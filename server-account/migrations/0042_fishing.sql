-- PROF8 (2026-09-30, Mac: "Continue the arc"; "XP follows your rank") - FISHING WITH THE NET
-- (bible/06-Systems/Professions-Arc.md 5.2, 6, 30).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A HAUL: node_harvests learns the kind `fish` (a haul's Raw Fish, under Fishing - its node the haul's own key,
-- `haul:<x>:<y>:<day>:<id>`, nodeLaw.js haulKey), and `trophy`, whether the haul brought up a trophy (the species' own
-- Deep Waters item, which the client puts in the pack - so an answer asked again says it again). SQLite cannot widen a
-- CHECK in place: the table is rebuilt, every column carried; a row before this reads no trophy.
CREATE TABLE IF NOT EXISTS node_harvests_new (
  day              INTEGER NOT NULL,
  node             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('herbs', 'food', 'ore', 'stone', 'logs', 'hide', 'fish')),
  player           TEXT NOT NULL,
  char_id          TEXT NOT NULL,
  profession       TEXT NOT NULL,
  material         TEXT NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty >= 1),
  xp               INTEGER NOT NULL CHECK (xp >= 0),
  gem              TEXT,
  at               INTEGER NOT NULL,
  rid              TEXT NOT NULL,
  n                TEXT NOT NULL,
  deep_unconfirmed INTEGER NOT NULL DEFAULT 0 CHECK (deep_unconfirmed IN (0, 1)),
  extra            TEXT,
  tier             INTEGER NOT NULL DEFAULT 0 CHECK (tier BETWEEN 0 AND 7),
  extra_qty        INTEGER NOT NULL DEFAULT 1 CHECK (extra_qty >= 1),
  trophy           INTEGER NOT NULL DEFAULT 0 CHECK (trophy IN (0, 1)),
  PRIMARY KEY (day, node, kind, player, char_id),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO node_harvests_new (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty, trophy)
  SELECT day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty, 0 FROM node_harvests;
DROP TABLE node_harvests;
ALTER TABLE node_harvests_new RENAME TO node_harvests;
CREATE INDEX IF NOT EXISTS idx_node_harvests_today ON node_harvests (player, char_id, profession, day);
CREATE INDEX IF NOT EXISTS idx_node_harvests_account ON node_harvests (player, day, profession);
