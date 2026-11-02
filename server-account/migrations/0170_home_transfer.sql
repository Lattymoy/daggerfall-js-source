-- A house offered to one account. The row stays the house's: accepting it changes who owns that row.
-- It never deletes the house, so the building cannot be claimed by anyone else while the offer is open.
-- One open offer a building. An accepted offer keeps its answer, so a lost response is not a second sale.
CREATE TABLE IF NOT EXISTS home_offers (
  id           TEXT PRIMARY KEY,
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  seller       TEXT NOT NULL,
  seller_char  TEXT NOT NULL,
  buyer        TEXT NOT NULL,
  price        INTEGER NOT NULL,
  keep_decor   INTEGER NOT NULL,
  keep_items   INTEGER NOT NULL,
  rev          INTEGER NOT NULL,
  state        TEXT NOT NULL,
  result       TEXT,
  at           INTEGER NOT NULL,
  until        INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_home_offer_open ON home_offers (map_id, building_key) WHERE state = 'open';
