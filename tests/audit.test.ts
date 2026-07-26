import { describe, expect, it } from 'vitest'
import {
  AUDIT_CATEGORIES, AUDIT_EVENTS, AUDIT_SEVERITIES, auditEvent, isSecurityEvent,
} from '@/lib/audit/events'
import {
  MASK, diffFields, isSecretField, maskSecretsInText, redactChanges, redactValue,
} from '@/lib/audit/redact'
import { auditVisibility, redactForViewer, redactListForViewer } from '@/lib/audit/visibility'
import { describeDevice, inferSource } from '@/lib/audit/context'
import { legacyShape } from '@/lib/audit/legacy'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { SYSTEM_ROLES } from '@/lib/rbac/roles'
import type { AuditRecord } from '@/lib/audit/types'

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: '1',
    event: 'rule.enabled',
    category: 'rules',
    severity: 'warning',
    status: 'success',
    source: 'dashboard',
    organizationId: 'org_1',
    actor: { id: 'mem_1', name: 'Alice', email: 'alice@acme.test' },
    ipAddress: '203.0.113.7',
    userAgent: 'Mozilla/5.0',
    device: 'Chrome on macOS',
    sessionId: 'sess_1',
    createdAt: new Date('2026-01-15T09:30:00Z'),
    ...overrides,
  }
}

describe('event catalogue', () => {
  it('gives every event a category and severity from the known sets', () => {
    for (const [id, definition] of Object.entries(AUDIT_EVENTS)) {
      expect(AUDIT_CATEGORIES, `${id} category`).toContain(definition.category)
      expect(AUDIT_SEVERITIES, `${id} severity`).toContain(definition.severity)
      expect(definition.label.length, `${id} label`).toBeGreaterThan(0)
    }
  })

  it('resolves an unknown event instead of throwing', () => {
    // A record written by a newer version must still render. An audit log that
    // cannot display one of its own rows hides the row's existence entirely.
    const unknown = auditEvent('something.invented')
    expect(unknown.known).toBe(false)
    expect(unknown.category).toBe('system')
    expect(unknown.severity).toBe('warning')
  })

  it('marks the events an investigator looks for first as security-relevant', () => {
    expect(isSecurityEvent('member.role_changed')).toBe(true)
    expect(isSecurityEvent('api.key_created')).toBe(true)
    expect(isSecurityEvent('auth.login_failed')).toBe(true)
    expect(isSecurityEvent('sprint.started')).toBe(false)
  })

  it('rates a permission change above an ordinary update', () => {
    expect(AUDIT_EVENTS['member.role_changed'].severity).toBe('critical')
    expect(AUDIT_EVENTS['member.updated'].severity).toBe('info')
  })
})

describe('legacy projection', () => {
  it('keeps the NOT NULL columns populated for every catalogued event', () => {
    for (const id of Object.keys(AUDIT_EVENTS)) {
      const { action, resource } = legacyShape(id)
      expect(action, id).toBeTruthy()
      expect(resource, id).toBeTruthy()
    }
  })

  it('maps the shapes a reader would expect', () => {
    expect(legacyShape('team.created').action).toBe('create')
    expect(legacyShape('member.removed').action).toBe('delete')
    expect(legacyShape('member.role_changed').action).toBe('permission_change')
    expect(legacyShape('team.created').resource).toBe('team')
  })
})

describe('secret masking', () => {
  it('recognises credential-ish field names in any casing or separator', () => {
    for (const name of [
      'password', 'jiraApiToken', 'slack_webhook_url', 'SMTP_PASSWORD',
      'clientSecret', 'refresh_token', 'Authorization', 'session-id',
    ]) {
      expect(isSecretField(name), name).toBe(true)
    }
    expect(isSecretField('name')).toBe(false)
    expect(isSecretField('minimumLevel')).toBe(false)
  })

  it('masks a secret field entirely', () => {
    expect(redactValue('hunter2', 'password')).toBe(MASK)
  })

  it('keeps null distinct from masked', () => {
    // "was not set" and "was set to something secret" are different facts, and
    // flattening them would mislead an investigator.
    expect(redactValue(null, 'password')).toBeNull()
    expect(redactValue(undefined, 'apiKey')).toBeUndefined()
  })

  it('catches a credential hiding in an innocently named field', () => {
    const text = 'posted to https://hooks.slack.com/services/T00/B00/abcdef123456'
    expect(maskSecretsInText(text)).not.toContain('abcdef123456')
    expect(redactValue(text, 'description')).not.toContain('hooks.slack.com/services')
  })

  it.each([
    ['slack token', 'xoxb-1234567890-abcdefghijkl'],
    ['stripe key', 'sk_live_abcdefghijklmnop'],
    ['github token', 'ghp_abcdefghijklmnopqrstuvwxyz012345'],
    ['atlassian token', 'ATATT3xFfGF0abcdefghijklmnopqrstuv='],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r'],
  ])('masks a %s appearing in free text', (_label, secret) => {
    expect(maskSecretsInText(`value is ${secret}`)).not.toContain(secret)
  })

  it('walks nested objects and arrays', () => {
    const redacted = redactValue({
      config: { auth: { apiToken: 'secret-value' }, items: [{ password: 'p' }] },
      label: 'fine',
    }) as Record<string, never>
    expect(JSON.stringify(redacted)).not.toContain('secret-value')
    expect(JSON.stringify(redacted)).toContain('fine')
  })

  it('masks both sides of a change so history cannot leak an old credential', () => {
    // A rotated secret is still a secret: the "before" value is exactly what an
    // attacker reading the log would want.
    const redacted = redactChanges({
      url: { before: 'https://hooks.slack.com/services/T0/B0/old', after: 'https://hooks.slack.com/services/T0/B0/new' },
    })!
    expect(JSON.stringify(redacted)).not.toContain('/old')
    expect(JSON.stringify(redacted)).not.toContain('/new')
  })
})

describe('diffFields', () => {
  it('keeps only fields that actually moved', () => {
    const changes = diffFields(
      { name: 'A', severity: 'medium', threshold: 10 },
      { name: 'A', severity: 'high', threshold: 5 },
    )!
    expect(Object.keys(changes).sort()).toEqual(['severity', 'threshold'])
  })

  it('returns undefined when nothing changed, so no empty diff is stored', () => {
    expect(diffFields({ a: 1 }, { a: 1 })).toBeUndefined()
  })

  it('treats undefined as "not supplied" rather than a change to null', () => {
    expect(diffFields({ name: 'A', note: 'x' }, { name: 'B' }, ['name', 'note'])).toEqual({
      name: { before: 'A', after: 'B' },
      note: { before: 'x', after: null },
    })
  })

  it('masks while diffing', () => {
    const changes = diffFields({ apiToken: 'old-token' }, { apiToken: 'new-token' })!
    expect(changes.apiToken).toEqual({ before: MASK, after: MASK })
  })
})

describe('viewer visibility', () => {
  const full = auditVisibility([PERMISSIONS.AUDIT_READ, PERMISSIONS.AUDIT_READ_SENSITIVE])
  const basic = auditVisibility([PERMISSIONS.AUDIT_READ])
  const none = auditVisibility([])

  it('reflects the granted permissions', () => {
    expect(full.canReadSensitive).toBe(true)
    expect(basic.canRead).toBe(true)
    expect(basic.canReadSensitive).toBe(false)
    expect(none.canRead).toBe(false)
  })

  it('returns nothing at all to someone without read', () => {
    expect(redactForViewer(record(), none)).toBeNull()
  })

  it('strips origin fields from an ordinary reader', () => {
    const seen = redactForViewer(record(), basic)!
    expect(seen.ipAddress).toBeUndefined()
    expect(seen.device).toBeUndefined()
    expect(seen.sessionId).toBeUndefined()
    expect(seen.userAgent).toBeUndefined()
    // The event itself is still visible — only the surveillance detail is not.
    expect(seen.event).toBe('rule.enabled')
  })

  it('leaves a privileged reader untouched', () => {
    expect(redactForViewer(record(), full)?.ipAddress).toBe('203.0.113.7')
  })

  it('removes security events wholesale rather than blanking them', () => {
    // Leaving a stub would still tell the reader that someone's permissions
    // changed at that moment, which is the thing being protected.
    const security = record({ event: 'member.role_changed' })
    expect(redactForViewer(security, basic)).toBeNull()
    expect(redactForViewer(security, full)).not.toBeNull()
  })

  it('filters a list without leaving holes', () => {
    const visible = redactListForViewer(
      [record({ id: '1' }), record({ id: '2', event: 'api.key_created' }), record({ id: '3' })],
      basic,
    )
    expect(visible.map((entry) => entry.id)).toEqual(['1', '3'])
  })
})

describe('role grants', () => {
  it('gives a developer no audit access at all', () => {
    const permissions = SYSTEM_ROLES.developer.permissions
    expect(permissions).not.toContain(PERMISSIONS.AUDIT_READ)
  })

  it('gives QA leads and release managers read without the forensic detail', () => {
    for (const roleId of ['qa_lead', 'release_manager'] as const) {
      const permissions = SYSTEM_ROLES[roleId].permissions
      expect(permissions, roleId).toContain(PERMISSIONS.AUDIT_READ)
      expect(permissions, roleId).not.toContain(PERMISSIONS.AUDIT_READ_SENSITIVE)
      expect(permissions, roleId).not.toContain(PERMISSIONS.AUDIT_EXPORT)
    }
  })

  it('gives administrators the whole record', () => {
    for (const roleId of ['org_admin', 'org_owner', 'platform_admin'] as const) {
      const permissions = SYSTEM_ROLES[roleId].permissions
      expect(permissions, roleId).toContain(PERMISSIONS.AUDIT_READ_SENSITIVE)
      expect(permissions, roleId).toContain(PERMISSIONS.AUDIT_EXPORT)
    }
  })
})

describe('request context', () => {
  it('describes a device coarsely enough to be useful, not to fingerprint', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/120 Safari/537'))
      .toBe('Chrome on macOS')
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Firefox/121')).toBe('Firefox on Windows')
    expect(describeDevice(null)).toBeUndefined()
  })

  it('separates a browser from a script', () => {
    const browser = new Request('https://x.test', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' } })
    const script = new Request('https://x.test', { headers: { 'user-agent': 'curl/8.4.0' } })
    expect(inferSource(browser)).toBe('dashboard')
    expect(inferSource(script)).toBe('api')
  })

  it('trusts an explicit source header only for the values it names', () => {
    const cli = new Request('https://x.test', { headers: { 'x-silent-signal-source': 'cli' } })
    expect(inferSource(cli)).toBe('cli')
    const bogus = new Request('https://x.test', { headers: { 'x-silent-signal-source': 'system' } })
    // 'system' would let a caller disguise itself as the platform.
    expect(inferSource(bogus)).toBe('api')
  })
})
