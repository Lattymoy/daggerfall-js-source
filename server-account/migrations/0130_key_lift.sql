-- KEY-LIFT (FIELD BUGS 2026-10-17f; the Discord, the evening after KEY-LAW: "bruhhhh it was that keyyyyy", over "The
-- realm's law has held this character three times. Its trading is frozen until October 24 at 3:21 AM, then opens on its
-- own.", and "like 5 other people reporting same thing"; bible/01-Overview/bugs/Field-Bugs-2026-10-17f.md).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). No Worker moves with it.
--
-- Migration 0125 lifted what law 6 laid on Weir Keys (template 575) only where EVERY law finding a character ever had
-- was the key's. A finding a staff act or a lift migration had already judged and cleared (0123's Aetheric pieces - the
-- gate's own set, worn by the players who farm the gate's keys - or staff's), and a finding an older law laid and a
-- later law loosened, both stood in that history, so the week's hold the key's strikes made stood on. This reads only
-- what still counts: the law findings since the character's last act that zeroed its count (a staff 'clear' or
-- 'rollback', 0123's and 0125's lifts; never 0120's copies' 'clear', which zeroed nothing), an excused finding none (it
-- held nothing). A finding is the KEY'S when every piece it names is a Weir Key's 'template' or an id on another piece
-- ('uid' - never a strike, server-account/src/verdict.js); one naming only ids strikes nothing; every other finding is
-- one that could have struck without the key, its count past its kept list (FINDINGS_KEPT) and an unreadable list
-- among them. Where a key's finding stands among fewer than three of those (judge.js STRIKES_FOR_TIMED), the key made
-- the timed hold: it is lifted, with every timed hold served, and the strikes are what the other findings could have
-- struck at most (one each) - the fade counted from the last of them. A character whose timed hold an act made since
-- (0120's 'timed') is left as it was, and so are staff's holds. The hold lifts only where no other finding holds it
-- (`law_sig` none, or the key's alone): a character carrying another finding stays held until it is gone, its
-- `law_sig` left as it was, so its next checkpoint is no new strike. The key's own signature is dropped - law 7 has
-- judged every checkpoint since 0125 and finds no key, so it stood for a clean record, and kept it would have made the
-- next real finding no strike. Written among the character's findings as a staff act is, with what it lifted and the
-- strikes it kept.
CREATE TABLE key_lift (char_id TEXT PRIMARY KEY, since INTEGER NOT NULL, other INTEGER NOT NULL DEFAULT 0, other_at INTEGER,
  kept INTEGER NOT NULL DEFAULT 0);
CREATE TABLE key_lift_other (char_id TEXT NOT NULL, at INTEGER NOT NULL);

-- every character the law's count could be holding, and the last act that zeroed that count
INSERT INTO key_lift (char_id, since)
  SELECT c.id, COALESCE((SELECT MAX(s.id) FROM realm_findings s WHERE s.char_id = c.id AND s.kind = 'staff'
      AND (json_extract(s.detail, '$.act') = 'rollback'
        OR (json_extract(s.detail, '$.act') = 'clear' AND COALESCE(json_extract(s.detail, '$.by'), '') <> 'auto-hold'))), 0)
  FROM realm_characters c
  WHERE (c.held IS NULL OR c.held <> 'staff') AND (c.held = 'law' OR c.strikes > 0 OR c.law_holds > 0 OR c.held_until IS NOT NULL);

-- no key's finding since, or a timed hold an act made since: not this
DELETE FROM key_lift WHERE NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = key_lift.char_id AND f.kind = 'law'
    AND f.id > key_lift.since AND COALESCE(json_extract(f.detail, '$.excused'), 0) <> 1
    AND EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE json_extract(j.value, '$.code') = 'template' AND json_extract(j.value, '$.t') = 575))
  OR EXISTS (SELECT 1 FROM realm_findings s WHERE s.char_id = key_lift.char_id AND s.kind = 'staff' AND s.id > key_lift.since
    AND json_extract(s.detail, '$.act') = 'timed');

-- the findings since that could have struck without the key
INSERT INTO key_lift_other (char_id, at)
  SELECT f.char_id, f.at FROM realm_findings f JOIN key_lift k ON k.char_id = f.char_id
  WHERE f.kind = 'law' AND f.id > k.since AND COALESCE(json_extract(f.detail, '$.excused'), 0) <> 1 AND (
    json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
    OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
    OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (json_extract(j.value, '$.code') = 'uid'
      OR (json_extract(j.value, '$.code') = 'template' AND json_extract(j.value, '$.t') = 575))));
UPDATE key_lift SET other = (SELECT COUNT(*) FROM key_lift_other o WHERE o.char_id = key_lift.char_id),
  other_at = (SELECT MAX(o.at) FROM key_lift_other o WHERE o.char_id = key_lift.char_id);
-- the strikes the character keeps: every strike it was counted (a timed hold served is three), no more than those
-- findings could have struck
UPDATE key_lift SET kept = (SELECT MIN(c.strikes + 3 * c.law_holds, key_lift.other) FROM realm_characters c WHERE c.id = key_lift.char_id);

-- three such findings could have made the timed hold without the key; and a character the lift would leave as it
-- stands is written nothing
DELETE FROM key_lift WHERE other >= 3
  OR EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = key_lift.char_id AND c.held_until IS NULL AND c.law_holds = 0
    AND c.strikes <= key_lift.kept AND NOT (c.held = 'law' AND (c.law_sig IS NULL OR c.law_sig = 'template:575')));

INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT c.player, c.id, c.seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff',
    json_object('act', 'clear', 'by', 'key-lift', 'was', c.held, 'until', c.held_until, 'strikes', c.strikes, 'served', c.law_holds, 'kept', k.kept)
  FROM realm_characters c JOIN key_lift k ON k.char_id = c.id;

UPDATE realm_characters SET
  held = CASE WHEN held = 'law' AND (law_sig IS NULL OR law_sig = 'template:575') THEN NULL ELSE held END,
  held_at = CASE WHEN held = 'law' AND (law_sig IS NULL OR law_sig = 'template:575') THEN NULL ELSE held_at END,
  law_sig = CASE WHEN law_sig = 'template:575' THEN NULL ELSE law_sig END,
  held_until = NULL, law_holds = 0,
  strikes = (SELECT k.kept FROM key_lift k WHERE k.char_id = realm_characters.id),
  law_at = (SELECT CASE WHEN k.kept > 0 THEN k.other_at END FROM key_lift k WHERE k.char_id = realm_characters.id),
  judge_rev = judge_rev + 1
  WHERE id IN (SELECT char_id FROM key_lift);

DROP TABLE key_lift_other;
DROP TABLE key_lift;
