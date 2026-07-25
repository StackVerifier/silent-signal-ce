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
