// DRAGON-RIDE (bible/11-Multiplayer/Staff-Events.md section 12): an Admin's ride on the Dwarven Dragon - who may ride,
// the flight's pace, the cannons' clock and aim, the bundle, and /dragon's grammar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mayRideDragon, ridingDragon, mountDragon, landDragon, dragonFlyMult, dragonFire, dragonFiring, dragonBolt, dragonVolley,
  DRAGON_FLY_MULT, DRAGON_BOLT_DAMAGE, DRAGON_BOLT_COOLDOWN_MS, DRAGON_BOLT_MEET, _resetDragonRide,
  parseDragonCommand, DRAGON_HELP_LINE, noteDragonRelay, dragonPoseRide, DRAGON_POSE_RIDE, dragonWireCast, drawPeerCast,
  dragonRideLook, setDragonRideLook, dragonAimDistance, DRAGON_AIM_SLACK,
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
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN}`);   // PIN MOVED: DRAGON1 (Dwarven-Dragon.md section 10) - the wire's gate, world288 (world281, world283, world284, world285, world286 then world287 on its branch, renumbered past world281 to world287 at the merges of main); it was this file's world276
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

test('DRAGON-SHOTS each volley moves the pose\'s cast count as a ranged shock, so the peers draw it; a refused press and the ground move nothing (mutants: the volley uncounted; the rig\'s range and element kept in the saddle; a cooled-down press counted)', () => {
  _resetDragonRide();
  const rig = { n: 7, rangeType: 1, element: 0 };
  assert.deepEqual(dragonWireCast(rig), { n: 7, rangeType: 1, element: 0 }, 'on foot the rig\'s cast stands');
  mountDragon(false);
  assert.equal(dragonFire(1000), true);
  assert.deepEqual(dragonWireCast(rig), { n: 8, rangeType: 2, element: 3 }, 'one volley, one cast: ranged, shock');
  assert.equal(dragonFire(1000 + DRAGON_BOLT_COOLDOWN_MS - 1), false);
  assert.equal(dragonWireCast(rig).n, 8, 'a press the cannons refuse is no cast');
  assert.equal(dragonFire(1000 + DRAGON_BOLT_COOLDOWN_MS), true);
  assert.equal(dragonWireCast({ ...rig, n: 0xffff }).n, 1, 'the count wraps as the rig\'s does');
  landDragon();
  assert.deepEqual(dragonWireCast(rig), { n: 9, rangeType: 1, element: 0 }, 'landed: the count kept (peers read a change), the rig\'s range and element back');
  _resetDragonRide();
});

test('DRAGON-SHOTS a peer riding the dragon is drawn firing both cannons, crossing down the look; any other peer\'s cast from the eye (mutants: one ball for a rider; two for a walker)', () => {
  const look = { from: [0, 10, 0], dir: [0, 0, 1], element: 3, rangeType: 2, casterId: 'p1' };
  const drawn = [];
  drawPeerCast((l) => drawn.push(l), look, DRAGON_POSE_RIDE);
  assert.equal(drawn.length, 2);
  assert.ok(drawn[0].from[0] < 0 && drawn[1].from[0] > 0, 'one from each barrel');
  assert.ok(drawn.every((l) => l.element === 3 && l.casterId === 'p1'));
  drawn.length = 0;
  drawPeerCast((l) => drawn.push(l), look, 1);
  assert.deepEqual(drawn, [look]);
});

test('DRAGON-BLUE /dragon blue mounts the Aetherbright, brass the brass, and either changes the look in the saddle; on foot the look is none (mutants: blue refused; the look kept past the landing; a look past the two)', () => {
  assert.deepEqual(parseDragonCommand('/dragon blue'), { cmd: 'dragon', on: true, look: 1 });
  assert.deepEqual(parseDragonCommand('/dragon Aetherbright'), { cmd: 'dragon', on: true, look: 1 });
  assert.deepEqual(parseDragonCommand('/dragon aether'), { cmd: 'dragon', on: true, look: 1 });
  assert.deepEqual(parseDragonCommand('/dragon brass'), { cmd: 'dragon', on: true, look: 0 });
  assert.ok('error' in parseDragonCommand('/dragon red'));
  assert.ok('error' in parseDragonCommand('/dragon blue now'));
  assert.ok(DRAGON_HELP_LINE.includes('blue'));
  _resetDragonRide();
  assert.equal(dragonRideLook(), 0);
  mountDragon(false, 1);
  assert.equal(dragonRideLook(), 1, 'the Aetherbright, for my saddle and the pose\'s rc');
  setDragonRideLook(0);
  assert.equal(dragonRideLook(), 0);
  setDragonRideLook(7);
  assert.equal(dragonRideLook(), 0, 'only the two looks');
  setDragonRideLook(1);
  landDragon();
  assert.equal(dragonRideLook(), 0, 'landed: no dragon, no look');
  setDragonRideLook(1);
  assert.equal(dragonRideLook(), 0, 'no look on foot');
  mountDragon(false);
  assert.equal(dragonRideLook(), 0, 'a bare mount is the brass');
  _resetDragonRide();
});

test('DRAGON-AIM the balls meet on the nearest body under my aim, not at a fixed distance; with none they meet far off and fly near level (mutants: the fixed meet; a body off the look taken; the farther body taken; a body behind me taken)', () => {
  const eye = [0, 10, 0], dir = [0, 0, 1];
  assert.equal(dragonAimDistance(eye, dir, []), DRAGON_BOLT_MEET);
  const near = { feet: [1, 9, 25], height: 2 }, far = { feet: [0, 9, 80], height: 2 };
  assert.ok(Math.abs(dragonAimDistance(eye, dir, [far, near]) - 25) < 1e-9, 'the nearer of two on the look');
  assert.equal(dragonAimDistance(eye, dir, [{ feet: [DRAGON_AIM_SLACK + 1, 9, 25], height: 2 }]), DRAGON_BOLT_MEET, 'off the look');
  assert.equal(dragonAimDistance(eye, dir, [{ feet: [0, 9, -20], height: 2 }, null, { height: 2 }]), DRAGON_BOLT_MEET, 'behind me, or no body');
  for (const { pos, dir: d } of dragonVolley(eye, dir, 25)) {
    const k = (25 - pos[2]) / d[2];
    assert.ok(Math.abs(pos[0] + d[0] * k) < 1e-9 && Math.abs(pos[1] + d[1] * k - 10) < 1e-9, 'both meet at 25 m');
  }
  assert.ok(DRAGON_BOLT_MEET >= 200, 'with nothing aimed at, near level');
});
