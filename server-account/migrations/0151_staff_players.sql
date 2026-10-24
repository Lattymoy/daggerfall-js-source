-- STAFF-PANEL3-PLAYERS (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 3, "Players and
-- nameplates" and "Server load"): THE INDEXES THE PANEL'S PLAYER SEARCH AND PROFILE READ BY (server-account/src/staffPlayers.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- by them. Indexes only: no row is written or moved.
--
-- THE TRADES TAB (design doc, Server load: "add the realm_trades indexes before a trades screen ships"). A profile reads
-- one account's trades, both sides, newest first; realm_trades had an index on the first side's account only as the
-- start of a waiting trade's key (0043's idx_realm_trades_waiting) and none on the second side's, so the read walked the
-- whole table. A trade is written twice in its life (its first half, its settling), so the two cost little.
CREATE INDEX IF NOT EXISTS realm_trades_a_player ON realm_trades (a_player, created_at);
CREATE INDEX IF NOT EXISTS realm_trades_b_player ON realm_trades (b_player, created_at) WHERE b_player IS NOT NULL;
-- THE SEARCH BY A CHARACTER'S NAME (mob, 03:23Z: "by handle or character name"), a prefix in any case - a name is written
-- at a character's making and a staff rename, never by a checkpoint, so the index costs a save nothing.
CREATE INDEX IF NOT EXISTS realm_characters_name ON realm_characters (name COLLATE NOCASE);
-- THE HISTORY TAB'S REPORTS, against the account (every case, closed ones too - 0126's mod_cases_open holds the open one
-- alone) and by it.
CREATE INDEX IF NOT EXISTS mod_cases_target ON mod_cases (target, opened_at);
CREATE INDEX IF NOT EXISTS mod_reports_reporter ON mod_reports (reporter, at);
