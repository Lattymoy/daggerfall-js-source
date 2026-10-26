-- YARD-TOWN (2026-10-25, players: "Decorative items placed in any house yard in that area disappear after restarting the
-- game, even when the Saved to the Realm notification pops up"; bible/06-Systems/Online-Arc.md YARD-TOWN): EVERY TOWN'S
-- YARDS BUILT AGAIN AT THE TOWN'S NEW BOUND.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service
-- (acct191) with the site; no relay change.
--
-- A town's yards answered 2,000 pieces (DECOR_YARDS_TOWN_MAX), cut in building-key order, and placing never asked it:
-- Daggerfall's city held 3,357 on 2026-10-19 (0136's own count), so the pieces of its eastern blocks were written and
-- never served. The bound is now 6,500 (src/net/decorLaw.js, as many rows as a built row keeps) and placing refuses a
-- piece past it (server-account/src/decor.js, `yard-town-full`).
--
-- The bound is part of the build's shape (decor.js YARD_SNAP_SHAPE), so every row 0136 and the clock built is another
-- shape now: read as its rows stand until the minute's clock, fifty towns a firing, builds it again - the reads YARD-SNAP
-- took off the database, for every town at once. This builds them all here instead, in the shape the code reads
-- (decor.js yardsBuildSql, word for word but the shape and the bound written as they stand), as 0136 did. A town with no
-- version row has no built row to replace and is read as it stands, as before.
INSERT INTO home_yards (map_id, built, shape, rows)
  SELECT v.map_id, v.ver, '05361a66', (SELECT CASE WHEN length(CAST(j AS BLOB)) <= 1500000 THEN j END FROM (SELECT json_group_array(json_array(map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)) AS j
    FROM (SELECT map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard FROM home_decor
      WHERE map_id = v.map_id AND yard = 1 ORDER BY building_key, placed_at, id LIMIT 6500)))
  FROM home_yards_ver v WHERE true
  ON CONFLICT (map_id) DO UPDATE SET built = excluded.built, shape = excluded.shape, rows = excluded.rows;
