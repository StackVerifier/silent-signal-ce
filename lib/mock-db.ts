'use client'

import {
  mockInvitations, mockMembers, mockTeams, mockWorkspaces,
} from './mock-tenancy'
import { mockAuditLogs, mockIntegrations, mockNotifications } from './mock-data'
import type { Invitation, Member, Team, Workspace } from './rbac/types'
import type { AuditLog, Integration, Notification } from './types'

/**
 * Mutable mock database.
 *
 * Without this, every mutation was a no-op: the UI acknowledged an invite or a
 * team and the next read returned the untouched fixture. That is worse than no
 * button at all, because it teaches the operator to distrust the product.
 *
 * State is seeded from the fixtures, mutated in memory and mirrored to
 * localStorage so it survives a reload. It is a stand-in for the API, not a
 * cache: `NEXT_PUBLIC_API_MODE=live` bypasses this module entirely.
 */

const STORAGE_KEY = 'ss_mock_db_v1'

interface MockDatabase {
  members: Member[]
  invitations: Invitation[]
  teams: Team[]
  workspaces: Workspace[]
  notifications: Notification[]
  integrations: Integration[]
  auditLogs: AuditLog[]
}

function seed(): MockDatabase {
  return {
    members: structuredClone(mockMembers),
    invitations: structuredClone(mockInvitations),
    teams: structuredClone(mockTeams),
    workspaces: structuredClone(mockWorkspaces),
    notifications: structuredClone(mockNotifications),
    integrations: structuredClone(mockIntegrations),
    auditLogs: structuredClone(mockAuditLogs),
  }
}

/** JSON.parse loses Date objects; every persisted date is revived here. */
const DATE_KEYS = new Set([
  'createdAt', 'updatedAt', 'invitedAt', 'expiresAt', 'acceptedAt', 'resentAt',
  'approvedAt', 'lastActiveAt', 'emailVerifiedAt', 'archivedAt', 'lastSyncAt',
])

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const [key, item] of Object.entries(record)) {
      if (DATE_KEYS.has(key) && typeof item === 'string') record[key] = new Date(item)
      else if (item && typeof item === 'object') record[key] = reviveDates(item)
    }
  }
  return value
}

let database: MockDatabase | null = null

function load(): MockDatabase {
  if (database) return database

  if (typeof window === 'undefined') {
    database = seed()
    return database
  }

  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      database = reviveDates(JSON.parse(saved) as MockDatabase)
      return database
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  database = seed()
  persist()
  return database
}

function persist() {
  if (typeof window === 'undefined' || !database) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
  } catch {
    // Quota or private mode — in-memory state still works for this session.
  }
}

/** Applies a change and persists it. Returns whatever the mutator returns. */
function write<T>(mutate: (db: MockDatabase) => T): T {
  const db = load()
  const result = mutate(db)
  persist()
  return result
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Records an audit entry for a mutation. Kept alongside the write itself so the
 * activity feed and the compliance record cannot drift — the same invariant the
 * real implementation enforces with a database transaction.
 */
function audit(
  db: MockDatabase,
  entry: Pick<AuditLog, 'action' | 'resource' | 'resourceId'> &
    Partial<Pick<AuditLog, 'changes' | 'metadata' | 'workspaceId'>>,
  actorId: string,
) {
  const actor = db.members.find((member) => member.id === actorId) ?? db.members[0]
  db.auditLogs.unshift({
    id: id('audit'),
    organizationId: 'org-1',
    userId: actor.id,
    user: { id: actor.id, name: actor.name, email: actor.email, avatar: actor.avatar },
    createdAt: new Date(),
    ...entry,
  })
}

function notify(db: MockDatabase, notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
  db.notifications.unshift({
    id: id('notif'),
    read: false,
    createdAt: new Date(),
    ...notification,
  })
}

export const mockDb = {
  reset() {
    database = seed()
    persist()
  },

  // ─── Reads ──────────────────────────────────────────────────────────────────
  members: () => load().members,
  invitations: () => load().invitations,
  teams: () => load().teams,
  workspaces: () => load().workspaces,
  notifications: () => load().notifications,
  integrations: () => load().integrations,
  auditLogs: () => load().auditLogs,

  // ─── Members ────────────────────────────────────────────────────────────────
  setMemberStatus(memberId: string, status: Member['status'], actorId: string): Member {
    return write((db) => {
      const member = db.members.find((candidate) => candidate.id === memberId)
      if (!member) throw new Error('Member not found')

      const before = member.status
      member.status = status
      if (status === 'approved') {
        member.approvedById = actorId
        member.approvedAt = new Date()
      }

      const action =
        status === 'approved' ? (before === 'pending' ? 'approve' : 'activate')
        : status === 'rejected' ? 'reject'
        : status === 'suspended' ? 'suspend'
        : 'update'

      audit(db, {
        action, resource: 'member', resourceId: member.id,
        metadata: { member: member.name },
        changes: { status: { before, after: status } },
      }, actorId)

      if (before === 'pending' && status === 'approved') {
        notify(db, {
          userId: member.id, workspaceId: 'ws-1', type: 'admin', level: 'medium',
          title: 'Member approved',
          message: `${member.name} now has ${member.roleId.replace('_', ' ')} access`,
          link: '/members',
        })
      }
      return structuredClone(member)
    })
  },

  removeMember(memberId: string, actorId: string) {
    return write((db) => {
      const member = db.members.find((candidate) => candidate.id === memberId)
      if (!member) throw new Error('Member not found')
      db.members = db.members.filter((candidate) => candidate.id !== memberId)
      audit(db, {
        action: 'remove', resource: 'member', resourceId: memberId,
        metadata: { member: member.name },
      }, actorId)
      return { ok: true as const }
    })
  },

  bulkMemberStatus(memberIds: string[], status: Member['status'], actorId: string) {
    memberIds.forEach((memberId) => {
      try {
        mockDb.setMemberStatus(memberId, status, actorId)
      } catch {
        // A member removed in another tab should not fail the whole batch.
      }
    })
    return { updated: memberIds.length }
  },

  // ─── Invitations ────────────────────────────────────────────────────────────
  createInvitation(
    input: { email: string; roleId: Invitation['roleId']; workspaceId: string; teamId?: string },
    actorId: string,
  ): Invitation {
    return write((db) => {
      const email = input.email.trim().toLowerCase()
      if (db.members.some((member) => member.email.toLowerCase() === email)) {
        throw new Error('That email already belongs to a member of this organization')
      }
      if (db.invitations.some((invite) => invite.email.toLowerCase() === email && invite.status === 'pending')) {
        throw new Error('An invitation is already pending for that email')
      }

      const invitation: Invitation = {
        id: id('inv'),
        organizationId: 'org-1',
        email,
        roleId: input.roleId,
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        status: 'pending',
        token: '***',
        invitedById: actorId,
        invitedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        resendCount: 0,
      }
      db.invitations.unshift(invitation)
      audit(db, {
        action: 'invite', resource: 'invitation', resourceId: invitation.id,
        metadata: { invitedEmail: email },
      }, actorId)
      return structuredClone(invitation)
    })
  },

  resendInvitation(invitationId: string, actorId: string) {
    return write((db) => {
      const invitation = db.invitations.find((candidate) => candidate.id === invitationId)
      if (!invitation) throw new Error('Invitation not found')
      invitation.resentAt = new Date()
      invitation.resendCount += 1
      invitation.status = 'pending'
      invitation.expiresAt = new Date(Date.now() + 7 * 86400000)
      audit(db, {
        action: 'update', resource: 'invitation', resourceId: invitation.id,
        metadata: { invitedEmail: invitation.email, resent: true },
      }, actorId)
      return { ok: true as const }
    })
  },

  cancelInvitation(invitationId: string, actorId: string) {
    return write((db) => {
      const invitation = db.invitations.find((candidate) => candidate.id === invitationId)
      if (!invitation) throw new Error('Invitation not found')
      invitation.status = 'cancelled'
      audit(db, {
        action: 'delete', resource: 'invitation', resourceId: invitation.id,
        metadata: { invitedEmail: invitation.email },
      }, actorId)
      return { ok: true as const }
    })
  },

  /** Called by the scheduled job — expires invitations past their window. */
  expireInvitations(): number {
    return write((db) => {
      const now = Date.now()
      let expired = 0
      for (const invitation of db.invitations) {
        if (invitation.status === 'pending' && invitation.expiresAt.getTime() <= now) {
          invitation.status = 'expired'
          expired += 1
        }
      }
      return expired
    })
  },

  // ─── Teams ──────────────────────────────────────────────────────────────────
  createTeam(
    input: { name: string; workspaceId: string; description?: string; releaseManagerId?: string; qaLeadId?: string },
    actorId: string,
  ): Team {
    return write((db) => {
      const duplicate = db.teams.some(
        (team) =>
          team.workspaceId === input.workspaceId &&
          team.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
      )
      if (duplicate) throw new Error('A team with that name already exists in this workspace')

      const team: Team = {
        id: id('team'),
        organizationId: 'org-1',
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        releaseManagerId: input.releaseManagerId || undefined,
        qaLeadId: input.qaLeadId || undefined,
        createdAt: new Date(),
      }
      db.teams.push(team)
      audit(db, {
        action: 'create', resource: 'team', resourceId: team.id,
        workspaceId: team.workspaceId, metadata: { name: team.name },
      }, actorId)
      return structuredClone(team)
    })
  },

  updateTeam(teamId: string, patch: Partial<Team>, actorId: string): Team {
    return write((db) => {
      const team = db.teams.find((candidate) => candidate.id === teamId)
      if (!team) throw new Error('Team not found')
      Object.assign(team, patch)
      audit(db, {
        action: 'update', resource: 'team', resourceId: team.id,
        workspaceId: team.workspaceId, metadata: { name: team.name },
      }, actorId)
      return structuredClone(team)
    })
  },

  deleteTeam(teamId: string, actorId: string) {
    return write((db) => {
      const team = db.teams.find((candidate) => candidate.id === teamId)
      if (!team) throw new Error('Team not found')
      db.teams = db.teams.filter((candidate) => candidate.id !== teamId)
      // Membership must not dangle when its team disappears.
      db.members.forEach((member) => {
        member.teamIds = member.teamIds.filter((candidate) => candidate !== teamId)
      })
      audit(db, {
        action: 'delete', resource: 'team', resourceId: teamId,
        workspaceId: team.workspaceId, metadata: { name: team.name },
      }, actorId)
      return { ok: true as const }
    })
  },

  setTeamMembers(teamId: string, memberIds: string[], actorId: string) {
    return write((db) => {
      const team = db.teams.find((candidate) => candidate.id === teamId)
      if (!team) throw new Error('Team not found')
      db.members.forEach((member) => {
        const shouldBelong = memberIds.includes(member.id)
        const belongs = member.teamIds.includes(teamId)
        if (shouldBelong && !belongs) member.teamIds.push(teamId)
        if (!shouldBelong && belongs) {
          member.teamIds = member.teamIds.filter((candidate) => candidate !== teamId)
        }
      })
      audit(db, {
        action: 'transfer', resource: 'team', resourceId: teamId,
        workspaceId: team.workspaceId,
        metadata: { name: team.name, memberCount: memberIds.length },
      }, actorId)
      return { ok: true as const }
    })
  },

  // ─── Notifications ──────────────────────────────────────────────────────────
  markNotificationRead(notificationId: string) {
    return write((db) => {
      const notification = db.notifications.find((candidate) => candidate.id === notificationId)
      if (notification) notification.read = true
      return { ok: true as const }
    })
  },

  markAllNotificationsRead() {
    return write((db) => {
      db.notifications.forEach((notification) => { notification.read = true })
      return { ok: true as const }
    })
  },

  // ─── Integrations ───────────────────────────────────────────────────────────
  setIntegrationEnabled(type: Integration['type'], enabled: boolean, actorId: string): Integration {
    return write((db) => {
      let integration = db.integrations.find((candidate) => candidate.type === type)
      if (!integration) {
        integration = {
          id: id('int'),
          workspaceId: 'ws-1',
          type,
          name: type === 'jira' ? 'Jira Cloud' : type,
          enabled,
          config: {},
          createdAt: new Date(),
        }
        db.integrations.push(integration)
      }
      integration.enabled = enabled
      if (enabled) integration.lastSyncAt = new Date()

      audit(db, {
        action: 'update', resource: 'integration', resourceId: integration.id,
        metadata: { integration: integration.name },
        changes: { enabled: { before: !enabled, after: enabled } },
      }, actorId)
      return structuredClone(integration)
    })
  },

  recordSync(type: Integration['type'], issueCount: number) {
    return write((db) => {
      const integration = db.integrations.find((candidate) => candidate.type === type)
      if (integration) integration.lastSyncAt = new Date()
      notify(db, {
        userId: 'mem-1', workspaceId: 'ws-1', type: 'system', level: 'low',
        title: 'Jira sync completed',
        message: `${issueCount.toLocaleString()} issues synced`,
        link: '/integrations',
      })
      return { ok: true as const }
    })
  },
}
