# Data storage

## Choosing a database

`DATABASE_URL` decides, and nothing else changes:

```bash
# .env.local — unset: local SQLite, nothing to install
# DATABASE_URL=

# set: Postgres, and the SQLite file is not touched
DATABASE_URL=postgres://user:password@localhost:5432/silentsignal
```

`lib/db/driver.ts` is the only module that knows which is in play. Repositories
issue the same SQL either way; `?` placeholders are rewritten to `$1, $2, …`
for Postgres, and the two dialect differences that matter — `INSERT OR IGNORE`
→ `ON CONFLICT DO NOTHING`, and integer-vs-boolean parameters — are handled
there too.

Both schemas live side by side and are applied on first connection:
`db/app-schema.sql` and `db/app-schema.postgres.sql`. The Postgres one differs
only where Postgres requires it: real `BOOLEAN` and `TIMESTAMPTZ`, `BIGSERIAL`
for the audit id. Table and column names are identical.

`pnpm db:seed` seeds whichever database `DATABASE_URL` selects.

### The `pg` package is loaded, not bundled

The Postgres driver sits behind a dynamic `import('pg')` that only runs when
`DATABASE_URL` is set — but a bundler resolves that specifier at build time
regardless of whether the branch is ever taken. A SQLite-only deployment
therefore failed to build with `Module not found: Can't resolve 'pg'` whenever
the package was missing from `node_modules`, despite never touching it.

`serverExternalPackages: ['pg']` in `next.config.mjs` moves the resolution to
the moment it is actually used. If the package really is absent when Postgres
is selected, the failure says so and names the fix rather than surfacing a bare
`MODULE_NOT_FOUND`.

## Two databases, different lifecycles

| Store | Written at runtime | Committed | Purpose |
|---|---|---|---|
| `data/help.db` (always SQLite) | No | Yes | Help centre content, opened read-only |
| Application database | **Yes** | No | Members, teams, invitations, webhooks, notifications, audit, delivery data |

## The serverless caveat, stated plainly

`data/silent-signal.db` persists wherever the filesystem persists: `pnpm dev`,
`pnpm start`, Docker, a VM. It does **not** persist on serverless platforms
(including Vercel), because each instance gets a fresh ephemeral disk and
instances do not share one. On Vercel, expect writes to survive a request and
then vanish.

`data/help.db` is unaffected: it is read-only and ships with the deployment.

Point `DATABASE_URL` at a hosted Postgres and the caveat disappears — that is
the supported path for any deployment that needs data to survive.

## Passwords

Hashed with scrypt (`lib/auth/password.ts`), which is memory-hard and ships in
Node's standard library — no native module to compile and nothing to keep
patched. The stored format is `scrypt$N$r$p$salt$hash`; parameters travel with
the hash, so the cost can be raised later without invalidating existing
passwords, and `needsRehash()` upgrades one transparently at next sign-in.

Login hashes even when the account does not exist, so response time does not
reveal which addresses are registered, and both failure modes return the same
message.

The seeded administrator is flagged `must_change_password`, which puts an
unmissable banner in the app until a real password is set.

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
