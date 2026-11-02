-- STAFF-PANEL6-STATUS (2026-10-22; design doc "DFO Staff Panel: design", build step 6 - "Server status tiles and Admin-set
-- limits"): THE LINES A STATUS TILE TURNS AMBER AND RED AT, and the indexes the tiles' hour of guild activity is read by
-- (server-account/src/staffStatus.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them.
--
-- staff_limits  one row a metric (staffStatus.js STATUS_METRICS names every one): the value at or past which its tile is
--               amber, and red - either may be NULL, never both (a limit cleared is its row deleted). Shared by every staff
--               member and set by an Admin alone (design doc: "Shared limits that change what everyone sees, like status
--               tile limits and flag thresholds, are Admin-only and kept separately"); every set is in staff_audit with
--               what it was. A row a metric, so no retention: the table never holds more than the metrics.
-- guild_vault_log (at), guild_store_moves (at)  the last hour's guild moves counted without a walk of either table
--               (design doc, Server load: "add indexes before shipping a read over a big table"). Market sales and Marks
--               are read through their own `day` indexes, and player trades through realm_trades_created.
CREATE TABLE IF NOT EXISTS staff_limits (
  metric TEXT PRIMARY KEY,
  amber  REAL CHECK (amber IS NULL OR amber >= 0),
  red    REAL CHECK (red IS NULL OR red >= 0),
  set_by TEXT,
  set_at INTEGER NOT NULL,
  CHECK (amber IS NOT NULL OR red IS NOT NULL),
  CHECK (amber IS NULL OR red IS NULL OR amber <= red)
);
-- (a guild vault's moves by time: 0153's idx_guild_vault_log_at, made for the economy's stream)
CREATE INDEX IF NOT EXISTS guild_store_moves_at ON guild_store_moves (at);
