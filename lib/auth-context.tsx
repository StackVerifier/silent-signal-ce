'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  SESSION_COOKIE,
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  encodeClaims,
  findDemoAccount,
  type SessionClaims,
} from './auth-config'
import {
  mockMembers,
  mockOrganization,
  mockWorkspaces,
  workspacesForMember,
} from './mock-tenancy'
import {
  STATUS_CAN_AUTHENTICATE,
  buildAccessContext,
  can,
  canAll,
  canAny,
} from './rbac/access'
import type { Permission } from './rbac/permissions'
import type { AccessContext, Member, Organization, RoleDefinition, Workspace } from './rbac/types'

interface AuthContextType {
  /** Null while loading or signed out. */
  access: AccessContext | null
  member: Member | null
  organization: Organization | null
  workspace: Workspace | null
  /** Workspaces the signed-in member can switch between. */
  workspaces: Workspace[]
  role: RoleDefinition | null
  permissions: Permission[]
  isLoading: boolean
  isAuthenticated: boolean
  /** True when the account cannot see data yet (pending/suspended). */
  isGated: boolean
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAll: (permissions: Permission[]) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchWorkspace: (workspaceId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Mirrors session claims into a cookie so `middleware.ts` can gate routes before
 * React hydrates. Not httpOnly because the mock login runs in the browser; a
 * real implementation issues this cookie server-side.
 */
function writeSessionCookie(claims: SessionClaims) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const expires = new Date(claims.expiresAt).toUTCString()
  document.cookie = `${SESSION_COOKIE}=${encodeClaims(claims)}; Path=/; Expires=${expires}; SameSite=Lax${secure}`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

function resolveSession(memberId: string, workspaceId: string | null) {
  const member = mockMembers.find((candidate) => candidate.id === memberId)
  if (!member) return null

  const available = workspacesForMember(member)
  const workspace =
    available.find((candidate) => candidate.id === workspaceId) ?? available[0] ?? null

  return {
    member,
    workspace,
    workspaces: available,
    access: buildAccessContext({ member, organization: mockOrganization, workspace }),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<AccessContext | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const persist = useCallback((next: AccessContext, expiresAt: number) => {
    const claims: SessionClaims = {
      memberId: next.member.id,
      organizationId: next.organization.id,
      workspaceId: next.workspace?.id ?? null,
      roleId: next.member.roleId,
      status: next.member.status,
      expiresAt,
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(claims))
    writeSessionCookie(claims)
  }, [])

  // Restore a previous session, discarding it if expired or no longer valid.
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!saved) {
      clearSessionCookie()
      setIsLoading(false)
      return
    }

    try {
      const claims = JSON.parse(saved) as SessionClaims
      const resolved =
        claims.expiresAt > Date.now() ? resolveSession(claims.memberId, claims.workspaceId) : null

      // Status is re-read from the source of truth on every restore, so an
      // administrator's approval or suspension takes effect on next load.
      if (resolved && STATUS_CAN_AUTHENTICATE[resolved.member.status]) {
        setAccess(resolved.access)
        setWorkspaces(resolved.workspaces)
        persist(resolved.access, claims.expiresAt)
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY)
        clearSessionCookie()
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      clearSessionCookie()
    }

    setIsLoading(false)
  }, [persist])

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      try {
        // Simulate network latency so loading states are exercised.
        await new Promise((resolve) => setTimeout(resolve, 400))

        const account = findDemoAccount(email, password)
        if (!account) throw new Error('Invalid email or password')

        const resolved = resolveSession(account.memberId, null)
        if (!resolved) throw new Error('Account not found in this organization')

        if (!STATUS_CAN_AUTHENTICATE[resolved.member.status]) {
          throw new Error(
            resolved.member.status === 'rejected'
              ? 'Your access request was declined. Contact your administrator.'
              : 'This account is no longer active.',
          )
        }

        setAccess(resolved.access)
        setWorkspaces(resolved.workspaces)
        persist(resolved.access, Date.now() + SESSION_TTL_MS)
      } finally {
        setIsLoading(false)
      }
    },
    [persist],
  )

  const logout = useCallback(() => {
    setAccess(null)
    setWorkspaces([])
    localStorage.removeItem(SESSION_STORAGE_KEY)
    clearSessionCookie()
  }, [])

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      setAccess((current) => {
        if (!current) return current
        const workspace = mockWorkspaces.find((candidate) => candidate.id === workspaceId)
        if (!workspace || !current.member.workspaceIds.includes(workspaceId)) return current

        const next = buildAccessContext({
          member: current.member,
          organization: current.organization,
          workspace,
        })
        persist(next, Date.now() + SESSION_TTL_MS)
        return next
      })
    },
    [persist],
  )

  const value = useMemo<AuthContextType>(() => {
    const permissions = access?.permissions ?? []
    return {
      access,
      member: access?.member ?? null,
      organization: access?.organization ?? null,
      workspace: access?.workspace ?? null,
      workspaces,
      role: access?.role ?? null,
      permissions,
      isLoading,
      isAuthenticated: !!access,
      isGated: !!access && access.status !== 'approved',
      can: (permission) => can(permissions, permission),
      canAny: (required) => canAny(permissions, required),
      canAll: (required) => canAll(permissions, required),
      login,
      logout,
      switchWorkspace,
    }
  }, [access, workspaces, isLoading, login, logout, switchWorkspace])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Convenience hook for permission checks in leaf components. */
export function usePermission(permission: Permission): boolean {
  return useAuth().can(permission)
}
