import { sprints } from '@/lib/mock-data'
import type { Sprint } from '@/lib/types'
import { resolve } from './transport'

export const sprintService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Sprint[]>({ path: '/api/sprints', workspaceId, signal, mock: () => sprints }),

  get: (sprintId: string, workspaceId?: string, signal?: AbortSignal) =>
    resolve<Sprint | undefined>({
      path: `/api/sprints/${sprintId}`,
      workspaceId,
      signal,
      mock: () => sprints.find((sprint) => sprint.id === sprintId),
    }),
}
