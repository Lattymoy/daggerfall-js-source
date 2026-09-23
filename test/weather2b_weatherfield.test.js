// WEATHER2b (Mac, 2026-09-14: "a dynamic world space event system where weather can be traveled out of and into
// instead of just starting and stopping in your location"): THE WEATHER FIELD - the day's words as places. The sim's
// six zone words (DFU's roll, the shared day's online) are read as a field over the map on the enhanced lane: a rain,
// thunder or snow word becomes cells scattered over the zone's land on a seeded, jittered lattice, drifting on the
// day's wind, with the zone's base sky between them; the player's weather is what the field says at the player. A
// change on a live frame is a CROSSING: a short front (wind.js CROSS_LEAD_MIN), the sky eased on the same lead. The
// cells go to the clouds (WEATHER2c) so the storm on the horizon is the storm walked into.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CELL_WORDS, CELL_JITTER, DRIFT_M_PER_MIN, FIELD_RANGE_M, NATIVE_TO_METRES, fieldFromNative, nativeFromField, pixelOfField,
  fieldOfPixelLocal, pixelLocalOfField, driftOfDay, cellCandidate, baseWordOf, fieldAt,
} from '../src/systems/weatherField.js';
import {
  resetWeatherSim, setWeatherFieldLaw, weatherFieldOn, sampleWeatherField, weatherCrossingStamp, weatherJumpStamp, currentFieldCells, currentFieldCell,
  importClimateWeathers, tickWeather, applyClimateWeather, weatherRespawn, currentWeather, setSnowGroundLaw, WEATHER_ENUM, setWeatherMapLaw,
} from '../src/systems/weatherSim.js';
import { createWindModel, frontFactor, FRONT_LEAD_MIN, CROSS_LEAD_MIN } from '../src/systems/wind.js';
import { CLIMATES, MAX_MAP_PIXEL_Y } from '../src/formats/mapsFile.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { FEATURES } from '../src/systems/features.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { ONLINE_FORCED_PREFS } from '../src/systems/onlineLane.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url)).toString();
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const SUMMER = 6 * 30 * 1440;
const E = WEATHER_ENUM;
/** the six zones' words, in the slots' order: Desert, Mountain, Rainforest, Swamp, Subtropical, Woodlands */
const DAY = Uint8Array.of(E.sunny, E.thunder, E.rain, E.fog, E.sunny, E.rain);
const WOODS = () => CLIMATES.Woodlands;
const wordOf = (c) => ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow'][{ [CLIMATES.Desert]: E.sunny, [CLIMATES.Mountain]: E.thunder, [CLIMATES.Rainforest]: E.rain, [CLIMATES.Swamp]: E.fog, [CLIMATES.Subtropical]: E.sunny, [CLIMATES.Woodlands]: E.rain }[c] ?? E.sunny];

/** a place inside a cell, and one in the clear, on a woodland rain day (scanned, so the pin never guesses a seed) */
function placesOn(day, minute = 0, climateAt = WOODS) {
  let inside = null, clear = null;
  for (let x = 100000; x < 400000 && !(inside && clear); x += 3000) {
    for (let z = 100000; z < 300000 && !(inside && clear); z += 3000) {
      const f = fieldAt({ day, minuteOfDay: minute, at: [x, z], climateAt, wordOfClimate: wordOf });
      if (f.inside && !inside) inside = [x, z];
      if (!f.inside && !clear) clear = [x, z];
    }
  }
  return { inside, clear };
}

test('WEATHER2b coordinates: field metres are the natives scaled to the pixel\'s 819.2, the map pixel under a place with y running south, and a fixed location\'s local frame round-trips', () => {
  assert.ok(near(NATIVE_TO_METRES * 32768, TERRAIN_SIZE));
  assert.deepEqual(fieldFromNative(32768 * 3, 32768 * 2), [TERRAIN_SIZE * 3, TERRAIN_SIZE * 2]);
  const back = nativeFromField(TERRAIN_SIZE * 3, TERRAIN_SIZE * 2);
  assert.ok(near(back[0], 32768 * 3) && near(back[1], 32768 * 2));
  assert.deepEqual(pixelOfField(TERRAIN_SIZE * 3.5, TERRAIN_SIZE * 2.5), { x: 3, y: MAX_MAP_PIXEL_Y - 1 - 2 }, 'MapsFile: y = 499 - z / dim');
  const [mx, mz] = fieldOfPixelLocal(120, 200, 100, 250);
  assert.ok(near(mx, 120 * TERRAIN_SIZE + 100) && near(mz, (499 - 200) * TERRAIN_SIZE + 250));
  assert.deepEqual(pixelOfField(mx, mz), { x: 120, y: 200 }, 'the location\'s own pixel');
  assert.deepEqual(pixelLocalOfField(120, 200, mx, mz), [100, 250]);
});

test('WEATHER2b the cells: three precipitating words with a spacing, a radius range, a coin and a base sky; the candidate is seeded by day, index and word; the drift is the day\'s heading times the minutes', () => {
  assert.deepEqual(Object.keys(CELL_WORDS), ['rain', 'thunder', 'snow', 'sandstorm']);   // WEATHER2d: the sandstorm, never a zone's word, seats on desert land
  for (const w of Object.values(CELL_WORDS)) { assert.ok(w.spacing > 2 * w.radius[0] && w.radius[1] > w.radius[0] && w.p > 0 && w.p < 1); assert.ok(['overcast', 'cloudy'].includes(w.base)); }
  assert.equal(baseWordOf('rain'), 'overcast'); assert.equal(baseWordOf('thunder'), 'cloudy'); assert.equal(baseWordOf('snow'), 'overcast');
  for (const w of ['sunny', 'cloudy', 'overcast', 'fog']) assert.equal(baseWordOf(w), w, 'a whole-sky word makes no cells');
  assert.equal(cellCandidate('sunny', 3, 0, 0), null);
  // seeded: the same again, another day or index or word another answer; jittered inside its lattice cell; a radius in range
  let present = 0;
  for (let gx = 0; gx < 40; gx++) for (let gz = 0; gz < 40; gz++) {
    const a = cellCandidate('thunder', 12, gx, gz), b = cellCandidate('thunder', 12, gx, gz);
    assert.deepEqual(a, b);
    if (!a) continue;
    present++;
    const s = CELL_WORDS.thunder.spacing;
    assert.ok(a.x >= (gx + 0.5 - CELL_JITTER) * s - 1e-6 && a.x <= (gx + 0.5 + CELL_JITTER) * s + 1e-6, 'jittered inside its lattice cell');
    assert.ok(a.r >= CELL_WORDS.thunder.radius[0] && a.r <= CELL_WORDS.thunder.radius[1]);
  }
  assert.ok(present / 1600 > CELL_WORDS.thunder.p - 0.08 && present / 1600 < CELL_WORDS.thunder.p + 0.08, `the coin lands near its share: ${present / 1600}`);
  assert.notDeepEqual(cellCandidate('thunder', 13, 5, 5), cellCandidate('thunder', 12, 5, 5), 'another day');
  const perWord = ['rain', 'thunder', 'snow'].map((w) => JSON.stringify([...Array(20).keys()].map((i) => cellCandidate(w, 12, i, 7))));
  assert.equal(new Set(perWord).size, 3, 'another word, another lattice of coins');
  const d0 = driftOfDay(12, 0), d1 = driftOfDay(12, 600), e = driftOfDay(13, 600);
  assert.deepEqual(d0, [0, 0]);
  assert.ok(near(Math.hypot(...d1), DRIFT_M_PER_MIN * 600), 'the distance so far');
  assert.ok(!near(Math.atan2(d1[1], d1[0]), Math.atan2(e[1], e[0])), 'another day, another heading');
});

test('WEATHER2b fieldAt: inside a cell the cell\'s word, in the clear the zone\'s base; the cells drift with the minutes; the cells nearest first within range; a whole-sky zone stays whole', () => {
  const { inside, clear } = placesOn(12);
  assert.ok(inside && clear, 'a rain day has cells and gaps');
  const fi = fieldAt({ day: 12, minuteOfDay: 0, at: inside, climateAt: WOODS, wordOfClimate: wordOf });
  assert.equal(fi.word, 'rain'); assert.equal(fi.zoneWord, 'rain'); assert.ok(fi.inside && fi.inside.d < fi.inside.r);
  const fc = fieldAt({ day: 12, minuteOfDay: 0, at: clear, climateAt: WOODS, wordOfClimate: wordOf });
  assert.equal(fc.word, 'overcast', 'the base between rain cells'); assert.equal(fc.inside, null);
  for (const f of [fi, fc]) {
    for (let i = 1; i < f.cells.length; i++) assert.ok(f.cells[i].d >= f.cells[i - 1].d, 'nearest first');
    for (const c of f.cells) { assert.equal(c.word, 'rain'); assert.ok(c.d - c.r <= FIELD_RANGE_M); }
    assert.ok(f.cells.length > 0 && f.cells.length < 40);
  }
  // the drift: the same cell, moved by the day's drift
  const later = fieldAt({ day: 12, minuteOfDay: 600, at: inside, climateAt: WOODS, wordOfClimate: wordOf });
  const d = driftOfDay(12, 600);
  const moved = later.cells.find((c) => near(c.x, fi.cells[0].x + d[0], 1e-6) && near(c.z, fi.cells[0].z + d[1], 1e-6));
  assert.ok(moved, 'the nearest cell is where the drift carried it');
  // a mountain zone on a thunder day: thunderheads, cloudy between
  const mtn = () => CLIMATES.Mountain;
  const { inside: ti, clear: tc } = placesOn(12, 0, mtn);
  assert.equal(fieldAt({ day: 12, minuteOfDay: 0, at: ti, climateAt: mtn, wordOfClimate: wordOf }).word, 'thunder');
  assert.equal(fieldAt({ day: 12, minuteOfDay: 0, at: tc, climateAt: mtn, wordOfClimate: wordOf }).word, 'cloudy');
  // a desert on a sunny day: no cells, the word whole
  const des = () => CLIMATES.Desert;
  const fd = fieldAt({ day: 12, minuteOfDay: 0, at: inside, climateAt: des, wordOfClimate: wordOf });
  assert.equal(fd.word, 'sunny'); assert.deepEqual(fd.cells, []);
  // a cell's word is the climate UNDER ITS SEAT: a woodland traveller beside the mountains sees their thunderheads
  const border = (px) => (px >= 200 ? CLIMATES.Mountain : CLIMATES.Woodlands);
  const fb = fieldAt({ day: 12, minuteOfDay: 0, at: [199.5 * TERRAIN_SIZE, 150 * TERRAIN_SIZE], climateAt: border, wordOfClimate: wordOf });
  assert.ok(fb.cells.some((c) => c.word === 'thunder') && fb.cells.some((c) => c.word === 'rain'), 'both zones\' cells in view from the border');
});

test('WEATHER2b the sim: nothing off the lane; on it the player\'s word is the field\'s, a live change is a crossing, a drain\'s is not, an arrival\'s is a jump; the respawn and the travel arrival sample the destination; the cells are kept for the clouds', () => {
  resetWeatherSim(); setWeatherMapLaw(false); setSnowGroundLaw(false);   // WEATHER3b: the day-roll machine's pin - on the map's lane the map is the sky and this machine stands down (weather3b pins that)
  importClimateWeathers(DAY);
  const now = SUMMER + 12 * 1440;   // a summer day (no ground law in play either way - the seam is off above)
  const day = Math.floor(now / 1440);
  const p = placesOn(day);
  assert.ok(p.inside && p.clear);
  // off the lane: false, nothing moves
  setWeatherFieldLaw(false);
  tickWeather(now, CLIMATES.Woodlands);
  assert.equal(currentWeather(), 'rain', 'DFU: the zone\'s word');
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.clear, WOODS, 'live'), false);
  assert.equal(currentWeather(), 'rain'); assert.equal(weatherCrossingStamp(), 0);
  // on the lane: the clear is overcast (a drain's change: no crossing), the cell is rain (a live change: a crossing)
  setWeatherFieldLaw(true);
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.clear, WOODS, 'drain'), true);
  assert.equal(currentWeather(), 'overcast'); assert.equal(weatherCrossingStamp(), 0); assert.equal(currentFieldCell(), null);
  assert.ok(currentFieldCells().length > 0 && currentFieldCells().every((c) => c.word === 'rain'), 'the cells near the player, for the clouds');
  const j0 = weatherJumpStamp();
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.inside, WOODS, 'live'), true);
  assert.equal(currentWeather(), 'rain'); assert.equal(weatherCrossingStamp(), 1, 'a crossing'); assert.equal(weatherJumpStamp(), j0);
  assert.ok(currentFieldCell() && currentFieldCell().word === 'rain');
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.inside, WOODS, 'live'), false, 'standing still: no change');
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.clear, WOODS, 'jump'), true, 'an arrival in the clear');
  assert.equal(currentWeather(), 'overcast'); assert.equal(weatherCrossingStamp(), 1); assert.equal(weatherJumpStamp(), j0 + 1, 'a jump');
  // the travel arrival: the array's slot, then the field there - one jump
  const j1 = weatherJumpStamp();
  assert.equal(applyClimateWeather(CLIMATES.Woodlands, now, p.inside, WOODS), true);
  assert.equal(currentWeather(), 'rain'); assert.equal(weatherJumpStamp(), j1 + 1); assert.equal(weatherCrossingStamp(), 1);
  // the respawn: on the lane the field's word at the destination, no fresh roll (a throwing roll proves it)
  const j2 = weatherJumpStamp();
  assert.equal(weatherRespawn(now, CLIMATES.Woodlands, () => { throw new Error('rolled'); }, p.clear, WOODS), true);
  assert.equal(currentWeather(), 'overcast'); assert.equal(weatherJumpStamp(), j2 + 1);
  assert.equal(weatherRespawn(now, CLIMATES.Woodlands, () => { throw new Error('rolled'); }, p.clear, WOODS), false, 'the same base: no change');
  // no words yet: nothing sampled
  resetWeatherSim(); setWeatherMapLaw(false); setWeatherFieldLaw(true);
  assert.equal(sampleWeatherField(now, CLIMATES.Woodlands, p.inside, WOODS, 'live'), false, 'the drain rolls the words first');
  resetWeatherSim(); setWeatherMapLaw(false);
  assert.equal(weatherCrossingStamp(), 0); assert.deepEqual(currentFieldCells(), []);
});

test('WEATHER2b the switch: the enhanced skin, Enhanced Environments and the weather-events row, the seam over them; the row is forced on online', () => {
  resetWeatherSim();
  const skin = uiSkin(); const pe = PREF_DEFAULTS.enhancedEnvironments, pw = PREF_DEFAULTS.weatherEvents;
  try {
    setUiSkin('enhanced'); setPref('enhancedEnvironments', true); setPref('weatherEvents', true);
    assert.equal(weatherFieldOn(), true);
    setPref('weatherEvents', false); assert.equal(weatherFieldOn(), false, 'the row is the switch');
    setPref('weatherEvents', true); setPref('enhancedEnvironments', false); assert.equal(weatherFieldOn(), false);
    setPref('enhancedEnvironments', true); setUiSkin('classic'); assert.equal(weatherFieldOn(), false, '1:1 on the classic skin');
    setWeatherFieldLaw(true); assert.equal(weatherFieldOn(), true, 'the seam wins'); setWeatherFieldLaw(null);
  } finally { setUiSkin(skin); setPref('enhancedEnvironments', pe); setPref('weatherEvents', pw); resetWeatherSim(); }
  const row = FEATURES.find((f) => f.id === 'weather-events');
  assert.ok(row); assert.equal(row.control.key, 'weatherEvents'); assert.equal(row.control.initial, true); assert.equal(row.control.online, true);
  assert.equal(PREF_DEFAULTS.weatherEvents, true); assert.equal(ONLINE_FORCED_PREFS.weatherEvents, true, 'one field for every player');
  assert.equal(FEATURES.findIndex((f) => f.id === 'weather-events'), FEATURES.findIndex((f) => f.id === 'flora-sway') + 1);
  assert.match(rd('src/systems/weatherSim.js'), /get\('wxfield'\) !== 'off'/, 'the kill door');
});

test('WEATHER2b the wind: a crossing builds its front on the short lead, the day roll\'s on three hours; the factor takes the lead; the model says which lead is up', () => {
  assert.equal(CROSS_LEAD_MIN, 6); assert.ok(CROSS_LEAD_MIN < FRONT_LEAD_MIN / 10);
  assert.equal(frontFactor(-CROSS_LEAD_MIN / 2, CROSS_LEAD_MIN), 0.5); assert.equal(frontFactor(-CROSS_LEAD_MIN - 1, CROSS_LEAD_MIN), 0);
  assert.equal(frontFactor(-FRONT_LEAD_MIN / 2), 0.5, 'the default lead is the day roll\'s');
  const a = createWindModel({ seed: 3 }), b = createWindModel({ seed: 3 });
  a.tick(0, 'sunny'); b.tick(0, 'sunny');
  assert.equal(a.leadMinutes(), FRONT_LEAD_MIN, 'none up: the long lead');
  b.arrive();
  a.tick(600, 'rain'); b.tick(600, 'rain');
  assert.equal(a.state().front.lead, FRONT_LEAD_MIN); assert.equal(a.state().front.at, 600 + FRONT_LEAD_MIN);
  assert.equal(b.state().front.lead, CROSS_LEAD_MIN); assert.equal(b.state().front.at, 600 + CROSS_LEAD_MIN);
  assert.equal(b.leadMinutes(), CROSS_LEAD_MIN); assert.equal(b.state().arrivePending, false, 'spent');
  assert.ok(near(b.state().front.strength, a.state().front.strength), 'the same roll, the same strength');
  b.tick(603, 'rain'); assert.equal(b.arrival(), frontFactor(-3, CROSS_LEAD_MIN)); assert.ok(b.inLead());
  b.tick(607, 'rain'); assert.equal(b.arrival(), 1, 'arrived'); assert.ok(!b.inLead());
  a.tick(607, 'rain'); assert.ok(a.arrival() < 0.01, 'the day roll\'s front is still building');
  const c = createWindModel({ seed: 3 }); c.tick(0, 'sunny'); c.arrive(); c.tick(1, 'sunny'); c.tick(2, 'rain');
  assert.equal(c.state().front.lead, FRONT_LEAD_MIN, 'an arrive with no change on its tick is forgotten');
});

test('WEATHER2b the controller and the hosts: the sky eases on the front\'s own lead and has an arrive hook; both hosts sample the field after the drain, read the crossing stamp after the jump\'s, hand the arrivals the place, and give the clouds the field\'s cells', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /weatherArrive\(\) \{ windModel\.arrive\(\); \}/);
  assert.match(shared, /const easeDt = windModel\.inLead\(\) \? dt \* \(WEATHER_EASE_MINUTES \/ windModel\.leadMinutes\(\)\) : dt;/);
  assert.doesNotMatch(shared, /FRONT_LEAD_MIN/, 'the controller no longer assumes the long lead');
  const w = rd('src/scenes/world.js'), e = rd('src/scenes/exterior.js');
  for (const [name, s] of [['world', w], ['exterior', e]]) {
    assert.match(s, /const drained = tickWeather\(/, `${name}: the drain's answer`);
    assert.match(s, /sampleWeatherField\(Math\.floor\(playerTicker\.classicMinutes\), [^,]+, [^;]+, climateAt, drained \? 'drain' : 'live'\);/, `${name}: the field after the drain`);
    assert.match(s, /let seenCrossing = weatherCrossingStamp\(\);/, `${name}: the boot's stamp is the baseline`);
    assert.match(s, /const crossing = weatherCrossingStamp\(\) !== seenCrossing;\s*\n\s*seenCrossing = weatherCrossingStamp\(\);\s*\n\s*if \(crossing && !jump\) sky\.weatherArrive\(\);/, `${name}: a crossing tells the sky, a jump wins`);
    assert.match(s, /cells: fieldCellsHere\(\), cloudBase: /, `${name}: the clouds' cells are the field's (WEATHER3c: the base they stand on beside them)`);
    assert.match(s, /const climateAt = \(px, py\) => maps\.getClimateIndex\(px, py\);/, `${name}: the map's lookup`);
  }
  assert.match(w, /const fieldXZ = \(\) => \{ const wc = state\.worldCoords\(walkMode \? player\.pos : cam\.pos\); return fieldFromNative\(wc\.x, wc\.z\); \};/, 'world: the player\'s place in the field');
  assert.match(w, /const h = state\.localFromWorld\(n\[0\], n\[1\]\); const cell = cellOf\(c\.word, h\[0\], h\[1\], c\.r\);/, 'world: the cells back into the floating host space');
  assert.match(w, /weatherRespawn\(Math\.floor\(playerTicker\.classicMinutes\), maps\.getClimateIndex\(px\.x, px\.y\), Math\.random, fieldXZ\(\), climateAt\)/, 'world: the respawn samples the destination');
  assert.equal((w.match(/applyClimateWeather\([^;]*fieldXZ\(\), climateAt\);/g) || []).length, 2, 'world: both travel arrivals sample the destination');
  assert.match(e, /fieldOfPixelLocal\(_locPixel\.x, _locPixel\.y, eye\[0\], eye\[2\]\)/, 'exterior: the eye in the location\'s pixel');
  assert.match(e, /const h = pixelLocalOfField\(_locPixel\.x, _locPixel\.y, c\.x, c\.z\); const cell = cellOf\(c\.word, h\[0\], h\[1\], c\.r\);/);
});

test('WEATHER2b records: the arc page\'s B, the ledger row, the features arc, Home\'s index and the testing row', () => {
  assert.match(rd('bible/07-Rendering/Weather-Arc.md'), /^## B - THE WEATHER FIELD \(WEATHER2b, 2026-09-14\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /^\| \*\*THE WEATHER FIELD \(WEATHER2b, 2026-09-14\)\*\*/m);
  assert.match(rd('bible/10-UI/Features-Arc.md'), /^## WEATHER2b - WEATHER AS PLACES, THE ROW \(2026-09-14\)/m);
  assert.match(rd('bible/Home.md'), /B: the weather field/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| weather2b_weatherfield\.test\.js \| \d+ \| WEATHER2b/m);
});
