import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { integrationRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { resolveJiraAuth } from '@/lib/env'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.INTEGRATION_READ }, async (context) =>
  (await integrationRepo.list(context.workspaceId)).find((item) => item.type === 'jira') ?? null)

const actionSchema = z.object({ action: z.enum(['connect', 'disconnect']) })

export const POST = route({ permission: PERMISSIONS.INTEGRATION_WRITE }, async (context, request) => {
  const { action } = await parseBody(request, actionSchema)

  if (action === 'disconnect') {
    await integrationRepo.setEnabled(context.workspaceId, 'jira', false, context.memberId, context.organizationId)
    return { ok: true }
  }

  const auth = resolveJiraAuth()
  await integrationRepo.setEnabled(context.workspaceId, 'jira', true, context.memberId, context.organizationId)

  // With OAuth configured the browser is sent to Atlassian for consent; with an
  // API token there is nothing to consent to, so the connection is live now.
  return {
    redirectUrl: auth?.mode === 'oauth'
      ? `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${auth.clientId}&scope=read%3Ajira-work&redirect_uri=${encodeURIComponent(auth.redirectUri)}&response_type=code&prompt=consent`
      : '',
  }
})
