// WEATHER2a (Mac, 2026-09-14: "it can rain when theres snow on the ground"): NO RAIN OVER SNOW, ENHANCED LANE.
// The Chronicles' table (DFU's, digit for digit) rolls rain and thunder in Winter for every climate but the mountains,
// and the terrain wears its snow archive for the whole of Winter in every climate but a Desert base - so DFU, and the
// classic lane, draw rain over a white field. The enhanced lane funnels every write of the sim's word through the
// ground: rain or thunder over a ground that wears snow falls as snow, and the table's own word is kept beside it so
// the wind's violence is the storm's (a blizzard). The ground's snow law has ONE home (climateSwaps.js groundIsSnowy),
// which the terrain's archive and the sim both read.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resetWeatherSim, setSnowGroundLaw, snowGroundLawOn, overGround, tickWeather, weatherRespawn, applyClimateWeather,
  setClimateWeathers, setWeather, restoreWeather, currentWeather, currentWeatherRaw, currentWeatherEnum, WEATHER_ENUM,
} from '../src/systems/weatherSim.js';
import { groundIsSnowy, getTerrainGroundArchive, SEASON } from '../src/world/climateSwaps.js';
import { CLIMATES, CLIMATE_BASE_TYPES, getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { seasonValue, dateFromClassicMinutes, SEASONS } from '../src/systems/gameDate.js';
import { createWindModel, VIOLENCE } from '../src/systems/wind.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const WINTER = 0;                 // classic minute 0: Morning Star, Winter (the classic start's own season)
const SUMMER = 6 * 30 * 1440;     // month 6: Midyear, Summer
const RAIN_ROLL = () => 0.70;     // woodlands Winter: 25 sunny, 15 cloudy, 20 overcast, 5 fog, 10 RAIN - 70 lands on rain; the jungle's and the subtropics' too
const THUNDER_ROLL = () => 0.95;  // the jungle's Winter row: 15/20/25/3/25/0/12 - 95 lands on thunder

test('WEATHER2a groundIsSnowy: one law - every climate but a Desert base wears snow in Winter, and the terrain archive keys its +1 on it', () => {
  assert.equal(seasonValue(dateFromClassicMinutes(WINTER)), SEASONS.Winter); assert.equal(seasonValue(dateFromClassicMinutes(SUMMER)), SEASONS.Summer);
  for (const c of [CLIMATES.Ocean, CLIMATES.Mountain, CLIMATES.Rainforest, CLIMATES.Swamp, CLIMATES.MountainWoods, CLIMATES.Woodlands, CLIMATES.HauntedWoodlands]) {
    const s = getWorldClimateSettings(c);
    assert.equal(groundIsSnowy(s, SEASON.Winter), true, `climate ${c} wears snow in Winter`);
    assert.equal(groundIsSnowy(s, SEASON.Summer), false);
    assert.equal(getTerrainGroundArchive(s, SEASON.Winter), s.groundArchive + 1, 'the archive is the law + 1');
  }
  for (const c of [CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Subtropical]) {   // the subtropics are a Desert base too (MapsFile: ClimateType Desert, ground 2)
    const s = getWorldClimateSettings(c);
    assert.equal(s.climateType, CLIMATE_BASE_TYPES.Desert);
    assert.equal(groundIsSnowy(s, SEASON.Winter), false, 'a desert base never wears snow');
    assert.equal(getTerrainGroundArchive(s, SEASON.Winter), s.groundArchive);
  }
  assert.match(rd('src/world/climateSwaps.js'), /return climateSettings\.groundArchive \+ \(groundIsSnowy\(climateSettings, season\) \? 1 : 0\);/, 'the terrain reads the one law');
});

test('WEATHER2a overGround: rain and thunder over snowy ground are snow; a desert, a summer, and every other word pass through; the law off passes everything', () => {
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Woodlands, WINTER), WEATHER_ENUM.snow);
  assert.equal(overGround(WEATHER_ENUM.thunder, CLIMATES.Rainforest, WINTER), WEATHER_ENUM.snow, 'a jungle storm over its winter snow');
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Desert, WINTER), WEATHER_ENUM.rain, 'a desert never wears snow');
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Woodlands, SUMMER), WEATHER_ENUM.rain);
  for (const w of [WEATHER_ENUM.sunny, WEATHER_ENUM.cloudy, WEATHER_ENUM.overcast, WEATHER_ENUM.fog, WEATHER_ENUM.snow]) assert.equal(overGround(w, CLIMATES.Woodlands, WINTER), w);
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Woodlands, null), WEATHER_ENUM.rain, 'no minute, no ground to ask');
  setSnowGroundLaw(false);
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Woodlands, WINTER), WEATHER_ENUM.rain, 'the classic lane: DFU\'s word');
  assert.equal(overGround(WEATHER_ENUM.thunder, CLIMATES.Rainforest, WINTER), WEATHER_ENUM.thunder);
  resetWeatherSim();
});

test('WEATHER2a the three writers go through the ground: the day\'s drain, the respawn roll and the travel arrival wear snow over a winter field and keep the table\'s word beside it; the classic lane wears the rain', () => {
  // the drain (tickWeather's boot roll + apply)
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(tickWeather(WINTER, CLIMATES.Woodlands, RAIN_ROLL), true);
  assert.equal(currentWeather(), 'snow'); assert.equal(currentWeatherRaw(), 'rain');
  resetWeatherSim(); setSnowGroundLaw(false);
  assert.equal(tickWeather(WINTER, CLIMATES.Woodlands, RAIN_ROLL), true);
  assert.equal(currentWeather(), 'rain', 'DFU\'s own: rain over the snow'); assert.equal(currentWeatherRaw(), 'rain');
  // the same roll in summer, on the enhanced lane: rain
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(tickWeather(SUMMER, CLIMATES.Woodlands, () => 0.90), true);   // Summer row 60/20/5/0/10: 90 lands on rain
  assert.equal(currentWeather(), 'rain');
  // the respawn roll: a jungle storm in winter is a blizzard - snow worn, thunder kept
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(weatherRespawn(WINTER, CLIMATES.Rainforest, THUNDER_ROLL), true);
  assert.equal(currentWeather(), 'snow'); assert.equal(currentWeatherRaw(), 'thunder');
  // ...and a desert respawn's rain stays rain (the desert never wears snow)
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(weatherRespawn(WINTER, CLIMATES.Desert, () => 0.96), true);   // desert Winter 75/15/0/3/5: 96 lands on rain
  assert.equal(currentWeather(), 'rain');
  // the travel arrival: the array's slot, over the destination's ground at the arrival's minute
  resetWeatherSim(); setSnowGroundLaw(true);
  setClimateWeathers(SEASONS.Winter, RAIN_ROLL);
  assert.equal(applyClimateWeather(CLIMATES.Woodlands, WINTER), true);
  assert.equal(currentWeather(), 'snow'); assert.equal(currentWeatherRaw(), 'rain');
  resetWeatherSim(); setSnowGroundLaw(true);
  setClimateWeathers(SEASONS.Winter, RAIN_ROLL);
  assert.equal(applyClimateWeather(CLIMATES.Woodlands), true, 'no minute (an old caller): the word is taken as rolled');
  assert.equal(currentWeather(), 'rain');
  // a change of the raw word under one worn word is not a change: rain then thunder, both snow
  resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(weatherRespawn(WINTER, CLIMATES.Rainforest, RAIN_ROLL), true);
  assert.equal(currentWeather(), 'snow'); assert.equal(currentWeatherRaw(), 'rain');
  setClimateWeathers(SEASONS.Winter, THUNDER_ROLL);
  assert.equal(applyClimateWeather(CLIMATES.Rainforest, WINTER), false, 'still snow - no front, no jump');
  assert.equal(currentWeatherRaw(), 'thunder', 'but the violence word moved');
  // a word taken whole (a pin, a restore) is its own violence
  setWeather('rain'); assert.equal(currentWeather(), 'rain'); assert.equal(currentWeatherRaw(), 'rain');
  restoreWeather('thunder'); assert.equal(currentWeatherEnum(), WEATHER_ENUM.thunder); assert.equal(currentWeatherRaw(), 'thunder');
  resetWeatherSim();
  assert.equal(currentWeatherRaw(), 'sunny', 'reset');
});

test('WEATHER2a the switch: the enhanced skin and Enhanced Environments, the test seam over it; the classic skin never funnels', () => {
  resetWeatherSim();
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedEnvironments;
  try {
    setUiSkin('enhanced'); setPref('enhancedEnvironments', true);
    assert.equal(snowGroundLawOn(), true);
    setPref('enhancedEnvironments', false); assert.equal(snowGroundLawOn(), false);
    setPref('enhancedEnvironments', true); setUiSkin('classic'); assert.equal(snowGroundLawOn(), false, '1:1 on the classic skin');
    setSnowGroundLaw(true); assert.equal(snowGroundLawOn(), true, 'the seam wins');
    setSnowGroundLaw(false); setUiSkin('enhanced'); assert.equal(snowGroundLawOn(), false);
    setSnowGroundLaw(null); assert.equal(snowGroundLawOn(), true, 'null hands it back to the lane');
  } finally { setUiSkin(skin); setPref('enhancedEnvironments', pref); resetWeatherSim(); }
  assert.match(rd('src/systems/weatherSim.js'), /get\('snowground'\) !== 'off'/, 'the kill door');
});

test('WEATHER2a the wind blows by the table\'s word: a storm turned to snow builds a thunder front, not a flurry\'s', () => {
  const a = createWindModel({ seed: 3 }); const b = createWindModel({ seed: 3 });
  a.tick(0, 'sunny'); b.tick(0, 'sunny');
  a.tick(600, 'snow');               // a flurry: the snow row's violence
  b.tick(600, 'snow', 'thunder');    // WEATHER2a: snow worn, the storm's violence
  const fa = a.state().front, fb = b.state().front;
  assert.ok(fa && fb, 'both build a front');
  assert.ok(Math.abs(fb.strength / fa.strength - VIOLENCE.thunder / VIOLENCE.snow) < 1e-9, 'the same roll, the storm\'s violence');
  const c = createWindModel({ seed: 3 }); c.tick(0, 'sunny'); c.tick(600, 'snow', 'nonsense');
  assert.ok(Math.abs(c.state().front.strength - fa.strength) < 1e-12, 'an unknown violence word falls back to the worn one');
  assert.match(rd('src/scenes/shared.js'), /windModel\.tick\(extra\?\.classicMinutes \?\? 0, weatherName, extra\?\.violence \?\? weatherName\);/);
});

test('WEATHER2a the hosts: the arrival hands the sim its minute, the sky is handed the violence word, and the sim has one write of the worn word', () => {
  const w = rd('src/scenes/world.js'), e = rd('src/scenes/exterior.js');
  assert.equal((w.match(/applyClimateWeather\(maps\.getClimateIndex\(pick\.pixel\.x, pick\.pixel\.y\), Math\.floor\(playerTicker\.classicMinutes\), fieldXZ\(\), climateAt\);/g) || []).length, 2, 'both arrivals (the travel landing and the respawn drain) carry the minute (WEATHER2b: and the field\'s place)');
  for (const [name, s] of [['world', w], ['exterior', e]]) {
    assert.match(s, /violence: weatherOverride \?\? currentWeatherRaw\(\), classicMinutes: playerTicker\.classicMinutes/, `${name}: the sky's bag carries the violence word`);
    assert.match(s, /currentWeatherRaw[^\n]*from '\.\.\/systems\/weatherSim\.js'/, `${name}: imported`);
  }
  const sim = rd('src/systems/weatherSim.js');
  assert.equal((sim.match(/^\s*_current = /gm) || []).length, 3, 'setWeather (a word whole), _set (through the ground), reset - and nothing else writes the worn word');
  assert.match(sim, /function applyFromArray\(climateIndex, nowMinutes\) \{\s*\n\s*return _set\(weatherForClimate\(climateIndex\), climateIndex, nowMinutes\);/);
  assert.match(sim, /if \(!_set\(next, climateIndex, nowMinutes\)\) return false;[^\n]*\n\s*_jumps\+\+;/, 'the respawn roll through the ground, the jump kept');
  assert.match(sim, /const changed = applyFromArray\(climateIndex, nowMinutes\);/, 'the drain');
  assert.match(sim, /import \{ groundIsSnowy, climateSeasonFromMinutes \} from '\.\.\/world\/climateSwaps\.js';/, 'the terrain\'s own law, not a copy');
});

test('WEATHER2a records: the arc page, the ledger row, Home\'s index and the testing row', () => {
  assert.match(rd('bible/07-Rendering/Weather-Arc.md'), /^## A - NO RAIN OVER SNOW \(WEATHER2a, 2026-09-14\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /^\| \*\*NO RAIN OVER SNOW, ENHANCED LANE \(WEATHER2a, 2026-09-14\)\*\*/m);
  assert.match(rd('bible/Home.md'), /`07-Rendering\/Weather-Arc\.md`/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| weather2a_snowground\.test\.js \| \d+ \| WEATHER2a/m);
});
