-- BAG1 (2026-10-03) - THE MATERIALS BAG: WHAT A CHARACTER CARRIES, COUNTED
-- (bible/06-Systems/Materials-Bag.md; the law is src/net/bagLaw.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE CARRIED COUNT: every unit the service handed to a character's bag or pack - a harvest's, a withdrawal's - and has
-- not had back by a deposit, own, bought or bought with gold (the Stores' three). It is a BOUND, not an inventory: the
-- items are the save's, and every act that reads the count first cuts it to what the client says it holds (bagLaw.js
-- clampCarried), so it only ever falls to the truth. At most 5,000 of a material (bagLaw CARRIED_MAX, the Stores' own);
-- a row at 0 is deleted.
CREATE TABLE IF NOT EXISTS prof_carried (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  origin   TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold')),
  qty      INTEGER NOT NULL CHECK (qty >= 0 AND qty <= 5000),
  PRIMARY KEY (player, char_id, material, origin),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- A DEPOSIT: carried units into the Stores, each origin as it was. The row is the request's own (`n` its nonce), so an
-- answer lost is answered again with what it moved, and the moves after the deciding INSERT run for this deposit alone.
-- `own`, `bought` and `gold` are what it moved of each, read in the decision from the count as it was cut.
CREATE TABLE IF NOT EXISTS prof_deposits (
  player   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 1),
  own      INTEGER NOT NULL DEFAULT 0 CHECK (own >= 0),
  bought   INTEGER NOT NULL DEFAULT 0 CHECK (bought >= 0),
  gold     INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  at       INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- WHERE A HARVEST LANDED: `carry` 1 - the bag or the pack (the carried count); 0 - the Stores, as every harvest did
-- before BAG1 and an older client's still does. Read back by the answer, so a request asked again says where its units
-- went.
ALTER TABLE node_harvests ADD COLUMN carry INTEGER NOT NULL DEFAULT 0 CHECK (carry IN (0, 1));
-- AUDIT2 BAG1 S1: a carried harvest's row is kept CARRIED_ROW_DAYS (bagLaw.js), an older client's two - the sweep reads each
-- kind by its own day (professions.js profState)
CREATE INDEX IF NOT EXISTS idx_node_harvests_carry_day ON node_harvests (carry, day);
ALTER TABLE motherlode_strikes ADD COLUMN carry INTEGER NOT NULL DEFAULT 0 CHECK (carry IN (0, 1));

-- A WITHDRAWAL'S ORIGINS: what it took of each (gold's first, bought, own - its spend order), so the units it handed to a
-- carrying client are counted under the origin they left the Stores as. `carry` 0 is the old door: the units leave the
-- service's count for good (law 3, as it stood).
ALTER TABLE prof_withdrawals ADD COLUMN carry INTEGER NOT NULL DEFAULT 0 CHECK (carry IN (0, 1));
ALTER TABLE prof_withdrawals ADD COLUMN own INTEGER NOT NULL DEFAULT 0 CHECK (own >= 0);
ALTER TABLE prof_withdrawals ADD COLUMN bought INTEGER NOT NULL DEFAULT 0 CHECK (bought >= 0);
ALTER TABLE prof_withdrawals ADD COLUMN gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0);

-- AUDIT BAG1 B2 (the audit, bible/06-Systems/Materials-Bag.md): WHETHER A REQUEST'S HELD COUNT MAY CUT THE COUNT - a row a
-- request id, made at the head of the request's own batch where the count still stands at what the client last heard
-- (`seen`), read by every origin's cut, and cleared at the batch's end: never a row between two batches. The decision is
-- taken once because each origin's cut moves the total the next would read.
CREATE TABLE IF NOT EXISTS prof_carried_gate (
  player   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  PRIMARY KEY (player, rid)
);
