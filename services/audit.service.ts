import { request, type Paginated } from './http'
import type { AuditAction, AuditLog, AuditResource } from '@/lib/types'

export interface AuditQuery {
  action?: AuditAction
  resource?: AuditResource
  actorId?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export const auditService = {
  list: (params: AuditQuery = {}, signal?: AbortSignal) =>
    request<Paginated<AuditLog>>('/api/audit', { query: { ...params }, signal }),
}
