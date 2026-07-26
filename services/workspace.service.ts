import { request } from './http'
import type { Workspace } from '@/lib/rbac/types'

export const workspaceService = {
  list: (signal?: AbortSignal) => request<Workspace[]>('/api/workspaces', { signal }),

  create: (input: { name: string; description?: string }) =>
    request<Workspace>('/api/workspaces', { method: 'POST', body: input }),
}
