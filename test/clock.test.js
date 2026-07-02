import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNight, isCityLightsOn, dayFraction, daylightScale, evaluateCurve,
  sunDirection, sunScale, exteriorAmbient, skyFrameForTime,
  windowStyleForTime, parseTimeOfDay, CityLightAnimator,
  DAWN_HOUR, DUSK_HOUR, LIGHTS_ON_HOUR, LIGHTS_OFF_HOUR, SUN_RIG_INTENSITY,
} from '../src/world/worldClock.js';

const approx = (a, b, eps = 1e-5) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('clock: verbatim hour gates and time parsing', () => {
  assert.equal(DAWN_HOUR, 6);
  assert.equal(DUSK_HOUR, 18);
  assert.equal(LIGHTS_ON_HOUR, 17);
  assert.equal(LIGHTS_OFF_HOUR, 8);

  // IsNight = hour < 6 || >= 18 (minute boundaries).
  assert.equal(isNight(5 * 60 + 59), true);
  assert.equal(isNight(6 * 60), false);
  assert.equal(isNight(17 * 60 + 59), false);
  assert.equal(isNight(18 * 60), true);

  // IsCityLightsOn = hour >= 17 || < 8: lanterns burn past dawn until 8:00.
  assert.equal(isCityLightsOn(16 * 60 + 59), false);
  assert.equal(isCityLightsOn(17 * 60), true);
  assert.equal(isCityLightsOn(7 * 60 + 59), true);
  assert.equal(isCityLightsOn(8 * 60), false);

  assert.equal(windowStyleForTime(22 * 60), 'night');
  assert.equal(windowStyleForTime(12 * 60), 'day');

  assert.equal(parseTimeOfDay('22:00'), 1320);
  assert.equal(parseTimeOfDay('6:30'), 390);
  assert.equal(parseTimeOfDay('90'), 90);
  assert.equal(parseTimeOfDay(null), null);
  assert.equal(parseTimeOfDay(''), null);
});

test('clock: LightCurve, ambient, and sun scale pinned', () => {
  // Key values verbatim from the SunlightRig prefab curve.
  const keys = [
    [0, 0, 0, 0], [0.08, 0.36, 2.8928573, 2.8928573], [0.5, 0.9, 0, 0],
    [0.92, 0.36, -2.8928576, -2.8928576], [1, 0, 0, 0],
  ];
  approx(evaluateCurve(keys, 0), 0);
  approx(evaluateCurve(keys, 0.08), 0.36);
  approx(evaluateCurve(keys, 0.5), 0.9);
  approx(evaluateCurve(keys, 0.92), 0.36);
  approx(evaluateCurve(keys, 1), 0);
  // Unity Evaluate clamps outside the key range.
  approx(evaluateCurve(keys, -1), 0);
  approx(evaluateCurve(keys, 2), 0);

  // t = (minute - 360) / 720.
  approx(dayFraction(6 * 60), 0);
  approx(dayFraction(12 * 60), 0.5);
  approx(dayFraction(18 * 60), 1);

  approx(daylightScale(12 * 60), 0.9);
  approx(daylightScale(2 * 60), 0); // clamped through the night

  // Sun rig intensity 0.6; scale = 0.6 * curve; hard 0 at night.
  approx(SUN_RIG_INTENSITY, 0.6);
  approx(sunScale(12 * 60), 0.54);
  approx(sunScale(22 * 60), 0);

  // Ambient lerp night 0.25 -> noon 0.9 by daylight.
  const noon = exteriorAmbient(12 * 60);
  approx(noon[0], 0.25 + (0.9 - 0.25) * 0.9);
  const midnight = exteriorAmbient(0);
  approx(midnight[0], 0.25);
  approx(midnight[1], 0.25);
  approx(midnight[2], 0.25);
});

test('clock: sun direction sweep and sky frames', () => {
  // Toward-sun = (cos, sin, 0)(PI * t): dawn from +X (map east), noon up,
  // dusk from -X - matching the sky panorama's east seam.
  const dawn = sunDirection(6 * 60);
  approx(dawn[0], 1); approx(dawn[1], 0); approx(dawn[2], 0);
  const noon = sunDirection(12 * 60);
  approx(noon[0], 0, 1e-6); approx(noon[1], 1); approx(noon[2], 0);
  const dusk = sunDirection(18 * 60);
  approx(dusk[0], -1); approx(dusk[1], 0, 1e-6); approx(dusk[2], 0);

  // Linear frame equivalence across daylight; night sky otherwise.
  assert.equal(skyFrameForTime(6 * 60), 0);
  assert.equal(skyFrameForTime(12 * 60), 32);
  assert.equal(skyFrameForTime(17 * 60 + 59), 63);
  assert.equal(skyFrameForTime(18 * 60), null);
  assert.equal(skyFrameForTime(3 * 60), null);
});

test('clock: light flicker is deterministic and bounded', () => {
  const a = new CityLightAnimator(8, 18, 12345);
  const b = new CityLightAnimator(8, 18, 12345);
  for (let i = 0; i < 30; i++) {
    a.tick(1 / 14);
    b.tick(1 / 14);
  }
  assert.deepEqual(Array.from(a.ranges), Array.from(b.ranges));

  // Verbatim bounds: targets in [start - 1, start], step 0.4 can overshoot
  // by at most one step below the band.
  let moved = false;
  for (const r of a.ranges) {
    assert.ok(r <= 18 + 1e-6 && r >= 18 - 1 - 0.4 - 1e-6, `range ${r}`);
    if (Math.abs(r - 18) > 1e-9) moved = true;
  }
  assert.ok(moved, 'flicker never moved');

  // Different seed diverges.
  const c = new CityLightAnimator(8, 18, 999);
  for (let i = 0; i < 30; i++) c.tick(1 / 14);
  assert.notDeepEqual(Array.from(c.ranges), Array.from(a.ranges));
});
