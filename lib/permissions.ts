import type { UserRole } from './types'
import { ROLE_PERMISSIONS } from './types'

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'manage:workspace': 'Manage workspace settings and configuration',
  'manage:members': 'Invite, remove, and manage team members',
  'manage:billing': 'Access and manage billing information',
  'manage:integrations': 'Add and configure integrations',
  'view:audit': 'View audit logs and activity history',
  'edit:rules': 'Create and edit risk rules',
  'view:all': 'View all dashboards and reports',
  'export:data': 'Export data and reports',
  'edit:own': 'Edit own profile and settings',
  'view:dashboard': 'View basic dashboard',
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

export function requirePermission(role: UserRole, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} required`)
  }
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    lead: 'Team Lead',
    member: 'Member',
    viewer: 'Viewer',
    guest: 'Guest',
  }
  return labels[role] || role
}

export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full control over workspace, members, billing, and integrations',
    manager: 'Can manage team members, rules, and view audit logs',
    lead: 'Can edit rules and export data',
    member: 'Can view dashboards and edit own profile',
    viewer: 'Read-only access to all dashboards',
    guest: 'Limited access to public dashboards',
  }
  return descriptions[role] || ''
}

export const ROLE_TIERS: Record<UserRole, number> = {
  admin: 6,
  manager: 5,
  lead: 4,
  member: 3,
  viewer: 2,
  guest: 1,
}

export function canManage(userRole: UserRole, targetRole: UserRole): boolean {
  // Can only manage roles below or equal to yours
  return ROLE_TIERS[userRole] >= ROLE_TIERS[targetRole]
}
