-- ARENA4b (2026-10-03) - THE ONLINE HOMES THE ARENA DISPLACED, MOVED; AND A BOUT'S RENOWN, ONCE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac (ARENA1): "Move them to a new house". The Arena of Daggerfall stands
-- in Daggerfall's cell (4,3) - no building has a key there any more - so
-- an online home keyed there names nothing. Its owner's client picks the
-- new house by the offline move's rule (src/systems/arenaMove.js
-- arenaHomeFor) and the service carries the row to it
-- (server-account/src/homes.js arenaMoveHome). Design:
-- bible/11-Multiplayer/Arena.md, the ARENA1 record's "ARENA4 - the online
-- homes' migration".

-- A HOME MOVED, ONCE: the town and the old key are the primary key, so a
-- move posted twice (an answer lost, two tabs) is one move - the second
-- post is answered with this row, and a second INSERT in the move's batch
-- throws and takes the batch back. `player` and `char_id` are the account
-- and character that moved it (the owner's, or a guild hall's keeper's):
-- the old house's things lie in THAT character's save, so the scene is
-- emptied by its client (`seen_at` NULL until it says the letter was read).
-- `refund` the catalogue's and the yard's pieces paid back whole (into the
-- owner's record, or the hall's treasury) in the move's own batch; `hall` 1
-- for a guild's hall (moved by one of its keepers).
-- No reference to `homes`: the old key's row is gone by design, and the new
-- one may be sold later - the move stays a fact about the town.
CREATE TABLE IF NOT EXISTS home_moves (
  map_id     INTEGER NOT NULL,
  old_key    INTEGER NOT NULL,
  new_key    INTEGER NOT NULL,
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  refund     INTEGER NOT NULL DEFAULT 0,
  hall       INTEGER NOT NULL DEFAULT 0,
  moved_at   INTEGER NOT NULL,
  seen_at    INTEGER,
  PRIMARY KEY (map_id, old_key),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- A character's moves not yet read - the boot's one question.
CREATE INDEX IF NOT EXISTS idx_home_moves_mover ON home_moves (player, char_id, seen_at);

-- A BOUT'S RENOWN, CREDITED ONCE AN ACCOUNT (Arena.md 2: "Online, renown
-- too, within the renown law's own hourly cap"). A ladder win and a rated
-- win between players pay Renown to the character the claim names
-- (server-account/src/arena.js arenaRenownOf); a bout between players is
-- ONE row of arena_pvp whichever fighter claims it first, so the winner
-- may claim second - the right to the bout's Renown is this row, taken
-- before the credit, never the arena_pvp row's own insert.
CREATE TABLE IF NOT EXISTS arena_renown (
  bout     TEXT NOT NULL,
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  xp       INTEGER NOT NULL,                -- what the bout asked; the credit is the renown law's (its hour, its cap)
  at       INTEGER NOT NULL,
  PRIMARY KEY (bout, player),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
