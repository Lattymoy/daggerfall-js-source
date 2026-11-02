-- SUMMON-REPAIR (2026-10-15, FIELD BUGS 2026-10-14 SUMMON-OFFER; Mac, asked how to mend the reporter's save: "Operator
-- tool"; bible/06-Systems/Integrity-Arc.md INT6).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- A STAFF REPAIR, ONCE A TICKET A CHARACTER. The review's `repair` act (server-account/src/review.js) clears one of
-- FactionFile's flag bits on one faction of one realm character's record and gives gold back - and writes its row here
-- in the SAME batch as the record's move, so the move and the row land together or neither does. The key is the
-- character and the operator's ticket: the same repair asked again finds its row and moves nothing, and two asked at once
-- meet the key and one of them rolls back. Never swept (the findings are, after 90 days): a ticket mends once for good.
-- `seq` the record's sequence the repair wrote; `was` the faction's flags before it.
CREATE TABLE IF NOT EXISTS realm_repairs (
  char_id   TEXT NOT NULL,
  ticket    TEXT NOT NULL,
  player    TEXT NOT NULL,
  by_handle TEXT NOT NULL,
  at        INTEGER NOT NULL,
  faction   INTEGER NOT NULL,
  flag      INTEGER NOT NULL,
  was       INTEGER NOT NULL,
  gold      INTEGER NOT NULL CHECK (gold >= 0),
  seq       INTEGER NOT NULL,
  note      TEXT,
  PRIMARY KEY (char_id, ticket),
  FOREIGN KEY (char_id) REFERENCES realm_characters(id) ON DELETE CASCADE
);
