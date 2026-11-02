-- RENOWN-CHAR (2026-09-29) - RENOWN A CHARACTER'S AGAIN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "Can we make renown per character again". RENOWN-ACCOUNT (0021)
-- made Renown one track an ACCOUNT (`renown_accounts`), each account
-- starting at its best character's track, and left `renown_tracks` as
-- history nothing wrote again. Now every read and write of Renown is a
-- CHARACTER's track once more (server-account/src/renownTracks.js), and
-- this migration gives each track back what it is owed.
--
-- ═══ WHAT EACH CHARACTER STARTS AT (Mac's choice: "Own + recent gains") ══
--
-- ITS OWN TRACK, as it stood when Renown became the account's, PLUS
-- EVERYTHING THE ACCOUNT EARNED WHILE IT WAS - the account's total less
-- the best track it began from (`renown_accounts.xp` began at MAX over
-- the account's tracks, and no track's XP was written since). Those
-- gains were never recorded by character, so every character of the
-- account takes them: nobody loses a level, and an alt takes only the
-- gains. A realm character with no track yet - made after RENOWN-ACCOUNT
-- - starts at those gains alone. Never past the cap's total
-- (RENOWN_XP_MAX, 2,318,660 - src/net/renown.js).
--
-- One thing moved a track while the account held Renown: a realm
-- character deleted took its row with it (realm.js deleteRealm). Where
-- that row was the account's best, the gains are read against the best
-- that remains - more than was earned, never less, so still nobody loses
-- a level.
--
-- THE TRACKS' BOUND (RENOWN_TRACKS_MAX, 60 an account) holds for the new
-- rows as the service's own inserts hold it: an account's realm
-- characters are taken the most recently played first, only into the
-- room its tracks leave.
--
-- THE CARD'S ORDER: the account card shows the characters most recently
-- played online (renownTracksOf, `updated_at`). While Renown was the
-- account's, no track said who played, so a realm character's track is
-- stamped with the later of its own time and its record's last move
-- (`realm_characters.updated_at`) - the realm is where a character has
-- played online since REALM. A new track is made now (`created_at`).
--
-- A report in flight across the deploy, sent again because its answer
-- was lost, is answered as a repeat: every track of the account takes the
-- account's `last_rid` (a report's id is its own, so no later report can
-- share it).
--
-- ═══ renown_accounts IS HISTORY NOW ════════════════════════════════
--
-- Its rows stay as they stand - what each account held when Renown became
-- the characters' again - and nothing writes them again.

-- The gain each account's characters take, worked out once, before any track moves.
CREATE TABLE IF NOT EXISTS renown_char_seed (
  player   TEXT PRIMARY KEY,
  gain     INTEGER NOT NULL,
  last_rid TEXT
);
INSERT OR REPLACE INTO renown_char_seed (player, gain, last_rid)
  SELECT a.player,
    MAX(0, a.xp - COALESCE((SELECT MAX(t.xp) FROM renown_tracks t WHERE t.player = a.player), 0)),
    a.last_rid
  FROM renown_accounts a;

-- Every track the account holds: its own, plus the gains, never past the cap; the report the account last took; and,
-- for a realm character's, the last time its record moved where that is later.
UPDATE renown_tracks SET
  xp = MIN(2318660, xp + (SELECT s.gain FROM renown_char_seed s WHERE s.player = renown_tracks.player)),
  last_rid = COALESCE((SELECT s.last_rid FROM renown_char_seed s WHERE s.player = renown_tracks.player), last_rid),
  updated_at = MAX(updated_at, COALESCE((SELECT r.updated_at FROM realm_characters r
    WHERE r.player = renown_tracks.player AND r.id = renown_tracks.char_id), 0))
WHERE player IN (SELECT player FROM renown_char_seed);

-- A realm character with no track yet: the gains alone - only with Renown to hold, and only into the room the tracks'
-- bound leaves, the most recently played first (the room counted before any is made, so the bound is exact).
INSERT OR IGNORE INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
  SELECT player, id, name, xp, last_rid, CAST(strftime('%s', 'now') AS INTEGER), played
  FROM (
    SELECT r.player, r.id, CASE WHEN length(r.name) BETWEEN 1 AND 32 THEN r.name END AS name,
      MIN(2318660, s.gain) AS xp, s.last_rid, r.updated_at AS played,
      ROW_NUMBER() OVER (PARTITION BY r.player ORDER BY r.updated_at DESC, r.id) AS n,
      60 - (SELECT COUNT(*) FROM renown_tracks t WHERE t.player = r.player) AS room
    FROM realm_characters r
    JOIN renown_char_seed s ON s.player = r.player
    WHERE s.gain > 0
      AND NOT EXISTS (SELECT 1 FROM renown_tracks t WHERE t.player = r.player AND t.char_id = r.id)
  )
  WHERE n <= room;

DROP TABLE renown_char_seed;
