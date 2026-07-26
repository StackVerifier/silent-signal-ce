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

PRAGMA journal_mode = WAL;      -- Concurrent reads during a write.
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS organization (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  logo              TEXT,
  plan              TEXT NOT NULL DEFAULT 'free',
  sso_enabled       INTEGER NOT NULL DEFAULT 0,
  sso_provider      TEXT,
  verified_domains  TEXT NOT NULL DEFAULT '[]',
  settings          TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  integration_ids  TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  archived_at      TEXT,
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
  email_verified_at  TEXT,
  invited_by_id      TEXT,
  invited_at         TEXT,
  approved_by_id     TEXT,
  approved_at        TEXT,
  last_active_at     TEXT,
  password_hash      TEXT,
  -- Set when an account is created with a handed-out password, so the app can
  -- insist on a real one before it is used for anything.
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_changed_at TEXT,
  created_at         TEXT NOT NULL,
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
  created_at          TEXT NOT NULL,
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
  invited_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  accepted_at      TEXT,
  resent_at        TEXT,
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
  enabled       INTEGER NOT NULL DEFAULT 0,
  config        TEXT NOT NULL DEFAULT '{}',
  last_sync_at  TEXT,
  created_at    TEXT NOT NULL,
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
  enabled        INTEGER NOT NULL DEFAULT 1,
  quiet_hours    TEXT,                   -- JSON {start,end,timezone} or NULL
  last_status    TEXT,                   -- ok | failed | untested
  last_error     TEXT,
  last_tested_at TEXT,
  created_by_id  TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
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
  read          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_member
  ON notification(member_id, read, created_at DESC);

-- The audit log is a compliance record, not an activity feed. Every column
-- here exists to answer a question an investigator actually asks: who acted,
-- on what, from where, through which interface, and to what value.
--
-- Nothing in this table is ever updated. Records are append-only by
-- convention — the repository exposes no update path — because a mutable audit
-- log is not evidence of anything.
CREATE TABLE IF NOT EXISTS audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Event identity. `event` names a catalogue entry; category and severity are
  -- denormalised from it so filtering does not need the application's help,
  -- and so a record keeps the severity it had when it was written even if the
  -- catalogue is later re-tuned.
  event            TEXT NOT NULL DEFAULT 'system.job_run',
  category         TEXT NOT NULL DEFAULT 'system',
  severity         TEXT NOT NULL DEFAULT 'info',
  status           TEXT NOT NULL DEFAULT 'success',
  source           TEXT NOT NULL DEFAULT 'dashboard',

  -- Scope. Nullable on purpose: a failed sign-in for an address that matches no
  -- account belongs to no tenant, and dropping the record would leave the log
  -- silent about exactly the traffic worth watching — someone guessing at
  -- addresses. Those rows are platform-level and do not appear in
  -- organization-scoped queries.
  organization_id  TEXT REFERENCES organization(id) ON DELETE CASCADE,
  workspace_id     TEXT,
  workspace_name   TEXT,
  team_id          TEXT,
  team_name        TEXT,

  -- Actor: names and role are captured at write time. Ids outlive names, and
  -- an investigator needs to know the role held *then*, not the role held now.
  actor_id         TEXT,
  actor_name       TEXT NOT NULL,
  actor_email      TEXT NOT NULL,
  actor_avatar     TEXT,
  actor_role       TEXT,

  -- Target: the other end of "Bora suspended Hakan".
  target_type      TEXT,
  target_id        TEXT,
  target_name      TEXT,
  target_email     TEXT,

  -- Legacy shape, retained so existing readers and rows keep working.
  action           TEXT NOT NULL,
  resource         TEXT NOT NULL,
  resource_id      TEXT,

  changes          TEXT,
  metadata         TEXT,
  relations        TEXT,

  -- Forensics. Sensitive: only readers holding audit.read_sensitive see these.
  ip_address       TEXT,
  user_agent       TEXT,
  device           TEXT,
  session_id       TEXT,
  correlation_id   TEXT,

  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(organization_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(organization_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(organization_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(organization_id, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_log(correlation_id);

-- ─── Delivery data ───────────────────────────────────────────────────────────
-- Jira owns these once syncing is live; seeded now so the product has content.

CREATE TABLE IF NOT EXISTS sprint (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  team          TEXT NOT NULL,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  payload       TEXT NOT NULL           -- full Sprint aggregate as JSON
);

CREATE TABLE IF NOT EXISTS release (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  target_date   TEXT NOT NULL,
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
  enabled          INTEGER NOT NULL DEFAULT 1,
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
  occurred_at   TEXT NOT NULL,
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
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billing (
  workspace_id  TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  payload       TEXT NOT NULL
);
