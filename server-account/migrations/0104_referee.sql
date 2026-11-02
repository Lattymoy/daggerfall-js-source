-- INT7-INT10 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything
-- and do it properly"): PVP REFEREED EVERYWHERE - the arms the judge signs (INT7), a duel's result the relay signs
-- (INT8), a death in the open zone's drop taken off the record (INT9). 0097, then 0098, on its branch - renumbered past
-- BAG-CRAFT's 0097 and then the Chapters' 0098-0103 at the merges of main.
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

-- INT9, A DEATH IN THE OPEN ZONE (server-account/src/wild.js wildFall): its drop taken off the fallen's record once, by its
-- remains' id - the relay's (a fall it signed, net/wildReceipt.js `f1`) or the service's (a death to a foe). A second
-- asking is answered these records and the SAME order - issued at `oi`, for room `wm`, good its minute alone (AUDIT INT9:
-- a fresh order each asking laid one fall's drop again in a room that had let its emptied remains go). Swept
-- WILD_FALLS_KEEP_S after `at` (server-account/src/cron.js).
--   r        the remains' id (twelve hex: the relay's, or a digest of the character and its tab's nonce - a foe's)
--   char_id  the fallen's realm character        player  its account        killer  the killer's account (NULL: a foe)
--   at       when the drop was taken, epoch s     items   the records taken (JSON, the wire's - net/wildLaw.js)
--   kept     the ledger keys the record kept back (JSON - a copy, another's piece, a claim waiting)
--   burnt    1 where the judge held the record (lane 1's freeze): the drop taken, none of it given to the room
--   wi       0 where the first record is the killer's worn piece, else -1
--   wm       the room its remains are laid in (the relay's room key: the order names it - AUDIT INT9)
--   oi       when its order was issued, epoch s (its every order the same - AUDIT INT9)
--   wg       the fallen's guild then (the order names it: no guildmate takes from the remains), or NULL
--   tk       what the record lost, as the fallen's game finds it again (JSON `{ took, gold }` - wildDropLaw.js wildTookOf)
CREATE TABLE IF NOT EXISTS wild_falls (
  r TEXT PRIMARY KEY,
  char_id TEXT NOT NULL,
  player TEXT NOT NULL,
  killer TEXT,
  at INTEGER NOT NULL,
  items TEXT NOT NULL,
  kept TEXT NOT NULL DEFAULT '[]',
  burnt INTEGER NOT NULL DEFAULT 0,
  wi INTEGER NOT NULL DEFAULT -1,
  wm TEXT NOT NULL DEFAULT '',
  oi INTEGER NOT NULL DEFAULT 0,
  wg TEXT,
  tk TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_wild_falls_at ON wild_falls (at);
