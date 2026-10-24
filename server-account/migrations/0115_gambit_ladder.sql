-- KG6 (2026-10-15) - THE KING'S GAMBIT'S SEASON BOARD.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- bible/11-Multiplayer/Kings-Gambit.md sections 10.7 and 19. A rated game
-- of The King's Gambit between two accounts, refereed and SIGNED by the
-- relay (src/net/gambitReceipt.js g1), is ONE row keyed by the game's id -
-- whichever of the two carries it first (server-account/src/gambit.js
-- claimGambit). Iliac Hand's board's twin (0095's iliac_games): the season
-- the arena's, the ratings before and after, `rated` 0 for a game past its
-- pair's day or season (kept, not counted), `played` the receipt's own
-- second. No draw: a game nobody won is no contest, and no receipt.
--
--   gambit_games       every rated game kept
--   gambit_champions   the season's #1 as the service last counted it (the
--                      GRANDMASTER title's - gambit.js storeGambitChampion)

CREATE TABLE IF NOT EXISTS gambit_games (
  game    TEXT PRIMARY KEY,
  season  INTEGER NOT NULL,
  a       TEXT,                             -- the host's account
  b       TEXT,                             -- the guest's account
  result  INTEGER NOT NULL CHECK (result IN (0, 1)),   -- 0 a won, 1 b won
  how     TEXT NOT NULL,
  ra0     INTEGER NOT NULL, rb0 INTEGER NOT NULL,          -- the ratings before
  ra1     INTEGER NOT NULL, rb1 INTEGER NOT NULL,          -- and after
  rated   INTEGER NOT NULL DEFAULT 1,
  played  INTEGER NOT NULL,                 -- the receipt's issue second (its `i`) - a pair's day is counted on it
  at      INTEGER NOT NULL,                 -- the claim's second - the row's, never the game's
  FOREIGN KEY (a) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (b) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gambit_games_a ON gambit_games (a, season, at);
CREATE INDEX IF NOT EXISTS idx_gambit_games_b ON gambit_games (b, season, at);
CREATE INDEX IF NOT EXISTS idx_gambit_games_season ON gambit_games (season, at);
CREATE INDEX IF NOT EXISTS idx_gambit_games_pair ON gambit_games (a, b, season);

CREATE TABLE IF NOT EXISTS gambit_champions (
  season INTEGER PRIMARY KEY,
  player TEXT,
  at     INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE SET NULL
);
