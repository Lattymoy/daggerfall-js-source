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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentWeather,
  tickWeather, rollClimateWeathersForDay, weatherForClimate, weatherArrivalStamp, mapGround, WEATHER_ENUM,
  sampleWeatherIndoors, restoreWeather, weatherJumpStamp, weatherCrossingStamp,
} from '../src/systems/weatherSim.js';
import { weatherAt, systemsNear, birthsIn, BIRTHS_MEMO, forecastAt } from '../src/systems/weatherMap.js';
import { weatherMarks } from '../src/ui/weatherLayer.js';
import { createDistantStorms, THUNDER_LATE_SECONDS } from '../src/systems/distantStorms.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const WINTER = YEAR + 20 * 1440;
const SPRING = YEAR + 100 * 1440;
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(true); }

test('AUDIT WEATHER3 R1: ONE GROUND LAW for every reader - the travel map inks and forecasts what falls, and a winter storm strikes nothing', () => {
  lane();
  const ground = mapGround(woods);
  assert.equal(ground('rain', 100000, 100000, WINTER), 'snow', 'rain over the woodlands\' winter ground is snow');
  assert.equal(ground('thunder', 100000, 100000, WINTER), 'snow');
  assert.equal(ground('rain', 100000, 100000, SPRING), 'rain', 'and rain in spring');
  assert.equal(ground('fog', 100000, 100000, WINTER), 'fog', 'only what falls is turned');
  // the map's marks: never a rain mark over winter snow ground
  const sys = systemsNear(400000, 200000, WINTER, woods, 200000);
  assert.ok(sys.some((s) => s.type === 'rain' || s.type === 'thunder'), 'the winter woods still have rain in the table');
  const marks = weatherMarks(sys, (w, x, z) => ground(w, x, z, WINTER));
  for (const m of marks) { assert.ok(m.type !== 'rain' && m.type !== 'thunder'); for (const [, w] of m.bands) assert.ok(w !== 'rain' && w !== 'thunder'); }
  // the hover's forecast says what the player standing there gets
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
  // the travel map passes it
  const src = rd('src/ui/heldMap.js');
  assert.match(src, /const ground = mapGround\(climateAt\);\s*\n\s*this\._wx = \{ bucket, key: `wx\$\{bucket\}`, minutes, ground, systems, marks: weatherMarks\(systems, \(w, x, z\) => ground\(w, x, z, minutes\)\)/);
  assert.match(src, /weatherField\(wx\.systems, \{ width: this\._size\.width, height: this\._size\.height, ground: \(w, x, z\) => wx\.ground\(w, x, z, wx\.minutes\) \}\)/, 'WEATHER3h: the regions read through it too');
  assert.match(src, /forecastAt\(fx, fz, this\.deps\.weather\.minutes\(\), this\.deps\.getClimateIndex, \{ hours: WEATHER_FORECAST_HOURS, step: 30, ground: wx\.ground \}\)/);
});

test('AUDIT WEATHER3 R2: the map\'s cache - the host\'s own lookup, and a full cache sheds its OLDEST quarter, never the whole', () => {
  assert.match(rd('src/scenes/world.js'), /getClimateIndex: climateAt,/, 'the travel map reads with the sim\'s own lookup - warm, not a cold read per open');
  assert.match(rd('src/ui/heldMap.js'), /const systems = systemsNear\(cx, cz, minutes, climateAt, reach\);/, 'and no wrapper made per window');
  const look = () => WOODS;
  const keep = Math.floor(BIRTHS_MEMO * 0.6);
  let kept = null, oldest = null;
  for (let i = 0; i < BIRTHS_MEMO + 10; i++) { const b = birthsIn('fog', i, 0, 0, look); if (i === keep) kept = b; if (i === 0) oldest = b; }
  assert.equal(birthsIn('fog', keep, 0, 0, look), kept, 'a node read at sixty per cent of the cache is still cached after it filled');
  assert.notEqual(birthsIn('fog', 0, 0, 0, look), oldest, 'the oldest was shed (and redrawn, the same births)');
  assert.deepEqual(birthsIn('fog', 0, 0, 0, look), oldest);
});

// a canvas that records: the kept wash layer and the sheet's own context
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'createRadialGradient') return (...a) => { calls.push({ fn: k, args: a }); return { addColorStop() {} }; };
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
test('AUDIT WEATHER3 R2a: the weather is READ once a refresh - a pan or a zoom redraws the kept regions, never the bay\'s weather again', () => {
  // WEATHER3h: the soft washes (and the layer that kept them) are gone; the weather is the law read over the bay into
  // regions once a refresh. What R2a held stands: a pan costs the drawing, not the reading.
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  const node = () => { const n = { children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, append(...k) { n.children.push(...k); }, remove() {}, addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [] }; return n; };
  globalThis.document = { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
  try {
    const clock = { m: SPRING + 8 * 60 };
    const win = new HeldMapWindow({ getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: woods, woods: { heightMapBuffer: new Uint8Array(6000).fill(10) }, mapSize: { width: 100, height: 60 }, weather: { on: () => true, minutes: () => clock.m } });
    const wx = win._weatherLayer();
    const env = (ox) => ({ view: { ox, oy: 0, scale: 8 }, paperW: 800, paperH: 480, dpr: 1 });
    win._paintWeather(recordingCtx(), env(0), wx);
    const regions = wx.regions;
    assert.ok(regions && Object.keys(regions).length > 0, 'the regions traced on the first paint');
    for (const ox of [3, 7, 12]) {
      const pan = recordingCtx();
      win._paintWeather(pan, env(ox), wx);
      assert.equal(wx.regions, regions, 'a pan frame reads no weather: the same regions');
      assert.ok(pan.calls.some((c) => c.fn === 'fill'), 'and draws them');
    }
    clock.m += 10;
    const next = win._weatherLayer();
    win._paintWeather(recordingCtx(), env(0), next);
    assert.notEqual(next.regions, regions, 'the next refresh reads the bay again');
    // the regions go UNDER the pen; the glyphs and the legend over it. With no region to lay, every stroke on the
    // sheet is made over the pen - a glyph under the parchment is a glyph no one sees
    const over = [];
    const state = { globalCompositeOperation: 'source-over' };
    const ink = new Proxy({}, {
      get: (_, k) => (k in state ? state[k] : k === 'measureText' ? (t) => ({ width: t.length * 6 }) : (...a) => over.push({ fn: k, op: state.globalCompositeOperation })),
      set: (_, k, v) => { state[k] = v; return true; },
    });
    const rain = { id: 'r', type: 'rain', x: 50, y: 30, env: 1, bands: [[20, 'rain']], reach: 20, clip: null };
    win._paintWeather(ink, env(0), { ...next, regions: {}, marks: [rain] });
    const drawn = over.filter((c) => ['stroke', 'fill', 'fillRect', 'strokeRect', 'fillText'].includes(c.fn));
    assert.ok(drawn.some((c) => c.fn === 'stroke'), 'the rain\'s glyph is drawn');
    for (const c of drawn) assert.equal(c.op, 'source-over', `${c.fn} over the pen`);
  } finally { delete globalThis.document; }
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
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /if \(jump \|\| weatherArrivalStamp\(\) !== seenArrival\) distantStorms\.reset\(\);/, host);
});
