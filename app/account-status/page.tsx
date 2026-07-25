'use client'

import { useRouter } from 'next/navigation'
import { ShieldAlert, LogOut, Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/**
 * Terminal surface for suspended members. Rendered outside the app shell —
 * a suspended account must not see navigation at all.
 */
export default function AccountStatusPage() {
  const { member, organization, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.replace('/auth/login')
    router.refresh()
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#070B18] via-[#0F1824] to-[#070B18] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert aria-hidden="true" className="w-6 h-6 text-[#EF4444]" />
        </div>

        <h1 className="text-xl font-bold text-[#E2E8F0] tracking-tight">Account suspended</h1>
        <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
          Your access to {organization?.name ?? 'this workspace'} has been suspended. Contact your
          organization administrator to have it restored.
        </p>

        {member && (
          <div className="mt-6 rounded-xl bg-[#151D32] border border-[#1E2D4A] px-4 py-3 text-left">
            <p className="text-xs text-[#64748B]">Signed in as</p>
            <p className="text-sm font-medium text-[#E2E8F0] mt-0.5 truncate">{member.email}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <a
            href="mailto:support@silentsignal.io"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5B52CC] transition-colors"
          >
            <Mail aria-hidden="true" className="w-3.5 h-3.5" />
            Contact administrator
          </a>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-[#94A3B8] text-sm font-medium hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
          >
            <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
