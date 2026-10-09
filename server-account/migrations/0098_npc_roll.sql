-- CHAP1 (2026-10-07) - THE ROLL: A REALM CHARACTER'S STANDING WITH DAGGERFALL'S OWN GUILDS, KEPT BY THE SERVICE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct102 - AUDIT CHAP4 R1, AUDIT CHAP5 R3: acct95 then, renumbered at the merges of main) BEFORE the site:
-- the new site asks /v1/chapters/roll as a realm character comes online.
--
-- Mac: "completely overhaul the NPC guild system and reputation system",
-- "This is mostly with online in mind", and asked who holds it online:
-- "Server-owned". bible/11-Multiplayer/Chapters-Arc.md section 3; the
-- law is src/net/npcChapterLaw.js, the service src/npcRoll.js.
--
--   npc_roll_heads  one row a realm character the Roll keeps: whose it
--                   is, the cap its seed was taken under, and `seq`,
--                   `last_rid` and `tag` - every write moves `seq` on by
--                   one under a `tag` of its own (AUDIT CHAP S1: every
--                   row a write carries asks for that tag, so a write
--                   that lost its race - even to a twin of itself -
--                   writes nothing), and a claim whose id was taken is
--                   answered, never credited twice.
--   npc_roll        one row a guild faction of that character (the
--                   twenty-two, seeded together): its reputation, the
--                   day's net change so far (`gained` on the UTC day
--                   `gained_day` - the daily pace), what a gain past the
--                   pace left `owed` (AUDIT CHAP D2: paid on the days
--                   after, never lost), and its membership:
--                   `member`, the `rank` its client reported (never
--                   past what its reputation allows, nor 7 - AUDIT CHAP5
--                   R19: npcChapterLaw.js rollBookRankOf), and
--                   `joined_at` - when the service first saw it a member,
--                   the tenure a seat will ask (CHAP4). AUDIT CHAP4 D1
--                   (grown in place - nothing shipped): and `dormant`, 1
--                   for a membership the character's ACTIVE book does not
--                   hold (a vampire's mortal guilds, DFU's GuildManager
--                   Memberships) - kept on the Roll, earning no Merit, no
--                   member writ and no seat.
--   npc_rep_events  the record: every line of every claim, what it asked
--                   and what it was credited - kept ROLL_EVENTS_KEEP_S
--                   (90 days), and asked by `rid` for a repeat.
--
-- A realm character's delete takes all three (src/realm.js deleteRealm, and undoCustoms for a
-- customs whose first save never landed).
CREATE TABLE IF NOT EXISTS npc_roll_heads (
  char_id     TEXT PRIMARY KEY,
  player      TEXT NOT NULL,
  cap         INTEGER NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,
  last_rid    TEXT,
  tag         TEXT,
  seeded_at   INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS npc_roll_heads_player ON npc_roll_heads (player);

CREATE TABLE IF NOT EXISTS npc_roll (
  char_id     TEXT NOT NULL,
  faction_id  INTEGER NOT NULL,
  player      TEXT NOT NULL,
  rep         INTEGER NOT NULL DEFAULT 0,
  gained_day  INTEGER NOT NULL DEFAULT 0,
  gained      INTEGER NOT NULL DEFAULT 0,
  owed        INTEGER NOT NULL DEFAULT 0,
  member      INTEGER NOT NULL DEFAULT 0,
  rank        INTEGER,
  joined_at   INTEGER,
  dormant     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (char_id, faction_id)
);

CREATE TABLE IF NOT EXISTS npc_rep_events (
  seq         INTEGER PRIMARY KEY,
  char_id     TEXT NOT NULL,
  player      TEXT NOT NULL,
  faction_id  INTEGER NOT NULL,
  asked       INTEGER NOT NULL,
  credited    INTEGER NOT NULL,
  rid         TEXT NOT NULL,
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS npc_rep_events_char ON npc_rep_events (char_id, at);
CREATE INDEX IF NOT EXISTS npc_rep_events_rid ON npc_rep_events (char_id, rid);
