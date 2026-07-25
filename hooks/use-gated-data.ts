'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Permission } from '@/lib/rbac/permissions'
import { ApiError } from '@/services/http'

export type DataState = 'loading' | 'ready' | 'gated' | 'denied' | 'error'

export interface GatedResult<T> {
  state: DataState
  data: T | null
  isSkeleton: boolean
  error: ApiError | Error | null
  errorMessage: string | null
  retry: () => void
}

/** Minimal shape of a TanStack Query result — avoids coupling to its generics. */
interface QueryLike<T> {
  data: T | undefined
  isPending: boolean
  isFetching: boolean
  isError: boolean
  error: Error | null
  refetch: () => unknown
}

/**
 * Turns a query result into the four-way state every widget renders against.
 *
 * The precedence is deliberate: account status outranks permission, which
 * outranks loading, which outranks error. A pending member must see the locked
 * skeleton — never a permission error, and never a failed request, because a
 * gated query never runs in the first place.
 */
export function useGatedQuery<T>(
  query: QueryLike<T>,
  options: { permission?: Permission } = {},
): GatedResult<T> {
  const { isGated, isLoading, can } = useAuth()

  let state: DataState
  if (isLoading) state = 'loading'
  else if (isGated) state = 'gated'
  else if (options.permission && !can(options.permission)) state = 'denied'
  else if (query.isError) state = 'error'
  else if (query.isPending) state = 'loading'
  else state = 'ready'

  const error = state === 'error' ? query.error : null

  return {
    state,
    data: state === 'ready' ? (query.data ?? null) : null,
    isSkeleton: state === 'loading' || state === 'gated',
    error,
    errorMessage:
      error instanceof ApiError ? error.userMessage : error?.message ?? null,
    retry: () => query.refetch(),
  }
}

/**
 * Static-data variant, used where the source is not (yet) a query — it applies
 * the same gating so pending accounts never see data through a back door.
 */
export function useGatedData<T>(
  data: T,
  options: { permission?: Permission; delay?: number } = {},
): Omit<GatedResult<T>, 'retry'> & { retry: () => void } {
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
    error: null,
    errorMessage: null,
    retry: () => {},
  }
}
