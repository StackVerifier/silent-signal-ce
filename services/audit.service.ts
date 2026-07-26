import { request } from './http'
import type { AuditPage, AuditQuery, AuditRecord } from '@/lib/audit/types'

export type { AuditQuery, AuditRecord }

/** What the endpoint adds on top of a page of records. */
export interface AuditResponse extends AuditPage {
  /** True when fields or whole events were withheld from this viewer. */
  restricted: boolean
}

function toQueryParams(query: AuditQuery): Record<string, string | number | boolean | undefined> {
  const params: Record<string, string | number | boolean | undefined> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      if (value.length > 0) params[key] = value.join(',')
      continue
    }
    params[key] = value as string | number | boolean
  }
  return params
}

export const auditService = {
  list: (query: AuditQuery = {}, signal?: AbortSignal) =>
    request<AuditResponse>('/api/audit', { query: toQueryParams(query), signal }),

  get: (id: string, signal?: AbortSignal) =>
    request<{ record: AuditRecord; related: AuditRecord[] }>(`/api/audit/${id}`, { signal }),

  actors: (signal?: AbortSignal) =>
    request<{ id: string; name: string; email: string }[]>('/api/audit/actors', { signal }),
}
