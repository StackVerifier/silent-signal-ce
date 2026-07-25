import {
  mockInvitations, mockMembers, mockTeams, mockWorkspaces,
} from '@/lib/mock-tenancy'
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
      mock: () => ({ data: mockMembers, pageInfo: { nextCursor: null, hasMore: false } }),
    }),

  approve: (memberId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/approve`,
      mock: () => ({ ...mockMembers.find((m) => m.id === memberId)!, status: 'approved' as const }),
    }),

  reject: (memberId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/reject`,
      mock: () => ({ ...mockMembers.find((m) => m.id === memberId)!, status: 'rejected' as const }),
    }),

  suspend: (memberId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/suspend`,
      mock: () => ({ ...mockMembers.find((m) => m.id === memberId)!, status: 'suspended' as const }),
    }),

  activate: (memberId: string) =>
    resolveMutation<Member>({
      path: `/api/members/${memberId}/activate`,
      mock: () => ({ ...mockMembers.find((m) => m.id === memberId)!, status: 'approved' as const }),
    }),

  remove: (memberId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/members/${memberId}`,
      method: 'DELETE',
      mock: () => ({ ok: true }),
    }),

  bulk: (memberIds: string[], action: 'approve' | 'reject' | 'suspend' | 'activate') =>
    resolveMutation<{ updated: number }>({
      path: '/api/members/bulk',
      body: { ids: memberIds, action },
      mock: () => ({ updated: memberIds.length }),
    }),

  listInvitations: (signal?: AbortSignal) =>
    resolve<Invitation[]>({ path: '/api/invitations', signal, mock: () => mockInvitations }),

  invite: (input: { email: string; roleId: RoleId; workspaceId: string; teamId?: string }) =>
    resolveMutation<Invitation>({
      path: '/api/invitations',
      body: input,
      mock: () => ({
        id: `inv-${Date.now()}`,
        organizationId: 'org-1',
        status: 'pending' as const,
        token: '***',
        invitedById: 'mem-1',
        invitedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        resendCount: 0,
        ...input,
      }),
    }),

  resendInvitation: (invitationId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/invitations/${invitationId}/resend`,
      mock: () => ({ ok: true }),
    }),

  cancelInvitation: (invitationId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/invitations/${invitationId}`,
      method: 'DELETE',
      mock: () => ({ ok: true }),
    }),

  listTeams: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Team[]>({
      path: '/api/teams',
      query: { workspaceId },
      signal,
      mock: () => mockTeams,
    }),

  listWorkspaces: (signal?: AbortSignal) =>
    resolve<Workspace[]>({ path: '/api/workspaces', signal, mock: () => mockWorkspaces }),
}
