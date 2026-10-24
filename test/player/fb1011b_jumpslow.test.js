// JUMP-SLOW (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "Fix slowfalling" - "you
// can't jump with slowfalling"; Mac: "Give the jump back"). A departure (Port-Ledger A): DFU's HandleJumpInput cancels a
// jump while the player is slow falling (AcrobatMotor.cs:64-70), and the port carried the cancel AND DFU's ApplyGravity,
// which sets the fall speed rather than adding to it - so even with the cancel gone the rise lasted one tick (0.069 m).
// Now a jump under the spell rises as the plain jump does, and the spell takes the descent from the apex at its 2.1 m/s,
// billing no fall. Still ground-gated: Jump pressed in the air does nothing, so the spell is no stair to the sky. Pinned
// on the real motor over a flat collider.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, SLOWFALL_VELOCITY } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';

const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const settled = (sf, ground = () => 0) => {
  const m = new PlayerMotor(new Collider(ground), { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 0, 0);
  m.slowFalling = sf;
  for (let i = 0; i < 30; i++) m.update(1 / 60, still, 0);   // past the 0.1 s grounded gate
  return m;
};
/** Jump pressed on the given steps (the first by default), 180 steps watched: the apex, the fastest descent, the fall billed. */
const jumpOf = (sf, pressAt = [0]) => {
  const m = settled(sf);
  let apex = 0, fastest = 0, billed = 0;
  for (let i = 0; i < 180; i++) {
    m.update(1 / 60, { ...still, jump: pressAt.includes(i) }, 0);
    apex = Math.max(apex, m.pos[1]); fastest = Math.min(fastest, m.velY); billed = Math.max(billed, m.landedFallDistance);
  }
  return { apex, fastest, billed, grounded: m.grounded };
};

test('JUMP-SLOW: a jump under Slowfall rises as the plain jump does, and comes down at the spell\'s 2.1 m/s billing no fall', () => {
  assert.equal(SLOWFALL_VELOCITY, 2.1);
  const plain = jumpOf(false), slow = jumpOf(true);
  assert.ok(plain.apex > 0.4, `the plain jump rises (${plain.apex.toFixed(3)} m)`);
  assert.ok(Math.abs(slow.apex - plain.apex) < 1e-9, `apex ${slow.apex.toFixed(3)} under the spell, ${plain.apex.toFixed(3)} without (0 = the jump refused, 0.069 = one tick of the rise)`);
  assert.ok(slow.fastest >= -SLOWFALL_VELOCITY - 1e-9, `the descent at the spell's speed (${slow.fastest.toFixed(2)} m/s)`);
  assert.ok(plain.fastest < -SLOWFALL_VELOCITY, 'the plain jump falls faster - the spell is what slowed it');
  assert.ok(slow.grounded && slow.billed < 0.1, `landed, billing ${slow.billed.toFixed(3)} m`);
});

test('JUMP-SLOW: still ground-gated - Jump pressed again and again in the air under the spell climbs no higher than one jump', () => {
  const once = jumpOf(true), held = jumpOf(true, Array.from({ length: 60 }, (_, i) => i));
  assert.ok(Math.abs(held.apex - once.apex) < 1e-9, `one jump's height (${held.apex.toFixed(3)} vs ${once.apex.toFixed(3)})`);
});

test('JUMP-SLOW: off a ledge the spell is unmoved - the fall from the first airborne step at 2.1 m/s, never faster', () => {
  const m = settled(true, (x) => (x < 1 ? 3 : 0));   // a 3 m shelf, its edge at x = 1
  m.spawn(0.5, 3, 0);
  for (let i = 0; i < 30; i++) m.update(1 / 60, still, 0);
  let fastest = 0, airborne = 0;
  for (let i = 0; i < 300 && (airborne === 0 || !m.grounded); i++) {
    m.update(1 / 60, { ...still, forward: 1 }, Math.PI / 2);
    if (!m.grounded) { airborne++; fastest = Math.min(fastest, m.velY); }
  }
  assert.ok(airborne > 0, 'it walked off the shelf');
  assert.ok(fastest >= -SLOWFALL_VELOCITY - 1e-9 && fastest <= -SLOWFALL_VELOCITY + 1e-9, `the spell's 2.1 m/s (${fastest.toFixed(3)})`);
});
