-- CARDS10 (2026-10-08) - ILIAC HAND'S SEASON BOARD.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- bible/11-Multiplayer/Tavern-Cards.md section 33. A ranked game of Iliac
-- Hand between two accounts' vouched-for decks, refereed and SIGNED by the
-- relay (src/net/iliacReceipt.js i1), is ONE row keyed by the game's id -
-- whichever of the two carries it first (server-account/src/iliac.js
-- claimIliac). The arena players' board's twin (0074's arena_pvp): the
-- season the arena's (src/net/arenaLaw.js arenaSeasonOf), the ratings
-- before and after the game, and `rated` 0 for a game past its pair's
-- day or season (kept, not counted).
--
--   iliac_games       every ranked game kept
--   iliac_champions   the season's #1 as the service last counted it (the
--                     title's - iliac.js storeIliacChampion)

CREATE TABLE IF NOT EXISTS iliac_games (
  game    TEXT PRIMARY KEY,
  season  INTEGER NOT NULL,
  a       TEXT,                             -- seat 0's account
  b       TEXT,                             -- seat 1's account
  result  INTEGER NOT NULL CHECK (result IN (0, 1, 2)),   -- 0 a won, 1 b won, 2 a draw
  how     TEXT NOT NULL,
  ra0     INTEGER NOT NULL, rb0 INTEGER NOT NULL,          -- the ratings before
  ra1     INTEGER NOT NULL, rb1 INTEGER NOT NULL,          -- and after
  rated   INTEGER NOT NULL DEFAULT 1,
  at      INTEGER NOT NULL,
  FOREIGN KEY (a) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (b) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_iliac_games_a ON iliac_games (a, season, at);
CREATE INDEX IF NOT EXISTS idx_iliac_games_b ON iliac_games (b, season, at);
CREATE INDEX IF NOT EXISTS idx_iliac_games_season ON iliac_games (season, at);

CREATE TABLE IF NOT EXISTS iliac_champions (
  season INTEGER PRIMARY KEY,
  player TEXT,
  at     INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE SET NULL
);
