import { request } from './http'
import type { Notification, NotificationLevel } from '@/lib/types'

export type NotificationChannel = 'slack' | 'teams' | 'email'

export interface QuietHours {
  start: string
  end: string
  timezone: string
}

/**
 * A webhook destination as the browser is allowed to see it: `urlHint` is a
 * masked preview, never the URL itself. The real URL only exists server-side.
 */
export interface WebhookEndpoint {
  id: string
  workspaceId: string
  channel: NotificationChannel
  label: string
  urlHint: string
  minimumLevel: NotificationLevel
  enabled: boolean
  quietHours: QuietHours | null
  lastStatus: 'ok' | 'failed' | 'untested' | null
  lastError: string | null
  lastTestedAt: string | null
}

export interface WebhookInput {
  channel: NotificationChannel
  label: string
  url: string
  minimumLevel: NotificationLevel
  enabled: boolean
  quietHours: QuietHours | null
}

export const notificationService = {
  list: (signal?: AbortSignal) =>
    request<Notification[]>('/api/notifications', { signal }),

  markRead: (notificationId: string) =>
    request<{ ok: true }>(`/api/notifications/${notificationId}`, { method: 'POST' }),

  markAllRead: () =>
    request<{ ok: true }>('/api/notifications', { method: 'POST' }),

  listWebhooks: (workspaceId?: string, signal?: AbortSignal) =>
    request<WebhookEndpoint[]>('/api/webhooks', { workspaceId, signal }),

  createWebhook: (input: WebhookInput, workspaceId?: string) =>
    request<WebhookEndpoint>('/api/webhooks', { method: 'POST', body: input, workspaceId }),

  updateWebhook: (webhookId: string, patch: Partial<WebhookInput>, workspaceId?: string) =>
    request<WebhookEndpoint>(`/api/webhooks/${webhookId}`, {
      method: 'PATCH', body: patch, workspaceId,
    }),

  deleteWebhook: (webhookId: string, workspaceId?: string) =>
    request<{ ok: true }>(`/api/webhooks/${webhookId}`, { method: 'DELETE', workspaceId }),

  /** Posts a real message to the destination. */
  testWebhook: (webhookId: string, workspaceId?: string) =>
    request<{ ok: boolean; error: string | null }>(`/api/webhooks/${webhookId}`, {
      method: 'POST', workspaceId,
    }),
}
