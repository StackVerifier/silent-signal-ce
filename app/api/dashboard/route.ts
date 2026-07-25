import { route } from '@/lib/api/handler'
import { deliveryRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { DashboardMetrics, LiveSignal, ServiceHealth } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.DASHBOARD_READ }, async (context) => ({
  metrics: deliveryRepo.metrics<DashboardMetrics>(context.workspaceId),
  serviceHealth: deliveryRepo.serviceHealth<ServiceHealth>(context.workspaceId),
  liveSignals: deliveryRepo.signals<LiveSignal>(context.workspaceId, 'live'),
}))
