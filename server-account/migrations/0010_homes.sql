-- HOME1 (2026-09-25) - THE ONLINE HOMES.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "allowing online players to purchase housing in any location";
-- asked: "Housing is exclusive" - ONE OWNER A BUILDING, server-wide. The
-- shapes and the cap are src/net/homeLaw.js, which the service and the
-- client both read.
--
-- A home is a building in a town: the town's unsigned map id and the
-- building's key there, which together are the primary key - so a
-- building can be nobody's or one character's, never two. `char_id` is
-- the character (the id its own save carries, as Renown's tracks key on);
-- `owner_name` the account's handle when it was bought, what the door
-- says to everyone else (a character's name is never shown to another
-- player - the handle is the name the relay signs). `entry` is who may
-- walk in (private, party, public), `price` what was paid, for the
-- share given back when it is sold.
--
-- The account row goes, and its homes go with it (CASCADE) - the
-- buildings stand free again.
CREATE TABLE IF NOT EXISTS homes (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  player       TEXT NOT NULL,
  char_id      TEXT NOT NULL,
  owner_name   TEXT NOT NULL,
  region       INTEGER NOT NULL,
  entry        TEXT NOT NULL DEFAULT 'private',
  price        INTEGER NOT NULL,
  bought_at    INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- A character's homes - the count the cap asks before every claim, and the owner's list.
CREATE INDEX IF NOT EXISTS idx_homes_owner ON homes (player, char_id);
