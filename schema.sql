-- D1 schema for Voice-CV visitor logging.
-- Run once against the D1 database bound to the Pages project as `DB`.
-- Dashboard: Workers & Pages → D1 → <your db> → Console → paste & run.

CREATE TABLE IF NOT EXISTS visits (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL,        -- ISO timestamp (UTC)
  session  TEXT DEFAULT '',      -- per-tab session id
  country  TEXT DEFAULT '',      -- CF-IPCountry (coarse, no IP stored)
  referer  TEXT DEFAULT '',
  ua       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS questions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL,
  session  TEXT DEFAULT '',
  country  TEXT DEFAULT '',
  q        TEXT NOT NULL         -- the visitor's question (truncated to 500 chars)
);

CREATE INDEX IF NOT EXISTS idx_visits_ts    ON visits(ts);
CREATE INDEX IF NOT EXISTS idx_questions_ts ON questions(ts);
