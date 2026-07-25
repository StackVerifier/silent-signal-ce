import { runDueJobs } from './runner'

/**
 * In-process ticker for long-lived deployments (`next start`, Docker, a VM).
 *
 * Serverless platforms recycle instances between requests, so an interval there
 * is unreliable — that is why production on Vercel uses the HTTP cron trigger
 * instead, and why this driver is opt-in via SCHEDULER_IN_PROCESS=true.
 *
 * The module-level guard matters: Next.js can evaluate a module more than once
 * (dev HMR, multiple entrypoints), and without it every reload would add
 * another interval on top of the last.
 */
const GLOBAL_KEY = Symbol.for('silent-signal.scheduler.ticker')

type TickerGlobal = typeof globalThis & { [GLOBAL_KEY]?: NodeJS.Timeout }

const TICK_MS = 30_000

export function startScheduler(): void {
  if (typeof window !== 'undefined') return
  if (process.env.SCHEDULER_IN_PROCESS !== 'true') return

  const scope = globalThis as TickerGlobal
  if (scope[GLOBAL_KEY]) return

  const timer = setInterval(() => {
    // Each tick only runs jobs whose interval has elapsed, so a 30s tick does
    // not mean a 30s job cadence.
    void runDueJobs('interval').catch(() => {
      // Failures are already recorded in the run log; never crash the server.
    })
  }, TICK_MS)

  // Do not hold the process open on shutdown.
  timer.unref?.()
  scope[GLOBAL_KEY] = timer
}

export function stopScheduler(): void {
  const scope = globalThis as TickerGlobal
  if (scope[GLOBAL_KEY]) {
    clearInterval(scope[GLOBAL_KEY])
    delete scope[GLOBAL_KEY]
  }
}
