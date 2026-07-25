import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { all, run } from '@/lib/db/driver'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

const EMPTY = { storyPoints: null, sprint: null, severity: null, qaStatus: null }

/** Stored in the integration's config blob; it is configuration, not a secret. */
async function readMapping(workspaceId: string) {
  const rows = await all<{ config: string }>(
    "SELECT config FROM integration WHERE workspace_id = ? AND type = 'jira'", workspaceId,
  )
  if (rows.length === 0) return EMPTY
  const config = JSON.parse(rows[0].config || '{}')
  return { ...EMPTY, ...(config.fieldMapping ?? {}) }
}

export const GET = route({ permission: PERMISSIONS.INTEGRATION_READ }, async (context) =>
  readMapping(context.workspaceId))

const mappingSchema = z.object({
  storyPoints: z.string().nullable(),
  sprint: z.string().nullable(),
  severity: z.string().nullable(),
  qaStatus: z.string().nullable(),
})

export const PUT = route({ permission: PERMISSIONS.INTEGRATION_WRITE }, async (context, request) => {
  const mapping = await parseBody(request, mappingSchema)
  const rows = await all<{ config: string }>(
    "SELECT config FROM integration WHERE workspace_id = ? AND type = 'jira'", context.workspaceId,
  )
  const config = { ...JSON.parse(rows[0]?.config || '{}'), fieldMapping: mapping }
  await run(
    "UPDATE integration SET config = ? WHERE workspace_id = ? AND type = 'jira'",
    JSON.stringify(config), context.workspaceId,
  )
  return mapping
})
