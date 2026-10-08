-- SCALE4b (2026-10-08, Mac: "Do 1 2 and 3"; bible/11-Multiplayer/Scale-Arc.md): THE SESSIONS' IDLE SWEEP, by an index.
--
-- A session idle past SESSION_IDLE_S (a year) was deleted only if its secret was ever presented again
-- (accounts.js resolveSession, AUDIT-ACC F9), so a cleared browser's session stood for ever. The service's own clock
-- (src/cron.js, each hour) now deletes every one past the bound - `last_seen < now - SESSION_IDLE_S` - and that range
-- needs an index of its own: idx_sessions_player leads with the player, and a sweep by it walks the whole table.
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen);
