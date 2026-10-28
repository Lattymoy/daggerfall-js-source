-- YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md): A TOWN'S YARDS KEPT ONE BLOCK AT A TIME.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service
-- (acct207) with the site; the relay redeploys as world277 (net/homeLaw.js is in its import graph).
--
-- YARD-SNAP (0136) kept each town's yard rows as one row, and YARD-TOWN (0175) bounded a town at 6,500 pieces because
-- that is what one D1 row holds - a storage limit shown to players as a rule. Every write rebuilt the whole town and
-- every caller read the whole town each minute. Now a town's yards are kept per CELL, one RMB block (`building_key >>
-- 8` - src/net/yardCellLaw.js yardCellOf): at most 32 buildings of 60 pieces in a block of Daggerfall's, about 415 KB at
-- the widest, so no cell meets the kept bound, and a write rebuilds one cell.
--
--   home_yard_cell_ver   one row a cell that ever stood a yard piece: `ver`, moved by the database itself on every yard
--                        row written (the triggers below), and `built`, the version its row was last built at. The
--                        partial index on `ver <> built` is how the minute's clock finds the stale cells without walking
--                        every town (server-account/src/yardCells.js settleStaleYardCells).
--   home_yard_cells      the cell's rows as the read takes them (yardCells.js cellRowsSql), kept at `built`, in `shape`
--                        (keptBoard.js), NULL past KEPT_BOARD_MAX_BYTES.
--
-- The version row stays narrow, apart from the rows' text, for AUDIT LEAN-READS 2 B3's reason: a version kept beside
-- the text rewrote the text on every write.
--
-- KEPT FOR ROLLBACK: home_yards, home_yards_ver and their three triggers (0136) stay. Nothing builds a town's row any
-- more, but the old triggers still move each town's version, so acct192's read (the rows as they stand where a built row
-- is behind) stays correct if this service is rolled back. A later migration drops them (YC3).
CREATE TABLE IF NOT EXISTS home_yard_cell_ver (
  map_id INTEGER NOT NULL,
  cell   INTEGER NOT NULL,
  ver    INTEGER NOT NULL DEFAULT 1,
  built  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_home_yard_cell_stale ON home_yard_cell_ver (map_id, cell) WHERE ver <> built;
CREATE TABLE IF NOT EXISTS home_yard_cells (
  map_id INTEGER NOT NULL,
  cell   INTEGER NOT NULL,
  built  INTEGER NOT NULL,
  shape  TEXT NOT NULL,
  rows   TEXT,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;

-- Every cell that stands a yard piece now, built now - in the shape the code reads (yardCells.js YARD_CELL_SHAPE; its
-- build, cellBuildSql, word for word but the version and the shape written as they stand here).
INSERT OR IGNORE INTO home_yard_cell_ver (map_id, cell, ver, built)
  SELECT DISTINCT map_id, building_key >> 8, 1, 1 FROM home_decor WHERE yard = 1;
INSERT INTO home_yard_cells (map_id, cell, built, shape, rows)
  SELECT v.map_id, v.cell, v.ver, 'c39743d4', (SELECT CASE WHEN length(CAST(j AS BLOB)) <= 1500000 THEN j END
    FROM (SELECT json_group_array(json_array(map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)) AS j
      FROM (SELECT map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard FROM home_decor
        WHERE map_id = v.map_id AND yard = 1 AND building_key BETWEEN v.cell * 256 AND v.cell * 256 + 255
        ORDER BY building_key, placed_at, id LIMIT 15360)))
  FROM home_yard_cell_ver v WHERE true
  ON CONFLICT (map_id, cell) DO NOTHING;

-- A yard row written, by any route, a cascade or a sweep: its cell's version moved (and the cell's version row made, the
-- first time - past any version its row was kept at, so a version row lost and counted again never meets an old row:
-- AUDIT LEAN-READS 2 B4). A row moved between cells, towns, or in or out of a yard moves both cells (a cell it stays in,
-- twice - a version is only ever compared for being the one built, and for climbing).
CREATE TRIGGER IF NOT EXISTS home_yard_cell_in AFTER INSERT ON home_decor WHEN NEW.yard = 1
BEGIN
  INSERT INTO home_yard_cell_ver (map_id, cell, ver)
    VALUES (NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_yard_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_yard_cell_out AFTER DELETE ON home_decor WHEN OLD.yard = 1
BEGIN
  INSERT INTO home_yard_cell_ver (map_id, cell, ver)
    VALUES (OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_yard_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_yard_cell_moved AFTER UPDATE ON home_decor WHEN OLD.yard = 1 OR NEW.yard = 1
BEGIN
  INSERT INTO home_yard_cell_ver (map_id, cell, ver)
    SELECT OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_yard_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1
    WHERE OLD.yard = 1
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
  INSERT INTO home_yard_cell_ver (map_id, cell, ver)
    SELECT NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_yard_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1
    WHERE NEW.yard = 1
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
