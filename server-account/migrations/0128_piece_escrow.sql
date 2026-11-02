-- INT19 (2026-10-17, the INTEGRITY arc's lane 1, its open item - bible/06-Systems/Integrity-Arc.md section 7 and "What lane
-- 1 leaves open"; server-account/src/market.js): A CRAFTED PIECE LISTED OR AUCTIONED LEAVES ITS SELLER'S REALM RECORD.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- reads this table.

-- THE RECORD'S OWN PIECE, IN THE MARKET'S HANDS: a crafted piece's record as its seller's realm record held it, taken
-- out in the listing's (or the auction's) own batch (realm.js prepareRealmRecord, `escrow`: the ledger holds it the
-- market's). One row a provenance - one live listing or auction a piece. A piece cancelled, expired, unsold or removed
-- comes back as an `item` delivery made of this record, which its seller's record collects (market.js collectGood);
-- a piece sold, won or filled goes to its buyer as the craft's record always has, and the row goes with the sale.
CREATE TABLE IF NOT EXISTS piece_escrow (
  provenance  TEXT PRIMARY KEY,
  player      TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  item        TEXT NOT NULL,
  at          INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
