-- GUILD1e (2026-09-30, Mac: "Finish the seats") - A GUILD'S OWN BOARD
-- (bible/11-Multiplayer/Seats-Arc.md 8.2: "a private guild board (the board's Guilds tab, members only)";
-- bible/06-Systems/Professions-Arc.md 10.1's Guilds tab; src/net/boardLaw.js GUILD_NOTES_*).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A GUILD'S NOTES are the guild's, never a town's (board_notes keys a town): read by its members on the Guilds tab of
-- any Notice Board and at the board in its hall. `author` the account (never leaves the service), `char_id` and
-- `author_name` the member who pinned it (its roster name - how a guild knows its own), (author, rid) the pin asked
-- twice made once. A guild gone takes its notes with it; an account gone, its own.
CREATE TABLE IF NOT EXISTS guild_notes (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  author      TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  author_name TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  rid         TEXT NOT NULL,
  UNIQUE (author, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (author) REFERENCES players(id) ON DELETE CASCADE
);
-- The guild's board, newest first; and each author's live notes, which the INSERT counts.
CREATE INDEX IF NOT EXISTS idx_guild_notes_guild ON guild_notes (guild_id, expires_at, at);
CREATE INDEX IF NOT EXISTS idx_guild_notes_author ON guild_notes (guild_id, author, expires_at);
