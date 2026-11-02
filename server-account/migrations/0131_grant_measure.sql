-- GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md section 12): THE SPAWN GRANTS'
-- MEASURE - each cell's window of grant asks, posted by the relay (src/net/grantMeasure.js) to /v1/mod/grant-feed and
-- read by /v1/mod/realm-grants (tools/realmReview.mjs grants; GRANT5: seven days, then the buckets and the ceiling).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). No Worker moves with it.

-- A cell's window, once: a batch posted twice is read once (its own id).
CREATE TABLE IF NOT EXISTS grant_batches (
  id TEXT PRIMARY KEY,       -- the batch's own, 16 hex
  at INTEGER NOT NULL,       -- when the service took it, s
  q TEXT NOT NULL,           -- the cell
  span_s INTEGER NOT NULL,   -- the window's length, s (1 at least)
  live INTEGER NOT NULL      -- the most granted hostile members the cell held at once
);
CREATE INDEX IF NOT EXISTS grant_batches_at ON grant_batches (at);

-- An account's asks of one kind in one window.
CREATE TABLE IF NOT EXISTS grant_rows (
  batch TEXT NOT NULL,
  at INTEGER NOT NULL,
  sub TEXT NOT NULL,
  kind TEXT NOT NULL,
  asks INTEGER NOT NULL,
  members INTEGER NOT NULL,
  bucket INTEGER NOT NULL,   -- the asks the account's bucket would have refused
  ceiling INTEGER NOT NULL,  -- the asks the cell's ceiling would have refused
  span_s INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS grant_rows_at ON grant_rows (at, kind);

-- GRANT3 (Spawn-Grants.md section 13): a reader's tally in a window - what its game refused of a sender's foes, by
-- reason, as the cell heard it. GRANT7's evidence: readers on several accounts against one sender.
CREATE TABLE IF NOT EXISTS grant_tallies (
  batch TEXT NOT NULL,
  at INTEGER NOT NULL,       -- when the service took the batch, s
  reader TEXT NOT NULL,      -- the reader's account
  sender TEXT NOT NULL,      -- the sender's account
  reason TEXT NOT NULL,      -- net/grantLaw.js GRANT_READER_REFUSALS
  n INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS grant_tallies_sender ON grant_tallies (sender, at);
