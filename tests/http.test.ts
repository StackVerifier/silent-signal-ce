import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from '@/services/http'

function respondWith(body: unknown, init: ResponseInit = {}) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      ...init,
    })))
}

afterEach(() => vi.unstubAllGlobals())

/**
 * JSON has no date type, so every `Date` on the wire arrives as a string. The
 * reviver lives at the transport boundary because the alternative — remembering
 * to parse at each of the hundreds of call sites — fails the first time someone
 * forgets, with `date.getTime is not a function` at render.
 */
describe('date revival', () => {
  it('revives ISO timestamps, at any depth', async () => {
    respondWith({
      createdAt: '2025-01-15T09:30:00.000Z',
      nested: { items: [{ lastActiveAt: '2025-01-15T09:30:00Z' }] },
    })
    const result = await request<{
      createdAt: Date
      nested: { items: { lastActiveAt: Date }[] }
    }>('/api/thing')

    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.createdAt.getTime()).toBe(Date.parse('2025-01-15T09:30:00.000Z'))
    expect(result.nested.items[0].lastActiveAt).toBeInstanceOf(Date)
  })

  it('accepts an explicit offset as well as Z', async () => {
    respondWith({ at: '2025-01-15T12:30:00+03:00' })
    const { at } = await request<{ at: Date }>('/api/thing')
    expect(at).toBeInstanceOf(Date)
    expect(at.toISOString()).toBe('2025-01-15T09:30:00.000Z')
  })

  it('leaves strings that merely look date-ish alone', async () => {
    // Over-eager revival is the opposite failure: a version number or an ID
    // silently becoming a Date is far harder to debug than a missing one.
    respondWith({
      date: '2025-01-15',
      time: '09:30',
      version: '2025.01.15',
      text: 'shipped 2025-01-15T09:30:00Z at last',
    })
    const result = await request<Record<string, unknown>>('/api/thing')
    for (const value of Object.values(result)) {
      expect(typeof value).toBe('string')
    }
  })

  it('preserves nulls and numbers', async () => {
    respondWith({ deletedAt: null, count: 3, ok: false })
    expect(await request('/api/thing')).toEqual({ deletedAt: null, count: 3, ok: false })
  })
})

describe('error normalisation', () => {
  it('surfaces the server message and status', async () => {
    respondWith({ error: 'Invalid email or password' }, { status: 401 })
    await expect(request('/api/session', { method: 'POST' }))
      .rejects.toMatchObject({ status: 401, message: 'Invalid email or password' })
  })

  it('does not retry a POST — a rejected login must not be replayed', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Too many sign-in attempts. Try again shortly.' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'Retry-After': '60' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/api/session', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats 204 as absent rather than trying to parse a body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    expect(await request('/api/session')).toBeUndefined()
  })
})
