-- PROF5b (2026-09-29, Mac: "Go") - TIMED AUCTIONS FOR MASTERWORKS (bible/06-Systems/Professions-Arc.md 10.2, 27).
--
-- An AUCTION: one crafted Masterwork (products.quality 4) posted by its owner at an opening bid on the boards of a
-- region, for 24 hours - its end moved two minutes on by a bid in its last two. `high` the standing bid and `high_bid`
-- its row; `state` open, sold (its highest bid bought it), unsold (none came), cancelled (by its seller, no bid
-- standing) or removed (by a moderator); `returned` once the piece is back with its seller or handed to its winner.
-- `n` the post's nonce, `bn` the last bid's (a bid's decision is this row's own update - one standing bid an auction is
-- an index, so the new bid's row is written after the old one is outbid), `cn` the close's (or a moderator's removal),
-- `rn` a cancel's or a return's; `cancel_rid` the seller's cancel, answered again the same.
CREATE TABLE IF NOT EXISTS market_auctions (
  id         TEXT PRIMARY KEY,
  seller     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region < 62),
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
  UNIQUE (seller, rid),
  FOREIGN KEY (seller) REFERENCES players(id) ON DELETE CASCADE
);
-- one live auction a piece (a listing's own index keeps it off the listings; `products.listed` keeps it off both)
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_auction_open ON market_auctions (provenance) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS idx_market_auctions_open ON market_auctions (state, ends_at);
CREATE INDEX IF NOT EXISTS idx_market_auctions_seller ON market_auctions (seller, state);

-- A BID: an amount and its courier (from the bid's board's region to the auction's, for one piece), escrowed on the
-- ledger's `escrow` end under the bid's own id while it stands. `state` high (it leads), outbid, won, lost never
-- stands - an outbid bid is returned - or void (its auction removed); `returned` once its escrow is back with its
-- bidder. `road` and `seconds` the courier's, so the winner's delivery arrives when it would have.
CREATE TABLE IF NOT EXISTS market_bids (
  id         TEXT PRIMARY KEY,
  auction    TEXT NOT NULL,
  bidder     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  region     INTEGER NOT NULL CHECK (region >= 0 AND region < 62),
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
-- one standing bid an auction
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_bid_high ON market_bids (auction) WHERE state = 'high';
CREATE INDEX IF NOT EXISTS idx_market_bids_bidder ON market_bids (bidder, state, returned);

-- A REPORT on an auction (section 20), as on a listing - its own table, the listings' is keyed to market_listings.
CREATE TABLE IF NOT EXISTS market_auction_reports (
  auction  TEXT NOT NULL,
  reporter TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (auction, reporter),
  FOREIGN KEY (auction) REFERENCES market_auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter) REFERENCES players(id) ON DELETE CASCADE
);
