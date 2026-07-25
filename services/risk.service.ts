import { request } from './http'
import type { RiskTimelineEvent, Signal } from '@/lib/types'

export const riskService = {
  listTimeline: (
    params: { from?: string; to?: string; workspaceId?: string } = {},
    signal?: AbortSignal,
  ) =>
    request<RiskTimelineEvent[]>('/api/risk', {
      query: { from: params.from, to: params.to },
      workspaceId: params.workspaceId,
      signal,
    }),

  listSignals: (workspaceId?: string, signal?: AbortSignal) =>
    request<Signal[]>('/api/signals', { workspaceId, signal }),
}
