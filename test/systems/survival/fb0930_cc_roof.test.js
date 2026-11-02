// FIELD BUGS 2026-09-30 (ROOF-SHELTER) - #bug-reports, "Climates & Calories Bugs": "1 - The player characters
// temperature seems to never change. Whether you are appropriately clothed for your region, indoors, etc. your
// temperature gets to either "Scorching" or "Freezing" or "Soaked" etc and seems to never recover".
//
// The minute tick is not stuck: temperature.js recomputes the felt reading every minute. The rule held it. Indoors the
// natural temperature was half the climate and the season and nothing else - no hour - so a desert inn at eleven at night
// read 30 while the street outside it read 0: in from the sand, a Redguard in the starting kit felt 35, Hot, all night,
// and the chip never lifted. Inside a building the natural temperature is now the street's own now (climate, season, hour
// and weather, as outdoors) softened to the roofed half's size - AUDIT C&C T4: never across nought, so a warmer street
// never reads colder inside (it was the milder by size, and a desert inn read +30 in the rain and -28 when overcast).
// A roof never makes it hotter or colder than the street. Underground is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { naturalTemperature, feltTemperature, temperatureWord, CLIMATE_TEMP, MONTH_TEMP, WEATHER_TEMP } from '../../../src/systems/survival/temperature.js';
import { newSurvival, runSurvivalMinutes } from '../../../src/systems/survival/needs.js';
import { survivalHudChips } from '../../../src/systems/survival/status.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

/** The starting kit: a short shirt (5) and casual pants (10). */
const kit = () => { const w = new Array(27).fill(null); w[17] = { templateIndex: 165, group: 'MensClothing' }; w[24] = { templateIndex: 151, group: 'MensClothing' }; return w; };
const SUNS_HEIGHT = 6, MORNING_STAR = 0, RAINS_HAND = 3;
const inn = (climateIndex, month, hour, weather = 'sunny') => ({ climateIndex, month, hour, weather, insideBuilding: true });
const street = (env) => ({ ...env, insideBuilding: false });
const roofed = ({ climateIndex, month }) => Math.trunc((CLIMATE_TEMP[climateIndex] + MONTH_TEMP[month]) / 2);

test('ROOF-SHELTER: the report - a desert inn at eleven at night reads the street\'s own night, not the day\'s half: a Redguard in the starting kit is comfortable, not Hot (mutants: the roof ignores the street again; the street always; the street forgets the hour indoors)', () => {
  const night = inn(CLIMATES.Desert, SUNS_HEIGHT, 23);
  assert.equal(naturalTemperature(street(night)), 0, 'the Alik\'r at eleven: 40 + 20 - 60');
  assert.equal(naturalTemperature(night), 0, 'the inn reads the street, the milder');
  const felt = feltTemperature(night, kit(), { raceId: RACES.Redguard });
  assert.equal(felt.felt, 5); assert.equal(temperatureWord(felt.felt), 'comfortable');
  assert.equal(felt.felt, feltTemperature(street(night), kit(), { raceId: RACES.Redguard }).felt, 'in the inn as on its doorstep');
  assert.equal(naturalTemperature(inn(CLIMATES.Desert, SUNS_HEIGHT, 12)), 30, 'at noon the roof is the milder: half of 60');
  assert.equal(naturalTemperature(inn(CLIMATES.Desert, SUNS_HEIGHT, 4)), 30, 'the small hours before dawn: the street 30, at the roof\'s own size');
});

test('ROOF-SHELTER: the rule, swept - inside is the street softened to the roof\'s size, never across nought, never hotter or colder than either; a warmer street never reads colder inside (AUDIT C&C T4); the weather reaches in; the mountain inn keeps its roof; underground unchanged (mutants: the roof ignores the street again; the street always; the milder by size across nought; the milder by value, not by size; the street forgets the weather indoors; the street forgets the hour indoors)', () => {
  for (const ci of Object.values(CLIMATES)) for (let month = 0; month < 12; month++) {
    const seen = [];
    for (let hour = 0; hour < 24; hour += 1) for (const weather of Object.keys(WEATHER_TEMP)) {
      const env = inn(ci, month, hour, weather);
      const out = naturalTemperature(street(env)), roof = roofed(env), got = naturalTemperature(env);
      assert.equal(got, Math.sign(out) * Math.min(Math.abs(out), Math.abs(roof)) || 0, `${ci}/${month}/${hour}/${weather}`);
      assert.ok(Math.abs(got) <= Math.abs(out) && Math.abs(got) <= Math.abs(roof));
      assert.ok(got === 0 || Math.sign(got) === Math.sign(out), `never across nought: ${ci}/${month}/${hour}/${weather} - the street ${out}, inside ${got}`);
      seen.push([out, got]);
      assert.equal(naturalTemperature({ ...env, insideBuilding: false, insideDungeon: true }), CLIMATE_TEMP[ci] + MONTH_TEMP[month], 'underground: no hour, no sky - as ever');
    }
    for (const [o1, g1] of seen) for (const [o2, g2] of seen) if (o1 < o2) assert.ok(g1 <= g2, `a warmer street never reads colder inside: ${ci}/${month} - ${o1}->${g1}, ${o2}->${g2}`);
  }
  assert.equal(naturalTemperature(inn(CLIMATES.Desert, RAINS_HAND, 23)), -20, 'the street -20 under a roof of 20: -20, the street\'s own, not the roof\'s +20 across nought');
  // AUDIT C&C T4's case: a Dak'fron inn at half past midnight in Midyear - rain on the street (-30) and an overcast one (-28) read
  // the street's own inside, two degrees apart; the milder-by-size rule read the rain +30 (the roof's, across nought) and the overcast -28
  assert.deepEqual(['rain', 'overcast'].map((w) => naturalTemperature(inn(CLIMATES.Desert2, 5, 0.5, w))), [-30, -28]);
  assert.equal(naturalTemperature(inn(CLIMATES.Desert, SUNS_HEIGHT, 23, 'rain')), -10, 'the rain on the street is inside the roof\'s 30, and reaches in');
  assert.equal(naturalTemperature(inn(CLIMATES.Desert, SUNS_HEIGHT, 21, 'fog')), -5, 'a foggy desert night: the street\'s -5');
  assert.deepEqual([12, 23].map((h) => naturalTemperature(inn(CLIMATES.Mountain, MORNING_STAR, h))), [-30, -30], 'a mountain inn in Morning Star keeps its roof\'s -30, noon and night (the street -60 and -100)');
  assert.equal(naturalTemperature(inn(CLIMATES.Woodlands, 11, 18, 'snow')), -12, 'a Woodlands winter evening in the snow: the roof\'s -12, not the street\'s -45');
});

test('ROOF-SHELTER: through the minute law - the night hours in a desert inn (eight to four, before the dawn band warms the street to the roof\'s own 30) build no exposure and leave no temperature chip, as the street outside it would (mutants: the roof ignores the street again; the street forgets the hour indoors)', () => {
  const e = { raceId: RACES.Redguard, stats: { endurance: 50, strength: 50 }, items: [], activeEffects: [], fatigue: 6400, health: 40, maxHealth: 40 };
  const start = SUNS_HEIGHT * 30 * 1440 + 20 * 60;
  e.survival = { ...newSurvival(start), lastMinute: start };
  let now = start;
  for (let h = 20; h < 28; h++) {
    const t = runSurvivalMinutes(e, now, now + 60, inn(CLIMATES.Desert, SUNS_HEIGHT, h % 24), { worn: kit(), ctx: { raceId: RACES.Redguard }, rules: SURVIVAL_RULES.hard, autoDrink: false, sinks: {} });
    now += 60;
    assert.ok(t.felt <= 10, `${h % 24}:00 in the inn feels ${t.felt}`);
  }
  assert.equal(e.survival.exposure, 0, 'no exposure built');
  assert.equal(survivalHudChips(e, now).some((c) => c.key === 'temp'), false, 'no Hot chip over the night');
});
