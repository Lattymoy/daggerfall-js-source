-- MASTER-ART (2026-10-27; bible/06-Systems/Professions-Arc.md section 57): a Master's work - a Legendary piece a Master
-- makes, its three lines chosen, their values the service's roll in the Legendary band.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- reads it.
--
-- A MASTER'S WORK (`prof_masters`, masterWork.js): its row decides and answers a request asked twice ((player, rid)),
-- and holds a character to one a UTC day ((player, char_id, day) - the decision's INSERT OR IGNORE). `lines` the lines
-- as the record signs them (src/net/masterLaw.js masterRecordLines: a JSON list of `[kind, value]` or `[kind, value,
-- param]`, the values the service rolled - AUDIT HORIZONTAL B1), `seed` the record's, `provenance` the piece's products
-- row, written in the same batch. Kept when the character is deleted, as prof_crafts is: a request asked again is
-- answered, never made twice.
CREATE TABLE IF NOT EXISTS prof_masters (
  player     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  day        INTEGER NOT NULL CHECK (day >= 0),
  recipe     TEXT NOT NULL,
  provenance TEXT NOT NULL,
  lines      TEXT NOT NULL,
  seed       INTEGER NOT NULL CHECK (seed >= 0),
  at         INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  UNIQUE (player, char_id, day),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
