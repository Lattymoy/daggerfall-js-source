// DRAGON-RIDE (bible/11-Multiplayer/Staff-Events.md section 12): an Admin's ride on the Dwarven Dragon - who may ride,
// the flight's pace, the cannons' clock and aim, the bundle, and /dragon's grammar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mayRideDragon, ridingDragon, mountDragon, landDragon, dragonFlyMult, dragonFire, dragonFiring, dragonBolt, dragonVolley,
  DRAGON_FLY_MULT, DRAGON_BOLT_DAMAGE, DRAGON_BOLT_COOLDOWN_MS, DRAGON_BOLT_MEET, _resetDragonRide,
  parseDragonCommand, DRAGON_HELP_LINE, noteDragonRelay, dragonPoseRide, DRAGON_POSE_RIDE,
} from '../../src/systems/staffDragon.js';
import { registerFlySpeedMod, flySpeedMult } from '../../src/player/motor.js';
import { parseStaffCommand } from '../../src/net/staffCommands.js';
import { DRAGON_RIDE_RELAY_MIN } from '../../src/net/wire.js';   // DRAGON1: the ride's one gate

test('DRAGON-RIDE only the Developer and Shadow Fang may ride (mutants: the Dungeon Master let on; a player with no glyphs let on)', () => {
  assert.equal(mayRideDragon(['dev']), true);
  assert.equal(mayRideDragon(['shadowfang']), true);
  assert.equal(mayRideDragon(['dm']), false);
  assert.equal(mayRideDragon([]), false);
  assert.equal(mayRideDragon(null), false);
});

test('DRAGON-RIDE the ride flies ten times levitation\'s pace and lands /fly where it was (mutants: the pace left on after landing; /fly not given back)', () => {
  _resetDragonRide();
  registerFlySpeedMod('dragon', dragonFlyMult);
  assert.equal(flySpeedMult(), 1);
  mountDragon(false);
  assert.equal(ridingDragon(), true);
  assert.equal(flySpeedMult(), DRAGON_FLY_MULT);
  assert.equal(DRAGON_FLY_MULT, 10);
  assert.equal(landDragon(), false);
  assert.equal(flySpeedMult(), 1);
  mountDragon(true);
  assert.equal(landDragon(), true);
  assert.equal(landDragon(), null);
  registerFlySpeedMod('dragon', null);
});

test('DRAGON-RIDE the cannons fire on their own clock, and only in the saddle (mutants: no cooldown; a volley on foot)', () => {
  _resetDragonRide();
  assert.equal(dragonFire(1000), false);
  mountDragon(false);
  assert.equal(dragonFire(1000), true);
  assert.equal(dragonFiring(1050), true);
  assert.equal(dragonFire(1000 + DRAGON_BOLT_COOLDOWN_MS - 1), false);
  assert.equal(dragonFire(1000 + DRAGON_BOLT_COOLDOWN_MS), true);
  assert.equal(dragonFiring(5000), false);
  _resetDragonRide();
});

test('DRAGON-RIDE a shock ball is shock at range for 999,999, and the two cross on the aim (mutants: one barrel; parallel balls; the wrong element)', () => {
  const b = dragonBolt();
  assert.equal(b.element, 3);
  assert.equal(b.rangeType, 2);
  assert.equal(b.effects[0].type, 4);
  assert.equal(b.effects[0].magnitudeBaseLow, DRAGON_BOLT_DAMAGE);
  assert.equal(DRAGON_BOLT_DAMAGE, 999_999);
  const v = dragonVolley([0, 10, 0], [0, 0, 1]);
  assert.equal(v.length, 2);
  assert.ok(v[0].pos[0] * v[1].pos[0] < 0, 'one each side');
  for (const { pos, dir } of v) {
    const k = (DRAGON_BOLT_MEET - pos[2]) / dir[2];
    assert.ok(Math.abs(pos[0] + dir[0] * k) < 1e-9 && Math.abs(pos[1] + dir[1] * k - 10) < 1e-9, 'meets the aim point');
  }
});

test('DRAGON-RIDE /dragon\'s grammar: bare turns the ride over, on and off say so, anything else is refused', () => {
  assert.deepEqual(parseDragonCommand('/dragon'), { cmd: 'dragon' });
  assert.deepEqual(parseDragonCommand('/dragon on'), { cmd: 'dragon', on: true });
  assert.deepEqual(parseDragonCommand('/DRAGON off'), { cmd: 'dragon', on: false });
  assert.ok('error' in parseDragonCommand('/dragon fly'));
  assert.ok('error' in parseDragonCommand('/dragon on now'));
  assert.equal(parseDragonCommand('/dragons'), null);
  assert.equal(parseDragonCommand('/fly'), null);
  assert.equal(parseStaffCommand('/dragon'), null, 'the relay-read grammar is untouched');
  assert.ok(DRAGON_HELP_LINE.startsWith('/dragon '));
});

test('DRAGON-RIDE my pose says the dragon only while I ride, and only to a relay that keeps it (mutants: said to an older relay, which draws a cart; said on foot)', () => {
  _resetDragonRide();
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN}`);   // PIN MOVED: DRAGON1 (Dwarven-Dragon.md section 10) - the wire's gate, world283 (world281 on its branch, renumbered past the PvP rework's at the merge of main); it was this file's world276
  assert.equal(dragonPoseRide(), null);
  mountDragon(false);
  assert.equal(dragonPoseRide(), DRAGON_POSE_RIDE);
  assert.equal(DRAGON_POSE_RIDE, 3);
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN - 1}`);
  assert.equal(dragonPoseRide(), null);
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN + 1}`);
  assert.equal(dragonPoseRide(), DRAGON_POSE_RIDE);
  landDragon();
  assert.equal(dragonPoseRide(), null);
  _resetDragonRide();
});
