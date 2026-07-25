import { request } from './http'
import type { Sprint } from '@/lib/types'

export const sprintService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    request<Sprint[]>('/api/sprints', { workspaceId, signal }),
}
