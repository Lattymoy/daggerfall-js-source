-- FOUNDATION F2 (2026-10-30, bible/03-World/Foundation-Arc.md): THE REGIONS' CLOCK - each region's prosperity and the
-- tick it was stepped to, and the clock's own tick and rotation. The law is src/net/regionClockLaw.js, the service
-- src/regionClock.js. Regions 0..70: the Bay's 62 and the nine provinces'.
CREATE TABLE IF NOT EXISTS region_clock (
  region INTEGER PRIMARY KEY CHECK (region BETWEEN 0 AND 70),
  v      INTEGER NOT NULL DEFAULT 0 CHECK (v >= 0),
  tick   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS region_clock_meta (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  tick   INTEGER NOT NULL,
  cursor INTEGER NOT NULL
);
-- The regions' prosperity as every client reads it, kept beside the towns' shares (townEcon.js keepTownShares).
ALTER TABLE town_econ_kept ADD COLUMN regions TEXT;
