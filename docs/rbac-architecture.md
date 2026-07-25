# RBAC & Multi-Tenancy Architecture

Reference for the authorization system implemented in `lib/rbac/*`. It documents
the model, the enforcement layers, the database schema the mock layer is shaped
against, the API contracts, and the scale/SSO considerations behind the design.

---

## 1. Tenancy model

```
Platform
└── Organization        (the customer, e.g. Boyner — the isolation boundary)
    └── Workspace       (a delivery domain, e.g. Production, E-Commerce)
        └── Team        (QA Team, Backend Team, Mobile Team)
            └── Member  (a person, with exactly one role in the organization)
```

**Organization is the isolation boundary.** Every tenant-scoped row carries
`organization_id`, and every query is filtered by it. A workspace never spans
organizations; a member never spans organizations (the same human in two
customers is two member rows, as in GitHub or Linear).

Membership is deliberately *flat within an organization*: one role, many
workspaces, many teams. Per-workspace role overrides were considered and
rejected for v1 — they multiply the permission-resolution cost per request and
are not required by the access matrix. The schema leaves room for them
(`member_workspace.role_id`, nullable) without a migration of existing rows.

---

## 2. Permissions and roles

Permissions are the atomic unit (`lib/rbac/permissions.ts`), named
`<resource>.<action>`: `release.approve`, `members.invite`, `audit.read`…

**Roles are only bundles of permissions** (`lib/rbac/roles.ts`). No application
code branches on a role name — it branches on permissions. That is what makes
customer-defined custom roles possible with zero code change: a custom role is
a row of permission strings evaluated by the same engine.

| Role | Tier | Shape |
|---|---|---|
| Platform Admin | 100 | All permissions, cross-organization (support) |
| Organization Owner | 90 | All permissions, bounded to one organization |
| Organization Admin | 80 | People, workspaces, integrations, audit. No billing |
| Release Manager | 60 | Release/rules/QA write, notifications routing |
| QA Lead | 50 | QA write, rules read, sprint write |
| Developer | 40 | Delivery read, sprint write, QA read |
| Viewer | 10 | Read-only; no QA queue, no rules |

`tier` drives *who may administer whom*: `canManageRole(actor, target)` requires
a strictly higher tier, so an admin cannot demote or remove a peer admin, and
`assignableRoles()` never offers a role at or above the actor's own.

### Adding a custom role

Insert a `role` row with `is_system = false`, `organization_id = <org>`, and its
`role_permission` rows. Nothing else changes: `resolveRole()` accepts the
organization's custom roles, and `RoleId` already models them as `custom:<uuid>`.

---

## 3. Account status

`pending · approved · suspended · rejected · deleted`

Status gates the **entire** effective permission set, independently of role
(`STATUS_GRANTS_DATA_ACCESS` in `lib/rbac/access.ts`):

| Status | Can sign in | Effective permissions | Experience |
|---|---|---|---|
| approved | yes | role's bundle | Full product |
| pending | yes | **none** | Whole app visible, every widget a skeleton, banner explains why |
| suspended | yes | none | Redirected to `/account-status`, no navigation |
| rejected | no | — | Login refused with an explanation |
| deleted | no | — | Login refused |

A pending member keeps their granted permissions "on paper"
(`AccessContext.grantedPermissions`) so the UI can explain what will unlock —
but `permissions` is empty, so no data path can leak.

---

## 4. Enforcement layers

Authorization is enforced three times, deliberately:

| Layer | File | Protects | Trust |
|---|---|---|---|
| Edge / navigation | `middleware.ts` | Route access, status routing | Not a security boundary — a client can call the API directly |
| Server / data | route handlers, server actions | Every read and write | **The** security boundary |
| Client / UI | `PermissionGuard`, `useAuth().can()` | Affordances: hide or disable what cannot be used | UX only |

The same pure functions (`can`, `canAny`, `canAll`, `assertPermission`) run in
all three, so a rule cannot drift between them.

Tenant isolation has its own guard, `assertSameOrganization()`, which throws
`TenantIsolationError` (surfacing as **404**, never 403 — a cross-tenant probe
must not confirm that a resource exists).

> **Current state.** The session is mock: credentials are checked client-side
> and the cookie is not httpOnly. `SessionClaims` is already the JWT payload
> shape, so productionizing means issuing/verifying it server-side — the
> middleware and guards do not change.

---

## 5. Database schema

PostgreSQL, with row-level security as the primary isolation guarantee.

```sql
create table organization (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              citext not null unique,
  plan              text not null default 'free',
  sso_enabled       boolean not null default false,
  sso_provider      text,
  verified_domains  text[] not null default '{}',
  settings          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create table workspace (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organization(id) on delete cascade,
  name             text not null,
  slug             citext not null,
  status           text not null default 'active',   -- active | archived
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

create table team (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organization(id) on delete cascade,
  workspace_id        uuid not null references workspace(id) on delete cascade,
  name                text not null,
  release_manager_id  uuid references member(id) on delete set null,
  qa_lead_id          uuid references member(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (workspace_id, name)
);

create table app_user (                 -- identity, org-independent
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  name          text not null,
  password_hash text,                   -- null for SSO-only users
  created_at    timestamptz not null default now()
);

create table role (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organization(id) on delete cascade, -- null = system role
  key              text not null,       -- 'org_admin' | 'custom:<slug>'
  name             text not null,
  tier             int  not null,
  is_system        boolean not null default false,
  unique (organization_id, key)
);

create table role_permission (
  role_id     uuid not null references role(id) on delete cascade,
  permission  text not null,            -- 'release.approve'
  primary key (role_id, permission)
);

create table member (                   -- user ↔ organization
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organization(id) on delete cascade,
  user_id           uuid not null references app_user(id) on delete cascade,
  role_id           uuid not null references role(id),
  status            text not null default 'pending',
  invited_by_id     uuid references member(id) on delete set null,
  approved_by_id    uuid references member(id) on delete set null,
  approved_at       timestamptz,
  last_active_at    timestamptz,
  created_at        timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table member_workspace (
  member_id     uuid not null references member(id) on delete cascade,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  role_id       uuid references role(id),   -- reserved: per-workspace override
  primary key (member_id, workspace_id)
);

create table member_team (
  member_id  uuid not null references member(id) on delete cascade,
  team_id    uuid not null references team(id) on delete cascade,
  primary key (member_id, team_id)
);

create table invitation (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organization(id) on delete cascade,
  email            citext not null,
  role_id          uuid not null references role(id),
  workspace_id     uuid not null references workspace(id) on delete cascade,
  team_id          uuid references team(id) on delete set null,
  token_hash       text not null,       -- never store the raw token
  status           text not null default 'pending',
  invited_by_id    uuid not null references member(id),
  expires_at       timestamptz not null,
  accepted_at      timestamptz,
  resend_count     int not null default 0,
  created_at       timestamptz not null default now()
);
create unique index on invitation (organization_id, email) where status = 'pending';

create table audit_log (
  id               bigserial primary key,
  organization_id  uuid not null references organization(id) on delete cascade,
  workspace_id     uuid references workspace(id) on delete set null,
  actor_member_id  uuid references member(id) on delete set null,
  action           text not null,
  resource         text not null,
  resource_id      text,
  changes          jsonb,
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index on audit_log (organization_id, created_at desc);
```

**Indexes that matter at scale:** `member(organization_id, status)`,
`member_workspace(workspace_id)`, `member_team(team_id)`,
`audit_log(organization_id, created_at desc)`, and a trigram index on
`app_user(email)` / `member` name for the members search box.

**Row-level security** — the guarantee application code cannot bypass:

```sql
alter table workspace enable row level security;
create policy tenant_isolation on workspace
  using (organization_id = current_setting('app.current_org')::uuid);
```

Every request sets `app.current_org` from the verified session before issuing
queries. Application-level `assertSameOrganization()` is the second net.

---

## 6. API contracts

All routes are organization-scoped by the session; `organizationId` is never
accepted from the client. Errors: `401` unauthenticated, `403` authenticated
but lacking permission, `404` cross-tenant or missing, `409` conflict,
`422` validation (Zod), `429` rate limited.

```
GET    /api/members?status&role&workspace&team&q&cursor&limit
                                          → members.read
POST   /api/members/:id/approve           → members.approve
POST   /api/members/:id/reject            → members.approve
POST   /api/members/:id/suspend           → members.write
POST   /api/members/:id/activate          → members.write
PATCH  /api/members/:id                   → members.write   { roleId?, workspaceIds?, teamIds? }
DELETE /api/members/:id                   → members.write
POST   /api/members/bulk                  → members.write   { ids[], action }

POST   /api/invitations                   → members.invite  { email, roleId, workspaceId, teamId? }
POST   /api/invitations/:id/resend        → members.invite
DELETE /api/invitations/:id               → members.invite
POST   /api/invitations/accept            → public          { token, name, password }

GET    /api/workspaces                    → workspace.read
POST   /api/workspaces                    → workspace.write
PATCH  /api/workspaces/:id                → workspace.write
POST   /api/workspaces/:id/archive        → workspace.delete
POST   /api/workspaces/:id/restore        → workspace.delete

GET    /api/teams?workspaceId             → teams.read
POST   /api/teams                         → teams.write
PATCH  /api/teams/:id                     → teams.write     { name?, releaseManagerId?, qaLeadId? }
POST   /api/teams/:id/members             → teams.write     { memberIds[], mode: 'add'|'move' }
DELETE /api/teams/:id                     → teams.delete

GET    /api/roles                         → members.read
POST   /api/roles                         → roles.write     { name, permissions[] }

GET    /api/audit?action&resource&actor&from&to&cursor
                                          → audit.read
GET    /api/audit/export                  → audit.export
```

**Response envelope** — cursor pagination everywhere; offset pagination degrades
on large tenants.

```jsonc
{ "data": [ … ], "pageInfo": { "nextCursor": "…", "hasMore": true } }
```

**Auditable actions** (written in the same transaction as the mutation, so an
action can never succeed without its audit record): invite, approve, reject,
suspend, activate, remove, transfer, role/permission change, workspace and team
CRUD, integration changes, rule create/delete.

---

## 7. Invitation & onboarding flow

Registration never asks for company, workspace or team — those come from the
invitation:

```
Admin invites (email + workspace + team + role)
  → invitation row, token hashed at rest, expires after
    organization.settings.invitationExpiryDays
  → email with single-use link
  → user registers (name + password) or authenticates via SSO
  → email verification
  → automatic login, member.status = 'pending'
  → full app visible, all data skeletonised, banner explains the wait
  → admin approves → status = 'approved' → permissions activate
```

`requireAdminApproval = false` on the organization promotes accepted invitations
straight to `approved`, skipping the pending state (self-serve tenants).

---

## 8. SSO readiness

The model already separates identity (`app_user`) from membership (`member`),
which is the prerequisite for federation. Adding Azure AD, Google Workspace,
Okta, Entra ID or GitHub means:

1. An `identity_provider` row per organization (issuer, client id, metadata).
2. A `user_identity` table: `(user_id, provider, subject)`, unique on
   `(provider, subject)`.
3. A callback that resolves subject → `app_user`, then organization via
   `organization.verified_domains`, then upserts the `member` row.

Role mapping arrives as an optional `idp_group_role_map` (IdP group → role id),
which changes nothing downstream because the resolved role is still just a
permission bundle. SCIM provisioning writes to the same `member` table and reuses
the status lifecycle: deprovision sets `status = 'suspended'`.

---

## 9. Scale notes

- **Permission resolution is O(1) per request.** Claims (`memberId`, `roleId`,
  `status`, `organizationId`, `workspaceId`) live in the session token; role →
  permissions is a cached lookup. No joins on the authorization path.
- **Cache invalidation:** role edits and status changes bump a per-organization
  `permissions_version`. A token carrying a stale version is refreshed on the
  next request, so approval takes effect immediately without a global flush.
- **Members at thousands of rows:** the API is cursor-paginated and filtered
  server-side. `MembersTable` filters client-side today because the dataset is
  mock; the props (`members`, `isLoading`) already match a server-driven list, so
  the swap is contained. Beyond ~1,000 visible rows, add
  `@tanstack/react-virtual` inside the same component.
- **Audit log** is append-only and the fastest-growing table: partition by month
  on `created_at`, and enforce `organization.settings.dataRetentionDays` with a
  scheduled job.
- **Integrations (Jira/Slack/Teams/GitHub)** are workspace-scoped; credentials
  stay server-side, are encrypted at rest, and are never returned by any read
  endpoint. Webhook receivers verify signatures and are idempotent.
- **Rate limiting** per organization, not per IP — one noisy tenant must not
  exhaust another's budget.

---

## 10. File map

| Path | Responsibility |
|---|---|
| `lib/rbac/permissions.ts` | Permission registry, groups, descriptions |
| `lib/rbac/roles.ts` | System role bundles, resolution, tier comparison |
| `lib/rbac/access.ts` | Evaluation engine, status gating, tenant isolation |
| `lib/rbac/navigation.ts` | Navigation registry — the single source for sidebar, palette, shortcuts, route guard |
| `lib/rbac/types.ts` | Tenancy, role, member, invitation, session types |
| `lib/auth-config.ts` | Demo accounts + session claim encoding (JWT-shaped) |
| `lib/auth-context.tsx` | Session provider, `can/canAny/canAll`, workspace switching |
| `middleware.ts` | Edge enforcement: auth, status routing, route permissions |
| `components/rbac/*` | `PermissionGuard`, `GatedPage`, `AccessDenied`, status banner |
| `hooks/use-gated-data.ts` | loading / gated / denied / ready state machine per widget |
| `lib/mock-tenancy.ts` | Mock organization, workspaces, teams, members, invitations |
