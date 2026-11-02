// PERF-ROPE (2026-10-12, an allocation profile of a player's live client walking the overworld's coast: the moving
// teams' harnesses were some 7% of what the page allocated; bible/07-Rendering/Performance-Priority.md PERF-ROPE) - A
// ROPE STEPS IN PLACE: the rope it was (the old law restated here, Math.hypot and new end arrays every step), to within
// a float's rounding, over every step a team makes - laid, stepped, a leap, a still frame; its ends kept in its own
// arrays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRope, stepRope, layRope, ROPE } from '../../../src/systems/wagon/wagonRopes.js';
import { seeded } from '../../navalSea.mjs';

/** The old law, as it stood before PERF-ROPE (its pinEnds the module's own). */
function oldStep(rope, a, b, dt, scale = 1) {
  const pin = (r, x, y) => { const { n, p, q } = r, e = (n - 1) * 3; for (let k = 0; k < 3; k++) { p[k] = q[k] = x[k]; p[e + k] = q[e + k] = y[k]; } };
  const s = scale > 0 ? scale : 1;
  const leapt = !rope.laid || Math.hypot(a[0] - rope.a[0], a[1] - rope.a[1], a[2] - rope.a[2]) > ROPE.leap * s || Math.hypot(b[0] - rope.b[0], b[1] - rope.b[1], b[2] - rope.b[2]) > ROPE.leap * s;
  if (leapt || !(dt > 0)) { if (leapt) layRope(rope, a, b); else { pin(rope, a, b); rope.a = [...a]; rope.b = [...b]; } return rope; }
  const steps = Math.min(ROPE.maxSteps, Math.max(1, Math.ceil(dt / ROPE.maxStep)));
  const h = Math.min(dt, ROPE.maxStep * steps) / steps;
  const { n, p, q } = rope;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const link = (span * (ROPE[rope.kind]?.slack ?? ROPE.trace.slack)) / (n - 1);
  const a0 = rope.a, b0 = rope.b;
  for (let st = 1; st <= steps; st++) {
    const t = st / steps;
    const ea = [a0[0] + (a[0] - a0[0]) * t, a0[1] + (a[1] - a0[1]) * t, a0[2] + (a[2] - a0[2]) * t];
    const eb = [b0[0] + (b[0] - b0[0]) * t, b0[1] + (b[1] - b0[1]) * t, b0[2] + (b[2] - b0[2]) * t];
    for (let i = 1; i < n - 1; i++) for (let k = 0; k < 3; k++) { const o = i * 3 + k, v = (p[o] - q[o]) * ROPE.damping; q[o] = p[o]; p[o] += v + (k === 1 ? -ROPE.gravity * s * h * h : 0); }
    pin(rope, ea, eb);
    for (let it = 0; it < ROPE.iterations; it++) {
      for (let i = 0; i < n - 1; i++) {
        const o = i * 3, u = o + 3;
        const dx = p[u] - p[o], dy = p[u + 1] - p[o + 1], dz = p[u + 2] - p[o + 2];
        const len = Math.hypot(dx, dy, dz);
        if (!(len > 1e-9)) continue;
        const wa = i === 0 ? 0 : 1, wb = i + 1 === n - 1 ? 0 : 1;
        if (!(wa + wb)) continue;
        const f = (len - link) / len / (wa + wb);
        p[o] += dx * f * wa; p[o + 1] += dy * f * wa; p[o + 2] += dz * f * wa;
        p[u] -= dx * f * wb; p[u + 1] -= dy * f * wb; p[u + 2] -= dz * f * wb;
      }
    }
  }
  rope.a = [a[0], a[1], a[2]]; rope.b = [b[0], b[1], b[2]];
  return rope;
}

test('PERF-ROPE: every step a team makes - laid, walking, trotting, a leap, a still frame, a grown rig - the rope the old law made, to within a float\'s rounding', () => {
  const rnd = seeded(11);
  let worst = 0;
  for (let r = 0; r < 200; r++) {
    const kind = rnd() < 0.5 ? 'trace' : 'rein';
    const mine = newRope(kind), old = newRope(kind);
    const a = [rnd() * 10, 1 + rnd(), rnd() * 10], b = [a[0] + 1 + rnd() * 2, a[1] - 0.3, a[2] + rnd()];
    const scale = rnd() < 0.2 ? 1.5 + rnd() * 3 : 1;
    for (let f = 0; f < 120; f++) {
      const v = f % 40 === 39 ? 5 : rnd() * 0.08;   // a leap now and then
      for (const e of [a, b]) { e[0] += v; e[2] += (rnd() - 0.5) * 0.02; e[1] += (rnd() - 0.5) * 0.01; }
      const dt = f % 17 === 0 ? 0 : 1 / (30 + rnd() * 120);
      stepRope(mine, a, b, dt, scale); oldStep(old, a, b, dt, scale);
      for (let i = 0; i < mine.p.length; i++) worst = Math.max(worst, Math.abs(mine.p[i] - old.p[i]));
      assert.deepEqual([...mine.a, ...mine.b].map((x) => +x.toFixed(9)), [...old.a, ...old.b].map((x) => +x.toFixed(9)));
    }
  }
  assert.ok(worst < 1e-6, `the most any knot strayed from the old law: ${worst.toExponential(2)} m`);
});

test('PERF-ROPE: a rope keeps its ends in its own arrays, stepped or still - the caller\'s arrays never taken', () => {
  const rope = newRope('trace');
  const ownA = rope.a, ownB = rope.b;
  const a = [0, 1, 0], b = [2, 0.8, 0];
  stepRope(rope, a, b, 1 / 60);   // laid
  const laidA = rope.a, laidB = rope.b;
  for (let f = 0; f < 10; f++) { a[0] += 0.05; b[0] += 0.05; stepRope(rope, a, b, f === 5 ? 0 : 1 / 60); }
  assert.equal(rope.a, laidA, 'the same array, stepped or still');
  assert.equal(rope.b, laidB);
  assert.notEqual(rope.a, a, 'never the caller\'s');
  assert.deepEqual(rope.a, a, 'and holding where the end stands');
  assert.ok(ownA && ownB);
});
