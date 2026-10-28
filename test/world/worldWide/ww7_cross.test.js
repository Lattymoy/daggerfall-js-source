// WW7-9 and WW7-10 (2026-10-26, the owner: "Yes travellers to need to travel everywhere. Same for ships."; the
// coordinator's follow-up: across the Bay's edge, the land past the Bay waking a region at a time, and the sea's trade
// past the Bay; bible/03-World/World-Wide.md WW7-9, WW7-10): THE LIVING WORLD ACROSS THE BAY'S EDGE AND THE LANES THAT
// CROSS IT - the roads past the Bay's host's word of each region landed, a place waiting while the land about it is laid,
// the squares and the ways across the edge, the readers of a waiting place waiting with it; the Bay's mouths, its
// seaward water, the crossing lanes and their ways, the passages on them and the sea's trade counted past the Bay. Each pin
// mutation-checked (tools/mutants/ww7_cross.json).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTamrielRoadsHost } from '../../../src/scenes/tamrielRoadsHost.js';
import { rollSpec, REGION_APRON } from '../../../src/world/tamrielRoads.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex } from '../../../src/scenes/livingWorld/livingIndex.js';
import { createLivingLanes } from '../../../src/scenes/livingWorld/livingLanes.js';
import { createLivingTrips, landedAbout, LIVING_WAKE_PX, LIVING_AREA_WAKE_PX } from '../../../src/scenes/livingWorld/livingTrips.js';
import { createWayBook } from '../../../src/systems/livingWorld/ways.js';
import { createBeyondWays, BEYOND_FAR_PX } from '../../../src/systems/livingWorld/beyondWays.js';
import { visitorsOf, innGuestsOf, diversAt, divesIn, fallenIn, TRIP_REACH_PX, INN_REACH_PX, SEA_PACE_X, CALENDAR_MPM, CYCLE_DAYS } from '../../../src/systems/livingWorld/trips.js';
import { hideoutsOf, HIDEOUT_OFF_PX } from '../../../src/systems/livingWorld/outlaws.js';
import { bayMouths, baySeaward, crossLanes, crossLaneWay, pictureSeaMask, worldLaneWater, createWorldLanes, CROSS_BAY_PATH_PX, MOUTH_RUN_PX, CROSS_LANE_PATH_PX, BEYOND_LANE_PATH_PX, BEYOND_LANE_MAX_PX, LANE_NEAR_PX } from '../../../src/scenes/naval/worldLanes.js';
import { createTownEconHost } from '../../../src/scenes/townEconHost.js';
import { townProsperity, townKeyOf, townDayOf } from '../../../src/net/townEconLaw.js';
import { beyondKey, joinLayer, setArenaRoads } from '../../../src/world/arenaRoads.js';
import { DIR } from '../../../src/world/road/roadNetwork.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { areaOfDistrict, districtOf, DISTRICT_PX, WORLD_PIXEL_SPAN, THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { portIdOf } from '../../../src/world/worldWide/worldPorts.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { LOCATION_TYPES, CLIMATES } from '../../../src/formats/mapsFile.js';
import { NATIVE_PIXEL } from '../../../src/systems/seaRaiders.js';
import { LANE_STRAIGHT_STEPS } from '../../../src/systems/naval/seaLanes.js';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const T = LOCATION_TYPES;
const POP = new Set([0, 1, 2, 3, 5, 6, 8]);
const populated = (t) => POP.has(t);
const EMPTY_SPEC = rollSpec({ countryRates: new Map(), countryTemplates: new Map(), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() });
const bayBox = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 1000 && b.y1 <= 500;
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); setArenaRoads(null); });

// ─── 1. THE ROADS PAST THE BAY'S WORD, A REGION AT A TIME (scenes/tamrielRoadsHost.js) ──────

/** The roads' host over a stub client: its build's regions, each landed by hand. */
function roadsHost({ pending = () => 5 } = {}) {
  const starts = [];
  const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near: () => {}, pending, dispose: () => {} };
  let pixels = { stood: [] };
  const standing = { pixels: () => pixels, towns: () => [], spec: () => EMPTY_SPEC, capitals: () => false };
  const host = createTamrielRoadsHost({ terrainGen: { addArenaRoads: () => {}, roads: () => null, hasRoads: false }, woodsBytes: new Uint8Array(3), heightAt: () => 30, joinLand: () => true, onLanded: () => {}, standing, client, log: { log() {}, warn() {} } });
  const told = [];
  host.onRegion((g, b) => told.push([{ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 }, b]));
  const land = (k, r) => starts[k].onRegion(r, { roads: new Map(), tracks: new Map() }, { cached: true }, []);
  return { host, starts, told, land, move: () => { pixels = { stood: [] }; } };
}
const gridOf = (r) => ({ x0: r.gx, y0: r.gy, x1: r.core.x1 + REGION_APRON, y1: r.core.y1 + REGION_APRON });
const meets = (g, b) => g.x0 < b.x1 && b.x0 < g.x1 && g.y0 < b.y1 && b.y0 < g.y1;

test('WW7-9 THE ROADS PAST THE BAY\'S WORD, A REGION AT A TIME: the build\'s number (0 before the first, moving as one starts); a box of the Bay\'s own is always laid, a box past the Bay never before a build, and then once every region whose GRID (its core and REGION_APRON about it) meets it past the Bay has landed - a neighbour\'s apron too; each region landed told with its grid and the build; a build begun again lands nothing of the last; once the cache is asked and nothing is pending, every box (mutants: the Bay\'s box; the unbuilt; the pending\'s word; its asking; the landed kept; the apron; the told; the new build\'s slate; the last build\'s word)', async () => {
  let pending = 5;
  const h = roadsHost({ pending: () => pending });
  assert.equal(h.host.build(), 0);
  assert.equal(h.host.landedIn(10, 10, 990, 490), true, 'the Bay\'s own: always, before any build');
  assert.equal(h.host.landedIn(10, -20, 30, 5), false, 'past the Bay, before any build: never');
  h.host.frame({ x: 500, y: 250 });
  assert.equal(h.host.build(), 1, 'a build begun');
  const { regions } = h.starts[0];
  assert.ok(regions.length > 4);
  const grids = regions.map(gridOf);
  assert.ok(grids.every((g) => g.x1 - g.x0 === 1000 && g.y1 - g.y0 === 500), 'a region\'s grid the builder\'s own 1000 x 500');
  // a box past the Bay only one region's grid meets, and one a neighbour's apron meets too (that neighbour another)
  const boxes = function* () {
    for (let k = 0; k < regions.length; k++) {
      const c = regions[k].core;
      for (let y = c.y0; y < c.y1 - 10; y += 10) for (let x = c.x0; x < c.x1 - 10; x += 10) {
        const b = { x0: x, y0: y, x1: x + 10, y1: y + 10 };
        if (b.x1 <= 0 || b.y1 <= 0 || b.x0 >= 1000 || b.y0 >= 500) yield { b, k, by: grids.map((g, i) => (meets(g, b) ? i : -1)).filter((i) => i >= 0) };   // wholly past the Bay
      }
    }
  };
  let lone = null, shared = null;
  for (const q of boxes()) if (q.by.length === 1) { lone = { b: q.b, k: q.by[0] }; break; }
  for (const q of boxes()) {
    const n = q.by.find((i) => i !== q.k);
    if (q.by.length === 2 && q.by.includes(q.k) && n !== lone?.k && !meets(regions[n].core, q.b)) { shared = { b: q.b, k: q.k, n }; break; }
  }
  assert.ok(lone && shared, 'boxes found');
  const at = (b) => h.host.landedIn(b.b.x0, b.b.y0, b.b.x1, b.b.y1);
  assert.equal(at(lone), false, 'its region still to land');
  h.land(0, regions[lone.k]);
  assert.equal(at(lone), true, 'its region landed');
  assert.deepEqual(h.told, [[grids[lone.k], 1]], 'told, with its grid and the build');
  if (shared.k !== lone.k) h.land(0, regions[shared.k]);
  assert.equal(at(shared), false, 'its own core\'s region landed, a neighbour\'s apron reaches it: not yet');
  h.land(0, regions[shared.n]);
  assert.equal(at(shared), true, 'both landed');
  // the cache asked, nothing pending: every box (a region that failed let go)
  const far = grids.findIndex((g, i) => i !== lone.k && i !== shared.k && i !== shared.n);
  const fb = { x0: regions[far].core.x0 + 1, y0: regions[far].core.y0 + 1, x1: regions[far].core.x0 + 2, y1: regions[far].core.y0 + 2 };
  const farAt = () => h.host.landedIn(fb.x0, fb.y0, fb.x1, fb.y1);
  assert.equal(farAt(), bayBox(fb), 'unlanded');
  await new Promise((r) => setTimeout(r, 0));   // the cache asked
  assert.equal(farAt(), bayBox(fb), 'asked, but regions pending');
  pending = 0;
  assert.equal(farAt(), true, 'the build over: every box');
  // a build begun again: nothing of it landed, the last build's regions told no more - and nothing pending is no word
  // till the cache has been asked
  h.move();
  h.host.frame({ x: 500, y: 250 });
  assert.equal(h.host.build(), 2);
  assert.equal(at(lone), false, 'a new build: nothing landed (its cache not yet asked, though none is pending)');
  const toldBefore = h.told.length;
  h.land(0, regions[lone.k]);
  assert.equal(at(lone), false, 'the last build\'s region: not this one\'s');
  assert.equal(h.told.length, toldBefore, 'nor told');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(at(lone), true, 'its cache asked, nothing pending: whole');
  pending = 2;
  h.land(1, regions[lone.k]);
  assert.equal(at(lone), true);
  assert.deepEqual(h.told.at(-1), [grids[lone.k], 2]);
});

test('WW7-9 A BOX ACROSS THE EDGE WAITS ON THE LAND PAST THE BAY ALONE: a region whose grid meets only the box\'s Bay pixels lays nothing there (mutant: the box\'s Bay part read as the land past it)', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 195, ppu: 15.5 });   // a lattice with a row of grids beginning five pixels into the Bay
  const h = roadsHost();
  h.host.frame({ x: 500, y: 250 });
  const { regions } = h.starts[0];
  const box = { x0: 400, y0: -10, x1: 420, y1: 10 };
  const inside = regions.filter((r) => { const g = gridOf(r); return meets(g, box) && g.y0 > 0; });
  assert.ok(inside.length > 0, 'a grid that begins inside the Bay');
  for (const r of regions) if (!inside.includes(r)) h.land(0, r);
  assert.equal(h.host.landedIn(box.x0, box.y0, box.x1, box.y1), true, 'its pixels past the Bay laid; the rest is the Bay\'s own');
  assert.equal(h.host.landedIn(box.x0, box.y0, box.x1, box.y1 + 600), false, 'one reaching past the Bay\'s south edge into it: not yet');
});

// ─── 2. THE INDEX ACROSS THE EDGE (scenes/livingWorld/livingIndex.js) ──────

/** The Bay's rows by its north edge and a list past it; the land past the Bay laid where `land` says. */
function edgeWorld({ off = false } = {}) {
  const places = createWorldPlaces();
  const row = (mapId, px, py, o = {}) => ({ mapId, name: `P${mapId}`, px, py, type: T.TownHamlet, region: 17, ...o });
  places.register('bay', [row(10, 500, 1), row(11, 503, 0), row(12, 498, 3, { type: T.DungeonKeep, dungeonType: 4 })]);
  const sk = THEATRE_KEYS.indexOf('Skyrim'), [cx, cy] = districtOf(500, -3), area = areaOfDistrict(sk, cx, cy);
  places.register('past', [row(20, 500, -3, { area }), row(21, 505, -6, { area, type: T.TownCity }), row(22, 500, -40, { area })]);
  const s = { epoch: 1, land: false, landed: 0 };
  const beyond = off ? null : {
    epoch: () => s.epoch, placesIn: () => [], landed: () => s.landed,
    landedIn: (x0, y0, x1, y1) => bayBox({ x0, y0, x1, y1 }) || s.land,
  };
  return { places, idx: createLivingIndex({ places, populated, peopleAt: () => 0, beyond }), s };
}
const ids = (list) => list.map((t) => t.mapId);

test('WW7-9 THE INDEX ACROSS THE EDGE: with no land past the Bay a square of the Bay is the Bay\'s alone, to the byte; with it, a square of the Bay by the edge holds the towns past it and a square past it the Bay\'s, once the land past the Bay there is laid - none of the other side before; a region landing asks the squares again without moving the generation, a build moving it (mutants: the Bay\'s side\'s arm; the side past it\'s word; the Bay\'s bins\' side; a landing\'s squares kept; a landing moving the generation)', () => {
  const off = edgeWorld({ off: true });
  assert.deepEqual(ids(off.idx.townsNear(500, 1, 6)), [10, 11], 'no land past the Bay: the Bay\'s alone');
  assert.deepEqual(ids(off.idx.townsNear(500, -3, 6)), [], 'and nothing past it');
  const w = edgeWorld();
  assert.deepEqual(ids(w.idx.townsNear(500, 1, 6)), [10, 11], 'the land past the Bay unlaid: the Bay\'s alone');
  assert.deepEqual(ids(w.idx.townsNear(500, -3, 6)), [], 'past it: none yet');
  const g = w.idx.generation();
  w.s.land = true;
  assert.deepEqual(ids(w.idx.townsNear(500, 1, 6)), [10, 11], 'laid, but no region told: the book stands');
  w.s.landed++;
  assert.deepEqual(ids(w.idx.townsNear(500, 1, 6)), [10, 11, 20], 'a region landed: asked again - the towns past the edge in the square');
  assert.deepEqual(ids(w.idx.townsNear(500, -3, 6)), [10, 11, 20, 21], 'a square past the edge: the Bay\'s with its own');
  assert.deepEqual(ids(w.idx.dungeonsNear(500, -3, 6)), [12], 'a Bay dungeon a dive\'s across the edge');
  assert.deepEqual(ids(w.idx.townsNear(500, -40, 6)), [22], 'a square past the Bay away from the edge: its own alone');
  assert.deepEqual(ids(w.idx.townsNear(500, 250, 6)), [], 'a square of the Bay away from it: the Bay\'s');
  assert.equal(w.idx.generation(), g, 'a landing moves no generation: nothing known moved');
  w.s.epoch = 2;
  assert.notEqual(w.idx.generation(), g, 'the roads laid again: it moves');
});

// ─── 3. THE WAY BOOK ACROSS THE EDGE (systems/livingWorld/ways.js) ─────────

test('WW7-9 THE WAY BOOK ACROSS THE EDGE: with land past the Bay a pair of a Bay town and a town past it is the window planner\'s across the edge - the lower id first, kept apart, waiting while no network is drawn and asked again (the generation moving) when another is, or when the roads past the Bay are laid again; with none it has no way (mutants: the edge\'s none; the planner\'s arm; the edge said; the network\'s wait; its book kept; its generation; the build\'s clear)', () => {
  let epoch = 0;
  const asked = [];
  const beyond = { epoch: () => epoch, plan: (a, b, cross) => { asked.push([a.x, a.y, b.x, b.y, !!cross]); return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], kinds: ['road'] }; }, clear: () => {} };
  let net = { roads: 'R1', tracks: null };
  const book = createWayBook({ roads: () => net, ground: () => ({}), plan: () => ({ pixels: [] }), now: () => 0, beyond });
  const Bay = { mapId: 30, px: 500, py: 2 }, Far = { mapId: 7, px: 503, py: -10 }, Far2 = { mapId: 8, px: 510, py: -12 };
  book.frame();
  assert.equal(book.wayOf(Bay, Far), undefined, 'no build yet: it waits');
  epoch = 1;
  const w = book.wayOf(Bay, Far);
  assert.deepEqual(asked, [[503, -10, 500, 2, true]], 'the lower map id first, across the edge');
  assert.deepEqual(w.pixels, [{ x: 500, y: 2 }, { x: 503, y: -10 }], 'from the town asked first');
  book.wayOf(Far, Bay);
  book.wayOf(Far, Far2);
  assert.deepEqual(asked.map((q) => q[4]), [true, false], 'kept; a pair past the Bay its own');
  const g = book.generation;
  net = null;
  assert.equal(book.wayOf({ mapId: 31, px: 501, py: 3 }, Far), undefined, 'no network drawn: a pair across waits');
  net = { roads: 'R2', tracks: null };
  book.frame();
  book.wayOf(Bay, Far);
  book.wayOf(Far, Far2);
  assert.equal(asked.length, 3, 'another network: the pair across asked again, the pair past the Bay kept');
  assert.equal(book.generation, g + 1, 'the generation moved');
  epoch = 2;
  book.frame();
  book.wayOf(Bay, Far);
  assert.equal(asked.length, 4, 'the roads laid again: asked again');
  const none = createWayBook({ roads: () => net, ground: () => ({}), plan: () => ({ pixels: [] }), now: () => 0 });
  assert.equal(none.wayOf(Bay, Far), null, 'no land past the Bay: no way across');
});

// ─── 4. THE WINDOW PLANNER ACROSS THE EDGE (systems/livingWorld/beyondWays.js) ─────────

const BITS = { '0,-1': DIR.N, '1,-1': DIR.NE, '1,0': DIR.E, '1,1': DIR.SE, '0,1': DIR.S, '-1,1': DIR.SW, '-1,0': DIR.W, '-1,-1': DIR.NW };
/** Each step of a run of cells put at both its ends. */
const stampRun = (cells, put) => { for (let i = 0; i < cells.length - 1; i++) { const [ax, ay] = cells[i], [bx, by] = cells[i + 1]; put(ax, ay, BITS[`${bx - ax},${by - ay}`]); put(bx, by, BITS[`${ax - bx},${ay - by}`]); } };
const column = (x, y0, y1) => { const out = []; for (let y = y0; y0 <= y1 ? y <= y1 : y >= y1; y += y0 <= y1 ? 1 : -1) out.push([x, y]); return out; };

/** The Bay's network (a road at x = 500 from y = 40 up to 8, and a track at x = 600 from 40 up to 8), a crossing's
 *  join from each out to its gate eight past the edge, and the roads past the Bay on from the gates. */
function edgeField({ join = true } = {}) {
  const bayRoads = new Uint8Array(1000 * 500), bayTracks = new Uint8Array(1000 * 500);
  stampRun(column(500, 40, 8), (x, y, b) => { bayRoads[y * 1000 + x] |= b; });
  stampRun(column(600, 40, 25), (x, y, b) => { bayTracks[y * 1000 + x] |= b; });
  stampRun(column(600, 25, 8), (x, y, b) => { bayRoads[y * 1000 + x] |= b; });
  const layer = joinLayer([{ meet: [500, 8], gate: [500, -8] }, { meet: [600, 8], gate: [600, -8] }]);
  if (!join) layer.join = new Map();
  const put = (x, y, b) => layer.roads.set(beyondKey(x, y), (layer.roads.get(beyondKey(x, y)) ?? 0) | b);
  stampRun(column(500, -8, -40), put);
  stampRun(column(600, -8, -40), put);
  return { bayRoads, bayTracks, layer };
}

test('WW7-9 THE WINDOW PLANNER ACROSS THE EDGE: a pair across reads its Bay pixels as the Bay\'s own ground - its drawn roads and tracks, the crossings\' joins over them, the table\'s water - and walks the Bay\'s road out by the crossing onto the road past the Bay; a pair past the Bay never walks the Bay for it; a window waits while the land under it is laid; a region landed lets its tiles go; another network reads the Bay\'s tiles again (mutants: the Bay\'s tiles\' book; a pair past the Bay on the Bay\'s ground; the Bay\'s water; its roads; the joins; its tracks; the land\'s word; the tiles let go; another network)', () => {
  const f = edgeField();
  let laid = true, net = { roads: f.bayRoads, tracks: f.bayTracks };
  const wet = { calls: 0, at: () => false };
  const bw = createBeyondWays({ layer: () => f.layer, dry: (x, y) => !(x === 700 && y <= -1 && y >= -30), bay: () => ({ ...net, isWater: (x, y) => { wet.calls++; return wet.at(x, y); } }), landedIn: () => laid, tilesPerFrame: 1e6 });
  const way = bw.plan({ x: 500, y: 40 }, { x: 500, y: -40 }, true);
  assert.ok(way && way.kinds.every((k) => k === 'road'), 'the Bay\'s road, the crossing\'s join and the road past the Bay - a road all the way');
  assert.ok(way.pixels.some((p) => p.x === 500 && p.y === 0) && way.pixels.some((p) => p.x === 500 && p.y === -1), 'over the edge');
  const noJoin = edgeField({ join: false });
  const bare = createBeyondWays({ layer: () => noJoin.layer, dry: () => true, bay: () => ({ roads: noJoin.bayRoads, tracks: noJoin.bayTracks, isWater: () => false }), tilesPerFrame: 1e6 }).plan({ x: 500, y: 40 }, { x: 500, y: -40 }, true);
  assert.ok(bare && bare.kinds.includes('open'), 'no join: the edge walked on the open ground');
  // the Bay's track walked; and its water: a band of it across the track the way goes round. PIN MOVED (main's RPT1026-WORLD
  // CAUSEWAY, travel/travelRoute.js pavedStep, at the fourth merge): the band once lay across the road, and a road over the
  // water is the road's now (his painter paves it) - a track is not (a ford), so the band lies across the track, and the
  // road's own crossing of it is walked, the window carrying the road's bytes the law reads
  const t = bw.plan({ x: 600, y: 40 }, { x: 600, y: -40 }, true);
  assert.ok(t && t.kinds.includes('track') && t.kinds.includes('road'), 'the Bay\'s track walked, then its road');
  const band = (x, y) => y === 30 && x >= 570 && x <= 630;
  const round = createBeyondWays({ layer: () => f.layer, dry: () => true, bay: () => ({ roads: f.bayRoads, tracks: f.bayTracks, isWater: band }), tilesPerFrame: 1e6 }).plan({ x: 600, y: 40 }, { x: 600, y: -40 }, true);
  assert.ok(round && !round.pixels.some((p) => band(p.x, p.y)), 'the Bay\'s water never stepped on');
  assert.ok(round.pixels.some((p) => p.y === 30 && (p.x < 570 || p.x > 630)), 'round the band');
  const causeway = (x, y) => y === 20 && x >= 470 && x <= 530;
  const paved = createBeyondWays({ layer: () => f.layer, dry: () => true, bay: () => ({ roads: f.bayRoads, tracks: f.bayTracks, isWater: causeway }), tilesPerFrame: 1e6 }).plan({ x: 500, y: 40 }, { x: 500, y: -40 }, true);
  assert.ok(paved && paved.pixels.some((p) => p.x === 500 && p.y === 20) && paved.kinds.every((k) => k === 'road'), 'the road over the water walked, as on the Bay (CAUSEWAY)');
  // a pair past the Bay round a wall of water by the edge: never through the Bay, though its tiles were read across
  bw.plan({ x: 700, y: 30 }, { x: 700, y: -10 }, true);
  const past = bw.plan({ x: 690, y: -5 }, { x: 710, y: -5 });
  assert.ok(past && past.pixels.every((p) => !inBay(p.x, p.y)), 'round the wall\'s far end, off the Bay');
  assert.ok(past.pixels.some((p) => p.y < -30));
  // the land's word: a window waits while it is laid
  laid = false;
  assert.equal(bw.plan({ x: 500, y: 30 }, { x: 500, y: -30 }, true), undefined, 'the land under it still being laid: it waits');
  laid = true;
  // a region landed: its tiles let go, none else
  const n = bw.tiles;
  bw.drop(500, -40, 501, -39);
  assert.equal(bw.tiles, n - 1, 'the one tile it reaches');
  bw.drop(100000, 100000, 100001, 100001);
  assert.equal(bw.tiles, n - 1, 'nothing far off');
  // another network: the Bay's tiles read again
  const c0 = wet.calls;
  bw.plan({ x: 500, y: 40 }, { x: 500, y: -40 }, true);
  assert.equal(wet.calls, c0, 'the same network: the tiles kept');
  net = { roads: new Uint8Array(f.bayRoads), tracks: f.bayTracks };
  bw.plan({ x: 500, y: 40 }, { x: 500, y: -40 }, true);
  assert.ok(wet.calls > c0, 'another network: read again');
});

// ─── 5. THE TRIPS' WORLD (scenes/livingWorld/livingTrips.js) ─────────

test('WW7-9 THE TRIPS\' WORLD WAKES A REGION AT A TIME: a place waits while the land past the Bay within LIVING_WAKE_PX of it is laid (its towns near, the ways to them and the inns on them) - a Bay town deep in the Bay never, one by its edge until the land past it is laid, one past it likewise, past the Veil never; a district\'s bands while the land under it and LIVING_AREA_WAKE_PX about is; each region landed asks the index\'s squares again and lets the planner\'s tiles go; with no land past the Bay nothing waits (mutants: the box; the wait\'s word; the side; the area\'s box; the region\'s count; its tiles)', () => {
  assert.equal(LIVING_WAKE_PX, TRIP_REACH_PX + BEYOND_FAR_PX + INN_REACH_PX);
  assert.deepEqual([LIVING_WAKE_PX, LIVING_AREA_WAKE_PX], [80, 61 + HIDEOUT_OFF_PX[1] + 1]);
  const calls = [];
  let laid = false;
  const listeners = [];
  const pastTheBay = { build: () => 1, landedIn: (x0, y0, x1, y1) => { calls.push([x0, y0, x1, y1]); return bayBox({ x0, y0, x1, y1 }) || laid; }, onRegion: (fn) => listeners.push(fn) };
  assert.equal(landedAbout(pastTheBay, 500, -40), false);
  assert.deepEqual(calls.at(-1), [420, -120, 581, 41], 'the box about it');
  const places = createWorldPlaces();
  const sk = THEATRE_KEYS.indexOf('Skyrim'), [cx, cy] = districtOf(500, -40), area = areaOfDistrict(sk, cx, cy);
  places.register('past', [{ mapId: 20, name: 'P', px: 500, py: -40, type: T.TownHamlet, area }]);
  setArenaRoads({ roads: new Map(), tracks: new Map() });
  const woods = { isTamrielGround: true, getHeightMapValue: () => 30 };
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
  const trips = createLivingTrips({ places, populated, peopleAt: () => 0, maps: { getClimateIndex: () => 0 }, woods, roads: () => net, pastTheBay });
  const w = trips.world;
  assert.equal(listeners.length, 1, 'the trips hear each region landed');
  assert.equal(w.waiting({ px: 500, py: 250 }), false, 'deep in the Bay: never');
  assert.equal(w.waiting({ px: 500, py: 40 }), true, 'by its edge: while the land past it is laid');
  assert.equal(w.waiting({ px: 500, py: -40 }), true, 'past it: likewise');
  assert.equal(w.waiting({ px: ETHER_BOX.x0 + 5, py: ETHER_BOX.y0 + 5 }), false, 'past the Veil: no living world to wait for');
  assert.equal(w.waitingArea(17), false, 'a Bay region\'s bands: never');
  calls.length = 0;
  assert.equal(w.waitingArea(area), true, 'a district\'s: while its land is laid');
  const x0 = cx * DISTRICT_PX - WORLD_PIXEL_SPAN - LIVING_AREA_WAKE_PX, y0 = cy * DISTRICT_PX - WORLD_PIXEL_SPAN - LIVING_AREA_WAKE_PX;
  assert.deepEqual(calls, [[x0, y0, x0 + DISTRICT_PX + 2 * LIVING_AREA_WAKE_PX, y0 + DISTRICT_PX + 2 * LIVING_AREA_WAKE_PX]], 'the district and its bands\' reach');
  assert.deepEqual(trips.index.townsNear(500, -40, 6), [], 'its square unlaid');
  laid = true;
  assert.equal(w.waiting({ px: 500, py: 40 }), false, 'laid: it sets out');
  assert.equal(w.waitingArea(area), false);
  assert.deepEqual(trips.index.townsNear(500, -40, 6), [], 'no region told: the book stands');
  // a pair across the edge: the Bay's own ground, its land's word asked
  let across;
  for (let i = 0; i < 20 && (across = trips.beyond.plan({ x: 300, y: 10 }, { x: 300, y: -10 }, true)) === undefined; i++) trips.beyond.frame();
  assert.ok(across && across.pixels.some((q) => q.y >= 0) && across.pixels.some((q) => q.y < 0), 'across, on the Bay\'s own table and the land past it');
  laid = false;
  trips.beyond.frame();
  assert.equal(trips.beyond.plan({ x: 301, y: 10 }, { x: 301, y: -10 }, true), undefined, 'its tiles read, but the land unlaid: it waits');
  laid = true;
  // a region told: the squares asked again, the planner's tiles let go
  trips.beyond.frame();
  trips.beyond.plan({ x: 500, y: -40 }, { x: 505, y: -40 });
  const n = trips.beyond.tiles;
  assert.ok(n > 0);
  listeners[0]({ x0: 400, y0: -100, x1: 600, y1: 0 }, 1);
  assert.deepEqual(trips.index.townsNear(500, -40, 6).map((t) => t.mapId), [20], 'asked again');
  assert.ok(trips.beyond.tiles < n, 'the tiles it reached let go');
  const off = createLivingTrips({ places, populated, peopleAt: () => 0, maps: { getClimateIndex: () => 0 }, woods, roads: () => null });
  assert.deepEqual([off.world.waiting({ px: 500, py: 40 }), off.world.waiting({ px: 500, py: -40 }), off.world.waitingArea(area)], [false, false, false], 'no land past the Bay: nothing waits');
  const lt = rd('src/scenes/livingWorld/livingTrips.js');
  assert.match(lt, /const index = createLivingIndex\(\{ places, populated, peopleAt, beyond: pastTheBay \? \{ epoch, placesIn: pastBayPlacesIn, landedIn, landed: \(\) => landed \} : null \}\);/);
  assert.match(lt, /const epoch = \(\) => pastTheBay\?\.build\(\) \?\? 0;/, 'the epoch the roads\' build');
  assert.match(hostText('src/scenes/world.js'), /, marketBandOf: townEcon\.marketBandOf, pastTheBay: _tamrielRoads \}\);/, 'the host hands the roads past the Bay\'s host');
});

test('WW7-9 THE READERS OF A WAITING PLACE WAIT WITH IT: its visitors, an inn\'s guests, a dungeon\'s divers, dives and fallen - none read while it waits (pending), so none is kept short; an area\'s hideouts while it waits (mutants: each reader\'s wait)', () => {
  let asked = 0;
  const world = { townsNear: () => { asked++; return []; }, dungeonsNear: () => [], routeOf: () => null, rosterOf: () => [], waiting: () => true, waitingArea: () => true, townsIn: () => { asked++; return []; } };
  const town = { mapId: 5, px: 500, py: 40 }, o = { mpm: 6.5, memo: new Map() };
  assert.equal(visitorsOf(town, 10, world, o), undefined);
  assert.equal(innGuestsOf(town, 10, world, o), undefined);
  assert.deepEqual(diversAt(town, 10 * 1440, world, o), { divers: [], pending: true });
  assert.deepEqual(divesIn(town, 10 * 1440, 11 * 1440, world, o), { dives: [], pending: true });
  assert.deepEqual(fallenIn(town, 10 * 1440, world, o), { remains: [], pending: true });
  assert.equal(hideoutsOf(5000, world), undefined, 'the area waits: asked again');
  assert.equal(asked, 0, 'nothing read');
  const awake = { ...world, waiting: () => false, waitingArea: () => false };
  assert.deepEqual(visitorsOf(town, 10, awake, o), []);
  assert.deepEqual(innGuestsOf(town, 10, awake, o), []);
  assert.equal(diversAt(town, 10 * 1440, awake, o).pending, false);
  assert.equal(divesIn(town, 10 * 1440, 11 * 1440, awake, o).pending, false);
  assert.equal(fallenIn(town, 10 * 1440, awake, o).pending, false);
  assert.deepEqual(hideoutsOf(5000, awake), []);
  assert.ok(asked >= 6);
});

// ─── 6. THE BAY'S MOUTHS, ITS SEAWARD WATER, THE CROSSING LANES (scenes/naval/worldLanes.js) ─────────

/** A picture all open sea but a few cells of land, at the freeware's fit; the Bay's lane water its west three hundred
 *  pixels but a headland on its west edge with a lake in it, a cove joined by a corner alone and a lake inland; past the
 *  Bay the sea but a sandbar off the north edge. */
function seaWorld() {
  const w = 140, h = 130, land = new Uint8Array(w * h);
  for (let x = 44; x <= 47; x++) land[56 * w + x] = 1;   // the picture's land off the north edge, x 93..154
  setTamrielTrace({ w, h, land, province: new Uint8Array(w * h) });
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const lake = (x, y) => (x >= 605 && x <= 610 && y >= 200 && y <= 210) || (x >= 5 && x <= 8 && y >= 305 && y <= 308);
  const headland = (x, y) => x <= 20 && y >= 300 && y <= 320;
  const bayOpen = (x, y) => inBay(x, y) && ((x < 300 && !headland(x, y)) || (x === 300 && y === 150) || (x === 301 && y === 151) || lake(x, y));
  const lw = worldLaneWater({ bayOpen, water: (x, y) => !(y === -1 && x >= 200 && x <= 210), climateAt: () => CLIMATES.Ocean, beyond: () => true });
  return { bayOpen, open: lw.open, openNative: lw.openNative };
}
const port = (id, px, py, o = {}) => ({ id, name: `Port${id}`, px, py, region: 17, ...o });

test('WW7-10 THE BAY\'S MOUTHS AND ITS SEAWARD WATER: an edge pixel of the Bay\'s lane water whose run straight out is the world\'s lane water to the first picture cell clear of the Bay\'s rectangle, that cell the picture\'s open sea - none where the run meets land first or the cell is the picture\'s land; the seaward water every Bay lane pixel a boat sails to from a mouth, never round a corner of the land nor on a lake (mutants: the edges; the run\'s water; the cell still the Bay\'s; the picture\'s sea; the run\'s reach; the flood\'s water; its corner)', () => {
  const s = seaWorld();
  const mouths = bayMouths(s.bayOpen, s.open, pictureSeaMask({ w: 140, h: 130, land: (() => { const l = new Uint8Array(140 * 130); for (let x = 44; x <= 47; x++) l[56 * 140 + x] = 1; return l; })() }));
  const on = (x, y) => mouths.filter((m) => m.at[0] === x && m.at[1] === y);
  assert.deepEqual(on(50, 0).map((m) => [m.out, m.run]), [[[50, -1], [{ x: 50, y: -1 }]]], 'north: a pixel out, its cell clear');
  assert.deepEqual(on(100, 0), [], 'the picture\'s land there');
  assert.deepEqual(on(205, 0), [], 'a sandbar at the Bay\'s scale');
  const south = on(50, 499);
  assert.deepEqual(south.map((m) => [m.out, m.run.length]), [[[50, 511], 12]], 'south: out till the cell clears the rectangle');
  assert.ok(MOUTH_RUN_PX >= 12 && MOUTH_RUN_PX === 16);
  assert.deepEqual(on(0, 250).map((m) => m.out), [[-1, 250]], 'west');
  assert.deepEqual(on(999, 250), [], 'east: the Bay\'s land');
  assert.deepEqual(on(350, 0), [], 'nor where the Bay\'s water is not');
  const count = (f) => mouths.filter(f).length;
  // PIN MOVED (FIELD BUGS 2026-10-28 SEA-SQUARE): the sandbar's eleven bytes shut twelve squares - the one east of them has two
  // of its corners on it
  assert.deepEqual([count((m) => m.out[1] < 0), count((m) => m.out[1] > 499), count((m) => m.out[0] < 0), count((m) => m.out[0] > 999)], [300 - 62 - 12, 300, 500 - 21, 0], 'north, south, west (but the headland) and east');
  const sea = baySeaward(s.bayOpen, mouths);
  assert.equal(sea[250 * 1000 + 299], 1, 'the Bay\'s open water');
  assert.equal(sea[150 * 1000 + 300], 1, 'a cove joined');
  assert.equal(sea[151 * 1000 + 301], 0, 'one joined by a corner of the land alone: no boat sails there');
  assert.equal(sea[205 * 1000 + 607], 0, 'a lake');
  assert.equal(sea[306 * 1000 + 6], 0, 'a lake by the edge');
  assert.equal(sea.reduce((a, b) => a + b, 0), 300 * 500 - 21 * 21 + 1);
});

test('WW7-10 THE CROSSING LANES: each port past the Bay runs packets to its LANE_NEIGHBOURS nearest of the Bay\'s ports whose roadstead is seaward, within BEYOND_LANE_MAX_PX - each pair once, the Bay\'s port its `a`; a lane\'s way the Bay\'s water from its roadstead to a mouth (no longer than CROSS_BAY_PATH_PX) and the picture\'s sea on to the far roadstead, every leg on the world\'s lane water; none from a lake (mutants: the seaward ports; the reach; the neighbours; the order; the key\'s ends; the mouth\'s goal; the Bay\'s leg\'s water; its corner; its bound; the far leg; the straightening\'s water)', () => {
  const s = seaWorld();
  const mouths = bayMouths(s.bayOpen, s.open, pictureSeaMask({ w: 140, h: 130, land: new Uint8Array(140 * 130) }));
  const sea = baySeaward(s.bayOpen, mouths);
  const A = port(250300, 300, 250), A2 = port(240300, 300, 240), L = port(205611, 611, 205), B = port(400100, 100, 400), E = port(306009, 9, 306);
  const P1 = port(2000001, -50, 250), P2 = port(2000002, -900, 250), P3 = port(2000003, 150, -100);
  const lanes = crossLanes([P3, P1, P2], [L, E, A, A2], s.open, s.bayOpen, sea);
  assert.deepEqual(lanes.map((l) => l.key), ['250300-2000001', '240300-2000001', '240300-2000003', '250300-2000003'], 'the far ports in id order, each its two nearest seaward Bay ports, the nearer first');
  assert.ok(lanes.every((l) => l.cross && inBay(l.a.px, l.a.py) && !inBay(l.b.px, l.b.py)), 'the Bay\'s port a');
  assert.deepEqual(lanes[0].a.road, { x: 299, y: 250 });
  assert.ok(!lanes.some((l) => l.a.id === E.id), 'the lake by the edge, nearest of all to P1, sails nowhere');
  assert.deepEqual(crossLanes([P1], [A, A2], s.open, s.bayOpen, sea, 349).map((l) => l.key), [], 'out of reach');
  assert.equal(BEYOND_LANE_MAX_PX, 400);
  const way = crossLaneWay(lanes[0], { bayOpen: s.bayOpen, openNative: s.openNative, mouths });
  assert.ok(way, 'the Bay\'s water out to a mouth, the picture\'s sea on');
  const first = way.pts[0], last = way.pts.at(-1);
  assert.deepEqual([first.x / NATIVE_PIXEL, 500 - first.z / NATIVE_PIXEL], [299.5, 250.5], 'from the Bay port\'s roadstead');
  assert.ok(Math.abs(last.x / NATIVE_PIXEL + 49.5) < 1e-6 && Math.abs(500 - last.z / NATIVE_PIXEL - 249.5) < 1e-6, 'to the far one\'s');
  for (let i = 1; i < way.pts.length; i++) {
    const a = way.pts[i - 1], b = way.pts[i];
    const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS));
    for (let k = 1; k < n; k++) assert.ok(s.openNative(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n), `leg ${i} on the lane water`);
  }
  let len = 0;
  for (let i = 1; i < way.pts.length; i++) len += Math.hypot(way.pts[i].x - way.pts[i - 1].x, way.pts[i].z - way.pts[i - 1].z) * (819.2 / NATIVE_PIXEL);
  assert.ok(Math.abs(way.len - len) < 1e-6 && way.len > 349 * 819, 'its length its legs\'');
  const north = crossLaneWay(lanes[2], { bayOpen: s.bayOpen, openNative: s.openNative, mouths });
  assert.ok(north && north.pts.some((p) => 500 - p.z / NATIVE_PIXEL < 0 && p.x / NATIVE_PIXEL > 0), 'P3\'s out by the north');
  assert.equal(crossLaneWay({ a: { ...L, road: { x: 610, y: 205 } }, b: lanes[0].b }, { bayOpen: s.bayOpen, openNative: s.openNative, mouths }), null, 'from a lake: none');
  assert.equal(crossLaneWay({ a: { ...E, road: { x: 8, y: 306 } }, b: lanes[0].b }, { bayOpen: s.bayOpen, openNative: s.openNative, mouths }), null, 'from the lake by the edge, a step of land from the sea: none');
  assert.equal(CROSS_BAY_PATH_PX, 400);
  assert.equal(crossLaneWay(lanes[0], { bayOpen: s.bayOpen, openNative: s.openNative, mouths: mouths.filter((m) => m.at[1] === 0) }) === null, false, 'the north\'s mouths alone: within the bound');
  assert.equal(crossLaneWay({ a: { ...B, road: { x: 99, y: 400 } }, b: lanes[2].b }, { bayOpen: s.bayOpen, openNative: s.openNative, mouths: mouths.filter((m) => m.at[0] === 0 && m.at[1] < 10) }), null, 'the only mouth past its bound: none');
});

test('WW7-10 THE WORLD\'S LANES ACROSS THE EDGE: the crossing lanes are the book\'s - after the Bay\'s and the ones past it - made on the picture that stands (none without one), made again as the world\'s ports move; a crossing lane\'s way the crossing law\'s, kept once; a player near one within the ellipse of its longest way (mutants: the book\'s list; the way\'s arm; its keeping; the near\'s law; no picture)', () => {
  const s = seaWorld();
  const A = port(250300, 300, 250), A2 = port(240300, 300, 240);
  const dict = new Map([[A.id, { id: A.id, regionIndex: 17, mapIndex: 0 }], [A2.id, { id: A2.id, regionIndex: 17, mapIndex: 1 }]]);
  let v = 'v1';
  const far = [port(2000001, -50, 250, { area: 600 })];
  const ports = { list: () => far, version: () => v };
  const bayOpenNative = (x, z) => s.bayOpen(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL));
  const make = () => createWorldLanes({ mapDict: () => dict, maps: { getRegion: () => ({ mapNames: ['A', 'A2'] }), getClimateIndex: () => CLIMATES.Ocean }, portIds: [A.id, A2.id], ports, bayOpen: s.bayOpen, bayOpenNative, water: (x, y) => !(y === -1 && x >= 200 && x <= 210), beyond: () => true });
  const wl = make();
  const cross = wl.cross();
  assert.deepEqual(cross.map((l) => l.key), ['250300-2000001', '240300-2000001']);
  assert.equal(wl.cross(), cross, 'kept while nothing moves');
  assert.deepEqual(wl.all().map((l) => l.key), [...wl.bay().map((l) => l.key), ...cross.map((l) => l.key)], 'the Bay\'s, the ones past it (none), then the crossing');
  const way = wl.way(cross[0]);
  assert.deepEqual(way, crossLaneWay(cross[0], { bayOpen: s.bayOpen, openNative: worldLaneWater({ bayOpen: s.bayOpen, water: (x, y) => !(y === -1 && x >= 200 && x <= 210), climateAt: () => CLIMATES.Ocean, beyond: () => true }).openNative, mouths: bayMouths(s.bayOpen, s.open, pictureSeaMask({ w: 140, h: 130, land: (() => { const l = new Uint8Array(140 * 130); for (let x = 44; x <= 47; x++) l[56 * 140 + x] = 1; return l; })() })) }), 'the crossing law\'s');
  assert.equal(wl.way(cross[0]), way, 'kept once');
  assert.equal(CROSS_LANE_PATH_PX, CROSS_BAY_PATH_PX + MOUTH_RUN_PX + BEYOND_LANE_PATH_PX);
  const l = cross[0], d = Math.hypot(l.a.road.x - l.b.road.x, l.a.road.y - l.b.road.y);
  const edge = (CROSS_LANE_PATH_PX + 2 * LANE_NEAR_PX - d) / 2;   // straight out from the Bay's end, away from the far one
  assert.equal(wl.near(l, { x: l.a.road.x + edge - 0.5, y: l.a.road.y }), true, 'within its ellipse');
  assert.equal(wl.near(l, { x: l.a.road.x + edge + 0.5, y: l.a.road.y }), false, 'past it');
  v = 'v2';
  const again = wl.cross();
  assert.notEqual(again, cross, 'the ports moved: made again');
  assert.ok(wl.all().includes(again[0]), 'and the book with them');
  setTamrielTrace({ w: 140, h: 130, land: (() => { const l = new Uint8Array(140 * 130); for (let x = 44; x <= 47; x++) l[56 * 140 + x] = 1; return l; })(), province: new Uint8Array(140 * 130) });
  const third = wl.cross();
  assert.notEqual(third, again, 'a new picture: made again');
  assert.ok(wl.all().includes(third[0]) && !wl.all().includes(again[0]), 'and the book with it, the lanes past the Bay unmoved');
  setTamrielTrace(null);
  assert.deepEqual(make().cross(), [], 'no picture: no mouth known, no crossing');
});

// ─── 7. THE PASSAGES ACROSS AND THE SEA'S TRADE PAST THE BAY ─────────

test('WW7-9 A PASSAGE ACROSS THE EDGE: a port town\'s lanes are those to a port of its own side and the crossing lanes - a Bay port town\'s across to a town past the Bay, and back (mutant: the crossing\'s lane refused)', () => {
  const bay = { mapId: 250300, px: 300, py: 250 }, far = { mapId: 77, px: -50, py: 250 }, bay2 = { mapId: 240300, px: 300, py: 240 };
  const byPort = new Map([[portIdOf(bay), bay], [portIdOf(far), far], [portIdOf(bay2), bay2]]);
  const lanes = [{ key: 'b', a: { id: portIdOf(bay2) }, b: { id: portIdOf(bay) } }, { key: 'x', a: { id: portIdOf(bay) }, b: { id: portIdOf(far) }, cross: true }];
  const ll = createLivingLanes({ lanes: () => lanes, way: (lane) => ({ len: lane.key === 'x' ? 300000 : 9000 }), townOfPort: (id) => byPort.get(id) ?? null, sailorsOf: () => [], generation: () => 1 });
  assert.deepEqual(ll.from(bay).map((l) => [l.key, l.to.mapId, l.len]), [['b', 240300, 9000], ['x', 77, 300000]]);
  assert.deepEqual(ll.from(far).map((l) => [l.key, l.to.mapId]), [['x', 250300]]);
});

test('WW7-10 THE SEA\'S TRADE PAST THE BAY: a port\'s lanes are counted off the world\'s lanes, counted again only when they move; a Bay port counts the Bay\'s alone (a lane across the edge is no Bay port\'s: its economy every client\'s), a port past the Bay every lane it runs - past the Bay and across (mutants: counted every reading; counted once for good; the Bay\'s end of a crossing counted)', () => {
  const towns = new Map([[11, { name: 'Bayport', px: 300, py: 250, region: 17, type: 0, location: 1 }], [12, { name: 'Farport', px: -50, py: 250, region: 64, type: 0, location: -2 }]]);
  let reads = 0;
  const end = (px, py) => ({ get px() { reads++; return px; }, py });
  const bayLane = { a: end(300, 250), b: end(300, 240) }, pastLane = { a: end(-50, 250), b: end(150, -100) }, crossLane = { a: end(300, 250), b: end(-50, 250), cross: true };
  let lanes = [bayLane, pastLane, crossLane];
  const door = { econ: async () => ({ ok: true, data: { towns: [] } }), witness: async () => ({ ok: true, data: {} }), watch: async () => ({ ok: true, data: {} }), me: () => 'acct-me' };
  const host = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => [], raidedAt: () => false, nowMs: () => 1_800_000_000_000,
    locAt: () => null, portLanes: () => lanes, door, storage: null });
  const day = townDayOf(1_800_000_000_000);
  const p = (id, n) => townProsperity({ key: townKeyOf(towns.get(id).px, towns.get(id).py), type: 0, day, lanes: n });
  assert.equal(host.prosperityOf(11), p(11, 1), 'the Bay\'s port: its Bay lane alone');
  assert.equal(host.prosperityOf(12), p(12, 2), 'the port past the Bay: its lane past it and the crossing');
  const r = reads;
  host.prosperityOf(11); host.prosperityOf(12);
  assert.equal(reads, r, 'counted once while they stand');
  lanes = [bayLane, crossLane];
  assert.equal(host.prosperityOf(12), p(12, 1), 'the lanes moved: counted again');
  lanes = null;
  assert.equal(host.prosperityOf(11), p(11, 0), 'none standing: none');
  assert.match(hostText('src/scenes/world.js'), /portLanes: \(\) => \(_lanesReady && mapDict \? worldLanes\.all\(\) : null\) \}\);/, 'the world\'s lanes');
});

// ─── 8. ON THE FREEWARE'S WORLD ──────────────────────────────────

test('WW7-10 with ARENA2: the freeware\'s Bay opens on the sea past it at its north, south and west edges; its crossing lanes (Northpoint, Hegathe and Gilane to the Bay\'s seaward ports) each find a way - the Bay\'s water to a mouth, the picture\'s sea on, every leg on the world\'s lane water, none on a lake - and a passage on them fits the cycles it fits (the costs logged)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { tamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { bayLanePorts, beyondLaneWay } = await import('../../../src/scenes/naval/worldLanes.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { createWorldPorts } = await import('../../../src/world/worldWide/worldPorts.js');
  const { arenaPixels, pastBayLakeAt, pictureLakes } = await import('../../../src/world/arenaPlaces.js');
  const { arenaPlaceId, ARENA_TEMPLATE_KINDS } = await import('../../../src/world/arenaLocations.js');
  const { laneNetwork } = await import('../../../src/systems/naval/seaLanes.js');
  const { bayToPicture } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
    const bayOpen = (x, y) => inBay(x, y) && isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)) && maps.getClimateIndex(x, y) === CLIMATES.Ocean;
    const lw = worldLaneWater({ bayOpen, water, climateAt: (x, y) => tamrielClimateAt(x, y), beyond: () => true });
    let t0 = performance.now();
    const mouths = bayMouths(bayOpen, lw.open, pictureSeaMask(tamrielTrace()));
    const seaward = baySeaward(bayOpen, mouths);
    const tSea = performance.now() - t0;
    const edges = { N: 0, S: 0, W: 0, E: 0 };
    for (const m of mouths) edges[m.at[1] === 0 ? 'N' : m.at[1] === 499 ? 'S' : m.at[0] === 0 ? 'W' : 'E']++;
    assert.ok(edges.N > 100 && edges.S > 100 && edges.W > 400 && edges.E === 0, JSON.stringify(edges));
    const bay = bayLanePorts(buildMapDict(maps), maps, PORT_LOCATION_IDS);
    const places = createWorldPlaces();
    places.register('tesa', arenaPixels().stood.map((p) => ({ mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, port: !!p.port })));
    const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y) });
    const lanes = crossLanes(ports.list(), bay, lw.open, bayOpen, seaward);
    assert.deepEqual([...new Set(lanes.map((l) => l.b.name))].sort(), ['Gilane', 'Hegathe', 'Northpoint'], 'the ports past the Bay within reach of its seaward ports');
    assert.equal(lanes.length, 6);
    t0 = performance.now();
    const ways = lanes.map((l) => crossLaneWay(l, { bayOpen, openNative: lw.openNative, mouths }));
    const tWays = performance.now() - t0;
    assert.equal(ways.filter(Boolean).length, 6, 'every one a way');
    const tr = tamrielTrace(), lakes = pictureLakes(tr);
    let off = 0, onLake = 0;
    for (const way of ways) {
      for (let i = 1; i < way.pts.length; i++) {
        const a = way.pts[i - 1], b = way.pts[i];
        const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS));
        for (let k = 1; k < n; k++) if (!lw.openNative(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)) { off++; break; }
      }
      for (const p of way.pts) { const [qx, qy] = bayToPicture(p.x / NATIVE_PIXEL, 500 - p.z / NATIVE_PIXEL); if (!inBay(p.x / NATIVE_PIXEL, 500 - p.z / NATIVE_PIXEL) && lakes[Math.floor(qy) * tr.w + Math.floor(qx)]) onLake++; }
      assert.ok(way.len <= CROSS_LANE_PATH_PX * 819.2, 'within its bound');
    }
    assert.deepEqual([off, onLake], [0, 0], 'on the lane water, off the lakes');
    // the passage's pace: a crossing at SEA_PACE_X a walker's pace, there and back with a day's stay, against each job's
    // cycle at the calendar's pace - and the lanes past the Bay alike
    const past = laneNetwork(ports.list(), lw.open, BEYOND_LANE_MAX_PX).map((l) => beyondLaneWay(l, lw.openNative)).filter(Boolean);
    const span = (len) => Math.ceil((2 * Math.ceil(len / (CALENDAR_MPM * SEA_PACE_X))) / 1440) + 2;
    const fits = (list) => Object.fromEntries(Object.entries(CYCLE_DAYS).map(([job, days]) => [job, list.filter((w) => span(w.len) <= days).length]));
    const km = (list) => list.map((w) => Math.round(w.len / 1000)).sort((a, b) => a - b);
    console.log(`[ww7-10] mouths ${mouths.length} (${JSON.stringify(edges)}), seaward ${seaward.reduce((a, b) => a + b, 0)} px, ${tSea.toFixed(0)} ms; six crossing ways ${tWays.toFixed(0)} ms; crossing km ${km(ways)} fit ${JSON.stringify(fits(ways))}; past the Bay km ${km(past)} fit ${JSON.stringify(fits(past))}`);
    assert.ok(fits(ways).pilgrim >= 2, 'a pilgrim sails the shorter crossings');
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
