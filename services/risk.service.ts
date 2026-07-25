import { riskTimeline, type RiskTimelineEvent } from '@/lib/mock-data'
import { resolve } from './transport'

export const riskService = {
  listTimeline: (
    params: { from?: string; to?: string; workspaceId?: string } = {},
    signal?: AbortSignal,
  ) =>
    resolve<RiskTimelineEvent[]>({
      path: '/api/risk/timeline',
      query: { from: params.from, to: params.to },
      workspaceId: params.workspaceId,
      signal,
      mock: () => riskTimeline,
    }),
}
