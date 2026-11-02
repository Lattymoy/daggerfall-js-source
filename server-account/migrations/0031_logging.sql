-- PROF4 (2026-09-28, Mac: "Continue") - LOGGING, CARPENTRY AND THE FURNITURE
-- (bible/06-Systems/Professions-Arc.md 4.2, 5.2, 9.3, 9.4, 14, 25).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A TREE'S HARVEST: node_harvests learns the kind `logs`, and a second find beside the yield - `extra`, a tree's Resin
-- (one tree in four). A tree's Heartwood rides `gem`, the act's own find (a Clean Cut's, as a gem is a glint's). SQLite
-- cannot widen a CHECK in place: the table is rebuilt, every column carried (PROF2's, AUDIT 29's `deep_unconfirmed`).
CREATE TABLE IF NOT EXISTS node_harvests_new (
  day              INTEGER NOT NULL,
  node             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('herbs', 'food', 'ore', 'stone', 'logs')),
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
  PRIMARY KEY (day, node, kind, player, char_id),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO node_harvests_new (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra)
  SELECT day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, NULL FROM node_harvests;
DROP TABLE node_harvests;
ALTER TABLE node_harvests_new RENAME TO node_harvests;
CREATE INDEX IF NOT EXISTS idx_node_harvests_today ON node_harvests (player, char_id, profession, day);
CREATE INDEX IF NOT EXISTS idx_node_harvests_account ON node_harvests (player, day, profession);

-- A CRAFT'S HEARTWOOD: whether a Heartwood stood in for one of its planks (a quality step - PROF0 9.2, 25), so the
-- answer read back names what was spent.
ALTER TABLE prof_crafts ADD COLUMN heartwood INTEGER NOT NULL DEFAULT 0 CHECK (heartwood IN (0, 1));

-- A PIECE'S MARK: whether its name carries its maker's - a Masterwork's, and every piece of furniture a Master Joiner
-- makes (PROF0 3.3). DECOR writes a set-down piece's mark from this row alone (server-account/src/decor.js).
ALTER TABLE products ADD COLUMN marked INTEGER NOT NULL DEFAULT 0 CHECK (marked IN (0, 1));
