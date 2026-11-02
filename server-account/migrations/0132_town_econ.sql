-- TOWN-ECON TE2 (2026-10-18, Mac: "Everything") - THE PLAYERS' SHARE OF A TOWN'S ECONOMY.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service with
-- the site (the site reports the towns it walks into, claims its footsteps there and reads the towns' shares).
--
-- bible/06-Systems/Town-Economy-Arc.md section 4. The law is src/net/townEconLaw.js (the weights, the caps, the decay
-- and the share); the service src/townEcon.js.
--
-- THE WITNESSED TOWN. Which town stands at a Watch tick's pixel, and which a raid's `region:location` names, is the
-- clients' word, agreed: the kind `town`, keyed by the town's unsigned map id, its report the canonical
-- `[map, px, py, region, location]`. Three agreeing accounts confirm it (nodeLaw.js WITNESS), and a confirmed town is
-- written to town_econ_towns, after which its key takes no more reports. The table is rebuilt to admit the kind, as
-- 0028, 0032, 0048 and 0099 rebuilt it.
CREATE TABLE IF NOT EXISTS world_witness_new (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel', 'dungeon', 'hub', 'seat', 'npchall', 'town')),
  key     TEXT NOT NULL,
  account TEXT NOT NULL,
  report  TEXT NOT NULL,
  region  INTEGER,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO world_witness_new (kind, key, account, report, region, at)
  SELECT kind, key, account, report, region, at FROM world_witness;
DROP TABLE world_witness;
ALTER TABLE world_witness_new RENAME TO world_witness;
CREATE INDEX IF NOT EXISTS idx_world_witness_region ON world_witness (kind, region);

-- THE TOWNS CONFIRMED: one a map id, one a pixel, one a (region, location) - the first confirmed stands.
CREATE TABLE IF NOT EXISTS town_econ_towns (
  map      INTEGER PRIMARY KEY CHECK (map > 0),
  px       INTEGER NOT NULL,
  py       INTEGER NOT NULL,
  region   INTEGER NOT NULL,
  location INTEGER NOT NULL,
  at       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_town_econ_towns_pixel ON town_econ_towns (px, py);
CREATE UNIQUE INDEX IF NOT EXISTS idx_town_econ_towns_place ON town_econ_towns (region, location);

-- AN ACCOUNT'S ACTS at a town a real (UTC) day by source - the cap asked in the write (townEconLaw.js TOWN_ECON_CAPS).
-- SEA-TRADE (Town-Economy-Arc section 8): `sea`, a captain's dealing at the port's exchange, vouched by a Watch tick.
CREATE TABLE IF NOT EXISTS town_econ_acts (
  account TEXT NOT NULL,
  map     INTEGER NOT NULL,
  day     INTEGER NOT NULL,
  src     TEXT NOT NULL CHECK (src IN ('watch', 'trade', 'raid', 'sea')),
  n       INTEGER NOT NULL CHECK (n >= 1),
  PRIMARY KEY (account, map, day, src),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_econ_acts_day ON town_econ_acts (day);

-- A TOWN'S DAY: its counted acts by source - what the share is read from. Kept TOWN_ECON_DAYS (the hourly sweep).
CREATE TABLE IF NOT EXISTS town_econ_days (
  map INTEGER NOT NULL,
  day INTEGER NOT NULL,
  src TEXT NOT NULL CHECK (src IN ('watch', 'trade', 'raid', 'sea')),
  n   INTEGER NOT NULL CHECK (n >= 1),
  PRIMARY KEY (map, day, src)
);
CREATE INDEX IF NOT EXISTS idx_town_econ_days_day ON town_econ_days (day);

-- A WATCH TICK COUNTED - once, whatever claims it again. Kept a receipt's life and a day (AUDIT TOWN-ECON 2 SVC-5: a
-- tick older is refused by its own expiry).
CREATE TABLE IF NOT EXISTS town_econ_seen (
  ref TEXT PRIMARY KEY,
  day INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_town_econ_seen_day ON town_econ_seen (day);

-- AUDIT TOWN-ECON 2 SVC-1: A MAP ID STRUCK by a developer (`/town strike`) - never witnessed again (the seats' and the
-- halls' strike: npc_hall_strikes, town_seat_history's 'strike').
CREATE TABLE IF NOT EXISTS town_econ_struck (
  map INTEGER PRIMARY KEY,
  by  TEXT,
  at  INTEGER NOT NULL
);

-- AUDIT TOWN-ECON 2 SVC-3: THE TOWNS' SHARES, KEPT ONCE FOR THE WHOLE SERVICE (0112's seat_facts_kept shape). Every
-- isolate read every town's days of the fourteen kept each keeping, on the primary; the minute's clock (cron.js
-- `town-shares`) counts them once a keeping and writes them here, and the isolates read this one row. Always id 1.
CREATE TABLE IF NOT EXISTS town_econ_kept (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  at    INTEGER NOT NULL,
  towns TEXT NOT NULL
);
