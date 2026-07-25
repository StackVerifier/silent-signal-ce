'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

/**
 * Who you are signed in as, and the way out — in the header, next to the
 * notification bell.
 *
 * A menu rather than a bare button: signing out is destructive and a
 * single-click target sitting beside the bell is easy to hit by accident. It
 * also gives the identity somewhere to live once the sidebar can collapse.
 */
export function AccountMenu() {
  const { member, role, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!member) return null

  const initials = member.avatar ?? member.name.slice(0, 2).toUpperCase()

  return (
    <div ref={container} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${member.name}`}
        className={cn(
          'flex items-center gap-2 rounded-lg pl-1 pr-1.5 py-1 transition-colors',
          'hover:bg-[#151D32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]',
          open && 'bg-[#151D32]',
        )}
      >
        <span className="w-7 h-7 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/40 flex items-center justify-center text-[10px] font-bold text-[#6C63FF] shrink-0">
          {initials}
        </span>
        {/* The name is useful context on a wide screen and noise on a phone. */}
        <span className="hidden md:block text-left min-w-0 max-w-[10rem]">
          <span className="block text-xs font-medium text-[#E2E8F0] truncate">{member.name}</span>
          <span className="block text-[10px] text-[#64748B] truncate">{role?.name}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#1E2D4A] bg-[#111827] shadow-xl shadow-black/40 overflow-hidden z-50"
        >
          <div className="px-3 py-2.5 border-b border-[#1E2D4A]">
            <p className="text-xs font-medium text-[#E2E8F0] truncate">{member.name}</p>
            <p className="text-[10px] text-[#64748B] truncate">{member.email}</p>
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#94A3B8] hover:bg-[#151D32] hover:text-[#E2E8F0] transition-colors"
          >
            <User aria-hidden="true" className="w-3.5 h-3.5" />
            Profile
          </Link>

          <button
            role="menuitem"
            onClick={() => { setOpen(false); logout() }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#94A3B8] hover:bg-[#151D32] hover:text-[#EF4444] transition-colors border-t border-[#1E2D4A]"
          >
            <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
