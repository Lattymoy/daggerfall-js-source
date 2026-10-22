-- ESSENCE-LOOSE (FIELD BUGS 2026-10-20h, the Discord's #bug-reports: a player's Arcane Essence "bought with gold";
-- bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md ESSENCE-LOOSE, bible/06-Systems/Professions-Arc.md section 37).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- reads the new column (acct166).
--
-- AUDIT BAG-CRAFT A1 (migration 0097) walled a piece made or raised with LOOSE goods - a station's put-in from the pack
-- that the service never handed out - by writing `products.bought_with = 'gold'`: such a piece lists for gold alone, as a
-- pack's piece does. But 0041 wrote that column as the piece's LAST PURCHASE, and the disenchant read it so: the piece's
-- Arcane Essence went into the Stores as GOLD's, "bought with gold" on the Stores page, and the Reforge, a station,
-- refused it - a player's own ring, made of a Gold Bar from the pack, came apart into Essence no station would take.
--
-- THE PIECE SAYS WHY IT IS WALLED: `loose` 1 where its gold wall is the stations' - made or raised with loose goods, and
-- not bought with gold since - and 0 for a piece walled by a gold purchase (or not walled at all). The market's doors
-- still read `bought_with` alone; the disenchant reads both, and gives a loose-walled piece's Essence LOOSE (a station's,
-- as a smelt's products of loose goods are), a gold-bought piece's GOLD (10.8's wall, as before).
ALTER TABLE products ADD COLUMN loose INTEGER NOT NULL DEFAULT 0 CHECK (loose IN (0, 1));
-- THE PIECES STANDING: a piece walled to gold that its owner never bought with gold was walled by its goods. Every gold
-- purchase of a piece is a `market_sales` row (kind 'piece', currency 'gold', its buyer the piece's new owner - market.js
-- buyWithGold), and the market keeps them 90 days (pruneMarketHistory): GOLD-MARKET opened on 2026-09-30, so every one
-- ever made is still there.
UPDATE products SET loose = 1
  WHERE bought_with = 'gold'
    AND NOT EXISTS (SELECT 1 FROM market_sales s WHERE s.kind = 'piece' AND s.currency = 'gold' AND s.provenance = products.provenance AND s.buyer = products.owner);

-- A DISENCHANT'S ORIGIN MAY BE LOOSE. SQLite cannot widen a CHECK in place: the table is rebuilt, every row carried (0041's
-- and 0097's way) - and a disenchant already made of a loose-walled piece is named so: its piece's row is gone, so the
-- same rule reads the sales (gold, and no gold purchase of the piece by the account that disenchanted it).
CREATE TABLE IF NOT EXISTS prof_disenchants_new (
  player     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  provenance TEXT NOT NULL UNIQUE CHECK (length(provenance) = 16),
  recipe     TEXT NOT NULL,
  points     INTEGER NOT NULL CHECK (points >= 0),
  essence    INTEGER NOT NULL CHECK (essence >= 1),
  origin     TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold', 'loose')),
  xp         INTEGER NOT NULL CHECK (xp >= 0),
  at         INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO prof_disenchants_new (player, rid, char_id, provenance, recipe, points, essence, origin, xp, at, n)
  SELECT d.player, d.rid, d.char_id, d.provenance, d.recipe, d.points, d.essence,
    CASE WHEN d.origin = 'gold' AND NOT EXISTS (SELECT 1 FROM market_sales s WHERE s.kind = 'piece' AND s.currency = 'gold' AND s.provenance = d.provenance AND s.buyer = d.player)
      THEN 'loose' ELSE d.origin END,
    d.xp, d.at, d.n
  FROM prof_disenchants d;
DROP TABLE prof_disenchants;
ALTER TABLE prof_disenchants_new RENAME TO prof_disenchants;

-- THE ESSENCE IT GAVE, MOVED: a character's gold Essence is moved to loose as far as its disenchants of loose-walled pieces
-- gave it - at most what the Stores still hold of gold's (gold Essence leaves the Stores only by a gold listing, and which
-- units went is not kept: the ones still held are taken as the misnamed ones first). Every origin fills the one 5,000, so
-- the room is as it was.
INSERT INTO prof_stores (player, char_id, material, origin, qty)
  SELECT s.player, s.char_id, s.material, 'loose', MIN(s.qty, d.n)
  FROM prof_stores s JOIN (SELECT player, char_id, SUM(essence) AS n FROM prof_disenchants WHERE origin = 'loose' GROUP BY player, char_id) d
    ON d.player = s.player AND d.char_id = s.char_id
  WHERE s.material = 'essence:arcane' AND s.origin = 'gold' AND s.qty > 0
  ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty;
UPDATE prof_stores SET qty = qty - MIN(qty, (SELECT SUM(d.essence) FROM prof_disenchants d WHERE d.player = prof_stores.player AND d.char_id = prof_stores.char_id AND d.origin = 'loose'))
  WHERE material = 'essence:arcane' AND origin = 'gold'
    AND EXISTS (SELECT 1 FROM prof_disenchants d WHERE d.player = prof_stores.player AND d.char_id = prof_stores.char_id AND d.origin = 'loose');
DELETE FROM prof_stores WHERE material = 'essence:arcane' AND origin = 'gold' AND qty = 0;
