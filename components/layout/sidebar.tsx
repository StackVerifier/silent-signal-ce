'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Zap, GitBranch, FlaskConical,
  AlertTriangle, Clock, Settings, ChevronLeft,
  ChevronRight, Search, Bell, Shield, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardStore } from '@/store/dashboard-store'
import { useState, useEffect } from 'react'

const navItems = [
  { id: 'dashboard',     label: 'Dashboard',          icon: LayoutDashboard, href: '/',                badge: null,  shortcut: '1' },
  { id: 'sprint',        label: 'Sprint Intelligence', icon: Zap,             href: '/sprint',           badge: '42',  shortcut: '2' },
  { id: 'release',       label: 'Release Control',     icon: GitBranch,       href: '/release',          badge: null,  shortcut: '3' },
  { id: 'qa-queue',      label: 'QA Queue',            icon: FlaskConical,    href: '/qa-queue',         badge: '18',  shortcut: '4' },
  { id: 'risk-timeline', label: 'Risk Timeline',       icon: Clock,           href: '/risk-timeline',    badge: null,  shortcut: '5' },
  { id: 'rules',         label: 'Rule Management',     icon: Shield,          href: '/rules',            badge: '24',  shortcut: '6' },
] as const

const bottomItems = [
  { id: 'teams',    label: 'Teams',    icon: Users,    href: '/teams' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { setCommandPaletteOpen } = useDashboardStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen bg-[#111827] border-r border-[#1E2D4A] flex-shrink-0 overflow-hidden z-20"
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-[#1E2D4A]',
        collapsed && 'justify-center px-3'
      )}>
        <div className="w-7 h-7 rounded-lg bg-[#6C63FF] flex items-center justify-center flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-white opacity-90" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold text-[#E2E8F0] whitespace-nowrap tracking-tight">Silent Signal</p>
              <p className="text-[10px] text-[#64748B] whitespace-nowrap">Release Intelligence</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search / Command */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-[#1E2D4A]">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#151D32] border border-[#1E2D4A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#6C63FF]/40 transition-all text-xs"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[10px] bg-[#1E2D4A] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        </div>
      )}
      {collapsed && (
        <div className="px-3 py-3 border-b border-[#1E2D4A]">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-center p-2 rounded-lg bg-[#151D32] border border-[#1E2D4A] text-[#64748B] hover:text-[#94A3B8] transition-all"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-2 pb-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Navigation</p>
        )}
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all duration-150 group',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-[#6C63FF]/15 text-[#6C63FF]'
                  : 'text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8]'
              )}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#6C63FF] rounded-r-full"
                />
              )}
              <item.icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-[#6C63FF]')} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && (
                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="text-[10px] bg-[#1E2D4A] text-[#64748B] px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                  <span className={cn(
                    'text-[9px] font-mono px-1 py-0.5 rounded border transition-opacity',
                    active
                      ? 'text-[#6C63FF]/60 border-[#6C63FF]/20 bg-transparent'
                      : 'text-[#64748B]/50 border-[#1E2D4A]/50 bg-transparent opacity-0 group-hover:opacity-100'
                  )}>
                    {item.shortcut}
                  </span>
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Items */}
      <div className="px-2 py-3 border-t border-[#1E2D4A] space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-2 py-2.5 rounded-lg text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8] transition-all',
              collapsed && 'justify-center'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ))}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-[#64748B] hover:bg-[#151D32] hover:text-[#94A3B8] transition-all',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
