import { beforeEach, describe, expect, it } from 'vitest'
import { clearAll, clientAddress, consume, reset } from '@/lib/auth/rate-limit'

const RULE = { limit: 3, windowMs: 60_000 }

beforeEach(clearAll)

describe('rate limiting', () => {
  it('permits attempts up to the limit and then refuses', () => {
    const now = 1_000_000
    expect(consume('k', RULE, now).allowed).toBe(true)
    expect(consume('k', RULE, now).allowed).toBe(true)
    expect(consume('k', RULE, now).remaining).toBe(0)

    const blocked = consume('k', RULE, now)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBe(60)
  })

  it('keys are independent, so one account cannot lock out another', () => {
    const now = 1_000_000
    for (let i = 0; i < RULE.limit; i += 1) consume('a', RULE, now)
    expect(consume('a', RULE, now).allowed).toBe(false)
    expect(consume('b', RULE, now).allowed).toBe(true)
  })

  it('slides rather than resetting on a fixed boundary', () => {
    const start = 1_000_000
    consume('k', RULE, start)
    consume('k', RULE, start + 10_000)
    consume('k', RULE, start + 20_000)
    expect(consume('k', RULE, start + 30_000).allowed).toBe(false)

    // The first attempt ages out here; exactly one slot reopens — a fixed
    // window would have reopened all three at once.
    expect(consume('k', RULE, start + 60_001).allowed).toBe(true)
    expect(consume('k', RULE, start + 60_002).allowed).toBe(false)
  })

  it('does not extend the lockout when a client keeps hammering', () => {
    const start = 1_000_000
    for (let i = 0; i < RULE.limit; i += 1) consume('k', RULE, start)
    // Refused attempts must not be recorded, or a persistent client would
    // never see the window expire.
    for (let i = 0; i < 50; i += 1) consume('k', RULE, start + 30_000)
    expect(consume('k', RULE, start + 60_001).allowed).toBe(true)
  })

  it('clears the counter on reset, which is what a successful login does', () => {
    const now = 1_000_000
    for (let i = 0; i < RULE.limit; i += 1) consume('k', RULE, now)
    expect(consume('k', RULE, now).allowed).toBe(false)
    reset('k')
    expect(consume('k', RULE, now).allowed).toBe(true)
  })

  it('reports a retryAfter that actually reaches the reopening', () => {
    const start = 1_000_000
    for (let i = 0; i < RULE.limit; i += 1) consume('k', RULE, start)
    const { retryAfter } = consume('k', RULE, start + 5_000)
    const later = start + 5_000 + retryAfter * 1000
    expect(consume('k', RULE, later).allowed).toBe(true)
  })
})

describe('clientAddress', () => {
  it('takes the first hop of x-forwarded-for', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
    })
    expect(clientAddress(request)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientAddress(new Request('https://example.test', {
      headers: { 'x-real-ip': '198.51.100.4' },
    }))).toBe('198.51.100.4')
    // A shared 'unknown' bucket is deliberate: with no address to key on,
    // limiting everyone together beats not limiting at all.
    expect(clientAddress(new Request('https://example.test'))).toBe('unknown')
  })
})
