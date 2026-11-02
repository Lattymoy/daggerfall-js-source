-- HOME-YARD (2026-09-30) - PIECES OUTSIDE AN ONLINE HOME, ON ITS OWN LOT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Asked: "allowing for prop placement on the outside within the limits of
-- their house". A yard's piece is a piece of decor (DECOR1's `home_decor`,
-- the same law, src/net/decorLaw.js decorYardPieceOf) standing OUTSIDE:
-- `yard` 1, its place from the building's own origin outdoors (the
-- building's position in its town, the same on every client), within the
-- lot the client measures and the law's own bound. The room's list reads
-- the pieces with `yard` 0, as before; the town reads every home's yard.
-- They go with the home (the cascade through `homes`), as its room's do.
ALTER TABLE home_decor ADD COLUMN yard INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_home_decor_yard ON home_decor (map_id, yard);
