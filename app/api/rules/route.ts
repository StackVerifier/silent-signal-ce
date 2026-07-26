import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { ruleRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.RULES_READ }, async (context) =>
  await ruleRepo.list(context.workspaceId))

export const conditionSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.enum(['<', '>', '=', '>=', '<=', '!=']),
  value: z.union([z.string(), z.number()]),
  type: z.enum(['IF', 'AND', 'OR', 'NOT']),
})

export const ruleShape = {
  name: z.string().trim().min(1, 'Give the rule a name').max(120),
  category: z.enum(['sprint', 'release', 'qa', 'capacity', 'velocity']),
  action: z.enum(['score', 'alert', 'flag']),
  // A rule that can move a score by more than 100 could swamp every other
  // rule on its own, which defeats the point of a decomposable score.
  scoreImpact: z.number().int().min(0).max(100),
  description: z.string().trim().min(1, 'Say what the rule detects').max(400),
  conditions: z.array(conditionSchema).max(20).default([]),
}

const createSchema = z.object({ ...ruleShape, enabled: z.boolean().default(true) })

export const POST = route({ permission: PERMISSIONS.RULES_WRITE }, async (context, request) => {
  const input = await parseBody(request, createSchema)
  return await ruleRepo.create(
    { ...input, workspaceId: context.workspaceId, organizationId: context.organizationId },
    context.memberId,
  )
})
