-- KEY-LAW (FIELD BUGS 2026-10-17; slick, in the Discord's general channel, the hour the Elite Breach went live: "Playing
-- a new character I made last night and it's flagged by the new key thing"; bible/01-Overview/bugs/Field-Bugs-2026-10-17.md).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- carries item law 7.
--
-- Item law 7 (src/systems/item/itemLaw.js) reads the Weir Key's row (src/systems/eliteGates/weirKeyRow.js) beside the
-- registry: this service loads none of the key's home (systems/eliteGates/weirKey.js), so law 6 found every Weir Key a
-- template no honest client mints ('template', 575), and held its character's trade with a strike. An untimed hold lifts
-- by itself at the first checkpoint under law 7; this lifts the rest - every character, not staff's, whose law findings
-- were ONLY that one: the hold, a timed end, the strikes and the timed holds served. Written among the character's
-- findings as a staff act is, with what it lifted. `law_sig` is left as it was, so a checkpoint law 6 still judges
-- before the Worker moves is no new strike. A finding whose count passed the findings it kept (FINDINGS_KEPT) is not
-- read as only this: its character is left as it was.
INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail)
  SELECT player, id, seq, CAST(strftime('%s', 'now') AS INTEGER), 0, 'staff',
    json_object('act', 'clear', 'by', 'key-law', 'was', held, 'until', held_until, 'strikes', strikes, 'served', law_holds)
  FROM realm_characters
  WHERE (held IS NULL OR held <> 'staff') AND (held = 'law' OR strikes > 0 OR law_holds > 0 OR held_until IS NOT NULL)
    AND EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law')
    AND NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law' AND (
      json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
      OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
      OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (
        json_extract(j.value, '$.code') = 'template' AND json_extract(j.value, '$.t') = 575))));
UPDATE realm_characters SET held = CASE WHEN held = 'law' THEN NULL ELSE held END,
  held_at = CASE WHEN held = 'law' THEN NULL ELSE held_at END,
  held_until = NULL, strikes = 0, law_holds = 0, law_at = NULL, judge_rev = judge_rev + 1
  WHERE (held IS NULL OR held <> 'staff') AND (held = 'law' OR strikes > 0 OR law_holds > 0 OR held_until IS NOT NULL)
    AND EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law')
    AND NOT EXISTS (SELECT 1 FROM realm_findings f WHERE f.char_id = realm_characters.id AND f.kind = 'law' AND (
      json_type(f.detail, '$.findings') IS NOT 'array' OR json_array_length(f.detail, '$.findings') = 0
      OR COALESCE(json_extract(f.detail, '$.count'), 0) > json_array_length(f.detail, '$.findings')
      OR EXISTS (SELECT 1 FROM json_each(f.detail, '$.findings') j WHERE NOT (
        json_extract(j.value, '$.code') = 'template' AND json_extract(j.value, '$.t') = 575))));
