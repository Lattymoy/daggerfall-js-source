// WEATHER3 slice F (2026-09-23): AUDIT WEATHER3 - two independent reads of
// the five slices, one of the runtime (does it RUN, what did it break) and
// one of the records (do they say true things). What the runtime read
// found, each pinned here where it was paid:
//   R1 the ground law stopped at the sky: the travel map's washes and its
//      forecast, and the distant storms, said "Rain" and struck lightning
//      where the player standing there got snow;
//   R2 the travel map inked every wash again on every pan frame, read the
//      whole bay cold on every open (a lookup made per window), and the
//      births cache was wiped whole when it filled;
//   R3 an arrival straight indoors - a load into a dungeon, a recall -
//      read the last outdoor door's sky, or none;
//   R4 a lane switched off mid-session spent the day's pending apply and
//      wore the map's last word until the next day;
//   R5 a landing under the same sky kept the old place's thunder on its
//      way, and thunder due while the frames stopped burst on the first
//      frame back.
// DISC17-C (2026-09-24, Mac: "Remove the enhanced map weather enhancements
// entirely"): the travel map carries no weather now, so R1's map half, R2's
// map half and R2a went with it; the laws they rode on stand here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentWeather,
  tickWeather, rollClimateWeathersForDay, weatherForClimate, weatherArrivalStamp, mapGround, WEATHER_ENUM,
  sampleWeatherIndoors, restoreWeather, weatherJumpStamp, weatherCrossingStamp,
} from '../src/systems/weatherSim.js';
import { weatherAt, systemsNear, birthsIn, BIRTHS_MEMO, forecastAt } from '../src/systems/weatherMap.js';
import { createDistantStorms, THUNDER_LATE_SECONDS } from '../src/systems/distantStorms.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const WINTER = YEAR + 20 * 1440;
const SPRING = YEAR + 100 * 1440;
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(true); }

test('AUDIT WEATHER3 R1: ONE GROUND LAW for every reader - the forecast reads what falls, and a winter storm strikes nothing', () => {
  lane();
  const ground = mapGround(woods);
  assert.equal(ground('rain', 100000, 100000, WINTER), 'snow', 'rain over the woodlands\' winter ground is snow');
  assert.equal(ground('thunder', 100000, 100000, WINTER), 'snow');
  assert.equal(ground('rain', 100000, 100000, SPRING), 'rain', 'and rain in spring');
  assert.equal(ground('fog', 100000, 100000, WINTER), 'fog', 'only what falls is turned');
  const sys = systemsNear(400000, 200000, WINTER, woods, 200000);
  assert.ok(sys.some((s) => s.type === 'rain' || s.type === 'thunder'), 'the winter woods still have rain in the table');
  // the forecast says what the player standing there gets
  let checked = 0;
  for (let i = 0; i < 600 && checked < 5; i++) {
    // across the winter's days as well as the land: a front is a day and 100 km wide (WEATHER3g), one minute's line
    // may cross none
    const x = 120000 + i * 2711, z = 90000 + (i % 23) * 7001, m = WINTER + (i % 29) * 1440;
    if (!['rain', 'thunder'].includes(weatherAt(x, z, m, woods).word)) continue;
    const f = forecastAt(x, z, m, woods, { hours: 2, step: 30, ground });
    assert.equal(f.now.word, 'snow', 'the forecast of a winter storm is snow');
    sampleWeatherField(m, WOODS, [x, z], woods, 'jump');
    assert.equal(currentWeather(), 'snow', 'as the player there gets');
    checked++;
  }
  assert.ok(checked >= 3, `${checked} winter storms read`);
  // the distant storms: a thunderstorm over snow ground is a squall - no lightning, no thunder
  const storm = { type: 'thunder', id: 'thunder:1:1:1:0', x: 10000, z: 0, bornAt: WINTER - 100, life: 400, env: 1, bands: [[5000, 'thunder'], [9000, 'rain']] };
  const ds = createDistantStorms();
  let lit = 0;
  for (let f = 0; f < 60 * 300; f++) { const r = ds.tick({ systems: [storm], at: [0, 0], minutes: WINTER + f / 300, seconds: f / 60, ground }); if (r.bolt || r.sounds.length) lit++; }
  assert.equal(lit, 0);
});

test('AUDIT WEATHER3 R2: the births cache - a full cache sheds its OLDEST quarter, never the whole', () => {
  const look = () => WOODS;
  const keep = Math.floor(BIRTHS_MEMO * 0.6);
  let kept = null, oldest = null;
  for (let i = 0; i < BIRTHS_MEMO + 10; i++) { const b = birthsIn('fog', i, 0, 0, look); if (i === keep) kept = b; if (i === 0) oldest = b; }
  assert.equal(birthsIn('fog', keep, 0, 0, look), kept, 'a node read at sixty per cent of the cache is still cached after it filled');
  assert.notEqual(birthsIn('fog', 0, 0, 0, look), oldest, 'the oldest was shed (and redrawn, the same births)');
  assert.deepEqual(birthsIn('fog', 0, 0, 0, look), oldest);
});

// two places under different skies the same minute, far enough apart that one is a landing from the other
function twoSkies(word) {
  for (let i = 0; i < 4000; i++) {
    const m = SPRING + i * 37, a = [150000 + (i % 41) * 9001, 90000 + (i % 17) * 11003];
    if (weatherAt(a[0], a[1], m, woods).word !== word) continue;
    for (let j = 0; j < 40; j++) {
      const b = [a[0] + 30000 + j * 7001, a[1]];
      if (weatherAt(b[0], b[1], m, woods).word === 'sunny' && weatherAt(b[0], b[1], m + 1, woods).word === 'sunny') return { m, a, b };
    }
  }
  return null;
}

test('AUDIT WEATHER3 R3: an arrival indoors reads the place the host names, not the last outdoor frame\'s; and a load has no place to have come from', () => {
  lane();
  const t = twoSkies('rain');
  assert.ok(t, 'rain here and clear skies there');
  sampleWeatherField(t.m, WOODS, t.a, woods, 'live');
  assert.equal(currentWeather(), 'rain', 'the last outdoor frame, under the rain');
  assert.equal(sampleWeatherIndoors(t.m + 1, WOODS, t.b, woods), true);
  assert.equal(currentWeather(), 'sunny', 'the recall landed indoors under the other place\'s clear sky');
  // a load: the saved sky is worn, and the map's first word after it is a jump even on the very spot the player
  // last stood a minute before - the save may be anywhere in time and space
  lane();
  sampleWeatherField(t.m, WOODS, t.b, woods, 'live');
  restoreWeather('snow');
  const j = weatherJumpStamp(), c = weatherCrossingStamp();
  assert.equal(sampleWeatherField(t.m + 1, WOODS, t.b, woods, 'live'), true);
  assert.equal(currentWeather(), 'sunny');
  assert.equal(weatherJumpStamp(), j + 1, 'a jump');
  assert.equal(weatherCrossingStamp(), c, 'never a crossing out of a saved sky');
});

test('AUDIT WEATHER3 R4: a lane switched off mid-session drains the day\'s slot on its next frame - the pending apply waited', () => {
  lane();
  sampleWeatherField(SPRING, WOODS, [400000, 200000], woods, 'live');
  let day = SPRING;
  while (weatherForClimate(WOODS) === WEATHER_ENUM.sunny || WEATHER_ENUM[currentWeather()] === weatherForClimate(WOODS)) { day += 1440; rollClimateWeathersForDay(day, Math.random); }
  assert.equal(tickWeather(day, WOODS), false, 'on the map\'s lane the drain applies nothing');
  setWeatherMapLaw(false);   // the skin or Enhanced Environments switched off
  assert.equal(tickWeather(day + 1, WOODS), true, 'the next frame off the lane wears the zone\'s slot');
  assert.equal(WEATHER_ENUM[currentWeather()], weatherForClimate(WOODS));
});

test('AUDIT WEATHER3 R5: every landing is an arrival, the word moved or not; and thunder due while the frames stopped is not heard late', () => {
  lane();
  sampleWeatherField(SPRING, WOODS, [400000, 200000], woods, 'live');
  const a0 = weatherArrivalStamp();
  sampleWeatherField(SPRING, WOODS, [400050, 200000], woods, 'live');
  assert.equal(weatherArrivalStamp(), a0, 'a step is not an arrival');
  // a teleport far enough to be a landing, under whatever sky
  sampleWeatherField(SPRING, WOODS, [400000 + 60000, 200000], woods, 'live');
  assert.equal(weatherArrivalStamp(), a0 + 1, 'a landing - whether or not the word changed');
  sampleWeatherField(SPRING + 1, WOODS, [460000, 200000], woods, 'jump');
  assert.equal(weatherArrivalStamp(), a0 + 2, 'every jump');
  // the scheduler: a strike's thunder due while no frame ran is dropped, not burst
  const storm = { type: 'thunder', id: 'thunder:9:9:9:0', x: 10000, z: 0, bornAt: 0, life: 400, env: 1, bands: [[5000, 'thunder'], [8000, 'rain'], [12000, 'cloudy']] };
  const ds = createDistantStorms();
  let q = 0, sec = 0, min = 200;
  for (; q === 0 && sec < 2000; sec += 1 / 60) { min += 1 / 300; ds.tick({ systems: [storm], at: [0, 0], minutes: min, seconds: sec }); q = ds.pending(); }
  assert.ok(q > 0, 'thunder on its way');
  const after = ds.tick({ systems: [], at: [0, 0], minutes: min, seconds: sec + 120 });   // two real minutes indoors
  assert.deepEqual(after.sounds, [], `thunder more than ${THUNDER_LATE_SECONDS} s late is not played`);
  assert.equal(ds.pending(), 0);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /if \(jump \|\| weatherArrivalStamp\(\) !== seenArrival\) \{ distantStorms\.reset\(\); stormLights\.reset\(\); \}/, host);
});
