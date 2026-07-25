/**
 * Webhook URL validation, shared by the route handler and the dialog.
 *
 * A webhook URL is a bearer credential *and* a destination: a mistyped Slack
 * URL would silently POST alert contents — including issue titles — to whatever
 * host was pasted. So the host is checked against the provider the endpoint
 * claims to be, not merely parsed.
 *
 * The server is the authority. This module has no server-only dependencies so
 * the browser can run the identical check and catch a typo before a round trip,
 * rather than instead of one.
 */

export type WebhookChannel = 'slack' | 'teams' | 'email'

export interface HostRule {
  pattern: RegExp
  message: string
  placeholder: string
}

export const WEBHOOK_HOSTS: Partial<Record<WebhookChannel, HostRule>> = {
  slack: {
    pattern: /^hooks\.slack\.com$/i,
    message: 'A Slack webhook URL must be on hooks.slack.com',
    placeholder: 'https://hooks.slack.com/services/T000/B000/xxxxxxxx',
  },
  teams: {
    // Office 365 connectors live on several Microsoft hosts; the leading
    // `(^|\.)` anchors to a label boundary so `office.com.evil.test` fails.
    pattern: /(^|\.)(office|microsoft|office365)\.com$/i,
    message: 'A Teams webhook URL must be on an Office 365 host',
    placeholder: 'https://outlook.office.com/webhook/…',
  },
}

export interface WebhookUrlProblem {
  message: string
}

/** Returns the problem with `url` for `channel`, or null when it is acceptable. */
export function checkWebhookUrl(channel: WebhookChannel, url: string): WebhookUrlProblem | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { message: 'Enter a valid URL' }
  }

  // Plain http would put the credential on the wire in clear text.
  if (parsed.protocol !== 'https:') return { message: 'The URL must use https' }

  const rule = WEBHOOK_HOSTS[channel]
  if (!rule) return null
  return rule.pattern.test(parsed.host) ? null : { message: rule.message }
}
