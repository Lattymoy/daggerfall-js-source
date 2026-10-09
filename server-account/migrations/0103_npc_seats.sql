-- CHAP4a (2026-10-08) - THE SEATS: ranks 8 and 9, each chapter's.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct102 - AUDIT CHAP4 R1, AUDIT CHAP5 R3: acct95 then, renumbered at the merges of main) BEFORE the site.
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
-- CHAP7a: and 'patron', the guild that won a Season's patronage (`char_id`
-- '', `data` its id and its name and tag as they stood, and the Season).
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
-- AUDIT CHAP5 S5 (grown in place - nothing of it shipped): and a Season's own
-- read - the Masters' seats each chapter changed into in it (the Turning's
-- draw, seasonDrawn), which scanned every row the Chronicle ever kept. The
-- week first: led by the kind, it drew a token's mint off the character's
-- own index, to every 'season' row the realm ever kept.
CREATE INDEX IF NOT EXISTS idx_npc_chapter_history_week ON npc_chapter_history (week, kind);
-- CHAP6b (grown in place - nothing of it shipped): A SEASON'S BACKING. One
-- row an account a chapter a Season: the side its member backs in the
-- Season's Schism (0 or 1) or the candidate it names in its Succession (0
-- to 2), and the character that backed - a Master's naming is the backing
-- of the character in the Master's seat. Changed until the event is decided
-- (the Succession at the Season's third Turning, the Schism at its end).
CREATE TABLE IF NOT EXISTS npc_chapter_backing (
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  season    INTEGER NOT NULL,
  account   TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  side      INTEGER NOT NULL CHECK (side BETWEEN 0 AND 2),
  at        INTEGER NOT NULL,
  PRIMARY KEY (faction, region, season, account)
);
-- AUDIT CHAP5 S5: an account's backings in a region's chapters this Season
-- (every board's read) and a Season's backings (its Turnings') on their own
-- index - the key leads with the chapter, which neither read names.
CREATE INDEX IF NOT EXISTS idx_npc_chapter_backing_season ON npc_chapter_backing (season, region, account);
-- CHAP7a (grown in place - nothing of it shipped): A CHAPTER'S PATRONAGE'S
-- BIDS. One row a guild a chapter a Season: the whole of what its
-- guildmaster bid from the guild's treasury for the Season after the one
-- it bid in (held in the ledger's escrow, `patron:<Season>:<key>:<guild>`),
-- and when it stood at that sum. Decided at the Turning that opens the
-- Season - the highest burnt, every other home ('won' or 'lost').
CREATE TABLE IF NOT EXISTS npc_chapter_patron_bids (
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  season    INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  amount    INTEGER NOT NULL CHECK (amount > 0),
  at        INTEGER NOT NULL,
  state     TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'won', 'lost')),
  PRIMARY KEY (faction, region, season, guild_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_patron_bids_season ON npc_chapter_patron_bids (season, state);
-- AUDIT CHAP5 E4/S5: a guild's open bids - its board's own (guildPatronBids)
-- and the disbanding's guard (guilds.js guildKeepsSql: a guild with Marks
-- in a bid's escrow is never gone).
CREATE INDEX IF NOT EXISTS idx_npc_chapter_patron_bids_guild ON npc_chapter_patron_bids (guild_id, season, state);
