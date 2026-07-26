import { request } from './http'
import type { Rule } from '@/lib/types'

export interface RuleInput {
  name: string
  category: Rule['category']
  action: Rule['action']
  scoreImpact: number
  description: string
  conditions: Rule['conditions']
  enabled?: boolean
}

export const ruleService = {
  create: (input: RuleInput) =>
    request<Rule>('/api/rules', { method: 'POST', body: input }),

  update: (ruleId: string, patch: Partial<RuleInput>) =>
    request<Rule>(`/api/rules/${ruleId}`, { method: 'PATCH', body: patch }),

  remove: (ruleId: string) =>
    request<void>(`/api/rules/${ruleId}`, { method: 'DELETE' }),

  list: (workspaceId?: string, signal?: AbortSignal) =>
    request<Rule[]>('/api/rules', { workspaceId, signal }),

  toggle: (ruleId: string, enabled: boolean, workspaceId?: string) =>
    request<Rule>(`/api/rules/${ruleId}`, { method: 'PATCH', body: { enabled }, workspaceId }),
}
