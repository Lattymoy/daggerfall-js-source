// ROAD-C c2/S1: the automap MODEL, the repaired reveal index, and the
// true three-ray reveal law (Automap.cs
// ScanWithRaycastInDirectionAndUpdateMeshesAndMaterials :1021-1144 +
// CheckForNewlyDiscoveredMeshes :1149-1194).
//
// THE STAGE-ZERO PIN IS THE FIRST TEST IN THIS FILE and it is a LIVE
// FIELD BUG, not a hypothetical: A1's `pointInAabb` read a flat
// six-array while `dungeonContext` pushed `worldAabb()`'s `{min,max}`,
// so every dungeon reveal comparison in the real game ran against
// `undefined` and the dungeon map revealed NOTHING. The A1 suite
// missed it because its fixtures were hand-built in the flat dialect
// the reader wanted. This one builds its row THROUGH the host's own
// call shape - worldAabb over real positions and a real matrix - which
// is the only fixture that could have caught it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enterDungeonAutomap, resetAutomapStore, buildRevealIndex, bindAutomapLayout,
  automapRevealTick, snapshotAutomap, restoreAutomap, getDungeonAutomap,
  PROTECTION_RAYCAST_OFFSET, HIT_DISTANCE_AGREEMENT, FLOOR_MARCH_STEP,
} from '../src/systems/automap.js';
import {
  buildAutomapModel, normalizeAabb, aabbContains, automapWaterLevel,
  restoreMatchesLayout, AABB_TOLERANCE, ELEMENT_NAMES,
} from '../src/systems/automapModel.js';
import { worldAabb } from '../src/player/activate.js';
import { Collider } from '../src/player/collider.js';
import { _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- a box collider standing in for the dungeon soup ----------------
// Real slab intersection, real nearest-hit-wins, real bucket keys, so
// the three parallel rays behave exactly as they would in the game.
function boxCollider(boxes) {
  return {
    raycastHit(origin, dir, maxDist, filter = null) {
      const only = filter?.only ? new Set(filter.only) : null;
      const skip = filter?.skip ? new Set(filter.skip) : null;
      let best = Infinity;
      let key = null;
      for (const b of boxes) {
        const bucket = b.bucket ?? 'dungeon';
        if (only && !only.has(bucket)) continue;
        if (skip && skip.has(bucket)) continue;
        let tMin = 0;
        let tMax = Infinity;
        let ok = true;
        for (let a = 0; a < 3; a++) {
          if (Math.abs(dir[a]) < 1e-9) {
            if (origin[a] < b.aabb.min[a] || origin[a] > b.aabb.max[a]) { ok = false; break; }
            continue;
          }
          const inv = 1 / dir[a];
          let t0 = (b.aabb.min[a] - origin[a]) * inv;
          let t1 = (b.aabb.max[a] - origin[a]) * inv;
          if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
          if (t0 > tMin) tMin = t0;
          if (t1 < tMax) tMax = t1;
          if (tMin > tMax) { ok = false; break; }
        }
        if (!ok || tMin > maxDist || tMin >= best) continue;
        best = tMin;
        key = bucket;
      }
      return { dist: best, key, normal: null };
    },
    raycast(o, d, m, f = null) { return this.raycastHit(o, d, m, f).dist; },
  };
}

const box = (key, min, max, bucket) => ({ key, aabb: { min, max }, bucket });

/** floor y in [-0.5,0.1] over 0..10 x 0..20 (two slabs), wall at z=20 */
function roomFixture() {
  return [
    box('floorA', [0, -0.5, 0], [10, 0.1, 10]),
    box('floorB', [0, -0.5, 10], [10, 0.1, 20]),
    box('wall', [0, 0.1, 19.9], [10, 4, 20.5]),
    box('far', [50, 0, 50], [60, 4, 60]),
  ];
}

test('c2/S1 STAGE-ZERO: a row built through dungeonContext own call shape reveals (the shipped index revealed NOTHING)', () => {
  resetAutomapStore();
  try {
    // The host's shape, verbatim: cpu positions + a world matrix into
    // worldAabb(), whose answer is {min,max} - the object form A1's
    // flat six-array reader could never satisfy.
    const positions = [0, 0, 0, 4, 0, 0, 4, 0.2, 4, 0, 0.2, 4];
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const aabb = worldAabb(positions, identity);
    assert.ok(Array.isArray(aabb.min) && Array.isArray(aabb.max), 'worldAabb answers the OBJECT form');
    assert.equal(Array.isArray(aabb), false, 'and never the flat six-array A1 read');

    const model = buildRevealIndex([{ key: '0:12', aabb, blockIndex: 0, blockName: 'N0000000.RDB', elementIndex: 0, elementName: 'Models', modelIndex: 0 }]);
    assert.equal(model.length, 1);
    assert.deepEqual(model.rows[0].aabb, { min: [0, 0, 0], max: [4, 0.2, 4] }, 'the row is normalized, not merely kept');

    const rec = enterDungeonAutomap('0/stage-zero', 0);
    const collider = boxCollider([box('0:12', aabb.min, aabb.max)]);
    // Stand on the slab and look at nothing: the DOWN scan alone must reveal it.
    automapRevealTick(rec, { eye: [2, 2, 2], fwd: [0, 0, 1], collider, model });
    assert.equal(rec.revealed.has('0:12'), true, 'THE REVEAL PROBE WORKS - this is the field bug, fixed');
    assert.equal(rec.visitedThisRun.has('0:12'), true);
  } finally { resetAutomapStore(); }
});

test('c2/S1 one shape past the boundary: the flat dialect and the object dialect build identical rows and reveal identically', () => {
  resetAutomapStore();
  try {
    const flat = buildAutomapModel([{ key: 'k', aabb: [0, -0.5, 0, 10, 0.1, 10] }]);
    const obj = buildAutomapModel([{ key: 'k', aabb: { min: [0, -0.5, 0], max: [10, 0.1, 10] } }]);
    assert.deepEqual(flat.rows, obj.rows, 'both dialects normalize to the SAME row');
    assert.deepEqual(normalizeAabb([1, 2, 3, 4, 5, 6]), { min: [1, 2, 3], max: [4, 5, 6] });
    assert.equal(normalizeAabb([1, 2, 3]), null, 'a five-or-three array is not an AABB');
    assert.equal(normalizeAabb({ min: [0, 0, 0] }), null, 'a half-formed object is not an AABB');
    assert.equal(normalizeAabb(null), null);
    assert.equal(buildAutomapModel([{ key: 'a' }, { aabb: [0, 0, 0, 1, 1, 1] }, null]).length, 0, 'a row without BOTH is not indexed');

    const collider = boxCollider([box('k', [0, -0.5, 0], [10, 0.1, 10])]);
    for (const model of [flat, obj]) {
      const rec = enterDungeonAutomap(`0/dialect${model === flat ? 'F' : 'O'}`, 0);
      automapRevealTick(rec, { eye: [5, 2, 5], fwd: [0, 1, 0], collider, model });
      assert.deepEqual([...rec.revealed], ['k']);
    }
  } finally { resetAutomapStore(); }
});

test('c2/S1 the three-ray scan: same row + 0.01 agreement, or NOTHING reveals (:1112-1124)', () => {
  resetAutomapStore();
  try {
    const boxes = roomFixture();
    const model = buildAutomapModel(boxes.map((b) => ({ key: b.key, aabb: b.aabb })));
    const collider = boxCollider(boxes);

    // (a) all three rays agree -> the DOWN, the VIEW and the march all land
    const rec = enterDungeonAutomap('0/three', 0);
    const { rays } = automapRevealTick(rec, { eye: [5, 2, 5], fwd: [0, 0, 1], collider, model });
    assert.equal(rec.revealed.has('floorA'), true, 'the DOWN scan (:1157-1161)');
    assert.equal(rec.revealed.has('wall'), true, 'the VIEW scan (:1166-1171)');
    assert.equal(rec.revealed.has('floorB'), true, 'the floor march past z=10 (:1176-1190)');
    assert.equal(rec.revealed.has('far'), false);
    // BUDGET: 3 x (down + view + march steps). The wall sits 14.9 away,
    // so the march runs steps 1..14 -> 3 x 16 = 48.
    const marchSteps = Math.ceil(14.9 / FLOOR_MARCH_STEP) - 1;
    assert.equal(marchSteps, 14);
    assert.equal(rays, 3 * (1 + 1 + marchSteps), 'the ray budget is exactly 3 x (1 + 1 + march steps)');

    // (b) ONE ray missing -> no reveal at all. A collider that answers
    // only for the exact main-ray origin loses both protection rays.
    const rec2 = enterDungeonAutomap('0/miss', 0);
    const holed = {
      raycastHit(o, d, max) {
        if (Math.abs(o[0] - 5) > 1e-9) return { dist: Infinity, key: null, normal: null };
        return collider.raycastHit(o, d, max);
      },
    };
    automapRevealTick(rec2, { eye: [5, 2, 5], fwd: [0, 0, 1], collider: holed, model });
    assert.equal(rec2.revealed.size, 0, 'a hole under one protection ray reveals nothing (:1112-1114)');

    // (c) a protection ray resolving a DIFFERENT row -> no reveal
    const rec3 = enterDungeonAutomap('0/other', 0);
    const swapped = {
      raycastHit(o, d, max) {
        if (Math.abs(o[0] - 5) > 1e-9 && d[1] === -1) return { dist: 2 - 0.1, key: 'dungeon', normal: null };
        return collider.raycastHit(o, d, max);
      },
    };
    // move the offset rays' hit point into floorB's box by shifting the eye onto the seam
    const seamModel = buildAutomapModel([
      { key: 'floorA', aabb: [0, -0.5, 0, 10, 0.1, 10] },
      { key: 'floorB', aabb: [0, -0.5, 10, 10, 0.1, 20] },
    ]);
    automapRevealTick(rec3, { eye: [5, 2, 10], fwd: [0, 1, 0], collider: swapped, model: seamModel });
    assert.equal(rec3.revealed.size <= 1, true, 'rays straddling two rows never reveal both');

    // (d) distances disagreeing by 0.02 -> no reveal
    const rec4 = enterDungeonAutomap('0/disagree', 0);
    const skewed = {
      raycastHit(o, d, max) {
        const h = collider.raycastHit(o, d, max);
        if (Math.abs(o[0] - 5) > 1e-9) h.dist += 0.02;   // one protection ray reads 2cm further
        return h;
      },
    };
    automapRevealTick(rec4, { eye: [5, 2, 5], fwd: [0, 1, 0], collider: skewed, model });
    assert.equal(rec4.revealed.size, 0, `a ${HIT_DISTANCE_AGREEMENT * 2} disagreement reveals nothing (:1121-1123)`);

    // and the boundary: 0.009 still agrees
    const rec5 = enterDungeonAutomap('0/agree', 0);
    const nudged = {
      raycastHit(o, d, max) {
        const h = collider.raycastHit(o, d, max);
        if (Math.abs(o[0] - 5) > 1e-9) h.dist += 0.009;
        return h;
      },
    };
    automapRevealTick(rec5, { eye: [5, 2, 5], fwd: [0, 1, 0], collider: nudged, model });
    assert.equal(rec5.revealed.has('floorA'), true, 'under 0.01 still agrees');
  } finally { resetAutomapStore(); }
});

test('c2/S1 the closed door blocks: an action-door bucket as the nearest hit reveals nothing and does not crash', () => {
  resetAutomapStore();
  try {
    const boxes = [
      box('floorA', [0, -0.5, 0], [10, 0.1, 10]),
      box('hall', [0, 0.1, 12], [10, 4, 20]),
      box('act:0:44', [0, 0.1, 5], [10, 3, 5.4], 'act:0:44'),   // the door, its OWN bucket
    ];
    const model = buildAutomapModel([
      { key: 'floorA', aabb: boxes[0].aabb },
      { key: 'hall', aabb: boxes[1].aabb },
      // the door is NOT in the model - DFU's automap copy has no action doors
    ]);
    const collider = boxCollider(boxes);
    const isDoorBucket = (k) => k === 'act:0:44';

    const rec = enterDungeonAutomap('0/door', 0);
    automapRevealTick(rec, { eye: [5, 2, 1], fwd: [0, 0, 1], collider, model, isDoorBucket });
    assert.equal(rec.revealed.has('floorA'), true, 'the floor under your feet still reveals');
    assert.equal(rec.revealed.has('hall'), false, 'the CLOSED DOOR reveals nothing behind it');

    // the same geometry with the door gone reveals the hall - proving
    // the door, not the distance, is what stopped it
    const rec2 = enterDungeonAutomap('0/nodoor', 0);
    automapRevealTick(rec2, { eye: [5, 2, 1], fwd: [0, 0, 1], collider: boxCollider(boxes.slice(0, 2)), model });
    assert.equal(rec2.revealed.has('hall'), true, 'with the door removed the hall reveals');

    // a door hit with NO model row behind it must not throw
    const rec3 = enterDungeonAutomap('0/doorbare', 0);
    assert.doesNotThrow(() => automapRevealTick(rec3, {
      eye: [5, 2, 4], fwd: [0, 0, 1], collider, model: buildAutomapModel([]), isDoorBucket,
    }));
  } finally { resetAutomapStore(); }
});

test('c2/S1 the march paints the path and stops at the wall (:1176-1190)', () => {
  resetAutomapStore();
  try {
    const boxes = [
      box('near', [0, -0.5, 0], [10, 0.1, 6]),
      box('path', [0, -0.5, 6], [10, 0.1, 12]),
      box('wall', [0, 0.1, 12], [10, 4, 12.5]),
      box('beyond', [0, -0.5, 12.5], [10, 0.1, 30]),
    ];
    const model = buildAutomapModel(boxes.map((b) => ({ key: b.key, aabb: b.aabb })));
    const rec = enterDungeonAutomap('0/march', 0);
    automapRevealTick(rec, { eye: [5, 2, 1], fwd: [0, 0, 1], collider: boxCollider(boxes), model });
    assert.equal(rec.revealed.has('near'), true);
    assert.equal(rec.revealed.has('path'), true, 'the march painted the floor between');
    assert.equal(rec.revealed.has('wall'), true);
    assert.equal(rec.revealed.has('beyond'), false, 'the march never steps past the view hit');

    // the march runs only when the VIEW SCAN SUCCEEDED (hitForward.HasValue,
    // :1173) - not merely when the ray touched something
    const rec2 = enterDungeonAutomap('0/noview', 0);
    automapRevealTick(rec2, { eye: [5, 2, 1], fwd: [0, 0, -1], collider: boxCollider(boxes), model });
    assert.deepEqual([...rec2.revealed], ['near'], 'no view hit -> DOWN alone, no march');
  } finally { resetAutomapStore(); }
});

test('c2/S1 identity: rows walk DFU block -> element -> model order (Automap.cs:66-79, RDBLayout.cs:165-168/:644)', () => {
  const rows = [];
  // push in the HOST's interleaved order - action and plain models mixed
  const push = (bi, name, key, hasAction, mi) => rows.push({
    key, aabb: [0, 0, 0, 1, 1, 1],
    blockIndex: bi, blockName: name,
    elementIndex: hasAction ? 1 : 0, elementName: ELEMENT_NAMES[hasAction ? 1 : 0], modelIndex: mi,
  });
  push(1, 'B1', '1:a', false, 0);
  push(0, 'B0', '0:act0', true, 0);
  push(2, 'B2', '2:a', false, 0);
  push(0, 'B0', '0:a', false, 0);
  push(0, 'B0', '0:b', false, 1);
  push(1, 'B1', '1:act0', true, 0);

  const model = buildAutomapModel(rows);
  assert.deepEqual(model.rows.map((r) => r.key), ['0:a', '0:b', '0:act0', '1:a', '1:act0', '2:a'],
    'block, then "Models" before "Action Models", then model index');
  assert.deepEqual(model.blockNames, ['B0', 'B1', 'B2']);
  assert.equal(model.rows[2].elementName, 'Action Models');
  assert.deepEqual(ELEMENT_NAMES, ['Models', 'Action Models'], 'RDBLayout creates them in that order (:165-168)');
});

test('c2/S1 the hash grid answers the same set as a linear scan, over 500 random points', () => {
  // AUDIT 54: the skin's magnitude, so a change to it is a deliberate,
  // reviewed edit rather than a silent one. DFU has no analogue constant
  // (it resolves a reveal by hit.collider), so the value's only anchor is
  // its reason: the probe's hit point sits ON a surface and an exact test
  // is a coin flip against float error. The BEHAVIOUR it buys - which
  // model an in-bounds probe credits, and whether an off-geometry hit
  // reveals at all - is pinned in test/audit54_pins.test.js.
  assert.equal(AABB_TOLERANCE, 0.05);
  let seed = 20260901;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const rows = [];
  for (let i = 0; i < 200; i++) {
    const x = rnd() * 60 - 30; const y = rnd() * 20 - 10; const z = rnd() * 60 - 30;
    rows.push({ key: `k${i}`, aabb: { min: [x, y, z], max: [x + rnd() * 6, y + rnd() * 3, z + rnd() * 6] } });
  }
  // one deliberately enormous slab - the oversize arm
  rows.push({ key: 'slab', aabb: { min: [-500, -1, -500], max: [500, -0.9, 500] } });
  const model = buildAutomapModel(rows);
  for (let i = 0; i < 500; i++) {
    const p = [rnd() * 70 - 35, rnd() * 24 - 12, rnd() * 70 - 35];
    // AUDIT 54: an EXPLICIT literal tolerance on both sides. This read
    // AABB_TOLERANCE on the left and took queryPoint's default on the
    // right, so it moved with the constant and looked like coverage of
    // it - a tenfold widening to 0.5 left it green. It is a pure
    // grid-vs-linear index check; the skin itself is pinned in
    // test/audit54_pins.test.js.
    const linear = model.rows.filter((r) => aabbContains(r.aabb, p, 0.05)).map((r) => r.key).sort();
    const grid = model.queryPoint(p, 0.05).map((r) => r.key).sort();
    assert.deepEqual(grid, linear, `point ${i} disagrees`);
  }
  // resolveAt is a FUNCTION of the point: the tightest enclosing box
  const nested = buildAutomapModel([
    { key: 'big', aabb: [0, 0, 0, 10, 10, 10] },
    { key: 'small', aabb: [4, 4, 4, 5, 5, 5] },
  ]);
  assert.equal(nested.resolveAt([4.5, 4.5, 4.5]).key, 'small', 'the tightest owner wins');
  assert.equal(nested.resolveAt([9, 9, 9]).key, 'big');
  assert.equal(nested.resolveAt([99, 99, 99]), null);
});

test('c2/S1 partition is a total, disjoint cover; ExploredPercentage is DFU arithmetic (:2467-2478)', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel(Array.from({ length: 7 }, (_, i) => ({ key: `k${i}`, aabb: [i, 0, 0, i + 1, 1, 1] })));
    const rec = enterDungeonAutomap('0/part', 0);
    rec.revealed = new Set(['k0', 'k1', 'k2']);
    rec.visitedThisRun = new Set(['k0']);
    const { visited, revealed, undiscovered } = model.partition(rec);
    assert.deepEqual(visited.map((r) => r.key), ['k0']);
    assert.deepEqual(revealed.map((r) => r.key), ['k1', 'k2'], 'revealed-but-not-this-run draws grayscale');
    assert.equal(undiscovered.length, 4);
    assert.equal(visited.length + revealed.length + undiscovered.length, model.length, 'total cover');
    const seen = new Set([...visited, ...revealed, ...undiscovered].map((r) => r.key));
    assert.equal(seen.size, model.length, 'disjoint');
    // 3/7 = 42.857 -> 42 (C# (int) cast truncates)
    assert.equal(model.exploredPercentage(rec), 42);
    assert.equal(buildAutomapModel([]).exploredPercentage(rec), 0, 'an empty geometry answers 0, never NaN');
    rec.revealed.add('ghost');   // a key this layout does not own
    assert.equal(model.exploredPercentage(rec), 42, 'a stale key cannot inflate the percentage');
  } finally { resetAutomapStore(); }
});

test('c2/S1 save compatibility: an A1/A2 envelope restores unchanged; a REORDERED layout restores NOTHING', () => {
  resetAutomapStore();
  try {
    // the A1/A2 envelope: key sets, no blockNames field at all
    restoreAutomap({
      '3/Privateers Hold': {
        revealed: ['0:12', '0:44', '1:9'], visitedThisRun: ['0:12'], entranceDiscovered: true, lastVisited: 500,
      },
    });
    const rec = getDungeonAutomap('3/Privateers Hold');
    assert.equal(rec.blockNames, null, 'the old envelope carries no layout record');
    const model = buildAutomapModel([
      { key: '0:12', aabb: [0, 0, 0, 1, 1, 1], blockIndex: 0, blockName: 'B0' },
      { key: '0:44', aabb: [1, 0, 0, 2, 1, 1], blockIndex: 0, blockName: 'B0' },
      { key: '1:9', aabb: [2, 0, 0, 3, 1, 1], blockIndex: 1, blockName: 'B1' },
    ]);
    assert.equal(bindAutomapLayout(rec, model), true, 'no recorded layout -> nothing to disagree with');
    assert.deepEqual([...rec.revealed].sort(), ['0:12', '0:44', '1:9'], 'every key survives the upgrade');
    assert.equal(rec.entranceDiscovered, true);
    assert.deepEqual(rec.blockNames, ['B0', 'B1'], 'and the layout is stamped for next time');

    // round-trip the new field
    const snap = snapshotAutomap(600);
    assert.deepEqual(snap['3/Privateers Hold'].blockNames, ['B0', 'B1']);
    restoreAutomap(snap);
    const back = getDungeonAutomap('3/Privateers Hold');
    assert.deepEqual(back.blockNames, ['B0', 'B1']);

    // a REORDERED layout: DFU aborts the restore walk (:2385-2386);
    // the port drops the discovery whole rather than paint a prefix
    const reordered = buildAutomapModel([
      { key: '1:9', aabb: [2, 0, 0, 3, 1, 1], blockIndex: 0, blockName: 'B1' },
      { key: '0:12', aabb: [0, 0, 0, 1, 1, 1], blockIndex: 1, blockName: 'B0' },
    ]);
    assert.equal(bindAutomapLayout(back, reordered), false);
    assert.equal(back.revealed.size, 0, 'nothing restores - never the WRONG models');
    assert.equal(back.visitedThisRun.size, 0);
    assert.equal(back.entranceDiscovered, false);
    assert.deepEqual(back.blockNames, ['B1', 'B0'], 'and the record re-bases on the live layout');

    assert.equal(restoreMatchesLayout({ blockNames: ['A'] }, null), true, 'a null record never blocks a restore');
    assert.equal(restoreMatchesLayout({ blockNames: ['A', 'B'] }, ['A']), false, 'a SHORTER layout disagrees');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('c2/S1 water level: AddWater 10000 is dry, everything else is native * -1 * GlobalScale (:1982-1988)', () => {
  assert.equal(automapWaterLevel(10000), null, '10000 = no water, AddWater returns before touching a renderer');
  assert.equal(automapWaterLevel(null), null);
  assert.equal(automapWaterLevel(undefined), null);
  assert.equal(automapWaterLevel(-8), 0.2);
  assert.equal(automapWaterLevel(0), -0);
  assert.equal(automapWaterLevel(-256), 6.4);
});

test('c2/S1 the collider bucket filter is strictly additive (only/skip); no filter = the shipped walk', () => {
  const c = new Collider(() => -Infinity);
  const quad = (y) => ({ positions: [-5, y, -5, 5, y, -5, 5, y, 5, -5, y, 5], indices: [0, 1, 2, 0, 2, 3] });
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const a = quad(0); const b = quad(1);
  c.addMesh('dungeon', a.positions, a.indices, I);
  c.addMesh('act:0:44', b.positions, b.indices, I);
  const down = [0, -1, 0];
  assert.equal(c.raycastHit([0, 5, 0], down, 20).key, 'act:0:44', 'unfiltered: the nearest bucket wins, as before');
  assert.equal(c.raycastHit([0, 5, 0], down, 20).dist, 4);
  assert.equal(c.raycastHit([0, 5, 0], down, 20, { skip: ['act:0:44'] }).key, 'dungeon', 'skip drops a bucket');
  assert.equal(c.raycastHit([0, 5, 0], down, 20, { skip: ['act:0:44'] }).dist, 5);
  assert.equal(c.raycastHit([0, 5, 0], down, 20, { only: ['dungeon'] }).key, 'dungeon', 'only narrows the walk');
  assert.equal(c.raycastHit([0, 5, 0], down, 20, { only: [] }).key, null, 'an empty only-set hits nothing');
  assert.equal(c.raycast([0, 5, 0], down, 20, { skip: ['act:0:44'] }), 5, 'raycast passes the filter through');
  assert.equal(c.raycast([0, 5, 0], down, 20), 4, 'and is unchanged without one');
});

test('c2/S1 SOURCE PINS: action doors leave the entry set, the rows carry DFU identity, the door bucket is distinct', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  // the action-door push is GONE - DFU's automap copy has none
  assert.equal(/automapEntries\.push\([^)]*worldAabb/.test(ctx), false, 'action doors no longer enter the automap entry set');
  assert.match(ctx, /RDBLayout\.cs:625-627/, 'and the reason is recorded at the site');
  assert.match(ctx, /automapEntries\.push\(amapRow\(/, 'every entry goes through the identity row builder');
  assert.match(ctx, /elementName: ELEMENT_NAMES\[elementIndex\]/, 'the four-level identity rides as metadata');
  assert.match(ctx, /isDoorBucket: \(k\) => actions\.objects\.get\(k\)\?\.kind === 'door'/, 'the tick names the door bucket');
  assert.match(ctx, /bindAutomapLayout\(automapRec, automapModel\)/, 'the layout guard runs at mount');

  // BUCKET DISTINCTNESS - the whole door discrimination rests on it.
  // If a future change merges action geometry into the dungeon bucket
  // the reveal law silently reverts to over-reveal.
  const act = src('src/world/actionSystem.js');
  assert.match(act, /this\.collider\.addMesh\(key, cpu\.positions, cpu\.indices, baseMatrix\)/, 'an action object registers under its OWN key');
  assert.equal(/addMesh\('dungeon'/.test(act), false, 'no action object may join the dungeon bucket');
  assert.match(ctx, /collider\.addMesh\('dungeon', cpu\.positions/, 'dungeon geometry is the one shared bucket');

  // the reveal law itself must never fall back to a single ray
  const am = src('src/systems/automap.js');
  assert.match(am, /HIT_DISTANCE_AGREEMENT = 0\.01/);
  assert.match(am, /PROTECTION_RAYCAST_OFFSET = 0\.1/);
  assert.equal(PROTECTION_RAYCAST_OFFSET, 0.1);
  assert.equal(HIT_DISTANCE_AGREEMENT, 0.01);
});
