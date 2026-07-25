'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import type { AuthSession, User, Workspace } from './types'

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize from localStorage or session storage
    const savedSession = localStorage.getItem('auth_session')
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        setSession(parsed.session)
        setUser(parsed.user)
        setWorkspace(parsed.workspace)
      } catch (e) {
        console.error('[v0] Failed to restore session:', e)
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Mock login - in production, this would call an API
      const mockUser: User = {
        id: 'user-1',
        email,
        name: email.split('@')[0],
        role: 'admin',
        createdAt: new Date(),
        preferences: {
          theme: 'light',
          emailNotifications: true,
          desktopNotifications: true,
          language: 'en',
        },
      }

      const mockSession: AuthSession = {
        userId: mockUser.id,
        workspaceId: 'ws-1',
        token: 'mock-token-' + Date.now(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }

      const mockWorkspace: Workspace = {
        id: 'ws-1',
        name: 'Default Workspace',
        slug: 'default',
        owner: mockUser,
        members: [{ id: 'wm-1', userId: mockUser.id, user: mockUser, role: 'admin', joinedAt: new Date() }],
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

      setSession(mockSession)
      setUser(mockUser)
      setWorkspace(mockWorkspace)

      localStorage.setItem(
        'auth_session',
        JSON.stringify({ session: mockSession, user: mockUser, workspace: mockWorkspace })
      )
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setSession(null)
    setUser(null)
    setWorkspace(null)
    localStorage.removeItem('auth_session')
  }

  const isAuthenticated = !!session && !!user

  const canAccess = (permission: string): boolean => {
    if (!user) return false
    const { ROLE_PERMISSIONS } = require('./types')
    const userPermissions = ROLE_PERMISSIONS[user.role] || []
    return userPermissions.includes(permission)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        workspace,
        isLoading,
        login,
        logout,
        isAuthenticated,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
