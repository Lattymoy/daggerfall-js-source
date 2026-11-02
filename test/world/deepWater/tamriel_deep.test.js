// TAMRIEL-DEEP (2026-10-26, the owner: "Overhaul coastlines to properly have sand/dirt and arc into the deep, with the
// ability to slightly see through water and actually see the depth"; bible/03-World/Deep-Waters.md TAMRIEL-DEEP) - THE
// CONTINENT'S SEA CARVED BY ITS OWN BAKE. Past the Bay's edge the sea was the kernel's water over a bed a few metres down;
// the continent's frame is a bake's own now (world/tamrielWatersBake.js), built by the Bay's rules from the composed
// ground: its flood a cell at a time, seeded from the trace's own open sea (a lake the picture draws never), the Bay's
// own pixels the Bay's bake's; set on both threads when the trace lands (deepWatersClient.js setTamriel, the worker's
// 'tamriel'), asked by the host at every promote. The continent's sea carries no large-map detail, as WOODS.WLD's own
// sea carries none (world/tamriel/tamrielGround.js tamrielLargeMap) - with it not one pixel of it was the sea to the
// bound.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { WoodsFile } from '../../../src/formats/woodsFile.js';
import {
  DeepWatersBake, BAY_FRAME, floodSteps, PIXEL_SEA, PIXEL_LAND, BAKE_DISTANCE_CAP, BAKE_DISTANCE_SCALE_METERS, inFrame,
} from '../../../src/world/deepWater/deepWatersBake.js';
import { DeepWatersBakes, ETHER_FRAME, worldBakes, waterFrameOf } from '../../../src/world/etherWatersBake.js';
import { TamrielWatersBake, TAMRIEL_ROW, TAMRIEL_CELL_PX, tamrielWaterFrame, pictureOpenSeaAt } from '../../../src/world/tamrielWatersBake.js';
import { groundWoods, dropGroundCache, tamrielLargeMap } from '../../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace, tamrielTrace, IMPERIAL_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay, inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { loadDeepWatersBake, openDeepWaters } from '../../../src/world/deepWater/deepWatersClient.js';
import { createDeepWatersHost } from '../../../src/scenes/deepWater/deepWatersHost.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });

/** A raw WOODS.WLD of one height and one detail everywhere. */
function rawWoods(height = 60) {
  const N = 1000 * 500, hdr = 32 + 28 * 4, offs = N * 4, blk = 22 + 25;
  const heightOffset = hdr + offs, dataOffset = heightOffset + N;
  const bytes = new Uint8Array(dataOffset + blk);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, 4, true); v.setUint32(4, 1000, true); v.setUint32(8, 500, true); v.setUint32(28, heightOffset, true);
  for (let i = 0; i < N; i++) v.setUint32(hdr + i * 4, dataOffset, true);
  bytes.fill(height, heightOffset, heightOffset + N);
  const w = new WoodsFile();
  assert.ok(w.load(bytes));
  return w;
}
const RAW = rawWoods();
/** A 320 x 200 picture of the Imperial Province's land, its sea every row from 150 down (the picture's edge's) and a lake
 *  (picture pixels 200-209 by 60-69) inside the land. */
function picture() {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sea = y >= 150 || (x >= 200 && x < 210 && y >= 60 && y < 70);
    if (!sea) { land[y * w + x] = 1; province[y * w + x] = IMPERIAL_ID; }
  }
  return { w, h, land, province };
}
const bayPixel = (px, py) => pictureToBay(px + 0.5, py + 0.5).map(Math.floor);
const emptyBay = () => new DeepWatersBake({ woods: RAW, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } });

test('TAMRIEL-DEEP the large map follows the land: a pixel\'s detail none where the trace lays sea, kept while it stands and dropped with the ground\'s cache when a picture lands (mutants: the swell\'s cache kept)', () => {
  setTamrielFit(FIT);
  const [x, y] = bayPixel(100, 100);
  setTamrielTrace(picture());
  dropGroundCache();
  const land = tamrielLargeMap(x, y);
  assert.ok(land.some((col) => col.some((v) => v > 0)), 'detail on the land');
  assert.equal(tamrielLargeMap(x, y), land, 'kept');
  const sea = picture();
  sea.land.fill(0); sea.province.fill(0);
  setTamrielTrace(sea);
  dropGroundCache();   // as every thread does when a picture lands (terrainGenWorker, deepWatersWorker, tamrielRoadsWorker)
  assert.ok(tamrielLargeMap(x, y).every((col) => col.every((v) => v === 0)), 'the same pixel at sea: none');
});

test('TAMRIEL-DEEP the flood seeded: from the pixels `seedAt` names, whole, through the candidates - a pool beyond land unreached, where the border\'s flood reached both (mutants: the seeds the border\'s still; a seed\'s candidates unset)', () => {
  const classes = [PIXEL_SEA, PIXEL_SEA, PIXEL_LAND, PIXEL_SEA, PIXEL_SEA, PIXEL_SEA];
  const run = (seedAt) => { const it = floodSteps(6, 1, (x) => classes[x], () => new Uint8Array(8), seedAt); let r = it.next(); while (!r.done) r = it.next(); return [...r.value.state]; };
  assert.deepEqual(run((x) => x === 4), [0, 0, 0, 1, 1, 1], 'the seed\'s water alone');
  assert.deepEqual(run(null), [1, 1, 0, 1, 1, 1], 'the border\'s, as ever');
  assert.deepEqual(run(() => false), [0, 0, 0, 0, 0, 0], 'no seed, no sea');
});

test('TAMRIEL-DEEP the continent\'s bake: its open sea carved to the planes\' cap, a lake the picture draws never seeded, its coast nearer; the Bay\'s own pixels the Bay\'s bake\'s; a class kept only in its own slot (mutants: the lake seeded; the Bay\'s pixels its own; a class kept off the frame)', () => {
  setTamrielTrace(picture());
  setTamrielFit(FIT);
  const g = groundWoods(RAW), bay = { seaBits: (x, y) => (x === 500 && y === 250 ? new Uint8Array(8).fill(0xff) : new Uint8Array(8)), fullBits: () => new Uint8Array(8) };
  const b = new TamrielWatersBake({ woods: g, bay });
  assert.deepEqual(b.frame, tamrielWaterFrame());
  const [sx, sy] = bayPixel(100, 180), [lx, ly] = bayPixel(204, 64), [cx, cy] = pictureToBay(100.5, 150).map(Math.floor);   // the coast's own row
  assert.equal(pictureOpenSeaAt(sx, sy), true);
  assert.equal(pictureOpenSeaAt(lx, ly), false, 'the lake no open sea');
  assert.ok(b.seaBits(sx, sy).every((v) => v === 0xff), 'the open sea, every cell');
  assert.ok(b.seaBits(lx, ly).every((v) => v === 0), 'the lake none');
  b.prepare(sx, sy);
  assert.equal(b.sampleDistanceMeters(sx, sy, 0.5, 0.5), BAKE_DISTANCE_CAP * BAKE_DISTANCE_SCALE_METERS, 'as far from a coast as the planes see');
  assert.ok(b.isCarvedWater(sx, sy, 0.5, 0.5));
  b.prepare(cx, cy + 1);
  assert.ok(b.sampleDistanceMeters(cx, cy + 1, 0.5, 0.5) < b.sampleDistanceMeters(sx, sy, 0.5, 0.5), 'the coast nearer');
  assert.equal(b.inFrame(500, 250), false, 'the Bay\'s map is not this bake\'s');
  assert.equal(b.seaBits(500, 250)[0], 0xff, 'its sea bits the Bay\'s bake\'s');
  b.seaBits(1001, 250);   // a cell whose apron lies over the Bay's map
  for (const i of b._cls.keys()) {
    const x = (i % b.frame.w) + b.frame.x0, y = Math.floor(i / b.frame.w) + b.frame.y0;
    assert.ok(b.inFrame(x, y), `a class kept for (${x}, ${y})`);
  }
});

test('TAMRIEL-DEEP the frames: the Bay\'s on its map, the Eltheric\'s in its box, the continent\'s past the map where its bake stands, the Bay\'s else; the bakes routed by it, rows by their mark, the continent\'s set when its trace lands (mutants: the continent\'s frame over the Bay; the rows misrouted; the Bay\'s alone with the continent standing)', () => {
  setTamrielFit(FIT);
  const f = tamrielWaterFrame();
  const past = [f.x0 + 10, f.y0 + 10];
  assert.ok(!inBay(...past));
  assert.deepEqual([waterFrameOf(500, 250, true, f), waterFrameOf(...past, true, f), waterFrameOf(...past, true, null), waterFrameOf(ETHER_FRAME.x0 + 1, ETHER_FRAME.y0 + 1, true, f)], [BAY_FRAME, f, BAY_FRAME, ETHER_FRAME]);
  assert.equal(waterFrameOf(f.x0 - 1, f.y0, false, f), BAY_FRAME, 'past the frame: the Bay\'s clamp');
  const bay = emptyBay();
  assert.equal(worldBakes(bay, {}), bay, 'nothing past the Bay: the Bay\'s alone');
  const world = worldBakes(bay, { woods: RAW, continent: true });
  assert.ok(world instanceof DeepWatersBakes && world.ether === null && world.tamriel === null);
  assert.equal(world.of(...past), bay, 'before the trace lands the Bay\'s clamp');
  const calls = [];
  const stub = (name, frame) => new Proxy({ frame }, { get: (t, k) => (k === 'frame' ? t.frame : (...a) => { calls.push([name, k, ...a.slice(0, 2)]); return name; }) });
  const rowsOf = (name) => calls.find((c) => c[0] === name && c[1] === 'adoptPlanes')?.[2]?.map((r) => r.i);
  const pair = new DeepWatersBakes(stub('bay', BAY_FRAME), null, stub('tamriel', f));
  assert.deepEqual(['isWaterAt', 'holdsSea', 'exportPlanes'].map((m) => [pair[m](...past, 0.5, 0.5), pair[m](500, 250, 0.5, 0.5)]), [['tamriel', 'bay'], ['tamriel', 'bay'], ['tamriel', 'bay']]);
  calls.length = 0;
  pair.adoptPlanes([{ i: 1, f: TAMRIEL_ROW }, { i: 2 }]);
  pair.evictOutside(1, 2, 3);
  assert.deepEqual(calls.map((c) => [c[0], c[1]]), [['bay', 'adoptPlanes'], ['tamriel', 'adoptPlanes'], ['bay', 'evictOutside'], ['tamriel', 'evictOutside']]);
  assert.deepEqual([rowsOf('bay'), rowsOf('tamriel')], [[2], [1]], 'each row to its own bake');
  world.setTamriel(stub('set', f));
  assert.equal(world.of(...past).frame, f, 'set: the continent\'s');
});

test('TAMRIEL-DEEP the client: with the continent standing the bake has room for its own, set on this thread when the trace lands and told to the worker - its trace and its fit (mutants: the worker untold; the bake unset)', async () => {
  setTamrielTrace(picture());
  setTamrielFit(FIT);
  const ground = groundWoods(RAW);
  const kept = new Map(), store = { get: async (k) => kept.get(k), set: async (k, v) => { kept.set(k, v); } };
  const dw = openDeepWaters({ woods: ground, rects: [], continent: true, workerFactory: null, store });
  const b = await dw.ready;
  assert.ok(b instanceof DeepWatersBakes && !b.tamriel);
  dw.setTamriel({ trace: tamrielTrace(), fit: FIT });
  await null; await null;
  assert.ok(b.tamriel instanceof TamrielWatersBake, 'set on this thread');
  const [sx, sy] = bayPixel(100, 180);
  assert.equal(b.isWaterAt(sx, sy, 0.5, 0.5), true, 'the continent\'s sea answered');
  dw.setTamriel({ trace: null, fit: FIT });
  await null; await null;
  assert.equal(b.tamriel, null, 'gone with the trace');
  assert.ok(!((await loadDeepWatersBake({ woods: ground, rects: [], workerFactory: null, store })) instanceof DeepWatersBakes), 'not told, the Bay\'s alone');
  const said = [];
  const listening = () => { const w = { terminate() {}, postMessage(m) { said.push(m); if (m.t === 'build') queueMicrotask(() => w.onmessage({ data: { t: 'error', message: 'stop here' } })); } }; return w; };
  const dw2 = openDeepWaters({ woods: ground, woodsBytes: new Uint8Array(4), rects: [], continent: true, workerFactory: listening, store });
  dw2.setTamriel({ trace: tamrielTrace(), fit: FIT });
  await dw2.ready;
  assert.equal(said[0].continent, true, 'the build says the continent stands');
  const told = said.find((m) => m.t === 'tamriel');
  assert.ok(told && told.trace.land.length === 64000 && told.trace.land !== tamrielTrace().land && told.fit.ppu === 15.5, 'the worker told the trace (a copy) and the fit');
  const worker = src('src/world/deepWater/deepWatersWorker.js');
  assert.match(worker, /return bake\.setTamriel\?\.\(m\.trace \? new TamrielWatersBake\(\{ woods: groundWoods\(reader\), bay: bake\.bay \}\) : null\);/, 'the worker composes the continent over its own reader');
  assert.match(worker, /if \(!bake\) \{\n\s*if \(!failed\) waiting\.push\(m\);\n\s*return;\n\s*\}/, 'and holds the word until its bake is in');
});

test('TAMRIEL-DEEP the host: with the land past the Bay streaming, the continent\'s trace handed to the client once it lands and once a picture, and a pixel past the map promoted then - held before (mutants: the trace unhanded; handed every promote; the continent\'s frame unasked)', async () => {
  const pixel = (px, py) => ({ px, py, samples: new Float32Array(4), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) });
  setTamrielFit(FIT);
  const f = tamrielWaterFrame();
  const past = pixel(f.x0 + 600, f.y0 + 2500), bay = pixel(500, 250);
  const built = new Map([past, bay].map((p) => [`${p.px},${p.py}`, p]));
  const asked = [], handed = [];
  let answer;
  const client = { ready: new Promise((r) => { answer = r; }), setTamriel: (o) => handed.push(o), buildPixel: async (job) => { asked.push(`${job.px},${job.py}`); return null; } };
  const host = createDeepWatersHost({ woods: { isTamrielGround: true }, built, climateAt: () => 223, currentPixel: () => ({ x: past.px, y: past.py }), client, clock: () => 0 });
  answer({ mapPixelOrCardinalNeighborHasWaterCells: () => true });
  await host.ready;
  await host.promoteNear(past);
  assert.ok(!asked.includes(`${past.px},${past.py}`), 'no trace: held');
  assert.equal(handed.length, 0);
  setTamrielTrace(picture());
  await host.promoteNear(past);
  await host.promoteNear(bay);
  assert.equal(handed.length, 1, 'handed once');
  assert.equal(handed[0].trace, tamrielTrace());
  assert.ok(asked.includes(`${past.px},${past.py}`), 'the continent promoted');
  setTamrielTrace(picture());   // a new picture: handed again
  await host.promoteNear(past);
  assert.equal(handed.length, 2);
  const plain = createDeepWatersHost({ woods: {}, built, climateAt: () => 223, currentPixel: () => ({ x: past.px, y: past.py }), client: { ...client, ready: Promise.resolve({ mapPixelOrCardinalNeighborHasWaterCells: () => true }) }, clock: () => 0 });
  await plain.ready;
  asked.length = 0;
  await plain.promoteNear(past);
  assert.ok(!asked.includes(`${past.px},${past.py}`), 'the land past the Bay not streaming: held');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((n) => existsSync(join(ARENA2, n)));

test('TAMRIEL-DEEP (ARENA2): on the player\'s own picture the Topal Bay is carved to the planes\' cap, the Niben and the Waterfront canal carved, Hammerfell\'s lake not, and the coast\'s first pixel part sea', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit(FIT);
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const b = new TamrielWatersBake({ woods: groundWoods(woods) });
  const all = (x, y) => b.seaBits(x, y).every((v) => v === 0xff), none = (x, y) => b.seaBits(x, y).every((v) => v === 0);
  assert.ok(all(2441, 1500), 'the Topal Bay');
  b.prepare(2441, 1500);
  assert.equal(b.sampleDistanceMeters(2441, 1500, 0.5, 0.5), BAKE_DISTANCE_CAP * BAKE_DISTANCE_SCALE_METERS);
  assert.ok(all(2160, 720) && all(2300, 1000), 'Lake Rumare\'s ring and the Niben');
  assert.ok(all(2069, 676), 'the Waterfront canal');   // under IC-GRAND's twenty-five (bible/03-World/Tamriel.md NIBEN-SEA)
  assert.ok(none(1216, 224), 'Hammerfell\'s lake');
  assert.ok(!all(2441, 1441) && !none(2441, 1441), 'the coast\'s pixel part sea');
  assert.ok(TAMRIEL_CELL_PX >= 16);
  assert.ok(inFrame(b.frame, 2441, 1500));
});
