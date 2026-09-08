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
  assert.match(use, /const dtReal = weatherAt === null \? 0 : Math\.min\(MAX_DELTA_SECONDS, Math\.max\(0, seconds - weatherAt\)\);/, 'the wall\'s delta survives for one reader, clamped as Time.deltaTime is (MODS AUDIT)');
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
  assert.match(lab, /clouds\.setState\(cst, \{ cover: cst\.cloudCover, soft: cst\.cloudSoft \}, \$\('weather'\)\.value, dtMin, labDrift, 0\);/);
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
  currentWeather, WEATHER_TYPES, setWeather,
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
  assert.equal(currentWeather(), WEATHER_TYPES[weatherForClimate(CLIMATES.Woodlands)], 'the drain applied the zone the player stands in');
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
  assert.match(sim, /_evolveUrlDoor \?\?= new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('evolve'\) !== 'off';\s*\n\s*return _evolveUrlDoor && isEnhanced\(\) && !!getPref\('enhancedEnvironments'\);/, 'Enhanced Environments read LIVE (the pane flips it without a reload), ?evolve=off the kill switch read once');
  assert.match(sim, /const r = seededRng\(\(h \* 6 \+ zone\) \^ EVOLVE_SEED\);/, 'its own generator');
  assert.match(sim, /_zoneChangedAtMinutes\[zone\] = h \* 60;/, 'stale by the change\'s own hour, for THAT zone');
  assert.match(sim, /const rolledAt = \(zone != null \? _zoneChangedAtMinutes\[zone\] : null\) \?\? _rolledAtMinutes;/, 'the drain reads the player\'s zone\'s stamp, else the day roll\'s');
  assert.match(sim, /if \(!weatherEvolutionOn\(\) \|\| !_climateWeathersValid \|\| _evolveHour === null \|\| hour < _evolveHour\)/, 'VALID, not merely rolled: a loaded save\'s all-Sunny array is never evolved off');
  assert.match(sim, /for \(let h = Math\.max\(_evolveHour \+ 1, hour - 23\); h <= hour; h\+\+\) \{/);
});

// ---- CLK3: day and night on the clock - the remaining steps ----------
import { lunarPhaseFraction, lunarPhaseFractionsFromMinutes, lunarPhase, lunarPhasesFromMinutes, dateFromClassicMinutes, LUNAR_PHASES } from '../src/systems/gameDate.js';
import { skyState, moonSkyDirection, phaseLitFraction, sunSkyDirection } from '../src/render/enhancedSky.js';
import { dayFraction, daylightScale, sunDirection, DAWN_HOUR, DUSK_HOUR } from '../src/world/worldClock.js';

test('CLK3: the moon\'s phase is continuous on the clock for the dome - no 45-degree jump at midnight - and never a ring step from DFU\'s ladder, which every system still reads', () => {
  const base = 405 * 360 * MINUTES_PER_DAY;
  // across midnight the dome's moon moves by minutes, not by a step
  const before = skyState({ minuteOfDay: 1439, classicMinutes: base + 10 * MINUTES_PER_DAY + 1439 });
  const after = skyState({ minuteOfDay: 0, classicMinutes: base + 11 * MINUTES_PER_DAY });
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  assert.ok(angle(before.masser.dir, after.masser.dir) < 0.02, `Masser moves ${angle(before.masser.dir, after.masser.dir).toFixed(4)} rad across midnight - minutes' worth, not a step`);
  assert.ok(Math.abs(phaseLitFraction(before.masser.phase) - phaseLitFraction(after.masser.phase)) < 0.01, 'and the moonlight with it');
  // monotone through a day: the fraction only ever grows (mod the ring)
  let last = null;
  for (let m = 0; m < MINUTES_PER_DAY; m += 30) {
    const p = lunarPhaseFractionsFromMinutes(base + 3 * MINUTES_PER_DAY + m).masser;
    if (last !== null) assert.ok(((p - last + 8) % 8) > 0 && ((p - last + 8) % 8) < 0.02, 'a half hour is a sliver of the ring');
    last = p;
  }
  // a full ring is 32 days: the fraction at day d + 32 is the fraction at day d
  for (const d of [0, 7, 19]) {
    const a = lunarPhaseFractionsFromMinutes(base + d * MINUTES_PER_DAY + 600), b = lunarPhaseFractionsFromMinutes(base + (d + 32) * MINUTES_PER_DAY + 600);
    assert.ok(Math.abs(a.masser - b.masser) < 1e-9 && Math.abs(a.secunda - b.secunda) < 1e-9);
  }
  // the ladder's distance (the review widened this to the whole day): at midnight never more than one ring
  // step from DFU's own ladder, within the day at most 1.25 (the fraction walks a quarter step across a day
  // while the ladder stands still), on every day of the cycle, both moons
  const ring = (a, b) => Math.min(Math.abs(a - b), 8 - Math.abs(a - b));
  let worstDay = 0;
  for (let d = 0; d < 32; d++) {
    for (const m of [0, 360, 720, 1080, 1439]) {
      const cm = base + d * MINUTES_PER_DAY + m;
      const steps = lunarPhasesFromMinutes(cm), frac = lunarPhaseFractionsFromMinutes(cm);
      for (const moon of ['masser', 'secunda']) {
        const dist = ring(frac[moon], steps[moon]);
        assert.ok(dist <= (m === 0 ? 1 : 1.25) + 1e-9, `day ${d} minute ${m} ${moon}: fraction ${frac[moon].toFixed(2)} vs ladder ${steps[moon]}`);
        worstDay = Math.max(worstDay, dist);
      }
      if (m === 0) {
        // at midnight on a Full or New day the two agree exactly
        if (steps.masser === LUNAR_PHASES.Full) assert.ok(Math.abs(frac.masser - 4) < 1e-9, 'Full is ratio 0: the fraction is 4 at midnight');
        if (steps.masser === LUNAR_PHASES.New) assert.ok(Math.abs(frac.masser) < 1e-9, 'New is ratio 16: the fraction is 0 at midnight');
      }
    }
  }
  assert.ok(worstDay > 1, 'and the within-day bound is the real one: the walk does exceed a step late in the widest band');
  assert.equal(lunarPhaseFraction({ year: -1 }, 0), 0, 'year < 0: None, as the ladder answers');
  assert.equal(lunarPhase(dateFromClassicMinutes(base), { masser: true }) >= 0, true, 'the ladder itself is untouched');
  // the systems keep the step: the dome alone takes the fraction, a caller's own phases go in whole
  const dome = read('src/render/enhancedSky.js');
  assert.match(dome, /const ph = phases \?\? lunarPhaseFractionsFromMinutes\(classicMinutes\);/);
  assert.doesNotMatch(dome, /lunarPhasesFromMinutes/, 'the ladder is not the dome\'s to read any more');
  // the systems keep the step - the readers the page names (the enchant ctx's moon arms, the lycanthrope's full
  // moon, the Dynamic Skies mod's own), unconditionally: a file that stops reading DFU's step goes red, not quiet
  for (const f of ['src/scenes/hostEnchant.js', 'src/systems/lycanthropy.js', 'src/systems/dynamicSkies.js']) {
    const s = read(f);
    assert.match(s, /lunarPhasesFromMinutes|isFullMoonFromMinutes|lunarPhase\(/, `${f}: reads DFU's step`);
    assert.doesNotMatch(s, /lunarPhaseFraction/, `${f}: a system reads DFU's step, never the dome's fraction`);
  }
  assert.equal(Object.keys(import.meta).length >= 0, true);
  assert.match(read('src/tools/skyLab.js'), /const phases = lunarPhaseFractionsFromMinutes\(/, 'the lab hands the dome the same fraction');
  assert.deepEqual(skyState({ minuteOfDay: 0, classicMinutes: base, phases: { masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.New } }).masser.phase, LUNAR_PHASES.Full, 'a caller\'s own phases go in whole');
  // THE SUN AND THE RIG ARE ONE CURVE ALREADY: the dome's sun rides worldClock's dayFraction, the rig's light the same fraction clamped
  assert.match(dome, /export function sunSkyDirection\(minuteOfDay\) \{\s*\n\s*const x = Math\.PI \* dayFraction\(minuteOfDay\);/);
  for (const h of [DAWN_HOUR, DUSK_HOUR]) {
    assert.ok(Math.abs(sunSkyDirection(h * 60)[1]) < 1e-9, `${h}:00: the dome's sun is on the horizon`);
    assert.ok(Math.abs(daylightScale(h * 60)) < 1e-9, 'and the rig\'s light is at zero - the same minute');
  }
  let lastY = -1, lastScale = -1;
  for (let m = DAWN_HOUR * 60; m <= 12 * 60; m += 15) {
    const y = sunSkyDirection(m)[1], sc = daylightScale(m);
    assert.ok(y >= lastY - 1e-12 && sc >= lastScale - 1e-12, 'both climb through the morning together');
    assert.ok(Math.abs(y - sunDirection(m)[1]) < 1e-6, 'the rig\'s sun and the dome\'s are one direction by day');
    lastY = y; lastScale = sc;
  }
  assert.ok(sunSkyDirection(3 * 60)[1] < 0 && dayFraction(3 * 60) < 0, 'and the dome alone knows how far under the horizon the night\'s sun is');
});

// ---- CLK4: the review's fixes ----------------------------------------
import { moonlightTerm, MOONLIGHT, DECK_LATTICE, DECK_PERIOD, wrapDeck, fbm } from '../src/render/enhancedSky.js';

test('CLK4: the review - a distant zone never moves the player\'s stale clock, a loaded save is never evolved off, the door is live, the moonlight ramps, the deck has a period, the rest is a veil', () => {
  // (1) THE PLAYER'S ZONE'S STAMP: the day rolls at midnight while the player is inside; a DISTANT zone turns at
  // 03:00; the player steps out at 03:10 - the drain is stale (the day roll's three hours), not live (the distant turn)
  const day0 = 300 * MINUTES_PER_DAY;
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(day0 - MINUTES_PER_DAY, () => 0.0); evolveClimateWeathers(day0 - MINUTES_PER_DAY + 1);
  tickWeather(day0 - MINUTES_PER_DAY + 1, CLIMATES.Woodlands);
  setWeather('rain');   // the sky the player stands under
  rollClimateWeathersForDay(day0, () => 0.0);   // midnight, inside: every zone Sunny, the woodlands' slot now differs from the rain
  let distantTurn = null;
  for (let h = 1; h <= 24 * 30 && distantTurn === null; h++) {
    const before = zonesNow();
    if (evolveClimateWeathers(day0 + h * 60)) {
      const after = zonesNow();
      const woodlands = ZONE_CLIMATES.indexOf(CLIMATES.Woodlands);
      if (after[woodlands] === before[woodlands]) distantTurn = h;   // a zone that is not the player's moved
      else { resetWeatherSim(); setWeatherEvolution(true); rollClimateWeathersForDay(day0, () => 0.0); evolveClimateWeathers(day0 + 1); setWeather('rain'); }
    }
  }
  assert.ok(distantTurn !== null, 'some hour turns a zone that is not the woodlands');
  const stamp = weatherJumpStamp();
  assert.equal(tickWeather(day0 + distantTurn * 60 + 10, CLIMATES.Woodlands), true, 'the drain applies the day roll\'s Sunny to the woodlands');
  assert.equal(weatherJumpStamp(), stamp + 1, 'and it is a JUMP - the woodlands\' change is the day roll\'s, hours old; the distant zone\'s turn ten minutes ago is not the player\'s');
  // (2) A LOADED SAVE: the array was never rolled (all Sunny); the evolution rolls nothing off it, the loaded sky stands
  resetWeatherSim(); setWeatherEvolution(true);
  restoreWeather('rain');
  evolveClimateWeathers(day0 + 1);
  let moved = false;
  for (let h = 1; h <= 48; h++) moved = evolveClimateWeathers(day0 + h * 60) || moved;
  assert.equal(moved, false, 'nothing evolves off an array a save never had');
  assert.equal(tickWeather(day0 + 48 * 60, CLIMATES.Woodlands), false);
  assert.equal(currentWeather(), 'rain', 'the W1 restore law holds: the loaded sky stands until a day rolls');
  rollClimateWeathersForDay(day0 + MINUTES_PER_DAY, () => 0.0); evolveClimateWeathers(day0 + MINUTES_PER_DAY + 1);
  moved = false;
  for (let h = 1; h <= 24 * 20; h++) moved = evolveClimateWeathers(day0 + MINUTES_PER_DAY + h * 60) || moved;
  assert.equal(moved, true, 'and after the day roll the evolution runs again');
  resetWeatherSim();
  // (3) THE DOOR IS LIVE: the source reads the skin and the pref every call, and caches only the URL
  const sim = read('src/systems/weatherSim.js');
  assert.doesNotMatch(sim, /_evolveDoor\b/, 'no cached lane answer');
  assert.match(sim, /let _evolveUrlDoor = null;/);
  // (4) THE MOONLIGHT RAMPS on the daylight curve - no step at 18:00, none at 06:00
  const base = 405 * 360 * MINUTES_PER_DAY;
  let nightOf = null;
  for (let d = 0; d < 32 && nightOf === null; d++) {
    const st = skyState({ minuteOfDay: 18 * 60 + 5, classicMinutes: base + d * MINUTES_PER_DAY + 18 * 60 + 5 });
    if (st.masser.vis > 0.5 && phaseLitFraction(st.masser.phase) > 0.5) nightOf = d;
  }
  assert.ok(nightOf !== null);
  let lastScale = 0;
  for (let m = 17 * 60 + 30; m <= 18 * 60 + 30; m++) {
    const st = skyState({ minuteOfDay: m, classicMinutes: base + nightOf * MINUTES_PER_DAY + m });
    const term = moonlightTerm(st);
    const scale = term ? term.scale : 0;
    assert.ok(scale >= lastScale - 1e-12 && scale - lastScale < 0.04, `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}: the moonlight rises by slivers (${(scale - lastScale).toFixed(4)})`);
    lastScale = scale;
  }
  assert.ok(lastScale > 0.05, 'and is up by half past six');
  assert.equal(moonlightTerm(skyState({ minuteOfDay: 12 * 60, classicMinutes: base + nightOf * MINUTES_PER_DAY + 12 * 60 })), null, 'none at noon');
  assert.equal(skyState({ minuteOfDay: 720, classicMinutes: base }).daylight, daylightScale(720), 'the state carries the rig\'s curve');
  assert.match(read('src/render/dynamicSkiesBridge.js'), /daylight: daylightScale\(minuteOfDay\),/, 'and the mod\'s moon state carries it too (DS2: in the bridge now)');
  assert.ok(MOONLIGHT.dayFade > 0 && MOONLIGHT.dayFade < 0.2);
  // (5) THE DECK HAS A PERIOD: both decks whole, the field the same a period away, the drift wrapped where it becomes the state
  assert.equal(DECK_PERIOD % DECK_LATTICE, 0, 'the near deck');
  assert.ok(Math.abs((DECK_PERIOD * 0.55) / DECK_LATTICE - Math.round((DECK_PERIOD * 0.55) / DECK_LATTICE)) < 1e-9, 'the far deck (0.55 of the drift)');
  for (const [x, y] of [[0.3, 0.7], [12.25, -3.5], [100.1, 77.7]]) {
    assert.ok(Math.abs(fbm(x + DECK_PERIOD, y) - fbm(x, y)) < 1e-9 && Math.abs(fbm(x, y - DECK_PERIOD) - fbm(x, y)) < 1e-9, `fbm(${x}, ${y}) repeats every DECK_PERIOD`);
    assert.ok(Math.abs(fbm(x + DECK_LATTICE, y) - fbm(x, y)) < 1e-9, 'and every lattice period of the base octave');
  }
  assert.ok(wrapDeck(DECK_PERIOD * 3 + 5) - 5 < 1e-9 && wrapDeck(-1) > DECK_PERIOD - 1.001);
  const st = skyState({ minuteOfDay: 720, classicMinutes: base, drift: [DECK_PERIOD * 7 + 1.5, -DECK_PERIOD - 2] });
  assert.ok(Math.abs(st.drift[0] - 1.5) < 1e-9 && Math.abs(st.drift[1] - (DECK_PERIOD - 2)) < 1e-9, 'wrapped once, where the state is made');
  const dome = read('src/render/enhancedSky.js');
  assert.match(dome, /float hash21\(vec2 p\) \{ p = mod\(p, \$\{DECK_LATTICE\}\.0\);/, 'the shader\'s lattice, the same period');
  assert.doesNotMatch(dome, /2\.03/, 'the octave is exactly two');
  // (6) THE REST IS A VEIL on the enhanced skin while resting; DFU's opaque black on the classic skin and the selection page
  const rest = read('src/ui/restWindow.js');
  assert.match(rest, /export const REST_VEIL = Object\.freeze\(\[0, 0, 0, 0\.35\]\);/);
  assert.match(rest, /if \(this\.state === 'resting' && isEnhanced\(\)\) drawMenuBackdrop\(renderer, canvas, REST_VEIL\);/);
  // (7) WHAT STAYS ON THE WALL, by decision - pinned so the next audit does not "fix" it
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(h);
    assert.match(s, /lightning\.tick\(dt\)/, `${h}: the strobe's schedule is DFU's real-second law`);
    assert.match(s, /advanceRotor\(w\.state, dt, /, `${h}: the sails turn at their physical rate`);
    assert.match(s, /tsec: now \/ 1000/, `${h}: the precipitation's wander is the wall's`);
  }
  assert.match(read('src/scenes/shared.js'), /dt: dtReal,/, 'the mod keeps Time.deltaTime');
});
