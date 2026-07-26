import type { Permission } from '@/lib/rbac/permissions'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { auditEvent } from './events'
import type { AuditRecord } from './types'

/**
 * Who sees which parts of an audit record.
 *
 * Two separate questions, and conflating them is the usual mistake:
 *
 *   1. May this person open the audit log at all?  — `audit.read`
 *   2. May they see the forensic detail inside it? — `audit.read_sensitive`
 *
 * IP address, device, session id and security events are themselves sensitive.
 * A release manager who can see that a rule changed does not thereby need to
 * see the originating IP of every colleague — that is surveillance capability,
 * and handing it out with an ordinary read grant is how audit logs become a
 * privacy problem instead of a control.
 *
 * The filtering happens server-side. Sending the full record and hiding fields
 * in the browser would put the data one devtools tab away from anyone.
 */

/** Fields stripped from a record when the reader lacks the sensitive grant. */
export const SENSITIVE_FIELDS = [
  'ipAddress',
  'userAgent',
  'device',
  'sessionId',
] as const

export interface AuditVisibility {
  /** May open the log. */
  canRead: boolean
  /** May see IP, device, session, and security-category events. */
  canReadSensitive: boolean
  /** May download the log. */
  canExport: boolean
}

export function auditVisibility(permissions: Permission[]): AuditVisibility {
  return {
    canRead: permissions.includes(PERMISSIONS.AUDIT_READ),
    canReadSensitive: permissions.includes(PERMISSIONS.AUDIT_READ_SENSITIVE),
    canExport: permissions.includes(PERMISSIONS.AUDIT_EXPORT),
  }
}

/**
 * Applies visibility to one record.
 *
 * A security event is removed entirely rather than blanked, because its mere
 * presence is informative: "someone's permissions changed at 02:14, details
 * hidden" still tells a reader what to go asking about.
 */
export function redactForViewer(
  record: AuditRecord,
  visibility: AuditVisibility,
): AuditRecord | null {
  if (!visibility.canRead) return null
  if (visibility.canReadSensitive) return record

  if (auditEvent(record.event).security) return null

  const filtered: AuditRecord = { ...record }
  for (const field of SENSITIVE_FIELDS) delete filtered[field]
  return filtered
}

export function redactListForViewer(
  records: AuditRecord[],
  visibility: AuditVisibility,
): AuditRecord[] {
  return records
    .map((record) => redactForViewer(record, visibility))
    .filter((record): record is AuditRecord => record !== null)
}
