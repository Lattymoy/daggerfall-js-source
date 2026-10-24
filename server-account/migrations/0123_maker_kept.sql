-- MAKER-KEPT (FIELD BUGS 2026-10-16c; Flylighter, "Grandfathered Items triggering trade lock": "Enchanted a few pieces
-- of Ruhn's set back before the change that disallowed enchanting them. Now, I'm getting a trade lock notice on account
-- of my gear!", then "I've been wrongly trade-locked for a week"; bible/01-Overview/bugs/Field-Bugs-2026-10-16c.md).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- carries item law 6.
--
-- Item law 6 (src/systems/item/itemLaw.js MAKER_ERA_AETHERIC) keeps the item maker's rows on an Aetheric piece of a
-- record it took before AETHERIC-MAKER (2026-10-03): Ruhn's Regalia and the raiding parties' three sets. Law 5 found
-- every such piece forged ('aetheric' and 'enchantments'), so its owner's trade was held, each time it was taken up again
-- was a strike, and the third a timed hold (AUTO-HOLD, 0120) that no clean checkpoint lifts. An untimed hold lifts by
-- itself at the first checkpoint under law 6; this lifts the rest - every character, not staff's, whose law findings
-- were ONLY those two codes on the templates those records stand on: the hold, its timed end, the strikes and the timed
-- holds served. Written among the character's findings as a staff act is, with what it lifted.
--
-- A finding keeps a piece's template and no record id, and the later sets' records (the Serpent's, Numidium's) stand on
-- some of the same templates, so a forged row on one of those is lifted too - and found again at its first checkpoint
-- while it is carried, and held (`law_sig` is left as it was, so that checkpoint is no new strike). A finding whose
-- count passed the findings it kept (FINDINGS_KEPT) is not read as only these: its character is left as it was.
INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT player, id, seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff',
    json_object('act', 'clear', 'by', 'maker-kept', 'was', held, 'until', held_until, 'strikes', strikes, 'served', law_holds)
  FROM realm_characters
  WHERE (held IS NULL OR held <> 'staff') AND (held = 'law' OR strikes > 0 OR law_holds > 0 OR held_until IS NOT NULL)
    AND EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law')
    AND NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law' AND (
      json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
      OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
      OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (
        json_extract(j.value, '$.code') IN ('aetheric', 'enchantments')
        AND json_extract(j.value, '$.t') IN (102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 119, 120, 124, 127)))));
UPDATE realm_characters SET held = CASE WHEN held = 'law' THEN NULL ELSE held END,
  held_at = CASE WHEN held = 'law' THEN NULL ELSE held_at END,
  held_until = NULL, strikes = 0, law_holds = 0, law_at = NULL, judge_rev = judge_rev + 1
  WHERE (held IS NULL OR held <> 'staff') AND (held = 'law' OR strikes > 0 OR law_holds > 0 OR held_until IS NOT NULL)
    AND EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law')
    AND NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law' AND (
      json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
      OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
      OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (
        json_extract(j.value, '$.code') IN ('aetheric', 'enchantments')
        AND json_extract(j.value, '$.t') IN (102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 119, 120, 124, 127)))));
