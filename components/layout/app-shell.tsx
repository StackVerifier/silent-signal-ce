'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { CommandPalette } from './command-palette'
import { KeyboardProvider } from './keyboard-provider'
import { AccountStatusBanner } from '@/components/rbac/account-status-banner'
import { useDashboardStore } from '@/store/dashboard-store'

/**
 * Single application shell for both route groups.
 *
 * Desktop: fixed sidebar rail beside a scrolling content column.
 * Below `lg`: the sidebar becomes an off-canvas drawer over a scrim, with body
 * scroll locked and Escape to close.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const mobileNavOpen = useDashboardStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useDashboardStore((state) => state.setMobileNavOpen)

  useEffect(() => {
    if (!mobileNavOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileNavOpen, setMobileNavOpen])

  return (
    <KeyboardProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-3 focus:left-3 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-[#6C63FF] focus:text-white focus:text-sm"
      >
        Skip to content
      </a>

      <div className="flex h-dvh overflow-hidden bg-[#070B18]">
        {/* Scrim — mobile only, closes the drawer on tap */}
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
          />
        )}

        <Sidebar />

        <main id="main-content" className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <AccountStatusBanner />
          {children}
        </main>

        <CommandPalette />
      </div>
    </KeyboardProvider>
  )
}
