// FLORA-GROUND (FIELD BUGS 2026-10-27, the owner: "Plus floating flora and reflective flora can be seen off the ground in
// first person"; the coordinator: "Make the flora's height and the walk height one law ... Make your flora read the same
// ground the player walks on, whatever that ground's height law is, so its change cannot float the flora again") - THE
// GROUND'S ONE LAW (world/terrain/terrainSurface.js walkGroundAt): the near grid's drawn triangles, which the walker's floor
// (scenes/world.js heightAt) and every plant (the kernel's woods, DFU's scatter, the border's, the herb stands, the jungle,
// its graht-oaks and roadside pairs, a town's nature flats, World of Daggerfall's shrubs, the grass) read; and the far
// trees' band (render/farTrees.js) standing down over a pixel the stream has built and laid again when the ground moves.
// Pinned on made ground (a saddle field, where the bilinear patch the walker and the woods once stood on parts from the
// drawn triangles); on the game's own ground with ARENA2 in floraground_real.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HEIGHTMAP_DIMENSION as H, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, SCALED_BEACH_ELEVATION } from '../../../src/world/terrain/terrainSampler.js';
import { walkGroundAt, surfaceHeightAt, buildTerrainGrid, buildTerrainIndices, groundOffPlane, lowestGroundUnder } from '../../../src/world/terrain/terrainSurface.js';
import { layoutNature, natureStandsAt, groundAt, MAX_STEEPNESS, SLOPE_SINK_RATIO } from '../../../src/world/terrain/terrainNature.js';
import { withJungle } from '../../../src/world/terrain/jungleNature.js';
import { JUNGLE_ARCHIVE } from '../../../src/world/jungle/jungleModels.js';
import { bandSlot, bandBuiltBits, bandInstanceSteps, FarTreesBand, TREES_VS, TREE_STRIDE, BAND_REACH, BAND_SIDE, BAND_BUILT_WORDS, BAND_NO_SLOT, BAND_RING } from '../../../src/render/farTrees.js';
import { FarRingRenderer, HORIZON_BUDGET_MS } from '../../../src/render/farRing.js';
import { midRingSide } from '../../../src/world/terrain/midRingGrid.js';
import { TerrainGenClient } from '../../../src/world/terrain/terrainGenClient.js';
import { LAND_VIEW_MAX } from '../../../src/world/landView.js';
import { hostText } from '../../hostText.mjs';

const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // a normalized sample in metres
const CELL = TERRAIN_SIZE / (H - 1);
const SINK = MAX_STEEPNESS / SLOPE_SINK_RATIO;   // the deepest a flat is sunk into its slope (DFU's steepness / 70)
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A saddle field: grass over the beach line, a crossed ripple whose quads are saddles - where the bilinear patch over
 *  four samples and the two triangles drawn through them part (by up to a quarter of the quad's twist). */
function saddleField() {
  const hm = new Float32Array(H * H);
  const beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] = beach * 1.6 + 0.003 * Math.sin(a / 2.3) * Math.sin(b / 2.9);
  const tm = new Uint8Array(128 * 128).fill(2);
  for (let i = 0; i < tm.length; i += 7) tm[i] = 1;
  return { hm, tm };
}

/** THE DRAWN GROUND, read off the mesh itself: the near grid's vertices (buildTerrainGrid) and its triangles
 *  (buildTerrainIndices), a vertical line met with the triangle under it - no law of the code under test. */
function drawnOracle(hm) {
  const { positions } = buildTerrainGrid(hm, 1), idx = buildTerrainIndices(1);
  return (x, z) => {
    const qx = Math.min(127, Math.floor(x / CELL)), qz = Math.min(127, Math.floor(z / CELL)), o = (qz * 128 + qx) * 6;
    for (let t = 0; t < 2; t++) {
      const v = [0, 1, 2].map((k) => idx[o + t * 3 + k] * 3).map((i) => [positions[i], positions[i + 1], positions[i + 2]]);
      const [a, b, c] = v;
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * a[1] + l2 * b[1] + l3 * c[1];
    }
    throw new Error(`no triangle under ${x}, ${z}`);
  };
}

/** The world host's own walk floor, lifted off world.js (as RESPAWN-GROUND lifts it) over one built pixel at the origin. */
function hostHeightAt(samples) {
  const W = hostText('src/scenes/world.js');
  const i = W.indexOf('const heightAt = (x, z, terrainOnly = false) => {'), j = W.indexOf('\n  };', i);
  const body = W.slice(i, j + 5).replace('const heightAt = ', 'return ');
  const state = { compensation: [0, 0, 0], mapOrigin: { x: 300, y: 200 }, pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 300) * TERRAIN_SIZE; out[1] = 0; out[2] = (200 - py) * TERRAIN_SIZE; return out; } };
  const built = new Map([['300,200', { px: 300, py: 200, samples }]]);
  return new Function('state', 'built', 'TERRAIN_SIZE', 'HEIGHTMAP_DIMENSION', 'heightCell', 'worldHeight', 'deepWaters', '_htT', 'walkGroundAt', body)(
    state, built, TERRAIN_SIZE, H, CELL, M, null, [0, 0, 0], walkGroundAt);
}

/** Every flat stands on the walk law: at it or sunk into its slope, never over it. Answers the worst float. */
function onTheWalkFloor(flats, hm, what) {
  let worst = -Infinity;
  for (const f of flats) {
    const g = walkGroundAt(hm, f.x, f.z), off = f.y - g;
    worst = Math.max(worst, off);
    assert.ok(off <= 1e-6 && off >= -SINK - 1e-6, `${what}: a flat at (${f.x.toFixed(2)}, ${f.z.toFixed(2)}) stands ${off.toFixed(3)} m off the walk floor`);
  }
  return worst;
}

test('FLORA-GROUND the ground\'s one law is the drawn ground: walkGroundAt is the near grid\'s own triangles, the world host\'s walk floor walks it (the bilinear patch it walked is gone), and the grass stands on it (mutants: the law\'s stride; the walk floor\'s bilinear back; the grass off it)', () => {
  const { hm } = saddleField();
  const drawn = drawnOracle(hm), walk = hostHeightAt(hm);
  let apart = 0, n = 0;
  for (let k = 0; k < 3000; k++) {
    const x = ((k * 0.6180339887) % 1) * (TERRAIN_SIZE - 0.01), z = ((k * 0.7548776662) % 1) * (TERRAIN_SIZE - 0.01);
    const g = walkGroundAt(hm, x, z);
    assert.ok(Math.abs(g - drawn(x, z)) < 1e-3, `the law is the drawn triangle at (${x.toFixed(2)}, ${z.toFixed(2)}): ${g} against ${drawn(x, z)}`);   // the mesh's vertices are float32
    assert.ok(Math.abs(walk(x, z) - g) < 1e-9, `the walker stands on it at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    if (groundAt(hm, x, z) - g > 0.05) apart++;
    n++;
  }
  assert.ok(apart > n / 20, `the field tells the two apart: the bilinear patch over the drawn ground by 5 cm at ${apart} of ${n} points`);
  assert.equal(walkGroundAt(hm, 3 * CELL, 7 * CELL), surfaceHeightAt(hm, 3 * CELL, 7 * CELL, 1));
  const W = hostText('src/scenes/world.js');
  assert.match(W, /return walkGroundAt\(p\.samples, lx, lz\) \+ t\[1\];/, 'the walk floor');
  assert.match(W, /const h = walkGroundAt\(p\.samples, lx, lz\);/, 'the grass');
  assert.doesNotMatch(W, /at\(ix, iz\) \* \(1 - sx\) \* \(1 - sz\)/, 'the bilinear walk floor gone, not merely unused');
});

test('FLORA-GROUND every plant stands on the walk floor: the woods, DFU\'s scatter, a border\'s, an herb\'s stand, the jungle\'s four storeys - at it, or sunk into its slope by DFU\'s steepness / 70, never over it; on the bilinear patch the woods stood on until now, dozens of them stood over it (mutants: the woods\' law; the corner\'s; the border\'s; the stand\'s; the jungle\'s)', () => {
  const { hm, tm } = saddleField();
  const opts = { mapPixelX: 400, mapPixelY: 100, rawWorldHeight: 80, climateType: 231, locationRect: null };
  const woods = layoutNature(hm, tm, { ...opts, forests: { archive: 504, pois: [] } });
  assert.ok(woods.length > 2000);
  onTheWalkFloor(woods, hm, 'the woods');
  const wouldFloat = woods.filter((f) => groundAt(hm, f.x, f.z) - (walkGroundAt(hm, f.x, f.z) - f.y) - walkGroundAt(hm, f.x, f.z) > 0.05).length;
  assert.ok(wouldFloat > 20, `on the bilinear patch ${wouldFloat} of ${woods.length} of the woods' flats would stand 5 cm over the walk floor`);
  const dfu = layoutNature(hm, tm, { ...opts, forests: null });
  assert.ok(dfu.length > 2000);
  onTheWalkFloor(dfu, hm, 'DFU\'s scatter');
  // a border: a desert's tiles to the north laid by DFU's law on the tile's own dice, a swamp's woods to the east
  const ecotone = { nature: [504, 504, 506, 504, 504, 506, 503, 503, 503], type: [2, 2, 3, 2, 2, 3, 0, 0, 0] };
  const border = layoutNature(hm, tm, { ...opts, forests: { archive: 504, pois: [] }, ecotone }).filter((f) => f.archive != null);
  assert.ok(border.length > 50, `${border.length} of the border's flats`);
  onTheWalkFloor(border, hm, 'the border');
  const stands = [];
  for (let y = 3; y < 125; y += 7) for (let x = 2; x < 125; x += 5) { const s = natureStandsAt(hm, tm, null, x, y); if (s) stands.push(s); }
  assert.ok(stands.length > 100);
  onTheWalkFloor(stands, hm, 'an herb\'s stand');
  const jungle = withJungle(woods, hm, tm, { ...opts, forests: { archive: 500, pois: [] }, jungle: { nine: [3, 3, 3, 3, 3, 3, 3, 3, 3], pois: [], paths: null } }).filter((f) => f.archive === JUNGLE_ARCHIVE);
  assert.ok(jungle.length > 1000 && jungle.some((f) => f.jungle != null) && jungle.some((f) => f.jungle == null), `${jungle.length} of the jungle's trees, palms and floor`);
  onTheWalkFloor(jungle, hm, 'the jungle');
});

test('FLORA-GROUND what the build stands reads the same law: a town\'s nature flats lifted off its plane by it, World of Daggerfall\'s shrubs on its lowest, the jungle\'s roadside pairs and graht-oaks on it, and its pairs\' fallback flats (mutants: the plane\'s ground; the shrub\'s; the pairs\' fallback)', () => {
  const { hm } = saddleField();
  const avg = hm[64 * H + 64];
  for (const [x, z] of [[10.3, 20.9], [400.1, 3.3], [811.2, 500.7]]) {
    assert.ok(Math.abs(groundOffPlane(hm, avg, x, z) + Math.fround(avg) * M - walkGroundAt(hm, x, z)) < 1e-6, 'a town\'s nature flat lifted onto the walk floor');
  }
  const box = [100, 0, 200, 110, 5, 214];
  let low = Infinity;
  for (let x = 102.5; x <= 107.5; x += 0.25) for (let z = 203.5; z <= 210.5; z += 0.25) low = Math.min(low, walkGroundAt(hm, x, z));
  assert.ok(Math.abs(lowestGroundUnder(hm, box) - low) < 0.02, 'a shrub\'s foot the lowest walk floor under its middle');
  assert.ok(lowestGroundUnder(hm, box) <= low + 1e-9);
  assert.match(src('src/scenes/pixelBuild.js'), /addFlat\(archive, t\.record, t\.x, walkGroundAt\(samples, t\.x, t\.z\), t\.z, \{ wild: JUNGLE_ARCHIVE \}\);/, 'the pairs\' fallback flats');
  const jn = src('src/world/terrain/jungleNature.js'), jr = src('src/world/jungle/jungleRoadside.js');
  assert.match(jn, /ground: \(mx, mz\) => walkGroundAt\(heightmapData, mx, mz\),/, 'the graht-oaks\' foot');
  assert.equal((jr.match(/walkGroundAt\(heightmapData, /g) ?? []).length, 4, 'the pairs\' four reads of the ground');
  assert.doesNotMatch(jr, /surfaceHeightAt\(/, 'the pairs read no second law');
});

test('FLORA-GROUND what rides the ground reads it by the same law: the landforms\' lift field between its samples (the frame a save\'s heights are shed into) on the drawn triangles, and a rebuilt pixel\'s ground moved under what lies on it (mutants: the lift field bilinear again; the rider\'s read)', async () => {
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { landformLiftField } = await import('../../../src/world/landforms.js');
  const { syntheticWoodsBytes } = await import('../../landformWorld.mjs');
  const w = new WoodsFile();
  assert.equal(w.load(syntheticWoodsBytes()), true);
  let apart = 0, n = 0;
  for (const [px, py] of [[398, 251], [610, 245], [450, 120]]) {
    const f = landformLiftField(w, px, py);
    for (let k = 0; k < 400; k++) {
      const sx = 2 + ((k * 0.6180339887) % 1) * 120, sy = 2 + ((k * 0.7548776662) % 1) * 120;
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const f00 = f(ix, iy), f10 = f(ix + 1, iy), f01 = f(ix, iy + 1), f11 = f(ix + 1, iy + 1);
      const tri = fy >= fx ? f00 + fy * (f01 - f00) + fx * (f11 - f01) : f00 + fx * (f10 - f00) + fy * (f11 - f10);
      const bil = f00 * (1 - fx) * (1 - fy) + f10 * fx * (1 - fy) + f01 * (1 - fx) * fy + f11 * fx * fy;
      assert.ok(Math.abs(f(sx, sy) - tri) < 1e-9, `the lift at (${sx.toFixed(2)}, ${sy.toFixed(2)}) read on the drawn triangles`);
      if (Math.abs(tri - bil) > 1e-6) apart++;
      n++;
    }
  }
  assert.ok(apart > n / 4, `the fields tell the two reads apart at ${apart} of ${n} points`);
  assert.match(src('src/scenes/pixelBuild.js'), /const groundIn = \(smp, x, z\) => walkGroundAt\(smp, Math\.max\(0, Math\.min\(TERRAIN_SIZE, x - t\[0\]\)\), Math\.max\(0, Math\.min\(TERRAIN_SIZE, z - t\[2\]\)\)\);/, 'a rebuilt pixel\'s ground, moved under what lies on it, read by the walk floor\'s law');
});

test('FLORA-GROUND THE BAND STANDS DOWN OVER A BUILT PIXEL: each band tree carries its pixel\'s slot about the base (BAND_REACH a side, the Land View\'s most and the ring), the program drops a tree whose slot the stream has built, and the built bits are written the frame the built map changes - not at the next crossing (mutants: the slot unwritten; its byte; the drop; the bit\'s row; the bits not rewritten; the key blind to the map; the upload)', () => {
  assert.ok(BAND_REACH >= LAND_VIEW_MAX + BAND_RING, 'the reach holds the farthest band pixel');
  assert.deepEqual([BAND_SIDE, BAND_BUILT_WORDS, BAND_NO_SLOT], [2 * BAND_REACH + 1, Math.ceil(BAND_SIDE ** 2 / 32), 255]);
  assert.deepEqual(bandSlot(10, 20, 10, 20), [BAND_REACH, BAND_REACH]);
  assert.deepEqual(bandSlot(12, 19, 10, 20), [BAND_REACH + 2, BAND_REACH + 1], 'east x, north the next row');
  assert.deepEqual(bandSlot(10 + BAND_REACH + 1, 20, 10, 20), [BAND_NO_SLOT, BAND_NO_SLOT], 'past the reach: none');
  const built = new Map([['12,19', {}], ['10,20', {}]]);
  const bits = bandBuiltBits(10, 20, built);
  const bit = (i, j) => (bits[(j * BAND_SIDE + i) >> 5] >>> ((j * BAND_SIDE + i) & 31)) & 1;
  assert.equal(bit(BAND_REACH + 2, BAND_REACH + 1), 1);
  assert.equal(bit(BAND_REACH, BAND_REACH), 1);
  assert.equal(bit(BAND_REACH + 2, BAND_REACH - 1), 0, 'the pixel south of it not');
  let ones = 0;
  for (const w of bits) for (let k = 0; k < 32; k++) ones += (w >>> k) & 1;
  assert.equal(ones, 2, 'two pixels, two bits');
  // the instances carry their slots
  const it = bandInstanceSteps([{ px: 12, py: 19, archive: 504, trees: Float32Array.from([1, 2, 3, 12]) }], 10, 20, () => 0);
  let r; while (!(r = it.next()).done);
  const u = new Uint8Array(r.value.data);
  assert.deepEqual([u[14], u[15]], [BAND_REACH + 2, BAND_REACH + 1]);
  assert.equal(TREE_STRIDE, 16);
  assert.ok(TREES_VS.includes('layout(location=2) in vec2 aSlot;'));
  assert.ok(TREES_VS.includes(`if (slot >= 0 && ((uBuilt[slot >> 5] >> (slot & 31)) & 1) != 0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`), 'a built slot\'s tree outside the clip volume');
  assert.ok(TREES_VS.includes(`int slot = aSlot.x < ${BAND_NO_SLOT - 0.5} ? int(aSlot.y) * ${BAND_SIDE} + int(aSlot.x) : -1;`));
});

function fakeGl() {
  const log = { u1iv: [], ptr: [], arrays: [], made: 0 };
  const gl = new Proxy({
    TRIANGLES: 4, POINTS: 0, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8, TEXTURE0: 33984, TEXTURE_2D_ARRAY: 35866,
    drawingBufferHeight: 400,
    createBuffer: () => ({ id: ++log.made }), createVertexArray: () => ({ vao: ++log.made }), createTexture: () => ({ tex: ++log.made }), createProgram: () => ({}),
    uniform1iv: (loc, v) => log.u1iv.push([loc, [...v]]),
    vertexAttribPointer: (loc, size, type, norm, stride, off) => log.ptr.push([loc, size, type, norm, stride, off]),
    drawArrays: (mode, first, count) => log.arrays.push([mode, first, count]),
    getUniformLocation: (p, name) => name, getShaderParameter: () => true, getProgramParameter: () => true,
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { gl, log };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const S = (o = {}) => ({ proj: Float32Array.from({ length: 16 }, (_, k) => (k === 5 ? 1.7 : 0)), view: new Float32Array(16), origin: [0, 0, 0], radius: 1, viewportH: 400, hazeFrom: new Float32Array(4),
  ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], moonScale: 0, moonColor: [1, 1, 1], fogColor: [0, 0, 0], fogStart: 0, fogEnd: 1, rimStart: 1, rimEnd: 2, hold: 0.85,
  haze: new Float32Array(8), hazeEye: [0, 1, 0], cloudFar: 1, cloudRect: new Float32Array(4), cloudUnit: 15, exposure: 1, ...o });

test('FLORA-GROUND the band\'s book: a pixel built after the crossing stands its trees down on the next frame, and the trees are kept for the ground they were laid on - the terrain client\'s ground epoch moving (the roads, the landforms\' tables, the sites past the Bay, the continent\'s trace and relief) lets every kept pixel go and asks it again (mutants: the frame\'s bits; the epoch unread; the kept kept; an epoch not moved)', async () => {
  const { gl, log } = fakeGl();
  const asks = [];
  const source = { groundEpoch: 0, floraBand: (job) => { asks.push(job); return Promise.resolve(Array.from({ length: job.pixels.length / 4 }, (_, k) => Float32Array.from([k, 1, 2, 12]))); } };
  const read = () => ({ picture: async () => ({ width: 2, height: 4, data: new Uint8Array(32).fill(255) }), size: async () => ({ w: 2, h: 4 }) });
  const band = new FarTreesBand(gl, { source, read });
  const work = [];
  const built = new Map();
  built.changes = 0;
  const frame = () => band.frame({ curX: 50, curY: 50, radius: 1, built, climateOf: () => 231, forests: true, landform: false, work });
  const settle = async () => { for (let k = 0; k < 50; k++) { frame(); await tick(); while (work.length) { const w = work[0], r = w.it.next(); if (r.done) { work.shift(); w.done(r.value); } } } };
  await settle();
  assert.equal(asks.length, 1);
  assert.equal(asks[0].pixels.length / 4, 25, 'nothing built: the grid of nine and its ring');
  assert.equal(band.count, 25);
  band.draw(S());
  const bitsOf = () => log.u1iv.filter((u) => u[0] === 'uBuilt').at(-1)[1];
  assert.ok(bitsOf().every((w) => w === 0), 'none built: every tree drawn');
  assert.ok(log.ptr.some((p) => p[0] === 2 && p[1] === 2 && p[2] === gl.UNSIGNED_BYTE && p[4] === TREE_STRIDE && p[5] === 14), 'the slot read off its two bytes');
  // the stream builds the traveller's pixel and its east neighbour - no crossing
  built.set('50,50', {}); built.set('51,50', {}); built.changes += 2;
  frame();
  band.draw(S());
  const bits = bitsOf(), on = (px, py) => { const [i, j] = bandSlot(px, py, 50, 50), k = j * BAND_SIDE + i; return (bits[k >> 5] >>> (k & 31)) & 1; };
  assert.deepEqual([on(50, 50), on(51, 50), on(49, 50), on(50, 49)], [1, 1, 0, 0], 'the built pixels\' trees stood down on the next frame, the rest standing');
  assert.equal(asks.length, 1, 'nothing asked again for it');
  // the ground moves: every kept pixel asked again, the band laid anew
  const laid = band.drawn;
  source.groundEpoch++;
  await settle();
  assert.equal(asks.length, 2, 'asked again');
  assert.equal(asks[1].pixels.length / 4, 25, 'every pixel of the band, none kept from the old ground');
  assert.notEqual(band.drawn, laid, 'laid again on the new ground');
  // the client's epoch moves with every input of the ground
  const c = new TerrainGenClient({ woods: { getHeightMapValue: () => 0 } });
  const e0 = c.groundEpoch;
  c.setLandformTables({ sites: null, climates: null });
  c.setLandformBeyond(null);
  c.setTamriel({ trace: null, fit: null });
  c.setRoadsData({ roads: new Uint8Array(4), tracks: new Uint8Array(4) });
  c.setRoads([], null, null);
  assert.equal(c.groundEpoch, e0 + 5, 'the tables, the sites past the Bay, the trace, his network and ours');
});

test('FLORA-GROUND the middle ring under the band is laid again when the ground moves, as the band\'s trees are - one ground under them (mutants: the stale test unread; the epoch unstamped)', async () => {
  const gl = new Proxy({ ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, STATIC_DRAW: 7, DYNAMIC_DRAW: 8, TRIANGLES: 4,
    createBuffer: () => ({}), createVertexArray: () => ({}), getUniformLocation: (p, n) => n, getShaderParameter: () => true, getProgramParameter: () => true }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  const asks = [];
  let answer = null;
  const mid = { groundEpoch: 3, midRing: (job) => { asks.push(job); return new Promise((r) => { answer = r; }); } };
  const ring = new FarRingRenderer(gl, { mid });
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150, relief: false };
  ring.build(inputs, 200, 150, 5, null);
  assert.equal(asks.length, 1);
  const side = midRingSide();
  answer({ heights: new Float32Array(side * side).fill(50) });
  await tick();
  ring._now = (() => { let t = 0; return () => (t += HORIZON_BUDGET_MS); })();
  for (let k = 0; k < 200 && !ring._mid?.built; k++) ring.punchHole(200, 150, 5, null);
  assert.ok(ring._mid?.built);
  assert.equal(ring._mid.groundEpoch, 3, 'stamped with the ground it was asked on');
  ring.punchHole(200, 150, 5, null);
  assert.equal(asks.length, 1, 'the same ground: not asked again');
  mid.groundEpoch++;
  ring.punchHole(200, 150, 5, null);
  assert.equal(asks.length, 2, 'the ground moved: asked again');
});
