-- Humanizer initial schema.
-- A "period" is one day. Money is pence (INTEGER), never floats.

CREATE TABLE company (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  -- Global leaderboard is opt-in at COMPANY level so one employee can never
  -- expose their team's numbers.
  global_leaderboard_opt_in INTEGER NOT NULL DEFAULT 0
                              CHECK (global_leaderboard_opt_in IN (0, 1)),
  display_name              TEXT,
  theme                     TEXT NOT NULL DEFAULT 'default',
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE company_goal (
  company_id TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  goal       TEXT NOT NULL
               CHECK (goal IN ('time', 'revenue', 'capacity', 'headspace')),
  weight     REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (company_id, goal)
);

CREATE TABLE human (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  role             TEXT,
  -- Pence per hour. Converts time outcomes into money.
  hourly_rate_pence INTEGER CHECK (hourly_rate_pence IS NULL OR hourly_rate_pence >= 0),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  -- RESTRICT, not SET NULL: an agent without a human owner is invalid, so a
  -- human who still owns agents cannot be deleted until they are reassigned.
  owner_human_id  TEXT NOT NULL REFERENCES human (id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  job_description TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'building', 'live', 'retired')),
  baseline_minutes INTEGER CHECK (baseline_minutes IS NULL OR baseline_minutes >= 0),
  runs_per_day    INTEGER CHECK (runs_per_day IS NULL OR runs_per_day >= 0),
  setup_effort    REAL NOT NULL CHECK (setup_effort > 0),
  avatar          TEXT,
  prompt          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE outcome (
  id        TEXT PRIMARY KEY,
  agent_id  TEXT NOT NULL REFERENCES agent (id) ON DELETE CASCADE,
  -- ISO day. A period is one day.
  day       TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  goal      TEXT NOT NULL
              CHECK (goal IN ('time', 'revenue', 'capacity', 'headspace')),
  predicted REAL NOT NULL,
  -- NULL means the owner did not confirm that day. It is NOT a zero outcome.
  actual    REAL,
  source    TEXT NOT NULL
              CHECK (source IN ('run_log', 'draft_feedback', 'platform_metric', 'check_in')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (agent_id, goal, day)
);

CREATE INDEX idx_agent_company ON agent (company_id);
CREATE INDEX idx_agent_owner   ON agent (owner_human_id);
CREATE INDEX idx_human_company ON human (company_id);
CREATE INDEX idx_outcome_agent_day ON outcome (agent_id, day);
