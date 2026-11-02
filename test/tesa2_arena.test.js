// TESA2 (2026-10-12, the owner: "Continue building"; bible/03-World/Arena-Provinces.md TESA2) - THE PLACES PAST THE BAY
// STAND, pinned (TESA12: the port's own - world/tamrielPlaces.js - where TESA2 stood Arena's). Each named place beyond the
// Bay on a Bay pixel of its own province's land; on that pixel, as it builds, a non-mutating clone of one of Daggerfall's
// own places - a city, a hamlet or a village by the place's kind - under its own name, an id in a lane of its own and an
// index of its own; a save made in one loads into it; a pixel built before the places stood built again; no house sold,
// no spawn cloned from one; and the held map's press on a place the world stands is a portal's end there. No file ships:
// the pins lay synthetic traces and mint rows; where ARENA2_PATH names the data they hold the pixels and the templates on
// the real files.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  standArenaPixels, arenaPixels, arenaPlaceOnPixel, setArenaStanding, arenaStanding,
  arenaPlacesVersion, PIXEL_REACH,
} from '../src/world/arenaPlaces.js';
import {
  arenaPlaceId, isArenaPlaceId, arenaLocationIndex, arenaTemplates, arenaTemplateOf, synthesizeArenaLocation,
  ARENA_PLACE_SALT, ARENA_PLACE_BASE, ARENA_INDEX_BASE, ARENA_TEMPLATE_KINDS, ARENA_LOAD_WAIT_MS,
} from '../src/world/arenaLocations.js';
import { etherPlaceId, etherLocationIndex } from '../src/world/etherPlaces.js';
import { CELLS_W, CELLS_H } from '../src/world/ethericSea.js';
import { spawnedMapId, spawnTemplates, hash32 } from '../src/world/spawnedDungeons.js';
import { setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay } from '../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { buildTamrielInk, arenaInkCities, tamrielCityAt, CITY_HIT_PX } from '../src/ui/tamrielInk.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); setArenaStanding(false); });

function rectTrace(rects) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  return { w, h, land, province };
}
/** A model's place by hand: the province, slot, kind and name, and its point on the picture. */
const at = (province, provinceIndex, id, kind, name, px, py) => ({ province, provinceIndex, id, kind, name, px, py, snapped: 0 });
/** A picture point for a Bay pixel's centre under a fit of 10 Bay pixels a picture pixel, the Bay at picture (40, 50). */
const FIT = { ox: 400, oy: 500, ppu: 10 };
const pic = (bx, by) => [(bx + 0.5 + FIT.ox) / FIT.ppu, (by + 0.5 + FIT.oy) / FIT.ppu];

test('TESA2 the pixel a place stands on: the Bay pixel under its point where that pixel\'s centre is its own province\'s land and no place before it stood; else the nearest such within PIXEL_REACH, ring by ring; else none - and the Bay\'s own ground, and a nameless dungeon, stand none (mutant: the centre, the ring, the taken test, the Bay)', () => {
  assert.equal(PIXEL_REACH, 3);
  setTamrielFit(FIT);
  // Skyrim's land is picture x 110..210, y 20..50: Bay pixels x 700..1699, y -300..-1 (the Bay at 0..999, 0..499)
  const trace = rectTrace([[3, 110, 20, 210, 50], [1, 60, 20, 100, 50]]);
  const model = { places: [
    at('Skyrim', 2, 0, 'city-state', 'Plain', ...pic(800, -200)),
    at('Skyrim', 2, 1, 'town', 'Twin', ...pic(800, -200)),   // the same pixel: the next nearest free one
    at('Skyrim', 2, 2, 'village', 'Shore', 109.95, 30.05),   // a sliver west of the land: the nearest land pixel east
    at('Skyrim', 2, 3, 'village', 'Far', 105, 30),   // 50 Bay pixels out: none
    at('Skyrim', 2, 34, 'dungeon', '', ...pic(900, -100)),   // nameless: none
    at('HighRock', 0, 0, 'city-state', 'Bayside', ...pic(500, 200)),   // on the Bay's own ground: Daggerfall's
  ] };
  const s = standArenaPixels(model, trace);
  assert.deepEqual(s.stood.map((p) => [p.name, p.bx, p.by]), [['Plain', 800, -200], ['Twin', 800, -201], ['Shore', 700, -200]]);
  assert.deepEqual(s.unstood.map((p) => p.name), ['Far']);
  assert.equal(s.byPixel.get('800,-200').name, 'Plain');
  assert.equal(s.byPixel.get('800,-201').name, 'Twin', 'the ring\'s nearest centre to the point, the first of a tie in reading order');
  assert.equal(s.byPixel.size, 3);
  // a point whose own pixel's centre is sea, and every pixel round it within the reach sea too, stands nowhere
  const lone = standArenaPixels({ places: [at('Skyrim', 2, 5, 'town', 'Lone', 100.5, 30)] }, trace);
  assert.deepEqual([lone.stood.length, lone.unstood.length], [0, 1]);
  // the CENTRE decides: with the land's edge at Bay x 699.3, pixel 699's corner is sea and its centre land - it stands
  setTamrielFit({ ox: 400.7, oy: 500, ppu: 10 });
  const mid = standArenaPixels({ places: [at('Skyrim', 2, 7, 'town', 'Mid', (699.6 + 400.7) / 10, 30.05)] }, trace);
  assert.deepEqual(mid.stood.map((p) => [p.bx, p.by]), [[699, -200]]);
  setTamrielFit(FIT);
  // the reach is in rings: 3 out is reached, 4 out is not
  const edge = (dx) => standArenaPixels({ places: [at('Skyrim', 2, 6, 'town', 'Edge', 110 - (dx - 0.5) / 10, 30.05)] }, trace).stood.length;
  assert.deepEqual([edge(3), edge(4)], [1, 0]);
});

test('TESA2 the installed pixels: made once a trace and a fit, made again when either moves, none with no trace; the place on a pixel; the standing switch moves the version only when it changes (mutant: the fit key, the switch)', () => {
  setTamrielFit(FIT);
  assert.equal(arenaPixels(), null, 'PIN MOVED (TESA12): no trace, none - the places are the trace\'s own');
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 50]]));
  const a = arenaPixels();
  assert.ok(a.stood.length > 1);
  assert.equal(arenaPixels(), a, 'once');
  // a city of no capital's name and no port (TESA10b: Solitude's place stands on the capital the port built)
  const sol = a.stood.find((p) => p.name === 'Whiterun');
  const [x, y] = pictureToBay(sol.px, sol.py);
  assert.deepEqual([sol.bx, sol.by], [Math.floor(x), Math.floor(y)]);
  assert.equal(arenaPlaceOnPixel(sol.bx, sol.by), sol);
  assert.equal(arenaPlaceOnPixel(sol.bx + 1, sol.by), null);
  setTamrielFit({ ...FIT, ox: FIT.ox + 10 });
  const b = arenaPixels();
  assert.notEqual(b, a, 'a new fit, new pixels');
  assert.equal(b.stood.find((p) => p.name === 'Whiterun').bx, sol.bx - 10, 'ten Bay pixels west with the Bay ten east');
  const v = arenaPlacesVersion();
  assert.equal(arenaStanding(), false);
  setArenaStanding(true); setArenaStanding(true);
  assert.deepEqual([arenaStanding(), arenaPlacesVersion()], [true, v + 1], 'the version moves once, on the change');
  setArenaStanding(false);
  assert.equal(arenaPlacesVersion(), v + 2);
});

test('TESA2 the id: a lane of its own in the high 12 bits and a number past every Bay pixel id below, so no Arena place is a spawn\'s, an isle\'s or a Bay place\'s; the index its own negative past the isles\'; all 432 slots apart (mutant: the salt, the base, the ordinal)', () => {
  assert.deepEqual([ARENA_PLACE_SALT, ARENA_PLACE_BASE, ARENA_INDEX_BASE, ARENA_LOAD_WAIT_MS], [0xa7, 500000, 1000000, 8000]);
  const p = { provinceIndex: 2, id: 2 };
  assert.equal(arenaPlaceId(p), ((0xa7 << 20) | (500000 + 2 * 48 + 2)) >>> 0);
  assert.equal(arenaLocationIndex(p), -(1000000 + 98));
  const ids = new Set(), idx = new Set();
  for (let pi = 0; pi < 9; pi++) for (let id = 0; id < 48; id++) { ids.add(arenaPlaceId({ provinceIndex: pi, id })); idx.add(arenaLocationIndex({ provinceIndex: pi, id })); }
  assert.deepEqual([ids.size, idx.size], [432, 432]);
  for (const id of ids) {
    assert.ok(isArenaPlaceId(id));
    assert.ok((id & 0xfffff) >= 500000, 'past every pixel id');
  }
  assert.ok(Math.max(...[...idx].map((i) => -i)) < 1048576 && Math.min(...[...idx].map((i) => -i)) > 1000 + CELLS_W * CELLS_H, 'past the isles\' indices');
  assert.equal(isArenaPlaceId(spawnedMapId(0xa7, 999, 499)), false, 'a spawn under the same salt is still a spawn: its low bits are a pixel id');
  assert.equal(isArenaPlaceId(etherPlaceId({ cx: 3, cy: 4 })), false);
  assert.ok(-etherLocationIndex({ cx: CELLS_W - 1, cy: CELLS_H - 1 }) < ARENA_INDEX_BASE);
  assert.equal(isArenaPlaceId(1234), false, 'a Bay place');
});

/** A row of the game's own shape, enough for the templates and the clone. */
const row = (mapId, type, { dungeon = false, blocks = 1, extra = {} } = {}) => ({
  name: `Row ${mapId}`, regionIndex: 17, regionName: 'Daggerfall', politic: 145, climate: { worldClimate: 0 }, locationIndex: mapId % 100,
  mapTableData: { mapId, locationType: type, longitude: 1, latitude: 2 },
  exterior: { exteriorData: { width: blocks, height: 1, locationId: mapId, mapId, portTownAndUnknown: 1 }, recordElement: { header: { locationId: mapId } }, buildings: [{ n: 1 }] },
  hasDungeon: dungeon,
  ...(dungeon ? { dungeon: { blocks: [{}], recordElement: { header: { locationId: mapId } } } } : {}),
  ...extra,
});

test('TESA2 the templates: a city-state a CITY, a town a HAMLET, a village a VILLAGE - the game\'s rows of that type with an exterior and no dungeon, never main-story nor a place the port made, in map-id order; the pick off the place\'s own hash; a kind with none none (mutant: a kind\'s type, the dungeon test, an exclusion, the order)', () => {
  // PIN MOVED (TESA12): Arena's staff dungeons, a labyrinth and a keep, went with Arena
  assert.deepEqual(Object.fromEntries(Object.entries(ARENA_TEMPLATE_KINDS).map(([k, v]) => [k, v.type])), {
    'city-state': LOCATION_TYPES.TownCity, town: LOCATION_TYPES.TownHamlet, village: LOCATION_TYPES.TownVillage,
  });
  const rows = [
    row(30, LOCATION_TYPES.TownCity, { blocks: 40 }), row(10, LOCATION_TYPES.TownCity, { blocks: 36 }),
    row(20, LOCATION_TYPES.TownCity, { dungeon: true, blocks: 64 }),   // a capital's castle
    row(40, LOCATION_TYPES.TownHamlet, { blocks: 8 }), row(50, LOCATION_TYPES.TownVillage, { blocks: 4 }),
    row(60, LOCATION_TYPES.DungeonLabyrinth, { dungeon: true }), row(61, LOCATION_TYPES.DungeonLabyrinth, { dungeon: true }),
    row(70, LOCATION_TYPES.DungeonKeep, { dungeon: true }), row(71, LOCATION_TYPES.DungeonKeep, { extra: { hasDungeon: true, dungeon: { blocks: [] } } }),
    row(80, LOCATION_TYPES.TownCity, { extra: { spawned: true } }), row(81, LOCATION_TYPES.TownCity, { extra: { ether: 'k' } }),
    row(82, LOCATION_TYPES.TownCity, { extra: { arena: { id: 0 } } }), { name: 'no exterior', mapTableData: { mapId: 83, locationType: LOCATION_TYPES.TownCity } },
  ];
  const t = arenaTemplates(rows, (id) => id === 61);
  assert.deepEqual(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.map((l) => l.mapTableData.mapId)])), {
    'city-state': [10, 30], town: [40], village: [50],
  });
  const place = { provinceIndex: 2, id: 0, kind: 'city-state' };
  assert.equal(arenaTemplateOf(t, place), t['city-state'][hash32(0xa7, 2, 0, 3) % 2]);
  assert.equal(arenaTemplateOf(t, { provinceIndex: 4, id: 0, kind: 'city-state' }), t['city-state'][hash32(0xa7, 4, 0, 3) % 2], 'another province, its own hash');
  assert.notEqual(arenaTemplateOf(t, place), arenaTemplateOf(t, { provinceIndex: 4, id: 0, kind: 'city-state' }), 'and the two differ here, so the hash is read');
  assert.equal(arenaTemplateOf(t, { provinceIndex: 2, id: 34, kind: 'dungeon' }), null);
  assert.equal(arenaTemplateOf({ ...t, town: [] }, { provinceIndex: 2, id: 8, kind: 'town' }), null);
  // a spawn never clones an Arena place - nor an isle's (AUDIT CAPTAIN'S SEA P3's law)
  const dun = (mapId, extra) => ({ ...row(mapId, LOCATION_TYPES.DungeonRuin, { dungeon: true }), ...extra });
  assert.deepEqual(spawnTemplates([dun(1, {}), dun(2, { arena: { id: 1 } }), dun(3, { ether: 'x' })]).map((l) => l.mapTableData.mapId), [1]);
});

test('TESA2 the clone: the template under the place\'s name, its own id on the map row, the exterior (its location and map ids, its record\'s header) and the dungeon\'s header, the pixel\'s longitude and latitude, the region the host hands, its own index, no harbour, and `arena` - and the template itself untouched (mutant: a header left the template\'s, the pixel, the port byte)', () => {
  const tpl = row(70, LOCATION_TYPES.DungeonKeep, { dungeon: true });
  const before = JSON.stringify(tpl);
  const place = { province: 'Skyrim', provinceIndex: 2, id: 1, kind: 'city-state', name: 'Windhelm', bx: 2200, by: -360 };
  const loc = synthesizeArenaLocation(tpl, place, { regionIndex: 0, regionName: "Alik'r Desert", politic: 128, climate: { worldClimate: 230 } });
  const id = arenaPlaceId(place), ll = mapPixelToLongitudeLatitude(2200, -360);
  assert.equal(loc.name, 'Windhelm');
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate, loc.locationIndex], [0, "Alik'r Desert", 128, 230, arenaLocationIndex(place)]);
  assert.deepEqual(loc.mapTableData, { ...tpl.mapTableData, mapId: id, longitude: ll.x, latitude: ll.y });
  assert.deepEqual(loc.exterior.exteriorData, { ...tpl.exterior.exteriorData, locationId: id, mapId: id, portTownAndUnknown: 0 });
  assert.equal(loc.exterior.recordElement.header.locationId, id);
  assert.equal(loc.dungeon.recordElement.header.locationId, id);
  assert.equal(loc.dungeon.blocks, tpl.dungeon.blocks, 'the blocks shared, never copied');
  assert.equal(loc.exterior.buildings, tpl.exterior.buildings);
  assert.deepEqual(loc.arena, { province: 'Skyrim', provinceIndex: 2, id: 1, kind: 'city-state', port: false }, 'PIN MOVED (TESA6): and whether it is a port (tesa6_ports)');
  assert.ok(Object.isFrozen(loc.arena));
  assert.equal(JSON.stringify(tpl), before, 'the template is the game\'s and stays so');
  const town = synthesizeArenaLocation(row(40, LOCATION_TYPES.TownHamlet), { ...place, kind: 'town', name: 'T' });
  assert.equal(town.dungeon, undefined, 'a town clones no dungeon');
  assert.deepEqual([town.regionIndex, town.politic], [17, 145], 'no region handed: the template\'s');
});

test('TESA2 the map: where a host stands the places, each inked place carries the pixel it stands on, and on the teleport map the press on one is a portal\'s end at that pixel (TRAVEL-EVERYWHERE: on the travel map a place\'s journey, test/ui/travel_everywhere.test.js), the coordinates\' own; where none does it carries none and the press picks nothing; the cursor points at one it opens a portal to (mutant: the switch, the pixel, the pick)', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 80]]));
  let ink = buildTamrielInk();
  assert.ok(ink.cities.every((c) => c.pixel === null), 'nobody stands them: no journeys');
  setArenaStanding(true);
  ink = buildTamrielInk();
  const px = arenaPixels();
  assert.deepEqual(ink.cities.map((c) => [c.name, c.pixel]), px.stood.map((p) => [p.name, { x: p.bx, y: p.by }]));
  const sol = ink.cities[0];
  assert.equal(tamrielCityAt(sol.x + 1, sol.y, { ox: 0, oy: 0, scale: 1 }, ink), sol);
  assert.equal(tamrielCityAt(sol.x + CITY_HIT_PX + 1, sol.y, { ox: 0, oy: 0, scale: 1 }, ink), null);
  assert.equal(tamrielCityAt(500, 250, { ox: 0, oy: 0, scale: 1 }, ink), null, 'the Bay\'s own ground is the Bay\'s');
  assert.deepEqual(arenaInkCities({ places: [] }), []);
  const held = read('src/ui/heldMap.js');
  const pick = held.slice(held.indexOf('  _pickAt(sx, sy) {'), held.indexOf('  _renderSearch(entries) {'));
  // the teleport map's arm (the travel map's is TRAVEL-EVERYWHERE's, test/ui/travel_everywhere.test.js)
  assert.match(pick, /if \(this\._tamriel && !this\._zoneMap && this\.teleportationTravel\) \{/);
  // PIN MOVED (PORTAL-ANYWHERE, bible/06-Systems/Portal-Stone.md): the portal's end is the city with a pixel, else - on the
  // Portal Stone's map alone (`portalLandPastBay`) - the land under the press (systems/travel/pastBayTravel.js portalLandAt)
  // PIN MOVED (WILD-CITY-PORT, bible/11-Multiplayer/Wild-Zone.md section 28): the city the press takes is one method, asked by
  // ZONE-ZOOM too - a city the sheet inks, with its pixel
  assert.match(held, /  _portalCityAt\(sx, sy\) \{\n\s+if \(!this\._tamriel \|\| this\._zoneMap \|\| !this\.teleportationTravel\) return null;\n[^\n]+\n\s+const city = tamrielCityAt\(mx, my, this\._view, tamrielInkFor\(this\._model\), [^\n]+\n\s+return city\?\.pixel \? city : null;\n/);
  // PIN MOVED (TRAVEL-EVERYWHERE): a countryside mark's place is a portal's end too, as the Bay's teleport reaches any place
  assert.match(pick, /const mark = past\?\.on === 'mark' && !inBay\(past\.pixel\.x, past\.pixel\.y\) && this\._pastBayTownAt\(past\.pixel\.x, past\.pixel\.y\) \? past : null;/);   // AUDIT TRAVEL-EVERYWHERE 2: a place the world knows
  assert.match(pick, /const end = this\._portalCityAt\(sx, sy\) \?\? mark \?\? \(this\.deps\.portalLandPastBay \? portalLandAt\(Math\.floor\(mx\), Math\.floor\(my\)\) : null\);\n\s+if \(end\) \{\n\s+this\._select\(\{ coords: true, x: end\.pixel\.x \+ 0\.5, y: end\.pixel\.y \+ 0\.5, colorIndex: -1, kind: 'coords', name: end\.name, summary: null, mapId: null, arena: true \}\);\n\s+this\._openPanel\('teleport'\);/);
  assert.ok(pick.indexOf('// TESA2') < pick.indexOf('// WILD2'), 'before the zone\'s and the coordinates\' own arms');
  assert.match(held, /if \(selected\.coords\) return \{ pixel: \{ x: Math\.floor\(selected\.x\), y: Math\.floor\(selected\.y\) \}, name: selected\.name, \.\.\.\(selected\.place \|\| selected\.door \? \{ place: true \} : \{\}\) \};/, 'the journey is to its pixel, by its name');   // PIN MOVED (OW-PLACE-WALK, test/ui/owplacewalk.test.js): and a place; TRAVEL-EVERYWHERE: a known place's journey, an unknown one's walk to its door
  // PIN MOVED (AUDIT TESA II M7, M14): the cursor off the city the press would take (_pastBayHover: tamrielCityAt as the sheet inks)
  assert.match(held, /cursor: \(this\.teleportationTravel \? past\.city\?\.pixel \|\| \(past\.on === 'mark' && this\._pastBayTownAt\(past\.pixel\.x, past\.pixel\.y\)\) \|\| \(this\.deps\.portalLandPastBay && portalLandAt\(px, py\)\) : \(this\._walksPastBay\(\) \|\| this\._travelsPastBay\(\)\) && this\._pastBayPressPick\(mx, my\)\) \? 'pointer' : ''/);   // PIN MOVED (AUDIT TRAVEL-EVERYWHERE 8): a known mark on the teleport map; on the travel map where a press picks
  // PIN MOVED (BAY-LEFT-MAPS C11, test/ui/bayleft_find.test.js): and the Ports filter
  assert.match(held, /city: at\.on === 'city' \? tamrielCityAt\(mx, my, this\._view, ink, \{ filters: this\.filters, continent, portsOnly: this\.portsFilter \}\) : null/);
  // WW7-6: a seat past the Bay answers with its card, as the Bay's (SEAT-TIP) - off the city the press would take
  assert.match(held, /const seat = past\.city\?\.mapId != null \? this\.deps\.seatAt\?\.\(\{ mapId: past\.city\.mapId \}\) \?\? null : null;/);
});

test('TESA2 the host: offline on the land beyond the Bay it stands the places - the templates off the game\'s rows, the build asking Arena past the Bay, one clone a pixel in the index taken out when its place goes, the region and the climate the pixel\'s; the built pixel keeps its place for the sweep, which builds again what moved; a boot\'s load waits for the places; no house is sold in an Arena town; /tp names them (mutant: online, an arm, the wait)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const arenaStands = tamrielLand && arenaPlacesOn\(\);\n\s+setArenaStanding\(arenaStands\);/, 'PIN MOVED (TESA12): online and off, the port\'s own (tesa12_places)');
  assert.match(w, /const _arenaTemplates = arenaStands \? arenaTemplates\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\), isMainStoryDungeon\) : null;/, 'the game\'s rows');
  assert.ok(w.indexOf('const _arenaTemplates = arenaStands') < w.indexOf('  _classicRows = null;   // read, let go'), 'before they go');
  // PIN MOVED (AUDIT TESA II P1): online the open zone's hall of the day first - Cyrodiil's lie past the Bay
  assert.match(w, /if \(etherSea && inEther\(px, py\)\) return etherPlaceAt\(px, py\);[^\n]*\n\s+if \(\(_arenaTemplates \|\| _countryTemplates \|\| _capitalBase\) && !onTheBay\(px, py\)\) return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\) && zoneHalls\.standIn\(cyrodiilMask\(\), px, py\)\) \|\| host\.capitalLocationAt\(px, py\) \|\| \(_arenaTemplates && host\.arenaLocationAt\(px, py\)\) \|\| host\.countryLocationAt\(px, py\) \|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/);   // PIN MOVED (TESA7): Arena's place first, else the countryside's (tesa7_country); PIN MOVED (TESA8): then a lair's; PIN MOVED (TESA10): a capital before them all (tesa10_capitals)   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild is scenes/spawnStandHost.js's, the places' rolls through `host`   // PIN MOVED (SPAWN-WORLD 2026-10-26): online, the spawner's last - never on a place   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js) - carried into scenes/spawnStandHost.js at the packages' merge (AUDIT BAY-LEFT)
  const fn = w.slice(w.indexOf('  function arenaLocationAt(px, py) {'), w.indexOf('\n  }\n', w.indexOf('  function arenaLocationAt(px, py) {')) + 4);   // PIN MOVED (HOST-SPLIT, at the merge of main): the place law is scenes/tamrielPlacesHost.js's, its live names through host
  assert.match(fn, /if \(place && had\.arena\.provinceIndex === place\.provinceIndex && had\.arena\.id === place\.id && had\.arena\.port === !!place\.port\) return had;[^\n]*\n\s+host\._locIndexGen \+= 1;\n\s+locationIndex\.delete\(key\);/,   // PIN MOVED (TESA6): a city made a port is cloned again
    'one clone a pixel, and out of the index when its place goes');
  const clone = w.slice(w.indexOf('  function arenaCloneOf(template, place, px, py) {'), w.indexOf('\n  }\n', w.indexOf('  function arenaCloneOf(template, place, px, py) {')) + 4);   // PIN MOVED (AUDIT FOUNDATION II A1): the clone apart from its standing - the atlas's check reads it unstood
  assert.match(fn, /const loc = arenaCloneOf\(template, place, px, py\);\n\s+host\._locIndexGen \+= 1;\n\s+locationIndex\.set\(key, loc\);/);
  assert.match(clone, /const regionIndex = maps\.getRegionIndexAt\(px, py\);\n\s+const loc = outlineTownLocation\(synthesizeArenaLocation\(template, place, \{ regionIndex, regionName: REGION_NAMES\[regionIndex\], politic: 128 \+ regionIndex, climate: townClimateAt\(px, py, getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\)\) \}\), blockOf, \{ round: imperialOutskirts\(px, py\) \}\);/);   // PIN MOVED (TOWN-SHAPES TS3): laid as its own outline of blocks (townoutline); TS5: round in the Imperial City's outskirts; PIN MOVED (URBANIZER U1): its buildings in its province's set (world/urban/townLook.js townClimateAt)
  assert.match(fn, /locationIndex\.set\(key, loc\);\n\s+return loc;/);
  assert.match(w, /location: dfLocation \? dfLocation\.name : null,\n\s+arenaSlot: dfLocation\?\.arena \?\? null,\n/, 'the built pixel keeps its Arena slot - beside, never over, the colosseum\'s `arena` (ARENA2)');
  assert.equal((w.slice(w.indexOf('    swap.publish(px, py, key, made, {'), w.indexOf('    });', w.indexOf('    swap.publish(px, py, key, made, {'))).match(/^\s+arena: /gm) ?? []).length, 1, 'the colosseum\'s origin is the entry\'s one `arena`');
  const sweep = w.slice(w.indexOf('  function sweepArenaPixels() {'), w.indexOf('\n  }\n', w.indexOf('  function sweepArenaPixels() {')) + 4);   // PIN MOVED (HOST-SPLIT, at the merge of main): the sweeps are scenes/tamrielSweepsHost.js's - the function's own end, read whole
  assert.match(sweep, /if \(now === _swept\.arena\) return;/);
  assert.match(sweep, /if \(onTheBay\(p\.px, p\.py\)\) continue;/);
  assert.match(sweep, /if \(\(place \? `\$\{place\.provinceIndex\}\|\$\{place\.id\}\|\$\{!!place\.port\}` : null\) !== \(p\.arenaSlot \? `\$\{p\.arenaSlot\.provinceIndex\}\|\$\{p\.arenaSlot\.id\}\|\$\{!!p\.arenaSlot\.port\}` : null\)\) again\.push/, 'PIN MOVED (TESA6): and its port');
  assert.match(sweep, /if \(!again\.length\) return;\n\s+swap\.rebuild\(again\);/);   // PIN MOVED (IC-SWAP-BEHIND): built again behind its view, or torn down and queued nearest first (scenes/swapBehind.js rebuild)
  assert.match(w, /if \(_arenaTemplates && !building\) sweepArenaPixels\(\);/);
  const WAIT = "if ((_arenaTemplates || _countryTemplates || _capitalBase) && params.has('load')) await Promise.race([arenaTraced, new Promise((r) => setTimeout(r, ARENA_LOAD_WAIT_MS))]);";
  assert.ok(w.includes(WAIT), 'PIN MOVED (TESA12: the trace alone - no data to wait for; AUDIT-TESA A7-1: one wait for everything past the Bay) a load waits for the trace');
  assert.ok(w.indexOf(WAIT) < w.indexOf('  let _loadedGame = false;'), 'before the boot decides its start');
  assert.match(w, /\.finally\(\(\) => arenaTraceLanded\(\)\);/, 'landed, or never will');
  assert.match(w, /if \(!arenaTraceAsked\) arenaTraceLanded\(\);/, 'the door shut: nothing to wait for');
  assert.ok(w.indexOf('const arenaTraced = ') < w.indexOf(WAIT), 'the trace\'s promise made before the load waits on it');
  // PIN MOVED (AUDIT TAMRIEL-WIDE B4/C7): /tp's places are scenes/staffTp.js staffTpPlaces's - the stood places, when they
  // stand, on no indexed pixel
  assert.match(w, /staffTpPlaces\(\{ locationIndex, stood: _arenaTemplates \? arenaPixels\(\)\?\.stood : null, registry: worldPlaces \}\)/);
  assert.match(read('src/scenes/staffTp.js'), /for \(const a of stood \?\? \[\]\) if \(!locationIndex\.has\(`\$\{a\.bx\},\$\{a\.by\}`\)\) \{ places\.push\(\{ name: a\.name, px: a\.bx, py: a\.by \}\);/);
  const modes = read('src/scenes/worldModes.js');
  // PIN MOVED (BAY-LEFT-B, bible/03-World/Arena-Provinces.md): an Arena town sells its houses - its province's region's,
  // its deed held to its own map id (banking.js deedHeldIn); the Veil's guard alone stands
  assert.match(modes, /if \(isEtherPlaceId\(dir\.mapId\)\) return \[\];/);
  assert.match(modes, /const houseOwnedAt = \(b, key\) => !isEtherPlaceId\(homeTownOf\(b\)\) && isHouseOwned\(/);   // PIN MOVED (TESA7): nor a country place's; PIN MOVED (BAY-LEFT-B): an Arena town's and a country place's read, held to their own town
});

// ── THE PLAYER'S OWN FILES ─────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL', 'MAPS.BSA'].every((f) => existsSync(join(ARENA2, f)));

test('TESA2 with ARENA2: on the player\'s own trace all 283 places past the Bay stand on a pixel of their own, every one under its own point but a capital\'s, on the capital, and a port\'s, on its shore; MAPS.BSA\'s templates are 407 cities, 1200 hamlets and 1834 villages; Windhelm stands a 6 x 7 city', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const px = arenaPixels();
  assert.deepEqual([px.stood.length, px.unstood.length, px.byPixel.size], [283, 0, 283], 'PIN MOVED (TESA12): the port\'s own places, not Arena\'s 248');
  // PIN MOVED (AUDIT-TESA A7-2): a capital's place stands on the capital the port built (TESA10's pin); TESA12: a port on
  // its shore (tesa6_ports); every other under its own point
  const { capitalPin, CAPITALS } = await import('../src/world/tamrielCapitals.js');
  // PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): under its own point where the land's smooth law puts that pixel
  // on its own province's land - else (its point by a coast or a border the smooth law moved off the picture's pixel
  // corners) on the nearest pixel of its own land, a few pixels off
  const { provinceKeyBeyondBay } = await import('../src/world/tamriel/tamrielLand.js');
  const { CITIES } = await import('../src/world/tamriel/tamrielGeography.js');
  let off = 0;
  for (const p of px.stood) {
    if (p.pinned) { const at = capitalPin(p); assert.ok(at && CAPITALS.some((c) => c.name === p.name), p.name); assert.deepEqual([p.bx, p.by], [at.px, at.py], p.name); continue; }
    if (p.port && CITIES.some((c) => c.port && c.name === p.name)) continue;   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): a lore port on its shore - a coast port stands where any place does
    const [x, y] = pictureToBay(p.px, p.py), fx = Math.floor(x), fy = Math.floor(y);
    assert.equal(provinceKeyBeyondBay(p.bx, p.by), p.province, `${p.name} on its own land`);
    if (provinceKeyBeyondBay(fx, fy) === p.province) { assert.deepEqual([p.bx, p.by], [fx, fy], p.name); continue; }
    off++;
    assert.ok(Math.hypot(p.bx - fx, p.by - fy) <= 8, `${p.name}: ${p.bx - fx}, ${p.by - fy} off its point`);
  }
  assert.equal(off, 8, 'eight places a few pixels off their point - every other under it');
  const maps = new MapsFile();
  maps.load(await fetchBytes('MAPS.BSA'), await fetchBytes('CLIMATE.PAK'), await fetchBytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { const reg = maps.getRegion(r); if (reg) for (let i = 0; i < reg.locationCount; i++) rows.push(maps.getLocation(r, i)); }
  const t = arenaTemplates(rows);
  assert.deepEqual(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.length])), { 'city-state': 407, town: 1200, village: 1834 });
  const wh = px.stood.find((p) => p.name === 'Windhelm');
  const loc = synthesizeArenaLocation(arenaTemplateOf(t, wh), wh);
  assert.deepEqual([loc.name, loc.exterior.exteriorData.width, loc.exterior.exteriorData.height, isArenaPlaceId(loc.mapTableData.mapId)], ['Windhelm', 6, 7, true]);
});
