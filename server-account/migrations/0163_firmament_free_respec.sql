-- PWR2 (2026-10-23) - THE FREE RESPEC: one whole-sky respec a character, for nothing (bible/05-Combat/Power-Arc.md
-- section 5; Mac, of the characters the new limits find over them - two combat keystones awake: "Nothing taken, extras
-- sleep", and "Everyone gets one free Firmament respec"). The law is server-account/src/firmament.js respecFirmament.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- by it.
--
-- A ROW IS THE FREE RESPEC SPENT: written in the respec's own batch (a plain INSERT - a second free respec of the same
-- character fails the whole batch, the sky and the request's row with it), `rid` the request that spent it. No row,
-- the character's free respec is still to come - every character the arc found, and every one made after it. The
-- account row goes, and its rows go with it (CASCADE).
CREATE TABLE IF NOT EXISTS firmament_free (
  player  TEXT NOT NULL,
  char_id TEXT NOT NULL,
  rid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (player, char_id),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
