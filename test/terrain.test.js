import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { perlinNoise } from '../src/world/perlin.js';
import {
  cubicInterpolator, getNoise, generateSamples,
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE,
} from '../src/world/terrainSampler.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function approx(actual, expected, eps = 1e-4) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('terrain: cubicInterpolator endpoints and shape', () => {
  // frac 0 lands on v1, frac 1 on v2, verbatim polynomial.
  assert.equal(cubicInterpolator(1, 5, 9, 13, 0), 5);
  assert.equal(cubicInterpolator(1, 5, 9, 13, 1), 9);
  // Uniform samples interpolate linearly at the midpoint.
  approx(cubicInterpolator(0, 4, 8, 12, 0.5), 6);
});

test('terrain: perlin determinism and range remap', () => {
  // Lattice points are always the remapped zero.
  assert.equal(perlinNoise(0, 0), 0.5);
  assert.equal(perlinNoise(7, 42), 0.5);
  // Deterministic sample pins for our permutation.
  approx(perlinNoise(0.5, 0.5), 0.5625, 1e-6);
  approx(perlinNoise(12.34, 56.78), 0.698956, 1e-6);
});

test('terrain: getNoise octave accumulation', () => {
  // Integer lattice hits: one octave = 0.5 * amplitude, two add half again.
  approx(getNoise(100, 200, 0.3, 0.5, 0.5, 1), 0.25, 1e-6);
  approx(getNoise(100, 200, 0.3, 0.5, 0.5, 2), 0.375, 1e-6);
});

function syntheticWoodsBytes() {
  // Header + 500000 offsets + per-pixel 27-byte cells + heightmap.
  const offsetsStart = 32 + 28 * 4;
  const cellsStart = offsetsStart + MAP_WIDTH * MAP_HEIGHT * 4;
  const cellSize = 22 + 25;
  const heightMapOffset = cellsStart + 2 * cellSize; // two real cells
  const bytes = new Uint8Array(heightMapOffset + MAP_WIDTH * MAP_HEIGHT);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, MAP_WIDTH * MAP_HEIGHT * 4, true); // offsetSize
  v.setUint32(4, MAP_WIDTH, true);
  v.setUint32(8, MAP_HEIGHT, true);
  v.setUint32(16, cellsStart, true); // dataSection1Offset (unused)
  v.setUint32(28, heightMapOffset, true);
  // Point every pixel at cell 0; pixel (3, 2) at cell 1.
  for (let i = 0; i < MAP_WIDTH * MAP_HEIGHT; i++) {
    v.setUint32(offsetsStart + i * 4, cellsStart, true);
  }
  v.setUint32(offsetsStart + (2 * MAP_WIDTH + 3) * 4, cellsStart + cellSize, true);
  // Cell 1's 5x5 grid: value = 10*y + x in file order.
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      bytes[cellsStart + cellSize + 22 + y * 5 + x] = 10 * y + x;
    }
  }
  // Heightmap: value = (x + y) & 0xff.
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      bytes[heightMapOffset + y * MAP_WIDTH + x] = (x + y) & 0xff;
    }
  }
  return bytes;
}

test('terrain: WoodsFile synthetic - clamps, large-map order, header gate', () => {
  const w = new WoodsFile();
  assert.equal(w.load(syntheticWoodsBytes()), true);

  // Heightmap reads and the verbatim >= dim-1 clamp.
  assert.equal(w.getHeightMapValue(3, 2), 5);
  assert.equal(w.getHeightMapValue(-5, 2), 2);
  assert.equal(w.getHeightMapValue(5000, 0), 999 & 0xff);
  const range = w.getHeightMapValuesRange1Dim(1, 1, 2);
  assert.deepEqual(Array.from(range), [2, 3, 3, 4]);

  // Large map data reads data[x][y] from row-major bytes at offset + 22.
  const lg = w.getLargeMapData(3, 2);
  assert.equal(lg[4][0], 4);  // x=4, y=0 -> byte 10*0+4
  assert.equal(lg[0][3], 30); // x=0, y=3 -> byte 10*3+0
  assert.equal(w.getLargeMapData(0, 0)[0][0], 0); // cell 0 is all zero

  // getLargeHeightMapValuesRange: dim 1 at (3, 2) takes the interior 3x3
  // with sample Y inverted: out(x, y) = src[x + 1][4 - (y + 1)].
  const r = w.getLargeHeightMapValuesRange(3, 2, 1);
  assert.equal(r.length, 9);
  assert.deepEqual(Array.from(r), [31, 32, 33, 21, 22, 23, 11, 12, 13]);

  // Header gate: wrong dimensions fail the load.
  const bad = syntheticWoodsBytes();
  new DataView(bad.buffer).setUint32(4, 999, true);
  assert.equal(new WoodsFile().load(bad), false);
});

// ---------------------------------------------------------------------------
// Real-data validation - gated on ARENA2_PATH.
// ---------------------------------------------------------------------------

function loadWoods() {
  const w = new WoodsFile();
  assert.equal(w.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD')))), true);
  return w;
}

test('terrain: WOODS.WLD corpus pins', { skip: skipReal }, () => {
  const w = loadWoods();
  // Header closure: offsets fill header..dataSection1 exactly.
  assert.equal(w.header.offsetSize, 2000000);
  assert.equal(w.header.width, 1000);
  assert.equal(w.header.height, 500);
  assert.equal(w.header.dataSection1Offset, 144 + 2000000);
  assert.equal(w.header.heightMapOffset, 2001168);

  let sum = 0, max = 0, zeros = 0;
  for (const b of w.heightMapBuffer) {
    sum += b;
    if (b > max) max = b;
    if (b === 0) zeros++;
  }
  assert.equal(sum, 11699810);
  assert.equal(max, 255);
  assert.equal(zeros, 20237);

  // Daggerfall city environs sit at raw height 20; the far corner at 82.
  assert.equal(w.getHeightMapValue(207, 213), 20);
  assert.equal(w.getHeightMapValue(999, 499), 82);
});

test('terrain: sampler pins - Daggerfall environs and open ocean', { skip: skipReal }, () => {
  const w = loadWoods();
  const hDim = HEIGHTMAP_DIMENSION;
  assert.equal(hDim, 129);
  approx(TERRAIN_SIZE, 819.2);

  // Daggerfall city pixel (207, 213): pinned samples of OUR pipeline
  // (Perlin departure documented in perlin.js).
  const s = generateSamples(w, 207, 213);
  assert.equal(s.length, hDim * hDim);
  approx(s[0], 0.161704, 1e-6);
  approx(s[64 * hDim + 64], 0.165042, 1e-6);
  approx(s[hDim * hDim - 1], 0.164015, 1e-6);
  let mn = 1, mx = 0;
  for (const v of s) { if (v < mn) mn = v; if (v > mx) mx = v; }
  approx(mn, 0.161196, 1e-6);
  approx(mx, 0.171953, 1e-6);

  // Open ocean (500, 250): every sample clamps to the ocean elevation.
  const oceanNorm = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT;
  const o = generateSamples(w, 500, 250);
  for (const v of o) {
    if (Math.abs(v - oceanNorm) > 1e-6) assert.fail(`ocean sample ${v} != ${oceanNorm}`);
  }
});
