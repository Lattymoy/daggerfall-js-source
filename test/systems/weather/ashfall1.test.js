// ASHFALL1 (the owner, 2026-10-27: "I think with the volcanic isles we could do an ashfall sort of weather with tiny lava
// flakes" - "I also definitely want to develop the new weather I mentioned"): THE ASHFALL. The port's own NINTH weather
// word, appended as the sandstorm was, never rolled: the world weather map births it over the volcano's country past the
// Bay - a zone's `ash`, the share of its sky's hours under the ash (Red Mountain half, the Ashlands TES III's 30%,
// Stonefalls ESO's ashfall at 15%) - taken from the dry sky and never from what falls. Every seam a word reaches: its
// fog, sun, flags and fall; the front, the ear, the sky row, the pall's cloud, tint and veil; the wind, the grass, the
// body's air; the forecast; and the fall itself - grey ash and the tiny embers among it, glowing and cooling - drawn by
// the dry falls' one renderer beside the sandstorm's sand. bible/07-Rendering/Weather-Arc.md, E.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weatherKeyForWeather } from '../../../src/systems/ambientText.js';
import { WEATHER_TYPES, FOG_SETTINGS, fogForWeather, weatherSunlightScale, weatherFlags, precipitationForWeather, isDryFall, skyOffsetForWeather, weatherRng } from '../../../src/world/weather.js';
import { WEATHER_ENUM } from '../../../src/systems/weather/weatherTable.js';
import { WEATHER_TABLE } from '../../../src/systems/weather/weatherTable.js';
import {
  PRIORITY, SYSTEM_TYPES, STRENGTH, CLOUD_COVER, SKY_WEIGHT, targetShares, birthLaw, birthsIn, weatherAt, resetWeatherMap,
} from '../../../src/systems/weather/weatherMap.js';
import { CELL_WORDS, ASH_FROM, ASH_FIELD_GAIN, ashAtPixel, cellSeats, fieldAt, pixelOfField } from '../../../src/systems/weather/weatherField.js';
import { PRECIP_PEAK, PRECIP_SKEW, precipKind, soundWeather, fallTerms, createWeatherFront } from '../../../src/systems/weather/weatherFront.js';
import { BIOMES, BIOME_BY_KEY, ASH_COUNTRY, tamrielBiomeAt } from '../../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay, inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { tamrielClimateAt } from '../../../src/world/tamriel/tamrielGround.js';
import { WEATHER_SKY } from '../../../src/render/enhancedSky.js';
import { VC_PROFILE, CELL_TINT, CURTAIN_FALL, CIRRUS_COVER, cellOf } from '../../../src/render/volumetricClouds.js';
import { curtainsOf, mixColor, CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR } from '../../../src/render/rainCurtains.js';
import { VIOLENCE } from '../../../src/systems/wind/wind.js';
import { windfallWeather } from '../../../src/systems/windfall.js';
import { LAB_DIM } from '../../../src/render/labGrass.js';
import { JUNGLE_HAZE } from '../../../src/world/jungle/jungleHaze.js';
import { WEATHER_TEMP, WEATHER_NAMES, WEATHER_WET } from '../../../src/systems/survival/temperature.js';
import { FORECAST_WORDS, FORECAST_NOTABLE } from '../../../src/systems/weather/owForecast.js';
import {
  DryFallRenderer, AshFallRenderer, ASH_LOOK, EMBER_LOOK, ASH_BOX, ASH_VS, ASH_FS, ASH_SWAY_CYCLES, DRY_CLOCK_PERIOD, DRY_MIN_PX, dryCount,
} from '../../../src/render/dryFall.js';
import { SAND_LOOK, WISP_GUST_DIV } from '../../../src/render/windWisps.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { SEASONS } from '../../../src/systems/gameDate.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { MAX_MAP_PIXEL_Y } from '../../../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const DRY = ['cloudy', 'overcast', 'fog', 'sandstorm'];
/** The hosts' map with the continent round the Bay: the Bay's woods, a zone's ground past it. */
const continent = (x, y) => (inBay(x, y) ? CLIMATES.Woodlands : tamrielClimateAt(x, y));

/** Each Morrowind zone's pixel nearest its middle (every 4th pixel of the frame read once). */
let _hearts = null;
function hearts() {
  if (_hearts) return _hearts;
  const f = tamrielFrameInBay(), seen = {};
  for (let y = Math.ceil(f.y0); y < f.y0 + f.h; y += 4) for (let x = Math.ceil(f.x0); x < f.x0 + f.w; x += 4) {
    const b = tamrielBiomeAt(x, y);
    if (b?.province === 'Morrowind') (seen[b.key] ??= []).push([x, y]);
  }
  _hearts = {};
  for (const [k, px] of Object.entries(seen)) {
    const cx = px.reduce((a, p) => a + p[0], 0) / px.length, cy = px.reduce((a, p) => a + p[1], 0) / px.length;
    _hearts[k] = px.reduce((best, p) => ((p[0] - cx) ** 2 + (p[1] - cy) ** 2 < (best[0] - cx) ** 2 + (best[1] - cy) ** 2 ? p : best));
  }
  return _hearts;
}
const fieldOfPixel = ([x, y]) => [(x + 0.5) * TERRAIN_SIZE, (MAX_MAP_PIXEL_Y - 1 - y + 0.5) * TERRAIN_SIZE];
function stubGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 8, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19, ONE: 20, drawingBufferHeight: 1000 };
  let ids = 0;
  const gl = new Proxy({}, { get(_, k) {
    if (k in consts) return consts[k];
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'getExtension') return () => null;
    if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return () => ++ids;
    return (...args) => { calls.push([k, ...args]); };
  } });
  return { gl, calls };
}

test('ASHFALL1 the word: the ninth, appended - DFU\'s seven and the sandstorm keep their enum; its haze (thicker than the snow\'s, the pall seen over it), its sun, an overcast to every flag\'s reader, and its fall a dry one (mutants: the fog row; the sun; the flag; the fall\'s mode)', () => {
  assert.equal(WEATHER_TYPES.length, 9); assert.equal(WEATHER_TYPES[8], 'ashfall'); assert.equal(WEATHER_ENUM.ashfall, 8);
  assert.deepEqual(WEATHER_TYPES.slice(0, 8), ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow', 'sandstorm']);
  assert.deepEqual(FOG_SETTINGS.ashfall, { mode: 'exp', density: 0.006, start: 0, end: 0, excludeSky: true });
  assert.ok(FOG_SETTINGS.ashfall.density > FOG_SETTINGS.snowy.density && FOG_SETTINGS.ashfall.density < FOG_SETTINGS.heavy.density);
  assert.equal(fogForWeather('ashfall'), FOG_SETTINGS.ashfall);
  assert.equal(fogForWeather('ashfall', { sunny: 1, overcast: 2, rainy: 3, snowy: 4, heavy: 5 }), 4, 'a mod\'s five settings: the snow\'s haze stands in');
  assert.equal(weatherSunlightScale('ashfall', false), 0.4); assert.equal(weatherSunlightScale('ashfall', true), 0.4);
  assert.ok(weatherSunlightScale('ashfall', false) < weatherSunlightScale('rain', false) && weatherSunlightScale('ashfall', false) > weatherSunlightScale('sandstorm', false));
  assert.deepEqual({ ...weatherFlags('ashfall') }, { raining: false, storming: false, snowing: false, overcast: true });
  assert.equal(weatherKeyForWeather('ashfall'), 'Cloudy', 'Ambient Text hears an overcast, as for the sandstorm');
  assert.equal(precipitationForWeather('ashfall'), 'ash');
  assert.ok(isDryFall('ash') && isDryFall('sand')); for (const m of ['rain', 'storm', 'snow', null, undefined]) assert.equal(isDryFall(m), false, String(m));
  assert.equal(skyOffsetForWeather('ashfall', weatherRng(1)), 0, 'the classic panorama has no ash sky: the season\'s');
});

test('ASHFALL1 the volcano\'s country: Red Mountain, the Ashlands and Stonefalls name their ash - half, TES III\'s 30% and ESO\'s ashfall at 15% - and no other zone; each [climate, ash] once (mutants: a zone\'s share; the country\'s pairs)', () => {
  assert.equal(BIOME_BY_KEY.get('morrowindRedMountain').ash, 0.5);
  assert.equal(BIOME_BY_KEY.get('morrowindAshlands').ash, 0.3);
  assert.equal(BIOME_BY_KEY.get('morrowindStonefalls').ash, 0.15);
  assert.deepEqual(BIOMES.filter((b) => b.ash).map((b) => b.key).sort(), ['morrowindAshlands', 'morrowindRedMountain', 'morrowindStonefalls']);
  assert.deepEqual(ASH_COUNTRY.map((p) => [...p]), [[CLIMATES.Mountain, 0.3], [CLIMATES.Mountain, 0.5], [CLIMATES.Mountain, 0.15]]);
  // the ash at a pixel: the zone's where the host's map wears the zone, none on the Bay or where the map has no continent
  const h = hearts();
  assert.equal(ashAtPixel(continent, ...h.morrowindRedMountain), 0.5);
  assert.equal(ashAtPixel(continent, ...h.morrowindAshlands), 0.3);
  assert.equal(ashAtPixel(continent, ...h.morrowindGrazelands), 0, 'a Morrowind zone with no ash');
  assert.equal(ashAtPixel(() => -1, ...h.morrowindRedMountain), 0, 'a map with nothing past the Bay: no volcano');
  assert.equal(ashAtPixel(continent, 400, 200), 0, 'the Bay');
});

test('ASHFALL1 the law: a zone\'s ash is that share of its sky\'s hours, out of the clear air and the dry words in proportion - the table\'s rain, storms and snow keep theirs - and the law solves to it (mutants: the ash from the wet; the clear air untouched; the share; one law for every ash)', () => {
  for (const season of Object.values(SEASONS)) {
    const base = targetShares(WEATHER_TABLE.mountains, season), clear0 = 1 - Object.values(base).reduce((a, b) => a + b, 0);
    assert.equal(base.ashfall, 0, 'no ash off the volcano');
    for (const ash of [0.15, 0.3, 0.5]) {
      const t = targetShares(WEATHER_TABLE.mountains, season, ash), clear = 1 - Object.values(t).reduce((a, b) => a + b, 0);
      assert.equal(t.ashfall, ash, `${season} ${ash}: its share of the hours`);
      for (const w of ['rain', 'thunder', 'snow']) assert.equal(t[w], base[w], `${season} ${ash}: ${w} keeps its hours`);
      const k = 1 - ash / (clear0 + DRY.reduce((s, w) => s + base[w], 0));
      for (const w of DRY) assert.ok(Math.abs(t[w] - base[w] * k) < 1e-12, `${season} ${ash}: ${w} gives its share`);
      assert.ok(Math.abs(clear - clear0 * k) < 1e-12, `${season} ${ash}: and the clear air its`);
      const law = birthLaw(CLIMATES.Mountain, season, ash);
      assert.notEqual(law, birthLaw(CLIMATES.Mountain, season), 'its own law');
      assert.equal(law, birthLaw(CLIMATES.Mountain, season, ash), 'solved once');
      assert.ok(law.weight.ashfall > (ash > 0.15 ? birthLaw(CLIMATES.Mountain, season, ash / 2).weight.ashfall : 0), `${season} ${ash}: more ash, more births`);
      for (const w of ['thunder', 'rain', 'snow']) assert.ok(Math.abs(law.weight[w] - birthLaw(CLIMATES.Mountain, season).weight[w]) < 1e-9, `${season} ${ash}: the ${w} systems born as ever`);
    }
    assert.equal(birthLaw(CLIMATES.Mountain, season).weight.ashfall, 0, 'none born off it');
    for (const c of [CLIMATES.Woodlands, CLIMATES.Desert, CLIMATES.Swamp]) assert.equal(birthLaw(c, season).weight.ashfall, 0);
  }
  assert.equal(targetShares(WEATHER_TABLE.mountains, SEASONS.Winter, 0.9).ashfall, targetShares(WEATHER_TABLE.mountains, SEASONS.Winter, 1).ashfall, 'all the dry sky at most');
  // the system: a pall over the vents, the overcast its skirt, regional, slow, born at every hour, from a dusting to the heavy fall
  assert.deepEqual(SYSTEM_TYPES.ashfall, { core: [15000, 28000], rings: [['overcast', 0.8]], life: [360, 960], speed: 20, grow: 0.2, decay: 0.3, node: [80000, 720], diurnal: { other: [0, 0] } });
  assert.deepEqual(PRIORITY, ['thunder', 'rain', 'snow', 'sandstorm', 'ashfall', 'fog', 'overcast', 'cloudy']);
  assert.deepEqual(STRENGTH.ashfall, [0.35, 1]);
  assert.equal(CLOUD_COVER.ashfall, 1); assert.equal(SKY_WEIGHT.ashfall, 0.9);
});

test('ASHFALL1 the map: under the volcano the ash stands its law\'s share of the hours - Red Mountain half, the Ashlands near a third, Stonefalls a seventh - and the Grazelands, the Velothi wall and the Bay never; the births follow the land past the Bay (mutants: the ash unread; the climate unread; the births kept over a moved land)', () => {
  resetWeatherMap();
  const h = hearts(), share = (key) => {
    const [x, z] = fieldOfPixel(h[key]);
    let n = 0;
    for (let i = 0; i < 300; i++) if (weatherAt(x, z, 525600 + i * 1051 + (i % 7) * 97, continent).word === 'ashfall') n++;
    return n / 300;
  };
  const red = share('morrowindRedMountain'), ash = share('morrowindAshlands'), stone = share('morrowindStonefalls');
  assert.ok(red > 0.4 && red < 0.6, `Red Mountain ${red}`);
  assert.ok(ash > 0.2 && ash < 0.36, `the Ashlands ${ash}`);
  assert.ok(stone > 0.08 && stone < 0.22, `Stonefalls ${stone}`);
  assert.ok(red > ash && ash > stone, 'the nearer the vents, the more ash');
  for (const key of ['morrowindGrazelands', 'morrowindVelothi', 'morrowindDeshaan']) assert.equal(share(key), 0, key);
  for (let i = 0; i < 40; i++) assert.notEqual(weatherAt(200000 + i * 9000, 150000, 525600 + i * 4000, continent).word, 'ashfall', 'never on the Bay');
  // a map whose continent is not the zones' (its climate there another's): no ash
  const [rx, rz] = fieldOfPixel(h.morrowindRedMountain), woods = (x, y) => (inBay(x, y) ? CLIMATES.Woodlands : CLIMATES.Woodlands);
  for (let i = 0; i < 60; i++) assert.notEqual(weatherAt(rx, rz, 525600 + i * 1051, woods).word, 'ashfall');
  // the births are the land's as it stood: the zones' stamp moving (a fit, the trace landing) draws them again
  const a = birthsIn('ashfall', 0, 0, 900, continent);
  assert.equal(birthsIn('ashfall', 0, 0, 900, continent), a, 'kept');
  setTamrielFit({ ox: 862, oy: 976, ppu: 18.75 });
  try { assert.notEqual(birthsIn('ashfall', 0, 0, 900, continent), a, 'the land moved: drawn again'); } finally { setTamrielFit(null); }
  resetWeatherMap();
});

test('ASHFALL1 the field (?wxmap=off): an ash cell stands on the volcano\'s country under a dry word, its coin the seat\'s ash - never under what falls, never off the volcano (mutants: the coin; the dry words; the seat\'s ash unread)', () => {
  assert.deepEqual(CELL_WORDS.ashfall, { spacing: 30000, radius: [8000, 15000], p: 1, base: 'overcast' });
  assert.deepEqual(ASH_FROM, ['sunny', 'cloudy', 'overcast', 'fog']);
  assert.equal(ASH_FIELD_GAIN, 2.5);
  assert.equal(cellSeats('ashfall', CLIMATES.Mountain, 'sunny', 0.3, 0.7), true);
  assert.equal(cellSeats('ashfall', CLIMATES.Mountain, 'sunny', 0.3, 0.8), false, 'the coin: 0.3 x 2.5');
  assert.equal(cellSeats('ashfall', CLIMATES.Mountain, 'rain', 0.5, 0), false, 'never through rain');
  assert.equal(cellSeats('ashfall', CLIMATES.Mountain, 'cloudy', 0, 0), false, 'never off the volcano');
  const [x, z] = fieldOfPixel(hearts().morrowindRedMountain);
  let ashDays = 0;
  for (let day = 0; day < 40; day++) {
    const f = fieldAt({ day, minuteOfDay: 600, at: [x, z], climateAt: continent, wordOfClimate: () => 'cloudy' });
    if (f.cells.some((c) => c.word === 'ashfall')) ashDays++;
    for (const c of f.cells.filter((c) => c.word === 'ashfall')) { const p = pixelOfField(c.x, c.z); assert.ok(p.y < 0 || p.x >= 1000, 'past the Bay'); }
  }
  assert.ok(ashDays > 20, `ash cells about the volcano on ${ashDays} of 40 cloudy days`);
  const rainy = fieldAt({ day: 3, minuteOfDay: 600, at: [x, z], climateAt: continent, wordOfClimate: () => 'rain' });
  assert.equal(rainy.cells.filter((c) => c.word === 'ashfall').length, 0, 'a rain day: none');
});

test('ASHFALL1 the front and the ear: the ash is its own look, a dusting at its edge to the heavy fall; never the wet fall the rain and the snow share; heard as a cloudy day; its edge\'s haze thinned as a sprinkle\'s is (mutants: the look; the peak; the ear; the thinning)', () => {
  assert.deepEqual(PRECIP_PEAK.ash, [0.1, 1.0]); assert.equal(PRECIP_SKEW.ash, 1.3);
  assert.equal(precipKind('ash'), 'ash'); assert.equal(precipKind('sand'), 'sand'); assert.equal(precipKind('snow'), 'snow'); assert.equal(precipKind('storm'), 'rain');
  for (const s of [{ shown: 'ash' }, { shown: 'ash', rain: 0 }, { shown: null }, { shown: null, rain: 0 }]) assert.equal(soundWeather(s, 'ashfall'), 'cloudy', JSON.stringify(s));
  const f = createWeatherFront({ seed: 2 });
  const s0 = f.tick({ dt: 0.016, weather: 'ashfall', arrival: 1, nowMinutes: 100, tsec: 1, jump: true, peak: 1 });
  assert.equal(s0.shown, 'ash'); assert.equal(s0.kind, 'ash'); assert.ok(s0.intensity > 0.6);
  const light = { sun: 0.65, dim: 0.72 }, row = { sun: 0.4, dim: 0.58, fog: FOG_SETTINGS.ashfall };
  const dust = fallTerms(row, 0.05, 'ashfall', light);
  assert.equal(dust.sun, 0.65); assert.ok(Math.abs(dust.fog.density - 0.006 * 0.25) < 1e-12, 'a dusting\'s haze thin');
  assert.equal(fallTerms(row, 1, 'ashfall', light), row, 'the heavy fall: the row whole');
});

test('ASHFALL1 the sky: a brown-grey pall low, deep and dark, tinted, its veil hung under it in its tint; the body\'s air a fog\'s, dry; a breeze; a dim field (mutants: the tint; the veil untinted; the row)', () => {
  assert.deepEqual(WEATHER_SKY.ashfall, { cover: 0.96, soft: 0.24, grey: 0.85, lit: '#8c8178', shade: '#463d38', wind: [0.012, 0.004] });
  assert.deepEqual(VC_PROFILE.ashfall, { base: 450, top: 3400, density: 0.95, dark: 0.60, flat: 0.80, shear: 0.25, vary: 0.15 });
  assert.deepEqual(CELL_TINT.ashfall, [0.66, 0.60, 0.56]); assert.deepEqual(CURTAIN_FALL.ashfall, [0.9, 0]); assert.equal(CIRRUS_COVER.ashfall, 0.15);
  const c = cellOf('ashfall', 1, 2, 20000);
  assert.deepEqual(c.tint, CELL_TINT.ashfall); assert.equal(c.fall, 0.9); assert.equal(c.fallKind, 0);
  assert.match(rd('src/render/volumetricClouds.js'), /mix\(uCloudLit, uHorizonColor, 0\.4\), F\.y\) \* uCellC\[i\]\.rgb;/, 'the sky\'s veil in its cell\'s tint (white for a word with none)');
  const [veil] = curtainsOf([{ ...c, x: 0, z: 15000 }], { focus: [0, 0, 0], eye: [0, 400, 0] });
  assert.deepEqual(veil.tint, CELL_TINT.ashfall, 'the travel view\'s veil carries it');
  assert.deepEqual([...mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, 0, CELL_TINT.ashfall)], CURTAIN_RAIN_COLOR.map((v, i) => Math.fround(v * CELL_TINT.ashfall[i])));
  assert.deepEqual([...mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, 0)], [...CURTAIN_RAIN_COLOR].map(Math.fround), 'no tint: as it was');
  assert.equal(WEATHER_TEMP.ashfall, -5); assert.equal(WEATHER_TEMP.ashfall, WEATHER_TEMP.fog); assert.equal(WEATHER_WET.ashfall, undefined, 'dry');
  assert.equal(WEATHER_NAMES.ashfall, 'Ashfall');
  assert.equal(VIOLENCE.ashfall, 0.3); assert.equal(windfallWeather('ashfall'), WEATHER_ENUM.overcast);
  assert.equal(LAB_DIM.ashfall, 0.58); assert.equal(JUNGLE_HAZE.weather.ashfall, 1.12);
  assert.equal(FORECAST_WORDS.ashfall, 'Ashfall'); assert.ok(FORECAST_NOTABLE.has('ashfall'));
});

test('ASHFALL1 the fall: grey ash and the embers among it - two instance sets on one program, the ash blended, the embers ADDED; counts the front\'s share; the clock whole cycles and whole boxes over its period; the travel wrapped at the gust\'s span (mutants: the embers blended; the counts; the clock)', () => {
  assert.deepEqual(ASH_LOOK, { count: 12000, fall: [6, 7], size: [0.018, 0.03], color: [0.36, 0.34, 0.32], alpha: 0.72 });
  assert.deepEqual(EMBER_LOOK, { count: 320, fall: [3, 4], size: [0.008, 0.012], life: [40, 59], flicker: [1700, 900], gain: 1.6 });
  assert.equal(ASH_BOX, 40); assert.equal(DRY_CLOCK_PERIOD, 400); assert.deepEqual(ASH_SWAY_CYCLES, [50, 37]); assert.equal(DRY_MIN_PX, 1.5);
  assert.equal(dryCount(0, ASH_LOOK), 0); assert.equal(dryCount(1, ASH_LOOK), 12000); assert.equal(dryCount(0.5, EMBER_LOOK), 160); assert.equal(dryCount(7, EMBER_LOOK), 320);
  // the clock: every flake's fall whole boxes over the period, every rate whole cycles
  assert.match(ASH_VS, /float boxes = uFall\.x \+ floor\(fract\(seed\*7\.3\) \* \(uFall\.y \+ 1\.0\)\);\n\s+p\.y -= uTime \* boxes \* uBox \/ 400\.0;/);
  assert.ok(ASH_VS.includes(`sin(uTime*${((2 * Math.PI) / 400) * 50} + seed*24.0)`) && ASH_VS.includes(`cos(uTime*${((2 * Math.PI) / 400) * 37} + seed*11.0)`), 'the sway');
  assert.match(ASH_VS, /float life = fract\(uTime \* \(uLife\.x \+ floor\(fract\(seed\*5\.3\) \* \(uLife\.y \+ 1\.0\)\)\) \/ 400\.0 \+ seed\*7\.0\);/);
  assert.match(ASH_VS, /float gust = \(32\.0 \+ floor\(fract\(seed\*3\.7\) \* 17\.0\)\) \/ 40\.0;/);
  assert.match(ASH_VS, /p = mod\(p - uEye \+ uBox\*0\.5, uBox\) \+ uEye - uBox\*0\.5;/, 'the lab\'s wrap about the eye');
  assert.match(ASH_FS, /o = vec4\(hot \* vGlow \* a \* uGain, 1\.0\);/); assert.match(ASH_FS, /o = vec4\(uColor\.rgb, uColor\.a \* a\);/);
  // the renderer, on a stub context
  const { gl, calls } = stubGl();
  const dry = new DryFallRenderer(gl);
  assert.equal(dry.sand.look, SAND_LOOK, 'the sand built at boot, as it was');
  const proj = new Float32Array(16); proj[0] = 0.6; proj[5] = 1.0; proj[10] = proj[15] = 1;
  calls.length = 0;
  dry.draw({ on: true, kind: 'ash', strength01: 0.5, windV: [2, 1], step: [1, 0.5], gust: 1 }, proj, proj, new Float32Array([0, 0, 0]), 401);
  const draws = calls.filter((c) => c[0] === 'drawArraysInstanced').map((c) => c[4]);
  assert.deepEqual(draws, [6000, 160], 'the ash, then the embers');
  const blends = calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1));
  assert.deepEqual(blends, [[17, 18], [20, 20]], 'the ash blended, the embers added');
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uEmber').map((c) => c[2]), [0, 1]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime').slice(2), [1], 'the clock wrapped');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uMinSize').slice(2), [1.5 / 1000]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uAspect').slice(2), [proj[5] / proj[0]]);
  assert.equal(dry.drawn, 6160);
  calls.length = 0;
  dry.draw({ on: true, kind: 'sand', strength01: 1, windV: [20, 5], step: [1, 0.25], gust: 1 }, proj, proj, new Float32Array([0, 0, 0]), 3);
  assert.equal(calls.find((c) => c[0] === 'drawArraysInstanced')?.[4], SAND_LOOK.count, 'the sand its own');
  const ash = dry.ash();
  assert.ok(ash instanceof AshFallRenderer);
  for (let i = 0; i < 2000; i++) ash.advance([7, -9]);
  const span = ASH_BOX * WISP_GUST_DIV;
  assert.ok(ash.windOff[0] >= 0 && ash.windOff[0] < span && ash.windOff[1] >= 0 && ash.windOff[1] < span, 'wrapped to the gust\'s span');
  ash.draw({ on: true, strength01: 0, windV: [0, 0], step: [0, 0] }, proj, proj, new Float32Array([0, 0, 0]), 4);
  assert.equal(ash.drawn + ash.embers, 0, 'an ashfall at nothing draws nothing');
});

test('ASHFALL1 the hosts: the dry falls\' one renderer built on the enhanced lane, every dry fall\'s branch before the rain\'s, the fall handed its kind; the rain program never built for the ash', () => {
  for (const [name, s, eye] of [['world', rd('src/scenes/world.js'), 'wxEye32'], ['exterior', rd('src/scenes/exterior.js'), 'eye32']]) {
    assert.match(s, /const dryFall = sky\.enhanced \? new DryFallRenderer\(renderer\.gl\) : null;/, `${name}: built at boot`);
    assert.match(s, /if \(precipMode && !isDryFall\(precipMode\) && !precip\) precip = new PrecipitationRenderer/, `${name}: the rain program for the wet falls alone`);
    const i = s.indexOf('if (isDryFall(precipShown)) {');
    assert.ok(i > 0, `${name}: the dry falls' branch`);
    assert.ok(s.slice(i, i + 700).includes(`dryFall.draw({ on: true, kind: precipShown, strength01: fx.intensity, windV: wd.windV, step: wd.step }, proj, view, ${eye}, now / 1000);`), `${name}: the kind handed (the frame's gust, which neither fall reads, gone)`);
  }
});

test('ASHFALL1 records: the arc page\'s E, the ledger row, the page index and the biomes page\'s ash', () => {
  assert.match(rd('bible/07-Rendering/Weather-Arc.md'), /^## E - THE ASHFALL \(ASHFALL1, 2026-10-27\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /^\| \*\*THE ASHFALL \(ASHFALL1, 2026-10-27\)\*\*/m);
  assert.match(rd('bible/01-Overview/Page-Index.md'), /E: the ashfall/);
  assert.match(rd('bible/03-World/Tamriel-Biomes.md'), /ASHFALL1/);
});
