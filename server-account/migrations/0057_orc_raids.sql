-- SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up") - THE ORC RAIDS' CAMPS (bible/
-- 11-Multiplayer/Seats-Arc.md 9.3: "each cleared gives the clearer's war-guild +50 influence at its pledged seat in that
-- region - bounded ... at most 5 camps an account a UTC day and 250 an account a week"): a camp's influence admitted as
-- its own source, `raid` (server-account/src/seatInfluence.js claimOrcCamp; src/net/townSeatLaw.js accountSeatInfluence).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- SQLite cannot widen a CHECK in place, so the table is rebuilt with its rows (nothing references it) and its indexes.
CREATE TABLE IF NOT EXISTS town_seat_influence_new (
  id        INTEGER PRIMARY KEY,
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  account   TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  source    TEXT NOT NULL CHECK (source IN ('watch', 'gate', 'writ', 'bought', 'tribute', 'raid')),
  amount    INTEGER NOT NULL CHECK (amount >= 0),
  region    INTEGER,
  day       INTEGER,
  ref       TEXT NOT NULL,
  at        INTEGER NOT NULL,
  UNIQUE (source, ref)
);
INSERT INTO town_seat_influence_new (id, week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
  SELECT id, week, key, guild_id, account, char_id, source, amount, region, day, ref, at FROM town_seat_influence;
DROP TABLE town_seat_influence;
ALTER TABLE town_seat_influence_new RENAME TO town_seat_influence;
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_seat ON town_seat_influence (week, key, guild_id);
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_account ON town_seat_influence (account, source, day);
