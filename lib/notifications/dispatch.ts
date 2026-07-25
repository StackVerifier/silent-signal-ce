import 'server-only'
import type { NotificationLevel } from '@/lib/types'
import type { WebhookChannel, WebhookEndpointView } from '@/lib/db/repositories'

/**
 * Outbound delivery to Slack and Teams.
 *
 * Runs server-side only — the webhook URL is a bearer credential and never
 * reaches the browser. Each provider wants a different payload shape, so the
 * formatting lives here rather than at the call site.
 */

const LEVEL_ORDER: Record<NotificationLevel, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
}

const LEVEL_COLOUR: Record<NotificationLevel, string> = {
  critical: 'EF4444', high: 'F59E0B', medium: '6C63FF', low: '64748B',
}

export interface OutboundAlert {
  level: NotificationLevel
  title: string
  message: string
  /** Absolute or app-relative link back to the originating page. */
  link?: string
}

/** True when an alert clears the endpoint's severity floor. */
export function meetsThreshold(alert: OutboundAlert, minimum: NotificationLevel): boolean {
  return LEVEL_ORDER[alert.level] >= LEVEL_ORDER[minimum]
}

/**
 * Quiet hours are wall-clock local to the endpoint's timezone and may wrap
 * midnight (22:00→07:00), which a naive start<=now<=end comparison gets wrong.
 */
export function inQuietHours(
  quietHours: WebhookEndpointView['quietHours'],
  at: Date = new Date(),
): boolean {
  if (!quietHours) return false

  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: quietHours.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)

  const minutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number)
    return hour * 60 + minute
  }

  const now = minutes(local)
  const start = minutes(quietHours.start)
  const end = minutes(quietHours.end)

  return start <= end ? now >= start && now < end : now >= start || now < end
}

function slackPayload(alert: OutboundAlert) {
  return {
    text: `${alert.title} — ${alert.message}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${alert.title}*\n${alert.message}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Severity: *${alert.level}* · Silent Signal` }],
      },
      ...(alert.link
        ? [{
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'Open in Silent Signal' },
              url: alert.link,
            }],
          }]
        : []),
    ],
  }
}

function teamsPayload(alert: OutboundAlert) {
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: alert.title,
    themeColor: LEVEL_COLOUR[alert.level],
    title: alert.title,
    text: alert.message,
    sections: [{ facts: [{ name: 'Severity', value: alert.level }] }],
    ...(alert.link
      ? {
          potentialAction: [{
            '@type': 'OpenUri',
            name: 'Open in Silent Signal',
            targets: [{ os: 'default', uri: alert.link }],
          }],
        }
      : {}),
  }
}

export interface DeliveryResult {
  ok: boolean
  error?: string
}

/**
 * Posts one alert to one endpoint. Never throws: a failing channel is recorded
 * against that endpoint, and must not abort delivery to the others.
 */
export async function deliver(
  channel: WebhookChannel,
  url: string,
  alert: OutboundAlert,
  timeoutMs = 10_000,
): Promise<DeliveryResult> {
  if (channel === 'email') {
    return { ok: false, error: 'Email delivery requires SMTP configuration' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel === 'slack' ? slackPayload(alert) : teamsPayload(alert)),
      signal: controller.signal,
    })

    if (!response.ok) {
      // Slack answers 200 "ok" or a short error string; surface it verbatim,
      // truncated so a hostile response cannot bloat the database.
      const detail = (await response.text().catch(() => '')).slice(0, 200)
      return { ok: false, error: `${response.status} ${detail || response.statusText}`.trim() }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: controller.signal.aborted
        ? 'Timed out after 10s'
        : error instanceof Error ? error.message : 'Request failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
