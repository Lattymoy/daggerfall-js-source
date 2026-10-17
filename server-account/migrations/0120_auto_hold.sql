-- AUTO-HOLD (2026-10-16, Mac: "We need to figure out a better system for trade banning. I dont want to have to manually
-- review"; bible/06-Systems/Integrity-Arc.md, AUTO-HOLD).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE LAW'S TIMED HOLD (server-account/src/verdict.js lawCountOf): the third strike holds a character's trade for a time
-- - a week, each one after it a month - and the strikes and the holds served fade a month after the last finding that
-- held. NULL / 0 for every row before this.
--   held_until  the timed hold's end (seconds), or NULL
--   law_holds   the timed holds served since the count last faded
--   law_at      when the fade counts from - the last finding that held, or the last timed hold's end
ALTER TABLE realm_characters ADD COLUMN held_until INTEGER;
ALTER TABLE realm_characters ADD COLUMN law_holds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realm_characters ADD COLUMN law_at INTEGER;

-- A HOLD WAITING FOR STAFF ON THE LAW'S COUNT (STRIKES_FOR_REVIEW come, as it was) becomes the first timed hold, a week
-- from now - FIRST, before the copies' holds lift (AUDIT AUTO-HOLD: a law hold at three strikes that copies charged
-- after became 'dupe'; lifted first, it slipped past this conversion and its next checkpoint held it a week from THEN,
-- with no finding saying so). Written among the character's findings as a staff act is, with the hold it was.
INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT player, id, seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff',
    json_object('act', 'timed', 'by', 'auto-hold', 'was', held, 'until', CAST(strftime('%s', 'now') AS INTEGER) + 604800)
  FROM realm_characters WHERE held IN ('law', 'dupe') AND strikes >= 3;
UPDATE realm_characters SET held = 'law', held_at = CASE WHEN held = 'law' THEN held_at ELSE CAST(strftime('%s', 'now') AS INTEGER) END,
  held_until = CAST(strftime('%s', 'now') AS INTEGER) + 604800, law_holds = 1, strikes = 0,
  law_at = CAST(strftime('%s', 'now') AS INTEGER) + 604800, judge_rev = judge_rev + 1
  WHERE held IN ('law', 'dupe') AND strikes >= 3;

-- THE COPIES' HOLD IS RETIRED: a copy locks its piece (item_dupes), never the character. Every 'dupe' hold still
-- standing is lifted - its copied pieces stay locked - and the lift is written among the character's findings as a
-- staff act is.
INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT player, id, seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff', json_object('act', 'clear', 'by', 'auto-hold', 'was', 'dupe')
  FROM realm_characters WHERE held = 'dupe';
UPDATE realm_characters SET held = NULL, held_at = NULL, judge_rev = judge_rev + 1 WHERE held = 'dupe';

-- THE STRIKES STANDING FADE TOO (AUDIT AUTO-HOLD: the old law's strikes never fell, and a row with one or two came out
-- of this migration with no `law_at` - lawCountOf fades only from one - so a strike from before it stood for good, and
-- one finding a year on was a week's hold). The fade counts from the last finding that held (its finding's time), or
-- from now where the findings were swept.
UPDATE realm_characters SET law_at = COALESCE((SELECT MAX(f.at) FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law'),
  CAST(strftime('%s', 'now') AS INTEGER)), judge_rev = judge_rev + 1
  WHERE strikes > 0 AND law_at IS NULL;
