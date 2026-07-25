import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getJobHistory, getJobStatus, runDueJobs, runJob } from '@/lib/scheduler/runner'

/**
 * Cron trigger.
 *
 * Production driver: one scheduled caller (Vercel Cron via vercel.json, or any
 * external scheduler) hits this endpoint. The runner's due-time gate makes the
 * call idempotent, so an at-least-once scheduler that fires twice still runs
 * each job once.
 *
 * Authorization is a bearer secret rather than a session: the caller is a
 * machine. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // Without a configured secret the endpoint stays local-only, so a missing
  // env var cannot silently expose job execution in production.
  if (!secret) return process.env.NODE_ENV !== 'production'
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = request.nextUrl.searchParams.get('job')

  if (jobId) {
    try {
      const run = await runJob(jobId, { trigger: 'manual', force: true })
      return NextResponse.json({ runs: [run] })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown job' },
        { status: 404 },
      )
    }
  }

  const runs = await runDueJobs('cron')
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    executed: runs.filter((run) => run.status !== 'skipped').length,
    skipped: runs.filter((run) => run.status === 'skipped').length,
    runs,
  })
}

/** Status view for the admin UI — never executes anything. */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ jobs: getJobStatus(), history: getJobHistory() })
}
