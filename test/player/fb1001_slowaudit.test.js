// AUDIT 2026-10-01 part five (Mac: "audit this") - SLOW-SLIP, SLOW-GRASP, SLOW-PRESS, on the real PlayerMotor over a
// real Collider. Two findings against SLOW-PRESS, each red on the branch before its fix:
//   SP1 under the Jump spell (enhancedJumping) the airborne branch re-reads the input every step, so Forward held re-
//       pressed a slow fall into a face past the slope limit after SLOW-PRESS spent it: 72 deg at a walk took 19.9 s to
//       come down 12 m, 74 deg at a run crept UP the face and stayed;
//   SP2 SLOW-PRESS spent the press on the step the body first touched a wall - and the collider's step-up needs that
//       push the step after, so a slow glide arriving a step under a lower roof's lip fell into the street (148 of 230
//       arrivals at 1 m/s landed on the roof, 216 before SLOW-PRESS).
// And two guards the first pins let pass: the glide along a wall met at an angle keeps its along-wall motion, and a
// slip under the spell is still the classic slip (its regain roll stands).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, SLOWFALL_VELOCITY } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxVerts = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const fwd = { ...still, forward: 1 };
const press = { ...still, forward: 1 };

test('AUDIT SP1, SLOW-PRESS x the Jump spell: air control re-presses into a face past the slope limit every step - the body hangs (walk) or creeps UP it (run)', () => {
  for (const [deg, running] of [[72, false], [74, true]]) {
    const col = new Collider(() => 0);
    const run = 30 / Math.tan(deg * Math.PI / 180), zb = 1 + run + 2;
    col.addMesh('face', new Float32Array([-10, 0, 1, 10, 0, 1, 10, 30, 1 + run, -10, 30, 1 + run, -10, 0, zb, 10, 0, zb, 10, 30, zb, -10, 30, zb]), BOX_IDX, I);
    const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { enhancedJumping: () => true });   // isEnhancedJumping: the Jump effect
    m.spawn(0, 12, 1 + 12 / Math.tan(deg * Math.PI / 180) - 0.6);
    m.slowFalling = true;
    m.isRunning = running;   // the run latched on the ground it left (the air keeps it)
    let t = 0, top = 0;
    while (!m.grounded && t < 20) { m.update(1 / 60, fwd, 0); t += 1 / 60; top = Math.max(top, m.pos[1]); }
    assert.ok(top <= 12 + 1e-6, `${deg} deg, Forward held: crept up the face to ${top.toFixed(2)} m`);
    assert.ok(m.grounded && t < 12 / SLOWFALL_VELOCITY + 1.5, `${deg} deg, Forward held: ${m.grounded ? t.toFixed(1) + ' s' : 'not down in 20 s (y ' + m.pos[1].toFixed(2) + ')'} to come down 12 m`);
  }
});

test('AUDIT SP2, SLOW-PRESS x the step-up: a slow glide arriving with its feet a step under a lower roof\'s lip is stepped onto the roof (the press was spent on the touch, a step before the ladder could use it)', () => {
  for (const [v, d] of [[1, -0.30], [2, -0.40], [4.43, -0.37], [7.59, -0.37]]) {
    const col = new Collider(() => 0);
    col.addMesh('roof', boxVerts(-5, 0, 2, 5, 6, 10), BOX_IDX, I);   // top y 6, lip at z 2
    const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
    const y = 6 + d + SLOWFALL_VELOCITY / v;   // 1 m short of the face: arrives with the feet d under the lip
    m.spawn(0, y, 2 - 0.35 - 1);
    m.slowFalling = true;
    m.update(1 / 60, still, 0);
    m.pos[1] = y; m.pos[2] = 2 - 0.35 - 1;
    m._airVelX = 0; m._airVelZ = v;   // the walk carried off the higher roof (airControl false: frozen at liftoff)
    for (let i = 0; i < 1000 && !m.grounded; i++) m.update(1 / 60, still, 0);
    assert.ok(m.grounded && m.pos[1] > 5, `${v} m/s arriving ${d} m under the lip: came down at y ${m.pos[1].toFixed(2)} (the street) - not stepped onto the roof`);
  }
});

test('SLOW-SLIP: a slip under the spell is still the classic slip - its regain roll can take the hold back (the grasp refusal is the airborne grasp\'s only)', () => {
  const col = new Collider(() => 0);
  col.addMesh('wall', boxVerts(-5, 0, 0.4, 5, 40, 3), BOX_IDX, I);
  let mode = 'pass';
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { climbing: { inputs: () => ({ climbing: 30, luck: 50 }), tally: () => {}, rolls: () => (mode === 'fail' ? 0.999 : 0), say: () => {} } });
  m.spawn(0, 0.02, 0);
  for (let f = 0; m.pos[1] < 15 && f < 3000; f++) m.update(1 / 60, press, 0);
  m.slowFalling = true;
  mode = 'fail';
  let i = 0;
  while (!m.climb.isSlipping && i++ < 2000) m.update(1 / 60, press, 0);
  assert.ok(m.climb.isSlipping, 'slipped');
  mode = 'pass';
  for (let k = 0; k < 60; k++) m.update(1 / 60, press, 0);
  assert.ok(m.climb.isClimbing && !m.climb.isSlipping && !m.grounded, `the regain roll took the hold back (climbing ${m.climb.isClimbing}, slipping ${m.climb.isSlipping}, y ${m.pos[1].toFixed(2)})`);
});

test('SLOW-PRESS: a slow glide meeting a wall at 45 degrees keeps its along-wall half (only the press is spent)', () => {
  const col = new Collider(() => 0);
  col.addMesh('wall', boxVerts(-50, 0, 1, 50, 40, 3), BOX_IDX, I);
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 20, 0.3);
  m.slowFalling = true;
  m.update(1 / 60, still, 0);
  m._airVelX = 3; m._airVelZ = 3;
  for (let i = 0; i < 60; i++) m.update(1 / 60, still, 0);
  assert.ok(Math.abs(m._airVelX - 3) < 0.01 && m.pos[0] > 2.9, `along the wall: ${m._airVelX.toFixed(2)} m/s, x ${m.pos[0].toFixed(2)} after 1 s`);
  assert.ok(m.pos[2] <= 1 - 0.34, 'and never through it');
});

test('SLOW-PRESS: a slow glide meeting a face past the slope limit at an angle slides ALONG it as it comes down - the press is spent, never the rest of the glide (mutant: the held glide zeroed)', () => {
  const col = new Collider(() => 0);
  const t = Math.tan(72 * Math.PI / 180), zT = 1 + 30 / t;
  col.addMesh('face', new Float32Array([-30, 0, 1, 30, 0, 1, 30, 30, zT, -30, 30, zT, -30, 0, zT + 2, 30, 0, zT + 2, 30, 30, zT + 2, -30, 30, zT + 2]), BOX_IDX, I);
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 12, 1 + 12 / t - 0.6);
  m.slowFalling = true;
  m.update(1 / 60, still, 0);
  m._airVelX = 4; m._airVelZ = 4;   // a run off an edge at 45 degrees to the face
  let s = 0;
  while (!m.grounded && s < 20) { m.update(1 / 60, still, 0); s += 1 / 60; }
  assert.ok(m.grounded && s < 12 / SLOWFALL_VELOCITY + 1.5, `down in ${s.toFixed(1)} s`);
  assert.ok(m.pos[0] > 15, `the along-face half carried it ${m.pos[0].toFixed(2)} m along the face`);
});

test('SLOW-PRESS x the Jump spell: the way a face refused is the face\'s only while it holds the body - past the face\'s foot Forward steers again (mutant: the held press never let go)', () => {
  const col = new Collider(() => 0);
  const t = Math.tan(72 * Math.PI / 180), zA = 1 + 6 / t, zT = 1 + 30 / t;
  col.addMesh('quad', new Float32Array([-10, 6, zA, 10, 6, zA, 10, 30, zT, -10, 30, zT]), [0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3], I);   // a face that ends 6 m up, open under it
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { enhancedJumping: () => true });
  m.spawn(0, 12, 1 + 12 / t - 0.6);
  m.slowFalling = true;
  let s = 0, zOff = null;
  while (!m.grounded && s < 20) { m.update(1 / 60, fwd, 0); s += 1 / 60; if (zOff == null && m.pos[1] < 5) zOff = m.pos[2]; }
  assert.ok(m.grounded && zOff != null, 'slid off the face\'s foot and came down');
  assert.ok(m.pos[2] - zOff > 3, `Forward carried it ${(m.pos[2] - zOff).toFixed(2)} m on under the face once it was off it`);
});
