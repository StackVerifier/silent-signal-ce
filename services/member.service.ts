import { request, type Paginated } from './http'
import type { Invitation, Member, RoleId, Team, Workspace } from '@/lib/rbac/types'

export interface MemberQuery {
  q?: string
  status?: string
  roleId?: string
  workspaceId?: string
  teamId?: string
  cursor?: string
  limit?: number
}

type MemberAction = 'approve' | 'reject' | 'suspend' | 'activate' | 'remove'

export const memberService = {
  list: (params: MemberQuery = {}, signal?: AbortSignal) =>
    request<Paginated<Member>>('/api/members', { query: { ...params }, signal }),

  act: (memberId: string, action: MemberAction) =>
    request<Member | { ok: true }>(`/api/members/${memberId}`, {
      method: 'POST', body: { action },
    }),

  listInvitations: (signal?: AbortSignal) =>
    request<Invitation[]>('/api/invitations', { signal }),

  /** `acceptUrl` is returned once, at creation, and never again. */
  invite: (input: { email: string; roleId: RoleId; workspaceId: string; teamId?: string }) =>
    request<Invitation & { acceptUrl: string }>('/api/invitations', { method: 'POST', body: input }),

  invitationAction: (invitationId: string, action: 'resend' | 'cancel') =>
    request<{ ok: true; acceptUrl?: string }>(`/api/invitations/${invitationId}`, {
      method: 'POST', body: { action },
    }),

  listTeams: (workspaceId?: string, signal?: AbortSignal) =>
    request<Team[]>('/api/teams', { query: { workspaceId }, signal }),

  listWorkspaces: (signal?: AbortSignal) =>
    request<Workspace[]>('/api/workspaces', { signal }),

  createTeam: (input: {
    name: string; workspaceId: string; description?: string
    releaseManagerId?: string; qaLeadId?: string
  }) => request<Team>('/api/teams', { method: 'POST', body: input }),

  updateTeam: (teamId: string, patch: Partial<Team>) =>
    request<Team>(`/api/teams/${teamId}`, { method: 'PATCH', body: patch }),

  deleteTeam: (teamId: string) =>
    request<{ ok: true }>(`/api/teams/${teamId}`, { method: 'DELETE' }),

  setTeamMembers: (teamId: string, memberIds: string[]) =>
    request<{ ok: true }>(`/api/teams/${teamId}`, { method: 'POST', body: { memberIds } }),
}
