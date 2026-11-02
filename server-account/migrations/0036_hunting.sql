-- PROF7 (2026-09-29, Mac: "Do it") - HUNTING, THE SKINNING KNIFE AND OUTFITTING
-- (bible/06-Systems/Professions-Arc.md 4.4, 4.5, 5.2, 6, 9.3, 9.4, 29).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A BODY'S HIDE: node_harvests learns the kind `hide`; `tier`, the node's tier as the harvest was decided (Hunting's
-- day counts its tier 5-6 hides by it - PROF0 6: 3 an account); and `extra_qty`, how many of the second find (a body's
-- butchery - a Butcher's two Raw Meat; a tree's Resin one, as ever). SQLite cannot widen a CHECK in place: the table is
-- rebuilt, every column carried (PROF4's `extra`, AUDIT 29's `deep_unconfirmed`); a row before this reads tier 0 and one
-- of its extra.
CREATE TABLE IF NOT EXISTS node_harvests_new (
  day              INTEGER NOT NULL,
  node             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('herbs', 'food', 'ore', 'stone', 'logs', 'hide')),
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
  PRIMARY KEY (day, node, kind, player, char_id),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO node_harvests_new (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty)
  SELECT day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, 0, 1 FROM node_harvests;
DROP TABLE node_harvests;
ALTER TABLE node_harvests_new RENAME TO node_harvests;
CREATE INDEX IF NOT EXISTS idx_node_harvests_today ON node_harvests (player, char_id, profession, day);
CREATE INDEX IF NOT EXISTS idx_node_harvests_account ON node_harvests (player, day, profession);

-- A GARMENT'S DYE: the colour the crafter chose (DFU's DyeColors 0-9 - recipeLaw GARMENT_DYES), kept on the craft and on
-- the piece, and signed into its record (`u`), so a garment is the colour it was sewn in wherever it goes. Null for every
-- other piece.
ALTER TABLE prof_crafts ADD COLUMN dye INTEGER CHECK (dye IS NULL OR dye BETWEEN 0 AND 9);
ALTER TABLE products ADD COLUMN dye INTEGER CHECK (dye IS NULL OR dye BETWEEN 0 AND 9);
