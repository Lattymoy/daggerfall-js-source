-- YARD-CELL YC3 (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 9) - THE TOWN-WIDE YARD TABLES DROPPED.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- YC1 (0190) keeps a town's yards a block at a time in `home_yard_cells` and `home_yard_cell_ver`. Since then nothing
-- builds or reads `home_yards`: it and `home_yards_ver` (0136) stayed only so that a service rolled back to before YC1
-- read correct yards, and 0136's three triggers kept its town versions moving on every yard write. YC1 has been live
-- without a rollback since 2026-10-28, so the net goes, and a yard write moves its cell's version alone.
DROP TRIGGER IF EXISTS home_yards_in;
DROP TRIGGER IF EXISTS home_yards_out;
DROP TRIGGER IF EXISTS home_yards_moved;
DROP TABLE IF EXISTS home_yards;
DROP TABLE IF EXISTS home_yards_ver;
