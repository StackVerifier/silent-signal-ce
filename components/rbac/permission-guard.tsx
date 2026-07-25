'use client'

import { useAuth } from '@/lib/auth-context'
import type { Permission } from '@/lib/rbac/permissions'
import { AccessDenied } from './access-denied'

interface PermissionGuardProps {
  /** Member needs ANY of these by default. */
  permission?: Permission
  anyOf?: Permission[]
  allOf?: Permission[]
  children: React.ReactNode
  /** Rendered instead of the children when the check fails. Default: nothing. */
  fallback?: React.ReactNode
  /** Render the full access-denied page instead of a silent fallback. */
  showDenied?: boolean
}

/**
 * Client-side permission gate.
 *
 * Hides UI the member cannot use. This is a UX affordance, not a security
 * boundary — the same permission is enforced in middleware (navigation) and
 * must be enforced again in every route handler (data).
 */
export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
  showDenied = false,
}: PermissionGuardProps) {
  const { can, canAny, canAll, isLoading } = useAuth()

  if (isLoading) return null

  const required = [
    permission ? can(permission) : true,
    anyOf?.length ? canAny(anyOf) : true,
    allOf?.length ? canAll(allOf) : true,
  ]

  if (required.every(Boolean)) return <>{children}</>
  if (showDenied) {
    return <AccessDenied requiredPermissions={[permission, ...(anyOf ?? []), ...(allOf ?? [])].filter(Boolean) as Permission[]} />
  }
  return <>{fallback}</>
}

/**
 * Disables (rather than hides) an interactive subtree — the right choice when
 * hiding the control would make the page confusing, e.g. a pending member who
 * should see that an action exists but cannot use it yet.
 */
export function DisabledWhenDenied({
  permission,
  children,
  reason = 'You do not have permission for this action',
}: {
  permission: Permission
  children: React.ReactNode
  reason?: string
}) {
  const { can } = useAuth()
  if (can(permission)) return <>{children}</>

  return (
    <div
      title={reason}
      aria-disabled="true"
      className="opacity-50 pointer-events-none select-none"
    >
      {children}
    </div>
  )
}
