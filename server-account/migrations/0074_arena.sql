-- ARENA4 (2026-10-02) - THE ARENA OF DAGGERFALL, ONLINE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "Joining a team comes with it's own enhanced UI where you can view
-- your ranking and even player leaderboards ... Being a top rank PvE
-- fighter comes with it's own title. Being the #1 pvp arena player comes
-- with it's own temporary title/glyph". Design:
-- bible/11-Multiplayer/Arena.md "7. Online" - "account-service tables
-- (migration 0074 - 0047 on its branch, 0070 at the merge onto main past its 0047-0068, 0072 past PROF9's and PROF12's 0069_cooking and 0070_alchemy at the second, renumbered again past SILVER-WAYS' and PROF2b's 0071_silver_ways and 0072_motherlodes at the third): ladder results (one row a tier won), PvP results (one
-- row a bout, both ratings), team membership and season; leaderboards
-- counted from rows (/v1/arena/board)".
--
-- EVERY ROW IS A RECEIPT THE RELAY SIGNED (src/net/arenaReceipt.js), keyed
-- by the bout's id, so a receipt counts once whoever carries it and however
-- often. Nothing here is a total another row could disagree with: the
-- ladder an account stands on, a season's board and a banner's points are
-- each COUNTED from these rows (server-account/src/arena.js) - the repo's
-- law, DERIVED OVER ENUMERATED - and the titles they give are derived at
-- the token's mint (server-account/src/titles.js), so the laurel passes to
-- whoever takes the top and lapses by itself.

-- A LADDER BOUT, won or lost - one row a bout's receipt. The climb is the
-- won rows in order (src/net/arenaLaw.js arenaLadderOf); the service writes
-- a win only where it is the account's next bout, so the Grand Champion
-- (tier 9, bout 3) is a row only a whole climb of relay-refereed wins can
-- stand under.
CREATE TABLE IF NOT EXISTS arena_pve (
  bout    TEXT PRIMARY KEY,                 -- the bout's id (16 hex): one receipt, one row
  player  TEXT NOT NULL,
  season  INTEGER NOT NULL,
  tier    INTEGER NOT NULL CHECK (tier BETWEEN 0 AND 9),
  step    INTEGER NOT NULL CHECK (step BETWEEN 0 AND 3),   -- 0..2 the tier's bouts, 3 its champion
  won     INTEGER NOT NULL CHECK (won IN (0, 1)),
  how     TEXT NOT NULL,
  banner  TEXT,                             -- the banner worn at the claim (its points), NULL none
  at      INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- one WIN a step: a climb cannot hold the same bout twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_pve_step ON arena_pve (player, tier, step) WHERE won = 1;
CREATE INDEX IF NOT EXISTS idx_arena_pve_player ON arena_pve (player, at);
-- the Grand Champions (the Hall of Champions, the title) and a season's board
CREATE INDEX IF NOT EXISTS idx_arena_pve_grand ON arena_pve (tier, step, won, at);
CREATE INDEX IF NOT EXISTS idx_arena_pve_season ON arena_pve (season, player);

-- A BOUT BETWEEN PLAYERS - one row a bout, both accounts and both ratings,
-- before and after. The season's board is each account's LAST row of the
-- season (its rating after), its wins and losses counted.
CREATE TABLE IF NOT EXISTS arena_pvp (
  bout    TEXT PRIMARY KEY,
  season  INTEGER NOT NULL,
  a       TEXT,                             -- side 0's account
  b       TEXT,                             -- side 1's account
  result  INTEGER NOT NULL CHECK (result IN (0, 1, 2)),   -- 0 a won, 1 b won, 2 a draw
  how     TEXT NOT NULL,
  ra0     INTEGER NOT NULL, rb0 INTEGER NOT NULL,          -- the ratings before
  ra1     INTEGER NOT NULL, rb1 INTEGER NOT NULL,          -- and after
  rated   INTEGER NOT NULL DEFAULT 1,       -- 0: fought and kept, not counted (a pair past its day's bouts)
  banner_a TEXT, banner_b TEXT,
  at      INTEGER NOT NULL,
  FOREIGN KEY (a) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (b) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_arena_pvp_a ON arena_pvp (a, season, at);
CREATE INDEX IF NOT EXISTS idx_arena_pvp_b ON arena_pvp (b, season, at);
CREATE INDEX IF NOT EXISTS idx_arena_pvp_season ON arena_pvp (season, at);

-- THE BANNERS: the one an account wears, since which season; and the one it
-- quit this season (the other banner is refused until the next season -
-- systems/arenaLeague.js joinRefusal's law).
CREATE TABLE IF NOT EXISTS arena_members (
  player       TEXT PRIMARY KEY,
  banner       TEXT CHECK (banner IN ('red', 'blue')),
  season       INTEGER NOT NULL,              -- the season it was joined (or quit)
  left_banner  TEXT,
  left_season  INTEGER,
  at           INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_arena_members_banner ON arena_members (banner);
