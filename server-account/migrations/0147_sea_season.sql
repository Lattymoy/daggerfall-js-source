-- SEA-SEASON (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
-- Ocean's seasonal boards: the deepest voyage and the legends ended; bible/03-World/Eltheric-Ocean.md SEA-SEASON).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that serves
-- /v1/sea/season (acct168).
--
-- A CAPTAIN'S SEASON: a realm character's figures for a season (net/arena/arenaLaw.js arenaSeasonOf), read off its CLEAN
-- judged checkpoints (server-account/src/seaSeason.js, in the checkpoint's own batch) - the deepest leagues past the Veil
-- a voyage went and the legends ended, each the most any checkpoint of the season has said (a figure never falls), with
-- the moment it was first reached (the earlier of two equal ranks first).
CREATE TABLE IF NOT EXISTS sea_season (
  season      INTEGER NOT NULL,
  char_id     TEXT NOT NULL,           -- the realm character
  player      TEXT NOT NULL,           -- its account
  deepest     INTEGER NOT NULL DEFAULT 0 CHECK (deepest >= 0),
  deep_at     INTEGER NOT NULL,        -- when the deepest was first reached
  legends     INTEGER NOT NULL DEFAULT 0 CHECK (legends >= 0),
  legends_at  INTEGER NOT NULL,        -- when the legends' count was first reached
  at          INTEGER NOT NULL,        -- the last checkpoint that said them
  PRIMARY KEY (season, char_id)
);
CREATE INDEX IF NOT EXISTS sea_season_deep ON sea_season (season, deepest DESC, deep_at);
CREATE INDEX IF NOT EXISTS sea_season_legends ON sea_season (season, legends DESC, legends_at);
