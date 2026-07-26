import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Invitation tokens.
 *
 * A token is a bearer credential: whoever holds it becomes a member with a role
 * someone else chose. That makes it worth the same care as a password, with one
 * difference — it is single use and short lived, so a plain SHA-256 is the
 * right hash rather than scrypt. There is no offline-guessing threat against
 * 256 bits of entropy, and an invitation lookup happens on a public endpoint
 * where a deliberately slow hash would be a denial-of-service lever.
 *
 * Stored hashed so a stolen database is not a set of usable invitations.
 */

/** 32 bytes. base64url so it survives a URL without escaping. */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Constant-time comparison, for callers that hold both hashes.
 *
 * The database lookup is by hash and therefore already constant-time with
 * respect to the token, but anything comparing two hashes in application code
 * should not leak a prefix through timing.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The link handed to the invited person.
 *
 * Absolute, because it is pasted into a chat window or an email and a relative
 * path is useless there.
 */
export function invitationLink(token: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/auth/accept?token=${encodeURIComponent(token)}`
}
