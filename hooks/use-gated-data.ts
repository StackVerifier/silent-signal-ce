'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Permission } from '@/lib/rbac/permissions'

export type DataState = 'loading' | 'ready' | 'gated' | 'denied' | 'error'

/**
 * Single entry point every widget uses to decide what to render.
 *
 * It collapses four independent concerns into one state machine:
 *  - the request is still in flight        → 'loading' → skeleton
 *  - the account is pending/suspended      → 'gated'   → skeleton, permanently
 *  - the role lacks the permission         → 'denied'  → locked card
 *  - data arrived                          → 'ready'
 *
 * Each widget calls it independently, which is what produces per-widget
 * parallel loading rather than one blocking page-level spinner.
 *
 * When the real API lands this becomes a thin wrapper over a TanStack Query
 * result — the returned contract does not change, so widgets stay untouched.
 */
export function useGatedData<T>(
  data: T,
  options: { permission?: Permission; delay?: number } = {},
): { state: DataState; data: T | null; isSkeleton: boolean } {
  const { delay = 0, permission } = options
  const { isGated, isLoading, can } = useAuth()
  const [settled, setSettled] = useState(delay === 0)

  useEffect(() => {
    if (delay === 0) return
    const timer = setTimeout(() => setSettled(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  let state: DataState = 'ready'
  if (isLoading || !settled) state = 'loading'
  else if (isGated) state = 'gated'
  else if (permission && !can(permission)) state = 'denied'

  return {
    state,
    data: state === 'ready' ? data : null,
    isSkeleton: state === 'loading' || state === 'gated',
  }
}
