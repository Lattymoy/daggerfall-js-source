// WET-FALL (FIELD BUGS 2026-10-15f, a Discord report: "Player is getting wet despite it not raining. Possibly an
// oversight in reducing the rain?"). RAIN-HEART (Weather-Arc.md) made most rain a sprinkle the eye barely sees, and the
// front eases every episode in behind its cloud - but the soak read the sim's word at the downpour's rate, so a body
// soaked under a sky that dropped nothing. The skin now reads what falls - the word and level the street's frame wrote
// for the ear (DISC9/DISC11) - through weatherSim.js fallingWeather. bible/01-Overview/bugs/Field-Bugs-2026-10-15f.md.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../../../src/systems/weather/weatherSim.js';
import { createWeatherFront, soundWeather } from '../../../src/systems/weather/weatherFront.js';
import { weatherWetGain, feltTemperature } from '../../../src/systems/survival/temperature.js';
import { newSurvival, survivalMinute, runSurvivalMinutes, ROAD_MINUTES } from '../../../src/systems/survival/needs.js';
import { ENV_DEFAULTS } from '../../../src/systems/survival/env.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
afterEach(() => { W.resetWeatherSim(); });

const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (from) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, survival: newSurvival(from) });
const deps = { sinks: {}, autoDrink: false, autoEat: false, rules: SURVIVAL_RULES.casual, rolls: () => 0.99, ctx: { raceId: RACES.Breton } };
// a cool woodland morning, outdoors, nothing worn - the air under 10 dries a point a dry minute
const street = (falling) => ({ ...ENV_DEFAULTS, climateIndex: CLIMATES.Woodlands, month: 2, hour: 9, weather: 'rain', falling });
/** The street's frame, as both open-world hosts run it: the front ticks on the sim's word, the ear's word and level are
 *  written from what it shows (world.js:"setHeardWeather(ambientWord, enhancedFront ? fx.rain ?? fx.intensity : 1, enhancedFront ? fx : null);"). */
const streetFrames = (front, n, { arrival, t0 = 0, peak = null }) => {
  let fx = null;
  for (let i = 0; i < n; i++) {
    fx = front.tick({ dt: 1 / 60, weather: W.currentWeather(), arrival, nowMinutes: 1000, tsec: t0 + i / 60, jump: false, peak });
    W.setHeardWeather(soundWeather(fx, W.currentWeather()), fx.rain ?? fx.intensity, fx);   // AUDIT PRECIP FALL-4: the drops' level, the whole fall beside it
  }
  return fx;
};

test('WET-FALL: a fall soaks by how hard it falls - a sprinkle a sprinkle\'s share, nothing falling nothing, the downpour the mod\'s whole row (mutant: the level ignored)', () => {
  assert.deepEqual([weatherWetGain('rain'), weatherWetGain('rain', { fall: 1 })], [3, 3], 'the classic sky\'s level is the mod\'s row');
  assert.equal(weatherWetGain('rain', { fall: 0 }), 0, 'a rain word with nothing yet down');
  assert.ok(Math.abs(weatherWetGain('rain', { fall: 0.15 }) - 0.45) < 1e-12, 'a light shower: 0.15 of three');
  assert.ok(Math.abs(weatherWetGain('thunder', { fall: 0.5, cloak: true }) - 1) < 1e-12, 'half a storm under a cloak: half of two');
  assert.equal(weatherWetGain('snow', { fall: 0 }), 0);
  assert.equal(weatherWetGain('rain', { fall: 2 }), 3, 'never past the row');
  assert.equal(weatherWetGain('rain', { fall: 0.5, insideBuilding: true }), 0, 'a roof is still a roof');
});

test('WET-FALL: fog is not falling - its row stands whole whatever level the street wrote (mutant: fog scaled)', () => {
  assert.equal(weatherWetGain('fog', { fall: 0 }), 1);
  assert.equal(weatherWetGain('fog', { fall: 0.3 }), 1);
});

test('WET-FALL: the felt reading soaks on the env\'s `falling`, never the sky\'s word, and the sky\'s word alone where no host wrote one (mutant: the sky\'s word read)', () => {
  const felt = (env) => feltTemperature(env, null, { raceId: RACES.Breton }).wetGain;
  assert.equal(felt(street({ word: 'cloudy', level: 0 })), 0, 'a rain sky with nothing falling: no soak');
  assert.ok(Math.abs(felt(street({ word: 'rain', level: 0.2 })) - 0.6) < 1e-12, 'a sprinkle: a fifth of three');
  assert.equal(felt(street(null)), 3, 'no falling word (a test, a bench): the sky\'s word whole, as before');
  assert.ok(Math.abs(felt({ ...street({ word: 'rain', level: 0.5 }), weather: 'snow' }) - 1.5) < 1e-12, 'the sky turned to snow while the outgoing rain tapers: the rain\'s row, not the snow\'s');
});

test('WET-FALL: the front\'s own frames - the sim says rain, the cloud has not come, the street hears a cloudy day and the body stays dry; the shower arrives and it soaks by the shower (mutant: the soak reads the sim\'s word)', () => {
  W.setWeather('rain');
  const front = createWeatherFront({ seed: 7 });
  let fx = streetFrames(front, 60, { arrival: 0 });
  assert.equal(W.currentWeather(), 'rain', 'the sim\'s word');
  assert.equal(fx.shown, null, 'nothing drawn');
  const before = W.fallingWeather();
  assert.notEqual(before.word, 'rain');
  const e = body(0);
  for (let m = 1; m <= 30; m++) survivalMinute(e, m, street(W.fallingWeather()), deps);
  assert.equal(e.survival.wet, 0, 'half an hour under the cloud\'s edge: dry');
  // the shower arrives at a light peak, and falls
  fx = streetFrames(front, 60 * 30, { arrival: 1, t0: 1, peak: 0.1 });
  const now = W.fallingWeather();
  assert.equal(now.word, 'rain');
  assert.ok(now.level > 0 && now.level < 0.3, `a light shower's level, got ${now.level}`);
  for (let m = 31; m <= 40; m++) survivalMinute(e, m, street(W.fallingWeather()), deps);
  assert.ok(e.survival.wet > 0 && e.survival.wet < 10 * 3 * 0.3, `ten minutes in a light shower soak lightly, got ${e.survival.wet}`);
});

test('WET-FALL: after a jump the street\'s word no longer stands - the host\'s own sky, whole: the Sun Baby\'s clear day stays dry (mutant: the fallback the sim\'s word)', () => {
  W.setWeather('rain');
  W.setHeardWeather('rain', 0.4);
  // AUDIT PRECIP FALL-4 (PIN MOVED): the fall carries its snow share - null off the law's lane (the word's own row)
  assert.deepEqual(W.fallingWeather('sunny'), { word: 'rain', level: 0.4, snow: null }, 'the street\'s word stands until a jump');
  W.setHeardWeather('rain', 0.25, { intensity: 0.5, snow: 0.5 });
  assert.deepEqual(W.fallingWeather('sunny'), { word: 'rain', level: 0.5, snow: 0.5 }, 'on the law\'s lane the whole fall and its share - the drops\' level is the ear\'s');
  W.restoreWeather('rain');
  assert.deepEqual(W.fallingWeather('sunny'), { word: 'sunny', level: 1, snow: null }, 'a jump: the host\'s shown sky, at the classic level');
  assert.deepEqual(W.fallingWeather(), { word: 'rain', level: 1, snow: null }, 'with no shown word, the sim\'s');
});

test('WET-FALL: a road the clock jumped over meets no fall it cannot know - the host\'s `falling` is cleared with its weather (mutant: the road keeps the departure\'s rain)', () => {
  const e = body(0);
  e.survival.lastMinute = 0;
  const env = { ...street({ word: 'rain', level: 1 }), weather: 'rain' };
  runSurvivalMinutes(e, 0, ROAD_MINUTES + 60, env, { ...deps, skyFollows: true });
  assert.equal(e.survival.wet, 0, 'a long fast travel lands dry');
});

test('WET-FALL by source: both open-world hosts hand the minute law what fell on the street, under their own shown sky (mutants: either host drops it)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(f);
    assert.match(s, /\n {6}month: dateFromClassicMinutes\(wm\)\.month, hour, weather, falling: fallingWeather\(weather\),/, f);
  }
  assert.match(read('src/scenes/world.js'), /const survivalEnvNow = \(\) => \{[\s\S]{0,400}const weather = shownWeather\(\);/, 'world.js: the shown sky is the fallback');
});
