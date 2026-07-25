import { request } from './http'
import type { DashboardMetrics, LiveSignal, ServiceHealth } from '@/lib/types'

export interface DashboardSnapshot {
  metrics: DashboardMetrics | null
  serviceHealth: ServiceHealth[]
  liveSignals: LiveSignal[]
}

export const dashboardService = {
  getSnapshot: (workspaceId?: string, signal?: AbortSignal) =>
    request<DashboardSnapshot>('/api/dashboard', { workspaceId, signal }),
}
