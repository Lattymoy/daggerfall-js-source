-- MARKET-ANY (FIELD BUGS 2026-10-01, the field: "The market doesn't allow you to list any item that isnt bound") - A
-- PIECE FROM THE PACK, FOR GOLD (src/net/marketLaw.js goodRefusal; server-account/src/market.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- A listing, a sale and a delivery learn a third kind beside a Stores material and a crafted piece: `item`, a piece of
-- a realm character's pack - its RECORD, as the seller's realm record held it, rides the listing (`item`, JSON) and the
-- delivery that brings it to its buyer or back to its seller. SQLite widens no CHECK in place, so the three tables are
-- rebuilt, every row carried and every index made again exactly as 0032 and 0043 (SCALE1) wrote them.

-- A LISTING. `market_reports` names a listing by FOREIGN KEY ON DELETE CASCADE, and dropping the old table deletes its
-- rows first (the cascade runs whatever `defer_foreign_keys` says) - so the reports are kept aside and put back.
CREATE TABLE IF NOT EXISTS market_reports_keep AS SELECT listing, reporter, at FROM market_reports;
CREATE TABLE IF NOT EXISTS market_listings_new (
  id         TEXT PRIMARY KEY,
  seller     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region < 62),
  kind       TEXT NOT NULL CHECK (kind IN ('material', 'piece', 'item')),
  material   TEXT,
  provenance TEXT,
  units      INTEGER NOT NULL CHECK (units >= 1 AND units <= 5000),
  own        INTEGER NOT NULL DEFAULT 0 CHECK (own >= 0),
  bought     INTEGER NOT NULL DEFAULT 0 CHECK (bought >= 0),
  price      INTEGER NOT NULL CHECK (price >= 1 AND price <= 1000000),
  wear       INTEGER CHECK (wear IS NULL OR (wear >= 1 AND wear <= 1000)),
  fee        INTEGER NOT NULL CHECK (fee >= 1),
  at         INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  state      TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'sold', 'cancelled', 'expired', 'removed')),
  closed_at  INTEGER,
  returned   INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  cancel_rid TEXT,
  rn         TEXT,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'marks' CHECK (currency IN ('marks', 'gold')),
  item       TEXT,
  UNIQUE (seller, rid),
  -- MARKET-ANY: a piece from the pack is one record, its whole stack one unit, for gold alone
  CHECK ((kind = 'material' AND material IS NOT NULL AND provenance IS NULL AND wear IS NULL AND item IS NULL)
      OR (kind = 'piece' AND provenance IS NOT NULL AND material IS NULL AND wear IS NOT NULL AND units = 1 AND item IS NULL)
      OR (kind = 'item' AND item IS NOT NULL AND material IS NULL AND provenance IS NULL AND wear IS NULL AND units = 1
        AND currency = 'gold')),
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_listings_new (id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at,
    expires_at, state, closed_at, returned, cancel_rid, rn, rid, n, currency)
  SELECT id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at,
    expires_at, state, closed_at, returned, cancel_rid, rn, rid, n, currency FROM market_listings;
DROP TABLE market_listings;
ALTER TABLE market_listings_new RENAME TO market_listings;
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_piece_open ON market_listings (provenance) WHERE state = 'open' AND provenance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_open ON market_listings (state, kind, material, price);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings (seller, state);
CREATE INDEX IF NOT EXISTS idx_market_listings_closed ON market_listings (closed_at);   -- SCALE1 (0043)
INSERT OR IGNORE INTO market_reports (listing, reporter, at)
  SELECT k.listing, k.reporter, k.at FROM market_reports_keep k WHERE EXISTS (SELECT 1 FROM market_listings l WHERE l.id = k.listing);
DROP TABLE market_reports_keep;

-- A SALE: its kind as its listing's.
CREATE TABLE IF NOT EXISTS market_sales_new (
  buyer       TEXT NOT NULL,
  rid         TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  listing     TEXT NOT NULL,
  seller      TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('material', 'piece', 'item')),
  material    TEXT,
  provenance  TEXT,
  units       INTEGER NOT NULL CHECK (units >= 1),
  price       INTEGER NOT NULL CHECK (price >= 1),
  total       INTEGER NOT NULL CHECK (total >= 1),
  tax         INTEGER NOT NULL CHECK (tax >= 0),
  tithe       INTEGER NOT NULL DEFAULT 0 CHECK (tithe >= 0),
  courier     INTEGER NOT NULL DEFAULT 0 CHECK (courier >= 0),
  road        INTEGER NOT NULL DEFAULT 0 CHECK (road >= 0),
  from_region INTEGER NOT NULL,
  to_region   INTEGER NOT NULL,
  arrives_at  INTEGER NOT NULL,
  delivered   INTEGER NOT NULL DEFAULT 0 CHECK (delivered IN (0, 1)),
  dn          TEXT,
  at          INTEGER NOT NULL,
  day         INTEGER NOT NULL,
  n           TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'marks' CHECK (currency IN ('marks', 'gold')),
  fee         INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
  PRIMARY KEY (buyer, rid),
  FOREIGN KEY (buyer) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_sales_new (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, tithe, courier,
    road, from_region, to_region, arrives_at, delivered, dn, at, day, n, currency, fee)
  SELECT buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, tithe, courier,
    road, from_region, to_region, arrives_at, delivered, dn, at, day, n, currency, fee FROM market_sales;
DROP TABLE market_sales;
ALTER TABLE market_sales_new RENAME TO market_sales;
CREATE INDEX IF NOT EXISTS idx_market_sales_road ON market_sales (buyer, delivered, arrives_at);
CREATE INDEX IF NOT EXISTS idx_market_sales_seller ON market_sales (seller, at);
CREATE INDEX IF NOT EXISTS idx_market_sales_day ON market_sales (day);

-- A DELIVERY: a crafted piece (its provenance and wear, minted again from its record at the pack) or, MARKET-ANY, a
-- piece from a pack (its record, put into the collecting character's realm record whole).
CREATE TABLE IF NOT EXISTS market_deliveries_new (
  id          TEXT PRIMARY KEY,
  player      TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  provenance  TEXT,
  wear        INTEGER CHECK (wear IS NULL OR (wear >= 1 AND wear <= 1000)),
  why         TEXT NOT NULL CHECK (why IN ('bought', 'returned')),
  from_region INTEGER,
  arrives_at  INTEGER NOT NULL,
  collected   INTEGER NOT NULL DEFAULT 0 CHECK (collected IN (0, 1)),
  rid         TEXT,
  at          INTEGER NOT NULL,
  item        TEXT,
  CHECK ((item IS NULL AND provenance IS NOT NULL AND wear IS NOT NULL) OR (item IS NOT NULL AND provenance IS NULL AND wear IS NULL)),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_deliveries_new (id, player, char_id, provenance, wear, why, from_region, arrives_at, collected, rid, at)
  SELECT id, player, char_id, provenance, wear, why, from_region, arrives_at, collected, rid, at FROM market_deliveries;
DROP TABLE market_deliveries;
ALTER TABLE market_deliveries_new RENAME TO market_deliveries;
CREATE INDEX IF NOT EXISTS idx_market_deliveries_player ON market_deliveries (player, collected);
CREATE INDEX IF NOT EXISTS idx_market_deliveries_provenance ON market_deliveries (provenance, collected);   -- SCALE1 (0043)
CREATE INDEX IF NOT EXISTS idx_market_deliveries_at ON market_deliveries (collected, at);   -- SCALE1 (0043)
