-- YARD-SWEEP (2026-10-11, the owner: "remove any decor items that currently go above the height limit").
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- YARD-HEIGHT (migration-free, acct86) refused a yard's piece placed or moved higher than DECOR_YARD_HIGH (4 m) over the
-- ground, and left every piece standing from before it where it stood - the towers it was written against among them.
-- They go now: every yard piece whose place stands above the bound (src/net/decorLaw.js decorYardHighOk - its `pos`'s
-- height, from the building's own origin on the town's ground) is deleted, and the service never serves one again
-- (server-account/src/decor.js yardsOf). Nothing is given back: a yard's gold was paid from the save or the realm record,
-- which no statement here can reach, and the pieces stood against the law. A yard's piece holds nothing, serves no craft
-- and hires no trader (decorYardPlaceOf), so no other row names one. A room's pieces (`yard` 0) are never asked.
DELETE FROM home_decor
  WHERE yard = 1
    AND json_valid(place)   -- json_extract throws on a malformed place; such a row is never served (pieceOfRow)
    AND CAST(json_extract(place, '$.pos[1]') AS REAL) > 4;
