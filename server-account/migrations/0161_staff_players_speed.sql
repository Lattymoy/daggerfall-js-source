-- STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "it need to not hurt server performance"): THE PLAYER
-- SEARCH'S PREFIX READ ON COVERING INDEXES (server-account/src/staffPlayers.js, /v1/staff/players with `q`).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- by them. Indexes only: no row is written or moved.
--
-- The search gathers every account whose handle, or a character's name, starts with what was typed, then keeps the first
-- page by handle. Each half read its range by an index that holds the name alone (0001's idx_players_handle_lc, 0151's
-- realm_characters_name) and went to the table for every match to learn its account's id - a short prefix is a thousand
-- matches on a busy realm. These hold the id beside the name, so each half reads its index and nothing else. A handle is
-- written at a sign-up and a staff rename, a character's name at its making and a staff rename, never by a checkpoint or
-- a play beat, so the two cost a save nothing. 0151's realm_characters_name is now this one's first column; it is kept, as
-- this migration adds and never drops.
CREATE INDEX IF NOT EXISTS players_handle_lc_id ON players (handle_lc, id) WHERE handle_lc IS NOT NULL;
CREATE INDEX IF NOT EXISTS realm_characters_name_player ON realm_characters (name COLLATE NOCASE, player);
