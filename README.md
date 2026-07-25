# Silent Signal

Release intelligence for Jira-driven delivery. Rule-based risk scoring — no model, no inference: every score decomposes into the rules that produced it.

## Running it

Requires **Node 22+** (the help database uses Node's built-in `node:sqlite`) and **pnpm**.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. You will land on the login screen.

`predev` builds the help database first, so a fresh clone works with no extra step and editing help content is reflected on the next `pnpm dev`.

### Sign in

The app ships with demo accounts — the login screen offers one-click role switching. Password is `admin123` for all of them.

| Account | Role | Use it to see |
|---|---|---|
| `alice@boyner.com.tr` | Organization Owner | Everything, including billing |
| `bora@boyner.com.tr` | Organization Admin | People and integrations, no billing |
| `cem@boyner.com.tr` | Release Manager | Release, rules, QA queue |
| `deniz@boyner.com.tr` | QA Lead | QA queue; read-only rules |
| `irem@boyner.com.tr` | Viewer | Read-only dashboards, no QA queue |
| `faruk@boyner.com.tr` | Pending | The locked, skeleton-only experience |
| `hakan@boyner.com.tr` | Suspended | The account-suspended screen |

> Authentication is mock: credentials are checked in the browser and the session cookie is not `httpOnly`. Fine for a demo, not for real users. `SessionClaims` is already shaped as the JWT payload, so moving to server-issued sessions does not change middleware or the guards.

## All commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server, seeds the help database first |
| `pnpm build` | Production build, seeds the help database first |
| `pnpm start` | Serve a production build |
| `pnpm db:seed` | Rebuild `data/help.db` from `db/content/help.ts` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

### Exercising the scheduler

Background jobs run on an HTTP trigger. In development no `CRON_SECRET` is needed:

```bash
curl localhost:3000/api/cron                    # run everything that is due
curl 'localhost:3000/api/cron?job=jira.sync'    # force one job
curl -X POST localhost:3000/api/cron            # status and run history
```

In production the endpoint refuses every request unless `CRON_SECRET` is set — a missing environment variable cannot silently expose job execution.

## Configuration

Copy `.env.example` to `.env.local` and fill in what you need. Nothing is required to run the demo: `NEXT_PUBLIC_API_MODE` defaults to `mock`, which resolves every service from in-memory fixtures.

Anything prefixed `NEXT_PUBLIC_` is inlined into the browser bundle, so credentials never carry that prefix — they are read server-side through `serverEnv()`.

## How it is put together

```
app/                 routes; (dashboard) and (settings) share one AppShell
components/          UI, split by feature (rbac, members, teams, help, layout)
lib/rbac/            permissions, roles, access engine, navigation registry
lib/query/           TanStack Query client, key registry, hooks
lib/db/              read-only SQLite access for help content
services/            one module per domain, all behind a single transport
db/content/          help centre content — source of truth for data/help.db
scripts/             build-time seeding
docs/                architecture notes
```

Three ideas carry most of the design:

**Permissions, not roles.** A role is only a bundle of permissions, and no screen branches on a role name. That is what lets a customer define their own roles without a product change.

**One seam for data.** Every service call goes through `services/transport.ts`, which either resolves a fixture or issues the HTTP request depending on `NEXT_PUBLIC_API_MODE`. Components cannot tell the difference, so going live is a configuration change rather than a refactor.

**Status outranks permission.** A pending member keeps their granted permissions on paper but resolves to an empty effective set, so they see the whole product rendered as skeletons and no data path can leak.

## Documentation

- [`docs/rbac-architecture.md`](docs/rbac-architecture.md) — tenancy model, PostgreSQL schema with row-level security, API contracts, SSO/SCIM readiness
- [`docs/scheduler.md`](docs/scheduler.md) — job definitions, the two drivers, and why it is safe without Redis
- [`AUDIT.md`](AUDIT.md) — the technical audit this work started from

## Current limitations

- **Auth and tenant data are mock.** Members, teams and invitations live in a browser-backed store; they survive a reload, not a different browser.
- **Mutations are real but local.** `resolveMutation` is explicit that mock-mode writes do not reach a server.
- **Billing and support forms are inert.** Both need a real backend, and wiring them to fixtures would be theatre.
