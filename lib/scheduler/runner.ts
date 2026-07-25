import { JOBS, findJob, type JobDefinition, type JobResult } from './jobs'

/**
 * Scheduler core — no Redis, no external queue.
 *
 * Three properties make it safe to run inside the application process:
 *
 *  1. **Overlap prevention.** A job holds an in-process lock for its duration;
 *     a second trigger while it is running is skipped, not queued. A slow Jira
 *     sync therefore cannot stack five deep behind a one-minute ticker.
 *  2. **Due-time gating.** A run only happens when `intervalSeconds` has
 *     elapsed since the last *start*. Triggering the endpoint twice in a minute
 *     runs the job once, which is what makes an at-least-once HTTP cron safe.
 *  3. **Bounded execution.** Every run is wrapped in a timeout and a retry
 *     budget with backoff, so a hung request cannot occupy the lock forever.
 *
 * The single-instance caveat is stated plainly: with several server instances
 * each keeps its own lock, so a job can run once per instance. That is why the
 * production driver is one HTTP cron trigger (a single caller), and why the
 * in-process ticker defaults to off unless explicitly enabled. Promoting this
 * to a true distributed lock means one change — a Postgres advisory lock in
 * `acquire()` — and nothing else in this file moves.
 */

export interface JobRun {
  jobId: string
  startedAt: Date
  finishedAt?: Date
  durationMs?: number
  status: 'running' | 'success' | 'failed' | 'skipped'
  trigger: 'cron' | 'manual' | 'interval'
  attempts: number
  summary?: string
  error?: string
  metrics?: Record<string, number>
}

interface JobState {
  running: boolean
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastStatus: JobRun['status'] | null
  consecutiveFailures: number
}

const MAX_HISTORY = 50

const state = new Map<string, JobState>()
const history: JobRun[] = []

function stateFor(jobId: string): JobState {
  let existing = state.get(jobId)
  if (!existing) {
    existing = {
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastStatus: null,
      consecutiveFailures: 0,
    }
    state.set(jobId, existing)
  }
  return existing
}

function record(run: JobRun) {
  history.unshift(run)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
}

export function isDue(job: JobDefinition, now = Date.now()): boolean {
  const current = stateFor(job.id)
  if (current.running) return false
  if (current.lastStartedAt === null) return true
  return now - current.lastStartedAt >= job.intervalSeconds * 1000
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withTimeout(job: JobDefinition, trigger: JobRun['trigger']): Promise<JobResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), job.timeoutMs)
  try {
    return await job.handler({ trigger, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Runs a single job if it is due. `force` bypasses the due check (manual run)
 * but never the lock — a manual trigger must not overlap a scheduled one.
 */
export async function runJob(
  jobId: string,
  options: { trigger?: JobRun['trigger']; force?: boolean } = {},
): Promise<JobRun> {
  const { trigger = 'cron', force = false } = options
  const job = findJob(jobId)
  if (!job) throw new Error(`Unknown job: ${jobId}`)

  const current = stateFor(job.id)

  if (current.running) {
    const skipped: JobRun = {
      jobId: job.id, startedAt: new Date(), status: 'skipped', trigger, attempts: 0,
      summary: 'Previous run still in progress',
    }
    record(skipped)
    return skipped
  }

  if (!force && !isDue(job)) {
    const skipped: JobRun = {
      jobId: job.id, startedAt: new Date(), status: 'skipped', trigger, attempts: 0,
      summary: 'Not due yet',
    }
    record(skipped)
    return skipped
  }

  current.running = true
  current.lastStartedAt = Date.now()

  const run: JobRun = {
    jobId: job.id,
    startedAt: new Date(current.lastStartedAt),
    status: 'running',
    trigger,
    attempts: 0,
  }

  try {
    let lastError: unknown
    for (let attempt = 1; attempt <= job.maxAttempts; attempt += 1) {
      run.attempts = attempt
      try {
        const result = await withTimeout(job, trigger)
        run.status = 'success'
        run.summary = result.summary
        run.metrics = result.metrics
        current.consecutiveFailures = 0
        break
      } catch (error) {
        lastError = error
        if (attempt < job.maxAttempts) await sleep(2 ** attempt * 500)
      }
    }

    if (run.status !== 'success') {
      run.status = 'failed'
      run.error = lastError instanceof Error ? lastError.message : String(lastError)
      current.consecutiveFailures += 1
    }
  } finally {
    const finishedAt = Date.now()
    current.running = false
    current.lastFinishedAt = finishedAt
    current.lastStatus = run.status
    run.finishedAt = new Date(finishedAt)
    run.durationMs = finishedAt - (current.lastStartedAt ?? finishedAt)
    record(run)
  }

  return run
}

/** Runs every job that is due. This is what the cron endpoint calls. */
export async function runDueJobs(trigger: JobRun['trigger'] = 'cron'): Promise<JobRun[]> {
  const due = JOBS.filter((job) => isDue(job))
  // Sequential on purpose: parallel runs would multiply peak load against the
  // same rate-limited Jira tenant.
  const runs: JobRun[] = []
  for (const job of due) {
    runs.push(await runJob(job.id, { trigger }))
  }
  return runs
}

export function getJobStatus() {
  return JOBS.map((job) => {
    const current = stateFor(job.id)
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      intervalSeconds: job.intervalSeconds,
      running: current.running,
      lastStartedAt: current.lastStartedAt ? new Date(current.lastStartedAt) : null,
      lastFinishedAt: current.lastFinishedAt ? new Date(current.lastFinishedAt) : null,
      lastStatus: current.lastStatus,
      consecutiveFailures: current.consecutiveFailures,
      nextDueAt: current.lastStartedAt
        ? new Date(current.lastStartedAt + job.intervalSeconds * 1000)
        : null,
    }
  })
}

export function getJobHistory(limit = 20): JobRun[] {
  return history.slice(0, limit)
}
