// DRUNK2 (2026-10-17, asked for: "I want more of a beer goggle effect at higher levels, along with less control over
// your character") - LESS CONTROL, THE DRINK'S HAND ON THE BODY (src/systems/survival/drunkFeel.js, src/player/lookFilter.js).
// Three things the higher levels now do beside the goggles: the look LAGS (lookFilter's smoothing floor, a provider
// seam like the pitch floor's, answered by the game's one feel), the walk WEAVES (a steady side-to-side push across
// the walk, the motor's blow push set each frame, never in the half-gap after a stumble), and the stumbles WORSEN
// (twice the rate and a goggles' share more speed at full). Pinned here with exact values: the camera's yaw after a
// tick against lookFilter's own frameSmoothing, the weave's push against the table, the boundaries of the quiet window.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDrunkFeel, drunkFeel, drunkLookFloor, lookSmoothingAt, weaveAt, stumbleRateAt, stumbleSpeedAt, stumbleChance, gogglesAt, drunkStateOf,
  LOOK_LAG, WEAVE, STUMBLE_RATE, STUMBLE_SPEED, STUMBLE_GAP_S, FEEL_FLOOR, DRUNK_FEEL_PREF, OUTSIDE_PUSH_EPS, MOTOR_PUSH_DECAY,
} from '../../../src/systems/survival/drunkFeel.js';
import { drunkVisions } from '../../../src/systems/survival/drunkVisions.js';
import { drunkSigns } from '../../../src/systems/survival/drunkSigns.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { PlayerMotor, BLOW_PUSH_DECAY } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import {
  LookFilter, frameSmoothing, setLookSmoothingFloor, lookSmoothingFloor, takeFrameLook, SMOOTHING_MAX,
} from '../../../src/player/lookFilter.js';
import { getFloat } from '../../../src/systems/settings/settings.js';
import { tavernDrink } from '../../../src/systems/survival/tavernMenu.js';
import { survivalOf } from '../../../src/systems/survival/needs.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';

// The game's own provider is put back (a test that sets another must not leave the game's feel unheard) and its one
// feel sobered, as drunk1_speech.test.js does.
afterEach(() => {
  _resetForTests();
  setLookSmoothingFloor(drunkLookFloor);
  drunkFeel.frame(10, { entity: { survival: { drunk: 0 } } });
  takeFrameLook();
});

const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A drinker at the bar (drunk1_feel.test.js's): the record the minute law mints, the counter raised by the tavern's own pour. */
const drinker = (cups = [], endurance = 50) => {
  const p = { isPlayer: true, health: 40, maxHealth: 40, fatigue: 100, magicka: 10, maxMagicka: 20, stats: { ...STATS, endurance }, activeEffects: [], items: [] };
  const s = survivalOf(p, 0);
  for (const strength of cups) tavernDrink(s, strength, { endurance });
  return p;
};
/** A walker the motor would make (drunk1_feel.test.js's): on the ground, moving, turned by `moveYaw`, its pushes recorded. */
const walker = (over = {}) => ({
  grounded: true, jumping: false, swimming: false, levitating: false, riding: false, climb: null, freezeMotor: 0,
  moveForward: 1, moveStrafe: 0, moveYaw: 0, pushes: [], isDown: () => false,
  blowPush(vx, vz) { this.pushes.push([vx, vz]); }, ...over,
});
/** A push rounded to a nanometre a second, and a zero's sign dropped (the right vector flips a sign through -0). */
const round = ([x, z]) => [Math.round(x * 1e9) / 1e9 + 0, Math.round(z * 1e9) / 1e9 + 0];
/** The push the weave makes across a walk turned by `yaw`, at a lateral `speed`: HANDEDNESS (mat4's law), right = (cos, 0, -sin). */
const across = (yaw, speed) => round([Math.cos(yaw) * speed, -Math.sin(yaw) * speed]);

/** One look owed a full radian, ticked once on a 60 Hz frame: the camera's yaw after (1 - the frame's smoothing of the radian). */
const DT = 1 / 60;
const yawAfter = (opts) => {
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  f.add(1, 0);
  f.tick(DT, cam, opts);
  return cam.yaw;
};
const owed = (smoothing) => 1 * (1 - frameSmoothing(smoothing, DT));

test('DRUNK2: the look\'s smoothing floor - nothing set is the setting\'s own, a provider raises a lower factor, never past SMOOTHING_MAX, and a handed factor is raised too', () => {
  const setting = getFloat('Controls', 'MouseLookSmoothingFactor', 0, SMOOTHING_MAX);
  assert.ok(setting < 0.7, 'the shipped factor sits under the floors tried below');

  setLookSmoothingFloor(null);
  assert.equal(lookSmoothingFloor(), 0);
  assert.equal(yawAfter(undefined), owed(setting), 'no provider: the setting, as before');
  assert.equal(yawAfter({ smoothing: 0.2 }), owed(0.2));
  assert.equal(yawAfter({ smoothing: 0 }), 1, 'no smoothing, no floor: the whole look at once');

  for (const none of [() => 0, () => -1, () => NaN, () => undefined, () => 'x']) {
    setLookSmoothingFloor(none);
    assert.equal(lookSmoothingFloor(), 0, String(none));
    assert.equal(yawAfter(undefined), owed(setting), `${none}: a floor of nothing leaves the look alone`);
    assert.equal(yawAfter({ smoothing: 0.2 }), owed(0.2));
  }

  setLookSmoothingFloor(() => 0.7);
  assert.equal(lookSmoothingFloor(), 0.7);
  assert.equal(yawAfter(undefined), owed(0.7), 'a floor over the setting raises it');
  assert.equal(yawAfter({ smoothing: 0 }), owed(0.7), 'a factor handed to tick is raised too (the destructured default is no way round it)');
  assert.equal(yawAfter({ smoothing: 0.8 }), owed(0.8), 'a factor over the floor is kept');
  assert.notEqual(owed(0.7), owed(0.5));

  setLookSmoothingFloor(() => 5);
  assert.equal(lookSmoothingFloor(), SMOOTHING_MAX, 'the floor is held to the setter\'s own ceiling');
  assert.equal(yawAfter({ smoothing: 0 }), owed(SMOOTHING_MAX));

  setLookSmoothingFloor(() => 0.88);
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  f.add(1, 0);
  f.tick(DT, cam, { smoothing: 0 });
  assert.equal(f.residualYaw, 1 - cam.yaw, 'the rest is still owed, and paid out on the next frames');
  f.tick(DT, cam, { smoothing: 0 });
  assert.equal(cam.yaw, owed(0.88) + (1 - owed(0.88)) * (1 - frameSmoothing(0.88, DT)));
});

test('DRUNK2: the look\'s lag - nothing sober and at the Drunk line, LOOK_LAG.base just past it, base plus add at full (under SMOOTHING_MAX)', () => {
  assert.deepEqual(LOOK_LAG, { base: 0.55, add: 0.33 });
  assert.ok(Object.isFrozen(LOOK_LAG));
  assert.equal(lookSmoothingAt(0), 0, 'sober');
  assert.equal(lookSmoothingAt(FEEL_FLOOR), 0, 'the Drunk line: the goggles are not on yet, nor is the lag');
  assert.equal(lookSmoothingAt(1), LOOK_LAG.base + LOOK_LAG.add * 1);
  assert.ok(Math.abs(lookSmoothingAt(1) - 0.88) < 1e-12);
  assert.ok(LOOK_LAG.base + LOOK_LAG.add < SMOOTHING_MAX);
  const mid = (FEEL_FLOOR + 1) / 2;   // half way up the goggles' range
  assert.ok(Math.abs(gogglesAt(mid) - 0.5) < 1e-12);
  assert.ok(Math.abs(lookSmoothingAt(mid) - (0.55 + 0.33 * 0.5)) < 1e-12);
  assert.ok(Math.abs(lookSmoothingAt(FEEL_FLOOR + 0.0065) - (0.55 + 0.33 * 0.01)) < 1e-12, 'a hundredth up the range: the base, and a hundredth of the add');
});

test('DRUNK2: the game\'s feel answers the look\'s floor from its eased intensity - nothing sober, the lag at full, nothing with the part off', () => {
  assert.equal(lookSmoothingFloor(), 0, 'sober (the registered provider reads the one feel)');
  assert.equal(yawAfter({ smoothing: 0 }), 1);
  drunkFeel.frame(10, { entity: drinker([25, 25]) });
  assert.equal(drunkFeel.intensity, 1);
  assert.equal(lookSmoothingFloor(), lookSmoothingAt(1));
  assert.equal(yawAfter({ smoothing: 0 }), owed(lookSmoothingAt(1)), 'a drunk head turns slowly into the look');
  drunkFeel.frame(0.7, { entity: drinker([25, 25]), paused: true });
  assert.equal(lookSmoothingFloor(), lookSmoothingAt(1), 'a window holds the lag where it stands');
  setPref(DRUNK_FEEL_PREF, false);
  drunkFeel.frame(10, { entity: drinker([25, 25]) });
  assert.equal(drunkFeel.intensity, 0);
  assert.equal(lookSmoothingFloor(), 0, 'the part off: the look is the setting\'s own');
  assert.equal(yawAfter({ smoothing: 0 }), 1);
});

test('DRUNK2: the weave - a sine of the table, nothing at the Drunk line, the goggles to the 1.5 up to the table\'s speed at full', () => {
  assert.deepEqual(WEAVE, { speed: 1.1, hz: 0.23, phase: 0.6 });
  assert.ok(Object.isFrozen(WEAVE));
  assert.equal(weaveAt(3, 0) + 0, 0);   // + 0: a zero's sign is no weave
  assert.equal(weaveAt(3, FEEL_FLOOR) + 0, 0, 'the Drunk line: no weave');
  assert.equal(weaveAt(0, 1), WEAVE.speed * Math.sin(WEAVE.phase));
  const peak = (0.25 - WEAVE.phase / (2 * Math.PI)) / WEAVE.hz;   // the clock the sine crests at
  assert.ok(Math.abs(weaveAt(peak, 1) - 1.1) < 1e-12, 'a crest is the table\'s speed');
  assert.ok(Math.abs(weaveAt(peak, 1) + weaveAt(peak + 1 / (2 * WEAVE.hz), 1)) < 1e-12, 'and a half period on, the same lean the other way');
  const mid = (FEEL_FLOOR + 1) / 2;
  assert.ok(Math.abs(weaveAt(peak, mid) - 1.1 * Math.pow(0.5, 1.5)) < 1e-12, 'half way up the range: the goggles (a half) to the 1.5');
});

test('DRUNK2: a drunk walker weaves - the blow push across the walk (the right vector), set each frame, at the table\'s lateral speed', () => {
  const feel = createDrunkFeel({ rng: () => 0.99 });   // never a stumble
  const p = drinker([25, 25]);
  const w = walker({ moveYaw: 0.7 });
  feel.frame(2, { entity: p, player: w });   // eases to the full intensity (0.5 a second): the clock reads 2
  assert.equal(feel.intensity, 1);
  assert.equal(w.pushes.length, 1);
  assert.deepEqual(round(w.pushes[0]), across(0.7, 1.1 * Math.sin(2 * Math.PI * 0.23 * 2 + 0.6)));
  feel.frame(DT, { entity: p, player: w });
  assert.equal(w.pushes.length, 2, 'every frame: the motor decays a push, so it is set again to hold the speed');
  assert.deepEqual(round(w.pushes[1]), across(0.7, 1.1 * Math.sin(2 * Math.PI * 0.23 * (2 + DT) + 0.6)));
  // yaw 0 walks along -z: the weave is along x (the right vector (cos, 0, -sin)), none along z
  const face = walker({ moveYaw: 0 });
  const f2 = createDrunkFeel({ rng: () => 0.99 });
  f2.frame(2, { entity: p, player: face });
  assert.deepEqual(round(face.pushes[0]), across(0, 1.1 * Math.sin(2 * Math.PI * 0.23 * 2 + 0.6)));
  assert.equal(face.pushes[0][1] + 0, 0);
});

test('DRUNK2: no weave standing still, off the ground, in the saddle, in the water, on a wall, at the Drunk line, under a window - or with the part off', () => {
  const p = drinker([25, 25]);
  for (const over of [{ moveForward: 0, moveStrafe: 0 }, { grounded: false }, { riding: true }, { swimming: true }, { levitating: true }, { climb: { isClimbing: true } }, { moveYaw: NaN }]) {
    const feel = createDrunkFeel({ rng: () => 0.99 });
    const w = walker(over);
    feel.frame(2, { entity: p, player: w });
    assert.equal(w.pushes.length, 0, JSON.stringify(over));
  }
  // the Drunk line: seven tenths of a second at the ease's half a second is exactly FEEL_FLOOR, where gogglesAt is 0
  const line = createDrunkFeel({ rng: () => 0.99 });
  const w0 = walker();
  line.frame(0.7, { entity: p, player: w0 });
  assert.equal(line.intensity, FEEL_FLOOR);
  assert.equal(w0.pushes.length, 0, 'at the Drunk line the walk is steady');
  line.frame(DT, { entity: p, player: w0 });
  assert.equal(w0.pushes.length, 1, 'and a frame more of the drink weaves');
  // a window holds the whole thing
  const held = createDrunkFeel({ rng: () => 0.99 });
  const w1 = walker();
  held.frame(2, { entity: p, player: w1 });
  held.frame(1, { entity: p, player: w1, paused: true });
  assert.equal(w1.pushes.length, 1, 'paused: no further push');
  // the part off
  setPref(DRUNK_FEEL_PREF, false);
  const off = createDrunkFeel({ rng: () => 0.99 });
  const w2 = walker();
  off.frame(2, { entity: p, player: w2 });
  assert.equal(w2.pushes.length, 0);
  assert.equal(off.intensity, 0);
});

test('DRUNK2: the weave never overwrites a stumble - none in the half-gap after one (the boundary included), the next frame past it', () => {
  const feel = createDrunkFeel({ rng: () => 0 });   // every roll stumbles, to the left
  const p = drinker([25, 25]);
  const w = walker();
  let t = 0;
  const step = (dt) => { t += dt; feel.frame(dt, { entity: p, player: w }); };
  step(3);   // the stumble
  assert.equal(w.pushes.length, 1);
  assert.deepEqual(round(w.pushes[0]), [-5, 0], 'the full drink\'s lurch: base, intensity and goggles shares');
  step(STUMBLE_GAP_S / 4);
  assert.equal(w.pushes.length, 1, 'a quarter gap on: the lurch is still in the motor');
  step(STUMBLE_GAP_S / 4);
  assert.equal(w.pushes.length, 1, 'exactly half the gap on: still the stumble\'s, no weave yet');
  step(0.01);
  assert.equal(w.pushes.length, 2, 'past the half gap, before the next stumble can come: the weave');
  assert.deepEqual(round(w.pushes[1]), across(0, weaveAt(t, 1)));
  assert.notDeepEqual(round(w.pushes[1]), round(w.pushes[0]));
  step(STUMBLE_GAP_S);
  assert.equal(w.pushes.length, 3, 'a gap later the next stumble, and the weave not on top of it in that frame');
  assert.deepEqual(round(w.pushes[2]), [-5, 0]);
});

test('DRUNK2: the stumbles worsen - twice the rate at full, the goggles\' share more speed, the Drunk line as it was', () => {
  assert.equal(STUMBLE_SPEED.perGoggles, 1.5);
  assert.equal(stumbleRateAt(0), 0);
  assert.equal(stumbleRateAt(FEEL_FLOOR), STUMBLE_RATE * FEEL_FLOOR, 'at the Drunk line: the first drink\'s rate');
  assert.equal(stumbleRateAt(1), 0.6, 'full: twice STUMBLE_RATE a second');
  const mid = (FEEL_FLOOR + 1) / 2;
  assert.ok(Math.abs(stumbleRateAt(mid) - 0.3 * mid * 1.5) < 1e-12);
  assert.equal(stumbleChance(0.5, 1), 1 - Math.exp(-0.3));
  assert.equal(stumbleChance(1, FEEL_FLOOR), 1 - Math.exp(-STUMBLE_RATE * FEEL_FLOOR));
  assert.equal(stumbleChance(1, 0), 0);
  assert.equal(stumbleChance(0, 1), 0);
  assert.equal(stumbleSpeedAt(1), 1.5 + 2 * 1 + 1.5 * 1);
  assert.equal(stumbleSpeedAt(1), 5);
  assert.ok(Math.abs(stumbleSpeedAt(FEEL_FLOOR) - (1.5 + 2 * FEEL_FLOOR)) < 1e-12, 'at the Drunk line no goggles\' share');
  assert.ok(Math.abs(stumbleSpeedAt(mid) - (1.5 + 2 * mid + 1.5 * 0.5)) < 1e-12);
});

test('AUDIT DRUNK2: the motor reports its push\'s speed, read only - the hypot of the push, none at rest, set by a blow, gone with a knockdown', () => {
  const motor = new PlayerMotor(new Collider(() => 0));
  assert.equal(motor.pushSpeed, 0);
  motor.blowPush(3, 4);
  assert.equal(motor.pushSpeed, 5);
  motor.blowPush(-1.5, 0);
  assert.equal(motor.pushSpeed, 1.5, 'the push is one assigned value: a sign does not matter');
  assert.equal(Object.getOwnPropertyDescriptor(PlayerMotor.prototype, 'pushSpeed')?.set, undefined, 'a getter and no setter');
  motor.blowKnockDown(1, 0.4);
  assert.equal(motor.pushSpeed, 0, 'a knockdown takes the push with it');
});

/** A walker the way the motor really is: `pushSpeed` is the hypot of what the last blowPush set, the motor decaying it between frames. */
function motorWalker(over = {}) {
  const w = walker(over);
  let speed = 0;
  w.blowPush = function (vx, vz) { this.pushes.push([vx, vz]); speed = Math.hypot(vx, vz); };
  Object.defineProperty(w, 'pushSpeed', { get: () => speed });
  w.setSpeed = (s) => { speed = s; };   // an outside blow's knockback, as systems/blowEffects.js sets it
  w.decay = (dt) => { speed = Math.max(0, speed - 12 * dt); };   // the motor's BLOW_PUSH_DECAY
  return w;
}

test('AUDIT DRUNK2: the weave leaves a knockback to play out - no weave and no stumble while the motor\'s push is faster than the feel\'s own, the weave back once it has decayed', () => {
  const p = drinker([25, 25]);
  const feel = createDrunkFeel({ rng: () => 0.99 });   // never a stumble: the weave alone
  const w = motorWalker({ moveYaw: 0.7 });
  let clock = 2;
  const step = () => { clock += DT; feel.frame(DT, { entity: p, player: w }); };
  feel.frame(2, { entity: p, player: w });
  assert.equal(w.pushes.length, 1, 'the weave sets its push');
  // the feel's own pushes are not mistaken for a knockback: the motor decays them, and the next frames weave on
  for (let i = 0; i < 5; i++) { w.decay(DT); step(); }
  assert.equal(w.pushes.length, 6, 'five more frames, five more weaves: its own push is never "outside"');
  // an enemy blow lands: a 4 m/s knockback, faster than the weave ever sets (1.1)
  w.setSpeed(4);
  for (let i = 0; i < 4; i++) { step(); w.decay(DT); }
  assert.equal(w.pushes.length, 6, 'the knockback plays out whole: nothing overwrites it');
  assert.ok(w.pushSpeed > 3, 'and it is the knockback still in the motor');
  // a hair over the epsilon (the feel set nothing while it waited): still the knockback's
  w.setSpeed(OUTSIDE_PUSH_EPS + 0.01);
  step();
  assert.equal(w.pushes.length, 6, 'a knockback not quite spent is still the knockback\'s');
  // spent: the weave is back
  w.setSpeed(OUTSIDE_PUSH_EPS);
  step();
  assert.equal(w.pushes.length, 7, 'decayed to the epsilon: the weave resumes');
  assert.deepEqual(round(w.pushes[6]), across(0.7, weaveAt(clock, 1)), 'at the table\'s lean for the clock it has reached (the clock ran on while it waited)');

  // no stumble over a knockback either: a feel that stumbles on every roll still does not, while it plays out
  const lurch = createDrunkFeel({ rng: () => 0 });
  const v = motorWalker();
  lurch.frame(3, { entity: p, player: v });   // the first lurch
  assert.equal(v.pushes.length, 1);
  for (let i = 0; i < 14; i++) { v.decay(0.1); lurch.frame(0.1, { entity: p, player: v }); }   // 1.4 s on: the lurch spent in the motor, the gap not yet
  assert.equal(v.pushes.length, 8, 'the lurch, then the weave from the half gap on (seven frames), no second stumble before the gap');
  v.setSpeed(4);   // a blow's knockback, with a stumble due on the very next frames
  for (let i = 0; i < 3; i++) { lurch.frame(0.1, { entity: p, player: v }); v.decay(0.1); }
  assert.equal(v.pushes.length, 8, 'no lurch and no weave over a knockback');
  assert.ok(v.pushSpeed > 0.05, 'which is still in the motor');
  v.decay(0.1);   // spent
  lurch.frame(0.1, { entity: p, player: v });
  assert.equal(v.pushes.length, 9, 'and the lurch the frame it is spent');
  assert.deepEqual(round(v.pushes[8]), [-5, 0]);
  assert.equal(MOTOR_PUSH_DECAY, BLOW_PUSH_DECAY, 'the decay the feel credits its own push is the motor\'s');
});

test('AUDIT DRUNK2: a body with no pushSpeed (the walker fixture) weaves as it did, and the feel\'s own stumble is not an outside push to the frames after it', () => {
  const p = drinker([25, 25]);
  const feel = createDrunkFeel({ rng: () => 0.99 });
  const w = walker();   // no pushSpeed at all
  assert.equal('pushSpeed' in w, false);
  feel.frame(2, { entity: p, player: w });
  feel.frame(DT, { entity: p, player: w });
  assert.equal(w.pushes.length, 2, 'as before');
  // a stumble the feel set itself (5 m/s), the motor having spent it by the time the half gap is past: the weave follows
  const lurch = createDrunkFeel({ rng: () => 0 });
  const m = motorWalker();
  lurch.frame(3, { entity: p, player: m });
  assert.equal(m.pushSpeed, 5);
  m.decay(STUMBLE_GAP_S * 0.6);
  lurch.frame(STUMBLE_GAP_S * 0.6, { entity: p, player: m });
  assert.equal(m.pushes.length, 2, 'the weave follows its own stumble past the half gap');
});

const SOBER_ENTITY = () => ({ survival: { drunk: 0 } });
const veryDrunk = () => drinker([25, 25]);
/** A drinker at a chosen counter (the endurance is 50: Drunk is past 25, Very drunk past 40). */
const at = (drunk) => { const e = drinker(); e.survival.drunk = drunk; return e; };

test('AUDIT DRUNK2: a feel tells its listeners each change of band - (band, previous), once a change, under a window too, until they stop listening', () => {
  const feel = createDrunkFeel({ rng: () => 0.99 });
  const heard = [];
  const off = feel.onBand((band, previous) => heard.push([band, previous]));
  feel.frame(DT, { entity: SOBER_ENTITY() });
  assert.deepEqual(heard, [], 'sober to sober is no change');
  feel.frame(DT, { entity: at(30) });
  feel.frame(DT, { entity: at(31) });
  assert.deepEqual(heard, [['drunk', 'sober']], 'one change, not one a frame');
  feel.frame(DT, { entity: at(45) });
  assert.deepEqual(heard.at(-1), ['veryDrunk', 'drunk']);
  feel.frame(DT, { entity: at(45) });
  feel.frame(DT, { entity: veryDrunk() });   // another entity, the same band
  assert.equal(heard.length, 2, 'a new entity in the same band is no change');
  feel.frame(1, { entity: SOBER_ENTITY(), paused: true });
  assert.deepEqual(heard.at(-1), ['sober', 'veryDrunk'], 'a band that changes under a window is heard in it');
  feel.frame(0, { entity: at(45) });
  assert.deepEqual(heard.at(-1), ['veryDrunk', 'sober'], 'and a frame of no time counts');
  off();
  feel.frame(DT, { entity: SOBER_ENTITY() });
  assert.equal(heard.length, 4, 'a listener that stopped listening hears no more');
  // two listeners hear it, in the order they came
  const order = [];
  const a = feel.onBand(() => order.push('a')), b = feel.onBand(() => order.push('b'));
  feel.frame(DT, { entity: at(30) });
  assert.deepEqual(order, ['a', 'b']);
  a(); b();
  // with the arc Off nothing is drunk: the band reads sober whatever an old counter holds
  const offFeel = createDrunkFeel({ on: () => false });
  const none = []; offFeel.onBand((band) => none.push(band));
  offFeel.frame(DT, { entity: at(45) });
  assert.deepEqual(none, []);
  // a sober read is the one frozen answer - a sober frame allocates none
  assert.strictEqual(drunkStateOf(SOBER_ENTITY()), drunkStateOf(null));
  assert.ok(Object.isFrozen(drunkStateOf(null)));
});

test('AUDIT DRUNK2: a binge ends when the band does, not when something is drawn - very drunk, sober, very drunk with no foe and no street between turns both counters', () => {
  drunkSigns.reset();
  drunkFeel.frame(DT, { entity: SOBER_ENTITY() });
  const v0 = drunkVisions.binge, s0 = drunkSigns.binge;
  // the town the signs read: one building, so a pick is held while the binge lasts
  drunkSigns.provide({ town: () => 4242, buildings: () => [{ buildingKey: 77, buildingType: BUILDING_TYPES.Bank }] });

  drunkFeel.frame(DT, { entity: veryDrunk() });
  assert.equal(drunkSigns.binge, s0 + 1, 'into very drunk: the signs\' binge begins with no draw');
  assert.equal(drunkVisions.binge, v0, 'and the visions\' is under way, not yet over');
  assert.deepEqual([...drunkSigns.current().keys], [77]);
  assert.ok(drunkSigns.held > 0, 'the binge holds its pick');
  const first = drunkSigns.current();

  drunkFeel.frame(DT, { entity: SOBER_ENTITY() });   // sobered up indoors: no street, no foe, nothing asks either
  assert.equal(drunkSigns.held, 0, 'the signs let go of the binge\'s picks the frame the band drops, unasked');
  assert.equal(drunkVisions.binge, v0 + 1, 'the visions\' binge is over');
  drunkFeel.frame(DT, { entity: veryDrunk() });
  assert.equal(drunkSigns.binge, s0 + 2, 'drinking again is a new binge of signs');
  assert.equal(drunkVisions.binge, v0 + 1, 'and the visions\' one under way');
  assert.notStrictEqual(drunkSigns.current(), first, 'a fresh answer, not the old binge\'s');

  // a band that changes under a window counts the same
  drunkFeel.frame(1, { entity: SOBER_ENTITY(), paused: true });
  assert.equal(drunkVisions.binge, v0 + 2, 'paused: the binge still ends');
  assert.equal(drunkSigns.held, 0);
  drunkFeel.frame(1, { entity: veryDrunk(), paused: true });
  assert.equal(drunkSigns.binge, s0 + 3);
  // merely Drunk is no binge: down to the Drunk line ends it and begins nothing
  drunkFeel.frame(DT, { entity: at(30) });
  assert.equal(drunkVisions.binge, v0 + 3);
  assert.equal(drunkSigns.binge, s0 + 3);
  // a load: a different entity object in another band is the same change
  drunkFeel.frame(DT, { entity: veryDrunk() });
  assert.equal(drunkSigns.binge, s0 + 4, 'a new character who is very drunk after a Drunk one');
  drunkFeel.frame(DT, { entity: SOBER_ENTITY() });
  drunkSigns.reset();
});
