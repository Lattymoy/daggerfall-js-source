-- STAFF-PANEL3-ECON (2026-10-22; design doc "DFO Staff Panel: design", build step 3 - Market and trades, Node activity
-- and Economy; "Server load": "add the realm_trades indexes before a trades screen ships"): THE INDEXES THE PANEL'S
-- ECONOMY READS STAND ON (server-account/src/staffEconomy.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them. Every statement is IF NOT EXISTS, and no row is changed: an index is only a way to find rows. Each is asked again
-- by EXPLAIN QUERY PLAN in test/server/staffpanel3econ.test.js, so a statement rewritten past its index fails a pin.
--
-- D1 has ONE writer for the whole service (SCALE1): a read that walks a table holds every write behind it. So each index
-- here serves a read that would otherwise walk a table that only grows, and the two on the busiest tables are partial:
-- a row outside their condition costs its writes nothing.

-- THE STREAM, newest first (/v1/staff/econ/stream): every market sale and order fill by its time - the bids have theirs
-- (0091), a trade its first half's (realm_trades_created) - and a trade by its second side's account (the first side's
-- is idx_realm_trades_waiting's prefix)
CREATE INDEX IF NOT EXISTS idx_market_sales_at ON market_sales (at);
CREATE INDEX IF NOT EXISTS idx_market_fills_at ON market_fills (at);
-- (a trade by its second side's account: 0151's realm_trades_b_player, made for the profile's Trades tab)

-- ...and a guild vault's moves by time, and by who made them: the log keeps a name, never an account, and is never swept
CREATE INDEX IF NOT EXISTS idx_guild_vault_log_at ON guild_vault_log (at);
CREATE INDEX IF NOT EXISTS idx_guild_vault_log_who ON guild_vault_log (who, at);

-- A MATERIAL'S USUAL PRICE, read from its sales and fills themselves over the median's seven days - each pair of
-- accounts once, which the day tables (market_prices, market_gold_prices) cannot say (weak spot: "leave out sales
-- between the same two accounts")
CREATE INDEX IF NOT EXISTS idx_market_sales_material ON market_sales (material, at);
CREATE INDEX IF NOT EXISTS idx_market_fills_material ON market_fills (material, at);

-- THE MARKS IN ESCROW, the ledger's escrow end (marks.js marksReport's statement, and the economy's): the escrow's rows
-- alone, covered. The ledger is never swept, and this sum walked all of it. The condition is the statements' own, word
-- for word and in order - SQLite takes a partial index only for a WHERE that says what the index says.
CREATE INDEX IF NOT EXISTS idx_marks_ledger_escrow ON marks_ledger (dst_kind, src_kind, amount) WHERE dst_kind = 'escrow' OR src_kind = 'escrow';

-- THE RICHEST CHARACTERS by the judge's wealth (verdict.js writes it at every judged checkpoint): only the rich are in
-- it, so a checkpoint below the floor writes nothing more. The floor is staffEconomy.js RICH_FLOOR, said as a literal in
-- its statement.
CREATE INDEX IF NOT EXISTS idx_realm_characters_rich ON realm_characters (wealth) WHERE wealth >= 250000;
