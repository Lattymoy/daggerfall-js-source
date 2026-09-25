// HT-WAIST (2026-09-24, Mac: "Let it be a separate animated item on
// movement"). THE SWING LAW - systems/lanternSwing.js, the one law both
// bodies that draw the lantern at the waist feed (the Morrowind body in
// combat/fpArm.js, Eye Of The Beholder's sprite in player/eotbBody.js).
//
// Two damped pendulums on the hip's own acceleration. What must hold, and
// is driven here through the law itself: still, it hangs plumb and stays
// there; starting to walk throws it BACK and stopping throws it FORWARD
// (it lags the hip, it does not lead it); a strafe swings it to the side
// the same way; a steady walk sways it with the stride and never runs it
// away; a turn pulls it OUTWARD; left alone it settles; it never passes
// its stop; the same motion swings the same at 30 and at 144 frames a
// second; and the matrix the Morrowind body hangs it by carries plumb onto
// the way it hangs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LANTERN_SWING, createLanternSwing, stepLanternSwing, lanternSwingDown, lanternSwingMatrix } from '../src/systems/lanternSwing.js';

const run = (s, seconds, motion, fps = 60) => {
  const dt = 1 / fps;
  const n = Math.round(seconds * fps);
  let min = { fore: 0, side: 0 }, max = { fore: 0, side: 0 };
  for (let i = 0; i < n; i++) {
    stepLanternSwing(s, dt, typeof motion === 'function' ? motion(i * dt) : motion);
    for (const k of ['fore', 'side']) { min[k] = Math.min(min[k], s[k]); max[k] = Math.max(max[k], s[k]); }
  }
  return { min, max };
};
const deg = (d) => d * Math.PI / 180;

test('HT-WAIST swing: still, it hangs plumb - and a swing left alone settles back to plumb (mutant: the gravity or the damping term dropped)', () => {
  const s = createLanternSwing();
  assert.deepEqual({ fore: s.fore, side: s.side }, { fore: 0, side: 0 });
  run(s, 3, {});
  assert.deepEqual({ fore: s.fore, side: s.side, foreVel: s.foreVel, sideVel: s.sideVel }, { fore: 0, side: 0, foreVel: 0, sideVel: 0 }, 'nothing moves a still lantern');
  // kicked, then left: it swings back past plumb (gravity) and dies away (damping)
  s.fore = deg(30); s.side = deg(-20);
  const first = run(s, 0.6, {});
  assert.ok(first.min.fore < 0, 'it swings back through plumb - gravity pulls it home');
  run(s, 4, {});
  assert.ok(Math.abs(s.fore) < deg(1) && Math.abs(s.side) < deg(1), `settled: ${s.fore}, ${s.side}`);
});

test('HT-WAIST swing: it LAGS the hip - starting to walk throws it back, stopping throws it forward, a strafe to the right throws it left (mutant: the pivot\'s acceleration sign flipped, or the drive dropped)', () => {
  const s = createLanternSwing();
  const start = run(s, 0.4, { forward: 5 });
  assert.ok(start.min.fore < -deg(8), `a walk begun: it swings back (${(start.min.fore * 180 / Math.PI).toFixed(1)} deg)`);
  assert.ok(start.max.fore <= 0 + 1e-9, 'and not forward first');
  assert.equal(start.max.side, 0); assert.equal(start.min.side, 0, 'a straight walk does not swing it sideways without a stride');
  run(s, 5, { forward: 5 });   // steady: settles
  assert.ok(Math.abs(s.fore) < deg(1), 'a steady walk with no stride: plumb again');
  const stop = run(s, 0.4, { forward: 0 });
  assert.ok(stop.max.fore > deg(8), 'a stop: it swings forward');
  const side = createLanternSwing();
  const strafe = run(side, 0.4, { side: 5 });
  assert.ok(strafe.min.side < -deg(8), 'a strafe to the right throws it to the left');
  assert.equal(strafe.max.fore, 0);
});

test('HT-WAIST swing: a steady walk SWAYS it with the stride - side to side once a stride, within bounds - and standing still with a stride phase moves nothing (mutant: the stride push dropped or unscaled by the speed)', () => {
  const s = createLanternSwing();
  run(s, 3, { forward: 5 });   // up to speed first
  const walk = run(s, 4, (t) => ({ forward: 5, stride: t % 1 }));
  assert.ok(walk.max.side > deg(3) && walk.min.side < -deg(3), `the stride sways it (${(walk.min.side * 180 / Math.PI).toFixed(1)}..${(walk.max.side * 180 / Math.PI).toFixed(1)} deg)`);
  assert.ok(walk.max.side < LANTERN_SWING.maxAngle && walk.min.side > -LANTERN_SWING.maxAngle, 'and a walk never throws it to its stop');
  const idle = createLanternSwing();
  const r = run(idle, 3, (t) => ({ forward: 0, stride: t % 1 }));
  assert.deepEqual([r.min.side, r.max.side, r.min.fore, r.max.fore], [0, 0, 0, 0], 'no speed, no stride push');
});

test('HT-WAIST swing: a turn on the spot pulls it OUTWARD (the hip\'s centripetal pull), either way round (mutant: the turn term dropped or signed by the direction)', () => {
  for (const yawRate of [3, -3]) {
    const s = createLanternSwing();
    const r = run(s, 1, { yawRate });
    assert.ok(r.max.side > deg(2), `turning at ${yawRate} rad/s swings it out to the right hip's side`);
    assert.ok(r.min.side >= 0, 'never inward');
  }
});

test('HT-WAIST swing: it never passes its stop, however hard the hip moves (mutant: the clamp dropped)', () => {
  const s = createLanternSwing();
  const r = run(s, 2, (t) => ({ forward: t < 1 ? 40 : -40, side: t < 1 ? -40 : 40, yawRate: 50 }));
  const cap = LANTERN_SWING.maxAngle + 1e-12;
  assert.ok(r.max.fore <= cap && r.min.fore >= -cap && r.max.side <= cap && r.min.side >= -cap);
  assert.ok(r.min.fore === -LANTERN_SWING.maxAngle || r.max.fore === LANTERN_SWING.maxAngle, 'and it does reach it');
});

test('HT-WAIST swing: the same motion swings the same at 30 and 144 frames a second; a long frame is cut, not integrated whole; a bad dt is nothing (mutant: the sub-step dropped)', () => {
  const at = (fps) => { const s = createLanternSwing(); run(s, 0.5, { forward: 5 }, fps); return s.fore; };
  const a = at(30), b = at(144);
  assert.ok(a < -deg(5) && b < -deg(5), `it did swing, at both rates (${a}, ${b})`);
  assert.ok(Math.abs(a - b) < deg(0.5), `30fps ${a} vs 144fps ${b}`);
  const hitch = createLanternSwing();
  stepLanternSwing(hitch, 10, { forward: 5 });
  const cut = createLanternSwing();
  stepLanternSwing(cut, LANTERN_SWING.maxDt, { forward: 5 });
  assert.deepEqual(hitch, cut, 'a ten-second frame is a quarter-second one');
  const nan = createLanternSwing();
  stepLanternSwing(nan, NaN, { forward: 5 }); stepLanternSwing(nan, -1, { forward: 5 }); stepLanternSwing(nan, 0.016, { forward: NaN, yawRate: NaN });
  assert.deepEqual({ fore: nan.fore, side: nan.side }, { fore: 0, side: 0 });
});

test('HT-WAIST swing: the matrix the Morrowind body hangs it by carries plumb onto the way it hangs - forward is +Y, right is +X, and it is a rotation (mutant: an axis or a sign swapped)', () => {
  const s = createLanternSwing();
  const apply = (m, v) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
  for (const [fore, side] of [[0, 0], [deg(20), 0], [0, deg(20)], [deg(-15), deg(25)]]) {
    s.fore = fore; s.side = side;
    const m = lanternSwingMatrix(s);
    const down = lanternSwingDown(s);
    const got = apply(m, [0, 0, -1]);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - down[i]) < 1e-6, `plumb carried onto the hang (${fore}, ${side})`);
    // orthonormal, determinant +1
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    assert.ok(Math.abs(det - 1) < 1e-6, 'a rotation');
  }
  s.fore = deg(20); s.side = 0;
  assert.ok(lanternSwingDown(s)[1] > 0, 'fore positive: the foot swings forward (+Y, the actor\'s front)');
  s.fore = 0; s.side = deg(20);
  assert.ok(lanternSwingDown(s)[0] > 0, 'side positive: out to the right (+X)');
  const still = lanternSwingMatrix(createLanternSwing());
  [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => assert.ok(Math.abs(still[i] - v) < 1e-12, `still: the identity (${i})`));
});
