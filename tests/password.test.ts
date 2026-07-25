import { describe, expect, it } from 'vitest'
import { hashPassword, needsRehash, validatePassword, verifyPassword } from '@/lib/auth/password'

describe('password hashing', () => {
  it('verifies the password it hashed and rejects anything else', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(await verifyPassword('correct horse battery stapl', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('salts, so the same password never produces the same hash twice', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')])
    expect(first).not.toBe(second)
    expect(await verifyPassword('same', first)).toBe(true)
    expect(await verifyPassword('same', second)).toBe(true)
  })

  it('stores its parameters, so cost can be raised without invalidating hashes', async () => {
    const stored = await hashPassword('whatever')
    const [scheme, n, r, p] = stored.split('$')
    expect(scheme).toBe('scrypt')
    expect(Number(n)).toBeGreaterThanOrEqual(32768)
    expect([r, p].map(Number)).toEqual([8, 1])
  })

  it('normalises unicode, so the same typed password verifies from either keyboard', async () => {
    // U+00E9 vs e + U+0301 — visually identical, different bytes.
    const stored = await hashPassword('caféphrase')
    expect(await verifyPassword('caféphrase', stored)).toBe(true)
  })

  it('returns false rather than throwing on a malformed stored value', async () => {
    for (const junk of ['', 'not-a-hash', 'scrypt$$$$', 'bcrypt$2b$10$abc']) {
      expect(await verifyPassword('anything', junk)).toBe(false)
    }
  })
})

describe('needsRehash', () => {
  it('flags a weaker or foreign hash and leaves a current one alone', async () => {
    expect(needsRehash(await hashPassword('x'))).toBe(false)
    expect(needsRehash('scrypt$16384$8$1$c2FsdA==$aGFzaA==')).toBe(true)
    expect(needsRehash('bcrypt$2b$10$abcdef')).toBe(true)
  })
})

describe('validatePassword', () => {
  it('accepts a long passphrase', () => {
    expect(validatePassword('a reasonably long passphrase')).toBeNull()
  })

  it('rejects short, absurdly long, and obviously guessable passwords', () => {
    expect(validatePassword('short')?.message).toMatch(/10 characters/)
    expect(validatePassword('a'.repeat(201))?.message).toMatch(/under 200/)
    expect(validatePassword('mypassword123')?.message).toMatch(/guess/)
    // The seeded credential itself must not survive as a chosen password.
    expect(validatePassword('admin123456')).not.toBeNull()
  })
})
