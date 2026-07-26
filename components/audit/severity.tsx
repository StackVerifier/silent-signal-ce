import {
  AlertOctagon, AlertTriangle, CheckCircle2, Info, type LucideIcon,
} from 'lucide-react'
import type { AuditSeverity, AuditStatus } from '@/lib/audit/events'

/**
 * One place that decides what each severity looks like.
 *
 * Severity is the first thing a reviewer scans for, so its colour has to mean
 * the same thing on every surface — the feed, the timeline, the drawer and the
 * export legend. Defining it per component is how "critical" ends up amber in
 * one place and red in another.
 */
export const SEVERITY_STYLES: Record<
  AuditSeverity,
  { Icon: LucideIcon; label: string; chip: string; dot: string; text: string; border: string }
> = {
  info: {
    Icon: Info, label: 'Info',
    chip: 'text-[#6C63FF] bg-[#6C63FF]/10',
    dot: 'bg-[#6C63FF]', text: 'text-[#6C63FF]', border: 'border-[#6C63FF]/30',
  },
  success: {
    Icon: CheckCircle2, label: 'Success',
    chip: 'text-[#22C55E] bg-[#22C55E]/10',
    dot: 'bg-[#22C55E]', text: 'text-[#22C55E]', border: 'border-[#22C55E]/30',
  },
  warning: {
    Icon: AlertTriangle, label: 'Warning',
    chip: 'text-[#F59E0B] bg-[#F59E0B]/10',
    dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/30',
  },
  critical: {
    Icon: AlertOctagon, label: 'Critical',
    chip: 'text-[#EF4444] bg-[#EF4444]/10',
    dot: 'bg-[#EF4444]', text: 'text-[#EF4444]', border: 'border-[#EF4444]/30',
  },
}

export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const style = SEVERITY_STYLES[severity]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${style.chip} ${style.border}`}
    >
      {style.label}
    </span>
  )
}

/**
 * Status is not severity. A denied attempt is a *successful* control doing its
 * job; showing them in the same colour would tell a reviewer the wrong story.
 */
export const STATUS_STYLES: Record<AuditStatus, { label: string; className: string }> = {
  success:   { label: 'Success',   className: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  failed:    { label: 'Failed',    className: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
  denied:    { label: 'Denied',    className: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' },
  cancelled: { label: 'Cancelled', className: 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/25' },
}

export function StatusBadge({ status }: { status: AuditStatus }) {
  // "Success" is the overwhelmingly common case; badging it everywhere would
  // add noise to every row and make the exceptions harder to spot.
  if (status === 'success') return null
  const style = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${style.className}`}>
      {style.label}
    </span>
  )
}
