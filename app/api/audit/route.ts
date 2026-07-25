import { route } from '@/lib/api/handler'
import { auditRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.AUDIT_READ }, async (context, request) => {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 50)
  return {
    data: await auditRepo.list(context.organizationId, Math.min(Math.max(limit, 1), 200)),
    pageInfo: { nextCursor: null, hasMore: false },
  }
})
