// COAST-RAY, SHIP-FLAGS, SHIP-FLATS (FIELD BUGS 2026-10-01 #6 "Sometimes performance issues when along the coastline",
// #7 "Sometimes performance issues when looking at AI ships").
//   COAST-RAY: Come Sail Away's breakers are rebuilt at every map pixel crossed on a coast (OnPositionUpdate ->
//     UpdateWaveMesh), several hundred straight-down rays from 500 m over the sea, and the port's Physics.Raycast walked
//     the ground in quarter metres asking surfaceAt at every step and every halving - ~1,900 lookups a ray, a stall of
//     0.1-0.6 s a crossing. A straight-down ray asks its one column once; the walk and its answer are what they were.
//   SHIP-FLAGS: a ship's flag is two dozen cubes of 36 triangles, two quatRotate turns a triangle, five arrays a turn,
//     every frame - quatRotateInto writes quatRotate's answer, to the bit, into a scratch triple.
//   SHIP-FLATS: a galley's fifty flats went to the billboard pass from every ship out to 1.9 km, where her hull's own
//     meshes are left undrawn under a pixel (CULL_DETAIL_PX) - the flats take the hull's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWaveMesh } from '../../src/systems/comeSailAway/comeSailAwayWaves.js';
import { quatRotate, quatRotateInto } from '../../src/world/quat.js';
import { batchSphere } from '../../src/render/bounds.js';
import { CULL_DETAIL_PX } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const lift = (from, to) => { const a = W.indexOf(from), b = W.indexOf(to, a); assert.ok(a > 0 && b > a, from); return W.slice(a, b); };

/** world.js's csaRaycast, lifted and run outdoors over `surfaceAt` - no collider, no foes, no boats, no carved sea. */
function raycastOver(surfaceAt) {
  const body = lift('  function csaRaycast(o, d, reach, { triggers = true } = {}) {', '\n  /**\n   * CSA-D: PHYSICS.SPHERECASTALL');
  // eslint-disable-next-line no-new-func
  return new Function('modes', 'csaModeCollider', '_csaBuckets', 'surfaceAt', 'csaPixelAt', 'state', 'deepWaters', '_csaSlab', 'csaTerrainOf', 'built',
    'TERRAIN_SIZE', 'rayBoxEntry', 'exteriorFoes', 'cityGuards', 'rayUprightCapsule', 'BODY_CAPSULE_RADIUS', 'CAPSULE_HEIGHT', 'csaRuntime',
    'csaColliderBoats', 'raycastColliders', 'csaColliderMesh', `${body}\nreturn csaRaycast;`)(
    { mode: 'exterior' }, () => null, new Map(), surfaceAt, () => null, null, null, [0, 0, 0], () => null, new Map(),
    819.2, () => null, { foes: [] }, { guards: [] }, () => null, 0.25, 1.8, null, () => [], () => null, () => null);
}
/** The walk as it stood before COAST-RAY, verbatim: surfaceAt asked at every step and every halving. */
function walkBefore(o, d, limit, surfaceAt) {
  const at = (t) => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  const below = (t) => { const q = at(t); const g = surfaceAt(q[0], q[2]); return Number.isFinite(g) && q[1] < g; };
  if (below(0)) return null;
  for (let t0 = 0; t0 < limit; t0 += 0.25) {
    const t1 = Math.min(limit, t0 + 0.25);
    if (!below(t1)) continue;
    let lo = t0, hi = t1;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (below(m)) hi = m; else lo = m; }
    return { distance: hi, point: at(hi) };
  }
  return null;
}
const DOWN = [0, -1, 0];
/** A coast: the sea floor at 30 east of x 0, land rising to 60 west of it; an unbuilt column north of z 900. */
const ground = (x, z) => (z > 900 ? NaN : x > 0 ? 30 - 0.01 * x + Math.sin(z * 0.37) : 30 + Math.min(30, -x * 0.2) + Math.cos(x * 0.11));

test('COAST-RAY: a straight-down ray asks its column ONCE and answers what the walk answered, to the bit - the sea floor, the land, an unbuilt column, a start under the ground; a slanted ray still walks (mutants: the column asked every step; the slant taken as straight)', () => {
  let asked = 0;
  const cast = raycastOver((x, z) => { asked++; return ground(x, z); });
  for (const [x, z, y] of [[120, 40, 500], [-60, 300, 500], [3.7, -12.25, 470.5], [250, 10, 31.2], [-200, 50, 61], [10, 950, 500], [40, 40, 20]]) {
    asked = 0;
    const h = cast([x, y, z], DOWN, 1000);
    assert.equal(asked, 1, `(${x}, ${z}) from ${y}: one lookup (was ~${Math.round((y - (Number.isFinite(ground(x, z)) ? ground(x, z) : 0)) * 4 + 21)})`);
    const want = walkBefore([x, y, z], DOWN, 1000, ground);
    if (!want) assert.equal(h, null, `(${x}, ${z}) from ${y}: nothing, as before`);
    else {
      assert.equal(h.distance, want.distance, `(${x}, ${z}) from ${y}: the distance to the bit`);
      assert.deepEqual(h.point, want.point, 'and the point');
      assert.equal(h.name, 'DaggerfallTerrain');
    }
  }
  // and a thousand columns, heights and reaches at random - the same answer every time, one lookup each
  let r = 99;
  const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  for (let i = 0; i < 1000; i++) {
    const o = [(rnd() - 0.5) * 800, rnd() * 600 - 20, (rnd() - 0.4) * 1100], reach = 50 + rnd() * 950;
    asked = 0;
    const got = cast(o, DOWN, reach), want = walkBefore(o, DOWN, reach, ground);
    assert.equal(asked, 1);
    assert.deepEqual(got && { distance: got.distance, point: got.point }, want, `case ${i}: ${o} reach ${reach}`);
  }
  // a slanted ray: the walk, step for step, as before
  let slant = 0;
  const walkCast = raycastOver((x, z) => { slant++; return ground(x, z); });
  const d = [0.6, -0.8, 0];
  const h = walkCast([-50, 80, 20], d, 400);
  const want = walkBefore([-50, 80, 20], d, 400, ground);
  assert.ok(slant > 100, `a slanted ray asks along its way (${slant})`);
  assert.equal(h.distance, want.distance); assert.deepEqual(h.point, want.point);
});

test('COAST-RAY: a coast\'s breakers rebuilt - buildWaveMesh over the real raycast asks the ground once a ray, and builds the mesh it built (the stall of every pixel crossed on a coast)', () => {
  const heightMapValue = (x, y) => (x < 100 ? 20 : 2);   // a coast running north-south through the window
  let asked = 0;
  const ray = raycastOver((x, z) => { asked++; return x < 0 ? 40 : 30; });
  let rays = 0;
  const opts = { heightMapValue, mapPixel: { X: 100, Y: 50 }, worldCompensation: [0, 0, 0], waveDistance: 2, waterLevel: 34 };
  const now = buildWaveMesh({ ...opts, raycast: (o, d, m) => { rays++; return ray(o, d, m); } });
  assert.ok(rays > 100, `hundreds of rays a rebuild (${rays})`);
  assert.equal(asked, rays, 'one lookup a ray');
  const then = buildWaveMesh({ ...opts, raycast: (o, d, m) => walkBefore(o, d, m, (x) => (x < 0 ? 40 : 30)) });
  assert.ok(now.mesh && then.mesh, 'a mesh each');
  assert.deepEqual(now, then, 'the same breakers, to the bit');
  assert.match(W, /const vertical = d\[0\] === 0 && d\[2\] === 0, g0 = vertical \? surfaceAt\(o\[0\], o\[2\]\) : NaN;/);
});

test('SHIP-FLAGS: quatRotateInto is quatRotate to the bit, written into the triple it is handed; the flag cubes turn through it (mutants: a product reordered; the loop back on quatRotate)', () => {
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  const out = [0, 0, 0];
  for (let i = 0; i < 2000; i++) {
    const q = [rnd(), rnd(), rnd(), rnd()], l = Math.hypot(...q); for (let k = 0; k < 4; k++) q[k] /= l;
    const v = [rnd() * 3, rnd() * 3, rnd() * 3];
    assert.equal(quatRotateInto(q, v[0], v[1], v[2], out), out);
    assert.deepEqual(out, quatRotate(q, v), `case ${i}`);
  }
  const r = rd('src/render/comeSailAwayRender.js');
  const loop = r.slice(r.indexOf('for (const q of run.list) {'), r.indexOf('spans.push({ color: run.color'));
  assert.match(loop, /quatRotateInto\(rot, t\.p\[0\] \* q\.size\[0\], t\.p\[1\] \* q\.size\[1\], t\.p\[2\] \* q\.size\[2\], _flagP\)/);
  assert.match(loop, /quatRotateInto\(rot, t\.n\[0\] \/ \(q\.size\[0\] \|\| 1\), t\.n\[1\] \/ \(q\.size\[1\] \|\| 1\), t\.n\[2\] \/ \(q\.size\[2\] \|\| 1\), _flagN\)/);
  assert.doesNotMatch(loop, /quatRotate\(/, 'no turn makes an array');
});

test('SHIP-FLATS: a ship\'s flat under a pixel across is not drawn - the hull\'s own law (CULL_DETAIL_PX) - and every flat near enough to read is (mutants: the flats uncut; the law\'s side)', () => {
  // world.js's pushSeenShipFlats, lifted, over a 1080-line buffer and the game's 70-degree lens (P[5] = 1 / tan 35)
  const from = W.indexOf('  const _shipFlatSphere = new Float64Array(4);');
  const body = W.slice(from, W.indexOf('\n  }\n', W.indexOf('function pushSeenShipFlats(', from)) + 4);
  const renderer = { _proj: Object.assign(new Float32Array(16), { 5: 1 / Math.tan((35 * Math.PI) / 180) }), _camPos: new Float32Array([0, 2, 0]), gl: { drawingBufferHeight: 1080 } };
  // eslint-disable-next-line no-new-func
  const push = new Function('renderer', 'batchSphere', 'CULL_DETAIL_PX', `${body}\nreturn pushSeenShipFlats;`)(renderer, batchSphere, CULL_DETAIL_PX);
  const flat = (z, w = 0.4, h = 0.5) => ({ size: { w, h }, bounds: [0, 0, 0, Math.hypot(w, h) / 2], origin: [0, 0, z] });
  const pxPerM = renderer._proj[5] * 1080 / 2;
  const lantern = 0.5 * Math.hypot(0.4, 0.5);
  const edge = (2 * lantern * pxPerM) / CULL_DETAIL_PX;   // the distance a lantern is a pixel across
  const out = [];
  const near = flat(-60), far = flat(-1900), justIn = flat(-(edge - 5)), justOut = flat(-(edge + 5)), sail = flat(-1900, 9, 12);
  push([near, far, justIn, justOut, sail], out);
  assert.deepEqual(out, [near, justIn, sail], `a lantern at ${Math.round(edge)} m is a pixel: nearer drawn, farther not; a sail at 1.9 km still drawn`);
  const none = [];
  push([far], none); assert.deepEqual(none, []);
  renderer._proj = null; const all = []; push([far], all); assert.deepEqual(all, [far], 'no lens yet: every flat as before');
  assert.match(W, /if \(csaOn\(\) && _mode\(\) === 'exterior'\) pushSeenShipFlats\(csa\.batches\(\), livePersonBatches\);/, 'the boats\' flats go through it');
});
