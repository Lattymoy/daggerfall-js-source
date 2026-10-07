-- CHAP1 (2026-10-07) - THE ROLL: A REALM CHARACTER'S STANDING WITH DAGGERFALL'S OWN GUILDS, KEPT BY THE SERVICE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct93) BEFORE the site:
-- the new site asks /v1/chapters/roll as a realm character comes online.
--
-- Mac: "completely overhaul the NPC guild system and reputation system",
-- "This is mostly with online in mind", and asked who holds it online:
-- "Server-owned". bible/11-Multiplayer/Chapters-Arc.md section 3; the
-- law is src/net/npcChapterLaw.js, the service src/npcRoll.js.
--
--   npc_roll_heads  one row a realm character the Roll keeps: whose it
--                   is, the cap its seed was taken under, and `seq` and
--                   `last_rid` - every claim moves `seq` on by one, and a
--                   claim whose id is the last one taken is answered,
--                   never credited twice.
--   npc_roll        one row a guild faction of that character (the
--                   twenty-two, seeded together): its reputation, the
--                   day's gains so far (`gained` on the UTC day
--                   `gained_day` - the daily bound), and its membership:
--                   `member`, the `rank` its client reported, and
--                   `joined_at` - when the service first saw it a member,
--                   the tenure a seat will ask (CHAP4).
--   npc_rep_events  the record: every line of every claim, what it asked
--                   and what it was credited.
--
-- A realm character's delete takes all three (src/realm.js deleteRealm).
CREATE TABLE IF NOT EXISTS npc_roll_heads (
  char_id     TEXT PRIMARY KEY,
  player      TEXT NOT NULL,
  cap         INTEGER NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,
  last_rid    TEXT,
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
  member      INTEGER NOT NULL DEFAULT 0,
  rank        INTEGER,
  joined_at   INTEGER,
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
