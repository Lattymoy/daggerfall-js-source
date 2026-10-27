// BAY-LEFT-MAPS C3, C11 (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed.
// No exceptions."; bible/06-Systems/Travel-View.md BAY-LEFT-MAPS) - A PLACE PAST THE BAY BY ITS SUMMARY.
//
// Every "place past the Bay by its summary" (scenes/mapPlacesHost.js tvPlaceSummary, moved out of bootWorld by HOST-SPLIT)
// read the location index alone, and the index holds a place past the Bay only once its pixel has built. So a booked
// passage to a port past the Bay, saved and reloaded, never resumed (her master asked every 20 s and was answered
// nothing); a port past the Bay found in an earlier session was off her masters' lists; the Overworld's far plates (TV5)
// were a snapshot of the index at the view's first ask - no countryside, no province not built yet; a quest's diamond
// past the Bay did nothing (its key's pixel unread west and north of the Bay's corner, and its place unfound). Now a
// place found there is its row's summary - the registry's list, the countryside's roll, a lair's, the rolls the build
// stands (scenes/tamrielPlacesHost.js rowAt) - known by the ids the pixel could hold before it stands (idsOnPixel), its
// location stood the first time a journey reads it (`loc`), never for a list. C11: the carriage towns keyed by the
// place's own id (it read every map id as the Bay's `y * 1000 + x`). C10: the junction map's dots past the Bay.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createMapPlaces } from '../../src/scenes/mapPlacesHost.js';
import { restoreDiscovery, discoverLocation, snapshotDiscovery } from '../../src/systems/discovery.js';
import { addPastBayPlaces, resetPastBayPlaces } from '../../src/world/pastBayPlaces.js';
import { LOCATION_TYPES as T, mapPixelToLongitudeLatitude } from '../../src/formats/mapsFile.js';
import { locationWorldRect } from '../../src/world/streamingWorld.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { countryPlaceId } from '../../src/world/tamrielCountry.js';
import { hostText } from '../hostText.mjs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

beforeEach(() => { restoreDiscovery(null); resetPastBayPlaces(); });

/** A location as the build stands one past the Bay (its fields the summary reads). */
const stoodLoc = (row) => ({ name: row.name, regionIndex: row.region, locationIndex: row.location, mapTableData: { mapId: row.mapId, locationType: row.type }, exterior: { exteriorData: { width: row.w, height: row.h, blockNames: ['TVRNAS01.RMB'] } } });
/** The places host's three reads past the Bay, over rows by pixel - and every stand counted. */
function placesOf(rows) {
  const at = new Map(rows.map((r) => [`${r.px},${r.py}`, r]));
  const index = new Map(), stands = [], rowsAsked = [];
  const pq = {
    idsOnPixel: (px, py) => (at.has(`${px},${py}`) ? [at.get(`${px},${py}`).mapId] : []),
    rowAt: (px, py) => { rowsAsked.push(`${px},${py}`); return at.get(`${px},${py}`) ?? null; },
    standAt: (px, py) => { stands.push(`${px},${py}`); const r = at.get(`${px},${py}`); if (!r) return null; const loc = stoodLoc(r); index.set(`${px},${py}`, loc); return loc; },
  };
  return { pq, index, stands, rowsAsked };
}
const host = (o) => ({ captainLedger: { isCharted: () => false, chartedCount: () => 0 }, etherPlaceClone: () => null, etherSea: false, locationIndex: o.index ?? new Map(), mapDict: new Map(),
  wildActiveNow: () => null, wildHallStand: () => null, provinceQuestPlaces: o.pq ?? null, worldPlaces: o.worldPlaces ?? null, _locIndexGen: o.gen ?? 0 });
const TOWN = { mapId: countryPlaceId(1234), name: 'Ingmik', px: 1600, py: -420, type: T.TownHamlet, region: 64, location: -900, w: 2, h: 2 };
const PORT = { mapId: 0x24180123 >>> 0, name: 'Dawnstar', px: 1700, py: -600, type: T.TownCity, region: 64, location: -800, w: 4, h: 4, port: true };

test('BAY-LEFT-MAPS C3 A PLACE FOUND, NOT STANDING YET: its summary is its row\'s - id, name, region, location, type - known by the ids the pixel could hold, nothing stood to answer it; its location is stood the first time a journey reads it, once; its rect its grid\'s until then (mutants: the index alone as before; stood to answer; the location stood every read; the found law skipped; the row\'s own find unchecked)', () => {
  const p = placesOf([TOWN, PORT]);
  const mp = createMapPlaces(host(p));
  assert.equal(mp.tvPlaceSummary(TOWN.px, TOWN.py), null, 'never found: no summary');
  assert.deepEqual(p.rowsAsked, [], 'and no row read for it - a list of pixels costs the ids alone');
  discoverLocation(TOWN.mapId, { locationName: TOWN.name });
  const s = mp.tvPlaceSummary(TOWN.px, TOWN.py);
  assert.deepEqual({ pixel: s.pixel, name: s.name, mapId: s.mapId, regionIndex: s.regionIndex, locationIndex: s.locationIndex, locationType: s.locationType },
    { pixel: { x: TOWN.px, y: TOWN.py }, name: 'Ingmik', mapId: TOWN.mapId, regionIndex: 64, locationIndex: -900, locationType: T.TownHamlet });
  assert.deepEqual(p.stands, [], 'nothing stood to answer it');
  assert.deepEqual(s.lightRect(), locationWorldRect(stoodLoc(TOWN), TOWN.px, TOWN.py), 'its plate over its grid');
  const loc = s.loc;
  assert.deepEqual(p.stands, ['1600,-420'], 'read: stood, the build\'s own order');
  assert.equal(s.loc, loc);
  assert.equal(p.stands.length, 1, 'once');
  assert.equal(s.lightRect(), null, 'stood: its own rect');
  const again = mp.tvPlaceSummary(TOWN.px, TOWN.py);
  assert.equal(again.loc, loc, 'and the index\'s from then on');
  assert.equal(again.locationType, T.TownHamlet);
  // the pixel could hold two places (an Arena place under a capital's slice, say) and the one found is not the one the build
  // stands there: no summary - the row's own id is the one that must be found
  const OTHER = { ...TOWN, mapId: countryPlaceId(4321), px: 1610, py: -420, name: 'Elsewhere' };
  const q = placesOf([OTHER]);
  q.pq.idsOnPixel = (px, py) => (px === OTHER.px && py === OTHER.py ? [OTHER.mapId, countryPlaceId(9999)] : []);
  discoverLocation(countryPlaceId(9999), {});
  assert.equal(createMapPlaces(host(q)).tvPlaceSummary(OTHER.px, OTHER.py), null, 'another id of the pixel found: not this place');
  discoverLocation(OTHER.mapId, {});
  assert.equal(createMapPlaces(host(q)).tvPlaceSummary(OTHER.px, OTHER.py)?.name, 'Elsewhere', 'its own found: its summary');
});

test('BAY-LEFT-MAPS C3 A QUEST\'S DIAMOND: a place a quest names past the Bay is its summary found or not (`named`), and the press reads its key west and north of the Bay\'s corner - the host\'s and the marks\' (mutants: named unread; the index arm\'s named unread; the key\'s minus unread; a plate over a pending place reads its location)', () => {
  const p = placesOf([{ ...TOWN, px: -150, py: -40 }]);
  const mp = createMapPlaces(host(p));
  assert.equal(mp.tvPlaceSummary(-150, -40), null, 'unfound');
  assert.equal(mp.tvPlaceSummary(-150, -40, true)?.name, 'Ingmik', 'named by the quest');
  const loc = mp.tvPlaceSummary(-150, -40, true).loc;   // a journey reads it: it stands
  assert.ok(loc && p.index.get('-150,-40') === loc, 'read, it stands');
  assert.equal(mp.tvPlaceSummary(-150, -40), null, 'standing, still unfound');
  assert.equal(mp.tvPlaceSummary(-150, -40, true)?.loc, loc, 'standing, named by the quest: the index\'s place');
  const W = hostText('src/scenes/world.js');
  assert.match(W, /const qp = \/\^quest:\(-\?\\d\+\),\(-\?\\d\+\)\$\/\.exec\(key\);/);
  assert.match(W, /const plate = qp \? \{ summary: tvPlaceSummary\(Number\(qp\[1\]\), Number\(qp\[2\]\), true\) \} :/);
  assert.match(hostText('src/scenes/travelViewMarks.js'), /const s = tvPlaceSummary\(q\.px, q\.py, true\), r = s \? tvPlaceRect\(s\) : null;/, 'its diamond over the place\'s middle');
  assert.match(W, /const r = summary\.lightRect\?\.\(\) \?\? locationWorldRect\(summary\.loc, summary\.pixel\.x, summary\.pixel\.y\);/, 'a plate over a place not standing yet reads no location');
});

test('BAY-LEFT-MAPS C3 TV5\'S FAR PLATES: the Bay\'s towns gathered once (the Bay\'s alone, never a place past it the index held then), and past the Bay a near query - the registry\'s towns in the edge\'s circle (a capital once, by its centre) and the countryside\'s the roads laid - asked each time (mutants: the snapshot back; the Bay\'s gathered with what stood past it; the capital\'s every slice; the countryside unread; the registry read once for good; the edge\'s circle held to the Bay)', () => {
  const index = new Map([['500,250', { name: 'Bayton', mapTableData: { mapId: 250500, locationType: T.TownCity } }], ['1601,-420', stoodLoc(TOWN)]]);
  let gen = 1;
  const listed = [
    { mapId: PORT.mapId, px: PORT.px, py: PORT.py, type: T.TownCity, name: 'Dawnstar' },
    { mapId: capitalPlaceId(1, 0), px: 1569, py: -430, type: T.TownCity, name: 'Solitude' },
    { mapId: capitalPlaceId(0, 0), px: 2069, py: 658, type: T.TownCity, name: 'Imperial City' },
    { mapId: capitalPlaceId(0, 3), px: 2070, py: 658, type: T.TownCity, name: 'Market District' },
    { mapId: 250501, px: 501, py: 250, type: T.TownCity, name: 'Bay row' },
    { mapId: countryPlaceId(77), px: 1005, py: 10, type: T.TownHamlet, name: 'Over the edge' },
  ];
  const worldPlaces = { generation: () => gen, all: () => listed, byMapId: () => null };
  const mp = createMapPlaces(host({ index, worldPlaces }));
  addPastBayPlaces([{ x: 1590, y: -430, type: T.TownVillage }, { x: 1591, y: -431, type: T.DungeonRuin }, { x: 1500, y: -430, type: T.TownHamlet }]);
  assert.deepEqual(mp.tvFarSettlements({ x: 500, y: 250 }).map((t) => [t.x, t.y]), [[500, 250]], 'on the Bay: the Bay\'s own, gathered once - never the place past the Bay the index held');
  assert.deepEqual(mp.tvFarSettlements({ x: 1580, y: -430 }).map((t) => [t.x, t.y]), [[500, 250], [1569, -430], [1590, -430]], 'Solitude in the circle, a village the roads laid; Dawnstar and the dungeon not');
  assert.deepEqual(mp.tvFarSettlements({ x: 2060, y: 650 }).map((t) => [t.x, t.y]), [[500, 250], [2069, 658]], 'the Imperial City once, by its centre');
  assert.deepEqual(mp.tvFarSettlements({ x: 990, y: 10 }).map((t) => [t.x, t.y]), [[500, 250], [1005, 10]], 'on the Bay by its edge: the edge\'s circle reaches past it');
  listed.push({ mapId: 999999, px: 1700, py: -590, type: T.TownHamlet, name: 'New' });
  gen = 2;
  assert.deepEqual(mp.tvFarSettlements({ x: 1700, y: -590 }).map((t) => [t.x, t.y]), [[500, 250], [1700, -600], [1700, -590]], 'the registry moved: read again');
});

test('BAY-LEFT-MAPS C11 THE CARRIAGE TOWNS BY THEIR OWN KEY: a Bay town by its pixel id (DFU\'s mask); a walled city past the Bay by its whole id, found where the registry stands it; a countryside id never read as another pixel\'s place (mutants: every id the Bay\'s pixel id; a Bay key read off the registry; the stood place\'s id unchecked)', async () => {
  const { latchModLoaded } = await import('../../src/systems/modSettings.js');
  const { IMMERSIVE_TRAVEL_VENDOR } = await import('../../src/systems/immersiveTravel.js');
  latchModLoaded(IMMERSIVE_TRAVEL_VENDOR, true);
  const gated = (name, mapId) => ({ name, mapTableData: { mapId }, exterior: { exteriorData: { blockNames: ['WALLAA08.RMB', 'TVRNAS01.RMB'] } } });
  const index = new Map(), byId = new Map();
  const bayId = ((0x05 << 20) | (250 * 1000 + 500)) >>> 0;   // a Bay row's id: its pixel id in the low 20 bits
  index.set('500,250', gated('Bayton', bayId));
  index.set(`${PORT.px},${PORT.py}`, gated('Dawnstar', PORT.mapId));
  byId.set(PORT.mapId, { px: PORT.px, py: PORT.py });
  // a countryside id whose low 20 bits read as a Bay pixel id would name (289, 524) - a walled town stands there
  const country = countryPlaceId(524289 & 0x7ffff);
  assert.equal((country & 0xfffff) % 1000, 289);
  index.set('289,524', gated('Not it', 7));
  const mp = createMapPlaces(host({ index, worldPlaces: { byMapId: (id) => byId.get(id >>> 0) ?? null } }));
  assert.equal(mp.carriageTown(bayId), true, 'the Bay\'s town by its pixel');
  assert.equal(mp.carriageTown(PORT.mapId), true, 'a walled city past the Bay by its own id, where the registry stands it');
  assert.equal(mp.carriageTown(country), false, 'a farm is no other pixel\'s walled town');
  // the registry's pixel holding another place (a stale row): no answer for this id
  byId.set(country >>> 0, { px: PORT.px, py: PORT.py });
  const mp2 = createMapPlaces(host({ index, worldPlaces: { byMapId: (id) => byId.get(id >>> 0) ?? null }, gen: 1 }));
  assert.equal(mp2.carriageTown(country), false, 'the place standing there is not this id\'s');
  latchModLoaded(IMMERSIVE_TRAVEL_VENDOR, false);
  assert.equal(createMapPlaces(host({ index })).carriageTown(bayId), false, 'no carriages without the mod');
});

test('BAY-LEFT-MAPS C10 THE JUNCTION MAP\'S DOTS: on the Bay its row and DFU\'s discovery law, as it read; past the Bay a place found there - its dot drawn, its type its row\'s, nothing stood (mutants: the dots past the Bay unread; the host\'s read held to the Bay)', () => {
  const p = placesOf([TOWN]);
  const mp = createMapPlaces(host(p));
  assert.equal(mp.junctionPlaceAt(TOWN.px, TOWN.py), null, 'never found');
  discoverLocation(TOWN.mapId, {});
  assert.deepEqual(mp.junctionPlaceAt(TOWN.px, TOWN.py), { locationType: T.TownHamlet, mapId: TOWN.mapId, discovered: true });
  assert.deepEqual(p.stands, [], 'nothing stood for a dot');
  assert.equal(mp.junctionPlaceAt(500, 250), null, 'the Bay: its row\'s (none in this dictionary)');
  assert.match(hostText('src/scenes/world.js'), /locationAt: \(x, y\) => junctionPlaceAt\(x, y\),/);
});

// ── ON THE PLAYER'S DATA ──────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'TAMRIEL2.IMG', 'TMAP00I0.IMG'].every((f) => existsSync(join(ARENA2, f)));
let _world = null;
const standWorld = async () => (_world ??= await (await import('../systems/quest/r25World.mjs')).standWorldPastBay(ARENA2));
const mapPlacesOver = (world) => createMapPlaces(host({ index: world.locationIndex, pq: world.places.provinceQuestPlaces, worldPlaces: world.worldPlaces }));

test('BAY-LEFT-MAPS C3 on the player\'s data: a place found past the Bay, not standing, is the summary the build\'s location carries - an Arena town, a capital, a country hamlet: the same id, name, region and location; read, it stands as its pixel would build it (lane C\'s p5: 0.00 far plates a town past the Bay before)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const world = await standWorld();
  const pq = world.places.provinceQuestPlaces;
  pq.refresh();
  const { inBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { isCapitalPlaceId } = await import('../../src/world/capitalLane.js');
  const listed = world.worldPlaces.all().filter((r) => !inBay(r.px, r.py));
  const arena = listed.find((r) => !isCapitalPlaceId(r.mapId) && r.type === T.TownVillage && !world.locationIndex.has(`${r.px},${r.py}`));
  const capital = listed.find((r) => r.name === 'Solitude');
  const hamlet = pq.countryNear(1600, -400, 12, 1)[0];
  assert.ok(arena && capital && hamlet, 'an Arena village, Solitude and a hamlet of Skyrim');
  const mp = mapPlacesOver(world);
  for (const r of [arena, capital, hamlet]) {
    assert.equal(mp.tvPlaceSummary(r.px, r.py), null, `${r.name}: unfound`);
    discoverLocation(r.mapId, {});
    const s = mp.tvPlaceSummary(r.px, r.py);
    assert.equal(world.locationIndex.has(`${r.px},${r.py}`), false, `${r.name}: nothing stood to answer`);
    const want = { name: s.name, mapId: s.mapId, regionIndex: s.regionIndex, locationIndex: s.locationIndex, locationType: s.locationType };
    const loc = s.loc;
    assert.ok(loc && world.locationIndex.get(`${r.px},${r.py}`) === loc, `${r.name}: read, it stands`);
    assert.deepEqual(want, { name: loc.name, mapId: loc.mapTableData.mapId >>> 0, regionIndex: loc.regionIndex, locationIndex: loc.locationIndex, locationType: loc.mapTableData.locationType }, `${r.name}: the summary is the location's`);
  }
});

test('BAY-LEFT-MAPS C3 on the player\'s data: A BOOKED PASSAGE TO A PORT PAST THE BAY RESUMES AFTER A LOAD - the port found and the discoveries saved and restored, her master finds its summary and sails on; and it is on her masters\' lists (mutants: the index alone as before)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const world = await standWorld();
  world.places.provinceQuestPlaces.refresh();
  const { inBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { createPassageHost } = await import('../../src/scenes/naval/passageHost.js');
  const { PASSAGE_FIRST_S } = await import('../../src/systems/naval/passage.js');
  const port = world.worldPlaces.all().find((r) => r.port && !inBay(r.px, r.py) && !world.locationIndex.has(`${r.px},${r.py}`));
  assert.ok(port, 'a port past the Bay, not built');
  discoverLocation(port.mapId, {});
  const saved = JSON.parse(JSON.stringify(snapshotDiscovery()));
  restoreDiscovery(null);
  restoreDiscovery(saved);   // the load
  const mp = mapPlacesOver(world);
  const boat = { uid: 7, hull: 2, charter: { to: { name: port.name, px: port.px, py: port.py }, ship: 'The Fair Silk', captain: 'Ana', fare: 40 }, GameObject: { position: [0, 0, 0] }, Cargo: { Items: [] } };
  const rt = { AllBoats: [boat], state: { CurrentBoat: boat }, isSailing: () => true };
  const routed = [];
  const passage = createPassageHost({
    naval: () => ({ boatInPlay: () => null }), csa: () => rt, ports: () => [{ key: `${port.px},${port.py}`, name: port.name, px: port.px, py: port.py }],
    here: () => null, pixel: () => ({ x: 400, y: 200 }), ether: () => false, place: (p) => mp.tvPlaceSummary(p.px, p.py), canGo: () => true,
    travel: () => ({ isTravelActive: false }), route: (s) => { routed.push(s); return true; }, journeyTo: () => null, busy: () => false,
    standsOn: () => true, player: { feetAt: () => [0, 0, 0], transportMode: 'foot', spawn() {} }, talk: { say() {}, showOverlay() {} },
  });
  passage.frame(PASSAGE_FIRST_S + 0.1);
  assert.equal(routed.length, 1, 'her master sails on for the port');
  assert.deepEqual([routed[0].name, routed[0].mapId, routed[0].pixel], [port.name, port.mapId >>> 0, { x: port.px, y: port.py }]);
  // and her masters list it: a port found in an earlier session is known
  const { passageDestinations } = await import('../../src/systems/naval/passage.js');
  assert.deepEqual(passageDestinations([{ key: 'k', name: port.name, px: port.px, py: port.py }], { x: 400, y: 200 }, { known: (p) => !!mp.tvPlaceSummary(p.px, p.py) }).map((d) => d.port.name), [port.name]);
});

test('BAY-LEFT-MAPS C3 on the player\'s data: TV5 PAST THE BAY - about a village of Skyrim with its countryside laid and found, the edge marks its nearest found settlements, none stood, in a few milliseconds a pixel (lane C\'s p5: 0.00 before)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const world = await standWorld();
  const pq = world.places.provinceQuestPlaces;
  pq.refresh();
  const { farPlaces, TV_FAR_RANGE } = await import('../../src/systems/travel/travelFarPlaces.js');
  const { inBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const town = world.worldPlaces.all().filter((r) => !inBay(r.px, r.py) && r.region === 64 && r.type === T.TownVillage)[3];   // a village of Skyrim
  const at = { x: town.px, y: town.py };
  const country = pq.countryNear(at.x, at.y, TV_FAR_RANGE);
  addPastBayPlaces(country.map((r) => ({ x: r.px, y: r.py, type: r.type })));
  for (const r of country) discoverLocation(r.mapId, {});
  const before = world.locationIndex.size;
  const mp = mapPlacesOver(world);
  const t0 = performance.now();
  const list = farPlaces({ at, near: 3, settlements: mp.tvFarSettlements(at), summaryOf: mp.tvPlaceSummary });
  const ms = performance.now() - t0;
  const { TV_FAR_TYPES } = await import('../../src/systems/travel/travelFarPlaces.js');
  const inCircle = (x, y) => Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) > 3 && Math.hypot(x - at.x, y - at.y) <= TV_FAR_RANGE;
  const listedNear = world.worldPlaces.all().filter((r) => !inBay(r.px, r.py) && TV_FAR_TYPES.has(r.type) && inCircle(r.px, r.py) && (discoverLocation(r.mapId, {}), true));
  const want = country.filter((r) => TV_FAR_TYPES.has(r.type) && inCircle(r.px, r.py)).length + listedNear.length;
  assert.ok(want > 3, `settlements about (${want})`);
  assert.equal(farPlaces({ at, near: 3, settlements: mp.tvFarSettlements(at), summaryOf: mp.tvPlaceSummary }).length, Math.min(10, want), `the edge's found settlements in its circle (${country.length} country places about)`);
  assert.ok(list.every((f) => f.summary.mapId && f.summary.name), 'each a found place\'s summary');
  assert.equal(world.locationIndex.size, before, 'none stood');
  assert.ok(ms < 100, `a pixel's list in ${ms.toFixed(1)} ms`);
});
