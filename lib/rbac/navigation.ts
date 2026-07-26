import {
  LayoutDashboard, Zap, GitBranch, FlaskConical, Clock, Shield, Bell,
  Plug, Users, UsersRound, FileText, FileSpreadsheet, Building2, CreditCard, User, LifeBuoy,
  type LucideIcon,
} from 'lucide-react'
import { PERMISSIONS, type Permission } from './permissions'
import type { AccountStatus } from './types'

export type NavSection = 'monitoring' | 'workspace' | 'administration' | 'account'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  section: NavSection
  /** Item is shown when the member holds ANY of these. Empty = always visible. */
  permissions: Permission[]
  shortcut?: string
  /** Keywords the command palette also matches on. */
  keywords?: string[]
}

export const NAV_SECTIONS: { id: NavSection; label: string }[] = [
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'administration', label: 'Administration' },
]

/**
 * Single source of truth for navigation. The sidebar, the command palette, the
 * keyboard shortcuts and the route guard all derive from this list, which is
 * what keeps them from drifting apart (they previously each held their own).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard,
    section: 'monitoring', permissions: [PERMISSIONS.DASHBOARD_READ], shortcut: '1',
    keywords: ['home', 'overview', 'executive'],
  },
  {
    id: 'sprint', label: 'Sprint Intelligence', href: '/sprint', icon: Zap,
    section: 'monitoring', permissions: [PERMISSIONS.SPRINT_READ], shortcut: '2',
    keywords: ['velocity', 'capacity', 'board'],
  },
  {
    id: 'release', label: 'Release Control', href: '/release', icon: GitBranch,
    section: 'monitoring', permissions: [PERMISSIONS.RELEASE_READ], shortcut: '3',
    keywords: ['gates', 'deployment', 'readiness'],
  },
  {
    id: 'qa-queue', label: 'QA Queue', href: '/qa-queue', icon: FlaskConical,
    section: 'monitoring', permissions: [PERMISSIONS.QA_READ], shortcut: '4',
    keywords: ['testing', 'triage', 'defects'],
  },
  {
    id: 'risk-timeline', label: 'Risk Timeline', href: '/risk-timeline', icon: Clock,
    section: 'monitoring', permissions: [PERMISSIONS.RISK_READ], shortcut: '5',
    keywords: ['events', 'history', 'signals'],
  },
  {
    id: 'rules', label: 'Rule Management', href: '/rules', icon: Shield,
    section: 'monitoring', permissions: [PERMISSIONS.RULES_READ], shortcut: '6',
    keywords: ['automation', 'conditions', 'scoring'],
  },

  {
    id: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell,
    section: 'workspace', permissions: [PERMISSIONS.NOTIFICATIONS_READ],
    keywords: ['alerts', 'slack', 'teams', 'email'],
  },
  {
    id: 'integrations', label: 'Integrations', href: '/integrations', icon: Plug,
    section: 'workspace', permissions: [PERMISSIONS.INTEGRATION_READ],
    keywords: ['jira', 'slack', 'github', 'azure'],
  },
  {
    id: 'teams', label: 'Teams', href: '/teams', icon: UsersRound,
    section: 'workspace', permissions: [PERMISSIONS.TEAMS_READ],
    keywords: ['squad', 'group', 'assignments'],
  },

  {
    id: 'members', label: 'Members', href: '/members', icon: Users,
    section: 'administration', permissions: [PERMISSIONS.MEMBERS_READ],
    keywords: ['people', 'invite', 'approve', 'users'],
  },
  {
    id: 'reports', label: 'Reports', href: '/reports', icon: FileSpreadsheet,
    section: 'workspace', permissions: [PERMISSIONS.REPORTS_READ],
    keywords: ['export', 'pdf', 'excel', 'download', 'sprint', 'release', 'qa'],
  },
  {
    id: 'audit-log', label: 'Audit Log', href: '/audit-log', icon: FileText,
    section: 'administration', permissions: [PERMISSIONS.AUDIT_READ],
    keywords: ['activity', 'compliance', 'history'],
  },
  {
    id: 'workspace', label: 'Workspace', href: '/workspace', icon: Building2,
    section: 'administration', permissions: [PERMISSIONS.WORKSPACE_READ],
    keywords: ['settings', 'organization', 'sso'],
  },
  {
    id: 'billing', label: 'Billing', href: '/billing', icon: CreditCard,
    section: 'administration', permissions: [PERMISSIONS.BILLING_READ],
    keywords: ['plan', 'invoice', 'seats', 'usage'],
  },
]

/** Rendered in the sidebar footer, below the scrolling navigation. */
export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  {
    id: 'profile', label: 'Profile', href: '/profile', icon: User,
    section: 'account', permissions: [], keywords: ['account', 'preferences'],
  },
  {
    id: 'help', label: 'Help & Support', href: '/help', icon: LifeBuoy,
    section: 'account', permissions: [], keywords: ['docs', 'support', 'contact'],
  },
]

export const ALL_NAV_ITEMS = [...NAV_ITEMS, ...ACCOUNT_NAV_ITEMS]

/**
 * Pending members see the delivery surface so they understand what they are
 * waiting for — rendered locked, with skeletons instead of data. Admin-only
 * destinations stay hidden entirely.
 */
const PENDING_VISIBLE_IDS = new Set([
  'dashboard', 'sprint', 'release', 'qa-queue', 'risk-timeline', 'rules', 'notifications',
])

export function visibleNavItems(
  permissions: Permission[],
  status: AccountStatus,
  items: NavItem[] = NAV_ITEMS,
): NavItem[] {
  if (status !== 'approved') {
    return items.filter((item) => PENDING_VISIBLE_IDS.has(item.id))
  }
  return items.filter(
    (item) => item.permissions.length === 0 || item.permissions.some((p) => permissions.includes(p)),
  )
}

/** Route → permissions required to open it. Used by middleware and the guard. */
export function requiredPermissionsForPath(pathname: string): Permission[] | null {
  const match = ALL_NAV_ITEMS.filter(
    (item) => item.href === pathname || (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
  )
    // Longest href wins, so /workspace/teams beats /workspace.
    .sort((a, b) => b.href.length - a.href.length)[0]

  if (!match) return null
  return match.permissions
}

export function navItemForPath(pathname: string): NavItem | null {
  return (
    ALL_NAV_ITEMS.filter(
      (item) => item.href === pathname || (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
    ).sort((a, b) => b.href.length - a.href.length)[0] ?? null
  )
}
