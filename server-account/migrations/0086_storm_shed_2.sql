-- STORM-SHED 2 (2026-10-06, the account database's follow-ups after the second overload; bible/06-Systems/Online-Arc.md
-- STORM-SHED 2): THE ARENA'S READS ON EVERY TOKEN, AND THE TOWNS' LAYOUTS, MADE SMALL.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct89) with the site; no
-- relay change.
--
--   arena_champions   the season's #1 as the service last counted it
--                     (arena.js storeArenaChampion: every rated bout
--                     recorded, and a reader whose row is
--                     ARENA_CHAMPION_STORED_S old). Every Worker counted the
--                     whole season's board each minute for the token's
--                     laurel - 109 million of the database's 760 million
--                     rows a day. NULL: nobody wears the laurel.
--   idx_arena_pve_player_grand
--                     a Grand Champion's row, asked on every registered
--                     account's token (arena.js arenaHonoursOf), found by
--                     the account and the bout - it walked every ladder bout
--                     the account ever fought (idx_arena_pve_player).
CREATE TABLE IF NOT EXISTS arena_champions (
  season INTEGER PRIMARY KEY,
  player TEXT,
  at     INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_arena_pve_player_grand ON arena_pve (player, tier, step, won);

-- homes_gen   one row, moved by the database itself on every home made,
--             gone, or moved to another town, building, purchase time or
--             layout - the towns' layouts (homes.js homeLayoutsKept) are
--             read again only once it moved. The answer was a scan of every
--             home with a NOT EXISTS beside each, read at every online boot
--             and every 24 s while unheard; no yard or room is asked until
--             it lands.
CREATE TABLE IF NOT EXISTS homes_gen (
  id  INTEGER PRIMARY KEY CHECK (id = 1),
  gen INTEGER NOT NULL
);
INSERT OR IGNORE INTO homes_gen (id, gen) VALUES (1, 0);
CREATE TRIGGER IF NOT EXISTS homes_gen_made AFTER INSERT ON homes
BEGIN
  UPDATE homes_gen SET gen = gen + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS homes_gen_gone AFTER DELETE ON homes
BEGIN
  UPDATE homes_gen SET gen = gen + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS homes_gen_moved AFTER UPDATE OF map_id, building_key, bought_at, layout ON homes
BEGIN
  UPDATE homes_gen SET gen = gen + 1 WHERE id = 1;
END;
