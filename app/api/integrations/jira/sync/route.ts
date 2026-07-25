import { route } from '@/lib/api/handler'
import { integrationRepo, notificationRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { resolveJiraAuth } from '@/lib/env'

export const dynamic = 'force-dynamic'

function status(context: { workspaceId: string }) {
  const jira = integrationRepo.list(context.workspaceId).find((item) => item.type === 'jira')
  const configured = Boolean(resolveJiraAuth())

  return {
    state: !jira?.enabled ? 'never' : configured ? 'idle' : 'error',
    lastSyncAt: jira?.lastSyncAt ?? null,
    nextSyncAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    // Being honest beats showing a healthy-looking idle state that never syncs.
    lastError: jira?.enabled && !configured
      ? 'Jira credentials are not configured on the server (see .env.example)'
      : undefined,
    rateLimitedUntil: null,
    syncedIssueCount: 0,
  }
}

export const GET = route({ permission: PERMISSIONS.INTEGRATION_READ }, (context) => status(context))

export const POST = route({ permission: PERMISSIONS.INTEGRATION_WRITE }, (context) => {
  integrationRepo.recordSync(context.workspaceId, 'jira')
  notificationRepo.create({
    memberId: context.memberId,
    workspaceId: context.workspaceId,
    type: 'system',
    level: 'low',
    title: 'Jira sync requested',
    message: resolveJiraAuth()
      ? 'An incremental sync has been queued.'
      : 'Sync could not start: Jira credentials are not configured on the server.',
    link: '/integrations',
  })
  return status(context)
})
