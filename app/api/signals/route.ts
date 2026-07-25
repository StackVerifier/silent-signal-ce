import { route } from '@/lib/api/handler'
import { deliveryRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { Signal } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.RISK_READ }, async (context) =>
  deliveryRepo.signals<Signal>(context.workspaceId, 'signal'))
