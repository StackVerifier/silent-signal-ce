'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bell, CheckCheck, Check, AlertTriangle, GitBranch, Zap, FlaskConical,
  Settings2, Users, Send, Mail, MessageSquare, type LucideIcon,
} from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useGatedQuery } from '@/hooks/use-gated-data'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationRoutes,
  useNotifications,
} from '@/lib/query/hooks'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { relativeTime } from '@/components/members/member-status-badge'
import type { NotificationLevel, NotificationType } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  risk: AlertTriangle, release: GitBranch, sprint: Zap,
  qa: FlaskConical, system: Settings2, admin: Users,
}

const LEVEL_STYLES: Record<NotificationLevel, string> = {
  critical: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25',
  high: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25',
  medium: 'text-[#6C63FF] bg-[#6C63FF]/10 border-[#6C63FF]/25',
  low: 'text-[#94A3B8] bg-[#94A3B8]/10 border-[#94A3B8]/25',
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'risk', label: 'Risk' },
  { value: 'release', label: 'Release' },
  { value: 'qa', label: 'QA' },
  { value: 'admin', label: 'Admin' },
  { value: 'system', label: 'System' },
]

export default function NotificationsPage() {
  const { can } = useAuth()
  const [filter, setFilter] = useState('all')

  const result = useGatedQuery(useNotifications(), { permission: PERMISSIONS.NOTIFICATIONS_READ })
  const routes = useGatedQuery(useNotificationRoutes(), { permission: PERMISSIONS.NOTIFICATIONS_READ })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = useMemo(
    () =>
      [...(result.data ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [result.data],
  )
  const unread = notifications.filter((notification) => !notification.read).length
  const visible = notifications.filter((notification) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
    return notification.type === filter
  })

  return (
    <PermissionGuard permission={PERMISSIONS.NOTIFICATIONS_READ} showDenied>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SettingsPageHeader
          title="Notifications"
          description={
            result.isSkeleton ? 'Loading…' : `${unread} unread of ${notifications.length}`
          }
          action={
            unread > 0 ? (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-sm font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 disabled:opacity-50 transition-colors"
              >
                <CheckCheck aria-hidden="true" className="w-4 h-4" />
                Mark all read
              </button>
            ) : undefined
          }
        />

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-4xl space-y-6">
            {/* Delivery routing summary */}
            {can(PERMISSIONS.NOTIFICATIONS_WRITE) && (
              <section className="bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1E2D4A] flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#E2E8F0]">Delivery channels</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Where alerts are sent once a rule fires
                    </p>
                  </div>
                  <Link
                    href="/integrations"
                    className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors shrink-0"
                  >
                    Manage
                  </Link>
                </div>
                {routes.isSkeleton ? (
                  <div className="p-5"><SkeletonCard rows={2} /></div>
                ) : (
                  <ul className="divide-y divide-[#1E2D4A]/60">
                    {(routes.data ?? []).map((route) => (
                      <li key={`${route.channel}-${route.target}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        {route.channel === 'email' ? (
                          <Mail aria-hidden="true" className="w-4 h-4 text-[#64748B] shrink-0" />
                        ) : route.channel === 'teams' ? (
                          <MessageSquare aria-hidden="true" className="w-4 h-4 text-[#64748B] shrink-0" />
                        ) : (
                          <Send aria-hidden="true" className="w-4 h-4 text-[#64748B] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#E2E8F0] truncate">
                            {route.target}
                          </p>
                          <p className="text-[11px] text-[#64748B] capitalize">
                            {route.channel} · {route.minimumLevel} and above
                            {route.quietHours &&
                              ` · quiet ${route.quietHours.start}–${route.quietHours.end}`}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
                            route.enabled
                              ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'
                              : 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/25',
                          )}
                        >
                          {route.enabled ? 'Active' : 'Paused'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  role="tab"
                  aria-selected={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    filter === option.value
                      ? 'border-[#6C63FF]/50 bg-[#6C63FF]/15 text-[#6C63FF]'
                      : 'border-[#1E2D4A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#6C63FF]/30',
                  )}
                >
                  {option.label}
                  {option.value === 'unread' && unread > 0 && ` (${unread})`}
                </button>
              ))}
            </div>

            {/* List */}
            {result.isSkeleton ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 rounded-xl bg-[#151D32] border border-[#1E2D4A] animate-pulse" />
                ))}
              </div>
            ) : result.state === 'error' ? (
              <ErrorState
                title="Unable to load notifications"
                description={result.errorMessage ?? undefined}
                onRetry={result.retry}
              />
            ) : visible.length === 0 ? (
              <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl">
                <EmptyState
                  icon={Bell}
                  title={filter === 'all' ? 'No notifications yet' : 'Nothing matches this filter'}
                  description={
                    filter === 'all'
                      ? 'Connect Jira so rules can start evaluating and delivering alerts here.'
                      : 'Try another filter to see the rest of your notifications.'
                  }
                  actions={
                    filter === 'all'
                      ? [{ label: 'Connect Jira', href: '/integrations' }]
                      : [{ label: 'Show all', onClick: () => setFilter('all'), variant: 'secondary' }]
                  }
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {visible.map((notification, index) => {
                  const Icon = TYPE_ICONS[notification.type]
                  return (
                    <motion.li
                      key={notification.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 8) * 0.04 }}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border transition-colors',
                        notification.read
                          ? 'bg-[#151D32] border-[#1E2D4A]'
                          : 'bg-[#6C63FF]/[0.07] border-[#6C63FF]/25',
                      )}
                    >
                      <span
                        className={cn(
                          'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
                          LEVEL_STYLES[notification.level],
                        )}
                      >
                        <Icon aria-hidden="true" className="w-4 h-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-[#E2E8F0]">{notification.title}</h3>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize', LEVEL_STYLES[notification.level])}>
                            {notification.level}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{notification.message}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-[11px] text-[#64748B]">
                            {relativeTime(notification.createdAt)}
                          </span>
                          {notification.link && (
                            <Link
                              href={notification.link}
                              className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors"
                            >
                              Open
                            </Link>
                          )}
                        </div>
                      </div>

                      {!notification.read && (
                        <button
                          onClick={() => markRead.mutate(notification.id)}
                          aria-label={`Mark "${notification.title}" as read`}
                          title="Mark as read"
                          className="p-1.5 rounded-lg text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors shrink-0"
                        >
                          <Check aria-hidden="true" className="w-4 h-4" />
                        </button>
                      )}
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}
