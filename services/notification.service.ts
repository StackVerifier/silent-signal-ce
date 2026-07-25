import { mockDb } from '@/lib/mock-db'
import type { Notification, NotificationLevel } from '@/lib/types'
import { resolve, resolveMutation } from './transport'

export type NotificationChannel = 'slack' | 'teams' | 'email'

export interface ChannelRoute {
  channel: NotificationChannel
  /** Slack channel id, Teams webhook id, or an email group. */
  target: string
  minimumLevel: NotificationLevel
  enabled: boolean
  /** Local time window during which delivery is suppressed. */
  quietHours?: { start: string; end: string; timezone: string }
}

/**
 * Outbound notifications.
 *
 * Delivery always happens server-side: Slack and Teams webhook URLs are
 * credentials and must never reach the browser. The client only reads and edits
 * routing rules.
 */
export const notificationService = {
  list: (signal?: AbortSignal) =>
    resolve<Notification[]>({ path: '/api/notifications', signal, mock: () => mockDb.notifications() }),

  markRead: (notificationId: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/notifications/${notificationId}/read`,
      mock: () => mockDb.markNotificationRead(notificationId),
    }),

  markAllRead: () =>
    resolveMutation<{ ok: true }>({
      path: '/api/notifications/read-all',
      mock: () => mockDb.markAllNotificationsRead(),
    }),

  listRoutes: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<ChannelRoute[]>({
      path: '/api/notifications/routes',
      workspaceId,
      signal,
      mock: () => [
        { channel: 'slack', target: '#release-risk', minimumLevel: 'high', enabled: true },
        { channel: 'teams', target: 'Delivery / Alerts', minimumLevel: 'critical', enabled: true },
        {
          channel: 'email', target: 'release-managers@boyner.com.tr',
          minimumLevel: 'critical', enabled: false,
          quietHours: { start: '19:00', end: '08:00', timezone: 'Europe/Istanbul' },
        },
      ],
    }),

  saveRoute: (route: ChannelRoute, workspaceId?: string) =>
    resolveMutation<ChannelRoute>({
      path: '/api/notifications/routes',
      method: 'PUT',
      body: route,
      workspaceId,
      mock: () => route,
    }),

  /** Sends a sample payload so an admin can verify wiring before going live. */
  sendTest: (channel: NotificationChannel, workspaceId?: string) =>
    resolveMutation<{ ok: true }>({
      path: '/api/notifications/test',
      body: { channel },
      workspaceId,
      mock: () => ({ ok: true }),
    }),
}
