-- INT11-INT14 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6; Mac: "I want to do
-- everything and do it properly", and of the healing the relay cannot see: "Measure, then enforce"): THE BODY COUNTED.
-- The relay counts each fighter's body in a boss fight (net/bossBody.js, net/bossRef.js) and signs its MEASURE on the
-- fighter's receipt (`m`); the claim keeps it here, for staff to read (/v1/mod/realm-bodies, tools/realmReview.mjs
-- bodies) and set the line the relay enforces from (its BOSS_BODY var).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- ON EACH KILL'S ROW (gate_kills, sd_kills, serpent_kills), written by its claim from the receipt (accounts.js claimGate,
-- sds.js claimSd, serpents.js claimSerpent):
--   body  the measure, JSON [counted, believed, claimed past the line] in thousandths of a whole, the count's falls,
--         whether the receipt would have stood had the first been a fall (1/0), the seconds stood; NULL from a relay
--         before INT11, and on a gate's rite-alone row
ALTER TABLE gate_kills ADD COLUMN body TEXT;
ALTER TABLE sd_kills ADD COLUMN body TEXT;
ALTER TABLE serpent_kills ADD COLUMN body TEXT;
