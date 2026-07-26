'use client'

import { useState } from 'react'
import { Download, FileText, ShieldAlert } from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { useAuditLog } from '@/lib/query/hooks'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { useAuth } from '@/lib/auth-context'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { auditVisibility } from '@/lib/audit/visibility'
import type { AuditQuery, AuditRecord } from '@/lib/audit/types'
import { AuditFilters, activeFilterCount } from '@/components/audit/audit-filters'
import { AuditTimeline } from '@/components/audit/audit-timeline'
import { AuditDetailDrawer } from '@/components/audit/audit-detail-drawer'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The audit log.
 *
 * Not an activity feed: this is the screen someone opens when something has
 * gone wrong and they need to establish who changed what, when, from where and
 * to what value — for an incident review, or for an ISO 27001 or SOC 2 auditor
 * asking for evidence that access changes are tracked.
 *
 * Everything on it follows from that. Filters are the primary interface, because
 * the question is always "narrow this to the answer". Severity is prominent
 * because the eye needs somewhere to land. Before/after values are the point,
 * not a footnote. And credentials never appear, because a record kept for years
 * and exported to spreadsheets is the worst possible home for a live secret.
 */

/**
 * Export respects the filters on screen — a report that silently covers a
 * different set than the one the reviewer was looking at is worse than no
 * report. A plain link rather than fetch-and-blob: the browser handles the
 * download, the Content-Disposition header names the file, and nothing has to
 * hold ten thousand rows in memory to save them.
 */
function ExportMenu({ query }: { query: AuditQuery }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return (
    <div className="flex items-center gap-1.5">
      {(['csv', 'json'] as const).map((format) => (
        <a
          key={format}
          href={`/api/audit/export?${new URLSearchParams({ ...Object.fromEntries(params), format })}`}
          download
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#94A3B8] hover:text-[#E2E8F0] border border-[#1E2D4A] hover:border-[#2A3B5C] rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <Download aria-hidden="true" className="w-3 h-3" />
          {format.toUpperCase()}
        </a>
      ))}
    </div>
  )
}

export default function AuditLogPage() {
  const { permissions } = useAuth()
  const visibility = auditVisibility(permissions)

  const [query, setQuery] = useState<AuditQuery>({ limit: 100 })
  const [selected, setSelected] = useState<AuditRecord | null>(null)

  const result = useGatedQuery(useAuditLog(query), { permission: PERMISSIONS.AUDIT_READ })
  const records = result.data?.records ?? []
  const restricted = result.data?.restricted ?? false
  const filtered = activeFilterCount(query) > 0

  return (
    <PermissionGuard permission={PERMISSIONS.AUDIT_READ} showDenied>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SettingsPageHeader
          title="Audit Log"
          description="Who changed what, when, and from where"
          action={visibility.canExport ? <ExportMenu query={query} /> : undefined}
        />

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-[1400px] space-y-4">
            {restricted && (
              <p
                role="status"
                className="flex items-start gap-2 text-[11px] text-[#94A3B8] bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg px-3 py-2"
              >
                <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                {/* An incomplete view presented as complete is how an audit log
                    misleads. Better to say so at the top. */}
                This is a partial view. Security events, IP addresses, devices and
                sessions need the sensitive-audit permission.
              </p>
            )}

            <AuditFilters
              query={query}
              onChange={setQuery}
              canReadSensitive={visibility.canReadSensitive}
              total={result.data?.total ?? 0}
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_24rem] items-start">
              <div className="min-w-0">
                {result.isSkeleton ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : result.state === 'error' ? (
                  <ErrorState
                    title="Unable to load the audit log"
                    description={result.errorMessage ?? undefined}
                    onRetry={result.retry}
                  />
                ) : records.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title={filtered ? 'No records match these filters' : 'No activity recorded yet'}
                    description={
                      filtered
                        ? 'Widen the date range or clear a filter to see more.'
                        : 'Sign-ins, member approvals, rule changes and integration updates all appear here.'
                    }
                  />
                ) : (
                  <AuditTimeline
                    records={records}
                    selectedId={selected?.id ?? null}
                    onSelect={(record) =>
                      setSelected((current) => (current?.id === record.id ? null : record))}
                  />
                )}

                {result.data?.hasMore && (
                  <button
                    onClick={() =>
                      setQuery((current) => ({
                        ...current,
                        limit: Math.min((current.limit ?? 100) + 100, 500),
                      }))}
                    className="mt-4 w-full text-xs text-[#94A3B8] hover:text-[#E2E8F0] border border-[#1E2D4A] hover:border-[#2A3B5C] rounded-lg py-2 transition-colors"
                  >
                    Load more
                  </button>
                )}
              </div>

              <AuditDetailDrawer
                record={selected}
                onClose={() => setSelected(null)}
                canReadSensitive={visibility.canReadSensitive}
              />
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}
