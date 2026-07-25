import 'server-only'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

/**
 * Password hashing with scrypt.
 *
 * scrypt is memory-hard, which is what makes it resistant to GPU cracking, and
 * it ships in Node's standard library — no native module to compile and nothing
 * to keep patched. bcrypt or argon2 would be equally defensible; scrypt is the
 * one that costs zero dependencies.
 *
 * Format: `scrypt$<N>$<r>$<p>$<salt-b64>$<hash-b64>`. Parameters are stored
 * alongside the hash so they can be raised later without invalidating existing
 * passwords — an old hash still verifies against its own cost.
 */
const KEY_LENGTH = 64
const SALT_LENGTH = 16

// N=2^15 is the current OWASP floor for scrypt and takes ~100ms here.
const PARAMS = { N: 32768, r: 8, p: 1 }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH)
  return [
    'scrypt', PARAMS.N, PARAMS.r, PARAMS.p,
    salt.toString('base64'), derived.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, , , , saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false

  try {
    const expected = Buffer.from(hashB64, 'base64')
    const derived = await scryptAsync(
      password.normalize('NFKC'),
      Buffer.from(saltB64, 'base64'),
      expected.length,
    )
    // Constant-time: a length check or `===` would leak how much matched.
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    // A malformed stored value is a failed verification, not a crash.
    return false
  }
}

/** True when a stored hash was made with weaker parameters and should be upgraded. */
export function needsRehash(stored: string): boolean {
  const [scheme, n, r, p] = stored.split('$')
  return scheme !== 'scrypt'
    || Number(n) < PARAMS.N
    || Number(r) < PARAMS.r
    || Number(p) < PARAMS.p
}

export interface PasswordProblem {
  message: string
}

/**
 * Length is the property that actually matters; composition rules push people
 * towards `Password1!` and no further. NIST 800-63B says the same.
 */
export function validatePassword(password: string): PasswordProblem | null {
  if (password.length < 10) return { message: 'Use at least 10 characters' }
  if (password.length > 200) return { message: 'Keep it under 200 characters' }

  const weak = ['password', '12345678', 'qwerty', 'admin123', 'letmein', 'silentsignal']
  const lowered = password.toLowerCase()
  if (weak.some((candidate) => lowered.includes(candidate))) {
    return { message: 'That password is too easy to guess' }
  }
  return null
}
