// WW7-7 and WW7-8 (2026-10-26, the owner: "Yes travellers to need to travel everywhere. Same for ships.";
// bible/03-World/World-Wide.md WW7-7, WW7-8): THE LIVING WORLD'S PEOPLE AND THE SEA'S SHIPS PAST THE BAY - each trip on its own
// side of the Bay's edge; past the Bay the towns near by the roads' places, the ways the one planner's on a window of the world
// on the roads past the Bay, every trip waiting on those roads laid whole; and every ship named past the Bay said so on the
// wire, so every reader names her as her stander did. Each pin mutation-checked (tools/mutants/ww7_people.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex, livingSide, LIVING_SIDES } from '../../../src/scenes/livingWorld/livingIndex.js';
import { createLivingLanes } from '../../../src/scenes/livingWorld/livingLanes.js';
import { createLivingTrips } from '../../../src/scenes/livingWorld/livingTrips.js';
import { createWayBook, WAYS_PER_FRAME } from '../../../src/systems/livingWorld/ways.js';
import { createBeyondWays, BEYOND_TILE, BEYOND_TILES_PER_FRAME, BEYOND_NEAR_PX, BEYOND_FAR_PX, BEYOND_NEAR_MARGINS, BEYOND_FAR_MARGINS } from '../../../src/systems/livingWorld/beyondWays.js';
import { ownTrip, roadChoices, templesNear, townTrips } from '../../../src/systems/livingWorld/trips.js';
import { planRoute } from '../../../src/systems/travel/travelRoute.js';
import { beyondKey, setArenaRoads } from '../../../src/world/arenaRoads.js';
import { DIR } from '../../../src/world/road/roadNetwork.js';
import { areaOfDistrict, districtOf, DISTRICT_PX, WORLD_PIXEL_SPAN, BAY_AREA_COUNT, THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { BAY_REGION_COUNT, CYRODIIL_REGION, regionOfTheatre, PROVINCE_REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { navalWireRecord, validNavalRecord, pastBayNaming } from '../../../src/systems/naval/navalWire.js';
import { shipNameBank } from '../../../src/systems/naval/shipNameBank.js';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const T = LOCATION_TYPES;
const POP = new Set([0, 1, 2, 3, 5, 6, 8]);
const populated = (t) => POP.has(t);

// ─── 1. THE SIDES OF THE BAY'S EDGE ────────────────────────────────

test('WW7-7 THE SIDES: a pixel of the Bay is the Bay\'s side, a pixel of the world\'s grid past it the land past the Bay\'s, the Eltheric Ocean\'s box and off the grid none (mutants: the Bay\'s arm, the grid\'s, the box\'s)', () => {
  assert.deepEqual([LIVING_SIDES.none, LIVING_SIDES.bay, LIVING_SIDES.beyond], [-1, 0, 1]);
  const at = (px, py) => livingSide({ px, py });
  assert.deepEqual([at(0, 0), at(999, 499), at(500, 250)], [0, 0, 0], 'the Bay\'s own');
  assert.deepEqual([at(-1, 0), at(1000, 0), at(0, -1), at(0, 500), at(2215, -371)], [1, 1, 1, 1, 1], 'past every edge');
  assert.deepEqual([at(ETHER_BOX.x0, ETHER_BOX.y0), at(ETHER_BOX.x1 - 1, ETHER_BOX.y1 - 1)], [-1, -1], 'past the Veil');
  assert.deepEqual([at(ETHER_BOX.x0 - 1, ETHER_BOX.y0), at(ETHER_BOX.x0, ETHER_BOX.y1)], [1, 1], 'beside the box');
  assert.deepEqual([at(WORLD_PIXEL_SPAN, 0), at(0, -WORLD_PIXEL_SPAN), at(-WORLD_PIXEL_SPAN + 1, 0)], [-1, -1, 1], 'off the grid, and its last pixel');
});

// ─── 2. THE INDEX PAST THE BAY ─────────────────────────────────────

/** A registry with the Bay's rows by its north edge, a list past it and a pixel provider past it (asked counted), and the
 *  roads' places the provider stands. */
function world() {
  const places = createWorldPlaces();
  const row = (mapId, px, py, o = {}) => ({ mapId, name: `P${mapId}`, px, py, type: T.TownHamlet, region: 17, w: 2, h: 2, ...o });
  places.register('bay', [row(10, 500, 1), row(11, 503, 0), row(12, 498, 3, { type: T.DungeonKeep, dungeonType: 4 })]);
  const sk = THEATRE_KEYS.indexOf('Skyrim'), [cx, cy] = districtOf(500, -3);
  const area = areaOfDistrict(sk, cx, cy), next = areaOfDistrict(THEATRE_KEYS.indexOf('HighRock'), cx, cy);
  places.register('past', [row(20, 500, -3, { area }), row(21, 505, -6, { area, type: T.TownCity })]);
  const rolled = new Map([['502,-5', { type: T.HomeFarms, area }], ['496,-8', { type: T.TownVillage, area: next }], ['501,-9', { type: T.DungeonRuin, area, dungeonType: 10 }]]);
  const asked = [];
  places.registerPixels('rolled', (px, py) => {
    if (inBay(px, py)) return null;
    asked.push(`${px},${py}`);
    const r = rolled.get(`${px},${py}`);
    return r && { mapId: 3000 + px * 7 + py * -13, name: 'R', px, py, type: r.type, area: r.area, dungeonType: r.dungeonType ?? 0, hasDungeon: r.dungeonType != null };
  });
  const roadsPlaces = [...rolled.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y, type: rolled.get(k).type }; });
  let epoch = 0, said = roadsPlaces;
  const beyond = {
    epoch: () => epoch,
    placesIn: (x0, y0, x1, y1) => [...said, { x: 500, y: 1, type: T.TownHamlet }].filter((q) => q.x >= x0 && q.x < x1 && q.y >= y0 && q.y < y1),   // a Bay pixel said too: never past the Bay's
  };
  const idx = createLivingIndex({ places, populated, peopleAt: () => 0, beyond });
  return { places, idx, area, next, asked, setEpoch: (e) => { epoch = e; }, say: (list) => { said = list; }, roadsPlaces };
}

test('WW7-7 THE INDEX PAST THE BAY: a square past the Bay is none while the roads past the Bay are unsaid; once whole its listed places and the roads\' places found on the registry - the walk\'s answer, its provider asked at those pixels alone - sorted by map id, never the Bay\'s; a square of the Bay the Bay\'s alone; the books made again when the roads are laid again (mutants: the Bay\'s filter; the bins\' filter; the roads\' places\' filter; the epoch unkept; a walk for the roads\' places)', () => {
  const w = world();
  assert.deepEqual(w.idx.townsNear(500, -3, 6), [], 'unsaid: none');
  assert.deepEqual(w.idx.dungeonsNear(500, -3, 8), []);
  assert.deepEqual(w.idx.townsIn(w.area), []);
  assert.deepEqual(w.asked, [], 'and the rolls never asked');
  const g0 = w.idx.generation();
  w.setEpoch(1);
  assert.notEqual(w.idx.generation(), g0, 'the roads laid: the generation moves');
  // PIN MOVED (WW7-9, bible/03-World/World-Wide.md): the square's own side the walk's, and across the edge the Bay's in it
  const all = w.idx.townsNear(500, -3, 6).map((t) => t.mapId), near = all.filter((id) => id !== 10 && id !== 11);
  assert.deepEqual(w.asked.sort(), ['496,-8', '501,-9', '502,-5'], 'the provider asked at the roads\' places alone - no walk of the square');
  const walk = w.places.near(500, -3, 6).filter((p) => !inBay(p.px, p.py) && populated(p.type)).map((p) => p.mapId).sort((a, b) => a - b);
  assert.deepEqual(near, walk, 'the walk\'s answer, place for place');
  assert.deepEqual(near, [20, 21, 3000 + 502 * 7 + 65, 3000 + 496 * 7 + 104].sort((a, b) => a - b), 'the listed and the rolled');
  assert.deepEqual(all.filter((id) => id === 10 || id === 11), [10, 11], 'and the Bay\'s within the square, across the edge');
  assert.deepEqual(w.idx.dungeonsNear(500, -3, 8).map((d) => [d.dungeonType, d.dungeon]), [[4, true], [10, true]], 'a lair the roads rolled: a dive\'s (PIN MOVED, WW7-9: and the Bay\'s keep across the edge)');
  // PIN MOVED (WW7-9, bible/03-World/World-Wide.md): a square of the Bay by the edge holds the towns past it once the land
  // there is laid (the land past the Bay standing - with none, the Bay's alone: ww7_cross.test.js)
  assert.deepEqual(w.idx.townsNear(500, 1, 6).map((t) => t.mapId), [10, 11, 20, 3000 + 502 * 7 + 65], 'a square of the Bay: the Bay\'s, and the land past the edge\'s in it');
  assert.deepEqual(w.idx.dungeonsNear(500, 1, 4).map((d) => d.mapId), [12]);
  // the roads laid again: a place gone from them - the books made again
  const kept = w.idx.townsNear(500, -3, 6);
  assert.equal(w.idx.townsNear(500, -3, 6), kept, 'kept while the roads stand');
  w.say(w.roadsPlaces.filter((q) => q.x !== 502));
  assert.equal(w.idx.townsNear(500, -3, 6), kept, 'the same epoch, the same book');
  w.setEpoch(2);
  assert.deepEqual(w.idx.townsNear(500, -3, 6).map((t) => t.mapId), [10, 11, 20, 21, 3000 + 496 * 7 + 104], 'laid again: asked again');
});

test('WW7-7 A PROVINCE\'S DISTRICT\'S BANDS: an area past the Bay\'s towns are its district\'s by the roads\' places, its own area\'s alone (a district a border cuts is two areas), in map-id order - none while the roads are unsaid; a Bay region\'s as before (mutants: the area\'s filter; the district\'s arm)', () => {
  const w = world();
  w.setEpoch(1);
  assert.deepEqual(w.idx.townsIn(w.area).map((t) => t.mapId), [20, 21, 3000 + 502 * 7 + 65].sort((a, b) => a - b), 'the district\'s own area');
  assert.deepEqual(w.idx.townsIn(w.next).map((t) => t.mapId), [3000 + 496 * 7 + 104], 'the other province\'s side of it');
  assert.deepEqual(w.idx.townsIn(17).map((t) => t.mapId), [10, 11], 'a Bay region\'s');
  assert.deepEqual(w.idx.townsIn(-5), [], 'no area');
  const [dx, dy] = districtOf(500, -3);
  assert.ok(500 >= dx * DISTRICT_PX - WORLD_PIXEL_SPAN && 500 < (dx + 1) * DISTRICT_PX - WORLD_PIXEL_SPAN, 'the fixture inside its district');
});

// ─── 3. THE WAYS PAST THE BAY ──────────────────────────────────────

test('WW7-7 THE WAY BOOK PAST THE BAY: a pair past the Bay waits while the roads are unsaid, then is its own planner\'s - the lower id first, the other way its reverse, kept; a pair over the edge has none; the roads laid again ask every way past the Bay again and move the generation; a way whose ground is still read waits unkept; a Bay pair the Bay\'s planner\'s; the frame renews the ground\'s reading (mutants: the wait; the edge; the flip; the epoch\'s clear; the generation; the unkept wait; the frame)', () => {
  let epoch = 0, wait = false;
  const bayAsked = [], farAsked = [];
  let frames = 0, clears = 0;
  const beyond = {
    epoch: () => epoch,
    plan: (a, b) => { farAsked.push([a.x, a.y, b.x, b.y]); return wait ? undefined : { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], kinds: ['road'] }; },
    frame: () => { frames++; },
    clear: () => { clears++; },
  };
  const book = createWayBook({ roads: () => ({ roads: 'R', tracks: 'T' }), ground: () => ({}), plan: (a, b) => { bayAsked.push([a.x, a.y]); return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] }; }, now: () => 0, beyond });
  const A = { mapId: 7, px: 1200, py: -40 }, B = { mapId: 3, px: 1210, py: -45 }, Bay = { mapId: 1, px: 990, py: 10 };
  book.frame();
  assert.equal(frames, 1, 'the frame renews the ground past the Bay\'s reading');
  assert.equal(book.wayOf(A, B), undefined, 'unsaid: it waits');
  assert.deepEqual(farAsked, [], 'nothing asked');
  epoch = 5;
  const ab = book.wayOf(A, B);
  assert.deepEqual(farAsked, [[1210, -45, 1200, -40]], 'the lower map id first');
  assert.deepEqual(ab.pixels, [{ x: 1200, y: -40 }, { x: 1210, y: -45 }], 'from the town asked first');
  assert.deepEqual(book.wayOf(B, A).pixels, [{ x: 1210, y: -45 }, { x: 1200, y: -40 }]);
  assert.equal(farAsked.length, 1, 'kept');
  // PIN MOVED (WW7-9): over the edge the window planner's too, across it (ww7_cross.test.js) - never the Bay's planner's
  assert.ok(book.wayOf(Bay, A), 'over the edge: across');
  assert.deepEqual(farAsked.at(-1), [990, 10, 1200, -40], 'the lower id first');
  farAsked.pop();
  assert.deepEqual(bayAsked, [], 'nor the Bay\'s planner asked of it');
  book.wayOf(Bay, { mapId: 2, px: 995, py: 12 });
  assert.equal(bayAsked.length, 1, 'a Bay pair the Bay\'s planner\'s');
  const g = book.generation;
  epoch = 6;
  book.frame();
  book.wayOf(A, B);
  assert.equal(farAsked.length, 2, 'laid again: asked again');
  assert.equal(clears, 1, 'the ground past the Bay read again');
  assert.equal(book.generation, g + 1, 'the generation moves (the host\'s trips with it)');
  wait = true;
  const C = { mapId: 9, px: 1300, py: -60 };
  book.frame();
  assert.equal(book.wayOf(A, C), undefined, 'its ground still read: it waits');
  wait = false;
  book.frame();
  assert.ok(book.wayOf(A, C), 'asked again, and planned');
  assert.equal(farAsked.filter((q) => q[0] === 1200 && q[2] === 1300).length, 2, 'the wait was never kept');
  // PERF-WAYS1's floor shared: past the floor no new pair past the Bay this frame (the clock reads 2 ms a pair)
  let clock = 0;
  const timed = createWayBook({ roads: () => ({ roads: 'R' }), ground: () => ({}), now: () => clock, beyond: { epoch: () => 1, plan: (a, b) => { clock += 5; return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] }; } } });
  timed.frame();
  let got = 0;
  for (let i = 0; i < 6; i++) if (timed.wayOf({ mapId: 100 + i, px: 1500 + i, py: -50 }, { mapId: 200 + i, px: 1505 + i, py: -50 })) got++;
  assert.equal(got, WAYS_PER_FRAME, 'the floor, a dear pair\'s');
});

/** A layer and a ground past the Bay: dry everywhere past the Bay but where `wet` says. */
function field(roadCells, wet = () => false) {
  const roads = new Map(), tracks = new Map();
  const stamp = (cells) => {
    for (let i = 0; i < cells.length - 1; i++) {
      const [ax, ay] = cells[i], [bx, by] = cells[i + 1];
      const dx = bx - ax, dy = by - ay;
      const bit = Object.entries({ N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] }).find(([, d]) => d[0] === dx && d[1] === dy)[0];
      const back = { N: 'S', NE: 'SW', E: 'W', SE: 'NW', S: 'N', SW: 'NE', W: 'E', NW: 'SE' }[bit];
      roads.set(beyondKey(ax, ay), (roads.get(beyondKey(ax, ay)) ?? 0) | DIR[bit]);
      roads.set(beyondKey(bx, by), (roads.get(beyondKey(bx, by)) ?? 0) | DIR[back]);
    }
  };
  stamp(roadCells);
  return { layer: { roads, tracks }, dry: (x, y) => !wet(x, y) };
}

test('WW7-7 THE WINDOW PLANNER PAST THE BAY: the one planner on a window of the world, its roads the layer\'s - a road past the Bay walked; the Bay\'s pixels never a way\'s past it; a pair the narrow window cannot join the wide one\'s, each answer a single wide ask\'s; a frame reads BEYOND_TILES_PER_FRAME tiles and a pair whose tiles wait answers undefined; the tiles read again when cleared (mutants: the Bay\'s pixels; the window\'s origin; the proof\'s bound; the tiles\' budget; a tile\'s roads)', () => {
  assert.deepEqual([BEYOND_TILE, BEYOND_TILES_PER_FRAME, BEYOND_NEAR_PX, BEYOND_FAR_PX, [...BEYOND_NEAR_MARGINS], [...BEYOND_FAR_MARGINS]], [64, 1, 21, 61, [6, 20], [6, 20, 60]]);
  // a road east past the Bay's east edge, with a kink: walked, not cut across the open ground
  const road = [];
  for (let x = 1110; x <= 1150; x++) road.push([x, -80]);
  for (let y = -81; y >= -90; y--) road.push([1150, y]);
  for (let x = 1151; x <= 1190; x++) road.push([x, -90]);
  const f = field(road);
  const bw = createBeyondWays({ layer: () => f.layer, dry: f.dry, tilesPerFrame: 1e6 });
  const way = bw.plan({ x: 1110, y: -80 }, { x: 1190, y: -90 });
  assert.ok(way && way.kinds.every((k) => k === 'road'), 'on the road all the way');
  assert.deepEqual([way.pixels[0], way.pixels.at(-1)], [{ x: 1110, y: -80 }, { x: 1190, y: -90 }], 'in the world\'s own pixels');
  assert.ok(way.pixels.some((p) => p.x === 1150 && p.y === -85), 'round the kink');
  // round the Bay's north-east corner: never on the Bay
  const open = field([]);
  const corner = createBeyondWays({ layer: () => open.layer, dry: open.dry, tilesPerFrame: 1e6 }).plan({ x: 990, y: -2 }, { x: 1002, y: 10 });
  assert.ok(corner && corner.pixels.every((p) => !inBay(p.x, p.y)), 'round the corner, off the Bay');
  // a wall of water the narrow window cannot get round (its gap 30 px north): the wide window's way, a single wide ask's
  const wall = (x, y) => x === 1500 && y > -130 && y < -60 + 40;
  const w2 = field([], wall);
  const far = createBeyondWays({ layer: () => w2.layer, dry: w2.dry, tilesPerFrame: 1e6 });
  const a = { x: 1490, y: -90 }, b = { x: 1510, y: -90 };
  const got = far.plan(a, b);
  const R = BEYOND_FAR_PX, x0 = 1490 - R, y0 = -90 - R, W = 20 + 2 * R + 1, H = 2 * R + 1;
  const water = (x, y) => x < 0 || y < 0 || x >= W || y >= H || inBay(x + x0, y + y0) || wall(x + x0, y + y0);
  const ref = planRoute({ x: a.x - x0, y: a.y - y0 }, { x: b.x - x0, y: b.y - y0 }, { roads: new Uint8Array(W * H), tracks: new Uint8Array(W * H), isWater: water, width: W, height: H, margins: BEYOND_FAR_MARGINS });
  assert.ok(got && ref, 'round the wall');
  assert.deepEqual(got.pixels, ref.pixels.map((p) => ({ x: p.x + x0, y: p.y + y0 })), 'the wide ask\'s way, to the pixel');
  assert.ok(got.pixels.some((p) => p.y <= -130), 'round its north end, past the narrow window');
  // a road the narrow window holds none of, cheaper than the open ground inside it: the wide ask's (the planner's own proof -
  // the narrow window's open way costs past two margins' worth of road, so a way outside it may beat it)
  const loop = [];
  for (let y = -200; y >= -225; y--) loop.push([2000, y]);
  for (let x = 2001; x <= 2040; x++) loop.push([x, -225]);
  for (let y = -224; y <= -200; y++) loop.push([2040, y]);
  const l = field(loop);
  const looped = createBeyondWays({ layer: () => l.layer, dry: l.dry, tilesPerFrame: 1e6 }).plan({ x: 2000, y: -200 }, { x: 2040, y: -200 });
  assert.ok(looped && looped.kinds.every((k) => k === 'road') && looped.pixels.some((p) => p.y === -225), 'round the road\'s loop, past the narrow window');
  // the tiles' budget: a pair whose window spans tiles not read yet waits a frame a tile
  const slow = createBeyondWays({ layer: () => f.layer, dry: f.dry });
  let frames = 0, answer;
  while ((answer = slow.plan({ x: 1110, y: -80 }, { x: 1190, y: -90 })) === undefined && frames < 50) { slow.frame(); frames++; }
  assert.ok(frames >= 2, `it waited a tile a frame (${frames} frames)`);
  assert.deepEqual(answer.pixels, way.pixels, 'and then planned as the unbudgeted');
  assert.ok(slow.tiles >= 3);
  slow.clear();
  assert.equal(slow.tiles, 0, 'cleared: read again');
});

// ─── 4. THE TRIPS WAIT, AND THEIR CHOICES ARE KEPT BY THE WORLD'S GENERATION ──

test('WW7-7 THE TRIPS WAIT: a town the world says waits answers every trip undefined (asked again, never lost) - its towns near never asked; a town\'s road choices and temples near are kept by the world\'s generation, made again when it moves (mutants: the wait; the choices\' generation)', () => {
  const home = { mapId: 5, px: 1200, py: -40, blocks: 4, type: 2 };
  const near = [{ mapId: 6, px: 1205, py: -40, blocks: 9, type: 0 }, { mapId: 8, px: 1210, py: -44, blocks: 4, type: 5 }];
  let asked = 0, gen = 1, waiting = true;
  const world = {
    townsNear: () => { asked++; return near; },
    routeOf: (a, b) => ({ pixels: [{ x: a.px, y: a.py }, { x: b.px, y: b.py }], kinds: ['road'] }),
    rosterOf: () => [], templeTown: (t) => t.type === 5,
    waiting: (t) => waiting && t.px > 999,
    generation: () => gen,
  };
  const res = { id: 'L5.t1', town: 5, slot: 1, job: 'merchant' };
  assert.equal(ownTrip(res, home, 3, world, { mpm: 6.5 }), undefined, 'waiting: undefined');
  assert.equal(asked, 0, 'its towns near never asked');
  assert.equal(townTrips(home, 3 * 1440, { ...world, rosterOf: () => [res] }, { mpm: 6.5, memo: new Map() }), undefined, 'the town\'s trips wait with it');
  waiting = false;
  const c1 = roadChoices(home, 'merchant', world);
  assert.equal(roadChoices(home, 'merchant', world), c1, 'kept');
  const n = asked;
  gen = 2;
  const c2 = roadChoices(home, 'merchant', world);
  assert.notEqual(c2, c1, 'the generation moved: made again');
  assert.equal(asked, n + 1);
  const t1 = templesNear(home, world);
  assert.equal(templesNear(home, world), t1);
  gen = 3;
  assert.notEqual(templesNear(home, world), t1, 'the temples near too');
});

// ─── 5. THE TRIPS' WORLD (scenes/livingWorld/livingTrips.js) ──────

test('WW7-7 THE LAND PAST THE BAY\'S WORD: the trips\' world waits a town past the Bay while the roads past the Bay about it are unlaid, never a Bay town deep in the Bay; its generation the index\'s, moving as the roads are laid again (PIN MOVED, WW7-9: the word the roads\' host\'s own, a region at a time - its build and its regions landed, ww7_cross.test.js; the whole build\'s epoch retired) (mutants: the wait\'s side; the wait\'s word)', () => {
  let build = 0, laid = false;
  setArenaRoads(null);
  const trips = createLivingTrips({ places: createWorldPlaces(), populated, peopleAt: () => 0, maps: { getClimateIndex: () => 0 }, woods: { getHeightMapValue: () => 0 }, roads: () => null,
    pastTheBay: { build: () => build, landedIn: (x0, y0, x1, y1) => (x0 >= 0 && y0 >= 0 && x1 <= 1000 && y1 <= 500) || (!!build && laid), onRegion: () => {} } });
  const far = { mapId: 1, px: 1200, py: -40 }, bay = { mapId: 2, px: 200, py: 240 };
  assert.deepEqual([trips.world.waiting(far), trips.world.waiting(bay)], [true, false], 'unlaid: the town past the Bay waits, the Bay\'s never');
  const g = trips.world.generation();
  build = 1; laid = true;
  assert.equal(trips.world.waiting(far), false, 'laid: it sets out');
  assert.notEqual(trips.world.generation(), g, 'the generation moves with the build');
  assert.equal(trips.world.generation, trips.index.generation);
  const w = hostText('src/scenes/world.js');
  assert.match(w, /, marketBandOf: townEcon\.marketBandOf, pastTheBay: _tamrielRoads \}\);/, 'the host hands the roads past the Bay\'s host');
  assert.ok(w.indexOf('const { _tamrielRoads,') < w.indexOf('= createLivingTrips({'), 'made before it');
  assert.doesNotMatch(w, /livingRoams|createLivingIndex\(|createWayBook\(/, 'the host builds neither the index nor the ways');
  assert.match(rd('src/scenes/livingWorld/livingTrips.js'), /const index = createLivingIndex\(\{ places, populated, peopleAt, beyond: pastTheBay \? \{ epoch, placesIn: pastBayPlacesIn, landedIn, landed: \(\) => landed \} : null \}\);/);   // PIN MOVED (WW7-9)
});

test('WW7-7 THE ROLL PAST THE BAY READS A ROADS\' PLACE AS DRY: a pixel the roads past the Bay rolled a place on stands on dry ground without its plateau summed again (the same answer: the roads\' workers rolled it on that plateau) (mutant: the vouch dropped)', () => {
  const m = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(m, /ground: \(x, y\) => pastBayPlacesIn\(x, y, x \+ 1, y \+ 1\)\.length > 0 \|\| _countryGround\(x, y\) \};/);
  assert.match(m, /import \{ pastBayPlacesIn \} from '\.\.\/world\/pastBayPlaces\.js';/);
});

// ─── 6. THE SHIPS NAMED PAST THE BAY (WW7-8) ───────────────────────

test('WW7-8 THE WIRE NAMES A SHIP PAST THE BAY: `r` says her province\'s region and her names\' area where either is a province\'s - `s` the Bay\'s alone (-1 past it, for an older door) - and the reader takes both; a word without it reads as before; a malformed `r` fails the word whole (mutants: the record\'s region bound; its area bound; the reader\'s region; the reader\'s area; each door\'s bound)', () => {
  const sk = THEATRE_KEYS.indexOf('Skyrim'), skArea = areaOfDistrict(sk, 100, 80), skRegion = regionOfTheatre(sk);
  const ship = (n, region, area) => ({ n, classId: 'merchantCoaster', variant: 0, pos: [1, 2, 3], yaw: 0, speed: 1, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 77 + n, region, area });
  const word = navalWireRecord({ ships: [ship(1, 17, 17), ship(2, skRegion, skArea), ship(3, 17, skArea), ship(4, -1, -1)] });
  assert.ok(word, 'said');
  assert.deepEqual(word.s.map((s) => s[18]), [17, -1, 17, -1], '`s` the Bay\'s regions alone');
  assert.deepEqual(word.r, [[2, skRegion, skArea], [3, -1, skArea]], 'the province\'s, and a Bay crown\'s named by the waters past it');
  const back = validNavalRecord(JSON.parse(JSON.stringify(word)));
  assert.ok(back);
  assert.deepEqual(back.ships.map((s) => [s.n, s.region, s.area]), [[1, 17, undefined], [2, skRegion, skArea], [3, 17, skArea], [4, -1, undefined]]);
  // an older build's word: no `r` - the reader's own waters, as before
  const older = JSON.parse(JSON.stringify(word));
  delete older.r;
  assert.deepEqual(validNavalRecord(older).ships.map((s) => [s.region, s.area]), [[17, undefined], [-1, undefined], [17, undefined], [-1, undefined]]);
  // the door: whole or not at all
  const bad = (r) => validNavalRecord({ ...JSON.parse(JSON.stringify(word)), r });
  assert.equal(bad([[2, BAY_REGION_COUNT - 1, skArea]]), null, 'a Bay region on `r`');
  assert.equal(bad([[2, CYRODIIL_REGION + 1, skArea]]), null, 'past the provinces');
  assert.equal(bad([[2, skRegion, BAY_AREA_COUNT - 1]]), null, 'a Bay area on `r`');
  assert.equal(bad([[2, -1, -1]]), null, 'saying nothing');
  assert.equal(bad([[2, skRegion]]), null, 'short');
  assert.equal(bad([[2, skRegion, skArea, 0]]), null, 'long');
  assert.equal(bad(Array.from({ length: 9 }, (_, i) => [i, skRegion, skArea])), null, 'more than a word\'s ships');
  assert.ok(bad([[2, CYRODIIL_REGION, -1]]), 'Cyrodiil\'s, no area');
  assert.deepEqual([pastBayNaming({ region: 17, area: 17 }), pastBayNaming({ region: skRegion, area: 3 }), pastBayNaming({ region: 9, area: skArea })], [null, [skRegion, -1], [-1, skArea]]);
});

test('WW7-8 EVERY READER NAMES HER AS HER STANDER DID: a province\'s region names her by its people as any of its districts does (so `r`\'s region alone names her right), and the host keeps on her entry the area her names were drawn in, says it, and launches a peer\'s copy with it (mutants: the area unkept; unsaid; unread; the area\'s law)', () => {
  for (let t = 1; t <= PROVINCE_REGION_NAMES.length; t++) {
    const region = regionOfTheatre(t);
    for (const [cx, cy] of [[90, 80], [100, 85], [110, 90]]) assert.equal(shipNameBank(region, -1), shipNameBank(region, areaOfDistrict(t, cx, cy)), `${THEATRE_KEYS[t]}: its region's people its districts'`);
  }
  const n = rd('src/scenes/naval/navalHost.js');
  const law = /const namesArea = (\(spec, w\) => [^\n]*);\n/.exec(n);
  assert.ok(law, 'the law beside watersShipNames');
  const namesArea = new Function(`return ${law[1]};`)();
  assert.deepEqual([namesArea({ area: 300 }, { area: 400 }), namesArea({ region: 17 }, { area: 400 }), namesArea({}, { area: 400 }), namesArea({ region: -1 }, { area: 400 }), namesArea({}, {})], [300, -1, 400, 400, -1]);
  assert.match(n, /const area = namesArea\(spec, w\), names = ether \? etherShipNames\(cls, spec\.seed\) : watersShipNames\(cls, spec\.seed, region, crown, area\);/);
  assert.match(n, /gen: Math\.max\(0, Math\.min\(NAVAL_GEN_MAX, spec\.gen \| 0\)\), region, area, deep: !!spec\.deep,/, 'kept on her entry');
  assert.match(n, /gen: e\.gen, region: e\.region, area: e\.area,/, 'said');
  assert.match(n, /yaw: w\.yaw, gen: w\.gen, region: w\.region, area: w\.area, deep: w\.deep \}, owner, w\.n\);/, 'a copy launched by the word named by it');
});

// ─── 7. ON THE FREEWARE'S WORLD ────────────────────────────────────

test('WW7-7 with ARENA2: a region of the land past the Bay laid as the roads\' workers lay it - the index\'s squares past the Bay are the registry\'s walk, place for place; the roll that reads a roads\' place as dry answers as the plateau does; every way the planner walks there on dry land off the Bay, mostly on the roads, each a single wide ask\'s (the costs logged)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace, tamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, tamrielFit, tamrielFrameInBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const C = await import('../../../src/world/tamrielCountry.js');
  const D = await import('../../../src/world/tamrielDungeons.js');
  const { arenaTemplates, arenaTemplateOf, arenaRoadTowns } = await import('../../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { regionLattice, regionsByNearness, regionHasLand, rollSpec } = await import('../../../src/world/tamrielRoads.js');
  const { createRoadsWorkerState } = await import('../../../src/world/tamrielRoadsWorker.js');
  const { unpackArenaRoads } = await import('../../../src/world/arenaRoads.js');
  const { resetPastBayPlaces, addPastBayPlaces, unpackPastBayPlaces, pastBayPlacesIn } = await import('../../../src/world/pastBayPlaces.js');
  const { CAPITALS, capitalGates, capitalSpanPixels } = await import('../../../src/world/tamrielCapitals.js');
  const { layerByte } = await import('../../../src/world/arenaRoads.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const climate = (x, y) => maps.getClimateIndex(x, y);
    const land = C.bayLand(climate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
    const cT = C.countryTemplates(rows, isMainStoryDungeon), lT = D.lairTemplates(rows, isMainStoryDungeon), aT = arenaTemplates(rows, isMainStoryDungeon);
    // the roads' worker in this thread, one region of Skyrim's west laid
    const spec = rollSpec({ countryRates: C.countryRates(C.countryCounts(cT, climate), land), countryTemplates: cT, lairRates: C.countryRates(C.countryCounts(lT, climate), land, D.LAIR_TYPES), lairTemplates: lT, lairPools: D.lairPools(lT) });
    const lattice = regionLattice(tamrielFrameInBay());
    const region = regionsByNearness(lattice, (r) => regionHasLand(r, (x, y) => ground.getHeightMapValue(x, y)), { x: 1700, y: -350 })[0];
    const ap = arenaPixels();
    const gates = CAPITALS.flatMap((_, k) => capitalGates(k)).filter((q) => !inBay(q.x, q.y) && ground.getHeightMapValue(q.x, q.y) > WATER_BYTE);
    const f = tamrielFit();
    const inputs = { woodsBytes: bytes('WOODS.WLD'), trace: tamrielTrace(), fit: { ox: f.ox, oy: f.oy, ppu: f.ppu }, spec, inThread: true,
      nodes: [...(arenaRoadTowns({ stood: ap.stood.filter((p) => !p.pinned && arenaTemplateOf(aT, p)) }) ?? []), ...gates.map((q) => ({ x: q.x, y: q.y, type: T.TownCity }))],
      obstacles: CAPITALS.flatMap((_, k) => capitalSpanPixels(k)), gates, held: ap.stood.filter((p) => arenaTemplateOf(aT, p)).map((p) => ({ x: p.bx, y: p.by })), lattice };
    const st = createRoadsWorkerState();
    st.handle({ t: 'init', ...inputs }, () => {});
    let msg = null;
    st.handle({ t: 'build', id: 1, i: region.i, j: region.j }, (m) => { msg = m; });
    assert.ok(msg && !msg.error, msg?.error);
    const layer = unpackArenaRoads(msg.layer);
    resetPastBayPlaces();
    addPastBayPlaces(unpackPastBayPlaces(msg.places));
    // the host's rolls - the plateau, and the one reading a roads' place as dry (scenes/tamrielPlacesHost.js _pastBayAt)
    const plateau = C.createCountryGround(ground);
    const at = { climateAt: climate, heightAt: (x, y) => ground.getHeightMapValue(x, y), ground: plateau };
    const vouched = { ...at, ground: (x, y) => pastBayPlacesIn(x, y, x + 1, y + 1).length > 0 || plateau(x, y) };
    const country = { ...vouched, rates: C.countryRates(C.countryCounts(cT, climate), land), templates: cT };
    const lairs = { ...vouched, rates: C.countryRates(C.countryCounts(lT, climate), land, D.LAIR_TYPES), templates: lT };
    const { core } = region;
    const sample = pastBayPlacesIn(core.x0 + 70, core.y0 + 70, core.x1 - 70, core.y1 - 70).filter((_, i) => i % 47 === 0);
    assert.ok(sample.length > 15, `${sample.length} places sampled`);
    for (const q of sample) {
      assert.equal(plateau(q.x, q.y), true, `the roads' place at ${q.x},${q.y} on dry plateau`);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, -1]]) assert.equal(!!C.countryStandsAt(country, q.x + dx, q.y + dy), !!C.countryStandsAt({ ...country, ground: plateau }, q.x + dx, q.y + dy), 'the vouched roll the plateau\'s, beside it too');
    }
    const places = createWorldPlaces();
    places.register(BAY_SOURCE, bayPlaceRows(rows.filter((l) => l?.exterior?.exteriorData)));
    places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(aT, p), capitals: true }) });
    places.registerPixels('tesa-country', (px, py) => { if (inBay(px, py)) return null; const pick = C.countryStandsAt(country, px, py); return pick && { mapId: C.countryPlaceId(C.countryOrdinal(px, py)), name: '', px, py, type: pick.type }; });
    places.registerPixels('tesa-lairs', (px, py) => { if (inBay(px, py)) return null; const a = D.lairStandsAt(lairs, px, py); return a && { mapId: D.lairPlaceId(a.c), name: '', px, py, type: a.pick.type, hasDungeon: true }; });
    const idx = createLivingIndex({ places, populated, peopleAt: () => 0, beyond: { epoch: () => 1, placesIn: pastBayPlacesIn } });
    const homes = sample.filter((q) => populated(q.type)).slice(0, 12);
    let tNear = 0;
    for (const h of homes) {
      const a = performance.now(), near = idx.townsNear(h.x, h.y, 18).map((t) => t.mapId);
      tNear += performance.now() - a;
      const walk = places.near(h.x, h.y, 18).filter((p) => populated(p.type)).map((p) => p.mapId).sort((x, y) => x - y);
      assert.deepEqual(near, walk, `the square about ${h.x},${h.y}: the walk's, place for place`);
    }
    // the ways: every pair of a few towns' near
    const bw = createBeyondWays({ layer: () => layer, dry: (x, y) => ground.getHeightMapValue(x, y) > WATER_BYTE, tilesPerFrame: 1e6 });
    let pairs = 0, routed = 0, steps = 0, onRoad = 0, tWays = 0;
    for (const h of homes.slice(0, 6)) {
      for (const t of idx.townsNear(h.x, h.y, 14).filter((t) => t.px !== h.x || t.py !== h.y).slice(0, 4)) {
        const a = performance.now(), way = bw.plan({ x: h.x, y: h.y }, { x: t.px, y: t.py });
        tWays += performance.now() - a; pairs++;
        if (!way) continue;
        routed++;
        steps += way.kinds.length; onRoad += way.kinds.filter((k) => k !== 'open').length;
        for (const p of way.pixels.slice(1, -1)) assert.ok(!inBay(p.x, p.y) && ground.getHeightMapValue(p.x, p.y) > WATER_BYTE, `on dry land past the Bay (${p.x},${p.y})`);
        const R = BEYOND_FAR_PX, x0 = Math.min(h.x, t.px) - R, y0 = Math.min(h.y, t.py) - R, W = Math.max(h.x, t.px) + R - x0 + 1, H = Math.max(h.y, t.py) + R - y0 + 1;
        const roads = new Uint8Array(W * H), tracks = new Uint8Array(W * H), wet = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x + x0, Y = y + y0, i = y * W + x; wet[i] = inBay(X, Y) || ground.getHeightMapValue(X, Y) <= WATER_BYTE ? 1 : 0; roads[i] = layerByte(layer, 'roads', X, Y); tracks[i] = layerByte(layer, 'tracks', X, Y); }
        const ref = planRoute({ x: h.x - x0, y: h.y - y0 }, { x: t.px - x0, y: t.py - y0 }, { roads, tracks, isWater: (x, y) => x < 0 || y < 0 || x >= W || y >= H || wet[y * W + x] === 1, width: W, height: H, margins: BEYOND_FAR_MARGINS });
        assert.deepEqual(way.pixels, ref.pixels.map((p) => ({ x: p.x + x0, y: p.y + y0 })), 'a single wide ask\'s');
      }
    }
    assert.ok(routed >= pairs * 0.9 && pairs >= 12, `${routed} of ${pairs} routed`);
    assert.ok(onRoad / steps > 0.5, `${Math.round((100 * onRoad) / steps)}% of the steps on the roads past the Bay`);
    console.log(`[ww7-7] a square of eighteen past the Bay ${(tNear / homes.length).toFixed(1)} ms cold; a way ${(tWays / pairs).toFixed(1)} ms with its tiles; ${routed}/${pairs} routed, ${Math.round((100 * onRoad) / steps)}% on the roads`);
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); resetPastBayPlaces(); }
});
