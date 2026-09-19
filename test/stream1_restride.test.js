// STREAM1 (2026-09-19): A PROMOTION IS QUEUED, NOT PAID ON THE CROSSING.
//
// EV4 lets a surviving pixel cross between the full-res core and the
// strided far ring by swapping its terrain SURFACE, and world.js did all
// of them inline on the frame the player crossed a map pixel. Measured,
// `buildTerrainGrid` at stride 1 is ~3 ms of main thread - 16,641
// vertices, each with a central-difference normal - and a crossing
// promotes FIVE pixels at once, so the crossing frame paid ~15 ms and
// dropped. Promotions queue now and the frame loop spends one a frame;
// demotions are ~0.11 ms and stay inline.
//
// The five is not a guess and it does not depend on the land view
// distance: the ring boundary is LOD_NEAR, a Chebyshev radius of 3, and
// the pin below counts the class changes directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTerrainGrid } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('STREAM1: a crossing promotes FIVE pixels whatever the land view distance is - the ring boundary is not the radius', () => {
  const world = read('src/scenes/world.js');
  const near = Number(world.match(/const LOD_NEAR = (\d+);/)[1]);
  const lodStride = Number(world.match(/const LOD_STRIDE = (\d+);/)[1]);
  assert.equal(near, 3); assert.equal(lodStride, 4);
  const cls = (dx, dy) => (Math.max(Math.abs(dx), Math.abs(dy)) >= near ? lodStride : 1);
  for (const radius of [3, 4, 5, 6]) {
    let promote = 0, demote = 0;
    for (let px = -radius; px <= radius; px++) {
      for (let py = -radius; py <= radius; py++) {
        if (Math.abs(px - 1) > radius) continue;   // not in both grids: a new pixel, not a restride
        const before = cls(px, py), after = cls(px - 1, py);
        if (before === lodStride && after === 1) promote++;
        if (before === 1 && after === lodStride) demote++;
      }
    }
    assert.equal(promote, 5, `radius ${radius}: five pixels promote - the count is the BOUNDARY's, not the radius's`);
    assert.equal(demote, 5, `radius ${radius}: and five demote`);
  }
});

test('STREAM1: the expensive direction is the one that is queued, and it is expensive', () => {
  // THE COST, measured here rather than asserted: a stride-1 grid is a
  // 129x129 lattice with a central difference per vertex; a stride-4 one
  // is a 33x33. The ratio is what makes one worth queueing and the other
  // not - the numbers themselves are a machine's and are not pinned.
  const hDim = HEIGHTMAP_DIMENSION;
  const samples = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) samples[x * hDim + z] = 0.5 + 0.006 * Math.sin(x * 0.025) * Math.cos(z * 0.02);
  const ghost = () => 0.5;
  const time = (stride) => {
    for (let i = 0; i < 5; i++) buildTerrainGrid(samples, stride, ghost);
    const xs = [];
    for (let i = 0; i < 9; i++) { const t = process.hrtime.bigint(); buildTerrainGrid(samples, stride, ghost); xs.push(Number(process.hrtime.bigint() - t) / 1e6); }
    return xs.sort((a, b) => a - b)[4];
  };
  const one = time(1), four = time(4);
  assert.ok(one > four * 4, `a stride-1 grid is far dearer than a stride-4 one (${one.toFixed(2)} ms against ${four.toFixed(2)})`);
  const g1 = buildTerrainGrid(samples, 1, ghost), g4 = buildTerrainGrid(samples, 4, ghost);
  assert.equal(g1.positions.length / 3, hDim * hDim, 'stride 1 is every sample');
  assert.ok(g4.positions.length < g1.positions.length / 10, 'and stride 4 is a sixteenth of the lattice plus a skirt');
});

test('STREAM1: the queue is spent a pixel a frame, nearest first, and never on a pixel that no longer wants it', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const restridePending = new Map\(\);/, 'the queue is keyed by pixel, so a pixel queued twice is queued once');
  assert.match(world, /const RESTRIDE_PER_FRAME = 1;/, 'one stride-1 grid a frame - two would be most of a 60 Hz budget');
  assert.match(world, /spendRestrides\(\);\s+\/\/ STREAM1/, 'and the frame loop spends it');
  // THE THREE REFUSALS, each a real case on a walk: a pixel evicted while
  // it waited, a pixel that walked back out of the near ring before its
  // turn, and the budget itself.
  const fn = world.slice(world.indexOf('function spendRestrides()'), world.indexOf('function restrideTerrain('));
  assert.match(fn, /if \(budget <= 0\) break;/);
  assert.match(fn, /if \(!built\.has\(`\$\{p\.px\},\$\{p\.py\}`\)\) continue;/, 'an evicted pixel is dropped, not rebuilt into freed GL objects');
  assert.match(fn, /if \(s === p\._stride\) continue;/, 'and one that changed back builds nothing');
  // NEAREST FIRST, and the comparator RUN rather than merely present -
  // a reversed sort leaves the ring the player is walking into waiting
  // behind the one they are walking away from, and reads as terrain
  // that sharpens late.
  const cmp = fn.match(/\.sort\((\([\s\S]*?)\);\n/);
  assert.ok(cmp, 'the queue is sorted');
  const current = { x: 10, y: 10 };
  // eslint-disable-next-line no-new-func
  const sorter = new Function('state', `return ${cmp[1]}`)({ current });
  const far = { px: 16, py: 10 }, near = { px: 11, py: 10 };
  assert.ok(sorter(near, far) < 0, 'the nearer pixel sorts first');
  assert.ok(sorter(far, near) > 0, '...and the further one after it');
  assert.deepEqual([far, near].sort(sorter), [near, far]);
  // BOTH call sites queue the promotion and take the demotion now
  assert.match(world, /if \(want === 1\) restridePending\.set\(`\$\{p\.px\},\$\{p\.py\}`, p\);/, 'the crossing sweep');
  assert.match(world, /if \(wantStride === 1\) restridePending\.set\(key, entry\);/, 'and the publish re-check');
  assert.ok(!/for \(const p of built\.values\(\)\) \{\s*const want = strideFor\(p\.px, p\.py\);\s*if \(want !== p\._stride\) restrideTerrain\(p, want\);/.test(world),
    'the inline sweep that paid all five is gone');
});
