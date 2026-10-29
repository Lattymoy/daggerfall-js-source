-- YC4 HOME-CELL (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14): THE SHARED PART OF A TOWN'S HOMES, KEPT
-- ONE BLOCK AT A TIME.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service (acct223)
-- before the site.
--
-- HOMES-SHED measured /v1/homes/town as the busiest route of the 2026-10-13 overload: every page asks its whole town's
-- homes each minute, and almost every answer is the one it had. What every caller reads alike (owner, entry, free rooms,
-- score, look, deed, hall) is now kept per CELL, one RMB block (`building_key >> 8` - src/net/yardCellLaw.js yardCellOf),
-- as 0190 keeps the yards; a reader is sent only the cells whose version moved (server-account/src/homeCells.js).
--
--   home_cell_ver   one row a cell that ever held a home: `ver`, moved by the database itself on every write of what the
--                   shared part reads (the triggers below); `built`, the version its row was last built at (the partial
--                   index on `ver <> built` is how the minute's clock finds the stale cells); `stale_at`, when a let room
--                   of the cell next falls vacant with no write - the clock moves `ver` past it (index on `stale_at`).
--   home_cells      the cell's homes as the read takes them (homeCells.js cellRowsSql), kept at `built`, in `shape`
--                   (keptBoard.js), NULL past KEPT_BOARD_MAX_BYTES.
--
-- The version row stays narrow, apart from the rows' text, for AUDIT LEAN-READS 2 B3's reason: a version kept beside
-- the text rewrote the text on every write. /v1/homes/town stays as it was for one release (section 14.6).
CREATE TABLE IF NOT EXISTS home_cell_ver (
  map_id   INTEGER NOT NULL,
  cell     INTEGER NOT NULL,
  ver      INTEGER NOT NULL DEFAULT 1,
  built    INTEGER NOT NULL DEFAULT 0,
  stale_at INTEGER,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_home_cell_stale ON home_cell_ver (map_id, cell) WHERE ver <> built;
CREATE INDEX IF NOT EXISTS idx_home_cell_due ON home_cell_ver (stale_at) WHERE stale_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS home_cells (
  map_id INTEGER NOT NULL,
  cell   INTEGER NOT NULL,
  built  INTEGER NOT NULL,
  shape  TEXT NOT NULL,
  rows   TEXT,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;

-- Every cell that holds a home now, built now - in the shape the code reads (homeCells.js HOME_CELL_SHAPE; its build,
-- cellBuildSql, and its mark, cellMarkSql, word for word but the version, the shape and the clock written as they stand
-- here).
INSERT OR IGNORE INTO home_cell_ver (map_id, cell, ver, built)
  SELECT DISTINCT map_id, building_key >> 8, 1, 1 FROM homes;
INSERT INTO home_cells (map_id, cell, built, shape, rows)
  SELECT v.map_id, v.cell, v.ver, '209e1fa9', (SELECT CASE WHEN length(CAST(j AS BLOB)) <= 1500000 THEN j END
    FROM (SELECT json_group_array(json_array(building_key, owner_name, entry, look, score, guild_id, deed, guild_name, guild_tag, guild_heraldry, vacant, rent_from)) AS j FROM (SELECT h.building_key, h.owner_name, h.entry, h.look, h.score, h.guild_id, h.deed,
      g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry,
      (SELECT COUNT(*) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.listed = 1 AND (r.tenant IS NULL OR r.until <= CAST(strftime('%s', 'now') AS INTEGER))) AS vacant,
      (SELECT MIN(r.price) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.listed = 1 AND (r.tenant IS NULL OR r.until <= CAST(strftime('%s', 'now') AS INTEGER))) AS rent_from
    FROM homes h LEFT JOIN guilds g ON g.id = h.guild_id
    WHERE h.map_id = v.map_id AND h.building_key BETWEEN v.cell * 256 AND v.cell * 256 + 255
    ORDER BY h.building_key)))
  FROM home_cell_ver v WHERE true
  ON CONFLICT (map_id, cell) DO NOTHING;
UPDATE home_cell_ver
  SET stale_at = (SELECT MIN(r.until) FROM home_rooms r
    WHERE r.map_id = home_cell_ver.map_id AND r.building_key BETWEEN home_cell_ver.cell * 256 AND home_cell_ver.cell * 256 + 255 AND r.listed = 1 AND r.tenant IS NOT NULL AND r.until > CAST(strftime('%s', 'now') AS INTEGER));

-- A write of what the shared part reads, by any route, a cascade or a sweep: its cell's version moved (and the cell's
-- version row made, the first time - past any version its row was kept at, so a version row lost and counted again
-- never meets an old row: AUDIT LEAN-READS 2 B4). A home or a room moved between cells or towns moves both cells. An
-- UPDATE moves a cell only when a column the shared part reads changed - a home's `paid`, `rent_due`, `char_id` or
-- `layout`, a room's `anchor` or `tenant_char`, a guild's treasury: none (each is the caller's own part, or nobody's).
CREATE TRIGGER IF NOT EXISTS home_cell_in AFTER INSERT ON homes
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_cell_out AFTER DELETE ON homes
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_cell_moved AFTER UPDATE OF map_id, building_key, owner_name, entry, look, score, guild_id, deed ON homes
  WHEN OLD.map_id IS NOT NEW.map_id OR OLD.building_key IS NOT NEW.building_key OR OLD.owner_name IS NOT NEW.owner_name
    OR OLD.entry IS NOT NEW.entry OR OLD.look IS NOT NEW.look OR OLD.score IS NOT NEW.score OR OLD.guild_id IS NOT NEW.guild_id
    OR OLD.deed IS NOT NEW.deed
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_cell_room_in AFTER INSERT ON home_rooms
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS home_cell_room_out AFTER DELETE ON home_rooms
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
-- an arena move carries a let room to the new house's key (homes.js arenaMoveHome): its key is read here too
CREATE TRIGGER IF NOT EXISTS home_cell_room_moved AFTER UPDATE OF map_id, building_key, listed, tenant, until, price ON home_rooms
  WHEN OLD.map_id IS NOT NEW.map_id OR OLD.building_key IS NOT NEW.building_key OR OLD.listed IS NOT NEW.listed
    OR OLD.tenant IS NOT NEW.tenant OR OLD.until IS NOT NEW.until OR OLD.price IS NOT NEW.price
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (OLD.map_id, OLD.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = OLD.map_id AND cell = OLD.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
  INSERT INTO home_cell_ver (map_id, cell, ver)
    VALUES (NEW.map_id, NEW.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = NEW.map_id AND cell = NEW.building_key >> 8), 0) + 1)
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
-- a guild renamed, retagged or its heraldry redrawn: the cell of its hall (idx_homes_guild: one a guild)
CREATE TRIGGER IF NOT EXISTS home_cell_guild AFTER UPDATE OF name, tag, heraldry ON guilds
  WHEN OLD.name IS NOT NEW.name OR OLD.tag IS NOT NEW.tag OR OLD.heraldry IS NOT NEW.heraldry
BEGIN
  INSERT INTO home_cell_ver (map_id, cell, ver)
    SELECT h.map_id, h.building_key >> 8, COALESCE((SELECT built FROM home_cells WHERE map_id = h.map_id AND cell = h.building_key >> 8), 0) + 1
    FROM homes h WHERE h.guild_id = NEW.id
    ON CONFLICT (map_id, cell) DO UPDATE SET ver = ver + 1;
END;
