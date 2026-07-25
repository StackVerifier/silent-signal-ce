import { mockDb } from '@/lib/mock-db'
import type {
  AccountStatus, Invitation, Member, RoleId, Team, Workspace,
} from '@/lib/rbac/types'
import { resolve, resolveMutation } from './transport'
import type { Paginated } from './http'

export interface MemberQuery {
  q?: string
  status?: AccountStatus | 'all'
  roleId?: RoleId | 'all'
  workspaceId?: string | 'all'
  teamId?: string | 'all'
  cursor?: string
  limit?: number
}

/**
 * People, invitations, teams and workspaces.
 *
 * Filtering is expressed as query params even in mock mode, so moving the work
 * server-side later needs no call-site change — the list page already passes
 * exactly what the endpoint will consume.
 */
export const memberService = {
  list: (params: MemberQuery = {}, signal?: AbortSignal) =>
    resolve<Paginated<Member>>({
      path: '/api/members',
      query: {
        q: params.q,
        status: params.status === 'all' ? undefined : params.status,
        role: params.roleId === 'all' ? undefined : params.roleId,
        workspace: params.workspaceId === 'all' ? undefined : params.workspaceId,
        team: params.teamId === 'all' ? undefined : params.teamId,
        cursor: params.cursor,
        limit: params.limit,
      },
      signal,
      mock: () => ({ data: mockDb.members(), pageInfo: { nextCursor: null, hasMore: false } }),
    }),

  approve: (memberId: string, actorId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/approve`,
      mock: () => mockDb.setMemberStatus(memberId, 'approved', actorId),
    }),

  reject: (memberId: string, actorId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/reject`,
      mock: () => mockDb.setMemberStatus(memberId, 'rejected', actorId),
    }),

  suspend: (memberId: string, actorId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/suspend`,
      mock: () => mockDb.setMemberStatus(memberId, 'suspended', actorId),
    }),

  activate: (memberId: string, actorId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/activate`,
      mock: () => mockDb.setMemberStatus(memberId, 'approved', actorId),
    }),

  remove: (memberId: string, actorId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/members/${memberId}`,
      method: 'DELETE',
      mock: () => mockDb.removeMember(memberId, actorId),
    }),

  bulk: (
    memberIds: string[],
    action: 'approve' | 'reject' | 'suspend' | 'activate',
    actorId: string,
  ) =>
    resolveMutation<{ updated: number }>({
      path: '/api/members/bulk',
      body: { ids: memberIds, action },
      mock: () => {
        const status = action === 'reject' ? 'rejected' : action === 'suspend' ? 'suspended' : 'approved'
        return mockDb.bulkMemberStatus(memberIds, status, actorId)
      },
    }),

  listInvitations: (signal?: AbortSignal) =>
    resolve<Invitation[]>({ path: '/api/invitations', signal, mock: () => mockDb.invitations() }),

  invite: (
    input: { email: string; roleId: RoleId; workspaceId: string; teamId?: string },
    actorId: string,
  ) =>
    resolveMutation<Invitation>({
      path: '/api/invitations',
      body: input,
      mock: () => mockDb.createInvitation(input, actorId),
    }),

  resendInvitation: (invitationId: string, actorId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/invitations/${invitationId}/resend`,
      mock: () => mockDb.resendInvitation(invitationId, actorId),
    }),

  cancelInvitation: (invitationId: string, actorId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/invitations/${invitationId}`,
      method: 'DELETE',
      mock: () => mockDb.cancelInvitation(invitationId, actorId),
    }),

  listTeams: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Team[]>({
      path: '/api/teams',
      query: { workspaceId },
      signal,
      mock: () => mockDb.teams(),
    }),

  listWorkspaces: (signal?: AbortSignal) =>
    resolve<Workspace[]>({ path: '/api/workspaces', signal, mock: () => mockDb.workspaces() }),

  createTeam: (
    input: { name: string; workspaceId: string; description?: string; releaseManagerId?: string; qaLeadId?: string },
    actorId: string,
  ) =>
    resolveMutation<Team>({
      path: '/api/teams',
      body: input,
      mock: () => mockDb.createTeam(input, actorId),
    }),

  updateTeam: (teamId: string, patch: Partial<Team>, actorId: string) =>
    resolveMutation<Team>({
      path: `/api/teams/${teamId}`,
      method: 'PATCH',
      body: patch,
      mock: () => mockDb.updateTeam(teamId, patch, actorId),
    }),

  deleteTeam: (teamId: string, actorId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/teams/${teamId}`,
      method: 'DELETE',
      mock: () => mockDb.deleteTeam(teamId, actorId),
    }),

  setTeamMembers: (teamId: string, memberIds: string[], actorId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/teams/${teamId}/members`,
      body: { memberIds },
      mock: () => mockDb.setTeamMembers(teamId, memberIds, actorId),
    }),
}
