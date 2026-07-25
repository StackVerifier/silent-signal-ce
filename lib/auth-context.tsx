'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { sessionService } from '@/services/session.service'
import { ApiError, SESSION_LOST_EVENT } from '@/services/http'
import { can, canAll, canAny } from './rbac/access'
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
  logout: () => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Session state, owned by the server.
 *
 * The cookie is httpOnly, so this provider cannot read or mint it — it asks
 * `/api/session` who it is. That closes the hole the previous browser-minted
 * cookie left open: an XSS could lift a readable session cookie, but cannot
 * touch this one.
 *
 * Permissions still arrive resolved by the server, and every route handler
 * re-checks them, so nothing here is trusted for authorization.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<AccessContext | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    sessionService
      .current()
      .then((payload) => {
        if (cancelled) return
        setAccess(payload?.access ?? null)
        setWorkspaces(payload?.workspaces ?? [])
      })
      // A signed-out visitor is the normal case, not an error worth surfacing.
      .catch(() => {
        if (!cancelled) setAccess(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // A request elsewhere in the app found the session gone. Dropping the state
  // here is what lets the guard react; nothing else in the tree polls for it.
  useEffect(() => {
    const onSessionLost = () => {
      setAccess(null)
      setWorkspaces([])
    }
    window.addEventListener(SESSION_LOST_EVENT, onSessionLost)
    return () => window.removeEventListener(SESSION_LOST_EVENT, onSessionLost)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const payload = await sessionService.login(email, password)
      setAccess(payload.access)
      setWorkspaces(payload.workspaces)
    } catch (error) {
      // The server's message is the useful one ("declined", "not active"); the
      // transport's generic copy is not.
      throw error instanceof ApiError ? new Error(error.message) : error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await sessionService.logout().catch(() => undefined)
    setAccess(null)
    setWorkspaces([])
    // Clearing state is not leaving the application: without this the shell
    // stayed on screen with no permissions, which reads as the pending
    // "waiting for approval" account rather than as signed out. A full page
    // load also drops the query cache holding the previous member's data.
    window.location.assign('/auth/login')
  }, [])

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const payload = await sessionService.switchWorkspace(workspaceId)
    setAccess(payload.access)
    setWorkspaces(payload.workspaces)
  }, [])

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
