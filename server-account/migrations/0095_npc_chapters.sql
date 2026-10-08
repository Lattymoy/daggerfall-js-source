-- CHAP3b (2026-10-08) - STRENGTH: each chapter's, moved at the week's Turning.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct95) BEFORE the site.
--
-- Mac: "Continue", on "Keep going with the arc/slices"
-- (bible/11-Multiplayer/Chapters-Arc.md sections 5.2 and 5.3, CHAP3b). The
-- law is src/net/npcChapterLaw.js; the service src/npcChapters.js.
--
-- THE WEEKS SETTLED. One row a seat week whose Turning moved the chapters'
-- Strength: the key a second settle of the week fails on (its whole batch
-- rolled back), the accounts that played and the week's target, how many
-- chapters it moved. AUDIT CHAP3 S2: and the switch it settled under
-- (CHAPTERS_OPEN, 'dev' or 'on') - the first week settled 'on' after weeks
-- at 'dev' starts every chapter from 50, so the developers' trial weeks
-- leave no chapter Failing, nor Ascendant, the day the Chapters open.
CREATE TABLE IF NOT EXISTS npc_chapter_weeks (
  week      INTEGER PRIMARY KEY,
  active    INTEGER NOT NULL,
  target    INTEGER NOT NULL,
  chapters  INTEGER NOT NULL,
  open      TEXT NOT NULL DEFAULT 'on' CHECK (open IN ('dev', 'on')),
  at        INTEGER NOT NULL
);
-- THE CHAPTERS. One row a guild faction and region a Turning has settled:
-- its Strength, the week that last moved it and that week's Merit. A
-- chapter no Turning has settled yet stands at 50 (STRENGTH_START).
CREATE TABLE IF NOT EXISTS npc_chapters (
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  strength  INTEGER NOT NULL CHECK (strength BETWEEN 0 AND 100),
  week      INTEGER NOT NULL,
  merit     INTEGER NOT NULL DEFAULT 0,
  at        INTEGER NOT NULL,
  PRIMARY KEY (faction, region)
);
CREATE INDEX IF NOT EXISTS idx_npc_chapters_region ON npc_chapters (region);
