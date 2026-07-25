import { cn } from '@/lib/utils'
import type { AccountStatus, InvitationStatus } from '@/lib/rbac/types'

const ACCOUNT_STATUS_STYLES: Record<AccountStatus, { label: string; className: string }> = {
  approved:  { label: 'Active',    className: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  pending:   { label: 'Pending',   className: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' },
  suspended: { label: 'Suspended', className: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
  rejected:  { label: 'Rejected',  className: 'text-[#94A3B8] bg-[#94A3B8]/10 border-[#94A3B8]/25' },
  deleted:   { label: 'Deleted',   className: 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/25' },
}

const INVITATION_STATUS_STYLES: Record<InvitationStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' },
  accepted:  { label: 'Accepted',  className: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  expired:   { label: 'Expired',   className: 'text-[#94A3B8] bg-[#94A3B8]/10 border-[#94A3B8]/25' },
  cancelled: { label: 'Cancelled', className: 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/25' },
}

/** Status is never conveyed by colour alone — the label always carries it too. */
export function MemberStatusBadge({ status }: { status: AccountStatus }) {
  const style = ACCOUNT_STATUS_STYLES[status]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', style.className)}>
      {style.label}
    </span>
  )
}

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const style = INVITATION_STATUS_STYLES[status]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', style.className)}>
      {style.label}
    </span>
  )
}

export function relativeTime(date?: Date): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}
