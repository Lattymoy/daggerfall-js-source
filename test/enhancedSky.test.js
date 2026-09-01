// ES1 - THE ENHANCED SKY (2026-08-27, Mac's call: "for the enhanced
// version of the game, I want us to develop our own take on the
// procedural sky system mod from DFU").
//
// The sky's PRESENTATION is ours and unpinnable by assertion - it is
// judged by eye through tools/enhancedSkyProbe.mjs, which renders the
// real pass in a real WebGL context and screenshots it. What IS pinned
// here is everything the presentation stands on:
//
//   - the LAWS it reads are the port's verbatim ones, not new ones: the
//     sun's arc is worldClock's own (dawn at map east, noon overhead),
//     the moons' phases are gameDate's DFU ladder, night is DawnHour /
//     DuskHour, the weather is the weather sim's own type names;
//   - the palette is a RECORD interpolated in the sun's elevation, so
//     "change a row, change the sky" is true and no colour lives in the
//     shader;
//   - the moons' PLACES agree with their phases (a full moon is up at
//     midnight, a new moon is beside the sun and never seen at night),
//     which is the one thing a player can catch the sky lying about;
//   - the classic pass is untouched and the enhanced one is behind the
//     skin, with ?sky=classic the escape hatch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SKY_KEYS, WEATHER_SKY, MOONS, SUN_RADIUS,
  paletteAt, sunSkyDirection, moonSkyDirection, skyState,
} from '../src/render/enhancedSky.js';
import { LUNAR_PHASES, lunarPhasesFromMinutes, MINUTES_PER_DAY as CLASSIC_DAY } from '../src/systems/gameDate.js';
import { dayFraction, isNight, sunDirection, DAWN_HOUR, DUSK_HOUR } from '../src/world/worldClock.js';
import { WEATHER_TYPES } from '../src/world/weather.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (h, m = 0) => h * 60 + m;
const elevOf = (dir) => Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── THE PALETTE IS A RECORD ───────────────────────────────────────
test('ES1 palette: a table in the sun\'s elevation, interpolated, and the shader holds no colour', () => {
  // Ordered, spanning horizon to horizon, every field a colour or a 0..1.
  assert.ok(SKY_KEYS.length >= 5);
  assert.equal(SKY_KEYS[0].elev, -90);
  assert.equal(SKY_KEYS[SKY_KEYS.length - 1].elev, 90);
  for (let i = 1; i < SKY_KEYS.length; i++) assert.ok(SKY_KEYS[i].elev > SKY_KEYS[i - 1].elev, 'rows ascend');
  for (const k of SKY_KEYS) {
    for (const f of ['zenith', 'horizon', 'sun', 'glow']) assert.match(k[f], /^#[0-9a-f]{6}$/, `${f} is a hex colour`);
    for (const f of ['glowAmount', 'stars']) assert.ok(k[f] >= 0 && k[f] <= 1, `${f} is 0..1`);
  }
  // A row is returned verbatim at its own elevation, and between two
  // rows every channel is the linear blend - the whole interpolation.
  const p0 = paletteAt(0), pMid = paletteAt(2), p4 = paletteAt(4);
  const row0 = SKY_KEYS.find((k) => k.elev === 0), row4 = SKY_KEYS.find((k) => k.elev === 4);
  assert.ok(near(p0.glowAmount, row0.glowAmount) && near(p4.glowAmount, row4.glowAmount));
  assert.ok(near(pMid.glowAmount, (row0.glowAmount + row4.glowAmount) / 2), 'halfway is half');
  for (let c = 0; c < 3; c++) assert.ok(near(pMid.zenith[c], (p0.zenith[c] + p4.zenith[c]) / 2, 1e-6));
  // Clamped past both ends, never undefined.
  assert.deepEqual(paletteAt(-200).zenith, paletteAt(-90).zenith);
  assert.deepEqual(paletteAt(200).zenith, paletteAt(90).zenith);
  // Night is starry and sunless, noon is not.
  assert.equal(paletteAt(-90).stars, 1);
  assert.equal(paletteAt(90).stars, 0);
  // THE SHADER CARRIES NO COLOUR: every colour is a uniform, so the
  // record above is the one place a colour lives.
  const src = read('src/render/enhancedSky.js');
  const fs = src.slice(src.indexOf('const FS = `'), src.indexOf('export class EnhancedSkyRenderer'));
  assert.doesNotMatch(fs, /vec3\s*\(\s*0?\.\d+\s*,\s*0?\.\d+\s*,\s*0?\.\d+\s*\)/,
    'no literal RGB triple in the fragment shader - the palette is uniforms');
});

test('ES1 weather: one row per weather type the sim can produce, and greyer weather is greyer', () => {
  for (const type of WEATHER_TYPES) assert.ok(WEATHER_SKY[type], `${type} has a sky row`);
  assert.equal(Object.keys(WEATHER_SKY).length, WEATHER_TYPES.length, 'and no row for a weather that cannot happen');
  for (const [name, w] of Object.entries(WEATHER_SKY)) {
    for (const f of ['cover', 'soft', 'grey']) assert.ok(w[f] >= 0 && w[f] <= 1, `${name}.${f} is 0..1`);
    assert.match(w.lit, /^#[0-9a-f]{6}$/); assert.match(w.shade, /^#[0-9a-f]{6}$/);
    assert.equal(w.wind.length, 2);
  }
  assert.ok(WEATHER_SKY.sunny.cover < WEATHER_SKY.cloudy.cover);
  assert.ok(WEATHER_SKY.cloudy.cover < WEATHER_SKY.overcast.cover);
  assert.ok(WEATHER_SKY.overcast.cover <= WEATHER_SKY.thunder.cover);
  assert.equal(WEATHER_SKY.sunny.grey, 0, 'a clear sky is not greyed at all');
  assert.ok(WEATHER_SKY.thunder.grey > WEATHER_SKY.overcast.grey);
  assert.ok(WEATHER_SKY.thunder.wind[0] > WEATHER_SKY.sunny.wind[0], 'a storm moves faster');
});

// ── THE LAWS ARE THE PORT'S OWN ───────────────────────────────────
test('ES1 sun: worldClock\'s arc, continued below the horizon', () => {
  // Dawn at map east, noon overhead, dusk at map west - the same three
  // the lit world uses, so the shadow and the sun in the sky agree.
  const dawn = sunSkyDirection(at(DAWN_HOUR));
  const noon = sunSkyDirection(at((DAWN_HOUR + DUSK_HOUR) / 2));
  const dusk = sunSkyDirection(at(DUSK_HOUR));
  assert.ok(near(dawn[0], 1, 1e-9) && near(dawn[1], 0, 1e-9), 'dawn: due east, on the horizon');
  assert.ok(near(noon[1], 1, 1e-9), 'noon: straight up');
  assert.ok(near(dusk[0], -1, 1e-9) && near(dusk[1], 0, 1e-9), 'dusk: due west, on the horizon');
  for (const m of [at(7), at(10), at(13), at(17)]) {
    const s = sunSkyDirection(m);
    assert.ok(near(Math.hypot(s[0], s[1], s[2]), 1, 1e-9), 'unit');
    // It IS the lit world's direction while the sun is up.
    const lit = sunDirection(m);
    assert.ok(near(s[0], lit[0], 1e-6) && near(s[1], lit[1], 1e-6), `${m}: the sky's sun is the world's sun`);
  }
  // ...and below the horizon at night, which sunDirection clamps away -
  // twilight is a matter of degrees, so the sky needs the real angle.
  assert.ok(sunSkyDirection(at(0))[1] < -0.5, 'midnight: well under');
  assert.ok(elevOf(sunSkyDirection(at(19))) < 0 && elevOf(sunSkyDirection(at(19))) > -20, 'an hour past dusk: twilight, not deep night');
  assert.ok(dayFraction(at(0)) < 0, 'the unclamped fraction is what makes that possible');
});

test('ES1 moons: DFU\'s phases decide WHERE they are, so the sky cannot lie about them', () => {
  // The one thing a player can catch: a full moon must be up at
  // midnight and a new moon must never be seen at night.
  const midnight = at(0), noon = at((DAWN_HOUR + DUSK_HOUR) / 2);
  assert.ok(moonSkyDirection(midnight, LUNAR_PHASES.Full)[1] > 0.9, 'a full moon is overhead at midnight');
  assert.ok(moonSkyDirection(noon, LUNAR_PHASES.Full)[1] < -0.9, '...and under the world at noon');
  assert.ok(moonSkyDirection(midnight, LUNAR_PHASES.New)[1] < -0.9, 'a new moon is with the sun: never seen at night');
  assert.ok(near(moonSkyDirection(noon, LUNAR_PHASES.New)[1], 1, 1e-9), '...and beside the sun at noon');
  // A waning half rises at midnight and is high at dawn; a waxing half sets after dusk.
  assert.ok(moonSkyDirection(at(DAWN_HOUR), LUNAR_PHASES.HalfWane)[1] > 0.5, 'the waning half is high at dawn');
  assert.ok(moonSkyDirection(at(DUSK_HOUR + 1), LUNAR_PHASES.HalfWax)[1] > 0, 'the waxing half is still up just after dusk');
  // None (the year < 0 sentinel) is treated as new rather than thrown.
  assert.deepEqual(moonSkyDirection(noon, LUNAR_PHASES.None), moonSkyDirection(noon, LUNAR_PHASES.New));
  // Every phase is a unit direction on the sun's own plane, tilt aside.
  for (const p of Object.values(LUNAR_PHASES)) {
    const d = moonSkyDirection(at(9), p, 0);
    assert.ok(near(Math.hypot(d[0], d[1], d[2]), 1, 1e-9));
    assert.ok(near(d[2], 0, 1e-9), 'no tilt: on the sun\'s arc');
  }
  assert.ok(MOONS.masser.radius > MOONS.secunda.radius, 'Masser is the big one');
  assert.ok(MOONS.secunda.tilt !== 0, '...and Secunda rides off the arc, so they do not overlap forever');
  assert.ok(SUN_RADIUS > 0.01 && SUN_RADIUS < 0.1);
});

// ── THE FRAME'S STATE ─────────────────────────────────────────────
test('ES1 state: what the shader gets - the palette by elevation, the weather\'s hand, the clock\'s phases', () => {
  const noon = skyState({ minuteOfDay: at(12), weather: 'sunny', classicMinutes: 0 });
  const night = skyState({ minuteOfDay: at(0), weather: 'sunny', classicMinutes: 0 });
  assert.ok(noon.elevDeg > 80 && night.elevDeg < -40);
  assert.equal(noon.sunVis, 1, 'the disc is drawn by day');
  assert.equal(night.sunVis, 0, '...and not at night');
  assert.ok(night.stars > 0.8 && noon.stars === 0, 'stars at night, none by day - a little dimmed even on a clear night by its scattered cloud');
  assert.ok(skyState({ minuteOfDay: at(0), weather: 'overcast' }).stars < night.stars, 'and dimmer under cloud');
  assert.equal(night.night, isNight(at(0)));
  assert.equal(noon.night, isNight(at(12)));
  // The hosts read these two for the haze and the clear, exactly as they
  // read the classic pass's - which is why the field names are its.
  assert.deepEqual(noon.clearColor, noon.horizon);
  assert.deepEqual(noon.fillColor, noon.zenith);
  // Weather greys the dome and thins the glow; a storm more than clouds.
  const clear = skyState({ minuteOfDay: at(12), weather: 'sunny' });
  const storm = skyState({ minuteOfDay: at(12), weather: 'thunder' });
  // The dome moves TOWARD the grey - which is not the same as darker,
  // and the difference is worth pinning because it caught this test out:
  // a greyed noon zenith is LIGHTER in sum than clear blue. The frame
  // gets darker because the CLOUDS cover it, which is the probe's to
  // judge (it measures 95 < 137 < 174 for storm < overcast < clear).
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const grey = [0x66 / 255, 0x70 / 255, 0x7c / 255];   // GREY_ZENITH
  assert.ok(dist(storm.zenith, grey) < dist(clear.zenith, grey), 'a storm dome is nearer grey');
  const cloudy = skyState({ minuteOfDay: at(12), weather: 'cloudy' });
  assert.ok(dist(cloudy.zenith, grey) < dist(clear.zenith, grey) && dist(storm.zenith, grey) < dist(cloudy.zenith, grey),
    'and the greying is ordered: clear, cloudy, storm');
  assert.ok(storm.glowAmount < clear.glowAmount, 'the horizon glow thins under weather');
  assert.ok(storm.cloudCover > clear.cloudCover);
  assert.ok(storm.stars <= clear.stars);
  // Weather darkens the CLOUDS, which is what a rendered storm reads as.
  assert.ok(storm.cloudLit[0] + storm.cloudLit[1] + storm.cloudLit[2] < clear.cloudLit[0] + clear.cloudLit[1] + clear.cloudLit[2],
    'a storm\'s clouds are darker than a clear day\'s');
  // The phases come from the CLASSIC clock, not the day's minute: the
  // same in-game day gives the same moons whatever the hour.
  const day11 = 11 * CLASSIC_DAY;
  const morning = skyState({ minuteOfDay: at(7), classicMinutes: day11 + at(7) });
  const evening = skyState({ minuteOfDay: at(20), classicMinutes: day11 + at(20) });
  assert.equal(morning.masser.phase, evening.masser.phase, 'one day, one phase');
  assert.deepEqual(morning.masser.phase, lunarPhasesFromMinutes(day11 + at(7)).masser);
  assert.notEqual(morning.masser.phase, skyState({ minuteOfDay: at(7), classicMinutes: day11 + 8 * CLASSIC_DAY }).masser.phase);
  // A moon below the horizon is not drawn; by day it is faint at most.
  const full = skyState({ minuteOfDay: at(0), phases: { masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.Full } });
  assert.ok(full.masser.vis > 0.5, 'a full moon at midnight is plainly there');
  const dayFull = skyState({ minuteOfDay: at(12), phases: { masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.Full } });
  assert.equal(dayFull.masser.vis, 0, 'and under the world at noon it is not drawn at all');
  const dayNew = skyState({ minuteOfDay: at(12), phases: { masser: LUNAR_PHASES.New, secunda: LUNAR_PHASES.New } });
  assert.ok(dayNew.masser.vis < 0.2, 'a moon up by day is faint');
  // An unknown weather falls to clear rather than throwing.
  assert.deepEqual(skyState({ minuteOfDay: at(12), weather: 'volcano' }).zenith, clear.zenith);
});

// ── THE SEAM ──────────────────────────────────────────────────────
test('ES1 horizon: the dome continues BELOW the line - no flat slab, no glow under it', () => {
  // The first render's one fault: `e` is the CLAMPED elevation, so
  // everything under the horizon got e = 0 - the flat horizon colour
  // AND the maximum dawn glow - which drew a bright band with a hard
  // seam. Fixed the same day; pinned here because it is a shader fault
  // and a shader is not otherwise readable by a test.
  const fs = read('src/render/enhancedSky.js');
  assert.match(fs, /float below = clamp\(-dir\.y, 0\.0, 1\.0\);/, 'the dome knows how far below the line it is');
  assert.match(fs, /color = mix\(color, uHorizon \* 0\.55, pow\(below, 0\.7\)\);/, 'and darkens toward the nadir');
  assert.match(fs, /exp\(-abs\(dir\.y\) \* 9\.0\)/, 'the glow falls off below the line as fast as above it');
  assert.doesNotMatch(fs, /exp\(-e \* 9\.0\)/, 'never off the clamped elevation, which is 0 for the whole lower half');
  // The darkening is mild ON PURPOSE: where the streamed world's edge
  // leaves this band showing, a pale one blends into the distance haze.
  const factor = Number(fs.match(/uHorizon \* (0\.\d+), pow\(below/)[1]);
  assert.ok(factor >= 0.4 && factor <= 0.75, `${factor}: darker than the horizon, not a dark band`);
});

test('ES1 seam: enhanced skin only, one renderer field, the classic pass untouched', () => {
  const shared = read('src/scenes/shared.js');
  // RA1 widened the seam: the skin's, with ?sky=classic the URL escape
  // hatch AND the Enhanced pane's own switch (uiPrefs proceduralSky,
  // default on) - the pane row said "not built" while this line had
  // been building it for a day.
  assert.match(shared, /const enhancedSky = isEnhanced\(\) && params\.get\('sky'\) !== 'classic' && getPref\('enhancedEnvironments'\)\s*\n?\s*\? new EnhancedSkyRenderer\(gl\) : null;/,
    'the enhanced sky is the skin\'s, behind the URL hatch and the player\'s own switch');
  assert.match(shared, /renderer: enhancedSky \?\? sky,/, 'ONE renderer field: the hosts do not know which pass they hold');
  assert.match(shared, /\(enhancedSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\)/);
  // The classic pass keeps its verbatim laws - this arc adds beside it.
  const classic = read('src/render/skyRenderer.js');
  assert.match(classic, /export function buildDaySkyPanorama/);
  assert.match(classic, /export function nightSkyIndexForSky/);
  assert.doesNotMatch(classic, /enhanced/i, 'skyRenderer.js knows nothing of the enhanced sky');
  // Both hosts hand the weather and the classic clock through.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /\{ weather, classicMinutes: playerTicker\.classicMinutes \}\);\s*\/\/ ES1/, `${host} feeds the sky`);
  }
  // The lab is a page like the other prototypes, built as one.
  assert.match(read('vite.config.js'), /sky: 'sky\.html',/);
});

// ── ES1c: THE POLISH (2026-08-27, Mac: "how can we improve this") ──
// Four of five taken: the banding, the clouds, the weather's snap, the
// stars standing still. (The fifth - cloud shadow on the world - is a
// world change, not a sky one, and stays on the board.)
import { easeWeather, weatherRow, WEATHER_EASE_SECONDS, STAR_POLE } from '../src/render/enhancedSky.js';

test('ES1c weather: the sim flips in a frame, the sky walks - eased, monotone, and whole on the first call', () => {
  const clear = weatherRow('sunny'), storm = weatherRow('thunder');
  assert.deepEqual(easeWeather(null, storm, 1), { ...storm }, 'the first call takes the row whole: a boot into rain is rain');
  assert.deepEqual(easeWeather(clear, storm, 0), { ...clear }, 'no time, no move');
  // One step is a fraction of the way, and the way is monotone.
  let row = clear, last = clear.cover;
  for (let t = 0; t < 60; t += 1 / 60) {
    row = easeWeather(row, storm, 1 / 60);
    assert.ok(row.cover >= last - 1e-12, 'cover never goes backwards on the way to a stormier row');
    last = row.cover;
  }
  const span = storm.cover - clear.cover;
  assert.ok(Math.abs(row.cover - storm.cover) < span * 0.02, `a minute in it has all but arrived (${(row.cover).toFixed(4)} of ${storm.cover})`);
  const half = easeWeather(clear, storm, WEATHER_EASE_SECONDS);
  assert.ok(half.cover > clear.cover && half.cover < storm.cover, 'at the time constant it is part way, not there');
  assert.ok(Math.abs(half.cover - (clear.cover + (storm.cover - clear.cover) * (1 - Math.exp(-1)))) < 1e-9, 'exponential, one time constant');
  // Every number the shader takes eases, colours included.
  for (const k of ['cover', 'soft', 'grey']) assert.ok(Number.isFinite(half[k]), k);
  assert.equal(half.wind.length, 2);
  assert.equal(half.lit.length, 3);
  assert.ok(half.lit.every((v, i) => (v - clear.lit[i]) * (storm.lit[i] - clear.lit[i]) >= 0), 'the cloud colours ease too');
  assert.ok(WEATHER_EASE_SECONDS >= 5 && WEATHER_EASE_SECONDS <= 30, `${WEATHER_EASE_SECONDS}s: a weather turns, it does not cut`);
  // skyState takes the eased row over the type's own.
  const eased = skyState({ minuteOfDay: 12 * 60, weather: 'sunny', row: half });
  assert.equal(eased.cloudCover, half.cover, 'the state is built from the eased row');
  assert.notEqual(eased.cloudCover, weatherRow('sunny').cover);
  // And the controller keeps one and walks it.
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /weatherRowNow = easeWeather\(weatherRowNow, want, dt\);/);
  assert.match(shared, /row: weatherRowNow,/);
});

test('ES1c stars: the field wheels about a pole, one turn a day, on the same clock as the sun', () => {
  const at = (h) => skyState({ minuteOfDay: h * 60 }).starAngle;
  assert.equal(at(0), 0);
  assert.ok(Math.abs(at(12) - Math.PI) < 1e-9, 'half a turn by noon');
  assert.ok(Math.abs(at(24) - Math.PI * 2) < 1e-9, 'a full turn a day');
  assert.ok(at(3) > at(0) && at(21) > at(3), 'it only goes one way');
  // The pole is a unit vector, off the zenith, so the field wheels at an
  // angle rather than spinning flat overhead.
  const len = Math.hypot(...STAR_POLE);
  assert.ok(Math.abs(len - 1) < 1e-6, `${len}: a direction`);
  assert.ok(STAR_POLE[1] > 0.3 && STAR_POLE[1] < 0.9, 'tilted: neither flat nor overhead');
  assert.deepEqual(skyState({ minuteOfDay: 60 }).starPole, STAR_POLE, 'and the state carries it to the shader');
  const fs = read('src/render/enhancedSky.js');
  assert.match(fs, /float ca = cos\(uStarAngle\), sa = sin\(uStarAngle\);/, 'the turn is the CLOCK\'s angle - a constant here is a field that stands still');
  assert.match(fs, /vec3 d = dir \* ca \+ cross\(axis, dir\) \* sa \+ axis \* dot\(axis, dir\) \* \(1\.0 - ca\);/, 'Rodrigues about the pole');
  // EE2 F2: cubeSnap is no longer called for the STARS - it returned an
  // integer cell id, and taking fract() of an integer gave every star
  // the same offset inside its cell, which ruled the field into rows.
  // The cell and the position now come from one number. The law the
  // pin exists for is unchanged and still asserted: the field is
  // sampled in the TURNED frame (d, not dir), and it is cast on the
  // cube's equi-angular faces.
  assert.match(fs, /vec2 raw2; float face2;/, 'the star field must choose a cube face itself');
  assert.match(fs, /if \(ad2\.x >= md2\) \{ raw2 = d\.zy \/ ad2\.x;/, 'the field is sampled in the TURNED frame (d, not dir)');
  assert.match(fs, /vec2 g = atan\(raw2\) \* 1\.27323954 \* scale/, 'equi-angular, so a cell is one angle everywhere on a face');
  assert.match(fs, /vec2 cell = floor\(g\), f = fract\(g\);/, 'the cell and the position must be the floor and fract of ONE number');
  assert.match(fs, /smoothstep\(0\.0, 0\.08, dir\.y\)/, '...but a star sets where the REAL horizon is');
});

test('ES1c clouds and dither: two decks lit by the sun, and a triangular dither on the gradient', () => {
  const fs = read('src/render/enhancedSky.js');
  // Two decks: a high one and a low one, the low occluding the high.
  assert.match(fs, /vec2 deck\(vec3 dir, float scale, vec2 wind, float cover, float soft, float bias\)/);
  assert.match(fs, /vec2 hi = deck\(dir, 0\.95, uWind \* 0\.55,/, 'the high deck is smaller and slower');
  assert.match(fs, /vec2 lo = deck\(dir, 1\.9, uWind,/, 'the low one larger and faster - so they move against each other');
  assert.match(fs, /float covHi = hi\.x \* \(1\.0 - lo\.x\) \* 0\.7;/, 'the low deck covers the high one where it is');
  // Lit by the sun: a rim toward it, a darker belly away from it.
  assert.match(fs, /float sunAz = max\(dot\(dir, uSunDir\), 0\.0\);/);
  assert.match(fs, /cc \+= uSunColor \* rim \* 0\.55 \* uSunVis;/, 'the rim is the sun through the edge, and is nothing at night');
  assert.match(fs, /\(1\.0 - pow\(sunAz, 0\.7\)\) \* thick/, 'and the belly darkens away from it');
  assert.doesNotMatch(fs, /vec3 cc = mix\(uCloudShade, uCloudLit, smoothstep\(0\.5, 0\.95, n\)\);/, 'the old unlit colouring is gone');
  // The dither is at the final write, after the fog. (ES1e replaced the
  // hash with interleaved gradient noise on the smooth pass and with an
  // ordered dither on the retro one - the dither's SHAPE is pinned in
  // the ES1e test; what is pinned here is that there is one, and where.)
  assert.match(fs, /vec3 out3 = mix\(clamp\(color, 0\.0, 1\.0\), uFogColor, uFogMix\);/);
  assert.match(fs, /out3 \+= \(ign - 0\.5\) \/ 255\.0;/, 'a sub-quantisation step, never more');
  assert.match(fs, /outColor = vec4\(out3, 1\.0\);/);
});

// ── ES1d: THE CLOUD IN FRONT OF THE SUN ───────────────────────────
import { sunOcclusion, CLOUD_SHADOW, fbm, hash21 } from '../src/render/enhancedSky.js';

test('ES1d shadow: the sun dims under the cloud the SHADER draws, and the two cannot disagree', () => {
  // Nothing at night: there is no sun to occlude.
  assert.equal(sunOcclusion(skyState({ minuteOfDay: 2 * 60, weather: 'cloudy' })), 0);
  assert.equal(sunOcclusion(null), 0);
  // A clear sky barely occludes; a solid deck occludes wholly; a broken
  // one SWEEPS - which is the whole point, a cloud passing over you.
  const over = (w) => {
    const v = [];
    for (let t = 0; t < 400; t += 10) v.push(sunOcclusion(skyState({ minuteOfDay: 9 * 60, weather: w, seconds: t })));
    return { min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b) / v.length };
  };
  const sunny = over('sunny'), cloudy = over('cloudy'), overcast = over('overcast');
  assert.ok(sunny.mean < 0.1, `clear: the sun is mostly out (${sunny.mean.toFixed(2)})`);
  assert.ok(cloudy.min < 0.1 && cloudy.max > 0.9, `broken: it sweeps (${cloudy.min.toFixed(2)}..${cloudy.max.toFixed(2)})`);
  assert.ok(overcast.min > 0.95, 'solid: the sun is gone');
  for (const s of [sunny, cloudy, overcast]) assert.ok(s.min >= 0 && s.max <= 1);
  // It is the SAME field the shader draws with: the same deck call, at
  // the sun's own direction. A drift here is a sun that dims when the
  // sky says it should not, so the two texts are pinned against each other.
  const fs = read('src/render/enhancedSky.js');
  assert.match(fs, /vec2 hi = deck\(dir, 0\.95, uWind \* 0\.55, uCloudCover \* 0\.75, uCloudSoft \* 1\.5, 0\.0\);/);
  assert.match(fs, /const hi = deckCover\(d, 0\.95, \[w\[0\] \* 0\.55, w\[1\] \* 0\.55\], state\.cloudCover \* 0\.75, state\.cloudSoft \* 1\.5, t\);/);
  assert.match(fs, /vec2 lo = deck\(dir, 1\.9, uWind, uCloudCover, uCloudSoft, 0\.0\);/);
  assert.match(fs, /const lo = deckCover\(d, 1\.9, w, state\.cloudCover, state\.cloudSoft, t\);/);
  assert.match(fs, /float covHi = hi\.x \* \(1\.0 - lo\.x\) \* 0\.7;/);
  assert.match(fs, /clamp01\(lo \+ hi \* \(1 - lo\) \* 0\.7\)/);
  // The JS noise is the GLSL noise: same magic numbers, same octaves.
  for (const n of ['123.34', '456.21', '45.32', '2.03', '17.1', '9.7']) {
    assert.ok(fs.includes(n), `${n} appears in both the shader and the JS`);
  }
  assert.ok(fbm(1.5, 2.5) >= 0 && fbm(1.5, 2.5) <= 1);
  assert.equal(hash21(1, 1), hash21(1, 1));
  assert.notEqual(hash21(1, 1), hash21(1, 2));
  // The world takes it off the KEY light only - the sky still lights the
  // ground under a cloud - and the same number in both exterior hosts.
  assert.ok(CLOUD_SHADOW > 0.2 && CLOUD_SHADOW < 0.8, `${CLOUD_SHADOW}: a cloud dims the sun, it does not switch it off`);
  assert.match(read('src/scenes/shared.js'), /return 1 - CLOUD_SHADOW \* occ;/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(host);
    assert.match(src, /sunScale\(minute\) \* weatherSun \* flash \* sky\.sunFactor\(\)/, `${host} dims the key light`);
    assert.doesNotMatch(src, /exteriorAmbient\(minute, 1, weatherSun \* sky\.sunFactor/, `${host} does NOT dim the ambient`);
  }
});

// ── ES1e: THE RETRO PASS ──────────────────────────────────────────
import { RETRO, retroFor } from '../src/render/enhancedSky.js';
import { SKY_ANGLE_PER_PIXEL } from '../src/render/skyRenderer.js';

test('ES1e retro: the enhanced sky is drawn on the PAINTED sky\'s own angular pixel, posterised with an ordered dither', () => {
  // The pixel is the classic sky's pixel - not a screen grid - so the
  // two skins read as one game, the pixels stay put when the camera
  // turns, and a phone and a desktop see the same scale.
  assert.equal(RETRO.step, SKY_ANGLE_PER_PIXEL, 'PI/512: SKY??.DAT is 512 across 180 degrees');
  assert.ok(RETRO.levels >= 12 && RETRO.levels <= 64, `${RETRO.levels}: a 256-colour gradient, not a 24-bit one`);
  // On by default (Mac's call), off with ?sky=smooth - ONE door, so the
  // game and the lab cannot disagree about what the sky looks like.
  assert.equal(retroFor(''), RETRO);
  assert.equal(retroFor('?sky=smooth'), null);
  assert.equal(retroFor('?sky=classic'), RETRO, 'classic is the OTHER pass entirely; it never reaches here');
  assert.match(read('src/scenes/shared.js'), /enhancedSky\.retro = retroFor\(params\.toString\(\)\);/);
  assert.match(read('src/tools/skyLab.js'), /sky\.retro = retroFor\(location\.search\);/);
  const fs = read('src/render/enhancedSky.js');
  // The snap happens to the DIRECTION, before anything is computed - so
  // the sun, the moons, the stars and the cloud edges are all ON the grid.
  assert.match(fs, /if \(uRetroStep > 0\.0\) dir = cubeSnap\(dir, 1\.57079633 \/ uRetroStep, cell\);/);
  const body = fs.slice(fs.indexOf('void main() {'));
  assert.ok(body.indexOf('uRetroStep > 0.0') < body.indexOf('float e = clamp(dir.y'), 'snapped BEFORE the dome is coloured');
  // Ordered dither, indexed by the angular cell (not the screen pixel,
  // which would crawl when the camera turned).
  assert.match(fs, /float bayer4\(vec2 p\)/);
  assert.match(fs, /float b = bayer4\(uRetroStep > 0\.0 \? cell : gl_FragCoord\.xy\) - 0\.5;/);
  assert.match(fs, /out3 = floor\(out3 \* uRetroLevels \+ 0\.5 \+ b\) \/ uRetroLevels;/);
  // ...and the SMOOTH pass keeps a dither, but interleaved gradient
  // noise rather than the hash, which was structured under magnification.
  assert.match(fs, /float ign = fract\(52\.9829189 \* fract\(0\.06711056 \* gl_FragCoord\.x \+ 0\.00583715 \* gl_FragCoord\.y\)\);/);
  assert.doesNotMatch(fs, /hash21\(gl_FragCoord\.xy\) \+ hash21\(gl_FragCoord\.xy \+ 13\.7\)/, 'the structured hash dither is gone');
});

// ── ES1f: NO POLE, NO CIRCLE ──────────────────────────────────────
// Mac: "any way to get rid of the circle that everything weaves into.
// The circle when you look up at the very middle." The grid was
// azimuth/elevation, which puts its POLE at the zenith: the elevation
// rings became concentric circles and the azimuth cells converged to
// nothing, so looking straight up was a bullseye.
test('ES1f: the grid is cast on a CUBE, and its faces are equi-angular - no pole and no beat', () => {
  const fs = read('src/render/enhancedSky.js');
  // The lat-long snap is gone, root and branch.
  assert.doesNotMatch(fs, /floor\(vec2\(az, el\) \/ uRetroStep\)/, 'no azimuth/elevation snap');
  assert.doesNotMatch(fs, /vec2 sc = vec2\(atan\(d\.x, d\.z\), asin\(clamp\(d\.y, -1\.0, 1\.0\)\)\);/, 'and no lat-long star field');
  // A cube: six faces, the major axis chosen, the cell id carrying its face.
  assert.match(fs, /vec3 cubeSnap\(vec3 dir, float n, out vec2 cellOut\) \{/);
  assert.match(fs, /if \(a\.x >= m\) \{ raw = dir\.zy \/ a\.x; face = dir\.x > 0\.0 \? 0\.0 : 1\.0; \}/);
  // AUDIT 39 F53 MOVED THIS PIN: cellOut is the CONTINUOUS face
  // coordinate now (the id is floor(cellOut)), because the star field
  // needs the fragment's position inside its cell and fract() of an
  // integer is zero. The face offset is integral, so flooring before or
  // after the add names the same cell and the seam law is unchanged.
  assert.match(fs, /cellOut = uv \* n \+ face \* 977\.0;/, 'a face\'s cells are its own, so the dither does not run across a seam');
  assert.match(fs, /cell = floor\(cell\);/, 'and the dither indexes the cell, not its interior');
  // EQUI-ANGULAR: a plain cube face is a tangent plane, so its cells
  // cover 2.6x less sky at the corners - a cell size that varies across
  // the frame beats against the screen grid and draws curved rings,
  // which is the pole's ghost rather than its cure.
  assert.match(fs, /vec2 uv = atan\(raw\) \* 1\.27323954;/, '4/PI: the face is warped to equal angles');
  assert.match(fs, /vec2 t = tan\(\(cell \+ 0\.5\) \/ n \* 0\.78539816\);/, 'PI/4: and warped back to rebuild the ray');
  // ...which makes the count exact: 90 degrees a face over n cells at
  // one step each, so n = (PI/2)/step, 256 a face, 512 across 180 -
  // SKY??.DAT's own width, which is the whole point of the step.
  const n = (Math.PI / 2) / RETRO.step;
  assert.ok(Math.abs(n - 256) < 1e-9, `${n} cells a face`);
  assert.ok(Math.abs(1.57079633 / RETRO.step - 256) < 1e-4, 'and the shader computes the same n');
  // The star field rides the same cube, so it has no pinwheel and no
  // density pile-up at a pole - and its scales were raised to keep the
  // count, because a cube covers the sphere with far fewer cells.
  // EE2 F2: the RETRO snap still uses cubeSnap on the turned frame -
  // that is what the cube grid is for - but the STAR field no longer
  // does, because cubeSnap hands back an integer cell and the stars
  // needed a position inside it. Both laws hold; they are asserted on
  // their own sites now.
  assert.match(fs, /if \(uRetroStep > 0\.0\) dir = cubeSnap\(dir, 1\.57079633 \/ uRetroStep, cell\);/, 'the retro pass still snaps on the cube');
  assert.match(fs, /vec2 g = atan\(raw2\) \* 1\.27323954 \* scale/, 'and the stars sit on the same equi-angular faces');
  assert.match(fs, /float scale = layer == 0 \? 127\.0 : 236\.0;/);
});

// ═══ EE2: the two sky faults the Enhanced Environments lab found ════
test('EE2: the deck reaches the horizon, and the star field is not ruled into rows', () => {
  const fs = read('src/render/enhancedSky.js');
  // F1: the projection runs away as the ray flattens - at the horizon
  // the lookup reaches the tens of thousands and a float32 loses its
  // fraction, so the noise returns a constant and the largest part of
  // the sky carried no cloud whatever the cover said.
  assert.match(fs, /vec2 p = dir\.xz \* min\(1\.0 \/ \(dir\.y \+ 0\.18\), 9\.0\) \* scale \+ wind \* uTime;/,
    'the deck projection must be capped or the horizon has no cloud');
  // F2: the cell id and the position inside it must be the floor and
  // the fract of ONE number. cubeSnap returns an integer cell, so
  // fract() of it was a constant and every star sat on the same line.
  assert.match(fs, /vec2 cell = floor\(g\), f = fract\(g\);/);
  const stars = fs.slice(fs.indexOf('float stars('), fs.indexOf('float stars(') + 3200);
  const code = stars.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/cubeSnap/.test(code), 'the star field must not take its position from a cell id');
  assert.match(stars, /vec2 g = atan\(raw2\) \* 1\.27323954 \* scale \+ vec2\(face2 \* 977\.0/,
    'one number for the cell and the offset, on the cube\u2019s own equi-angular faces');
});

// ═══ EE3: the ground's sampler follows the switch ═══════════════════
test('EE3: mipmaps and anisotropy on the enhanced ground, NEAREST for classic', () => {
  const r = read('src/render/renderer.js');
  // the classic look is untouched: a 64px tile sampled NEAREST is
  // Daggerfall's own, and the classic skin keeps it exactly.
  assert.match(r, /gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MIN_FILTER, gl\.NEAREST\);/);
  // and the enhanced ground gets the mip chain, which is what stops
  // the boiling at distance - and is a PREREQUISITE for any higher
  // resolution tile, since more texels alias worse without it.
  assert.match(r, /if \(this\.enhancedGround\) \{\s*\n\s*gl\.generateMipmap\(gl\.TEXTURE_2D_ARRAY\);/);
  assert.match(r, /gl\.TEXTURE_MIN_FILTER, gl\.LINEAR_MIPMAP_LINEAR\);/);
  assert.match(r, /aniso\.TEXTURE_MAX_ANISOTROPY_EXT/, 'ground is seen at grazing angles almost always');
  assert.match(r, /this\.enhancedGround = false;/, 'and it defaults OFF, so classic cannot inherit it');
  // both hosts set it before the upload, because the sampler state is
  // chosen there and the array is cached afterwards
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /renderer\.enhancedGround = isEnhanced\(\) && getPref\('enhancedEnvironments'\);\n\s*renderer\.uploadTileArray\(/,
      `${host} must set the flag immediately before the upload`);
  }
});

test('AUDIT 44: the tile array cache is keyed by MODE, and the probe drives the real row', () => {
  const r = read('src/render/renderer.js');
  // F2: the cache lives on the renderer, which survives a world load,
  // so keying it by archive alone made the switch a page-reload-only
  // setting while the row promised "when the world next loads".
  assert.match(r, /const key = `\$\{archive\}:\$\{this\.enhancedGround \? 'e' : 'c'\}`;/);
  assert.match(r, /if \(this\.tileArrays\.has\(key\)\) return this\.tileArrays\.get\(key\);/);
  assert.match(r, /this\.tileArrays\.set\(key, tex\);/);
  assert.ok(!/tileArrays\.(has|get|set)\(archive/.test(r), 'the archive alone must not key the cache');
  // F1: the menu probe drove a row that no longer exists, so it would
  // have failed on a row it could not find rather than on a fault.
  const probe = read('tools/enhancedMenuProbe.mjs');
  assert.ok(!/proceduralSky|Procedural sky/.test(probe), 'the probe must drive the switch that exists');
  assert.match(probe, /hasText: 'Enhanced environments'/);
  assert.match(probe, /m\.getPref\('enhancedEnvironments'\)/);
});
