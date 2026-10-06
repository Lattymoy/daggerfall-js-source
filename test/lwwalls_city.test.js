// LW-WALLS (2026-10-06, bible/06-Systems/Living-World.md "LW-WALLS"; the field - MD-Geist on the Discord: "In Ripmarket
// (Daggerfall Province) the last few days there have been 0 NPC's walking around in the city...Tested on clear days and
// rainy no change", and the ask: "Seems like with living world, a lot of towns are unpopulated"): THE CITY BEHIND ITS WALLS.
// A town's street net is the walkable component its buildings' doors open onto (places.js doorsNet), never the grid's
// largest: a walled city's wall and gates are covered cells of the navgrid (the gate model's automap footprint closes its
// passage), so its streets and the fields about it are two components, and the fields are the larger in 407 of the
// game's 410 cities - the living town was laid on the fields, every door off them, and every one of its people kept at
// home all day. And the watch and the travellers live where a door opens onto the street (census.js townCensus
// `opens`): a palace walled in its own grounds kept the whole watch in. The synthetic walled city (test/lwTown.mjs
// walledTown) everywhere; the game's own cities where ARENA2_PATH names the data, built as the streaming host builds them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { walledTown } from './lwTown.mjs';
import { streetNet, townPlaces, doorsNet } from '../src/systems/livingWorld/places.js';
import { townCensus, isHome } from '../src/systems/livingWorld/census.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { maxPopulationFor } from '../src/systems/townPopulation.js';
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { isCityGate } from '../src/world/rmbLayout.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { patchSeams } from '../src/world/arch3dSeams.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { trs, multiply } from '../src/world/mat4.js';
import { hasPort } from '../src/systems/travelPorts.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 54321, blocks: 16, region: 17, people: 3, port: false });

/** A living town on a town's grid, doors and buildings, the calendar's clock at `minute`. */
function livingTown({ nav, buildings, doors }, minute, town = TOWN) {
  const clock = { t: minute };
  const lt = new LivingTown(nav, {
    town, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM,
  });
  return { town: lt, clock };
}
/** `seconds` of real time at 30 frames a second, the clock with it, the player standing at the town's square. */
function run({ town, clock }, seconds) {
  const sq = town.places.square, at = [sq.x, 0, sq.z];
  let seats = [];
  for (let i = 0; i < Math.round(seconds * 30); i++) { clock.t += RATE / 30; seats = town.update(1 / 30, at, 0, at, true); }
  return seats;
}

/** A grid of rooms, each [x0, y0, x1, y1] of walkable cells, the rest covered. */
function rooms(...boxes) {
  const nav = new CityNavigation(1, 1);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) nav.grid[y * nav.width + x] = (15 << 4);
  return nav;
}
/** Building `key`'s door in the wall over a room's top row, at column `x`, facing down into it. */
const doorInto = (key, room, x) => ({ key, x: (x + 0.5) * NAV_CELL, z: (room[3] + 1) * NAV_CELL, nx: 0, nz: -1 });

test('LW-WALLS doorsNet: a town\'s street is the walkable component the most of its BUILDINGS open onto - smaller than another or not; each building once, however many doors; on a tie the larger, then the first labelled; a town whose doors reach no street keeps the largest; townPlaces lays the doors on it and a building off it keeps no spot (mutants: the largest kept, a door counted for a building, the tie to the smaller, the tie to the last, no doors no street, the vote on the largest)', () => {
  const A = [2, 2, 11, 11], B = [20, 2, 39, 11], C = [2, 30, 21, 39];   // 100, 200 and 200 cells
  const nav = rooms(A, B, C);
  const streets = streetNet(nav);
  const at = (room) => streets.label[room[1] * nav.width + room[0]];
  assert.deepEqual([at(A), at(B), at(C), streets.id], [1, 2, 3, 2], 'the fixture: labelled in the grid\'s order, B the first of the two largest');
  assert.equal(doorsNet(nav, [doorInto(1, A, 4), doorInto(2, A, 8), doorInto(3, B, 25)], streets), at(A), 'two buildings onto A and one onto B: A, the smaller');
  assert.equal(doorsNet(nav, [doorInto(1, A, 3), doorInto(1, A, 6), doorInto(1, A, 9), doorInto(2, B, 25), doorInto(3, B, 30)], streets), at(B),
    'one building\'s three doors onto A count once against two buildings onto B');
  assert.equal(doorsNet(nav, [doorInto(1, A, 4), doorInto(2, B, 25)], streets), at(B), 'a building each: the larger');
  assert.equal(doorsNet(nav, [doorInto(1, A, 4), doorInto(2, C, 5)], streets), at(C), 'the larger, though the smaller is labelled first');
  assert.equal(doorsNet(nav, [doorInto(2, C, 5), doorInto(1, B, 25)], streets), at(B), 'a building each, alike in size: the first labelled');
  assert.equal(doorsNet(nav, [], streets), streets.id, 'no doors: the largest');
  assert.equal(doorsNet(nav, [{ key: 9, x: 50.5 * NAV_CELL, z: 50.5 * NAV_CELL, nx: 0, nz: 1 }], streets), streets.id, 'a door deep in a covered lot reaches no street');
  const places = townPlaces(nav, [doorInto(1, A, 4), doorInto(2, A, 8), doorInto(3, B, 25)], []);
  assert.equal(places.netId, at(A));
  assert.deepEqual([...places.doors.keys()].sort((a, b) => a - b), [1, 2], 'the building onto B keeps no spot: its people stay in (LW1)');
  for (const s of places.doors.values()) assert.equal(streets.label[s.cell[1] * nav.width + s.cell[0]], at(A));
});

test('LW-WALLS a walled city: its streets and its fields are two components of the grid, the fields the larger (as in 407 of the game\'s 410 cities) - and the town is laid on its streets: every building inside the walls has its door\'s spot on them and the farmhouse out in the fields none, an exit in each gate\'s passage on the inside of the gate, the square inside the walls (mutants: the largest kept, the street unread, the vote on the largest)', () => {
  const { nav, buildings, doors, farmhouse, box, passages } = walledTown();
  const W = nav.width;
  const streets = streetNet(nav);
  const inside = streets.label[53 * W + 53], fields = streets.label[5 * W + 5];
  assert.equal(streets.id, fields, 'the fixture: the fields the larger');
  assert.notEqual(inside, fields, 'and the gates closed');
  const places = townPlaces(nav, doors, buildings);
  assert.equal(places.netId, inside, 'the street its doors open onto');
  assert.deepEqual([...places.doors.keys()].sort((a, b) => a - b), buildings.map((b) => b.key).filter((k) => k !== farmhouse));
  for (const s of places.doors.values()) assert.equal(streets.label[s.cell[1] * W + s.cell[0]], inside, `${s.key} on the street`);
  assert.deepEqual(places.exits.map((e) => [e.key, e.cell]), [['xn', [128, 204]], ['xs', [128, 51]], ['xe', [204, 128]], ['xw', [51, 128]]]);
  for (const e of places.exits) {
    const [x0, y0, x1, y1] = passages[/** @type {'n'|'s'|'e'|'w'} */ (e.side)];
    assert.ok(e.cell[0] >= x0 && e.cell[0] <= x1 && e.cell[1] >= y0 && e.cell[1] <= y1, `${e.key}: in its gate's passage`);
  }
  const [bx0, by0, bx1, by1] = box, [sx, sy] = places.square.cell;
  assert.ok(sx >= bx0 && sx <= bx1 && sy >= by0 && sy <= by1, `the square inside the walls (${places.square.cell})`);
  assert.deepEqual([places.social.length, places.market.length], [5, 5], 'the square and the four social spots before the tavern, the temple, the guild hall and the palace; a market before each shop');
});

test('LW-WALLS the walled city\'s street by day: its people out on it, to DFU\'s cap and every one inside the walls; the farmhouse\'s household out in the fields keeps in all day (mutants: the largest kept, the street unread)', () => {
  const fx = walledTown();
  const c = livingTown(fx, 100 * DAY_MIN + 10 * 60);
  const seats = run(c, 6);
  const cap = maxPopulationFor(TOWN.blocks);
  assert.ok(seats.length >= cap * 0.75, `a morning street (${seats.length} of ${cap})`);
  const [bx0, by0, bx1, by1] = fx.box.map((v, i) => (i < 2 ? v : v + 1) * NAV_CELL);
  for (const { person } of seats) {
    assert.ok(person.pos[0] >= bx0 && person.pos[0] <= bx1 && person.pos[2] >= by0 && person.pos[2] <= by1, `${person.living.id} inside the walls`);
  }
  const farm = c.town.residents.filter((r) => r.home === fx.farmhouse);
  assert.ok(farm.length > 0, 'the fixture: a household out in the fields');
  for (let m = 0; m < DAY_MIN; m += 20) for (const r of farm) assert.equal(c.town.where(r, 101 * DAY_MIN + m, false), null, `${r.id} at ${m}`);
});

test('LW-WALLS the watch lives where a door opens onto the street: a palace walled in its own grounds keeps none of them - the watch\'s and every traveller\'s home is a building whose door opens onto the street, an adventurer\'s tavern too, and a household keeps the house it is minted from; through the living town, the day\'s watch walks the city\'s street (mutants: the palace unread, the houses unread, the taverns unread, the census unwired)', () => {
  const fx = walledTown({ walledPalace: true });
  const palace = /** @type {{ key: number }} */ (fx.buildings.find((b) => b.type === BUILDING_TYPES.Palace)).key;
  const tavern = /** @type {{ key: number }} */ (fx.buildings.find((b) => b.type === BUILDING_TYPES.Tavern)).key;
  const places = townPlaces(fx.nav, fx.doors, fx.buildings);
  assert.equal(places.doors.has(palace), false, 'the fixture: the palace\'s door opens onto its grounds alone');
  const opens = new Set(places.doors.keys());
  const unknowing = townCensus(TOWN, fx.buildings);
  assert.ok(unknowing.filter((r) => r.guard).every((r) => r.home === palace), 'the street unknown, the watch lives at the palace (LW1)');
  assert.ok(unknowing.some((r) => r.job === 'adventurer' && r.home === tavern), 'the fixture: an adventurer lodged at the tavern');
  const census = townCensus(TOWN, fx.buildings, opens);
  assert.ok(census.filter((r) => r.roll !== 'h').every((r) => opens.has(/** @type {number} */ (r.home))), 'the watch and the travellers at doors onto the street');
  const own = (list) => list.filter((r) => r.roll === 'h').map((r) => [r.id, r.home]);
  assert.deepEqual(own(census), own(unknowing), 'a household keeps its house - its slot is its identity');
  // one house alone opens onto the street (the tavern none): every one of the watch and of the travellers lives there
  const one = /** @type {{ key: number }} */ (fx.buildings.find((b) => isHome(b.type) && opens.has(b.key))).key;
  const narrow = townCensus(TOWN, fx.buildings, new Set([one]));
  assert.deepEqual([...new Set(narrow.filter((r) => r.roll !== 'h').map((r) => r.home))], [one]);
  // the living town knows its street when it numbers its people, and the day's watch is out on its duty
  const c = livingTown(fx, 100 * DAY_MIN + 10 * 60);
  assert.ok(c.town.residents.filter((r) => r.guard).every((r) => opens.has(/** @type {number} */ (r.home))), 'the town\'s watch at doors onto its street');
  const t = c.clock.t;
  const out = c.town.residents.filter((r) => r.guard && c.town.entryOf(r, t)?.e.duty && c.town.where(r, t, false));
  assert.ok(out.length >= 2, `the day's watch out on its duty (${out.length})`);
});

test('LW-WALLS the game\'s own walled cities are read here as the streaming host reads them - its location laid out, its navgrid, its doors\' law into the location frame and its buildings (the replay below, scenes/world.js\'s population block, word for word)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const loc = layoutLocation\(dfLocation, maps, blocks, \{ enhanced: isEnhanced\(\), windmills: windmillsOn\(\) \}\);/);
  assert.match(w, /const originMatrix = trs\(\n\s+locLocal\[0\] \+ b\.originX, locLocal\[1\], locLocal\[2\] \+ b\.originZ, 0, 0, 0\);/);
  assert.match(w, /const local = multiply\(originMatrix, placed\.matrix\);/);
  assert.match(w, /const staticDoors = getStaticDoors\(cpu, b\.dfBlock\.index, placed\.recordIndex, local\);/);
  assert.match(w, /nav\.setBlockData\(b\.x, b\.y, b\.dfBlock\.rmbBlock\.fldHeader\.autoMapData,\n\s+\(tx, ty\) => srcTiles\[tx\]\[ty\]\.textureRecord, \{ enhancedWater: waterSwitchOn\(\) \}\);/);
  assert.match(w, /key: makeBuildingKey\(d\.blockX, d\.blockY, d\.recordIndex\),\n\s+x: m\[0\] \* c\.x \+ m\[4\] \* c\.y \+ m\[8\] \* c\.z \+ m\[12\] - locOrigin\[0\], z: m\[2\] \* c\.x \+ m\[6\] \* c\.y \+ m\[10\] \* c\.z \+ m\[14\] - locOrigin\[2\],\n\s+nx: m\[0\] \* n\.x \+ m\[4\] \* n\.y \+ m\[8\] \* n\.z, nz: m\[2\] \* n\.x \+ m\[6\] \* n\.y \+ m\[10\] \* n\.z,/);
  assert.match(w, /buildings: buildingSummaries\(dfLocation\.exterior\?\.buildings \?\? \[\], loc\.blocks, \{ locationIndex: dfLocation\.locationIndex \?\? 0, locationName: dfLocation\.name \}\)\n\s+\.map\(\(b\) => \(\{ key: b\.buildingKey, type: b\.buildingType, quality: b\.quality, factionId: b\.factionId \}\)\),/);
  assert.match(w, /people: getWorldClimateSettings\(maps\.getClimateIndex\(p\.x, p\.y\)\)\?\.people, blocks: Math\.max\(1, \(ed\?\.width \?\? 1\) \* \(ed\?\.height \?\? 1\)\),\n\s+port: hasPort\(md\.mapId\),/);
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

/** The game's data, read once: the maps, the blocks, and each model as the pipeline mints it (its seams closed). */
let _game = null;
function game() {
  if (_game) return _game;
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const modelOf = (id) => {
    if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i === -1 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(i)), () => ({ width: 64, height: 64 }))); }
    return models.get(id);
  };
  _game = { maps, blocks, modelOf };
  return _game;
}

/** A town as the streaming host builds its living town (the population block, pinned above), on the enhanced skin with
 *  its water and its mills (the living world's lane, each on by default): the location frame is the location's own
 *  origin. And where its city gates stand, in navgrid cells. */
function hostTown(dfLocation) {
  const { maps, blocks, modelOf } = game();
  const md = dfLocation.mapTableData;
  const p = longitudeLatitudeToMapPixel(md.longitude, md.latitude);
  const loc = layoutLocation(dfLocation, maps, blocks, { enhanced: true, windmills: true });
  const nav = new CityNavigation(loc.width, loc.height);
  for (const b of loc.blocks) {
    const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => srcTiles[tx][ty].textureRecord, { enhancedWater: true });
  }
  const doors = [], gates = [];
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const local = multiply(originMatrix, placed.matrix);
      if (isCityGate(placed.modelIdNum)) gates.push([Math.floor(local[12] / NAV_CELL), Math.floor(local[14] / NAV_CELL)]);
      const cpu = modelOf(placed.modelIdNum);
      if (!cpu?.doors?.length) continue;
      for (const door of getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, local)) {
        const m = door.matrix, c = door.centre, n = door.normal;
        doors.push({
          key: makeBuildingKey(b.x, b.y, placed.recordIndex),
          x: m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], z: m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14],
          nx: m[0] * n.x + m[4] * n.y + m[8] * n.z, nz: m[2] * n.x + m[6] * n.y + m[10] * n.z,
        });
      }
    }
  }
  const buildings = buildingSummaries(dfLocation.exterior?.buildings ?? [], loc.blocks, { locationIndex: dfLocation.locationIndex ?? 0, locationName: dfLocation.name })
    .map((b) => ({ key: b.buildingKey, type: b.buildingType, quality: b.quality, factionId: b.factionId }));
  const town = {
    mapId: md.mapId >>> 0, name: String(dfLocation.name ?? ''), px: p.x, py: p.y, type: md.locationType, region: dfLocation.regionIndex,
    people: getWorldClimateSettings(maps.getClimateIndex(p.x, p.y))?.people, blocks: Math.max(1, loc.width * loc.height), port: hasPort(md.mapId),
  };
  return { nav, doors, buildings, town, gates };
}

/** Every city of the game's own rows (a mod's appended rows never). */
function cities() {
  const { maps } = game();
  const out = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.exterior?.exteriorData && loc.mapTableData?.locationType === LOCATION_TYPES.TownCity) out.push(loc);
    }
  }
  return out;
}

test('LW-WALLS the game\'s own cities (ARENA2): Ripmarket, the report\'s - its fields larger than its streets, every building with a door its spot on its streets, an exit at each of its four gates, and its street at midday full to DFU\'s cap, every one on it inside the walls; and every one of the game\'s 410 cities, 407 of them with fields the larger: nearly every building with a door its spot (99%), most of its people homed on its street, and the whole watch (mutants: the largest kept, the vote on the largest, the census unwired)', { skip: skipReal }, () => {
  const all = cities();
  const rip = /** @type {any} */ (all.find((c) => c.name === 'Ripmarket'));
  assert.ok(rip, 'Ripmarket, a city of the Daggerfall region');
  const h = hostTown(rip);
  const streets = streetNet(h.nav);
  const places = townPlaces(h.nav, h.doors, h.buildings);
  const size = (id) => streets.label.reduce((n, l) => n + (l === id ? 1 : 0), 0);
  assert.ok(size(streets.id) > size(places.netId) && places.netId !== streets.id, `the fields (${size(streets.id)} cells) larger than the streets (${size(places.netId)})`);
  assert.equal(places.doors.size, new Set(h.doors.map((d) => d.key)).size, 'every building with a door, its spot');
  assert.equal(h.gates.length, 4, 'four gates');
  for (const e of places.exits) assert.ok(h.gates.some(([gx, gy]) => Math.max(Math.abs(gx - e.cell[0]), Math.abs(gy - e.cell[1])) <= 4), `${e.key} ${e.cell} at a gate`);
  const c = livingTown(h, 400 * DAY_MIN + 13 * 60, h.town);
  const seats = run(c, 6);
  assert.ok(seats.length >= 0.75 * c.town.maxPopulation, `Ripmarket at midday: ${seats.length} of ${c.town.maxPopulation}`);
  for (const { person } of seats) assert.equal(streets.label[Math.floor(person.pos[2] / NAV_CELL) * h.nav.width + Math.floor(person.pos[0] / NAV_CELL)], places.netId, `${person.living.id} on the street`);
  assert.ok(c.town.residents.filter((r) => r.guard).every((r) => places.doors.has(/** @type {number} */ (r.home))), 'Ripmarket\'s watch at doors onto the street');
  let fieldsLarger = 0;
  for (const loc of all) {
    const t = hostTown(loc);
    const s = streetNet(t.nav);
    const p = townPlaces(t.nav, t.doors, t.buildings);
    if (p.netId !== s.id) fieldsLarger++;
    const keyed = new Set(t.doors.map((d) => d.key));
    assert.ok(p.doors.size >= 0.99 * keyed.size, `${loc.name}: ${p.doors.size} of ${keyed.size} buildings with a door have their spot`);
    const census = townCensus(t.town, t.buildings, new Set(p.doors.keys()));
    const homed = census.filter((r) => r.home != null && p.doors.has(r.home)).length;
    assert.ok(homed >= 0.8 * census.length, `${loc.name}: ${homed} of ${census.length} homed on the street`);
    assert.deepEqual(census.filter((r) => r.guard && !p.doors.has(/** @type {number} */ (r.home))).map((r) => r.id), [], `${loc.name}: the watch homed on the street`);
  }
  assert.deepEqual([all.length, fieldsLarger], [410, 407], 'the game\'s cities, and those whose fields are the larger');
});
