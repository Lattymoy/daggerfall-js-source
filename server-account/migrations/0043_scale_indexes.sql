-- SCALE1 (2026-09-30, the scaling audit - Mac: "set the stage for a larger player base in the future") - THE
-- STATEMENTS THAT READ A WHOLE TABLE, given an index each.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Every statement is
-- IF NOT EXISTS, and no row is changed: an index is only a way to find rows.
--
-- Each was found by EXPLAIN QUERY PLAN over the real migrations (test/scale1.test.js asks it again, so a query
-- rewritten past its index, or an index dropped by a table's rebuild, is a failing pin rather than a slow afternoon).
-- D1 has ONE writer for the whole service: a statement that scans a table holds every other write behind it, and
-- these tables only grow.

-- A PIECE'S PROVENANCE, asked of every home's decor before a listing, a writ's delivery or a placement may name it
-- (market.js listing, writs.js, decor.js - AUDIT 30 S6): the expression itself, as the statements write it.
CREATE INDEX IF NOT EXISTS idx_home_decor_pv ON home_decor (json_extract(item, '$.pv'));

-- ...and of the deliveries still waiting to be collected (AUDIT 30 S5); and the History's sweep of collected ones.
CREATE INDEX IF NOT EXISTS idx_market_deliveries_provenance ON market_deliveries (provenance, collected);
CREATE INDEX IF NOT EXISTS idx_market_deliveries_at ON market_deliveries (collected, at);

-- A TRADE'S FIRST HALF replaces any other its character left waiting (realmTrade.js, AUDIT REALM2 S5).
CREATE INDEX IF NOT EXISTS idx_realm_trades_waiting ON realm_trades (a_player, a_char, state);

-- THE WEEK'S ACTIVE ACCOUNTS, counted by the first reader of a region's Court writs each UTC day (professions.js
-- activeBefore) - registered accounts only, which is the index's own condition.
CREATE INDEX IF NOT EXISTS idx_players_played ON players (played_at) WHERE handle IS NOT NULL;

-- CUSTOMS asks the census of a character on every account (realm.js customsRefusal, originIn - L3-F2).
CREATE INDEX IF NOT EXISTS idx_realm_census_char ON realm_census (char_id, spent);

-- THE MARKET HISTORY'S SWEEP (market.js, section 20: ninety days) - one batch of deletes on every History view.
CREATE INDEX IF NOT EXISTS idx_market_fills_day ON market_fills (day);
CREATE INDEX IF NOT EXISTS idx_market_listings_closed ON market_listings (closed_at);
CREATE INDEX IF NOT EXISTS idx_market_orders_closed ON market_orders (closed_at);
CREATE INDEX IF NOT EXISTS idx_market_bids_at ON market_bids (at);

-- A DAY'S HARVESTS kept two days, swept five hundred at a time on the professions' state read. node_harvests has been
-- rebuilt by four migrations to widen its CHECK (0028, 0031, 0036, 0042): a fifth must create this index again.
CREATE INDEX IF NOT EXISTS idx_node_harvests_day ON node_harvests (day);

-- GUILD WRITS SETTLED on every Work read (writs.js closeGuildWrits): the open ones past their day, and the closed ones
-- whose escrow has not gone back - each half of its OR an index of its own.
CREATE INDEX IF NOT EXISTS idx_guild_writs_due ON guild_writs (state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_writs_unreturned ON guild_writs (returned, state);
