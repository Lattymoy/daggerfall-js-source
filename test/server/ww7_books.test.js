// WW7-5 (2026-10-25, the owner: "This needs to apply everywhere", "We also need to fully integrate our living world into
// the entirety of tamriel"; bible/03-World/World-Wide.md WW7-5): the town books past the Bay - every region's (the Bay's 62
// and the provinces' 62-70), the seven tables whose CHECKs said the Bay's rebuilt, the Watch on the land past the Bay and
// never past the Veil, a town past the Bay a report of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { regionOk, bayRegionOk } from '../../src/net/nodeLaw.js';
import { homeRegionOk, HOME_REGION_MAX } from '../../src/net/homeLaw.js';
import { watchPixelOk, WATCH_VEIL_BOX } from '../../src/net/watchReceipt.js';
import { ETHER_BOX } from '../../src/world/ethericSea.js';
import { hubPixelOk, parseHubReport, hubReport } from '../../src/net/marketLaw.js';
import { townReportOf, parseTownReport, townReportText, TOWN_PLACE_ID_MIN } from '../../src/net/townEconLaw.js';
import { capitalPlaceId, capitalLocationIndex } from '../../src/world/tamrielCapitals.js';
import { arenaPlaceId, arenaLocationIndex } from '../../src/world/arenaLocations.js';
import { placeOfRow } from '../../src/world/worldWide/worldPlaces.js';
import { createTownTable } from '../../src/world/worldWide/townTable.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const BOOKS = ['market', 'professions', 'writs', 'contracts', 'cards', 'seaBounty', 'npcChapters', 'npcHalls', 'npcReceipts'];
const TABLES = ['market_listings', 'market_orders', 'market_auctions', 'market_bids', 'guild_writs', 'commissions', 'guild_contracts'];
const CHILDREN = ['market_reports', 'market_auction_reports'];

test('WW7-5 the books every region\'s: no town book asks the Bay\'s alone - the market, the writs, the contracts, the cards, the sea bounty, the chapters, their halls and receipts read every region\'s; a home any region\'s; the staff\'s filter too (mutants: a book the Bay\'s; a home the Bay\'s)', () => {
  for (const b of BOOKS) {
    const s = rd(`server-account/src/${b}.js`);
    assert.ok(!/bayRegionOk/.test(s), `${b}: the Bay's no more`);
    assert.match(s, /regionOk\(/, `${b}: every region's`);
  }
  assert.ok(!/bayRegionOk/.test(rd('src/net/npcChapterLaw.js')));
  assert.deepEqual([regionOk(64), regionOk(70), regionOk(71), bayRegionOk(64)], [true, true, false, false]);
  assert.equal(HOME_REGION_MAX, REGION_NAMES.length - 1);
  assert.deepEqual([homeRegionOk(0), homeRegionOk(64), homeRegionOk(70), homeRegionOk(71), homeRegionOk(-1)], [true, true, true, false, false]);
  assert.match(rd('server-account/src/staffEconomy.js'), /region: int\(body\.region, 0, 70\)/);
  assert.match(rd('server-account/src/market.js'), /Object\.entries\(hubs\)\.slice\(0, REGION_NAMES\.length\)/);
});

test('WW7-5 the Watch on the land past the Bay: the world\'s grid is its ground, never the Veil\'s box (the Eltheric Ocean\'s, pinned equal) - so a town, a seat and a node past the Bay are watched, and the isles still are not; a market\'s board a pixel of the world\'s grid (mutants: the Bay\'s alone; the Veil watched; the board the Bay\'s)', () => {
  assert.deepEqual({ ...WATCH_VEIL_BOX }, { ...ETHER_BOX });
  assert.deepEqual([watchPixelOk(500, 250), watchPixelOk(1000, 0), watchPixelOk(-300, -500), watchPixelOk(4000, 2000)], [true, true, true, true]);
  assert.deepEqual([watchPixelOk(100, -3000), watchPixelOk(8127, -7680), watchPixelOk(8192, 0), watchPixelOk(0, -8192), watchPixelOk(0.5, 1)], [false, false, false, false, false]);
  assert.equal(watchPixelOk(63, -3000), true, 'west of the Veil\'s box');
  assert.deepEqual([hubPixelOk(-40, 1200), hubPixelOk(8192, 0)], [true, false]);
  assert.deepEqual(parseHubReport(hubReport(-40, 1200)), { x: -40, y: 1200 });
  assert.deepEqual(parseHubReport('12,34'), { x: 12, y: 34 });
  assert.equal(parseHubReport('99999,1'), null);
});

test('WW7-5 a town past the Bay reports itself: on the world\'s grid, its map id a place of the port\'s own (never a MAPS row\'s), its location its own negative, its region its province\'s; the Bay\'s towns as before (mutants: a MAPS id past the Bay; a Bay location past it; the Bay\'s identity dropped)', () => {
  const sol = { map: capitalPlaceId(1, 0), px: 1810, py: -420, region: 64, location: capitalLocationIndex(1, 0) };
  assert.deepEqual(townReportOf(sol), sol);
  assert.deepEqual(parseTownReport(townReportText(sol)), sol);
  const city = { map: arenaPlaceId({ provinceIndex: 3, id: 7 }), px: -300, py: 900, region: 66, location: arenaLocationIndex({ provinceIndex: 3, id: 7 }) };
  assert.deepEqual(townReportOf(city), city);
  assert.ok((capitalPlaceId(1, 0) & 0xfffff) >= TOWN_PLACE_ID_MIN && (city.map & 0xfffff) >= TOWN_PLACE_ID_MIN && 499 * 1000 + 999 < TOWN_PLACE_ID_MIN);
  assert.equal(townReportOf({ ...sol, map: (17 << 20) | 400123 }), null, 'a MAPS id past the Bay');
  assert.equal(townReportOf({ ...sol, location: 12 }), null, 'a Bay location past it');
  assert.equal(townReportOf({ ...sol, px: 9000 }), null, 'off the grid');
  assert.equal(townReportOf({ ...sol, region: 71 }), null);
  const bay = { map: (5 << 20) | (120 * 1000 + 450), px: 450, py: 120, region: 17, location: 3 };
  assert.deepEqual(townReportOf(bay), bay);
  assert.equal(townReportOf({ ...bay, px: 451 }), null, 'the Bay\'s map id names its own pixel');
  assert.equal(townReportOf({ ...bay, location: -1 }), null);
  assert.deepEqual(townReportOf({ ...bay, region: 64 }), { ...bay, region: 64 }, 'a region the law takes any of the world\'s');
});

test('WW7-5 a place past the Bay carries its location\'s index through the registry to the town table (mutant: the index dropped)', () => {
  const row = placeOfRow({ mapId: capitalPlaceId(1, 0), name: 'Solitude', px: 1810, py: -420, type: 0, location: capitalLocationIndex(1, 0) }, 'tesa-capitals');
  assert.equal(row.location, capitalLocationIndex(1, 0));
  assert.equal(placeOfRow({ mapId: 9, name: 'x', px: 1810, py: -420, type: 0 }, 's').location, null);
  const towns = createTownTable(() => ({ byMapId: (id) => (id === row.mapId ? row : null) }));
  assert.equal(towns.get(row.mapId).location, capitalLocationIndex(1, 0));
  // PIN MOVED (TESA x AUDIT TESA II): the capitals and Arena's places the audit's live list (world/pastBayRows.js), the countryside the host's
  const rows = rd('src/world/pastBayRows.js');
  for (const re of [/location: capitalLocationIndex\(k, capitalSliceOrdinal\(cap, s\)\),/, /port: !!p\.port,\n\s*location: arenaLocationIndex\(p\),\n\s*\}\);/]) assert.match(rows, re);
  assert.match(rd('src/scenes/tamrielPlacesHost.js'), /location: countryLocationIndex\(countryOrdinal\(px, py\)\) \};/);
});

test('WW7-5 migration 0180 (0170 before main\'s own took it): the market\'s listings, orders, auctions and bids, the guild writs, the commissions and the contracts take every region - every row, every child, every index and trigger kept, each table as it was but its region\'s CHECK (mutants: a child lost; a trigger dropped; the bound the Bay\'s)', () => {
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.includes('0186_world_books.sql'));
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of files.filter((f) => f < '0180')) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const filler = (table, id) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().filter((c) => c.name === 'id' || (c.notnull && c.dflt_value == null));
    db.prepare(`INSERT INTO ${table} (${cols.map((c) => c.name).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => (c.name === 'id' ? id : c.type === 'INTEGER' ? 1 : `${c.name}-${id}`)));
  };
  for (const id of ['p1', 'p2']) filler('players', id);
  filler('guilds', 'g1');
  db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n, board_x, board_y, vendor_map, vendor_id, patron_hour) VALUES ('L1','p1','c1',61,'material','ore:iron',5,5,3,1,10,20,'r1','n1',450,120,7,'v1',3)`);
  db.exec("INSERT INTO market_reports (listing, reporter, at) VALUES ('L1','p2',5)");
  db.exec(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n) VALUES ('O1','p1','c1',17,'ore:iron',5,5,3,15,10,20,'r2','n2')`);
  db.exec(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n, board_x, board_y, tithe) VALUES ('A1','p1','c1',20,'0123456789abcdef',900,10,1,10,20,'r3','n3',4,5,2)`);
  db.exec(`INSERT INTO market_bids (id, auction, bidder, char_id, region, amount, at, rid, n) VALUES ('B1','A1','p2','c2',23,12,11,'r4','n4')`);
  db.exec("INSERT INTO market_auction_reports (auction, reporter, at) VALUES ('A1','p2',6)");
  db.exec(`INSERT INTO guild_writs (id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow, at, expires_at, rid, n, seat, camp) VALUES ('W1','g1','p1','c1',1,3,61,'ore:iron',5,5,2,10,10,20,'r5','n5',77,1)`);
  db.exec(`INSERT INTO commissions (id, poster, poster_char, region, recipe, pay, at, expires_at, rid, n) VALUES ('C1','p1','c1',0,'sword',100,10,20,'r6','n6')`);
  db.exec(`INSERT INTO guild_contracts (id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow, at, expires_at, rid, n) VALUES ('K1','g1','p1','c1',0,3,61,'raid',5,5,2,10,10,20,'r7','n7')`);
  const rows = (t) => JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const schema = () => db.prepare(`SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN (${[...TABLES, ...CHILDREN].map((t) => `'${t}'`).join(',')}) AND sql IS NOT NULL ORDER BY type, name`).all()
    .map((r) => ({ ...r, sql: r.sql.replace(/^CREATE TABLE "?(\w+)"?/, 'CREATE TABLE $1').replace(/CHECK \(region >= 0 AND region (?:< 62|<= 61|<= 70)\)/, 'CHECK (region)').replace(/\s+/g, ' ') }));
  const was = Object.fromEntries([...TABLES, ...CHILDREN].map((t) => [t, rows(t)])), wasSchema = schema();
  const vendorVer = () => db.prepare('SELECT ver FROM market_vendor_ver WHERE region = 64').get()?.ver ?? 0;
  db.exec(readFileSync(new URL('0186_world_books.sql', dir), 'utf8'));
  for (const t of [...TABLES, ...CHILDREN]) assert.equal(rows(t), was[t], `${t} kept`);
  assert.deepEqual(schema(), wasSchema, 'each table, index and trigger as it was but the region\'s CHECK');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE '%\\_new' ESCAPE '\\' OR name LIKE '%\\_keep' ESCAPE '\\'").get().n, 0, 'nothing left over');
  for (const t of TABLES) assert.match(db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(t).sql, /CHECK \(region >= 0 AND region <= 70\)/, t);
  // a province's: listed, and the vendors' board told (0137's trigger, made again)
  const before = vendorVer();
  db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n, vendor_id) VALUES ('L2','p1','c1',64,'material','ore:iron',1,1,3,1,10,20,'r8','n8','v2')`);
  assert.equal(vendorVer(), before + 1);
  db.exec(`INSERT INTO guild_contracts (id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow, at, expires_at, rid, n) VALUES ('K2','g1','p1','c1',0,3,70,'raid',5,5,2,10,10,20,'r9','n9')`);
  assert.throws(() => db.exec(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n) VALUES ('O2','p1','c1',71,'ore:iron',5,5,3,15,10,20,'r10','n10')`), /CHECK/);
  // the cascades as before: an auction's bids and reports go with it
  db.exec("DELETE FROM market_auctions WHERE id = 'A1'");
  assert.deepEqual([db.prepare('SELECT count(*) AS n FROM market_bids').get().n, db.prepare('SELECT count(*) AS n FROM market_auction_reports').get().n], [0, 0]);
});
