-- LW15 (2026-10-09, bible/06-Systems/Living-World-II.md "LW15"): THE PATRONS - the living world's townsfolk buying from a
-- player's hired trader, decided here by the law both ends read (src/net/patronLaw.js). A trader's listing keeps the
-- last hour its town's patrons were reckoned for (`patron_hour`); a patron's purchase is its own row (the buyer a
-- town's resident the client deals the seed to, never an account - market_sales' buyer is a player's), the piece gone
-- from the realm; and the gold the service's own faucets pay is kept by the hour and kind, for the wealth measure
-- (budget.js FAUCET_KINDS).
ALTER TABLE market_listings ADD COLUMN patron_hour INTEGER;
CREATE TABLE IF NOT EXISTS market_patron_sales (
  listing  TEXT PRIMARY KEY,
  map      INTEGER NOT NULL,
  hour     INTEGER NOT NULL,
  minute   INTEGER NOT NULL CHECK (minute >= 0 AND minute < 60),
  seed     INTEGER NOT NULL,
  seller   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  region   INTEGER NOT NULL,
  price    INTEGER NOT NULL CHECK (price >= 1),
  tax      INTEGER NOT NULL CHECK (tax >= 0),
  fee      INTEGER NOT NULL CHECK (fee >= 0),
  gets     INTEGER NOT NULL CHECK (gets >= 0),
  at       INTEGER NOT NULL,
  day      INTEGER NOT NULL,
  -- AUDIT LW-II P9: the house the trader stood in at the sale, kept with it - a piece's id is its owner's client's, so
  -- another's piece of the same id in the same town told every sale twice, once at its own door
  building_key INTEGER,
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patron_sales_town ON market_patron_sales (map, hour);
CREATE INDEX IF NOT EXISTS idx_patron_sales_seller ON market_patron_sales (seller, day);
-- AUDIT LW-II P6: the region's read of its last day's sales (it walked the table whole), and the market's prune by the day
CREATE INDEX IF NOT EXISTS idx_patron_sales_region ON market_patron_sales (region, at);
CREATE INDEX IF NOT EXISTS idx_patron_sales_day ON market_patron_sales (day);
CREATE TABLE IF NOT EXISTS realm_faucets (
  hour  INTEGER NOT NULL,
  kind  TEXT NOT NULL,
  gold  INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  n     INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (hour, kind)
);
