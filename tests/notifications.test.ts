import { describe, expect, it } from 'vitest'
import { inQuietHours, meetsThreshold, type OutboundAlert } from '@/lib/notifications/dispatch'

const alert = (level: OutboundAlert['level']): OutboundAlert => ({
  level, title: 'Release at risk', message: 'Three gates are red',
})

describe('severity threshold', () => {
  it('lets an alert through only at or above the endpoint floor', () => {
    expect(meetsThreshold(alert('critical'), 'high')).toBe(true)
    expect(meetsThreshold(alert('high'), 'high')).toBe(true)
    expect(meetsThreshold(alert('medium'), 'high')).toBe(false)
    expect(meetsThreshold(alert('low'), 'low')).toBe(true)
  })
})

describe('quiet hours', () => {
  const utc = (hour: number, minute = 0) =>
    new Date(Date.UTC(2025, 0, 15, hour, minute))

  it('is never quiet when no window is configured', () => {
    expect(inQuietHours(null, utc(3))).toBe(false)
  })

  it('handles a window inside one day', () => {
    const window = { start: '09:00', end: '17:00', timezone: 'UTC' }
    expect(inQuietHours(window, utc(8, 59))).toBe(false)
    expect(inQuietHours(window, utc(9, 0))).toBe(true)
    expect(inQuietHours(window, utc(16, 59))).toBe(true)
    // End is exclusive, so 17:00 is already back on duty.
    expect(inQuietHours(window, utc(17, 0))).toBe(false)
  })

  // The case a naive `start <= now && now <= end` gets exactly backwards, which
  // would page someone at 02:00 — the hour the window exists to protect.
  it('handles a window that wraps midnight', () => {
    const window = { start: '22:00', end: '07:00', timezone: 'UTC' }
    expect(inQuietHours(window, utc(23))).toBe(true)
    expect(inQuietHours(window, utc(2))).toBe(true)
    expect(inQuietHours(window, utc(6, 59))).toBe(true)
    expect(inQuietHours(window, utc(7, 0))).toBe(false)
    expect(inQuietHours(window, utc(12))).toBe(false)
  })

  it('reads the wall clock of the endpoint timezone, not the server', () => {
    // 23:00 UTC is 02:00 the next day in Istanbul (UTC+3).
    const istanbul = { start: '01:00', end: '05:00', timezone: 'Europe/Istanbul' }
    expect(inQuietHours(istanbul, utc(23))).toBe(true)
    // The same instant is outside an identically-numbered UTC window.
    expect(inQuietHours({ ...istanbul, timezone: 'UTC' }, utc(23))).toBe(false)
  })
})
