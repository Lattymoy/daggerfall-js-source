-- CHAP4a (2026-10-08) - THE SEATS: ranks 8 and 9, each chapter's.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct99 - AUDIT CHAP4 R1: acct95 then, renumbered at the merges of main) BEFORE the site.
--
-- Mac: "Your decision", on "Whats next" (bible/11-Multiplayer/Chapters-Arc.md
-- sections 3.5 and 6, CHAP4a). The law is src/net/npcChapterLaw.js; the
-- service src/npcChapters.js, whose Turning places them.
--
-- THE SEATS. One row a character a chapter holds a seat at: 'master' (rank
-- 9, one a chapter) or 'officer' (rank 8, three), the account that held
-- the character when it was placed, the week it first sat there without a
-- break (`since` - a seat that moves between Master and officer keeps it)
-- and the Turning that placed it. Every Turning writes the whole table
-- again in its own batch, after its week's key.
CREATE TABLE IF NOT EXISTS npc_chapter_seats (
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  char_id   TEXT NOT NULL,
  account   TEXT NOT NULL,
  seat      TEXT NOT NULL CHECK (seat IN ('master', 'officer')),
  since     INTEGER NOT NULL,
  week      INTEGER NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (faction, region, char_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_seats_char ON npc_chapter_seats (char_id);
-- THE CHRONICLE. One row a change of seat: the chapter, the Turning's week,
-- its kind ('seat'), the character, and `data` - `{ "from": seat | null,
-- "to": seat | null }`. The Hall of Records' to read (Chapters-Arc 6); kept
-- when the character is deleted, as the seats' own history is. CHAP6a: and
-- a Season's own rows - 'event', the Season's event and how it ended
-- (`char_id` ''), and 'season', the Master who held the seat all of it.
CREATE TABLE IF NOT EXISTS npc_chapter_history (
  seq       INTEGER PRIMARY KEY,
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  week      INTEGER NOT NULL,
  kind      TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  data      TEXT NOT NULL DEFAULT '{}',
  at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_history_chapter ON npc_chapter_history (faction, region, seq);
-- AUDIT CHAP4 S1 (grown in place - nothing of it shipped): the two readers' own - a character's lost Masters' seats this
-- Season (chapterTitlesOfAccount, every token's mint once CHAPTER_TITLES is on) and a region's newest rows (the Hall of
-- Records' chapterChronicle). Without them each read scanned every row the Chronicle ever kept.
CREATE INDEX IF NOT EXISTS idx_npc_chapter_history_char ON npc_chapter_history (char_id, week);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_history_region ON npc_chapter_history (region, seq);
