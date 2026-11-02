-- RENOWN1 (2026-09-24) - THE RENOWN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "What if the leveling system was something seperate unique to
-- online but compatible" - asked, the online health and magicka go "On
-- top" of Daggerfall's, the curve is a "Grind", and offline play earns
-- "No" Renown XP (src/net/renown.js holds all three).
--
-- ONE ROW A CHARACTER, NEVER IN THE SAVE. A character is the id its own
-- save carries (src/systems/characterId.js, the same id the cloud saves
-- are filed under), so a track follows its character across devices and
-- through every save and load, and nothing in the save file says a word
-- about it - the Daggerfall character offline is exactly what it was.
--
-- THE LEVEL IS NOT A COLUMN. It is derived from `xp` by the one curve
-- both ends share (src/net/renown.js renownForXp), so the total and
-- the level can never disagree.
--
-- `name` is the character's name as its own client last said it - for
-- the account card alone, never for anybody else's screen (a name over
-- a head is the account's, signed into the token).
--
-- `last_rid` is the id of the last report the track took (AUDIT RENOWN1
-- DATA-4): a client whose answer was lost sends the same report again
-- under the same id, and is answered rather than credited twice.
--
-- The account row goes, and its tracks go with it (CASCADE).
CREATE TABLE IF NOT EXISTS renown_tracks (
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  name       TEXT,
  xp         INTEGER NOT NULL DEFAULT 0,
  last_rid   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player, char_id),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- An account's tracks, the most recently played online first - the card reads it.
CREATE INDEX IF NOT EXISTS idx_renown_recent ON renown_tracks (player, updated_at);

-- THE HOUR'S BOUND IS THE ACCOUNT'S, across all its characters, so a
-- second character is not a second allowance. `renown_hour` is the clock
-- hour the window counts (epoch seconds / 3600), `renown_hour_xp` what the
-- account has earned in it, and `renown_last_credit` what the last report
-- was credited - written by the same UPDATE that spends the window, so
-- the credit is read back with RETURNING and two reports landing at
-- once can never both spend the same remainder (ACC4's creditPlay law).
-- The window only moves FORWARD: a report stamped with an hour already
-- past is charged to the window that is open (AUDIT RENOWN1 SEC-1).
ALTER TABLE players ADD COLUMN renown_hour INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN renown_hour_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN renown_last_credit INTEGER NOT NULL DEFAULT 0;
