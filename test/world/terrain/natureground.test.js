// NATURE-GROUND (2026-09-26, Ilvi on the Discord: "I encountered a lot of floating sprites across Illiac Bay, and I
// thought if there is a way to drop all of them to 0 z position"). A location stands on its pixel's average height, and
// blendLocationTerrain flattens the ground to that height only inside the location's rect - the band past it is EASED
// toward it, out to the pixel's edge. The block's trees, bushes and rocks in that band stood on the plane, over ground
// falling away under them or rising through them. They stand on the drawn ground now (world.js buildPixelNow, through
// terrainSurface.js groundOffPlane), and inside the rect nothing moves. Driven over the real blend, on a slope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundOffPlane, surfaceHeightAt } from '../../../src/world/terrain/terrainSurface.js';
import { calcAvgMaxHeight, blendLocationTerrain } from '../../../src/world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const H = HEIGHTMAP_DIMENSION;
const WH = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const PER_TILE = TERRAIN_SIZE / (H - 1);   // a tile is a sample's span

/** A pixel rising west to east, a small location's rect in its middle (tile space), blended as the build blends it. */
function slopedLocation() {
  const samples = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let z = 0; z < H; z++) samples[x * H + z] = 0.1 + 0.3 * (x / (H - 1)) + 0.013 * Math.sin(z);
  const [avg] = calcAvgMaxHeight(samples);
  blendLocationTerrain(samples, avg, { xMin: 48, xMax: 80, yMin: 48, yMax: 80 });
  return { samples, avg, plane: Math.fround(avg) * WH };
}

test('NATURE-GROUND: inside the flattened rect a flat keeps the plane EXACTLY - outside, it is lifted to the ground the pixel draws', () => {
  const { samples, avg, plane } = slopedLocation();
  for (const t of [49, 56.5, 64, 71.25, 79]) {
    assert.equal(groundOffPlane(samples, avg, t * PER_TILE, 64 * PER_TILE), 0, `tile ${t}: inside the rect nothing moves`);
  }
  const west = [6 * PER_TILE, 64 * PER_TILE], east = [122 * PER_TILE, 60.5 * PER_TILE];
  const w = groundOffPlane(samples, avg, ...west), e = groundOffPlane(samples, avg, ...east);
  assert.ok(w < -20, `the low side's ground lies far under the plane (${w.toFixed(1)}) - the report's floating bush`);
  assert.ok(e > 20, `the high side's rises through it (${e.toFixed(1)}) - a bush sunk to its crown`);
  for (const [lx, lz] of [west, east, [30 * PER_TILE, 100 * PER_TILE]]) {
    assert.ok(Math.abs(plane + groundOffPlane(samples, avg, lx, lz) - surfaceHeightAt(samples, lx, lz)) < 1e-9, 'plane + lift IS the drawn surface');
  }
});

test('NATURE-GROUND by source: the pixel build lifts the block\'s nature flats by the ground\'s offset, and nothing else it stands', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const fx = locLocal\[0\] \+ b\.originX \+ flat\.x, fz = locLocal\[2\] \+ b\.originZ \+ flat\.z;/);
  assert.match(w, /const lift = flat\.archive === natureArchive \? groundOffPlane\(samples, avg, fx, fz\) : 0;/, 'the climate\'s nature archive alone - a lamp, a sign, an animal may stand on a model');
  // TREES-SEATED (test/world/fb1003b_trees.test.js): a block whose hills the port draws as its stand-ins seats its whole nature RANGE
  // on the higher of that ground and the mounds; every other block keeps the plane and this lift, as before
  assert.match(w, /addFlat\(flat\.archive, flat\.record, fx, locLocal\[1\] \+ \(hillSeat && isNatureArchive\(flat\.archive\) \? seatNatureFlat\(hillSeat, flat\.x, flat\.z, NATURE_FLATS_Y \+ groundOffPlane\(samples, avg, fx, fz\)\) : flat\.y \+ lift\), fz, \{ block, n \}\);/);
  assert.match(w, /const flatOpts = \{ climateIndex: maps\.getClimateIndex\(px, py\), solid: blockSolids\([^\n]*\n\s+const blockFlats = collectBlockFlats\(b\.dfBlock, natureArchive, flatOpts\);/, 'the archive the scenery and the nature flats were swapped to (FIELD BUGS 2026-10-04d CROPS: a field\'s batch handed the climate and the block\'s solids too)');
});
