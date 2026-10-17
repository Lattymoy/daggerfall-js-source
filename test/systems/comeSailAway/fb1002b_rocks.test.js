// FIELD BUGS 2026-10-02b - THE ROCKS' RECORD AUDITED (Mac: "Audit this"). FIELD BUGS 2026-10-02's ROCK-FREE answered
// Come Sail Away's hull sweep part by part (player/collider.js hullSweepAll) - and its audit, through the real
// modules, found it short of Unity's SphereCastAll five ways, and the C#'s own reach a sixth:
//   BETWEEN THE SPOKES - the sweep was nine rays (the centre and eight on her sphere's rim): a rock smaller than the
//                        gap between two met nothing at all. The sphere itself is swept now, face, edges and corners
//                        (sweepSphereTriangle) - its first contact is the exact one
//   SHELF AND STACK    - a part answered once, at its overlap: one model (one MeshCollider) that is a shelf under her
//                        and a stack ahead answered the shelf, the host dropped it as "beneath" her, and the stack
//                        went unmet - she sailed 15.5 m into it. Now nothing wholly under her keel is met at all (the
//                        KEEL LINE, the host's "beneath" rule gone), and the stack answers as a rock alone does
//   A SIDE OVERLAP ONCE - a rock overlapping her side answered both sweeps (the second refused only the zero point,
//                        and the overlap answers where it touches): counted twice, it outweighed the rock ahead and
//                        she slid 15.9 m into that. The second sweep refuses an overlap as it refuses the zero point
//   A MOVER NEVER HOLDS - a boat's bucket unmoved since its bake (no turn: R null) was read as static, and its hull
//                        held a sphere whose centre it closed round - its walls unmet
//   HER OWN, HER KEEL  - the host is handed her keel line (her collider's box's foot under its centre - as she
//                        floats, however the swell pitches her) and her own colliders, which it no longer sweeps
//   ROCK-REACH         - each sweep reached the whole length again past her end (the C#'s, from her centre): a rock
//                        half a hull clear pushed her and refused her helm, and the push answers the SUM - two clear
//                        astern and one clear ahead summed to her way, and she sailed onto the one ahead and through
//                        it. Each sweep reaches her own end now (a departure)
// Each pin is red on the record's own code (e2466e2bd). `01-Overview/bugs/Field-Bugs-2026-10-02b.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider, sweepSphereTriangle } from '../../../src/player/collider.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { HULL_NAMES, colliderBounds } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { scene } from '../../csaScene.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const cut = (s, start, end = '\n  }\n') => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf(end, i) + end.length); };
const cutLine = (s, start) => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf('\n', i) + 1); };
/** world.js's csaSphereCastAll - CheckCollision's sweep - lifted over `col` with `buckets` (world.js's _csaBuckets):
 *  the ground probe over a sea with no ground under it. */
function liftSweep(col, buckets = new Map()) {
  const body = `let { csaModeCollider, _csaBuckets, modes, surfaceAt, csaPixelAt, state, deepWaters } = s;
    ${cutLine(WORLD, '  const _csaSlab = [0, 0, 0]')}
    ${cut(WORLD, '  function csaSphereCastAll(')}
    return csaSphereCastAll;`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ csaModeCollider: () => col, _csaBuckets: buckets, modes: { mode: 'exterior' }, surfaceAt: () => -Infinity, csaPixelAt: () => null, state: null, deepWaters: null });
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const SMALL_SHIP = HULL_NAMES.indexOf('Small Ship');
/** A rock as a box from min to max (prefabColliders' own box, a closed skin). */
const boxMesh = ({ min, max }) => boxColliderTriangles({ m_Center: { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 }, m_Size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] } });
/** Boxes as ONE model - one addMesh, one MeshCollider. */
function oneModel(boxes) {
  const positions = [], indices = [];
  for (const b of boxes) {
    const m = boxMesh(b), base = positions.length / 3;
    positions.push(...m.positions);
    for (const i of m.indices) indices.push(base + i);
  }
  return { positions, indices };
}
/** A pixel's ground: each box its own part of the one bucket (`key`), or each its own bucket (`keys`). */
function pixel(boxes, keys = null) {
  const col = new Collider();
  boxes.forEach((b, i) => { const m = boxMesh(b); col.addMesh(keys ? keys[i] : 'pixel', m.positions, m.indices, I); });
  return col;
}
const inside = (p, r) => p[0] > r.min[0] && p[0] < r.max[0] && p[2] > r.min[2] && p[2] < r.max[2];
/** How far into `rock`'s footprint her bow's node or her root came over `track`. */
const deepIn = (track, rock) => {
  let deep = 0;
  for (const e of track) for (const p of [e.bow, e.root]) if (inside(p, rock)) deep = Math.max(deep, Math.min(p[0] - rock.min[0], rock.max[0] - p[0], p[2] - rock.min[2], rock.max[2] - p[2]));
  return deep;
};

/** A Small Ship at (100, 34, 200) facing north under sail, the wind astern, CheckCollision through world.js's own
 *  sweep over `col`; `seconds` of quarter-second frames - her track (root and bow's node, a frame each). */
function under(col, { seconds = 60, wind = 3 } = {}) {
  const s = scene();
  s.deps.sphereCastAll = liftSweep(col);
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  s.rt.RaiseSails();
  s.rt.state.windVectorCurrent = [0, 0, wind];
  s.rt.state.windVectorTarget = [0, 0, wind];
  const track = [];
  for (let t = 0; t < seconds; t += 0.25) { s.frame(); track.push({ root: boat.GameObject.position.slice(), bow: boat.Nodes[1].position.slice() }); }
  return { s, boat, track };
}

/** Seeded draws (the pins' own, so every run asks the same cases). */
function draws(seed) {
  let x = seed >>> 0;
  return (lo, hi) => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return lo + (x / 4294967296) * (hi - lo); };
}
/** A point's distance to a solid box. */
const toBox = (c, b) => Math.hypot(...[0, 1, 2].map((i) => Math.max(b.min[i] - c[i], 0, c[i] - b.max[i])));

test('ROCK-FREE BETWEEN THE SPOKES: hullSweepAll sweeps her SPHERE - a 2 m boulder 4.2 m off her line, mid-sweep, is met where the swept sphere first touches it (nine rays met nothing); and over 300 boxes and sweeps its first contact is the exact one, to the micrometre, at a point of the box her sphere touches', () => {
  // the Small Ship's sweep (CheckCollision's): her collider's centre, her half-beam
  const o = [100, 37.785, 197.813], r = 8.434;
  const boulder = { min: [103.2, 0, 215], max: [105.2, 40, 217] };
  const out = pixel([boulder]).hullSweepAll(o, r, [0, 0, 1], 27.26);
  const travel = 215 - Math.sqrt(r * r - 3.2 * 3.2) - o[2];   // the sphere's edge reaches the boulder's near corner line
  assert.equal(out.length, 1, 'the boulder answers');
  assert.ok(Math.abs(out[0].dist - travel) < 1e-6, `at the swept sphere's own travel (${out[0].dist} vs ${travel})`);
  assert.ok(Math.hypot(out[0].point[0] - 103.2, out[0].point[2] - 215) < 1e-6 && Math.abs(out[0].point[1] - o[1]) < 1e-6, `where it touches: its near edge, level with her centre (${out[0].point})`);
  // boxes and sweeps of every kind: the first contact against the solid's distance, found by bisection
  const at = draws(1002);
  let met = 0, starts = 0;
  for (let k = 0; k < 300; k++) {
    const c0 = [at(-3, 3), at(-3, 3), at(-3, 3)], half = [at(0.25, 3), at(0.25, 3), at(0.25, 3)];
    const b = { min: c0.map((v, i) => v - half[i]), max: c0.map((v, i) => v + half[i]) };
    const radius = at(0.5, 8), L = at(1, 40);
    const o2 = [at(-25, 25), at(-6, 6), at(-25, 25)];
    // most aimed at the box, within a few metres; the rest anywhere
    let d = k % 4 ? c0.map((v, i) => v - o2[i] + at(-4, 4)) : [at(-1, 1), at(-0.3, 0.3), at(-1, 1)];
    const l = Math.hypot(...d);
    d = d.map((v) => v / l);
    if (toBox(o2, b) === 0) continue;   // a centre inside the box: a part that holds her, answered by its own pin
    const c = (t) => o2.map((v, i) => v + d[i] * t);
    // the distance along the line is convex: its least by ternary search, the first touch by bisection before it
    let lo = 0, hi = L;
    for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (toBox(c(m1), b) < toBox(c(m2), b)) hi = m2; else lo = m1; }
    const tMin = (lo + hi) / 2;
    let want = null;
    if (toBox(o2, b) <= radius) want = 0;
    else if (toBox(c(tMin), b) <= radius) { let a = 0, z = tMin; for (let i = 0; i < 200; i++) { const m = (a + z) / 2; if (toBox(c(m), b) <= radius) z = m; else a = m; } want = z; }
    const got = pixel([b]).hullSweepAll(o2, radius, d, L);
    if (want === null) { assert.deepEqual(got, [], `case ${k}: a miss`); continue; }
    if (want === 0) starts++; else met++;
    assert.equal(got.length, 1, `case ${k}: one contact (${JSON.stringify(got)})`);
    assert.ok(Math.abs(got[0].dist - want) < 1e-6, `case ${k}: first contact at ${want}, answered ${got[0].dist}`);
    assert.equal(!!got[0].start, want === 0, `case ${k}: an overlap where she starts is \`start\``);
    const p = got[0].point;
    assert.ok(toBox(p, b) < 1e-6 && [0, 1, 2].some((i) => Math.abs(p[i] - b.min[i]) < 1e-6 || Math.abs(p[i] - b.max[i]) < 1e-6), `case ${k}: the point is on the box`);
    assert.ok(Math.abs(Math.hypot(...p.map((v, i) => v - c(want)[i])) - Math.min(radius, toBox(c(want), b))) < 1e-5, `case ${k}: where her sphere touches it`);
  }
  assert.ok(met > 100 && starts > 5, `swept contacts and overlaps alike asked (${met}, ${starts})`);
  // one triangle at a time, either winding (the collider reads none), its face, edges and corners: against a point's
  // distance to the triangle (Ericson's closest point, here on its own)
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const toTri = (p, a, b, c) => {
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    let q;
    if (d1 <= 0 && d2 <= 0) q = a;
    else {
      const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
      if (d3 >= 0 && d4 <= d3) q = b;
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
        else {
          const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
          if (d6 >= 0 && d5 <= d6) q = c;
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
            else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
              else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
            }
          }
        }
      }
    }
    return Math.hypot(...sub(p, q));
  };
  let tris = 0;
  for (let k = 0; k < 400; k++) {
    const a = [at(-6, 6), at(-6, 6), at(-6, 6)], b = [at(-6, 6), at(-6, 6), at(-6, 6)], c = [at(-6, 6), at(-6, 6), at(-6, 6)];
    const o2 = [at(-20, 20), at(-20, 20), at(-20, 20)], radius = at(0.3, 5), L = at(1, 40);
    let d = k % 3 ? [at(-3, 3) - o2[0], at(-3, 3) - o2[1], at(-3, 3) - o2[2]] : [at(-1, 1), at(-1, 1), at(-1, 1)];
    const l = Math.hypot(...d);
    d = d.map((v) => v / l);
    const cAt = (t) => o2.map((v, i) => v + d[i] * t);
    let lo = 0, hi = L;
    for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (toTri(cAt(m1), a, b, c) < toTri(cAt(m2), a, b, c)) hi = m2; else lo = m1; }
    let want = null;
    if (toTri(o2, a, b, c) <= radius) want = 0;
    else if (toTri(cAt((lo + hi) / 2), a, b, c) <= radius) { let x = 0, z = (lo + hi) / 2; for (let i = 0; i < 200; i++) { const m = (x + z) / 2; if (toTri(cAt(m), a, b, c) <= radius) z = m; else x = m; } want = z; }
    for (const [p, q, r] of [[a, b, c], [a, c, b]]) {
      const out = [0, 0, 0, 0];
      const got = sweepSphereTriangle(o2[0], o2[1], o2[2], radius, d[0], d[1], d[2], L, p, q, r, out);
      if (want === null) { assert.equal(got, false, `triangle ${k}: a miss`); continue; }
      assert.ok(got && Math.abs(out[0] - want) < 1e-6, `triangle ${k}: first contact ${want}, answered ${got ? out[0] : 'none'}`);
      assert.ok(Math.abs(Math.hypot(...sub(out.slice(1), cAt(want))) - (want === 0 ? toTri(o2, a, b, c) : radius)) < 1e-5 || want === 0, `triangle ${k}: where it touches`);
      tris++;
    }
  }
  assert.ok(tris > 200, `triangles met (${tris})`);
});

test('ROCK-FREE SHELF AND STACK, ONE MODEL: a shelf under her keel and a rock ahead that are ONE model (one MeshCollider) hold her off the rock exactly as the rock alone does - the shelf never answers for the part (she sailed 15.5 m into the rock)', () => {
  const SHELF = { min: [60, 20, 150], max: [140, 30, 300] }, ROCK = { min: [70, 0, 280], max: [130, 80, 320] };
  const col = new Collider();
  const m = oneModel([SHELF, ROCK]);
  col.addMesh('pixel', m.positions, m.indices, I);
  const one = under(col, { seconds: 90 }), alone = under(pixel([ROCK]), { seconds: 90 });
  assert.deepEqual(one.track, alone.track, 'the rock alone\'s track, frame for frame');
  assert.ok(Math.max(...one.track.map((e) => e.root[2])) < ROCK.min[2] - 15, 'held off the rock');
});

test('ROCK-FREE A SIDE OVERLAP COUNTED ONCE: a rock along her starboard side, in her sphere from the start, and a rock ahead of her port bow - she comes no more than one frame\'s way into the rock ahead (her side\'s overlap, counted by both sweeps, outweighed it: 15.9 m in)', () => {
  const SIDE = { min: [103.9, 0, 150], max: [140, 80, 300.8] }, AHEAD = { min: [66.7, 0, 277.6], max: [99.6, 80, 310.6] };
  const u = under(pixel([SIDE, AHEAD], ['side', 'ahead']), { seconds: 60 });
  const step = Math.max(...u.track.slice(1).map((e, k) => Math.hypot(e.root[0] - u.track[k].root[0], e.root[2] - u.track[k].root[2])));
  const deep = deepIn(u.track, AHEAD);
  assert.ok(deep <= step, `${deep.toFixed(2)} m into it, a frame's way ${step.toFixed(2)} m`);
  // and the overlap answers the first sweep alone
  const s = scene();
  const sweep = liftSweep(pixel([SIDE], ['side']));
  let firsts = 0, seconds = 0;
  s.deps.sphereCastAll = (o, r, d, dist, opts) => { const out = sweep(o, r, d, dist, opts); if (d[2] > 0) firsts += out.length; else seconds += out.length; return out; };
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  firsts = 0; seconds = 0;
  s.rt.CheckCollision(boat);
  assert.ok(firsts > 0, 'the first sweep answers it');
  assert.equal(s.rt.state.collisionDirections.length, firsts, 'the second refuses it - once, from the first');
  assert.ok(seconds > 0, 'though the second is answered it');
});

test('ROCK-FREE A MOVER NEVER HOLDS: a boat\'s hull unmoved since its bake (its turn null) closing round her sphere\'s centre answers its overlap, where it touches - only the static world holds (its walls went unmet)', () => {
  const hull = boxMesh({ min: [-10, -10, -12], max: [30, 10, 8] });
  for (const R of [() => null, () => [1, 0, 0, 0, 1, 0, 0, 0, 1]]) {
    const col = new Collider();
    col.addMesh('csaBoat:7:0', hull.positions, hull.indices, I, () => [0, 0, 0], R);
    const out = col.hullSweepAll([0, 0, 3], 7, [0, 0, 1], 30);
    assert.deepEqual(out.filter((h) => h.start).map((h) => h.point), [[0, 0, 8]], `turn ${R() ? 'set' : 'null'}: the overlap, where it touches`);
  }
});

test('ROCK-FREE HER OWN, HER KEEL: CheckCollision hands the host her keel line - her collider\'s box\'s foot under its centre, steady through the swell where her box\'s lowest corner dips a metre - and herself; the host hands the collider the buckets that are hers to pass, no other boat\'s', () => {
  const s = scene();
  const calls = [];
  s.deps.sphereCastAll = (o, r, d, dist, opts) => { calls.push(opts); return []; };
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  s.rt.RaiseSails();
  s.rt.state.windVectorCurrent = [0, 0, 3];
  s.rt.state.windVectorTarget = [0, 0, 3];
  let lowest = Infinity;
  for (let i = 0; i < 400; i++) {
    s.frame();
    lowest = Math.min(lowest, colliderBounds({ models: s.deps.pool.models }, boat.MeshObject, boat.MeshCollider).min[1]);
  }
  assert.ok(calls.length > 100, `swept every frame she moves (${calls.length})`);
  // PIN MOVED (AUDIT GALLEON, the merge with main, 2026-10-02): the Small Ship is Mac's galleon - her box's foot 4.64 m
  // under the line, where the mod's galleon's stood 3.35
  const keel = 34 + hullBuild(SMALL_SHIP).keel;
  for (const opts of calls) {
    assert.ok(opts?.boat === boat, 'herself');
    assert.ok(Math.abs(opts.keelY - keel) < 0.15, `her keel, ${(-hullBuild(SMALL_SHIP).keel).toFixed(2)} m under the line (${opts.keelY})`);
  }
  assert.ok(lowest < keel - 0.6, `while her box's lowest corner dipped to ${lowest.toFixed(2)}`);
  // the host: her buckets passed, another boat's swept
  const her = { GameObject: {} }, other = { GameObject: {} };
  let asked = null;
  const spy = { hullSweepAll: (o, r, d, dist, opts) => { asked = opts; return []; } };
  const buckets = new Map([['csaBoat:1:0', { boat: her }], ['csaBoat:2:0', { boat: other }], ['csaBoat:1:1', { boat: her }]]);
  liftSweep(spy, buckets)([0, 0, 0], 3, [0, 0, 1], 10, { boat: her, keelY: -2 });
  assert.equal(asked?.keelY, -2, 'her keel line on');
  assert.deepEqual([...asked.skip].sort(), ['csaBoat:1:0', 'csaBoat:1:1'], 'her own buckets alone passed');
  // and the collider passes them: two boats' hulls round her, hers not asked
  const col = new Collider();
  for (const key of ['csaBoat:1:0', 'csaBoat:2:0']) { const m = boxMesh({ min: [-4, -2, 2], max: [4, 2, 12] }); col.addMesh(key, m.positions, m.indices, I, () => [0, 0, 0], () => null); }
  assert.deepEqual(col.hullSweepAll([0, 0, 0], 3, [0, 0, 1], 10, { skip: new Set(['csaBoat:1:0']) }).map((h) => h.key), ['csaBoat:2:0'], 'the other boat\'s alone');
});

test('ROCK-FREE STRAIGHT UNDER HER: an overlap straight under her sweep\'s centre - a shelf over her keel, where she touches bottom - has no side to push her from: nothing pushes her and no helm is refused (taken from her root, 2.2 m ahead of that centre, it pushed her on toward her bow and refused her helm to starboard)', () => {
  const s = scene();
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  s.deps.sphereCastAll = (o, r, d, dist, opts) => (d[2] > 0 ? [{ point: [o[0], 31, o[2]], distance: 0, name: 'shelf', root: null, terrain: false, entity: false, start: true }] : []);
  s.rt.CheckCollision(boat);
  assert.deepEqual(s.rt.state.collisionDirections, [], 'nothing met that pushes');
  assert.deepEqual(s.rt.state.CollisionVector, [0, 0, 0]);
  assert.equal(s.rt.CanTurnLeft(boat), true);
  assert.equal(s.rt.CanTurnRight(boat), true);
  // one beside her centre pushes her off it, from that centre
  s.deps.sphereCastAll = (o, r, d) => (d[2] > 0 ? [{ point: [o[0] + 6, 33, o[2]], distance: 0, name: 'rock', root: null, terrain: false, entity: false, start: true }] : []);
  s.rt.CheckCollision(boat);
  assert.deepEqual(s.rt.state.collisionDirections.map((v) => v.map((x) => Math.round(x * 1e6) / 1e6 + 0)), [[-1, 0, 0]], 'straight off it, to port');
});

test('ROCK-REACH: each sweep reaches her own end - two rocks clear astern and one clear ahead hold her off the one ahead exactly as it alone does (their sum drove her onto it and on through it), and a rock half a hull clear of her bow refuses no helm', () => {
  const A1 = { min: [86, 0, 160], max: [97, 80, 172] }, A2 = { min: [103, 0, 160], max: [114, 80, 172] }, B = { min: [95, 0, 226], max: [105, 80, 236] };
  const three = under(pixel([A1, A2, B]), { seconds: 40 }), alone = under(pixel([B]), { seconds: 40 });
  assert.deepEqual(three.track, alone.track, 'B alone\'s track, frame for frame');
  assert.ok(deepIn(three.track, B) < 1, `at most a frame's way into it (${deepIn(three.track, B).toFixed(2)} m)`);
  // at rest with B 6 m clear of her bow: nothing met, the helm free both ways
  const s = scene();
  s.deps.sphereCastAll = liftSweep(pixel([B]));
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  s.frame();
  assert.deepEqual(s.rt.state.collisionDirections, [], 'nothing met');
  assert.equal(s.rt.CanTurnLeft(boat), true);
  assert.equal(s.rt.CanTurnRight(boat), true);
});
