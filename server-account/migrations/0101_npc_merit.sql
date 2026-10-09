-- CHAP3a (2026-10-08) - MERIT: what a member did for its chapter, the week's.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct102 - AUDIT CHAP4 R1, AUDIT CHAP5 R3: acct95 then, renumbered at the merges of main) BEFORE the site.
--
-- Mac: "Keep going with the arc/slices" (bible/11-Multiplayer/Chapters-Arc.md
-- section 5.1, CHAP3a). The law is src/net/npcChapterLaw.js; the service
-- src/professions.js (a member's own writ) and src/npcReceipts.js (a
-- receipt in the chapter's region).
--
-- ONE LINE A WITNESSED ACT. `week` the seats' week (townSeatLaw.js
-- seatWeekOf - the Turning settles both), `faction` and `region` the
-- chapter, `account` and `char_id` who earned it, `source` 'writ' (the
-- member's own writ, its own units' share), 'gate' or 'raid' (a receipt in
-- the chapter's region), `ref` the act's own id (the writ's, the receipt's
-- npc_receipt_credits ref) - one line a character an act a guild (UNIQUE),
-- so an act claimed again earns nothing more. Every bound is
-- asked in the line's own INSERT: the member's tenure on the Roll, the
-- account's one chapter of a guild a week, the 600 an account a chapter a
-- week.
CREATE TABLE IF NOT EXISTS npc_chapter_merit (
  week     INTEGER NOT NULL,
  faction  INTEGER NOT NULL,
  region   INTEGER NOT NULL,
  account  TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  source   TEXT NOT NULL CHECK (source IN ('writ', 'gate', 'raid')),
  amount   INTEGER NOT NULL CHECK (amount >= 1),
  ref      TEXT NOT NULL,
  at       INTEGER NOT NULL,
  UNIQUE (char_id, faction, source, ref)
);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_merit_chapter ON npc_chapter_merit (week, faction, region);
CREATE INDEX IF NOT EXISTS idx_npc_chapter_merit_account ON npc_chapter_merit (week, account, faction);
-- AUDIT CHAP3 (S, notes): an act's lines by its id (npcMerit.js meritOfAct)
CREATE INDEX IF NOT EXISTS idx_npc_chapter_merit_act ON npc_chapter_merit (char_id, source, ref);
