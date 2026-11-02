// RPT1026-WORLD FAR-QUAY (a private report, 2026-10-24: sailing from port to port, no other port's docks stood, and most
// of the harbour office's contracts could not be done): THE FAR HARBOUR IS SOUNDED FROM THE SEA. HARBOUR-REACH sounds a
// Bay port whose own shore gives no berth out to the port law's ring, once that ground is known - and a ship come in from
// the sea to that shore was near no port (the world host looked a pixel about the player) and stood where the ring's far
// side is never built (DFU's TerrainDistance 3). Over the player's own data: the 36 such ports, their towns and their
// ground as the pixel build makes it (test/portTerrain.mjs), each port's harbour sounded through the real book
// (systems/naval/harbourBook.js) with a harbourNear assembled as the world host's (scenes/world.js navalHarbourNear: the
// town found over HARBOUR_TOWN_ORDER, its readiness read by harbourKnown), the world built about a ship at the harbour's
// own first berth and nothing farther - an unbuilt pixel's water reads as land, as navalIsWater reads it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarbourBook, portRingReach, HARBOUR_TOWN_ORDER, harbourKnown, dryPixel, harbourOf } from '../../../src/systems/naval/harbourBook.js';
import { locationSummaryAt } from '../../../src/systems/map/mapDirectory.js';
import { GLOBAL_SCALE } from '../../../src/world/meshReader.js';
import { findHarbour } from '../../../src/systems/naval/shipLife.js';
import { SEA_RING } from '../../../src/world/portSites.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { hostText } from '../../hostText.mjs';
import { portTerrain, HAS_ARENA2 } from '../../portTerrain.mjs';

const skip = !HAS_ARENA2 && 'ARENA2_PATH not set';
/** portTerrain's frame as the scene's: world metres, x east, z north - map pixel (x / 819.2, 499 - z / 819.2); a native
 *  rect (locationWorldRect's) in it is its units times GLOBAL_SCALE, as portTerrain stands its towns. */
const FRAME = { mapOrigin: { x: 0, y: 499 }, compensation: [0, 0, 0], localFromWorld: (x, z) => [x * GLOBAL_SCALE, z * GLOBAL_SCALE] };
const pixOf = (x, z) => ({ px: Math.floor(x / TERRAIN_SIZE), py: 499 - Math.floor(z / TERRAIN_SIZE) });
/** The world built `td` pixels about a ship at map pixel `ship` - an unbuilt pixel's water reads as land (navalIsWater). */
function world(t, ship, td) {
  const built = (x, z) => { const p = pixOf(x, z); return Math.max(Math.abs(p.px - ship.px), Math.abs(p.py - ship.py)) <= td; };
  return { built, isWater: (x, z, h) => built(x, z) && t.isWater(x, z, h) };
}
/** The port towns on map pixels, each its location (portTerrain's own read of it). */
function townsOf(t) {
  const out = new Map();
  for (const w of t.towns) {
    const s = locationSummaryAt(t.dict, w.px, w.py);
    out.set(`${w.px},${w.py}`, { id: w.name, loc: t.maps.getLocation(s.regionIndex, s.locationIndex ?? s.mapIndex), x: w.px, y: w.py, name: w.name });
  }
  return out;
}
/** The world host's harbourNear (scenes/world.js navalHarbourNear) from a ship at `ship`: every port town walked for over
 *  HARBOUR_TOWN_ORDER, each handed as harbourOf hands it. */
function nearNow(t, towns, ship, w) {
  const near = [];
  for (const [dx, dy] of HARBOUR_TOWN_ORDER) { const town = towns.get(`${ship.px + dx},${ship.py + dy}`); if (town) near.push(town); }
  return () => near.map((town) => harbourOf(town, { state: FRAME, built: w.built, woods: t.woods }));
}
/** The law it replaced, as the world host wrote it: the 3 x 3's first port town alone, ready only where every point its
 *  scan box reads - its far edges included - is built. */
function nearThen(t, towns, ship, w) {
  let town = null;
  for (let dy = -1; dy <= 1 && !town; dy++) for (let dx = -1; dx <= 1 && !town; dx++) town = towns.get(`${ship.px + dx},${ship.py + dy}`) ?? null;
  if (!town) return null;
  const { rect, reach } = harbourOf(town, { state: FRAME, built: w.built, woods: null });
  const ready = (r = reach) => {
    const x0 = rect.minX - r, z0 = rect.minZ - r, sx = rect.maxX - rect.minX + 2 * r, sz = rect.maxZ - rect.minZ + 2 * r;
    const nx = Math.ceil(sx / 400), nz = Math.ceil(sz / 400);
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) if (!w.built(x0 + (sx * i) / nx, z0 + (sz * k) / nz)) return false;
    return true;
  };
  return () => ({ key: `port:${town.id}`, name: town.name, rect, ready, reach });
}
/** The 36 far-harbour ports and the harbour each one's whole ring sounds (FB1020c HARBOUR-REACH's own). */
function farPorts(t) {
  const out = [];
  for (const town of t.towns) {
    if (findHarbour({ rect: town.rect, isWater: t.isWater })?.berths?.length) continue;
    const whole = findHarbour({ rect: town.rect, isWater: t.isWater, reach: portRingReach(town.rect) });
    if (whole) out.push({ town, whole });
  }
  return out;
}

test('FAR-QUAY on the player\'s data: a ship at each of the 36 far harbours\' first berth, the world built 3 pixels about her - every one is sounded, to its whole ring\'s harbour exactly; before, 24 never were (near no port, another port asked in its place, or a pixel past the ring awaited) (mutants: the ring\'s band unwalked; the dry pixels unread; one town alone; the far edge read past the ring; the host unwired)', { skip }, () => {
  const t = portTerrain();
  const far = farPorts(t), towns = townsOf(t);
  assert.equal(far.length, 36);
  const missed = [], missedThen = [];
  for (const { town, whole } of far) {
    const ship = pixOf(...whole.berths[0].pos), w = world(t, ship, 3);
    const book = createHarbourBook({ harbourNear: nearNow(t, towns, ship, w), isWater: w.isWater });
    book.step(0);
    const e = book.get(`port:${town.name}`);
    if (e?.harbour) assert.deepEqual(e.harbour, whole, `${town.name}: the whole ring's harbour, to the bit`);
    else missed.push(town.name);
    const then = nearThen(t, towns, ship, w);
    const old = then && createHarbourBook({ harbourNear: then, isWater: w.isWater });
    old?.step(0);
    if (!old?.get(`port:${town.name}`)?.harbour) missedThen.push(town.name);
  }
  assert.deepEqual(missed, [], 'every far harbour sounded from its own first berth');
  // the law it replaced, from the same berths: 24 of the 36 never sounded - 7 whose first berth lies 2 pixels off the
  // town (near no port), Pencart's within a pixel of Longham (the nearest port alone was asked), and 16 whose scan's far
  // edge was read one pixel past the ring, a pixel never built from there
  assert.deepEqual(missedThen.sort(), ['Aldpath Hall', 'Blackcart Hollow', 'Bubissidata', 'Cathborne', 'Cathwold Heath', 'Chardale',
    'Chesterbrugh', 'Crossleigh', 'Daggerfall', 'Eastwold', 'Gallocart', 'Holwych', 'Isfakabi', 'Longwich End', 'Mesiton', 'Midbrugh',
    'Pencart', 'Ripmore', 'Wartry Moor', 'Wayrest', 'Wilderbury Rock', 'Wilderham', 'Wilderleigh', 'Zagoparia'], 'the law it replaced');
});

test('FAR-QUAY the town\'s walk: the 3 x 3 first, in the order the world host always walked it, then the ring\'s band out to SEA_RING - 25 pixels, each once', () => {
  assert.equal(SEA_RING, 2);
  const nine = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nine.push([dx, dy]);
  assert.deepEqual(HARBOUR_TOWN_ORDER.slice(0, 9).map((p) => [...p]), nine);
  assert.equal(HARBOUR_TOWN_ORDER.length, 25);
  assert.equal(new Set(HARBOUR_TOWN_ORDER.map((p) => p.join())).size, 25);
  assert.ok(HARBOUR_TOWN_ORDER.slice(9).every(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) === 2));
});

test('FAR-QUAY dry for certain: the open sea and a shore are not, an inland highland is, off the map never; a built pixel is known whatever it holds (mutants: every pixel dry; the dry pixels unread)', { skip }, () => {
  const t = portTerrain();
  const daggerfall = t.towns.find((w) => w.name === 'Daggerfall');
  assert.ok(daggerfall);
  assert.equal(t.openSea(daggerfall.px, daggerfall.py + 4), true, 'open sea south of Daggerfall');
  assert.equal(dryPixel(t.woods, daggerfall.px, daggerfall.py + 4), false, 'the sea');
  const whole = farPorts(t).find((f) => f.town.name === 'Daggerfall').whole;
  const berth = pixOf(...whole.berths[0].pos);
  assert.equal(dryPixel(t.woods, berth.px, berth.py), false, 'the pixel its berth lies in');
  assert.equal(dryPixel(t.woods, daggerfall.px, daggerfall.py - 2), true, 'the ring\'s far side, inland');
  assert.equal(dryPixel(t.woods, -1, 10), false, 'off the map');
  assert.equal(dryPixel(null, 10, 10), false, 'no height map');
  const none = () => null;
  assert.equal(harbourKnown(() => ({}), FRAME, t.woods, 0, 0), true, 'built: known');
  const far = (daggerfall.px + 0.5) * TERRAIN_SIZE, farZ = (499 - (daggerfall.py - 2) + 0.5) * TERRAIN_SIZE;
  assert.equal(harbourKnown(none, FRAME, t.woods, far, farZ), true, 'unbuilt and dry: known');
  const seaX = (daggerfall.px + 0.5) * TERRAIN_SIZE, seaZ = (499 - (daggerfall.py + 4) + 0.5) * TERRAIN_SIZE;
  assert.equal(harbourKnown(none, FRAME, t.woods, seaX, seaZ), false, 'unbuilt sea: unknown');
});

test('FAR-QUAY by source: the world host walks HARBOUR_TOWN_ORDER for every port town near the player and hands each as harbourOf does - its readiness by harbourKnown over the built pixels and the height map', () => {
  const W = hostText('src/scenes/world.js');
  assert.ok(W.includes('for (const [dx, dy] of isle ? [] : HARBOUR_TOWN_ORDER) {'), 'the town walked out to the ring');
  // PIN MOVED (the merge of main into #1184, 2026-10-27): the host is scenes/harbourHost.js (HOST-SPLIT) - the world host's
  // woods read live off it, and each town's keep beside its harbour (PORT-SHIPS)
  assert.ok(W.includes('return _navalHarbourAt.towns.map((t) => {\n      const h = harbourOf(t, { state, built: csaPixelAt, woods: host.woods });\n      return { ...h, keep: harbourKeep(t.loc, h.rect) };\n    });'), 'every town near, its readiness harbourOf\'s');
});

test('FAR-QUAY the readiness\'s box is half-open: built over exactly the ring\'s 25 pixels, a town is ready at the ring\'s reach - its far edges, a pixel\'s own, never read as the next pixel past it; one pixel short of the ring, it is not (mutant: the far edge read past the ring)', () => {
  const loc = { exterior: { exteriorData: { width: 2, height: 2 } } };   // a town of 2 x 2 blocks, its footprint about its pixel's middle
  const town = { id: 7, loc, x: 10, y: 489, name: 'Port' };
  const ring = (td) => (x, z) => { const p = pixOf(x, z); return Math.max(Math.abs(p.px - 10), Math.abs(p.py - 489)) <= td; };
  const h = harbourOf(town, { state: FRAME, built: ring(SEA_RING), woods: null });
  assert.equal(h.ready(), true, 'its own reach');
  assert.equal(h.ready(portRingReach(h.rect)), true, 'the ring\'s reach, the ring built');
  assert.equal(harbourOf(town, { state: FRAME, built: ring(SEA_RING - 1), woods: null }).ready(portRingReach(h.rect)), false, 'a pixel short');
  assert.deepEqual([h.key, h.name, h.reach], ['port:7', 'Port', 420]);
});

test('FAR-QUAY the book: a list of ports near the player is each sounded as the one port always was; one port alone, as ever (mutant: one town alone)', () => {
  const shore = (x, z) => z < -50;
  const A = { key: 'port:a', name: 'A', rect: { minX: -300, maxX: -100, minZ: 0, maxZ: 200 }, ready: () => true };
  const B = { key: 'port:b', name: 'B', rect: { minX: 100, maxX: 300, minZ: 0, maxZ: 200 }, ready: () => true };
  const book = createHarbourBook({ harbourNear: () => [A, B], isWater: shore });
  book.step(0);
  assert.deepEqual(book.list().map((h) => h.key), ['port:a', 'port:b']);
  const one = createHarbourBook({ harbourNear: () => A, isWater: shore });
  one.step(0);
  assert.deepEqual(one.list().map((h) => h.key), ['port:a']);
});
