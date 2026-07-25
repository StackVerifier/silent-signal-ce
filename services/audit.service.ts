import { mockDb } from '@/lib/mock-db'
import type { AuditAction, AuditLog, AuditResource } from '@/lib/types'
import { resolve } from './transport'
import type { Paginated } from './http'

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
    resolve<Paginated<AuditLog>>({
      path: '/api/audit',
      query: { ...params },
      signal,
      mock: () => ({ data: mockDb.auditLogs(), pageInfo: { nextCursor: null, hasMore: false } }),
    }),

  /** Returns a signed, time-limited download URL rather than streaming bytes. */
  export: (params: AuditQuery = {}) =>
    resolve<{ downloadUrl: string; expiresAt: Date }>({
      path: '/api/audit/export',
      query: { ...params },
      mock: () => ({ downloadUrl: '#', expiresAt: new Date(Date.now() + 900000) }),
    }),
}
