// PERF-ALLOC1 (2026-10-10, Mac: "Exterior performance is really bad"): the lanterns' face matrices made in place. The
// shadow pass makes six view-projections a lantern a frame (pointFaceMatrices), and each was a fresh projection, six
// lookAt views and their twenty-four arrays - the real game at Knightstale by night (tools/frameProbe.mjs over the
// freeware ARENA2): lookAt alone 47 KB of the 1.4 MB the frame allocated. They are written into two scratches now, by
// lookAtInto and perspectiveInto (shadowPass.js - world/mat4.js is the relay's, and its bytes stay) - mat4.js's
// arithmetic in its order, so its floats. The
// record is `bible/07-Rendering/Performance-Arena.md` (PERF-ALLOC1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookAt, perspective, multiply } from '../../src/world/mat4.js';
import { pointFaceMatrices, lookAtInto, perspectiveInto, SHADOW_POINT_NEAR } from '../../src/render/shadowPass.js';

/** The base's lookAt and perspective, verbatim - the oracle. */
function baseLookAt(eye, center, up) {
  const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  const zl = Math.hypot(zx, zy, zz);
  const z = [zx / zl, zy / zl, zz / zl];
  const x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
  const xl = Math.hypot(x[0], x[1], x[2]);
  x[0] /= xl; x[1] /= xl; x[2] /= xl;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1,
  ]);
}
function basePerspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}
const FACES = [[[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]], [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, -1]], [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]]];
const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
let seed = 3;
const rnd = (s = 1) => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648 - 0.5) * 2 * s; };

test('PERF-ALLOC1: the lanterns\' face matrices are the base\'s to the bit - over random lights (a town\'s places and a rebased origin\'s, ranges a lamp to a bonfire), each of the six view-projections equals the base\'s projection times the base\'s view, element for element; and the twins answer mat4.js\'s lookAt and perspective to the bit (mat4.js untouched: the relay\'s bundle) (mutants: PERFALLOC1-order, PERFALLOC1-near, PERFALLOC1-unnormalised, PERFALLOC1-centre)', () => {
  const out = Array.from({ length: 6 }, () => new Float32Array(16));
  for (let i = 0; i < 4000; i++) {
    const s = i % 2 ? 900 : 40000;
    const pos = [rnd(s), rnd(60), rnd(s)], far = 2 + Math.abs(rnd(40));
    pointFaceMatrices(pos, far, out);
    const P = basePerspective(Math.PI / 2, 1, SHADOW_POINT_NEAR, far);
    for (let f = 0; f < 6; f++) {
      const d = FACES[f][0];
      const want = multiply(P, baseLookAt(pos, [pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]], FACES[f][1]), new Float32Array(16));
      assert.ok(same(out[f], want), `face ${f} of a light at ${pos} reaching ${far}: ${[...out[f]]} against ${[...want]}`);
    }
    const eye = [rnd(s), rnd(s), rnd(s)], c = [rnd(s), rnd(s), rnd(s)], up = [rnd(), rnd(), rnd()];
    assert.ok(same(lookAt(eye, c, up), baseLookAt(eye, c, up)), 'lookAt: the base\'s floats');
    assert.ok(same(lookAtInto(new Float32Array(16).fill(7), eye, c[0], c[1], c[2], up), baseLookAt(eye, c, up)), 'lookAtInto writes every element');
    const fov = 0.3 + Math.abs(rnd(2)), asp = 0.5 + Math.abs(rnd(2)), near = 0.01 + Math.abs(rnd(1)), farP = near + 1 + Math.abs(rnd(5000));
    assert.ok(same(perspective(fov, asp, near, farP), basePerspective(fov, asp, near, farP)), 'perspective: the base\'s floats');
    assert.ok(same(perspectiveInto(new Float32Array(16).fill(7), fov, asp, near, farP), basePerspective(fov, asp, near, farP)), 'perspectiveInto writes every element (the rest zero, as a new array\'s)');
  }
});

test('PERF-ALLOC1 (AUDIT PERF-ARENA L2/L3): the twin to the bit where the random views never go - a translation that CANCELS (an eye nearly perpendicular to the view\'s axis, at 1e3 to 1e7: a reordered or re-rooted sum differs there in more than float32 can hide) and an eye at the origin (a signed zero), and each face\'s view before the product hides its -0; against the base\'s lookAt itself (mutants: PERFALLOC1-order, LA-hypot-z, LA-hypot-x, LA-reciprocal, LA-negzero, LA-y-form)', () => {
  let sd = 7;
  const r01 = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  const cases = [];
  for (let i = 0; i < 3000; i++) {
    const dir = [r01() - 0.5, r01() - 0.5, r01() - 0.5], up = [r01() - 0.5, r01() - 0.5, r01() - 0.5];
    const m = baseLookAt([0, 0, 0], dir, up), x = [m[0], m[4], m[8]], y = [m[1], m[5], m[9]];
    const r = [r01() - 0.5, r01() - 0.5, r01() - 0.5];
    const p = i % 2 ? [x[1] * r[2] - x[2] * r[1], x[2] * r[0] - x[0] * r[2], x[0] * r[1] - x[1] * r[0]] : [y[1] * r[2] - y[2] * r[1], y[2] * r[0] - y[0] * r[2], y[0] * r[1] - y[1] * r[0]];   // perpendicular to the view's x (or y): its translation term cancels
    const sc = 10 ** (3 + (i % 5));
    const eye = [p[0] * sc + r01(), p[1] * sc + r01(), p[2] * sc + r01()];
    cases.push([eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], up]);
  }
  cases.push([[0, 0, 0], [1, 0, 0], [0, -1, 0]], [[0, 0, 0], [0.3, 0.4, 0.5], [0, 1, 0]], [[0, 5, 0], [1, 5, 0], [0, -1, 0]]);   // an eye at the origin: the translation's signed zero
  for (let i = 0; i < 200; i++) {
    const pos = [(r01() - 0.5) * 900, r01() * 50, (r01() - 0.5) * 900];
    for (const [d, up] of FACES) cases.push([pos, [pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]], up]);   // the faces' own views, before multiply's sum = 0 wipes a -0
  }
  let bad = 0;
  for (const [eye, c, up] of cases) if (!same(lookAtInto(new Float32Array(16).fill(7), eye, c[0], c[1], c[2], up), baseLookAt(eye, c, up))) bad++;
  assert.equal(bad, 0, `${bad} of ${cases.length} views differ from the base's lookAt`);
});

test('PERF-ALLOC1: a lantern\'s six faces make no typed array (the base: seven a lantern a frame, a projection and six views - and their twenty-four arrays) (mutant: PERFALLOC1-minted)', () => {
  const out = Array.from({ length: 6 }, () => new Float32Array(16));
  pointFaceMatrices([1, 2, 3], 18, out);   // warm
  const Real = globalThis.Float32Array;
  let made = 0;
  globalThis.Float32Array = class extends Real { constructor(...a) { super(...a); made++; } };
  try {
    for (let i = 0; i < 12; i++) pointFaceMatrices([i * 7.5, 2, -i * 3.25], 15 + i, out);
  } finally { globalThis.Float32Array = Real; }
  assert.equal(made, 0, `twelve lanterns' faces made ${made} typed arrays`);
});

test('PERF-ALLOC2: the lantern walk hands its cube through a typed array - placementsInCubeOf answers what placementsInCube answers over random woods (scaled, lifted, moved origins) and random cubes, in and out of reach; and _candidateQuads asks placementsInCubeOf with its own Float64Array, five doubles a call no longer handed as heap numbers (mutants: PERFALLOC2-boxed-again, PERFALLOC2-cube-short, WALK-scratch-module)', async () => {
  const { readFileSync } = await import('node:fs');
  const bounds = await import('../../src/render/bounds.js');
  const { placementGrid } = bounds;
  let n = 0, hits = 0;
  for (let k = 0; k < 400; k++) {
    const centers = Array.from({ length: 2 + Math.floor(Math.abs(rnd(60))) }, () => [rnd(120), rnd(3), rnd(120)]);
    const b = { _place: placementGrid(centers), origin: [rnd(800), rnd(5), rnd(800)], size: { w: 1 + Math.abs(rnd(3)), h: (k % 9 ? 1 : -1) * (1 + Math.abs(rnd(8))) } };
    for (let j = 0; j < 12; j++) {
      const rad = Math.abs(rnd(4)), px = b.origin[0] + rnd(160), py = b.origin[1] + rnd(10), pz = b.origin[2] + rnd(160), far = Math.abs(rnd(30));
      // the oracle: any placement (the batch's frame, the lift folded in) within far + rad of the light on every axis
      const R = far + rad, lx = px - b.origin[0], ly = py - b.origin[1] - bounds.batchLift(b), lz = pz - b.origin[2], p = b._place.pts;
      let want = false;
      for (let i = 0; i < p.length && !want; i += 3) want = Math.abs(p[i] - lx) <= R && Math.abs(p[i + 1] - ly) <= R && Math.abs(p[i + 2] - lz) <= R;
      assert.equal(bounds.placementsInCubeOf(b, Float64Array.of(rad, px, py, pz, far)), want, 'the cube test through the typed array: any quad in reach');
      assert.equal(bounds.placementsInCube(b, rad, px, py, pz, far), want, 'and through the old door, the same');
      n++; if (want) hits++;
    }
  }
  assert.ok(hits > n / 10 && hits < n * 0.9, `the cubes fell both in and out of reach (${hits} of ${n})`);
  const src = readFileSync(new URL('../../src/render/shadowPass.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  _candidateQuads(rank) {'), src.indexOf('\n  }\n', src.indexOf('  _candidateQuads(rank) {')));
  assert.match(body, /cube\[4\] = lim\[o \+ 3\] \+ cubeReach\(rad\) - rad \+ lim\[o \+ 4\];\n\s*if \(!placementsInCubeOf\(b, cube\)\) continue;/, 'the walk asks through its typed array, with the cube\'s own reach');
  assert.doesNotMatch(body, /placementsInCube\(/, 'and hands no double to the old door');
  assert.match(body, /const lim = this\._candLim, o = rank \* 5, sp = this\._bSphere, cube = this\._cubeArgs;/, 'its own scratch, made once with the pass - not an array a call (AUDIT PERF-ARENA L4)');
});
