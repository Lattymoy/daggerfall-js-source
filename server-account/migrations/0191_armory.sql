-- ARMORY (2026-10-28, the owner: "Aura armory ... customize your character without changing your overall sprite";
-- bible/04-Characters/Aura-Armory.md) - THE AURA ARMORY: the pieces Dagon's Breach gave, the misses since the last, and
-- the kit worn.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- serves /v1/account/armory. SQLite has no ADD COLUMN IF NOT EXISTS, so a second run errors harmlessly.
--
-- A FIND IS A FACT, SO IT IS STORED (0040's law): `armory_held` holds a bit a Breach piece found (src/net/armoryLaw.js
-- ARMORY_PIECES' `bit`), set by a recorded Breach kill's roll (server-account/src/armory.js). A shop piece is a ware's
-- bit on `shop_wares` (0189). `armory_miss` counts the recorded kills since the last piece - the pity's count.
ALTER TABLE players ADD COLUMN armory_held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN armory_miss INTEGER NOT NULL DEFAULT 0;
-- THE KIT WORN: five characters, a slot each (armoryLaw.js armoryKitOk), NULL for none. Read against what is held at
-- every ask (titles.js armoryWorn), so a piece refunded is signed for no more.
ALTER TABLE players ADD COLUMN armory TEXT;
