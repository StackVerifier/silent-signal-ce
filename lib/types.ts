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

// ─── Actor Types ──────────────────────────────────────────────────────────────
// Identity, roles, org/workspace/team and permissions live in `lib/rbac/*`.
// Only the lightweight actor projection used by domain records stays here.

export interface Actor {
  id: string
  name: string
  email: string
  avatar?: string
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

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'invite' | 'remove' | 'export'
  | 'approve' | 'reject' | 'suspend' | 'activate' | 'transfer' | 'permission_change'
export type AuditResource =
  | 'organization' | 'workspace' | 'team' | 'member' | 'invitation'
  | 'integration' | 'rule' | 'role' | 'config'

export interface AuditLog {
  id: string
  organizationId: string
  workspaceId?: string
  userId: string
  user: Actor
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
