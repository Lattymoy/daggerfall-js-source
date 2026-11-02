-- ARENA-BOARD (2026-10-19, the account database overloaded again; bible/11-Multiplayer/Scale-Arc.md ARENA-BOARD): THE
-- ARENA'S BOARD READ AS ONE ROW A SEASON.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct161) with the site; no
-- relay change.
--
-- The arena's board (arena.js arenaBoardOf) counted, on every open - 28,586 on the day - the Grand Champions, the
-- season's rated board, the climb of every account that ever won a ladder bout (every season's every bout), the fastest
-- Grand Champions, two seasons' banner standings, both banners' rosters and their members: ten aggregates over the arena's
-- whole record, some 2.5% of the database's statement time, for an answer every caller reads alike but for its own rows
-- (its ladder, its rating, its banner, its bouts). It moves only when a bout is recorded, voided or an account's goes,
-- or a banner is joined or left.
--
--   arena_board_ver   the arena's one version, moved by the database itself on every such write (AUDIT LEAN-READS D4:
--                     moved on each season's own row, every bout rewrote every season's board - two of 800 KB cost an
--                     arena write half a millisecond; the board is the current season's alone).
--   arena_boards      one row a season read: `built`, the version `rows` was counted at; `shape`, the counts that counted
--                     it (keptBoard.js shapeOf - a deploy that changes them counts it again); `rows`, the board's counts as
--                     every caller reads them (arena.js arenaShared). A read is the row while it is the version's and the
--                     shape's; else it counts as before and keeps it - after the caller's own reads - written only where
--                     the version has not moved since it counted and no board of it is kept already.
CREATE TABLE IF NOT EXISTS arena_board_ver (
  id  INTEGER PRIMARY KEY CHECK (id = 1),
  ver INTEGER NOT NULL
);
INSERT OR IGNORE INTO arena_board_ver (id, ver) VALUES (1, 1);
CREATE TABLE IF NOT EXISTS arena_boards (
  season INTEGER PRIMARY KEY,
  built  INTEGER NOT NULL DEFAULT 0,
  shape  TEXT,
  rows   TEXT
);

-- Every write the board counts, by any route, a cascade (an account gone: its ladder bouts deleted, its side of a
-- players' bout set NULL) or a sweep - the climb and the Hall being every season's.
CREATE TRIGGER IF NOT EXISTS arena_board_pve_in AFTER INSERT ON arena_pve BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_pve_up AFTER UPDATE ON arena_pve BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_pve_out AFTER DELETE ON arena_pve BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_pvp_in AFTER INSERT ON arena_pvp BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_pvp_up AFTER UPDATE ON arena_pvp BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_pvp_out AFTER DELETE ON arena_pvp BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_member_in AFTER INSERT ON arena_members BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_member_up AFTER UPDATE ON arena_members BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS arena_board_member_out AFTER DELETE ON arena_members BEGIN UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1; END;
