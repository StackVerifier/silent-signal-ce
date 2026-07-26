import { PERMISSIONS, type Permission } from './permissions'
import type { RoleDefinition, RoleId, SystemRoleId } from './types'

const P = PERMISSIONS

/** Read-only view of the delivery surface, shared by most roles. */
const DELIVERY_READ: Permission[] = [
  P.DASHBOARD_READ,
  P.SPRINT_READ,
  P.RELEASE_READ,
  P.RISK_READ,
  P.NOTIFICATIONS_READ,
  P.SETTINGS_READ,
]

/**
 * System roles are permission bundles — nothing more. No application code
 * branches on a role name; it branches on permissions. Adding a customer's
 * custom role therefore requires zero code changes.
 */
export const SYSTEM_ROLES: Record<SystemRoleId, RoleDefinition> = {
  platform_admin: {
    id: 'platform_admin',
    name: 'Platform Admin',
    description: 'Silent Signal staff. Cross-organization support access.',
    isSystem: true,
    tier: 100,
    permissions: Object.values(P),
  },

  org_owner: {
    id: 'org_owner',
    name: 'Organization Owner',
    description: 'Full control of the organization, including billing and SSO.',
    isSystem: true,
    tier: 90,
    // Same permission set as platform_admin; the difference is scope, not
    // capability — an owner is bounded to their own organizationId.
    permissions: Object.values(P),
  },

  org_admin: {
    id: 'org_admin',
    name: 'Organization Admin',
    description: 'Administers people, workspaces and integrations. No billing.',
    isSystem: true,
    tier: 80,
    permissions: [
      ...DELIVERY_READ,
      P.DASHBOARD_WRITE,
      P.SPRINT_WRITE,
      P.RELEASE_WRITE,
      P.RELEASE_APPROVE,
      P.QA_READ,
      P.QA_WRITE,
      P.RISK_WRITE,
      P.RULES_READ,
      P.RULES_WRITE,
      P.RULES_DELETE,
      P.NOTIFICATIONS_WRITE,
      P.MEMBERS_READ,
      P.MEMBERS_WRITE,
      P.MEMBERS_APPROVE,
      P.MEMBERS_INVITE,
      P.TEAMS_READ,
      P.TEAMS_WRITE,
      P.TEAMS_DELETE,
      P.WORKSPACE_READ,
      P.ORGANIZATION_READ,
      P.INTEGRATION_READ,
      P.INTEGRATION_WRITE,
      P.AUDIT_READ,
      P.AUDIT_READ_SENSITIVE,
      P.AUDIT_EXPORT,
      P.SETTINGS_WRITE,
    ],
  },

  release_manager: {
    id: 'release_manager',
    name: 'Release Manager',
    description: 'Owns release readiness, rules and the QA queue.',
    isSystem: true,
    tier: 60,
    permissions: [
      ...DELIVERY_READ,
      P.SPRINT_WRITE,
      P.RELEASE_WRITE,
      P.RELEASE_APPROVE,
      P.QA_READ,
      P.QA_WRITE,
      P.RISK_WRITE,
      P.RULES_READ,
      P.RULES_WRITE,
      P.RULES_DELETE,
      P.NOTIFICATIONS_WRITE,
      P.TEAMS_READ,
      // Read-only, without the sensitive grant.
      P.AUDIT_READ,
    ],
  },

  qa_lead: {
    id: 'qa_lead',
    name: 'QA Lead',
    description: 'Owns the QA queue. Reads releases, rules and notifications.',
    isSystem: true,
    tier: 50,
    // Audit read without the sensitive grant: a QA lead can see that a rule
    // changed, not the IP every colleague signed in from.
    permissions: [
      ...DELIVERY_READ, P.SPRINT_WRITE, P.QA_READ, P.QA_WRITE, P.RULES_READ, P.TEAMS_READ,
      P.AUDIT_READ,
    ],
  },

  developer: {
    id: 'developer',
    name: 'Developer',
    description: 'Reads delivery signals. Contributes to sprint and QA context.',
    isSystem: true,
    tier: 40,
    permissions: [...DELIVERY_READ, P.SPRINT_WRITE, P.QA_READ],
  },

  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only stakeholder access. No QA queue, no rules.',
    isSystem: true,
    tier: 10,
    permissions: [P.DASHBOARD_READ, P.SPRINT_READ, P.RELEASE_READ, P.RISK_READ, P.SETTINGS_READ],
  },
}

export const SYSTEM_ROLE_LIST = Object.values(SYSTEM_ROLES)

/**
 * Resolves a role id to its definition. Custom roles are looked up in the
 * organization-scoped list supplied by the caller (in production: fetched with
 * the session and cached), so this stays a pure function.
 */
export function resolveRole(
  roleId: RoleId,
  customRoles: RoleDefinition[] = [],
): RoleDefinition {
  if (roleId in SYSTEM_ROLES) return SYSTEM_ROLES[roleId as SystemRoleId]
  const custom = customRoles.find((role) => role.id === roleId)
  if (custom) return custom
  // Fail closed: an unknown role gets the least privileged bundle.
  return SYSTEM_ROLES.viewer
}

export function getRoleLabel(roleId: RoleId, customRoles: RoleDefinition[] = []): string {
  return resolveRole(roleId, customRoles).name
}

/** A member may only administer roles strictly below their own tier. */
export function canManageRole(
  actorRoleId: RoleId,
  targetRoleId: RoleId,
  customRoles: RoleDefinition[] = [],
): boolean {
  const actor = resolveRole(actorRoleId, customRoles)
  const target = resolveRole(targetRoleId, customRoles)
  return actor.tier > target.tier
}

/** Roles an actor is allowed to assign when inviting or editing a member. */
export function assignableRoles(
  actorRoleId: RoleId,
  customRoles: RoleDefinition[] = [],
): RoleDefinition[] {
  const actor = resolveRole(actorRoleId, customRoles)
  return [...SYSTEM_ROLE_LIST, ...customRoles].filter(
    (role) => role.tier < actor.tier && role.id !== 'platform_admin',
  )
}
