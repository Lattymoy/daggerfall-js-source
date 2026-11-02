-- SOUL-LAW (FIELD BUGS 2026-10-20h; a player's report from the Discord's #bug-reports, the day Daggerfall Enemy Expansion
-- went live: a Soul Trap holding an Ogre's soul, and the realm's notice that the character's trading was frozen;
-- bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- carries item law 9.
--
-- Item law 9 (src/systems/item/itemLaw.js) takes the soul of one of the mod's fifty (src/systems/enemyExpansion/dexIds.js)
-- in a Soul Gem (template 274) or Azura's Star (an amulet, 133): law 8 found each one 'soul', and held its trapper's trade
-- with a strike - three gems filled and sold, three strikes and a week's hold. An untimed hold lifts by itself at the
-- first checkpoint under law 9; this lifts the rest, as migration 0130 lifted the Weir Key's (KEY-LIFT, whose reading this
-- is): it reads the law findings since the character's last act that zeroed its count (a staff 'clear' or 'rollback',
-- the lifts 0123 and 0125 wrote; never 0120's copies' 'clear', which zeroed nothing, nor 0130's, which kept strikes). A
-- finding is the SOUL'S when every piece it names is a 'soul' on a Soul Gem or an amulet, or an id on another piece
-- ('uid' - never a strike, server-account/src/verdict.js), or a Weir Key's 'template' (law 6's, lifted by 0125 and 0130 -
-- no law since finds one); every other finding could have struck without the soul, its count past its kept list
-- (FINDINGS_KEPT) and an unreadable list among them. Where a soul's finding stands among fewer than three of those
-- (judge.js STRIKES_FOR_TIMED), the soul made the timed hold: it is lifted, with every timed hold served, and the strikes
-- are what the other findings could have struck at most (one each) - the fade counted from the last of them. A character
-- whose timed hold an act made since (0120's 'timed') is left as it was, and so are staff's holds. The hold lifts only
-- where no other finding holds it (`law_sig` none, or the soul's alone). `law_sig` is left as it was, as 0125 left the
-- key's: a checkpoint law 8 still judges before the Worker moves finds the same gem, and is no new strike. Written among
-- the character's findings as a staff act is, with what it lifted and the strikes it kept.
CREATE TABLE soul_lift (char_id TEXT PRIMARY KEY, since INTEGER NOT NULL, other INTEGER NOT NULL DEFAULT 0, other_at INTEGER,
  kept INTEGER NOT NULL DEFAULT 0);
CREATE TABLE soul_lift_other (char_id TEXT NOT NULL, at INTEGER NOT NULL);

-- every character the law's count could be holding, and the last act that zeroed that count
INSERT INTO soul_lift (char_id, since)
  SELECT c.id, COALESCE((SELECT MAX(s.id) FROM realm_findings s WHERE s.char_id = c.id AND s.kind = 'staff'
      AND (json_extract(s.detail, '$.act') = 'rollback'
        OR (json_extract(s.detail, '$.act') = 'clear' AND COALESCE(json_extract(s.detail, '$.by'), '') NOT IN ('auto-hold', 'key-lift')))), 0)
  FROM realm_characters c
  WHERE (c.held IS NULL OR c.held <> 'staff') AND (c.held = 'law' OR c.strikes > 0 OR c.law_holds > 0 OR c.held_until IS NOT NULL);

-- no soul's finding since, or a timed hold an act made since: not this
DELETE FROM soul_lift WHERE NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = soul_lift.char_id AND f.kind = 'law'
    AND f.id > soul_lift.since AND COALESCE(json_extract(f.detail, '$.excused'), 0) <> 1
    AND EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE json_extract(j.value, '$.code') = 'soul' AND json_extract(j.value, '$.t') IN (274, 133)))
  OR EXISTS (SELECT 1 FROM realm_findings s WHERE s.char_id = soul_lift.char_id AND s.kind = 'staff' AND s.id > soul_lift.since
    AND json_extract(s.detail, '$.act') = 'timed');

-- the findings since that could have struck without the soul
INSERT INTO soul_lift_other (char_id, at)
  SELECT f.char_id, f.at FROM realm_findings f JOIN soul_lift k ON k.char_id = f.char_id
  WHERE f.kind = 'law' AND f.id > k.since AND COALESCE(json_extract(f.detail, '$.excused'), 0) <> 1 AND (
    json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
    OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
    OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (json_extract(j.value, '$.code') = 'uid'
      OR (json_extract(j.value, '$.code') = 'soul' AND json_extract(j.value, '$.t') IN (274, 133))
      OR (json_extract(j.value, '$.code') = 'template' AND json_extract(j.value, '$.t') = 575))));
UPDATE soul_lift SET other = (SELECT COUNT(*) FROM soul_lift_other o WHERE o.char_id = soul_lift.char_id),
  other_at = (SELECT MAX(o.at) FROM soul_lift_other o WHERE o.char_id = soul_lift.char_id);
-- the strikes the character keeps: every strike it was counted (a timed hold served is three), no more than those
-- findings could have struck
UPDATE soul_lift SET kept = (SELECT MIN(c.strikes + 3 * c.law_holds, soul_lift.other) FROM realm_characters c WHERE c.id = soul_lift.char_id);

-- three such findings could have made the timed hold without the soul; and a character the lift would leave as it
-- stands is written nothing
DELETE FROM soul_lift WHERE other >= 3
  OR EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = soul_lift.char_id AND c.held_until IS NULL AND c.law_holds = 0
    AND c.strikes <= soul_lift.kept AND NOT (c.held = 'law' AND (c.law_sig IS NULL OR c.law_sig IN ('soul:274', 'soul:133', 'soul:133,soul:274'))));

INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT c.player, c.id, c.seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff',
    json_object('act', 'clear', 'by', 'soul-lift', 'was', c.held, 'until', c.held_until, 'strikes', c.strikes, 'served', c.law_holds, 'kept', k.kept)
  FROM realm_characters c JOIN soul_lift k ON k.char_id = c.id;

UPDATE realm_characters SET
  held = CASE WHEN held = 'law' AND (law_sig IS NULL OR law_sig IN ('soul:274', 'soul:133', 'soul:133,soul:274')) THEN NULL ELSE held END,
  held_at = CASE WHEN held = 'law' AND (law_sig IS NULL OR law_sig IN ('soul:274', 'soul:133', 'soul:133,soul:274')) THEN NULL ELSE held_at END,
  held_until = NULL, law_holds = 0,
  strikes = (SELECT k.kept FROM soul_lift k WHERE k.char_id = realm_characters.id),
  law_at = (SELECT CASE WHEN k.kept > 0 THEN k.other_at END FROM soul_lift k WHERE k.char_id = realm_characters.id),
  judge_rev = judge_rev + 1
  WHERE id IN (SELECT char_id FROM soul_lift);

DROP TABLE soul_lift_other;
DROP TABLE soul_lift;
