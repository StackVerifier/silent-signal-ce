# Scheduler

Background jobs without Redis, without an external queue, running inside the
Next.js application.

## Why it is shaped this way

A bare `setInterval` in a Next.js app is not stable in production: serverless
instances are recycled between requests, so the interval simply stops, and with
several instances every one of them fires the same job. The design therefore
separates **what a job is** from **what triggers it**:

```
lib/scheduler/jobs.ts     definitions   — id, interval, timeout, retries, handler
lib/scheduler/runner.ts   execution     — due-time gate, lock, timeout, retries, run log
lib/scheduler/ticker.ts   driver A      — in-process interval (long-lived servers)
app/api/cron/route.ts     driver B      — HTTP trigger (serverless / Vercel Cron)
```

One definition, two drivers. Swapping drivers changes no job code.

## Safety properties

| Property | Mechanism |
|---|---|
| No overlapping runs | A job holds a lock for its duration; a trigger during a run is **skipped, not queued**, so a slow Jira sync cannot stack behind a fast ticker. |
| Idempotent triggers | A run only starts when `intervalSeconds` has elapsed since the last start. An at-least-once scheduler firing twice a minute still runs each job once. |
| Bounded execution | Every run is wrapped in `timeoutMs` via `AbortSignal`, so a hung HTTP call cannot hold the lock forever. |
| Bounded retries | `maxAttempts` with exponential backoff, per trigger. |
| Observability | The last 50 runs are kept with status, duration, attempts, summary and error. |
| Fail-safe auth | `/api/cron` refuses every request in production when `CRON_SECRET` is unset — a missing env var cannot silently expose job execution. |

## Deployment

**Vercel (current).** `vercel.json` registers a one-minute cron against
`/api/cron`. Vercel sends `Authorization: Bearer $CRON_SECRET`. The endpoint
runs only the jobs that are due, so the minute-by-minute call is cheap:

```json
{ "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
```

**Long-lived server** (`next start`, Docker, a VM). Set
`SCHEDULER_IN_PROCESS=true` and the ticker takes over — no external scheduler
needed. A module-level guard keyed on a global symbol prevents duplicate
intervals across HMR reloads and multiple entrypoints.

Do not enable both drivers against the same deployment. It is not harmful — the
due-time gate absorbs the extra triggers — but it makes the run log confusing.

## Jobs

| Job | Interval | Purpose |
|---|---|---|
| `jira.sync` | 5 min | Pull issues changed since the last successful run |
| `rules.evaluate` | 10 min | Re-score sprints, releases and QA against enabled rules |
| `notifications.dispatch` | 1 min | Deliver queued alerts to Slack, Teams, email |
| `invitations.expire` | 1 hour | Expire invitations past their window |
| `audit.retention` | 24 hours | Apply the organization retention policy |

Jobs run **sequentially**, not in parallel: running them together would multiply
peak load against the same rate-limited Jira tenant.

## Operating it

```bash
# Run everything that is due
curl -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron

# Force one job, ignoring its schedule (still respects the lock)
curl -H "Authorization: Bearer $CRON_SECRET" 'https://app.example.com/api/cron?job=jira.sync'

# Status and run history, executes nothing
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron
```

## The multi-instance caveat, stated plainly

Locks and run history live in process memory. With several instances behind a
load balancer, each keeps its own lock, so a job can run once per instance. Two
things make that acceptable today: the production driver is a single HTTP caller,
and the in-process ticker is opt-in.

When horizontal scaling arrives, this becomes a one-function change — take a
Postgres advisory lock in `runJob()`:

```sql
SELECT pg_try_advisory_lock(hashtext('job:' || $1));
```

and persist `JobRun` to a `job_run` table instead of the in-memory ring buffer.
Nothing else in the scheduler moves, and no job handler changes.
