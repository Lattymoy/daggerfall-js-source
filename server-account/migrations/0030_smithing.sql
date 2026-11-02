-- PROF3 (2026-09-28, Mac: "Lets keep moving") - SMITHING: THE ANVIL, QUALITY AND PROVENANCE
-- (bible/06-Systems/Professions-Arc.md 9.1-9.4, 14, 24).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A CRAFT AT THE ANVIL: the request's own row (the house law - one statement decides, its nonce `n` the rest key on),
-- so an answer lost is answered again with what it made. The recipe (net/recipeLaw.js), the quality the service
-- rolled (0 Crude to 4 Masterwork; -1 for a Repair Kit, which takes none), the pieces it made (a Quartermaster's kit
-- two - `provenance2`), the seed their Loot Rarity rolls come off, the Smithing XP it credited and whether it was the
-- character's first of the recipe (+500, PROF0 3.2).
CREATE TABLE IF NOT EXISTS prof_crafts (
  player      TEXT NOT NULL,
  rid         TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  recipe      TEXT NOT NULL,
  quality     INTEGER NOT NULL CHECK (quality >= -1 AND quality <= 4),
  count       INTEGER NOT NULL CHECK (count IN (1, 2)),
  provenance  TEXT NOT NULL CHECK (length(provenance) = 16),
  provenance2 TEXT CHECK (provenance2 IS NULL OR length(provenance2) = 16),
  seed        INTEGER NOT NULL CHECK (seed >= 0 AND seed <= 4294967295),
  xp          INTEGER NOT NULL CHECK (xp >= 0),
  first       INTEGER NOT NULL CHECK (first IN (0, 1)),
  at          INTEGER NOT NULL,
  n           TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- the character's first of a recipe, read in the decision
CREATE INDEX IF NOT EXISTS idx_prof_crafts_recipe ON prof_crafts (player, char_id, recipe);

-- EVERY CRAFTED PIECE (PROF0 14's `products`): its provenance id - 16 hex digits from the service's CSPRNG, unique
-- across the server - its owner (the account that holds the id: PROF5's market and TRADE1's hand-over move it, section
-- 18), the character that made it and the mark's name at the moment of making, what it is, and the signed record
-- (net/productRecord.js). `listed` is PROF5's: one live listing an id.
CREATE TABLE IF NOT EXISTS products (
  provenance TEXT PRIMARY KEY CHECK (length(provenance) = 16),
  owner      TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  maker      TEXT,
  recipe     TEXT NOT NULL,
  template   INTEGER NOT NULL,
  material   INTEGER NOT NULL,
  quality    INTEGER NOT NULL CHECK (quality >= -1 AND quality <= 4),
  seed       INTEGER NOT NULL,
  record     TEXT NOT NULL,
  made_at    INTEGER NOT NULL,
  listed     INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1)),
  FOREIGN KEY (owner) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_owner ON products (owner);

-- THE SMITH'S STOCK (PROF0 24): a purchase of the fittings no profession yields yet, bought into the Stores for Marks -
-- the request's own row, whose nonce the Marks line (kind `stock`) and the Stores' units key on.
CREATE TABLE IF NOT EXISTS prof_stock (
  player   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 1 AND qty <= 100),
  marks    INTEGER NOT NULL CHECK (marks >= 1),
  at       INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
