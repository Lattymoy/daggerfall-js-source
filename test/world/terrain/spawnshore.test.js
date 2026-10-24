// SPAWN-SHORE (2026-09-29, Shabalako: "An elite dungeon spawned like this on a beach/sea") - a spawned ruin stands only
// where the plateau DFU flattens it to (its whole pixel's average height, terrainGen.js calcAvgMaxHeight ->
// blendLocationTerrain) is above the beach band. The Ocean-climate gate alone let it onto the sea: the boot spreads land
// climates two pixels into it (terrainHelper.js dilateCoastalClimate), so a coast's first sea pixels read as land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSpawnGround, spawnPlateauFloor, SPAWN_DRY_ELEVATION } from '../../../src/world/spawnedDungeons.js';
import { generateSamples, sampleKernel, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, SCALED_OCEAN_ELEVATION } from '../../../src/world/terrain/terrainSampler.js';
import { calcAvgMaxHeight, BEACH_JITTER } from '../../../src/world/terrain/terrainTiles.js';

/** A WoodsFile's three-method surface over a byte-per-pixel function; the large map flat at `large`. */
const woodsOf = (byteAt, large = 0) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const dst = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) dst[x + y * dim] = byteAt(x0 + x, y0 + y);
    return dst;
  },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3).fill(large),
});
/** The plateau the build flattens a location to, metres - its own two calls. */
const buildPlateau = (woods, px, py) => calcAvgMaxHeight(generateSamples(woods, px, py))[0] * MAX_TERRAIN_HEIGHT;

test('SPAWN-SHORE: the dry line is the beach band\'s highest dirt', () => {
  assert.equal(SPAWN_DRY_ELEVATION, SCALED_BEACH_ELEVATION + BEACH_JITTER);
  assert.ok(SPAWN_DRY_ELEVATION > SCALED_OCEAN_ELEVATION);
});

test('SPAWN-SHORE: open sea, a coast\'s sea edge and a beach stand no ruin; inland ground does', () => {
  const sea = woodsOf(() => 0);
  assert.equal(createSpawnGround(sea)(100, 100), false, 'open sea');
  // The reported case: the climate page was spread over the pixel, but its own height byte is the sea's.
  const seaEdge = woodsOf((x) => (x >= 101 ? 30 : 0));
  assert.ok(buildPlateau(seaEdge, 100, 100) <= SPAWN_DRY_ELEVATION, 'the build would flatten it to the waterline');
  assert.equal(createSpawnGround(seaEdge)(100, 100), false, 'a coast\'s sea edge');
  assert.equal(createSpawnGround(seaEdge)(103, 100), true, 'the same coast, inland');
  // Why the plateau and not the byte: a pixel's ground spans its own byte AND its western one (the kernel's window), so
  // a low shore whose own byte is above the sea (8 * 8 = 64 m) is still flattened to the beach by the sea beside it.
  const lowShore = woodsOf((x) => (x >= 101 ? 8 : 0));
  assert.ok(buildPlateau(lowShore, 101, 100) <= SPAWN_DRY_ELEVATION, 'its plateau is the beach');
  assert.equal(createSpawnGround(lowShore)(101, 100), false, 'a low shore');
  const beach = woodsOf(() => 5);   // 5 * 8 = 40 m: the beach band
  assert.equal(createSpawnGround(beach)(100, 100), false, 'a beach');
  const land = woodsOf(() => 20);
  assert.equal(createSpawnGround(land)(100, 100), true, 'inland');
});

test('SPAWN-SHORE: the gate\'s plateau is a strict LOWER bound of the build\'s - a pixel it admits is dry for certain', () => {
  const coast = woodsOf((x, y) => Math.max(0, Math.min(255, (x - 100) * 2 + (y - 100))), 3);
  for (const [px, py] of [[98, 98], [101, 101], [102, 104], [105, 100], [110, 112]]) {
    const floor = spawnPlateauFloor(coast, px, py), real = buildPlateau(coast, px, py);
    assert.ok(floor <= real + 1e-3, `(${px},${py}): ${floor} <= ${real}`);
    assert.ok(real - floor <= 10 + 1e-3, 'short of it by the ground noise at most (EXTRA_NOISE_SCALE)');
  }
});

test('SPAWN-SHORE: the kernel\'s default is the reference\'s own - the noiseless read is opt-in', () => {
  const w = woodsOf((x, y) => (x * 7 + y * 3) % 40, 9);
  const a = sampleKernel(w, 120, 80), b = sampleKernel(w, 120, 80, undefined, true), s = generateSamples(w, 120, 80);
  for (const [x, y] of [[0, 0], [17, 90], [64, 64], [128, 5]]) {
    assert.equal(a(x, y), b(x, y));
    assert.equal(Math.fround(a(x, y)), s[x * 129 + y]);
  }
});

test('SPAWN-SHORE: kept per pixel - the height map does not change under a session', () => {
  let reads = 0;
  const w = woodsOf(() => { reads++; return 20; });
  const ground = createSpawnGround(w);
  ground(50, 50);
  const once = reads;
  ground(50, 50);
  assert.equal(reads, once, 'asked again, read nothing');
});

test('SPAWN-SHORE by source: both of the host\'s gates ask the ground - the build\'s and the Overworld\'s far found spawns', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const _spawnGround = createSpawnGround\(woods\);/);
  const i = w.indexOf('const spawnedDungeonAt = (px, py) => {');
  assert.match(w.slice(i, w.indexOf('\n  };\n', i)), /CLIMATES\.Ocean \|\| !_spawnGround\(px, py\)\) return null;/);
  const j = w.indexOf('function tvSpawnAt(px, py) {');
  assert.match(w.slice(j, w.indexOf('\n  }\n', j)), /CLIMATES\.Ocean \|\| !_spawnGround\(px, py\) \|\| tvSpawnGone/);
});
