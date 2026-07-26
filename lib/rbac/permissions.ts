/**
 * Permission registry.
 *
 * Permissions are the atomic unit of authorization. Roles are *only* bundles of
 * these strings (see `roles.ts`), which is what makes customer-defined custom
 * roles possible without touching application code: a custom role is a row of
 * permission strings, evaluated by exactly the same engine as a system role.
 *
 * Naming: `<resource>.<action>`. Keep it stable — these strings are persisted in
 * the database (role_permissions) and appear in API contracts.
 */

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard.read',
  DASHBOARD_WRITE: 'dashboard.write',

  SPRINT_READ: 'sprint.read',
  SPRINT_WRITE: 'sprint.write',

  RELEASE_READ: 'release.read',
  RELEASE_WRITE: 'release.write',
  RELEASE_APPROVE: 'release.approve',

  QA_READ: 'qa.read',
  QA_WRITE: 'qa.write',

  RISK_READ: 'risk.read',
  RISK_WRITE: 'risk.write',

  RULES_READ: 'rules.read',
  RULES_WRITE: 'rules.write',
  RULES_DELETE: 'rules.delete',

  NOTIFICATIONS_READ: 'notifications.read',
  NOTIFICATIONS_WRITE: 'notifications.write',

  MEMBERS_READ: 'members.read',
  MEMBERS_WRITE: 'members.write',
  MEMBERS_APPROVE: 'members.approve',
  MEMBERS_INVITE: 'members.invite',

  TEAMS_READ: 'teams.read',
  TEAMS_WRITE: 'teams.write',
  TEAMS_DELETE: 'teams.delete',

  WORKSPACE_READ: 'workspace.read',
  WORKSPACE_WRITE: 'workspace.write',
  WORKSPACE_DELETE: 'workspace.delete',

  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_WRITE: 'organization.write',

  BILLING_READ: 'billing.read',
  BILLING_WRITE: 'billing.write',

  REPORTS_READ: 'reports.read',
  REPORTS_EXPORT: 'reports.export',

  AUDIT_READ: 'audit.read',
  // Separate from AUDIT_READ on purpose: IP, device and session identify a
  // person's movements, and security events reveal the shape of the access
  // model. Granting the forensic detail with an ordinary read turns the audit
  // log into a surveillance tool.
  AUDIT_READ_SENSITIVE: 'audit.read_sensitive',
  AUDIT_EXPORT: 'audit.export',

  INTEGRATION_READ: 'integration.read',
  INTEGRATION_WRITE: 'integration.write',

  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',

  /** Ability to define custom roles. Reserved for owners/platform staff. */
  ROLES_WRITE: 'roles.write',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[]

/** Grouping drives the custom-role editor UI. */
export const PERMISSION_GROUPS: { id: string; label: string; permissions: Permission[] }[] = [
  {
    id: 'delivery',
    label: 'Delivery Intelligence',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.DASHBOARD_WRITE,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SPRINT_WRITE,
      PERMISSIONS.RELEASE_READ,
      PERMISSIONS.RELEASE_WRITE,
      PERMISSIONS.RELEASE_APPROVE,
      PERMISSIONS.QA_READ,
      PERMISSIONS.QA_WRITE,
      PERMISSIONS.RISK_READ,
      PERMISSIONS.RISK_WRITE,
    ],
  },
  {
    id: 'automation',
    label: 'Rules & Notifications',
    permissions: [
      PERMISSIONS.RULES_READ,
      PERMISSIONS.RULES_WRITE,
      PERMISSIONS.RULES_DELETE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.NOTIFICATIONS_WRITE,
    ],
  },
  {
    id: 'people',
    label: 'People & Teams',
    permissions: [
      PERMISSIONS.MEMBERS_READ,
      PERMISSIONS.MEMBERS_WRITE,
      PERMISSIONS.MEMBERS_APPROVE,
      PERMISSIONS.MEMBERS_INVITE,
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.TEAMS_WRITE,
      PERMISSIONS.TEAMS_DELETE,
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    permissions: [
      PERMISSIONS.ORGANIZATION_READ,
      PERMISSIONS.ORGANIZATION_WRITE,
      PERMISSIONS.WORKSPACE_READ,
      PERMISSIONS.WORKSPACE_WRITE,
      PERMISSIONS.WORKSPACE_DELETE,
      PERMISSIONS.INTEGRATION_READ,
      PERMISSIONS.INTEGRATION_WRITE,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE,
      PERMISSIONS.ROLES_WRITE,
    ],
  },
  {
    id: 'governance',
    label: 'Governance & Billing',
    permissions: [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.AUDIT_READ_SENSITIVE,
      PERMISSIONS.AUDIT_EXPORT,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_WRITE,
    ],
  },
]

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'dashboard.read': 'View the executive dashboard',
  'dashboard.write': 'Customize dashboard widgets and layout',
  'sprint.read': 'View sprint intelligence',
  'sprint.write': 'Edit sprint configuration and annotations',
  'release.read': 'View releases and readiness gates',
  'release.write': 'Create and edit releases and gates',
  'release.approve': 'Approve a release for deployment',
  'qa.read': 'View the QA queue',
  'qa.write': 'Assign, triage and close QA items',
  'risk.read': 'View the risk timeline',
  'risk.write': 'Acknowledge and annotate risk events',
  'rules.read': 'View risk rules',
  'rules.write': 'Create and edit risk rules',
  'rules.delete': 'Delete risk rules',
  'notifications.read': 'View notifications',
  'notifications.write': 'Configure notification routing and channels',
  'members.read': 'View organization members',
  'members.write': 'Edit, suspend and remove members',
  'members.approve': 'Approve or reject pending accounts',
  'members.invite': 'Invite new members',
  'teams.read': 'View teams',
  'teams.write': 'Create and edit teams and their membership',
  'teams.delete': 'Delete teams',
  'workspace.read': 'View workspace settings',
  'workspace.write': 'Create, rename and configure workspaces',
  'workspace.delete': 'Archive or delete workspaces',
  'organization.read': 'View organization settings',
  'organization.write': 'Manage organization settings and SSO',
  'billing.read': 'View plan, usage and invoices',
  'billing.write': 'Change plan and payment details',
  'reports.read': 'View the reports page',
  'reports.export': 'Download PDF and Excel delivery reports',
  'audit.read': 'View the audit log',
  'audit.read_sensitive': 'See IP address, device, session and security events in the audit log',
  'audit.export': 'Export audit records',
  'integration.read': 'View connected integrations',
  'integration.write': 'Connect, configure and remove integrations',
  'settings.read': 'View settings',
  'settings.write': 'Change settings',
  'roles.write': 'Define custom roles',
}
