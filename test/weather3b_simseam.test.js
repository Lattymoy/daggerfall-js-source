// WEATHER3 slice B (2026-09-22): THE WORLD WEATHER MAP IS THE SKY - the
// sim's seam (systems/weatherSim.js WEATHER3b). On the map's lane the
// player's word is the map at the player: every exterior frame, every
// arrival as a jump, and indoors at the door they went in by. The day
// roll's drain and CLK2's evolution stand down there; the front's peak is
// the place's intensity; online and offline read one map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resetWeatherSim, setWeatherMapLaw, weatherMapOn, setWeatherFieldLaw, sampleWeatherField, sampleWeatherIndoors,
  currentWeather, currentWeatherRaw, currentWeatherIntensity, weatherJumpStamp, weatherCrossingStamp,
  tickWeather, rollClimateWeathersForDay, evolveClimateWeathers, setWeatherEvolution, applyClimateWeather,
  weatherRespawn, restoreWeather, currentFieldCells, currentFieldCell, setSharedWeather, setSnowGroundLaw,
  weatherForClimate, WEATHER_ENUM, MAP_JUMP_M, STALE_DRAIN_MINUTES,
} from '../src/systems/weatherSim.js';
import { weatherAt, systemsNear, wornAmong } from '../src/systems/weatherMap.js';
import { FIELD_RANGE_M } from '../src/systems/weatherField.js';
import { createWeatherFront, PRECIP_PEAK } from '../src/systems/weatherFront.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
const SPRING = YEAR + 100 * 1440;
const WINTER = YEAR + 20 * 1440;

/** A place and minute where the map wears `word` (and, if asked, where it did not a minute before). */
function find(word, from = SPRING, { climateAt = woods, x0 = 150000 } = {}) {
  for (let i = 0; i < 4000; i++) {
    const x = x0 + (i % 80) * 6000, z = 60000 + Math.floor(i / 80) * 6000, m = from + (i % 13) * 97;
    if (weatherAt(x, z, m, climateAt).word === word) return { x, z, m };
  }
  throw new Error(`no ${word} found`);
}
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(false); }

test('WEATHER3b: the lane - the field\'s own, and ?wxmap=off hands it back to the field; nothing of the map off it', () => {
  resetWeatherSim(); setWeatherFieldLaw(false);
  assert.equal(weatherMapOn(), false, 'off the field\'s lane there is no map');
  setWeatherFieldLaw(true);
  assert.equal(weatherMapOn(), true, 'on it, the map');
  const saved = globalThis.location;
  try {
    resetWeatherSim(); setWeatherFieldLaw(true);
    globalThis.location = { search: '?wxmap=off' };
    assert.equal(weatherMapOn(), false, 'the door');
  } finally { globalThis.location = saved; }
  resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(false);
  assert.equal(currentWeatherIntensity(), null, 'no map, no intensity - the front rolls its own');
  const p = find('rain');
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  assert.notEqual(currentWeather(), 'rain', 'the field lane reads the zones\' words, not the map (none rolled: nothing moves)');
});

test('WEATHER3b: THE PLAYER\'S WORD IS THE MAP AT THE PLAYER - word, intensity, and the ground law with the storm\'s own word kept', () => {
  for (const word of ['rain', 'thunder', 'overcast', 'cloudy', 'sunny', 'fog']) {
    lane();
    const p = find(word, word === 'fog' ? YEAR + 250 * 1440 + 5 * 60 : SPRING, word === 'fog' ? { climateAt: () => CLIMATES.Swamp } : {});
    const at = word === 'fog' ? () => CLIMATES.Swamp : woods;
    sampleWeatherField(p.m, at(), [p.x, p.z], at, 'live');
    assert.equal(currentWeather(), word);
    const w = weatherAt(p.x, p.z, p.m, at);
    assert.equal(currentWeatherIntensity(), w.intensity, `${word}: the place's intensity`);
  }
  // winter: the woodlands' winter row still rains (a tenth) - over the snow ground it is snow, and the raw word is kept
  lane(); setSnowGroundLaw(true);
  const p = find('rain', WINTER);
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  assert.equal(currentWeather(), 'snow', 'WEATHER2a\'s law: no rain over snow');
  assert.equal(currentWeatherRaw(), 'rain', 'the table\'s word kept beside it');
});

test('WEATHER3b: A CROSSING is a live change close in time and place; a clock jump, a teleport\'s distance, a load or a first sample is a JUMP', () => {
  // walk a line until the word changes, a metre at a time of the same minute
  lane();
  const p = find('rain');
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  const j0 = weatherJumpStamp();
  assert.equal(currentWeather(), 'rain');
  let x = p.x, crossed = false;
  for (let i = 0; i < 400 && !crossed; i++) {
    x += 100;
    const c0 = weatherCrossingStamp();
    if (sampleWeatherField(p.m, WOODS, [x, p.z], woods, 'live')) { crossed = weatherCrossingStamp() === c0 + 1; break; }
  }
  assert.ok(crossed, 'walking out of the rain is a crossing');
  assert.equal(weatherJumpStamp(), j0, '...not a jump');
  // a clock jump: the same place, hours later
  lane();
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  let later = p.m, jumped = false;
  for (let h = 1; h < 72 && !jumped; h++) {
    later = p.m + h * 60;
    const j = weatherJumpStamp(), c = weatherCrossingStamp();
    if (weatherAt(p.x, p.z, later, woods).word === currentWeather()) continue;
    // arrive there straight from p.m, as a rest would
    sampleWeatherField(later, WOODS, [p.x, p.z], woods, 'live');
    jumped = weatherJumpStamp() === j + 1 && weatherCrossingStamp() === c;
  }
  assert.ok(jumped, `a change across more than ${STALE_DRAIN_MINUTES} minutes is a jump, whatever the host called it`);
  // a teleport: the same minute, far away, into other weather
  lane();
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  let q = null;
  for (let k = 0; k < 400 && !q; k++) { const x = p.x + 50000 + k * 3000; if (weatherAt(x, p.z, p.m, woods).word === 'sunny') q = [x, p.z]; }
  assert.ok(q && Math.hypot(q[0] - p.x, q[1] - p.z) > MAP_JUMP_M, 'a sunny place a teleport away, the same minute');
  const j = weatherJumpStamp(), cj = weatherCrossingStamp();
  assert.equal(sampleWeatherField(p.m, WOODS, q, woods, 'live'), true);
  assert.equal(weatherJumpStamp(), j + 1, 'a teleport\'s distance is an arrival, whatever the host called it');
  assert.equal(weatherCrossingStamp(), cj);
  // the first sample of a session, and the first after a load
  lane();
  const j1 = weatherJumpStamp();
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  assert.equal(weatherJumpStamp(), j1 + 1, 'a boot into rain is rain, whole');
  restoreWeather('sunny');
  const j2 = weatherJumpStamp();
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  assert.equal(weatherJumpStamp(), j2 + 1, 'a load\'s first word off the map is a jump too');
});

test('WEATHER3b: THE DAY ROLL STANDS DOWN on the lane - it still rolls, nothing applies it; the evolution rests', () => {
  lane();
  const p = find('sunny');
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  let day = p.m;
  for (let i = 0; i < 40 && weatherForClimate(WOODS) === 0; i++) { day += 1440; rollClimateWeathersForDay(day, Math.random); }
  assert.notEqual(weatherForClimate(WOODS), 0, 'the zones rolled (the classic lane and the save read them)');
  assert.equal(tickWeather(day, WOODS), false, 'the drain applies nothing');
  assert.equal(currentWeather(), 'sunny', 'the map\'s word stands');
  setWeatherEvolution(true);
  evolveClimateWeathers(day);
  assert.equal(evolveClimateWeathers(day + 48 * 60), false, 'two days of hours, and the zones\' words are left where the day put them');
});

test('WEATHER3b: EVERY ARRIVAL LANDS UNDER THE MAP - travel and respawn (in the same climate too) are jumps at the destination', () => {
  lane();
  const a = find('sunny'), b = find('rain');
  sampleWeatherField(a.m, WOODS, [a.x, a.z], woods, 'live');
  const j = weatherJumpStamp(), c = weatherCrossingStamp();
  assert.equal(applyClimateWeather(WOODS, b.m, [b.x, b.z], woods), true);
  assert.equal(currentWeather(), 'rain');
  assert.equal(weatherJumpStamp(), j + 1); assert.equal(weatherCrossingStamp(), c);
  // an arrival under the same sky changes nothing - the day's zone word is never worn on the way through
  lane();
  const b2 = (() => { for (let k = 0; k < 400; k++) { const x = b.x + 60000 + k * 3000; if (weatherAt(x, b.z, b.m, woods).word === 'rain') return [x, b.z]; } return null; })();
  assert.ok(b2, 'a second rain a journey away');
  let day = b.m;
  while (weatherForClimate(WOODS) === WEATHER_ENUM.sunny || weatherForClimate(WOODS) === WEATHER_ENUM.rain) { day += 1440; rollClimateWeathersForDay(day, Math.random); }   // the zones rolled, and not to sunny or rain
  sampleWeatherField(b.m, WOODS, [b.x, b.z], woods, 'live');
  const j1 = weatherJumpStamp();
  assert.equal(applyClimateWeather(WOODS, b.m, b2, woods), false, 'rain to rain');
  assert.equal(weatherJumpStamp(), j1, 'no flicker through the zone\'s word');
  // a respawn inside the same climate base: DFU rolls nothing, the map still reads the new place
  lane();
  sampleWeatherField(a.m, WOODS, [a.x, a.z], woods, 'live');
  weatherRespawn(a.m, WOODS, Math.random, [a.x, a.z], woods);   // the base is recorded
  const j2 = weatherJumpStamp();
  assert.equal(weatherRespawn(b.m, WOODS, Math.random, [b.x, b.z], woods), true);
  assert.equal(currentWeather(), 'rain');
  assert.equal(weatherJumpStamp(), j2 + 1);
});

test('WEATHER3b: INDOORS the weather goes on - the map read over the place the player is in, each change a jump; nothing without a place or off the lane', () => {
  lane();
  const p = find('rain');
  assert.equal(sampleWeatherIndoors(p.m, WOODS, null, woods), false, 'no place named, nothing read');
  // straight in, no outdoor frame first (a load into a dungeon, a recall): the place's own sky
  const j0 = weatherJumpStamp();
  assert.equal(sampleWeatherIndoors(p.m, WOODS, [p.x, p.z], woods), true);
  assert.equal(currentWeather(), 'rain', 'the rain over the place the player went in at');
  assert.equal(weatherJumpStamp(), j0 + 1, 'no one inside saw it come');
  let m = p.m, changed = false;
  for (let i = 1; i < 72 * 6 && !changed; i++) {
    m = p.m + i * 10;
    const j = weatherJumpStamp();
    if (sampleWeatherIndoors(m, WOODS, [p.x, p.z], woods)) { changed = true; assert.equal(weatherJumpStamp(), j + 1); }
  }
  assert.ok(changed, 'the rain outside stopped while the player sat inside');
  assert.equal(currentWeather(), weatherAt(p.x, p.z, m, woods).word);
  setWeatherMapLaw(false);
  assert.equal(sampleWeatherIndoors(m + 600, WOODS, [p.x, p.z], woods), false, 'off the lane, nothing');
});

test('WEATHER3b/c: the clouds get every system near, most important first, and the one overhead is the worn word\'s', () => {
  lane();
  const p = find('rain');
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  const cells = currentFieldCells();
  assert.ok(cells.length > 0);
  for (const c of cells) assert.ok(c.d - c.r <= FIELD_RANGE_M, 'within the sky\'s reach');
  for (let i = 1; i < cells.length; i++) assert.ok(cells[i].imp <= cells[i - 1].imp, 'most important first');
  assert.equal(currentFieldCell()?.word, 'rain', 'the cell overhead is the rain the player wears');
  // and where a weightier cloud covers a higher-priority word - a fog bank under an overcast deck - the cell
  // overhead is still the word worn, not the one that matters most to the sky
  const swamp = () => CLIMATES.Swamp;
  let q = null;
  for (let i = 0; i < 20000 && !q; i++) {
    const x = 60000 + (i % 100) * 4000, z = 60000 + Math.floor(i / 100) * 4000, m = YEAR + 250 * 1440 + 5 * 60 + (i % 7) * 60;
    if (weatherAt(x, z, m, swamp).word !== 'fog') continue;
    const over = systemsNear(x, z, m, swamp, 0).some((sy) => sy.type === 'overcast' && Math.hypot(sy.x - x, sy.z - z) < sy.bands[0][0]);
    if (over) q = { x, z, m };
  }
  assert.ok(q, 'a fog bank under a deck');
  lane();
  sampleWeatherField(q.m, CLIMATES.Swamp, [q.x, q.z], swamp, 'live');
  assert.equal(currentWeather(), 'fog');
  assert.equal(currentFieldCell()?.word, 'fog', 'the fog, not the deck above it');
});

test('WEATHER3b: ONLINE IS OFFLINE - two clients, one shared and one not, at one place and minute wear one sky', () => {
  const p = find('rain');
  lane(); setSharedWeather(true);
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  const online = [currentWeather(), currentWeatherIntensity()];
  lane();
  sampleWeatherField(p.m, WOODS, [p.x, p.z], woods, 'live');
  assert.deepEqual([currentWeather(), currentWeatherIntensity()], online);
  // and the cached systems resolve what a fresh walk does, a step and a minute on
  sampleWeatherField(p.m + 1, WOODS, [p.x + 120, p.z], woods, 'live');
  assert.equal(currentWeather(), wornAmong(systemsNear(p.x + 120, p.z, p.m + 1, woods, 0), p.x + 120, p.z).word);
});

test('WEATHER3b: THE FRONT\'S PEAK IS THE PLACE\'S - the map\'s intensity placed in the mode\'s range, the seeded roll where there is no map', () => {
  const f = createWeatherFront();
  f.tick({ weather: 'rain', peak: 0, nowMinutes: 100, jump: true });
  assert.equal(f.state().episode.peak, PRECIP_PEAK.rain[0], 'the edge of a shower');
  f.tick({ weather: 'rain', peak: 1, nowMinutes: 101 });
  assert.equal(f.state().episode.peak, PRECIP_PEAK.rain[1], 'its heart - the same episode, walked into');
  const g = createWeatherFront(), h = createWeatherFront();
  g.tick({ weather: 'thunder', nowMinutes: 5000, jump: true }); h.tick({ weather: 'thunder', nowMinutes: 5000, jump: true, peak: null });
  assert.equal(g.state().episode.peak, h.state().episode.peak, 'no map: the seeded episode, as WX2 has it');
  // the hosts hand it over, and read the door indoors before the rain source does
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(host), /weatherFront\.tick\(\{ dt, weather, arrival: enhancedFront \? sky\.frontArrival\(\) : 1, nowMinutes: playerTicker\.classicMinutes, tsec: now \/ 1000, jump, peak: weatherOverride \? null : currentWeatherIntensity\(\) \}\);/, host);
  }
  assert.match(rd('src/scenes/worldModes.js'), /host\.weatherIndoors\?\.\(\);\n(?:\s*\/\/[^\n]*\n)*\s*betterAmbience\.frame\(dt, \{\n\s*entity: playerEntity, inside: true,/, 'the indoor frame asks the host, before the rain source reads the word');
  assert.match(rd('src/scenes/world.js'), /weatherIndoors: \(\) => \{\s*\n\s*if \(weatherOverride\) return;\s*\n\s*const p = playerTravelPixel\(\);\s*\n\s*sampleWeatherIndoors\(Math\.floor\(playerTicker\.classicMinutes\), maps\.getClimateIndex\(p\.x, p\.y\), fieldOfPixelLocal\(p\.x, p\.y, TERRAIN_SIZE \/ 2, TERRAIN_SIZE \/ 2\), climateAt\);/, 'world: the place the player is inside, the building\'s pixel or the dungeon\'s');
  assert.match(rd('src/scenes/exterior.js'), /weatherIndoors: \(\) => \{\s*\n\s*if \(weatherOverride\) return;\s*\n\s*sampleWeatherIndoors\(Math\.floor\(playerTicker\.classicMinutes\), locClimateIndex, fieldOfPixelLocal\(_locPixel\.x, _locPixel\.y, TERRAIN_SIZE \/ 2, TERRAIN_SIZE \/ 2\), climateAt\);/, 'exterior: the location\'s own pixel');
});
