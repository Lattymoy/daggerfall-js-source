-- INT17 (2026-10-17, the INTEGRITY arc's lane 4 - bible/06-Systems/Integrity-Arc.md section 7; server-account/src/progress.js):
-- THE PLAY THAT PAYS FOR A PROGRESSION CLAIM, measured first (the owner, asked: "Measure first").
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- reads these tables.

-- A STREAM'S BUCKET, an account at a time (one seat an account: realm.js joinRealm). It fills at the line's rate for
-- every second the account played (`played_at` the account's played_s when it last moved - accounts.js creditPlay's own
-- count), up to the line's cap, and each claim spends it (budget.js stepBudget). While the line only measures it keeps
-- no debt; once staff enforce it, an empty bucket refuses its stream until play refills it.
CREATE TABLE IF NOT EXISTS progress_play (
  player     TEXT NOT NULL,
  stream     TEXT NOT NULL,
  allowance  INTEGER NOT NULL,
  played_at  INTEGER NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (player, stream),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- THE MEASURE: an account's claims of a stream in one hour of the clock - what they took, the seconds played they came
-- in, and what they took past the bucket (`over`: who the line standing would have refused). What staff read to set
-- the line (/v1/mod/realm-progress). The cron sweeps rows past REALM_WEALTH_KEEP_S, as it sweeps the wealth's hours.
CREATE TABLE IF NOT EXISTS progress_hours (
  player    TEXT NOT NULL,
  stream    TEXT NOT NULL,
  hour      INTEGER NOT NULL,
  amount    INTEGER NOT NULL DEFAULT 0,
  played_s  INTEGER NOT NULL DEFAULT 0,
  over      INTEGER NOT NULL DEFAULT 0,
  claims    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player, stream, hour),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS progress_hours_hour ON progress_hours (stream, hour);
