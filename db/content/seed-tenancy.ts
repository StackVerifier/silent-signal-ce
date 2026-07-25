import type {
  Invitation,
  Member,
  Organization,
  Team,
  Workspace,
} from '../../lib/rbac/types'

/**
 * Seed data for a fresh installation — one demo organization so the product has
 * something to show before Jira is connected. Written into SQLite by
 * `scripts/seed-app.mjs`; nothing reads this module at runtime.
 */

export const seedOrganization: Organization = {
  id: 'org-1',
  name: 'Boyner',
  slug: 'boyner',
  logo: 'BY',
  plan: 'enterprise',
  ssoEnabled: true,
  ssoProvider: 'entra-id',
  verifiedDomains: ['boyner.com.tr'],
  createdAt: new Date('2025-01-15'),
  settings: {
    requireAdminApproval: true,
    twoFactorRequired: false,
    invitationExpiryDays: 7,
    dataRetentionDays: 365,
    auditLoggingEnabled: true,
  },
}

export const seedWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    organizationId: 'org-1',
    name: 'Production',
    slug: 'production',
    description: 'Customer-facing platform delivery',
    status: 'active',
    integrationIds: ['int-1', 'int-2'],
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: 'ws-2',
    organizationId: 'org-1',
    name: 'E-Commerce',
    slug: 'e-commerce',
    description: 'Storefront and checkout squads',
    status: 'active',
    integrationIds: ['int-1'],
    createdAt: new Date('2025-03-02'),
    updatedAt: new Date(Date.now() - 172800000),
  },
  {
    id: 'ws-3',
    organizationId: 'org-1',
    name: 'Legacy Migration',
    slug: 'legacy-migration',
    description: 'Wound down after the 2025 migration',
    status: 'archived',
    integrationIds: [],
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2026-01-10'),
    archivedAt: new Date('2026-01-10'),
  },
]

export const seedTeams: Team[] = [
  { id: 'team-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'QA Team', description: 'Quality engineering for platform releases', qaLeadId: 'mem-4', createdAt: new Date('2025-01-20') },
  { id: 'team-2', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Backend Team', description: 'Core services and APIs', releaseManagerId: 'mem-3', createdAt: new Date('2025-01-20') },
  { id: 'team-3', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Mobile Team', description: 'iOS and Android clients', createdAt: new Date('2025-02-11') },
  { id: 'team-4', organizationId: 'org-1', workspaceId: 'ws-2', name: 'Web Team', description: 'Storefront web experience', releaseManagerId: 'mem-3', createdAt: new Date('2025-03-05') },
  { id: 'team-5', organizationId: 'org-1', workspaceId: 'ws-2', name: 'Mobile Team', description: 'Commerce mobile experience', createdAt: new Date('2025-03-05') },
]

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000)
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000)

export const seedMembers: Member[] = [
  {
    id: 'mem-1', organizationId: 'org-1', userId: 'user-1',
    email: 'alice@boyner.com.tr', name: 'Alice Chen', avatar: 'AC',
    roleId: 'org_owner', status: 'approved',
    workspaceIds: ['ws-1', 'ws-2'], teamIds: ['team-2'],
    emailVerifiedAt: daysAgo(190), lastActiveAt: hoursAgo(1), createdAt: daysAgo(190),
  },
  {
    id: 'mem-2', organizationId: 'org-1', userId: 'user-2',
    email: 'bora@boyner.com.tr', name: 'Bora Martinez', avatar: 'BM',
    roleId: 'org_admin', status: 'approved',
    workspaceIds: ['ws-1', 'ws-2'], teamIds: ['team-2', 'team-4'],
    emailVerifiedAt: daysAgo(150), invitedById: 'mem-1', invitedAt: daysAgo(151),
    approvedById: 'mem-1', approvedAt: daysAgo(150), lastActiveAt: hoursAgo(3), createdAt: daysAgo(151),
  },
  {
    id: 'mem-3', organizationId: 'org-1', userId: 'user-3',
    email: 'cem@boyner.com.tr', name: 'Cem Patel', avatar: 'CP',
    roleId: 'release_manager', status: 'approved',
    workspaceIds: ['ws-1', 'ws-2'], teamIds: ['team-2', 'team-4'],
    emailVerifiedAt: daysAgo(120), invitedById: 'mem-1', invitedAt: daysAgo(121),
    approvedById: 'mem-1', approvedAt: daysAgo(120), lastActiveAt: hoursAgo(6), createdAt: daysAgo(121),
  },
  {
    id: 'mem-4', organizationId: 'org-1', userId: 'user-4',
    email: 'deniz@boyner.com.tr', name: 'Deniz Lopez', avatar: 'DL',
    roleId: 'qa_lead', status: 'approved',
    workspaceIds: ['ws-1'], teamIds: ['team-1'],
    emailVerifiedAt: daysAgo(95), invitedById: 'mem-2', invitedAt: daysAgo(96),
    approvedById: 'mem-2', approvedAt: daysAgo(95), lastActiveAt: hoursAgo(2), createdAt: daysAgo(96),
  },
  {
    id: 'mem-5', organizationId: 'org-1', userId: 'user-5',
    email: 'elif@boyner.com.tr', name: 'Elif Kaya', avatar: 'EK',
    roleId: 'developer', status: 'approved',
    workspaceIds: ['ws-1'], teamIds: ['team-3'],
    emailVerifiedAt: daysAgo(60), invitedById: 'mem-2', invitedAt: daysAgo(61),
    approvedById: 'mem-2', approvedAt: daysAgo(60), lastActiveAt: hoursAgo(30), createdAt: daysAgo(61),
  },
  {
    id: 'mem-6', organizationId: 'org-1', userId: 'user-6',
    email: 'faruk@boyner.com.tr', name: 'Faruk Demir', avatar: 'FD',
    roleId: 'developer', status: 'pending',
    workspaceIds: ['ws-2'], teamIds: ['team-5'],
    emailVerifiedAt: hoursAgo(20), invitedById: 'mem-3', invitedAt: daysAgo(2), createdAt: daysAgo(2),
  },
  {
    id: 'mem-7', organizationId: 'org-1', userId: 'user-7',
    email: 'gizem@boyner.com.tr', name: 'Gizem Aydın', avatar: 'GA',
    roleId: 'qa_lead', status: 'pending',
    workspaceIds: ['ws-1'], teamIds: ['team-1'],
    emailVerifiedAt: hoursAgo(5), invitedById: 'mem-4', invitedAt: daysAgo(1), createdAt: daysAgo(1),
  },
  {
    id: 'mem-8', organizationId: 'org-1', userId: 'user-8',
    email: 'hakan@boyner.com.tr', name: 'Hakan Şahin', avatar: 'HŞ',
    roleId: 'viewer', status: 'suspended',
    workspaceIds: ['ws-1'], teamIds: [],
    emailVerifiedAt: daysAgo(200), approvedById: 'mem-1', approvedAt: daysAgo(199),
    lastActiveAt: daysAgo(21), createdAt: daysAgo(200),
  },
  {
    id: 'mem-9', organizationId: 'org-1', userId: 'user-9',
    email: 'irem@boyner.com.tr', name: 'İrem Yıldız', avatar: 'İY',
    roleId: 'viewer', status: 'approved',
    workspaceIds: ['ws-2'], teamIds: ['team-4'],
    emailVerifiedAt: daysAgo(30), invitedById: 'mem-2', invitedAt: daysAgo(31),
    approvedById: 'mem-2', approvedAt: daysAgo(30), lastActiveAt: daysAgo(4), createdAt: daysAgo(31),
  },
  {
    id: 'mem-10', organizationId: 'org-1', userId: 'user-10',
    email: 'jale@boyner.com.tr', name: 'Jale Öz', avatar: 'JÖ',
    roleId: 'developer', status: 'rejected',
    workspaceIds: [], teamIds: [],
    invitedById: 'mem-2', invitedAt: daysAgo(14), createdAt: daysAgo(14),
  },
]

export const seedInvitations: Invitation[] = [
  {
    id: 'inv-1', organizationId: 'org-1', email: 'kerem@boyner.com.tr',
    roleId: 'developer', workspaceId: 'ws-1', teamId: 'team-2',
    status: 'pending', token: '***', invitedById: 'mem-2',
    invitedAt: daysAgo(1), expiresAt: new Date(Date.now() + 6 * 86400000), resendCount: 0,
  },
  {
    id: 'inv-2', organizationId: 'org-1', email: 'leyla@boyner.com.tr',
    roleId: 'qa_lead', workspaceId: 'ws-1', teamId: 'team-1',
    status: 'pending', token: '***', invitedById: 'mem-4',
    invitedAt: daysAgo(4), expiresAt: new Date(Date.now() + 3 * 86400000),
    resentAt: daysAgo(1), resendCount: 1,
  },
  {
    id: 'inv-3', organizationId: 'org-1', email: 'murat@boyner.com.tr',
    roleId: 'viewer', workspaceId: 'ws-2',
    status: 'expired', token: '***', invitedById: 'mem-2',
    invitedAt: daysAgo(20), expiresAt: daysAgo(13), resendCount: 0,
  },
  {
    id: 'inv-4', organizationId: 'org-1', email: 'nazli@boyner.com.tr',
    roleId: 'developer', workspaceId: 'ws-2', teamId: 'team-5',
    status: 'cancelled', token: '***', invitedById: 'mem-3',
    invitedAt: daysAgo(9), expiresAt: daysAgo(2), resendCount: 0,
  },
]
