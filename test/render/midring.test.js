// MID-RING (2026-10-26, the owner: "we need to find a way to expand the overworld view distance without killing
// performance. Currently tiles visibly load in with distance"; bible/06-Systems/Travel-View.md MID-RING) -
// THE MIDDLE RING: the streamed kernel's own ground past the streamed grid, between it and the far ring
// (world/terrain/midRingGrid.js, render/midRing.js, render/farRing.js, the terrain worker's 'midring' job). Pinned with no
// game data, on the landforms' synthetic world (test/landformWorld.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile } from '../../src/formats/woodsFile.js';
import { generateSamples, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { createLandforms, nodeGroundAt } from '../../src/world/landforms.js';
import { buildMidRingHeights, midRingNormals, midRingSide, midRingPixel, midRingBandRows, buildFarFieldBytes, farFieldCell, FAR_SAMPLES, FAR_CLIMATE_ASK, MID_RADIUS, MID_SUB, MID_REBUILD_DRIFT } from '../../src/world/terrain/midRingGrid.js';
import { midRingVertices, midRingOrder, midRingRuns, MidRingMesh, midRingDisabled, MID_SEA_EPS } from '../../src/render/midRing.js';
import { FarRingRenderer, ringHeight, RING_RADIUS, HORIZON_BUDGET_MS, MID_MORPH_START, MID_MORPH_END } from '../../src/render/farRing.js';
import { TerrainGenClient, HORIZON_BAND_ROWS } from '../../src/world/terrain/terrainGenClient.js';
import { syntheticWoodsBytes, network } from '../landformWorld.mjs';
import { tamrielClimateAt } from '../../src/world/tamriel/tamrielGround.js';

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
  assert.deepEqual([...v.coarse], [...heights], 'no far ring handed: its own ground');
  // `coarse`, the far ring's surface under each vertex (the ease's ground): a plane through the pixel centres is the plane
  // at the vertex's own place; one centre raised lifts only the triangle of the far ring's that holds it (its winding
  // splits a cell north-west to south-east)
  const plane = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt, seaY, ringAt: (px, py) => 3 * px + 7 * py });
  const pxOf = (gx) => bx - radius + (gx - sub / 2) / sub, pyOf = (gz) => by + radius - (gz - sub / 2) / sub;
  for (const [gx, gz] of [[8, 7], [5, 3], [9, 9]]) assert.ok(Math.abs(plane.coarse[at(gx, gz)] - (3 * pxOf(gx) + 7 * pyOf(gz))) < 1e-3, `the plane at ${gx},${gz}`);
  const peak = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt, seaY, ringAt: (px, py) => (px === bx + 1 && py === by - 1 ? 80 : 0) });
  assert.equal(peak.coarse[at(8, 7)], 0, 'south-west of the cell\'s diagonal: the flat triangle');
  assert.ok(Math.abs(peak.coarse[at(9, 9)] - 40) < 1e-4, 'north-east of it: the raised one, a half of the way up');
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
  mesh.cut((k) => k === '5,5', 1);   // a pixel inside the order: two runs
  const runs = mesh.runs;
  mesh.cut(() => true, 1);
  assert.equal(mesh.runs, runs, 'the same stamp: the runs stand');
  mesh.cut((k) => k === '5,5', 2);
  mesh.draw('uOrigin', [1, 2, 3]);
  assert.deepEqual(log.origins.at(-1), ['uOrigin', 1, 2, 3]);
  assert.equal(log.draws.length, mesh.runs.length);
  assert.ok(mesh.runs.length === 2 && mesh.runs[1][0] > 0, 'a built pixel inside the order cuts it in two');
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
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150, relief: false };   // the sea
  const built = new Map();   // the stream's whole grid round the traveller (Land View 5)
  for (let y = 145; y <= 155; y++) for (let x = 195; x <= 205; x++) built.set(`${x},${y}`, {});
  ring.build(inputs, 200, 150, 5, built);
  assert.equal(asks.length, 1, 'asked at the first hole');
  // PIN MOVED (FAR-FLORA): the near law's woods asked beside the heights (Land View 5: the knob's on); PIN MOVED
  // (TESA-LANDS, AUDIT): and with the lands' row the forest field's own value (a zone's woods its own edge on it)
  assert.deepEqual(asks[0], { baseX: 200, baseY: 150, radius: MID_RADIUS, sub: MID_SUB, landform: false, flora: true, lands: true });
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
  // the fake clock spends the budget in one step: a frame a step - the tints a row of 31 centres a step (30), the vertices
  // MID_ROWS_A_STEP rows (19 more), their normals the same (20), and the last
  const { MID_ROWS_A_STEP } = await import('../../src/render/midRing.js');
  const steps = 2 * MID_RADIUS + 2 + Math.ceil(side / MID_ROWS_A_STEP) - 1 + Math.ceil(side / MID_ROWS_A_STEP) + 1;
  assert.ok(MID_ROWS_A_STEP === 12 && frames >= steps - 1 && frames < 200 && ring._mid.built, `the ring's vertices laid over ${frames} frames, a step of rows a frame (${steps} steps)`);
  ring.punchHole(201, 150, 5, built);
  assert.ok(ring.ringCount < before, `the far ring holed for the middle ring's footprint (${ring.ringCount} < ${before})`);
  const cells = (2 * RING_RADIUS) ** 2 - (2 * MID_RADIUS) ** 2;
  assert.equal(ring.ringCount, cells * 6, 'every cell wholly inside the footprint left to the middle ring');
  const fill = (ring.indexCount - ring.ringCount) / 6;
  assert.ok(fill > 0 && fill <= (2 * 5 + 1) ** 2, `the sea's fill the streamed grid's hole's (${fill} cells), never the footprint's`);
  // the draw: the far ring, then the middle ring at its base's origin
  log.draws.length = 0;
  ring.draw(new Float32Array(16), { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.ok(log.draws.length >= 2, 'the far ring and the middle ring\'s runs');
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uOrigin').at(-1), ['uOrigin', 10, 0, 20], 'the bases are one pixel: the far ring\'s origin');
  // the ease: off for the far ring, the band for the middle ring, measured from the traveller (no focus handed: the eye,
  // else the ring's own origin)
  assert.deepEqual(MID_MORPH_END, (MID_RADIUS - MID_REBUILD_DRIFT) * TERRAIN_SIZE);
  assert.deepEqual(MID_MORPH_START, MID_MORPH_END - 2 * TERRAIN_SIZE);
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uMorph').slice(-2), [['uMorph', 0, 0, 0], ['uMorph', MID_MORPH_START, MID_MORPH_END, 1]]);
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uMorphFrom').at(-1), ['uMorphFrom', 10, 0, 20]);
  // the middle ring's base a pixel off the far ring's: its origin moved by the pixels between (x east, z north)
  ring.baseX = 199; ring.baseY = 151;
  ring.draw(new Float32Array(16), { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uOrigin').at(-1), ['uOrigin', Math.fround(10 + TERRAIN_SIZE), 0, Math.fround(20 + TERRAIN_SIZE)], 'a Float32Array\'s');
  ring.baseX = 200; ring.baseY = 150;
  // past the drift: asked again; an answer for a base let go is dropped
  ring.punchHole(200 + MID_REBUILD_DRIFT + 1, 150, 5, built);
  assert.equal(asks.length, 2);
  assert.equal(globalThis.__horizonRings, undefined, 'no shot page: no probe door (AUDIT ANTICHEAT A2)');
  const page = globalThis.location;
  globalThis.location = /** @type {any} */ ({ search: '?world&shot' });
  try {
    const probed = new FarRingRenderer(fakeGl().gl, {});
    assert.equal(typeof globalThis.__horizonRings, 'function', 'the probes\' read, behind the shot gate');
    probed.dispose();
    assert.equal(globalThis.__horizonRings, undefined, 'let go with the ring');
  } finally { globalThis.location = page; }
  ring.dispose();
  answer({ heights: new Float32Array(side * side) });
  await new Promise((r) => setTimeout(r, 0));
  for (let k = 0; k < 100; k++) ring.punchHole(204, 150, 5, built);
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
    const { HORIZON_KEPT } = await import('../../src/world/terrain/terrainGenWorker.js');
    // each ground's book holds two of its grounds: one smaller than a ground's walk lets every entry go before the next
    // rebuild asks it again (the far field's 14,641 cells through one 8,192-entry book)
    const { farFieldSide } = await import('../../src/world/terrain/midRingGrid.js');
    assert.ok(HORIZON_KEPT.mid >= 2 * (2 * MID_RADIUS + 1) ** 2 && HORIZON_KEPT.far >= 2 * farFieldSide() ** 2, JSON.stringify(HORIZON_KEPT));
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoodsBytes() } });
    globalThis.onmessage({ data: { t: 'midring', id: 9, baseX: 398, baseY: 251, radius: 1, sub: 2, landform: false, rows: [1, 3] } });
    const a = posted.find((p) => p.m.t === 'mid');
    assert.ok(a, JSON.stringify(posted.map((p) => p.m.t)));
    assert.equal(a.m.id, 9);
    assert.deepEqual(a.t, [a.m.heights.buffer], 'transferred');
    assert.deepEqual([...a.m.heights], [...whole.subarray(2 * side)], 'the band of pixel rows 1-2: vertex rows 2 to the last');
    globalThis.onmessage({ data: { t: 'midring', id: 10, baseX: 398, baseY: 251, radius: 1e9, sub: 2 } });
    assert.equal(posted.at(-1).m.t, 'midError');
    // the far field: a band of its rows, each cell its vertex's byte, its count of the sea's floor and (RELIEF-PEAKS) its
    // vertex's ground
    globalThis.onmessage({ data: { t: 'farfield', id: 11, baseCX: 40, baseCY: 25, radius: 2, cell: 8, seaByte: 3, rows: [0, 5] } });   // a slope: every row its own
    const f = posted.at(-1);
    assert.equal(f.m.t, 'far');
    assert.deepEqual(f.t, [f.m.high.buffer, f.m.low.buffer, f.m.clim.buffer, f.m.ground.buffer]);   // PIN MOVED (RELIEF-PEAKS): and the ground
    assert.ok(f.m.clim.every((c) => c === FAR_CLIMATE_ASK), 'no continent installed here: every climate the main thread\'s to read');
    const ref = buildFarFieldBytes({ woods, baseCX: 40, baseCY: 25, radius: 2, cell: 8, seaByte: 3 });
    assert.deepEqual([[...f.m.high], [...f.m.low], [...f.m.ground]], [[...ref.high], [...ref.low], [...ref.ground]]);
    const [m0, n0, , g0] = farFieldCell(woods, 38, 23, 8, 3);
    let n = 0;
    for (const v of FAR_SAMPLES) for (const u of FAR_SAMPLES) { const byte = woods.getHeightMapValue(38 * 8 + u, 23 * 8 + v); if (byte <= 3) n++; }
    // PIN MOVED (RELIEF-PEAKS): a cell's vertex stands on the byte whose node is its centre (the byte north-west of it) and
    // the kernel's ground there (nodeGroundAt) - it stood the highest of its samples' bytes, by the far ring's law
    const byteAt = (x, y) => woods.getHeightMapValue(x, y);
    assert.deepEqual([m0, n0, g0], [byteAt(38 * 8 + 3, 23 * 8 + 3), n, nodeGroundAt(byteAt, 38 * 8 + 3, 23 * 8 + 3, false) * STREAMING_TERRAIN_SCALE], 'a cell: its vertex\'s byte, how many samples are the sea\'s floor, its vertex\'s ground');
    assert.equal(ref.high[0], m0, 'the north-west cell first');
    // a cell's climate the reader's at its centre pixel, where one is handed
    const asked = [];
    const withClim = buildFarFieldBytes({ woods, baseCX: 40, baseCY: 25, radius: 2, cell: 8, seaByte: 3, climateAt: (x, y) => { asked.push([x, y]); return 200 + ((x + y) % 50); } });
    assert.deepEqual(asked[0], [38 * 8 + 4, 23 * 8 + 4], 'the north-west cell\'s centre pixel');
    assert.equal(withClim.clim[6], 200 + ((39 * 8 + 4 + 24 * 8 + 4) % 50));
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) assert.equal(ref.high[j * 5 + i], farFieldCell(woods, 38 + i, 23 + j, 8, 3)[0], `cell ${i},${j}: rows run south`);
    assert.notEqual(ref.high[0], ref.high[20], 'the slope the rows are told apart by');
    // the far cells' climates past the Bay are the worker's, read as the main thread's reader reads them (the continent's,
    // its trace installed by 'tamriel'); on the Bay, and with no continent installed, the main thread's to read
    const climOf = (baseCX, baseCY) => {
      globalThis.onmessage({ data: { t: 'farfield', id: 20, baseCX, baseCY, radius: 2, cell: 8, seaByte: 3 } });
      return posted.at(-1).m.clim;
    };
    assert.ok(climOf(150, -20).every((c) => c === FAR_CLIMATE_ASK), 'past the Bay, no continent: asked');
    const land = new Uint8Array(320 * 200), province = new Uint8Array(320 * 200);
    for (let y = 20; y < 80; y++) for (let x = 110; x < 210; x++) { land[y * 320 + x] = 1; province[y * 320 + x] = 3; }   // Skyrim, as tesa6's rig
    globalThis.onmessage({ data: { t: 'tamriel', trace: { w: 320, h: 200, land, province }, fit: { ox: 400, oy: 500, ppu: 10 } } });
    try {
      const past = climOf(150, -20);
      assert.equal(past[0], tamrielClimateAt(148 * 8 + 4, -22 * 8 + 4) & 255, 'the continent\'s climate at the cell\'s centre');
      assert.ok(past.every((c) => c !== FAR_CLIMATE_ASK));
      assert.ok(climOf(40, 25).every((c) => c === FAR_CLIMATE_ASK), 'on the Bay: the main thread\'s own map');
    } finally { globalThis.onmessage({ data: { t: 'tamriel', trace: null, fit: null } }); }
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
  assert.equal(got[(4 * 4 - 1) * sideJ], 0, 'the first band\'s last row its own');
  const p2 = client.midRing(job);
  w.onmessage({ data: { t: 'midError', id: sent.at(-1).id, message: 'x' } });
  assert.equal(await p2, null);
  // the far field a band of FAR rows at a time, its four answers assembled (PIN MOVED, RELIEF-PEAKS: and its ground)
  const pf = client.farField({ baseCX: 0, baseCY: 0, radius: 10, cell: 8, seaByte: 3 }), fside = 21;
  for (let k = 0; k < 4; k++) {
    const at = sent.filter((x) => x.t === 'farfield').at(-1);
    if (!at || at.done) break;
    at.done = true;
    const rows = at.rows[1] - at.rows[0], fill = (b) => new Uint8Array(rows * fside).fill(b + at.rows[0]);
    w.onmessage({ data: { t: 'far', id: at.id, high: fill(0), low: fill(100), clim: fill(200), ground: new Float32Array(rows * fside).fill(1000 + at.rows[0]) } });
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.deepEqual(sent.filter((x) => x.t === 'farfield').map((x) => x.rows), [[0, HORIZON_BAND_ROWS.far], [HORIZON_BAND_ROWS.far, fside]]);
  const ff = await pf;
  assert.deepEqual([ff.high[0], ff.low[0], ff.clim[0], ff.ground[0], ff.high[16 * fside], ff.low[16 * fside], ff.clim[16 * fside], ff.ground[16 * fside]], [0, 100, 200, 1000, 16, 116, 216, 1016]);
  const p3 = client.farField({ baseCX: 0, baseCY: 0, radius: 2, cell: 8, seaByte: 3 });
  w.onerror({ message: 'gone' });
  assert.equal(await p3, null, 'the worker died: no far field');
});

test('MID-RING the wiring: the world host hands the far ring the terrain\'s client, the far ring draws the middle ring inside its own pass (mutant: the host\'s line, the draw\'s place)', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(world, /new FarRingRenderer\(renderer\.gl, \{ renderer, mid: terrainGen \}\)/);
  const ring = readFileSync('src/render/farRing.js', 'utf8');
  assert.match(ring, /gl\.drawElements\(gl\.TRIANGLES, this\.ringCount \+ 6 \* fill[^\n]*\n[\s\S]*?mid\.draw\(this\.u\.uOrigin, o\);[\s\S]*?gl\.depthRange\(0, 1\);/, 'after the far ring, before the depth range is put back');
  // the ease in the rings' one vertex program: the middle ring's ground onto the far ring's under it, by the traveller's
  // Chebyshev distance, only where the draw asks it
  assert.match(ring, /layout\(location=4\) in float aCoarse;/);
  assert.match(ring, /if \(uMorph\.z > 0\.5\) \{\n\s*vec2 d = abs\(world\.xz - uMorphFrom\.xz\);\n\s*world\.y = mix\(aPos\.y, aCoarse, smoothstep\(uMorph\.x, uMorph\.y, max\(d\.x, d\.y\)\)\) \+ uOrigin\.y;/);
  const mesh = readFileSync('src/render/midRing.js', 'utf8');
  assert.match(mesh, /buf\(v\.coarse, 4, gl\.FLOAT, false, 1\);/, 'the mesh hands it at the program\'s location');
});

test('MID-RING the stream\'s new pixel eases out of the middle ring\'s tint: stamped past the near rings, its share a smoothstep to nought over PIXEL_FADE_MS, mixed over its tiles by both lanes\' ground programs with no discard, uploaded only while it moves and its stamp dropped when done (mutant: the ring, the curve, the mix, the upload, the drop)', async () => {
  const { PIXEL_FADE_MS, PIXEL_FADE_RING, pixelFadeShare, stampPixelFade } = await import('../../src/render/pixelFade.js');
  assert.deepEqual([PIXEL_FADE_MS, PIXEL_FADE_RING], [1200, 2]);
  assert.equal(pixelFadeShare(100, 100), 1);
  assert.equal(pixelFadeShare(100, 100 + PIXEL_FADE_MS / 2), 0.5);
  assert.ok(Math.abs(pixelFadeShare(0, PIXEL_FADE_MS / 4) - (1 - (0.0625 * 3 - 2 * 0.015625))) < 1e-12, 'a smoothstep, not a line');
  assert.equal(pixelFadeShare(0, PIXEL_FADE_MS), 0);
  const near = {}, far = {};
  assert.equal(stampPixelFade(near, 11, 10, { x: 10, y: 10 }, [255, 0, 51], 5), false, 'the next pixel stands at once');
  assert.deepEqual(near, {});
  assert.equal(stampPixelFade(far, 12, 9, { x: 10, y: 10 }, [255, 0, 51], 5), true);
  assert.deepEqual(far, { _fadeFrom: 5, _fadeTint: [1, 0, 0.2] });
  // both lanes' ground programs: the tint over the tiles after the bed, no discard (GROUND-LAST's early depth test)
  const { EL_TERRAIN_FS } = await import('../../src/render/enhancedLighting.js');
  const R = readFileSync('src/render/renderer.js', 'utf8');
  const classic = R.slice(R.indexOf('const TERRAIN_FS = `'), R.indexOf('}`;', R.indexOf('const TERRAIN_FS = `')));
  for (const [name, fs] of [['classic', classic], ['lane', EL_TERRAIN_FS]]) {
    assert.match(fs, /uniform vec4 uFadeTint;/, name);
    assert.match(fs, /tex = ge \? mix\(snowGround\(tex[\s\S]*?tex = mix\(tex, uFadeTint\.rgb, uFadeTint\.a\);[^\n]*\n(?:\s*float road = roadAmt[\s\S]*?\n)?\s*vec3 n = normalize\(vNormal\);/, `${name}: over the tiles, after the snow and the bed, before the light`);   // PIN MOVED (WET1): lane puts roadAmt between the fade and the normal; PIN MOVED (COAST-LOOK): the snow's line a transition's two kinds or the tile's
    assert.doesNotMatch(fs.replace(/\/\/[^\n]*/g, ''), /\bdiscard\b/, `${name}: no discard`);
  }
  // the upload: once whole a frame's block, the share while it moves, the stamp dropped when the share is spent
  const { Renderer } = await import('../../src/render/renderer.js');
  const ups = [];
  const self = { gl: { uniform4f: (...a) => ups.push(a) }, tUFadeTint: 'loc', _tFade: -1, _c3: (c) => c };
  const fade = Renderer.prototype._terrainFade;
  fade.call(self, {});
  fade.call(self, {});
  assert.deepEqual(ups, [['loc', 0, 0, 0, 0]], 'whole: uploaded once, then held');
  const s = { _fadeFrom: performance.now(), _fadeTint: [0.5, 0.25, 0.125] };
  fade.call(self, s);
  assert.equal(ups.length, 2);
  assert.deepEqual(ups[1].slice(0, 4), ['loc', 0.5, 0.25, 0.125]);
  assert.ok(ups[1][4] > 0.9, 'just arrived: nearly all tint');
  s._fadeFrom -= PIXEL_FADE_MS + 1;
  fade.call(self, s);
  assert.equal(s._fadeFrom, null, 'spent: the stamp dropped');
  assert.deepEqual(ups.at(-1), ['loc', 0, 0, 0, 0]);
  assert.match(R, /gl\.uniform1i\(this\.tUTilemap, 2\);\n\s*this\._tFade = -1;/, 'the frame\'s block makes the next draw upload it again');
  // the build stamps it on the enhanced lane, the middle ring standing
  const P = readFileSync('src/scenes/pixelBuild.js', 'utf8');
  // PIN MOVED (IC-SWAP-BEHIND, scenes/swapBehind.js): a view swapped in from behind one that stood takes no fade (`key === pkey`:
  // built under its pixel's own key), and the entry is published through the swap
  assert.match(P, /if \(key === pkey && isEnhanced\(\) && !midRingDisabled\(\)\) stampPixelFade\(terrain, px, py, host\.state\.current, overworldTint\(maps\.getClimateIndex\(px, py\), host\.woods\.getHeightMapValue\(px, py\)\), performance\.now\(\)\);[^\n]*\n\s*if \(_building\.get\(key\) === made\) _building\.delete\(key\);[^\n]*\n\s*swap\.publish\(px, py, key, made, \{/, 'stamped as the build publishes, before the ledger is handed over (BUILD-FAIL1\'s two lines kept together)');
});

test('FAR-FIELD the far field: a vertex a cell on its centre (the far ring\'s frame), its height the far ring\'s law on its highest byte or the sea\'s where most of it is the sea or its centre the ocean\'s climate; its cells farthest first from the traveller\'s, the far ring\'s footprint left to it (mutant: the frame, the sea\'s majority, the order, the hole)', async () => {
  const { farFieldVertices, farFieldOrder, FAR_RIM_START, FAR_RIM_END, FAR_LENS_FAR } = await import('../../src/render/farField.js');
  const { farFieldSide, FAR_CELL, FAR_RADIUS } = await import('../../src/world/terrain/midRingGrid.js');
  assert.deepEqual([FAR_CELL, FAR_RADIUS, farFieldSide()], [8, 60, 121]);
  assert.ok(FAR_RIM_END > 300000 && FAR_RIM_START === FAR_RIM_END * 0.6 && FAR_LENS_FAR > FAR_RIM_END, 'the land runs past 300 km');
  const radius = 2, side = farFieldSide(radius), n = side * side;
  const high = Uint8Array.from({ length: n }, (_, v) => 10 + v), low = new Uint8Array(n);
  low[1] = 5;   // five of nine samples at the sea's floor: the sea
  low[2] = 4;   // four: the land
  const v = farFieldVertices({ high, low, baseCX: 10, baseCY: 20, radius, heightOf: (b) => b * 3, tintAt: (x, y, b) => [x % 256, y % 256, b], oceanAt: (x, y) => x === (10 - radius + 3) * 8 + 4 && y === (20 - radius) * 8 + 4, seaY: -7 });
  const S = TERRAIN_SIZE;
  // vertex (0, 0): cell (8, 18), centre (68, 148) in corner units; the base's north-west pixel (80, 160)
  assert.ok(Math.abs(v.positions[0] - (68 - 80) * S) < 1e-2 && Math.abs(v.positions[2] - (160 + 1 - 148) * S) < 1e-2, 'the far ring\'s frame');
  assert.equal(v.positions[1], 30, 'the law on the highest byte');
  assert.equal(v.positions[4], -7, 'most of it the sea: the sea');
  assert.equal(v.sea[1], 255);
  assert.equal(v.positions[7], 36, 'four of nine: the land');
  assert.equal(v.positions[10], -7, 'the ocean\'s climate at its centre: the sea');
  assert.deepEqual([...v.colors.subarray(0, 3)], [68, 148, 10], 'the tint at the centre pixel, its byte');
  assert.deepEqual([...v.colors.subarray(3, 6)], [76, 148, 0], 'the sea\'s byte for a sea cell');
  // the order against a sort of every cell; the hole left out
  const covered = { x0: 0, x1: -1, y0: 0, y1: -1 };
  const all = farFieldOrder({ baseCX: 10, baseCY: 20, curCX: 11, curCY: 20, radius, covered });
  const cells = side - 1, want = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) want.push([Math.hypot(10 - radius + i + 0.5 - 11, 20 - radius + j + 0.5 - 20), j * side + i]);
  want.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  assert.deepEqual([...all].filter((_, k) => k % 6 === 0), want.map((c) => c[1]), 'farthest first, then the index');
  const hole = { x0: (10 - radius + 1) * 8, x1: (10 - radius + 3) * 8 + 8, y0: (20 - radius + 1) * 8, y1: (20 - radius + 3) * 8 + 8 };
  const holed = farFieldOrder({ baseCX: 10, baseCY: 20, curCX: 11, curCY: 20, radius, covered: hole });
  assert.equal(holed.length, all.length - 4 * 6, 'the cells whose four centres the footprint holds: left to the far ring');
});

test('FAR-FIELD the far ring asks the far field of the worker, lays it a frame\'s share at a time, draws it first under the far field\'s rim and lens, and lets it go on dispose (mutant: the ask, the rim, the lens, the order of the draws)', async () => {
  const { FAR_RIM_END, FAR_LENS_FAR } = await import('../../src/render/farField.js');
  const { farFieldSide } = await import('../../src/world/terrain/midRingGrid.js');
  const { gl, log } = fakeGl();
  const u1 = [];
  gl.uniform1f = (loc, x) => u1.push([loc, x]);
  const asks = [];
  let answer = null;
  const src = { farField: (job) => { asks.push(job); return new Promise((r) => { answer = r; }); } };
  const ring = new FarRingRenderer(gl, { mid: src });
  ring._now = (() => { let t = 0; return () => (t += HORIZON_BUDGET_MS); })();
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150 };
  ring.build(inputs, 200, 150, 5, new Map());
  assert.deepEqual(asks.map((a) => [a.baseCX, a.baseCY, a.radius, a.cell, a.seaByte]), [[25, 18, 60, 8, 3]], 'the traveller\'s cell, the sea\'s byte isWaterPixel\'s');
  const n = farFieldSide() ** 2;
  // the worker's climates where it read them (the ocean's for the first row), this ring's own reader's where it asks
  const clim = new Uint8Array(n).fill(FAR_CLIMATE_ASK);
  clim.fill(223, 0, farFieldSide());
  assert.equal(asks[0].relief, false, 'RELIEF-PEAKS: asked under the row (off here)');
  const ground = Float32Array.from({ length: n }, (_, v) => 500 + v);   // RELIEF-PEAKS: the worker's ground at each vertex
  answer({ high: new Uint8Array(n).fill(90), low: new Uint8Array(n), clim, ground });
  await new Promise((r) => setTimeout(r, 0));
  let frames = 0;
  while (!ring.horizonStats().field && frames < 2000) { ring.punchHole(200, 150, 5, new Map()); frames++; }
  // a frame a step under the fake clock: FAR_CELLS_A_STEP cells a step (a cold centre past the Bay is the continent's
  // biome worked out), then FAR_NORMAL_ROWS rows of normals a step
  const { FAR_CELLS_A_STEP, FAR_NORMAL_ROWS } = await import('../../src/render/farField.js');
  const steps = Math.ceil(n / FAR_CELLS_A_STEP) + Math.ceil(farFieldSide() / FAR_NORMAL_ROWS);
  assert.ok(FAR_CELLS_A_STEP === 32 && FAR_NORMAL_ROWS === 8 && frames >= steps - 1 && ring.horizonStats().field, `laid over ${frames} frames (${steps} steps)`);
  const pos = log.buffers.map((b) => b[1]).find((d) => d instanceof Float32Array && d.length === n * 3);
  assert.equal(pos[1], Math.fround(ringHeight(0)), 'the worker\'s ocean: the sea');
  assert.equal(pos[farFieldSide() * 3 + 1], ground[farFieldSide()], 'asked of this ring\'s reader (no ocean): the land, on the ground the worker answered (PIN MOVED, RELIEF-PEAKS)');
  ring.punchHole(200, 150, 5, new Map());
  log.draws.length = 0; u1.length = 0;
  ring.draw(new Float32Array(16), { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.equal(u1.find((x) => x[0] === 'uRimEnd')[1], FAR_RIM_END, 'the haze closes at the far field\'s rim');
  assert.equal(log.draws[0][0], ring.horizonStats().field.cells * 6, 'the far field first');
  assert.ok(ring._projKey.endsWith(`,${FAR_LENS_FAR}`), 'the rings\' lens reaches it');
  // its origin: the base cell's north-west pixel (25 x 8, 18 x 8) off the far ring's base (200, 150), z north
  assert.deepEqual(log.origins.filter((o) => o[0] === 'uOrigin').slice(0, 3), [['uOrigin', 0, 0, 0], ['uOrigin', 0, 0, Math.fround((150 - 18 * 8) * TERRAIN_SIZE)], ['uOrigin', 0, 0, 0]], 'the pass\'s, the far field\'s, the far ring\'s again');
  // the order written only when the traveller's cell or the ring's footprint moved; asked again only past the drift
  const ups = log.buffers.length;
  ring.punchHole(200, 150, 5, new Map());
  assert.equal(log.buffers.length, ups, 'the same cell: nothing written');
  ring.punchHole(200 + 8 * 2, 150, 5, new Map());
  assert.equal(asks.length, 1, 'two cells off: the field stands');
  ring.punchHole(200 + 8 * 3, 150, 5, new Map());
  assert.equal(asks.length, 2, 'past the drift: asked again');
  assert.deepEqual([asks[1].baseCX, asks[1].baseCY], [28, 18]);
  ring.dispose();
  assert.equal(ring.horizonStats().field, null);
});
