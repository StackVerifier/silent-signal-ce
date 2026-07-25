import type { Permission } from './permissions'

// ─── Tenancy hierarchy ────────────────────────────────────────────────────────
// Platform → Organization → Workspace → Team → Member
// Every tenant-scoped record carries organizationId so isolation can be enforced
// at the persistence layer (row-level security) rather than in application code.

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
  plan: 'free' | 'pro' | 'enterprise'
  ssoEnabled: boolean
  ssoProvider?: SsoProvider
  /** Domains auto-joined via SSO, e.g. ['boyner.com.tr'] */
  verifiedDomains: string[]
  createdAt: Date
  settings: OrganizationSettings
}

export interface OrganizationSettings {
  requireAdminApproval: boolean
  twoFactorRequired: boolean
  invitationExpiryDays: number
  dataRetentionDays: number
  auditLoggingEnabled: boolean
}

export type SsoProvider = 'azure-ad' | 'google-workspace' | 'okta' | 'entra-id' | 'github'

export type WorkspaceStatus = 'active' | 'archived'

export interface Workspace {
  id: string
  organizationId: string
  name: string
  slug: string
  description?: string
  status: WorkspaceStatus
  integrationIds: string[]
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}

export interface Team {
  id: string
  organizationId: string
  workspaceId: string
  name: string
  description?: string
  /** memberId of the assigned release manager / QA lead, if any. */
  releaseManagerId?: string
  qaLeadId?: string
  createdAt: Date
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export type SystemRoleId =
  | 'platform_admin'
  | 'org_owner'
  | 'org_admin'
  | 'release_manager'
  | 'qa_lead'
  | 'developer'
  | 'viewer'

/** Custom roles use the `custom:<uuid>` form, so RoleId stays a single string type. */
export type RoleId = SystemRoleId | `custom:${string}`

export interface RoleDefinition {
  id: RoleId
  name: string
  description: string
  permissions: Permission[]
  /** System roles cannot be edited or deleted by customers. */
  isSystem: boolean
  /** Higher tier can administer lower tiers. Used by `canManageRole`. */
  tier: number
  /** Custom roles are scoped to the organization that created them. */
  organizationId?: string
}

// ─── Membership & account status ──────────────────────────────────────────────

export type AccountStatus = 'pending' | 'approved' | 'suspended' | 'rejected' | 'deleted'

export interface Member {
  id: string
  organizationId: string
  userId: string
  email: string
  name: string
  avatar?: string
  roleId: RoleId
  status: AccountStatus
  /** A member belongs to one organization but may span workspaces/teams. */
  workspaceIds: string[]
  teamIds: string[]
  emailVerifiedAt?: Date
  invitedById?: string
  invitedAt?: Date
  approvedById?: string
  approvedAt?: Date
  lastActiveAt?: Date
  /** True while the account still uses a handed-out password. */
  mustChangePassword?: boolean
  createdAt: Date
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'

export interface Invitation {
  id: string
  organizationId: string
  email: string
  roleId: RoleId
  workspaceId: string
  teamId?: string
  status: InvitationStatus
  /** Opaque, single-use, hashed at rest. Never returned by list endpoints. */
  token: string
  invitedById: string
  invitedAt: Date
  expiresAt: Date
  acceptedAt?: Date
  resentAt?: Date
  resendCount: number
}

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * The resolved authorization context for the current request/render.
 * Produced server-side in production; produced from the mock session today.
 */
export interface AccessContext {
  member: Member
  organization: Organization
  /** The workspace currently in scope (workspace switcher). */
  workspace: Workspace | null
  role: RoleDefinition
  /** Effective permissions AFTER account-status gating. */
  permissions: Permission[]
  /** Permissions the role grants, ignoring status. Used to explain gating in UI. */
  grantedPermissions: Permission[]
  status: AccountStatus
}
