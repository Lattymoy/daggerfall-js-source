-- RPT1026-LEDGERLAW (2026-10-26, the private report inbox; bible/06-Systems/Integrity-Arc.md): THE CRAFT'S RECORD
-- FOLLOWS THE SERVICE'S HAND-OVERS, AND STAFF'S EXCUSE IS OF THE STATE THEY READ.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it. No relay change.
--
-- `products.handed_to`: the account the service last handed a crafted piece to, where that is not its owner - written
-- by every move the service makes of the piece into a realm record from the account the craft's record names (server-account/
-- src/ledger.js ledgerMoves: a realm trade, a market delivery collected, a vault's or a chest's - AUDIT RPT1026 C1: from
-- no other giver, so a seller that kept a sold piece hands no record on), cleared by a sale that moves its owner (market.js
-- pieceSoldSteps, writs.js's commission fill). The ledger settles a contested claim on a crafted piece for the account
-- the craft's record names (ledger.js CRAFT_RECORD_SQL): its owner alone, until now - a realm trade moves no owner, so a
-- maker who traded a piece away and wrote it back into its save took it back from its buyer, and the buyer's was locked
-- as the copy. NULL for every piece today: no hand-over before this one is known, so each stands as it did.
ALTER TABLE products ADD COLUMN handed_to TEXT;

-- `realm_characters.law_v`: the values the character law found at the last judgement (judge.js lawValuesOf - the purse,
-- a bank, the level, an attribute, a skill), beside `law_sig`. Staff's clear excuses the signature AND these
-- (review.js clear, verdict.js lawExcused): `law_sig` names a character finding by its code alone, so a cleared negative
-- purse excused every purse after it. NULL until a character's next judgement; an excuse written before this stands for
-- its pieces' findings alone.
ALTER TABLE realm_characters ADD COLUMN law_v TEXT;
