'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * Sends a visitor with no session to the login page.
 *
 * Middleware already redirects an unauthenticated *request*, but it only runs
 * when the browser actually asks the server for something. The application can
 * reach "mounted, but no session" without any such request — after signing out,
 * when the session expires while a tab sits open, or when another tab signs
 * out. In that state the shell renders with an empty permission set, which is
 * exactly what a pending member sees, so a signed-out visitor was shown the
 * "waiting for approval" screen instead of a login form.
 *
 * A hard navigation rather than `router.push`: it discards the JS heap, and
 * with it the TanStack Query cache still holding the previous member's data.
 * A soft navigation would leave that cache in memory for whoever signs in next
 * in the same tab.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading || isAuthenticated) return
    const here = `${window.location.pathname}${window.location.search}`
    const target = here === '/' ? '/auth/login' : `/auth/login?redirect=${encodeURIComponent(here)}`
    window.location.assign(target)
  }, [isLoading, isAuthenticated])

  // Nothing of the application renders until the session is known. Rendering
  // the shell first is what made "signed out" and "pending" look identical.
  if (isLoading || !isAuthenticated) {
    return (
      <div
        role="status"
        aria-label={isLoading ? 'Checking your session' : 'Redirecting to sign in'}
        className="flex h-dvh items-center justify-center bg-[#070B18]"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1E2D4A] border-t-[#6C63FF]" />
      </div>
    )
  }

  return <>{children}</>
}
