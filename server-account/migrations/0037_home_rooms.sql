-- HOME-RENT (2026-09-30) - A HOME'S ROOMS, RENTED TO OTHER PLAYERS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Asked: "For houses with multiple rooms, the owner can choose to rent out
-- to other players and adjust the price as needed". The shapes and bounds
-- are src/net/homeLaw.js (RENT_*), which the client reads too; the writes
-- are server-account/src/rent.js.
--
-- A room offered is a row: its home (the `homes` row, HOME1) and its
-- number there, the primary key; `anchor` a point in it, the building
-- frame's (JSON [x, y, z], as a piece of decor stands), so every client
-- finds the same room in the same walls; `price` gold a day, the owner's to
-- change; `listed` whether a new tenant may take it (a room taken off the
-- offer keeps its tenant until the days run out). The TENANT is an account
-- and one of its characters, the handle the door names, and `until` the
-- service's second the tenancy ends (0: never rented) - running while it
-- is ahead of the clock.
--
-- The home released - sold, or its account deleted - takes its rooms with
-- it (CASCADE through `homes`); a sale is refused while a tenancy runs
-- (homes.js). A tenant's account deleted frees the room (SET NULL).
CREATE TABLE IF NOT EXISTS home_rooms (
  map_id        INTEGER NOT NULL,
  building_key  INTEGER NOT NULL,
  room          INTEGER NOT NULL,
  anchor        TEXT NOT NULL,
  price         INTEGER NOT NULL,
  listed        INTEGER NOT NULL DEFAULT 1,
  tenant        TEXT,
  tenant_char   TEXT,
  tenant_name   TEXT,
  until         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (map_id, building_key, room),
  FOREIGN KEY (map_id, building_key) REFERENCES homes(map_id, building_key) ON DELETE CASCADE,
  FOREIGN KEY (tenant) REFERENCES players(id) ON DELETE SET NULL
);
-- A character's tenancies - the cap every rent asks before it lands, and the town answer's own rooms.
CREATE INDEX IF NOT EXISTS idx_home_rooms_tenant ON home_rooms (tenant, tenant_char);

-- The rent tenants' records paid in, not yet collected by the owner - held on the home, since the owner's record is
-- theirs to move (realm.js prepareRealmRecord needs its own tab's lease), and paid out by their own collection.
ALTER TABLE homes ADD COLUMN rent_due INTEGER NOT NULL DEFAULT 0;
