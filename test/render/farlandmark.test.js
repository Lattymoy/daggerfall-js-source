// FAR-LANDMARK and BREATHTAKER2 ON THE HORIZON (2026-10-26, the coordinator: stream A's Imperial City wants a silhouette on
// the horizon, and stream G's lift past byte 127 was missing from the far layers; bible/06-Systems/Travel-View.md
// FAR-LANDMARK) - the far ring's cells farthest first, a landmark drawn in that painter's order by its distance (and the
// middle ring's), and the far ring, the middle ring's eased rim and the far field standing the continent's peaks by G's
// own law (world/landforms.js byteBeyond). No game data.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FarRingRenderer, ringHeight, ringHeightAt, ringGroundAt, buildFarRingGrid, RING_RADIUS, HORIZON_BUDGET_MS, MID_MORPH_START, MID_MORPH_END } from '../../src/render/farRing.js';
import { FarLandmark, landmarkBox, landmarkDistance, landmarkNormals, LANDMARK_GREY } from '../../src/render/farLandmarks.js';
import { farFieldVertices } from '../../src/render/farField.js';
import { byteBeyond, nodeGround } from '../../src/world/landforms.js';
import { midRingSide, MID_RADIUS } from '../../src/world/terrain/midRingGrid.js';
import { STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const S = TERRAIN_SIZE;

/** A WebGL2 stand-in that records what is made, bound, uploaded and drawn, in one log of events. */
function fakeGl() {
  const log = { made: 0, deleted: 0, events: [], buffers: [] };
  let n = 0, vao = null;
  const gl = new Proxy({
    TRIANGLES: 4, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
    createBuffer: () => { log.made++; return { id: ++n }; },
    createVertexArray: () => { log.made++; return { vao: ++n }; },
    bindVertexArray: (v) => { vao = v; },
    deleteBuffer: () => { log.deleted++; }, deleteVertexArray: () => { log.deleted++; },
    bufferData: (target, data) => { log.buffers.push([target, data]); },
    drawElements: (mode, count, type, offset) => log.events.push(['draw', vao?.vao ?? null, count, type, offset]),
    uniform3f: (loc, x, y, z) => log.events.push(['u3', loc, x, y, z]),
    getUniformLocation: (p, name) => name,
    getShaderParameter: () => true, getProgramParameter: () => true,
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { gl, log };
}
const drawOpts = { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 };

test('BREATHTAKER2 on the horizon: a pixel\'s macro height is G\'s own law past the Bay - ringHeight with the continent\'s share at its byte node (byteBeyond), the Bay\'s and the plain law\'s untouched - in the far ring\'s grid and the far field\'s cells (mutant: the share dropped, the share on the Bay, the far field\'s cell unasked)', () => {
  // the law itself
  assert.equal(ringHeightAt(500, 250, 100, true, 1), ringHeight(100, true, 1), 'on the Bay: no share');
  assert.equal(byteBeyond(1200, 250), 1, 'well past the Bay: the whole share');
  assert.equal(ringHeightAt(1200, 250, 160, true, 1), nodeGround(160, 1, 1) * STREAMING_TERRAIN_SCALE);   // PIN MOVED (RELIEF-PEAKS): the node's ground - the large map by its law with the byte's term (reliefByteHeight left it out)
  assert.ok(ringHeightAt(1200, 250, 160, true, 1) > ringHeight(160, true, 1) + 100, 'byte 160 stands its lift past the 7-bit top');
  assert.equal(ringHeightAt(1200, 250, 160, false, 1), ringHeight(160), 'the plain law takes no lift');
  // the far ring's grid past the Bay: the vertex at (1100, 250) on a field of byte 160
  const g = buildFarRingGrid({ heightBytes: new Uint8Array(1000 * 500), mapWidth: 1000, mapHeight: 500, climateAt: () => 231, baseX: 1100, baseY: 250, radius: 2, relief: true, byteAt: () => 160, climatePast: () => 231 });
  const mid = (2 * 5 + 2) * 3 + 1;
  const want = ringGroundAt(1100, 250, () => 160, true);   // PIN MOVED (RELIEF-PEAKS): the vertex the kernel's mean ground at its pixel's centre - the node's law with the ranges there
  assert.ok(Math.abs(g.positions[mid] - want) < 1e-3, `${g.positions[mid]} against ${want}`);
  assert.ok(want > ringHeight(160, true, 1) + 100, 'the continent\'s lift on it');
  // the far field's height is asked at its cell's centre pixel
  const asked = [];
  const v = farFieldVertices({ high: new Uint8Array(25).fill(160), low: new Uint8Array(25), baseCX: 140, baseCY: 31, radius: 2, heightOf: (b, x, y) => { asked.push([x, y]); return b; }, tintAt: () => [1, 2, 3], oceanAt: () => false, seaY: 0 });
  assert.deepEqual(asked[0], [138 * 8 + 4, 29 * 8 + 4]);
  assert.equal(v.positions[1], 160);
});

test('BREATHTAKER2 the far ring\'s far field stands its cells by G\'s law at their centres under the Landforms row (mutant: the far field\'s law unwired)', async () => {
  const { gl, log } = fakeGl();
  let answer = null;
  const asks = [];
  const ring = new FarRingRenderer(gl, { mid: { farField: (job) => { asks.push(job); return new Promise((r) => { answer = r; }); } } });
  ring._now = (() => { let t = 0; return () => (t += 1000); })();
  const inputs = { heightBytes: new Uint8Array(1000 * 500), mapWidth: 1000, mapHeight: 500, climateAt: () => 231, baseX: 1100, baseY: 250, relief: true, byteAt: () => 160, climatePast: () => 231 };
  ring.build(inputs, 1100, 250, 5, new Map());
  const { farFieldSide } = await import('../../src/world/terrain/midRingGrid.js');
  const n = farFieldSide() ** 2;
  // PIN MOVED (RELIEF-PEAKS): the law is the worker's now (world/terrain/midRingGrid.js farFieldCell: the kernel's ground at
  // the vertex's node, test/world/reliefpeaks.test.js) - the ring asks it under the Landforms row and stands each vertex on
  // the ground answered for it
  assert.equal(asks[0].relief, true, 'asked under the Landforms row');
  const ground = Float32Array.from({ length: n }, (_, v) => 1000 + v);
  answer({ high: new Uint8Array(n).fill(160), low: new Uint8Array(n), clim: new Uint8Array(n).fill(255), ground });
  await new Promise((r) => setTimeout(r, 0));
  for (let k = 0; k < 1000 && !ring.horizonStats().field; k++) ring.punchHole(1100, 250, 5, new Map());
  const pos = log.buffers.map((b) => b[1]).find((d) => d instanceof Float32Array && d.length === n * 3);
  assert.equal(pos[1], ground[0], 'the north-west cell on its own ground');
  assert.equal(pos[3 * 77 + 1], ground[77], 'and every cell on its own');
});

test('FAR-LANDMARK the far ring\'s cells are written farthest first from the traveller\'s pixel, each\'s distance kept, the hole left out (mutant: the order, the distance, the hole)', () => {
  const { gl, log } = fakeGl();
  const ring = new FarRingRenderer(gl, {});
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150 };
  const built = new Map();   // the stream's whole grid round the traveller
  for (let y = 147; y <= 157; y++) for (let x = 200; x <= 210; x++) built.set(`${x},${y}`, {});
  ring.build(inputs, 205, 152, 5, built);
  const idx = log.buffers.filter((b) => b[0] === 2).at(-1)[1], side = RING_RADIUS * 2 + 1, cells = ring.ringCount / 6;
  const dist = ring._ringDist.subarray(0, cells);
  for (let k = 1; k < cells; k++) assert.ok(dist[k] <= dist[k - 1], 'farthest first');
  const cellOf = (k) => { const i0 = idx[6 * k], i = i0 % side, j = (i0 - i) / side; return [200 - RING_RADIUS + i, 150 - RING_RADIUS + j]; };
  for (const k of [0, (cells / 2) | 0, cells - 1]) {
    const [px, py] = cellOf(k);
    assert.ok(Math.abs(dist[k] - Math.hypot(px - 205 + 0.5, py - 152 + 0.5)) < 1e-4, `cell ${k} at its own distance`);
  }
  assert.equal(cells, (2 * RING_RADIUS) ** 2 - (2 * 5) ** 2, 'the streamed grid\'s whole hole left out');
});

test('FAR-LANDMARK a landmark: drawn between the far ring\'s farther and nearer cells at its distance, at its own pixel\'s origin, never eased, its triangles farthest first; stood down where the stream has built its pixel; one nearer than every cell after the ring; let go by its handle (mutant: the cut, the origin, the ease, the built pixel, the triangles\' order, the near one undrawn, the remove)', () => {
  const { gl, log } = fakeGl();
  const ring = new FarRingRenderer(gl, {});
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150 };
  ring.build(inputs, 200, 150, 5, new Map());
  const box = landmarkBox({ x: S / 2, z: S / 2, w: 300, d: 300, y: 50, h: 400 });
  const made = log.made;
  const h = ring.addLandmark({ px: 225, py: 150, mesh: box });
  assert.ok(h.landmark instanceof FarLandmark && ring.horizonStats().landmarks === 1);
  log.events.length = 0;
  ring.draw(new Float32Array(16), drawOpts);
  const draws = log.events.filter((e) => e[0] === 'draw');
  const lmDraw = draws.findIndex((e) => e[1] === h.landmark.vao.vao);
  assert.ok(lmDraw > 0 && lmDraw < draws.length - 1, 'between the ring\'s two parts');
  const cells = ring.ringCount / 6, before = draws[lmDraw - 1][2] / 6, d = landmarkDistance(225, 150, 200, 150);
  assert.ok(ring._ringDist[before - 1] >= d && ring._ringDist[before] < d, 'the cut at its distance');
  assert.equal(draws[lmDraw + 1][4], before * 24, 'the nearer cells from where the farther ended');
  assert.equal(draws[lmDraw - 1][2] / 6 + draws[lmDraw + 1][2] / 6, cells, 'every cell once (no sea to fill here)');
  assert.deepEqual([draws[lmDraw][2], draws[lmDraw][3]], [30, gl.UNSIGNED_SHORT], 'its ten triangles');
  // its origin, its ease off
  const at = log.events.indexOf(draws[lmDraw]);
  const lastU = (name) => log.events.slice(0, at).filter((e) => e[0] === 'u3' && e[1] === name).at(-1);
  assert.deepEqual(lastU('uOrigin'), ['u3', 'uOrigin', Math.fround(10 + 25 * S), 0, 20].map((v, k) => (k > 1 ? Math.fround(v) : v)));
  assert.deepEqual(lastU('uMorph'), ['u3', 'uMorph', 0, 0, 0]);
  // its triangles farthest first: the traveller is west of it, so its east face first
  const order = h.landmark.order, cx = (t) => (box.positions[order[3 * t] * 3] + box.positions[order[3 * t + 1] * 3] + box.positions[order[3 * t + 2] * 3]) / 3;
  assert.ok(cx(0) > cx(order.length / 3 - 1), 'the far side first');
  // two: the farther first, each at its own cut; one nearer than every cell (inside the streamed grid's hole, no middle
  // ring standing) after the ring
  const far2 = ring.addLandmark({ px: 240, py: 150, mesh: landmarkBox({ x: S / 2, z: S / 2, w: 100, d: 100, y: 50, h: 100 }) });
  const near2 = ring.addLandmark({ px: 202, py: 150, mesh: landmarkBox({ x: S / 2, z: S / 2, w: 100, d: 100, y: 50, h: 100 }) });
  const full = new Map();
  for (let y = 145; y <= 155; y++) for (let x = 195; x <= 205; x++) if (x !== 202 || y !== 150) full.set(`${x},${y}`, {});
  ring.punchHole(200, 150, 5, full);
  log.events.length = 0;
  ring.draw(new Float32Array(16), drawOpts);
  const seq = log.events.filter((e) => e[0] === 'draw').map((e) => (e[1] === far2.landmark.vao.vao ? 'far' : e[1] === h.landmark.vao.vao ? 'lm' : e[1] === near2.landmark.vao.vao ? 'near' : 'ring'));
  assert.deepEqual(seq, ['ring', 'far', 'ring', 'lm', 'ring', 'near', 'ring'], 'the farther landmark first; the near one before the two cells by its own unbuilt pixel');
  assert.ok(log.events.filter((e) => e[0] === 'draw').every((e) => e[1] !== null), 'every draw with its own array bound (a landmark\'s reorder unbinds)');
  far2.remove(); near2.remove();
  // one on the traveller's own unbuilt pixel: nearer than every cell (theirs stand at their centres), so after the whole
  // ring when no middle ring stands
  const home = ring.addLandmark({ px: 200, py: 150, mesh: landmarkBox({ x: S / 2, z: S / 2, w: 100, d: 100, y: 50, h: 100 }) });
  full.delete('200,150');
  ring.punchHole(200, 150, 5, full);
  log.events.length = 0;
  ring.draw(new Float32Array(16), drawOpts);
  const seq2 = log.events.filter((e) => e[0] === 'draw').map((e) => (e[1] === h.landmark.vao.vao ? 'lm' : e[1] === home.landmark.vao.vao ? 'home' : 'ring'));
  assert.deepEqual(seq2, ['ring', 'lm', 'ring', 'home'], 'the near one after the ring: no middle ring to cut');
  home.remove();
  // the stream built its pixel: it stands down
  ring.punchHole(200, 150, 5, new Map([['225,150', {}]]));
  log.events.length = 0;
  ring.draw(new Float32Array(16), drawOpts);
  assert.ok(!log.events.some((e) => e[0] === 'draw' && e[1] === h.landmark.vao.vao), 'built: the city\'s own models stand there');
  // let go
  h.remove();
  assert.equal(ring.horizonStats().landmarks, 0);
  assert.equal(log.deleted, log.made - made, 'every buffer it made');
  assert.ok(Math.abs(landmarkNormals(box.positions, box.indices)[4 * 3 + 1] - 1) < 0.8 && LANDMARK_GREY.length === 3);
});

test('FAR-LANDMARK a landmark inside the middle ring\'s footprint is drawn between the middle ring\'s farther and nearer pixels, the ring\'s ease off for it and back on after (mutant: the middle ring\'s cut, the ease put back)', async () => {
  const { gl, log } = fakeGl();
  let answer = null;
  const ring = new FarRingRenderer(gl, { mid: { midRing: () => new Promise((r) => { answer = r; }) } });
  ring._now = (() => { let t = 0; return () => (t += HORIZON_BUDGET_MS); })();
  const W = 400, Hh = 300, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 200, baseY: 150 };
  ring.build(inputs, 200, 150, 5, new Map());
  answer({ heights: new Float32Array(midRingSide() ** 2).fill(60) });
  await new Promise((r) => setTimeout(r, 0));
  for (let k = 0; k < 300 && !ring._mid?.built; k++) ring.punchHole(200, 150, 5, new Map());
  assert.ok(ring._mid.built);
  ring.punchHole(200, 150, 5, new Map());
  const h = ring.addLandmark({ px: 206, py: 150, mesh: landmarkBox({ x: S / 2, z: S / 2, w: 100, d: 100, y: 60, h: 200 }) });
  log.events.length = 0;
  ring.draw(new Float32Array(16), drawOpts);
  const ev = log.events, lm = ev.findIndex((e) => e[0] === 'draw' && e[1] === h.landmark.vao.vao), midVao = ring._mid.vao.vao;
  const midDraws = ev.filter((e) => e[0] === 'draw' && e[1] === midVao);
  assert.ok(lm > 0 && ev.slice(0, lm).some((e) => e[0] === 'draw' && e[1] === midVao) && ev.slice(lm).some((e) => e[0] === 'draw' && e[1] === midVao), 'the middle ring on both sides of it');
  const total = midDraws.reduce((a, e) => a + e[2], 0);
  assert.equal(total, ring._mid.total, 'every cell of the middle ring once');
  const d = landmarkDistance(206, 150, 200, 150), cut = ring._mid.order.find((p) => p.d < d).at;
  const firstAfter = ev.slice(lm).find((e) => e[0] === 'draw' && e[1] === midVao);
  assert.equal(firstAfter[4], cut * 2, 'the nearer pixels from the cut (16-bit indices)');
  const morphs = ev.filter((e) => e[0] === 'u3' && e[1] === 'uMorph');
  assert.deepEqual(morphs.slice(-2), [['u3', 'uMorph', 0, 0, 0], ['u3', 'uMorph', MID_MORPH_START, MID_MORPH_END, 1]], 'off for the landmark, on again for the ring');
  assert.ok(MID_RADIUS > d);
});
