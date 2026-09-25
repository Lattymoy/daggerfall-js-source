// WEATHER3 slice C (2026-09-22): THE SKY IS THE MAP'S. Every system near
// the player is a cloud - its bands as nested discs - chosen for the few
// slots by how much of the sky it fills and drawn lowest priority first
// so the blend agrees with the worn word; the clouds stand on clear air
// (the dome, the fog and the sun keep the worn word); the wind rises as
// a storm draws near.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skyCells, approachAt, systemsNear, weatherAt, radialOf, shapeFactor, SKY_WEIGHT, APPROACH_M, PRIORITY } from '../src/systems/weatherMap.js';
import { pickCells, cellOf, cellOfField, CELL_EDGE, MAX_CELLS, VC_PROFILE } from '../src/render/volumetricClouds.js';
import { cloudBaseOf } from '../src/scenes/shared.js';
import { weatherRow } from '../src/render/enhancedSky.js';
import { createWindModel, VIOLENCE } from '../src/systems/wind.js';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentFieldCells,
  currentCloudBase, currentWindApproach, currentWeather,
} from '../src/systems/weatherSim.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
const SPRING = YEAR + 100 * 1440;
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(false); }

test('WEATHER3c: a system is its bands as NESTED discs - skirt, ring, core - each word through the ground law at the cell', () => {
  const s = { id: 't', type: 'thunder', x: 1000, z: 2000, env: 1, r: 13000, bands: [[5000, 'thunder'], [8000, 'rain'], [13000, 'cloudy']] };
  const cells = skyCells([s], 1000, 2000 + 20000);
  assert.deepEqual(cells.map((c) => [c.word, c.r]), [['thunder', 5000], ['rain', 8000], ['cloudy', 13000]]);
  for (const c of cells) { assert.equal(c.x, 1000); assert.equal(c.z, 2000); assert.equal(c.rank, PRIORITY.indexOf(c.word)); }
  cells.forEach((c) => assert.ok(Math.abs(c.imp - SKY_WEIGHT[c.word] * c.r / 20000) < 1e-12, `${c.word}: importance is its weight x the angle it fills`));
  const inside = skyCells([s], 1000, 2000);
  for (const c of inside) assert.equal(c.imp, SKY_WEIGHT[c.word] * 2, 'a disc overhead counts double - it is never the one dropped');
  // WEATHER2a at the CELL: a winter storm is a snow cloud where it stands
  const snowy = skyCells([s], 0, 0, (w) => (w === 'rain' || w === 'thunder' ? 'snow' : w));
  assert.deepEqual(snowy.map((c) => c.word), ['snow', 'snow', 'cloudy']);
});

test('WEATHER3c: THE SLOTS - the most important cells, drawn lowest priority first; a list with no importance is cut in its own order', () => {
  const mk = (word, r, imp) => ({ ...cellOf(word, 0, 0, r), word, imp, rank: PRIORITY.indexOf(word) });
  const cells = [mk('cloudy', 30000, 0.2), mk('thunder', 5000, 2), mk('rain', 9000, 1.8), mk('cloudy', 14000, 1.0), mk('overcast', 20000, 0.1), mk('fog', 6000, 0.9)];
  const low = pickCells(cells, 3);
  assert.deepEqual(low.map((c) => c.word), ['cloudy', 'rain', 'thunder'], 'Low keeps the three that matter, the heart drawn last');
  assert.deepEqual(low.map((c) => c.imp), [1.0, 1.8, 2], 'by importance, not by where they stood in the list - the near cloud field, not the far one');
  const all = pickCells(cells, MAX_CELLS);
  assert.deepEqual(all.map((c) => c.word), ['cloudy', 'cloudy', 'overcast', 'fog', 'rain', 'thunder']);
  assert.ok(all[0].r > all[1].r, 'within a word the larger disc first');
  const plain = [cellOf('rain', 0, 0, 5000), cellOf('thunder', 0, 0, 3000), cellOf('snow', 0, 0, 4000)];
  assert.deepEqual(pickCells(plain, 2), plain.slice(0, 2), 'WEATHER2b\'s field and the test door: as before');
});

// The shader's resolve (volumetricClouds.js resolveAt), in JS: every cell whose rim reaches the point blended over
// what came before by its weight, last over first. Where the last full-weight cell over the player lands is the sky
// overhead - it must be the word the player wears.
const smooth = (lo, hi, v) => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
function overhead(cells, x, z) {
  let word = 'sunny';
  for (const c of cells) {
    const edge = Math.max(1, c.edge ?? c.r * CELL_EDGE);
    const sd = (cx, cz, shape) => Math.hypot(x - cx, z - cz) / shapeFactor(shape, x - cx, z - cz);   // WEATHER3h: the shader's shapedDist
    let w = 1 - smooth(c.r - edge, c.r, sd(c.x, c.z, c.shape));
    if (c.clip) w *= 1 - smooth(c.clip[2] - edge, c.clip[2], sd(c.clip[0], c.clip[1], c.clip[3]));   // WEATHER3g: uCellK
    if (w >= 1) word = c.word;
  }
  return word;
}
test('WEATHER3c: THE BLEND AGREES WITH THE WORD - over hundreds of places, the cloud fully overhead after the pick and the draw order is the worn word', () => {
  let checked = 0, clear = 0;
  for (let i = 0; i < 400; i++) {
    const x = 120000 + (i % 40) * 9001, z = 80000 + Math.floor(i / 40) * 11003, m = SPRING + (i % 17) * 211;
    const worn = weatherAt(x, z, m, woods).word;
    const near = systemsNear(x, z, m, woods, 40000);
    const cells = pickCells(skyCells(near, x, z).map((c) => ({ ...cellOfField(c, (cx, cz) => [cx, cz]), word: c.word })), MAX_CELLS);
    // only places deep inside their band (the rims blend by design) or in clear air - a storm cell's rims include
    // its front's core, where it is clipped
    const bandHere = near.map((s) => ({ s, d: radialOf(s, x, z) })).filter(({ s, d }) => d < s.r);
    const inRim = bandHere.some(({ s, d }) => s.bands.some(([r]) => Math.abs(d - r) < r * CELL_EDGE + 1
      || (s.clip && Math.abs(Math.hypot(s.clip[0] - x, s.clip[1] - z) / shapeFactor(s.clip[3], x - s.clip[0], z - s.clip[1]) - s.clip[2]) < r * CELL_EDGE + 1)));
    if (inRim) continue;
    assert.equal(overhead(cells, x, z), worn, `at ${x},${z} minute ${m}`);
    checked++; if (worn === 'sunny') clear++;
  }
  assert.ok(checked > 100 && clear > 10 && checked - clear > 20, `${checked} places checked, ${clear} of them clear air`);
});

test('WEATHER3c: THE CLOUDS STAND ON CLEAR AIR on the map\'s lane - its row whole but the live wind; off it the worn word\'s eased row', () => {
  const eased = { ...weatherRow('rain'), wind: [0.3, 0.1] };
  assert.deepEqual(cloudBaseOf({}, 'rain', eased), { word: 'rain', row: eased }, 'off the lane: the worn word and the dome\'s own row');
  const cb = cloudBaseOf({ cloudBase: 'sunny' }, 'rain', eased);
  assert.equal(cb.word, 'sunny');
  assert.deepEqual({ ...cb.row, wind: null }, { ...weatherRow('sunny'), wind: null }, 'clear air\'s cover, softness and colours');
  assert.deepEqual(cb.row.wind, [0.3, 0.1], 'the wind is the live one');
  assert.ok(VC_PROFILE.sunny.density < VC_PROFILE.rain.density, 'the base is the fair-weather slab');
  lane();
  assert.equal(currentCloudBase(), 'sunny');
  setWeatherMapLaw(false);
  assert.equal(currentCloudBase(), null);
  // the controller's two paths hand the clouds the base's state and row; the dome keeps its own
  const shared = rd('src/scenes/shared.js');
  assert.equal((shared.match(/const cb = dreadW > 0 \? \{ word: skyWord, row: weatherRowNow \} : cloudBaseOf\(extra, weatherName, weatherRowNow\);/g) || []).length, 2, 'the dome path and the mod path (EVENT1: the live event\'s deck over it while the dread is up)');
  assert.match(shared, /enhancedSky\.setState\(skyState\(\{\s*\n\s*minuteOfDay,\s*\n\s*weather: skyWord,/, 'the dome itself is the worn word\'s (EVENT1: the storm\'s while the dread is up)');
  assert.match(shared, /const skyWord = dreadW > 0 \? DREAD_SKY_WORD : weatherName;/, 'the worn word but under the live event');
});

test('WEATHER3c: THE WIND OF WHAT IS COMING - the storm\'s violence, at its envelope, from its edge to nothing APPROACH_M out; a floor under the fronts', () => {
  const storm = (env = 1, type = 'thunder') => ({ type, env, x: 0, z: 0, r: 10000, bands: [] });
  const at = (gap, env, type) => approachAt([storm(env, type)], 10000 + gap, 0);
  assert.equal(at(APPROACH_M + 1), 0, 'too far to feel');
  assert.equal(at(0), VIOLENCE.thunder, 'at its edge, the storm\'s own violence');
  assert.ok(at(APPROACH_M / 2) > at(APPROACH_M * 0.8) && at(APPROACH_M / 2) < at(0), 'rising as it nears');
  assert.equal(at(0, 0.5), VIOLENCE.thunder * 0.5, 'a young or dying storm blows less');
  assert.ok(at(0, 1, 'rain') < at(0, 1, 'thunder'));
  assert.equal(approachAt([storm(1, 'fog'), storm()], 10000, 0), VIOLENCE.thunder, 'the strongest near');
  // the model: a floor, not a second front on top
  const calm = createWindModel(), windy = createWindModel();
  calm.tick(1000, 'sunny'); windy.tick(1000, 'sunny', 'sunny', 0.9);
  assert.ok(windy.strength() > calm.strength() + 0.5, 'the storm drawing near is felt');
  // a mild front (a cloud field) with a lighter approach under it: the wind is the front's, exactly - not the sum
  const f = createWindModel(), g = createWindModel();
  f.tick(1000, 'sunny'); f.tick(1001, 'cloudy', 'cloudy', 0.05); f.tick(1001 + 200, 'cloudy', 'cloudy', 0.05);
  g.tick(1000, 'sunny'); g.tick(1001, 'cloudy', 'cloudy', 0); g.tick(1001 + 200, 'cloudy', 'cloudy', 0);
  assert.ok(g.frontProgress() > 0.5 && g.strength() < 0.9, 'a front up, well under the cap');
  assert.ok(Math.abs(f.strength() - g.strength()) < 1e-12, 'never the front and the approach summed');
  // the sim hands it over only on the lane
  lane();
  const p = (() => { for (let i = 0; i < 4000; i++) { const x = 150000 + (i % 80) * 6000, z = 60000 + Math.floor(i / 80) * 6000; if (approachAt(systemsNear(x, z, SPRING, woods, 40000), x, z) > 0.3) return [x, z]; } return null; })();
  assert.ok(p);
  sampleWeatherField(SPRING, WOODS, p, woods, 'live');
  assert.equal(currentWindApproach(), approachAt(systemsNear(p[0], p[1], SPRING, woods, 40000), p[0], p[1]));
  setWeatherMapLaw(false);
  assert.equal(currentWindApproach(), 0);
});

test('WEATHER3c: the sim\'s cells - every kind of sky, and a winter storm a snow cloud where it stands', () => {
  lane();
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    sampleWeatherField(SPRING + i * 300, WOODS, [150000 + i * 20000, 150000], woods, 'live');
    for (const c of currentFieldCells()) seen.add(c.word);
  }
  for (const w of ['cloudy', 'overcast', 'rain', 'thunder']) assert.ok(seen.has(w), `${w} clouds stand in the sky`);
  lane(); setSnowGroundLaw(true);
  const WINTER = YEAR + 20 * 1440;
  let winterWords = new Set();
  for (let i = 0; i < 30; i++) {
    sampleWeatherField(WINTER + i * 300, WOODS, [150000 + i * 20000, 150000], woods, 'live');
    for (const c of currentFieldCells()) winterWords.add(c.word);
  }
  assert.ok(!winterWords.has('rain') && !winterWords.has('thunder'), 'no rain cloud over the winter\'s snow ground');
  assert.ok(winterWords.has('snow'));
  assert.ok(typeof currentWeather() === 'string');
});

test('WEATHER3c: the hosts hand the clouds the base, the wind the approach, and the cells their importance and rank', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = rd(host);
    assert.match(h, /cells: fieldCellsHere\(\), cloudBase: weatherOverride \? null : currentCloudBase\(\), approach: weatherOverride \? 0 : currentWindApproach\(\) \}\);/, host);
    assert.match(h, /currentFieldCells\(\)\.map\(\(c\) => cellOfField\(c, \(x, z\) => /, `${host}: the cells carry the pick (WEATHER3g: through the one conversion)`);
  }
  assert.match(rd('src/scenes/shared.js'), /windModel\.tick\(extra\?\.classicMinutes \?\? 0, weatherName, extra\?\.violence \?\? weatherName, extra\?\.approach \?\? 0\);/);
  assert.match(rd('src/render/volumetricClouds.js'), /this\.cells = pickCells\(/);
});
