-- BILL1 (AUDIT BILL B1, 2026-10-24; bible/11-Multiplayer/Bill-Arc.md): A PIECE'S MAKER, FOUND BY THE PIECE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads it.
--
-- The Work tab's eligible pieces (writs.js eligibleHere) and a crafting writ's pieces (craftWrits.js pieceOkSql) ask, of
-- every piece they weigh, whether the reader made it: a prof_crafts row of the player's naming it as its provenance or its
-- second. prof_crafts was found by the player alone (idx_prof_crafts_recipe), so each piece walked the crafter's whole
-- history of crafts - nothing deletes one - pieces times crafts. With these two indexes, and the question asked as one
-- EXISTS a column (the planner takes neither index for an OR of the two), each piece is one search.
CREATE INDEX IF NOT EXISTS idx_prof_crafts_provenance ON prof_crafts (player, provenance);
CREATE INDEX IF NOT EXISTS idx_prof_crafts_provenance2 ON prof_crafts (player, provenance2) WHERE provenance2 IS NOT NULL;
