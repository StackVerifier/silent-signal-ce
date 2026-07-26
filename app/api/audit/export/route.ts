import { route } from '@/lib/api/handler'
import { auditRepo, writeAudit } from '@/lib/audit/repository'
import { auditVisibility, redactListForViewer } from '@/lib/audit/visibility'
import { isSecurityEvent } from '@/lib/audit/events'
import {
  EXPORT_CONTENT_TYPES, EXPORT_FORMATS, exportFilename, toCsv, toJson, type ExportFormat,
} from '@/lib/audit/export'
import { parseAuditQuery } from '@/lib/audit/query'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

/** Bounded so one request cannot pull the entire history into memory. */
const MAX_EXPORT_ROWS = 10_000

export const GET = route({ permission: PERMISSIONS.AUDIT_EXPORT }, async (context, request) => {
  const url = new URL(request.url)
  const requested = url.searchParams.get('format') ?? 'csv'
  const format = (EXPORT_FORMATS as readonly string[]).includes(requested)
    ? (requested as ExportFormat)
    : 'csv'

  const query = parseAuditQuery(url)
  const visibility = auditVisibility(context.permissions)

  const page = await auditRepo.search(context.organizationId, {
    ...query,
    limit: MAX_EXPORT_ROWS,
    cursor: undefined,
  })

  // The same redaction the screen applies. Exporting from raw rows "because the
  // file is for an auditor" is how a read grant turns into privilege escalation.
  const filtered = query.securityOnly
    ? page.records.filter((record) => isSecurityEvent(record.event))
    : page.records
  const records = redactListForViewer(filtered, visibility)

  // Bulk extraction of the security record is itself worth recording.
  await writeAudit({
    event: 'security.data_exported',
    organizationId: context.organizationId,
    actorId: context.memberId,
    target: { type: 'audit_log', id: 'audit_log', name: 'Audit log' },
    metadata: {
      format,
      rows: records.length,
      truncated: page.total > records.length,
      filters: Object.fromEntries(url.searchParams.entries()),
    },
  })

  const body = format === 'json' ? toJson(records) : toCsv(records)

  return new Response(body, {
    headers: {
      'Content-Type': EXPORT_CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${exportFilename(format)}"`,
      'Cache-Control': 'no-store',
    },
  })
})
