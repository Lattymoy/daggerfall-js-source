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
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patron_sales_town ON market_patron_sales (map, hour);
CREATE INDEX IF NOT EXISTS idx_patron_sales_seller ON market_patron_sales (seller, day);
CREATE TABLE IF NOT EXISTS realm_faucets (
  hour  INTEGER NOT NULL,
  kind  TEXT NOT NULL,
  gold  INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  n     INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (hour, kind)
);
