-- REALM P2.1 (2026-09-28) - A TRADE IS THE REALM'S, AND EVERY WRITE OF A REALM CHARACTER IS A NEW OBJECT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "eliminate duping". The plan is bible/06-Systems/Realm-Arc.md
-- section 3: a trade between two realm characters is settled HERE, both
-- records moved at once or neither.
--
-- `obj` AND `prev`. A realm character's save lands at a key of its own
-- (src/realm.js mintObjectKey) and the row then names it: `obj` the
-- current save, `prev` the one before, which a bad write never touches.
-- 0018 (0016 on its branch) alternated two objects by `seq`; a write
-- that lost its race - a checkpoint against a trade being settled -
-- could land on the current one.
--
-- realm_trades: ONE ROW A TRADE, by the peers' own sid. The first HALF
-- waits here (`a_*`: who sent it, the lease and the sequence of the
-- checkpoint it was made at, and the half itself - what that side gives
-- and takes); the second settles it (src/realmTrade.js), and the row
-- keeps the outcome either side may ask for again: `done` with the
-- `result` each side applies, or `refused` with its word. A done trade
-- without its result is impossible by the CHECK.
--
-- realm_tx_guard: NEVER HOLDS A ROW. A settling batch ends with an
-- insert here only when a record it moved did not move (the insert's
-- WHERE), and the CHECK refuses that row - so the whole batch rolls
-- back, and a trade is both records or neither. D1's batch is one
-- transaction; an UPDATE that matches nothing is not an error, and this
-- makes it one.
ALTER TABLE realm_characters ADD COLUMN obj TEXT;
ALTER TABLE realm_characters ADD COLUMN prev TEXT;

CREATE TABLE IF NOT EXISTS realm_trades (
  sid         TEXT PRIMARY KEY,
  a_player    TEXT NOT NULL,
  a_char      TEXT NOT NULL,
  a_lease     TEXT NOT NULL,
  a_seq       INTEGER NOT NULL,
  a_half      TEXT NOT NULL,
  b_player    TEXT,
  b_char      TEXT,
  state       TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'done', 'refused')),
  why         TEXT,
  result      TEXT,
  created_at  INTEGER NOT NULL,
  CHECK (state != 'done' OR result IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS realm_trades_created ON realm_trades (created_at);

CREATE TABLE IF NOT EXISTS realm_tx_guard (
  moved     INTEGER NOT NULL,
  expected  INTEGER NOT NULL,
  CHECK (moved = expected)
);
