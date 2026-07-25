import { request } from './http'
import type { BillingInfo } from '@/lib/types'

export const billingService = {
  get: (workspaceId?: string, signal?: AbortSignal) =>
    request<BillingInfo | null>('/api/billing', { workspaceId, signal }),
}
