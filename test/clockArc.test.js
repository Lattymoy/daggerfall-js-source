// THE CLOCK ARC (CLK, 2026-09-08). Mac: "we need to change our weather/
// day and night system to be in sync with the world clock to enhance
// everything." bible/03-World/Clock-Arc.md. (test/clock.test.js is the
// world clock's own file - the rig's curve, the hour gates; this one is
// the arc's.)
//
// CLK1: the sky's PRESENTATION - the weather ease, the front's stretch
// of it, the cloud drift integral and the cloud profile's ease - walks
// on GAME MINUTES, the one clock the sun, the moons, the stars and the
// wind model already read, and never again on the wall's seconds the
// controller differenced for itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEATHER_EASE_MINUTES, WIND_SECONDS_PER_MINUTE, easeWeather, WEATHER_SKY } from '../src/render/enhancedSky.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import {
  FIELD_PERIOD_METRES, wrapField, SHAPE_METRES, DETAIL_METRES, VARIATION_METRES, MOTTLE_METRES, easeProfile, VC_PROFILE,
} from '../src/render/volumetricClouds.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('CLK1: the constants - the ease is 14 real seconds at the default scale, said in game minutes; a game minute is five real seconds of wind', () => {
  assert.ok(Math.abs(WEATHER_EASE_MINUTES - 14 * CLASSIC_MINUTES_PER_SECOND) < 1e-12, 'ES1c\'s fourteen seconds, on the clock');
  assert.ok(Math.abs(WIND_SECONDS_PER_MINUTE - 1 / CLASSIC_MINUTES_PER_SECOND) < 1e-12, 'the row\'s per-second units through the one time scale');
  // the ease in minutes: one time constant at 2.8, all but done after a rest's hour, done after a day
  const a = { cover: 0, soft: 0.5, grey: 0, wind: [0, 0], lit: [1, 1, 1], shade: [0, 0, 0] };
  const b = { cover: 1, soft: 0.1, grey: 1, wind: [0.01, 0], lit: [0.5, 0.5, 0.5], shade: [0.2, 0.2, 0.2] };
  assert.ok(Math.abs(easeWeather(a, b, WEATHER_EASE_MINUTES).cover - (1 - Math.exp(-1))) < 1e-12);
  assert.ok(easeWeather(a, b, 60).cover > 0.999999, 'an hour of clock crosses it whole');
  assert.equal(easeWeather(a, b, 1440).cover, 1, 'a day of clock: arrived');
  assert.equal(easeWeather(a, b, 0).cover, 0, 'a stopped clock moves nothing');
  // the profile on the same minutes
  assert.ok(Math.abs(easeProfile(VC_PROFILE.sunny, VC_PROFILE.thunder, WEATHER_EASE_MINUTES).base - (VC_PROFILE.sunny.base + (VC_PROFILE.thunder.base - VC_PROFILE.sunny.base) * (1 - Math.exp(-1)))) < 1e-9);
  for (const w of Object.keys(WEATHER_SKY)) assert.ok(Math.hypot(...WEATHER_SKY[w].wind) < 0.1, `${w}: the row's wind is still in the dome's per-second units`);
});

test('CLK1: the controller - the presentation differences the host\'s classicMinutes, never the wall; the stretch has no time scale in it; the mod keeps its real frame', () => {
  const shared = read('src/scenes/shared.js');
  const use = shared.slice(shared.indexOf('use(skyIndex, minuteOfDay, showNightSky = true, extra = null) {'), shared.indexOf('let frame = params.has(\'window\')'));
  assert.match(use, /const nowMin = extra\?\.classicMinutes \?\? 0;\s*\n\s*const dt = lastMin === null \|\| nowMin < lastMin \? 0 : nowMin - lastMin;   \/\/ GAME MINUTES\s*\n\s*lastMin = nowMin;/, 'dt is the clock\'s delta, in minutes; a clock that went backwards costs none');
  assert.match(use, /const dtReal = weatherAt === null \? 0 : Math\.min\(1, Math\.max\(0, seconds - weatherAt\)\);/, 'the wall\'s delta survives for one reader');
  assert.match(use, /dynamic\.tick\(\{\s*\n\s*minuteOfDay, classicMinutes: nowMinutes, weather: weatherName, seconds, dt: dtReal,/, 'the mod (1:1) takes it - BLBSkybox reads Time.deltaTime');
  assert.equal((use.match(/dtReal/g) || []).length, 2, 'and nothing else does');
  assert.match(use, /const easeDt = windModel\.inLead\(\) \? dt \* \(WEATHER_EASE_MINUTES \/ FRONT_LEAD_MIN\) : dt;/, 'minutes over minutes');
  assert.doesNotMatch(use, /60 \/ 12|\* 12\b/, 'no time scale hard-coded in the presentation');
  assert.match(use, /weatherRowNow = easeWeather\(weatherRowNow, want, easeDt\);/);
  assert.match(use, /driftXZ\[0\] \+= weatherRowNow\.wind\[0\] \* dt \* WIND_SECONDS_PER_MINUTE;\s*\n\s*driftXZ\[1\] \+= weatherRowNow\.wind\[1\] \* dt \* WIND_SECONDS_PER_MINUTE;/);
  assert.match(use, /clouds\?\.setState\(enhancedSky\.state, weatherRowNow, weatherName, easeDt, driftXZ,/, 'the clouds take the same minutes');
  assert.match(shared, /let lastMin = null;/);
  // the lab keeps the same shape: a game-minute clock, its own integral, ?still stopping both
  const lab = read('src/tools/skyLab.js');
  assert.match(lab, /const dtMin = still \? 0 : Math\.min\(1, \(nowReal - labLast\) \/ 1000\) \/ WIND_SECONDS_PER_MINUTE;/);
  assert.match(lab, /labDrift\[0\] \+= rowWind\[0\] \* dtMin \* WIND_SECONDS_PER_MINUTE;/);
  assert.match(lab, /clouds\.setState\(sky\.state, \{ cover: sky\.state\.cloudCover, soft: sky\.state\.cloudSoft \}, \$\('weather'\)\.value, dtMin, labDrift, 0\);/);
  assert.match(lab, /skyState\(\{ minuteOfDay, weather: \$\('weather'\)\.value, phases, seconds, drift: labDrift \}\)/);
  // the seconds-named constant is gone from the tree's readers
  for (const f of ['src/render/enhancedSky.js', 'src/render/volumetricClouds.js', 'src/scenes/shared.js', 'src/world/windmills.js']) assert.doesNotMatch(read(f), /WEATHER_EASE_SECONDS/, `${f}: no reader of the old constant`);
});

test('CLK1: the wrap - the drift and the recenter shift are unbounded integrals; the clouds take them modulo the field\'s common period', () => {
  for (const [name, m] of Object.entries({ SHAPE_METRES, DETAIL_METRES, VARIATION_METRES, MOTTLE_METRES })) {
    const n = FIELD_PERIOD_METRES / m;
    assert.ok(Math.abs(n - Math.round(n)) < 1e-9 && n >= 1, `${name} divides the common period (${n} times)`);
  }
  for (const v of [0, 1, -1, 12345.678, -98765.4, FIELD_PERIOD_METRES, FIELD_PERIOD_METRES * 3.5, -FIELD_PERIOD_METRES * 2.25, 5e7]) {
    const w = wrapField(v);
    assert.ok(w >= 0 && w < FIELD_PERIOD_METRES, `${v} wraps into [0, P)`);
    assert.ok(Math.abs(wrapField(v + FIELD_PERIOD_METRES) - w) < 1e-6, 'a whole period away is the same cloud');
  }
  assert.ok(FIELD_PERIOD_METRES < 2 ** 20, 'the wrapped value keeps float32 precision under a metre');
  const vc = read('src/render/volumetricClouds.js');
  assert.match(vc, /this\.drift = \[wrapField\(drift\[0\] \* WORLD_PER_DRIFT\), wrapField\(drift\[1\] \* WORLD_PER_DRIFT\)\];/, 'the drift, at upload');
  assert.match(vc, /gl\.uniform2f\(u\.uShift, wrapField\(this\.shift\[0\]\), wrapField\(this\.shift\[1\]\)\);/, 'the shift, at upload');
  assert.match(vc, /this\.shift\[0\] -= offset\[0\]; this\.shift\[1\] -= offset\[2\];/, 'the integral itself is kept raw - the wrap is the shader\'s, not the state\'s');
});
