import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, decodeClaims } from './auth-config'
import { STATUS_GRANTS_DATA_ACCESS } from './rbac/access'
import { resolveRole } from './rbac/roles'
import type { Permission } from './rbac/permissions'
import type { AccountStatus, RoleId } from './rbac/types'

export interface ServerSession {
  memberId: string
  organizationId: string
  workspaceId: string | null
  roleId: RoleId
  status: AccountStatus
  permissions: Permission[]
}

/**
 * Server-side view of the session, for Server Components and route handlers.
 *
 * It resolves permissions from the same claims and the same pure functions the
 * middleware and the client use, so a permission decision cannot differ between
 * where content is filtered and where navigation is gated.
 *
 * Status gating applies here too: a pending member resolves to an empty
 * permission set, so restricted content is never rendered into their payload.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const store = await cookies()
  const claims = decodeClaims(store.get(SESSION_COOKIE)?.value ?? '')
  if (!claims) return null

  const role = resolveRole(claims.roleId)
  const permissions = STATUS_GRANTS_DATA_ACCESS[claims.status] ? role.permissions : []

  return {
    memberId: claims.memberId,
    organizationId: claims.organizationId,
    workspaceId: claims.workspaceId,
    roleId: claims.roleId,
    status: claims.status,
    permissions,
  }
}

/** Permissions only — the common case, and safe when there is no session. */
export async function getServerPermissions(): Promise<Permission[]> {
  return (await getServerSession())?.permissions ?? []
}
