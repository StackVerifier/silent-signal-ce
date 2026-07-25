import { route } from '@/lib/api/handler'
import { memberRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.MEMBERS_READ }, (context) => ({
  data: memberRepo.list(context.organizationId),
  pageInfo: { nextCursor: null, hasMore: false },
}))
