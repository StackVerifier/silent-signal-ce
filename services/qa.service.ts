import { qaQueue, qaTesters } from '@/lib/mock-data'
import type { QAItem, QATester } from '@/lib/types'
import { resolve, resolveMutation } from './transport'

export const qaService = {
  listQueue: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<QAItem[]>({ path: '/api/qa/queue', workspaceId, signal, mock: () => qaQueue }),

  listTesters: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<QATester[]>({ path: '/api/qa/testers', workspaceId, signal, mock: () => qaTesters }),

  assign: (itemId: string, testerId: string, workspaceId?: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/qa/queue/${itemId}/assign`,
      body: { testerId },
      workspaceId,
      mock: () => ({ ok: true }),
    }),
}
