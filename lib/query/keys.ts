import type { MemberQuery } from '@/services/member.service'
import type { AuditQuery } from '@/services/audit.service'

/**
 * Central query-key registry.
 *
 * Keys are workspace-scoped by construction, which is what makes the workspace
 * switcher correct: switching workspaces changes the key, so cached data from
 * another workspace can never be shown, and nothing needs manual invalidation.
 */
export const queryKeys = {
  dashboard: (workspaceId?: string) => ['dashboard', workspaceId] as const,
  signals: (workspaceId?: string) => ['signals', workspaceId] as const,

  sprints: (workspaceId?: string) => ['sprints', workspaceId] as const,
  sprint: (sprintId: string, workspaceId?: string) => ['sprints', workspaceId, sprintId] as const,

  releases: (workspaceId?: string) => ['releases', workspaceId] as const,
  release: (releaseId: string, workspaceId?: string) => ['releases', workspaceId, releaseId] as const,

  qaQueue: (workspaceId?: string) => ['qa', workspaceId, 'queue'] as const,
  qaTesters: (workspaceId?: string) => ['qa', workspaceId, 'testers'] as const,

  riskTimeline: (workspaceId?: string, range?: { from?: string; to?: string }) =>
    ['risk', workspaceId, range ?? {}] as const,

  rules: (workspaceId?: string) => ['rules', workspaceId] as const,

  jiraConnection: (workspaceId?: string) => ['jira', workspaceId, 'connection'] as const,
  jiraProjects: (workspaceId?: string) => ['jira', workspaceId, 'projects'] as const,
  jiraBoards: (workspaceId?: string, projectKey?: string) =>
    ['jira', workspaceId, 'boards', projectKey ?? null] as const,
  jiraSync: (workspaceId?: string) => ['jira', workspaceId, 'sync'] as const,
  jiraFields: (workspaceId?: string) => ['jira', workspaceId, 'fields'] as const,

  members: (params?: MemberQuery) => ['members', params ?? {}] as const,
  invitations: () => ['invitations'] as const,
  teams: (workspaceId?: string) => ['teams', workspaceId] as const,
  workspaces: () => ['workspaces'] as const,

  notifications: () => ['notifications'] as const,
  webhooks: (workspaceId?: string) => ['webhooks', workspaceId] as const,

  audit: (params?: AuditQuery) => ['audit', params ?? {}] as const,
} as const

/** Broad prefixes for invalidation after mutations. */
export const queryScopes = {
  allMembers: ['members'] as const,
  allInvitations: ['invitations'] as const,
  allJira: ['jira'] as const,
  allTeams: ['teams'] as const,
  allAudit: ['audit'] as const,
  allNotifications: ['notifications'] as const,
  allWebhooks: ['webhooks'] as const,
  allWorkspaces: ['workspaces'] as const,
  allRules: ['rules'] as const,
}
