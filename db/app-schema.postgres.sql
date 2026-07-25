-- Application schema, Postgres dialect.
--
-- Mirrors db/app-schema.sql. The differences are only the ones Postgres
-- requires: real BOOLEAN and TIMESTAMPTZ instead of SQLite's INTEGER/TEXT, and
-- BIGSERIAL for the audit id. Table and column names are identical, so the
-- repositories issue the same SQL against either driver.

-- Application database.
--
-- Unlike data/help.db (read-only content), this one is written at runtime.
-- That works wherever the filesystem persists: `pnpm dev`, `pnpm start`,
-- Docker, a VM. It does NOT work on serverless, where each instance gets a
-- fresh ephemeral disk — see docs/database.md.
--
-- Aggregates that are always read as a unit and whose real source of truth is
-- Jira (a sprint's issues, a release's gates, a rule's conditions) are stored
-- as JSON columns. Modelling them relationally now would be premature: Jira
-- owns their shape, and nothing queries into them.





CREATE TABLE IF NOT EXISTS organization (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  logo              TEXT,
  plan              TEXT NOT NULL DEFAULT 'free',
  sso_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  sso_provider      TEXT,
  verified_domains  TEXT NOT NULL DEFAULT '[]',
  settings          TEXT NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  integration_ids  TEXT NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  archived_at      TIMESTAMPTZ,
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS member (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL,
  email              TEXT NOT NULL,
  name               TEXT NOT NULL,
  avatar             TEXT,
  role_id            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  email_verified_at  TIMESTAMPTZ,
  invited_by_id      TEXT,
  invited_at         TIMESTAMPTZ,
  approved_by_id     TEXT,
  approved_at        TIMESTAMPTZ,
  last_active_at     TIMESTAMPTZ,
  password_hash      TEXT,
  -- Set when an account is created with a handed-out password, so the app can
  -- insist on a real one before it is used for anything.
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_member_org_status ON member(organization_id, status);

CREATE TABLE IF NOT EXISTS team (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  workspace_id        TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  release_manager_id  TEXT REFERENCES member(id) ON DELETE SET NULL,
  qa_lead_id          TEXT REFERENCES member(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace_id, name)
);

-- Join tables rather than JSON arrays: membership is queried from both sides.
CREATE TABLE IF NOT EXISTS member_workspace (
  member_id     TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS member_team (
  member_id  TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  team_id    TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_member_team_team ON member_team(team_id);

CREATE TABLE IF NOT EXISTS invitation (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  role_id          TEXT NOT NULL,
  workspace_id     TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  team_id          TEXT REFERENCES team(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  token_hash       TEXT NOT NULL,
  invited_by_id    TEXT NOT NULL,
  invited_at       TIMESTAMPTZ NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  accepted_at      TIMESTAMPTZ,
  resent_at        TIMESTAMPTZ,
  resend_count     INTEGER NOT NULL DEFAULT 0
);

-- Only one live invitation per address; expired and cancelled ones may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_pending
  ON invitation(organization_id, email) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS integration (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  name          TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  config        TEXT NOT NULL DEFAULT '{}',
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace_id, type)
);

-- Slack / Teams / email delivery targets.
--
-- A webhook URL is a bearer credential: anyone holding it can post as the app.
-- It is therefore stored encrypted (AES-256-GCM) and never returned by any read
-- endpoint — only `url_hint`, a masked preview, ever reaches the browser.
CREATE TABLE IF NOT EXISTS webhook_endpoint (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL,          -- slack | teams | email
  label          TEXT NOT NULL,          -- '#release-risk', 'Delivery / Alerts'
  url_encrypted  TEXT NOT NULL,
  url_hint       TEXT NOT NULL,
  minimum_level  TEXT NOT NULL DEFAULT 'high',
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours    TEXT,                   -- JSON {start,end,timezone} or NULL
  last_status    TEXT,                   -- ok | failed | untested
  last_error     TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_workspace ON webhook_endpoint(workspace_id, enabled);

CREATE TABLE IF NOT EXISTS notification (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  level         TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  link          TEXT,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_member
  ON notification(member_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id               BIGSERIAL PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  workspace_id     TEXT,
  actor_id         TEXT,
  actor_name       TEXT NOT NULL,
  actor_email      TEXT NOT NULL,
  actor_avatar     TEXT,
  action           TEXT NOT NULL,
  resource         TEXT NOT NULL,
  resource_id      TEXT,
  changes          TEXT,
  metadata         TEXT,
  created_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_log(organization_id, created_at DESC);

-- ─── Delivery data ───────────────────────────────────────────────────────────
-- Jira owns these once syncing is live; seeded now so the product has content.

CREATE TABLE IF NOT EXISTS sprint (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  team          TEXT NOT NULL,
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  payload       TEXT NOT NULL           -- full Sprint aggregate as JSON
);

CREATE TABLE IF NOT EXISTS release (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  target_date   TIMESTAMPTZ NOT NULL,
  payload       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_item (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  issue_key     TEXT NOT NULL,
  payload       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_tester (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  payload       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rule (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  action           TEXT NOT NULL,
  score_impact     INTEGER NOT NULL DEFAULT 0,
  description      TEXT NOT NULL,
  conditions       TEXT NOT NULL DEFAULT '[]',
  triggered_count  INTEGER NOT NULL DEFAULT 0,
  last_triggered   TEXT
);

CREATE INDEX IF NOT EXISTS idx_rule_workspace ON rule(workspace_id, enabled);

CREATE TABLE IF NOT EXISTS risk_event (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  occurred_at   TIMESTAMPTZ NOT NULL,
  payload       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_event_time ON risk_event(workspace_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS signal (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,          -- 'signal' | 'live'
  payload       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_health (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  payload       TEXT NOT NULL
);

-- One row per workspace; the dashboard aggregate is recomputed, not accumulated.
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  workspace_id  TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  payload       TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing (
  workspace_id  TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  payload       TEXT NOT NULL
);
