import { mockIntegrations } from '@/lib/mock-data'
import type { Integration } from '@/lib/types'
import { resolve, resolveMutation } from './transport'

/**
 * Jira Cloud integration.
 *
 * Every call in this module is proxied through our own API — the browser never
 * holds a Jira token. The OAuth 2.0 (3LO) exchange, the refresh cycle and the
 * webhook receiver all live in route handlers reading `serverEnv()`.
 */

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraBoard {
  id: string
  name: string
  projectKey: string
  type: 'scrum' | 'kanban'
}

export type SyncState = 'idle' | 'syncing' | 'error' | 'never'

export interface JiraSyncStatus {
  state: SyncState
  lastSyncAt: Date | null
  nextSyncAt: Date | null
  /** Populated when state === 'error'. */
  lastError?: string
  /** Jira applies per-tenant rate limits; surfaced so the UI can explain waits. */
  rateLimitedUntil?: Date | null
  syncedIssueCount: number
}

/** Field mapping is customer-specific; Jira custom fields vary per tenant. */
export interface JiraFieldMapping {
  storyPoints: string | null
  sprint: string | null
  severity: string | null
  qaStatus: string | null
}

const jiraIntegration = () => mockIntegrations.find((integration) => integration.type === 'jira')

export const jiraService = {
  /** Current connection record, or null when Jira has never been connected. */
  getConnection: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Integration | null>({
      path: '/api/integrations/jira',
      workspaceId,
      signal,
      mock: () => jiraIntegration() ?? null,
    }),

  /** Returns the URL to redirect to for the OAuth consent screen. */
  startOAuth: (workspaceId?: string) =>
    resolveMutation<{ redirectUrl: string }>({
      path: '/api/integrations/jira/oauth/start',
      workspaceId,
      mock: () => ({ redirectUrl: '/integrations?mock_oauth=1' }),
    }),

  disconnect: (workspaceId?: string) =>
    resolveMutation<{ ok: true }>({
      path: '/api/integrations/jira/disconnect',
      method: 'DELETE',
      workspaceId,
      mock: () => ({ ok: true }),
    }),

  listProjects: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<JiraProject[]>({
      path: '/api/integrations/jira/projects',
      workspaceId,
      signal,
      mock: () => [
        { id: '10001', key: 'PLAT', name: 'Platform' },
        { id: '10002', key: 'SHOP', name: 'Storefront' },
        { id: '10003', key: 'MOB', name: 'Mobile' },
      ],
    }),

  listBoards: (projectKey?: string, workspaceId?: string, signal?: AbortSignal) =>
    resolve<JiraBoard[]>({
      path: '/api/integrations/jira/boards',
      query: { projectKey },
      workspaceId,
      signal,
      mock: () => [
        { id: '1', name: 'Platform Scrum', projectKey: 'PLAT', type: 'scrum' },
        { id: '2', name: 'Storefront Scrum', projectKey: 'SHOP', type: 'scrum' },
        { id: '3', name: 'Mobile Kanban', projectKey: 'MOB', type: 'kanban' },
      ],
    }),

  getSyncStatus: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<JiraSyncStatus>({
      path: '/api/integrations/jira/sync',
      workspaceId,
      signal,
      mock: () => ({
        state: jiraIntegration()?.enabled ? 'idle' : 'never',
        lastSyncAt: jiraIntegration()?.lastSyncAt ?? null,
        nextSyncAt: new Date(Date.now() + 5 * 60 * 1000),
        rateLimitedUntil: null,
        syncedIssueCount: 1284,
      }),
    }),

  /** Kicks off an incremental sync; the response is the queued job state. */
  triggerSync: (workspaceId?: string) =>
    resolveMutation<JiraSyncStatus>({
      path: '/api/integrations/jira/sync',
      workspaceId,
      mock: () => ({
        state: 'syncing',
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + 5 * 60 * 1000),
        rateLimitedUntil: null,
        syncedIssueCount: 1284,
      }),
    }),

  getFieldMapping: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<JiraFieldMapping>({
      path: '/api/integrations/jira/fields',
      workspaceId,
      signal,
      mock: () => ({
        storyPoints: 'customfield_10016',
        sprint: 'customfield_10020',
        severity: 'customfield_10101',
        qaStatus: null,
      }),
    }),

  saveFieldMapping: (mapping: JiraFieldMapping, workspaceId?: string) =>
    resolveMutation<JiraFieldMapping>({
      path: '/api/integrations/jira/fields',
      method: 'PUT',
      body: mapping,
      workspaceId,
      mock: () => mapping,
    }),
}
