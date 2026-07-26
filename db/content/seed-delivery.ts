import type {
  DashboardMetrics, ServiceHealth, LiveSignal,
  Sprint, Release, QAItem, QATester, Rule, Signal,
  Notification, Integration, BillingInfo, RiskTimelineEvent
} from '../../lib/types'
import type { AuditEventId, AuditSource, AuditStatus } from '../../lib/audit/events.ts'

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export const dashboardMetrics: DashboardMetrics = {
  releaseHealth: 82,
  releaseRiskLevel: 'HIGH',
  sprintHealth: 74,
  sprintRiskLevel: 'MEDIUM',
  qaQueueSize: 18,
  qaWaitAvgDays: 3.4,
  blockedIssues: 5,
  openRisks: 12,
  activeRules: 24,
  lastSyncAt: new Date(Date.now() - 12000),
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export const signals: Signal[] = [
  {
    id: 's1',
    type: 'qa-wait',
    severity: 'critical',
    score: 82,
    title: 'Release Risk Elevated',
    description: 'Multiple QA blockers pushing release confidence below threshold',
    reasons: [
      { rule: 'QA Wait > 5 days', impact: 40, value: '12 tasks waiting in QA' },
      { rule: 'Critical Bug Reopen', impact: 25, value: '3 critical issues reopened' },
      { rule: 'QA Capacity > 90%', impact: 15, value: 'QA team at 94% capacity' },
      { rule: 'Release Date < 5 days', impact: 2, value: '4 days to target release' },
    ],
    issueIds: ['PAY-123', 'PAY-145', 'ORD-222', 'ORD-234'],
    service: 'Payment Service',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 600000),
  },
  {
    id: 's2',
    type: 'blocked',
    severity: 'high',
    score: 62,
    title: 'Order Service Blocked',
    description: 'Critical dependency blocked waiting on external team',
    reasons: [
      { rule: 'Blocked Issue > 2 days', impact: 35, value: 'PAY-091 blocked 4 days' },
      { rule: 'Sprint Remaining < 3 days', impact: 27, value: '2 days left in sprint' },
    ],
    issueIds: ['ORD-456', 'ORD-189'],
    service: 'Order Service',
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 900000),
  },
  {
    id: 's3',
    type: 'scope-change',
    severity: 'medium',
    score: 35,
    title: 'Checkout Scope Drift',
    description: 'Mid-sprint additions increasing scope',
    reasons: [
      { rule: 'Mid-sprint additions > 3', impact: 20, value: '5 issues added mid-sprint' },
      { rule: 'Story point increase > 15%', impact: 15, value: '+18% total points' },
    ],
    issueIds: ['CHK-089', 'CHK-091', 'CHK-094', 'CHK-095', 'CHK-097'],
    service: 'Checkout',
    createdAt: new Date(Date.now() - 10800000),
    updatedAt: new Date(Date.now() - 1800000),
  },
]

// ─── Service Health ───────────────────────────────────────────────────────────

export const serviceHealth: ServiceHealth[] = [
  { name: 'Payment Service', riskScore: 87, riskLevel: 'HIGH', signals: [signals[0]], trend: 'up' },
  { name: 'Order Service',   riskScore: 62, riskLevel: 'MEDIUM', signals: [signals[1]], trend: 'up' },
  { name: 'Checkout',        riskScore: 35, riskLevel: 'LOW', signals: [signals[2]], trend: 'down' },
  { name: 'Auth Service',    riskScore: 18, riskLevel: 'LOW', signals: [], trend: 'stable' },
  { name: 'API Gateway',     riskScore: 44, riskLevel: 'MEDIUM', signals: [], trend: 'down' },
]

// ─── Live Signals ─────────────────────────────────────────────────────────────

export const liveSignals: LiveSignal[] = [
  { id: 'ls1', issueKey: 'PAY-123', severity: 'critical', message: 'Test wait 5 days — regression not complete', service: 'Payment', timestamp: new Date(Date.now() - 300000) },
  { id: 'ls2', issueKey: 'ORD-456', severity: 'high', message: 'Added mid-sprint — scope risk detected', service: 'Order', timestamp: new Date(Date.now() - 720000) },
  { id: 'ls3', issueKey: 'PAY-145', severity: 'critical', message: 'Critical bug reopened 2nd time', service: 'Payment', timestamp: new Date(Date.now() - 1200000) },
  { id: 'ls4', issueKey: 'CHK-089', severity: 'medium', message: 'Dev Done > 3 days — QA unassigned', service: 'Checkout', timestamp: new Date(Date.now() - 2400000) },
  { id: 'ls5', issueKey: 'ORD-222', severity: 'high', message: 'QA waiting 4 days — no tester assigned', service: 'Order', timestamp: new Date(Date.now() - 3600000) },
  { id: 'ls6', issueKey: 'AUTH-034', severity: 'medium', message: 'Velocity drop 22% vs last sprint', service: 'Auth', timestamp: new Date(Date.now() - 5400000) },
]

// ─── Sprints ──────────────────────────────────────────────────────────────────

export const sprints: Sprint[] = [
  {
    id: 'sp1',
    name: 'Sprint 42',
    startDate: new Date('2026-07-14'),
    endDate: new Date('2026-07-28'),
    totalPoints: 89,
    completedPoints: 52,
    remainingPoints: 37,
    velocity: 67,
    previousVelocity: 82,
    healthScore: 74,
    riskLevel: 'MEDIUM',
    blockedCount: 3,
    addedMidSprintCount: 5,
    team: 'Backend Team',
    issues: [
      { id: 'i1', key: 'PAY-123', title: 'Fix payment gateway timeout', status: 'Development Done', priority: 'Critical', assignee: 'Alice Chen', storyPoints: 8, daysInStatus: 5, labels: ['payment', 'regression'], riskScore: 82, releaseId: 'r1' },
      { id: 'i2', key: 'ORD-456', title: 'Order state machine refactor', status: 'Blocked', priority: 'High', assignee: 'Bora Martinez', storyPoints: 13, daysInStatus: 4, blockedBy: ['PAY-091'], labels: ['order', 'blocked'], riskScore: 71, releaseId: 'r1' },
      { id: 'i3', key: 'CHK-089', title: 'Checkout flow redesign', status: 'In Progress', priority: 'Medium', assignee: 'Deniz Lopez', storyPoints: 5, daysInStatus: 2, labels: ['checkout', 'ui'], riskScore: 35, releaseId: 'r1' },
      { id: 'i4', key: 'AUTH-034', title: 'JWT refresh token bug', status: 'QA', priority: 'High', assignee: 'İrem Yıldız', storyPoints: 3, daysInStatus: 3, labels: ['auth', 'security'], riskScore: 44, releaseId: 'r1' },
      { id: 'i5', key: 'PAY-145', title: 'Subscription billing cycle fix', status: 'Development Done', priority: 'Critical', assignee: 'Alice Chen', storyPoints: 8, daysInStatus: 2, labels: ['payment', 'billing'], riskScore: 68, releaseId: 'r1' },
      { id: 'i6', key: 'ORD-222', title: 'Inventory sync race condition', status: 'QA', priority: 'High', assignee: 'Gizem Aydın', storyPoints: 5, daysInStatus: 4, labels: ['order', 'sync'], riskScore: 59, releaseId: 'r1' },
      { id: 'i7', key: 'CHK-091', title: 'Promo code validation', status: 'Done', priority: 'Medium', assignee: 'Hakan Şahin', storyPoints: 3, daysInStatus: 0, labels: ['checkout', 'promo'], riskScore: 5, releaseId: 'r1' },
      { id: 'i8', key: 'API-012', title: 'Rate limiter config update', status: 'Done', priority: 'Low', assignee: 'Cem Patel', storyPoints: 2, daysInStatus: 0, labels: ['api', 'config'], riskScore: 3, releaseId: 'r1' },
      { id: 'i9', key: 'INFRA-005', title: 'K8s resource limits', status: 'In Review', priority: 'Medium', assignee: 'Elif Kaya', storyPoints: 5, daysInStatus: 1, labels: ['infra', 'k8s'], riskScore: 22, releaseId: 'r1' },
    ],
  },
  {
    id: 'sp2',
    name: 'Sprint 41',
    startDate: new Date('2026-06-30'),
    endDate: new Date('2026-07-14'),
    totalPoints: 76,
    completedPoints: 71,
    remainingPoints: 5,
    velocity: 82,
    previousVelocity: 79,
    healthScore: 91,
    riskLevel: 'LOW',
    blockedCount: 1,
    addedMidSprintCount: 2,
    team: 'Backend Team',
    issues: [],
  },
]

// ─── Releases ───────────────────────────────────────────────────��─────────────

export const releases: Release[] = [
  {
    id: 'r1',
    name: 'Platform v2.4',
    version: '2.4.0',
    targetDate: new Date('2026-07-29'),
    confidence: 78,
    riskLevel: 'HIGH',
    riskScore: 82,
    riskReasons: [
      { rule: 'QA completion < 80%', impact: 30, value: '12 items pending QA' },
      { rule: 'Critical bugs > 2', impact: 25, value: '3 critical unresolved' },
      { rule: 'QA capacity > 90%', impact: 15, value: 'Team at 94% capacity' },
      { rule: 'Release date < 5 days', impact: 12, value: '4 days remaining' },
    ],
    gates: [
      { name: 'Development', status: 'complete',    percent: 100, issueCount: 0 },
      { name: 'Code Review', status: 'complete',    percent: 95,  issueCount: 1 },
      { name: 'QA Testing',  status: 'at-risk',     percent: 70,  issueCount: 12 },
      { name: 'Regression',  status: 'at-risk',     percent: 40,  issueCount: 8 },
      { name: 'Sign-off',    status: 'blocked',     percent: 0,   issueCount: 0 },
    ],
    blockingIssues: [
      { id: 'bi1', key: 'PAY-123', title: 'Regression suite not complete', status: 'Development Done', priority: 'Critical', assignee: 'Alice Chen', storyPoints: 8, daysInStatus: 5, labels: ['regression'], riskScore: 82 },
      { id: 'bi2', key: 'ORD-222', title: 'QA waiting 4 days', status: 'QA', priority: 'High', assignee: 'Unassigned', storyPoints: 5, daysInStatus: 4, labels: ['qa'], riskScore: 59 },
      { id: 'bi3', key: 'AUTH-034', title: 'Token refresh edge case fails', status: 'QA', priority: 'High', assignee: 'İrem Yıldız', storyPoints: 3, daysInStatus: 3, labels: ['auth', 'security'], riskScore: 44 },
    ],
    services: ['Payment Service', 'Order Service', 'Checkout', 'Auth Service'],
    teamCount: 12,
  },
  {
    id: 'r2',
    name: 'Mobile SDK v1.8',
    version: '1.8.2',
    targetDate: new Date('2026-08-12'),
    confidence: 91,
    riskLevel: 'LOW',
    riskScore: 22,
    riskReasons: [
      { rule: 'QA completion < 80%', impact: 12, value: '2 items pending QA' },
      { rule: 'Story point variance', impact: 10, value: '+8% variance from estimate' },
    ],
    gates: [
      { name: 'Development', status: 'complete',    percent: 100, issueCount: 0 },
      { name: 'Code Review', status: 'complete',    percent: 100, issueCount: 0 },
      { name: 'QA Testing',  status: 'in-progress', percent: 88,  issueCount: 2 },
      { name: 'Regression',  status: 'in-progress', percent: 75,  issueCount: 3 },
      { name: 'Sign-off',    status: 'blocked',     percent: 0,   issueCount: 0 },
    ],
    blockingIssues: [],
    services: ['Mobile SDK', 'Push Notification'],
    teamCount: 6,
  },
]

// ─── QA Queue ─────────────────────────────────────────────────────────────────

export const qaQueue: QAItem[] = [
  { id: 'qa1', issueKey: 'PAY-123', title: 'Payment gateway timeout fix', priority: 'Critical', assignee: 'Unassigned', waitingDays: 5, status: 'Waiting', service: 'Payment', riskScore: 82, reopenCount: 2 },
  { id: 'qa2', issueKey: 'ORD-222', title: 'Inventory sync race condition', priority: 'High', assignee: 'Gizem Aydın', waitingDays: 4, status: 'In Progress', service: 'Order', riskScore: 59, reopenCount: 1 },
  { id: 'qa3', issueKey: 'PAY-145', title: 'Subscription billing cycle fix', priority: 'Critical', assignee: 'Unassigned', waitingDays: 2, status: 'Waiting', service: 'Payment', riskScore: 68, reopenCount: 0 },
  { id: 'qa4', issueKey: 'AUTH-034', title: 'JWT refresh token bug', priority: 'High', assignee: 'İrem Yıldız', waitingDays: 3, status: 'Regression', service: 'Auth', riskScore: 44, reopenCount: 1 },
  { id: 'qa5', issueKey: 'CHK-089', title: 'Checkout flow UX fix', priority: 'Medium', assignee: 'Gizem Aydın', waitingDays: 3, status: 'In Progress', service: 'Checkout', riskScore: 35, reopenCount: 0 },
  { id: 'qa6', issueKey: 'ORD-456', title: 'Order state machine edge case', priority: 'High', assignee: 'Unassigned', waitingDays: 1, status: 'Waiting', service: 'Order', riskScore: 71, reopenCount: 0 },
  { id: 'qa7', issueKey: 'API-019', title: 'Rate limit header missing', priority: 'Medium', assignee: 'Hakan Şahin', waitingDays: 2, status: 'In Progress', service: 'API Gateway', riskScore: 28, reopenCount: 0 },
  { id: 'qa8', issueKey: 'INFRA-005', title: 'Memory leak in worker process', priority: 'High', assignee: 'Unassigned', waitingDays: 1, status: 'Blocked', service: 'Infrastructure', riskScore: 51, reopenCount: 0 },
]

export const qaTesters: QATester[] = [
  { name: 'Gizem Aydın',  avatar: 'LM', capacity: 94, assigned: 4, completed: 12 },
  { name: 'İrem Yıldız', avatar: 'JW', capacity: 87, assigned: 3, completed: 9 },
  { name: 'Hakan Şahin',   avatar: 'TA', capacity: 72, assigned: 2, completed: 15 },
  { name: 'Jale Öz', avatar: 'PS', capacity: 45, assigned: 1, completed: 8 },
]

// ─── Rules ────────────────────────────────────────────────────────────────────

export const rules: Rule[] = [
  {
    id: 'r001',
    name: 'Sprint Remaining Days Critical',
    category: 'sprint',
    enabled: true,
    conditions: [
      { field: 'remainingDays', operator: '<', value: 3, type: 'IF' },
      { field: 'openIssues', operator: '>', value: 'completedIssues', type: 'AND' },
      { field: 'blockedIssues', operator: '>', value: 0, type: 'AND' },
    ],
    action: 'score',
    scoreImpact: 35,
    description: 'Sprint is in critical state with less than 3 days left and more open than closed issues',
    triggeredCount: 12,
    lastTriggered: new Date(Date.now() - 3600000),
  },
  {
    id: 'r002',
    name: 'QA Bottleneck Detected',
    category: 'qa',
    enabled: true,
    conditions: [
      { field: 'status', operator: '=', value: 'Development Done', type: 'IF' },
      { field: 'waitingDays', operator: '>', value: 2, type: 'AND' },
      { field: 'assignee', operator: '=', value: 'QA', type: 'AND' },
    ],
    action: 'alert',
    scoreImpact: 25,
    description: 'Issue has been in Development Done state for more than 2 days waiting for QA',
    triggeredCount: 8,
    lastTriggered: new Date(Date.now() - 7200000),
  },
  {
    id: 'r003',
    name: 'Release Date Imminent Risk',
    category: 'release',
    enabled: true,
    conditions: [
      { field: 'releaseDate - today', operator: '<', value: 5, type: 'IF' },
      { field: 'unfinishedTaskPercent', operator: '>', value: '20%', type: 'AND' },
    ],
    action: 'score',
    scoreImpact: 80,
    description: 'Release date is within 5 days but more than 20% of tasks are unfinished',
    triggeredCount: 3,
    lastTriggered: new Date(Date.now() - 900000),
  },
  {
    id: 'r004',
    name: 'Critical Bug Reopened',
    category: 'qa',
    enabled: true,
    conditions: [
      { field: 'priority', operator: '=', value: 'Critical', type: 'IF' },
      { field: 'reopenCount', operator: '>=', value: 1, type: 'AND' },
    ],
    action: 'score',
    scoreImpact: 20,
    description: 'A critical priority issue has been reopened at least once',
    triggeredCount: 5,
    lastTriggered: new Date(Date.now() - 1800000),
  },
  {
    id: 'r005',
    name: 'Velocity Drop Warning',
    category: 'velocity',
    enabled: true,
    conditions: [
      { field: 'currentVelocity', operator: '<', value: 'previousVelocity * 0.8', type: 'IF' },
    ],
    action: 'alert',
    scoreImpact: 15,
    description: 'Team velocity has dropped more than 20% compared to the previous sprint',
    triggeredCount: 2,
    lastTriggered: new Date(Date.now() - 14400000),
  },
  {
    id: 'r006',
    name: 'Mid-Sprint Scope Addition',
    category: 'sprint',
    enabled: true,
    conditions: [
      { field: 'addedMidSprint', operator: '>', value: 3, type: 'IF' },
      { field: 'sprintProgress', operator: '>', value: '30%', type: 'AND' },
    ],
    action: 'flag',
    scoreImpact: 10,
    description: 'More than 3 issues were added after the sprint started at 30%+ completion',
    triggeredCount: 7,
    lastTriggered: new Date(Date.now() - 21600000),
  },
  {
    id: 'r007',
    name: 'QA Capacity Overload',
    category: 'capacity',
    enabled: true,
    conditions: [
      { field: 'qaCapacity', operator: '>', value: '90%', type: 'IF' },
      { field: 'pendingQAItems', operator: '>', value: 5, type: 'AND' },
    ],
    action: 'alert',
    scoreImpact: 30,
    description: 'QA team is at over 90% capacity with more than 5 items waiting',
    triggeredCount: 4,
    lastTriggered: new Date(Date.now() - 3600000),
  },
  {
    id: 'r008',
    name: 'Issue Blocked > 2 Days',
    category: 'sprint',
    enabled: false,
    conditions: [
      { field: 'status', operator: '=', value: 'Blocked', type: 'IF' },
      { field: 'daysInStatus', operator: '>', value: 2, type: 'AND' },
    ],
    action: 'alert',
    scoreImpact: 18,
    description: 'An issue has been in Blocked status for more than 2 days',
    triggeredCount: 9,
    lastTriggered: new Date(Date.now() - 43200000),
  },
]

// ─── Risk Timeline ────────────────────────────────────────────────────────────

export const riskTimeline: RiskTimelineEvent[] = [
  { id: 't1', date: new Date('2026-07-25T09:15:00'), type: 'risk-increase', title: 'QA bottleneck detected', description: 'PAY-123 waiting 5 days in Development Done', riskDelta: +15, service: 'Payment', severity: 'critical' },
  { id: 't2', date: new Date('2026-07-25T07:30:00'), type: 'alert', title: 'Critical bug reopened', description: 'PAY-145 reopened for 2nd time', riskDelta: +8, service: 'Payment', severity: 'critical' },
  { id: 't3', date: new Date('2026-07-24T16:00:00'), type: 'risk-increase', title: 'Velocity drop 22%', description: 'Sprint 42 trending below previous velocity', riskDelta: +5, service: 'Platform', severity: 'medium' },
  { id: 't4', date: new Date('2026-07-24T11:00:00'), type: 'risk-increase', title: 'Scope creep detected', description: '5 issues added mid-sprint to Sprint 42', riskDelta: +10, service: 'Checkout', severity: 'medium' },
  { id: 't5', date: new Date('2026-07-23T14:30:00'), type: 'resolved', title: 'CHK-091 resolved', description: 'Promo code validation fix shipped', riskDelta: -5, service: 'Checkout', severity: 'low' },
  { id: 't6', date: new Date('2026-07-23T09:00:00'), type: 'sprint-start', title: 'Sprint 42 started', description: '89 story points committed across 9 issues', riskDelta: 0, severity: 'low' },
  { id: 't7', date: new Date('2026-07-22T16:45:00'), type: 'risk-decrease', title: 'Blocked issue resolved', description: 'AUTH-029 dependency resolved', riskDelta: -12, service: 'Auth', severity: 'low' },
  { id: 't8', date: new Date('2026-07-21T10:00:00'), type: 'alert', title: 'QA capacity warning', description: 'QA team hit 90% capacity threshold', riskDelta: +7, service: 'QA', severity: 'high' },
  { id: 't9', date: new Date('2026-07-18T09:00:00'), type: 'release', title: 'Platform v2.3 released', description: 'Successfully shipped 14 features', riskDelta: -30, severity: 'low' },
  { id: 't10', date: new Date('2026-07-16T15:00:00'), type: 'risk-decrease', title: 'Sprint 41 completed', description: '94% completion rate achieved', riskDelta: -20, service: 'Platform', severity: 'low' },
]

// ─── Users ────────────────────────────────────────────────────────────────────

// Actors referenced by audit records — projected from the tenancy graph.
// ─── Notifications ────────────────────────────────────────────────────────────

export const seedNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'mem-1',
    workspaceId: 'ws-1',
    type: 'risk',
    level: 'critical',
    title: 'Critical Risk Alert',
    message: 'Payment Service risk score jumped to 87 — multiple QA blockers detected',
    link: '/risk-timeline',
    read: false,
    createdAt: new Date(Date.now() - 600000),
  },
  {
    id: 'notif-2',
    userId: 'mem-1',
    workspaceId: 'ws-1',
    type: 'sprint',
    level: 'high',
    title: 'Sprint Alert',
    message: 'Sprint 42 velocity trending 22% below last sprint',
    link: '/sprint',
    read: false,
    createdAt: new Date(Date.now() - 1800000),
  },
  {
    id: 'notif-3',
    userId: 'mem-1',
    workspaceId: 'ws-1',
    type: 'release',
    level: 'medium',
    title: 'Release Status Update',
    message: 'Platform v2.4 now at 78% completion — on track for next Friday',
    link: '/release',
    read: true,
    createdAt: new Date(Date.now() - 3600000),
  },
]

// Additional notifications so the centre has realistic volume and mixed states.
const moreNotifications: Notification[] = [
  {
    id: 'notif-4', userId: 'mem-1', workspaceId: 'ws-1', type: 'qa', level: 'high',
    title: 'QA Queue Backing Up',
    message: '18 items waiting — oldest has been queued for 6 days',
    link: '/qa-queue', read: false, createdAt: new Date(Date.now() - 5400000),
  },
  {
    id: 'notif-5', userId: 'mem-1', workspaceId: 'ws-1', type: 'system', level: 'medium',
    title: 'Jira Sync Completed',
    message: '1,284 issues synced from 3 boards in 42 seconds',
    link: '/integrations', read: true, createdAt: new Date(Date.now() - 10800000),
  },
  {
    id: 'notif-6', userId: 'mem-1', workspaceId: 'ws-1', type: 'admin', level: 'medium',
    title: 'Two Members Awaiting Approval',
    message: 'Faruk Demir and Gizem Aydın requested access',
    link: '/members', read: false, createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: 'notif-7', userId: 'mem-1', workspaceId: 'ws-1', type: 'release', level: 'critical',
    title: 'Release Gate Blocked',
    message: 'Regression gate failed for Platform v2.4 — 9 tests red',
    link: '/release', read: true, createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: 'notif-8', userId: 'mem-1', workspaceId: 'ws-1', type: 'system', level: 'low',
    title: 'Slack Notification Delivered',
    message: 'Critical risk alert posted to #release-risk',
    link: '/notifications', read: true, createdAt: new Date(Date.now() - 259200000),
  },
]

seedNotifications.push(...moreNotifications)

// ─── Audit Log ────────────────────────────────────────────────────────────────
//
// Seeded so the screen has something to demonstrate on a fresh install. The
// spread is deliberate: several severities, a denied attempt, a failed sign-in,
// a permission change, and a webhook update whose URL is already masked —
// together they exercise every branch of the timeline and the detail drawer.

export interface SeedAuditRecord {
  event: AuditEventId
  organizationId: string
  workspaceId?: string
  workspaceName?: string
  actorId: string
  target?: { type: string; id: string; name?: string; email?: string }
  status?: AuditStatus
  source?: AuditSource
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
  relations?: Record<string, string>
  ipAddress?: string
  device?: string
  correlationId?: string
  createdAt: Date
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

export const seedAuditRecords: SeedAuditRecord[] = [
  {
    event: 'rule.enabled',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-1',
    target: { type: 'rule', id: 'rule-1', name: 'Payment Timeout' },
    changes: {
      enabled: { before: false, after: true },
      severity: { before: 'medium', after: 'high' },
      threshold: { before: 10, after: 5 },
    },
    relations: { ruleId: 'rule-1', ruleName: 'Payment Timeout' },
    ipAddress: '10.42.0.18', device: 'Chrome on macOS',
    createdAt: minutesAgo(60),
  },
  {
    event: 'member.role_changed',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-2',
    target: { type: 'member', id: 'mem-5', name: 'Elif Kaya', email: 'elif@boyner.com.tr' },
    changes: { roleId: { before: 'developer', after: 'qa_lead' } },
    ipAddress: '10.42.0.31', device: 'Firefox on Windows',
    createdAt: minutesAgo(720),
  },
  {
    event: 'notification.endpoint_updated',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-4',
    target: { type: 'webhook', id: 'wh-1', name: 'Release alerts' },
    // The URL is a credential; the masker replaces it before it is stored, and
    // this seed shows what the reader will actually see.
    changes: { url: { before: '••••••••', after: '••••••••' } },
    metadata: { channel: 'slack', urlRotated: true },
    relations: { notificationChannel: 'slack' },
    ipAddress: '10.42.0.7', device: 'Chrome on macOS',
    createdAt: minutesAgo(70),
  },
  {
    event: 'member.approved',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-2',
    target: { type: 'member', id: 'mem-9', name: 'İrem Yıldız', email: 'irem@boyner.com.tr' },
    changes: { status: { before: 'pending', after: 'approved' } },
    ipAddress: '10.42.0.31', device: 'Firefox on Windows',
    createdAt: minutesAgo(120),
  },
  {
    event: 'auth.login_failed',
    organizationId: 'org-1',
    actorId: 'mem-6',
    status: 'failed',
    ipAddress: '203.0.113.44', device: 'curl',
    source: 'api',
    createdAt: minutesAgo(95),
  },
  {
    event: 'authz.permission_denied',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-7',
    status: 'denied',
    metadata: { permission: 'billing.read', path: '/api/billing' },
    ipAddress: '10.42.0.55', device: 'Chrome on Linux',
    createdAt: minutesAgo(150),
  },
  {
    event: 'team.created',
    organizationId: 'org-1', workspaceId: 'ws-2', workspaceName: 'Mobile',
    actorId: 'mem-1',
    target: { type: 'team', id: 'team-5', name: 'Mobile Team' },
    ipAddress: '10.42.0.18', device: 'Chrome on macOS',
    createdAt: minutesAgo(360),
  },
  {
    event: 'integration.connected',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-4',
    target: { type: 'integration', id: 'jira', name: 'Jira Cloud' },
    changes: { enabled: { before: false, after: true } },
    ipAddress: '10.42.0.7', device: 'Chrome on macOS',
    createdAt: minutesAgo(1440),
  },
  {
    event: 'rule.created',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-3',
    target: { type: 'rule', id: 'rule-12', name: 'QA wait over 5 days' },
    relations: { ruleId: 'rule-12', ruleName: 'QA wait over 5 days' },
    ipAddress: '10.42.0.22', device: 'Safari on macOS',
    createdAt: minutesAgo(25),
  },
  {
    event: 'security.data_exported',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: 'mem-3',
    target: { type: 'release', id: 'r1', name: 'Platform v2.4' },
    metadata: { format: 'csv', rows: 812 },
    relations: { releaseId: 'r1', releaseName: 'Platform v2.4' },
    ipAddress: '10.42.0.22', device: 'Safari on macOS',
    createdAt: minutesAgo(2160),
  },
  {
    event: 'system.job_failed',
    organizationId: 'org-1', workspaceId: 'ws-1', workspaceName: 'Production',
    actorId: '',
    status: 'failed', source: 'scheduler',
    metadata: { job: 'jira.sync', error: 'credentials not configured' },
    createdAt: minutesAgo(45),
  },
]

// ─── Integrations ─────────────────────────────────────────────────────────────

export const seedIntegrations: Integration[] = [
  {
    id: 'int-1',
    workspaceId: 'ws-1',
    type: 'jira',
    name: 'Jira Cloud',
    enabled: true,
    config: { baseUrl: 'https://acme.atlassian.net', apiKey: '***' },
    lastSyncAt: new Date(Date.now() - 300000),
    createdAt: new Date('2025-02-01'),
  },
  {
    id: 'int-2',
    workspaceId: 'ws-1',
    type: 'slack',
    name: 'Slack Notifications',
    enabled: true,
    config: { webhookUrl: '***', channelId: 'C123456' },
    lastSyncAt: new Date(Date.now() - 600000),
    createdAt: new Date('2025-02-15'),
  },
  {
    id: 'int-3',
    workspaceId: 'ws-1',
    type: 'github',
    name: 'GitHub',
    enabled: false,
    config: { org: 'acme-org', apiKey: '***' },
    createdAt: new Date('2025-03-10'),
  },
]

// ─── Billing ──────────────────────────────────────────────────────────────────

export const seedBilling: BillingInfo = {
  workspaceId: 'ws-1',
  plan: 'pro',
  status: 'active',
  currentPeriodStart: new Date('2026-06-25'),
  currentPeriodEnd: new Date('2026-07-25'),
  nextBillingDate: new Date('2026-07-25'),
  usage: {
    rules: 24,
    team: 4,
    storage: 42,
  },
}
