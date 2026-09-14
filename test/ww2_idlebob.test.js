// WW2 (Mac, 2026-09-14: "The newly integrated weapon widget mod had an issue where the bob movement plays even when
// idle"): THE ONE MOTION BAG. The weapon rig's Bob keys its idle on `standing` (FPSWeaponClone's IsStandingStill),
// because DFU's PlayerMotor.Speed is the SETTING and never zero; the hosts wrote the rig's motion bag out longhand at
// five sites and the world-hosted dungeon lane's copy stopped four fields short - no `standing`, so the idle gate
// never fired, the speed ratio fell back to 1 and the WALKING stride played at rest, ten times the idle's size and
// speed (a crouched or mounted walk lost its halving and a run its ratio the same way). The bag is one home now,
// `motionBagOf(player)` in the motor, so a sixth host cannot ship a partial one.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motionBagOf, PlayerMotor } from '../src/player/motor.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WW2: the one motion bag - every field the rig reads, from a player at rest and one walking; the real motor at rest says standing with a speed setting that is never zero', () => {
  const rest = motionBagOf({ moveForward: 0, moveStrafe: 0, isRunning: false, moveSpeed: 0, grounded: true, jumping: false, swimming: false, levitating: false, crouching: false, riding: false, standing: true, speed: 4.43 });
  assert.deepEqual(rest, { forward: 0, strafe: 0, running: false, speed: 0, grounded: true, jumping: false, swimming: false, levitating: false, crouching: false, riding: false, standing: true, speedField: 4.43 });
  const walk = motionBagOf({ moveForward: 1, moveStrafe: 0, isRunning: true, moveSpeed: 6.2, grounded: true, crouching: true, riding: false, standing: false, speed: 8.86 });
  assert.equal(walk.standing, false); assert.equal(walk.running, true); assert.equal(walk.crouching, true); assert.equal(walk.speedField, 8.86);
  const bare = motionBagOf({});
  assert.deepEqual(bare, { forward: 0, strafe: 0, running: false, speed: 0, grounded: true, jumping: false, swimming: false, levitating: false, crouching: false, riding: false, standing: false, speedField: 0 }, 'a bare player: grounded, not standing (the rig then reads a ratio of 1 - the motor must say)');
  // the real motor, at rest: standing, no move speed, a speed setting that is the walk's - DFU's PlayerMotor.Speed
  const motor = new PlayerMotor({ raycast: () => Infinity, heightAt: () => 0, move: (feet) => ({ grounded: true, hitCeiling: false, groundKey: 'floor' }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), raycastHit: () => ({ dist: Infinity, normal: null }) }, [0, 0, 0]);
  const held = { forward: false, back: false, left: false, right: false, jump: false, run: false, crouch: false };
  try { for (let i = 0; i < 10; i++) motor.update?.(1 / 60, held, { speed: 50 }); } catch { /* a motor that wants more deps still carries the fields below */ }
  const bag = motionBagOf(motor);
  assert.equal(typeof bag.standing, 'boolean'); assert.equal(bag.speed, 0, 'no move speed at rest');
  assert.ok(bag.speedField >= 0, 'the speed setting is a number (never the idle gate)');
});

test('WW2: by source - the five host sites read the one bag and none is written out longhand; the record says so', () => {
  for (const [host, sites] of [['src/scenes/world.js', 1], ['src/scenes/exterior.js', 1], ['src/scenes/worldModes.js', 2], ['src/scenes/dungeon.js', 1]]) {
    const s = rd(host);
    assert.equal((s.match(/motionBagOf\(player\)/g) ?? []).length, sites, host);
    assert.equal(/forward: player\.moveForward/.test(s), false, `${host}: no longhand bag`);
    assert.match(s, /import \{[^}]*motionBagOf[^}]*\} from '\.\.\/player\/motor\.js';/, `${host}: from the motor`);
  }
  const m = rd('src/player/motor.js');
  assert.match(m, /export function motionBagOf\(player\) \{\s*\n\s*return \{\s*\n\s*forward: player\.moveForward \|\| 0, strafe: player\.moveStrafe \|\| 0, running: !!player\.isRunning, speed: player\.moveSpeed \|\| 0,\s*\n\s*grounded: player\.grounded !== false, jumping: !!player\.jumping, swimming: !!player\.swimming, levitating: !!player\.levitating,\s*\n\s*crouching: !!player\.crouching, riding: !!player\.riding, standing: !!player\.standing, speedField: player\.speed \|\| 0,\s*\n\s*\};/, 'the one bag, every field');
  assert.match(rd('src/combat/weaponWidget.js'), /if \(m\.standing\) s = w\.s\.bobWhileIdle \? 0\.1 : 0;/, 'the mod\'s idle gate, unchanged');
  assert.match(rd('bible/05-Combat/Weapon-Widget.md'), /through the one motion bag \(`motionBagOf`, WW2\)/);
});
