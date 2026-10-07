-- CRAFT3 (2026-10-07) - FIVE CRAFTS, NOT EIGHT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "How could we enhance the profession element of the game while
-- reducing complexity and making crafting more viable", then "Lets do
-- it" (bible/06-Systems/Professions-Arc.md 41.2, CRAFT3; 41.6 as
-- built). Eight crafting tracks become five: Smithing takes
-- Jewelcrafting's, Building is Carpentry's and Masonry's, Provisioning
-- Alchemy's and Cooking's; Outfitting and Enchanting stand as they are.
-- The disciplines stay (a Ring is still Jewelcrafting's work, the
-- Gemcutter its choice) - the TRACK is the craft's (professionLaw.js
-- trackOf).
--
-- THE MERGE, DECIDED (41.2): a merged track takes the HIGHER of its two
-- parents' XP. Its choice at a rank is the higher parent's where that
-- one chose, else the other's. A character who chose at a rank under
-- both keeps the higher's and re-chooses free (`free_respec`: 1 the
-- choice at 50, 2 at 100 - no Marks, in effect at once, once;
-- professions.js chooseSpec). A change on its way (bought, 1,000 Marks)
-- is the higher parent's where it has one; else the other's where its
-- rank's choice is the one kept; any other is dropped, and its rank's
-- change made free in its place. A change already in effect is folded
-- into its choice first, so nothing in force is read as on its way.
-- The higher of the two is the one with more XP; equal, the first named
-- (Smithing, Carpentry, Alchemy). The crafter's limit holds: a merged
-- track is above Journeyman only where a parent was, so a character
-- never stands over two after it.

ALTER TABLE prof_tracks ADD COLUMN free_respec INTEGER NOT NULL DEFAULT 0;

-- a change already in effect, folded (the merging parents' rows alone)
UPDATE prof_tracks SET
    spec50 = CASE WHEN respec_rank = 50 THEN respec_to ELSE spec50 END,
    spec100 = CASE WHEN respec_rank = 100 THEN respec_to ELSE spec100 END,
    respec_rank = NULL, respec_to = NULL, respec_at = NULL
  WHERE profession IN ('smithing', 'jewelcrafting', 'carpentry', 'masonry', 'alchemy', 'cooking')
    AND respec_to IS NOT NULL AND respec_at <= CAST(strftime('%s', 'now') AS INTEGER);

-- each character's two parents, the higher one and the lower one
CREATE TABLE craft3_pairs AS
  SELECT player, char_id, craft,
    CASE WHEN a_hi THEN a_xp ELSE b_xp END AS hi_xp,
    CASE WHEN a_hi THEN a_s50 ELSE b_s50 END AS hi_s50,
    CASE WHEN a_hi THEN a_s100 ELSE b_s100 END AS hi_s100,
    CASE WHEN a_hi THEN a_rr ELSE b_rr END AS hi_rr,
    CASE WHEN a_hi THEN a_rt ELSE b_rt END AS hi_rt,
    CASE WHEN a_hi THEN a_ra ELSE b_ra END AS hi_ra,
    CASE WHEN a_hi THEN b_s50 ELSE a_s50 END AS lo_s50,
    CASE WHEN a_hi THEN b_s100 ELSE a_s100 END AS lo_s100,
    CASE WHEN a_hi THEN b_rr ELSE a_rr END AS lo_rr,
    CASE WHEN a_hi THEN b_rt ELSE a_rt END AS lo_rt,
    CASE WHEN a_hi THEN b_ra ELSE a_ra END AS lo_ra,
    MAX(COALESCE(a_up, 0), COALESCE(b_up, 0)) AS updated_at
  FROM (
    SELECT k.player, k.char_id, k.craft,
      a.xp AS a_xp, a.spec50 AS a_s50, a.spec100 AS a_s100, a.respec_rank AS a_rr, a.respec_to AS a_rt, a.respec_at AS a_ra, a.updated_at AS a_up,
      b.xp AS b_xp, b.spec50 AS b_s50, b.spec100 AS b_s100, b.respec_rank AS b_rr, b.respec_to AS b_rt, b.respec_at AS b_ra, b.updated_at AS b_up,
      (a.player IS NOT NULL AND (b.player IS NULL OR a.xp >= b.xp)) AS a_hi
    FROM (
      SELECT DISTINCT t.player, t.char_id, p.craft, p.a, p.b FROM prof_tracks t
      JOIN (SELECT 'smithing' AS craft, 'smithing' AS a, 'jewelcrafting' AS b
            UNION ALL SELECT 'building', 'carpentry', 'masonry'
            UNION ALL SELECT 'provisioning', 'alchemy', 'cooking') p ON t.profession IN (p.a, p.b)
    ) k
    LEFT JOIN prof_tracks a ON a.player = k.player AND a.char_id = k.char_id AND a.profession = k.a
    LEFT JOIN prof_tracks b ON b.player = k.player AND b.char_id = k.char_id AND b.profession = k.b
  );

-- the merged track: the higher's XP; a rank's choice the higher's, else the lower's; the change on its way the higher's,
-- else the lower's where its rank's choice is kept (`lo_kept`); a rank free where the lower's choice there was lost or its
-- change there dropped
CREATE TABLE craft3_merged AS
  SELECT player, char_id, craft AS profession, hi_xp AS xp,
    COALESCE(hi_s50, lo_s50) AS spec50,
    COALESCE(hi_s100, lo_s100) AS spec100,
    CASE WHEN hi_rr IS NOT NULL THEN hi_rr WHEN lo_kept THEN lo_rr END AS respec_rank,
    CASE WHEN hi_rr IS NOT NULL THEN hi_rt WHEN lo_kept THEN lo_rt END AS respec_to,
    CASE WHEN hi_rr IS NOT NULL THEN hi_ra WHEN lo_kept THEN lo_ra END AS respec_at,
    updated_at,
    (CASE WHEN (hi_s50 IS NOT NULL AND lo_s50 IS NOT NULL) OR (lo_rr = 50 AND NOT lo_kept) THEN 1 ELSE 0 END)
      | (CASE WHEN (hi_s100 IS NOT NULL AND lo_s100 IS NOT NULL) OR (lo_rr = 100 AND NOT lo_kept) THEN 2 ELSE 0 END) AS free_respec
  FROM (
    SELECT *, (hi_rr IS NULL AND lo_rr IS NOT NULL
      AND ((lo_rr = 50 AND hi_s50 IS NULL) OR (lo_rr = 100 AND hi_s100 IS NULL))) AS lo_kept
    FROM craft3_pairs
  );

DELETE FROM prof_tracks WHERE profession IN ('smithing', 'jewelcrafting', 'carpentry', 'masonry', 'alchemy', 'cooking');
INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, respec_rank, respec_to, respec_at, updated_at, free_respec)
  SELECT player, char_id, profession, xp, spec50, spec100, respec_rank, respec_to, respec_at, updated_at, free_respec FROM craft3_merged;
DROP TABLE craft3_merged;
DROP TABLE craft3_pairs;
