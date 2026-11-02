// CSA-E (2026-09-27) - COME SAIL AWAY'S SAILS AND WIND: systems/comeSailAway/comeSailAway.js's UpdateWind and its RotateWind
// coroutine, the three events that roll a wind, GetSailPower, raising and lowering (all of them and the square ones),
// Update's sail arm (the sails' Wind, the square sails stowed upwind, the trim, the sails' power and the rudder's turn),
// the manual trim, the wind widget's frame and rect, the rudder's and the door's Animators - over the vendored hulls
// (the real SpawnBoat, its Animators the real world/unityAnimator.js) and a scripted scene. Every expectation is worked
// out here from ComeSailAway.cs's own rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGER_MODEL, animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import {
  BOAT_ACTIONS, WEATHER_TYPE, WIND_WIDGET, windWidgetFrameCount,
  vAngle, vSignedAngle, vRotateTowards, mathfLerp, mathfLerpUnclamped, quatAngleUnity, quatRotateTowards,
} from '../../../src/systems/comeSailAway/comeSailAway.js';
import { quatRotate, quatAngleAxis } from '../../../src/world/quat.js';
import { scene } from '../../csaScene.mjs';   // the scripted scene, one harness (HELM-WAY's suite drives it too)

const f = Math.fround;
const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const near = (a, b, eps = 1e-4, msg = '') => assert.ok(close(a, b, eps), `${msg} ${a} vs ${b}`);
const nearV = (a, b, eps = 1e-4, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => near(v, b[i], eps, `${msg}[${i}]`)); };
const forwardOf = (node) => quatRotate(node.rotation, [0, 0, 1]);
const turnUp = (deg, v) => quatRotate(quatAngleAxis(deg, [0, 1, 0]), v);
const flatNorm = (v) => { const l = Math.hypot(v[0], v[2]); return [v[0] / l, 0, v[2] / l]; };

// ── Unity's arithmetic ────────────────────────────────────────────────────────

test('CSA-E: Vector3.Angle and SignedAngle (2019.4) - degrees in floats, nought under kEpsilonNormalSqrt, the sign by the axis, nought counted positive', () => {
  near(vAngle([1, 0, 0], [0, 0, 1]), 90, 1e-4);
  near(vAngle([1, 0, 0], [-1, 0, 0]), 180, 1e-3);
  assert.equal(vAngle([0, 0, 0], [1, 0, 0]), 0);
  assert.equal(vAngle([1e-8, 0, 0], [1e-8, 0, 0]), 0, 'the product of the squared lengths under 1e-15');
  near(vAngle([1e-4, 0, 0], [0, 0, 1e-4]), 90, 1e-3, 'small vectors above it still have their angle');
  near(vSignedAngle([0, 0, 1], [1, 0, 0], [0, 1, 0]), 90, 1e-4, 'forward to right is +90 about up');
  near(vSignedAngle([0, 0, 1], [-1, 0, 0], [0, 1, 0]), -90, 1e-4);
  assert.equal(vSignedAngle([0, 0, 1], [0, 0, 1], [0, 1, 0]), 0);
  near(vSignedAngle([0, 0, 1], [0, 0, -1], [0, 1, 0]), 180, 1e-3, 'a zero cross is Sign(0): +1');
  assert.equal(mathfLerp(50, 100, 2), 100, 'Lerp clamps');
  assert.equal(mathfLerpUnclamped(100, 0, 2), -100, 'LerpUnclamped does not');
});

test('CSA-E: Vector3.RotateTowards - the direction by at most the radians, the length by at most the magnitude; along, opposite and near nought', () => {
  // the normal case: a quarter turn asked, a tenth of a radian given, the length moved by at most 0.5
  const r = vRotateTowards([0, 0, 1], [2, 0, 0], 0.1, 0.5);
  near(Math.hypot(...r), 1.5, 1e-5, 'length 1 toward 2 by 0.5');
  near(Math.atan2(r[0], r[2]), 0.1, 1e-5, 'turned by 0.1 rad toward +x');
  // the whole turn when it is smaller than the step
  nearV(vRotateTowards([0, 0, 1], [0.1, 0, 1], 1, 0), flatNorm([0.1, 0, 1]), 1e-5);
  // already along: MoveTowards
  nearV(vRotateTowards([0, 0, 1], [0, 0, 3], 1, 0.5), [0, 0, 1.5], 1e-6);
  // exactly opposite: about OrthoNormalVectorFast(from) - forward leans on z, so the y-z plane's (0, -z, y) = (0, -1, 0),
  // and a quarter turn about down takes forward to the left
  nearV(vRotateTowards([0, 0, 1], [0, 0, -1], Math.PI / 2, 0), [-1, 0, 0], 1e-5);
  // right leans on x: the x-y plane's (-y, x, 0) = (0, 1, 0), and about up a quarter turn takes right to the back
  nearV(vRotateTowards([1, 0, 0], [-1, 0, 0], Math.PI / 2, 0), [0, 0, -1], 1e-5);
  // from nought (the wind indoors): MoveTowards by the magnitude
  nearV(vRotateTowards([0, 0, 0], [0, 0, 2], 0.1, 1), [0, 0, 1], 1e-6);
  nearV(vRotateTowards([0, 0, 0], [0, 0, 0.5], 0.1, 1), [0, 0, 0.5], 1e-6);
});

test('CSA-E: Quaternion.RotateTowards - SlerpUnclamped by at most the degrees; the angle nought past 1 - 1e-6 of the dot', () => {
  const a = [0, 0, 0, 1], b = quatAngleAxis(90, [0, 1, 0]);
  near(quatAngleUnity(a, b), 90, 1e-3);
  assert.equal(quatAngleUnity(a, [0, 0, 0, 1]), 0);
  near(quatAngleUnity(a, quatAngleAxis(2, [0, 1, 0])), 2, 1e-2, 'two degrees is not nought');
  const q = quatRotateTowards(a, b, 25);
  near(quatAngleUnity(a, q), 25, 1e-3);
  assert.deepEqual(quatRotateTowards(a, a, 25), a, 'at the target: the target');
  nearV(quatRotateTowards(a, b, 200), b, 1e-6, 'a step past the angle lands on it');
});

// ── the wind ─────────────────────────────────────────────────────────────────

test('CSA-E: UpdateWind - indoors none; outdoors Random.Range(1f, 2f) (a tenth in fog, half again in rain, twice in a storm) along right turned back by day and forward by night, flipped south of row 250, then 15 x Random.Range(-4, 4) degrees', () => {
  const day = (weather, hour = 12, pixelY = 20, strength = 1.5, steps = -4) => {
    const s = scene({ weather, hour, pixelY, float: [strength], int: [0, steps] });   // Start's roll, then UpdateWind's
    s.rt.UpdateWind(weather);
    return s.rt.state.windVectorTarget;
  };
  // day: right + back = (1, 0, -1), turned -60 degrees about up: (0.9659, 0, 0.2588)
  const dir = [0.96592583, 0, 0.25881905];
  nearV(day(WEATHER_TYPE.Sunny), dir.map((v) => v * 1.5), 1e-5);
  nearV(day(WEATHER_TYPE.Fog), dir.map((v) => v * f(f(1.5) * f(0.1))), 1e-5);
  nearV(day(WEATHER_TYPE.Rain), dir.map((v) => v * 2.25), 1e-5);
  nearV(day(WEATHER_TYPE.Thunder), dir.map((v) => v * 3), 1e-5);
  nearV(day(WEATHER_TYPE.Snow), dir.map((v) => v * 1.5), 1e-5, 'snow is none of the three');
  // night (18:00 to 06:00, both ends in): right + forward, turned -60: (-0.2588, 0, 0.9659)
  nearV(day(WEATHER_TYPE.Sunny, 18), [-0.25881905 * 1.5, 0, 0.96592583 * 1.5], 1e-5);
  nearV(day(WEATHER_TYPE.Sunny, 6), [-0.25881905 * 1.5, 0, 0.96592583 * 1.5], 1e-5);
  nearV(day(WEATHER_TYPE.Sunny, 7), dir.map((v) => v * 1.5), 1e-5);
  // south of row 250 the whole vector flips
  nearV(day(WEATHER_TYPE.Sunny, 12, 251), dir.map((v) => -v * 1.5), 1e-5);
  nearV(day(WEATHER_TYPE.Sunny, 12, 250), dir.map((v) => v * 1.5), 1e-5);
  // no turn at all: straight along right + back
  nearV(day(WEATHER_TYPE.Sunny, 12, 20, 1, 0), [Math.SQRT1_2, 0, -Math.SQRT1_2], 1e-6);
  // indoors: nothing at all, both vectors
  const s = scene();
  s.world.inside = true;
  s.rt.UpdateWind(WEATHER_TYPE.Rain);
  assert.deepEqual([s.rt.state.windVectorTarget, s.rt.state.windVectorCurrent], [[0, 0, 0], [0, 0, 0]]);
});

test('CSA-E: RotateWind - the first step at once, then one each frame\'s end at a tenth of a radian a second (the length by up to one), until equal; then OnUpdateWind; a second UpdateWind runs a second one beside it (kept)', () => {
  const s = scene({ float: [1, 1], int: [0, 0, 0] });   // Start rolls one, each UpdateWind one
  s.rt.state.windVectorCurrent = [0, 0, 1];
  s.rt.state.windVectorTarget = [0, 0, 1];
  s.rt.UpdateWind(WEATHER_TYPE.Sunny);   // the target: (1, 0, -1) normalised, 135 degrees off forward
  const target = [Math.SQRT1_2, 0, -Math.SQRT1_2];
  nearV(s.rt.state.windVectorTarget, target, 1e-6);
  near(vAngle([0, 0, 1], s.rt.state.windVectorCurrent), f(0.1 * 0.25) * 57.29578, 1e-3, 'StartCoroutine ran the first step');
  s.rt.endOfFrame();
  near(vAngle([0, 0, 1], s.rt.state.windVectorCurrent), 2 * f(0.1 * 0.25) * 57.29578, 1e-3, 'and the frame\'s end the second');
  // a second UpdateWind: two coroutines, twice the turn a frame
  s.rt.UpdateWind(WEATHER_TYPE.Sunny);
  const before = vAngle([0, 0, 1], s.rt.state.windVectorCurrent);
  s.rt.endOfFrame();
  near(vAngle([0, 0, 1], s.rt.state.windVectorCurrent) - before, 2 * f(0.1 * 0.25) * 57.29578, 1e-3, 'two steps in one frame');
  for (let i = 0; i < 200 && s.out.wind.length < 2; i++) s.rt.endOfFrame();
  assert.equal(s.out.wind.length, 2, 'each ends with its own OnUpdateWind');
  nearV(s.out.wind[0], target, 1e-4);
  nearV(s.rt.state.windVectorCurrent, target, 1e-4);
});

test('CSA-E: the wind rolls again on the hour (the player\'s weather), on a weather change (the one coming) and on a transition - which also puts the time scale back without a word', () => {
  const s = scene({ weather: WEATHER_TYPE.Rain, float: [1, 1, 1], int: [0, 0, 0, 0] });
  s.rt.OnNewHour();
  near(Math.hypot(...s.rt.state.windVectorTarget), 1.5, 1e-5, 'the player\'s rain');
  s.rt.OnWeatherChange(WEATHER_TYPE.Thunder);
  near(Math.hypot(...s.rt.state.windVectorTarget), 2, 1e-5, 'the storm coming, not the rain there');
  s.deps.setTimeScale(5);
  s.out.timeScales.length = 0;
  s.world.inside = true;
  s.rt.OnTransition();
  assert.deepEqual(s.out.timeScales, [1]);
  assert.equal(s.out.mid.length, 0, 'ResetTimeScale(message: false)');
  assert.deepEqual(s.rt.state.windVectorCurrent, [0, 0, 0], 'and indoors the wind is none');
});

// ── the sails ────────────────────────────────────────────────────────────────

/** A sail's own Animator, and its Stowed. */
const stowed = (sail) => animatorOf(sail).GetBool('Stowed');
/** A wind of length `len` at `deg` degrees about up off the sail's own flat forward. */
const windOff = (sail, deg, len = 1) => turnUp(deg, flatNorm(forwardOf(sail))).map((v) => v * len);

test('CSA-E: GetSailPower - a lateen at half off its own forward and full at 135, down to half at 165 and nought past it, 15% less (x0.85) on its bad tack; large half again', () => {
  const s = scene();
  const boat = s.helm(s.place(1, 0));   // the skiff's one large lateen
  s.rt.RaiseSails();
  const [sail] = boat.Sails;
  assert.ok(boat.SailsLateen.includes(sail) && boat.SailsLarge.includes(sail));
  const power = (deg) => { s.rt.state.windVectorCurrent = windOff(sail, deg); return s.rt.GetSailPower(); };
  near(power(0), 0.5 * 1.5, 1e-5, 'along the sail');
  near(power(-90), (50 + 50 * (90 / 135)) / 100 * 1.5, 1e-4, 'good tack');
  near(power(90), (50 + 50 * (90 / 135)) / 100 * 0.85 * 1.5, 1e-4, 'the wind on the sail\'s right: SignedAngle > 0, the bad tack');
  near(power(-150), 0.75 * 1.5, 1e-4, 'between 135 and 165 the lerp back down');
  near(power(-170), 0, 1e-6, 'head to wind');
  // stowed, it pulls nothing
  animatorOf(sail).SetBool('Stowed', true);
  assert.equal(power(0), 0);
});

test('CSA-E: GetSailPower - a square sail full before the wind and backing past 90 (doubled when it backs), a gaff and a staysail on to 150, the small ones cut (a gaff half, a staysail three tenths, a square four)', () => {
  const s = scene();
  const trireme = s.helm(s.place(3, 0));   // one large square sail
  s.rt.state.windVectorCurrent = [0, 0, 1];   // astern, or the assist keeps a square sail stowed
  s.rt.RaiseSails();
  const [sq] = trireme.Sails;
  const power = (sail, deg) => { s.rt.state.windVectorCurrent = windOff(sail, deg); return s.rt.GetSailPower(); };
  near(power(sq, 0), 1.5, 1e-5);
  near(power(sq, 90), 0, 1e-4);
  near(power(sq, 135), -0.5 * 2 * 1.5, 1e-4, 'LerpUnclamped past 90, doubled when negative');
  const s2 = scene();
  const skiff = s2.helm(s2.place(1, 1));   // a small gaff and a small staysail
  s2.rt.RaiseSails();
  const gaff = skiff.Sails.find((n) => skiff.SailsGaff.includes(n));
  const stay = skiff.Sails.find((n) => skiff.SailsStay.includes(n));
  assert.ok(gaff && stay && skiff.SailsSmall.includes(gaff) && skiff.SailsSmall.includes(stay));
  const alone = (sail, deg) => {
    for (const n of skiff.Sails) animatorOf(n).SetBool('Stowed', n !== sail);
    s2.rt.state.windVectorCurrent = windOff(sail, deg);
    return s2.rt.GetSailPower();
  };
  near(alone(gaff, 0), 0.5 * 0.5, 1e-5);
  near(alone(gaff, 150), 0 * 0.5, 1e-4, 'the gaff is nought at 150');
  near(alone(gaff, 165), -1 * 0.25 * 0.5, 1e-4, 'and a quarter of its backing past it');
  near(alone(stay, 0), 0.2 * 0.3, 1e-5);
  near(alone(stay, 135), 0.8 * 0.3, 1e-4);
  // a small square sail: four tenths (the skiff's third variant: a small square and a large lateen)
  const s3 = scene();
  const v3 = s3.helm(s3.place(1, 3));
  s3.rt.RaiseSails();
  const small = v3.SailsSquare[0];
  for (const n of v3.Sails) animatorOf(n).SetBool('Stowed', n !== small);
  s3.rt.state.windVectorCurrent = windOff(small, 0);
  near(s3.rt.GetSailPower(), 0.4, 1e-5);
});

test('CSA-E: RaiseSails - refused while a node is off water; the square sails stay stowed with the wind more than 90 off the bow (the assist), every other raised; the rudder\'s Sailing; LowerSails stows them all', () => {
  const s = scene();
  const boat = s.helm(s.place(1, 3));   // a small square and a large lateen
  boat.NodeTileMapIndices[3] = 7;
  s.rt.RaiseSails();
  assert.equal(s.out.hud.at(-1), 'Unable to raise sail. Boat is obstructed.');
  assert.equal(s.rt.state.sailPosition, 0);
  boat.NodeTileMapIndices[3] = 0;
  s.rt.state.windVectorCurrent = [0, 0, -1];   // from dead ahead of the bow (+z)
  s.rt.RaiseSails();
  assert.equal(s.out.hud.at(-1), 'Sail raised!');
  assert.equal(s.rt.state.sailPosition, 1);
  const sq = boat.SailsSquare[0], lat = boat.SailsLateen[0];
  assert.equal(stowed(sq), true, 'the square stays stowed upwind');
  assert.equal(animatorOf(sq).pending?.state.name, 'Stowed', 'and is asked nothing (SpawnBoat\'s own stow is all that waits)');
  assert.equal(stowed(lat), false);
  assert.deepEqual([animatorOf(lat).pending.state.name, animatorOf(lat).pending.duration], ['Unstowed', 2]);
  assert.equal(boat.RudderAnimator.animator.GetBool('Sailing'), true);
  s.rt.LowerSails();
  assert.equal(s.out.hud.at(-1), 'Sail lowered!');
  assert.equal(s.rt.state.sailPosition, 0);
  assert.deepEqual([stowed(sq), stowed(lat)], [true, true]);
  assert.equal(boat.RudderAnimator.animator.GetBool('Sailing'), false);
  // the bar is 90 off the bow: 120 keeps the square down, 80 raises it
  const at = (deg) => { const t = scene(); const b = t.helm(t.place(1, 3)); t.rt.state.windVectorCurrent = turnUp(deg, [0, 0, 1]); t.rt.RaiseSails(); return stowed(b.SailsSquare[0]); };
  assert.equal(at(120), true);
  assert.equal(at(80), false);
  // the assist off: the square goes up too
  const s2 = scene({ settings: { 'SailingAssist.AutoStowSquareSails': false } });
  const b2 = s2.helm(s2.place(1, 3));
  s2.rt.state.windVectorCurrent = [0, 0, -1];
  s2.rt.RaiseSails();
  assert.equal(stowed(b2.SailsSquare[0]), false);
});

test('CSA-E: ToggleSails, ToggleSquareSails and HasLargeSquareSailWithGaff', () => {
  const s = scene();
  s.helm(s.place(0, 0));   // the rowboat
  s.rt.ToggleSails();
  assert.equal(s.out.hud.at(-1), 'Boat does not have any sail.');
  const s2 = scene();
  const two = s2.helm(s2.place(1, 6));   // two square sails
  s2.rt.ToggleSquareSails();
  assert.equal(s2.out.hud.at(-1), 'Square sails raised!');
  assert.deepEqual(two.SailsSquare.map(stowed), [false, false]);
  s2.rt.ToggleSquareSails();
  assert.equal(s2.out.hud.at(-1), 'Square sails lowered!');
  assert.deepEqual(two.SailsSquare.map(stowed), [true, true]);
  assert.equal(s2.rt.state.sailPosition, 0, 'the square sails alone do not set the sails up');
  const has = (variant) => { const t = scene(); return t.rt.HasLargeSquareSailWithGaff(t.place(1, variant)); };
  assert.equal(has(2), true, 'a large square and a gaff');
  assert.equal(has(3), false, 'no gaff');
  assert.equal(has(5), false, 'the square is the small one');
  assert.equal(has(6), false, 'a large square and no gaff');
  const tri = scene();
  assert.equal(tri.rt.HasLargeSquareSailWithGaff(tri.place(3, 0)), false);
});

test('CSA-E: the ToggleSail key raises and lowers them; with the sails up, the assist off and the trim modifier held on a square-and-lateen boat it toggles the square ones alone', () => {
  const s = scene();
  s.helm(s.place(1, 0));
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s.rt.state.sailPosition, 1);
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s.rt.state.sailPosition, 0);
  const s2 = scene({ settings: { 'SailingAssist.AutoStowSquareSails': false }, held: [BOAT_ACTIONS.trimModifier] });
  const b2 = s2.helm(s2.place(1, 3));
  s2.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s2.out.hud.at(-1), 'Sail raised!', 'down, the modifier changes nothing');
  s2.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s2.out.hud.at(-1), 'Square sails lowered!');
  assert.equal(s2.rt.state.sailPosition, 1);
  assert.deepEqual([stowed(b2.SailsSquare[0]), stowed(b2.SailsLateen[0])], [true, false]);
  // the modifier let go: the key lowers them all
  s2.held.delete(BOAT_ACTIONS.trimModifier);
  s2.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s2.out.hud.at(-1), 'Sail lowered!');
  assert.equal(s2.rt.state.sailPosition, 0);
});

test('CSA-E: the sail arm - obstructed, the sails come down and the boat stops; each sail\'s Wind walks toward its pull (a gaff past 150 flaps on the clock\'s sine); the square sails stow upwind and rise again', () => {
  const s = scene();
  const boat = s.helm(s.place(1, 0));
  s.rt.RaiseSails();
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  boat.NodeTileMapIndices[3] = 7;
  s.frame();
  assert.equal(s.rt.state.sailPosition, 0);
  assert.equal(s.out.hud.at(-1), 'Sail lowered!');
  // the Wind: a lateen with the wind 45 off its left - num8 half, so the pull is +|wind|, from its default 1 by dt
  const s2 = scene();
  const b2 = s2.helm(s2.place(1, 0));
  s2.rt.RaiseSails();
  const lat = b2.Sails[0];
  s2.rt.state.windVectorCurrent = windOff(lat, -45, 2);
  s2.rt.state.windVectorTarget = [...s2.rt.state.windVectorCurrent];
  s2.frame();
  near(animatorOf(lat).GetFloat('Wind'), 1.25, 1e-5, 'MoveTowards(1, 2, 0.25)');
  s2.rt.state.windVectorCurrent = windOff(lat, 45, 2);   // num9 +45: num8 -0.5, so the pull is -|wind|
  s2.rt.state.windVectorTarget = [...s2.rt.state.windVectorCurrent];
  s2.frame();
  near(animatorOf(lat).GetFloat('Wind'), 1, 1e-5, 'toward -2 by 0.25');
  // a gaff past 150: MoveTowards toward Sin((Time.time + its index) * 2) * 0.25
  const s3 = scene();
  const b3 = s3.helm(s3.place(1, 1));
  s3.rt.RaiseSails();
  const k = b3.Sails.findIndex((n) => b3.SailsGaff.includes(n));
  const gaff = b3.Sails[k];
  s3.rt.state.windVectorCurrent = windOff(gaff, -160);
  s3.rt.state.windVectorTarget = [...s3.rt.state.windVectorCurrent];
  s3.frame();
  near(animatorOf(gaff).GetFloat('Wind'), Math.max(1 - 0.25, Math.sin((0 + k) * 2) * 0.25), 1e-5, 'the flap');
  // the staysail too, at its own place in the list: its phase is its index (Time.time + num7)
  const j = b3.Sails.findIndex((n) => b3.SailsStay.includes(n));
  assert.ok(j > 0, 'the staysail sits after the first');
  const stay = b3.Sails[j];
  for (const n of b3.Sails) animatorOf(n).SetFloat('Wind', 0.3);
  s3.rt.state.windVectorCurrent = windOff(stay, -160);
  s3.rt.state.windVectorTarget = [...s3.rt.state.windVectorCurrent];
  const t0 = s3.world.time;
  s3.frame();
  near(animatorOf(stay).GetFloat('Wind'), Math.sin((t0 + j) * 2) * 0.25, 1e-5, 'within reach of its own sine');
  // a gaff at 160 flaps (the bar is 150 for all but the lateen): from 0.1 toward its sine, not toward its pull of -1
  for (const n of b3.Sails) animatorOf(n).SetFloat('Wind', 0.1);
  s3.rt.state.windVectorCurrent = windOff(gaff, -160);
  s3.rt.state.windVectorTarget = [...s3.rt.state.windVectorCurrent];
  const t1 = s3.world.time;
  s3.frame();
  const flapTo = Math.sin((t1 + k) * 2) * 0.25;
  near(animatorOf(gaff).GetFloat('Wind'), Math.abs(flapTo - 0.1) <= 0.25 ? flapTo : 0.1 + Math.sign(flapTo - 0.1) * 0.25, 1e-5);
  // the square sails upwind: stowed by the assist, raised again off the wind
  const s4 = scene();
  const b4 = s4.helm(s4.place(3, 0));
  s4.rt.state.windVectorCurrent = [0, 0, 1];   // astern: raised
  s4.rt.RaiseSails();
  assert.equal(stowed(b4.Sails[0]), false);
  s4.rt.state.windVectorCurrent = [0, 0, -1];
  s4.rt.state.windVectorTarget = [0, 0, -1];
  s4.frame();
  assert.equal(stowed(b4.Sails[0]), true, 'stowed by the assist when the wind came round ahead');
  s4.rt.state.windVectorCurrent = [0, 0, 1];
  s4.rt.state.windVectorTarget = [0, 0, 1];
  s4.frame();
  assert.equal(stowed(b4.Sails[0]), false);
});

test('CSA-E: the auto trim turns a raised lateen\'s boom toward the side the wind is from at 100 degrees a second; the sails\' power drives the boat forward and the rudder turns it by the speed it makes', () => {
  const s = scene();
  const boat = s.helm(s.place(1, 0));   // the boat faces +z
  s.rt.RaiseSails();
  const boom = boat.Booms[0];
  const wind = turnUp(60, [0, 0, 1]).map((v) => v * 2);   // 60 degrees to the right of the bow, twice the unit: num6 +60, so num13 Lerp(-90, -45, 2/3) = -60
  s.rt.state.windVectorCurrent = [...wind];
  s.rt.state.windVectorTarget = [...wind];
  const goal = quatAngleAxis(-60, [0, 1, 0]);
  const before = quatAngleUnity(boom.localRotation, goal);
  s.frame();
  near(before - quatAngleUnity(boom.localRotation, goal), 25, 1e-2, '100 degrees a second, a quarter second');
  // the power: forward by GetSailPower x |wind| (read after the frame's trim, as the arm reads it)
  assert.ok(s.rt.state.MoveVectorTarget[2] > 0 && s.rt.state.MoveVectorTarget[0] === 0 && s.rt.state.MoveVectorTarget[1] === 0);
  near(s.rt.state.MoveVectorTarget[2], s.rt.GetSailPower() * 2, 1e-4, 'the power times the wind\'s length');
  s.frame();
  near(before - quatAngleUnity(boom.localRotation, goal), 50, 1e-2, 'and on from where it stood - the manual trim does not reset it while the auto one runs');
  // the rudder: MoveRight turns by |MoveVectorCurrent| x modifierRudder / 10
  s.rt.state.MoveVectorCurrent = [0, 0, 4];
  s.held.add('MoveRight');
  s.frame();
  assert.equal(boat.modifierRudder, 1);
  assert.equal(s.rt.state.TurnTarget, f(f(4 * 1) / 10), 'read off the speed the boat had as the arm ran, before the frame\'s MoveTowards');
  s.held.delete('MoveRight');
  s.held.add('MoveLeft');
  s.rt.state.MoveVectorCurrent = [0, 0, 2];
  s.frame();
  assert.equal(s.rt.state.TurnTarget, -f(f(2 * 1) / 10));
});

test('CSA-E: the manual trim - the brackets turn the fore-and-aft booms 15 degrees a second to 90, with the modifier the square ones to 45, every boom set to its angle', () => {
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false }, held: [BOAT_ACTIONS.trimRight] });
  const boat = s.helm(s.place(1, 3));   // a small square boom and a lateen boom
  s.frame();
  near(s.rt.state.trimAngle, 3.75, 1e-6);
  assert.equal(s.rt.state.trimAngleSquare, 0);
  const lateen = boat.Booms.find((b) => b.name.includes('Lateen'));
  const square = boat.Booms.find((b) => b.name.includes('Square'));
  nearV(lateen.localRotation, quatAngleAxis(3.75, [0, 1, 0]), 1e-6);
  nearV(square.localRotation, [0, 0, 0, 1], 1e-6);
  s.held.add(BOAT_ACTIONS.trimModifier);
  s.frame();
  near(s.rt.state.trimAngleSquare, 3.75, 1e-6);
  near(s.rt.state.trimAngle, 3.75, 1e-6);
  for (let i = 0; i < 20; i++) s.frame();
  near(s.rt.state.trimAngleSquare, 45, 3.75, 'held at 45');
  assert.ok(s.rt.state.trimAngleSquare < 45 + 3.75);
  const held45 = s.rt.state.trimAngleSquare;
  s.held.delete(BOAT_ACTIONS.trimRight);
  s.held.add(BOAT_ACTIONS.trimLeft);
  s.frame();
  near(s.rt.state.trimAngleSquare, held45 - 3.75, 1e-5, 'the left bracket back');
  nearV(square.localRotation, quatAngleAxis(s.rt.state.trimAngleSquare, [0, 1, 0]), 1e-6);
  near(s.rt.state.trimAngle, 3.75, 1e-6, 'the modifier held: the lateen boom stays');
});

// ── the widget ───────────────────────────────────────────────────────────────

test('CSA-E: the widget\'s frame - fifteen degrees a frame of 24, a wind on the right counted from 360 down and one on the left up from nought (each bin fifteen wide, its far edge in), nought the last', () => {
  assert.equal(windWidgetFrameCount(), 24);
  assert.deepEqual([...WIND_WIDGET.intervals], [1, 2, 3, 5, 6, 9, 10, 15, 18, 30, 45, 90]);
  const s = scene();
  const at = (deg) => s.rt.windWidgetFrameOf(deg);
  assert.equal(at(0), 0);
  assert.equal(at(10), 1);
  assert.equal(at(-10), 0);
  assert.equal(at(-20), 23);
  assert.equal(at(179), 12);
  assert.equal(at(-179), 13);
  // at the helm, the player's forward against the wind
  const t = scene();
  t.helm(t.place(1, 0));
  t.rt.state.windVectorCurrent = turnUp(40, [0, 0, 1]);
  t.rt.state.windVectorTarget = [...t.rt.state.windVectorCurrent];
  t.frame();
  assert.equal(t.rt.state.windWidgetFrame, t.rt.windWidgetFrameOf(vSignedAngle(forwardOf({ rotation: [0, Math.sin((t.player.yaw * Math.PI / 180) / 2), 0, Math.cos((t.player.yaw * Math.PI / 180) / 2)] }), t.rt.state.windVectorCurrent, [0, 1, 0])));
});

test('CSA-E: the widget\'s rect - at the helm only, unpaused; centred at its offset of the screen, lifted by the large HUD, sized by the picture, the screen\'s scale (none, the height\'s, both) and its own', () => {
  const s = scene();
  const screenRect = { x: 0, y: 0, width: 960, height: 400 };
  assert.equal(s.rt.windWidget({ screenRect }), null, 'not at the helm');
  s.helm(s.place(1, 0));
  assert.deepEqual(s.rt.windWidget({ screenRect }).rect, { x: 480 - 64, y: 200 - 64, w: 128, h: 128 });
  assert.equal(s.rt.windWidget({ screenRect, paused: true }), null);
  assert.deepEqual(s.rt.windWidget({ screenRect, largeHudHeight: 50 }).rect, { x: 416, y: 86, w: 128, h: 128 });
  const mode = (m, extra = {}) => { const t = scene({ settings: { 'WindDirectionWidget.ScalingMode': m, ...extra } }); t.helm(t.place(1, 0)); return t.rt.windWidget({ screenRect }); };
  assert.deepEqual(mode(1).rect, { x: 480 - 128, y: 200 - 128, w: 256, h: 256 }, 'ScreenHeight: 400 / 200 both ways');
  assert.deepEqual(mode(2).rect, { x: 480 - 192, y: 200 - 128, w: 384, h: 256 }, 'ScreenDimensions: 960 / 320 across, 400 / 200 down');
  assert.deepEqual(mode(0, { 'WindDirectionWidget.Scale': 0.5, 'WindDirectionWidget.Position': [0.25, 0.75] }).rect, { x: 240 - 32, y: 300 - 32, w: 64, h: 64 });
  assert.equal(mode(0, { 'WindDirectionWidget.Enable': false }), null);
  assert.equal(mode(0, { 'WindDirectionWidget.Color': '#ff000080' }).color, '#ff000080');
});

// ── the sails at the helm's edges, the rudder and the door ───────────────────

test('CSA-E: leaving the helm lowers raised sails; a save taken with them up raises them on load before the wind comes back, so the load-time wind decides the square sails (kept)', () => {
  const s = scene();
  s.helm(s.place(1, 0));
  s.rt.RaiseSails();
  s.rt.StopSailingDelayed();
  assert.ok(s.out.hud.includes('Sail lowered!'));
  assert.equal(s.rt.state.sailPosition, 0);
  // the save: a trireme (one square sail) sailing with its sail up and the wind astern
  const a = scene();
  a.helm(a.place(3, 0));
  a.rt.state.windVectorCurrent = [0, 0, 1];
  a.rt.RaiseSails();
  const data = a.rt.getSaveData();
  assert.equal(data.sailPosition, 1);
  // loaded where Start's wind blew from dead ahead: Random.Range(-12, 12) of 12 is 180 degrees
  const b = scene({ int: [12] });
  nearV(b.rt.state.windVectorCurrent, [0, 0, -1], 1e-6);
  b.rt.restoreSaveData(data);
  const boat = b.rt.AllBoats[data.currentBoat];
  assert.equal(b.rt.state.sailPosition, 1);
  assert.equal(stowed(boat.Sails[0]), true, 'the square stayed stowed for a wind that was not the saved one');
  nearV(b.rt.state.windVectorCurrent, [0, 0, 1], 1e-6, 'and then the saved wind');
});

test('CSA-E: the rudder\'s Animator - Rowing faded in at the helm, RowZ, RowX and RowSpeed from the oars, TurnAngle under sail, Disembarked on leaving; the Animators step between Update and LateUpdate', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.helm(s.place(1, 0));
  const rudder = boat.RudderAnimator.animator;
  assert.deepEqual([rudder.pending.state.name, rudder.pending.duration], ['Rowing', 1]);
  s.frame();
  assert.equal(rudder.nextStateName, 'Rowing', 'the fade taken in the frame\'s step');
  near(rudder.GetFloat('RowZ'), s.rt.state.inputCurrent[1], 1e-6);
  near(rudder.GetFloat('RowX'), s.rt.state.inputCurrent[0], 1e-6);
  near(rudder.GetFloat('RowSpeed'), Math.min(2, Math.max(0.2, Math.hypot(...s.rt.state.MoveVectorCurrent) / 20)), 1e-6);
  s.rt.RaiseSails();
  s.held.delete('MoveForwards');
  s.held.add('MoveRight');
  s.frame();
  near(rudder.GetFloat('TurnAngle'), s.rt.state.inputCurrent[0], 1e-6);
  assert.ok(rudder.GetFloat('TurnAngle') > 0);
  s.rt.StopSailingDelayed();
  assert.equal(rudder.pending.state.name, 'Disembarked');
});

test('CSA-E: TriggerDoor - the trigger\'s parent\'s Animator has its Opened turned over at each press within reach; a hit on no boat does nothing', () => {
  const s = scene();
  const galleon = s.place(2, 0);
  const trigger = [...galleon.GameObject.walk()].find((n) => n.name === 'DaggerfallMesh [ID=112403] [Replacement]');
  const door = animatorOf(trigger.parent);
  assert.ok(door, 'the galleon\'s door carries its Animator');
  assert.equal(door.GetBool('Opened'), false);
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 2 }, 'grab');
  assert.equal(door.GetBool('Opened'), true);
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 2 }, 'grab');
  assert.equal(door.GetBool('Opened'), false);
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 4 }, 'grab');
  assert.equal(door.GetBool('Opened'), false, 'beyond 3.2 nothing');
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: null, distance: 2 }, 'grab');
  assert.equal(door.GetBool('Opened'), false);
  // the door's own transition, stepped by the frame: Closed to Opened over a second
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 2 }, 'grab');
  s.frame();
  assert.equal(door.nextStateName, 'Opened');
});

test('CSA-D x AUDIT NAV1 (the helm): the sea fight\'s seams - moveSpeed times `wayScale` (told whether she is under sail) held to 0..1, the mod\'s own speed with none; RaiseSails refused with `sailRefused`\'s word before the mod\'s own obstruction, the sails kept stowed (mutants: the share unread, the sail flag unread, the refusal after the raise)', () => {
  const s = scene();
  const boat = s.helm(s.place(1, 3));
  const oars = s.rt.properties.moveSpeed();
  assert.ok(oars > 0);
  const asked = [];
  s.deps.wayScale = (underSail) => { asked.push(underSail); return 0.5; };
  near(s.rt.properties.moveSpeed(), oars * 0.5, 1e-6, 'a hurt boat rows at her share');
  assert.equal(asked.at(-1), false, 'told she is under oars');
  s.deps.wayScale = () => 7;
  near(s.rt.properties.moveSpeed(), oars, 1e-6, 'never past her own');
  s.deps.wayScale = () => -1;
  assert.equal(s.rt.properties.moveSpeed(), 0);
  s.deps.wayScale = () => undefined;
  near(s.rt.properties.moveSpeed(), oars, 1e-6, 'no word, her own');
  // the refusal: said, and the sails stay stowed - before the mod's own obstruction
  boat.NodeTileMapIndices[3] = 7;
  s.deps.sailRefused = () => 'The rigging is shot away. No sail will set.';
  s.rt.RaiseSails();
  assert.equal(s.out.hud.at(-1), 'The rigging is shot away. No sail will set.');
  assert.equal(s.rt.state.sailPosition, 0);
  assert.ok(boat.Sails.every((n) => stowed(n)), 'every sail stowed');
  boat.NodeTileMapIndices[3] = 0;
  s.deps.sailRefused = () => null;
  s.rt.state.windVectorCurrent = [0, 0, -1];
  s.rt.RaiseSails();
  assert.equal(s.out.hud.at(-1), 'Sail raised!');
  assert.equal(s.rt.state.sailPosition, 1);
  const sail = s.rt.properties.moveSpeed();
  s.deps.wayScale = (underSail) => { asked.push(underSail); return 0.25; };
  near(s.rt.properties.moveSpeed(), sail * 0.25, 1e-6, 'under a torn rig, the canvas left');
  assert.equal(asked.at(-1), true, 'told she is under sail');
});

test('CSA-D x AUDIT NAV1 (the helm) x HELM-WAY: a heave-to\'s brake - the sea fight\'s `brake` (m/s^2) is her way\'s rate while it says one, held to 20, whatever her own rate; the mod\'s own rate with none (mutants: the brake unread, unheld, a multiple of her rate again)', () => {
  const s = scene();
  s.helm(s.place(1, 3));
  const own = s.rt.properties.moveAccel();
  assert.ok(own > 0);
  s.deps.brake = () => 2;
  near(s.rt.properties.moveAccel(), 2, 1e-6, 'heaving to: the brake\'s own number');
  s.deps.handling = () => 'responsive';
  near(s.rt.properties.moveAccel(), 2, 1e-6, 'the Ship handling never moves it');
  s.deps.brake = () => 1e6;
  near(s.rt.properties.moveAccel(), 20, 1e-5, 'held to 20');
  s.deps.brake = () => -3;
  assert.ok(s.rt.properties.moveAccel() > 0, 'no brake: her own');
  s.deps.handling = undefined;
  s.deps.brake = () => undefined;
  near(s.rt.properties.moveAccel(), own, 1e-9, 'no word, her own');
});
