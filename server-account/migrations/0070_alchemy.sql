-- PROF12 (2026-10-02) - ALCHEMY AND THE ENCHANTING LAYER; DISENCHANTING
-- (bible/06-Systems/Professions-Arc.md 3.3, 4.3, 9.3; section 37).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- AN UNBRUISED HERB (4.3, 5.2: "an unbruised herb (+5% Alchemy Potent chance each, 9.3)"). The Stores keep a unit's origin
-- and nothing else (section 7), so the herbs a character picked unbruised - an uncommon or rare herb's steady hand clean,
-- every one an Apothecary's Friend's - are counted beside them, a material at a time: a harvest adds its units, a brew
-- spends what it reckoned (never below none). DECIDED: a brew counts at most the own units it spent of the herb (a bought
-- herb was nobody's steady hand), and at most this count.
CREATE TABLE IF NOT EXISTS prof_unbruised (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (player, char_id, material),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- A BREW (9.3: "the brewing act at an alchemy station"): its request's row, the one statement that decides it - the
-- potion (DFU's recipe's name, src/systems/potionRecipes.js), the cauldron as the Stores held it (`keys`, JSON - an herb's
-- group the brewer's), the potions it made (1, 2 or 3), Potent's share (0, or +25 / a Master Alchemist's +40), the
-- unbruised herbs it reckoned, the Apothecary's steps it was brewed under, the Alchemy XP credited and whether it was the
-- character's first of the potion (+500). Read back to answer a request asked twice.
CREATE TABLE IF NOT EXISTS prof_brews (
  player    TEXT NOT NULL,
  rid       TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  potion    TEXT NOT NULL,
  keys      TEXT NOT NULL,
  count     INTEGER NOT NULL CHECK (count BETWEEN 1 AND 3),
  potent    INTEGER NOT NULL CHECK (potent IN (0, 25, 40)),
  unbruised INTEGER NOT NULL DEFAULT 0 CHECK (unbruised >= 0),
  steps     INTEGER NOT NULL DEFAULT 0 CHECK (steps >= 0),
  xp        INTEGER NOT NULL CHECK (xp >= 0),
  first     INTEGER NOT NULL CHECK (first IN (0, 1)),
  at        INTEGER NOT NULL,
  n         TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- the character's first of a potion, read in the decision
CREATE INDEX IF NOT EXISTS idx_prof_brews_potion ON prof_brews (player, char_id, potion);

-- A DISENCHANT (9.3: "a provenance item the player owns becomes Arcane Essence, one per 100 enchantment points it carried
-- (Disenchanter x2), into the Stores, and is gone"): its request's row - the piece (its provenance, ONE disenchant a piece:
-- UNIQUE), its recipe, the points the service reckoned from its record, the Essence it gave and their origin (own - a piece
-- this character made and nobody bought; gold - one bought with gold, walled as gold's goods are; else bought), the
-- Enchanting XP credited. The piece's `products` row is deleted in the same batch: it lists, auctions and fills nothing
-- again.
CREATE TABLE IF NOT EXISTS prof_disenchants (
  player     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  provenance TEXT NOT NULL UNIQUE CHECK (length(provenance) = 16),
  recipe     TEXT NOT NULL,
  points     INTEGER NOT NULL CHECK (points >= 0),
  essence    INTEGER NOT NULL CHECK (essence >= 1),
  origin     TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold')),
  xp         INTEGER NOT NULL CHECK (xp >= 0),
  at         INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
