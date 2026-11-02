-- WOVEN-PAYS (FIELD BUGS 2026-10-26b; fogs, #feature-feedback: "First time XP bonus from the Loom still isn't working";
-- the owner: "Woven cloth pays"; bible/01-Overview/bugs/Field-Bugs-2026-10-26b.md, its AUDIT WOVEN-PAYS;
-- bible/06-Systems/Professions-Arc.md section 50.3).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- reads it (acct196; acct195 and 0176 on its branch, renumbered past LOCKPICK and AUDIT GATHER on main).
--
-- A piece made wholly of Linen or Wool (AUDIT 32 S1's 152 recipes) pays its pattern's first-make share wherever it
-- uses no bolt bought with silver - whatever goods the character wove or spun its cloth of. A unit's origin cannot say
-- it: `bought` is also the loom's own cloth of bought goods and a guildmate's cloth out of the guild Stores, and `loose`
-- is also a Weavers' bolt set down and picked up again. So the service counts.

-- THE SILVER COUNT: the bolts of Linen and Wool (src/net/recipeLaw.js JUDGED_CLOTH) a character has bought with silver -
-- the Weavers' and the furnisher's counters (professions.js buyStock), the Drakes market (market.js: a buy, a courier's
-- load, a buy order filled) - less every bolt of that cloth its stations have used since (craftAtAnvil, temperPiece).
-- While it stands, the bolts a craft uses are those, and its first lays on none. A row at nought is deleted.
CREATE TABLE IF NOT EXISTS prof_silver_cloth (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (player, char_id, material),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- THE COUNT AS IT STANDS: every bolt of Linen and Wool a character holds as bought, in its Stores and counted carried -
-- the Weavers', the furnisher's and the Drakes market's (the wall the decision read until now). A bolt bought before and
-- set down where the count no longer reads it is not known, and counts as none.
INSERT INTO prof_silver_cloth (player, char_id, material, qty)
  SELECT player, char_id, material, SUM(qty) FROM (
    SELECT player, char_id, material, qty FROM prof_stores WHERE origin = 'bought' AND material IN ('cloth:linen', 'cloth:wool') AND qty > 0
    UNION ALL
    SELECT player, char_id, material, qty FROM prof_carried WHERE origin = 'bought' AND material IN ('cloth:linen', 'cloth:wool') AND qty > 0
  ) GROUP BY player, char_id, material;

-- A PATTERN IS MADE BY THE CRAFT THAT LAID ITS FIRST ON: `first_paid` 1 where this craft laid its pattern's first-make
-- share on, 0 where it laid none on (not the first, or a bolt it used counted as bought with silver) - so a craft of
-- silver-bought cloth takes nothing, and the first is still owed to the next craft of the pattern that can pay. NULL for
-- a row from before it: the service reads such a row as laying its share on where it was the first and its XP holds the
-- share (professions.js craftAtAnvil `patternMade`, craftAnswer - a share eaten by the crafter's limit reads as owed, and
-- that track's limit pays it nothing again).
ALTER TABLE prof_crafts ADD COLUMN first_paid INTEGER CHECK (first_paid IS NULL OR first_paid IN (0, 1));
