import { request } from './http'
import type { Organization } from '@/lib/rbac/types'

export const organizationService = {
  get: (signal?: AbortSignal) => request<Organization>('/api/organization', { signal }),

  setRetention: (dataRetentionDays: number) =>
    request<Organization>('/api/organization', {
      method: 'PATCH',
      body: { dataRetentionDays },
    }),
}
