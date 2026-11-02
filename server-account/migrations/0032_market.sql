-- PROF5 (2026-09-29, Mac: "Continue") - THE MARKET: listings, regional markets, couriers, buy orders and history
-- (bible/06-Systems/Professions-Arc.md 10.2-10.5, 14, 26).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Every act below is
-- decided by ONE statement that writes its row with a fresh nonce `n`; everything that follows is keyed on it
-- (server-account/src/market.js), as PROF1-4's acts are.

-- THE ESCROW END (PROF0 26). A buy order's Marks are held while it stands, and the ledger had nowhere to hold them:
-- its ends were mint / account / guild and burn / account / guild. A third end, `escrow`, its id the order's, moves no
-- balance by trigger (as mint and burn move none) - the order row holds what is left, moved in each line's batch.
-- SQLite widens no CHECK in place: the ledger is rebuilt, every line carried with its seq, its indexes and its four
-- triggers made again exactly as 0025 wrote them.
CREATE TABLE IF NOT EXISTS marks_ledger_new (
  seq      INTEGER PRIMARY KEY,
  src_kind TEXT NOT NULL CHECK (src_kind IN ('mint', 'account', 'guild', 'escrow')),
  src_id   TEXT,
  dst_kind TEXT NOT NULL CHECK (dst_kind IN ('burn', 'account', 'guild', 'escrow')),
  dst_id   TEXT,
  kind     TEXT NOT NULL,
  amount   INTEGER NOT NULL CHECK (amount > 0),
  day      INTEGER NOT NULL,
  at       INTEGER NOT NULL,
  actor    TEXT NOT NULL,
  who      TEXT,
  rid      TEXT NOT NULL,
  UNIQUE (actor, rid)
);
INSERT INTO marks_ledger_new (seq, src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
  SELECT seq, src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid FROM marks_ledger;
DROP TABLE marks_ledger;
ALTER TABLE marks_ledger_new RENAME TO marks_ledger;
CREATE INDEX IF NOT EXISTS idx_marks_dst ON marks_ledger (dst_id, kind, day);
CREATE INDEX IF NOT EXISTS idx_marks_src ON marks_ledger (src_id, kind, day);
CREATE INDEX IF NOT EXISTS idx_marks_day ON marks_ledger (day);
CREATE TRIGGER IF NOT EXISTS marks_line_pays_account AFTER INSERT ON marks_ledger WHEN NEW.src_kind = 'account'
BEGIN
  UPDATE marks SET balance = balance - NEW.amount WHERE account = NEW.src_id;
END;
CREATE TRIGGER IF NOT EXISTS marks_line_pays_guild AFTER INSERT ON marks_ledger WHEN NEW.src_kind = 'guild'
BEGIN
  UPDATE guild_marks SET balance = balance - NEW.amount WHERE guild_id = NEW.src_id;
END;
CREATE TRIGGER IF NOT EXISTS marks_line_pays_to_account AFTER INSERT ON marks_ledger WHEN NEW.dst_kind = 'account'
BEGIN
  INSERT INTO marks (account, balance) VALUES (NEW.dst_id, NEW.amount)
    ON CONFLICT (account) DO UPDATE SET balance = balance + excluded.balance;
END;
CREATE TRIGGER IF NOT EXISTS marks_line_pays_to_guild AFTER INSERT ON marks_ledger WHEN NEW.dst_kind = 'guild'
BEGIN
  INSERT INTO guild_marks (guild_id, balance) VALUES (NEW.dst_id, NEW.amount)
    ON CONFLICT (guild_id) DO UPDATE SET balance = balance + excluded.balance;
END;

-- THE ROAD (PROF0 26): a region's hub town's map pixel, witnessed as a pixel's climate is - the kind `hub`, keyed by
-- the region, its report "x,y" (src/net/marketLaw.js hubPixel). The table is rebuilt to admit the kind.
CREATE TABLE IF NOT EXISTS world_witness_new (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel', 'dungeon', 'hub')),
  key     TEXT NOT NULL,
  account TEXT NOT NULL,
  report  TEXT NOT NULL,
  region  INTEGER,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO world_witness_new (kind, key, account, report, region, at)
  SELECT kind, key, account, report, region, at FROM world_witness;
DROP TABLE world_witness;
ALTER TABLE world_witness_new RENAME TO world_witness;
CREATE INDEX IF NOT EXISTS idx_world_witness_region ON world_witness (kind, region);

-- EVERY CRAFTED PIECE, FOREVER (PROF0 20: "the Marks ledger and `products` forever"). FOUND: 0030 cascaded a piece's
-- row away with its owner's account. A sale now moves the owner (section 18), so the row is rebuilt without the
-- cascade: a piece outlives its owner's account, and an owner that is gone never lists it again.
CREATE TABLE IF NOT EXISTS products_new (
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
  marked     INTEGER NOT NULL DEFAULT 0 CHECK (marked IN (0, 1))
);
INSERT INTO products_new (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, listed, marked)
  SELECT provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, listed, marked FROM products;
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;
CREATE INDEX IF NOT EXISTS idx_products_owner ON products (owner);

-- A LISTING (10.2): a Stores material - its units left, own and bought apart, so a return gives each back with the
-- origin it left with - or a crafted piece (its provenance id and its wear, in thousandths; its one unit counted own,
-- so a purchase takes it as it takes a material's), at a price (a unit's, or
-- the piece's whole), standing on the boards of its region until `expires_at`. `state` open, sold, cancelled, expired
-- or removed; `returned` once its goods are back (a material's units in the Stores, a piece's delivery written or
-- answered); `cancel_rid` the cancel's request, answered again the same; `rn` the nonce a return was decided on.
CREATE TABLE IF NOT EXISTS market_listings (
  id         TEXT PRIMARY KEY,
  seller     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region < 62),
  kind       TEXT NOT NULL CHECK (kind IN ('material', 'piece')),
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
  UNIQUE (seller, rid),
  CHECK ((kind = 'material' AND material IS NOT NULL AND provenance IS NULL AND wear IS NULL)
      OR (kind = 'piece' AND provenance IS NOT NULL AND material IS NULL AND wear IS NOT NULL AND units = 1)),
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
-- one live listing a piece (section 18: a duplicated copy can never be sold beside its original)
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_piece_open ON market_listings (provenance) WHERE state = 'open' AND provenance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_open ON market_listings (state, kind, material, price);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings (seller, state);

-- A SALE (10.4): a purchase's row - its buyer's request, what it bought and for how much, the tax, the Tithe and the
-- courier, the road's pixels and when the goods arrive. `delivered` once a material is in the buyer's Stores or a
-- piece is handed (at once here, or its delivery written); `dn` the nonce an arrival was decided on.
CREATE TABLE IF NOT EXISTS market_sales (
  buyer       TEXT NOT NULL,
  rid         TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  listing     TEXT NOT NULL,
  seller      TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('material', 'piece')),
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
  PRIMARY KEY (buyer, rid),
  FOREIGN KEY (buyer) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_sales_road ON market_sales (buyer, delivered, arrives_at);
CREATE INDEX IF NOT EXISTS idx_market_sales_seller ON market_sales (seller, at);
CREATE INDEX IF NOT EXISTS idx_market_sales_day ON market_sales (day);

-- A PIECE ON ITS WAY to a character's pack (PROF0 26): one bought by courier (`bought`, keyed by a fresh id) or one
-- whose listing expired or was removed (`returned`, keyed by the listing's id). Collected once by its character's
-- book - `rid` the collect's request, answered again the same.
CREATE TABLE IF NOT EXISTS market_deliveries (
  id         TEXT PRIMARY KEY,
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  provenance TEXT NOT NULL,
  wear       INTEGER NOT NULL CHECK (wear >= 1 AND wear <= 1000),
  why        TEXT NOT NULL CHECK (why IN ('bought', 'returned')),
  from_region INTEGER,
  arrives_at INTEGER NOT NULL,
  collected  INTEGER NOT NULL DEFAULT 0 CHECK (collected IN (0, 1)),
  rid        TEXT,
  at         INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_deliveries_player ON market_deliveries (player, collected);

-- A BUY ORDER (10.3): a material asked at a unit price in a region, its Marks escrowed when it is posted - `escrow`
-- what is left of them, `left_units` what is still asked. `state` open, filled, cancelled or expired; `returned` once
-- the rest of the escrow is back (one line, keyed on the order's own id, so it happens once).
CREATE TABLE IF NOT EXISTS market_orders (
  id         TEXT PRIMARY KEY,
  poster     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region < 62),
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
CREATE INDEX IF NOT EXISTS idx_market_orders_open ON market_orders (state, region, material, price);
CREATE INDEX IF NOT EXISTS idx_market_orders_poster ON market_orders (poster, state);

-- A FILL (10.3): a filler's request against an order - the units it gave from its Stores, the pay out of the escrow
-- and the tax burnt from it.
CREATE TABLE IF NOT EXISTS market_fills (
  filler   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  order_id TEXT NOT NULL,
  poster   TEXT NOT NULL,
  material TEXT NOT NULL,
  units    INTEGER NOT NULL CHECK (units >= 1),
  price    INTEGER NOT NULL CHECK (price >= 1),
  pay      INTEGER NOT NULL CHECK (pay >= 1),
  tax      INTEGER NOT NULL CHECK (tax >= 0),
  at       INTEGER NOT NULL,
  day      INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (filler, rid),
  FOREIGN KEY (filler) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_fills_poster ON market_fills (poster, at);

-- THE PRICES (10.2's History): every sale or fill of a material adds its units at its unit price to its UTC day. A
-- material's median is its middle unit's price over seven days (marketLaw.js medianOf). Kept 90 days (section 20).
CREATE TABLE IF NOT EXISTS market_prices (
  day      INTEGER NOT NULL,
  material TEXT NOT NULL,
  price    INTEGER NOT NULL CHECK (price >= 1),
  units    INTEGER NOT NULL CHECK (units >= 1),
  PRIMARY KEY (day, material, price)
);

-- A REPORT on a listing (section 20): once a reader; counted for the moderators, hiding nothing - a listing carries
-- no words.
CREATE TABLE IF NOT EXISTS market_reports (
  listing  TEXT NOT NULL,
  reporter TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (listing, reporter),
  FOREIGN KEY (listing) REFERENCES market_listings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter) REFERENCES players(id) ON DELETE CASCADE
);
