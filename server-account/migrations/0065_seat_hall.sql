-- SEAT-HALL (2026-10-02, Mac: "Please do" - the palace as the holder's guild hall) - THE CHARTER ROOM
-- (bible/11-Multiplayer/Seats-Arc.md 7.2: "the palace interior is the holder's guild hall ... the Charter Room - the
-- palace's largest room, decorated by Officers with DECOR's catalogue (at most 100 pieces, DECOR's gold a placement)").
-- A palace's pieces, in the shape of DECOR1's `home_decor` (its columns as migrations 0011, 0012, 0020 and 0039 left
-- them) - `map_id` the palace seat's key (its location's map id), `building_key` the palace its keeper's client named -
-- but standing on no home's row: a palace is nobody's home. Read and written through server-account/src/decor.js's
-- seat store.
--
-- THE ROOM FALLS WITH THE CHARTER: whenever the seat changes hands (a siege taken - its row's guild moved) or its Charter
-- lapses (Neglect, a revolt, a strike, a relinquishing, Season 0's wipe - its row deleted), the triggers clear its pieces,
-- nothing given back, as a work's building project falls with the Charter.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
CREATE TABLE IF NOT EXISTS seat_hall_decor (
  map_id        INTEGER NOT NULL,
  building_key  INTEGER NOT NULL,
  id            TEXT NOT NULL,
  model         INTEGER,
  flat_archive  INTEGER,
  flat_record   INTEGER,
  place         TEXT NOT NULL,
  placed_at     INTEGER NOT NULL,
  item          TEXT,
  paid          INTEGER NOT NULL DEFAULT 0,
  yard          INTEGER NOT NULL DEFAULT 0 CHECK (yard = 0),
  PRIMARY KEY (map_id, building_key, id)
);
CREATE INDEX IF NOT EXISTS idx_seat_hall_decor_seat ON seat_hall_decor (map_id);
CREATE TRIGGER IF NOT EXISTS seat_hall_decor_handed AFTER UPDATE OF guild_id ON town_seat_holds
  WHEN NEW.guild_id IS NOT OLD.guild_id
BEGIN
  DELETE FROM seat_hall_decor WHERE map_id = NEW.key;
END;
CREATE TRIGGER IF NOT EXISTS seat_hall_decor_lapsed AFTER DELETE ON town_seat_holds
BEGIN
  DELETE FROM seat_hall_decor WHERE map_id = OLD.key;
END;
