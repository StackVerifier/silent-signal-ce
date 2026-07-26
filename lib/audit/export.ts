import { auditEvent } from './events'
import type { AuditRecord } from './types'

/**
 * Export formats.
 *
 * An auditor asks for evidence in a file, not a screenshot, so this is the
 * feature that makes the log usable in a compliance review. Two rules govern
 * the output and both matter:
 *
 *  1. It is generated from records that have already passed the viewer's
 *     redaction. Export must never be a way around a permission — the tempting
 *     shortcut of querying raw rows "because the file is for an auditor" is
 *     exactly how a read grant becomes a privilege escalation.
 *
 *  2. Every export is itself an audit event. Bulk extraction of the security
 *     record is the sort of thing an investigation wants to know happened.
 */

export const EXPORT_FORMATS = ['csv', 'json'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

const COLUMNS = [
  'timestamp', 'event', 'label', 'category', 'severity', 'status', 'source',
  'actor_name', 'actor_email', 'actor_role',
  'target_type', 'target_name', 'target_email', 'target_id',
  'workspace', 'team', 'changes', 'metadata',
  'ip_address', 'device', 'session_id', 'correlation_id',
] as const

/**
 * Escapes one CSV field.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not decoration: Excel and
 * Sheets evaluate a cell beginning with those as a formula, so an audit record
 * whose value happens to start with `=` becomes executable content in the
 * reviewer's spreadsheet. Quoting alone does not prevent it.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${guarded.replace(/"/g, '""')}"`
}

function row(record: AuditRecord): unknown[] {
  const definition = auditEvent(record.event)
  return [
    record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    record.event,
    definition.label,
    record.category,
    record.severity,
    record.status,
    record.source,
    record.actor.name,
    record.actor.email,
    record.actor.roleId ?? '',
    record.target?.type ?? '',
    record.target?.name ?? '',
    record.target?.email ?? '',
    record.target?.id ?? '',
    record.workspaceName ?? '',
    record.teamName ?? '',
    record.changes ? JSON.stringify(record.changes) : '',
    record.metadata ? JSON.stringify(record.metadata) : '',
    record.ipAddress ?? '',
    record.device ?? '',
    record.sessionId ?? '',
    record.correlationId ?? '',
  ]
}

export function toCsv(records: AuditRecord[]): string {
  const lines = [COLUMNS.join(','), ...records.map((record) => row(record).map(csvField).join(','))]
  // CRLF and a BOM: Excel opens UTF-8 as the local codepage otherwise, which
  // turns every Turkish name in the file into mojibake.
  return `﻿${lines.join('\r\n')}\r\n`
}

export function toJson(records: AuditRecord[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: records.length,
      // Naming the schema in the file means a reader in three years knows what
      // the columns meant when it was written.
      schema: 'silent-signal.audit.v1',
      records,
    },
    null,
    2,
  )
}

export function exportFilename(format: ExportFormat, at = new Date()): string {
  return `audit-log-${at.toISOString().slice(0, 10)}.${format}`
}

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
}
