-- WW7-5 (2026-10-25, the owner: "This needs to apply everywhere", "We also need to fully integrate our living world into
-- the entirety of tamriel"; bible/03-World/World-Wide.md WW7-5) - THE TOWN BOOKS PAST THE BAY: a market's listing, order,
-- auction and bid, a guild's writ and contract and a crafter's commission in any of the world's regions - the Bay's 62 and
-- the provinces' 62-70 (formats/mapsTables.js REGION_NAMES; the service's net/nodeLaw.js regionOk).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- SQLite widens no CHECK in place, so the seven tables are rebuilt as 0044 rebuilt the market's - every row carried, every
-- index and trigger made again exactly as the migrations before this one left them, each column a later ALTER TABLE added
-- kept. A row a CASCADE would take when its parent is dropped (a listing's reports, an auction's bids and reports) is kept
-- aside and put back.

-- THE CHILDREN, kept aside: dropping a parent deletes its children's rows first (the cascade runs whatever
-- `defer_foreign_keys` says).
CREATE TABLE IF NOT EXISTS market_reports_keep AS SELECT listing, reporter, at FROM market_reports;
CREATE TABLE IF NOT EXISTS market_auction_reports_keep AS SELECT auction, reporter, at FROM market_auction_reports;
CREATE TABLE IF NOT EXISTS market_bids_keep AS SELECT id, auction, bidder, char_id, region, amount, courier, road, seconds, state, returned, at, rid, n FROM market_bids;

-- A LISTING (0032, 0044; its columns of 0051, 0080, 0106; its triggers of 0137).
CREATE TABLE IF NOT EXISTS market_listings_new (
  id         TEXT PRIMARY KEY,
  seller     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
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
  board_x    INTEGER,
  board_y    INTEGER,
  vendor_map INTEGER,
  vendor_id  TEXT,
  patron_hour INTEGER,
  UNIQUE (seller, rid),
  -- MARKET-ANY: a piece from the pack is one record, its whole stack one unit, for gold alone
  CHECK ((kind = 'material' AND material IS NOT NULL AND provenance IS NULL AND wear IS NULL AND item IS NULL)
      OR (kind = 'piece' AND provenance IS NOT NULL AND material IS NULL AND wear IS NOT NULL AND units = 1 AND item IS NULL)
      OR (kind = 'item' AND item IS NOT NULL AND material IS NULL AND provenance IS NULL AND wear IS NULL AND units = 1
        AND currency = 'gold')),
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_listings_new (id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at, expires_at, state, closed_at, returned, cancel_rid, rn, rid, n, currency, item, board_x, board_y, vendor_map, vendor_id, patron_hour)
  SELECT id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at, expires_at, state, closed_at, returned, cancel_rid, rn, rid, n, currency, item, board_x, board_y, vendor_map, vendor_id, patron_hour FROM market_listings;
DROP TABLE market_listings;
ALTER TABLE market_listings_new RENAME TO market_listings;
CREATE INDEX IF NOT EXISTS idx_market_listings_closed ON market_listings (closed_at);
CREATE INDEX IF NOT EXISTS idx_market_open ON market_listings (state, kind, material, price);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_piece_open ON market_listings (provenance) WHERE state = 'open' AND provenance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings (seller, state);
CREATE INDEX IF NOT EXISTS idx_market_vendor ON market_listings (vendor_map, vendor_id, state);
CREATE INDEX IF NOT EXISTS idx_market_vendor_expiry ON market_listings (region, expires_at) WHERE state = 'open' AND vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_vendor_region ON market_listings (region, at) WHERE state = 'open' AND vendor_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS vendor_board_listed AFTER INSERT ON market_listings WHEN NEW.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT NEW.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_listing AFTER UPDATE OF id, kind, region, material, item, own, bought, units, price, fee, wear, at,
  expires_at, state, currency, seller, vendor_map, vendor_id ON market_listings WHEN OLD.vendor_id IS NOT NULL OR NEW.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r UNION SELECT NEW.region) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_unlisted AFTER DELETE ON market_listings WHEN OLD.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
INSERT OR IGNORE INTO market_reports (listing, reporter, at)
  SELECT k.listing, k.reporter, k.at FROM market_reports_keep k WHERE EXISTS (SELECT 1 FROM market_listings l WHERE l.id = k.listing);
DROP TABLE market_reports_keep;

-- AN ORDER (0032).
CREATE TABLE IF NOT EXISTS market_orders_new (
  id         TEXT PRIMARY KEY,
  poster     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  material   TEXT NOT NULL,
  units      INTEGER NOT NULL CHECK (units >= 1 AND units <= 5000),
  left_units INTEGER NOT NULL CHECK (left_units >= 0),
  price      INTEGER NOT NULL CHECK (price >= 1 AND price <= 1000000),
  escrow     INTEGER NOT NULL CHECK (escrow >= 0),
  at         INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  state      TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'cancelled', 'expired')),
  closed_at  INTEGER,
  returned   INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  UNIQUE (poster, rid),
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_orders_new (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, state, closed_at, returned, rid, n)
  SELECT id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, state, closed_at, returned, rid, n FROM market_orders;
DROP TABLE market_orders;
ALTER TABLE market_orders_new RENAME TO market_orders;
CREATE INDEX IF NOT EXISTS idx_market_orders_closed ON market_orders (closed_at);
CREATE INDEX IF NOT EXISTS idx_market_orders_open ON market_orders (state, region, material, price);
CREATE INDEX IF NOT EXISTS idx_market_orders_poster ON market_orders (poster, state);

-- AN AUCTION (0033; its columns of 0051).
CREATE TABLE IF NOT EXISTS market_auctions_new (
  id         TEXT PRIMARY KEY,
  seller     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  provenance TEXT NOT NULL CHECK (length(provenance) = 16),
  wear       INTEGER NOT NULL CHECK (wear >= 1 AND wear <= 1000),
  opening    INTEGER NOT NULL CHECK (opening >= 1 AND opening <= 1000000),
  fee        INTEGER NOT NULL CHECK (fee >= 1),
  high       INTEGER CHECK (high IS NULL OR high >= 1),
  high_bid   TEXT,
  bids       INTEGER NOT NULL DEFAULT 0 CHECK (bids >= 0),
  at         INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  state      TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'sold', 'unsold', 'cancelled', 'removed')),
  closed_at  INTEGER,
  returned   INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  cancel_rid TEXT,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  bn         TEXT,
  cn         TEXT,
  rn         TEXT,
  board_x    INTEGER,
  board_y    INTEGER,
  tithe      INTEGER NOT NULL DEFAULT 0 CHECK (tithe >= 0),
  UNIQUE (seller, rid),
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_auctions_new (id, seller, char_id, region, provenance, wear, opening, fee, high, high_bid, bids, at, ends_at, state, closed_at, returned, cancel_rid, rid, n, bn, cn, rn, board_x, board_y, tithe)
  SELECT id, seller, char_id, region, provenance, wear, opening, fee, high, high_bid, bids, at, ends_at, state, closed_at, returned, cancel_rid, rid, n, bn, cn, rn, board_x, board_y, tithe FROM market_auctions;
DROP TABLE market_auctions;
ALTER TABLE market_auctions_new RENAME TO market_auctions;
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_auction_open ON market_auctions (provenance) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS idx_market_auctions_open ON market_auctions (state, ends_at);
CREATE INDEX IF NOT EXISTS idx_market_auctions_seller ON market_auctions (seller, state);

-- A BID (0033): its rows the kept ones - the auction's drop took them.
CREATE TABLE IF NOT EXISTS market_bids_new (
  id         TEXT PRIMARY KEY,
  auction    TEXT NOT NULL,
  bidder     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  amount     INTEGER NOT NULL CHECK (amount >= 1),
  courier    INTEGER NOT NULL DEFAULT 0 CHECK (courier >= 0),
  road       INTEGER NOT NULL DEFAULT 0 CHECK (road >= 0),
  seconds    INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  state      TEXT NOT NULL DEFAULT 'high' CHECK (state IN ('high', 'outbid', 'won', 'void')),
  returned   INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  at         INTEGER NOT NULL,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  UNIQUE (bidder, rid),
  FOREIGN KEY (auction) REFERENCES market_auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (bidder) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO market_bids_new (id, auction, bidder, char_id, region, amount, courier, road, seconds, state, returned, at, rid, n)
  SELECT id, auction, bidder, char_id, region, amount, courier, road, seconds, state, returned, at, rid, n FROM market_bids_keep k WHERE EXISTS (SELECT 1 FROM market_auctions a WHERE a.id = k.auction);
DROP TABLE market_bids;
ALTER TABLE market_bids_new RENAME TO market_bids;
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_bid_high ON market_bids (auction) WHERE state = 'high';
CREATE INDEX IF NOT EXISTS idx_market_bids_at ON market_bids (at);
CREATE INDEX IF NOT EXISTS idx_market_bids_auction ON market_bids (auction);
CREATE INDEX IF NOT EXISTS idx_market_bids_bidder ON market_bids (bidder, state, returned);
DROP TABLE market_bids_keep;
INSERT OR IGNORE INTO market_auction_reports (auction, reporter, at)
  SELECT k.auction, k.reporter, k.at FROM market_auction_reports_keep k WHERE EXISTS (SELECT 1 FROM market_auctions a WHERE a.id = k.auction);
DROP TABLE market_auction_reports_keep;

-- A GUILD'S WRIT (0034; its columns of 0061).
CREATE TABLE IF NOT EXISTS guild_writs_new (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  poster      TEXT,
  poster_char TEXT NOT NULL,
  officer     INTEGER NOT NULL CHECK (officer IN (0, 1)),
  week        INTEGER NOT NULL,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  material    TEXT NOT NULL,
  units       INTEGER NOT NULL CHECK (units >= 1 AND units <= 5000),
  left_units  INTEGER NOT NULL CHECK (left_units >= 0 AND left_units <= units),
  pay         INTEGER NOT NULL CHECK (pay >= 1),
  escrow      INTEGER NOT NULL CHECK (escrow >= 0),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  closed_by   TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  cn          TEXT,
  seat        INTEGER,
  camp        INTEGER NOT NULL DEFAULT 0 CHECK (camp IN (0, 1)),
  UNIQUE (poster, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE SET NULL
);
INSERT INTO guild_writs_new (id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow, at, expires_at, state, closed_at, returned, closed_by, rid, n, cn, seat, camp)
  SELECT id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow, at, expires_at, state, closed_at, returned, closed_by, rid, n, cn, seat, camp FROM guild_writs;
DROP TABLE guild_writs;
ALTER TABLE guild_writs_new RENAME TO guild_writs;
CREATE INDEX IF NOT EXISTS idx_guild_writs_due ON guild_writs (state, returned, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_writs_guild ON guild_writs (guild_id, state);
CREATE INDEX IF NOT EXISTS idx_guild_writs_region ON guild_writs (region, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_writs_unreturned ON guild_writs (returned, state);
CREATE INDEX IF NOT EXISTS idx_guild_writs_week ON guild_writs (guild_id, week, officer);

-- A COMMISSION (0034).
CREATE TABLE IF NOT EXISTS commissions_new (
  id          TEXT PRIMARY KEY,
  poster      TEXT NOT NULL,
  poster_char TEXT NOT NULL,
  crafter     TEXT,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  recipe      TEXT NOT NULL,
  quality     INTEGER CHECK (quality IS NULL OR (quality >= 0 AND quality <= 4)),
  pay         INTEGER NOT NULL CHECK (pay >= 1 AND pay <= 1000000),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'declined', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  provenance  TEXT CHECK (provenance IS NULL OR length(provenance) = 16),
  filled_char TEXT,
  tax         INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0),
  fill_rid    TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  fn          TEXT,
  cn          TEXT,
  UNIQUE (poster, rid),
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (crafter) REFERENCES players(id) ON DELETE SET NULL
);
INSERT INTO commissions_new (id, poster, poster_char, crafter, region, recipe, quality, pay, at, expires_at, state, closed_at, returned, provenance, filled_char, tax, fill_rid, rid, n, fn, cn)
  SELECT id, poster, poster_char, crafter, region, recipe, quality, pay, at, expires_at, state, closed_at, returned, provenance, filled_char, tax, fill_rid, rid, n, fn, cn FROM commissions;
DROP TABLE commissions;
ALTER TABLE commissions_new RENAME TO commissions;
CREATE INDEX IF NOT EXISTS idx_commissions_crafter ON commissions (crafter, state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_fill_rid ON commissions (crafter, fill_rid) WHERE fill_rid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_poster ON commissions (poster, state);
CREATE INDEX IF NOT EXISTS idx_commissions_region ON commissions (region, state, expires_at);

-- A GUILD'S CONTRACT (0071, 0091).
CREATE TABLE IF NOT EXISTS guild_contracts_new (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  poster      TEXT,
  poster_char TEXT NOT NULL,
  officer     INTEGER NOT NULL CHECK (officer IN (0, 1)),
  week        INTEGER NOT NULL,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),
  kind        TEXT NOT NULL CHECK (kind IN ('raid')),
  deeds       INTEGER NOT NULL CHECK (deeds >= 1 AND deeds <= 500),
  left_deeds  INTEGER NOT NULL CHECK (left_deeds >= 0 AND left_deeds <= deeds),
  pay         INTEGER NOT NULL CHECK (pay >= 1 AND pay <= 50),
  escrow      INTEGER NOT NULL CHECK (escrow >= 0),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  closed_by   TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  cn          TEXT,
  UNIQUE (poster, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE SET NULL
);
INSERT INTO guild_contracts_new (id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow, at, expires_at, state, closed_at, returned, closed_by, rid, n, cn)
  SELECT id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow, at, expires_at, state, closed_at, returned, closed_by, rid, n, cn FROM guild_contracts;
DROP TABLE guild_contracts;
ALTER TABLE guild_contracts_new RENAME TO guild_contracts;
CREATE INDEX IF NOT EXISTS idx_guild_contracts_due ON guild_contracts (state, returned, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_guild ON guild_contracts (guild_id, state);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_open_due ON guild_contracts (state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_region ON guild_contracts (region, kind, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_unreturned ON guild_contracts (returned, state);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_week ON guild_contracts (guild_id, week, officer);
