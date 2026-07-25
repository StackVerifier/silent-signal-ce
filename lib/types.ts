// ─── Risk & Signal Types ──────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none'
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface RiskReason {
  rule: string
  impact: number   // percentage contribution
  value: string    // human readable value
}

export interface Signal {
  id: string
  type: 'blocked' | 'overdue' | 'scope-change' | 'qa-wait' | 'regression' | 'velocity-drop' | 'capacity'
  severity: Severity
  score: number
  title: string
  description: string
  reasons: RiskReason[]
  issueIds: string[]
  service?: string
  createdAt: Date
  updatedAt: Date
}

// ─── Issue Types ──────────────────────────────────────────────────────────────

export type IssueStatus =
  | 'To Do'
  | 'In Progress'
  | 'Development Done'
  | 'In Review'
  | 'QA'
  | 'Done'
  | 'Blocked'

export type IssuePriority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Issue {
  id: string
  key: string
  title: string
  status: IssueStatus
  priority: IssuePriority
  assignee: string
  storyPoints: number
  sprintId?: string
  releaseId?: string
  daysInStatus: number
  blockedBy?: string[]
  labels: string[]
  riskScore: number
}

// ─── Sprint Types ─────────────────────────────────────────────────────────────

export interface Sprint {
  id: string
  name: string
  startDate: Date
  endDate: Date
  totalPoints: number
  completedPoints: number
  remainingPoints: number
  issues: Issue[]
  velocity: number
  previousVelocity: number
  healthScore: number
  riskLevel: RiskLevel
  blockedCount: number
  addedMidSprintCount: number
  team: string
}

// ─── Release Types ────────────────────────────────────────────────────────────

export type GateStatus = 'complete' | 'in-progress' | 'at-risk' | 'blocked'

export interface ReleaseGate {
  name: string
  status: GateStatus
  percent: number
  issueCount: number
}

export interface Release {
  id: string
  name: string
  version: string
  targetDate: Date
  confidence: number
  riskLevel: RiskLevel
  riskScore: number
  riskReasons: RiskReason[]
  gates: ReleaseGate[]
  blockingIssues: Issue[]
  services: string[]
  teamCount: number
}

// ─── QA Types ─────────────────────────────────────────────────────────────────

export interface QAItem {
  id: string
  issueKey: string
  title: string
  priority: IssuePriority
  assignee: string
  waitingDays: number
  status: 'Waiting' | 'In Progress' | 'Regression' | 'Blocked'
  service: string
  riskScore: number
  reopenCount: number
}

export interface QATester {
  name: string
  avatar: string
  capacity: number  // 0-100
  assigned: number
  completed: number
}

// ─── Rule Types ───────────────────────────────────────────────────────────────

export type RuleOperator = 'AND' | 'OR'
export type RuleConditionType = 'IF' | 'AND' | 'OR' | 'NOT'
export type RuleAction = 'score' | 'alert' | 'flag'

export interface RuleCondition {
  field: string
  operator: '<' | '>' | '=' | '>=' | '<=' | '!='
  value: string | number
  type: RuleConditionType
}

export interface Rule {
  id: string
  name: string
  category: 'sprint' | 'release' | 'qa' | 'capacity' | 'velocity'
  enabled: boolean
  conditions: RuleCondition[]
  action: RuleAction
  scoreImpact: number
  description: string
  triggeredCount: number
  lastTriggered?: Date
}

// ─── Dashboard Meta ───────────────────────────────────────────────────────────

export interface ServiceHealth {
  name: string
  riskScore: number
  riskLevel: RiskLevel
  signals: Signal[]
  trend: 'up' | 'down' | 'stable'
}

export interface LiveSignal {
  id: string
  issueKey: string
  severity: Severity
  message: string
  service: string
  timestamp: Date
}

export interface DashboardMetrics {
  releaseHealth: number
  releaseRiskLevel: RiskLevel
  sprintHealth: number
  sprintRiskLevel: RiskLevel
  qaQueueSize: number
  qaWaitAvgDays: number
  blockedIssues: number
  openRisks: number
  activeRules: number
  lastSyncAt: Date
}

// ─── Auth & User Types ────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'lead' | 'member' | 'viewer' | 'guest'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  createdAt: Date
  lastLoginAt?: Date
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  emailNotifications: boolean
  desktopNotifications: boolean
  language: string
}

export interface AuthSession {
  userId: string
  workspaceId: string
  token: string
  expiresAt: Date
}

// ─── Organization & Workspace Types ────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  logo?: string
  description?: string
  owner: User
  members: WorkspaceMember[]
  createdAt: Date
  updatedAt: Date
  settings: WorkspaceSettings
}

export interface WorkspaceMember {
  id: string
  userId: string
  user: User
  role: UserRole
  joinedAt: Date
  invitedBy?: User
}

export interface WorkspaceSettings {
  isPrivate: boolean
  twoFactorRequired: boolean
  ssoEnabled: boolean
  auditLoggingEnabled: boolean
  dataRetentionDays: number
}

// ─── Integration Types ────────────────────────────────────────────────────────

export type IntegrationType = 'jira' | 'github' | 'slack' | 'azure' | 'datadog'

export interface Integration {
  id: string
  workspaceId: string
  type: IntegrationType
  name: string
  enabled: boolean
  config: Record<string, any>
  lastSyncAt?: Date
  createdAt: Date
}

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationLevel = 'critical' | 'high' | 'medium' | 'low'
export type NotificationType = 'risk' | 'release' | 'sprint' | 'qa' | 'system' | 'admin'

export interface Notification {
  id: string
  userId: string
  workspaceId: string
  type: NotificationType
  level: NotificationLevel
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: Date
}

// ─── Audit Log Types ──────────────────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete' | 'invite' | 'remove' | 'export'
export type AuditResource = 'workspace' | 'member' | 'integration' | 'rule' | 'config'

export interface AuditLog {
  id: string
  workspaceId: string
  userId: string
  user: User
  action: AuditAction
  resource: AuditResource
  resourceId: string
  changes?: Record<string, { before: any; after: any }>
  metadata?: Record<string, any>
  createdAt: Date
}

// ─── Billing Types ────────────────────────────────────────────────────────────

export type BillingPlan = 'free' | 'pro' | 'enterprise'

export interface BillingInfo {
  workspaceId: string
  plan: BillingPlan
  status: 'active' | 'past_due' | 'cancelled'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  nextBillingDate?: Date
  usage: {
    rules: number
    team: number
    storage: number
  }
}

// ─── Permission Helper ────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['manage:workspace', 'manage:members', 'manage:billing', 'manage:integrations', 'view:audit', 'edit:rules', 'view:all'],
  manager: ['edit:rules', 'manage:members', 'view:audit', 'view:all', 'export:data'],
  lead: ['edit:rules', 'export:data', 'view:all'],
  member: ['view:all', 'edit:own'],
  viewer: ['view:all'],
  guest: ['view:dashboard'],
}
