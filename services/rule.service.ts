import { rules } from '@/lib/mock-data'
import type { Rule } from '@/lib/types'
import { resolve, resolveMutation } from './transport'

export const ruleService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Rule[]>({ path: '/api/rules', workspaceId, signal, mock: () => rules }),

  toggle: (ruleId: string, enabled: boolean, workspaceId?: string) =>
    resolveMutation<Rule>({
      path: `/api/rules/${ruleId}`,
      method: 'PATCH',
      body: { enabled },
      workspaceId,
      mock: () => ({ ...rules.find((rule) => rule.id === ruleId)!, enabled }),
    }),

  remove: (ruleId: string, workspaceId?: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/rules/${ruleId}`,
      method: 'DELETE',
      workspaceId,
      mock: () => ({ ok: true }),
    }),
}
