import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBone } from '../src/characters/rewrite/limb.js';

// C4-C5 audit: the vendored rig's joint math verified as MATH, not just
// hash parity - the two-bone solve must preserve bone lengths exactly
// (both are exact by construction: |joint-R| = l1 by unit-frame scale,
// |end-joint|^2 expands to l2^2 via the law of cosines), reach the
// target when reachable, clamp at extension, respect the pole side,
// and stay finite through the degenerate cases.
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const EPS = 1e-9;

test('rigmath: bone lengths exact, target reached when reachable', () => {
  const R = [1, 2, 3];
  const F = [1.6, 1.1, 3.4];
  const [joint, end] = solveTwoBone(R, F, 0.8, 0.7);
  assert.ok(Math.abs(len(joint, R) - 0.8) < EPS, `l1: ${len(joint, R)}`);
  assert.ok(Math.abs(len(end, joint) - 0.7) < EPS, `l2: ${len(end, joint)}`);
  assert.ok(len(end, F) < EPS, 'end == target within reach');
});

test('rigmath: overreach clamps to full extension, joints stay true', () => {
  const R = [0, 0, 0];
  const [joint, end] = solveTwoBone(R, [10, 0, 0], 1, 1);
  assert.ok(Math.abs(len(end, R) - (2 - 0.005)) < EPS, 'clamped length');
  assert.ok(Math.abs(len(joint, R) - 1) < EPS);
  assert.ok(Math.abs(len(end, joint) - 1) < EPS);
});

test('rigmath: too-close target clamps to |l1-l2| fold', () => {
  const R = [0, 0, 0];
  const [joint, end] = solveTwoBone(R, [0.01, 0, 0], 1, 0.6);
  assert.ok(Math.abs(len(end, R) - (0.4 + 0.005)) < 1e-6);
  assert.ok(Math.abs(len(joint, R) - 1) < EPS);
  assert.ok(Math.abs(len(end, joint) - 0.6) < EPS);
});

test('rigmath: joint bends toward the pole half-plane', () => {
  const R = [0, 0, 0];
  const F = [1, 0, 0];
  const [jUp] = solveTwoBone(R, F, 0.8, 0.8, [0, 1, 0]);
  const [jDn] = solveTwoBone(R, F, 0.8, 0.8, [0, -1, 0]);
  assert.ok(jUp[1] > 0.1, `pole up bends up: ${jUp[1]}`);
  assert.ok(jDn[1] < -0.1, `pole down bends down: ${jDn[1]}`);
});

test('rigmath: parallel pole + zero-length target stay finite and true', () => {
  const R = [0, 0, 0];
  // Pole parallel to the bone axis triggers the fallback frame.
  const [j1, e1] = solveTwoBone(R, [1, 0, 0], 0.8, 0.8, [1, 0, 0]);
  for (const v of [...j1, ...e1]) assert.ok(Number.isFinite(v));
  assert.ok(Math.abs(len(j1, R) - 0.8) < EPS);
  assert.ok(Math.abs(len(e1, j1) - 0.8) < EPS);
  // Target at the root (degenerate direction guard).
  const [j2, e2] = solveTwoBone(R, [0, 0, 0], 1, 0.6);
  for (const v of [...j2, ...e2]) assert.ok(Number.isFinite(v));
  assert.ok(Math.abs(len(j2, R) - 1) < EPS);
  assert.ok(Math.abs(len(e2, j2) - 0.6) < EPS);
});
