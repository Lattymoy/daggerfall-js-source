-- CRAFT4 (2026-10-07) - TEMPERING AND REFORGING.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "How could we enhance the profession element of the game while
-- reducing complexity and making crafting more viable", then "Lets do
-- it" (bible/06-Systems/Professions-Arc.md 41.2, CRAFT4; 41.7 as built).
-- The crafter improves what loot gives, never past law 7.
--
-- A TEMPER (`prof_tempers`, professions.js temperPiece): a piece's
-- quality a step better, up to Superior, for half its recipe's main
-- input from the Stores and the craft's XP. Its row decides and answers
-- a request asked twice ((player, rid)); `quality` is the quality it
-- made, `provenance` a made piece's (its products row re-signed in the
-- same batch), NULL for a found one - the save's own word, bounded by
-- the Stores' spend.
CREATE TABLE IF NOT EXISTS prof_tempers (
  player     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  recipe     TEXT NOT NULL,
  provenance TEXT,
  quality    INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 3),
  material   TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  xp         INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  at         INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- A REFORGE WITH ESSENCE (`prof_reforges`, alchemy.js reforgeWithEssence):
-- an Enchanter's - 2 Arcane Essence for a Magic piece's line, 5 for a
-- Rare's - and the seed the line is rolled again with, the service's.
CREATE TABLE IF NOT EXISTS prof_reforges (
  player   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  tier     TEXT NOT NULL CHECK (tier IN ('magic', 'rare')),
  essence  INTEGER NOT NULL CHECK (essence > 0),
  seed     INTEGER NOT NULL CHECK (seed >= 0 AND seed <= 4294967295),
  at       INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
