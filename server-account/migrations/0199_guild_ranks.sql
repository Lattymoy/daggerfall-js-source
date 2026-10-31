-- GUILD-RANKS, GUILD-REQUESTS (2026-10-30) - more ranks, their powers, and join requests
-- (bible/11-Multiplayer/Guild-Shop.md sections 13 and 14).
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
-- A guild keeps four to eight rank names in `ranks` (JSON, as before). `powers` is the guildmaster's word on which ranks
-- hold each power it may give (src/net/guild/guildLaw.js GUILD_POWERS_EDITABLE): JSON, a power to its ranks. NULL, or a
-- power it does not name, is the law's default.
ALTER TABLE guilds ADD COLUMN powers TEXT;

-- A character's request to join a guild, answered by a rank that may invite. One a guild and account. `id` is never
-- reused (AUTOINCREMENT), so an officer's answer never lands on a later request.
CREATE TABLE IF NOT EXISTS guild_requests (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  at       INTEGER NOT NULL,
  UNIQUE (guild_id, player, char_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_requests_guild ON guild_requests (guild_id, at);
CREATE INDEX IF NOT EXISTS idx_guild_requests_player ON guild_requests (player, char_id);
