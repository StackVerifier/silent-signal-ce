import { request } from './http'
import type { QAItem, QATester } from '@/lib/types'

export const qaService = {
  listQueue: (workspaceId?: string, signal?: AbortSignal) =>
    request<QAItem[]>('/api/qa', { workspaceId, signal }),

  listTesters: (workspaceId?: string, signal?: AbortSignal) =>
    request<QATester[]>('/api/qa', { query: { view: 'testers' }, workspaceId, signal }),
}
