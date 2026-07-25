import type { AccountStatus, RoleId } from './rbac/types'

/**
 * Demo accounts for the mock authentication layer.
 *
 * TEMPORARY: credentials are checked client-side and exist only so the app can
 * be navigated with a realistic session. Replace this module (and the mock
 * branch of `lib/auth-context.tsx`) with a real identity provider before any
 * non-demo deployment — see docs/rbac-architecture.md.
 */
export interface DemoAccount {
  email: string
  password: string
  /** Links the credential to a member in the mock tenancy graph. */
  memberId: string
  label: string
  roleId: RoleId
  status: AccountStatus
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'alice@boyner.com.tr', password: 'admin123', memberId: 'mem-1', label: 'Organization Owner', roleId: 'org_owner', status: 'approved' },
  { email: 'bora@boyner.com.tr', password: 'admin123', memberId: 'mem-2', label: 'Organization Admin', roleId: 'org_admin', status: 'approved' },
  { email: 'cem@boyner.com.tr', password: 'admin123', memberId: 'mem-3', label: 'Release Manager', roleId: 'release_manager', status: 'approved' },
  { email: 'deniz@boyner.com.tr', password: 'admin123', memberId: 'mem-4', label: 'QA Lead', roleId: 'qa_lead', status: 'approved' },
  { email: 'elif@boyner.com.tr', password: 'admin123', memberId: 'mem-5', label: 'Developer', roleId: 'developer', status: 'approved' },
  { email: 'irem@boyner.com.tr', password: 'admin123', memberId: 'mem-9', label: 'Viewer', roleId: 'viewer', status: 'approved' },
  { email: 'faruk@boyner.com.tr', password: 'admin123', memberId: 'mem-6', label: 'Pending approval', roleId: 'developer', status: 'pending' },
  { email: 'hakan@boyner.com.tr', password: 'admin123', memberId: 'mem-8', label: 'Suspended', roleId: 'viewer', status: 'suspended' },
  { email: 'jale@boyner.com.tr', password: 'admin123', memberId: 'mem-10', label: 'Rejected', roleId: 'developer', status: 'rejected' },
]

/** The account the login form is prefilled with — full admin access. */
export const DEFAULT_DEMO_ACCOUNT = DEMO_ACCOUNTS[0]

export const SESSION_COOKIE = 'ss_session'
export const SESSION_STORAGE_KEY = 'auth_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function findDemoAccount(email: string, password: string): DemoAccount | null {
  const normalized = email.trim().toLowerCase()
  return (
    DEMO_ACCOUNTS.find(
      (account) => account.email === normalized && account.password === password,
    ) ?? null
  )
}

/**
 * Claims mirrored into the session cookie so middleware can authorize at the
 * edge, before any React code runs.
 *
 * PRODUCTION: this must become a signed, encrypted JWT issued server-side and
 * set httpOnly. The shape stays the same — only the encoding and the trust
 * boundary change, so `middleware.ts` does not need rewriting.
 */
export interface SessionClaims {
  memberId: string
  organizationId: string
  workspaceId: string | null
  roleId: RoleId
  status: AccountStatus
  expiresAt: number
}

export function encodeClaims(claims: SessionClaims): string {
  // encodeURIComponent guards against non-ASCII breaking the cookie value.
  return encodeURIComponent(btoa(JSON.stringify(claims)))
}

export function decodeClaims(value: string): SessionClaims | null {
  try {
    const claims = JSON.parse(atob(decodeURIComponent(value))) as SessionClaims
    if (!claims?.memberId || typeof claims.expiresAt !== 'number') return null
    if (claims.expiresAt <= Date.now()) return null
    return claims
  } catch {
    return null
  }
}
