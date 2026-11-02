-- AUDIT FB1031 W1 W3 W4 (2026-10-31, WITNESS-MAP's audit; bible/06-Systems/Professions-Arc.md section 61): THE WITNESSED
-- GROUND IN TILES, laid once a UTC day from the scan the day's Motherlodes pick already makes (server-account/src/
-- witnessTiles.js), so the held map's read is a primary-key read and never a scan of world_witness.
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
-- A TILE is 64 x 64 map pixels keyed by the world pixel (tx = floor(x / 64), ty = floor(y / 64); the provinces and the
-- sea past the Bay are tiles like the Bay's), one row a day for each tile holding a confirmed pixel; `px` its pixels,
-- two characters each (net/witnessTileLaw.js packTile). A DAY is laid when its row is written, in the same batch as its
-- tiles; yesterday's tiles go in that batch. Additive: no table moves.
CREATE TABLE IF NOT EXISTS witness_tiles (
  day INTEGER NOT NULL,
  tx  INTEGER NOT NULL,
  ty  INTEGER NOT NULL,
  px  TEXT NOT NULL,
  PRIMARY KEY (day, tx, ty)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS witness_tile_days (
  day    INTEGER PRIMARY KEY,
  tiles  INTEGER NOT NULL,
  pixels INTEGER NOT NULL,
  n      TEXT NOT NULL
);
