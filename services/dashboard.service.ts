import { dashboardMetrics, liveSignals, serviceHealth, signals } from '@/lib/mock-data'
import type { DashboardMetrics, LiveSignal, ServiceHealth, Signal } from '@/lib/types'
import { resolve } from './transport'

export interface DashboardSnapshot {
  metrics: DashboardMetrics
  serviceHealth: ServiceHealth[]
  liveSignals: LiveSignal[]
}

export const dashboardService = {
  getSnapshot: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<DashboardSnapshot>({
      path: '/api/dashboard',
      workspaceId,
      signal,
      mock: () => ({ metrics: dashboardMetrics, serviceHealth, liveSignals }),
    }),

  getSignals: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Signal[]>({ path: '/api/signals', workspaceId, signal, mock: () => signals }),
}
