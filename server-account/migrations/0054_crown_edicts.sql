-- CROWN1 (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up") - THE CROWN'S TWO EDICTS (bible/11-Multiplayer/
-- Seats-Arc.md 7.6): Conscription (part one) and the Royal Tourney (part two) admitted among the Edicts a seat may
-- proclaim (src/net/townSeatLaw.js EDICTS; a crown's alone - edictForTier, asked in server-account/src/seatHolding.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- SQLite cannot widen a CHECK in place, so the table is rebuilt with its rows (nothing references it) and its index.
CREATE TABLE IF NOT EXISTS town_seat_edicts_new (
  key        INTEGER NOT NULL,
  week       INTEGER NOT NULL,
  edict      TEXT NOT NULL CHECK (edict IN ('market-day', 'open-gates', 'curfew', 'festival', 'levy', 'bounty', 'conscription', 'royal-tourney')),
  guild_id   TEXT NOT NULL,
  set_by     TEXT NOT NULL,
  set_aside  INTEGER NOT NULL DEFAULT 0 CHECK (set_aside >= 0),
  spent      INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0 AND spent <= set_aside),
  state      TEXT NOT NULL DEFAULT 'proclaimed' CHECK (state IN ('proclaimed', 'law', 'unpaid', 'void', 'returned')),
  cost       INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  at         INTEGER NOT NULL,
  PRIMARY KEY (key, week),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
INSERT INTO town_seat_edicts_new (key, week, edict, guild_id, set_by, set_aside, spent, state, cost, at)
  SELECT key, week, edict, guild_id, set_by, set_aside, spent, state, cost, at FROM town_seat_edicts;
DROP TABLE town_seat_edicts;
ALTER TABLE town_seat_edicts_new RENAME TO town_seat_edicts;
CREATE INDEX IF NOT EXISTS idx_town_seat_edicts_week ON town_seat_edicts (week, state);
