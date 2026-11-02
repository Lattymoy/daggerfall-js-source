-- CREW-SIGNED (2026-10-27, the SEA-OPEN slice; bible/03-World/Shipyards.md CREW-SIGNED): A CREW HALL'S RECRUIT SIGNED
-- ONCE ONLINE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Either side may deploy
-- first: a service without /v1/crew/* says not-found, and the client then hires as it did before. No relay change.
--
-- A town's hall draws the same six sailors for every client on a day (src/systems/crewHall.js recruitsOf), so two
-- players could sign one named man. A row is one recruit held: his hall's town (map id), day and slot, who signed him
-- (`player`: `<account>:<character>` - AUDIT HORIZONTAL C8), and when. The first character to write it holds him for
-- that day (server-account/src/crewSigns.js); a hand paid off deletes it. The clock sweeps rows three days past their day (cron.js `crew-signs`).
CREATE TABLE IF NOT EXISTS crew_signed (
  town INTEGER NOT NULL,
  day INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 6),
  player TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (town, day, slot)
);
CREATE INDEX IF NOT EXISTS crew_signed_player_day ON crew_signed (player, day);
CREATE INDEX IF NOT EXISTS crew_signed_day ON crew_signed (day);
