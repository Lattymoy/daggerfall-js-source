// AUDIT 24, wave 34: AttemptMove is not "move" - it is probe, then
// move OR detour. None of the probe was ported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EnemyAI, MELEE_DISTANCE, OBSTACLE_CHECK_DISTANCE, OBSTACLE_CAST_RADIUS,
  DETOUR_TIMER, DETOUR_CLOCKWISE_TIMER, DETOUR_UNSTUCK_RESET, DETOUR_REACH,
  DETOUR_ARRIVAL, DETOUR_SWEEP_MAX_TRIES, FALL_CHECK_AHEAD, FALL_CHECK_DROP,
  DOOR_CROUCHING_HEIGHT,
} from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

/** A floor, optionally cut short at +z, plus optional walls. */
function world({ floorTo = 40, wall = null, wallKey = 'wall' } = {}) {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, floorTo, -40, 0, floorTo]), quadIdx, I);
  if (wall) {
    // a vertical quad across x, standing at z = wall, 4 units tall
    c.addMesh(wallKey, new Float32Array([-40, 0, wall, 40, 0, wall, 40, 4, wall, -40, 4, wall]), quadIdx, I);
  }
  return c;
}
const NORTH = [0, 0, 1];   // the port's yaw 0 heading: x = sin, z = cos
const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });
/** Four 1/60 steps = one classic tick, the audit18_enemies helper. */
const tick = (ai, target, s = senses()) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, target, s, false); };

test('audit24 wave34: capsuleCast answers the swept capsule, and names the bucket', () => {
  const c = world({ wall: 1.0 });
  const p1 = [0, 0.5, 0];
  const p2 = [0, 1.2, 0];
  const hit = c.capsuleCast(p1, p2, OBSTACLE_CAST_RADIUS, NORTH, 2);
  // the reported distance is the distance the CAPSULE travels, so it is
  // short of the axis-to-wall gap by the leading cap's radius
  assert.ok(Math.abs(hit.dist - (1.0 - OBSTACLE_CAST_RADIUS)) < 0.02,
    `travelled, not axis-to-wall: ${hit.dist.toFixed(3)}`);
  assert.equal(hit.key, 'wall', 'and the bucket comes back - action doors are their own buckets');
  assert.equal(Number.isFinite(c.capsuleCast(p1, p2, OBSTACLE_CAST_RADIUS, NORTH, 0.5).dist), false,
    'a sweep that stops short of it is clear');
  assert.equal(Number.isFinite(c.capsuleCast(p1, p2, OBSTACLE_CAST_RADIUS, [0, 0, -1], 2).dist), false,
    'and so is one aimed the other way');
  // the RADIUS is real: a gap narrower than the capsule is not clear
  const slit = world({ wall: 1.0, wallKey: 'w1' });
  slit.addMesh('w2', new Float32Array([-40, 0, 1.0, 40, 0, 1.0, 40, 4, 1.0, -40, 4, 1.0]), quadIdx, I);
  assert.ok(Number.isFinite(slit.capsuleCast(p1, p2, OBSTACLE_CAST_RADIUS, NORTH, 2).dist));
});

test('audit24 wave34: the constants are DFU\'s, and the probe geometry derives from the capsule', () => {
  assert.equal(OBSTACLE_CHECK_DISTANCE, CAPSULE_RADIUS / Math.SQRT2, 'EnemyMotor.cs:1143');
  assert.equal(OBSTACLE_CAST_RADIUS, CAPSULE_RADIUS / 2, ':1154');
  assert.equal(DOOR_CROUCHING_HEIGHT, 1.65, ':37');
  assert.equal(FALL_CHECK_AHEAD, 1, ':1210');
  assert.equal(FALL_CHECK_DROP, 1.5, ':1218');
  assert.equal(DETOUR_TIMER, 0.75, ':1135');
  assert.equal(DETOUR_CLOCKWISE_TIMER, 5, ':1094');
  assert.equal(DETOUR_UNSTUCK_RESET, 2, ':1033');
  assert.equal(DETOUR_REACH, 2, ':1133');
  assert.equal(DETOUR_ARRIVAL, 0.3, ':402');
  assert.equal(DETOUR_SWEEP_MAX_TRIES, 7, ':1124 `if (count > 7) break`');
});

test('audit24 wave34: a wall STOPS the foe and buys a detour, it does not get slid along', () => {
  const c = world({ wall: 3.0 });
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.4 });
  ai.detected = true;
  ai.inSight = true;
  const target = [0, 0, 20];   // straight through the wall
  const z0 = ai.feet[2];
  for (let i = 0; i < 40; i++) tick(ai, target);
  assert.ok(ai.feet[2] > z0, 'it did approach');
  assert.ok(ai.feet[2] < 3.0, 'and it never crossed the wall');
  // the machine really engaged, rather than the capsule simply blocking
  assert.ok(ai.avoidObstaclesTimer > 0 || ai.lastTimeWasStuck > 0, 'the detour machine ran');
  assert.notDeepEqual(ai.detourDestination, [0, 0, 0], 'and it chose somewhere to go');
  // THE SIGNATURE of a detour rather than a slide: it worked its way
  // SIDEWAYS along the wall. A capsule grinding into a flat wall it is
  // walking straight at has no lateral force on it at all and would
  // still be at x = 0.
  assert.ok(Math.abs(ai.feet[0]) > 1, `it went around: x = ${ai.feet[0].toFixed(2)}`);
  // and the destination is two units out AT THE MOMENT IT IS CHOSEN -
  // measured later it is wherever the foe has walked to since, which is
  // the whole point of the 0.75s commitment.
  // REVIEW 2026-09-05 (PR #55 review): the detour destination is FEET-space
  // like every other destination on the class (DFU's transform + probe *
  // reach, less the transform offset) - measured from the feet, not the
  // capsule centre it used to be built from.
  const at = [ai.feet[0], ai.feet[1], ai.feet[2]];
  ai._findDetour([Math.sin(ai.yaw), 0, Math.cos(ai.yaw)]);
  const d = Math.hypot(ai.detourDestination[0] - at[0], ai.detourDestination[1] - at[1], ai.detourDestination[2] - at[2]);
  assert.ok(Math.abs(d - DETOUR_REACH) < 1e-6, `two units along the probe, got ${d.toFixed(2)}`);
});

test('audit24 wave34: a blocked foe does not translate at all - the move is the ELSE arm', () => {
  // EnemyMotor.cs:989-996: `if (fallDetected || ObstacleDetected)
  // FindDetour(...) else controller.Move(...)`. The port used to move
  // unconditionally and let the capsule slide along the wall.
  const asked = [];
  const stub = {
    raycast: () => Infinity,
    capsuleCast: () => ({ dist: 0.1, key: 'wall' }),
    move: (feet, dx, dy, dz) => { asked.push([dx, dz]); return { grounded: true }; },
  };
  const ai = new EnemyAI(stub, [0, 0, 0], 0, { liveSpeed: 50 });
  ai.detected = true;
  ai.inSight = true;
  ai.moving = true;
  ai._step(1 / 60, [0, 0, 20], senses(), false);
  assert.equal(asked.length, 1, 'the capsule was still asked to fall');
  assert.deepEqual(asked[0], [0, 0], 'but with no horizontal motion whatsoever');
  assert.equal(ai.obstacleDetected, true);
  assert.ok(ai.avoidObstaclesTimer > 0, 'and a detour was bought instead');

  // clear ahead: the same foe DOES translate
  const clear = [];
  const ai2 = new EnemyAI({
    raycast: () => 1, capsuleCast: () => ({ dist: Infinity, key: null }),
    move: (feet, dx, dy, dz) => { clear.push([dx, dz]); return { grounded: true }; },
  }, [0, 0, 0], 0, { liveSpeed: 50 });
  ai2.detected = true; ai2.inSight = true; ai2.moving = true;
  ai2._step(1 / 60, [0, 0, 20], senses(), false);
  assert.ok(Math.abs(clear[0][1]) > 0, 'a clear path moves');
});

test('audit24 wave34: a foe will not step off a ledge, and the detour is what stops it', () => {
  // The floor ends at z = 4 over a 1000-unit void: FallCheck's ray from
  // one unit ahead of the centre finds nothing within height/2 + 1.5.
  const c = world({ floorTo: 4 });
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.4 });
  ai.detected = true;
  ai.inSight = true;
  for (let i = 0; i < 60; i++) tick(ai, [0, 0, 30]);
  assert.ok(ai.feet[1] > -5, `it stayed on the floor (y = ${ai.feet[1].toFixed(2)})`);
  assert.ok(ai.feet[2] < 4, 'and never walked past the edge');

  // THE EDGE of the reach, which is what makes it a ledge test and not a
  // "there is nothing at all down there" test: the ray reaches
  // height/2 + 1.5, so a step DOWN of exactly that is still floor.
  const shelf = (drop) => {
    const c3 = new Collider(() => -1000);
    c3.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 0.5, -40, 0, 0.5]), quadIdx, I);
    c3.addMesh('lower', new Float32Array([-40, -drop, 0.5, 40, -drop, 0.5, 40, -drop, 40, -40, -drop, 40]), quadIdx, I);
    const a = new EnemyAI(c3, [0, 0, 0], 0, { liveSpeed: 50 });
    a._fallCheck(NORTH);
    return a.fallDetected;
  };
  // The ray reaches `height * 0.5 + 1.5` and starts at the CONTROLLER
  // CENTRE, which is height/2 above the feet - so the two halves cancel
  // and the real limit is FALL_CHECK_DROP below the foe's own feet.
  assert.equal(shelf(FALL_CHECK_DROP - 0.05), false, 'a step down inside the reach is not a fall');
  assert.equal(shelf(FALL_CHECK_DROP + 0.05), true, 'one step deeper is');

  // the same foe with the floor CONTINUING walks straight on - so the
  // fixture is testing the ledge, not some other refusal to move.
  const c2 = world({ floorTo: 40 });
  const ai2 = new EnemyAI(c2, [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.4 });
  ai2.detected = true;
  ai2.inSight = true;
  for (let i = 0; i < 60; i++) tick(ai2, [0, 0, 30]);
  assert.ok(ai2.feet[2] > 6, `an unbroken floor is walked (z = ${ai2.feet[2].toFixed(2)})`);
});

test('audit24 wave34: FallCheck is cancelled by an obstacle, a slope or a door', () => {
  // EnemyMotor.cs:1206-1210 - the early return, which is why
  // ObstacleCheck must run first. Without it a foe standing at a wall
  // ON a ledge would read BOTH, and the detour would be chosen from
  // the wrong probe.
  // the wall must be inside the probe's reach - OBSTACLE_CHECK_DISTANCE
  // plus the cast capsule's leading cap, about 0.42 ahead of the axis.
  const c = world({ floorTo: 4, wall: 0.3 });
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  ai._obstacleCheck(NORTH);
  assert.equal(ai.obstacleDetected, true, 'the wall is seen');
  ai._fallCheck(NORTH);
  assert.equal(ai.fallDetected, false, 'and the ledge behind it is not even asked about');

  // each flag alone cancels it
  for (const flag of ['obstacleDetected', 'foundUpwardSlope', 'foundDoor']) {
    const a = new EnemyAI(world({ floorTo: 0.1 }), [0, 0, 0], 0, { liveSpeed: 50 });
    a.obstacleDetected = false; a.foundUpwardSlope = false; a.foundDoor = false;
    a[flag] = true;
    a._fallCheck(NORTH);
    assert.equal(a.fallDetected, false, `${flag} cancels the fall test`);
  }
  const bare = new EnemyAI(world({ floorTo: 0.1 }), [0, 0, 0], 0, { liveSpeed: 50 });
  bare._fallCheck(NORTH);
  assert.equal(bare.fallDetected, true, '...and with none of them set, the void IS detected');
});

test('audit24 wave34: a climbable upward slope is not an obstacle', () => {
  // ObstacleCheck's re-cast (:1180-1195). The arm's law is "the first
  // capsule hit something, but a TALLER one aimed a unit ahead and a
  // unit UP is clear, so walk into it" - and that is what is pinned
  // here, through a collider that answers the two casts differently.
  // Real ramp geometry cannot separate them at this scale: p1 sits at
  // the climbable-step height (0.1388 of the body below its centre)
  // precisely so that anything the controller can step over never
  // reaches the first cast at all.
  const casts = [];
  const stub = {
    raycast: () => Infinity,
    capsuleCast(p1, p2, radius, dir, maxDist) {
      casts.push({ p1: [...p1], p2: [...p2], radius, dir: [...dir], maxDist });
      // the first (horizontal) cast hits; the second (up-aimed) is clear
      return dir[1] === 0 ? { dist: 0.1, key: 'ramp' } : { dist: Infinity, key: null };
    },
  };
  const ai = new EnemyAI(stub, [0, 0, 0], 0, { liveSpeed: 50 });
  ai._obstacleCheck(NORTH);
  assert.equal(ai.foundUpwardSlope, true, 'the re-cast was clear, so it is a slope');
  assert.equal(ai.obstacleDetected, false, 'and NOT an obstacle');
  assert.equal(casts.length, 2, 'exactly two casts: the probe, then the slope re-cast');
  // the geometry of both, against the C#
  assert.equal(casts[0].radius, OBSTACLE_CAST_RADIUS);
  assert.equal(casts[0].maxDist, OBSTACLE_CHECK_DISTANCE);
  assert.ok(Math.abs(casts[0].p1[1] - (0.9 - 1.8 * 0.1388)) < 1e-9, 'p1 is 0.1388 of the body below the centre');
  assert.ok(Math.abs((casts[0].p2[1] - casts[0].p1[1]) - Math.min(1.8, DOOR_CROUCHING_HEIGHT) / 2) < 1e-9,
    'p2 is half a crouch-height above p1');
  assert.ok(Math.abs(casts[1].p1[1] - (0.9 - 1.8 * 0.25)) < 1e-9, 'the re-cast starts 0.25 of the body lower');
  assert.ok(Math.abs((casts[1].p2[1] - casts[1].p1[1]) - 1.8 * 0.75) < 1e-9, 'and is 0.75 of the body tall');
  assert.ok(casts[1].dir[1] > 0.7 && casts[1].dir[1] < 0.71, 'aimed one unit ahead and one unit UP, normalised');

  // if the re-cast is ALSO blocked, it stays an obstacle
  const blocked = new EnemyAI({
    raycast: () => Infinity,
    capsuleCast: () => ({ dist: 0.1, key: 'wall' }),
  }, [0, 0, 0], 0, { liveSpeed: 50 });
  blocked._obstacleCheck(NORTH);
  assert.equal(blocked.obstacleDetected, true);
  assert.equal(blocked.foundUpwardSlope, false);

  // and a swimmer or a flyer never asks the question at all (:1180)
  for (const behaviour of ['Aquatic', 'Flying']) {
    const n = [];
    const fish = new EnemyAI({
      raycast: () => Infinity,
      capsuleCast: (a, b, r, dir) => { n.push(dir); return { dist: 0.1, key: 'wall' }; },
    }, [0, 0, 0], 0, { liveSpeed: 50, behaviour });
    fish._obstacleCheck(NORTH);
    assert.equal(n.length, 1, `${behaviour}: one cast, no slope re-cast`);
    assert.equal(fish.obstacleDetected, true);
  }

  // a sheer wall in REAL geometry is an obstacle and not a slope
  const w = new EnemyAI(world({ wall: 0.3 }), [0, 0, 0], 0, { liveSpeed: 50 });
  w._obstacleCheck(NORTH);
  assert.equal(w.obstacleDetected, true);
  assert.equal(w.foundUpwardSlope, false);
});

test('audit24 wave34: an action door is not an obstacle - it is a door', () => {
  // :1167-1176. The AI cannot resolve a bucket key to an action object,
  // so the HOST answers - the same registry the OpenDoors seam reads.
  const c = world({ wall: 0.3, wallKey: 'door:17' });
  const ai = new EnemyAI(c, [0, 0, 0], 0, {
    liveSpeed: 50, isActionDoor: (key) => typeof key === 'string' && key.startsWith('door:'),
  });
  ai._obstacleCheck(NORTH);
  assert.equal(ai.obstacleDetected, false, 'the door is walked at, not walked round');
  assert.equal(ai.foundDoor, true);
  assert.equal(ai.doorKey, 'door:17', 'and it is recorded for OpenDoors, as senses.LastKnownDoor is');

  // a host that has no action doors answers false, and the same
  // geometry is an obstacle again - the default must not exempt walls
  const plain = new EnemyAI(world({ wall: 0.3, wallKey: 'door:17' }), [0, 0, 0], 0, { liveSpeed: 50 });
  plain._obstacleCheck(NORTH);
  assert.equal(plain.obstacleDetected, true, 'the default isActionDoor exempts nothing');
  assert.equal(plain.foundDoor, false);
});

test('audit24 wave34: the committed hand - chosen once, held five seconds, then flipped', () => {
  const ai = new EnemyAI(world({ wall: 1.0 }), [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.9 });
  ai.destination = [0, 0, 20];
  ai._clock = 100;
  ai.lastTimeWasStuck = 100;   // recently stuck, so no reset
  ai._findDetour(NORTH);
  const firstHand = ai.checkingClockwise;
  assert.equal(ai.didClockwiseCheck, true);
  assert.equal(ai.checkingClockwiseTimer, DETOUR_CLOCKWISE_TIMER);
  assert.equal(ai.avoidObstaclesTimer, DETOUR_TIMER);
  assert.equal(ai.lastTimeWasStuck, 100);

  // inside the five seconds the hand is NOT re-chosen
  ai.checkingClockwiseTimer = 3;
  ai._findDetour(NORTH);
  assert.equal(ai.checkingClockwise, firstHand, 'held');
  assert.equal(ai.checkingClockwiseTimer, 3, 'and the timer is not refilled');

  // once it runs out, the SECOND visit flips rather than re-choosing
  ai.checkingClockwiseTimer = 0;
  ai._findDetour(NORTH);
  assert.equal(ai.checkingClockwise, !firstHand, 'flipped');
  assert.equal(ai.didClockwiseCheck, false);
  assert.equal(ai.checkingClockwiseTimer, DETOUR_CLOCKWISE_TIMER);

  // two seconds clear of trouble resets the whole choice
  ai.checkingClockwiseTimer = 4;
  ai._clock = 100 + DETOUR_UNSTUCK_RESET + 0.01;
  ai._findDetour(NORTH);
  assert.equal(ai.didClockwiseCheck, true, 'a fresh choice was made');
});

test('audit24 wave34: boxed in, the sweep gives up after eight probes', () => {
  // Four walls: nothing is clear, so the do/while runs to `count > 7`
  // and the LAST probe is used whether it was clear or not.
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  for (const [k, m] of [
    ['n', [-2, 0, 0.3, 2, 0, 0.3, 2, 4, 0.3, -2, 4, 0.3]],
    ['s', [-2, 0, -0.3, 2, 0, -0.3, 2, 4, -0.3, -2, 4, -0.3]],
    ['e', [0.3, 0, -2, 0.3, 0, 2, 0.3, 4, 2, 0.3, 4, -2]],
    ['w', [-0.3, 0, -2, -0.3, 0, 2, -0.3, 4, 2, -0.3, 4, -2]],
  ]) c.addMesh(k, new Float32Array(m), quadIdx, I);
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.1 });
  ai.destination = [0, 0, 20];
  ai._clock = 50;
  ai.lastTimeWasStuck = 50;
  ai._findDetour(NORTH);
  assert.equal(ai.avoidObstaclesTimer, DETOUR_TIMER, 'it still commits to something');
  assert.ok(ai.obstacleDetected || ai.fallDetected, 'having found nowhere clear');
  // AND THE QUIRK THE BOUND PRODUCES. `angle` starts at 0 and moves 45
  // degrees per probe; the eighth probe is therefore a FULL 360, which
  // is dir2d again - so a boxed-in foe commits to walking two units
  // STRAIGHT INTO the thing that blocked it, and comes straight back
  // here 0.75 seconds later. That is DFU's, not the port's: raise the
  // bound and the last probe lands on a different angle entirely.
  const centre = [ai.feet[0], ai.feet[1] + ai.height / 2, ai.feet[2]];
  const dx = ai.detourDestination[0] - centre[0];
  const dz = ai.detourDestination[2] - centre[2];
  assert.ok(Math.abs(Math.hypot(dx, dz) - DETOUR_REACH) < 1e-6, 'two units out');
  assert.ok(Math.abs(dx - NORTH[0] * DETOUR_REACH) < 1e-6 && Math.abs(dz - NORTH[2] * DETOUR_REACH) < 1e-6,
    'and along the ORIGINAL heading - the eighth 45-degree step is a full circle');
});

test('audit24 wave34: the detour is COMMITTED - it overrides the stop distance and cuts short on arrival', () => {
  const ai = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  ai.detected = true;
  ai.giveUpTimer = 200;   // AUDIT 26 F014: the refill lives in _step now
  ai.inSight = true;
  ai._dist = 0.5;                       // well inside melee range
  // wave 35: HandleNoAction (:357-366) refuses to act at all until the
  // target has a known position, so the fixture must have seen it.
  ai.lastKnownTargetPos = [0, 0, 0.5];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.avoidObstaclesTimer = DETOUR_TIMER;
  ai.detourDestination = [0, 0, 5];
  ai._classicTick([0, 0, 0.5]);
  assert.equal(ai.moving, true, 'if detouring, always attempt to move (:481-484 - behind the ranged arms since AUDIT 26 F011, but still ahead of the stop test)');
  assert.deepEqual(ai.destination, [0, 0, 5], 'and it steers at the detour, not the target');

  // UpdateTimers zeroes the timer inside 0.3 of the destination,
  // measured in the horizontal plane only (the y is overwritten).
  const near = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  near.avoidObstaclesTimer = DETOUR_TIMER;
  near.detourDestination = [0, 99, 0.2];
  near._updateDetourTimers(1 / 60, true);
  assert.equal(near.avoidObstaclesTimer, 0, 'arrived - the height difference is ignored');

  const far = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  far.avoidObstaclesTimer = DETOUR_TIMER;
  far.detourDestination = [0, 0, 0.5];
  far._updateDetourTimers(1 / 60, true);
  assert.ok(far.avoidObstaclesTimer > 0, 'not yet');
  // ":399 - only bother checking if possible to move". A paralysed or
  // knocked-back foe sitting ON its detour destination keeps the timer.
  const held = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  held.avoidObstaclesTimer = DETOUR_TIMER;
  held.detourDestination = [0, 0, 0.2];   // well inside the 0.3
  held._updateDetourTimers(1 / 60, false);
  assert.ok(Math.abs(held.avoidObstaclesTimer - (DETOUR_TIMER - 1 / 60)) < 1e-9,
    'a foe that cannot act only decays, it never arrives');
  held._updateDetourTimers(1 / 60, true);
  assert.equal(held.avoidObstaclesTimer, 0, '...and arrives the moment it can');
});

test('audit24 wave34: the walk-base cycle is broken, one home and one direction', () => {
  // The first module-level use of CAPSULE_RADIUS in enemyMotor.js turned
  // a latent import cycle into a ReferenceError across twelve test
  // files: motor.js imported DF_WALK_BASE from enemyMotor.js while
  // enemyMotor.js imported the capsule constants from motor.js.
  const motor = rd('src/player/motor.js');
  const enemy = rd('src/characters/enemyMotor.js');
  assert.ok(motor.includes('export const DF_WALK_BASE = 150;'), 'the home is motor.js, beside DF_CROUCH_BASE');
  assert.equal(/from '\.\.\/characters\/enemyMotor\.js'/.test(motor), false, 'motor.js imports nothing from enemyMotor.js');
  assert.ok(enemy.includes("import { CAPSULE_HEIGHT, CAPSULE_RADIUS, DF_WALK_BASE } from '../player/motor.js';"),
    'and the edge runs one way');
  assert.equal((`${motor}${enemy}`.match(/^export const DF_WALK_BASE = /gm) ?? []).length, 1, 'declared once');
});

test('audit24 wave34: every pool inherits the probe, because it lives in the AI', () => {
  // The whole point of putting it in EnemyAI: the three pools construct
  // one and get the law without a line each.
  const enemy = rd('src/characters/enemyMotor.js');
  for (const m of ['_obstacleCheck(dir)', '_fallCheck(dir)', '_findDetour(dir2d', '_updateDetourTimers(dt, canAct)']) {
    assert.ok(enemy.includes(m), `${m} is on the AI`);
  }
  // ...and each of the three movement branches probes before it moves
  const step = enemy.slice(enemy.indexOf('  _step(dt, playerFeet, senses, paralyzed = false, paused = false) {'));
  assert.equal((step.match(/this\._obstacleCheck\(/g) ?? []).length, 3, 'swimmer, flyer, grounded');
  assert.equal((step.match(/this\._fallCheck\(/g) ?? []).length, 3);
  assert.equal((step.match(/if \(this\.fallDetected \|\| this\.obstacleDetected\)/g) ?? []).length, 3,
    'and each move is the ELSE arm of the probe, as :989-996');
  // the dungeon host answers the door question; the exterior pools do not have one
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/isActionDoor,\s+\/\/ wave 34/g) ?? []).length, 2,
    'BOTH dungeon foe constructions resolve door keys - the class branch and the monster branch');
  assert.ok(dc.includes('const isActionDoor = (key) => {'), 'through the host registry OpenDoors already reads');
  assert.equal(MELEE_DISTANCE, 2.25);
});
