import { route } from '@/lib/api/handler'
import { auditRepo } from '@/lib/audit/repository'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

/** Distinct actors that appear in the log, for the "performed by" filter. */
export const GET = route({ permission: PERMISSIONS.AUDIT_READ }, async (context) =>
  await auditRepo.actors(context.organizationId))
