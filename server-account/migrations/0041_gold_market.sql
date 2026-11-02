-- GOLD-MARKET (2026-09-30, Mac: "Allow trading with gold or drakes on the marketplace"; "Gold listings, walled")
-- (bible/06-Systems/Professions-Arc.md 10.8; src/net/marketLaw.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE STORES' THIRD ORIGIN: `gold`, units bought on the market with gold. They go to the pack or back on the market for
-- gold and nowhere else (the wall - no station, craft, writ, fill or Drakes listing reads them), so the Drakes a player
-- holds never come of gold (law 8). SQLite cannot widen a CHECK in place: the table is rebuilt, every row carried.
CREATE TABLE IF NOT EXISTS prof_stores_new (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  origin   TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold')),
  qty      INTEGER NOT NULL CHECK (qty >= 0 AND qty <= 5000),
  PRIMARY KEY (player, char_id, material, origin),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO prof_stores_new (player, char_id, material, origin, qty) SELECT player, char_id, material, origin, qty FROM prof_stores;
DROP TABLE prof_stores;
ALTER TABLE prof_stores_new RENAME TO prof_stores;

-- A LISTING'S CURRENCY: Drakes (`marks`, every listing before this) or gold. A gold listing's `bought` column holds its
-- GOLD units (a gold listing never holds units bought with Drakes - marketLaw listableOrigins), so a listing's units
-- left stay `own + bought` whatever its currency.
ALTER TABLE market_listings ADD COLUMN currency TEXT NOT NULL DEFAULT 'marks' CHECK (currency IN ('marks', 'gold'));
-- A SALE'S CURRENCY, and a gold sale's share of its listing's fee (a gold listing pays its fee out of each sale).
ALTER TABLE market_sales ADD COLUMN currency TEXT NOT NULL DEFAULT 'marks' CHECK (currency IN ('marks', 'gold'));
ALTER TABLE market_sales ADD COLUMN fee INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0);
-- A PIECE'S LAST PURCHASE: NULL for one never bought (its maker's, or a writ's), else the currency it was bought in on
-- the market, at auction or by a commission. A piece bought with gold lists for gold alone; one bought with Drakes lists
-- for Drakes alone.
ALTER TABLE products ADD COLUMN bought_with TEXT CHECK (bought_with IS NULL OR bought_with IN ('marks', 'gold'));

-- THE GOLD A CHARACTER'S SALES HOLD FOR IT, uncollected: the buyers' records paid it; the seller's own record collects
-- it into a bank account (a realm act). A character's, not an account's: gold is a character's.
CREATE TABLE IF NOT EXISTS market_gold (
  player  TEXT NOT NULL,
  char_id TEXT NOT NULL,
  gold    INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0 AND gold <= 100000000),
  PRIMARY KEY (player, char_id),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- THE GOLD PRICES (10.2's History, in gold): a gold sale's price a unit, a day - apart from the Drakes' table, so the
-- Drakes' medians and the weekly report never read a gold price.
CREATE TABLE IF NOT EXISTS market_gold_prices (
  day      INTEGER NOT NULL,
  material TEXT NOT NULL,
  price    INTEGER NOT NULL CHECK (price >= 1),
  units    INTEGER NOT NULL CHECK (units >= 1),
  PRIMARY KEY (day, material, price)
);
