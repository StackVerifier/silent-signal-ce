-- Help centre content schema.
--
-- Read-only at runtime: the database is built by `pnpm db:seed` from the
-- TypeScript content source and committed, so a request never writes. That is
-- what makes SQLite viable on a serverless platform, where the filesystem is
-- read-only and instances are ephemeral.

PRAGMA journal_mode = DELETE;   -- No WAL sidecar files; the file must be self-contained.
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS help_article_fts;
DROP TABLE IF EXISTS help_faq;
DROP TABLE IF EXISTS help_article;
DROP TABLE IF EXISTS help_category;
DROP TABLE IF EXISTS help_channel;

CREATE TABLE help_category (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT NOT NULL,          -- lucide icon name, resolved in the UI
  position     INTEGER NOT NULL
);

CREATE TABLE help_article (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES help_category(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  -- Structured blocks as JSON rather than raw HTML: the renderer stays a
  -- switch over known block types, so content can never inject markup.
  body          TEXT NOT NULL,
  read_minutes  INTEGER NOT NULL DEFAULT 2,
  -- Article is only listed when the viewer holds this permission (NULL = all).
  permission    TEXT,
  position      INTEGER NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_help_article_category ON help_article(category_id, position);

CREATE TABLE help_faq (
  id          TEXT PRIMARY KEY,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  article_slug TEXT REFERENCES help_article(slug) ON DELETE SET NULL,
  position    INTEGER NOT NULL
);

CREATE TABLE help_channel (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  href         TEXT NOT NULL,
  icon         TEXT NOT NULL,
  availability TEXT NOT NULL,
  position     INTEGER NOT NULL
);

-- Full-text search over title, summary and the flattened body text.
CREATE VIRTUAL TABLE help_article_fts USING fts5(
  slug UNINDEXED,
  title,
  summary,
  body_text,
  tokenize = 'unicode61 remove_diacritics 2'
);
