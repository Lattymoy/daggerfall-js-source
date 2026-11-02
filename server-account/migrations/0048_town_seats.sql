-- SEAT1a (2026-09-30, Mac: "Finish the seats") - THE SEATS' REGISTRY
-- (bible/11-Multiplayer/Seats-Arc.md 3.1-3.2; src/net/townSeatLaw.js, server-account/src/townSeats.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE WITNESSED SEAT (SEAT0 3.2: "Every fact the servers need that only ARENA2 knows is learnt the same way ... in one
-- table and one law"): a seat is witnessed as a pixel, a dungeon and a hub are - the kind `seat`, keyed by its map id,
-- its report the seat's canonical bytes (townSeatLaw.js seatReportText). The table is rebuilt to admit the kind.
CREATE TABLE IF NOT EXISTS world_witness_new (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel', 'dungeon', 'hub', 'seat')),
  key     TEXT NOT NULL,
  account TEXT NOT NULL,
  report  TEXT NOT NULL,
  region  INTEGER,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO world_witness_new (kind, key, account, report, region, at)
  SELECT kind, key, account, report, region, at FROM world_witness;
DROP TABLE world_witness;
ALTER TABLE world_witness_new RENAME TO world_witness;
CREATE INDEX IF NOT EXISTS idx_world_witness_region ON world_witness (kind, region);

-- THE CHRONICLE (SEAT0 9.2, 12): every claim, siege, Tourney, revolt, Edict, fealty and change of hands is a row, kept
-- forever. Its first rows are SEAT1a's: a developer's strike of a seat (SEAT0 3.2: "the strike is itself a history row"),
-- which also keeps the struck key from being witnessed again. `week` the seat week the row belongs to (townSeatLaw.js
-- seatWeekOf); `data` its JSON.
CREATE TABLE IF NOT EXISTS town_seat_history (
  seq   INTEGER PRIMARY KEY,
  key   INTEGER NOT NULL,
  week  INTEGER NOT NULL,
  kind  TEXT NOT NULL,
  data  TEXT NOT NULL DEFAULT '{}',
  at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_town_seat_history_key ON town_seat_history (key, seq);
