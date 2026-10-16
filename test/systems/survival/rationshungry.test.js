// RATIONS-HUNGRY (2026-10-03, Mac: "With C&C let it auto consume any rations in inventory when hungry"). Climates &
// Calories' rations in the pack were eaten by themselves only once the player was STARVING (a day without a meal, and
// starving's fatigue and Hard's stat loss on the way); now a sack is eaten as the player turns HUNGRY (12 hours). Not at
// Peckish - a sack is a full meal - and never for a vampire, nor with the host's autoEat off. Over a jump (a rest, a
// journey) the walk eats one each time it turns Hungry, as many as the pack holds. survival/needs.js AUTO_EAT_STAGES.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATE } from '../../../src/systems/survival/food.js';
import { NEED, AUTO_EAT_STAGES, SURVIVAL_TEXT, survivalOf, hungerStage, survivalMinute, runSurvivalMinutes } from '../../../src/systems/survival/needs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

const noon = { climateIndex: CLIMATES.Woodlands, month: 5, hour: 12, weather: 'sunny', insideBuilding: true };
const stats = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const sack = (n) => ({ templateIndex: TEMPLATE.Rations, group: 'UselessItems2', stackCount: n });
const player = (items) => ({ stats, raceId: RACES.Breton, items, activeEffects: [], health: 50, fatigue: 3000 });
const sinks = (log) => ({ drainFatigue: () => {}, hurt: () => {}, restoreFatigue: () => {}, say: (t) => log.push(t) });

test('RATIONS-HUNGRY: a sack in the pack is eaten the minute the player turns Hungry - not at Peckish, not left to Starving - and the Hungry line is never said over food; with no sack, as before (mutants: the stages)', () => {
  assert.deepEqual([...AUTO_EAT_STAGES], ['hungry', 'starving']);
  assert.deepEqual([NEED.PECKISH_AT, NEED.HUNGRY_AT, NEED.STARVING_AT], [240, 720, 1440]);
  const now = 90000;
  const e = player([sack(2)]);
  const s = survivalOf(e, now);
  const log = [];
  s.lastAte = now - (NEED.HUNGRY_AT - 1);
  survivalMinute(e, now, noon, { sinks: sinks(log) });
  assert.equal(hungerStage(now - s.lastAte), 'peckish', 'a minute short of Hungry');
  assert.equal(e.items[0].stackCount, 2, 'Peckish: the sack kept');
  survivalMinute(e, now + 1, noon, { sinks: sinks(log) });
  assert.equal(e.items[0].stackCount, 1, 'Hungry: one eaten');
  assert.ok(log.includes(SURVIVAL_TEXT.ateRations));
  assert.ok(!log.includes(SURVIVAL_TEXT.hungry), 'the Hungry line is not said over food');
  assert.equal(hungerStage(now + 1 - s.lastAte), 'fed');
  // starving still eats (a pack that was empty when they turned Hungry, filled since)
  s.lastAte = now - NEED.STARVING_AT - 50;
  survivalMinute(e, now + 2, noon, { sinks: sinks(log) });
  assert.equal(e.items.length, 0, 'the last one eaten, the sack gone');
  // no sack: Hungry says so, as before
  const hungry = player([]);
  const hs = survivalOf(hungry, now);
  hs.lastAte = now - NEED.HUNGRY_AT;
  const said = [];
  survivalMinute(hungry, now, noon, { sinks: sinks(said) });
  assert.ok(said.includes(SURVIVAL_TEXT.hungry));
  assert.equal(hungerStage(now - hs.lastAte), 'hungry');
});

test('RATIONS-HUNGRY: the host\'s autoEat off eats nothing, a vampire never; over a two-day jump the walk eats one each time it turns Hungry, never more than the pack holds', () => {
  const now = 120000;
  const off = player([sack(3)]);
  survivalOf(off, now).lastAte = now - NEED.HUNGRY_AT;
  survivalMinute(off, now, noon, { sinks: sinks([]), autoEat: false });
  assert.equal(off.items[0].stackCount, 3, 'autoEat off');
  const vamp = player([sack(3)]);
  survivalOf(vamp, now).lastAte = now - NEED.STARVING_AT;
  survivalMinute(vamp, now, noon, { sinks: sinks([]), ctx: { vampire: true } });
  assert.equal(vamp.items[0].stackCount, 3, 'a vampire is never hungry for rations');
  // a meal lands the marker ten minutes back (eatRations), so the next Hungry is 710 minutes on: 710, 1420, 2130, 2840
  const walker = player([sack(9)]);
  survivalOf(walker, now);   // fresh: lastAte = now - 10
  const log = [];
  runSurvivalMinutes(walker, now, now + 2880, noon, { sinks: sinks(log) });
  assert.equal(walker.items[0].stackCount, 9 - 4, 'four meals in two days');
  const two = player([sack(2)]);
  survivalOf(two, now);
  runSurvivalMinutes(two, now, now + 2880, noon, { sinks: sinks([]) });
  assert.equal(two.items.length, 0, 'two sacks, two meals, then the pack is empty');
});
