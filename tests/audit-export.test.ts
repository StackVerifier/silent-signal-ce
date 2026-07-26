import { describe, expect, it } from 'vitest'
import { csvField, exportFilename, toCsv, toJson } from '@/lib/audit/export'
import { alertLevel, buildAlert, shouldAlert } from '@/lib/audit/alerts'
import {
  DEFAULT_RETENTION_DAYS, RETENTION_OPTIONS, isValidRetention, readRetentionDays, retentionLabel,
} from '@/lib/audit/retention-options'
import type { AuditRecord } from '@/lib/audit/types'

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: '1',
    event: 'member.role_changed',
    category: 'members',
    severity: 'critical',
    status: 'success',
    source: 'dashboard',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    workspaceName: 'Production',
    actor: { id: 'mem_1', name: 'Alice Chen', email: 'alice@acme.test', roleId: 'org_owner' },
    target: { type: 'member', id: 'mem_5', name: 'Elif Kaya', email: 'elif@acme.test' },
    changes: { roleId: { before: 'developer', after: 'qa_lead' } },
    ipAddress: '203.0.113.7',
    device: 'Chrome on macOS',
    createdAt: new Date('2026-01-15T09:30:00Z'),
    ...overrides,
  }
}

describe('CSV export', () => {
  it('quotes and escapes embedded quotes', () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('a,b')).toBe('"a,b"')
  })

  it('neutralises formula injection', () => {
    // Excel and Sheets evaluate a cell starting with these, so an audit value
    // like `=HYPERLINK(...)` would become executable content in the reviewer's
    // spreadsheet. Quoting alone does not stop it.
    for (const dangerous of ['=1+1', '+1', '-1', '@SUM(A1)']) {
      expect(csvField(dangerous).startsWith(`"'`), dangerous).toBe(true)
    }
    // A value that merely contains one of those characters is left alone.
    expect(csvField('a=b')).toBe('"a=b"')
  })

  it('renders empty rather than the string "null"', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })

  it('writes a header and one line per record', () => {
    const csv = toCsv([record(), record({ id: '2' })])
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('timestamp,event,label')
    expect(lines[1]).toContain('member.role_changed')
    expect(lines[1]).toContain('Alice Chen')
    expect(lines[1]).toContain('Elif Kaya')
  })

  it('starts with a BOM so Excel reads UTF-8', () => {
    // Without it every Turkish name in the file opens as mojibake.
    expect(toCsv([record()]).charCodeAt(0)).toBe(0xfeff)
  })

  it('carries the before and after values, not just a count', () => {
    const csv = toCsv([record()])
    expect(csv).toContain('developer')
    expect(csv).toContain('qa_lead')
  })
})

describe('JSON export', () => {
  it('names its schema and counts its records', () => {
    const parsed = JSON.parse(toJson([record()]))
    expect(parsed.schema).toBe('silent-signal.audit.v1')
    expect(parsed.count).toBe(1)
    expect(parsed.records[0].event).toBe('member.role_changed')
  })

  it('names the file by date and format', () => {
    expect(exportFilename('csv', new Date('2026-01-15T00:00:00Z'))).toBe('audit-log-2026-01-15.csv')
    expect(exportFilename('json', new Date('2026-01-15T00:00:00Z'))).toBe('audit-log-2026-01-15.json')
  })
})

describe('alerting', () => {
  it('alerts on critical events', () => {
    expect(shouldAlert({ event: 'member.role_changed', severity: 'critical', status: 'success' })).toBe(true)
  })

  it('stays quiet for routine events', () => {
    expect(shouldAlert({ event: 'auth.login', severity: 'info', status: 'success' })).toBe(false)
    expect(shouldAlert({ event: 'rule.updated', severity: 'warning', status: 'success' })).toBe(false)
  })

  it('does not alert on a denial', () => {
    // A denied attempt is a control working. Paging on every one would fire
    // whenever a viewer clicks Billing, and a noisy channel gets muted.
    expect(shouldAlert({ event: 'authz.permission_denied', severity: 'warning', status: 'denied' })).toBe(false)
  })

  it('alerts on a security-relevant failure below critical', () => {
    // A failed sign-in is only `warning`, but a burst of them is the thing to
    // catch.
    expect(shouldAlert({ event: 'auth.login_failed', severity: 'warning', status: 'failed' })).toBe(true)
    // An ordinary failure is not security-relevant and stays in the log.
    expect(shouldAlert({ event: 'integration.sync_failed', severity: 'warning', status: 'failed' })).toBe(false)
  })

  it('maps severity onto the levels endpoints filter on', () => {
    expect(alertLevel('critical')).toBe('critical')
    expect(alertLevel('warning')).toBe('high')
    expect(alertLevel('info')).toBe('low')
  })

  it('builds a message naming actor, target, scope and fields', () => {
    const alert = buildAlert(record())
    expect(alert.title).toBe('Member role changed')
    expect(alert.message).toContain('Alice Chen')
    expect(alert.message).toContain('Elif Kaya')
    expect(alert.message).toContain('Production')
    expect(alert.message).toContain('roleId')
    expect(alert.level).toBe('critical')
  })

  it('never carries a value the record itself masks', () => {
    const alert = buildAlert(record({
      event: 'notification.endpoint_updated',
      changes: { url: { before: '••••••••', after: '••••••••' } },
    }))
    // Field names are fine to name; values are not included at all.
    expect(alert.message).toContain('url')
    expect(alert.message).not.toContain('hooks.slack.com')
  })
})

describe('retention', () => {
  it('offers only defensible windows', () => {
    expect(RETENTION_OPTIONS[0]).toBe(30)
    expect(RETENTION_OPTIONS.at(-1)).toBe(2555)
    for (const days of RETENTION_OPTIONS) expect(isValidRetention(days)).toBe(true)
    // A one-day window would destroy the evidence trail; 20 years keeps
    // personal data with no purpose.
    expect(isValidRetention(1)).toBe(false)
    expect(isValidRetention(7300)).toBe(false)
  })

  it('labels days and years readably', () => {
    expect(retentionLabel(30)).toBe('30 days')
    expect(retentionLabel(365)).toBe('1 year')
    expect(retentionLabel(2555)).toBe('7 years')
  })

  it('falls back to the default rather than throwing on bad settings', () => {
    // A parse error must not stop the purge for every other tenant, and must
    // certainly not be read as "keep nothing".
    expect(readRetentionDays(null)).toBe(DEFAULT_RETENTION_DAYS)
    expect(readRetentionDays('not json')).toBe(DEFAULT_RETENTION_DAYS)
    expect(readRetentionDays('{}')).toBe(DEFAULT_RETENTION_DAYS)
    expect(readRetentionDays('{"dataRetentionDays":1}')).toBe(DEFAULT_RETENTION_DAYS)
  })

  it('reads a valid configured window', () => {
    expect(readRetentionDays('{"dataRetentionDays":90}')).toBe(90)
  })
})
