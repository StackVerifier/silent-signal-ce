'use client'

import { Clock, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/**
 * Persistent explanation of *why* the application is showing placeholders.
 * Without it, a pending member reads the skeleton UI as a broken product.
 */
export function AccountStatusBanner() {
  const { member, isGated } = useAuth()
  if (!member || !isGated) return null

  const isPending = member.status === 'pending'
  const tone = isPending
    ? { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/25', text: 'text-[#F59E0B]', Icon: Clock }
    : { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/25', text: 'text-[#EF4444]', Icon: ShieldAlert }

  return (
    <div
      role="status"
      className={`flex items-center gap-3 px-6 py-2.5 border-b ${tone.bg} ${tone.border}`}
    >
      <tone.Icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${tone.text}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${tone.text}`}>
          {isPending
            ? 'Your account is waiting for administrator approval.'
            : 'Your account has been suspended.'}
        </p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">
          {isPending
            ? 'You can explore the workspace, but data stays hidden until an administrator approves your access.'
            : 'Contact your organization administrator to restore access.'}
        </p>
      </div>
      <a
        href="mailto:support@silentsignal.io"
        className="hidden sm:inline-flex shrink-0 text-[11px] font-medium text-[#94A3B8] hover:text-[#E2E8F0] border border-[#1E2D4A] rounded-lg px-2.5 py-1.5 transition-colors"
      >
        Contact administrator
      </a>
    </div>
  )
}
