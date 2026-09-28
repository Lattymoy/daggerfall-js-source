-- BASE-HIDE (2026-09-26) - WHAT AN ONLINE HOME'S OWNER TOOK OUT OF THE ROOM.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "Remove bought houses decor - the base game decor isnt easy to
-- decorate around when u want more in depth house". What Daggerfall
-- furnished the room with - its prop models and its flats - the owner
-- may take out and put back, free. A home keeps ONE list of what is
-- out: `keys`, a JSON array of the built-in pieces' names
-- (src/net/decorLaw.js decorHiddenOf - `m<placement>:<model>`,
-- `f<flat>:<archive>.<record>`), written whole by each change, so every
-- player who walks in stands the room its owner cleared.
--
-- The home released - sold, or its account deleted - takes the list
-- with it (CASCADE through `homes`): the next owner walks into the room
-- as Daggerfall furnished it.
CREATE TABLE IF NOT EXISTS home_hidden (
  map_id        INTEGER NOT NULL,
  building_key  INTEGER NOT NULL,
  keys          TEXT NOT NULL,
  PRIMARY KEY (map_id, building_key),
  FOREIGN KEY (map_id, building_key) REFERENCES homes(map_id, building_key) ON DELETE CASCADE
);
