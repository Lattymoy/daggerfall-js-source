// TESA12 (2026-10-13, the owner: "I want to make it where attaching the arena file isn't needed"; asked, "Canon +
// generated" and "Remove it"; bible/03-World/Arena-Provinces.md TESA12) - THE PLACES PAST THE BAY, THE PORT'S OWN, pinned.
// TAMRIEL1's lore cities on their points (snapped onto their province's land), each province's towns and villages made
// beside them on its land past the Bay and named by its people, the same on every client; the ink and the host on them;
// and nothing of Arena read - no reader, no card, the store a copy was attached to emptied once. No file ships: the pins
// lay synthetic traces; where ARENA2_PATH names the data they hold the model on the player's own trace.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  makeTamrielPlaces, provinceLand, snapToProvince, provinceCells, madePoint, madeName, PLACES_PER_PROVINCE, PLACE_PROVINCES,
  PLACE_COUNTS, TOWN_SLOT, VILLAGE_SLOT, PLACE_TRIES, SNAP_REACH, SNAP_INSET, BAY_MARGIN,
} from '../src/world/tamrielPlaces.js';
import { arenaPlaces, arenaPixels, arenaPlacesVersion, setArenaStanding } from '../src/world/arenaPlaces.js';
import { arenaPlaceId, arenaLocationIndex } from '../src/world/arenaLocations.js';
import { CITIES } from '../src/world/tamriel/tamrielGeography.js';
import { setTamrielTrace, PROVINCE_OF_ID } from '../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayPictureRect, pictureToBay, inBay } from '../src/world/tamriel/tamrielFrame.js';
import { countryName } from '../src/world/tamrielCountry.js';
import { provinceNameBank } from '../src/world/tamrielPeople.js';
import { hash32 } from '../src/world/spawnedDungeons.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { buildTamrielInk, tamrielPlaceAt, ARENA_KIND_WORDS, ARENA_KIND_GLYPHS } from '../src/ui/tamrielInk.js';
import { arenaPlacesOn } from '../src/scenes/shared.js';
import * as dataSource from '../src/scenes/dataSource.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); setArenaStanding(false); });

/** A 320 x 200 trace of rectangles: [id, x0, y0, x1, y1] (exclusive ends), the picker's ids (1 High Rock, 3 Skyrim). */
function rectTrace(rects) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  return { w, h, land, province };
}
/** The Bay at picture (40, 50), ten Bay pixels a picture pixel: its rectangle picture x 40..140, y 50..100. */
const FIT = { ox: 400, oy: 500, ppu: 10 };
/** Skyrim's land below TAMRIEL1's north coast (its points at y 22 to 26 lie off it), High Rock's straddling the Bay. */
const SKYRIM_LAND = [3, 110, 30, 210, 80], HIGH_ROCK_LAND = [1, 30, 30, 110, 90];

test('TESA12 the cities: TAMRIEL1\'s own, a province\'s from slot 0 in TAMRIEL1\'s order - on its point where that is its province\'s land, else the nearest of it within SNAP_REACH, SNAP_INSET inside, else lost; a port where TAMRIEL1 sets it on the sea (mutant: the reach, the inset, the order, the port flag)', () => {
  assert.deepEqual([SNAP_REACH, SNAP_INSET], [24, 0.1]);
  setTamrielFit(FIT);
  const trace = rectTrace([SKYRIM_LAND]);
  const { places, lost } = makeTamrielPlaces(trace);
  const cities = places.filter((p) => p.kind === 'city-state');
  const lore = CITIES.filter((c) => c.province === 'Skyrim');
  assert.deepEqual(cities.map((p) => [p.name, p.id, p.provinceIndex]), lore.map((c, i) => [c.name, i, 2]), 'every one of Skyrim\'s, in order, Skyrim the lane\'s third');
  for (const p of cities) {
    const c = lore.find((q) => q.name === p.name);
    if (c.at[1] >= 30) { assert.deepEqual([p.px, p.py, p.snapped], [c.at[0], c.at[1], 0], `${p.name} on its point`); continue; }
    assert.ok(Math.abs(p.py - 30.1) < 1e-9 && Math.abs(p.px - c.at[0]) <= 0.1 + 1e-9, `${p.name} south onto the coast, SNAP_INSET inside its pixel`);
    assert.ok(Math.abs(p.snapped - Math.hypot(p.px - c.at[0], p.py - c.at[1])) < 1e-9);
  }
  assert.deepEqual(cities.filter((p) => p.port).map((p) => p.name), lore.filter((c) => c.port).map((c) => c.name));
  assert.deepEqual(cities.filter((p) => p.port).map((p) => p.name), ['Solitude', 'Windhelm', 'Winterhold', 'Dawnstar'], 'the lore\'s ports of the Sea of Ghosts');
  assert.deepEqual(lost.map((p) => p.province).filter((k) => k === 'Skyrim'), []);
  // the reach: Skyrim's land 30 below its points - the north coast's cities lost, the inland stand
  const far = makeTamrielPlaces(rectTrace([[3, 110, 50, 210, 80]]));
  assert.deepEqual(far.lost.filter((p) => p.province === 'Skyrim').map((p) => p.name), ['Solitude', 'Windhelm', 'Winterhold', 'Dawnstar'], 'past SNAP_REACH (24) from y 22 to 26');
  assert.ok(far.places.some((p) => p.name === 'Morthal' && p.py === 50.1), 'y 36: 14 off, within it');
  // the snap itself
  const own = provinceLand(trace, 'Skyrim');
  assert.deepEqual(snapToProvince(150, 40, own), { x: 150, y: 40, d: 0 });
  assert.equal(snapToProvince(150, 5, own), null, '25 off');
  assert.equal(snapToProvince(150, 6, own), null, '24.1 off: past the reach');
  assert.ok(Math.abs(snapToProvince(150, 6.2, own).y - 30.1) < 1e-9, '23.9 off: within it');
  assert.ok(Math.abs(snapToProvince(105, 40, own).x - 110.1) < 1e-9, 'west onto the land, SNAP_INSET inside');
  assert.equal(provinceLand(trace, 'HighRock')(150, 40), false, 'another province\'s land is not its own');
});

test('TESA12 the made places: PLACE_COUNTS a province - towns from TOWN_SLOT, villages from VILLAGE_SLOT - each on a cell of its province\'s land outside the Bay\'s rectangle and BAY_MARGIN, the farthest of PLACE_TRIES draws from every place before it, named by its province\'s people with no name twice; none with no land; the same every time (mutant: a count, a slot, the margin, the best-of, the name\'s frame, the uniqueness)', () => {
  assert.deepEqual([PLACE_COUNTS, TOWN_SLOT, VILLAGE_SLOT, PLACE_TRIES, BAY_MARGIN, PLACES_PER_PROVINCE], [{ town: 8, village: 16 }, 16, 24, 24, 1, 48]);
  setTamrielFit(FIT);
  const bay = bayPictureRect();
  assert.deepEqual(bay, { x0: 40, y0: 50, x1: 140, y1: 100 });
  const trace = rectTrace([SKYRIM_LAND, HIGH_ROCK_LAND]);
  const model = makeTamrielPlaces(trace);
  for (const key of ['Skyrim', 'HighRock']) {
    const made = model.places.filter((p) => p.province === key && p.kind !== 'city-state');
    assert.deepEqual(made.map((p) => [p.kind, p.id]), [
      ...Array.from({ length: 8 }, (_, i) => ['town', 16 + i]), ...Array.from({ length: 16 }, (_, i) => ['village', 24 + i]),
    ], `${key}: eight towns, sixteen villages, in their slots`);
    for (const p of made) {
      assert.ok(provinceLand(trace, key)(p.px, p.py), `${p.name} on ${key}'s land`);
      const cx = Math.floor(p.px), cy = Math.floor(p.py);
      assert.ok(!(cx + 1 > bay.x0 - 1 && cx < bay.x1 + 1 && cy + 1 > bay.y0 - 1 && cy < bay.y1 + 1), `${p.name} off the Bay and its margin (${cx}, ${cy})`);
      assert.ok(p.px - cx >= 0.25 && p.px - cx < 0.75 && p.py - cy >= 0.25 && p.py - cy < 0.75, 'a quarter in from its cell\'s edges');
    }
  }
  // High Rock's cells: its land less the Bay's rectangle and the margin round it
  const hr = model.provinces.find((p) => p.key === 'HighRock');
  assert.equal(hr.cells, 80 * 60 - (110 - 39) * (90 - 49));
  assert.deepEqual(provinceCells(provinceLand(trace, 'HighRock'), bay).length, hr.cells);
  // the names: the province's bank in a hamlet's or a village's frame, none twice, none a city's
  const names = model.places.map((p) => p.name);
  assert.equal(new Set(names).size, names.length, 'no name twice');
  const t = model.places.find((p) => p.province === 'Skyrim' && p.id === 16);
  assert.equal(t.name, countryName(LOCATION_TYPES.TownHamlet, provinceNameBank('Skyrim'), hash32(0x7a12, 2, 16, 100)), 'the first draw, where none had it');
  assert.equal(madeName(LOCATION_TYPES.TownHamlet, provinceNameBank('Skyrim'), 2, 16, new Set()), t.name);
  const every = { has: () => true };
  assert.equal(madeName(LOCATION_TYPES.TownHamlet, provinceNameBank('Skyrim'), 2, 16, /** @type {any} */ (every)), '', 'eight draws all taken: none');
  // the best of the draws: with nothing taken the first; never nearer than the first to what is taken
  const cells = provinceCells(provinceLand(trace, 'Skyrim'), bay);
  const first = madePoint(cells, [], 2, 16);
  const [fx, fy] = cells[hash32(0x7a12, 2, 16, 0) % cells.length];
  assert.ok(Math.floor(first.x) === fx && Math.floor(first.y) === fy, 'nothing taken: the first draw');
  const taken = [{ px: first.x, py: first.y }];
  const next = madePoint(cells, taken, 2, 16);
  assert.ok(Math.hypot(next.x - first.x, next.y - first.y) > 0, 'one taken: another point, farther than the first draw (0 from it)');
  assert.equal(madePoint([], [], 2, 16), null);
  // spread: 33 places on Skyrim's 100 x 50 - no two nearer than three picture pixels (45 km)
  const sk = model.places.filter((p) => p.province === 'Skyrim');
  let near = Infinity;
  for (let i = 0; i < sk.length; i++) for (let j = 0; j < i; j++) near = Math.min(near, Math.hypot(sk[i].px - sk[j].px, sk[i].py - sk[j].py));
  assert.ok(near >= 3, `the nearest two ${near.toFixed(2)} apart`);
  // no land, no places; the same trace, the same places
  assert.deepEqual(makeTamrielPlaces(rectTrace([SKYRIM_LAND])).places.filter((p) => p.province === 'Morrowind'), []);
  assert.deepEqual(makeTamrielPlaces(trace), model);
  assert.deepEqual(makeTamrielPlaces(null), { provinces: [], places: [], lost: [] });
});

test('TESA12 the lane: the provinces in the picker\'s order with the Imperial Province ninth, every place\'s slot inside its province\'s 48 and its id and index its own - no province\'s cities past its towns\' first slot (mutant: the order, the slots)', () => {
  assert.deepEqual(PLACE_PROVINCES, Array.from({ length: 9 }, (_, p) => PROVINCE_OF_ID[p + 1]));
  for (const key of PLACE_PROVINCES) assert.ok(CITIES.filter((c) => c.province === key).length <= TOWN_SLOT, key);
  setTamrielFit(FIT);
  const model = makeTamrielPlaces(rectTrace([SKYRIM_LAND, HIGH_ROCK_LAND, [9, 150, 90, 230, 150], [4, 220, 30, 290, 90]]));
  const ids = new Set(model.places.map(arenaPlaceId)), idx = new Set(model.places.map(arenaLocationIndex));
  assert.deepEqual([ids.size, idx.size], [model.places.length, model.places.length]);
  assert.ok(model.places.every((p) => p.id >= 0 && p.id < PLACES_PER_PROVINCE && p.provinceIndex === PLACE_PROVINCES.indexOf(p.province)));
  assert.deepEqual(model.provinces.map((p) => [p.index, p.key]), PLACE_PROVINCES.map((k, i) => [i, k]));
});

test('TESA12 the installed set: none without a trace; one model a trace and a fit, made again when either moves, its pixels with it; the standing switch moves the version once a change (mutant: the trace gate, the land key, the fit key)', () => {
  setTamrielFit(FIT);
  assert.equal(arenaPlaces(), null);
  assert.equal(arenaPixels(), null);
  setTamrielTrace(rectTrace([SKYRIM_LAND]));
  const a = arenaPlaces(), pa = arenaPixels();
  assert.ok(a.places.length > 0);
  assert.equal(arenaPlaces(), a, 'once a trace');
  assert.equal(arenaPixels(), pa, 'and its pixels once');
  assert.ok(pa.stood.length > 0 && pa.stood.every((p) => !inBay(p.bx, p.by)));
  setTamrielTrace(rectTrace([SKYRIM_LAND]));
  assert.notEqual(arenaPlaces(), a, 'a new trace, a new model');
  const b = arenaPlaces();
  setTamrielFit({ ...FIT, ox: FIT.ox + 10 });
  assert.notEqual(arenaPlaces(), b, 'a new fit, a new model (the Bay\'s rectangle moved)');
  const v = arenaPlacesVersion();
  setArenaStanding(true); setArenaStanding(true);
  assert.equal(arenaPlacesVersion(), v + 1);
});

test('TESA12 the ink: on the trace the continent\'s cities are the places past the Bay - a capital where TAMRIEL1 names one, each its kind\'s glyph and word; off it TAMRIEL1\'s cities as ever (mutant: the kinds\' words, the glyphs, the Bay test)', () => {
  assert.deepEqual(ARENA_KIND_WORDS, { 'city-state': 'city-state', town: 'town', village: 'village' });
  // PIN MOVED (REGION-LINES, 2026-10-25, the owner: "daggerfall's clustered icons need to be fixed amd standardized across tamriel"): one glyph a kind - a city-state the Bay's city, a town its hamlet
  assert.deepEqual(ARENA_KIND_GLYPHS, { 'city-state': 'city', town: 'hamlet', village: 'village' });
  const authored = buildTamrielInk();
  assert.equal(authored.arena, false);
  assert.ok(authored.cities.every((c) => c.kind === null));
  setTamrielFit(FIT);
  setTamrielTrace(rectTrace([SKYRIM_LAND, HIGH_ROCK_LAND]));
  const ink = buildTamrielInk();
  assert.equal(ink.arena, true);
  const model = arenaPlaces();
  const off = model.places.filter((p) => !inBay(...pictureToBay(p.px, p.py)));
  assert.deepEqual(ink.cities.map((c) => [c.province, c.name, c.kind]), off.map((p) => [p.province, p.name, p.kind]));
  assert.deepEqual(ink.cities.filter((c) => c.capital).map((c) => c.name), ['Solitude'], 'TAMRIEL1\'s capital of Skyrim');
  const town = ink.cities.find((c) => c.kind === 'town');
  assert.equal(tamrielPlaceAt(town.x, town.y, { ox: 0, oy: 0, scale: 1 }, ink), `${town.province === 'Skyrim' ? 'Skyrim' : 'High Rock'} : ${town.name} (town)`);   // PIN MOVED (AUDIT TAMRIEL-WIDE D3): the land past the Bay is the world's, named by its province and place alone
});

test('TESA12 no Arena: no reader, no card, no store read - the boot empties the store a copy was attached to, once and quietly; the places stand online whatever the door says; a town past the Bay is named on the wire (mutant: the clear, the door, the wire)', async () => {
  for (const f of ['src/formats/arenaCityData.js', 'src/formats/arenaExe.js']) assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, f);
  for (const name of ['registerArenaData', 'pickArenaFolder', 'clearStoredArena', 'storeArenaFiles', 'loadArenaFile', 'ARENA_FILES']) assert.equal(name in dataSource, false, name);
  await dataSource.clearRetiredArena();   // node has no IndexedDB: nothing to clear, nothing thrown
  const ds = read('src/scenes/dataSource.js');
  assert.match(ds, /const ASSET_STORES = \[MUSIC_STORE, TEXTURE_STORE, MW_STORE, DERIVED_STORE, ARENA_STORE\];/, 'a wipe still sweeps it');
  assert.match(ds, /indexedDB\.open\(DB_NAME, 6\);/, 'the schema as it was - its arms are additive');
  assert.match(ds, /export async function clearRetiredArena\(\) \{\n\s+try \{ await clearAssets\(ARENA_STORE\); \} catch \{/);
  const w = hostText('src/scenes/world.js');
  assert.equal(w.match(/clearRetiredArena\(\);/g)?.length, 1, 'the boot asks it once');
  assert.ok(w.indexOf('  clearRetiredArena();') < w.indexOf('preloadTamrielTrace({ fetchBytes, palette })'));
  for (const gone of ['registerArenaData', 'setArenaCityData', 'setArenaRoom', 'arenaBeyondNotice', 'ARENA_PLACES_TEXT', 'arenaReady']) assert.equal(w.includes(gone), false, gone);
  assert.match(w, /const arenaStands = tamrielLand && arenaPlacesOn\(\);\n\s+setArenaStanding\(arenaStands\);/);
  assert.match(w, /arenaWarm\(\);   \/\/ TESA1: the places onto the trace that just landed/);
  assert.match(w, /loc: ident\?\.kind === 'dungeon' \? \(ident\.name \?\? ''\) : \(loc\?\.name \?\? ''\),/, 'AUDIT-TESA A1-1\'s guard lifted: the name is every client\'s');
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  for (const gone of ['arenaCard', 'ARENA_CARD_LINE', 'arenaDataAttached', 'card:arena']) assert.equal(menu.includes(gone), false, gone);
  assert.match(read('src/ui/settings/settingsMap.js'), /'card:morrowind', 'card:packs'\]\),/);
  assert.deepEqual([arenaPlacesOn(''), arenaPlacesOn('?arenaplaces=off'), arenaPlacesOn('?arenaplaces=off&online=1')], [true, false, true], 'offline alone, as the countryside\'s door');
  const places = read('src/world/arenaPlaces.js');
  assert.doesNotMatch(places, /ARENA_CITYDATA_PRINTS|ARENA_COASTAL_PRINTS|setArenaCityData|setArenaCoastal|setArenaRoom|_online|arenaGlobalCityId/);
});

// ── THE PLAYER'S OWN FILES ─────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));

test('TESA12 with ARENA2: on the player\'s own trace every one of TAMRIEL1\'s 67 cities stands (none lost, Thorn the farthest snapped), and every province has its eight towns and sixteen villages - 283 places, 35 of them ports (Anvil and Leyawiin inland on this picture)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const m = arenaPlaces();
  assert.equal(CITIES.length, 67);
  assert.deepEqual(m.lost, []);
  const far = m.places.filter((p) => p.kind === 'city-state').sort((a, b) => b.snapped - a.snapped)[0];
  assert.equal(far.name, 'Thorn');
  for (const key of PLACE_PROVINCES) {
    const mine = m.places.filter((p) => p.province === key);
    assert.deepEqual([mine.filter((p) => p.kind === 'town').length, mine.filter((p) => p.kind === 'village').length], [8, 16], key);
  }
  const px = arenaPixels();
  assert.deepEqual([m.places.length, px.stood.length, px.unstood.length, px.stood.filter((p) => p.port).length], [283, 283, 0, 35]);   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): 28, and the seven places the sea bears on
  assert.deepEqual(px.stood.filter((p) => !p.port && CITIES.some((c) => c.port && c.name === p.name)).map((p) => p.name), ['Anvil', 'Leyawiin'], 'no shore within SHORE_REACH: no port');
});
