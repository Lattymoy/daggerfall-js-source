-- SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up") - THE BANNER RIBBON (bible/
-- 11-Multiplayer/Seats-Arc.md 9.1: "every member of it the Season's banner ribbon (a thin band in the guild's colours
-- under their name tag for the next Season)"): each guild that kept a seat a whole Season, written at the Turning that
-- ends it (server-account/src/seatTurning.js settleWeek), worn through the next Season by every member who was one at
-- that Turning (`at`) - read at the token's mint (server-account/src/seatRibbons.js ribbonOf).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
CREATE TABLE IF NOT EXISTS town_seat_ribbons (
  season    INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (season, guild_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
