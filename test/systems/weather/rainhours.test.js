// RAIN-HOURS and RAIN-HEART (Mac, 2026-10-13: "I feel like it rains too much, also sometimes instead of downpours it
// should just sprinkle"). Measured on the world weather map (systems/weather/weatherMap.js, the enhanced lane's weather, on by
// default and always online) before the change: a woodland spring under falling rain or a storm 36% of every hour, a
// swamp's 41%, a jungle's 54% - the Chronicles' odds of a DAY's word, which DFU wears all day, taken as the share of
// TIME - and half of that wet time drawn at half the rain's profile or more, because the place's intensity (WEATHER3b,
// in WX2's per-shower roll's place) reaches the envelope's 1 at every grown front's heart: every rain front poured
// there. RAIN-HOURS: the map wears rain and thunder for WET_HOURS (half) of their odds, and the hours they give up are
// the climate's own dry weather in its own proportions. RAIN-HEART: each rain front is born with its own strength -
// evenly from the heaviest front's edge to the downpour - so a whole front can be a sprinkle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  targetShares, WET_HOURS, STRENGTH, systemStrength, EDGE_INTENSITY, birthsIn, cellsOf, systemAt, bandAt, weatherAt,
  envelope, BIRTH_RADIUS, SYSTEM_TYPES, SAND_SHARE_OF_CLOUDY, PRIORITY,
} from '../../../src/systems/weather/weatherMap.js';
import { WEATHER_TABLE } from '../../../src/systems/weather/weatherTable.js';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentWeather,
  currentWeatherIntensity,
} from '../../../src/systems/weather/weatherSim.js';
import { createWeatherFront, rollPeak } from '../../../src/systems/weather/weatherFront.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { SEASONS } from '../../../src/systems/gameDate.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const YEAR = 405 * 360 * 1440;
const woods = () => CLIMATES.Woodlands;
const near = (got, want, what = '', within = 1e-12) => assert.ok(Math.abs(got - want) < within, `${what} ${got} vs ${want}`);
const painted = (t) => PRIORITY.reduce((sum, w) => sum + t[w], 0);   // every share but clear air's
const share = (xs, p) => xs.filter(p).length / xs.length;

/** Real rain fronts born over the woodlands across a spring: the lattice's own births, a node at a time. */
function springFronts() {
  const [, nodeMinutes] = SYSTEM_TYPES.rain.node;
  const gt0 = Math.floor((YEAR + 70 * 1440) / nodeMinutes);
  const out = [];
  for (let gt = gt0; gt < gt0 + 60; gt++) for (let gx = 0; gx < 8; gx++) for (let gz = 0; gz < 4; gz++) out.push(...birthsIn('rain', gx, gz, gt, woods));
  return out;
}

test('RAIN-HOURS: a wet day rains for half its hours - rain and thunder worn for WET_HOURS of their odds, the hours they give up the dry words\' by the table\'s own proportions, snow untouched, and the classic lane\'s table still DFU\'s digits (mutants: rain all day; storms all day; the hours handed to clear air alone; fog left out of the dry words)', () => {
  assert.deepEqual(WET_HOURS, { rain: 0.5, thunder: 0.5 });
  // the woodlands' spring, the Chronicles' digits: Sunny 35, Cloudy 15, Overcast 10, Fog 5, Rain 25, Snow 0, Thunder 10
  assert.deepEqual(WEATHER_TABLE.woodlands[SEASONS.Spring], [35, 15, 10, 5, 25, 0, 10], 'the table is DFU\'s, the classic lane\'s roll');
  const t = targetShares(WEATHER_TABLE.woodlands, SEASONS.Spring);
  const lift = 1 + 0.175 / 0.65;   // the 17.5 points rain and thunder give up, over the 65 the dry words hold
  near(t.rain, 0.125, 'rain'); near(t.thunder, 0.05, 'thunder'); near(t.snow, 0, 'snow');
  near(t.cloudy, 0.15 * lift, 'cloud'); near(t.overcast, 0.10 * lift, 'the deck'); near(t.fog, 0.05 * lift, 'fog');
  near(1 - painted(t), 0.35 * lift, 'clear air takes its share as well');
  // every row of every climate: the falling words halved, snow kept, each dry word lifted by the one factor
  for (const [name, table] of Object.entries(WEATHER_TABLE)) {
    for (const season of Object.values(SEASONS)) {
      const [sunny, cloudy, overcast, fog, rain, snow, thunder] = table[season].map((v) => v / 100);
      const k = 1 + ((rain + thunder) / 2) / (sunny + cloudy + overcast + fog);
      const got = targetShares(table, season);
      const at = `${name} ${season}`;
      near(got.rain, rain / 2, `${at} rain`); near(got.thunder, thunder / 2, `${at} thunder`); near(got.snow, snow, `${at} snow keeps its odds`);
      near(got.cloudy + got.sandstorm, cloudy * k, `${at} cloud`); near(got.overcast, overcast * k, `${at} the deck`); near(got.fog, fog * k, `${at} fog`);
      near(1 - painted(got), sunny * k, `${at} clear air`);
      if (name === 'desert') near(got.sandstorm, cloudy * k * SAND_SHARE_OF_CLOUDY, `${at}: the sand keeps its share of the cloud`);
    }
  }
  // what a player stands under: the falling words' share of every hour, halved - the jungle's spring from 52% to 26%
  const jungle = targetShares(WEATHER_TABLE.jungle, SEASONS.Spring);
  near(jungle.rain + jungle.thunder, 0.26, 'the jungle\'s spring');
});

test('RAIN-HEART: a rain front is born with its own strength - evenly from the heaviest front\'s edge to the whole downpour, drawn from its id alone - and every other system, a storm cell among them, falls whole (mutants: every front pours; the floor at nothing)', () => {
  assert.deepEqual(STRENGTH, { rain: [EDGE_INTENSITY, 1] });
  assert.equal(EDGE_INTENSITY, 0.2, 'the weakest front\'s heart is the heaviest one\'s edge');
  const fronts = springFronts();
  assert.ok(fronts.length > 400, `a spring's fronts over the woodlands (${fronts.length})`);
  for (const f of fronts) {
    assert.equal(f.strength, systemStrength('rain', f.id), 'the id\'s own draw');
    assert.ok(f.strength >= EDGE_INTENSITY && f.strength <= 1, `inside the range (${f.strength})`);
  }
  const s = fronts.map((f) => f.strength).sort((a, b) => a - b);
  const q = (p) => s[Math.floor(p * (s.length - 1))];
  for (const [p, want] of [[0.25, 0.4], [0.5, 0.6], [0.75, 0.8]]) assert.ok(Math.abs(q(p) - want) < 0.05, `evenly spread: the ${p} quantile ${q(p).toFixed(3)}`);
  // a storm is born in its front and is a storm, whatever the front's strength; nothing else has a range
  const cells = fronts.slice(0, 80).flatMap((f) => cellsOf(f, woods));
  assert.ok(cells.length > 0 && cells.every((c) => c.strength === undefined), 'a cell carries no strength - it falls whole');
  for (const type of ['overcast', 'cloudy', 'fog', 'snow', 'sandstorm', 'thunder']) assert.equal(systemStrength(type, `${type}:1:2:3:0`), 1, `${type} falls whole`);
  const desert = () => CLIMATES.Desert;
  const [, sandMinutes] = SYSTEM_TYPES.sandstorm.node;
  const sand = [];
  for (let gt = Math.floor((YEAR + 100 * 1440) / sandMinutes), n = 0; n < 200 && sand.length < 5; gt++, n++) for (let gx = 0; gx < 6; gx++) sand.push(...birthsIn('sandstorm', gx, 1, gt, desert));
  assert.ok(sand.length > 0 && sand.every((b) => b.strength === 1), 'a sandstorm is never thin (WEATHER2d)');
});

test('RAIN-HEART: the place\'s intensity carries the front\'s strength - a third of fronts are a drizzle from heart to edge where none was, about a quarter pour at their heart where every one did, and over a core\'s ground and life most of the rain falls light (mutants: every front pours; the strength unread)', () => {
  // the band law: the strength scales the core, heart to edge (a system with none - a cell - falls whole)
  const sys = { r: 2, bands: [[1, 'rain'], [2, 'overcast']], env: 1, strength: 0.4 };
  near(bandAt(sys, 0).intensity, 0.4, 'the heart');
  near(bandAt(sys, 1 - 1e-9).intensity, 0.4 * EDGE_INTENSITY, 'the edge: the strength times the edge\'s fifth', 1e-8);
  near(bandAt(sys, 1.5).intensity, 0.4 * EDGE_INTENSITY, 'the ring holds the edge\'s');
  near(bandAt({ ...sys, strength: undefined }, 0).intensity, 1, 'no strength: whole');
  // the hearts of a spring's fronts, as the front draws them (its roll of the place, at the wander's mean)
  const fronts = springFronts();
  const hearts = fronts.map((f) => rollPeak('rain', f.strength) * 0.8);
  assert.ok(share(hearts, (h) => h < 0.2) > 0.27 && share(hearts, (h) => h < 0.2) < 0.4, `a drizzle heart: ${(share(hearts, (h) => h < 0.2) * 100).toFixed(0)}% of fronts`);
  assert.ok(share(hearts, (h) => h >= 0.5) > 0.2 && share(hearts, (h) => h >= 0.5) < 0.36, `a downpour heart: ${(share(hearts, (h) => h >= 0.5) * 100).toFixed(0)}% of fronts`);
  assert.ok(rollPeak('rain', 1) * 0.8 >= 0.5, 'before, every front\'s heart (its whole envelope) was a downpour');
  // a fixed place under a front, over its life: the core's ground taken evenly (its area), the life weighted by the
  // core's area then, the place's intensity drawn as the front draws it - the rain a player stands in
  const r = seededRng(0x5EA7);
  const spec = SYSTEM_TYPES.rain;
  let w = 0, light = 0, heavy = 0;
  for (let i = 0; i < 60000; i++) {
    const f = fronts[i % fronts.length], env = envelope(spec, r());
    const weight = (BIRTH_RADIUS + (1 - BIRTH_RADIUS) * env) ** 2;
    const place = bandAt({ r: 1, bands: [[1, 'rain']], env, strength: f.strength }, Math.sqrt(r())).intensity;
    const drawn = rollPeak('rain', place) * 0.8;
    w += weight; if (drawn < 0.15) light += weight; if (drawn >= 0.5) heavy += weight;
  }
  assert.ok(light / w > 0.6, `a sprinkle (under 0.15 of the profile) ${(light / w * 100).toFixed(0)}% of the rain - a third before`);
  assert.ok(heavy / w < 0.06, `heavy (half the profile or more) ${(heavy / w * 100).toFixed(1)}% of the rain - a fifth before`);
});

test('RAIN-HEART: the player under a weak front\'s heart wears a sprinkle and under a strong one\'s a downpour - the map\'s word and intensity at the player, through the sim, into the WX2 front (mutants: every front pours; the strength unread)', () => {
  const fronts = springFronts().sort((a, b) => a.strength - b.strength);
  /** A front's heart in its hold, where it is the rain the map wears there (no storm cell, no stronger front over it). */
  const heartOf = (f) => {
    const m = Math.floor(f.bornAt + f.life * 0.45);
    const s = systemAt(f, m);
    const worn = weatherAt(s.x, s.z, m, woods);
    return worn.word === 'rain' && worn.system?.id === f.id ? { x: s.x, z: s.z, m } : null;
  };
  const wear = (f) => {
    const at = heartOf(f);
    if (!at) return null;
    resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(false);
    sampleWeatherField(at.m, CLIMATES.Woodlands, [at.x, at.z], woods, 'jump');
    const peak = currentWeatherIntensity();
    const fr = createWeatherFront({ seed: 7 });
    const fx = fr.tick({ weather: currentWeather(), nowMinutes: at.m, jump: true, tsec: 0, peak });
    return { word: currentWeather(), peak, drawn: fx.intensity, strength: f.strength };
  };
  const weak = fronts.map(wear).find(Boolean);
  const strong = [...fronts].reverse().map(wear).find(Boolean);
  assert.ok(weak && strong, 'a weak front and a strong one, each worn at its heart');
  assert.equal(weak.word, 'rain'); assert.equal(strong.word, 'rain');
  near(weak.peak, weak.strength, 'the map hands the sim the front\'s strength at its heart'); near(strong.peak, strong.strength, 'and the strong front\'s');
  assert.ok(weak.strength < 0.25 && weak.drawn < 0.12, `the weak front's heart is a sprinkle: ${weak.drawn.toFixed(3)} of the profile (strength ${weak.strength.toFixed(3)})`);
  assert.ok(strong.strength > 0.95 && strong.drawn > 0.5, `the strong front's heart pours: ${strong.drawn.toFixed(3)} of the profile`);
  resetWeatherSim();
});
