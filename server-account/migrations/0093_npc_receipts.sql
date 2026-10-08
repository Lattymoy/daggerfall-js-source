-- CHAP2b (2026-10-08) - THE RECEIPTS' STANDING AND THE RECEIPT WRITS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct95) BEFORE the site:
-- the new site shows a chapter's receipt asks on the Notice Board.
--
-- Mac: "Keep going with the arc/slices" (bible/11-Multiplayer/Chapters-Arc.md
-- sections 3.3 and 4, CHAP2b). The law is src/net/npcChapterLaw.js; the
-- service src/npcReceipts.js.
--
-- A RECEIPT'S CREDIT. A gate closed or a raided town defended, by a realm
-- character in a region where a guild it is a member of keeps a chapter:
-- one line a guild a receipt (`ref` `gate:<day>` or `raid:<key>`, the
-- receipt's own standing) and one a guild a member a UTC day for the
-- chapter's receipt writ (`wgate:<day>`, `wraid:<day>`). The key keeps
-- each once, so a receipt claimed again credits nothing; `tag` names the
-- write that made the line, so the Roll's row moves by that write's lines
-- alone. The record of what the receipts gave, as `npc_rep_events` is a
-- claim's.
CREATE TABLE IF NOT EXISTS npc_receipt_credits (
  char_id     TEXT NOT NULL,
  faction_id  INTEGER NOT NULL,
  ref         TEXT NOT NULL,
  player      TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  tag         TEXT NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (char_id, faction_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_npc_receipt_credits_tag ON npc_receipt_credits (char_id, tag);
