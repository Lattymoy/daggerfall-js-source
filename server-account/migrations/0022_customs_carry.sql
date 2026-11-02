-- FIELD BUGS 2026-09-29 (CUSTOMS-CARRY) - THE CENSUS COUNTS EVERY TRACE
-- THE REALM HAS OF A CHARACTER, AND CUSTOMS CARRIES ITS HOME AND GUILD.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Rows only: no table changes shape.
--
-- From the Discord (#bug-reports), through Mac: "Bring Online" answered
-- "Only a character that has already played online can be brought into
-- the realm" for characters that had (EnragedBard, Tony H.), and a
-- vampire who came in found their guild gone (Dracula/Valentin). Mac,
-- 2026-09-29, asked: the census admits "Any pre-realm trace", and homes
-- and guild places are "Carry them" (bible/06-Systems/Realm-Arc.md).
--
-- ═══ 1. THE CENSUS, WIDENED ═══════════════════════════════════════
--
-- 0020 took its census from `renown_tracks` alone, and a track is only
-- ever written with XP to hold (0009, AUDIT RENOWN1 DATA-7) - a first
-- online KILL, since RENOWN1 on 2026-09-24. A character that played
-- online before then, or walked the Bay online and never killed, had no
-- track and was refused as "never online". The census now counts every
-- trace the service holds of a character from BEFORE THE REALM: its
-- online home (HOME1), its guild place (GUILD1), a raid it fought
-- (RAID4) and a cloud backup of it (ACC2 - proof the character stood
-- before the realm, not that it played online; Mac's call).
--
-- BEFORE THE REALM is 1790638734 (2026-09-28 23:38:54 UTC): the commit
-- that brought 0020 to main (f4dc60ce), which the census deploy followed.
-- A row stamped earlier stood before the realm on any reading; a row
-- stamped later might not, and is no proof - the census stays FROZEN at
-- the realm's start, so a Copy to offline's new id (L1-F5's dupe) never
-- counts, however many backups or raids it gathers. The ids are the
-- shape customs takes (realm.js ORIGIN_ID_RE, a realm id never).
--
-- "ONCE" STAYS THE CHARACTER'S, ON EVERY ACCOUNT (L3-F2): a character
-- already brought in from any account - its census spent anywhere, or a
-- realm character standing on its id - is counted spent here too, so a
-- copy of it on a second account finds it already in.
INSERT OR IGNORE INTO realm_census (player, char_id, spent)
  SELECT t.player, t.char_id,
    CASE WHEN EXISTS (SELECT 1 FROM realm_census c WHERE c.char_id = t.char_id AND c.spent = 1)
           OR EXISTS (SELECT 1 FROM realm_characters r WHERE r.origin_id = t.char_id)
         THEN 1 ELSE 0 END
  FROM (
    SELECT player, char_id FROM homes WHERE bought_at < 1790638734
    UNION SELECT player, char_id FROM guild_members WHERE joined_at < 1790638734
    UNION SELECT account, char_id FROM raid_cleanses WHERE at < 1790638734
    UNION SELECT player_id, character_id FROM saves WHERE created_at < 1790638734
  ) AS t
  WHERE length(t.char_id) BETWEEN 4 AND 64 AND t.char_id NOT GLOB '*[^A-Za-z0-9_-]*'
    AND NOT (length(t.char_id) = 21 AND substr(t.char_id, 1, 1) = 'r' AND substr(t.char_id, 2) NOT GLOB '*[^0-9a-f]*');

-- ═══ 2. WHAT CAME IN WITHOUT ITS HOME AND ITS GUILD, CARRIED NOW ═══
--
-- AUDIT REALM2 S2 left a customs character's online home and guild
-- place under its offline id - "the safe choice of the two ('only what
-- stood before the realm, or none')". Under an id that can never come
-- online again they were lost to everybody: the building exclusive to
-- nobody who can walk in (housing is one owner a building), the guild
-- without the member - often its master - and its name and tag kept
-- from any founding. Mac chose the other of the two: what stood before
-- the realm crosses. It is exactly what an offline id holds, because
-- since the realm a claim, a placement and a founding are a realm
-- character's alone (S2's own rule), and it pays out nothing that was
-- not the realm's: a house from before the realm sells for its `paid`
-- (0), a piece gives back half its `paid` (0), and a guild's realm
-- withdrawal takes from `realm_gold` alone (0020, L1-F3).
--
-- Every character customs already made takes its origin's home and
-- guild place now (realm.js customsRealm carries them from here on). A
-- realm character that has joined or founded a guild since keeps that
-- one - one guild a character - and the old place stays where it is.
UPDATE homes SET char_id = (
    SELECT r.id FROM realm_characters r WHERE r.player = homes.player AND r.origin_id = homes.char_id)
  WHERE EXISTS (SELECT 1 FROM realm_characters r WHERE r.player = homes.player AND r.origin_id = homes.char_id);
UPDATE OR IGNORE guild_members SET char_id = (
    SELECT r.id FROM realm_characters r WHERE r.player = guild_members.player AND r.origin_id = guild_members.char_id)
  WHERE EXISTS (SELECT 1 FROM realm_characters r WHERE r.player = guild_members.player AND r.origin_id = guild_members.char_id);
