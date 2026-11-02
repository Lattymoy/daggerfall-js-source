// WOD-BUSH (2026-10-01, Mac: "World of daggerfall bush props float above the ground in bandit camps"). The mod stands
// every object on the site's average plus the author's own height, and levels the ground to that average only inside
// the site's rect - the band past it is eased toward it (flattenForLocation). The layouts ring their sites with the
// shrub model 60610, in that band, at heights the author read off the ground of the one place they were laid out, so
// on falling ground they hung in the air. The shrub's foot now goes to the lowest drawn ground under the middle of its
// footprint (world.js buildPixelNow, through terrainSurface.js lowestGroundUnder). Driven over the real flatten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lowestGroundUnder, surfaceHeightAt, GROUND_UNDER_INSET } from '../../../src/world/terrain/terrainSurface.js';
import { flattenForLocation, WOD_TERRAIN_HEIGHT_MAX } from '../../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { WOD_BUSH_MODEL } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const H = HEIGHTMAP_DIMENSION;
const CELL = TERRAIN_SIZE / (H - 1);

/** A pixel falling steeply east to west, a 2 x 2 camp at samples (64, 64) levelled as the mod levels it. */
function slopedCamp() {
  const samples = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let z = 0; z < H; z++) samples[x * H + z] = Math.fround(0.1 + 0.3 * (x / (H - 1)) + 0.004 * Math.sin(z * 0.7));
  const rect = { x: 64, y: 64, width: 2, height: 2 };
  const avg = flattenForLocation(samples, rect);
  return { samples, rect, plane: avg * WOD_TERRAIN_HEIGHT_MAX };
}

/** The ground a box's footprint middle covers, read on a fine grid. */
function groundUnder(samples, box, n = 40) {
  const out = [];
  const x0 = box[0] + (box[3] - box[0]) * GROUND_UNDER_INSET, x1 = box[3] - (box[3] - box[0]) * GROUND_UNDER_INSET;
  const z0 = box[2] + (box[5] - box[2]) * GROUND_UNDER_INSET, z1 = box[5] - (box[5] - box[2]) * GROUND_UNDER_INSET;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) out.push(surfaceHeightAt(samples, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * j / n));
  return out;
}

test('WOD-BUSH: the shrub is model 60610, the one the bandit camps ring their sites with', () => {
  assert.equal(WOD_BUSH_MODEL, 60610);
  for (const n of ['01', '02', '03', '04', '05']) {
    assert.match(src(`vendor/world-of-daggerfall/LocationPrefab/WOD_BanditCamp_${n}.txt`), /<name>60610<\/name>/, `camp ${n} stands it`);
  }
});

test('WOD-BUSH: the lowest ground under a box is the lowest the drawn surface holds there - never above any of it', () => {
  const { samples, rect, plane } = slopedCamp();
  // the camp's own rect is levelled: a shrub there stands on the plane exactly
  const inX = rect.x * CELL + 3, inZ = rect.y * CELL + 3;
  assert.equal(lowestGroundUnder(samples, [inX, 0, inZ, inX + 4, 0, inZ + 4]), Math.fround(plane / WOD_TERRAIN_HEIGHT_MAX) * WOD_TERRAIN_HEIGHT_MAX);
  // a shrub in the band on the low side, three samples wide: across quads, the ground under it falls away
  const bx = (rect.x - 4) * CELL, bz = (rect.y + 1) * CELL;
  const box = [bx, -5, bz, bx + 3 * CELL, 5, bz + 3 * CELL];
  const low = lowestGroundUnder(samples, box);
  const under = groundUnder(samples, box);
  assert.ok(low < plane - 10, `the band's ground lies well under the camp's plane (${(low - plane).toFixed(1)}) - the floating bush`);
  assert.ok(under.every((g) => g >= low - 1e-6), 'no ground under the middle of the footprint lies lower than the answer');
  assert.ok(under.some((g) => Math.abs(g - low) < 1e-6), 'and the answer is ground the footprint covers, not a guess under it');
});

test('WOD-BUSH: a gully under the footprint is found where neither its corners nor its centre stand', () => {
  const samples = new Float32Array(H * H).fill(0.3);
  for (let z = 0; z < H; z++) samples[40 * H + z] = 0.29;   // one sample line sunk, ~19 m
  // the middle runs 37.5 .. 40.5 samples: corners and centre (39) all on the 0.3 shelf, the gully at 40 between
  const box = [36 * CELL, 0, 10 * CELL, 42 * CELL, 0, 12 * CELL];
  assert.ok(Math.abs(lowestGroundUnder(samples, box) - 0.29 * WOD_TERRAIN_HEIGHT_MAX) < 1e-3, 'the gully is the lowest ground');
});

test('WOD-BUSH: the footprint is held to the pixel - the ground past its edge is the neighbour\'s', () => {
  const { samples } = slopedCamp();
  // its middle lies wholly past the west edge (x -14 .. -2): the edge's own line is what stands under it
  const box = [-20, 0, 100, 4, 0, 110];
  const low = lowestGroundUnder(samples, box);
  let edge = Infinity;
  for (let i = 0; i <= 40; i++) edge = Math.min(edge, surfaceHeightAt(samples, 0, 102.5 + 5 * i / 40));
  assert.ok(Math.abs(low - edge) < 1e-6, `the edge's ground (${edge.toFixed(3)}), got ${low.toFixed(3)}`);
  assert.ok(surfaceHeightAt(samples, -14, 105) < low - 1, 'the ground rises east, so an extrapolation west would have read it lower');
});

test('WOD-BUSH by source: the pixel build stands the shrub alone on the ground - mesh, box and collider', () => {
  const w = hostText('src/scenes/world.js');
  // ROCK-SUNK (test/world/worldOfDaggerfall/fb1002_rocksunk.test.js): the shrub of a site that is not a rock field - isWodShrub asks the pick
  // PIN MOVED (GATE-AGREE): the pick is the standing list's (`stood` - the picks a clearing does not hold), the list the placements index
  assert.match(w, /if \(isWodShrub\(m\.modelId, stood\[m\.pick\]\?\.name\)\) \{[^\n]*\n\s+const dy = lowestGroundUnder\(samples, box\) - box\[1\];\n\s+m\.matrix\[13\] \+= dy; box\[1\] \+= dy; box\[4\] \+= dy;\n\s+\}/);
  const at = w.indexOf('if (isWodShrub(m.modelId, stood[m.pick]?.name))');
  assert.ok(at > 0, 'the shrub\'s stand');
  assert.ok(at > w.indexOf('const box = transformedAabb(archAabb(m.modelId, cpu.positions), m.matrix);'), 'after its box is read');
  assert.ok(at < w.indexOf('late.add(key, cpu.positions, cpu.indices, m.matrix, { translation: wodBucket });'), 'before its collider is filed');   // PIN MOVED (ROCK-CLEAR): filed through the world collider's gate
  assert.ok(at < w.indexOf('addStatic(cpu, m.matrix, false, m.normalMatrix)', at), 'and before it is batched');   // PIN MOVED (AUDIT PRECIP HOST-7): the merge's models logged
});
