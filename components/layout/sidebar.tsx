'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Search, Lock, X } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useIsDesktop } from '@/hooks/use-media-query'
import { usePersistentFlag } from '@/hooks/use-persistent-flag'
import { cn } from '@/lib/utils'
import { useDashboardStore } from '@/store/dashboard-store'
import { useAuth } from '@/lib/auth-context'
import {
  ACCOUNT_NAV_ITEMS,
  NAV_SECTIONS,
  visibleNavItems,
  type NavItem,
} from '@/lib/rbac/navigation'
import { WorkspaceSwitcher } from './workspace-switcher'

const COLLAPSE_STORAGE_KEY = 'ss_sidebar_collapsed'

/**
 * Sidebar layout contract:
 *   header (org + workspace switcher)  — fixed
 *   search                             — fixed
 *   navigation                         — the ONLY scrolling region, no visible bar
 *   footer (account, user, collapse)   — fixed
 *
 * Items are derived from the RBAC navigation registry, so a member never sees a
 * destination they cannot open.
 */
export function Sidebar() {
  const pathname = usePathname()
  const setCommandPaletteOpen = useDashboardStore((state) => state.setCommandPaletteOpen)
  const mobileNavOpen = useDashboardStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useDashboardStore((state) => state.setMobileNavOpen)
  const { permissions, member, isGated } = useAuth()
  const isDesktop = useIsDesktop()
  // Expanded on the server, so the markup is deterministic; the stored
  // preference is read during the first client render.
  const [collapsed, setCollapsed] = usePersistentFlag(COLLAPSE_STORAGE_KEY, false)

  // The drawer only collapses on desktop; on mobile it is always full width.
  const showLabels = !collapsed || !isDesktop

  // Close the drawer whenever navigation happens, so a tap never leaves it open.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname, setMobileNavOpen])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current)
  }, [setCollapsed])

  const status = member?.status ?? 'pending'
  const navItems = useMemo(
    () => visibleNavItems(permissions, status),
    [permissions, status],
  )
  const accountItems = useMemo(
    () => visibleNavItems(permissions, 'approved', ACCOUNT_NAV_ITEMS),
    [permissions],
  )

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href)
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={!showLabels ? item.label : undefined}
        className={cn(
          'relative flex items-center gap-2.5 px-2 py-2.5 rounded-lg transition-colors duration-150 group min-w-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-inset',
          !showLabels && 'justify-center px-2',
          active
            ? 'bg-[#6C63FF]/15 text-[#6C63FF]'
            : 'text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8]',
        )}
      >
        {active && (
          <motion.span
            layoutId="nav-indicator"
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#6C63FF] rounded-r-full"
          />
        )}
        <item.icon aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
        {showLabels && (
          <>
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.label}</span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              {isGated ? (
                <Lock aria-hidden="true" className="w-3 h-3 text-[#64748B]/70" />
              ) : (
                item.shortcut && (
                  <kbd
                    className={cn(
                      'text-[9px] font-mono px-1 py-0.5 rounded border transition-opacity',
                      active
                        ? 'text-[#6C63FF]/60 border-[#6C63FF]/20'
                        : 'text-[#64748B]/50 border-[#1E2D4A]/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                    )}
                  >
                    {item.shortcut}
                  </kbd>
                )
              )}
            </span>
          </>
        )}
      </Link>
    )
  }

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      aria-hidden={!isDesktop && !mobileNavOpen}
      className={cn(
        // Mobile: off-canvas drawer. Desktop: in-flow rail that changes width.
        'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#111827] border-r border-[#1E2D4A]',
        'overflow-hidden transition-transform duration-200 ease-out',
        'lg:static lg:z-20 lg:h-dvh lg:flex-shrink-0 lg:translate-x-0',
        'lg:transition-[width] lg:duration-200',
        collapsed ? 'lg:w-16' : 'lg:w-[248px]',
        // Off-canvas content must not be reachable by Tab.
        mobileNavOpen
          ? 'translate-x-0'
          : '-translate-x-full invisible lg:visible lg:pointer-events-auto pointer-events-none',
      )}
    >
      {/* Drawer close — mobile only; desktop uses the collapse control below. */}
      <button
        onClick={() => setMobileNavOpen(false)}
        aria-label="Close navigation"
        className="lg:hidden absolute top-3 right-3 z-10 p-2 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#151D32] transition-colors"
      >
        <X aria-hidden="true" className="w-4 h-4" />
      </button>

      <WorkspaceSwitcher collapsed={!showLabels} />

      {/* Search */}
      <div className="px-3 py-3 border-b border-[#1E2D4A]">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          className={cn(
            'w-full flex items-center gap-2 rounded-lg bg-[#151D32] border border-[#1E2D4A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#6C63FF]/40 transition-colors text-xs',
            showLabels ? 'px-3 py-2' : 'justify-center p-2',
          )}
        >
          <Search aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
          {showLabels && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-[10px] bg-[#1E2D4A] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation — the only scrolling region */}
      <nav
        aria-label="Primary"
        className="flex-1 min-h-0 px-2 py-3 space-y-4 overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        {NAV_SECTIONS.map((section) => {
          const items = navItems.filter((item) => item.section === section.id)
          if (items.length === 0) return null
          return (
            <div key={section.id}>
              {showLabels && (
                <p className="px-2 pb-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">{items.map(renderItem)}</div>
            </div>
          )
        })}
      </nav>

      {/* Footer — account links and the collapse toggle. Identity and sign-out
          moved to the header, beside the notification bell. */}
      <div className="border-t border-[#1E2D4A] px-2 py-2 space-y-0.5 flex-shrink-0">
        {accountItems.map(renderItem)}

        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'hidden lg:flex w-full items-center gap-2.5 px-2 py-2 rounded-lg text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8] transition-colors',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
