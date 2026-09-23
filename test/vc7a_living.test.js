// VC7a (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive"; the first of the four chosen:
// living clouds): THE FIELD HAS A LIFE. It was a fixed noise volume slid across the land by the wind, a bank the same
// bank from horizon to horizon. Three clocks read from the GAME's minutes - the boil up the shape and detail volumes,
// the coverage's own slower wind and its daily turn - and the day's convection (fair-weather towers low in the
// morning, tall by mid-afternoon), and a weather-map cell's cloud as grown as its system. The record is
// bible/07-Rendering/Volumetric-Clouds-Arc.md VC7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VolumetricClouds, cloudClocks, convection, convectCell, grownCell, cellOf, cellOfField, FIELD_UNIFORMS, CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS,
  EVOLVE_M_PER_MINUTE, DETAIL_EVOLVE_M_PER_MINUTE, COVER_DRIFT_SHARE, COVER_EVOLVE_PER_MINUTE, FAIR_WEATHERS, CONVECTION_LAG_MINUTES,
  CONVECTION_DEPTH_FLOOR, GROWTH_FLOOR, SHAPE_METRES, DETAIL_METRES, FIELD_PERIOD_METRES, VC_PROFILE, QUALITY, WORLD_PER_DRIFT, wrapField,
  convectZone,
} from '../src/render/volumetricClouds.js';
import { skyState, WEATHER_SKY, WEATHER_EASE_MINUTES, sunSkyDirection } from '../src/render/enhancedSky.js';
import { skyCells } from '../src/systems/weatherMap.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;

test('VC7a: THE CLOCKS - the boil and the cover\'s turn run on the game\'s minutes, each wrapped to its own volume, whole at any year', () => {
  const at = (m, d = [0, 0]) => cloudClocks(m, d);
  // each reads up its volume at its own rate, and comes round exactly at its period
  for (const m of [0, 17, 1440, YEAR + 123456]) {
    const a = at(m), b = at(m + 1);
    const step = (x, y, period) => ((y - x) % period + period) % period;
    assert.ok(Math.abs(step(a.evolve[0], b.evolve[0], SHAPE_METRES) - EVOLVE_M_PER_MINUTE) < 1e-3, 'the shape boils EVOLVE_M_PER_MINUTE a minute');
    assert.ok(Math.abs(step(a.evolve[1], b.evolve[1], DETAIL_METRES) - DETAIL_EVOLVE_M_PER_MINUTE % DETAIL_METRES) < 1e-3, 'the detail faster');
    assert.ok(Math.abs(step(a.evolve[2], b.evolve[2], 1) - COVER_EVOLVE_PER_MINUTE) < 1e-9, 'the cover turns through its slice');
    for (const [v, period] of [[a.evolve[0], SHAPE_METRES], [a.evolve[1], DETAIL_METRES], [a.evolve[2], 1]]) assert.ok(v >= 0 && v < period && Number.isFinite(v), 'wrapped: a year of minutes never outgrows a float');
  }
  // an updraft's order: 1 to 5 m/s of game time rises 60 to 300 m a game minute
  assert.ok(EVOLVE_M_PER_MINUTE >= 60 && EVOLVE_M_PER_MINUTE <= 300, `the towers rise ${EVOLVE_M_PER_MINUTE} m a minute`);
  assert.ok(DETAIL_EVOLVE_M_PER_MINUTE > EVOLVE_M_PER_MINUTE, 'the edges churn faster than the towers rise');
  assert.ok(Math.abs(at(0).evolve[2] - at(1440).evolve[2]) < 1e-9, 'a whole turn a day');
  assert.ok(Math.abs(at(720).evolve[2] - at(0).evolve[2] - 0.5) < 1e-9, '...and half of one by the evening - no sooner round');
  // the cover's own wind: a share of the air's, wrapped to the field's period
  const drift = [123456.7, -98765.4];
  const c = at(0, drift).coverDrift;
  assert.ok(COVER_DRIFT_SHARE > 0 && COVER_DRIFT_SHARE < 1, 'slower than the air, so cover builds and dissolves in it');
  assert.deepEqual(c, [wrapField(drift[0] * COVER_DRIFT_SHARE), wrapField(drift[1] * COVER_DRIFT_SHARE)]);
  for (const v of c) assert.ok(v >= 0 && v < FIELD_PERIOD_METRES);
  // one clock: the same minute and drift, the same sky, on any client
  assert.deepEqual(at(YEAR + 999, drift), at(YEAR + 999, drift));
});

test('VC7a: THE BOIL IS IN THE FIELD - the shape and the detail read up their volumes, the coverage on its own wind; one field for the sky and the ground\'s shadow', () => {
  const d = CLOUD_FIELD_GLSL;
  assert.match(d, /uniform vec3 uEvolve;/);
  assert.match(d, /uniform vec2 uCoverDrift;/);
  assert.match(d, /vec2 qv = vec2\(p\.x \+ uShift\.x - uCoverDrift\.x \+ fShear \* \(p\.y - fBase\), p\.z \+ uShift\.y - uCoverDrift\.y\);/, 'the coverage on the cover\'s own wind, sheared as the cloud is');
  assert.match(d, /  v = textureLod\(uShape, vec3\(qv\.x \/ VARIATION_M, 0\.37 \+ uEvolve\.z, qv\.y \/ VARIATION_M\), 0\.0\);/, 'turning through its slice');
  assert.match(d, /vec4 s = textureLod\(uShape, \(q \+ vec3\(0\.0, uEvolve\.x, 0\.0\)\) \/ SHAPE_M, mip\);/, 'the towers boil');
  assert.match(d, /vec4 d = textureLod\(uDetail, \(q \+ vec3\(0\.0, uEvolve\.y, 0\.0\)\) \/ DETAIL_M, mip\);/, 'the edges churn');
  assert.doesNotMatch(d, /vec3\(q\.x \/ VARIATION_M/, 'the coverage is no longer read on the air\'s own drift');
  // both marches take the one field and its uniforms: the shadow on the ground boils with the bank
  assert.ok(MARCH_FS.includes('uniform vec3 uEvolve;') && SHADOW_FS.includes('uniform vec3 uEvolve;'));
  for (const n of ['uEvolve', 'uCoverDrift']) assert.ok(FIELD_UNIFORMS.includes(n), `${n} uploaded with the field`);
});

// the class without a GL context: its state half, and a recorder for what the field uploads
function clouds() {
  const c = Object.create(VolumetricClouds.prototype);
  Object.assign(c, { q: QUALITY.default, cam: [0, 0], shift: [0, 0], profile: null, weather: null, state: null, row: null, cells: [], noise: { shape: { tex: 1 }, detail: { tex: 2 } } });
  return c;
}
function uploads(c) {
  const got = {};
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && k.startsWith('uniform') ? (loc, ...v) => { got[loc] = v.length === 1 ? v[0] : v; } : () => {}) });
  c.gl = gl;
  c._fieldUniforms(Object.fromEntries(FIELD_UNIFORMS.map((n) => [n, n])));
  return got;
}

test('VC7a: ONE CLOCK FOR EVERY PLAYER - the sky state carries the game\'s minute, and the field uploads the clocks read from it', () => {
  const st = skyState({ minuteOfDay: 900, weather: 'sunny', classicMinutes: YEAR + 900 });
  assert.equal(st.minutes, YEAR + 900);
  assert.equal(st.minuteOfDay, 900);
  const c = clouds();
  const drift = [42, -17];
  c.setState(st, WEATHER_SKY.sunny, 'sunny', 1e9, drift);
  const got = uploads(c);
  const want = cloudClocks(YEAR + 900, [drift[0] * WORLD_PER_DRIFT, drift[1] * WORLD_PER_DRIFT]);
  assert.deepEqual(got.uEvolve, want.evolve);
  assert.deepEqual(got.uCoverDrift, want.coverDrift);
  // a minute later, the sky has moved on - and only by the clocks
  c.setState(skyState({ minuteOfDay: 901, weather: 'sunny', classicMinutes: YEAR + 901 }), WEATHER_SKY.sunny, 'sunny', 1e9, drift);
  const later = uploads(c).uEvolve;
  assert.ok(later[0] !== got.uEvolve[0] && later[1] !== got.uEvolve[1] && later[2] !== got.uEvolve[2], 'the towers, the edges and the cover each a minute on');
  // the lab steps the clock at one sun (`?t=`), so the life can be seen apart from the day
  assert.match(rd('src/tools/skyLab.js'), /const labClock = \(\(405 \* 360 \+ day\) \* MINUTES_PER_DAY\) \+ minuteOfDay \+ \(Number\(params\.get\('t'\)\) \|\| 0\);/);
});

test('VC7a: THE DAY\'S CONVECTION - fair towers low through the night and the morning, tallest mid-afternoon; their cover always DFU\'s row', () => {
  const depth = (h) => convection(h * 60).depth;
  let peak = 0, peakAt = 0;
  for (let m = 0; m < 1440; m++) { const d = convection(m).depth; if (d > peak) { peak = d; peakAt = m; } }
  assert.ok(Math.abs(peak - 1) < 1e-9, 'the whole row\'s depth at the peak');
  // the ground heats behind the sun: the towers peak CONVECTION_LAG_MINUTES after the sun is highest
  let noon = 0; for (let m = 0; m < 1440; m++) if (sunSkyDirection(m)[1] > sunSkyDirection(noon)[1]) noon = m;
  assert.ok(Math.abs(peakAt - (noon + CONVECTION_LAG_MINUTES)) <= 2, `towers tallest at ${(peakAt / 60).toFixed(1)}h, the sun highest at ${(noon / 60).toFixed(1)}h`);
  assert.ok(peakAt >= 13.5 * 60 && peakAt <= 15.5 * 60, `mid-afternoon, two to three hours after the sun is highest, as fair-weather cumulus peaks (${(peakAt / 60).toFixed(2)}h)`);
  assert.equal(depth(2), CONVECTION_DEPTH_FLOOR, 'the night\'s flat cumulus');
  for (let h = 8; h < 14; h++) assert.ok(depth(h + 1) >= depth(h), 'rising through the morning');
  for (let h = 16; h < 21; h++) assert.ok(depth(h + 1) <= depth(h), 'settling toward dusk');
  // a fair cell's tops come down by the hour; its cover never moves (the lab: a tenth more cover smeared the sky)
  const conv = convection(9 * 60);
  for (const w of Object.keys(VC_PROFILE)) {
    const cell = cellOf(w, 0, 0, 5000), got = convectCell(cell, conv);
    assert.equal(got.cover, cell.cover, `${w}: the row's cover`);
    if (FAIR_WEATHERS.includes(w)) assert.ok(Math.abs(got.top - (cell.base + (cell.top - cell.base) * conv.depth)) < 1e-9, `${w}: its tops by the hour`);
    else assert.equal(got, cell, `${w}: a deck, a front, fog and sand keep their own profile through the day`);
  }
  // and the zone: the field uploads the row's cover whatever the hour, and a fair zone's tops by it
  for (const [h, w] of [[9, 'sunny'], [15, 'sunny'], [9, 'overcast']]) {
    const c = clouds();
    c.setState(skyState({ minuteOfDay: h * 60, weather: w, classicMinutes: YEAR + h * 60 }), WEATHER_SKY[w], w, 1e9, [0, 0]);
    const got = uploads(c);
    assert.equal(got.uCover, WEATHER_SKY[w].cover);
    const p = VC_PROFILE[w];
    assert.ok(Math.abs(got.uTop - (FAIR_WEATHERS.includes(w) ? p.base + (p.top - p.base) * convection(h * 60).depth : p.top)) < 1e-6, `${w} at ${h}h`);
  }
  // THE SUN'S MINUTE, not the long clock's: a state whose day minute and whose minutes disagree (the lab's ?t=, a
  // host handing classicMinutes of 0) convects by the minute of the day the sun is at
  const off = clouds();
  off.setState(skyState({ minuteOfDay: 15 * 60, weather: 'sunny', classicMinutes: YEAR + 9 * 60 }), WEATHER_SKY.sunny, 'sunny', 1e9, [0, 0]);
  const ps = VC_PROFILE.sunny;
  assert.ok(Math.abs(uploads(off).uTop - (ps.base + (ps.top - ps.base) * convection(15 * 60).depth)) < 1e-6, 'three in the afternoon\'s towers, not nine in the morning\'s');
  // AUDIT-VC7 (R3): A FRONT PASSING TURNS THE ZONE FAIR AT THE PROFILE'S PACE - the convection weighed in as the profile
  // eases, never the whole of it the minute the word changes (a kilometre's jump in the tops)
  const turn = clouds();
  turn.setState(skyState({ minuteOfDay: 9 * 60, weather: 'overcast', classicMinutes: YEAR + 9 * 60 }), WEATHER_SKY.overcast, 'overcast', 1e9, [0, 0]);
  const before = uploads(turn).uTop;
  turn.setState(skyState({ minuteOfDay: 9 * 60 + 1, weather: 'sunny', classicMinutes: YEAR + 9 * 60 + 1 }), WEATHER_SKY.sunny, 'sunny', 1, [0, 0]);
  const k = 1 - Math.exp(-1 / WEATHER_EASE_MINUTES), pr = turn.profile, fair = k;
  assert.ok(Math.abs(turn.fair - fair) < 1e-12, 'the fair weight eases on the profile\'s own span');
  const after = uploads(turn).uTop;
  assert.ok(Math.abs(after - (pr.base + (pr.top - pr.base) * (1 - fair * (1 - convection(9 * 60 + 1).depth)))) < 1e-6, 'the eased profile\'s tops, convected by how fair it is');
  const whole = pr.base + (pr.top - pr.base) * convection(9 * 60 + 1).depth;   // the word's convection taken whole
  assert.ok(Math.abs((after - pr.top) - fair * (whole - pr.top)) < 1e-6 && fair < 0.5, `a minute after the word turned, the tops sit ${Math.abs(after - pr.top).toFixed(0)} m off the easing profile's: ${(100 * fair).toFixed(0)}% of the way to the word's whole convection (${Math.abs(whole - pr.top).toFixed(0)} m), as the profile is of the way to its row`);
  assert.deepEqual(convectZone(VC_PROFILE.overcast, convection(540), 0), { base: VC_PROFILE.overcast.base, top: VC_PROFILE.overcast.top }, 'not fair at all: its own tops');
  turn.jump();
  assert.equal(turn.fair, null, 'a jump takes the weight whole with the profile');
  // a fair cell the controller hands over convects too
  const c = clouds();
  c.setState(skyState({ minuteOfDay: 540, weather: 'sunny', classicMinutes: YEAR + 540 }), WEATHER_SKY.sunny, 'sunny', 1e9, [0, 0], 0, null, [cellOf('cloudy', 0, 0, 5000), cellOf('thunder', 9000, 0, 5000)]);
  const cloudy = c.cells.find((x) => x.word === 'cloudy'), storm = c.cells.find((x) => x.word === 'thunder');
  assert.ok(cloudy.top < VC_PROFILE.cloudy.top && storm.top === VC_PROFILE.thunder.top);
});

test('VC7a: A FRONT GROWS - a weather-map cell\'s cloud as grown as its system: thin at birth, the whole profile at full growth', () => {
  const cell = cellOf('rain', 0, 0, 40000);
  assert.equal(grownCell(cell, 1), cell);
  assert.equal(grownCell(cell, undefined), cell, 'no envelope, the whole profile');
  assert.equal(grownCell(cell, 1.5), cell, 'past full growth, full growth');
  assert.deepEqual(grownCell(cell, -1), grownCell(cell, 0), 'before birth, a newborn');
  const born = grownCell(cell, 0);
  assert.ok(Math.abs(born.cover - cell.cover * GROWTH_FLOOR.cover) < 1e-12);
  assert.ok(Math.abs(born.top - (cell.base + (cell.top - cell.base) * GROWTH_FLOOR.depth)) < 1e-9);
  assert.ok(Math.abs(born.density - cell.density * GROWTH_FLOOR.density) < 1e-12);
  let prev = null;
  for (let e = 0; e <= 1; e += 0.1) {
    const g = grownCell(cell, e);
    if (prev) assert.ok(g.cover >= prev.cover && g.top >= prev.top && g.density >= prev.density, 'deepening as it grows');
    prev = g;
  }
  // the map hands the envelope with each of a system's cells, and the host's conversion grows the cloud by it
  const sys = { id: 'rain:1', type: 'rain', x: 0, z: 0, r: 60000, env: 0.3, shape: null, clip: null, bands: [[40000, 'rain'], [50000, 'overcast'], [60000, 'cloudy']] };
  const cells = skyCells([sys], 0, 0);
  assert.ok(cells.length === 3 && cells.every((c) => c.env === 0.3));
  const rainCell = cellOfField(cells.find((c) => c.word === 'rain'), (x, z) => [x, z]);
  assert.ok(rainCell.cover < cell.cover && rainCell.top < cell.top, 'a young front a thin deck');
  const grownUp = cellOfField({ ...cells.find((c) => c.word === 'rain'), env: 1 }, (x, z) => [x, z]);
  assert.equal(grownUp.top, cell.top);
});
