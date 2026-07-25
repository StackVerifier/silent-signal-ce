# Data storage

Two SQLite databases, with different lifecycles. Keeping them apart is what
makes SQLite viable here at all.

| File | Written at runtime | Committed | Purpose |
|---|---|---|---|
| `data/help.db` | No | Yes | Help centre content, opened read-only |
| `data/silent-signal.db` | **Yes** | No | Members, teams, invitations, webhooks, notifications, audit, delivery data |

## The serverless caveat, stated plainly

`data/silent-signal.db` persists wherever the filesystem persists: `pnpm dev`,
`pnpm start`, Docker, a VM. It does **not** persist on serverless platforms
(including Vercel), because each instance gets a fresh ephemeral disk and
instances do not share one. On Vercel, expect writes to survive a request and
then vanish.

`data/help.db` is unaffected: it is read-only and ships with the deployment.

Moving to a hosted database is a change to `lib/db/app.ts` and the repositories
in `lib/db/repositories.ts`. Nothing above that layer — route handlers,
services, hooks, components — refers to SQLite, so the swap does not reach them.
`docs/rbac-architecture.md` carries the PostgreSQL schema this one mirrors.

## Seeding

```bash
pnpm db:seed     # create both databases if missing; never overwrites app data
pnpm db:reset    # rebuild the application database from seed content (destructive)
```

`predev` and `prebuild` run the seed, so a fresh clone works with no extra step.
The app seed refuses to touch an existing database without `--force`: once the
app is running that file holds real state, and a silent re-seed would discard
members, teams and webhooks someone configured.

Source of truth for seed content is `db/content/seed-tenancy.ts` and
`db/content/seed-delivery.ts` — TypeScript, so changes are reviewable in a diff.

## Credentials at rest

Webhook URLs are bearer credentials: anyone holding one can post as the app.
They are encrypted with AES-256-GCM before being stored, and no read endpoint
ever returns one — the browser only receives `urlHint`, a masked preview like
`hooks.slack.com/…/abcd••••••••`.

Key resolution, in order:

1. `ENCRYPTION_KEY` — 32 bytes, base64 or hex. **Use this in production.**
2. `SESSION_SECRET` — derived via SHA-256, for deployments that already set one.
3. `data/.encryption-key` — generated on first use, mode 0600, git-ignored.
   Local development only; it keeps `pnpm dev` working without configuration
   and is obviously not a secret-management strategy.

Rotating the key makes existing rows undecryptable. `webhookRepo.getUrl()`
returns `null` rather than throwing, so the UI reports the destination as
failing and asks for the URL again instead of the page breaking.

## Transactions

Every mutation that also writes an audit record does both inside one
transaction (`lib/db/app.ts:transaction`). An action must not be able to
succeed while leaving no trace of who performed it — the activity feed and the
compliance record are the same rows, so they cannot disagree.

## What is stored where

- **Relational**: organizations, workspaces, members, teams, invitations,
  integrations, webhooks, notifications, audit, rules. These are queried and
  filtered, so they get columns and indexes.
- **JSON columns**: a sprint's issues, a release's gates, a rule's conditions.
  Jira owns their shape and nothing queries into them; modelling them
  relationally now would be premature.
