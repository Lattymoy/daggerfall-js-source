-- FOUNDER4 (2026-10-04) - FOUNDER THROUGH A SHARED CHARACTER.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "We need to find a way to grant the founder title to everyone
-- before the previous cut off date. Since people are still missing their
-- founders title" - and, asked how, "Link shared characters".
--
-- FOUNDER3 reads Founder off when an account FIRST PLAYED: its row's
-- `created_at`, kept through registration's upgrade in place. What it
-- could not reach, it said: a player who played as a guest in one place
-- and registered in another has two rows and nothing linking them, and
-- the account's row was first seen when it registered. The desktop app
-- made that common - it is its own origin (dagger://game, app/main.cjs),
-- so its storage is not the browser's, and a browser guest who installed
-- it and registered there has an account first seen after the cutoff and
-- their play before it on a guest row nobody can name.
--
-- ═══ THE LINK: A CHARACTER BOTH ROWS HOLD ═══════════════════════════
--
-- A character's id is minted on the player's own machine
-- (src/systems/characterId.js - a UUID, or a stamp and a random tail),
-- carried in its save, and never told to another player: the relay keys
-- what it shares by a hash of the account and the id (src/net/wire.js
-- parkKeyOf). So a character held by two rows is one player's save on
-- both. A row HOLDS a character when the service recorded it there:
-- a cloud save of it (`saves`), its Renown track (`renown_tracks`), the
-- realm's census of it (`realm_census`), a realm character brought in
-- from it (`realm_characters.origin_id`) or a customs pass spent on it
-- (`realm_passes.origin_id`). A realm character's own id is minted by
-- the service for one account and links nothing.
--
-- `first_played_at` is the earliest first play of a row an account
-- shares a character with, where it is EARLIER than the account's own
-- (`created_at`, or `registered_at` where that is earlier) - and NULL
-- everywhere else. A row's first play counts as FOUNDER3 counts it. One
-- hop: the row that holds the character itself, never a row linked to
-- that row through another character. Guests are filled too: Founder is
-- still a registered account's alone (server-account/src/titles.js), so a
-- guest linked to a row from before the cutoff holds it the moment it
-- registers.
--
-- IT IS A FACT, NOT A GRANT. Every title stays derived
-- (server-account/src/titles.js): Founder is `firstPlayed` against
-- FOUNDER_UNTIL, and `firstPlayed` now reads this column beside the two
-- it read. The column says when the player is proven to have played,
-- read off records the service wrote, as `created_at` says when the row
-- did. The instant does not move, and nobody who holds Founder loses it.
--
-- ONCE, AT THIS DEPLOY: a character carried onto a new account after it
-- is not linked by this. The statement below is the whole of the law
-- and can be run again by hand against the live database if Mac wants
-- the late arrivals counted.
--
-- The holdings are gathered into a table of their own, indexed both
-- ways, and dropped at the end (0035's renown_char_seed is the
-- precedent).

ALTER TABLE players ADD COLUMN first_played_at INTEGER;

CREATE TABLE IF NOT EXISTS founder_holdings (
  char_id  TEXT NOT NULL,
  player   TEXT NOT NULL,
  PRIMARY KEY (char_id, player)
);
CREATE INDEX IF NOT EXISTS founder_holdings_player ON founder_holdings (player);

INSERT OR IGNORE INTO founder_holdings (char_id, player)
  SELECT character_id, player_id FROM saves WHERE character_id <> '';
INSERT OR IGNORE INTO founder_holdings (char_id, player)
  SELECT char_id, player FROM renown_tracks WHERE char_id <> '';
INSERT OR IGNORE INTO founder_holdings (char_id, player)
  SELECT char_id, player FROM realm_census WHERE char_id <> '';
INSERT OR IGNORE INTO founder_holdings (char_id, player)
  SELECT origin_id, player FROM realm_characters WHERE origin_id IS NOT NULL AND origin_id <> '';
INSERT OR IGNORE INTO founder_holdings (char_id, player)
  SELECT origin_id, player FROM realm_passes WHERE origin_id IS NOT NULL AND origin_id <> '';

UPDATE players SET first_played_at = (
  SELECT MIN(MIN(o.created_at, COALESCE(o.registered_at, o.created_at)))
  FROM founder_holdings mine
  JOIN founder_holdings theirs ON theirs.char_id = mine.char_id AND theirs.player <> mine.player
  JOIN players o ON o.id = theirs.player
  WHERE mine.player = players.id
)
WHERE EXISTS (
  SELECT 1
  FROM founder_holdings mine
  JOIN founder_holdings theirs ON theirs.char_id = mine.char_id AND theirs.player <> mine.player
  JOIN players o ON o.id = theirs.player
  WHERE mine.player = players.id
    AND MIN(o.created_at, COALESCE(o.registered_at, o.created_at)) < MIN(players.created_at, COALESCE(players.registered_at, players.created_at))
);

DROP TABLE founder_holdings;
