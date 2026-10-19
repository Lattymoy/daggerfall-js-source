// PRECIP1 / PRECIP2 (2026-10-19, the owner: "I also want to begin giving each biome their own precipitation. It shouldnt
// snow everywhere or rain everywhere when the season is winter ... If its snowing in one area and raining in the next,
// the transition should be seamless"): THE AIR (systems/weather/airTemperature.js, its map airGround.js) and WHAT FALLS IN
// IT - the phase law in the sim (weatherSim.js precipLawOn, snowShareAt, phaseWord, phaseRound, systemWordOf), one air per
// place (weatherMap.js wornAmong), the front's snow share and its two looks' levels (weatherFront.js), the mixed fall
// (render/precipitation.js drawFall) and the sky's cells at their own place's share (volumetricClouds.js cellOfField,
// rainCurtains.js). AUDIT PRECIP (the owner: "Audit this and ensure perfection. No band aids") re-pinned every law it
// moved. bible/07-Rendering/Biome-Precipitation.md is the record, bible/01-Overview/audits/Audit-Precip.md the audit's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  airTemperature, airParamsAt, snowShareOf, seasonAir, dayAir, spellAt, spellOf, SPELL, setAirGround, setAirBiome, airGround,
  altitudeOfWorldY, dayAndHourOf, CLIMATE_AIR, LAPSE_C_PER_M, COLDEST_DAY, WARMEST_HOUR, FALL, SNOW_ALL_C, RAIN_ALL_C,
  SEA_LEVEL_M, LATITUDE_C_PER_ROW, MARITIME, maritimeAt, pixelAir, airFall,
} from '../../../src/systems/weather/airTemperature.js';
import {
  setPrecipLaw, precipLawOn, snowShareAt, phaseWord, phaseRound, mapGround, currentSnowShare, setWeather, resetWeatherSim,
  setSnowGroundLaw, PHASE_INTENSITY, setWeatherFieldLaw, setWeatherMapLaw, sampleWeatherField, currentWeather, currentWeatherRaw,
  weatherSystemStamp, weatherPhaseFlip, systemWordOf, lawAir,
} from '../../../src/systems/weather/weatherSim.js';
import { weatherAt, wornAmong, skyCells } from '../../../src/systems/weather/weatherMap.js';
import { createWeatherFront, soundWeather, SHOWN_FLOOR } from '../../../src/systems/weather/weatherFront.js';
import { PrecipitationRenderer, MIX_SHIFT } from '../../../src/render/precipitation.js';
import { mixColor, CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, curtainsOf } from '../../../src/render/rainCurtains.js';
import { cellOfField, cellOf, CURTAIN_FALL } from '../../../src/render/volumetricClouds.js';
import { jungleAirShare, JUNGLE_AIR_EDGE } from '../../../src/world/jungle/jungleRegion.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';

const S = TERRAIN_SIZE;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
/** A map: Desert west of pixel column 100, Woodlands east of it (no sea); the ground `metres` above the sea everywhere. */
const splitGround = (metres = 0) => ({ climateAt: (px) => (px < 100 ? CLIMATES.Desert : CLIMATES.Woodlands), groundAt: () => metres });
/** Field metres of pixel (px, py)'s centre. */
const centre = (px, py) => [(px + 0.5) * S, (499 - py + 0.5) * S];

test('PRECIP1 THE PHASE: all snow at and under SNOW_ALL_C, all rain at and over RAIN_ALL_C, a smooth sleet between - monotone, half at the middle; a non-finite air no air at all (AUDIT PRECIP AIR-14: it fell as snow) (mutants: the band\'s ends swapped; a step for the smoothstep; NaN snow)', () => {
  assert.equal(snowShareOf(SNOW_ALL_C), 1); assert.equal(snowShareOf(-12), 1);
  assert.equal(snowShareOf(NaN), 0); assert.equal(snowShareOf(-Infinity), 0);
  assert.equal(snowShareOf(RAIN_ALL_C), 0); assert.equal(snowShareOf(30), 0);
  near(snowShareOf((SNOW_ALL_C + RAIN_ALL_C) / 2), 0.5, 1e-12, 'half at the middle');
  let last = 1;
  for (let t = SNOW_ALL_C; t <= RAIN_ALL_C; t += 0.05) { const s = snowShareOf(t); assert.ok(s <= last + 1e-12, `monotone at ${t}`); last = s; }
  near(snowShareOf(SNOW_ALL_C + 0.25), 1 - 3 * 0.01 + 2 * 0.001, 1e-12, 'a smoothstep, not a ramp');
});

test('PRECIP1 THE YEAR AND THE DAY: a climate is coldest on COLDEST_DAY and warmest half a year on, its day warmest at WARMEST_HOUR and coldest twelve hours round, the swing damped by the cloud COVER overhead (AUDIT PRECIP AIR-9: by any fall it stepped 2.7 C at a rain core\'s edge); the sky\'s minute read as its year\'s day and hour (mutants: the season\'s sign; the cloud undamped; the cover a step)', () => {
  const p = CLIMATE_AIR[CLIMATES.Woodlands];
  near(seasonAir(p, COLDEST_DAY), p.mean - p.amp, 1e-12, 'coldest');
  near(seasonAir(p, COLDEST_DAY + 180), p.mean + p.amp, 1e-12, 'warmest');
  near(dayAir(p, WARMEST_HOUR), p.day, 1e-12, 'the afternoon'); near(dayAir(p, WARMEST_HOUR + 12), -p.day, 1e-12, 'before dawn');
  near(dayAir(p, WARMEST_HOUR, 1), p.day * FALL.dayUnderCloud, 1e-12, 'under a whole deck');
  near(dayAir(p, WARMEST_HOUR, 0.5), p.day * (1 - (1 - FALL.dayUnderCloud) * 0.5), 1e-12, 'under half of one - the air walks under a deck\'s edge');
  assert.deepEqual(dayAndHourOf((3 * 360 + 45) * 1440 + 6 * 60 + 30), [45 + 390 / 1440, 6.5]);
  assert.equal(altitudeOfWorldY(SEA_LEVEL_M + 120), 120);
  // airFall: the place's fall - its strongest wet band, its snow systems' own, the cover over it (a word-only reader's
  // falling sky a covered one); the chill the fall's and the snow mass's
  assert.deepEqual(airFall(null), { wet: 0, snow: 0, cover: 0, chill: 0 });
  assert.deepEqual(airFall({ intensity: 0.8, snow: 0.5, cover: 0.3 }), { wet: 0.8, snow: 0.5, cover: 0.3, chill: 0.8 * FALL.chill + 0.5 * FALL.snowCold });
  assert.deepEqual(airFall({ intensity: 0.6, snow: true }), { wet: 0.6, snow: 0.6, cover: 1, chill: 0.6 * (FALL.chill + FALL.snowCold) });
});

test('PRECIP1 THE SPELL: pure in place and minute, within [-1, 1], continuous (a cold snap has no edge), drifting with the air - and spread over its range, not stuck at its middle (mutants: the spread unwidened; the drift dropped)', () => {
  const vals = [];
  for (let k = 0; k < 4000; k++) {
    const x = (k * 7919) % 900000, z = (k * 104729) % 400000, t = k * 997;
    const v = spellAt(x, z, t);
    assert.ok(v >= -1 && v <= 1);
    assert.equal(v, spellAt(x, z, t), 'pure');
    assert.ok(Math.abs(spellAt(x + 50, z + 50, t + 1) - v) < 0.02, 'continuous');
    vals.push(v);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  assert.ok(Math.abs(mean) < 0.12 && sd > 0.4 && sd < 0.75, `centred and spread: mean ${mean.toFixed(3)} sd ${sd.toFixed(3)}`);
  for (const t of [0, 777, 10 * 1440, 123456]) {
    for (const [x, z] of [[300000, 200000], [12345, 67890]]) assert.equal(spellAt(x, z, t), spellOf(x - SPELL.drift[0] * t, z - SPELL.drift[1] * t, t), `carried at ${t}`);
  }
  assert.ok(SPELL.drift[0] > 0 && SPELL.drift[1] > 0, 'east-north-east, as the Bay\'s air');
});

test('PRECIP1 THE CLIMATES BLEND between pixel centres - a climate\'s own numbers at its centre, the border warmed over the pixel either side and never at its edge; the latitude from the blend\'s own middle row (AUDIT PRECIP AIR-7: each climate\'s median), none in the Eltheric Ocean\'s box (AIR-1: arctic all year at a subtropical port); the ground read at the point; a biome leans the air by its share (mutants: the blend nearest-pixel; the latitude dropped; the latitude in the ether; the biome unleaned)', () => {
  setAirGround(splitGround(40));
  try {
    const woods = CLIMATE_AIR[CLIMATES.Woodlands], desert = CLIMATE_AIR[CLIMATES.Desert];
    const pw = airParamsAt(...centre(150, woods.row)), pd = airParamsAt(...centre(50, desert.row));
    near(pw.mean, woods.mean, 1e-9, 'woods at its centre, its own row'); near(pd.mean, desert.mean, 1e-9, 'desert');
    near(pw.ground, 40, 1e-9, 'the ground the host answers at the point');
    const row = 300, z = centre(0, row)[1];
    const at = (x) => airParamsAt(x, z).mean;
    const edge = 100 * S;
    near(at(edge - 1e-6), at(edge + 1e-6), 1e-6, 'no step at the pixel edge');
    near(at(edge), (at(99.5 * S) + at(100.5 * S)) / 2, 1e-9, 'half way between the centres');
    assert.ok(at(99.5 * S) > at(100.5 * S) + 5, 'the desert warmer');
    near(airParamsAt(...centre(150, woods.row + 100)).mean - woods.mean, LATITUDE_C_PER_ROW * 100, 1e-9, 'a hundred rows south');
    // the Eltheric Ocean's box: its isles' air is their climates' own, whatever their row in the Bay's frame
    const deep = [(ETHER_BOX.x0 + ETHER_BOX.x1) / 2, (ETHER_BOX.y0 + ETHER_BOX.y1) / 2];
    near(airParamsAt(...centre(deep[0], deep[1])).mean, woods.mean, 1e-9, 'no latitude in the ether box');
    const r0 = airParamsAt(...centre(150, 0)).mean, rOut = airParamsAt(...centre(150, -1)).mean;
    near(rOut, r0, 1e-9, 'north of the Bay the row is held to its edge - the latitude is the Bay\'s measure');
    const rain = CLIMATE_AIR[CLIMATES.Rainforest];
    setAirBiome('test', (x) => (x > 150 * S ? 1 : x > 140 * S ? 0.5 : 0), rain);
    near(airParamsAt(...centre(160, woods.row)).mean, rain.mean, 1e-9, 'whole');
    near(airParamsAt(...centre(145, woods.row)).mean, (woods.mean + rain.mean) / 2, 1e-9, 'half');
    near(airParamsAt(...centre(130, woods.row)).mean, woods.mean, 1e-9, 'outside it');
  } finally { setAirBiome('test', null); setAirGround(null); }
});

test('PRECIP1 THE SEA\'S HAND (AUDIT PRECIP AIR-10): the land beside the sea is partly maritime and the sea beside land partly the land\'s - coast at the shore, none MARITIME.inland pixels in, all MARITIME.offshore out - so the air is continuous across a coast and no snow line runs in the sea (mutants: the share a step at the shore; the sea\'s land unread)', () => {
  const OCEAN = CLIMATE_AIR[CLIMATES.Ocean], woods = CLIMATE_AIR[CLIMATES.Woodlands];
  setAirGround({ climateAt: (px) => (px < 100 ? CLIMATES.Ocean : CLIMATES.Woodlands), groundAt: () => 0 });
  try {
    const shore = maritimeAt(100, 200), sea = maritimeAt(99, 200);
    assert.equal(shore.land, CLIMATES.Woodlands); assert.equal(sea.land, CLIMATES.Woodlands, 'the sea carries the nearest land\'s climate');
    assert.ok(Math.abs(shore.share - MARITIME.coast) < 0.01 && Math.abs(sea.share - MARITIME.coast) < 0.01, `about the coast's share either side: ${shore.share} ${sea.share}`);
    assert.equal(maritimeAt(100 + MARITIME.inland + 1, 200).share, 0, 'inland: the land\'s own');
    assert.equal(maritimeAt(99 - MARITIME.offshore - 1, 200).share, 1, 'offshore: the open Bay\'s');
    near(pixelAir(99 - MARITIME.offshore - 1, 200).mean, OCEAN.mean, 1e-9, 'past the offshore reach the open Bay\'s air whole, whatever land is near');
    let last = -1;
    for (let px = 99 - MARITIME.offshore; px <= 100 + MARITIME.inland; px++) { const s = maritimeAt(px, 200).share; assert.ok(last < 0 || s <= last + 1e-6, `falling inland at ${px}`); last = s; }
    near(pixelAir(100 + MARITIME.inland + 1, woods.row).mean, woods.mean, 1e-9, 'inland the woods\' own');
    const half = pixelAir(100, woods.row);
    near(half.mean, woods.mean + (OCEAN.mean - woods.mean) * maritimeAt(100, woods.row).share, 1e-6, 'the shore between');
  } finally { setAirGround(null); }
});

test('PRECIP1 THE AIR: the lapse with height (null reads the ground at the point), a fall\'s chill and a snow mass\'s own cold by their shares, the day damped by the cover - pure (mutants: the lapse\'s sign; the snow mass\'s cold dropped; the ground unread)', () => {
  setAirGround(splitGround(390));
  try {
    const [x, z] = centre(150, 29), t = (405 * 360 + 20) * 1440 + 15 * 60;
    const a0 = airTemperature(x, z, 0, t), a1 = airTemperature(x, z, 1000, t);
    near(a0 - a1, LAPSE_C_PER_M * 1000, 1e-9, 'a kilometre up');
    near(airTemperature(x, z, null, t), airTemperature(x, z, 390, t), 1e-9, 'null: the ground');
    const p = airParamsAt(x, z), [, hour] = dayAndHourOf(t);
    const dry = airTemperature(x, z, 0, t), wet = airTemperature(x, z, 0, t, t, { intensity: 1, snow: 0, cover: 1 }), snow = airTemperature(x, z, 0, t, t, { intensity: 1, snow: 1, cover: 1 });
    near(dry - wet, FALL.chill + dayAir(p, hour) - dayAir(p, hour, 1), 1e-9, 'the fall\'s chill and its cloud');
    near(wet - snow, FALL.snowCold, 1e-9, 'a snow mass\'s own cold');
    near(airTemperature(x, z, 0, t, t, { intensity: 1, snow: 0.5, cover: 1 }), wet - FALL.snowCold / 2, 1e-9, 'by its share');
    assert.equal(airTemperature(x, z, 0, t), dry, 'pure');
  } finally { setAirGround(null); }
});

test('PRECIP1 THE LAW\'S LANE: on with the ground law\'s lane, the world weather MAP\'s (AUDIT PRECIP AIR-2: the map is what the snow lies from) and a host\'s map for the air; off without any of them or with ?biomeprecip=off - refused online; a test may force it (mutants: the map unasked; the weather map unasked; the lane unasked)', () => {
  setPrecipLaw(null);
  try {
    setSnowGroundLaw(true); setWeatherMapLaw(true); setAirGround(null);
    assert.equal(precipLawOn(), false, 'no map: off');
    setAirGround(splitGround());
    assert.equal(precipLawOn(), true, 'the lane, the weather map and a map: on');
    setWeatherMapLaw(false);
    assert.equal(precipLawOn(), false, 'no weather map: off - the calendar\'s law whole');
    setWeatherMapLaw(true); setSnowGroundLaw(false);
    assert.equal(precipLawOn(), false, 'the classic lane: off');
    setPrecipLaw(true); assert.equal(precipLawOn(), true, 'forced');
  } finally { setPrecipLaw(null); setSnowGroundLaw(null); setWeatherMapLaw(null); setAirGround(null); resetWeatherSim(); }
  assert.match(readFileSync('src/systems/weather/weatherSim.js', 'utf8'), /return \(pageHas\('online'\) \|\| pageParam\('biomeprecip'\) !== 'off'\) && snowGroundLawOn\(\) && weatherMapOn\(\) && airGround\(\) !== null;/, 'the door back, refused online');
});

test('PRECIP1 WHAT FALLS: a wet system\'s word at a place is its share\'s rounding - rain in cold air falls as snow, snow in warm air as rain, a storm in cold air a snow - PURE in the share (AUDIT PRECIP AIR-6: a client\'s memory of its last word made two clients wear two words); a dry word itself; the map\'s ground law routes through it and hands its readers the one air and the strikes (mutants: a band about the half; a snow system kept snow in warm air; the strikes gated off the law)', () => {
  setPrecipLaw(true); setAirGround(splitGround());
  try {
    const cold = (406 * 360 + COLDEST_DAY) * 1440 + 5 * 60, warm = (406 * 360 + COLDEST_DAY + 180) * 1440 + 15 * 60;
    const [x, z] = centre(150, 29);
    assert.equal(phaseWord('rain', x, z, cold, 2000), 'snow', 'rain on a winter night two kilometres up');
    assert.equal(phaseWord('thunder', x, z, cold, 2000), 'snow', 'a storm');
    assert.equal(phaseWord('snow', x, z, warm, 0), 'rain', 'snow on a summer afternoon at the sea');
    assert.equal(phaseWord('rain', x, z, warm, 0), 'rain');
    assert.equal(phaseWord('fog', x, z, cold, 2000), 'fog');
    assert.equal(snowShareAt(x, z, cold, 2000, { intensity: PHASE_INTENSITY, snow: 0, cover: 1 }), 1);
    assert.equal(lawAir(cold, 2000)(x, z, { intensity: 0.4, snow: 0, cover: 1 }), snowShareAt(x, z, cold, 2000, { intensity: 0.4, snow: 0, cover: 1 }), 'the law\'s air the share');
    const g = mapGround(splitGround().climateAt);
    assert.equal(g('rain', x, z, cold, 2000), phaseWord('rain', x, z, cold, 2000), 'the map\'s ground law is the phase');
    assert.equal(typeof g.lawAir(cold), 'function', 'and it carries the one air');
    assert.equal(g.strikes(x, z, cold), true, 'a storm strikes whatever its fall (thundersnow)');
    for (const [raw, share, word] of [['rain', 0.5, 'snow'], ['rain', 0.4999999, 'rain'], ['snow', 0.2, 'rain'], ['snow', 0.5, 'snow'], ['thunder', 0.2, 'thunder'], ['thunder', 0.9, 'snow']]) {
      assert.equal(phaseRound(raw, share), word, `${raw} at ${share}`);
    }
  } finally { setPrecipLaw(null); setAirGround(null); }
  setPrecipLaw(false);
  try { assert.equal(mapGround(() => CLIMATES.Desert).lawAir(0), null, 'off the law: no air for the readers'); } finally { setPrecipLaw(null); }
});

test('PRECIP1 ONE AIR A PLACE (AUDIT PRECIP AIR-8): every band falling at a place wears the one air - asked once with the place\'s fall (its strongest wet band, its snow bands\' own, the cover over it) - so a snow band over a rain band no longer falls as two airs the rain\'s winning by rank (mutants: the air asked per band; the fall\'s snow unread)', () => {
  const sys = (id, word, intensity) => ({ id, x: 0, z: 0, r: 30000, reach: 30000, bands: [[30000, word]], kind: 'front', env: 1, shape: null, clip: null, born: 0, ttl: 1e9, intensities: [intensity] });
  const asked = [];
  const air = (x, z, fall) => { asked.push(fall); return 0.7; };
  const systems = [sys('a', 'rain', 0.4), sys('b', 'snow', 0.9)];
  const w = wornAmong(systems.map((s) => ({ ...s, bandAt: undefined })), 100, 100, null, air);
  assert.equal(asked.length, 1, 'the air asked once');
  assert.equal(asked[0].snow, w.fall.snow); assert.equal(asked[0].intensity, w.fall.intensity);
  assert.equal(w.share, 0.7); assert.equal(w.word, 'snow', 'the place\'s share rounds the worn system');
  assert.ok(w.fall.cover > 0, 'the cover over the place');
});

test('PRECIP2 THE FRONT\'S SNOW SHARE: off the law the mode\'s own, on it the sim\'s; a phase turning under ONE system is no front, no episode, no new peak (AUDIT PRECIP FALL-2/3: every flip of the rounded word re-rolled the episode and blew a new wind); the hosts key on the system (systemWordOf); the two looks\' levels for the ear and the soak (FALL-4); resetWeatherSim forgets the law\'s state (AIR-13); a fall not yet shown carries its share (FALL-11) (mutants: the front keyed on the word; nothing shown no share; the episode rolled from the word; the drops\' level unsplit; the state kept)', () => {
  resetWeatherSim();
  try {
    setPrecipLaw(false); setWeather('snow');
    let fr = createWeatherFront({ seed: 3 });
    let fx = fr.tick({ weather: 'snow', nowMinutes: 1000, jump: true, tsec: 0, peak: 1 });
    assert.equal(fx.snow, null, 'off the law: the mode is its own look');
    assert.equal(fx.rain, null); assert.equal(fx.flakes, null);
  } finally { setPrecipLaw(null); resetWeatherSim(); }
  // under the law at a rain front, at heights either side of where its air is half snow
  const woodsAt = () => CLIMATES.Woodlands, x = 151 * S, z = 400 * S;
  let m = (406 * 360 + COLDEST_DAY) * 1440;
  while (weatherAt(x, z, m, woodsAt).word !== 'rain') m += 60;
  setAirGround({ climateAt: woodsAt, groundAt: () => 0 });
  setPrecipLaw(true); setWeatherFieldLaw(true); setWeatherMapLaw(true);
  try {
    // the share the sim reads there, at height h: the place's one air under the place's own fall
    const shareAt = (h) => { const g = () => null; g.lawAir = (mm) => lawAir(mm, h); return weatherAt(x, z, m, woodsAt, { ground: g }).share; };
    let lo = -2000, hi = 4000;
    for (let i = 0; i < 60; i++) { const h = (lo + hi) / 2; if (shareAt(h) > 0.5) hi = h; else lo = h; }
    sampleWeatherField(m, CLIMATES.Woodlands, [x, z, lo - 60], woodsAt, 'jump');
    assert.equal(currentWeather(), 'rain'); assert.equal(currentWeatherRaw(), 'rain');
    const stamp = weatherSystemStamp(), wet = currentSnowShare();
    assert.ok(wet > 0 && wet < 0.5, `a wet sleet: ${wet}`);
    const fr = createWeatherFront({ seed: 3 });
    const a = fr.tick({ weather: currentWeather(), nowMinutes: m, jump: true, tsec: 0, peak: 1 });
    near(a.snow, wet, 1e-12, 'the front carries the air\'s share');
    near(a.rain, a.intensity * (1 - wet), 1e-12, 'the drops\' level'); near(a.flakes, a.intensity * wet, 1e-12, 'the flakes\'');
    // AUDIT PRECIP FALL-11: a fall not yet shown (its arrival under the floor) carries the air's share all the same - a
    // ?front=off host draws the word's mode by it, never as drops for want of a share
    const early = createWeatherFront({ seed: 3 }).tick({ weather: currentWeather(), nowMinutes: m, dt: 0.001, tsec: 0, arrival: 0, peak: 1 });
    assert.equal(early.shown, null, 'nothing shown yet');
    near(early.snow, wet, 1e-12, 'the share all the same');
    const episode = fr.state().episode;
    // the player climbs through the line: the word turns, the system does not
    sampleWeatherField(m, CLIMATES.Woodlands, [x, z, hi + 60], woodsAt, 'live');
    assert.equal(currentWeather(), 'snow'); assert.equal(currentWeatherRaw(), 'rain');
    assert.equal(weatherSystemStamp(), stamp, 'no new weather'); assert.equal(weatherPhaseFlip(), true, 'its phase alone');
    assert.equal(systemWordOf('snow'), 'rain', 'the hosts key on the system'); assert.equal(systemWordOf('fog'), 'fog', 'another word is itself');
    const b = fr.tick({ weather: currentWeather(), nowMinutes: m + 1, dt: 1, tsec: 1, peak: 1 });
    assert.equal(b.changed, false, 'no cut');
    assert.deepEqual(fr.state().episode, episode, 'the episode its own - the rain\'s mode, its roll');
    assert.equal(fr.state().episode.mode, 'rain');
    near(b.snow, currentSnowShare(), 1e-12, 'the share walks');
    assert.ok(b.snow > 0.5);
    const late = createWeatherFront({ seed: 3 }).tick({ weather: currentWeather(), nowMinutes: m + 2, jump: true, tsec: 0, peak: 1 });
    assert.equal(late.shown, 'rain', 'a front first met under it: the system\'s fall (its drops and flakes by the share), never the word\'s mode');
    assert.equal(soundWeather({ ...b, rain: SHOWN_FLOOR }, 'snow'), 'rain', 'the ear hears the drops whatever the word rounds to');
    assert.equal(soundWeather({ ...b, rain: 0 }, 'snow'), 'snow', 'a fall of flakes alone the word\'s');
    // AUDIT PRECIP AIR-13: the reset forgets the law's own state - the share, the systems' count, the flip
    resetWeatherSim(); setPrecipLaw(true);
    assert.deepEqual([currentSnowShare(), weatherSystemStamp(), weatherPhaseFlip()], [0, 0, false], 'forgotten');
  } finally { setPrecipLaw(null); setWeatherFieldLaw(null); setWeatherMapLaw(null); setAirGround(null); resetWeatherSim(); }
  const src = readFileSync('src/systems/weather/weatherFront.js', 'utf8');
  assert.match(src, /const fallOf = \(mode\) => \(mode && mode !== 'sand' && precipLawOn\(\) \? 'wet' : precipKind\(mode\)\);/);
  assert.match(src, /const id = systemWordOf\(weather\);/);
});

test('PRECIP2 THE FALL\'S END (AUDIT PRECIP FALL-1): the outgoing fall drains at the share it fell at - a snowfall\'s last flakes never relabelled as drops when the air warms under a clearing sky (mutants: the outgoing share the live one)', () => {
  resetWeatherSim();
  setPrecipLaw(true);
  try {
    setWeather('snow');
    const fr = createWeatherFront({ seed: 5 });
    const a = fr.tick({ weather: 'snow', nowMinutes: 2000, jump: true, tsec: 0, peak: 1 });
    assert.equal(a.shown, 'snow');
    const fell = a.snow;
    setWeather('sunny');
    const b = fr.tick({ weather: 'sunny', nowMinutes: 2001, dt: 0.5, tsec: 0.5, arrival: 0.1, peak: null });
    assert.equal(b.changed, true);
    assert.equal(fr.state().outgoing.snow, fell, 'kept with the outgoing episode');
    assert.equal(b.snow, fell, 'and drawn at it');
  } finally { setPrecipLaw(null); resetWeatherSim(); }
});

test('PRECIP2 THE MIXED FALL: on the enhanced lane a wet mode is one fall in two looks - the drops at the rest of the intensity, the flakes at the share, the flakes aside on the wind at EVERY share (AUDIT PRECIP FALL-6: aside only under 1, every flake jumped where the share crossed it) through one owned array (FALL-7), a ?rain cap the whole fall\'s (FALL-8) - all put back after; with no share, off the lane, or dry, the draw as it is (mutants: the shares swapped; the shift dropped at 1; the cap unsplit; the intensity not restored)', () => {
  const p = Object.create(PrecipitationRenderer.prototype);
  const calls = [];
  p.draw = function (mode) { calls.push({ mode, intensity: this.intensity, cap: this.countCap, wind: [...this.windUpload()] }); };
  p.enhanced = true; p.intensity = 0.8; p.windOff = Float32Array.of(3, 4); p._windUp = new Float32Array(2); p._shift = null; p.countCap = null;
  const wind = p.windOff;
  p.snowShare = 0.25;
  p.drawFall('storm', null, null, null, null, 0);
  assert.deepEqual(calls.map((c) => c.mode), ['storm', 'snow']);
  near(calls[0].intensity, 0.6, 1e-9, 'the drops'); near(calls[1].intensity, 0.2, 1e-9, 'the flakes');
  assert.deepEqual(calls[0].wind, [3, 4], 'the drops on the wind');
  near(calls[1].wind[0], 3 + MIX_SHIFT[0], 1e-4, 'the flakes aside'); near(calls[1].wind[1], 4 + MIX_SHIFT[1], 1e-4, 'aside');
  assert.equal(p.intensity, 0.8); assert.equal(p.windOff, wind, 'the wind\'s own travel never swapped'); assert.equal(p._shift, null);
  calls.length = 0; p.snowShare = 1; p.drawFall('rain', null, null, null, null, 0);
  assert.deepEqual(calls.map((c) => [c.mode, c.intensity]), [['snow', 0.8]], 'all snow: the flakes alone');
  near(calls[0].wind[0], 3 + MIX_SHIFT[0], 1e-4, 'where they stood at any share - aside at a whole one too');
  calls.length = 0; p.snowShare = 0; p.drawFall('snow', null, null, null, null, 0);
  assert.deepEqual(calls.map((c) => [c.mode, c.intensity]), [['rain', 0.8]], 'a snow mode in warm air: rain');
  calls.length = 0; p.countCap = 1000; p.snowShare = 0.3; p.drawFall('rain', null, null, null, null, 0);
  assert.deepEqual(calls.map((c) => c.cap), [700, 300], 'the cap split by the share');
  assert.equal(p.countCap, 1000, 'put back');
  calls.length = 0; p.countCap = 0; p.drawFall('rain', null, null, null, null, 0);
  assert.deepEqual(calls.map((c) => c.cap), [0, 0], 'a cap of none caps both');
  p.countCap = null;
  for (const [share, enhanced, mode] of [[null, true, 'rain'], [0.5, false, 'rain'], [0.5, true, 'sand']]) {
    calls.length = 0; p.snowShare = share; p.enhanced = enhanced; p.drawFall(mode, null, null, null, null, 0);
    assert.deepEqual(calls.map((c) => [c.mode, c.intensity]), [[mode, 0.8]], `as it is: ${share} ${enhanced} ${mode}`);
  }
  const src = readFileSync('src/render/precipitation.js', 'utf8');
  assert.match(src, /if \(this\.enhanced\) return this\.drawLab\(mode, proj, view, camPos, camRight, timeSeconds\);/, 'the draw itself untouched');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = readFileSync(host, 'utf8');
    assert.match(h, /precip\.drawFall\(precipShown, proj, view, /, `${host}: draws the fall`);
    assert.match(h, /precip\.intensity = fx\.intensity; precip\.snowShare = fx\.snow \?\? null;/, `${host}: hands its share`);
  }
});

test('PRECIP2 THE SKY\'S CELLS at their own place\'s share: a wet cell\'s air read where its fall is NEAREST the player at its own band\'s intensity (AUDIT PRECIP AIR-4/FALL-9: its centre, tens of kilometres off, at a fixed intensity); its cloud and its curtain walk together from its warm side\'s to the snow\'s (FALL-5/SKY-4: the whole deck swapped at the half), before the growth (SKY-3: the curtain fell whole from a young system) (mutants: the share at the centre; the cloud a switch; the growth after)', () => {
  const sys = { id: 's', x: 0, z: 0, r: 30000, reach: 30000, bands: [[30000, 'rain']], kind: 'front', env: 1, shape: null, clip: null };
  const [cell] = skyCells([sys], 50000, 0);
  near(cell.near[0], 30000 * 0.999, 1e-6, 'its band\'s rim nearest the player'); near(cell.near[1], 0, 1e-9, 'on the line to them');
  assert.ok(Number.isFinite(cell.fall), 'its band\'s own intensity there');
  const [inside] = skyCells([sys], 1000, 0);
  near(inside.near[0], 1000, 1e-9, 'inside its band: the player\'s own place');
  const at = (x, z) => [x, z];
  const c = (o) => cellOfField({ x: 10, z: 20, r: 40000, imp: 1, rank: 1, id: 'a', d: 0, env: 1, ...o }, at);
  const half = c({ word: 'snow', raw: 'rain', snow: 0.5 });
  near(half.fallKind, 0.5, 1e-12, 'its share');
  near(half.fall, (CURTAIN_FALL.rain[0] + CURTAIN_FALL.snow[0]) / 2, 1e-12, 'its weight between');
  const rainCell = cellOf('rain', 10, 20, 40000), snowCell = cellOf('snow', 10, 20, 40000);
  for (const k of ['base', 'top', 'density', 'dark', 'cover', 'grey']) near(half[k], (rainCell[k] + snowCell[k]) / 2, 1e-9, `its ${k} between`);
  const lo = c({ word: 'rain', raw: 'rain', snow: 0.499 }), hi = c({ word: 'snow', raw: 'rain', snow: 0.501 });
  for (const k of ['base', 'top', 'density', 'dark', 'flat', 'cover', 'grey', 'fall']) assert.ok(Math.abs(lo[k] - hi[k]) < 0.01 * Math.max(1, Math.abs(lo[k])), `${k} walks across the half: ${lo[k]} ${hi[k]}`);
  near(c({ word: 'thunder', raw: 'thunder', snow: 0 }).fall, CURTAIN_FALL.thunder[0], 1e-12, 'a storm\'s own');
  near(c({ word: 'rain', raw: 'snow', snow: 0 }).fall, CURTAIN_FALL.rain[0], 1e-12, 'a snow front in warm air rains');
  near(c({ word: 'rain', raw: 'rain' }).fall, CURTAIN_FALL.rain[0], 1e-12, 'no share: the word\'s own');
  for (const env of [0.6, 0.3, 0.05]) near(c({ word: 'rain', raw: 'rain', snow: 0, env }).fall, c({ word: 'rain', raw: 'rain', env }).fall, 1e-9, `as grown as its system at ${env}`);
  assert.deepEqual([...mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, 0)], [...CURTAIN_RAIN_COLOR].map(Math.fround));
  assert.deepEqual([...mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, 1)], [...CURTAIN_SNOW_COLOR].map(Math.fround));
  const mid = mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, 0.5);
  for (let i = 0; i < 3; i++) near(mid[i], (CURTAIN_RAIN_COLOR[i] + CURTAIN_SNOW_COLOR[i]) / 2, 1e-6, 'between');
  const src = readFileSync('src/render/rainCurtains.js', 'utf8');
  assert.match(src, /kind: c\.fallKind \?\? 0,/);
  assert.match(src, /gl\.uniform3fv\(U\.uColor, mixColor\(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, c\.kind\)\);/);
  assert.equal(typeof curtainsOf, 'function');
});

test('PRECIP1 THE JUNGLE\'S AIR (AUDIT PRECIP AIR-12): it leans in over a band of its own kilometres wide - none JUNGLE_AIR_EDGE.out outside the line, whole JUNGLE_AIR_EDGE.in inside - never the haze\'s few hundred metres (a 19 C wall, its sleet 75 m wide) (mutants: the haze\'s edge; the band\'s ends swapped)', () => {
  assert.equal(jungleAirShare(-JUNGLE_AIR_EDGE.out), 0); assert.equal(jungleAirShare(JUNGLE_AIR_EDGE.in), 1);
  assert.ok(JUNGLE_AIR_EDGE.out + JUNGLE_AIR_EDGE.in >= 5000, 'kilometres');
  let a = -JUNGLE_AIR_EDGE.out, b = JUNGLE_AIR_EDGE.in;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (jungleAirShare(m) < 0.25) a = m; else b = m; }
  const q1 = a;
  a = -JUNGLE_AIR_EDGE.out; b = JUNGLE_AIR_EDGE.in;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (jungleAirShare(m) < 0.75) a = m; else b = m; }
  assert.ok(a - q1 > 1500, `its middle half ${(a - q1).toFixed(0)} m wide`);
});

test('PRECIP1 THE HOSTS: the world hands the air the law\'s map (airGround.js lawAirGround - its climates, the kernel\'s ground, its tops) and the player\'s height above the sea; the fixed city hands it none (its ground wears DFU\'s season); the jungle leans its own air in by its own band (mutants: a host unwired; the height dropped; the jungle\'s haze for its air)', () => {
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /setAirGround\(lawAirGround\(\{ woods, maps, landforms: landform, climates: \(\) => _landformClimates \}\)\);/);
  assert.match(w, /return \[\.\.\.fieldFromNative\(wc\.x, wc\.z\), altitudeOfWorldY\(p\[1\] - state\.compensation\[1\]\)\];/);
  assert.match(readFileSync('src/scenes/exterior.js', 'utf8'), /setAirGround\(null\);/);
  const j = readFileSync('src/scenes/jungleHost.js', 'utf8');
  assert.match(j, /setAirBiome\('jungle', \(fx, fz\) => \{[\s\S]{0,400}?jungleAirShare\(jungleDepthAt\([\s\S]{0,200}?\}, CLIMATE_AIR\[CLIMATES\.Rainforest\]\);/);
  assert.equal(airGround(), null, 'no test left a map behind');
});

// On the freeware's own map (CLAUDE.md: ARENA2 is fetched - `sh tools/fetch-data.sh`). Off it, skipped.
const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'CLIMATE.PAK'));
const loadMap = async () => {
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(rd('WOODS.WLD'));
  return { maps, woods };
};
const lawGround = async (maps, woods) => {
  const { lawAirGround } = await import('../../../src/systems/weather/airGround.js');
  const { landformClimates } = await import('../../../src/world/landforms.js');
  const table = landformClimates((x, y) => maps.getClimateIndex(x, y));
  return lawAirGround({ woods, maps, landforms: true, climates: () => table });
};

test('PRECIP1 THE ROWS on the freeware\'s map (AUDIT PRECIP AIR-7): each climate\'s air stands at its median row of CLIMATE.PAK - the latitude moves a climate\'s far ends, never its middle (mutants: a row moved)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { maps } = await loadMap();
  const rows = new Map();
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) { const c = maps.getClimateIndex(x, y); if (!rows.has(c)) rows.set(c, []); rows.get(c).push(y); }
  for (const [c, ys] of rows) {
    if (!CLIMATE_AIR[c]) continue;
    ys.sort((a, b) => a - b);
    assert.equal(CLIMATE_AIR[c].row, ys[ys.length >> 1], `climate ${c}`);
  }
});

test('PRECIP1 THE LAW\'S MAP on the freeware\'s data (AUDIT PRECIP AIR-1/3/10/15): the climates are CLIMATE.PAK\'s own - never the coastal dilation - and the continent\'s past the Bay; the ground is the kernel\'s own mean at the point, clamped as the kernel is, never the byte (110-900 m under the ranges) (mutants: the dilated buffer; the byte for the ground; the ground unclamped)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { maps, woods } = await loadMap();
  const raw = Uint8Array.from(maps.climatePak.buffer);
  const { dilateCoastalClimate } = await import('../../../src/world/terrain/terrainHelper.js');
  dilateCoastalClimate(maps, 2);
  const g = await lawGround(maps, woods);
  let moved = 0;
  for (let y = 0; y < 500; y++) {
    for (let x = 0; x < 1000; x++) {
      if (maps.getClimateIndex(x, y) !== raw[y * 1001 + x + 1]) moved++;
      assert.equal(g.climateAt(x, y), raw[y * 1001 + x + 1]);
    }
  }
  assert.ok(moved > 1000, `the dilation moved ${moved} pixels the air never reads`);
  assert.ok(g.climateAt(1200, 250) >= 0, 'the continent past the Bay answers');
  const { sampleKernel, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } = await import('../../../src/world/terrain/terrainSampler.js');
  const { createLandforms, landformClimates } = await import('../../../src/world/landforms.js');
  const lf = createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) });
  const diffs = []; let under = 0;
  for (let k = 0; k < 120; k++) {
    const px = 40 + ((k * 7919) % 920), py = 30 + ((k * 104729) % 440);
    if (raw[py * 1001 + px + 1] === CLIMATES.Ocean) continue;
    const f = sampleKernel(woods, px, py, 129, true, lf);
    let drawn = 0, mean = 0;
    for (let j = 8; j <= 120; j += 16) {
      for (let i = 8; i <= 120; i += 16) {
        drawn += f(i, j) * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE - SEA_LEVEL_M;
        mean += g.groundAt((px + i / 128) * S, (499 - py + j / 128) * S);
      }
    }
    drawn /= 64; mean /= 64;
    diffs.push(drawn - mean);
    if (woods.getHeightMapValue(px, py) * 8 * STREAMING_TERRAIN_SCALE - SEA_LEVEL_M < drawn - 100) under++;
  }
  // a pixel's mean of the drawn ground against the air's (a mean ground: the bicubic's and the noise's own shapes are the
  // drawn ground's, whose cover the GPU reads at its own height) - unbiased, close at the median, never a byte's error
  const abs = diffs.map(Math.abs).sort((a, b) => a - b), bias = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const median = abs[abs.length >> 1], p90 = abs[Math.floor(abs.length * 0.9)], worst = abs[abs.length - 1];
  assert.ok(Math.abs(bias) < 25 && median < 15 && p90 < 60 && worst < 200, `the air's ground the drawn ground's: bias ${bias.toFixed(1)}, median ${median.toFixed(1)}, p90 ${p90.toFixed(0)}, worst ${worst.toFixed(0)} m`);
  assert.ok(under > 0, 'the byte stood under it');
});

test('PRECIP1 THE CALIBRATION on the freeware\'s map: a winter at each climate\'s own ground falls as DFU\'s table says - the woodlands and the ranges mostly white, the desert, the rainforest and the subtropics never; a summer nowhere (mutants: a climate\'s mean moved)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { maps, woods } = await loadMap();
  setAirGround(await lawGround(maps, woods));
  try {
    let seed = 99; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    const pts = new Map();
    for (let k = 0; k < 300000; k++) {
      const px = Math.floor(rnd() * 1000), py = Math.floor(rnd() * 500), c = maps.getClimateIndex(px, py);
      if (!pts.has(c)) pts.set(c, []);
      if (pts.get(c).length < 300) pts.get(c).push([px, py]);
    }
    const share = (c, months) => {
      let snow = 0;
      const list = pts.get(c);
      for (let i = 0; i < 1200; i++) {
        const [px, py] = list[Math.floor(rnd() * list.length)];
        const x = px * S + rnd() * S, z = (499 - py) * S + rnd() * S;
        const t = ((405 + Math.floor(rnd() * 8)) * 360 + months[Math.floor(rnd() * months.length)] * 30 + Math.floor(rnd() * 30)) * 1440 + Math.floor(rnd() * 1440);
        if (snowShareOf(airTemperature(x, z, null, t, t, { intensity: 0.7, snow: 0, cover: 1 })) >= 0.5) snow++;
      }
      return snow / 1200;
    };
    const winter = [11, 0, 1], summer = [5, 6, 7];
    for (const c of [CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.MountainWoods]) { const s = share(c, winter); assert.ok(s > 0.55, `climate ${c} mostly white in winter: ${s}`); }
    for (const c of [CLIMATES.Desert, CLIMATES.Rainforest, CLIMATES.Subtropical]) { const s = share(c, winter); assert.ok(s < 0.02, `climate ${c} never: ${s}`); }
    for (const c of [CLIMATES.Woodlands, CLIMATES.Mountain]) { const s = share(c, summer); assert.ok(s < 0.01, `climate ${c} no summer snow: ${s}`); }
  } finally { setAirGround(null); }
});
