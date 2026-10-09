-- INT7-INT10 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything
-- and do it properly"): PVP REFEREED EVERYWHERE - the arms the judge signs (INT7), a duel's result the relay signs
-- (INT8).
--
-- INT7, THE ARMS: what the most a realm character can strike with is, off its judged pack, for the identity token to
-- carry (net/identityToken.js `wa`) and every referee to clip a blow between players to.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- ON THE CHARACTER'S ROW (realm_characters), written by each checkpoint's verdict (server-account/src/verdict.js) and read
-- by the identity mint (server-account/src/realm.js realmArmsOf):
--   arms_top  the most reach (a weapon's top damage and its material's modifier - net/siegeRef.js armsTop) of any weapon
--             in the judged pack the item law takes; 0 for none; NULL before the first judged checkpoint since INT7
--   arms_bow  1 where a lawful bow is among them, else 0; NULL beside a NULL arms_top
ALTER TABLE realm_characters ADD COLUMN arms_top INTEGER;
ALTER TABLE realm_characters ADD COLUMN arms_bow INTEGER;

-- INT8, A DUEL'S RESULT (server-account/src/accounts.js claimDuel): a row of duel_results is written by a relay-signed
-- receipt now (net/duelReceipt.js `d1`), never by the loser's own report - and counted once, by its bout's id:
--   rk  the receipt's bout id (twelve hex, the relay's); NULL for every row before INT8 (DUEL1's loser's reports)
ALTER TABLE duel_results ADD COLUMN rk TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_duel_rk ON duel_results (rk) WHERE rk IS NOT NULL;
