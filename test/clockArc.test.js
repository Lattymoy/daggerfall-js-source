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

// ---- CLK2: the weather evolves within the day (enhanced lane) --------
import {
  resetWeatherSim, setWeatherEvolution, weatherEvolutionOn, evolveClimateWeathers, rollClimateWeathersForDay, tickWeather,
  weatherForClimate, restoreWeather, weatherJumpStamp, EVOLVE_CHANCE_PER_HOUR, ZONE_CLIMATES, STALE_DRAIN_MINUTES, WEATHER_ENUM,
} from '../src/systems/weatherSim.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const zonesNow = () => ZONE_CLIMATES.map((c) => weatherForClimate(c));

test('CLK2: the evolution - hourly, seeded on the hour and the zone, replayable; a day of it turns most zones at least once; the classic lane never sees it', () => {
  resetWeatherSim();
  setWeatherEvolution(true);
  assert.equal(weatherEvolutionOn(), true);
  const day0 = 100 * MINUTES_PER_DAY;
  rollClimateWeathersForDay(day0, () => 0.0);   // every zone sunny (the first column)
  assert.equal(evolveClimateWeathers(day0 + 1), false, 'the first call anchors and rolls nothing');
  const before = zonesNow();
  const changes = [];
  for (let m = day0 + 60; m <= day0 + MINUTES_PER_DAY; m += 10) {   // a day walked in the rest's ten-minute steps
    if (evolveClimateWeathers(m)) changes.push(Math.floor(m / 60) - Math.floor(day0 / 60));
  }
  assert.ok(changes.length >= 1 && changes.length <= 12, `a day evolves a few times, not every hour and not never (${changes.length})`);
  assert.ok(changes.every((h) => h >= 1 && h <= 24), 'on hour boundaries within the day');
  const after = zonesNow();
  assert.notDeepEqual(after, before, 'the zones moved');
  // REPLAYABLE: the same day evolves the same way
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  for (let m = day0 + 60; m <= day0 + MINUTES_PER_DAY; m += 10) evolveClimateWeathers(m);
  assert.deepEqual(zonesNow(), after, 'seeded on the hour and the zone - whoever watches');
  // and the ten-minute walk and the one-hour walk agree: the hour is the unit
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  for (let m = day0 + 60; m <= day0 + MINUTES_PER_DAY; m += 60) evolveClimateWeathers(m);
  assert.deepEqual(zonesNow(), after, 'the same hours, however the clock is stepped');
  // the chance is the law's own number, and an hour re-rolls from the table (never a weather the season cannot bring)
  assert.ok(EVOLVE_CHANCE_PER_HOUR > 0.05 && EVOLVE_CHANCE_PER_HOUR < 0.3);
  assert.ok(after.every((w) => w >= 0 && w <= 6));
  // THE CLASSIC LANE: off, the hours pass and nothing moves
  resetWeatherSim(); setWeatherEvolution(false);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  let moved = false;
  for (let m = day0 + 60; m <= day0 + MINUTES_PER_DAY; m += 60) moved = evolveClimateWeathers(m) || moved;
  assert.equal(moved, false);
  assert.deepEqual(zonesNow(), before, 'DFU\'s day roll is the whole machine there');
  resetWeatherSim();
});

test('CLK2: the change lands through DFU\'s own drain - live under the sky it is a front, out of sight it is a jump; a jump of days walks only the last 24 hours; a load re-anchors', () => {
  const day0 = 200 * MINUTES_PER_DAY;
  // find an hour that changes the Woodlands zone, from sunny
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  let hourOfChange = null;
  for (let h = 1; h <= 24 * 20 && hourOfChange === null; h++) {
    const was = weatherForClimate(CLIMATES.Woodlands);
    evolveClimateWeathers(day0 + h * 60);
    if (weatherForClimate(CLIMATES.Woodlands) !== was) hourOfChange = h;
  }
  assert.ok(hourOfChange !== null, 'the woodlands turn within twenty days');
  // LIVE: the drain on the next frame (a rest's sub-tick lands within the hour) - no jump stamp
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  tickWeather(day0 + 1, CLIMATES.Woodlands);   // the day's own drain first
  const stamp0 = weatherJumpStamp();
  for (let h = 1; h < hourOfChange; h++) { evolveClimateWeathers(day0 + h * 60); tickWeather(day0 + h * 60, CLIMATES.Woodlands); }
  assert.equal(evolveClimateWeathers(day0 + hourOfChange * 60), true);
  assert.equal(tickWeather(day0 + hourOfChange * 60 + 5, CLIMATES.Woodlands), true, 'the drain applies it');
  assert.equal(weatherJumpStamp(), stamp0, 'five minutes after its hour: live, a front');
  assert.equal(WEATHER_ENUM[Object.keys(WEATHER_ENUM).find((k) => WEATHER_ENUM[k] === weatherForClimate(CLIMATES.Woodlands))] !== WEATHER_ENUM.sunny, true);
  // STALE: the same change found by a tick hours later (a day inside) drains as a jump
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  tickWeather(day0 + 1, CLIMATES.Woodlands);
  const stamp1 = weatherJumpStamp();
  for (let h = 1; h < hourOfChange; h++) evolveClimateWeathers(day0 + h * 60);
  evolveClimateWeathers(day0 + hourOfChange * 60);
  assert.equal(tickWeather(day0 + hourOfChange * 60 + STALE_DRAIN_MINUTES + 1, CLIMATES.Woodlands), true);
  assert.equal(weatherJumpStamp(), stamp1 + 1, 'past the stale window from the change\'s OWN hour: a jump');
  // A JUMP OF DAYS in one tick walks only the last 24 hours (the earlier ones were the day roll's)
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  evolveClimateWeathers(day0 + 5 * MINUTES_PER_DAY);
  const jumped = zonesNow();
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 4 * MINUTES_PER_DAY + 1);
  for (let h = 1; h <= 24; h++) evolveClimateWeathers(day0 + 4 * MINUTES_PER_DAY + h * 60);
  assert.deepEqual(zonesNow(), jumped, 'the five-day jump and the last day walked hour by hour agree');
  // A LOAD re-anchors: the loaded clock's hour rolls nothing, the next hour does
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1);
  restoreWeather('rain');
  assert.equal(evolveClimateWeathers(day0 + 7 * MINUTES_PER_DAY + 30), false, 'the first tick after a load anchors');
  // A REWOUND clock (a load to an earlier save) re-anchors too
  assert.equal(evolveClimateWeathers(day0 + 30), false);
  assert.equal(evolveClimateWeathers(day0 + 30), false, 'and the same hour again rolls nothing');
  resetWeatherSim();
  // the wiring: the tick calls it after the day roll; the lane's door
  const tick = read('src/systems/worldTick.js');
  assert.match(tick, /runDayChange\(\{ entity, lastMinutes, nowMinutes, rolls, say \}\);\s*\n(\s*\/\/[^\n]*\n)*\s*evolveClimateWeathers\(nowMinutes\);/, 'after the day roll, wherever the player is');
  const sim = read('src/systems/weatherSim.js');
  assert.match(sim, /_evolveDoor \?\?= isEnhanced\(\) && !!getPref\('enhancedEnvironments'\)\s*\n\s*&& new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('evolve'\) !== 'off';/, 'Enhanced Environments, ?evolve=off the kill switch');
  assert.match(sim, /const r = seededRng\(\(h \* 6 \+ zone\) \^ EVOLVE_SEED\);/, 'its own generator');
  assert.match(sim, /_rolledAtMinutes = lastChanged \* 60;/, 'stale by the change\'s own hour');
  assert.match(sim, /for \(let h = Math\.max\(_evolveHour \+ 1, hour - 23\); h <= hour; h\+\+\) \{/);
});
