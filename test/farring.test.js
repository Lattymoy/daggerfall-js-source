// EV8 - THE FAR PROVINCE RING, pinned with no GL and no game data:
// the height law is the streamed terrain's own (un-exaggerated - the
// travel map's x24 stays display skin), vertices sit at map-pixel
// centres in pixel-corner units relative to a base pixel (one
// pixelTranslation places the whole mesh, recenters free), tints are
// overworldTint verbatim, normals are real central differences, the
// hole skips exactly the streamed rect's cells, and the pass draws
// inside the host's sky-to-markForeignPass span behind the enhanced
// gate with ?ring=off as the hatch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ringHeight, buildFarRingGrid, buildFarRingIndices, ringDisabled,
  FarRingRenderer, RING_RADIUS, RING_REBUILD_DRIFT,
} from '../src/render/farRing.js';
import { SCALED_OCEAN_ELEVATION, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { overworldTint, overworldHeight, BASE_HEIGHT_SCALE } from '../src/ui/overworldModel.js';

const flatWorld = (byte) => ({
  heightBytes: new Uint8Array(1000 * 500).fill(byte),
  mapWidth: 1000, mapHeight: 500,
  climateAt: () => 231,   // Woodlands
});

test('EV8: the height law is the streamed terrain\'s own, not the travel map\'s skin', () => {
  assert.equal(ringHeight(0), SCALED_OCEAN_ELEVATION * DEFAULT_TERRAIN_SCALE, 'the flat sea at 40.8');
  assert.equal(ringHeight(100), 100 * BASE_HEIGHT_SCALE * DEFAULT_TERRAIN_SCALE, 'land is byte*8*1.5 world units');
  assert.equal(ringHeight(2), ringHeight(0), 'the ocean floor clamps like the sampler');
  // the travel map's overworldHeight carries a documented x24 relief
  // exaggeration in map-pixel units - deliberately NOT this law
  assert.notEqual(ringHeight(100), overworldHeight(100));
});

test('EV8: vertices sit at pixel centres relative to the base - north is +z, one origin places all', () => {
  const g = buildFarRingGrid({ ...flatWorld(50), baseX: 207, baseY: 213, radius: 2 });
  assert.equal(g.side, 5);
  assert.equal(g.positions.length, 25 * 3);
  const at = (i, j) => g.positions.subarray((j * g.side + i) * 3, (j * g.side + i) * 3 + 3);
  const approx = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-3, `${m}: ${a} !~ ${b}`);
  // the centre vertex is the base pixel's own centre (f32 storage)
  const c = at(2, 2);
  approx(c[0], 0.5 * TERRAIN_SIZE, 'centre x');
  approx(c[2], 0.5 * TERRAIN_SIZE, 'centre z');
  approx(c[1], ringHeight(50), 'centre height');
  // one pixel east: +819.2 in x; one pixel NORTH (py-1, j-1): +819.2 in z
  approx(at(3, 2)[0] - c[0], TERRAIN_SIZE, 'east step');
  approx(at(2, 1)[2] - c[2], TERRAIN_SIZE, 'map Y runs south - py-1 is +z');
  // a flat field lights straight up
  assert.deepEqual([...g.normals.subarray(0, 3)], [0, 1, 0]);
});

test('EV8: tints are the overworld law verbatim; slopes bend the normal the terrain-grid way', () => {
  const bytes = new Uint8Array(1000 * 500);
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) bytes[y * 1000 + x] = Math.min(255, x % 200);
  const climateAt = (x, y) => ((x + y) % 2 ? 232 : 223);   // alternate climates
  const g = buildFarRingGrid({ heightBytes: bytes, mapWidth: 1000, mapHeight: 500, climateAt, baseX: 100, baseY: 100, radius: 3 });
  const side = g.side;
  for (const [i, j] of [[0, 0], [3, 3], [6, 2]]) {
    const px = 100 - 3 + i, py = 100 - 3 + j;
    const want = overworldTint(climateAt(px, py), bytes[py * 1000 + px]);
    const o = (j * side + i) * 3;
    assert.deepEqual([...g.colors.subarray(o, o + 3)], [want[0], want[1], want[2]], `tint at (${px},${py})`);
    // heights rise with x here, so the normal leans west (negative x)
    assert.ok(g.normals[o] < 0, 'the slope law matches buildTerrainGrid\'s sign');
    assert.ok(g.normals[o + 1] > 0.5, 'and stays upward');
  }
});

test('EV8: the hole skips exactly the streamed rect\'s cells and every index stays in range', () => {
  const radius = 6, baseX = 50, baseY = 50, d = 2;
  const idx = buildFarRingIndices({ baseX, baseY, radius, holeX: 50, holeY: 50, holeRadius: d });
  const side = radius * 2 + 1;
  const totalCells = (side - 1) * (side - 1);
  const holeCells = (2 * d + 1) * (2 * d + 1);
  assert.equal(idx.length, (totalCells - holeCells) * 6, 'the hole is the streamed square, no more');
  const vertCount = side * side;
  const holeVerts = new Set();
  // reconstruct: no triangle's CELL may sit inside the hole - check by
  // re-deriving each triangle's cell from its first index
  for (let t = 0; t < idx.length; t += 3) {
    assert.ok(idx[t] >= 0 && idx[t] < vertCount, 'index in range');
    const i0 = idx[t];
    const i = i0 % side, j = (i0 - i) / side;
    const px = baseX - radius + i, py = baseY - radius + j;
    assert.ok(!(Math.abs(px - 50) <= d && Math.abs(py - 50) <= d), `cell (${px},${py}) is inside the hole`);
    holeVerts.add(i0);
  }
  // an off-centre hole (the player walked; only the indices re-punch)
  const idx2 = buildFarRingIndices({ baseX, baseY, radius, holeX: 53, holeY: 48, holeRadius: d });
  assert.notEqual(idx2.length, 0);
  assert.notDeepEqual([...idx2], [...idx], 'the hole moved with the walk');
});

test('EV8: map-edge pixels clamp instead of reading past the plane', () => {
  const g = buildFarRingGrid({ ...flatWorld(10), baseX: 1, baseY: 1, radius: 3 });
  assert.equal(g.positions.length, 7 * 7 * 3, 'the grid is whole at the map corner');
  for (let k = 1; k < g.positions.length; k += 3) assert.ok(Number.isFinite(g.positions[k]));
});

test('EV8: ?ring=off is the escape hatch, in the ?cull=off shape', () => {
  assert.equal(ringDisabled('?ring=off'), true);
  assert.equal(ringDisabled('?a=1&ring=off'), true);
  assert.equal(ringDisabled('?ring=on'), false);
  assert.equal(ringDisabled(''), false);
  assert.equal(ringDisabled(undefined), false);
});

test('EV8: the pass stands up, builds, re-punches and draws under the Proxy-GL stub', () => {
  const counts = { drawElements: 0, bufferData: 0 };
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return () => ({});
      if (k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return () => ({});
      if (k === 'drawElements' || k === 'bufferData') return () => { counts[k]++; };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const r = new FarRingRenderer(stub);
  assert.equal(r.needsRebuild(0, 0), true, 'an unbuilt ring wants a build');
  r.build({ ...flatWorld(30), baseX: 207, baseY: 213, radius: 4 }, 207, 213, 2);
  assert.ok(r.indexCount > 0);
  assert.equal(r.needsRebuild(207 + RING_REBUILD_DRIFT, 213), false, 'drift inside the slack re-punches only');
  assert.equal(r.needsRebuild(207 + RING_REBUILD_DRIFT + 1, 213), true, 'past the slack it re-centres');
  const uploadsBefore = counts.bufferData;
  r.punchHole(207, 213, 2);
  assert.equal(counts.bufferData, uploadsBefore, 'the same hole is free');
  r.punchHole(208, 213, 2);
  assert.ok(counts.bufferData > uploadsBefore, 'a moved hole re-uploads indices only');
  r.draw(new Float32Array(16), {
    origin: [0, 0, 0], lightDir: new Float32Array([0, 1, 0]),
    ambient: new Float32Array([0.4, 0.4, 0.4]), sunScale: 0.5, sunColor: new Float32Array([1, 1, 1]),
    fogColor: new Float32Array([0.6, 0.7, 0.8]), fogEnd: 2400, fovY: 1, aspect: 1.6,
  });
  assert.equal(counts.drawElements, 1, 'one draw for the whole horizon');
  r.dispose();
  assert.equal(r.vao, null);
});

test('EV8: the wiring - enhanced-gated, weather-gated, inside the sky\'s foreign span, one origin', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.ok(world.includes('const farRing = (isEnhanced() && !ringDisabled()) ? new FarRingRenderer(renderer.gl) : null'),
    'the 1:1 lane keeps the fog horizon DFU draws');
  // the draw sits between the sky and the one existing seam mark - no
  // third markForeignPass (glstate.test.js counts exactly two)
  const skyAt = world.indexOf('sky.draw(cam.yaw');
  const markAt = world.indexOf('renderer.markForeignPass();', skyAt);
  const span = world.slice(skyAt, markAt);
  assert.ok(span.includes("weatherFog.mode === 'linear'"), 'exp fog (weather) hides the ring');
  assert.ok(span.includes('farRing.draw(view, {'), 'drawn while the depth buffer is still the sky\'s');
  assert.ok(span.includes('state.pixelTranslation(farRing.baseX, farRing.baseY'),
    'one translation places the whole mesh - recenters are free');
  assert.ok(span.includes('farRing.needsRebuild(state.current.x, state.current.y)'),
    'the grid follows the walk');
  assert.equal((world.match(/renderer\.markForeignPass\(\);/g) || []).length, 2,
    'the ring shares the sky\'s seam - the EV6 count stands');
});
