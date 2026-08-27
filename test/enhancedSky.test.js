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
  assert.match(shared, /const enhancedSky = isEnhanced\(\) && params\.get\('sky'\) !== 'classic' \? new EnhancedSkyRenderer\(gl\) : null;/,
    'the enhanced sky is the skin\'s, with ?sky=classic the escape hatch');
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
