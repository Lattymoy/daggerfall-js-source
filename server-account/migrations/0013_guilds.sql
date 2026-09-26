-- GUILD1 (2026-09-25) - THE GUILDS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac, of the holdings: "future ownership for online guilds"; asked,
-- founding takes "Gold and Renown", a guild is joined "Per character",
-- its ranks are "Four, renamed by the guildmaster", and the treasury
-- is the "Guildmaster only" to take from. The shapes and the bounds are
-- src/net/guildLaw.js, which the service and the client both read.
--
-- A GUILD has one name (`name_key` the name with its case and spaces
-- aside, so "The Hound" and "the  hound" are one guild) and one tag, the
-- four rank names (JSON), and its treasury in gold.
--
-- A MEMBER is one CHARACTER of one account - the id its own save
-- carries, as Renown's tracks and the homes key on - so the primary key
-- (player, char_id) holds a character in at most one guild, and the
-- account's other characters are free. `name` is the account's handle
-- when it joined, what the roster says (a character's name is never
-- shown to another player). The roster names a member by the row's own
-- rowid, never the character's save id.
--
-- An INVITATION is to an ACCOUNT: whichever of its characters answers
-- it is the one that joins.
--
-- The LEDGER is every movement of the treasury, in order (`seq`, the
-- rowid - no AUTOINCREMENT, whose sequence table the ledger does not
-- need), with the balance after it - Mac: "every movement is logged".
-- The TRIGGER writes it, in the same statement as the move: the treasury
-- cannot change without its line, whichever write changes it. The move
-- names its mover and its moment (`moved_by`, `moved_at`) on the guild
-- row, and the line carries them - a move that names nobody is refused
-- by the line's NOT NULL, and the gold does not move.
--
-- An account goes, and its memberships and invitations go with it; a
-- guild goes, and everything of it goes with it (CASCADE).
CREATE TABLE IF NOT EXISTS guilds (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_key    TEXT NOT NULL UNIQUE,
  tag         TEXT NOT NULL UNIQUE,
  ranks       TEXT NOT NULL,
  treasury    INTEGER NOT NULL DEFAULT 0,
  founded_at  INTEGER NOT NULL,
  moved_by    TEXT,
  moved_at    INTEGER
);
CREATE TABLE IF NOT EXISTS guild_members (
  player      TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  guild_id    TEXT NOT NULL,
  rank        INTEGER NOT NULL,
  name        TEXT NOT NULL,
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (player, char_id),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
-- A guild's roster, highest rank first - and the count the cap asks before every join.
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members (guild_id, rank, joined_at);
CREATE TABLE IF NOT EXISTS guild_invites (
  guild_id    TEXT NOT NULL,
  player      TEXT NOT NULL,
  by_name     TEXT NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (guild_id, player),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_invites_player ON guild_invites (player);
CREATE TABLE IF NOT EXISTS guild_ledger (
  seq         INTEGER PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  at          INTEGER NOT NULL,
  who         TEXT NOT NULL,
  kind        TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  balance     INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_ledger_guild ON guild_ledger (guild_id, seq);
CREATE TRIGGER IF NOT EXISTS guild_ledger_line AFTER UPDATE OF treasury ON guilds
  WHEN NEW.treasury <> OLD.treasury
BEGIN
  INSERT INTO guild_ledger (guild_id, at, who, kind, amount, balance)
  VALUES (NEW.id, NEW.moved_at, NEW.moved_by,
          CASE WHEN NEW.treasury > OLD.treasury THEN 'deposit' ELSE 'withdraw' END,
          abs(NEW.treasury - OLD.treasury), NEW.treasury);
END;
