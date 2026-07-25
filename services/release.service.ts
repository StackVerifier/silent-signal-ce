import { request } from './http'
import type { Release } from '@/lib/types'

export const releaseService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    request<Release[]>('/api/releases', { workspaceId, signal }),
}
