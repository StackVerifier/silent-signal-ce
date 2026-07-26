import type { AccountStatus, RoleId } from './rbac/types'

/**
 * The session cookie: shape, signing and verification.
 *
 * This module runs in three places — the edge middleware, Node route handlers
 * and (for the demo roster only) the browser — so everything here uses Web
 * Crypto rather than `node:crypto`, which the edge runtime does not provide.
 */

/**
 * Personas offered on the login screen.
 *
 * Labels and emails only. The passwords live in the database as scrypt hashes,
 * and this list has no authority over anything: signing in still goes through
 * `/api/session`, which verifies against that hash. It exists so someone
 * evaluating the product can see each role's view without being handed a list
 * of accounts out of band.
 */
export interface DemoAccount {
  email: string
  label: string
  roleId: RoleId
  status: AccountStatus
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'alice@boyner.com.tr', label: 'Organization Owner', roleId: 'org_owner', status: 'approved' },
  { email: 'bora@boyner.com.tr', label: 'Organization Admin', roleId: 'org_admin', status: 'approved' },
  { email: 'cem@boyner.com.tr', label: 'Release Manager', roleId: 'release_manager', status: 'approved' },
  { email: 'deniz@boyner.com.tr', label: 'QA Lead', roleId: 'qa_lead', status: 'approved' },
  { email: 'elif@boyner.com.tr', label: 'Developer', roleId: 'developer', status: 'approved' },
  { email: 'irem@boyner.com.tr', label: 'Viewer', roleId: 'viewer', status: 'approved' },
  { email: 'faruk@boyner.com.tr', label: 'Pending approval', roleId: 'developer', status: 'pending' },
  { email: 'hakan@boyner.com.tr', label: 'Suspended', roleId: 'viewer', status: 'suspended' },
  { email: 'jale@boyner.com.tr', label: 'Rejected', roleId: 'developer', status: 'rejected' },
]

/** The account the login form is prefilled with — full admin access. */
export const DEFAULT_DEMO_ACCOUNT = DEMO_ACCOUNTS[0]

export const SESSION_COOKIE = 'ss_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Claims carried in the cookie so middleware can gate navigation at the edge,
 * before any React code runs.
 *
 * They are a *hint*, not an authority. Route handlers re-read the member from
 * the database (see `lib/auth-server.ts`), so a role change or a suspension
 * takes effect on the next request rather than when the cookie expires.
 */
export interface SessionClaims {
  memberId: string
  organizationId: string
  workspaceId: string | null
  roleId: RoleId
  status: AccountStatus
  expiresAt: number
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/**
 * Development-only signing key.
 *
 * Shipped in the repository, therefore public, therefore forgeable — which is
 * exactly why `signingKey()` refuses to use it in production. The alternative,
 * generating one per process, would sign every developer out on each restart
 * and teach people that being logged out is normal.
 */
const DEVELOPMENT_SECRET = 'silent-signal-development-only-not-a-secret'

let warned = false

function secret(): string {
  const configured = process.env.SESSION_SECRET
  if (configured && configured.length >= 32) return configured

  if (process.env.NODE_ENV === 'production') {
    // Fail closed. An unsigned or predictably-signed cookie is a complete
    // authentication bypass: anyone can mint themselves an owner session.
    throw new Error(
      'SESSION_SECRET is required in production and must be at least 32 characters. ' +
      'Generate one with `openssl rand -base64 32`.',
    )
  }

  if (!warned) {
    warned = true
    console.warn(
      '[auth] SESSION_SECRET is not set — using the public development key. ' +
      'Sessions are forgeable. Set SESSION_SECRET before deploying.',
    )
  }
  return DEVELOPMENT_SECRET
}

let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null

function signingKey(): Promise<CryptoKey> {
  const current = secret()
  // Re-imported only when the secret itself changes, which in practice means
  // once per process.
  if (cachedKey?.secret !== current) {
    cachedKey = {
      secret: current,
      key: crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(current),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    }
  }
  return cachedKey.key
}

/** base64url, so the value survives a cookie without percent-encoding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/**
 * `<payload>.<signature>`, both base64url.
 *
 * Not encrypted — the claims are not secret, and the cookie is httpOnly so no
 * script can read them. What matters is that they cannot be *written*, which is
 * what the signature provides.
 */
export async function encodeClaims(claims: SessionClaims): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign(
    'HMAC', await signingKey(), new TextEncoder().encode(payload),
  )
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

/**
 * Verifies and decodes. Returns null for anything that is not a cookie this
 * server signed and that has not expired.
 *
 * `crypto.subtle.verify` is constant-time, so a forged signature cannot be
 * discovered a byte at a time by timing the response.
 */
export async function decodeClaims(value: string): Promise<SessionClaims | null> {
  try {
    if (!value) return null
    const [payload, signature] = value.split('.')
    if (!payload || !signature) return null

    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    )
    if (!valid) return null

    const claims = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as SessionClaims

    if (!claims?.memberId || typeof claims.expiresAt !== 'number') return null
    if (claims.expiresAt <= Date.now()) return null
    return claims
  } catch {
    return null
  }
}
