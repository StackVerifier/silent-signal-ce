import { route } from '@/lib/api/handler'
import { auditRepo } from '@/lib/audit/repository'
import { isSecurityEvent } from '@/lib/audit/events'
import { parseAuditQuery } from '@/lib/audit/query'
import { auditVisibility, redactListForViewer } from '@/lib/audit/visibility'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.AUDIT_READ }, async (context, request) => {
  const query = parseAuditQuery(new URL(request.url))
  const visibility = auditVisibility(context.permissions)

  // `securityOnly` asks for exactly the records this viewer may not see.
  // Returning an empty list would read as "no security events happened", which
  // is a lie; the response says plainly that it was refused.
  if (query.securityOnly && !visibility.canReadSensitive) {
    return { records: [], total: 0, hasMore: false, nextCursor: null, restricted: true }
  }

  const page = await auditRepo.search(context.organizationId, query)

  // Which events count as security-relevant lives in the catalogue. Filtering
  // here rather than in SQL keeps the two from drifting apart.
  const matching = query.securityOnly
    ? page.records.filter((record) => isSecurityEvent(record.event))
    : page.records

  return {
    ...page,
    records: redactListForViewer(matching, visibility),
    /** Tells the UI to say the view is partial rather than imply completeness. */
    restricted: !visibility.canReadSensitive,
  }
})
