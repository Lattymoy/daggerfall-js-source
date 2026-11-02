-- PROF11 (2026-10-01) - MASONRY: THE MASON'S BENCH, THE CHISEL AND THE SCULPTOR'S STONE
-- (bible/06-Systems/Professions-Arc.md 3.2, 3.3, 4.5, 4.8, 9.3, 9.4).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Numbered 0060: another
-- slice may take 0059 in parallel - the ledger applies them in their order whichever lands first.

-- A MASON'S WORK rides the forge's table (prof_smelts - one route, one table, each recipe naming its station: PROF4's
-- law), and is the one work with a craft's law (src/net/professionLaw.js MASON_RECIPES): its XP is 3.2's craft's, the
-- first time the character does it +500 - read in the work's own INSERT, as a craft's is, and kept as `first` so the
-- answer (and a repeat's) says it - and its act is the chisel, whose report a clean work's XP is half again on: kept as
-- `clean`. Every row before this is no mason's: neither (0, 0).
ALTER TABLE prof_smelts ADD COLUMN first INTEGER NOT NULL DEFAULT 0 CHECK (first IN (0, 1));
ALTER TABLE prof_smelts ADD COLUMN clean INTEGER NOT NULL DEFAULT 0 CHECK (clean IN (0, 1));
-- the character's first of a work, read in the decision (prof_crafts' idx_prof_crafts_recipe's twin)
CREATE INDEX IF NOT EXISTS idx_prof_smelts_recipe ON prof_smelts (player, char_id, recipe);
