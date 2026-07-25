import { request } from './http'
import type { Rule } from '@/lib/types'

export const ruleService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    request<Rule[]>('/api/rules', { workspaceId, signal }),

  toggle: (ruleId: string, enabled: boolean, workspaceId?: string) =>
    request<Rule>(`/api/rules/${ruleId}`, { method: 'PATCH', body: { enabled }, workspaceId }),
}
