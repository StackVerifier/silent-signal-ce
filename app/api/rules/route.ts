import { route } from '@/lib/api/handler'
import { ruleRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.RULES_READ }, async (context) =>
  await ruleRepo.list(context.workspaceId))
