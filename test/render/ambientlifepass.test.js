// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures' pass, its vertex stage run in JS (test/glsl.mjs) -
// a body faces the way the sim heads it, banks into its turn, and folds, beats and steps as the sim says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions } from '../glsl.mjs';
import { AMBIENT_LIFE_PROGRAMS, AL_BODY_VERTS, kindTables } from '../../src/render/ambientLifePass.js';
import { AL_KINDS, AL_KIND_LIST } from '../../src/systems/ambientLife/ambientCast.js';
import { faceVelocity, makeBody } from '../../src/systems/ambientLife/ambientBody.js';

const [VS] = AMBIENT_LIFE_PROGRAMS[0];
const fns = glslFunctions(VS, {});
const near = (a, b, eps = 1e-5) => a.every((v, i) => Math.abs(v - b[i]) < eps);
/** Corner c of triangle t of a winged kind. */
const wingAt = (kind, t, c, spread, amp, phase) => fns.wingCorner(t, c, kind.a, kind.b, spread, amp, phase);
const runnerAt = (kind, t, c, phase, amp = 1) => fns.runnerCorner(t, c, kind.a, kind.b, phase, amp);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const faceNormal = (corners) => { const [a, b, c] = corners; const n = cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i])); const l = Math.hypot(...n); return n.map((v) => v / l); };

test('AMBIENT-LIFE: the pass turns a body the way the sim heads it (+z forward at yaw 0, the yaw atan2(vx, vz))', () => {
  for (const yaw of [0, 0.7, -2.1, Math.PI]) assert.ok(near(fns.turn([0, 0, 1], [yaw, 0, 0]), [Math.sin(yaw), 0, Math.cos(yaw)]), `yaw ${yaw}`);
  const b = makeBody(AL_KINDS.crow, () => 0.5);
  b.yaw = 0; b.vx = 3; b.vz = 4;
  for (let i = 0; i < 60; i++) faceVelocity(b, 1 / 30, 10);
  assert.ok(near(fns.turn([0, 0, 1], [b.yaw, 0, 0]), [0.6, 0, 0.8], 1e-3), 'the sim\'s heading is the pass\'s forward');
  assert.ok(fns.turn([0, 0, 1], [0, 0.4, 0])[1] > 0, 'a positive pitch lifts the nose');
});

test('AMBIENT-LIFE: a turn toward +x banks the +x wing down', () => {
  const b = makeBody(AL_KINDS.crow, () => 0.5);
  b.yaw = 0; b.vx = 0; b.vz = 5;
  for (let i = 0; i < 4; i++) { b.vx += 1.5; faceVelocity(b, 1 / 30, 4); }
  assert.ok(b.bank < 0, `bank ${b.bank}`);
  assert.ok(fns.turn([1, 0, 0], [0, 0, b.bank])[1] < 0, 'the +x wingtip is lowered');
});

test('AMBIENT-LIFE: wings - folded short along the body, beating through their stroke, mirrored', () => {
  const k = AL_KINDS.crow, tip = (spread, amp, phase) => wingAt(k, 5, 2, spread, amp, phase), otherTip = (a) => wingAt(k, 8, 2, 1, 0.9, a);
  const open = tip(1, 0, 0), folded = tip(0, 0, 0);
  assert.ok(Math.abs(folded[0]) < Math.abs(open[0]) * 0.5, `folded ${folded[0]} vs open ${open[0]}`);
  assert.ok(folded[2] < open[2], 'and laid back');
  const up = tip(1, 0.9, Math.PI / 2), down = tip(1, 0.9, -Math.PI / 2);
  assert.ok(up[1] > 0.3 && down[1] < -0.3, `the stroke: ${up[1]} / ${down[1]}`);
  assert.ok(near(otherTip(1), [-tip(1, 0.9, 1)[0], ...tip(1, 0.9, 1).slice(1)]), 'the wings mirror');
  const n = faceNormal([0, 1, 2].map((c) => wingAt(k, 3, c, 1, 0, 0)));
  assert.ok(Math.abs(Math.abs(n[1]) - Math.cos(k.b[3])) < 1e-6 && Math.abs(n[2]) < 1e-6, 'a held wing\'s face is level but for its dihedral');
  const side = faceNormal([0, 1, 2].map((c) => wingAt(k, 10, c, 0, 0, 0)));
  assert.ok(Math.abs(Math.abs(side[0]) - 1) < 1e-6, 'the body\'s side stands upright, a shape from the side for a bird on a roof');
  assert.equal(AL_BODY_VERTS, 39);
});

test('AMBIENT-LIFE: a runner\'s feet step on the ground in diagonal pairs; a crab has no head', () => {
  const k = AL_KINDS.rat, foot = (leg, phase) => runnerAt(k, 9 + leg, 2, phase);
  assert.notEqual(foot(0, Math.PI / 2)[2] - foot(0, -Math.PI / 2)[2], 0, 'a foot swings');
  for (let leg = 0; leg < 4; leg++) assert.equal(foot(leg, 0.3)[1], 0, `foot ${leg} on the ground`);
  const swing = (leg) => foot(leg, Math.PI / 2)[2] - foot(leg, 0)[2];
  assert.ok(Math.abs(swing(0) - swing(3)) < 1e-9 && Math.abs(swing(1) - swing(2)) < 1e-9 && swing(0) * swing(1) < 0, 'front left with back right');
  const crabHead = [4, 5, 6, 7].flatMap((t) => [0, 1, 2].map((c) => runnerAt(AL_KINDS.crab, t, c, 0).join()));
  assert.equal(new Set(crabHead).size, 1, 'one point: no triangle');
  assert.ok(runnerAt(AL_KINDS.squirrel, 8, 2, 0)[1] > runnerAt(AL_KINDS.rat, 8, 2, 0)[1] + 0.1, 'a squirrel\'s tail stands up');
});

test('AMBIENT-LIFE: the kinds\' tables put each kind\'s measures at its id', () => {
  const t = kindTables();
  for (const k of AL_KIND_LIST) {
    assert.deepEqual([...t.a.subarray(k.id * 4, k.id * 4 + 4)], k.a.map(Math.fround));
    assert.deepEqual([...t.b.subarray(k.id * 4, k.id * 4 + 4)], k.b.map(Math.fround));
    assert.equal(t.shape[k.id], k.shape);
  }
  assert.match(VS, /uniform vec4 uKindA\[16\]/);
  assert.ok(t.shape.length >= AL_KIND_LIST.length);
});
