-- SERPENT5 (2026-10-15, Mac: "A gilded weapon to the serpent + a rare chance of a title/aura drop";
-- bible/11-Multiplayer/Sea-Serpent.md section 17).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE OLD COIL'S GRANTS ON THE KILL'S ROW - what its first write granted (server-account/src/serpents.js claimSerpent),
-- as an Hour's row says its own (0090's sd_kills). 0 for every row before this.
ALTER TABLE serpent_kills ADD COLUMN title INTEGER NOT NULL DEFAULT 0;
ALTER TABLE serpent_kills ADD COLUMN aura INTEGER NOT NULL DEFAULT 0;
-- AND ON THE ACCOUNT'S - Coilbreaker (1) and The Maelstrom (2), laid by a dealing ship's kill's first write and held for
-- good, read off the row as Hourbreaker and The Turning Hour are off `sd_honours` (titles.js). 0 for every row before this.
ALTER TABLE players ADD COLUMN serpent_honours INTEGER NOT NULL DEFAULT 0;
