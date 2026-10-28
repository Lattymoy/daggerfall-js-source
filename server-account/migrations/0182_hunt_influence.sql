-- HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md section 12, bible/11-Multiplayer/Seats-Arc.md 4.2) - A
-- BOUNTY CLEARED AS A SEAT'S INFLUENCE: a recorded clear counts for the clearer's war-guild at its pledged seat in the
-- board's region, as its own source, `hunt` (server-account/src/seatInfluence.js creditHunt; src/net/townSeatLaw.js
-- accountSeatInfluence, HUNT_INFLUENCE and HUNT_WEEK_CAP).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- SQLite cannot widen a CHECK in place, so the table is rebuilt with its rows (nothing references it), AUDIT-SEATS S9's
-- `voided` kept as it stands, and its indexes (0057's way).
CREATE TABLE IF NOT EXISTS town_seat_influence_new (
  id        INTEGER PRIMARY KEY,
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  account   TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  source    TEXT NOT NULL CHECK (source IN ('watch', 'gate', 'writ', 'bought', 'tribute', 'raid', 'hunt')),
  amount    INTEGER NOT NULL CHECK (amount >= 0),
  region    INTEGER,
  day       INTEGER,
  ref       TEXT NOT NULL,
  at        INTEGER NOT NULL,
  voided    INTEGER NOT NULL DEFAULT 0 CHECK (voided IN (0, 1)),
  UNIQUE (source, ref)
);
INSERT INTO town_seat_influence_new (id, week, key, guild_id, account, char_id, source, amount, region, day, ref, at, voided)
  SELECT id, week, key, guild_id, account, char_id, source, amount, region, day, ref, at, voided FROM town_seat_influence;
DROP TABLE town_seat_influence;
ALTER TABLE town_seat_influence_new RENAME TO town_seat_influence;
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_seat ON town_seat_influence (week, key, guild_id);
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_account ON town_seat_influence (account, source, day);
