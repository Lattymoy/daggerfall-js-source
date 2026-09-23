// PERF-COL1 - THE SPHERE RESOLVE WALKED EVERY BUCKET (2026-09-21, SquidKam on
// Discord: "Guards kill the framerate too / I think thats a sound issue right?
// cause the guards have some null sounds").
//
// It was not the sounds: a missing DAGGER.SND record is cached as null once
// and the attract cadence fires every 3-9 s. tools/guardCostProbe.mjs stood
// five watchmen (MAX_ACTIVE_GUARD_SPAWNS) on the real EnemyAI over the real
// Collider holding a synthetic town and measured 5.5 ms a frame median, 20 ms
// at p90 - 85% of it in `_resolveSphere`, which walked EVERY bucket for EVERY
// sample: nine string keys, nine Map lookups and a fresh Set per bucket,
// whether or not the bucket was anywhere near the sphere. A capsule resolve is
// ~9 samples and a step up to ~5 resolves, so five bodies paid it ~90 times a
// frame. The ray had a broad phase (AUDIT NAME1 F2: the bucket's own bounds,
// kept by addMesh); the sphere did not. Now it does, in both sphere walks -
// the resolve and sphereOverlaps - and the same probe reads 0.7 ms median.
//
// THE PIN IS A DIFFERENTIAL AGAINST THE OLD WALK ITSELF. A twin collider
// holds the same triangles in the same buckets in the same order, with every
// bucket's bounds widened to infinity - so its broad phase passes everything,
// which IS the old walk, and the ONLY difference between the two is the
// skip. Every move and every overlap must answer bit for bit the same. Then
// the work: the real collider touches a handful of buckets per move, the
// twin touches all of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider, sphereTouchesBox } from '../src/player/collider.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A closed box as 12 triangles. */
function box(x0, y0, z0, x1, y1, z1) {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  const pos = [], idx = [];
  for (const f of F) {
    const b = pos.length / 3;
    for (const v of f) pos.push(...P[v]);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
}

/** A town: SIDE x SIDE buildings on 16-unit streets, one bucket each; `translated` stores each
 *  building at its own local origin with a translation provider, as the streaming world stores a
 *  pixel; plus a sky platform straight over the streets, which shares every street's x/z. */
function town(SIDE, { translated = false } = {}) {
  const c = new Collider(() => 0);
  for (let i = 0; i < SIDE; i++) for (let j = 0; j < SIDE; j++) {
    const x = (i - SIDE / 2) * 16, z = (j - SIDE / 2) * 16;
    if (translated) {
      const b = box(0, 0, 0, 10, 8, 10);
      const t = [x, 0, z];
      c.addMesh(`b${i}_${j}`, b.pos, b.idx, I, () => t);
    } else {
      const b = box(x, 0, z, x + 10, 8, z + 10);
      c.addMesh(`b${i}_${j}`, b.pos, b.idx, I);
    }
  }
  const sky = box(-SIDE * 8, 40, -SIDE * 8, SIDE * 8, 41, SIDE * 8);
  c.addMesh('sky', sky.pos, sky.idx, I);
  return c;
}
/** The old walk: every bucket's bounds widened so the broad phase passes everything. */
function widened(c) {
  for (const b of c._buckets.values()) { b.min = [-Infinity, -Infinity, -Infinity]; b.max = [Infinity, Infinity, Infinity]; }
  return c;
}
/** Count, per query, how many DISTINCT buckets had a cell looked up. */
function countTouched(c) {
  const touched = new Set();
  for (const [key, b] of c._buckets) {
    const get = b.grid.get.bind(b.grid);
    b.grid.get = (k) => { touched.add(key); return get(k); };
  }
  return touched;
}
/** The sweep: feet on the streets and against the walls, small moves in eight directions and a fall. */
function* sweep(SIDE) {
  const dirs = [[0.2, 0, 0], [-0.2, 0, 0], [0, 0, 0.2], [0, 0, -0.2], [0.15, 0, 0.15], [-0.15, 0, 0.15], [0.1, -0.3, -0.1], [0, -0.5, 0]];
  for (let i = 0; i < SIDE; i++) for (let j = 0; j < SIDE; j++) {
    const x = (i - SIDE / 2) * 16, z = (j - SIDE / 2) * 16;
    for (const [fx, fz] of [[x + 12.5, z + 5], [x + 10.2, z + 5], [x + 5, z + 10.2], [x + 13, z + 13], [x + 9.9, z + 9.9]]) {
      for (const d of dirs) yield { feet: [fx, 0.3, fz], d };
    }
  }
}

test('PERF-COL1: the broad phase changes no answer - every move on the town, bit for bit against the old walk', () => {
  for (const translated of [false, true]) {
    const real = town(6, { translated }), old = widened(town(6, { translated }));
    let n = 0;
    for (const { feet, d } of sweep(6)) {
      const a = [...feet], b = [...feet];
      const ra = real.move(a, d[0], d[1], d[2]);
      const rb = old.move(b, d[0], d[1], d[2]);
      assert.deepEqual(a, b, `feet after the move (${translated ? 'translated' : 'world'} buckets, from ${feet} by ${d})`);
      assert.deepEqual(ra, rb, 'and what the move reported');
      n++;
    }
    assert.ok(n > 1000, `a real sweep (${n} moves)`);
    // the walls were met, not skipped: a move into a building stops short
    const into = [-5, 0.3, -11];   // a clear capsule on the street, the building's +x face at x = -6
    const stopped = [...into]; real.move(stopped, -1.0, 0, 0);   // a full unit: would end at -6, inside the wall
    assert.ok(Math.abs(stopped[0] - (-6 + 0.35)) < 1e-6, `blocked by the wall it walked into, one radius off it (${stopped[0]})`);
  }
});

test('PERF-COL1: the work - a move touches the buckets it can reach, the old walk touched them all', () => {
  const real = town(6), old = widened(town(6));
  const total = real._buckets.size;
  assert.equal(total, 37, 'thirty-six buildings and the sky');
  const tReal = countTouched(real), tOld = countTouched(old);
  const feet = [-16 + 12.5, 0.3, -16 + 5];   // a street between two buildings
  real.move([...feet], 0.2, 0, 0);
  old.move([...feet], 0.2, 0, 0);
  assert.equal(tOld.size, total, 'the old walk: every bucket, the sky included, for a body on the ground');
  assert.ok(tReal.size <= 4, `the broad phase: at most the neighbours the capsule can reach (${tReal.size} of ${total}: ${[...tReal].join(' ')})`);
  assert.ok(!tReal.has('sky'), 'the sky platform shares the street\'s x/z and is forty units up - the box is three-dimensional');
});

test('PERF-COL1: sphereOverlaps takes the same broad phase - same answers, same skip', () => {
  const real = town(6), old = widened(town(6));
  let asked = 0, hits = 0;
  for (const { feet } of sweep(6)) {
    for (const r of [0.3, 0.6, 1.2]) {
      const c = [feet[0], feet[1] + 0.9, feet[2]];
      const a = real.sphereOverlaps(c, r), b = old.sphereOverlaps(c, r);
      assert.equal(a, b, `overlap at ${c} r ${r}`);
      asked++; if (a) hits++;
    }
  }
  assert.ok(hits > 0 && hits < asked, `both answers occur (${hits} of ${asked})`);
  const tReal = countTouched(real), tOld = countTouched(old);
  real.sphereOverlaps([-16 + 12.5, 1, -16 + 5], 0.5);
  old.sphereOverlaps([-16 + 12.5, 1, -16 + 5], 0.5);
  assert.ok(tReal.size <= 4 && tOld.size >= 1, `the real walk touches ${tReal.size}, the old walk stops at its first hit (${tOld.size})`);
});

test('PERF-COL1: a bucket visited after a contact still sees its own first triangle (the scratch set is cleared per bucket)', () => {
  // bucket 'a': a floor under the start - its triangles 0 and 1 make the grounding contact and are marked visited.
  // bucket 'b': a wall ahead whose triangles are ALSO 0 and 1 (indices restart per bucket). A stale set skips them.
  const c = new Collider(() => -100);
  c.addMesh('a', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), new Uint16Array([0, 1, 2, 0, 2, 3]), I);
  c.addMesh('b', new Float32Array([2, 0, -5, 2, 4, -5, 2, 4, 5, 2, 0, 5]), new Uint16Array([0, 1, 2, 0, 2, 3]), I);
  const feet = [1.5, 0, 0];
  c.move(feet, 0.3, 0, 0);
  assert.ok(feet[0] < 2 - 0.3, `the wall stops the capsule (x ${feet[0]})`);
});

test('PERF-COL1: sphereTouchesBox - the box test, the skin, the empty bucket', () => {
  const min = [0, 0, 0], max = [10, 8, 10];
  assert.equal(sphereTouchesBox(5, 4, 5, 0.35, min, max), true, 'inside');
  assert.equal(sphereTouchesBox(10.3, 4, 5, 0.35, min, max), true, 'a hair outside, within the radius');
  assert.equal(sphereTouchesBox(10.36, 4, 5, 0.35, min, max), false, 'past the radius by more than the skin');
  assert.equal(sphereTouchesBox(10.3505, 4, 5, 0.35, min, max), true, 'past it by less than the skin: walked, never dropped');
  assert.equal(sphereTouchesBox(5, 8.5, 5, 0.35, min, max), false, 'above the roof');
  assert.equal(sphereTouchesBox(5, 4, -1, 0.35, min, max), false, 'off the far side');
  assert.equal(sphereTouchesBox(5, 4, 5, 0.35, [Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]), false, 'an empty bucket is never walked');
});

test('PERF-COL1: the walks keep their laws - the live local point per triangle, the test before the cells, one scratch set', () => {
  const src = read('src/player/collider.js');
  const resolve = src.slice(src.indexOf('  _resolveSphere(center, radius, out'), src.indexOf('  _resolveCapsule(feet, out'));
  assert.match(resolve, /if \(!sphereTouchesBox\(center\[0\] - t\[0\], center\[1\] - t\[1\], center\[2\] - t\[2\], radius \+ SKIN, bucket\.min, bucket\.max\)\) continue;\s*\n\s*const visited = VISITED;\s*\n\s*visited\.clear\(\);\s*\n\s*for \(const cell of nearCells\(bucket, /, 'the box before the cells (AUDIT BRANCH (WoD) B1: the cells are nearCells\' - the fine 3x3, then any wide triangles), at the contact radius');
  assert.match(resolve, /const visited = VISITED;\s*\n\s*visited\.clear\(\);/, 'the module\'s scratch, cleared per bucket');
  assert.match(resolve, /for \(const ti of cell\) \{[\s\S]*?const lx = center\[0\] - t\[0\];/, 'the local point stays LIVE per triangle - earlier pushes are seen by later triangles');
  const overlaps = src.slice(src.indexOf('  sphereOverlaps(center, radius) {'), src.indexOf('  capsuleCast('));
  assert.match(overlaps, /if \(!sphereTouchesBox\(lx, ly, lz, radius, bucket\.min, bucket\.max\)\) continue;/, 'the overlap test at its bare radius (its narrow phase is < r2, no skin)');
  assert.match(overlaps, /const visited = VISITED;\s*\n\s*visited\.clear\(\);/);
  assert.equal((src.match(/new Set\(\)/g) || []).length, 2, 'the ray\'s per-bucket set and the module scratch - the two sphere walks mint none');
});
