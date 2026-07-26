import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { orgRepo } from '@/lib/db/repositories'
import { RETENTION_OPTIONS } from '@/lib/audit/retention'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.ORGANIZATION_READ }, async (context) =>
  await orgRepo.get(context.organizationId))

const patchSchema = z.object({
  // A free-form number would let someone set retention to a day and quietly
  // destroy the evidence trail; the allow-list is the control.
  dataRetentionDays: z.union(
    RETENTION_OPTIONS.map((days) => z.literal(days)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>],
  ),
})

export const PATCH = route({ permission: PERMISSIONS.SETTINGS_WRITE }, async (context, request) => {
  const input = await parseBody(request, patchSchema)
  return await orgRepo.setRetentionDays(context.organizationId, input.dataRetentionDays, context.memberId)
})
