-- DECOR-BATCH: one revision a property, and a receipt so a lost Confirm is not applied twice.
-- Existing houses have no row: that is revision 0. Nothing already placed is rewritten.
CREATE TABLE IF NOT EXISTS decor_rev (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (map_id, building_key)
);
CREATE TABLE IF NOT EXISTS decor_batch_receipt (
  txn          TEXT PRIMARY KEY,
  player       TEXT NOT NULL,
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  rev          INTEGER NOT NULL,
  result       TEXT NOT NULL,
  at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decor_batch_at ON decor_batch_receipt (at);
