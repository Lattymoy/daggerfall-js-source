-- FIRM1 (2026-10-13) - THE FIRMAMENT: a character's passive tree (bible/06-Systems/Firmament.md; the law
-- src/net/firmamentLaw.js, the sky src/net/firmamentTree.js). Written as 0113; renumbered past main's 0113_lamp_title at
-- the audit's merge (MIGRATION-PREFIX). Every statement IF NOT EXISTS, so a test service that applied it as 0113 takes
-- this name as a no-op.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- ONE ROW A CHARACTER, NEVER IN THE SAVE - Renown's own rule (0009): the tree is online's, as the Renown that pays for
-- it is, and the Daggerfall character in the save is exactly what it was. `tree` is the allocation packed by the law
-- (firmamentLaw.js packTree: "<start>|<key>,<key>,..."), '' for none; it is only ever written whole, by a request the
-- law found whole and the purses could pay (firmament.js setFirmament), so a row never holds a tree it could not.
--
-- The account row goes, and its trees go with it (CASCADE).
CREATE TABLE IF NOT EXISTS firmament (
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  tree       TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player, char_id),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- EVERY CHANGE, ONCE: a request's id with what it made of the tree and the silver its refunds burnt. A request asked again
-- (its answer lost) is answered from its row, never charged twice; `n` the request's own nonce, so the statements of one
-- batch know their own row. `prev` the tree the change was made over - the change is refused (the client reads again) if
-- another change landed in between.
CREATE TABLE IF NOT EXISTS firmament_sets (
  player  TEXT NOT NULL,
  rid     TEXT NOT NULL,
  char_id TEXT NOT NULL,
  prev    TEXT NOT NULL,
  tree    TEXT NOT NULL,
  silver  INTEGER NOT NULL DEFAULT 0,
  at      INTEGER NOT NULL,
  n       TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_firmament_sets_char ON firmament_sets (player, char_id, at);
