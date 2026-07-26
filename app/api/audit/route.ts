import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { auditRepo } from '@/lib/audit/repository'
import {
  AUDIT_CATEGORIES, AUDIT_SEVERITIES, AUDIT_SOURCES, AUDIT_STATUSES, isSecurityEvent,
} from '@/lib/audit/events'
import { auditVisibility, redactListForViewer } from '@/lib/audit/visibility'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

/** Repeated query parameters arrive as `?category=members&category=rules`. */
const many = <T extends string>(values: readonly T[]) =>
  z.array(z.enum(values as unknown as [T, ...T[]])).optional()

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: many(AUDIT_CATEGORIES),
  severity: many(AUDIT_SEVERITIES),
  status: many(AUDIT_STATUSES),
  source: many(AUDIT_SOURCES),
  event: z.array(z.string()).optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  search: z.string().max(200).optional(),
  hasChanges: z.boolean().optional(),
  securityOnly: z.boolean().optional(),
  failedOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
})

export function parseAuditQuery(url: URL) {
  const params = url.searchParams
  const values = (key: string) => {
    const found = params.getAll(key).flatMap((value) => value.split(',')).filter(Boolean)
    return found.length ? found : undefined
  }
  const flag = (key: string) => (params.get(key) === 'true' ? true : undefined)

  return querySchema.parse({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    category: values('category'),
    severity: values('severity'),
    status: values('status'),
    source: values('source'),
    event: values('event'),
    actorId: params.get('actorId') ?? undefined,
    targetId: params.get('targetId') ?? undefined,
    workspaceId: params.get('workspaceId') ?? undefined,
    teamId: params.get('teamId') ?? undefined,
    search: params.get('search') ?? undefined,
    hasChanges: flag('hasChanges'),
    securityOnly: flag('securityOnly'),
    failedOnly: flag('failedOnly'),
    limit: params.get('limit') ? Number(params.get('limit')) : undefined,
    cursor: params.get('cursor') ?? undefined,
  })
}

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
