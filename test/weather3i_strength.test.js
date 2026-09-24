// WEATHER3i (2026-09-23, Mac on WEATHER3h's render: "Let's make this more subtle and push the detail further";
// the detail chosen: "Strength inside a region"): THE STRENGTH OF WHAT FALLS, on the map and under the sky. The law's
// intensity now tapers across the CORE, where the system's word falls - a drizzle at the rain's edge, the downpour at
// its heart - where before it tapered across the whole outline and a grown front's rain never fell below 0.73. The
// travel map draws it: each region that falls closes its hatch up a step where the fall is moderate and again where it
// is heavy, one law with the words the hover reads and the rain the player feels; and every weather's hand is a third
// lighter than WEATHER3h's. AUDIT-3i (three lenses, before it shipped) found the steps rounded past their regions, the
// dots set in rows, the steps drawn under their own light hatch on the sheet, the player's strength read before the
// ground law and the hover at another minute than the hatch - and pins that a wrong painter, host or hatch passed.
// Each is paid and pinned here by execution.
// DISC17-C (2026-09-24, Mac: "Remove the enhanced map weather enhancements entirely"): the travel map draws no weather
// now, so its field, its steps' hand, its painter, its sheet, its hover and its key went with it. The law stands - the
// intensity tapering across the core, and the player wearing the strongest of what falls after the ground law - pinned
// here at the steps the map drew (0.35 and 0.7, strengthOf below).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandAt, EDGE_INTENSITY, wornAmong, systemsNear, weatherAt } from '../src/systems/weatherMap.js';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentWeather,
  currentWeatherRaw, currentWeatherIntensity, currentFieldCell, mapGround,
} from '../src/systems/weatherSim.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const YEAR = 405 * 360 * 1440;
const WINTER = YEAR + 20 * 1440;
const FALLS = ['rain', 'thunder', 'snow', 'sandstorm'];
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(true); }
/** The strength steps the travel map drew (the retired ui/weatherLayer.js STRENGTH_STEPS): light, moderate, heavy - only for what falls. */
const strengthOf = (word, v) => (FALLS.includes(word) ? (v >= 0.35) + (v >= 0.7) : 0);

test('WEATHER3i: THE LAW - the intensity tapers across the core, a drizzle at the rain\'s edge and the downpour at its heart; the rings hold the edge\'s', () => {
  // WEATHER3a's own range, the whole envelope at the heart and a fifth at the edge, moved from the outline to the core
  assert.ok(Math.abs(EDGE_INTENSITY - (1 - 0.8)) < 1e-12, `the edge ${EDGE_INTENSITY}, WEATHER3a's own`);
  const core = 40000, env = 0.8;
  const front = { r: core * Math.sqrt(3), env, bands: [[core, 'rain'], [core * Math.sqrt(2), 'overcast'], [core * Math.sqrt(3), 'cloudy']] };
  assert.equal(bandAt(front, 0).intensity, env, 'the whole envelope at the heart');
  assert.ok(Math.abs(bandAt(front, core - 1e-6).intensity - env * EDGE_INTENSITY) < 1e-9, 'a fifth of it at the rain\'s edge');
  assert.ok(Math.abs(bandAt(front, core * 1.2).intensity - env * EDGE_INTENSITY) < 1e-12 && Math.abs(bandAt(front, core * 1.7).intensity - env * EDGE_INTENSITY) < 1e-12, 'the rings hold the edge\'s');
  for (let d = 0; d < core; d += core / 50) assert.ok(bandAt(front, d).intensity >= bandAt(front, d + core / 50).intensity, 'never rising outward');
  // over the core's AREA the intensity is uniform on [edge, 1] x env: a grown core is 19% light, 44% moderate and
  // 37% heavy (the record's numbers), where before it was heavy to its edge
  const grown = { ...front, env: 1 };
  const n = 20000, count = [0, 0, 0];
  for (let i = 0; i < n; i++) count[strengthOf('rain', bandAt(grown, core * Math.sqrt((i + 0.5) / n)).intensity)]++;
  [0.1875, 0.4375, 0.375].forEach((want, k) => assert.ok(Math.abs(count[k] / n - want) < 1e-3, `step ${k}: ${(count[k] / n).toFixed(4)} of a grown core, ${want} by the law`));
  // a storm cell has no rings: its core is its outline, as before
  const cell = { r: 8000, env: 1, bands: [[8000, 'thunder']] };
  assert.ok(Math.abs(bandAt(cell, 4000).intensity - (1 - (1 - EDGE_INTENSITY) * 0.25)) < 1e-12);
  // a core of no size is all edge, never NaN
  assert.ok(Math.abs(bandAt({ r: 5, env: 1, bands: [[0, 'rain'], [5, 'overcast']] }, 0).intensity - EDGE_INTENSITY) < 1e-12);
});

test('WEATHER3i: THE PLAYER FEELS WHAT FALLS - the sim wears the strongest of what falls AFTER the ground law, and keeps the storm\'s own word', () => {
  // on winter ground a rain front under a snow front is snow: the strongest snow there is what falls. Read raw, the
  // sim wore the rain front's intensity (rain outranks snow) where the snow front's is what falls
  lane();
  const ground = mapGround(woods);
  let differs = 0, checked = 0;
  for (let i = 0; i < 20000 && differs < 6; i++) {
    const x = 60000 + (i % 157) * 5003, z = 60000 + Math.floor(i / 157) * 4001, m = WINTER + (i % 31) * 1440 + (i % 7) * 180;
    const g = (w, gx, gz) => ground(w, gx, gz, m);
    const near = systemsNear(x, z, m, woods, 0);
    const worn = wornAmong(near, x, z, g), raw = wornAmong(near, x, z);
    if (!FALLS.includes(worn.word)) continue;
    const bite = strengthOf(worn.word, worn.intensity) !== strengthOf(worn.word, raw.intensity);
    if (!bite && checked > 20) continue;
    lane();
    sampleWeatherField(m, WOODS, [x, z], woods, 'jump');
    assert.equal(currentWeather(), worn.word);
    assert.equal(currentWeatherIntensity(), worn.intensity, 'the strength the player feels is the one that falls there');
    assert.equal(currentWeatherRaw(), worn.raw, 'the painting storm\'s own word, for the sky\'s violence');
    assert.equal(worn.intensity, weatherAt(x, z, m, woods, { ground }).intensity, 'and the law\'s own read');
    // the cloud overhead is the worn word's - a winter rain front's cell is a snow cloud, as the word is
    if (currentFieldCell()) assert.equal(currentFieldCell().word, worn.word);
    checked++;
    if (bite) differs++;
  }
  assert.ok(differs >= 3, `${differs} places where reading raw would have worn another strength`);
});
