// EV4 - DISTANT LAND, pinned with no GL and no game data: the sampler
// kernel factored without a numeric wobble, the ghost sampler's
// neighbor mapping proven through the sampler's own edge-continuity
// law, central-difference edge normals, the strided far-ring grid with
// its crack skirt, the fog end following the live Land View Distance
// (identity at DFU's default), and the wiring shape in the hosts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE,
  generateSamples, sampleKernel, ghostSampler,
} from '../src/world/terrainSampler.js';
import {
  buildTerrainGrid, buildTerrainIndices, TERRAIN_SKIRT_DEPTH,
} from '../src/world/terrainSurface.js';
import { FOG_SETTINGS, scaleFogForDistance } from '../src/world/weather.js';

const hDim = HEIGHTMAP_DIMENSION;

// A deterministic stand-in for WoodsFile: window reads keyed to the
// ABSOLUTE coordinates the sampler asks for, so neighboring pixels see
// overlapping windows exactly as they do over the real file - which is
// what makes the edge-continuity assertions below meaningful.
const fakeWoods = {
  getHeightMapValuesRange1Dim(mx, my, d) {
    const a = new Float32Array(d * d);
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1);
      }
    }
    return a;
  },
  getLargeHeightMapValuesRange(mx, my, span) {
    // The real reader's y axis DESCENDS in map pixels (woodsFile.js
    // reads getLargeMapData(mapPixelX + x, mapPixelY - y) and inverts
    // inside the pixel) - the fake must share the orientation or the
    // continuity law below has nothing to hold onto.
    const d = span * 3;
    const a = new Float32Array(d * d);
    for (let x = 0; x < d; x++) {
      for (let y = 0; y < d; y++) {
        a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3);
      }
    }
    return a;
  },
};

test('EV4: sampleKernel IS generateSamples - the factoring moved no arithmetic', () => {
  const s = generateSamples(fakeWoods, 207, 213);
  const k = sampleKernel(fakeWoods, 207, 213);
  for (const [x, y] of [[0, 0], [64, 64], [128, 128], [1, 127], [37, 90]]) {
    // the grid stores f32; the kernel answers f64 - fround is the store
    assert.equal(Math.fround(k(x, y)), s[x * hDim + y], `kernel(${x},${y}) bit-equal to the generated grid`);
  }
});

test('EV4: the sampler is continuous at pixel edges (the law the ghost mapping rides)', () => {
  // x=128 of pixel px is x=0 of px+1; y=128 of py is y=0 of py-1
  // (map Y runs south). Continuity is the sampler's own guarantee
  // ("divisor ensures continuous range"); the ghost mapping is just
  // this law read one sample further.
  const c = sampleKernel(fakeWoods, 207, 213);
  const east = sampleKernel(fakeWoods, 208, 213);
  const north = sampleKernel(fakeWoods, 207, 212);
  for (let i = 0; i <= 128; i += 32) {
    assert.ok(Math.abs(c(128, i) - east(0, i)) < 1e-6, `x-edge continuity at y=${i}`);
    assert.ok(Math.abs(c(i, 128) - north(i, 0)) < 1e-6, `y-edge continuity at x=${i}`);
  }
});

test('EV4: ghostSampler answers out-of-range coordinates one step past the shared edge', () => {
  const ghost = ghostSampler(fakeWoods, 207, 213);
  const c = sampleKernel(fakeWoods, 207, 213);
  const east = sampleKernel(fakeWoods, 208, 213);
  const west = sampleKernel(fakeWoods, 206, 213);
  const north = sampleKernel(fakeWoods, 207, 212);
  const south = sampleKernel(fakeWoods, 207, 214);
  // in range: the pixel's own kernel
  assert.equal(ghost(64, 64), c(64, 64));
  // one out: the neighbor's row just past the shared edge
  assert.equal(ghost(129, 40), east(1, 40));
  assert.equal(ghost(-1, 40), west(127, 40));
  assert.equal(ghost(40, 129), north(40, 1));
  assert.equal(ghost(40, -1), south(40, 127));
  // the stride-4 span the far ring's normals ask about
  assert.equal(ghost(-4, 8), west(124, 8));
  assert.equal(ghost(132, 8), east(4, 8));
});

test('EV4: ghost rows make edge normals central differences - a plane lights flat to its rim', () => {
  // Samples on a uniform x-slope. With the old clamped one-sided
  // differences the x=0 and x=128 columns computed a HALVED slope -
  // the lighting lattice at every 819.2-unit seam. With a ghost that
  // continues the plane, every normal on the grid is identical.
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const slope = 2 ** -13;   // exactly representable: 0.25 + k*slope is exact in f32 for the whole grid
  const samples = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let y = 0; y < hDim; y++) samples[x * hDim + y] = 0.25 + slope * x;
  const ghost = (x) => 0.25 + slope * x;
  const flat = buildTerrainGrid(samples, 1, ghost);
  const iEdge = (0 * hDim + 0) * 3;          // vertex (x=0, z=0)
  const iMid = (64 * hDim + 64) * 3;         // vertex (x=64, z=64)
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(flat.normals[iEdge + k] - flat.normals[iMid + k]) < 1e-6,
      'edge normal equals interior normal under a ghost');
  }
  // ...and WITHOUT the ghost the edge still falls back to the old
  // clamped one-sided form (the default path unchanged).
  const old = buildTerrainGrid(samples);
  // nx = h(x-1)-h(x+1) = -2*slope*wh over ny = 2*cell - the 2s cancel
  const expectNx = (-slope * worldHeight) / Math.hypot(slope * worldHeight, TERRAIN_SIZE / (hDim - 1));
  assert.ok(Math.abs(old.normals[iMid] - expectNx) < 1e-6, 'interior slope normal');
  assert.ok(Math.abs(old.normals[iEdge]) < Math.abs(old.normals[iMid]),
    'clamped edge normal is the halved one-sided slope');
});

test('EV4: the strided far-ring grid - 33x33 on the same samples, skirt below the rim', () => {
  const samples = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let y = 0; y < hDim; y++) {
    samples[x * hDim + y] = 0.1 + 0.05 * Math.sin(x * 0.3) * Math.cos(y * 0.2);
  }
  const full = buildTerrainGrid(samples);
  const lod = buildTerrainGrid(samples, 4);
  const g = 32 + 1;
  assert.equal(lod.positions.length, (g * g + 4 * g) * 3, '33x33 grid + 4 skirt edges');
  // every LOD vertex coincides with the full-res vertex it samples
  for (const [xi, zi] of [[0, 0], [16, 16], [32, 32], [5, 20]]) {
    const lo = (zi * g + xi) * 3;
    const fo = ((zi * 4) * hDim + xi * 4) * 3;
    for (let k = 0; k < 3; k++) {
      assert.equal(lod.positions[lo + k], full.positions[fo + k],
        `LOD vertex (${xi},${zi}) sits exactly on the full-res grid`);
    }
  }
  // skirt: same x/z as its rim vertex, dropped by the skirt depth
  const skirtBase = g * g;
  for (let i = 0; i < g; i++) {
    const top = (0 * g + i) * 3;             // south row vertex (i, 0)
    const bot = (skirtBase + i) * 3;         // its skirt copy
    assert.equal(lod.positions[bot], lod.positions[top]);
    assert.equal(lod.positions[bot + 1], lod.positions[top + 1] - TERRAIN_SKIRT_DEPTH);
    assert.equal(lod.positions[bot + 2], lod.positions[top + 2]);
  }
});

test('EV4: strided indices - a 16x triangle cut, the skirt stitched both ways, all in range', () => {
  const full = buildTerrainIndices();
  const lod = buildTerrainIndices(4);
  assert.equal(full.length, 128 * 128 * 6, 'the full grid is untouched');
  const g = 33;
  assert.equal(lod.length, 32 * 32 * 6 + 32 * 4 * 12, 'grid quads + double-wound skirt quads');
  const vertCount = g * g + 4 * g;
  for (const i of lod) assert.ok(i >= 0 && i < vertCount, 'every index addresses a real vertex');
  // the grid part keeps the retired tessellation's diagonal
  assert.deepEqual([...lod.slice(0, 6)], [0, g, g + 1, 0, g + 1, 1]);
  // each skirt quad pairs a rim vertex with its own dropped copy
  const skirtStart = 32 * 32 * 6;
  assert.deepEqual([...lod.slice(skirtStart, skirtStart + 6)],
    [0, g * g, g * g + 1, 0, g * g + 1, 1]);
});

test('EV4: the distance haze follows the Land View Distance; weather does not', () => {
  // DFU's default distance is 3: the SAME frozen object comes back,
  // identity included - the classic path is untouched.
  assert.equal(scaleFogForDistance(FOG_SETTINGS.sunny, 3), FOG_SETTINGS.sunny);
  assert.equal(scaleFogForDistance(FOG_SETTINGS.sunny, 1), FOG_SETTINGS.sunny);
  assert.equal(scaleFogForDistance(FOG_SETTINGS.overcast, 2), FOG_SETTINGS.overcast);
  // distance 4 stretches the linear rows by 4/3 - 2400 stays the base
  const far = scaleFogForDistance(FOG_SETTINGS.sunny, 4);
  assert.equal(far.end, 3200);
  assert.equal(far.start, 0);
  assert.equal(far.mode, 'linear');
  assert.equal(far.excludeSky, FOG_SETTINGS.sunny.excludeSky);
  assert.equal(FOG_SETTINGS.sunny.end, 2400, 'the table itself never moves');
  // exp rows are WEATHER (rain, snow, heavy fog) - never stretched
  for (const key of ['rainy', 'snowy', 'heavy', 'interior', 'dungeon']) {
    assert.equal(scaleFogForDistance(FOG_SETTINGS[key], 4), FOG_SETTINGS[key], `${key} passes through`);
  }
});

test('EV4: the wiring - fog seam, far ring, restride, and the per-set index buffers', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  // both fogForWeather call sites route through the distance scale
  assert.equal((world.match(/scaleFogForDistance\(fogForWeather\(/g) || []).length, 2,
    'both weather-fog reads ride the live distance');
  // the far ring: strided build, its own index set, enhanced-gated,
  // and a surviving pixel re-strides when the walk reclassifies it
  assert.ok(world.includes('TERRAIN_INDICES_LOD'), 'the strided index set exists');
  assert.ok(world.includes('const lodOn = isEnhanced()'), 'the 1:1 lane keeps full resolution');
  assert.ok(world.includes('restrideTerrain(p, want)'), 'ring-class changes swap the surface in place');
  // EV7 moved buildPixel's kernel call into terrainGen.js whole; the
  // ghost-row law now lives there, and the RESTRIDE (main-thread by
  // design - rare, cheap, and reading cached samples) keeps its own.
  assert.ok(world.includes('ghostSampler(woods, p.px, p.py)'), 'the restride reads the neighbor pixels');
  assert.ok(readFileSync('src/world/terrainGen.js', 'utf8').includes('ghostSampler(woods, px, py)'),
    'the kernel reads them for every build');
  // the renderer keeps one shared buffer PER index set, not one total
  const renderer = readFileSync('src/render/renderer.js', 'utf8');
  assert.ok(renderer.includes('_terrainIndexSets'), 'index buffers key on the index array');
  assert.ok(!renderer.includes('_terrainIndexBuffer'), 'the first-set-wins cache is gone');
});
