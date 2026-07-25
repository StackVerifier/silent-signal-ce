import { describe, expect, it } from 'vitest'
import {
  STATUS_CAN_AUTHENTICATE,
  buildAccessContext,
  assertPermission,
  assertSameOrganization,
  can,
  canAll,
  canAny,
  PermissionDeniedError,
  TenantIsolationError,
} from '@/lib/rbac/access'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { assignableRoles, canManageRole, resolveRole } from '@/lib/rbac/roles'
import { requiredPermissionsForPath, visibleNavItems } from '@/lib/rbac/navigation'
import type { AccountStatus, Member, Organization, RoleId, Workspace } from '@/lib/rbac/types'

const organization: Organization = {
  id: 'org_1',
  name: 'Acme',
  slug: 'acme',
  plan: 'pro',
  ssoEnabled: false,
  verifiedDomains: [],
  createdAt: new Date('2024-01-01'),
  settings: {
    requireAdminApproval: true,
    twoFactorRequired: false,
    invitationExpiryDays: 7,
    dataRetentionDays: 365,
    auditLoggingEnabled: true,
  },
}

const workspace: Workspace = {
  id: 'ws_1',
  organizationId: 'org_1',
  name: 'Platform',
  slug: 'platform',
  status: 'active',
  integrationIds: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'mem_1',
    organizationId: 'org_1',
    userId: 'usr_1',
    email: 'someone@acme.test',
    name: 'Someone',
    roleId: 'org_admin',
    status: 'approved',
    workspaceIds: ['ws_1'],
    teamIds: [],
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

describe('account status gating', () => {
  it('gives an approved member the permissions their role grants', () => {
    const context = buildAccessContext({ member: member(), organization, workspace })
    expect(context.permissions.length).toBeGreaterThan(0)
    expect(context.permissions).toEqual(context.grantedPermissions)
  })

  // The whole "pending members see skeletons, never data" behaviour rests on
  // this: the granted set is preserved so the UI can explain the gating, while
  // the effective set — the one every check reads — is empty.
  it.each<AccountStatus>(['pending', 'suspended', 'rejected', 'deleted'])(
    'empties the effective permissions of a %s member without losing the granted set',
    (status) => {
      const context = buildAccessContext({ member: member({ status }), organization, workspace })
      expect(context.permissions).toEqual([])
      expect(context.grantedPermissions.length).toBeGreaterThan(0)
    },
  )

  it('lets a pending member hold a session but not a rejected or deleted one', () => {
    expect(STATUS_CAN_AUTHENTICATE.pending).toBe(true)
    expect(STATUS_CAN_AUTHENTICATE.suspended).toBe(true)
    expect(STATUS_CAN_AUTHENTICATE.rejected).toBe(false)
    expect(STATUS_CAN_AUTHENTICATE.deleted).toBe(false)
  })

  it('gates a status the product has not seen before, rather than defaulting to open', () => {
    // A status added to the union but forgotten in the grant table must fail
    // closed. `?? false` is what the lookup does for an unknown key.
    const context = buildAccessContext({
      member: member({ status: 'invented' as AccountStatus }),
      organization,
      workspace,
    })
    expect(context.permissions).toEqual([])
  })
})

describe('permission evaluation', () => {
  const granted = [PERMISSIONS.MEMBERS_READ, PERMISSIONS.MEMBERS_WRITE]

  it('answers can/canAny/canAll consistently', () => {
    expect(can(granted, PERMISSIONS.MEMBERS_READ)).toBe(true)
    expect(can(granted, PERMISSIONS.BILLING_READ)).toBe(false)
    expect(canAny(granted, [PERMISSIONS.BILLING_READ, PERMISSIONS.MEMBERS_READ])).toBe(true)
    expect(canAny(granted, [PERMISSIONS.BILLING_READ])).toBe(false)
    expect(canAll(granted, granted)).toBe(true)
    expect(canAll(granted, [...granted, PERMISSIONS.BILLING_READ])).toBe(false)
  })

  it('throws a 403-shaped error from assertPermission', () => {
    expect(() => assertPermission(granted, PERMISSIONS.MEMBERS_READ)).not.toThrow()
    try {
      assertPermission(granted, PERMISSIONS.BILLING_READ)
      expect.unreachable('assertPermission should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError)
      expect((error as PermissionDeniedError).statusCode).toBe(403)
    }
  })
})

describe('role hierarchy', () => {
  it('lets a higher tier manage a lower one but never an equal or higher one', () => {
    expect(canManageRole('org_owner', 'developer')).toBe(true)
    expect(canManageRole('org_admin', 'release_manager')).toBe(true)
    expect(canManageRole('release_manager', 'org_admin')).toBe(false)
    // Equal tier is the case that matters: one admin must not demote a peer.
    expect(canManageRole('org_admin', 'org_admin')).toBe(false)
  })

  it('only offers roles the actor could actually manage', () => {
    const offered = assignableRoles('release_manager').map((role) => role.id)
    expect(offered).not.toContain('org_owner')
    expect(offered).not.toContain('release_manager')
    for (const roleId of offered) {
      expect(canManageRole('release_manager', roleId as RoleId)).toBe(true)
    }
  })

  it('falls back to the least privileged role for an unknown id', () => {
    const resolved = resolveRole('custom:does-not-exist')
    expect(resolved.permissions).toEqual(resolveRole('viewer').permissions)
  })
})

describe('navigation registry', () => {
  it('hides destinations the member cannot open', () => {
    const viewer = buildAccessContext({
      member: member({ roleId: 'viewer' }),
      organization,
      workspace,
    })
    const hrefs = visibleNavItems(viewer.permissions, 'approved').map((item) => item.href)
    expect(hrefs).not.toContain('/billing')
    expect(hrefs).not.toContain('/members')
    expect(hrefs.length).toBeGreaterThan(0)
  })

  // A pending member has no effective permissions at all, so a purely
  // permission-driven menu would be empty and the product would look broken.
  // They see the delivery surface — locked, skeletons instead of data — while
  // administrative destinations stay hidden entirely.
  it('shows a pending member the delivery surface but no administrative pages', () => {
    const gated = buildAccessContext({
      member: member({ status: 'pending' }),
      organization,
      workspace,
    })
    expect(gated.permissions).toEqual([])
    const hrefs = visibleNavItems(gated.permissions, 'pending').map((item) => item.href)
    expect(hrefs).toContain('/')
    expect(hrefs).not.toContain('/members')
    expect(hrefs).not.toContain('/billing')
    expect(hrefs).not.toContain('/audit-log')
  })

  it('agrees with middleware about what a path requires', () => {
    const billing = requiredPermissionsForPath('/billing')
    expect(billing).toContain(PERMISSIONS.BILLING_READ)
    // An unregistered path returns null — "no opinion", not "no permission
    // needed"; the route handler is still the boundary.
    expect(requiredPermissionsForPath('/not-a-page')).toBeNull()
  })
})

describe('tenant isolation', () => {
  it('blocks a cross-organization resource with a 404, never a 403', () => {
    const context = buildAccessContext({ member: member(), organization, workspace })
    expect(() => assertSameOrganization(context, { organizationId: 'org_1' })).not.toThrow()
    try {
      assertSameOrganization(context, { organizationId: 'org_2' })
      expect.unreachable('assertSameOrganization should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TenantIsolationError)
      // 403 would confirm the record exists somewhere. 404 reveals nothing.
      expect((error as TenantIsolationError).statusCode).toBe(404)
    }
  })

  it('lets a platform admin cross tenants, since that is the point of the role', () => {
    const context = buildAccessContext({
      member: member({ roleId: 'platform_admin' }),
      organization,
      workspace,
    })
    expect(() => assertSameOrganization(context, { organizationId: 'org_2' })).not.toThrow()
  })
})
