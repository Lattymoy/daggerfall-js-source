// GRASS3 (2026-09-18): A BLADE STANDS ON THE SURFACE THAT IS DRAWN.
//
// The terrain is TRIANGLES. `buildTerrainIndices` cuts every quad on the
// diagonal (x, z)-(x+1, z+1), so inside a quad the drawn ground is two
// PLANES - and a bilinear patch over the same four samples is a
// different surface, agreeing only on that diagonal and at the corners.
// The grass placer read bilinear, so every blade off the diagonal stood
// slightly above or below the hill it was planted in.
//
// These pins do not restate the arithmetic; they check `surfaceHeightAt`
// against the REAL MESH - the actual `buildTerrainGrid` positions and
// the actual `buildTerrainIndices` triangles - by locating the triangle
// that contains each point and interpolating on its own plane. If the
// diagonal, the winding or the vertex order ever moves, the law moves
// with it or these fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTerrainGrid, buildTerrainIndices, surfaceHeightAt } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const hDim = HEIGHTMAP_DIMENSION;
const CELL = TERRAIN_SIZE / (hDim - 1);
const WORLD_H = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;

/** A heightmap with real saddles in it - a smooth field alone would let
 *  bilinear and the triangles agree by accident. */
function terrain(amp = 0.031, freq = 0.11) {
  const d = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) {
    for (let z = 0; z < hDim; z++) {
      d[x * hDim + z] = 0.5 + amp * (Math.sin(x * freq) * Math.cos(z * freq * 0.8) + 0.4 * Math.sin((x + z) * freq * 3.1));
    }
  }
  return d;
}

/** The height of the MESH at a point: the triangle that contains it,
 *  read off the real position and index buffers. */
function meshHeightAt(data, lx, lz, stride = 1) {
  const { positions } = buildTerrainGrid(data, stride, null);
  const idx = buildTerrainIndices(stride);
  const g = (hDim - 1) / stride + 1, q = g - 1, quad = CELL * stride;
  const P = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const cx = Math.max(0, Math.min(q - 1, Math.floor(lx / quad)));
  const cz = Math.max(0, Math.min(q - 1, Math.floor(lz / quad)));
  const base = (cz * q + cx) * 6;
  for (let t = 0; t < 2; t++) {
    const a = P(idx[base + t * 3]), b = P(idx[base + t * 3 + 1]), c = P(idx[base + t * 3 + 2]);
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    const u = ((b[2] - c[2]) * (lx - c[0]) + (c[0] - b[0]) * (lz - c[2])) / den;
    const v = ((c[2] - a[2]) * (lx - c[0]) + (a[0] - c[0]) * (lz - c[2])) / den;
    const w = 1 - u - v;
    if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9) return u * a[1] + v * b[1] + w * c[1];
  }
  return null;
}

const points = (n, seed, span) => {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return Array.from({ length: n }, () => [rnd() * span, rnd() * span]);
};

test('GRASS3: the height law IS the drawn mesh - every point, on its own triangle, at stride 1 and at the far ring’s stride 4', () => {
  for (const stride of [1, 4]) {
    const data = terrain();
    const { positions } = buildTerrainGrid(data, stride, null);
    let worst = 0, unlocated = 0;
    for (const [lx, lz] of points(4000, 0x51ed270b + stride, TERRAIN_SIZE - CELL * stride)) {
      const mesh = meshHeightAt(data, lx, lz, stride);
      if (mesh === null) { unlocated++; continue; }
      worst = Math.max(worst, Math.abs(mesh - surfaceHeightAt(data, lx, lz, stride)));
    }
    assert.equal(unlocated, 0, `stride ${stride}: every point falls in one of its quad's two triangles`);
    assert.ok(worst < 1e-3, `stride ${stride}: the law is the mesh to ${worst} world units`);
    // and it agrees with the VERTICES exactly, which is the one place
    // bilinear would have agreed too - so this is the weaker half
    const g = (hDim - 1) / stride + 1;
    for (const [xi, zi] of [[0, 0], [1, 3], [g - 1, g - 1], [g - 2, 5]]) {
      const want = positions[(zi * g + xi) * 3 + 1];
      const got = surfaceHeightAt(data, xi * CELL * stride, zi * CELL * stride, stride);
      assert.ok(Math.abs(want - got) < 1e-3, `stride ${stride}: vertex (${xi}, ${zi}) is its own height`);
    }
  }
});

test('GRASS3: the law is NOT bilinear, and the difference is what was putting blades off the ground', () => {
  const data = terrain();
  const bilinear = (lx, lz) => {
    const fx = lx / CELL, fz = lz / CELL;
    const x0 = Math.min(hDim - 2, Math.floor(fx)), z0 = Math.min(hDim - 2, Math.floor(fz));
    const ax = fx - x0, az = fz - z0;
    const S = (x, z) => data[x * hDim + z];
    return ((S(x0, z0) * (1 - ax) + S(x0 + 1, z0) * ax) * (1 - az)
          + (S(x0, z0 + 1) * (1 - ax) + S(x0 + 1, z0 + 1) * ax) * az) * WORLD_H;
  };
  // WHERE THE TWO AGREE IS THE FOUR CORNERS, and nowhere else in the
  // quad. Along the diagonal itself the difference works out at
  // t(1-t) x (h10 + h01 - h00 - h11) - the quad's SADDLE term - so the
  // surfaces part everywhere the ground is not a plane, and part most at
  // the quad's middle. (A first draft of this pin asserted they shared
  // the diagonal; they do not, and the pin said so.)
  const S = (x, z) => data[x * hDim + z];
  const q = 10;
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const lx = (q + i) * CELL, lz = (q + j) * CELL;
    assert.ok(Math.abs(bilinear(lx, lz) - surfaceHeightAt(data, lx, lz)) < 1e-3, `corner (${i}, ${j}) is shared`);
  }
  const saddle = Math.abs(S(q + 1, q) + S(q, q + 1) - S(q, q) - S(q + 1, q + 1)) * WORLD_H;
  for (const t of [0.25, 0.5, 0.75]) {
    const lx = (q + t) * CELL, lz = (q + t) * CELL;
    const got = Math.abs(bilinear(lx, lz) - surfaceHeightAt(data, lx, lz));
    assert.ok(Math.abs(got - t * (1 - t) * saddle) < 1e-3, `on the diagonal at t=${t} the gap is t(1-t) x the saddle`);
  }
  assert.ok(saddle > 0, 'and this quad HAS a saddle, or the pin above would pass on a plane');
  // OFF it they part, and a blade is only 0.25..0.72 world units tall at
  // the port's height of 38 - so this is blades standing in mid-air or
  // buried, not a rounding difference.
  let gap = 0;
  for (const [lx, lz] of points(4000, 0x2f6e2b1, TERRAIN_SIZE - CELL)) {
    gap = Math.max(gap, Math.abs(bilinear(lx, lz) - surfaceHeightAt(data, lx, lz)));
  }
  assert.ok(gap > 0.5, `on rolling ground the two surfaces differ by ${gap.toFixed(2)} world units - most of a blade`);
  // the placer reads the drawn surface now, and says so
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const h = surfaceHeightAt\(p\.samples, lx, lz, p\._stride \?\? 1\);/, 'the grass placer asks for the DRAWN height');
  assert.ok(!/s2\[x0 \* hDim \+ z0\] \* \(1 - ax\)/.test(world), 'and the bilinear read is gone, not merely unused');
});

test('GRASS3: the far ring’s coarser mesh needs the far ring’s stride - and the grass never reaches it', () => {
  const data = terrain();
  // Asking for a stride-1 height over stride-4 ground is the same class
  // of bug one ring out: the drawn surface there is 16x coarser.
  let worst = 0;
  for (const [lx, lz] of points(2000, 0x99, TERRAIN_SIZE - CELL * 4)) {
    worst = Math.max(worst, Math.abs(surfaceHeightAt(data, lx, lz, 1) - surfaceHeightAt(data, lx, lz, 4)));
  }
  assert.ok(worst > 1, `the two ring classes are genuinely different surfaces (${worst.toFixed(1)} world units apart)`);
  // ...and the reason it cannot bite today: the stride-1 ring is the 5x5
  // block of pixels around the player, so the nearest stride-4 ground is
  // two whole pixels away - 1,638 world units, against a grass range of
  // 250. The numbers are the host's own.
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const LOD_NEAR = 3;/, 'the far ring starts at chebyshev 3');
  assert.match(world, /const LOD_STRIDE = 4;/);
  assert.match(world, /\.filter\(\(p\) => p\._stride === 1 && p\.tilemapBytes/, 'and the grass only ever stands on the stride-1 ring');
  assert.ok((3 - 1) * TERRAIN_SIZE > 1600, 'two pixels of fine ground is 1,638 units, six times the grass range');
});
