'use client'

import { Sidebar } from './sidebar'
import { CommandPalette } from './command-palette'
import { KeyboardProvider } from './keyboard-provider'
import { AccountStatusBanner } from '@/components/rbac/account-status-banner'

/**
 * Single application shell. The (dashboard) and (settings) route groups used to
 * carry byte-identical layouts; both now render this.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-[#6C63FF] focus:text-white focus:text-sm"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden bg-[#070B18]">
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
