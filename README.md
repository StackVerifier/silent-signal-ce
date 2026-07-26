# Silent Signal

Release intelligence for Jira-driven delivery. Rule-based risk scoring — no model, no inference: every score decomposes into the rules that produced it.

## Running it

Requires **Node 22+** (the help database uses Node's built-in `node:sqlite`) and **pnpm**.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. You will land on the login screen.

`predev` builds both databases first, so a fresh clone works with no extra step.

### Sign in

Sign in as the administrator:

| | |
|---|---|
| Email | `admin@silentsignal.local` |
| Password | `ChangeMe123!` |

The app insists you replace that password on first use — it is flagged as a
handed-out one, so a banner sits at the top until you change it.

There are also demo personas for seeing each role's view, password `admin123`:

| Account | Role | Use it to see |
|---|---|---|
| `alice@boyner.com.tr` | Organization Owner | Everything, including billing |
| `bora@boyner.com.tr` | Organization Admin | People and integrations, no billing |
| `cem@boyner.com.tr` | Release Manager | Release, rules, QA queue |
| `deniz@boyner.com.tr` | QA Lead | QA queue; read-only rules |
| `irem@boyner.com.tr` | Viewer | Read-only dashboards, no QA queue |
| `faruk@boyner.com.tr` | Pending | The locked, skeleton-only experience |
| `hakan@boyner.com.tr` | Suspended | The account-suspended screen |

> Sessions are issued server-side, the cookie is `httpOnly` and **HMAC-signed**, and role and status are re-read from the database on every request — so suspending someone takes effect immediately rather than when their cookie expires. Set `SESSION_SECRET` before deploying; production refuses to start a session without it.
>
> Passwords: passwords are verified against a stored scrypt hash, and the login endpoint is rate limited per account and per address. What is still missing is the surrounding lifecycle — email verification and password reset.

## All commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server, seeds both databases first |
| `pnpm build` | Production build, seeds both databases first |
| `pnpm start` | Serve a production build |
| `pnpm db:seed` | Create both databases if missing (never overwrites app data) |
| `pnpm db:reset` | Rebuild the application database from seed content (destructive) |
| `pnpm test` | Vitest, once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

CI runs all four gates — typecheck, lint, test, build — on every push and pull
request (`.github/workflows/ci.yml`).

### Dependency policy

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` — nothing published in the
last 24 hours is installed. A compromised publish is usually caught within
hours, so the wait removes most of that window at no real cost, and it keeps
the committed lockfile installable for anyone running the same policy.

Settings live in `pnpm-workspace.yaml`, not in a `pnpm` field in
`package.json`: pnpm 10 ignores that field silently, which is worse than not
setting it at all, because the lockfile then depends on who ran the install.

### Exercising the scheduler

Background jobs run on an HTTP trigger. In development no `CRON_SECRET` is needed:

```bash
curl localhost:3000/api/cron                    # run everything that is due
curl 'localhost:3000/api/cron?job=jira.sync'    # force one job
curl -X POST localhost:3000/api/cron            # status and run history
```

In production the endpoint refuses every request unless `CRON_SECRET` is set — a missing environment variable cannot silently expose job execution.

## Configuration

Copy `.env.example` to `.env.local` and fill in what you need. Nothing is required to run locally.

**Database.** Leave `DATABASE_URL` unset and the app uses a local SQLite file. Set it to a `postgres://` URL and it uses Postgres instead — no code change, and `pnpm db:seed` seeds whichever one is selected. See [`docs/database.md`](docs/database.md).

Anything prefixed `NEXT_PUBLIC_` is inlined into the browser bundle, so credentials never carry that prefix — they are read server-side through `serverEnv()`.

## How it is put together

```
app/                 routes; (dashboard) and (settings) share one AppShell
components/          UI, split by feature (rbac, members, teams, help, layout)
lib/rbac/            permissions, roles, access engine, navigation registry
lib/query/           TanStack Query client, key registry, hooks
lib/db/              driver (SQLite or Postgres), repositories, encryption
lib/audit/           event catalogue, masking, visibility, retention
lib/auth/            password hashing, login rate limiting
assets/fonts/        the Unicode typeface embedded into every PDF
lib/forms/           the Zod ↔ React Hook Form resolver
lib/reports/         PDF and Excel report generation
services/            one module per domain — thin HTTP clients
tests/               Vitest, on the logic where being wrong is expensive
app/api/             route handlers; the security boundary
db/content/          seed content and help articles
scripts/             seeding
docs/                architecture notes
```

Three ideas carry most of the design:

**Permissions, not roles.** A role is only a bundle of permissions, and no screen branches on a role name. That is what lets a customer define their own roles without a product change.

**One seam for storage.** `lib/db/driver.ts` is the only module that knows whether it is talking to SQLite or Postgres. Repositories issue the same SQL either way, so switching is an environment variable rather than a refactor.

**Status outranks permission.** A pending member keeps their granted permissions on paper but resolves to an empty effective set, so they see the whole product rendered as skeletons and no data path can leak.

## Documentation

- [`docs/rbac-architecture.md`](docs/rbac-architecture.md) — tenancy model, PostgreSQL schema with row-level security, API contracts, SSO/SCIM readiness
- [`docs/database.md`](docs/database.md) — SQLite vs Postgres, the serverless caveat, password hashing, credential encryption
- [`docs/scheduler.md`](docs/scheduler.md) — job definitions, the two drivers, and why it is safe without Redis
- [`AUDIT.md`](AUDIT.md) — the technical audit this work started from

## Current limitations

- **SQLite does not persist on serverless.** Use `DATABASE_URL` with a hosted Postgres for any deployment that needs data to survive. `docs/database.md` explains why.
- **Auth lifecycle is incomplete.** Passwords are hashed, sessions are server-issued and logins are rate limited, but there is no email verification or password reset yet — both need an email provider.
- **Rate limiting is per process.** One server counts exactly; behind several instances each counts separately, so the effective limit multiplies by the instance count. A shared store is the upgrade path, and `lib/auth/rate-limit.ts` says so at the top.
- **Jira sync is not implemented.** The integration connects and the endpoints exist; the sync itself returns an honest "credentials not configured" rather than inventing data.
- **Billing and support forms are inert.** Both need a real backend, and wiring them to fixtures would be theatre.
