'use client'

import { cn } from '@/lib/utils'
import type { RiskLevel, Severity, IssuePriority, GateStatus } from '@/lib/types'
import { motion } from 'framer-motion'

// ─── Risk Level Badge ─────────────────────────────────────────────────────────

export function RiskLevelBadge({ level, size = 'sm' }: { level: RiskLevel; size?: 'xs' | 'sm' }) {
  const styles = {
    HIGH:   'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    MEDIUM: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    LOW:    'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  }
  return (
    <span className={cn(
      'font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide',
      size === 'xs' ? 'text-[9px]' : 'text-[10px]',
      styles[level]
    )}>
      {level}
    </span>
  )
}

// ─── Severity Dot ─────────────────────────────────────────────────────────────

export function SeverityDot({ severity }: { severity: Severity }) {
  const colors = {
    critical: 'bg-[#EF4444]',
    high:     'bg-[#F59E0B]',
    medium:   'bg-[#6C63FF]',
    low:      'bg-[#22C55E]',
    none:     'bg-[#64748B]',
  }
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', colors[severity])} />
  )
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const styles = {
    Critical: 'text-[#EF4444] bg-[#EF4444]/10',
    High:     'text-[#F59E0B] bg-[#F59E0B]/10',
    Medium:   'text-[#6C63FF] bg-[#6C63FF]/10',
    Low:      'text-[#64748B] bg-[#64748B]/10',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', styles[priority])}>
      {priority}
    </span>
  )
}

// ─── Gate Status ──────────────────────────────────────────────────────────────

export function GateStatusBadge({ status }: { status: GateStatus }) {
  const styles = {
    complete:    'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20',
    'in-progress': 'text-[#6C63FF] bg-[#6C63FF]/10 border-[#6C63FF]/20',
    'at-risk':   'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
    blocked:     'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  }
  const labels = {
    complete:    'Complete',
    'in-progress': 'In Progress',
    'at-risk':   'At Risk',
    blocked:     'Blocked',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', styles[status])}>
      {labels[status]}
    </span>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

export function SectionCard({
  title, subtitle, children, className, action
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2D4A]">
        <div>
          <h3 className="text-sm font-semibold text-[#E2E8F0]">{title}</h3>
          {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─── Score Progress Bar ───────────────────────────────────────────────────────

export function ScoreBar({
  value, max = 100, color, delay = 0, height = 'h-1.5'
}: {
  value: number
  max?: number
  color: string
  delay?: number
  height?: string
}) {
  const percent = Math.min(100, (value / max) * 100)
  return (
    <div className={cn('w-full bg-[#1E2D4A] rounded-full overflow-hidden', height)}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay }}
      />
    </div>
  )
}

// ─── Metric Tile ─────────────────────────────────────────────────────────────

export function MetricTile({
  label, value, unit, color, icon: Icon, trend
}: {
  label: string
  value: string | number
  unit?: string
  color: string
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  trend?: 'up' | 'down' | 'stable'
}) {
  return (
    <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-[#64748B]">{label}</p>
        {Icon && <Icon className="w-4 h-4" style={{ color }} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-[#64748B]">{unit}</span>}
      </div>
    </div>
  )
}

// ─── Status Row ───────────────────────────────────────────────────────────────

export function StatusRow({ label, value, status }: { label: string; value: string; status?: 'ok' | 'warn' | 'error' }) {
  const dotColor = status === 'ok' ? '#22C55E' : status === 'warn' ? '#F59E0B' : status === 'error' ? '#EF4444' : '#64748B'
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1E2D4A]/60 last:border-0">
      <div className="flex items-center gap-2">
        {status && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />}
        <span className="text-xs text-[#94A3B8]">{label}</span>
      </div>
      <span className="text-xs font-mono text-[#E2E8F0]">{value}</span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-[#64748B]">{message}</p>
    </div>
  )
}
