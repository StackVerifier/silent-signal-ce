import { request } from './http'
import type { Integration } from '@/lib/types'

/**
 * Jira Cloud integration.
 *
 * Every call is proxied through our own API — the browser never holds a Jira
 * token. The OAuth exchange, refresh cycle and webhook receiver live in route
 * handlers reading `serverEnv()`.
 */

export interface JiraProject { id: string; key: string; name: string }
export interface JiraBoard { id: string; name: string; projectKey: string; type: 'scrum' | 'kanban' }
export type SyncState = 'idle' | 'syncing' | 'error' | 'never'

export interface JiraSyncStatus {
  state: SyncState
  lastSyncAt: string | null
  nextSyncAt: string | null
  lastError?: string
  rateLimitedUntil?: string | null
  syncedIssueCount: number
}

/** Custom field ids differ per Jira site, so they are mapped per workspace. */
export interface JiraFieldMapping {
  storyPoints: string | null
  sprint: string | null
  severity: string | null
  qaStatus: string | null
}

export const jiraService = {
  getConnection: (workspaceId?: string, signal?: AbortSignal) =>
    request<Integration | null>('/api/integrations/jira', { workspaceId, signal }),

  getSyncStatus: (workspaceId?: string, signal?: AbortSignal) =>
    request<JiraSyncStatus>('/api/integrations/jira/sync', { workspaceId, signal }),

  connect: (workspaceId?: string) =>
    request<{ redirectUrl: string }>('/api/integrations/jira', {
      method: 'POST', body: { action: 'connect' }, workspaceId,
    }),

  disconnect: (workspaceId?: string) =>
    request<{ ok: true }>('/api/integrations/jira', {
      method: 'POST', body: { action: 'disconnect' }, workspaceId,
    }),

  triggerSync: (workspaceId?: string) =>
    request<JiraSyncStatus>('/api/integrations/jira/sync', { method: 'POST', workspaceId }),

  listProjects: (workspaceId?: string, signal?: AbortSignal) =>
    request<JiraProject[]>('/api/integrations/jira/projects', { workspaceId, signal }),

  getFieldMapping: (workspaceId?: string, signal?: AbortSignal) =>
    request<JiraFieldMapping>('/api/integrations/jira/fields', { workspaceId, signal }),

  saveFieldMapping: (mapping: JiraFieldMapping, workspaceId?: string) =>
    request<JiraFieldMapping>('/api/integrations/jira/fields', {
      method: 'PUT', body: mapping, workspaceId,
    }),
}
