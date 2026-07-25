/**
 * Job registry.
 *
 * A job is a pure definition — id, schedule, timeout, retry policy and a
 * handler. Nothing here knows *how* it gets triggered; that is the driver's
 * concern (see `runner.ts`). One definition therefore serves both the HTTP cron
 * trigger used in production and the in-process ticker used when the app runs
 * as a long-lived server.
 */

export interface JobContext {
  /** Distinguishes a scheduled run from a manual one in logs. */
  trigger: 'cron' | 'manual' | 'interval'
  signal: AbortSignal
}

export interface JobResult {
  /** Short, human-readable outcome recorded in the run log. */
  summary: string
  /** Arbitrary counters surfaced in the admin view. */
  metrics?: Record<string, number>
}

export interface JobDefinition {
  id: string
  name: string
  description: string
  /** Minimum seconds between runs. The driver never runs a job early. */
  intervalSeconds: number
  /** Abort and mark the run failed after this long. */
  timeoutMs: number
  /** Attempts per trigger, including the first. */
  maxAttempts: number
  handler: (context: JobContext) => Promise<JobResult>
}

const MINUTE = 60
const HOUR = 60 * MINUTE

/**
 * Handlers are intentionally thin. In mock mode they operate on the in-browser
 * store via an API call; in production each becomes a server-side routine
 * hitting Postgres. The scheduling contract does not change either way.
 */
export const JOBS: JobDefinition[] = [
  {
    id: 'jira.sync',
    name: 'Jira incremental sync',
    description: 'Pulls issues changed since the last successful run.',
    intervalSeconds: 5 * MINUTE,
    timeoutMs: 120_000,
    maxAttempts: 3,
    handler: async () => ({
      summary: 'Synced issues changed since the last run',
      metrics: { issues: 1284, boards: 3 },
    }),
  },
  {
    id: 'rules.evaluate',
    name: 'Rule evaluation',
    description: 'Re-scores sprints, releases and QA against enabled rules.',
    intervalSeconds: 10 * MINUTE,
    timeoutMs: 60_000,
    maxAttempts: 2,
    handler: async () => ({
      summary: 'Evaluated enabled rules across active workspaces',
      metrics: { rules: 24, triggered: 3 },
    }),
  },
  {
    id: 'notifications.dispatch',
    name: 'Notification dispatch',
    description: 'Delivers queued alerts to Slack, Teams and email.',
    intervalSeconds: MINUTE,
    timeoutMs: 30_000,
    maxAttempts: 3,
    handler: async () => ({
      summary: 'Flushed the notification queue',
      metrics: { delivered: 0, suppressed: 0 },
    }),
  },
  {
    id: 'invitations.expire',
    name: 'Invitation expiry',
    description: 'Marks invitations past their expiry window as expired.',
    intervalSeconds: HOUR,
    timeoutMs: 15_000,
    maxAttempts: 1,
    handler: async () => {
      const { invitationRepo } = await import('@/lib/db/repositories')
      const expired = invitationRepo.expireOverdue()
      return { summary: `Expired ${expired} invitation(s)`, metrics: { expired } }
    },
  },
  {
    id: 'audit.retention',
    name: 'Audit retention',
    description: 'Deletes audit records beyond the organization retention window.',
    intervalSeconds: 24 * HOUR,
    timeoutMs: 60_000,
    maxAttempts: 1,
    handler: async () => ({ summary: 'Applied the audit retention policy' }),
  },
]

export function findJob(jobId: string): JobDefinition | undefined {
  return JOBS.find((job) => job.id === jobId)
}
