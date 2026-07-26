import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { ruleRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { ruleShape } from '../route'

export const dynamic = 'force-dynamic'

const ruleId = (request: Request) => new URL(request.url).pathname.split('/').pop()!

/**
 * `enabled` on its own is the toggle in the list; the rest is the edit form.
 * Both go through PATCH so the client does not have to know which endpoint
 * corresponds to which control.
 */
const patchSchema = z.object({
  enabled: z.boolean().optional(),
  name: ruleShape.name.optional(),
  category: ruleShape.category.optional(),
  action: ruleShape.action.optional(),
  scoreImpact: ruleShape.scoreImpact.optional(),
  description: ruleShape.description.optional(),
  conditions: z.array(z.object({
    field: z.string().trim().min(1),
    operator: z.enum(['<', '>', '=', '>=', '<=', '!=']),
    value: z.union([z.string(), z.number()]),
    type: z.enum(['IF', 'AND', 'OR', 'NOT']),
  })).max(20).optional(),
})

export const PATCH = route({ permission: PERMISSIONS.RULES_WRITE }, async (context, request) => {
  const { enabled, ...fields } = await parseBody(request, patchSchema)
  const id = ruleId(request)

  // Enabling and disabling are separate audit events from editing, so they are
  // applied separately rather than folded into one "rule updated".
  if (Object.keys(fields).length > 0) {
    await ruleRepo.update(id, context.workspaceId, fields, context.memberId, context.organizationId)
  }
  if (enabled !== undefined) {
    return await ruleRepo.setEnabled(
      id, enabled, context.workspaceId, context.memberId, context.organizationId,
    )
  }
  return (await ruleRepo.list(context.workspaceId)).find((rule) => rule.id === id)!
})

export const DELETE = route({ permission: PERMISSIONS.RULES_DELETE }, async (context, request) => {
  await ruleRepo.remove(ruleId(request), context.workspaceId, context.memberId, context.organizationId)
})
