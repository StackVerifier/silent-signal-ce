'use client'

import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { PERMISSION_DESCRIPTIONS, type Permission } from '@/lib/rbac/permissions'

/**
 * Permission-denied surface. Explains what is missing and who can grant it —
 * a dead end with no next step is the most common enterprise UX failure here.
 */
export function AccessDenied({
  requiredPermissions = [],
  from,
}: {
  requiredPermissions?: Permission[]
  from?: string
}) {
  const { role, organization } = useAuth()

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert aria-hidden="true" className="w-6 h-6 text-[#F59E0B]" />
        </div>

        <h1 className="text-lg font-semibold text-[#E2E8F0]">You don&apos;t have access to this page</h1>
        <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
          {from ? (
            <>
              <span className="font-mono text-xs text-[#64748B]">{from}</span> requires permissions your
              role does not include.
            </>
          ) : (
            'This page requires permissions your role does not include.'
          )}
        </p>

        <div className="mt-6 rounded-xl bg-[#151D32] border border-[#1E2D4A] overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-[#1E2D4A] flex items-center justify-between">
            <span className="text-xs font-medium text-[#94A3B8]">Your role</span>
            <span className="text-xs font-semibold text-[#6C63FF]">{role?.name ?? 'Unknown'}</span>
          </div>
          {requiredPermissions.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-[#94A3B8] mb-2">Required permission</p>
              <ul className="space-y-1.5">
                {requiredPermissions.map((permission) => (
                  <li key={permission} className="flex items-start gap-2">
                    <code className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded shrink-0">
                      {permission}
                    </code>
                    <span className="text-[11px] text-[#64748B] leading-relaxed">
                      {PERMISSION_DESCRIPTIONS[permission]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5B52CC] transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>
          <a
            href="mailto:support@silentsignal.io"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-[#94A3B8] text-sm font-medium hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
          >
            Request access
          </a>
        </div>

        {organization && (
          <p className="text-[11px] text-[#64748B] mt-5">
            Ask an administrator of <span className="text-[#94A3B8]">{organization.name}</span> to
            adjust your role.
          </p>
        )}
      </div>
    </div>
  )
}
