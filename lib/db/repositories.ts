import 'server-only'
import { all, fromBit, newId, nowIso, one, run, toBit, toDate, transaction } from './driver'
import { decryptSecret, encryptSecret, maskUrl } from './crypto'
import type {
  AccountStatus, Invitation, InvitationStatus, Member, Organization, RoleId, Team, Workspace,
} from '@/lib/rbac/types'
import type {
  AuditAction, AuditLog, AuditResource, Integration, Notification, NotificationLevel, Rule,
} from '@/lib/types'
import { writeAudit } from '@/lib/audit/repository'
import { diffFields } from '@/lib/audit/redact'
import type { AuditEventId } from '@/lib/audit/events'

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface MemberRow {
  id: string; organization_id: string; user_id: string; email: string; name: string
  avatar: string | null; role_id: string; status: string
  email_verified_at: string | null; invited_by_id: string | null; invited_at: string | null
  approved_by_id: string | null; approved_at: string | null; last_active_at: string | null
  password_hash: string | null; must_change_password: number | boolean
  password_changed_at: string | null
  created_at: string
}

async function hydrateMember(row: MemberRow): Promise<Member> {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    avatar: row.avatar ?? undefined,
    roleId: row.role_id as RoleId,
    status: row.status as AccountStatus,
    workspaceIds: (await all<{ workspace_id: string }>(
      'SELECT workspace_id FROM member_workspace WHERE member_id = ?', row.id,
    )).map((item) => item.workspace_id),
    teamIds: (await all<{ team_id: string }>(
      'SELECT team_id FROM member_team WHERE member_id = ?', row.id,
    )).map((item) => item.team_id),
    emailVerifiedAt: toDate(row.email_verified_at),
    invitedById: row.invited_by_id ?? undefined,
    invitedAt: toDate(row.invited_at),
    approvedById: row.approved_by_id ?? undefined,
    approvedAt: toDate(row.approved_at),
    lastActiveAt: toDate(row.last_active_at),
    mustChangePassword: fromBit(row.must_change_password),
    createdAt: new Date(row.created_at),
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  organizationId: string
  workspaceId?: string | null
  actorId: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
}

/**
 * Writes an audit record. Always called inside the same transaction as the
 * mutation it describes, so an action cannot succeed without leaving a trace.
 *
 * @deprecated Use `writeAudit` with a named event from the catalogue. This
 * remains only for callers not yet migrated; it records `system.job_run`, which
 * is honest about telling the reader nothing rather than guessing an event.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const actor = await one<MemberRow>('SELECT * FROM member WHERE id = ?', entry.actorId)
  await run(
    `INSERT INTO audit_log
       (organization_id, workspace_id, actor_id, actor_name, actor_email, actor_avatar,
        action, resource, resource_id, changes, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.organizationId,
    entry.workspaceId ?? null,
    entry.actorId,
    actor?.name ?? 'System',
    actor?.email ?? 'system@silentsignal.io',
    actor?.avatar ?? null,
    entry.action,
    entry.resource,
    entry.resourceId ?? null,
    entry.changes ? JSON.stringify(entry.changes) : null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
    nowIso(),
  )
}

export const auditRepo = {
  async list(organizationId: string, limit = 50): Promise<AuditLog[]> {
    return (await all<{
      id: number; organization_id: string; workspace_id: string | null
      actor_id: string | null; actor_name: string; actor_email: string; actor_avatar: string | null
      action: string; resource: string; resource_id: string | null
      changes: string | null; metadata: string | null; created_at: string
    }>(
      `SELECT * FROM audit_log WHERE organization_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`,
      organizationId, limit,
    )).map((row) => ({
      id: String(row.id),
      organizationId: row.organization_id,
      workspaceId: row.workspace_id ?? undefined,
      userId: row.actor_id ?? '',
      user: {
        id: row.actor_id ?? '',
        name: row.actor_name,
        email: row.actor_email,
        avatar: row.actor_avatar ?? undefined,
      },
      action: row.action as AuditAction,
      resource: row.resource as AuditResource,
      resourceId: row.resource_id ?? '',
      changes: row.changes ? JSON.parse(row.changes) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    }))
  },
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationRepo = {
  async listForMember(memberId: string, limit = 50): Promise<Notification[]> {
    return (await all<{
      id: string; member_id: string; workspace_id: string; type: string; level: string
      title: string; message: string; link: string | null; read: number; created_at: string
    }>(
      'SELECT * FROM notification WHERE member_id = ? ORDER BY created_at DESC LIMIT ?',
      memberId, limit,
    )).map((row) => ({
      id: row.id,
      userId: row.member_id,
      workspaceId: row.workspace_id,
      type: row.type as Notification['type'],
      level: row.level as NotificationLevel,
      title: row.title,
      message: row.message,
      link: row.link ?? undefined,
      read: fromBit(row.read),
      createdAt: new Date(row.created_at),
    }))
  },

  async create(input: {
    memberId: string; workspaceId: string; type: Notification['type']
    level: NotificationLevel; title: string; message: string; link?: string
  }): Promise<void> {
    await run(
      `INSERT INTO notification (id, member_id, workspace_id, type, level, title, message, link, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId('notif'), input.memberId, input.workspaceId, input.type, input.level,
      input.title, input.message, input.link ?? null, toBit(false), nowIso(),
    )
  },

  async markRead(notificationId: string, memberId: string): Promise<void> {
    await run('UPDATE notification SET read = ? WHERE id = ? AND member_id = ?', toBit(true), notificationId, memberId)
  },

  async markAllRead(memberId: string): Promise<void> {
    await run('UPDATE notification SET read = ? WHERE member_id = ?', toBit(true), memberId)
  },
}

// ─── Tenancy ──────────────────────────────────────────────────────────────────

export const orgRepo = {
  async get(organizationId: string): Promise<Organization | null> {
    const row = await one<{
      id: string; name: string; slug: string; logo: string | null; plan: string
      sso_enabled: number; sso_provider: string | null; verified_domains: string
      settings: string; created_at: string
    }>('SELECT * FROM organization WHERE id = ?', organizationId)
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo ?? undefined,
      plan: row.plan as Organization['plan'],
      ssoEnabled: fromBit(row.sso_enabled),
      ssoProvider: (row.sso_provider ?? undefined) as Organization['ssoProvider'],
      verifiedDomains: JSON.parse(row.verified_domains),
      settings: JSON.parse(row.settings),
      createdAt: new Date(row.created_at),
    }
  },
}

export const workspaceRepo = {
  async list(organizationId: string): Promise<Workspace[]> {
    return (await all<{
      id: string; organization_id: string; name: string; slug: string
      description: string | null; status: string; integration_ids: string
      created_at: string; updated_at: string; archived_at: string | null
    }>(
      'SELECT * FROM workspace WHERE organization_id = ? ORDER BY created_at',
      organizationId,
    )).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      status: row.status as Workspace['status'],
      integrationIds: JSON.parse(row.integration_ids),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      archivedAt: toDate(row.archived_at),
    }))
  },
}

export const memberRepo = {
  async list(organizationId: string): Promise<Member[]> {
    const rows = await all<MemberRow>(
      'SELECT * FROM member WHERE organization_id = ? ORDER BY name',
      organizationId,
    )
    return Promise.all(rows.map(hydrateMember))
  },

  async get(memberId: string): Promise<Member | null> {
    const row = await one<MemberRow>('SELECT * FROM member WHERE id = ?', memberId)
    return row ? hydrateMember(row) : null
  },

  /** Server-side only — the hash never leaves this module's callers. */
  async credentialsFor(
    email: string,
  ): Promise<{ memberId: string; organizationId: string; passwordHash: string | null } | null> {
    const row = await one<{ id: string; organization_id: string; password_hash: string | null }>(
      'SELECT id, organization_id, password_hash FROM member WHERE lower(email) = lower(?)',
      email.trim(),
    )
    return row
      ? { memberId: row.id, organizationId: row.organization_id, passwordHash: row.password_hash }
      : null
  },

  async setPassword(memberId: string, passwordHash: string, actorId: string): Promise<void> {
    await transaction(async () => {
      const member = await one<MemberRow>('SELECT * FROM member WHERE id = ?', memberId)
      if (!member) throw new NotFoundError('Member not found')
      await run(
        `UPDATE member SET password_hash = ?, must_change_password = ?, password_changed_at = ?
         WHERE id = ?`,
        passwordHash, toBit(false), nowIso(), memberId,
      )
      // The audit record deliberately carries no password material.
      await writeAudit({
        event: 'auth.password_changed',
        organizationId: member.organization_id,
        actorId,
        target: { type: 'member', id: memberId, name: member.name, email: member.email },
      })
    })
  },

  async touchLastActive(memberId: string): Promise<void> {
    await run('UPDATE member SET last_active_at = ? WHERE id = ?', nowIso(), memberId)
  },

  async findByEmail(email: string): Promise<Member | null> {
    const row = await one<MemberRow>(
      'SELECT * FROM member WHERE lower(email) = lower(?)', email.trim(),
    )
    return row ? hydrateMember(row) : null
  },

  async setStatus(memberId: string, status: AccountStatus, actorId: string): Promise<Member> {
    return transaction(async () => {
      const before = await one<MemberRow>('SELECT * FROM member WHERE id = ?', memberId)
      if (!before) throw new NotFoundError('Member not found')

      const approving = status === 'approved'
      await run(
        `UPDATE member SET status = ?,
           approved_by_id = CASE WHEN ? THEN ? ELSE approved_by_id END,
           approved_at    = CASE WHEN ? THEN ? ELSE approved_at END
         WHERE id = ?`,
        status, toBit(approving), actorId, toBit(approving), nowIso(), memberId,
      )

      const event: AuditEventId =
        status === 'approved' ? (before.status === 'pending' ? 'member.approved' : 'member.activated')
        : status === 'rejected' ? 'member.rejected'
        : status === 'suspended' ? 'member.suspended'
        : 'member.updated'

      writeAudit({
        event,
        organizationId: before.organization_id,
        actorId,
        target: { type: 'member', id: memberId, name: before.name, email: before.email },
        changes: { status: { before: before.status, after: status } },
      })

      // Tell the newly approved member their access is live.
      if (before.status === 'pending' && status === 'approved') {
        const workspace = await one<{ workspace_id: string }>(
          'SELECT workspace_id FROM member_workspace WHERE member_id = ? LIMIT 1', memberId,
        )
        if (workspace) {
          notificationRepo.create({
            memberId, workspaceId: workspace.workspace_id, type: 'admin', level: 'medium',
            title: 'Your access has been approved',
            message: 'Dashboards are live. Welcome to Silent Signal.',
            link: '/',
          })
        }
      }

      return (await memberRepo.get(memberId))!
    })
  },

  async remove(memberId: string, actorId: string): Promise<void> {
    await transaction(async () => {
      const member = await one<MemberRow>('SELECT * FROM member WHERE id = ?', memberId)
      if (!member) throw new NotFoundError('Member not found')
      // Cascades clear member_workspace, member_team and notifications.
      await run('DELETE FROM member WHERE id = ?', memberId)
      writeAudit({
        event: 'member.removed',
        organizationId: member.organization_id,
        actorId,
        target: { type: 'member', id: memberId, name: member.name, email: member.email },
      })
    })
  },
}

export const teamRepo = {
  async list(organizationId: string, workspaceId?: string): Promise<Team[]> {
    const rows = workspaceId
      ? await all<Record<string, string | null>>(
          'SELECT * FROM team WHERE organization_id = ? AND workspace_id = ? ORDER BY name',
          organizationId, workspaceId,
        )
      : await all<Record<string, string | null>>(
          'SELECT * FROM team WHERE organization_id = ? ORDER BY name', organizationId,
        )

    return rows.map((row) => ({
      id: row.id as string,
      organizationId: row.organization_id as string,
      workspaceId: row.workspace_id as string,
      name: row.name as string,
      description: row.description ?? undefined,
      releaseManagerId: row.release_manager_id ?? undefined,
      qaLeadId: row.qa_lead_id ?? undefined,
      createdAt: new Date(row.created_at as string),
    }))
  },

  async create(
    input: {
      organizationId: string; workspaceId: string; name: string; description?: string
      releaseManagerId?: string; qaLeadId?: string
    },
    actorId: string,
  ): Promise<Team> {
    return transaction(async () => {
      const duplicate = await one<{ id: string }>(
        'SELECT id FROM team WHERE workspace_id = ? AND lower(name) = lower(?)',
        input.workspaceId, input.name.trim(),
      )
      if (duplicate) {
        throw new ConflictError('A team with that name already exists in this workspace')
      }

      const id = newId('team')
      await run(
        `INSERT INTO team (id, organization_id, workspace_id, name, description,
                           release_manager_id, qa_lead_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id, input.organizationId, input.workspaceId, input.name.trim(),
        input.description?.trim() || null,
        input.releaseManagerId || null, input.qaLeadId || null, nowIso(),
      )
      writeAudit({
        event: 'team.created',
        organizationId: input.organizationId, workspaceId: input.workspaceId,
        actorId,
        target: { type: 'team', id, name: input.name },
      })
      return (await teamRepo.list(input.organizationId)).find((team) => team.id === id)!
    })
  },

  async update(teamId: string, patch: Partial<Team>, actorId: string): Promise<Team> {
    return transaction(async () => {
      const existing = await one<Record<string, string | null>>('SELECT * FROM team WHERE id = ?', teamId)
      if (!existing) throw new NotFoundError('Team not found')

      await run(
        `UPDATE team SET name = ?, description = ?, workspace_id = ?,
                         release_manager_id = ?, qa_lead_id = ?
         WHERE id = ?`,
        patch.name?.trim() ?? existing.name,
        patch.description?.trim() ?? existing.description,
        patch.workspaceId ?? existing.workspace_id,
        patch.releaseManagerId ?? existing.release_manager_id,
        patch.qaLeadId ?? existing.qa_lead_id,
        teamId,
      )
      writeAudit({
        event: 'team.updated',
        organizationId: existing.organization_id as string,
        workspaceId: (patch.workspaceId ?? existing.workspace_id) as string,
        actorId,
        target: { type: 'team', id: teamId, name: (patch.name ?? existing.name) as string },
        changes: diffFields(
          existing as Record<string, unknown>,
          { name: patch.name, description: patch.description, workspace_id: patch.workspaceId },
          ['name', 'description', 'workspace_id'],
        ),
      })
      return (await teamRepo.list(existing.organization_id as string)).find((team) => team.id === teamId)!
    })
  },

  async remove(teamId: string, actorId: string): Promise<void> {
    await transaction(async () => {
      const existing = await one<Record<string, string | null>>('SELECT * FROM team WHERE id = ?', teamId)
      if (!existing) throw new NotFoundError('Team not found')
      await run('DELETE FROM team WHERE id = ?', teamId)   // member_team cascades
      writeAudit({
        event: 'team.deleted',
        organizationId: existing.organization_id as string,
        workspaceId: existing.workspace_id as string,
        actorId,
        target: { type: 'team', id: teamId, name: existing.name as string },
      })
    })
  },

  async setMembers(teamId: string, memberIds: string[], actorId: string): Promise<void> {
    await transaction(async () => {
      const existing = await one<Record<string, string | null>>('SELECT * FROM team WHERE id = ?', teamId)
      if (!existing) throw new NotFoundError('Team not found')

      await run('DELETE FROM member_team WHERE team_id = ?', teamId)
      for (const memberId of memberIds) {
        await run('INSERT OR IGNORE INTO member_team (member_id, team_id) VALUES (?, ?)', memberId, teamId)
      }
      writeAudit({
        event: 'team.members_changed',
        organizationId: existing.organization_id as string,
        workspaceId: existing.workspace_id as string,
        actorId,
        target: { type: 'team', id: teamId, name: existing.name as string },
        metadata: { memberCount: memberIds.length },
      })
    })
  },
}

export const invitationRepo = {
  async list(organizationId: string): Promise<Invitation[]> {
    const rows = await all<Record<string, string | number | null>>(
      'SELECT * FROM invitation WHERE organization_id = ? ORDER BY invited_at DESC',
      organizationId,
    )
    return rows.map((row) => ({
      id: row.id as string,
      organizationId: row.organization_id as string,
      email: row.email as string,
      roleId: row.role_id as RoleId,
      workspaceId: row.workspace_id as string,
      teamId: (row.team_id ?? undefined) as string | undefined,
      status: row.status as InvitationStatus,
      // The token never leaves the server; list responses carry a placeholder.
      token: '***',
      invitedById: row.invited_by_id as string,
      invitedAt: new Date(row.invited_at as string),
      expiresAt: new Date(row.expires_at as string),
      acceptedAt: toDate(row.accepted_at as string | null),
      resentAt: toDate(row.resent_at as string | null),
      resendCount: row.resend_count as number,
    }))
  },

  async create(
    input: {
      organizationId: string; email: string; roleId: RoleId
      workspaceId: string; teamId?: string; expiryDays: number
    },
    actorId: string,
  ): Promise<Invitation> {
    return transaction(async () => {
      const email = input.email.trim().toLowerCase()

      if (await one<{ id: string }>('SELECT id FROM member WHERE organization_id = ? AND lower(email) = ?', input.organizationId, email)) {
        throw new ConflictError('That email already belongs to a member of this organization')
      }
      if (await one<{ id: string }>("SELECT id FROM invitation WHERE organization_id = ? AND lower(email) = ? AND status = 'pending'", input.organizationId, email)) {
        throw new ConflictError('An invitation is already pending for that email')
      }

      const id = newId('inv')
      await run(
        `INSERT INTO invitation
           (id, organization_id, email, role_id, workspace_id, team_id, status,
            token_hash, invited_by_id, invited_at, expires_at, resend_count)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0)`,
        id, input.organizationId, email, input.roleId, input.workspaceId,
        input.teamId ?? null, newId('tok'), actorId, nowIso(),
        new Date(Date.now() + input.expiryDays * 86400000).toISOString(),
      )
      writeAudit({
        event: 'member.invited',
        organizationId: input.organizationId, workspaceId: input.workspaceId,
        actorId,
        target: { type: 'invitation', id, email },
        metadata: { roleId: input.roleId },
      })
      return (await invitationRepo.list(input.organizationId)).find((item) => item.id === id)!
    })
  },

  async resend(invitationId: string, actorId: string, expiryDays: number): Promise<void> {
    await transaction(async () => {
      const existing = await one<Record<string, string | number | null>>(
        'SELECT * FROM invitation WHERE id = ?', invitationId,
      )
      if (!existing) throw new NotFoundError('Invitation not found')

      await run(
        `UPDATE invitation SET status = 'pending', resent_at = ?, expires_at = ?,
                               resend_count = resend_count + 1
         WHERE id = ?`,
        nowIso(), new Date(Date.now() + expiryDays * 86400000).toISOString(), invitationId,
      )
      writeAudit({
        event: 'member.invite_resent',
        organizationId: existing.organization_id as string,
        actorId,
        target: { type: 'invitation', id: invitationId, email: existing.email as string },
      })
    })
  },

  async cancel(invitationId: string, actorId: string): Promise<void> {
    await transaction(async () => {
      const existing = await one<Record<string, string | null>>(
        'SELECT * FROM invitation WHERE id = ?', invitationId,
      )
      if (!existing) throw new NotFoundError('Invitation not found')
      await run("UPDATE invitation SET status = 'cancelled' WHERE id = ?", invitationId)
      writeAudit({
        event: 'member.invite_revoked',
        organizationId: existing.organization_id as string,
        actorId,
        target: { type: 'invitation', id: invitationId, email: existing.email as string },
      })
    })
  },

  /** Called by the scheduled job. */
  async expireOverdue(): Promise<number> {
    const overdue = await all<{ id: string }>(
      "SELECT id FROM invitation WHERE status = 'pending' AND expires_at <= ?", nowIso(),
    )
    for (const item of overdue) {
      await run("UPDATE invitation SET status = 'expired' WHERE id = ?", item.id)
    }
    return overdue.length
  },
}

// ─── Integrations & webhooks ──────────────────────────────────────────────────

export const integrationRepo = {
  async list(workspaceId: string): Promise<Integration[]> {
    return (await all<{
      id: string; workspace_id: string; type: string; name: string; enabled: number
      config: string; last_sync_at: string | null; created_at: string
    }>('SELECT * FROM integration WHERE workspace_id = ?', workspaceId)).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type as Integration['type'],
      name: row.name,
      enabled: fromBit(row.enabled),
      // Config may hold credentials; never returned to the client verbatim.
      config: {},
      lastSyncAt: toDate(row.last_sync_at),
      createdAt: new Date(row.created_at),
    }))
  },

  async setEnabled(
    workspaceId: string, type: Integration['type'], enabled: boolean, actorId: string,
    organizationId: string,
  ): Promise<Integration> {
    return transaction(async () => {
      const existing = await one<{ id: string; enabled: number }>(
        'SELECT id, enabled FROM integration WHERE workspace_id = ? AND type = ?',
        workspaceId, type,
      )

      if (existing) {
        await run(
          'UPDATE integration SET enabled = ?, last_sync_at = CASE WHEN ? THEN ? ELSE last_sync_at END WHERE id = ?',
          toBit(enabled), toBit(enabled), nowIso(), existing.id,
        )
      } else {
        await run(
          `INSERT INTO integration (id, workspace_id, type, name, enabled, config, last_sync_at, created_at)
           VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`,
          newId('int'), workspaceId, type, type === 'jira' ? 'Jira Cloud' : type,
          toBit(enabled), enabled ? nowIso() : null, nowIso(),
        )
      }

      writeAudit({
        event: enabled ? 'integration.connected' : 'integration.disconnected',
        organizationId, workspaceId, actorId,
        target: { type: 'integration', id: type, name: type },
        changes: { enabled: { before: existing ? fromBit(existing.enabled) : false, after: enabled } },
      })

      return (await integrationRepo.list(workspaceId)).find((item) => item.type === type)!
    })
  },

  async recordSync(workspaceId: string, type: Integration['type']): Promise<void> {
    await run(
      'UPDATE integration SET last_sync_at = ? WHERE workspace_id = ? AND type = ?',
      nowIso(), workspaceId, type,
    )
  },
}

export type WebhookChannel = 'slack' | 'teams' | 'email'

/** What the client is allowed to see — never the URL itself. */
export interface WebhookEndpointView {
  id: string
  workspaceId: string
  channel: WebhookChannel
  label: string
  urlHint: string
  minimumLevel: NotificationLevel
  enabled: boolean
  quietHours: { start: string; end: string; timezone: string } | null
  lastStatus: 'ok' | 'failed' | 'untested' | null
  lastError: string | null
  lastTestedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface WebhookRow {
  id: string; workspace_id: string; channel: string; label: string
  url_encrypted: string; url_hint: string; minimum_level: string; enabled: number
  quiet_hours: string | null; last_status: string | null; last_error: string | null
  last_tested_at: string | null; created_at: string; updated_at: string
}

function hydrateWebhook(row: WebhookRow): WebhookEndpointView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    channel: row.channel as WebhookChannel,
    label: row.label,
    urlHint: row.url_hint,
    minimumLevel: row.minimum_level as NotificationLevel,
    enabled: fromBit(row.enabled),
    quietHours: row.quiet_hours ? JSON.parse(row.quiet_hours) : null,
    lastStatus: (row.last_status ?? null) as WebhookEndpointView['lastStatus'],
    lastError: row.last_error,
    lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const webhookRepo = {
  async list(workspaceId: string): Promise<WebhookEndpointView[]> {
    const rows = await all<WebhookRow>(
      'SELECT * FROM webhook_endpoint WHERE workspace_id = ? ORDER BY channel, label',
      workspaceId,
    )
    return rows.map(hydrateWebhook)
  },

  /** Server-side only: the decrypted URL, for actually delivering a message. */
  async getUrl(webhookId: string): Promise<string | null> {
    const row = await one<{ url_encrypted: string }>(
      'SELECT url_encrypted FROM webhook_endpoint WHERE id = ?', webhookId,
    )
    if (!row) return null
    // A key rotation or a corrupt row must not take delivery down entirely.
    try {
      return decryptSecret(row.url_encrypted)
    } catch {
      return null
    }
  },

  async create(
    input: {
      workspaceId: string; organizationId: string; channel: WebhookChannel
      label: string; url: string; minimumLevel: NotificationLevel; enabled: boolean
      quietHours?: { start: string; end: string; timezone: string } | null
    },
    actorId: string,
  ): Promise<WebhookEndpointView> {
    return transaction(async () => {
      const id = newId('wh')
      await run(
        `INSERT INTO webhook_endpoint
           (id, workspace_id, channel, label, url_encrypted, url_hint, minimum_level,
            enabled, quiet_hours, last_status, created_by_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'untested', ?, ?, ?)`,
        id, input.workspaceId, input.channel, input.label.trim(),
        encryptSecret(input.url), maskUrl(input.url), input.minimumLevel,
        toBit(input.enabled), input.quietHours ? JSON.stringify(input.quietHours) : null,
        actorId, nowIso(), nowIso(),
      )
      writeAudit({
        event: 'notification.endpoint_created',
        organizationId: input.organizationId, workspaceId: input.workspaceId,
        actorId,
        // The URL is a credential; only the channel and label are recorded, and
        // the masker would catch it even if that changed.
        target: { type: 'webhook', id, name: input.label },
        metadata: { channel: input.channel },
        relations: { notificationChannel: input.channel },
      })
      return (await webhookRepo.list(input.workspaceId)).find((item) => item.id === id)!
    })
  },

  async update(
    webhookId: string,
    patch: {
      label?: string; url?: string; minimumLevel?: NotificationLevel
      enabled?: boolean; quietHours?: { start: string; end: string; timezone: string } | null
    },
    actorId: string,
    organizationId: string,
  ): Promise<WebhookEndpointView> {
    return transaction(async () => {
      const existing = await one<WebhookRow>('SELECT * FROM webhook_endpoint WHERE id = ?', webhookId)
      if (!existing) throw new NotFoundError('Webhook not found')

      // An omitted URL means "leave it alone" — editing a label must not force
      // the operator to paste the secret again.
      const urlEncrypted = patch.url ? encryptSecret(patch.url) : existing.url_encrypted
      const urlHint = patch.url ? maskUrl(patch.url) : existing.url_hint

      await run(
        `UPDATE webhook_endpoint
            SET label = ?, url_encrypted = ?, url_hint = ?, minimum_level = ?,
                enabled = ?, quiet_hours = ?, updated_at = ?,
                last_status = CASE WHEN ? THEN 'untested' ELSE last_status END
          WHERE id = ?`,
        patch.label?.trim() ?? existing.label,
        urlEncrypted, urlHint,
        patch.minimumLevel ?? existing.minimum_level,
        patch.enabled === undefined ? existing.enabled : toBit(patch.enabled),
        patch.quietHours === undefined
          ? existing.quiet_hours
          : patch.quietHours ? JSON.stringify(patch.quietHours) : null,
        nowIso(), toBit(Boolean(patch.url)), webhookId,
      )

      writeAudit({
        event: 'notification.endpoint_updated',
        organizationId, workspaceId: existing.workspace_id,
        actorId,
        target: { type: 'webhook', id: webhookId, name: patch.label ?? existing.label },
        metadata: { channel: existing.channel, urlRotated: Boolean(patch.url) },
        changes: diffFields(
          { label: existing.label, minimumLevel: existing.minimum_level, enabled: fromBit(existing.enabled) },
          { label: patch.label, minimumLevel: patch.minimumLevel, enabled: patch.enabled },
          ['label', 'minimumLevel', 'enabled'],
        ),
        relations: { notificationChannel: existing.channel },
      })
      return (await webhookRepo.list(existing.workspace_id)).find((item) => item.id === webhookId)!
    })
  },

  async remove(webhookId: string, actorId: string, organizationId: string): Promise<void> {
    await transaction(async () => {
      const existing = await one<WebhookRow>('SELECT * FROM webhook_endpoint WHERE id = ?', webhookId)
      if (!existing) throw new NotFoundError('Webhook not found')
      await run('DELETE FROM webhook_endpoint WHERE id = ?', webhookId)
      writeAudit({
        event: 'notification.endpoint_deleted',
        organizationId, workspaceId: existing.workspace_id,
        actorId,
        target: { type: 'webhook', id: webhookId, name: existing.label },
        metadata: { channel: existing.channel },
        relations: { notificationChannel: existing.channel },
      })
    })
  },

  async recordTest(webhookId: string, ok: boolean, error?: string): Promise<void> {
    await run(
      'UPDATE webhook_endpoint SET last_status = ?, last_error = ?, last_tested_at = ? WHERE id = ?',
      ok ? 'ok' : 'failed', error ?? null, nowIso(), webhookId,
    )
  },
}

// ─── Delivery data ────────────────────────────────────────────────────────────

async function payloads<T>(table: string, workspaceId: string, extra = ''): Promise<T[]> {
  const rows = await all<{ payload: string }>(
    `SELECT payload FROM ${table} WHERE workspace_id = ? ${extra}`, workspaceId,
  )
  return rows.map((row) => JSON.parse(row.payload) as T)
}

export const deliveryRepo = {
  sprints: <T>(workspaceId: string) =>
    payloads<T>('sprint', workspaceId, 'ORDER BY start_date DESC'),
  releases: <T>(workspaceId: string) =>
    payloads<T>('release', workspaceId, 'ORDER BY target_date'),
  qaQueue: <T>(workspaceId: string) =>
    payloads<T>('qa_item', workspaceId),
  qaTesters: <T>(workspaceId: string) =>
    payloads<T>('qa_tester', workspaceId),
  riskTimeline: <T>(workspaceId: string) =>
    payloads<T>('risk_event', workspaceId, 'ORDER BY occurred_at DESC'),
  serviceHealth: <T>(workspaceId: string) =>
    payloads<T>('service_health', workspaceId),
  async signals<T>(workspaceId: string, kind: 'signal' | 'live'): Promise<T[]> {
    const rows = await all<{ payload: string }>(
      'SELECT payload FROM signal WHERE workspace_id = ? AND kind = ?', workspaceId, kind,
    )
    return rows.map((row) => JSON.parse(row.payload) as T)
  },

  async metrics<T>(workspaceId: string): Promise<T | null> {
    const row = await one<{ payload: string }>(
      'SELECT payload FROM dashboard_metrics WHERE workspace_id = ?', workspaceId,
    )
    return row ? (JSON.parse(row.payload) as T) : null
  },

  async billing<T>(workspaceId: string): Promise<T | null> {
    const row = await one<{ payload: string }>(
      'SELECT payload FROM billing WHERE workspace_id = ?', workspaceId,
    )
    return row ? (JSON.parse(row.payload) as T) : null
  },
}

export const ruleRepo = {
  async list(workspaceId: string): Promise<Rule[]> {
    return (await all<{
      id: string; name: string; category: string; enabled: number; action: string
      score_impact: number; description: string; conditions: string
      triggered_count: number; last_triggered: string | null
    }>('SELECT * FROM rule WHERE workspace_id = ? ORDER BY name', workspaceId)).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as Rule['category'],
      enabled: fromBit(row.enabled),
      conditions: JSON.parse(row.conditions),
      action: row.action as Rule['action'],
      scoreImpact: row.score_impact,
      description: row.description,
      triggeredCount: row.triggered_count,
      lastTriggered: toDate(row.last_triggered),
    }))
  },

  async setEnabled(
    ruleId: string, enabled: boolean, workspaceId: string,
    actorId: string, organizationId: string,
  ): Promise<Rule> {
    return transaction(async () => {
      const existing = await one<{ id: string; name: string; enabled: number }>(
        'SELECT id, name, enabled FROM rule WHERE id = ? AND workspace_id = ?',
        ruleId, workspaceId,
      )
      if (!existing) throw new NotFoundError('Rule not found')

      await run('UPDATE rule SET enabled = ? WHERE id = ?', toBit(enabled), ruleId)
      writeAudit({
        event: enabled ? 'rule.enabled' : 'rule.disabled',
        organizationId, workspaceId, actorId,
        target: { type: 'rule', id: ruleId, name: existing.name },
        changes: { enabled: { before: fromBit(existing.enabled), after: enabled } },
        relations: { ruleId, ruleName: existing.name },
      })
      return (await ruleRepo.list(workspaceId)).find((rule) => rule.id === ruleId)!
    })
  },
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}
