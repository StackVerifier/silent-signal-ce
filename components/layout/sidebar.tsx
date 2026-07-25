'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Search, LogOut, Lock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const { permissions, member, role, isGated, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Read the persisted preference after mount to avoid a hydration mismatch,
  // while still rendering the sidebar on the server (no layout shift).
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1')
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, current ? '0' : '1')
      return !current
    })
  }, [])

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
        title={collapsed ? item.label : undefined}
        className={cn(
          'relative flex items-center gap-2.5 px-2 py-2.5 rounded-lg transition-colors duration-150 group min-w-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-inset',
          collapsed && 'justify-center px-2',
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
        {!collapsed && (
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
    <motion.aside
      animate={{ width: collapsed ? 64 : 248 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-dvh bg-[#111827] border-r border-[#1E2D4A] flex-shrink-0 overflow-hidden z-20"
    >
      <WorkspaceSwitcher collapsed={collapsed} />

      {/* Search */}
      <div className="px-3 py-3 border-b border-[#1E2D4A]">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          className={cn(
            'w-full flex items-center gap-2 rounded-lg bg-[#151D32] border border-[#1E2D4A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#6C63FF]/40 transition-colors text-xs',
            collapsed ? 'justify-center p-2' : 'px-3 py-2',
          )}
        >
          <Search aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
          {!collapsed && (
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
              {!collapsed && (
                <p className="px-2 pb-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">{items.map(renderItem)}</div>
            </div>
          )
        })}
      </nav>

      {/* Footer — account, user, collapse */}
      <div className="border-t border-[#1E2D4A] px-2 py-2 space-y-0.5 flex-shrink-0">
        {accountItems.map(renderItem)}

        {member && (
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-2',
              collapsed && 'justify-center',
            )}
          >
            <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/40 flex items-center justify-center text-[10px] font-bold text-[#6C63FF] shrink-0">
              {member.avatar ?? member.name.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#E2E8F0] truncate">{member.name}</p>
                  <p className="text-[10px] text-[#64748B] truncate">{role?.name}</p>
                </div>
                <button
                  onClick={logout}
                  aria-label="Sign out"
                  title="Sign out"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#151D32] transition-colors shrink-0"
                >
                  <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8] transition-colors',
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
    </motion.aside>
  )
}
