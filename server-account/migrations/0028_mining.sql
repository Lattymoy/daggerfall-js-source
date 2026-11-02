-- PROF2 (2026-09-28, Mac: "Go") - MINING AND QUARRYING, AND THE FORGE
-- (bible/06-Systems/Professions-Arc.md, PROF0 4.1, 4.5, 4.6, 6 and 23).
--
-- Two of PROF1's tables name what they hold in a CHECK, and SQLite changes
-- a CHECK only by building the table again: the day's harvests grow the
-- vein's `ore` and the boulder's `stone` beside the patch's two kinds, and
-- a gem a strike found; the witnessed world grows its second kind, the
-- dungeon (a dungeon vein's ground, SEAT0 3.2's law). Each is built new,
-- filled from the old, and takes the old one's name and index. Nothing
-- references either table, so the swap moves no foreign key.

-- THE DAY'S HARVESTS: as 0027 kept them, `kind` one of a patch's two
-- (herbs, food), a vein's (ore) or a boulder's (stone); `gem` the gem a
-- strike on the glint found beside the ore (one at most, PROF0 23).
CREATE TABLE IF NOT EXISTS node_harvests_new (
  day        INTEGER NOT NULL,
  node       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('herbs', 'food', 'ore', 'stone')),
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  profession TEXT NOT NULL,
  material   TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty >= 1),
  xp         INTEGER NOT NULL CHECK (xp >= 0),
  gem        TEXT,
  at         INTEGER NOT NULL,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (day, node, kind, player, char_id),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO node_harvests_new (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n)
  SELECT day, node, kind, player, char_id, profession, material, qty, xp, NULL, at, rid, n FROM node_harvests;
DROP TABLE node_harvests;
ALTER TABLE node_harvests_new RENAME TO node_harvests;
CREATE INDEX IF NOT EXISTS idx_node_harvests_today ON node_harvests (player, char_id, profession, day);

-- THE WITNESSED WORLD: a map pixel's climate and region (`pixel`, keyed
-- "x,y"), and now a dungeon's (`dungeon`, keyed by DFU's own identity,
-- MapTableData.MapId & 0xfffff) - one report an account a thing, from an
-- account a week registered (nodeLaw.js witnessedFact).
CREATE TABLE IF NOT EXISTS world_witness_new (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel', 'dungeon')),
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

-- A SMELT AT A FORGE (PROF0 4.1, 23): a recipe `count` times, the inputs
-- out of the Stores bought first and the products in - `own` of them own,
-- `bought` bought (an ingot is own only when every unit that made it was)
-- - and the Smithing XP it gave. The row is the request's own, so an answer
-- lost is answered again with what it made.
CREATE TABLE IF NOT EXISTS prof_smelts (
  player  TEXT NOT NULL,
  rid     TEXT NOT NULL,
  char_id TEXT NOT NULL,
  recipe  TEXT NOT NULL,
  count   INTEGER NOT NULL CHECK (count >= 1 AND count <= 100),
  own     INTEGER NOT NULL CHECK (own >= 0),
  bought  INTEGER NOT NULL CHECK (bought >= 0),
  xp      INTEGER NOT NULL CHECK (xp >= 0),
  at      INTEGER NOT NULL,
  n       TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
