/**
 * The audit event catalogue.
 *
 * An audit log is not an activity feed. It exists to answer, months later and
 * under scrutiny: who changed what, when, from where, and to what value. That
 * makes the event identity itself part of the record — "member.role_changed" is
 * a fact a compliance reviewer can filter on and reason about, where
 * "updated a member" is prose that has to be re-read and interpreted.
 *
 * So every write names an event from this catalogue, and the catalogue — not
 * the call site — decides its category and severity. Two consequences worth
 * stating: severity cannot drift between call sites for the same event, and
 * adding an event is a deliberate act rather than a free-text string.
 */

export const AUDIT_CATEGORIES = [
  'authentication',
  'authorization',
  'members',
  'workspace',
  'teams',
  'rules',
  'notifications',
  'integrations',
  'release',
  'sprint',
  'qa',
  'billing',
  'api',
  'security',
  'system',
] as const

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

/**
 * Severity is about consequence, not about whether the action succeeded.
 * A failed login is `warning` because a burst of them is an attack; a
 * successful permission grant is `critical` because it is the change an
 * investigator will look for first.
 */
export const AUDIT_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number]

/** Whether the attempt did what it set out to do. Orthogonal to severity. */
export const AUDIT_STATUSES = ['success', 'failed', 'denied', 'cancelled'] as const
export type AuditStatus = (typeof AUDIT_STATUSES)[number]

/** Where the change entered the system. "Who" is not enough on its own. */
export const AUDIT_SOURCES = [
  'dashboard',
  'api',
  'cli',
  'webhook',
  'automation',
  'scheduler',
  'system',
] as const
export type AuditSource = (typeof AUDIT_SOURCES)[number]

export interface AuditEventDefinition {
  label: string
  category: AuditCategory
  severity: AuditSeverity
  /**
   * Security-relevant events, surfaced by the "security events only" filter and
   * hidden from roles that may not see security detail. Being able to read that
   * a permission changed is itself a privilege.
   */
  security?: boolean
}

export const AUDIT_EVENTS = {
  // ─── Authentication ─────────────────────────────────────────────────────────
  'auth.login':            { label: 'User signed in',        category: 'authentication', severity: 'info' },
  'auth.login_failed':     { label: 'Failed sign-in',        category: 'authentication', severity: 'warning', security: true },
  'auth.login_blocked':    { label: 'Sign-in rate limited',  category: 'authentication', severity: 'warning', security: true },
  'auth.logout':           { label: 'User signed out',       category: 'authentication', severity: 'info' },
  'auth.password_changed': { label: 'Password changed',      category: 'authentication', severity: 'warning', security: true },
  'auth.password_reset':   { label: 'Password reset',        category: 'authentication', severity: 'warning', security: true },
  'auth.email_changed':    { label: 'Email changed',         category: 'authentication', severity: 'warning', security: true },
  'auth.mfa_enabled':      { label: 'MFA enabled',           category: 'authentication', severity: 'success', security: true },
  'auth.mfa_disabled':     { label: 'MFA disabled',          category: 'authentication', severity: 'critical', security: true },

  // ─── Authorization ──────────────────────────────────────────────────────────
  'authz.permission_denied': { label: 'Permission denied',   category: 'authorization', severity: 'warning', security: true },
  'authz.role_created':      { label: 'Role created',        category: 'authorization', severity: 'critical', security: true },
  'authz.role_updated':      { label: 'Role permissions changed', category: 'authorization', severity: 'critical', security: true },
  'authz.role_deleted':      { label: 'Role deleted',        category: 'authorization', severity: 'critical', security: true },

  // ─── Members ────────────────────────────────────────────────────────────────
  'member.invited':      { label: 'Member invited',      category: 'members', severity: 'info' },
  'member.invite_resent':{ label: 'Invitation resent',   category: 'members', severity: 'info' },
  'member.invite_revoked':{ label: 'Invitation revoked', category: 'members', severity: 'warning' },
  'member.accepted':     { label: 'Invitation accepted', category: 'members', severity: 'success' },
  'member.approved':     { label: 'Member approved',     category: 'members', severity: 'success' },
  'member.rejected':     { label: 'Member rejected',     category: 'members', severity: 'warning' },
  'member.suspended':    { label: 'Member suspended',    category: 'members', severity: 'critical', security: true },
  'member.activated':    { label: 'Member reactivated',  category: 'members', severity: 'warning', security: true },
  'member.removed':      { label: 'Member removed',      category: 'members', severity: 'critical', security: true },
  'member.role_changed': { label: 'Member role changed', category: 'members', severity: 'critical', security: true },
  'member.updated':      { label: 'Member updated',      category: 'members', severity: 'info' },

  // ─── Workspace ──────────────────────────────────────────────────────────────
  'workspace.created':  { label: 'Workspace created',   category: 'workspace', severity: 'success' },
  'workspace.updated':  { label: 'Workspace updated',   category: 'workspace', severity: 'warning' },
  'workspace.archived': { label: 'Workspace archived',  category: 'workspace', severity: 'critical' },
  'workspace.deleted':  { label: 'Workspace deleted',   category: 'workspace', severity: 'critical', security: true },

  // ─── Teams ──────────────────────────────────────────────────────────────────
  'team.created':          { label: 'Team created',          category: 'teams', severity: 'success' },
  'team.updated':          { label: 'Team updated',          category: 'teams', severity: 'info' },
  'team.deleted':          { label: 'Team deleted',          category: 'teams', severity: 'warning' },
  'team.members_changed':  { label: 'Team members changed',  category: 'teams', severity: 'info' },
  'team.lead_changed':     { label: 'Team lead changed',     category: 'teams', severity: 'warning' },

  // ─── Rules ──────────────────────────────────────────────────────────────────
  'rule.created':    { label: 'Rule created',    category: 'rules', severity: 'warning' },
  'rule.updated':    { label: 'Rule updated',    category: 'rules', severity: 'warning' },
  'rule.enabled':    { label: 'Rule enabled',    category: 'rules', severity: 'warning' },
  'rule.disabled':   { label: 'Rule disabled',   category: 'rules', severity: 'critical' },
  'rule.deleted':    { label: 'Rule deleted',    category: 'rules', severity: 'critical' },
  'rule.duplicated': { label: 'Rule duplicated', category: 'rules', severity: 'info' },

  // ─── Notifications ──────────────────────────────────────────────────────────
  'notification.endpoint_created': { label: 'Notification destination added',   category: 'notifications', severity: 'warning', security: true },
  'notification.endpoint_updated': { label: 'Notification destination updated', category: 'notifications', severity: 'warning', security: true },
  'notification.endpoint_deleted': { label: 'Notification destination removed', category: 'notifications', severity: 'warning', security: true },
  'notification.delivered':        { label: 'Notification delivered',           category: 'notifications', severity: 'info' },
  'notification.failed':           { label: 'Notification delivery failed',     category: 'notifications', severity: 'warning' },
  'notification.retried':          { label: 'Notification retried',             category: 'notifications', severity: 'info' },

  // ─── Integrations ───────────────────────────────────────────────────────────
  'integration.connected':    { label: 'Integration connected',    category: 'integrations', severity: 'warning', security: true },
  'integration.disconnected': { label: 'Integration disconnected', category: 'integrations', severity: 'critical', security: true },
  'integration.updated':      { label: 'Integration updated',      category: 'integrations', severity: 'warning', security: true },
  'integration.sync_started': { label: 'Sync started',             category: 'integrations', severity: 'info' },
  'integration.sync_failed':  { label: 'Sync failed',              category: 'integrations', severity: 'warning' },

  // ─── Release ────────────────────────────────────────────────────────────────
  'release.created':     { label: 'Release created',     category: 'release', severity: 'info' },
  'release.started':     { label: 'Release started',     category: 'release', severity: 'warning' },
  'release.approved':    { label: 'Release approved',    category: 'release', severity: 'critical', security: true },
  'release.rejected':    { label: 'Release rejected',    category: 'release', severity: 'warning' },
  'release.published':   { label: 'Release published',   category: 'release', severity: 'critical' },
  'release.rolled_back': { label: 'Release rolled back', category: 'release', severity: 'critical' },
  'release.gate_overridden': { label: 'Release gate overridden', category: 'release', severity: 'critical', security: true },

  // ─── Sprint & QA ────────────────────────────────────────────────────────────
  'sprint.started':   { label: 'Sprint started',   category: 'sprint', severity: 'info' },
  'sprint.closed':    { label: 'Sprint closed',    category: 'sprint', severity: 'info' },
  'qa.item_assigned': { label: 'QA item assigned', category: 'qa', severity: 'info' },
  'qa.item_reopened': { label: 'QA item reopened', category: 'qa', severity: 'warning' },

  // ─── Billing ────────────────────────────────────────────────────────────────
  'billing.plan_changed':    { label: 'Plan changed',           category: 'billing', severity: 'critical' },
  'billing.payment_method_changed': { label: 'Payment method changed', category: 'billing', severity: 'critical', security: true },
  'billing.invoice_paid':    { label: 'Invoice paid',           category: 'billing', severity: 'success' },
  'billing.payment_failed':  { label: 'Payment failed',         category: 'billing', severity: 'warning' },

  // ─── API & security ─────────────────────────────────────────────────────────
  'api.key_created':      { label: 'API key created',      category: 'api', severity: 'critical', security: true },
  'api.key_revoked':      { label: 'API key revoked',      category: 'api', severity: 'warning', security: true },
  'api.rate_limited':     { label: 'API rate limited',     category: 'api', severity: 'warning' },
  'security.sso_enabled':  { label: 'SSO enabled',         category: 'security', severity: 'critical', security: true },
  'security.sso_disabled': { label: 'SSO disabled',        category: 'security', severity: 'critical', security: true },
  'security.webhook_rotated': { label: 'Webhook secret rotated', category: 'security', severity: 'warning', security: true },
  'security.settings_changed': { label: 'Security settings changed', category: 'security', severity: 'critical', security: true },
  'security.data_exported': { label: 'Data exported',      category: 'security', severity: 'warning', security: true },

  // ─── System ─────────────────────────────────────────────────────────────────
  'system.job_run':      { label: 'Scheduled job ran',    category: 'system', severity: 'info' },
  'system.job_failed':   { label: 'Scheduled job failed', category: 'system', severity: 'warning' },
  'system.retention_purge': { label: 'Retention purge',   category: 'system', severity: 'info' },
} as const satisfies Record<string, AuditEventDefinition>

export type AuditEventId = keyof typeof AUDIT_EVENTS

/**
 * Definition for an event id.
 *
 * An unknown id — a record written by a newer version, or by hand — resolves to
 * a `system`/`warning` placeholder rather than throwing. An audit log that
 * cannot render one of its own rows is worse than one showing a row it does not
 * fully understand, because the reader is left unaware the record exists.
 */
export function auditEvent(id: string): AuditEventDefinition & { id: string; known: boolean } {
  const definition = (AUDIT_EVENTS as Record<string, AuditEventDefinition>)[id]
  if (definition) return { id, known: true, ...definition }
  return { id, known: false, label: id, category: 'system', severity: 'warning' }
}

export const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  info: 0, success: 1, warning: 2, critical: 3,
}

/** Events a "security events only" filter should return. */
export function isSecurityEvent(id: string): boolean {
  return auditEvent(id).security === true
}
