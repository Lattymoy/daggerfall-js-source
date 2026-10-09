-- CHAP3b (2026-10-08) - STRENGTH: each chapter's, moved at the week's Turning.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct99 - AUDIT CHAP4 R1: acct95 then, renumbered at the merges of main) BEFORE the site.
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
-- AUDIT CHAP4 S2 (grown in place): or 'off' - a week that passed while the
-- Chapters were shut, recorded and nothing moved (no Merit could be earned
-- in it), so the Turnings after the switch is on again start past it.
CREATE TABLE IF NOT EXISTS npc_chapter_weeks (
  week      INTEGER PRIMARY KEY,
  active    INTEGER NOT NULL,
  target    INTEGER NOT NULL,
  chapters  INTEGER NOT NULL,
  open      TEXT NOT NULL DEFAULT 'on' CHECK (open IN ('dev', 'on', 'off')),
  at        INTEGER NOT NULL
);
-- THE CHAPTERS. One row a guild faction and region a Turning has settled:
-- its Strength, the week that last moved it and that week's Merit. A
-- chapter no Turning has settled yet stands at 50 (STRENGTH_START).
-- CHAP4d (grown in place - nothing of it shipped): and its Master's Focus,
-- the material family its hall writs ask more of, and the week it was
-- chosen in (it holds for that week alone).
-- CHAP6a (grown in place): and its Season's event (Chapters-Arc 7) - the
-- event drawn at the Turning that opened Season `event_season`, its state
-- (`event_data`: a Rivalry's rival, a Decline's Strength lost so far, an
-- ending's outcome), and the Season a Crackdown shut its halls for.
-- CHAP6b (grown in place): and the doctrine a Schism carried, and the
-- Season it holds for.
CREATE TABLE IF NOT EXISTS npc_chapters (
  faction   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  strength  INTEGER NOT NULL CHECK (strength BETWEEN 0 AND 100),
  week      INTEGER NOT NULL,
  merit     INTEGER NOT NULL DEFAULT 0,
  at        INTEGER NOT NULL,
  focus     TEXT,
  focus_week INTEGER,
  event     TEXT CHECK (event IS NULL OR event IN ('calm', 'schism', 'succession', 'crackdown', 'rivalry', 'decline', 'ascendancy')),
  event_season INTEGER,
  event_data TEXT NOT NULL DEFAULT '{}',
  shut_season INTEGER,
  doctrine  TEXT CHECK (doctrine IS NULL OR doctrine IN ('training', 'shelf', 'writs')),
  doctrine_season INTEGER,
  PRIMARY KEY (faction, region)
);
CREATE INDEX IF NOT EXISTS idx_npc_chapters_region ON npc_chapters (region);
