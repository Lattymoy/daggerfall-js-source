-- PWR4 (2026-10-23) - THE SKIES PAST THE SOFT CAP: the alternate skies a character keeps beside the one in force
-- (bible/05-Combat/Power-Arc.md section 7; Mac: "20; past it, loadouts" - "Each Star past 20 fills up to two more saved
-- Firmament trees and attunement sets, swappable out of combat"). The law is src/net/firmament/firmamentLaw.js
-- (activeStarsFor, FIRM_SKIES_AT, skiesFor); the route server-account/src/firmament.js swapFirmamentSky.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- by it.
--
-- A ROW A SKY KEPT ASIDE: `slot` 1 or 2 (the sky Renown 30 opens, the sky Renown 40 opens), `tree` packed as the sky in
-- force is (firmamentLaw.js packTree), '' for none. A swap EXCHANGES the sky in force (0114's firmament row) with a slot's,
-- in one batch over the trees it read: neither is ever judged against a purse it was not made under - a sky in force was
-- judged when it was set, and a sky kept aside was in force when it was kept. The account row goes, and its skies go
-- with it (CASCADE).
CREATE TABLE IF NOT EXISTS firmament_skies (
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  slot       INTEGER NOT NULL CHECK (slot IN (1, 2)),
  tree       TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player, char_id, slot),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
