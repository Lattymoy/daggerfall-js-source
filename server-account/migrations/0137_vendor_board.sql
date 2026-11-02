-- VENDOR-BOARD (2026-10-19, the account database overloaded again; bible/11-Multiplayer/Scale-Arc.md VENDOR-BOARD): A
-- REGION'S TRADERS READ AS ONE ROW.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct161) with the site; no
-- relay change.
--
-- Every client in a living town reads its region's traders (market.js marketVendors) every PATRON_READ_S, and the Notice
-- Board's Vendors tab on every open: two statements over every open trader listing of the region and its piece and home
-- (5,700 rows a read, 21 ms) and the region's patron sales of the day - 197,665 reads on the day, 7% of the database's
-- statement time, and in the 18:05 overload the read most asked again (1,517 asks in five minutes where 330 was the
-- rate). The answer is every caller's alike but for three facts about the caller's own character (its own house, its
-- guild's, a room it rents), and it moves only when a trader's listing, its piece, its house or a patron's sale is
-- written, or a listing's time runs out.
--
--   market_vendor_ver      a region's version: `ver`, moved by the database itself on every such write (the row made by
--                          the first) - a narrow row of its own, so a write moves a number and never rewrites the kept
--                          board (AUDIT LEAN-READS 2 B3: kept beside it, a busy region's 354 KB was rewritten on every
--                          listing, sale and patron). Made by the backfill below for every region a board can name
--                          today, by a trigger for any other at its first write - and, made, past any version a board of
--                          the region was kept at (AUDIT LEAN-READS 2 B4: a row lost and counted again from 1 would
--                          meet a board kept at 1 long before). A region with no version row is read every time and
--                          kept never.
--   market_vendor_boards   one row a region read, kept: `built`, the version `rows` was read at; `shape`, the reads that
--                          read it (keptBoard.js shapeOf - a deploy that changes them reads it again); `since` and
--                          `until`, the seconds between which `rows` is the board - `until` its first listing's end,
--                          `since` (AUDIT LEAN-READS 2 B2) the last second before the read at which an answer would have
--                          differed: a listing that ran out by then, or a patron's sale that left the day by then where
--                          the board tells fewer than it may - so a caller whose clock was taken before the read's, as an
--                          overload's are, is served it as well; `rows`, the board as every caller reads it (market.js
--                          vendorBoard). A read is the row while it is its version's and shape's and its second between;
--                          else it reads the board as before - writing nothing first - and keeps it last, only where the
--                          version has not moved since it read (a version row deleted meanwhile keeps nothing: B4) and no
--                          board kept meanwhile serves its second or a later one already.
CREATE TABLE IF NOT EXISTS market_vendor_ver (
  region INTEGER PRIMARY KEY,
  ver    INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS market_vendor_boards (
  region INTEGER PRIMARY KEY,
  built  INTEGER NOT NULL,
  shape  TEXT NOT NULL,
  since  INTEGER NOT NULL,
  until  INTEGER NOT NULL,
  rows   TEXT NOT NULL
);

-- Every region a board can name today - a house stands in it, a trader listing or a patron's sale names it - has its
-- version now, so its first read keeps its board.
INSERT OR IGNORE INTO market_vendor_ver (region, ver)
  SELECT region, 1 FROM homes WHERE region IS NOT NULL
  UNION SELECT region, 1 FROM market_listings WHERE vendor_id IS NOT NULL AND region IS NOT NULL
  UNION SELECT region, 1 FROM market_patron_sales WHERE region IS NOT NULL;

-- The board's next listing to run out, by its region (idx_market_vendor_region names the listing's age, not its end -
-- every open trader listing of the region was read for it; AUDIT LEAN-READS B8).
CREATE INDEX IF NOT EXISTS idx_market_vendor_expiry ON market_listings (region, expires_at) WHERE state = 'open' AND vendor_id IS NOT NULL;

-- A trader's listing written - listed, bought, cancelled, run out, swept - its region's board and (moved) the old one's:
-- the columns the board reads alone (AUDIT LEAN-READS B7: the hour's patron reckoning marks every trader listing of a
-- town, and the board's pixel and the courier's word are none of the board's).
CREATE TRIGGER IF NOT EXISTS vendor_board_listed AFTER INSERT ON market_listings WHEN NEW.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT NEW.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_listing AFTER UPDATE OF id, kind, region, material, item, own, bought, units, price, fee, wear, at,
  expires_at, state, currency, seller, vendor_map, vendor_id ON market_listings WHEN OLD.vendor_id IS NOT NULL OR NEW.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r UNION SELECT NEW.region) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_unlisted AFTER DELETE ON market_listings WHEN OLD.vendor_id IS NOT NULL
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;

-- A trader standing in a room, moved or taken away (a piece a listing names stands there): its house's region. A
-- piece's place is asked only where it is JSON (json_extract throws on a record that is not, and a trigger's throw would
-- refuse the write: decor.js reads such a record as no piece).
CREATE TRIGGER IF NOT EXISTS vendor_board_trader_in AFTER INSERT ON home_decor
  WHEN NEW.yard = 0 AND CASE WHEN json_valid(NEW.place) THEN json_extract(NEW.place, '$.station') END = 'vendor'
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT region AS r FROM homes WHERE map_id = NEW.map_id AND building_key = NEW.building_key) WHERE true
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_trader AFTER UPDATE ON home_decor
  WHEN (OLD.yard = 0 AND CASE WHEN json_valid(OLD.place) THEN json_extract(OLD.place, '$.station') END = 'vendor') OR (NEW.yard = 0 AND CASE WHEN json_valid(NEW.place) THEN json_extract(NEW.place, '$.station') END = 'vendor')
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT DISTINCT region AS r FROM homes
    WHERE (map_id = OLD.map_id AND building_key = OLD.building_key) OR (map_id = NEW.map_id AND building_key = NEW.building_key)) WHERE true
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_trader_out AFTER DELETE ON home_decor
  WHEN OLD.yard = 0 AND CASE WHEN json_valid(OLD.place) THEN json_extract(OLD.place, '$.station') END = 'vendor'
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT region AS r FROM homes WHERE map_id = OLD.map_id AND building_key = OLD.building_key) WHERE true
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;

-- A house changing hands, its door, its name, its region or its guild, or released (its pieces go after it, the cascade
-- finding no house to name - this moves its region first); and one made (a house that stands no trader yet moves its
-- region's board for nothing - and a row replaced, whose implied delete fires no trigger, moves it: AUDIT LEAN-READS B6).
CREATE TRIGGER IF NOT EXISTS vendor_board_house AFTER UPDATE OF player, char_id, owner_name, region, entry, guild_id ON homes
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r UNION SELECT NEW.region) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_house_in AFTER INSERT ON homes
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT NEW.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
CREATE TRIGGER IF NOT EXISTS vendor_board_house_gone AFTER DELETE ON homes
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT OLD.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;

-- A patron's purchase told (the board says the region's day of them).
CREATE TRIGGER IF NOT EXISTS vendor_board_patron AFTER INSERT ON market_patron_sales
BEGIN
  INSERT INTO market_vendor_ver (region, ver) SELECT r, COALESCE((SELECT built FROM market_vendor_boards b WHERE b.region = r), 0) + 1 FROM (SELECT NEW.region AS r) WHERE r IS NOT NULL
    ON CONFLICT (region) DO UPDATE SET ver = ver + 1;
END;
