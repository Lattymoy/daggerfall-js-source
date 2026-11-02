-- DECOR1 (2026-09-25) - AN ONLINE HOME'S DECOR.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: decor is "Gold per placement", the catalogue "Everything
-- Daggerfall furnishes". An online home's pieces live HERE, so every
-- player who walks in sees the room its owner furnished; the offline
-- house's and ship's live in the save. The shapes and bounds are
-- src/net/decorLaw.js, which the client reads too.
--
-- A piece belongs to a HOME (the `homes` row, HOME1): its town's map id,
-- the building's key and the piece's own id are the primary key. WHAT it
-- is - a model, or a flat's archive and record - is its own columns and
-- no write after the placement touches them, so a move can never turn a
-- stool into a statue. WHERE it stands and what it cost is `place`, the
-- JSON decorLaw.js projects (pos, rot, scale, light, storage, paid).
--
-- The home released - sold, or its account deleted - takes its pieces
-- with it (CASCADE through `homes`): the next owner walks into an empty
-- house, as Daggerfall's buyer does.
CREATE TABLE IF NOT EXISTS home_decor (
  map_id        INTEGER NOT NULL,
  building_key  INTEGER NOT NULL,
  id            TEXT NOT NULL,
  model         INTEGER,
  flat_archive  INTEGER,
  flat_record   INTEGER,
  place         TEXT NOT NULL,
  placed_at     INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key, id),
  FOREIGN KEY (map_id, building_key) REFERENCES homes(map_id, building_key) ON DELETE CASCADE
);
