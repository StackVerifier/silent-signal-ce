import { describe, expect, it } from 'vitest'
import {
  hashInvitationToken, invitationLink, newInvitationToken, tokensMatch,
} from '@/lib/auth/invitation-token'

/**
 * Invitation tokens used to be `newId('tok')` — a timestamp in base 36 plus six
 * random characters — stored in clear in a column named `token_hash`, and never
 * surfaced to anyone. So they were both guessable and useless.
 */

describe('invitation tokens', () => {
  it('carries enough entropy to be unguessable', () => {
    // 32 random bytes; base64url of that is 43 characters.
    const token = newInvitationToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, newInvitationToken))
    expect(tokens.size).toBe(500)
  })

  it('is not derivable from the time it was issued', () => {
    // The old scheme was `Date.now().toString(36)` plus six characters, so two
    // tokens minted together shared a long prefix and the search space was
    // small enough to walk.
    const [a, b] = [newInvitationToken(), newInvitationToken()]
    let shared = 0
    while (shared < a.length && a[shared] === b[shared]) shared += 1
    expect(shared).toBeLessThan(6)
  })

  it('hashes deterministically, and the hash does not reveal the token', () => {
    const token = newInvitationToken()
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
    expect(hashInvitationToken(token)).toHaveLength(64)
    expect(hashInvitationToken(token)).not.toContain(token.slice(0, 8))
  })

  it('gives different tokens different hashes', () => {
    expect(hashInvitationToken('a')).not.toBe(hashInvitationToken('b'))
  })

  it('compares in constant time without throwing on length mismatch', () => {
    const hash = hashInvitationToken('x')
    expect(tokensMatch(hash, hash)).toBe(true)
    expect(tokensMatch(hash, hashInvitationToken('y'))).toBe(false)
    // timingSafeEqual throws on unequal lengths; the wrapper must not.
    expect(tokensMatch(hash, 'short')).toBe(false)
    expect(tokensMatch('', '')).toBe(true)
  })

  it('builds an absolute link and escapes the token', () => {
    // The link is pasted into a chat window, where a relative path is useless.
    expect(invitationLink('abc', 'https://app.example.test'))
      .toBe('https://app.example.test/auth/accept?token=abc')
    // A trailing slash on the origin must not produce a double slash.
    expect(invitationLink('abc', 'https://app.example.test/'))
      .toBe('https://app.example.test/auth/accept?token=abc')
    expect(invitationLink('a+b/c=', 'https://x.test'))
      .toBe('https://x.test/auth/accept?token=a%2Bb%2Fc%3D')
  })
})
