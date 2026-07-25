import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { ruleRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({ enabled: z.boolean() })

export const PATCH = route({ permission: PERMISSIONS.RULES_WRITE }, async (context, request) => {
  const { enabled } = await parseBody(request, patchSchema)
  const ruleId = new URL(request.url).pathname.split('/').pop()!
  return ruleRepo.setEnabled(
    ruleId, enabled, context.workspaceId, context.memberId, context.organizationId,
  )
})
