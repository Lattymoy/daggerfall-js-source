-- DOMAIN1 (2026-10-24, the owner: "Allowing guild mates to contribute to town material storage with gathered
-- items/their store"): A GIFT TO THE TOWN (bible/11-Multiplayer/Domains.md section 5; server-account/src/seatGifts.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads it.
--
-- ONE ROW A GIFT: a member's materials out of its Stores into its guild's stockpile (`camp` 0 - the seat it holds) or
-- its Siege Camp (`camp` 1 - the seat it pledged that seat week), keyed on the giver's request id so a gift asked twice
-- is one, `n` the nonce of the batch that made it (PROF1's law). `own` the units the giver gathered or made (bought units
-- go first); `who` the name it went by, for the board's line. The influence it counted is town_seat_influence's, keyed
-- on the gift (`gift:<player>:<rid>`). The Season's end wipes these with the stockpiles (seatTurning.js
-- SEASON_ZERO_WIPED).
CREATE TABLE IF NOT EXISTS town_seat_gifts (
  player    TEXT NOT NULL,
  rid       TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  guild_id  TEXT NOT NULL,
  key       INTEGER NOT NULL,
  camp      INTEGER NOT NULL CHECK (camp IN (0, 1)),
  week      INTEGER NOT NULL,
  region    INTEGER NOT NULL CHECK (region >= 0 AND region <= 61),
  material  TEXT NOT NULL,
  units     INTEGER NOT NULL CHECK (units >= 1),
  own       INTEGER NOT NULL CHECK (own >= 0 AND own <= units),
  who       TEXT NOT NULL,
  at        INTEGER NOT NULL,
  n         TEXT NOT NULL,
  PRIMARY KEY (player, rid)
);
-- the board's line: a place's last gifts by its guild, newest first
CREATE INDEX IF NOT EXISTS idx_town_seat_gifts_key ON town_seat_gifts (key, guild_id, camp, at);
