// FIELD BUGS 2026-09-30 (WARM-SAID) - #bug-reports, "Climates & Calories Bugs": "your temperature gets to either
// "Scorching" or "Freezing" or "Soaked" etc and seems to never recover".
//
// Since the Tiers' third pass a need's stage line is said when the need WORSENS and never on the way back (needs.js
// stageNote) - right for the stages, and it left the recovery unsaid: a player heard the cold seep into their bones and
// never heard it go, heard they were drenched and never that they were dry. The way out of the red is said now, ONCE:
// leaving scorching for any stage that is not red says "You are cooling down.", leaving freezing or deadly cold says
// "You are warming up.", and a soaking or a drenching dried all the way says "You have dried off." The improving stages
// themselves stay silent, and nothing repeats while the recovery goes on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { survivalMinute, runSurvivalMinutes, newSurvival, wetStage, SURVIVAL_TEXT, NEED } from '../../../src/systems/survival/needs.js';
import { temperatureWord } from '../../../src/systems/survival/temperature.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

const COOLING = 'You are cooling down.', WARMING = 'You are warming up.', DRIED = 'You have dried off.';
const RECOVERIES = [COOLING, WARMING, DRIED];
const EVENING_STAR = 11, SUNS_HEIGHT = 6;
/** The starting kit and a casual cloak drawn hood down (variant 0): 15 + 4. */
const kit = (cloak = true) => {
  const w = new Array(27).fill(null);
  w[17] = { templateIndex: 165, group: 'MensClothing' }; w[24] = { templateIndex: 151, group: 'MensClothing' };
  if (cloak) w[14] = { templateIndex: 154, group: 'MensClothing', variant: 0 };
  return w;
};
const body = () => ({ raceId: RACES.Redguard, stats: { endurance: 50, strength: 50 }, items: [], activeEffects: [], fatigue: 6400, health: 40, maxHealth: 40 });
const deps = (said, extra = {}) => ({ worn: kit(), ctx: { raceId: RACES.Redguard }, rules: SURVIVAL_RULES.casual, autoDrink: false, autoEat: false, rolls: () => 0.5, sinks: { say: (t) => said.push(t) }, ...extra });
/** Live `mins` minutes one at a time - each a minute the player stands in - and answer the last reading. */
const live = (e, from, mins, env, d) => { let t = null; for (let m = from + 1; m <= from + mins; m++) t = survivalMinute(e, m, env, d); return t; };
const woods = (hour, weather, inside = false) => ({ climateIndex: CLIMATES.Woodlands, month: EVENING_STAR, hour, weather, insideBuilding: inside });

test('WARM-SAID: the report - a Woodlands winter soak, then an inn: the rain says drenched and deadly cold once each; indoors the thaw says "You are warming up." once as it leaves the red and the drying says "You have dried off." once at dry - the stages between say nothing (mutants: no recovery line; said every minute it improves; the wet dried at wet; freezing not red; the lines swapped)', () => {
  const e = body(); const said = [];
  let now = EVENING_STAR * 30 * 1440 + 10 * 60;
  e.survival = { ...newSurvival(now), lastMinute: now };
  live(e, now, 360, woods(12, 'rain'), deps(said)); now += 360;   // AUDIT C&C T2: rain, through a cloak drawn hood down (the mod's snow keeps any cloak dry)
  assert.equal(wetStage(e.survival.wet), 'drenched');
  assert.equal(temperatureWord(e.survival.felt), 'deadly cold', `six hours in the rain: ${e.survival.felt}`);
  assert.deepEqual(said.filter((t) => [SURVIVAL_TEXT.drenched, SURVIVAL_TEXT.deadly].includes(t)).length, 2, 'each worst stage said once');
  said.length = 0;
  let warmedAt = null, driedAt = null;
  for (let m = 1; m <= 150; m++) {
    const before = said.length;
    survivalMinute(e, now + m, woods(16, 'snow', true), deps(said));
    if (said.slice(before).includes(WARMING)) warmedAt = [m, e.survival.felt];
    if (said.slice(before).includes(DRIED)) driedAt = [m, e.survival.wet];
  }
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [WARMING, DRIED], `the thaw and the drying, once each (heard: ${JSON.stringify(said)})`);
  assert.ok(warmedAt && warmedAt[1] >= -30 && warmedAt[1] < -10, `warming said the minute the reading left freezing for cold (${warmedAt})`);
  assert.ok(driedAt && driedAt[1] < NEED.WET_DAMP, `dried said at dry (${driedAt})`);
  assert.deepEqual(said.filter((t) => [SURVIVAL_TEXT.cold, SURVIVAL_TEXT.freezing, SURVIVAL_TEXT.soaked, SURVIVAL_TEXT.wet, SURVIVAL_TEXT.damp].includes(t)), [], 'the improving stages say nothing (the third pass kept)');
  assert.equal(temperatureWord(e.survival.felt), 'comfortable', `and the inn is comfortable at last (${e.survival.felt})`);
});

test('WARM-SAID: the heat - scorching on the Alik\'r road, then into an inn: "You are cooling down." once; the evening cools further in silence; out again to scorching and back is a new recovery, said again (mutants: no recovery line; the lines swapped; said every minute it improves)', () => {
  const e = body(); const said = [];
  let now = SUNS_HEIGHT * 30 * 1440 + 12 * 60;
  e.survival = { ...newSurvival(now), lastMinute: now };
  const road = (hour) => ({ climateIndex: CLIMATES.Desert, month: SUNS_HEIGHT, hour, weather: 'sunny', inSunlight: true });
  const inn = (hour) => ({ climateIndex: CLIMATES.Desert, month: SUNS_HEIGHT, hour, weather: 'sunny', insideBuilding: true });
  const d = deps(said, { worn: kit(false) });
  live(e, now, 30, road(12), d); now += 30;
  assert.equal(temperatureWord(e.survival.felt), 'scorching');
  assert.ok(said.includes(SURVIVAL_TEXT.scorching));
  said.length = 0;
  live(e, now, 60, inn(13), d); now += 60;
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [COOLING], `the inn at noon (${e.survival.felt}): cooling, once`);
  said.length = 0;
  live(e, now, 60, inn(21), d); now += 60;
  assert.equal(temperatureWord(e.survival.felt), 'comfortable');
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [], 'the evening cools further in silence');
  live(e, now, 30, road(12), d); now += 30;
  live(e, now, 10, inn(13), d); now += 10;
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [COOLING], 'out to the road and back: a new recovery, said again');
});

test('WARM-SAID: the laws - deadly to freezing is still the red and says nothing; a stage never red (cold, wet) says no recovery; a soaking dried says it, the way down silent; a replayed minute says nothing and the landing says the net change (mutants: no recovery line; freezing not red; deadly cold not red; a soaking not red; the wet dried at wet; the replay says it; said every minute it improves; the lines swapped)', () => {
  const said = [];
  // Mountain winter: deadly on the street; the inn's roof reads freezing - red to red, silent
  const m = body(); m.survival = newSurvival(0);
  const md = deps(said, { worn: new Array(27).fill(null) });
  const mtn = (inside, hour = 12) => ({ climateIndex: CLIMATES.Mountain, month: 0, hour, weather: 'sunny', insideBuilding: inside });
  survivalMinute(m, 1, mtn(false), md);
  assert.equal(temperatureWord(m.survival.felt), 'deadly cold');
  survivalMinute(m, 2, mtn(true), md);
  assert.equal(temperatureWord(m.survival.felt), 'freezing', `the mountain inn, naked: ${m.survival.felt}`);
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [], 'deadly to freezing: still red, nothing said');
  // a jump by the inn's fire from freezing to cold (the fire's fifteen): the landing says it once, the replay nothing
  said.length = 0;
  runSurvivalMinutes(m, 2, 62, { ...mtn(true), byFire: true }, md);
  assert.equal(temperatureWord(m.survival.felt), 'cold', `by the fire: ${m.survival.felt}`);
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [WARMING], 'a jump lands and says the net change, once');
  // a replayed minute out of the red says nothing and moves nothing: back in the red, the landing says nothing
  said.length = 0;
  survivalMinute(m, 63, mtn(true), md);
  assert.equal(temperatureWord(m.survival.felt), 'freezing');
  survivalMinute(m, 64, { ...mtn(true), byFire: true }, { ...md, replay: true });
  survivalMinute(m, 65, mtn(true), { ...md, replay: true });
  survivalMinute(m, 66, mtn(true), md);
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [], 'red, a replayed warm minute, red again: no recovery said');
  // deadly cold straight to cold (the street, then the inn's fire): warming, once
  said.length = 0;
  const f = body(); f.survival = newSurvival(0);
  survivalMinute(f, 1, mtn(false), md);
  survivalMinute(f, 2, { ...mtn(true), byFire: true }, md);
  survivalMinute(f, 3, { ...mtn(true), byFire: true }, md);
  assert.deepEqual([temperatureWord(f.survival.felt), said.filter((t) => RECOVERIES.includes(t))], ['cold', [WARMING]], 'deadly cold is red: leaving it is said');
  // cold (never red) to comfortable: nothing
  said.length = 0;
  const c = body(); c.survival = newSurvival(0);
  const woodsInn = (hour) => ({ climateIndex: CLIMATES.Woodlands, month: EVENING_STAR, hour, weather: 'sunny', insideBuilding: true });
  survivalMinute(c, 1, { ...woodsInn(12), insideBuilding: false }, deps(said, { worn: kit() }));
  assert.equal(temperatureWord(c.survival.felt), 'cold', `the winter street in the kit: ${c.survival.felt}`);
  survivalMinute(c, 2, woodsInn(12), deps(said, { worn: kit() }));
  assert.equal(temperatureWord(c.survival.felt), 'comfortable');
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [], 'cold is not red: its end says nothing');
  // the wet: wet (never soaked) to dry says nothing; soaked to dry says it once, at dry
  const w = body(); w.survival = newSurvival(0);
  const wd = deps(said, { worn: kit() });
  said.length = 0;
  w.survival.wet = NEED.WET_WET + 20;
  for (let i = 1; i <= 40; i++) survivalMinute(w, i, woodsInn(12), wd);
  assert.equal(wetStage(w.survival.wet), 'dry');
  assert.deepEqual(said.filter((t) => RECOVERIES.includes(t)), [], 'wet, never soaked: drying says nothing');
  w.survival.wet = NEED.WET_SOAKED + 10;
  const heard = [];
  for (let i = 41; i <= 120; i++) { const n = said.length; survivalMinute(w, i, woodsInn(12), wd); if (said.length > n) heard.push([wetStage(w.survival.wet), ...said.slice(n)]); }
  assert.deepEqual(heard.filter((h) => h.includes(DRIED)), [['dry', DRIED]], `soaked, dried: said once, at dry (${JSON.stringify(heard)})`);
});
