'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Check, CheckCheck, AlertTriangle, GitBranch, Zap, FlaskConical,
  Settings2, Users, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/query/hooks'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { Notification, NotificationLevel, NotificationType } from '@/lib/types'
import { relativeTime } from '@/components/members/member-status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  risk: AlertTriangle,
  release: GitBranch,
  sprint: Zap,
  qa: FlaskConical,
  system: Settings2,
  admin: Users,
}

const LEVEL_STYLES: Record<NotificationLevel, string> = {
  critical: 'bg-[#EF4444]/10 text-[#EF4444]',
  high: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  medium: 'bg-[#6C63FF]/10 text-[#6C63FF]',
  low: 'bg-[#64748B]/10 text-[#94A3B8]',
}

/** Groups by day so a long list stays scannable. */
function groupByDay(notifications: Notification[]) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]

  for (const notification of notifications) {
    const created = new Date(notification.createdAt).getTime()
    if (created >= startOfToday.getTime()) groups[0].items.push(notification)
    else if (created >= startOfYesterday.getTime()) groups[1].items.push(notification)
    else groups[2].items.push(notification)
  }

  return groups.filter((group) => group.items.length > 0)
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isGated } = useAuth()

  const result = useGatedQuery(useNotifications(), { permission: PERMISSIONS.NOTIFICATIONS_READ })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = useMemo(
    () =>
      [...(result.data ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [result.data],
  )
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const visible = unreadOnly ? notifications.filter((n) => !n.read) : notifications
  const groups = groupByDay(visible)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        className="relative flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg hover:bg-[#151D32] text-[#64748B] hover:text-[#94A3B8] transition-colors"
      >
        <Bell aria-hidden="true" className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 sm:top-0.5 sm:right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white border border-[#070B18]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notification centre"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 sm:top-10 w-[min(24rem,calc(100vw-2rem))] bg-[#111827] border border-[#1E2D4A] rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#1E2D4A] flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#E2E8F0]">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] disabled:opacity-50 transition-colors"
                >
                  <CheckCheck aria-hidden="true" className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="px-4 py-2 border-b border-[#1E2D4A] flex items-center gap-1" role="tablist">
              {[
                { id: 'all', label: `All (${notifications.length})`, value: false },
                { id: 'unread', label: `Unread (${unreadCount})`, value: true },
              ].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={unreadOnly === tab.value}
                  onClick={() => setUnreadOnly(tab.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                    unreadOnly === tab.value
                      ? 'bg-[#6C63FF]/15 text-[#6C63FF]'
                      : 'text-[#64748B] hover:text-[#94A3B8]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-[22rem] overflow-y-auto no-scrollbar">
              {result.isSkeleton ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2.5 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Bell aria-hidden="true" className="w-8 h-8 text-[#1E2D4A] mx-auto mb-3" />
                  <p className="text-xs font-medium text-[#94A3B8]">
                    {isGated
                      ? 'Notifications unlock once your account is approved'
                      : unreadOnly
                        ? 'Nothing unread'
                        : 'No notifications yet'}
                  </p>
                  {!isGated && !unreadOnly && (
                    <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
                      Rules deliver alerts here as soon as Jira starts syncing.
                    </p>
                  )}
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.label}>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                      {group.label}
                    </p>
                    {group.items.map((notification) => {
                      const Icon = TYPE_ICONS[notification.type]
                      const body = (
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              LEVEL_STYLES[notification.level],
                            )}
                          >
                            <Icon aria-hidden="true" className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[#E2E8F0] truncate">
                              {notification.title}
                            </p>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-[#64748B] mt-1">
                              {relativeTime(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read && (
                            <button
                              onClick={(event) => {
                                event.preventDefault()
                                markRead.mutate(notification.id)
                              }}
                              aria-label={`Mark "${notification.title}" as read`}
                              title="Mark as read"
                              className="p-1 rounded text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors shrink-0"
                            >
                              <Check aria-hidden="true" className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )

                      const className = cn(
                        'block px-4 py-3 border-b border-[#1E2D4A]/50 transition-colors',
                        notification.read ? 'hover:bg-[#151D32]' : 'bg-[#6C63FF]/[0.06] hover:bg-[#6C63FF]/10',
                      )

                      return notification.link ? (
                        <Link
                          key={notification.id}
                          href={notification.link}
                          onClick={() => setOpen(false)}
                          className={className}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div key={notification.id} className={className}>
                          {body}
                        </div>
                      )
                    })}
                  </section>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-[#1E2D4A] text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
