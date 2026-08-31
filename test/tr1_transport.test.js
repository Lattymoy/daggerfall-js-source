import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRANSPORT_MODES, DF_RIDE_BASE, DF_CART_BASE, HORSE_ITEM_INDEXES,
  hasHorse, hasCart, isOnFoot, isRiding, toggleMount, rideBaseFor,
  canRunUnlessRiding, dismountOnTransition,
} from '../src/systems/transport.js';
import { SMALL_CART_TEMPLATE, TRANSPORT_HORSE_TEMPLATE } from '../src/systems/inventorySession.js';
import {
  PlayerMotor, rideSpeed, runSpeed, walkSpeed, crouchSpeed, DF_WALK_BASE,
  EYE_HEIGHT, RIDE_EYE_HEIGHT, RIDE_HEIGHT, CAPSULE_HEIGHT, HEIGHT_TIMER_FAST, HEIGHT_TIMER_MEDIUM,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

// TR1 - THE TRANSPORT MODE: TransportManager's mode half, plus the laws
// that read it in PlayerSpeedChanger, PlayerEntity and ClimbingMotor.
// The port carried the cart as an inventory fact and the horse as an
// item nobody could sit on - motor.js passed `riding: false` with the
// note "the transport arc pends".

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const horse = { group: 'Transportation', templateIndex: TRANSPORT_HORSE_TEMPLATE };
const cart = { group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE };

test('TR1: the modes, the two ride bases, and the ownership tests', () => {
  assert.deepEqual({ ...TRANSPORT_MODES }, { Foot: 'Foot', Horse: 'Horse', Cart: 'Cart', Ship: 'Ship' });
  assert.equal(DF_RIDE_BASE, DF_WALK_BASE + 225, 'dfRideBase = dfWalkBase + 225 (:33)');
  assert.equal(DF_CART_BASE, DF_WALK_BASE + 100, 'dfCartBase = dfWalkBase + 100 (:34)');
  assert.deepEqual([...HORSE_ITEM_INDEXES], [TRANSPORT_HORSE_TEMPLATE], 'horseItemIndexes seeded with Transportation.Horse (:72)');
  // ONE HOME (AUDIT 24's ratchet, which caught this slice's first cut):
  // hasHorse/hasCart are inventorySession's, re-exported here.
  assert.match(readFileSync(join(root, 'src/systems/transport.js'), 'utf8'), /export \{ hasCart, hasHorse \};/);
  assert.equal(hasHorse([cart]), false); assert.equal(hasHorse([horse, cart]), true);
  assert.equal(hasCart([horse]), false); assert.equal(hasCart([cart]), true);
  assert.equal(hasHorse([]), false); assert.equal(hasCart(null), false);
  assert.equal(isOnFoot(TRANSPORT_MODES.Foot), true);
  assert.equal(isRiding(TRANSPORT_MODES.Horse), true);
  assert.equal(isRiding(TRANSPORT_MODES.Cart), true);
  assert.equal(isRiding(TRANSPORT_MODES.Ship), false, 'Ship is "not a real player transport mode"');
});

test('TR1: ToggleMount - mounted dismounts; on foot the HORSE wins over the cart; with neither the mode is unchanged (:113-127)', () => {
  const F = TRANSPORT_MODES.Foot, H = TRANSPORT_MODES.Horse, C = TRANSPORT_MODES.Cart;
  assert.equal(toggleMount(F, [horse, cart]), H, 'the horse is preferred');
  assert.equal(toggleMount(F, [cart]), C);
  assert.equal(toggleMount(F, [horse]), H);
  assert.equal(toggleMount(F, []), F, 'no else arm: nothing to mount, no change');
  // ...and the SHIP mode is not a foot mode: a toggle from it with
  // nothing owned leaves it alone rather than dropping to Foot, which
  // is what "no else arm" means and what a Foot fallback would break.
  assert.equal(toggleMount(TRANSPORT_MODES.Ship, []), TRANSPORT_MODES.Ship);
  assert.equal(toggleMount(H, [horse]), F, 'mounted dismounts');
  assert.equal(toggleMount(C, [cart]), F);
  // Dismounting does not depend on still owning the animal.
  assert.equal(toggleMount(H, []), F);
});

test('TR1: the ride speeds - the cart is slower, neither takes the walk drag, and RIDING HAS NO RUN BONUS BASE (:156-160, :402-408)', () => {
  const spd = 50, running = 40;
  assert.ok(near(rideSpeed(spd, DF_RIDE_BASE), (spd + DF_RIDE_BASE) / 39.5));
  assert.ok(rideSpeed(spd, DF_RIDE_BASE) > rideSpeed(spd, DF_CART_BASE), 'a horse beats a cart');
  assert.ok(rideSpeed(spd, DF_CART_BASE) > walkSpeed(spd), 'and a cart beats walking');
  // The walk drag is walkSpeed's own term; the ride arm does not take it.
  assert.ok(rideSpeed(spd, DF_RIDE_BASE) > (spd + DF_RIDE_BASE - 25) / 39.5);
  // GetRunSpeed's riding arm: baseRunSpeed IS baseSpeed.
  assert.ok(near(runSpeed(spd, running, false, DF_RIDE_BASE), rideSpeed(spd, DF_RIDE_BASE) * (1.35 + running / 200)));
  assert.ok(near(runSpeed(spd, running, true, DF_RIDE_BASE), rideSpeed(spd, DF_RIDE_BASE) * (1.35 + running / 200)), 'the ride base wins over crouch INSIDE GetRunSpeed (:404-407 tests riding first)');
  assert.ok(near(runSpeed(spd, running, false, null), (spd + DF_WALK_BASE) / 39.5 * (1.35 + running / 200)), 'on foot, unchanged');
  assert.equal(rideBaseFor(TRANSPORT_MODES.Cart), DF_CART_BASE);
  assert.equal(rideBaseFor(TRANSPORT_MODES.Horse), DF_RIDE_BASE);
});

test('TR1: CanRunUnlessRiding, the climb gate, and the transition dismount', () => {
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Foot), true);
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false);
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Cart), false);
  for (const t of ['ToBuildingInterior', 'ToDungeonInterior']) {
    assert.equal(dismountOnTransition(TRANSPORT_MODES.Horse, t), TRANSPORT_MODES.Foot, t);
  }
  // Anything else leaves the mode alone - DFU's handler has no arm for
  // leaving, so you walk OUT on foot rather than remounting.
  for (const t of ['ToDungeonExterior', 'ToBuildingExterior', undefined]) {
    assert.equal(dismountOnTransition(TRANSPORT_MODES.Horse, t), TRANSPORT_MODES.Horse, String(t));
  }
});

test('TR1: the motor rides - the mount\'s speed, no sprint, no climb, and the crouch arm still wins', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col, { speed: 50, running: 40, agility: 50, strength: 50, endurance: 50, willpower: 50, swimming: 0, climbing: 0 });
  m.spawn(0, 0.1, 0);
  const still = { forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false };
  for (let f = 0; f < 5; f++) m.update(1 / 60, still, 0);
  assert.equal(m.transportMode, TRANSPORT_MODES.Foot, 'the field starts on foot');
  assert.equal(m.riding, false);
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  const onFoot = m.speed;
  m.transportMode = TRANSPORT_MODES.Horse;
  assert.equal(m.riding, true);
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(m.speed > onFoot, `a horse is faster: ${m.speed} vs ${onFoot}`);
  assert.ok(near(m.speed, rideSpeed(50, DF_RIDE_BASE)));
  m.transportMode = TRANSPORT_MODES.Cart;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, rideSpeed(50, DF_CART_BASE)));
  // Run does not latch while riding.
  m.transportMode = TRANSPORT_MODES.Horse;
  m.update(1 / 60, { ...still, forward: 1, run: true }, 0);
  assert.equal(m.isRunning, false, 'CanRunUnlessRiding');
  assert.ok(near(m.speed, rideSpeed(50, DF_RIDE_BASE)), 'so the speed is the ride speed, not the canter');
  // On foot the run latches again and the speed is the run speed.
  m.transportMode = TRANSPORT_MODES.Foot;
  m.update(1 / 60, { ...still, forward: 1, run: true }, 0);
  assert.equal(m.isRunning, true);
  assert.ok(near(m.speed, runSpeed(50, 40, false)));
  // GetBaseSpeed tests CROUCH first: a crouched rider takes the crouch base.
  m.transportMode = TRANSPORT_MODES.Horse;
  m.crouching = true;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, crouchSpeed(50)), 'the DFU order, kept');
});

test('TR1: the wiring - the climb gate, the Horse bob style, and no Running tally from a saddle', () => {
  const motor = read('src/player/motor.js');
  assert.match(motor, /riding: isRiding\(this\.transportMode\),   \/\/ TR1: ClimbingMotor :398/);
  assert.match(motor, /this\.isRunning = !!input\.run && canRunUnlessRiding\(this\.transportMode\);/);
  assert.match(motor, /get riding\(\) \{ return isRiding\(this\.transportMode\); \}/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.match(read(host), /riding: !!player\.riding, levitating:/, `${host}: the Horse bob style (HeadBobber :107)`);
  }
  // PlayerEntity.cs:311 - the two hosts that report the RAW run key
  // need the riding term; world and exterior report the motor's own
  // isRunning, which the gate above already covers.
  for (const host of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(read(host), /running: held\(keys, 'Run'\) && moving && !player\.riding,/, `${host}: no Running tally while mounted`);
  }
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /running: player\.isRunning && !player\.standing,/, `${host}: the motor's own flag, already gated`);
  }
});

test('TR-AUDIT F-E2/F-E3: the half-speed line follows GetBaseSpeed, and a rider sits a horse tall', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col, { speed: 50, running: 40, agility: 50, strength: 50, endurance: 50, willpower: 50, swimming: 0, climbing: 0 });
  m.spawn(0, 0.1, 0);
  const still = { forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false };
  for (let f = 0; f < 5; f++) m.update(1 / 60, still, 0);
  // F-E3: DoMount raises the eye over timerMedium and clears the crouch.
  const footEye = m.eye[1] - m.pos[1];
  assert.ok(near(footEye, EYE_HEIGHT));
  assert.equal(m.height, CAPSULE_HEIGHT);
  m.crouching = true;
  m.setTransportMode(TRANSPORT_MODES.Horse);
  assert.equal(m.crouching, false, 'PlayerHeightChanger :306 - no crouching on a horse');
  assert.equal(m.heightAction, 'mount');
  assert.ok(near(m.heightTimerMax, HEIGHT_TIMER_MEDIUM), 'timerMedium up');
  m.heightTimer = HEIGHT_TIMER_MEDIUM;
  assert.ok(near(m.eye[1] - m.pos[1], RIDE_EYE_HEIGHT), `a rider's eye: ${m.eye[1] - m.pos[1]}`);
  assert.equal(m.height, RIDE_HEIGHT, 'and his capsule is the horse\'s');
  assert.equal(RIDE_HEIGHT, 2.6);
  // Dismounting falls, and faster.
  m.setTransportMode(TRANSPORT_MODES.Foot);
  assert.equal(m.heightAction, 'dismount');
  assert.ok(near(m.heightTimerMax, HEIGHT_TIMER_FAST), 'timerFast down');
  m.heightTimer = HEIGHT_TIMER_FAST;
  assert.ok(near(m.eye[1] - m.pos[1], EYE_HEIGHT));
  // Setting the SAME mode is not a transition.
  m.heightAction = null;
  m.setTransportMode(TRANSPORT_MODES.Foot);
  assert.equal(m.heightAction, null);
  // F-E2: the half-speed line is half the RIDE speed on a mount, which
  // is what TR2's clop swap and volume halving key off. Before TR1 both
  // GetBaseSpeed branches collapsed to walk/2 and the port said so.
  m.setTransportMode(TRANSPORT_MODES.Horse);
  m.heightTimer = 1;
  const rideHalf = rideSpeed(50, DF_RIDE_BASE) / 2;
  assert.ok(rideHalf > walkSpeed(50) / 2, 'the line moved');
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.equal(m.movingLessThanHalfSpeed, false, 'a horse at speed is over its own half line');
  // THE CASE THAT SEPARATES THE TWO LINES, and the reason the law
  // matters: a SNEAKING rider. sneakSpeed is base/2 - one classic unit,
  // which lands just UNDER half the RIDE speed and well OVER half the
  // walk speed - so under the old walk line a sneaking rider lost the
  // half-speed benefit that DFU gives him.
  m.update(1 / 60, { ...still, forward: 1, sneak: true }, 0);
  assert.equal(m.isSneaking, true, 'a mount can still sneak - only running is barred');
  assert.ok(m.speed < rideHalf && m.speed > walkSpeed(50) / 2, `between the lines: ${m.speed}`);
  assert.equal(m.movingLessThanHalfSpeed, true, 'and he IS moving less than half - his own half');
  // A crouched rider (DFU order) still compares the WALK line.
  m.crouching = true;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.equal(m.movingLessThanHalfSpeed, walkSpeed(50) / 2 >= m.speed);
});
