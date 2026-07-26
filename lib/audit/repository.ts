import 'server-only'
import { all, one, run, nowIso } from '@/lib/db/driver'
import { legacyShape } from './legacy'
import { auditEvent, type AuditEventId, type AuditSource, type AuditStatus } from './events'
import { currentAuditContext } from './context'
import { redactChanges, redactMetadata, type FieldChange } from './redact'
import type { AuditPage, AuditQuery, AuditRecord, AuditRelations, AuditTarget } from './types'

/**
 * Reading and writing audit records.
 *
 * Writes are append-only: there is no update or delete here beyond the
 * retention purge, because a mutable audit log is not evidence of anything.
 */

export interface AuditWrite {
  event: AuditEventId
  /** Null when the event belongs to no tenant — see the schema comment. */
  organizationId: string | null
  actorId: string | null
  /** Overrides the looked-up actor — used when the actor is not a member. */
  actor?: { name: string; email: string; roleId?: string }
  workspaceId?: string | null
  workspaceName?: string | null
  teamId?: string | null
  teamName?: string | null
  target?: AuditTarget
  status?: AuditStatus
  source?: AuditSource
  changes?: Record<string, FieldChange>
  metadata?: Record<string, unknown>
  relations?: AuditRelations
}

interface AuditRow {
  id: number | string
  event: string; category: string; severity: string; status: string; source: string
  organization_id: string | null
  workspace_id: string | null; workspace_name: string | null
  team_id: string | null; team_name: string | null
  actor_id: string | null; actor_name: string; actor_email: string
  actor_avatar: string | null; actor_role: string | null
  target_type: string | null; target_id: string | null
  target_name: string | null; target_email: string | null
  changes: string | null; metadata: string | null; relations: string | null
  ip_address: string | null; user_agent: string | null
  device: string | null; session_id: string | null; correlation_id: string | null
  created_at: string | Date
}

function hydrate(row: AuditRow): AuditRecord {
  const definition = auditEvent(row.event)
  return {
    id: String(row.id),
    event: row.event,
    // Stored values win over the catalogue: a record keeps the severity it was
    // written with, even if the catalogue is re-tuned later.
    category: (row.category ?? definition.category) as AuditRecord['category'],
    severity: (row.severity ?? definition.severity) as AuditRecord['severity'],
    status: (row.status ?? 'success') as AuditRecord['status'],
    source: (row.source ?? 'dashboard') as AuditRecord['source'],
    organizationId: row.organization_id,
    workspaceId: row.workspace_id ?? undefined,
    workspaceName: row.workspace_name ?? undefined,
    teamId: row.team_id ?? undefined,
    teamName: row.team_name ?? undefined,
    actor: {
      id: row.actor_id ?? '',
      name: row.actor_name,
      email: row.actor_email,
      avatar: row.actor_avatar ?? undefined,
      roleId: row.actor_role ?? undefined,
    },
    target: row.target_id || row.target_type
      ? {
          type: row.target_type ?? 'unknown',
          id: row.target_id ?? '',
          name: row.target_name ?? undefined,
          email: row.target_email ?? undefined,
        }
      : undefined,
    changes: row.changes ? JSON.parse(row.changes) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    relations: row.relations ? JSON.parse(row.relations) : undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    device: row.device ?? undefined,
    sessionId: row.session_id ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Writes one record. Called inside the same transaction as the mutation it
 * describes, so an action cannot succeed without leaving a trace.
 *
 * Secrets are masked here rather than at read time: redacting on the way out
 * would leave plaintext credentials sitting in the table, one forgotten query
 * away from a breach.
 */
export async function writeAudit(entry: AuditWrite): Promise<void> {
  const definition = auditEvent(entry.event)
  const context = currentAuditContext()

  const actor = entry.actorId
    ? await one<{ name: string; email: string; avatar: string | null; role_id: string }>(
        'SELECT name, email, avatar, role_id FROM member WHERE id = ?', entry.actorId,
      )
    : null

  const { action, resource } = legacyShape(entry.event)

  await run(
    `INSERT INTO audit_log (
       event, category, severity, status, source,
       organization_id, workspace_id, workspace_name, team_id, team_name,
       actor_id, actor_name, actor_email, actor_avatar, actor_role,
       target_type, target_id, target_name, target_email,
       action, resource, resource_id,
       changes, metadata, relations,
       ip_address, user_agent, device, session_id, correlation_id,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.event,
    definition.category,
    definition.severity,
    entry.status ?? 'success',
    entry.source ?? context?.source ?? 'system',
    entry.organizationId,
    entry.workspaceId ?? null,
    entry.workspaceName ?? null,
    entry.teamId ?? null,
    entry.teamName ?? null,
    entry.actorId ?? null,
    entry.actor?.name ?? actor?.name ?? 'System',
    entry.actor?.email ?? actor?.email ?? 'system@silentsignal.local',
    actor?.avatar ?? null,
    entry.actor?.roleId ?? actor?.role_id ?? null,
    entry.target?.type ?? null,
    entry.target?.id ?? null,
    entry.target?.name ?? null,
    entry.target?.email ?? null,
    action,
    resource,
    entry.target?.id ?? null,
    entry.changes ? JSON.stringify(redactChanges(entry.changes)) : null,
    entry.metadata ? JSON.stringify(redactMetadata(entry.metadata)) : null,
    entry.relations ? JSON.stringify(entry.relations) : null,
    context?.ipAddress ?? null,
    context?.userAgent ?? null,
    context?.device ?? null,
    context?.sessionId ?? null,
    context?.correlationId ?? null,
    nowIso(),
  )
}

/**
 * Builds the WHERE clause for a query.
 *
 * Every value is bound, never interpolated. An audit log is the table an
 * attacker most wants to read and rewrite, so its query builder is the last
 * place to be casual about string concatenation.
 */
function buildFilter(organizationId: string, query: AuditQuery) {
  const clauses: string[] = ['organization_id = ?']
  const params: unknown[] = [organizationId]

  const inClause = (column: string, values?: string[]) => {
    if (!values?.length) return
    clauses.push(`${column} IN (${values.map(() => '?').join(', ')})`)
    params.push(...values)
  }

  inClause('category', query.category)
  inClause('severity', query.severity)
  inClause('status', query.status)
  inClause('source', query.source)
  inClause('event', query.event)

  if (query.from) { clauses.push('created_at >= ?'); params.push(query.from) }
  if (query.to) { clauses.push('created_at <= ?'); params.push(query.to) }
  if (query.actorId) { clauses.push('actor_id = ?'); params.push(query.actorId) }
  if (query.targetId) { clauses.push('target_id = ?'); params.push(query.targetId) }
  if (query.workspaceId) { clauses.push('workspace_id = ?'); params.push(query.workspaceId) }
  if (query.teamId) { clauses.push('team_id = ?'); params.push(query.teamId) }
  if (query.hasChanges) clauses.push("changes IS NOT NULL AND changes <> ''")
  if (query.failedOnly) clauses.push("status <> 'success'")

  if (query.search) {
    // Across the fields a person actually types into a search box: a name, an
    // email, an event, a rule or issue key sitting in metadata.
    const like = `%${query.search.toLowerCase()}%`
    clauses.push(`(
      lower(actor_name) LIKE ? OR lower(actor_email) LIKE ? OR
      lower(coalesce(target_name, '')) LIKE ? OR lower(coalesce(target_email, '')) LIKE ? OR
      lower(event) LIKE ? OR lower(coalesce(workspace_name, '')) LIKE ? OR
      lower(coalesce(team_name, '')) LIKE ? OR lower(coalesce(metadata, '')) LIKE ? OR
      lower(coalesce(relations, '')) LIKE ? OR lower(coalesce(changes, '')) LIKE ?
    )`)
    params.push(...Array<string>(10).fill(like))
  }

  return { where: clauses.join(' AND '), params }
}

export const auditRepo = {
  /**
   * A page of records, newest first.
   *
   * `securityOnly` is applied in the application rather than in SQL: which
   * events count as security-relevant lives in the catalogue, and duplicating
   * that list into a query would let the two drift apart silently.
   */
  async search(organizationId: string, query: AuditQuery = {}): Promise<AuditPage> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 500)
    const { where, params } = buildFilter(organizationId, query)

    const cursorClause = query.cursor ? ' AND id < ?' : ''
    const cursorParams = query.cursor ? [Number(query.cursor)] : []

    const rows = await all<AuditRow>(
      `SELECT * FROM audit_log WHERE ${where}${cursorClause}
        ORDER BY created_at DESC, id DESC LIMIT ?`,
      ...params, ...cursorParams, limit + 1,
    )

    const totalRow = await one<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM audit_log WHERE ${where}`, ...params,
    )

    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).map(hydrate)

    return {
      records: page,
      hasMore,
      nextCursor: hasMore ? String(rows[limit - 1].id) : null,
      total: Number(totalRow?.count ?? page.length),
    }
  },

  async get(organizationId: string, id: string): Promise<AuditRecord | null> {
    const row = await one<AuditRow>(
      'SELECT * FROM audit_log WHERE organization_id = ? AND id = ?', organizationId, id,
    )
    return row ? hydrate(row) : null
  },

  /** Sibling records written while handling the same request. */
  async byCorrelation(organizationId: string, correlationId: string): Promise<AuditRecord[]> {
    return (await all<AuditRow>(
      `SELECT * FROM audit_log WHERE organization_id = ? AND correlation_id = ?
        ORDER BY created_at ASC, id ASC LIMIT 100`,
      organizationId, correlationId,
    )).map(hydrate)
  },

  /** Distinct actors, for the "performed by" filter. */
  async actors(organizationId: string): Promise<{ id: string; name: string; email: string }[]> {
    return await all<{ id: string; name: string; email: string }>(
      `SELECT DISTINCT actor_id AS id, actor_name AS name, actor_email AS email
         FROM audit_log WHERE organization_id = ? AND actor_id IS NOT NULL
        ORDER BY actor_name`,
      organizationId,
    )
  },
}
