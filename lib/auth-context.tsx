'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthSession, User, Workspace } from './types'
import { ROLE_PERMISSIONS } from './types'
import {
  SESSION_COOKIE,
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  buildUserFromAccount,
  findDemoAccount,
} from './auth-config'

interface AuthContextType {
  session: AuthSession | null
  user: User | null
  workspace: Workspace | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  canAccess: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Mirrors the session into a cookie so `middleware.ts` can gate routes before
 * React hydrates. It is intentionally NOT httpOnly because the mock login runs
 * in the browser; a real implementation must issue this cookie server-side.
 */
function writeSessionCookie(expiresAt: Date) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SESSION_COOKIE}=1; Path=/; Expires=${expiresAt.toUTCString()}; SameSite=Lax${secure}`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

function buildWorkspace(owner: User): Workspace {
  return {
    id: 'ws-1',
    name: 'Silent Signal Demo',
    slug: 'demo',
    owner,
    members: [
      { id: 'wm-1', userId: owner.id, user: owner, role: owner.role, joinedAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      isPrivate: false,
      twoFactorRequired: false,
      ssoEnabled: false,
      auditLoggingEnabled: true,
      dataRetentionDays: 90,
    },
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore a previous session, discarding it if it has expired.
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!saved) {
      clearSessionCookie()
      setIsLoading(false)
      return
    }

    try {
      const parsed = JSON.parse(saved)
      const expiresAt = new Date(parsed.session.expiresAt)

      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        localStorage.removeItem(SESSION_STORAGE_KEY)
        clearSessionCookie()
      } else {
        setSession({ ...parsed.session, expiresAt })
        setUser(parsed.user)
        setWorkspace(parsed.workspace)
        writeSessionCookie(expiresAt)
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      clearSessionCookie()
    }

    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Simulate network latency so the loading state is exercised.
      await new Promise((resolve) => setTimeout(resolve, 400))

      const account = findDemoAccount(email, password)
      if (!account) {
        throw new Error('Invalid email or password')
      }

      const nextUser = buildUserFromAccount(account)
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
      const nextSession: AuthSession = {
        userId: nextUser.id,
        workspaceId: 'ws-1',
        token: `demo-token-${Date.now()}`,
        expiresAt,
      }
      const nextWorkspace = buildWorkspace(nextUser)

      setSession(nextSession)
      setUser(nextUser)
      setWorkspace(nextWorkspace)

      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ session: nextSession, user: nextUser, workspace: nextWorkspace }),
      )
      writeSessionCookie(expiresAt)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    setUser(null)
    setWorkspace(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    clearSessionCookie()
  }, [])

  const canAccess = useCallback(
    (permission: string): boolean => {
      if (!user) return false
      return (ROLE_PERMISSIONS[user.role] ?? []).includes(permission)
    },
    [user],
  )

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      workspace,
      isLoading,
      login,
      logout,
      isAuthenticated: !!session && !!user,
      canAccess,
    }),
    [session, user, workspace, isLoading, login, logout, canAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
