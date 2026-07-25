'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw, FileText, Mail, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StateAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

function ActionButton({ action }: { action: StateAction }) {
  const className = cn(
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B18]',
    action.variant === 'secondary'
      ? 'border border-[#1E2D4A] text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40'
      : 'bg-[#6C63FF] text-white hover:bg-[#5B52CC]',
  )

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}

/**
 * Empty state — always action-oriented. "No data" is never acceptable copy;
 * the user must be told what is missing and given the next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: StateAction[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-14', className)}>
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center mb-4">
          <Icon aria-hidden="true" className="w-5 h-5 text-[#6C63FF]" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#E2E8F0]">{title}</h3>
      {description && (
        <p className="text-xs text-[#94A3B8] mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Error state — never a bare "Error". Always: what failed, how to retry, and
 * an escalation path.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  detail,
  onRetry,
  logsHref,
  className,
}: {
  title?: string
  description?: string
  detail?: string
  onRetry?: () => void
  logsHref?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center text-center px-6 py-14', className)}
    >
      <div className="w-11 h-11 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center mb-4">
        <AlertTriangle aria-hidden="true" className="w-5 h-5 text-[#EF4444]" />
      </div>
      <h3 className="text-sm font-semibold text-[#E2E8F0]">{title}</h3>
      {description && (
        <p className="text-xs text-[#94A3B8] mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {detail && (
        <code className="mt-3 text-[10px] font-mono text-[#64748B] bg-[#0F1824] border border-[#1E2D4A] rounded-lg px-2.5 py-1.5 max-w-full overflow-x-auto">
          {detail}
        </code>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5B52CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B18]"
          >
            <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
        {logsHref && (
          <Link
            href={logsHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-[#94A3B8] text-sm font-medium hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
          >
            <FileText aria-hidden="true" className="w-3.5 h-3.5" />
            View logs
          </Link>
        )}
        <a
          href="mailto:support@silentsignal.io"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-[#94A3B8] text-sm font-medium hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
        >
          <Mail aria-hidden="true" className="w-3.5 h-3.5" />
          Contact administrator
        </a>
      </div>
    </div>
  )
}
