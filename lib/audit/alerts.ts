import 'server-only'
import { auditEvent, SEVERITY_ORDER, type AuditSeverity } from './events'
import type { AuditRecord } from './types'
import type { NotificationLevel } from '@/lib/types'

/**
 * Routing audit events to notification destinations.
 *
 * A critical event nobody reads is a critical event nobody acts on. "Who gave
 * release approval to a developer at 02:00" is worth a Slack message at 02:01,
 * not a discovery three weeks later during a review.
 *
 * The rule is deliberately narrow. Alerting on everything trains people to
 * ignore the channel, and an ignored alert channel is worse than none because
 * it creates the belief that someone is watching.
 */

/** The floor. Below this an event goes to the log and nowhere else. */
const ALERT_FROM: AuditSeverity = 'critical'

export function shouldAlert(record: Pick<AuditRecord, 'event' | 'severity' | 'status'>): boolean {
  // A denied attempt is a control working. Alerting on every one would page
  // somebody every time a viewer clicks Billing.
  if (record.status === 'denied') return false

  if (SEVERITY_ORDER[record.severity] >= SEVERITY_ORDER[ALERT_FROM]) return true

  // Failures below critical still matter when they are security-relevant: a
  // failed sign-in is `warning`, and a burst of them is the thing to catch.
  return record.status === 'failed' && auditEvent(record.event).security === true
}

/** Audit severity mapped onto the notification levels endpoints filter on. */
export function alertLevel(severity: AuditSeverity): NotificationLevel {
  switch (severity) {
    case 'critical': return 'critical'
    case 'warning': return 'high'
    case 'success': return 'medium'
    default: return 'low'
  }
}

export interface AuditAlert {
  level: NotificationLevel
  title: string
  message: string
  link: string
}

/**
 * The message a destination receives.
 *
 * Deliberately assembled from the same fields the drawer shows, and nothing
 * else — an alert must never carry a value the audit record itself masks.
 */
export function buildAlert(record: AuditRecord): AuditAlert {
  const definition = auditEvent(record.event)
  const target = record.target?.name ?? record.target?.email ?? record.target?.id
  const scope = record.workspaceName ? ` in ${record.workspaceName}` : ''

  const changed = Object.keys(record.changes ?? {})
  const detail = changed.length
    ? ` Changed: ${changed.slice(0, 4).join(', ')}${changed.length > 4 ? '…' : ''}.`
    : ''

  return {
    level: alertLevel(record.severity),
    title: definition.label,
    message:
      `${record.actor.name}${target ? ` → ${target}` : ''}${scope}.` +
      `${detail} Source: ${record.source}.`,
    // Deep link straight to the record, so the first click lands on evidence.
    link: `/audit-log?event=${encodeURIComponent(record.event)}`,
  }
}
