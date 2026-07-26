import type {
  AuditCategory,
  AuditEventId,
  AuditSeverity,
  AuditSource,
  AuditStatus,
} from './events'
import type { FieldChange } from './redact'

/**
 * One audit record.
 *
 * The shape answers the five questions an investigation actually asks: who,
 * what, when, where from, and to what value. `actor` and `target` are separate
 * because "Bora suspended Hakan" needs both ends — a single `user` field, as
 * the previous activity feed had, loses the half that usually matters.
 */

export interface AuditActor {
  id: string
  name: string
  email: string
  avatar?: string
  /** The role held at the time of the action, not the role held today. */
  roleId?: string
}

export interface AuditTarget {
  /** 'member' | 'rule' | 'workspace' | … — what kind of thing was acted on. */
  type: string
  id: string
  /** Human label at the time of the action; ids outlive names. */
  name?: string
  email?: string
}

/** Domain objects the event relates to, for root-cause work. */
export interface AuditRelations {
  releaseId?: string
  releaseName?: string
  sprintId?: string
  sprintName?: string
  ruleId?: string
  ruleName?: string
  issueKey?: string
  notificationChannel?: string
}

export interface AuditRecord {
  id: string
  event: AuditEventId | string
  category: AuditCategory
  severity: AuditSeverity
  status: AuditStatus
  source: AuditSource

  organizationId: string | null
  organizationName?: string
  workspaceId?: string
  workspaceName?: string
  teamId?: string
  teamName?: string

  actor: AuditActor
  target?: AuditTarget

  /** Field-level before/after, secrets already masked at write time. */
  changes?: Record<string, FieldChange>
  metadata?: Record<string, unknown>
  relations?: AuditRelations

  /** Ties a record to backend logs and to sibling records from one operation. */
  correlationId?: string

  // Sensitive — stripped for readers without `audit.read_sensitive`.
  ipAddress?: string
  userAgent?: string
  device?: string
  sessionId?: string

  createdAt: Date
}

export interface AuditQuery {
  from?: string
  to?: string
  category?: AuditCategory[]
  severity?: AuditSeverity[]
  status?: AuditStatus[]
  source?: AuditSource[]
  event?: string[]
  actorId?: string
  targetId?: string
  workspaceId?: string
  teamId?: string
  /** Full-text across actor, target, event label, resource names and metadata. */
  search?: string
  /** Only records that carry a field-level diff. */
  hasChanges?: boolean
  /** Only security-relevant events. */
  securityOnly?: boolean
  /** Only attempts that did not succeed. */
  failedOnly?: boolean
  limit?: number
  cursor?: string
}

export interface AuditPage {
  records: AuditRecord[]
  nextCursor: string | null
  hasMore: boolean
  /** Total matching the filter, for "1–50 of 812". */
  total: number
}
