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
 * Two checks, and both are needed:
 *
 *  1. The cookie's signature must verify. Without it the claims are attacker
 *     input and anyone can mint themselves an owner session.
 *  2. The member is re-read from the database, and role and status come from
 *     *there*, not from the cookie. Otherwise suspending someone would not take
 *     effect until their cookie expired — up to seven days of access after an
 *     administrator believed they had revoked it. The same read is what makes a
 *     role change apply on the next request.
 *
 * Permissions then resolve through the same pure functions the middleware and
 * the client use, so a decision cannot differ between where content is filtered
 * and where navigation is gated.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const store = await cookies()
  const claims = await decodeClaims(store.get(SESSION_COOKIE)?.value ?? '')
  if (!claims) return null

  const { memberRepo } = await import('./db/repositories')
  const member = await memberRepo.get(claims.memberId).catch(() => null)
  // Deleted, or a signed cookie for a member who no longer exists.
  if (!member) return null
  // A cookie is scoped to one organization; it must not carry over if the
  // member was moved.
  if (member.organizationId !== claims.organizationId) return null

  const role = resolveRole(member.roleId)
  const permissions = STATUS_GRANTS_DATA_ACCESS[member.status] ? role.permissions : []

  return {
    memberId: member.id,
    organizationId: member.organizationId,
    // The workspace is the one the member chose and is a preference, not a
    // privilege — but it still has to be one they belong to.
    workspaceId: claims.workspaceId && member.workspaceIds.includes(claims.workspaceId)
      ? claims.workspaceId
      : member.workspaceIds[0] ?? null,
    roleId: member.roleId,
    status: member.status,
    permissions,
  }
}

/** Permissions only — the common case, and safe when there is no session. */
export async function getServerPermissions(): Promise<Permission[]> {
  return (await getServerSession())?.permissions ?? []
}
