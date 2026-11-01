// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" B1; bible/06-Systems/Legacy-Arc.md BAY-LEFT-B):
// PROJECT LEGACY'S HEIR PAST THE BAY. A birth whose family seat is past the Bay booted `?region=Skyrim&loc=Solitude`, the
// named start read MAPS.BSA alone, and the page never booted ("location not found"). The start is booted the way a save
// made past the Bay loads (scenes/bootStartHost.js): the world stands on the Bay, and once the land has its trace and the
// world stands, the player is moved to the seat by its kept map id (`seat`) or its names - before the heir is made.
// A house with no seat bears its heir in the WORLD's nearest town (systems/legacy/places.js nearestTownAnywhere).
// The ARENA2 halves stand the world past the Bay over the freeware (test/systems/quest/r25World.mjs).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBootStart, farStartOf, farPixelOf, BAY_DEFAULT_START } from '../../../src/scenes/bootStartHost.js';
import { STARTS_TEXT } from '../../../src/scenes/startsHost.js';
import { birthSearch, loadSearch, nearestTownAnywhere } from '../../../src/systems/legacy/places.js';
import { countryPixelOfId, countryPlaceId, countryOrdinal, LAIR_LANE } from '../../../src/world/tamrielCountry.js';
import { etherPlaceId, etherPlacePixelOfId, PLACE_KINDS } from '../../../src/world/etherPlaces.js';
import { veilhaven, isleOfCell, CELLS_W } from '../../../src/world/ethericSea.js';
import { capitalPlaceId } from '../../../src/world/tamrielCapitals.js';
import { nearestSafePlace } from '../../../src/systems/deathRespawn.js';
import { longitudeLatitudeToMapPixel, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { REPOSITION } from '../../../src/systems/ship.js';
import { BOOT_DOOR_KEYS } from '../../../src/systems/online/onlineLane.js';
import { hostText } from '../../hostText.mjs';   // PIN MOVED (HOST-SPLIT TEST-PRESET): the world host whole

const ARENA2 = process.env.ARENA2_PATH;
const NO_DATA = ARENA2 ? false : 'ARENA2_PATH unset (sh tools/fetch-data.sh)';
const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const SOLITUDE = Object.freeze({ id: capitalPlaceId(1, 0), x: 1569, y: -430 });

/** The world past the Bay as the build stands it, once a suite (the places, the registry, the Bay's index by pixel). */
let _world = null;
async function world() {
  if (_world) return _world;
  const { standWorldPastBay } = await import('../../systems/quest/r25World.mjs');
  const w = await standWorldPastBay(ARENA2);
  const index = new Map();
  for (const l of w.rows) { const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude); if (!index.has(`${p.x},${p.y}`)) index.set(`${p.x},${p.y}`, l); }
  _world = { ...w, index };
  return _world;
}
/** The boot's start over the world, as world.js constructs it - its teleport, its word and its readiness recorded. */
async function boot(search, { ready = () => true } = {}) {
  const w = await world();
  const params = new URLSearchParams(search);
  const moves = [], said = [];
  let asked = 0;
  const start = createBootStart({
    params, locationIndex: w.index, maps: w.maps, worldPlaces: w.worldPlaces,
    regionName: params.get('region') || 'Daggerfall', locationName: params.get('loc') || 'Daggerfall',
    _teleportToPixel: async (x, y, local, opts) => { moves.push([x, y, local, opts, asked]); },
    _worldReady: () => ready(++asked), arenaTraced: Promise.resolve(), townTalk: { say: (line) => said.push(line) },
  });
  return { ...start, at: await start.farStart, moves: moves.map((m) => m.slice(0, 4)), askedAtMove: moves.map((m) => m[4]), said };
}

test('BAY-LEFT-B B1: a birth at a seat past the Bay boots - the world stands at the Bay\'s town nearest the seat, and the player is moved to Solitude by its kept map id before the heir is made (mutants: the guard; the move; the id\'s arm; the reposition)', { skip: NO_DATA }, async () => {
  const b = await boot(`?world=1&legacyborn=4&region=Skyrim&loc=Solitude&seat=${SOLITUDE.id}`);
  assert.equal(b.startLoc.name, 'Charencester Garden', 'the Bay\'s town nearest the seat, where the world stands while the land comes');
  assert.deepEqual(b.at, { x: SOLITUDE.x, y: SOLITUDE.y });
  assert.deepEqual(b.moves, [[SOLITUDE.x, SOLITUDE.y, null, { reposition: REPOSITION.RandomStartMarker }]]);
  assert.deepEqual(b.said, []);
  const loc = (await world()).places.provinceQuestPlaces.standAt(b.at.x, b.at.y);
  assert.equal(loc?.name, 'Solitude', 'the place standing there');
  assert.equal(loc?.mapTableData?.mapId >>> 0, SOLITUDE.id);
  // by its id alone: a seat whose names the place no longer answers (its quest name, a renamed place) is still its id's
  const byId = await boot(`?world=1&legacyborn=4&region=Skyrim&loc=Elsewhere&seat=${SOLITUDE.id}`);
  assert.deepEqual(byId.at, { x: SOLITUDE.x, y: SOLITUDE.y });
});

test('BAY-LEFT-B B1: any boot that names a start past the Bay by its names alone reaches it (`?region=Skyrim&loc=Solitude`, no seat id - a seat noted before it knew its id, a dev boot) (mutants: the name\'s arm; the province\'s test)', { skip: NO_DATA }, async () => {
  const b = await boot('?world=1&region=Skyrim&loc=Solitude');
  assert.deepEqual(b.at, { x: SOLITUDE.x, y: SOLITUDE.y });
  assert.equal(b.moves.length, 1);
});

test('BAY-LEFT-B B1: the Bay\'s starts are as they were - a Bay town stands with no move, a Bay name MAPS.BSA lacks still throws, a load\'s place is the save\'s, and a seat no way reaches is said and born where the world stood (mutants: the Bay\'s lookup first; the load\'s skip; the word)', { skip: NO_DATA }, async () => {
  const bay = await boot('?world=1&legacyborn=4&region=Daggerfall&loc=Daggerfall&seat=7');
  assert.equal(bay.startLoc.name, 'Daggerfall');
  assert.equal(bay.at, null);
  assert.deepEqual(bay.moves, []);
  await assert.rejects(boot('?world=1&region=Daggerfall&loc=Nowhere At All'), /location not found: Daggerfall\/Nowhere At All/);
  const load = await boot('?world=1&load=1&region=Skyrim&loc=Solitude');
  assert.equal(load.at, null);
  assert.deepEqual(load.moves, [], 'a load teleports to its save');
  const lost = await boot('?world=1&legacyborn=4&region=Skyrim&loc=Nowhere At All');
  assert.equal(lost.startLoc.name, BAY_DEFAULT_START.loc, 'no pixel known: the boot\'s default');
  assert.equal(lost.at, null);
  assert.deepEqual(lost.moves, []);
  assert.deepEqual(lost.said, [STARTS_TEXT.noSite]);
  // never before the boot's world stands: asked until it does (the third ask here), then moved
  const late = await boot(`?world=1&legacyborn=4&region=Skyrim&loc=Solitude&seat=${SOLITUDE.id}`, { ready: (n) => n >= 3 });
  assert.equal(late.moves.length, 1);
  assert.ok(late.askedAtMove[0] >= 3, `moved once the world stood (asked ${late.askedAtMove[0]} times)`);
});

test('BAY-LEFT-B B1: farStartOf - a start past the Bay is a kept map id or a province\'s region; farPixelOf reads an id as the registry, the countryside or an isle stands it (mutants: the seat\'s parse; the province test; the country arm\'s check)', () => {
  assert.deepEqual(farStartOf(new URLSearchParams('seat=12'), 'Daggerfall', 'X'), { id: 12, region: 'Daggerfall', loc: 'X' });
  assert.deepEqual(farStartOf(new URLSearchParams(''), 'Skyrim', 'Solitude'), { id: null, region: 'Skyrim', loc: 'Solitude' });
  assert.equal(farStartOf(new URLSearchParams('seat=x'), 'Daggerfall', 'X'), null);
  assert.equal(farStartOf(new URLSearchParams(''), 'Daggerfall', 'X'), null);
  const id = countryPlaceId(countryOrdinal(1700, -398));
  const places = (at) => ({ byMapId: () => null, all: () => [], at: (x, y) => (x === 1700 && y === -398 && at ? { mapId: id } : null) });
  assert.deepEqual(farPixelOf({ id, region: 'Skyrim', loc: 'Riverwood' }, places(true)), { x: 1700, y: -398 });
  assert.equal(farPixelOf({ id, region: 'Skyrim', loc: 'Riverwood' }, places(false)), null, 'a pixel the countryside stands no place on is no seat');
  const haven = veilhaven();
  assert.deepEqual(farPixelOf({ id: etherPlaceId(haven), region: 'Betony', loc: haven.name }, places(false)), { x: haven.px, y: haven.py });
});

test('BAY-LEFT-B B1: countryPixelOfId reads a country place\'s map id back to its pixel (countryPlaceId x countryOrdinal\'s inverse), and no other lane; etherPlacePixelOfId an isle\'s to its centre (mutants: the lane bound; the grid\'s width; the cell\'s row)', () => {
  for (const [x, y] of [[1700, -398], [-862, -975], [5137, 2774], [0, 0], [-1024, -1024], [7167, 3071]]) assert.deepEqual(countryPixelOfId(countryPlaceId(countryOrdinal(x, y))), { x, y });
  assert.equal(countryPixelOfId(capitalPlaceId(1, 0)), null, 'a capital\'s');
  assert.equal(countryPixelOfId(((LAIR_LANE << 20) | 0x80000 | 5) >>> 0), null, 'a lair\'s');
  assert.equal(countryPixelOfId(7707), null, 'a Bay place\'s');
  let n = 0;
  for (let cy = 0; cy < 40 && n < 8; cy++) for (let cx = 0; cx < CELLS_W && n < 8; cx += 37) {
    const isle = isleOfCell(cx, cy);
    if (!isle || !PLACE_KINDS.includes(isle.kind)) continue;
    assert.deepEqual(etherPlacePixelOfId(etherPlaceId(isle)), { x: isle.px, y: isle.py });
    n++;
  }
  assert.equal(n, 8);
  assert.equal(etherPlacePixelOfId(7707), null);
});

test('BAY-LEFT-B B1: a house with no seat bears its heir in the WORLD\'s nearest town - past the Bay a town of the province, its map id the birth\'s seat; on the Bay the Bay\'s town as before (mutants: the town\'s kind - a temple nearer; the name\'s test; the map id)', { skip: NO_DATA }, async () => {
  const w = await world();
  const nearestOf = (px, accept) => nearestSafePlace([w.worldPlaces.all()], px, accept);
  const far = nearestTownAnywhere(nearestOf, REGION_NAMES, { x: 1571, y: -428 });
  assert.deepEqual(far, { region: 'Skyrim', loc: 'Solitude', pixel: { x: SOLITUDE.x, y: SOLITUDE.y }, mapId: SOLITUDE.id });
  // the Bay: the nearest town of MAPS.BSA's rows, as the 62 regions' walk found it (a sea pixel off Daggerfall's coast)
  const bay = nearestTownAnywhere(nearestOf, REGION_NAMES, { x: 205, y: 210 });
  let best = null, bestD = Infinity;
  for (const l of w.rows) {
    if (![0, 1, 2].includes(l.mapTableData.locationType)) continue;
    const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude), d = (p.x - 205) ** 2 + (p.y - 210) ** 2;
    if (d < bestD) { bestD = d; best = { region: REGION_NAMES[l.regionIndex], loc: l.name, pixel: p }; }
  }
  assert.deepEqual({ region: bay.region, loc: bay.loc, pixel: bay.pixel }, best);
  // a town alone: asked on a Bay temple's own pixel (the nearest safe place a temple, named), the heir's town is the
  // nearest TOWN - never the temple, nor a graveyard
  const temple = w.rows.find((l) => l.mapTableData.locationType === LOCATION_TYPES.ReligionTemple && l.name);
  const tp = longitudeLatitudeToMapPixel(temple.mapTableData.longitude, temple.mapTableData.latitude);
  assert.equal(nearestOf(tp, null)?.kind, 'temple', 'the nearest safe place there is the temple');
  let town = null, townD = Infinity;
  for (const l of w.rows) {
    if (![0, 1, 2].includes(l.mapTableData.locationType)) continue;
    const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude), d = (p.x - tp.x) ** 2 + (p.y - tp.y) ** 2;
    if (d < townD) { townD = d; town = { region: REGION_NAMES[l.regionIndex], loc: l.name, pixel: p }; }
  }
  const atTemple = nearestTownAnywhere(nearestOf, REGION_NAMES, tp);
  assert.deepEqual({ region: atTemple.region, loc: atTemple.loc, pixel: atTemple.pixel }, town);
  assert.notEqual(atTemple.loc, temple.name);
  assert.equal(nearestTownAnywhere(() => null, REGION_NAMES, { x: 1, y: 1 }), null);
  assert.equal(nearestTownAnywhere(nearestOf, REGION_NAMES, null), null);
});

test('BAY-LEFT-B B1: the birth\'s address carries the seat\'s map id (`seat`) where the place knows it, and a load\'s address drops it; the front door decides it as a door key (mutants: the seat set; the load\'s drop; the key)', () => {
  assert.equal(birthSearch('?world&seat=9', 4, { region: 'Skyrim', loc: 'Solitude', mapId: SOLITUDE.id }), `?world=1&legacyborn=4&region=Skyrim&loc=Solitude&seat=${SOLITUDE.id}`);
  assert.equal(birthSearch('?world&seat=9', 4, { region: 'Daggerfall', loc: 'Ashbury' }), '?world=1&legacyborn=4&region=Daggerfall&loc=Ashbury', 'a place with no id names none, and a stale one goes');
  assert.equal(loadSearch(`?world&legacyborn=4&region=Skyrim&loc=Solitude&seat=${SOLITUDE.id}`, 3), '?world=1&classic=1&load=1&loadkey=3');
  assert.ok(BOOT_DOOR_KEYS.includes('seat'));
});

test('BAY-LEFT-B B1: the world host wires it - the start\'s module with its move\'s doors, the birth waiting on the move, and the seatless birth\'s nearest town the world\'s (mutants: the birth\'s wait; the nearest\'s law)', () => {
  const W = hostText('src/scenes/world.js');
  // PIN MOVED (AUDIT BAY-LEFT, its packages merged): world.js hands over its own bindings - the settled ones by value, its
  // readiness among them (`_worldReady`, the homes' sweep's and START2's too), the two declared below as getters
  // (test/tooling/hostseam.test.js)
  assert.match(W, /const \{ startLoc, farStart \} = createBootStart\(\{ locationIndex, locationName, maps, params, regionName, _teleportToPixel, worldPlaces, _worldReady,\n\s+get arenaTraced\(\) \{ return arenaTraced; \}, get townTalk\(\) \{ return townTalk; \} \}\);/);
  assert.match(W, /const _worldReady = \(\) => playerSpawned && _bootLoaded && !_loading;/);
  assert.match(W, /Promise\.all\(\[createChargenFlow\(fetchBytes\), legacyReady, farStart\]\)\.then\(/);
  assert.match(W, /return nearestTown\(maps\.getRegion\(h\.regionIndex\), h\.region, h\.pixel\) \?\? nearestTownAnywhere\(nearestTownOf, REGION_NAMES, h\.pixel\);/);
  const P = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(P, /px: l\.country\.px, py: l\.country\.py, name: l\.name, region: l\.regionIndex, mapId: l\.mapTableData\?\.mapId \}\);/, 'a country town named, as the registry\'s are');
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /_pickedLegacyBirth = \{ personId: took\.heirId, region: took\.place\.region, loc: took\.place\.loc, \.\.\.\(Number\.isInteger\(took\.place\.mapId\) \? \{ mapId: took\.place\.mapId \} : \{\}\) \};/, 'the Online page\'s pick carries the seat\'s id');   // PIN MOVED (the fourth merge of main into #1184): main's RPT1026-MISC HEIR-WAITS names the heir the take minted
});
