import type { User, UserRole } from './types'

/**
 * Demo accounts for the mock authentication layer.
 *
 * TEMPORARY: credentials are checked client-side and exist only so the app can
 * be navigated with a realistic session/role. Replace this module (and the mock
 * branch of `lib/auth-context.tsx`) with a real identity provider before any
 * non-demo deployment — see AUDIT.md, "Security Improvements".
 */
export interface DemoAccount {
  email: string
  password: string
  name: string
  role: UserRole
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@silentsignal.io',
    password: 'admin123',
    name: 'Demo Admin',
    role: 'admin',
  },
]

/** The account the login form is prefilled with. */
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

export function buildUserFromAccount(account: DemoAccount): User {
  return {
    id: `user-${account.role}`,
    email: account.email,
    name: account.name,
    role: account.role,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    preferences: {
      theme: 'dark',
      emailNotifications: true,
      desktopNotifications: true,
      language: 'en',
    },
  }
}
