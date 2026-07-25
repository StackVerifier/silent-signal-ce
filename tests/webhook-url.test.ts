import { describe, expect, it } from 'vitest'
import { checkWebhookUrl } from '@/lib/notifications/webhook-url'

describe('webhook URL validation', () => {
  it('accepts a genuine Slack webhook', () => {
    expect(checkWebhookUrl('slack', 'https://hooks.slack.com/services/T0/B0/xyz')).toBeNull()
  })

  it('accepts Office 365 hosts for Teams', () => {
    for (const url of [
      'https://outlook.office.com/webhook/abc',
      'https://acme.webhook.office.com/webhookb2/abc',
      'https://prod-1.microsoft.com/workflows/abc',
    ]) {
      expect(checkWebhookUrl('teams', url)).toBeNull()
    }
  })

  it('rejects plain http, which would put the credential on the wire in clear', () => {
    expect(checkWebhookUrl('slack', 'http://hooks.slack.com/services/T0/B0/xyz')?.message)
      .toMatch(/https/)
  })

  it('rejects a host that merely contains the provider name', () => {
    // The attack this exists to stop: a URL that reads as Slack at a glance but
    // delivers every alert — issue titles included — somewhere else.
    for (const url of [
      'https://hooks.slack.com.evil.test/services/T0/B0/xyz',
      'https://evil.test/hooks.slack.com',
      'https://nothooks.slack.com/services/T0/B0/xyz',
    ]) {
      expect(checkWebhookUrl('slack', url)).not.toBeNull()
    }
    expect(checkWebhookUrl('teams', 'https://office.com.evil.test/webhook')).not.toBeNull()
  })

  it('rejects a Teams URL on a Slack endpoint and the reverse', () => {
    expect(checkWebhookUrl('teams', 'https://hooks.slack.com/services/T0/B0/xyz')).not.toBeNull()
    expect(checkWebhookUrl('slack', 'https://outlook.office.com/webhook/abc')).not.toBeNull()
  })

  it('rejects something that is not a URL at all', () => {
    expect(checkWebhookUrl('slack', '')?.message).toMatch(/valid URL/)
    expect(checkWebhookUrl('slack', 'hooks.slack.com/services')).not.toBeNull()
  })

  it('has no host opinion about email, so it only enforces the scheme', () => {
    expect(checkWebhookUrl('email', 'https://anything.test/hook')).toBeNull()
  })
})
