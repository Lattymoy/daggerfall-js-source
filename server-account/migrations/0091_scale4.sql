-- SCALE4b (2026-10-08, Mac: "Do 1 2 and 3"; bible/11-Multiplayer/Scale-Arc.md): THE INDEXES THE SERVICE'S OWN CLOCK
-- READS BY (src/cron.js), as AUDIT SCALE (bible/01-Overview/Audit-Scale.md) left them before this migration ever shipped.
--
-- The guild contracts past their days, and those closed with their escrow still owed (contracts.js closeContracts, asked
-- every minute now): its OR walked the whole table, which nothing prunes - idx_guild_contracts_due (0071) leads with
-- state and returned, and neither half of the OR can use it. The pair 0043 gave guild_writs for the same question.
CREATE INDEX IF NOT EXISTS idx_guild_contracts_open_due ON guild_contracts (state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_unreturned ON guild_contracts (returned, state);
--
-- A closed auction's bids (market.js pruneMarketHistory's auctions, each hour, and the ON DELETE CASCADE it sets off):
-- market_bids had only the partial idx_market_bid_high, so each auction pruned walked every bid twice - 500 old
-- auctions over 20,000 bids were thirty million steps.
CREATE INDEX IF NOT EXISTS idx_market_bids_auction ON market_bids (auction);
--
-- NOT HERE: an index on sessions(last_seen) for the sessions' idle sweep. It cost a written row at every stale touch
-- (accounts.js resolveSession, every SESSION_TOUCH_S an active device) - writes D1 bills at a thousand times a read -
-- to spare a walk of the sessions table once an hour, a walk that finds nothing before a year has passed.
