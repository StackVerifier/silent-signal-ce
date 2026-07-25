import { route } from '@/lib/api/handler'
import { deliveryRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { Release } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.RELEASE_READ }, async (context) =>
  deliveryRepo.releases<Release>(context.workspaceId))
