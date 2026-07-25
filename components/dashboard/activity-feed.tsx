'use client'

import Link from 'next/link'
import {
  Plus, Pencil, Trash2, UserPlus, UserMinus, Download, Check, X,
  Ban, RotateCw, ArrowRightLeft, ShieldCheck, History, type LucideIcon,
} from 'lucide-react'
import { useAuditLog } from '@/lib/query/hooks'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { AuditAction, AuditLog } from '@/lib/types'
import { relativeTime } from '@/components/members/member-status-badge'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { Skeleton } from '@/components/ui/skeleton'

const ACTION_META: Record<AuditAction, { icon: LucideIcon; color: string; verb: string }> = {
  create: { icon: Plus, color: 'text-[#22C55E] bg-[#22C55E]/10', verb: 'created' },
  update: { icon: Pencil, color: 'text-[#6C63FF] bg-[#6C63FF]/10', verb: 'updated' },
  delete: { icon: Trash2, color: 'text-[#EF4444] bg-[#EF4444]/10', verb: 'deleted' },
  invite: { icon: UserPlus, color: 'text-[#00D4FF] bg-[#00D4FF]/10', verb: 'invited' },
  remove: { icon: UserMinus, color: 'text-[#EF4444] bg-[#EF4444]/10', verb: 'removed' },
  export: { icon: Download, color: 'text-[#94A3B8] bg-[#94A3B8]/10', verb: 'exported' },
  approve: { icon: Check, color: 'text-[#22C55E] bg-[#22C55E]/10', verb: 'approved' },
  reject: { icon: X, color: 'text-[#EF4444] bg-[#EF4444]/10', verb: 'rejected' },
  suspend: { icon: Ban, color: 'text-[#F59E0B] bg-[#F59E0B]/10', verb: 'suspended' },
  activate: { icon: RotateCw, color: 'text-[#22C55E] bg-[#22C55E]/10', verb: 'reactivated' },
  transfer: { icon: ArrowRightLeft, color: 'text-[#6C63FF] bg-[#6C63FF]/10', verb: 'transferred' },
  permission_change: { icon: ShieldCheck, color: 'text-[#F59E0B] bg-[#F59E0B]/10', verb: 'changed permissions for' },
}

/** Prefers a human label from metadata over an opaque id. */
function describeTarget(entry: AuditLog): string {
  const metadata = entry.metadata ?? {}
  const label =
    metadata.name ?? metadata.member ?? metadata.integration ?? metadata.invitedEmail
  return label ? `${entry.resource} “${label}”` : `${entry.resource} ${entry.resourceId}`
}

function summariseChanges(entry: AuditLog): string | null {
  if (!entry.changes) return null
  const keys = Object.keys(entry.changes)
  if (keys.length === 0) return null
  if (keys.length === 1) {
    const [key] = keys
    const { before, after } = entry.changes[key]
    return `${key}: ${String(before)} → ${String(after)}`
  }
  return `${keys.length} fields changed`
}

/**
 * Recent activity, sourced from the audit log rather than a separate feed table
 * — one write path means the feed can never disagree with the compliance record.
 */
export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const result = useGatedQuery(useAuditLog({ limit }), { permission: PERMISSIONS.AUDIT_READ })
  const entries = (result.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)

  return (
    <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2D4A]">
        <div>
          <h3 className="text-sm font-semibold text-[#E2E8F0]">Recent Activity</h3>
          <p className="text-xs text-[#64748B] mt-0.5">Workspace changes as they happen</p>
        </div>
        {result.state === 'ready' && entries.length > 0 && (
          <Link
            href="/audit-log"
            className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors shrink-0"
          >
            View all
          </Link>
        )}
      </div>

      {result.isSkeleton ? (
        <div className="p-5 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-3/4" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : result.state === 'denied' ? (
        <EmptyState
          icon={History}
          title="Activity is restricted"
          description="Viewing workspace activity requires the audit permission. Ask an administrator if you need it."
        />
      ) : result.state === 'error' ? (
        <ErrorState
          title="Unable to load activity"
          description={result.errorMessage ?? undefined}
          onRetry={result.retry}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Rule changes, member approvals and integration updates will appear here."
          actions={[{ label: 'Connect Jira', href: '/integrations' }]}
        />
      ) : (
        <ol className="px-5 py-4 space-y-3.5">
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action]
            const changes = summariseChanges(entry)
            return (
              <li key={entry.id} className="flex items-start gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  <meta.icon aria-hidden="true" className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    <span className="font-medium text-[#E2E8F0]">{entry.user.name}</span>{' '}
                    {meta.verb} {describeTarget(entry)}
                  </p>
                  {changes && (
                    <p className="text-[10px] font-mono text-[#64748B] mt-0.5 truncate">{changes}</p>
                  )}
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {relativeTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
