import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { appDb } from '@/lib/db/app'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

const EMPTY = { storyPoints: null, sprint: null, severity: null, qaStatus: null }

/** Stored in the integration's config blob; it is configuration, not a secret. */
function readMapping(workspaceId: string) {
  const row = appDb()
    .prepare("SELECT config FROM integration WHERE workspace_id = ? AND type = 'jira'")
    .get(workspaceId) as { config: string } | undefined
  if (!row) return EMPTY
  const config = JSON.parse(row.config || '{}')
  return { ...EMPTY, ...(config.fieldMapping ?? {}) }
}

export const GET = route({ permission: PERMISSIONS.INTEGRATION_READ }, (context) =>
  readMapping(context.workspaceId))

const mappingSchema = z.object({
  storyPoints: z.string().nullable(),
  sprint: z.string().nullable(),
  severity: z.string().nullable(),
  qaStatus: z.string().nullable(),
})

export const PUT = route({ permission: PERMISSIONS.INTEGRATION_WRITE }, async (context, request) => {
  const mapping = await parseBody(request, mappingSchema)
  const db = appDb()
  const row = db
    .prepare("SELECT config FROM integration WHERE workspace_id = ? AND type = 'jira'")
    .get(context.workspaceId) as { config: string } | undefined

  const config = { ...JSON.parse(row?.config || '{}'), fieldMapping: mapping }
  db.prepare("UPDATE integration SET config = ? WHERE workspace_id = ? AND type = 'jira'")
    .run(JSON.stringify(config), context.workspaceId)

  return mapping
})
