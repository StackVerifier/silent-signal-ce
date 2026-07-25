import type { Permission } from './permissions'
import { resolveRole } from './roles'
import type { AccessContext, AccountStatus, Member, Organization, RoleDefinition, Workspace } from './types'

/**
 * Account status gates the *entire* permission set, independently of the role.
 *
 * This is the mechanism behind the "pending user sees the whole app, but no
 * data" requirement: the member keeps their granted permissions on paper, but
 * the effective set is empty until an administrator approves them.
 */
export const STATUS_GRANTS_DATA_ACCESS: Record<AccountStatus, boolean> = {
  approved: true,
  pending: false,
  suspended: false,
  rejected: false,
  deleted: false,
}

/** Statuses that may hold a session at all. Others are rejected at login. */
export const STATUS_CAN_AUTHENTICATE: Record<AccountStatus, boolean> = {
  approved: true,
  pending: true,
  suspended: true,
  rejected: false,
  deleted: false,
}

export function buildAccessContext(params: {
  member: Member
  organization: Organization
  workspace: Workspace | null
  customRoles?: RoleDefinition[]
}): AccessContext {
  const { member, organization, workspace, customRoles = [] } = params
  const role = resolveRole(member.roleId, customRoles)
  const grantedPermissions = role.permissions
  const permissions = STATUS_GRANTS_DATA_ACCESS[member.status] ? grantedPermissions : []

  return {
    member,
    organization,
    workspace,
    role,
    permissions,
    grantedPermissions,
    status: member.status,
  }
}

// ─── Evaluation primitives ────────────────────────────────────────────────────
// Deliberately pure and dependency-free so the identical functions run in
// middleware (edge), server components, route handlers and the browser.

export function can(permissions: Permission[], permission: Permission): boolean {
  return permissions.includes(permission)
}

export function canAny(permissions: Permission[], required: Permission[]): boolean {
  return required.some((permission) => permissions.includes(permission))
}

export function canAll(permissions: Permission[], required: Permission[]): boolean {
  return required.every((permission) => permissions.includes(permission))
}

/** Throws instead of returning false — for use in server actions/route handlers. */
export function assertPermission(permissions: Permission[], permission: Permission): void {
  if (!can(permissions, permission)) {
    throw new PermissionDeniedError(permission)
  }
}

export class PermissionDeniedError extends Error {
  readonly permission: Permission
  readonly statusCode = 403

  constructor(permission: Permission) {
    super(`Permission denied: ${permission}`)
    this.name = 'PermissionDeniedError'
    this.permission = permission
  }
}

// ─── Tenant isolation ─────────────────────────────────────────────────────────

/**
 * Last line of defence in application code. The primary guarantee must come
 * from the database (see docs/rbac-architecture.md — row level security);
 * this catches developer error before it reaches a query.
 */
export function assertSameOrganization(
  context: Pick<AccessContext, 'organization' | 'role'>,
  resource: { organizationId: string },
): void {
  if (context.role.id === 'platform_admin') return
  if (context.organization.id !== resource.organizationId) {
    throw new TenantIsolationError(context.organization.id, resource.organizationId)
  }
}

export class TenantIsolationError extends Error {
  readonly statusCode = 404 // Never confirm existence across tenants.

  constructor(expected: string, received: string) {
    super(`Cross-tenant access blocked (expected ${expected}, received ${received})`)
    this.name = 'TenantIsolationError'
  }
}
