// WEATHER2d (Mac, 2026-09-14: "a new sand storm weather event for desert regions... being able to see a large wall of
// sandstorm cloud in the distance"): THE SANDSTORM. The port's own eighth weather word, appended so DFU's seven keep
// their enum values, never rolled: the weather field stands it as cells over the desert tables' land on a cloudy or
// thunder day. Its fog row, sun scale, sky row, cloud profile (a wall on the ground) and tint, wind violence, grass dim
// and sand (the wisps' program in the sand's look, on the front's intensity) - every seam a word reaches, pinned here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEATHER_TYPES, FOG_SETTINGS, fogForWeather, weatherSunlightScale, precipitationForWeather, skyOffsetForWeather, weatherRng } from '../src/world/weather.js';
import { WEATHER_SKY, weatherRow } from '../src/render/enhancedSky.js';
import { VC_PROFILE, CELL_TINT, cellOf, packCells, slabOf, CLOUD_FIELD_GLSL, MARCH_FS, FIELD_UNIFORMS } from '../src/render/volumetricClouds.js';
import { VIOLENCE, createWindModel } from '../src/systems/wind.js';
import { LAB_DIM } from '../src/render/labGrass.js';
import { PRECIP_PEAK, precipKind, soundWeather, createWeatherFront } from '../src/systems/weatherFront.js';
import { CELL_WORDS, SAND_FROM, sandCountry, cellSeats, cellCandidate, fieldAt, baseWordOf } from '../src/systems/weatherField.js';
import {
  resetWeatherSim, setWeatherFieldLaw, setSnowGroundLaw, sampleWeatherField, importClimateWeathers, currentWeather, currentWeatherRaw, WEATHER_ENUM, overGround, setWeatherMapLaw,
} from '../src/systems/weatherSim.js';
import { WindWispsRenderer, wispCount, SAND_LOOK, WISP_LOOK, WISP_MAX, WISP_FLOOR, WISP_FS, WISP_VS } from '../src/render/windWisps.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const E = WEATHER_ENUM;
const DESERT = () => CLIMATES.Desert;
const WOODS = () => CLIMATES.Woodlands;
/** a cloudy day in the desert, a rain day in the woods */
const wordOf = (c) => (c === CLIMATES.Desert || c === CLIMATES.Desert2 ? 'cloudy' : c === CLIMATES.Woodlands ? 'rain' : 'sunny');
function placesOn(day, climateAt, word) {
  let inside = null, clear = null;
  for (let x = 100000; x < 500000 && !(inside && clear); x += 4000) {
    for (let z = 100000; z < 300000 && !(inside && clear); z += 4000) {
      const f = fieldAt({ day, minuteOfDay: 0, at: [x, z], climateAt, wordOfClimate: wordOf });
      if (f.inside?.word === word && !inside) inside = [x, z];
      if (!f.inside && !clear) clear = [x, z];
    }
  }
  return { inside, clear };
}
function stubGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 8, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19 };
  let ids = 0;
  const gl = new Proxy({}, { get(_, k) {
    if (k in consts) return consts[k];
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return () => ++ids;
    return (...args) => { calls.push([k, ...args]); };
  } });
  return { gl, calls };
}

test('WEATHER2d the word: the eighth, appended - DFU\'s seven keep their enum; its fog row (denser than the heavy fog, the sky in it), sun scale, sand precipitation, the default sky offset', () => {
  assert.equal(WEATHER_TYPES[7], 'sandstorm'); assert.equal(WEATHER_TYPES.length, 8); assert.equal(E.sandstorm, 7);
  assert.deepEqual(WEATHER_TYPES.slice(0, 7), ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow']);
  assert.deepEqual(FOG_SETTINGS.sandstorm, { mode: 'exp', density: 0.09, start: 0, end: 0, excludeSky: false });
  assert.ok(FOG_SETTINGS.sandstorm.density > FOG_SETTINGS.heavy.density);
  assert.equal(fogForWeather('sandstorm'), FOG_SETTINGS.sandstorm);
  const five = { sunny: 1, overcast: 2, rainy: 3, snowy: 4, heavy: 5 };
  assert.equal(fogForWeather('sandstorm', five), 5, 'a mod\'s five settings: the heavy fog stands in');
  assert.equal(weatherSunlightScale('sandstorm', false), 0.35); assert.equal(weatherSunlightScale('sandstorm', true), 0.35, 'winter first, the weather overrides');
  assert.ok(weatherSunlightScale('sandstorm', false) > weatherSunlightScale('thunder', false) && weatherSunlightScale('sandstorm', false) < weatherSunlightScale('rain', false));
  assert.equal(precipitationForWeather('sandstorm'), 'sand');
  assert.equal(skyOffsetForWeather('sandstorm', weatherRng(1)), 0, 'the classic panorama has no sand sky: the season\'s');
});

test('WEATHER2d the sky, the clouds, the wind, the grass: a tan row; a wall on the ground with a lid 900 m up; a tinted cell; a gale; a dimmed field', () => {
  assert.deepEqual(WEATHER_SKY.sandstorm, { cover: 0.90, soft: 0.30, grey: 0.70, lit: '#d8b47a', shade: '#8a6a3c', wind: [0.040, 0.014] });
  assert.equal(Object.keys(WEATHER_SKY).length, WEATHER_TYPES.length);
  assert.ok(weatherRow('sandstorm').cover === 0.9, 'the eased row reads it');
  assert.deepEqual(VC_PROFILE.sandstorm, { base: 0, top: 900, density: 1.00, dark: 0.35, flat: 0.95, shear: 0.05, vary: 0.00 });   // VC6a: a wall is one thing everywhere
  assert.deepEqual(CELL_TINT, { sandstorm: [0.88, 0.72, 0.46] });
  const c = cellOf('sandstorm', 10, 20, 9000);
  assert.deepEqual(c.tint, CELL_TINT.sandstorm); assert.equal(c.base, 0); assert.equal(c.cover, 0.9);
  assert.equal(cellOf('thunder', 0, 0, 1).tint, undefined, 'only the word that has one');
  assert.deepEqual(slabOf(VC_PROFILE.sunny, [c]), { base: 0, top: 3200 }, 'the union slab reaches the ground');
  const k = packCells([c, cellOf('rain', 0, 0, 1)], 8);
  assert.deepEqual([...k.t.slice(0, 8)], [0.88, 0.72, 0.46, 0, 1, 1, 1, 0.25].map((v) => Math.fround(v)), 'the tints, white for a word without one; VC6a: the spare w is the cell\'s own type variation - a sandstorm 0, rain its row\'s');
  assert.match(CLOUD_FIELD_GLSL, /uniform vec4 uCellC\[8\];/); assert.match(CLOUD_FIELD_GLSL, /fTint = mix\(fTint, uCellC\[i\]\.rgb, w\);/);
  assert.match(CLOUD_FIELD_GLSL, /fGrey = 0\.0; fTint = vec3\(1\.0\); fVary = uVary;/, 'the zone is untinted, and varies by its own row');
  assert.match(MARCH_FS, /\* fTint;   \/\/ WEATHER2d: the cell's tint/); assert.ok(FIELD_UNIFORMS.includes('uCellC'));
  assert.equal(VIOLENCE.sandstorm, 0.95); assert.ok(VIOLENCE.sandstorm < VIOLENCE.thunder && VIOLENCE.sandstorm > VIOLENCE.rain);
  const m = createWindModel({ seed: 3 }); m.tick(0, 'sunny'); m.tick(600, 'sandstorm');
  assert.ok(m.state().front.strength > 0.5, 'a front worth the name');
  assert.equal(LAB_DIM.sandstorm, 0.55);
});

test('WEATHER2d the front and the ear: the sand is its own kind with a heavy peak, a sandstorm word fills the sand in, and the ambience hears a cloudy day (the wind loop is the storm\'s voice)', () => {
  assert.deepEqual(PRECIP_PEAK.sand, [0.5, 1.0]);
  assert.equal(precipKind('sand'), 'sand'); assert.equal(precipKind('rain'), 'rain'); assert.equal(precipKind('storm'), 'rain'); assert.equal(precipKind('snow'), 'snow');
  assert.equal(soundWeather({ shown: 'sand' }, 'sandstorm'), 'cloudy'); assert.equal(soundWeather({ shown: null }, 'sandstorm'), 'cloudy');
  const f = createWeatherFront({ seed: 1 });
  const s0 = f.tick({ dt: 0.016, weather: 'sandstorm', arrival: 1, nowMinutes: 100, tsec: 1, jump: true });
  assert.equal(s0.shown, 'sand'); assert.equal(s0.kind, 'sand'); assert.ok(s0.intensity >= PRECIP_PEAK.sand[0] * 0.6 - 1e-9, 'a boot into a sandstorm is a sandstorm');
  const s1 = f.tick({ dt: 0.016, weather: 'cloudy', arrival: 0.1, nowMinutes: 101, tsec: 2 });
  assert.equal(s1.shown, 'sand', 'the sand thins out over the arrival\'s first stretch');
});

test('WEATHER2d the field: a sandstorm seats on the desert tables\' land under a cloudy or thunder word and nowhere else; inside one the word is sandstorm, between them the zone\'s own; the ground law passes it', () => {
  assert.deepEqual(CELL_WORDS.sandstorm, { spacing: 30000, radius: [8000, 14000], p: 0.5, base: 'cloudy' });
  assert.deepEqual(SAND_FROM, ['cloudy', 'thunder']);
  assert.ok(sandCountry(CLIMATES.Desert) && sandCountry(CLIMATES.Desert2));
  for (const c of [CLIMATES.Subtropical, CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Swamp]) assert.equal(sandCountry(c), false, `${c}: the desert TABLE's land only (the subtropics have their own table)`);
  assert.equal(cellSeats('sandstorm', CLIMATES.Desert, 'cloudy'), true); assert.equal(cellSeats('sandstorm', CLIMATES.Desert, 'thunder'), true);
  assert.equal(cellSeats('sandstorm', CLIMATES.Desert, 'sunny'), false); assert.equal(cellSeats('sandstorm', CLIMATES.Woodlands, 'cloudy'), false);
  assert.equal(cellSeats('rain', CLIMATES.Woodlands, 'rain'), true); assert.equal(cellSeats('rain', CLIMATES.Woodlands, 'cloudy'), false);
  assert.equal(baseWordOf('cloudy'), 'cloudy', 'between the storms the zone\'s own sky');
  assert.ok(cellCandidate('sandstorm', 3, 4, 5) === null || cellCandidate('sandstorm', 3, 4, 5).r >= 8000);
  const { inside, clear } = placesOn(21, DESERT, 'sandstorm');
  assert.ok(inside && clear, 'a cloudy desert day has sandstorms and clear sky');
  const fi = fieldAt({ day: 21, minuteOfDay: 0, at: inside, climateAt: DESERT, wordOfClimate: wordOf });
  assert.equal(fi.word, 'sandstorm'); assert.equal(fi.zoneWord, 'cloudy'); assert.ok(fi.cells.every((c) => c.word === 'sandstorm'));
  const fc = fieldAt({ day: 21, minuteOfDay: 0, at: clear, climateAt: DESERT, wordOfClimate: wordOf });
  assert.equal(fc.word, 'cloudy');
  // a sunny desert day: none; a cloudy woodland day: none (rain cells only, and today the woods rain)
  const sunnyDesert = fieldAt({ day: 21, minuteOfDay: 0, at: inside, climateAt: DESERT, wordOfClimate: () => 'sunny' });
  assert.deepEqual(sunnyDesert.cells, []); assert.equal(sunnyDesert.word, 'sunny');
  const woods = fieldAt({ day: 21, minuteOfDay: 0, at: inside, climateAt: WOODS, wordOfClimate: () => 'cloudy' });
  assert.deepEqual(woods.cells, []); assert.equal(woods.word, 'cloudy');
  // through the sim: the array's desert slot cloudy, the field's word at the place, the ground law untouched (never rain nor thunder)
  resetWeatherSim(); setWeatherMapLaw(false); setWeatherFieldLaw(true); setSnowGroundLaw(true);   // WEATHER3b: the day-roll machine's pin - on the map's lane the map is the sky and this machine stands down (weather3b pins that)
  importClimateWeathers(Uint8Array.of(E.cloudy, E.sunny, E.sunny, E.sunny, E.sunny, E.sunny));
  const now = 21 * 1440;
  assert.equal(sampleWeatherField(now, CLIMATES.Desert, inside, DESERT, 'jump'), true);
  assert.equal(currentWeather(), 'sandstorm'); assert.equal(currentWeatherRaw(), 'sandstorm');
  assert.equal(overGround(E.sandstorm, CLIMATES.Woodlands, 0), E.sandstorm, 'a sandstorm over a winter woodland (it never is) would still be sand, not snow');
  assert.equal(sampleWeatherField(now, CLIMATES.Desert, clear, DESERT, 'live'), true);
  assert.equal(currentWeather(), 'cloudy');
  resetWeatherSim(); setWeatherMapLaw(false);
});

test('WEATHER2d the sand: the wisps\' program in the sand\'s look - tan, dense, short, a lower box, no floor - the front\'s intensity its strength; the look is a uniform set, the wisps\' own unchanged', () => {
  assert.deepEqual(SAND_LOOK, { color: [0.80, 0.64, 0.40], alpha: [0.28, 0.30], len: [0.8, 1.2], count: 7000, floor: 0, box: 70, curl: 0 });   // WIND5: the sand's streaks stay straight
  assert.deepEqual(WISP_LOOK, { color: [0.86, 0.89, 0.94], alpha: [0.10, 0.12], len: [2.6, 2.0], count: WISP_MAX, floor: WISP_FLOOR, box: 90, curl: 1 });   // WIND5: a flourish - longer, to hold its curl   // WIND4: the count and the floor are the look's own constants, cut there
  assert.equal(wispCount(0, SAND_LOOK), 0, 'no sand without a storm'); assert.equal(wispCount(1, SAND_LOOK), 7000);
  assert.ok(wispCount(0.5, SAND_LOOK) > 0 && wispCount(0.5, SAND_LOOK) < 7000);
  assert.equal(wispCount(0), Math.round(WISP_MAX * WISP_FLOOR), 'the wisps keep their floor');
  assert.match(WISP_VS, /uniform vec2 uWindV, uWindOff, uLen;/); assert.match(WISP_FS, /uniform vec3 uColor;/); assert.match(WISP_FS, /uniform vec2 uAlpha;/);
  assert.match(WISP_VS, /float len = \(uLen\.x \+ fract\(seed\*13\.1\)\*uLen\.y\) \* \(0\.5 \+ uStrength\);/);
  const { gl, calls } = stubGl();
  const sand = new WindWispsRenderer(gl, SAND_LOOK);
  assert.equal(sand.look, SAND_LOOK);
  assert.equal(calls.find((c) => c[0] === 'bufferData' && c[2].length === 7000 * 4)?.[2].length, 7000 * 4, 'seven thousand instances in the sand\'s box');
  const proj = new Float32Array(16); proj[0] = proj[5] = proj[10] = proj[15] = 1;
  calls.length = 0;
  sand.draw({ on: true, strength01: 0.75, windV: [20, 5], step: [1, 0.25], gust: 1 }, proj, proj, new Float32Array([0, 0, 0]), 3);
  const dr = calls.find((c) => c[0] === 'drawArraysInstanced');
  assert.equal(dr[4], wispCount(0.75, SAND_LOOK));
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uColor')?.[2], SAND_LOOK.color);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uAlpha')?.slice(2), [0.28, 0.30]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uLen')?.slice(2), [0.8, 1.2]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uBox')?.slice(2), [70]);
  for (let i = 0; i < 1000; i++) sand.advance([9, -9]);
  assert.ok(sand.windOff[0] >= 0 && sand.windOff[0] < 70 && sand.windOff[1] >= 0 && sand.windOff[1] < 70, 'wrapped to the sand\'s own box');
  sand.draw({ on: true, strength01: 0, windV: [0, 0], step: [0, 0], gust: 1 }, proj, proj, new Float32Array([0, 0, 0]), 4);
  assert.equal(sand.drawn, 0, 'a storm at nothing draws nothing');
});

test('WEATHER2d the hosts: the sand renderer built on the enhanced lane, the sand drawn before the rain\'s branch on the front\'s intensity as a foreign pass, and the rain program never built for it', () => {
  for (const [name, s, eye] of [['world', rd('src/scenes/world.js'), 'cam.pos'], ['exterior', rd('src/scenes/exterior.js'), 'eye']]) {
    assert.match(s, /const sand = sky\.enhanced \? new WindWispsRenderer\(renderer\.gl, SAND_LOOK\) : null;/, `${name}: built at boot`);
    assert.match(s, /if \(precipMode && precipMode !== 'sand' && !precip\) precip = new PrecipitationRenderer\(renderer\.gl, precipOpts\);/, `${name}: the rain program is not the sand's`);
    const i = s.indexOf("if (precipShown === 'sand') {");
    assert.ok(i > 0, `${name}: the sand branch`);
    assert.ok(s.slice(i, i + 600).includes(`sand.draw({ on: true, strength01: fx.intensity, windV: wd.windV, step: wd.step, gust: wd.gust }, proj, view, new Float32Array(${eye}), now / 1000);\n        renderer.markForeignPass();`), `${name}: the front's intensity, the one wind, a foreign pass`);
    assert.ok(s.slice(i, i + 800).includes('} else if (precipShown && precip) {'), `${name}: the rain's branch after it`);
    assert.ok(s.includes("SAND_LOOK } from '../render/windWisps.js'"), `${name}: imported`);
  }
});

test('WEATHER2d records: the arc page\'s D and its close, the ledger row, Home\'s index and the testing row', () => {
  assert.match(rd('bible/07-Rendering/Weather-Arc.md'), /^## D - THE SANDSTORM \(WEATHER2d, 2026-09-14\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /^\| \*\*THE SANDSTORM \(WEATHER2d, 2026-09-14\)\*\*/m);
  assert.match(rd('bible/Home.md'), /D: the sandstorm/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| weather2d_sandstorm\.test\.js \| \d+ \| WEATHER2d/m);
});
