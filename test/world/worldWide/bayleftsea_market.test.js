// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 7 - B2 = E1): THE MARKET'S HUBS PAST THE
// BAY - a province's hub its crown seat's pixel, else its largest listed city's, made again as the seats and the places
// move; the Bay's hubs HUB1's byte for byte. On the freeware (ARENA2_PATH): the nine provinces' hubs, and the real Worker
// over node:sqlite buying and filling between a board in Solitude and one in Daggerfall, both ways - `market-no-road`
// with HUB1's hubs alone (the before), a courier with the provinces' (bible/06-Systems/Professions-Arc.md BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { provinceHubOf, marketHubsOf, createMarketHubs, PROVINCE_HUB_REGIONS } from '../../../src/systems/region/marketHubs.js';
import { settlementRank } from '../../../src/systems/region/regionHubs.js';
import { deriveTownSeats, replaceSeats, tamrielSeatsOf } from '../../../src/systems/town/townSeats.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { codeOnly } from '../../codeOnly.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit
const src = (p) => codeOnly(readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8'));
const { TownCity, TownHamlet, TownVillage } = LOCATION_TYPES;

/** A seats' book as the host keeps one: no Bay seat, the seats past the Bay replaced in (the producers' own). */
const seatsOf = (capitals = [], cities = []) => { const b = deriveTownSeats([]); replaceSeats(b, 'tesa', tamrielSeatsOf({ capitals, cities })); return b; };
/** A registry holding `rows` past the Bay (the producer's own record of each - worldPlaces.js placeOfRow). */
const placesOf = (rows) => { const p = createWorldPlaces(); p.register('tesa', rows); return p; };

test('BAY-LEFT-SEA THE PROVINCES\' MARKET HUBS: a province\'s hub its crown seat\'s pixel; without a crown its largest listed city\'s - a city over a town over a village, then the most blocks, then the lower map id; none for a Bay region or a province with neither (mutants: the crown unasked; a palace seat taken for a crown; the kind unranked; the blocks unread; the tie to the higher id; the region unfiltered)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  assert.deepEqual([settlementRank(TownCity), settlementRank(TownHamlet), settlementRank(TownVillage), settlementRank(LOCATION_TYPES.DungeonKeep)], [3, 2, 1, 0]);
  assert.deepEqual(PROVINCE_HUB_REGIONS, [62, 63, 64, 65, 66, 67, 68, 69, 70]);
  // Skyrim (64): Solitude its crown - the seat of power the seats past the Bay stand, whatever larger city it holds
  const seats = seatsOf([{ key: 0x34180001, name: 'Solitude', px: 1569, py: -430, region: 64 }], [{ key: 0x0a77a121, name: 'Dragonstar', px: 1700, py: -300, region: 64 }, { key: 0x0a77a0c0, name: 'Evermor', px: 709, py: -337, region: 62 }]);
  assert.deepEqual([seats.byMapId.get(seats.powers.get(64)).tier, seats.byMapId.get(seats.powers.get(62)).tier], ['crown', 'palace']);
  const rows = [
    { mapId: 0x0a77a121, name: 'Dragonstar', px: 1700, py: -300, type: TownCity, w: 8, h: 8 },   // Skyrim's largest - not its hub
    // High Rock past the Bay (62): no capital - its palace seat is no crown, its hub its largest listed city
    { mapId: 0x0a77a0c0, name: 'Evermor', px: 709, py: -337, type: TownCity, w: 4, h: 4 },
    { mapId: 0x0a77a0c1, name: 'Bigger Town', px: 720, py: -340, type: TownHamlet, w: 6, h: 6 },   // a town, though larger
    { mapId: 0x0a77a0c2, name: 'Larger City', px: 730, py: -350, type: TownCity, w: 5, h: 4 },   // the most blocks of the cities
    { mapId: 0x0a77a0c3, name: 'Tied City', px: 740, py: -360, type: TownCity, w: 4, h: 5 },   // as many, a higher id
    // Hammerfell past the Bay (63): towns and villages alone - the town
    { mapId: 0x0a77a200, name: 'A Village', px: 190, py: 700, type: TownVillage, w: 6, h: 6 },
    { mapId: 0x0a77a201, name: 'A Town', px: 190, py: 662, type: TownHamlet, w: 2, h: 2 },
    { mapId: 0x0001a6c6, name: 'Daggerfall', px: 214, py: 330, type: TownCity, w: 8, h: 8, region: 17 },   // a Bay city: HUB1's, never a province's
  ];
  const places = placesOf(rows);
  assert.deepEqual([places.byMapId(0x0a77a0c2).region, places.byMapId(0x0a77a201).region, places.byMapId(0x0a77a121).region, places.byMapId(0x0001a6c6).region], [62, 63, 64, 17], 'the registry\'s own regions (WW-R)');
  assert.deepEqual(PROVINCE_HUB_REGIONS.map((r) => provinceHubOf(r, { seats, places })), [[730, -350], [190, 662], [1569, -430], null, null, null, null, null, null]);
  assert.equal(provinceHubOf(17, { seats, places }), null, 'a Bay region\'s hub is HUB1\'s, never this');
  assert.deepEqual(provinceHubOf(64, { seats: null, places }), [1700, -300], 'no seats read: Skyrim\'s largest listed city');
  assert.equal(provinceHubOf(65, {}), null, 'nothing stands: no hub of this client\'s (the witnesses\' answer is the road\'s)');
});

test('BAY-LEFT-SEA THE HUBS A REQUEST CARRIES: the Bay\'s HUB1\'s byte for byte, each province\'s that stands after them; the host\'s made again only when the seats\' book or the registry moves (mutants: the provinces never added; the Bay\'s rebuilt otherwise; the memo never made again; made again every ask)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const regionHubs = { byRegion: new Map([[17, { regionIndex: 17, pixel: { x: 214, y: 330 } }], [23, { regionIndex: 23, pixel: { x: 786, y: 243 } }]]) };
  const seats = seatsOf([{ key: 0x34180001, name: 'Solitude', px: 1569, py: -430, region: 64 }]);
  const places = placesOf([]);
  const hubs = marketHubsOf({ regionHubs, seats, places });
  assert.deepEqual(hubs, { 17: [214, 330], 23: [786, 243], 64: [1569, -430] });
  assert.deepEqual(Object.keys(hubs), ['17', '23', '64']);
  assert.deepEqual(marketHubsOf({ regionHubs }), { 17: [214, 330], 23: [786, 243] }, 'the Bay\'s alone, as PROF5 made them');
  const hubsNow = createMarketHubs({ regionHubs, seats, places });
  const a = hubsNow();
  assert.equal(hubsNow(), a, 'the one object while nothing moves');
  assert.ok(Object.isFrozen(a));
  replaceSeats(seats, 'tesa', tamrielSeatsOf({ capitals: [{ key: 0x34180001, name: 'Solitude', px: 1569, py: -430, region: 64 }, { key: 0x34180002, name: 'Mournhold', px: 3293, py: 550, region: 65 }] }));
  const b = hubsNow();
  assert.notEqual(b, a);
  assert.deepEqual(b, { 17: [214, 330], 23: [786, 243], 64: [1569, -430], 65: [3293, 550] }, 'the seats moved: made again');
  places.register('tesa', [{ mapId: 0x0a77a0c0, name: 'Evermor', px: 709, py: -337, type: TownCity, w: 4, h: 4 }]);
  const c = hubsNow();
  assert.notEqual(c, b);
  assert.deepEqual(c[62], [709, -337], 'the places moved: made again');
});

test('BAY-LEFT-SEA THE HOST: the market\'s pieces module makes the hubs over the seats and the registry, the board hands the tab the hubs as they stand when it opens, a trader\'s stall reads them at its buy (mutants: the seats unhanded; the board\'s hubs a function; the stall\'s hubs the old object)', () => {
  const m = src('src/scenes/marketPiecesHost.js');
  assert.ok(m.includes('const marketHubs = createMarketHubs({ regionHubs, seats: townSeats, places: worldPlaces });'));
  assert.ok(m.includes('marketBook, regionHubs, saveSoon, townSeats, worldPlaces, writBook'));
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes('    marketBook, regionHubs, saveSoon, townSeats, worldPlaces, writBook,   // BAY-LEFT-SEA'));
  assert.ok(w.includes("regionNameOf: (r) => REGION_NAMES[r] ?? 'another region', hubs: marketHubs(), name:"));
  assert.ok(src('src/scenes/vendorHost.js').includes('const hub = marketHubs()[row.region];'));
});

const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
test('BAY-LEFT-SEA (ARENA2): on the freeware every province has its hub - the seven capitals\' centres and the largest city-states of High Rock and Hammerfell past the Bay - and the Bay\'s 43 are HUB1\'s; the real Worker fills a Daggerfall order from a board in Solitude and buys a Skyrim listing from a board in Daggerfall, both ways - `market-no-road` with HUB1\'s hubs alone', { skip: realSkip }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { pickRegionHubs } = await import('../../../src/systems/region/regionHubs.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { CAPITALS, capitalPlaceId, capitalOnPixel } = await import('../../../src/world/tamrielCapitals.js');
  const { arenaPlaceId } = await import('../../../src/world/arenaLocations.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(FIT);
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); } }
    // the host's own: HUB1 and the seats over the game's rows, the registry's places past the Bay, the seats past it
    const regionHubs = pickRegionHubs(rows, { regionNameOf: (r) => maps.getRegionName(r) });
    const seats = deriveTownSeats(rows, { regionNameOf: (r) => maps.getRegionName(r), isHub: (k) => regionHubs.byMapId.has(k) });
    const templates = arenaTemplates(rows), pixels = arenaPixels();
    const places = createWorldPlaces();
    places.register(PAST_BAY_SOURCE, pastBayPlaceRows({ pixels, templateOf: (p) => arenaTemplateOf(templates, p), capitals: true }));
    // as tamrielPlacesHost.js seatPlaces stands them: each capital's centre slice, each city-state but one a capital's pixel holds
    const capitals = CAPITALS.map((c, k) => { const p = places.byMapId(capitalPlaceId(k, 0)); return p && { key: p.mapId, name: c.name, px: p.px, py: p.py, region: p.region }; }).filter(Boolean);
    const cities = (pixels?.stood ?? []).filter((p) => p.kind === 'city-state' && !capitalOnPixel(p.bx, p.by)).map((p) => ({ key: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, region: maps.getRegionIndexAt(p.bx, p.by) }));
    assert.equal(capitals.length, 7);
    replaceSeats(seats, 'tesa', tamrielSeatsOf({ capitals, cities }));
    const before = marketHubsOf({ regionHubs });
    const hubs = marketHubsOf({ regionHubs, seats, places });
    assert.deepEqual(Object.fromEntries(Object.entries(hubs).filter(([r]) => Number(r) < 62)), before, 'the Bay\'s hubs HUB1\'s, byte for byte');
    assert.equal(Object.keys(before).length, 43);
    assert.deepEqual(Object.fromEntries(PROVINCE_HUB_REGIONS.map((r) => [r, hubs[r]])), {
      62: [709, -337], 63: [190, 662], 64: [1569, -430], 65: [3293, 550], 66: [8, 1533], 67: [1247, 1449], 68: [1922, 1705], 69: [3355, 1108], 70: [2069, 658],
    });
    // the real Worker over node:sqlite (lane E's probe): a board in Daggerfall (17) and one in Solitude (Skyrim, 64)
    const { standService, T0 } = await import('../../accountDb.mjs');
    const realNow = Date.now;
    Date.now = () => T0 * 1000;
    try {
      const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
      const raw = s.env.DB._raw;
      const fund = (who, m) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, m);
      const give = (who, m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
        ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, qty);
      let n = 0; const rid = () => `bls-${String(++n).padStart(6, '0')}`;
      const mac = await s.registered('Mac'), ann = await s.registered('Ann');
      fund(mac, 5000); fund(ann, 5000); give(ann, 'ore:mithril', 100); give(ann, 'metal:iron', 50);
      const order = (await s.call('/v1/market/order', { character: mac.character, region: 17, material: 'ore:mithril', units: 200, price: 8, hubs, rid: rid() }, mac.secret)).body.order;
      const fill = (h) => s.call('/v1/market/fill', { character: ann.character, region: 64, order: order.id, units: 40, hubs: h, rid: rid() }, ann.secret);
      assert.equal((await fill(before)).body.error, 'market-no-road', 'HUB1\'s hubs alone: no road to Skyrim (the audit\'s finding)');
      const filled = (await fill(hubs)).body;
      assert.equal(filled.ok, true, JSON.stringify(filled));
      assert.equal(filled.fill.courier, 123, 'the courier\'s fee off the road Solitude to Daggerfall (1,506 pixels)');
      const read = (await s.call('/v1/market/read', { character: ann.character, region: 64, view: 'orders', hubs }, ann.secret)).body;
      assert.deepEqual(read.orders.map((o) => [o.region, o.road?.road]), [[17, 1506]]);
      const listing = (await s.call('/v1/market/list', { character: ann.character, region: 64, kind: 'material', material: 'metal:iron', units: 10, price: 5, hubs, rid: rid() }, ann.secret)).body.listing;
      const buy = (h) => s.call('/v1/market/buy', { character: mac.character, region: 17, listing: listing.id, units: 5, max: 100_000, hubs: h, rid: rid() }, mac.secret);
      assert.equal((await buy(Object.fromEntries(Object.entries(before)))).body.error, 'market-no-road');
      assert.equal((await buy(hubs)).body.ok, true, 'bought in Daggerfall from a board in Solitude');
    } finally { Date.now = realNow; }
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
