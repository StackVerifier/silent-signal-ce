import { route } from '@/lib/api/handler'
import { deliveryRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { DashboardMetrics, LiveSignal, ServiceHealth } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.DASHBOARD_READ }, async (context) => {
  // These were once returned un-awaited. JSON.stringify turns a Promise into
  // `{}`, so the endpoint answered 200 with three empty objects and the whole
  // header row silently rendered blank — and `{}` reaching a `.map` took the
  // page down outright. The three queries are independent, so they run
  // together rather than in sequence.
  const [metrics, serviceHealth, liveSignals] = await Promise.all([
    deliveryRepo.metrics<DashboardMetrics>(context.workspaceId),
    deliveryRepo.serviceHealth<ServiceHealth>(context.workspaceId),
    deliveryRepo.signals<LiveSignal>(context.workspaceId, 'live'),
  ])
  return { metrics, serviceHealth, liveSignals }
})
