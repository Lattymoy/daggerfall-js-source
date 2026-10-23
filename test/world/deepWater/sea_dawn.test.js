// SEA-DAWN (the Discord, 2026-10-21: "Ocean water very dark, almost black during dawn/dusk"): the sea's daylight
// factor is the light curve to the power SEA_DAYLIGHT_GAMMA - night stays 0, the hours between dawn and noon lift.
// The departure from Iliac Puddle No More's GetDaylightFactor is Port-Ledger A, the SEA-DAWN row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daylightFactor, timeAdjustedSurfaceTint, SEA_DAYLIGHT_GAMMA, NIGHT_SURFACE_TINT } from '../../../src/world/deepWater/deepWaterLook.js';
import { daylightScale, isNight, setLightCurve } from '../../../src/world/worldClock.js';

const at = (h, m = 0, weatherScale = 1) => {
  const minute = h * 60 + m;
  return daylightFactor({ night: isNight(minute), daylightScale: daylightScale(minute), weatherScale });
};

test('SEA-DAWN: the factor is the clamped curve to the square root', () => {
  assert.equal(SEA_DAYLIGHT_GAMMA, 0.5);
  assert.equal(daylightFactor({ night: false, daylightScale: 0.36 }), 0.6);
  assert.equal(daylightFactor({ night: false, daylightScale: 0.5, weatherScale: 0.5 }), 0.5);
  assert.equal(daylightFactor({ night: false, daylightScale: 2 }), 1, 'clamped before the power');
  assert.equal(daylightFactor({ night: true, daylightScale: 0.9 }), 0, 'the night is the night');
});

test('SEA-DAWN: on the rig\'s curve, 17:00 and 07:00 hold well past the night tint, and 05:59 is still night', () => {
  setLightCurve(null);
  assert.ok(Math.abs(at(17) - 0.6083) < 1e-3, `17:00 clear: ${at(17)}`);
  assert.ok(Math.abs(at(17) - at(7)) < 1e-6, 'the curve is symmetric about noon (its slopes to the seventh place)');
  assert.ok(Math.abs(at(17, 0, 0.65) - 0.4904) < 1e-3, `17:00 overcast: ${at(17, 0, 0.65)}`);
  assert.equal(at(5, 59), 0);
  assert.ok(at(12) > 0.94 && at(12) < 0.95, 'clear noon barely moves (0.9 -> 0.949)');
  const tint = timeAdjustedSurfaceTint(0, at(17));
  assert.ok(tint[2] > NIGHT_SURFACE_TINT[2] + 0.4, `17:00's tint is no longer near the night's: ${tint}`);
});
