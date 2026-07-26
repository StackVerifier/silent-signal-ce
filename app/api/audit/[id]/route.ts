import { route } from '@/lib/api/handler'
import { auditRepo } from '@/lib/audit/repository'
import { auditVisibility, redactForViewer, redactListForViewer } from '@/lib/audit/visibility'
import { NotFoundError } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

/**
 * One record, plus its siblings.
 *
 * Related records are the ones written while handling the same request. A
 * single change often lands as several rows — suspend a member and their
 * sessions end — and seeing them together is what turns a log into an
 * explanation.
 */
export const GET = route({ permission: PERMISSIONS.AUDIT_READ }, async (context, request) => {
  const id = new URL(request.url).pathname.split('/').pop() ?? ''
  const visibility = auditVisibility(context.permissions)

  const found = await auditRepo.get(context.organizationId, id)
  // A record this viewer may not see is a 404, not a 403: confirming it exists
  // would leak that a security event happened at that moment.
  const record = found ? redactForViewer(found, visibility) : null
  if (!record) throw new NotFoundError('Audit record not found')

  const related = record.correlationId
    ? redactListForViewer(
        (await auditRepo.byCorrelation(context.organizationId, record.correlationId))
          .filter((sibling) => sibling.id !== record.id),
        visibility,
      )
    : []

  return { record, related }
})
