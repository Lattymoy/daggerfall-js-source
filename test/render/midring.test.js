// MID-RING (2026-10-26, the owner: "we need to find a way to expand the overworld view distance without killing
// performance. Currently tiles visibly load in with distance"; bible/07-Rendering/Performance-Priority.md MID-RING) -
// THE MIDDLE RING: the streamed kernel's own ground past the streamed grid, between it and the far ring
// (world/terrain/midRingGrid.js, render/midRing.js, render/farRing.js, the terrain worker's 'midring' job). Pinned with no
// game data, on the landforms' synthetic world (test/landformWorld.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile } from '../../src/formats/woodsFile.js';
import { generateSamples, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { createLandforms } from '../../src/world/landforms.js';
import { buildMidRingHeights, midRingNormals, midRingSide, midRingPixel, midRingBandRows, buildFarFieldBytes, farFieldCell, FAR_SAMPLES, MID_RADIUS, MID_SUB, MID_REBUILD_DRIFT } from '../../src/world/terrain/midRingGrid.js';
import { midRingVertices, midRingOrder, midRingRuns, MidRingMesh, midRingDisabled, MID_SEA_EPS } from '../../src/render/midRing.js';
import { FarRingRenderer, ringHeight, RING_RADIUS, HORIZON_BUDGET_MS } from '../../src/render/farRing.js';
import { TerrainGenClient, HORIZON_BAND_ROWS } from '../../src/world/terrain/terrainGenClient.js';
import { syntheticWoodsBytes, network } from '../landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION, WORLD = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const woods = new WoodsFile();
assert.equal(woods.load(syntheticWoodsBytes()), true);

test('MID-RING the ring\'s heights are each pixel\'s own kernel at whole samples, seams read once, with the landforms and without (mutant: the step, the row\'s pixel, the seam, the landforms)', () => {
  assert.deepEqual([MID_RADIUS, MID_SUB, MID_REBUILD_DRIFT, midRingSide()], [14, 8, 3, 233]);
  for (const landforms of [null, createLandforms({ woods, roads: network() })]) {
    const radius = 2, sub = 8, bx = 398, by = 251, side = midRingSide(radius, sub), step = (H - 1) / sub;
    const h = buildMidRingHeights({ woods, baseX: bx, baseY: by, radius, sub, landforms });
    assert.equal(h.length, side * side);
    for (let pj = 0; pj < 2 * radius + 1; pj++) {
      for (let pi = 0; pi < 2 * radius + 1; pi++) {
        const px = bx - radius + pi, py = by + radius - pj;   // gz grows north: the first row of pixels is the south's
        const s = generateSamples(woods, px, py, H, landforms);
        for (let j = 0; j <= sub; j++) {
          for (let i = 0; i <= sub; i++) {
            const got = h[(pj * sub + j) * side + pi * sub + i], want = s[(i * step) * H + j * step] * WORLD;
            assert.ok(Math.abs(got - want) < 1e-3, `pixel ${px},${py} sample ${i},${j}: ${got} against its own ${want}${landforms ? ' (landforms)' : ''}`);
          }
        }
      }
    }
  }
  // the normals are the grid's own central differences at its cell: a plane rising east tilts every normal west
  const side = 9, plane = Float32Array.from({ length: side * side }, (_, v) => (v % side) * 10);
  const n = midRingNormals(plane, side, 8), cell = TERRAIN_SIZE / 8, mid = (4 * side + 4) * 3, l = Math.hypot(20, 2 * cell);
  assert.ok(Math.abs(n[mid] + 20 / l) < 1e-6 && Math.abs(n[mid + 1] - (2 * cell) / l) < 1e-6 && Math.abs(n[mid + 2]) < 1e-9);
});

test('MID-RING the vertices: the base pixel\'s corner frame (x east, z north), each colour the bilinear of the pixel centres\' tints, the sea\'s byte at its floor (mutant: the frame, the lattice, the weights, the sea)', () => {
  const radius = 1, sub = 4, side = midRingSide(radius, sub), bx = 50, by = 60, seaY = ringHeight(0);
  const heights = new Float32Array(side * side).fill(100);
  heights[0] = seaY;
  const tintAt = (px, py) => [px - bx + 100, py - by + 100, 7];   // a pixel's tint names it
  const v = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt, seaY });
  const cell = TERRAIN_SIZE / sub;
  const at = (gx, gz) => (gz * side + gx);
  const near = (a, b) => a.every((x, k) => Math.abs(x - b[k]) < 1e-3);
  assert.ok(near([...v.positions.subarray(0, 3)], [-radius * sub * cell, seaY, -radius * sub * cell]), 'the south-west corner');
  const o = at(side - 1, side - 1) * 3;
  assert.ok(Math.abs(v.positions[o] - (radius + 1) * TERRAIN_SIZE) < 1e-3 && Math.abs(v.positions[o + 2] - (radius + 1) * TERRAIN_SIZE) < 1e-3, 'the north-east corner');
  // a vertex at a pixel's centre wears that pixel's tint alone: the base pixel's centre is (gx, gz) = (radius*sub + sub/2) both
  const c = at(radius * sub + sub / 2, radius * sub + sub / 2) * 3;
  assert.deepEqual([...v.colors.subarray(c, c + 3)], [100, 100, 7], 'the base pixel\'s centre');
  // north of the base (gz up) is the pixel py - 1; its centre
  const cn = at(radius * sub + sub / 2, (radius + 1) * sub + sub / 2) * 3;
  assert.deepEqual([...v.colors.subarray(cn, cn + 3)], [100, 99, 7], 'the pixel north of it: py - 1');
  // half way between the base's centre and its east neighbour's: their mean
  const ce = at(radius * sub + sub, radius * sub + sub / 2) * 3;
  assert.deepEqual([...v.colors.subarray(ce, ce + 3)], [101, 100, 7], 'on the seam: 100.5 rounds up');
  const q = at(radius * sub + sub / 2 + 1, radius * sub + sub / 2) * 3;
  assert.equal(v.colors[q], Math.round(100 * 0.75 + 101 * 0.25), 'a quarter of the way east');
  assert.equal(v.sea[0], 255);
  assert.equal(v.sea[1], 0);
  assert.ok(MID_SEA_EPS > 0 && MID_SEA_EPS < 1);
  assert.equal(v.normals.length, side * side * 3);
});

test('MID-RING the painter\'s order: every cell once, farthest pixel first, a pixel\'s cells farthest first along each axis; the runs cut where the stream has built (mutant: the sort, the axes, the runs)', () => {
  const radius = 2, sub = 4, side = midRingSide(radius, sub), n = 2 * radius + 1;
  const { indices, order } = midRingOrder({ baseX: 10, baseY: 10, curX: 10, curY: 10, radius, sub });
  assert.ok(indices instanceof Uint16Array, 'a ring whose vertices fit takes 16-bit indices');
  assert.equal(indices.length, n * n * sub * sub * 6);
  const seen = new Set();
  for (let k = 0; k < indices.length; k += 6) seen.add(indices[k]);
  assert.equal(seen.size, n * n * sub * sub, 'every cell once (its first corner names it)');
  const d = order.map((p) => Math.hypot(p.px - 10, p.py - 10));
  for (let k = 1; k < d.length; k++) assert.ok(d[k] <= d[k - 1] + 1e-9, 'farthest first');
  assert.equal(order.at(-1).key, '10,10', 'the traveller\'s own pixel last');
  // the pixel east of the traveller: its east cells first
  const east = order.find((p) => p.key === '12,10');
  const firstCell = indices[east.at], lastCell = indices[east.at + (sub * sub - 1) * 6];
  assert.ok(firstCell % side > lastCell % side, 'east of the traveller, east cells first');
  const north = order.find((p) => p.key === '10,8');
  assert.ok(Math.floor(indices[north.at] / side) > Math.floor(indices[north.at + (sub * sub - 1) * 6] / side), 'north of the traveller (py less), north cells first');
  // the runs
  const total = indices.length;
  assert.deepEqual(midRingRuns(order, total, () => false), [[0, total]], 'nothing built: one run');
  assert.deepEqual(midRingRuns(order, total, () => true), [], 'all built: none');
  const runs = midRingRuns(order, total, (k) => k === '10,10' || k === order[3].key);
  assert.deepEqual(runs, [[0, order[3].at], [order[4].at, order.at(-1).at - order[4].at]], 'a built pixel cuts a run, the last pixel built ends it');
  assert.ok(midRingOrder({ baseX: 0, baseY: 0, curX: 0, curY: 0 }).indices instanceof Uint16Array, 'the game\'s ring fits 16 bits (233 x 233 vertices)');
});

/** A WebGL2 stand-in that records what is made, bound and drawn. */
function fakeGl() {
  const log = { made: 0, deleted: 0, draws: [], origins: [], buffers: [] };
  let n = 0;
  const gl = new Proxy({
    TRIANGLES: 4, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
    createBuffer: () => { log.made++; return { id: ++n }; },
    createVertexArray: () => { log.made++; return { vao: ++n }; },
    deleteBuffer: () => { log.deleted++; }, deleteVertexArray: () => { log.deleted++; },
    bufferData: (target, data) => { log.buffers.push([target, data]); },
    drawElements: (mode, count, type, offset) => log.draws.push([count, type, offset]),
    uniform3f: (loc, x, y, z) => log.origins.push([loc, x, y, z]),
    getUniformLocation: (p, name) => name,
    getShaderParameter: () => true, getProgramParameter: () => true,
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { gl, log };
}

test('MID-RING the mesh: built, ordered once a pixel, its runs drawn at its origin through the pass\'s uniform, every buffer freed (mutant: the reorder key, the cut key, the byte offset, the dispose)', () => {
  const { gl, log } = fakeGl();
  const radius = 1, sub = 2, side = midRingSide(radius, sub);
  const v = midRingVertices({ heights: new Float32Array(side * side), baseX: 5, baseY: 5, radius, sub, tintAt: () => [1, 2, 3], seaY: -1 });
  const mesh = new MidRingMesh(gl);
  mesh.build(v, { baseX: 5, baseY: 5, radius, sub, curX: 5, curY: 5 });
  const uploads = log.buffers.length;
  mesh.reorder(5, 5);
  assert.equal(log.buffers.length, uploads, 'the same pixel: the order stands');
  mesh.reorder(6, 5);
  assert.equal(log.buffers.length, uploads + 1, 'a new pixel: written again');
  mesh.cut((k) => k === '6,5', 1);
  const runs = mesh.runs;
  mesh.cut(() => true, 1);
  assert.equal(mesh.runs, runs, 'the same stamp: the runs stand');
  mesh.cut((k) => k === '6,5', 2);
  mesh.draw('uOrigin', [1, 2, 3]);
  assert.deepEqual(log.origins.at(-1), ['uOrigin', 1, 2, 3]);
  assert.equal(log.draws.length, mesh.runs.length);
  for (const [k, [first, count]] of mesh.runs.entries()) assert.deepEqual(log.draws[k], [count, gl.UNSIGNED_SHORT, first * 2]);
  assert.equal(log.draws.reduce((a, d) => a + d[0], 0), (9 - 1) * sub * sub * 6, 'every cell but the built pixel\'s');
  mesh.dispose();
  assert.equal(log.deleted, log.made, 'every buffer and the vertex array let go');
  assert.equal(mesh.built, false);
});

test('MID-RING the far ring asks the middle ring of the terrain\'s worker once, holes itself for its footprint while the sea\'s fill stays the grid\'s, asks again past the drift and drops an answer it let go; no worker, no middle ring (mutant: the ask, the drift, the hole, the stale answer, the origin)', async () => {
  const { gl, log } = fakeGl();
  const asks = [];
  let answer = null;
  const mid = { midRing: (job) => { asks.push(job); return new Promise((r) => { answer = r; }); } };
  const ring = new FarRingRenderer(gl, { mid });
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150, relief: false };
  const built = new Map([['200,150', {}]]);
  ring.build(inputs, 200, 150, 5, built);
  assert.equal(asks.length, 1, 'asked at the first hole');
  assert.deepEqual(asks[0], { baseX: 200, baseY: 150, radius: MID_RADIUS, sub: MID_SUB, landform: false });
  const before = ring.ringCount;
  ring.punchHole(201, 150, 5, built);
  assert.equal(asks.length, 1, 'one ask at a time');
  const side = midRingSide();
  answer({ heights: new Float32Array(side * side).fill(50) });
  await new Promise((r) => setTimeout(r, 0));
  // the landed heights laid a frame's share at a time: a frame that never ends its budget steps once (HORIZON_BUDGET_MS)
  let frames = 0;
  ring._now = (() => { let t = 0; return () => (t += HORIZON_BUDGET_MS); })();
  while (!ring._mid?.built && frames < 100) { ring.punchHole(201, 150, 5, built); frames++; }
  assert.ok(frames > 5 && frames < 100 && ring._mid.built, `the ring's vertices laid over ${frames} frames, a step of rows a frame`);
  ring.punchHole(201, 150, 5, built);
  assert.ok(ring.ringCount < before, `the far ring holed for the middle ring's footprint (${ring.ringCount} < ${before})`);
  const cells = (2 * RING_RADIUS) ** 2 - (2 * MID_RADIUS) ** 2;
  assert.equal(ring.ringCount, cells * 6, 'every cell wholly inside the footprint left to the middle ring');
  // the draw: the far ring, then the middle ring at its base's origin
  log.draws.length = 0;
  ring.draw(new Float32Array(16), { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.ok(log.draws.length >= 2, 'the far ring and the middle ring\'s runs');
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uOrigin').at(-1), ['uOrigin', 10, 0, 20], 'the bases are one pixel: the far ring\'s origin');
  // past the drift: asked again; an answer for a base let go is dropped
  ring.punchHole(200 + MID_REBUILD_DRIFT + 1, 150, 5, built);
  assert.equal(asks.length, 2);
  ring.dispose();
  answer({ heights: new Float32Array(side * side) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ring._mid, null, 'disposed: the late answer built nothing');
  // no worker: the client answers null and the ring stands as before
  const client = new TerrainGenClient({ woods, woodsBytes: null });
  assert.equal(await client.midRing({ baseX: 0, baseY: 0, radius: 1, sub: 2 }), null);
  const lone = new FarRingRenderer(fakeGl().gl, { mid: client });
  lone.build(inputs, 200, 150, 5, built);
  await new Promise((r) => setTimeout(r, 0));
  lone.punchHole(200, 150, 5, built);
  assert.equal(lone._mid, null);
  assert.equal(midRingDisabled('?world&midring=off'), true);
  assert.equal(midRingDisabled('?world'), false);
});

test('MID-RING / FAR-FIELD the worker\'s grounds: by id and by band, transferred, the kernel\'s own and the heightmap\'s own, each pixel and cell kept across rebuilds; the client asks a band at a time and assembles them, null on an error and on the worker\'s death (mutant: the band, the kept pixel, the transfer, the error\'s null)', async () => {
  const posted = [];
  const was = { on: globalThis.onmessage, post: globalThis.postMessage };
  globalThis.postMessage = (m, t) => posted.push({ m, t });
  const side = midRingSide(1, 2);
  const whole = buildMidRingHeights({ woods, baseX: 398, baseY: 251, radius: 1, sub: 2 });
  try {
    await import('../../src/world/terrain/terrainGenWorker.js');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoodsBytes() } });
    globalThis.onmessage({ data: { t: 'midring', id: 9, baseX: 398, baseY: 251, radius: 1, sub: 2, landform: false, rows: [1, 3] } });
    const a = posted.find((p) => p.m.t === 'mid');
    assert.ok(a, JSON.stringify(posted.map((p) => p.m.t)));
    assert.equal(a.m.id, 9);
    assert.deepEqual(a.t, [a.m.heights.buffer], 'transferred');
    assert.deepEqual([...a.m.heights], [...whole.subarray(2 * side)], 'the band of pixel rows 1-2: vertex rows 2 to the last');
    globalThis.onmessage({ data: { t: 'midring', id: 10, baseX: 398, baseY: 251, radius: 1e9, sub: 2 } });
    assert.equal(posted.at(-1).m.t, 'midError');
    // the far field: a band of its rows, each cell its highest sample and its count of the sea's floor
    globalThis.onmessage({ data: { t: 'farfield', id: 11, baseCX: 50, baseCY: 31, radius: 2, cell: 8, seaByte: 3, rows: [0, 5] } });
    const f = posted.at(-1);
    assert.equal(f.m.t, 'far');
    assert.deepEqual(f.t, [f.m.high.buffer, f.m.low.buffer]);
    const ref = buildFarFieldBytes({ woods, baseCX: 50, baseCY: 31, radius: 2, cell: 8, seaByte: 3 });
    assert.deepEqual([[...f.m.high], [...f.m.low]], [[...ref.high], [...ref.low]]);
    const [m0, n0] = farFieldCell(woods, 48, 29, 8, 3);
    let m = 0, n = 0;
    for (const v of FAR_SAMPLES) for (const u of FAR_SAMPLES) { const byte = woods.getHeightMapValue(48 * 8 + u, 29 * 8 + v); m = Math.max(m, byte); if (byte <= 3) n++; }
    assert.deepEqual([m0, n0], [m, n], 'a cell: its samples\' highest byte and how many are the sea\'s floor');
    assert.equal(ref.high[0], m0, 'the north-west cell first');
  } finally { globalThis.onmessage = was.on; globalThis.postMessage = was.post; }
  // the pixel kept: a second ring over the same pixels asks the kernel no more
  let made = 0;
  const kept = new Map();
  const pixel = (px, py) => { const k = `${px},${py}`; if (!kept.has(k)) { made++; kept.set(k, midRingPixel(woods, px, py, 2)); } return kept.get(k); };
  const one = buildMidRingHeights({ woods, baseX: 398, baseY: 251, radius: 1, sub: 2, pixel });
  assert.equal(made, 9);
  const two = buildMidRingHeights({ woods, baseX: 399, baseY: 251, radius: 1, sub: 2, pixel });
  assert.equal(made, 12, 'drifted a pixel east: three new pixels');
  assert.deepEqual([...one], [...whole]);
  assert.deepEqual([...two], [...buildMidRingHeights({ woods, baseX: 399, baseY: 251, radius: 1, sub: 2 })]);
  // the client: a band at a time, the next posted as the last lands, assembled whole
  const sent = [];
  let w = null;
  const client = new TerrainGenClient({ woods, woodsBytes: new Uint8Array(4), workerFactory: () => (w = { postMessage: (msg) => sent.push(msg), terminate() {} }) });
  const job = { baseX: 1, baseY: 2, radius: 3, sub: 4, landform: true }, sideJ = midRingSide(3, 4);
  const p1 = client.midRing(job);
  const seen = new Set();
  for (let k = 0; k < 10; k++) {
    const at = sent.filter((x) => x.t === 'midring').at(-1);
    if (!at || seen.has(at.id)) break;
    seen.add(at.id);
    assert.deepEqual({ ...at, id: 0, rows: null }, { t: 'midring', id: 0, ...job, rows: null });
    const rows = midRingBandRows(at.rows[0], at.rows[1], 3, 4);
    w.onmessage({ data: { t: 'mid', id: at.id, heights: new Float32Array(rows * sideJ).fill(at.rows[0]) } });
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.deepEqual(sent.filter((x) => x.t === 'midring').map((x) => x.rows), [[0, 4], [4, 7]], `bands of ${HORIZON_BAND_ROWS.mid} pixel rows`);
  const got = (await p1).heights;
  assert.equal(got.length, sideJ * sideJ);
  assert.equal(got[0], 0);
  assert.equal(got[4 * 4 * sideJ], 4, 'the second band at its own rows');
  const p2 = client.midRing(job);
  w.onmessage({ data: { t: 'midError', id: sent.at(-1).id, message: 'x' } });
  assert.equal(await p2, null);
  const p3 = client.farField({ baseCX: 0, baseCY: 0, radius: 2, cell: 8, seaByte: 3 });
  w.onerror({ message: 'gone' });
  assert.equal(await p3, null, 'the worker died: no far field');
});

test('MID-RING the wiring: the world host hands the far ring the terrain\'s client, the far ring draws the middle ring inside its own pass (mutant: the host\'s line, the draw\'s place)', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(world, /new FarRingRenderer\(renderer\.gl, \{ renderer, mid: terrainGen \}\)/);
  const ring = readFileSync('src/render/farRing.js', 'utf8');
  assert.match(ring, /gl\.drawElements\(gl\.TRIANGLES, this\.ringCount \+ 6 \* fill[^\n]*\n[\s\S]*?mid\.draw\(this\.u\.uOrigin, o\);[\s\S]*?gl\.depthRange\(0, 1\);/, 'after the far ring, before the depth range is put back');
});
