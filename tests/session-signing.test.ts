import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { SessionClaims } from '@/lib/auth-config'

/**
 * The session cookie was previously base64 JSON with no signature, which made
 * authentication a suggestion: anyone could mint themselves an owner session by
 * writing one. These tests exist so that cannot come back silently.
 */

process.env.SESSION_SECRET = 'a-test-secret-that-is-at-least-32-characters-long'

let encodeClaims: (claims: SessionClaims) => Promise<string>
let decodeClaims: (value: string) => Promise<SessionClaims | null>

beforeAll(async () => {
  ({ encodeClaims, decodeClaims } = await import('@/lib/auth-config'))
})

const claims = (overrides: Partial<SessionClaims> = {}): SessionClaims => ({
  memberId: 'mem-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  roleId: 'developer',
  status: 'approved',
  expiresAt: Date.now() + 60_000,
  ...overrides,
})

/** What an attacker would write: the old, unsigned format. */
function unsigned(value: SessionClaims): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('session signing', () => {
  it('round-trips claims it signed', async () => {
    const token = await encodeClaims(claims())
    expect(await decodeClaims(token)).toMatchObject({
      memberId: 'mem-1', organizationId: 'org-1', roleId: 'developer',
    })
  })

  it('rejects an unsigned cookie', async () => {
    // The exact attack: base64 of hand-written claims, no signature.
    expect(await decodeClaims(unsigned(claims({ roleId: 'org_owner' })))).toBeNull()
  })

  it('rejects a forged owner session', async () => {
    const forged = `${unsigned(claims({ memberId: 'attacker', roleId: 'org_owner' }))}.deadbeef`
    expect(await decodeClaims(forged)).toBeNull()
  })

  it('rejects claims edited after signing', async () => {
    // Privilege escalation by editing the payload of a legitimately obtained
    // cookie — the signature no longer matches.
    const token = await encodeClaims(claims({ roleId: 'viewer' }))
    const [, signature] = token.split('.')
    const escalated = `${unsigned(claims({ roleId: 'org_owner' }))}.${signature}`
    expect(await decodeClaims(escalated)).toBeNull()
  })

  it('rejects a cookie signed with a different secret', async () => {
    const token = await encodeClaims(claims())
    process.env.SESSION_SECRET = 'a-completely-different-secret-also-32-chars'
    expect(await decodeClaims(token)).toBeNull()
    process.env.SESSION_SECRET = 'a-test-secret-that-is-at-least-32-characters-long'
    // And verifies again once the original secret is restored, proving the key
    // cache follows the secret rather than pinning the first one it saw.
    expect(await decodeClaims(token)).not.toBeNull()
  })

  it('rejects an expired cookie even though the signature is valid', async () => {
    expect(await decodeClaims(await encodeClaims(claims({ expiresAt: Date.now() - 1 })))).toBeNull()
  })

  it('rejects malformed input rather than throwing', async () => {
    for (const value of ['', 'garbage', 'a.b', '.', 'x.', '.y', 'not-base64!.sig']) {
      expect(await decodeClaims(value), value).toBeNull()
    }
  })

  it('produces a cookie-safe value', async () => {
    // base64url plus a dot: no padding, no characters needing percent-encoding.
    const token = await encodeClaims(claims())
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('survives non-ASCII in the claims', async () => {
    const token = await encodeClaims(claims({ memberId: 'üye-İrem-Yıldız' }))
    expect((await decodeClaims(token))?.memberId).toBe('üye-İrem-Yıldız')
  })
})

describe('secret handling', () => {
  it('refuses to run in production without a secret', async () => {
    const previousSecret = process.env.SESSION_SECRET
    delete process.env.SESSION_SECRET
    // A production deployment that silently signed with a public key would be
    // no safer than the unsigned cookie this replaced, so it fails closed.
    vi.stubEnv('NODE_ENV', 'production')

    await expect(encodeClaims(claims())).rejects.toThrow(/SESSION_SECRET is required/)

    vi.unstubAllEnvs()
    process.env.SESSION_SECRET = previousSecret
  })

  it('treats a too-short secret as absent', async () => {
    const previous = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'short'
    vi.stubEnv('NODE_ENV', 'production')

    await expect(encodeClaims(claims())).rejects.toThrow(/at least 32 characters/)

    vi.unstubAllEnvs()
    process.env.SESSION_SECRET = previous
  })
})
