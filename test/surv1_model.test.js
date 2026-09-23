import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLIMATE_TEMP, MONTH_TEMP, naturalTemperature, hourTemperature, weatherWetGain, resistTemperature,
  clothingWarmth, armorWarmth, dungeonTemperature, feltTemperature, temperatureWord, cloakState, NAKED_OFFSET, FLAG_FIRE, FLAG_FROST,
} from '../src/systems/survival/temperature.js';
import { EFFECT_FLAGS } from '../src/systems/spellcast.js';
import {
  TEMPLATE, FOOD, foodName, foodSatiety, rotOnce, rotRoll, rotFoodDay, eatLaw, drinkFrom, refillSkins, findDrink, waterIn,
  FOOD_STAGE, WATERSKIN_CAPACITY_KG, DRINK_KG, FOUL_MEAL_DISEASES, MILD_MEAL_DISEASES, DISEASE_STOMACH_ROT, DISEASE_SWAMP_ROT, DISEASE_YELLOW_FEVER,
} from '../src/systems/survival/food.js';
import {
  NEED, newSurvival, survivalOf, hungerStage, thirstStage, sleepStage, wetStage, survivalStatMods, applySurvivalMods,
  survivalMinute, runSurvivalMinutes, alignSurvival, drinkWater, eatRations, MAX_CATCHUP_MINUTES, THIRST_PER_MINUTE, DRAIN,
} from '../src/systems/survival/needs.js';
import { liveStat } from '../src/systems/statMods.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { RACES } from '../src/systems/races.js';
import { DISEASES } from '../src/systems/diseases.js';

// ═══ SURV1 (2026-09-18): THE SURVIVAL MODEL ═════════════════════════
//
// Mac: "we have been given permission to completely overhaul this mod
// [Climates & Calories], figure out bugs and implement it to our
// desire ... We're going to tackle everything here properly." The
// mod's rules were read off its DLL (no source ships) and rebuilt as
// pure laws: a felt temperature from the world and the worn items,
// and five needs on one record per entity, ticked a world minute at a
// time. This file pins the laws; the hosts, items and UI are later
// slices.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const S = EQUIP_SLOTS;
const item = (templateIndex, extra = {}) => ({ templateIndex, group: 'MensClothing', ...extra });
const armor = (templateIndex, material, extra = {}) => ({ templateIndex, group: 'Armor', material, maxCondition: 100, condition: 100, ...extra });
const worn = (map) => { const w = []; for (const [k, v] of Object.entries(map)) w[Number(k)] = v; return w; };
const noon = { climateIndex: CLIMATES.Woodlands, month: 5, hour: 12, weather: 'sunny' };

test('SURV1: the natural temperature is climate + month + hour + weather, sheltered indoors, timeless underground', () => {
  assert.equal(naturalTemperature({ ...noon }), CLIMATE_TEMP[CLIMATES.Woodlands] + MONTH_TEMP[5], 'a summer noon in the woods');
  assert.equal(naturalTemperature({ ...noon, hour: 23 }), -10 + 10 - 20, 'the small hours take 20');
  assert.equal(naturalTemperature({ ...noon, climateIndex: CLIMATES.Desert2, hour: 2 }), 50 + 10 - 80, 'a desert night swings four times as hard');
  assert.equal(naturalTemperature({ ...noon, weather: 'thunder' }), -15, 'a storm takes 15');
  assert.equal(naturalTemperature({ ...noon, weather: 'sandstorm', climateIndex: CLIMATES.Desert }), 40 + 10 + 5, 'the port\'s own sandstorm is hot');
  assert.equal(naturalTemperature({ ...noon, weather: 'thunder', insideBuilding: true }), 0, 'indoors: half the climate and season, no sky, no hour');
  assert.equal(naturalTemperature({ ...noon, hour: 23, weather: 'snow', insideDungeon: true }), 0, 'underground: no hour, no sky');
  assert.equal(hourTemperature(9, CLIMATES.Mountain), 0);
  assert.equal(hourTemperature(17, CLIMATES.Mountain), -20, 'evening, doubled in the mountains');
  assert.equal(hourTemperature(5, CLIMATES.Desert), -30, 'dawn in the desert');
});

test('SURV1: rain wets you unless a cloak covers you, a hood keeps the storm out of your neck, water soaks you', () => {
  assert.equal(weatherWetGain('rain'), 1);
  assert.equal(weatherWetGain('rain', { cloak: true }), 0);
  assert.equal(weatherWetGain('thunder'), 5);
  assert.equal(weatherWetGain('thunder', { cloak: true }), 2);
  assert.equal(weatherWetGain('thunder', { cloak: true, hood: true }), 1);
  assert.equal(weatherWetGain('snow', { cloak: true, hood: true }), 0);
  assert.equal(weatherWetGain('thunder', { insideBuilding: true }), 0, 'a roof');
  assert.equal(weatherWetGain('sunny'), 0);
  const w = worn({ [S.Cloak1]: item(154, { variant: 2 }) });
  assert.deepEqual({ cloak: cloakState(w).cloak, hood: cloakState(w).hood }, { cloak: true, hood: true }, 'variant 2 is drawn hood up');
  assert.equal(cloakState(worn({ [S.Cloak2]: item(155, { variant: 0 }) })).hood, false);
  assert.equal(cloakState(worn({ [S.ChestClothes]: item(163, { variant: 1 }) })).hood, true, 'plain robes, hood up');
});

test('SURV1: resistance is degrees toward zero - frost lifts a cold reading, fire lowers a hot one, neither crosses', () => {
  const nord = { raceTemplate: { resistanceFlags: 16 } };
  assert.equal(resistTemperature(-40, nord), -15, 'a Nord resists 25 degrees of cold');
  assert.equal(resistTemperature(-10, nord), 0, 'and never past zero');
  assert.equal(resistTemperature(40, nord), 40, 'the frost flag says nothing about heat');
  assert.equal(resistTemperature(40, { fireResist: 25 }), 15, 'a fire resistance spell');
  assert.equal(resistTemperature(-40, { raceTemplate: { criticalWeaknessFlags: 16 } }), -90, 'a critical weakness makes it worse');
  assert.equal(resistTemperature(-60, { vampire: true }), -35, 'a vampire feels 25 less cold');
  assert.equal(resistTemperature(-60, { beastForm: true }), 0, 'a were-beast in its form feels no cold');
  assert.equal(resistTemperature(60, { beastForm: true }), 0);
  assert.equal(resistTemperature(30, { lycanthrope: true }), 20);
  assert.equal(resistTemperature(0, nord), 0);
});

test('SURV1: clothing warms by piece and cloak, wetness eats it one for one and never below nothing, a hood shades the sun', () => {
  const w = worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151), [S.Feet]: item(149), [S.Cloak1]: item(155, { variant: 1 }) });
  assert.equal(clothingWarmth(w).warmth, 8 + 10 + 4 + 15, 'tunic, pants, boots, a formal cloak at variant 1 (5 x 3)');
  assert.equal(clothingWarmth(w, { wet: 20 }).warmth, 17, 'soaked, it keeps less');
  assert.equal(clothingWarmth(w, { wet: 300 }).warmth, 0, 'drenched clothes warm nothing');
  assert.equal(clothingWarmth(w, { natural: 40, inSunlight: true }).warmth, 37 - 10, 'the hood shades in strong sun');
  assert.equal(clothingWarmth(w, { natural: 20, inSunlight: true }).warmth, 37, 'but not in mild sun');
  assert.equal(clothingWarmth(worn({})).warmth, 0, 'naked');
  assert.equal(clothingWarmth(worn({ [S.ChestClothes]: item(141) })).warmth, 1, 'straps are barely clothes');
  assert.equal(clothingWarmth(worn({ [S.Feet]: armor(108, 0) })).warmth, 0, 'armour boots are the armour\'s to count');
});

test('SURV1: armour warms a little and its metal heats in the sun or chills in the cold, unless covered', () => {
  const plate = worn({ [S.ChestArmor]: armor(102, 0x0202), [S.LegsArmor]: armor(104, 0x0203), [S.Head]: armor(107, 0x0201) });
  assert.equal(armorWarmth(plate, { natural: 0 }).pieces, 3 + 2 + 1);
  const hot = armorWarmth(plate, { natural: 40, inSunlight: true });
  assert.equal(hot.metal, Math.trunc(((4 + 3 + 1) * 40) / 20), 'the metal sum scales the natural temperature');
  assert.equal(hot.warmth, 6 + 16, 'and the sun adds it');
  assert.equal(armorWarmth(plate, { natural: 40, inSunlight: false }).warmth, 6, 'shade: the metal does not cook');
  const cold = armorWarmth(plate, { natural: -40 });
  assert.equal(cold.heat, Math.trunc((-16 - 1) / 2), 'cold metal chills at half, toward the colder side');
  assert.equal(cold.warmth, 6 - 8);
  const covered = worn({ ...plate, [S.Cloak1]: item(154, { variant: 0 }) });
  assert.equal(armorWarmth(covered, { natural: 40, inSunlight: true }).heat, 0, 'a cloak over it keeps the sun off');
  const leather = worn({ [S.ChestArmor]: armor(102, 0x0000) });
  assert.equal(armorWarmth(leather, { natural: 40, inSunlight: true }).metal, 0, 'leather is not metal');
  assert.equal(armorWarmth(worn({ [S.ChestArmor]: armor(102, 0x0100) }), { natural: 20, inSunlight: true }).heat, 1, 'chain: warm 1, metal 1');
});

test('SURV1: the felt temperature is the resisted world plus the resisted body, cool underground, cooled by a drink', () => {
  const ctx = { raceId: RACES.Breton, raceTemplate: {} };
  const naked = feltTemperature({ ...noon }, worn({}), ctx);
  assert.equal(naked.natural, 0);
  assert.equal(naked.own, 5 + NAKED_OFFSET, 'a Breton\'s own warmth and the naked offset');
  assert.equal(naked.felt, 0, 'a summer noon in the woods, naked: comfortable');
  const dressed = feltTemperature({ ...noon, hour: 23 }, worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151) }), ctx);
  assert.equal(dressed.natTemp, -20);
  assert.equal(dressed.felt, -20 + (5 + 18 - 5), 'the night, in a tunic and pants');
  const wet = feltTemperature({ ...noon, hour: 23 }, worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151) }), { ...ctx, wet: 100 });
  assert.equal(wet.felt, -20 + (5 + 0 - 5 - 5), 'soaked: the clothes count for nothing and the water chills five more');
  assert.equal(wet.wetGain, 0);
  const dungeon = feltTemperature({ ...noon, insideDungeon: true }, worn({}), ctx);
  assert.equal(dungeon.natTemp, dungeonTemperature(0), 'a dungeon is cool whatever the sky');
  assert.equal(dungeonTemperature(60), 0);
  assert.equal(dungeonTemperature(-60), -20);
  const desert = feltTemperature({ ...noon, climateIndex: CLIMATES.Desert2, month: 6 }, worn({}), ctx);
  assert.equal(desert.felt, 70, 'high summer in Dak\'fron, naked and dry');
  const drink = feltTemperature({ ...noon, climateIndex: CLIMATES.Desert2, month: 6 }, worn({}), { ...ctx, hasWater: true });
  assert.equal(drink.felt, 60, 'a skin in the pack takes ten off');
  assert.equal(feltTemperature({ ...noon, climateIndex: CLIMATES.Desert2, month: 6 }, worn({}), { ...ctx, hasWater: true, vampire: true }).felt, 70, 'not for a vampire');
  const fire = feltTemperature({ ...noon, hour: 23, byFire: true }, worn({}), ctx);
  assert.equal(fire.felt, -20 + (5 + 15 - 5), 'a campfire is worth fifteen of warmth');
  const storm = feltTemperature({ ...noon, weather: 'thunder' }, worn({}), ctx);
  assert.equal(storm.wetGain, 5, 'and the storm soaks a naked body five a minute');
  assert.equal(feltTemperature({ ...noon, submerged: true }, worn({}), ctx).wetGain, 300);
  assert.deepEqual(['scorching', 'hot', 'warm', 'comfortable', 'cold', 'freezing', 'deadly cold'], [60, 40, 20, 0, -20, -40, -60].map(temperatureWord));
});

test('SURV1: food is minutes of satiety, halved a stage, named by its stage, and rots on a day roll against its keeping', () => {
  const apple = { templateIndex: TEMPLATE.Apple, group: 'UselessItems2' };
  assert.equal(foodSatiety(apple), 60);
  assert.equal(foodName(apple), 'Apple');
  assert.equal(rotOnce(apple), true);
  assert.equal(foodName(apple), 'Soft Apple');
  assert.equal(foodSatiety(apple), 30, 'half');
  assert.equal(apple.value, 0, 'worth nothing to a shop');
  rotOnce(apple); rotOnce(apple); rotOnce(apple);
  assert.equal(foodName(apple), 'Putrid Apple');
  assert.equal(rotOnce(apple), false, 'putrid is the end');
  const bread = { templateIndex: TEMPLATE.Bread };
  assert.equal(rotRoll(bread, 0, () => 0.94), false, 'a 95 does not beat bread\'s 95');
  assert.equal(rotRoll(bread, 0, () => 0.95), true, 'a 96 does');
  assert.equal(rotRoll({ templateIndex: TEMPLATE.Bread }, 20, () => 0.85), true, 'ten days kept add ten to the roll');
  const rations = { templateIndex: TEMPLATE.Rations };
  assert.equal(rotRoll(rations, 100, () => 0.99), false, 'rations keep');
  assert.equal(rotFoodDay([[{ templateIndex: TEMPLATE.RawFish }, { templateIndex: TEMPLATE.Meat }], null], 0, () => 0.6), 1, 'a 61 spoils raw fish (50) and not meat (90)');
  assert.equal(foodName({ templateIndex: TEMPLATE.RawFish, foodStage: 1 }), 'Smelly Raw Fish');
  assert.equal(foodName({ templateIndex: TEMPLATE.Bread, foodStage: 2 }), 'Mouldy Bread');
  assert.equal(FOOD[TEMPLATE.RawMeat].cooks, TEMPLATE.Meat);
  assert.equal(FOOD[TEMPLATE.RawFish].cooks, TEMPLATE.CookedFish);
});

test('SURV1: the eating law - not a full stomach, never putrid, banked four hours ahead, raw or spoiled risks the stomach', () => {
  const now = 10000;
  const meat = { templateIndex: TEMPLATE.Meat };
  assert.deepEqual(eatLaw(meat, { lastAte: now - 100, now }), { ok: false, reason: 'not hungry' }, 'a meal worth 240 needs 240 of hunger');
  const r = eatLaw(meat, { lastAte: now - 300, now, luck: 50, rolls: () => 0.99 });
  assert.equal(r.ok, true);
  assert.equal(r.lastAte, now - 300 + 240, 'the marker moves by the meal');
  assert.equal(r.sick, null, 'cooked meat is safe whatever the roll');
  const banked = eatLaw(meat, { lastAte: now - 2000, now });
  assert.equal(banked.lastAte, now - 240 + 240, 'starving, a meal fills you to now: the bank is four hours');
  assert.deepEqual(eatLaw({ templateIndex: TEMPLATE.Meat, foodStage: 4 }, { lastAte: 0, now }), { ok: false, reason: 'putrid' });
  const raw = eatLaw({ templateIndex: TEMPLATE.RawMeat }, { lastAte: now - 2000, now, luck: 50, rolls: () => 0.99 });
  assert.equal(raw.sick, 'mild', 'raw meat on a failed luck roll: the mild sickness');
  assert.equal(raw.feel, 'nauseated');
  assert.equal(eatLaw({ templateIndex: TEMPLATE.RawMeat }, { lastAte: now - 2000, now, luck: 50, rolls: () => 0.1 }).sick, null, 'lucky');
  const mouldy = eatLaw({ templateIndex: TEMPLATE.Bread, foodStage: 2 }, { lastAte: now - 2000, now, luck: 50, rolls: () => 0.99 });
  assert.equal(mouldy.sick, 'foul');
  assert.equal(mouldy.satiety, 60, 'mouldy bread: a third');
  assert.equal(eatLaw({ templateIndex: TEMPLATE.Orange }, { lastAte: now - 2000, now }).thirstRelief, 10, 'fruit is a drink too');
  assert.deepEqual([DISEASE_STOMACH_ROT, DISEASE_SWAMP_ROT, DISEASE_YELLOW_FEVER], [DISEASES.StomachRot, DISEASES.SwampRot, DISEASES.YellowFever], 'the restated ids are diseases.js\'s');
  assert.deepEqual(MILD_MEAL_DISEASES, [DISEASES.StomachRot]);
  assert.ok(!FOUL_MEAL_DISEASES.includes(DISEASES.Plague) && !FOUL_MEAL_DISEASES.includes(DISEASES.Cholera), 'no plague from a meal');
  assert.deepEqual([FLAG_FIRE, FLAG_FROST], [EFFECT_FLAGS.Fire, EFFECT_FLAGS.Frost], 'the restated flag bits are spellcast.js\'s');
  assert.deepEqual(eatLaw({ templateIndex: 5 }, { lastAte: 0, now }), { ok: false, reason: 'not food' });
});

test('SURV1: a waterskin holds two kilos, a drink is a tenth, a fountain fills every skin, a stream fills what it has', () => {
  const skin = { templateIndex: TEMPLATE.Waterskin, water: 0.25 };
  assert.deepEqual(drinkFrom(skin), { ok: true, left: 0.15, empty: false, low: true });
  assert.deepEqual(drinkFrom(skin), { ok: true, left: 0.05, empty: true, low: true });
  assert.deepEqual(drinkFrom(skin), { ok: false, reason: 'empty' });
  const items = [{ templateIndex: 5 }, { templateIndex: TEMPLATE.Waterskin, water: 1.5 }, skin];
  assert.equal(findDrink(items), items[1]);
  assert.deepEqual(refillSkins(items), { poured: 0.5 + 1.95, filled: 2, skins: 2 });
  assert.equal(waterIn(skin), WATERSKIN_CAPACITY_KG);
  const dry = [{ templateIndex: TEMPLATE.Waterskin, water: 0 }, { templateIndex: TEMPLATE.Waterskin, water: 0 }];
  assert.deepEqual(refillSkins(dry, 2.5), { poured: 2.5, filled: 2, skins: 2 }, 'a pool of two and a half fills one and a quarter of the other');
  assert.equal(dry[1].water, 0.5);
  assert.equal(DRINK_KG, 0.1);
});

test('SURV1: the stages - hunger by minutes, thirst by the counter, sleep by the debt, wet by the soak', () => {
  assert.deepEqual([0, 239, 240, 720, 1440, 5000].map(hungerStage), ['fed', 'fed', 'peckish', 'hungry', 'starving', 'starving']);
  assert.deepEqual([0, 49, 50, 80, 100, 150].map(thirstStage), ['fine', 'fine', 'thirsty', 'parched', 'dehydrated', 'dehydrated']);
  assert.deepEqual([0, 3.9, 4, 8, 12, 24].map(sleepStage), ['rested', 'rested', 'tired', 'drowsy', 'exhausted', 'exhausted']);
  assert.deepEqual([0, 4, 5, 30, 100, 200].map(wetStage), ['dry', 'dry', 'damp', 'wet', 'soaked', 'drenched']);
});

test('SURV1: the stat drains are one survival entry that liveStat reads, capped so no stat goes under five, gone when there is no cause', () => {
  const entity = { stats: { strength: 50, intelligence: 8, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [] };
  const now = 20000;
  const s = newSurvival(now);
  s.lastAte = now - 3 * 1440;   // three days
  s.thirst = 120;
  s.sleepDebt = 9;
  const mods = survivalStatMods(s, { abs: 0 }, now);
  assert.equal(mods.strength, -(6 + 3 + 5), 'starving three days (6), dehydrated 120 (3), drowsy (5)');
  assert.equal(mods.luck, undefined, 'luck is never drained');
  const entry = applySurvivalMods(entity, mods);
  assert.equal(entry.kind, 'survival');
  assert.equal(entry.statMods.intelligence, -3, 'an INT of 8 can lose only 3');
  assert.equal(liveStat(entity, 'strength'), 36);
  assert.equal(liveStat(entity, 'intelligence'), 5);
  assert.equal(applySurvivalMods(entity, {}), null);
  assert.equal(entity.activeEffects.length, 0, 'no cause, no entry');
  const hot = survivalStatMods({ ...newSurvival(now), exposure: 40 }, { abs: 50 }, now);
  assert.equal(hot.speed, -5, 'exposure: min(minutes past 30, degrees past 30) / 4');
  const drunk = survivalStatMods({ ...newSurvival(now), drunk: 45 }, { abs: 0 }, now, { endurance: 50 });
  assert.equal(drunk.agility, -2);
  assert.equal(drunk.personality, 3, 'the drink makes you a little friendlier (AUDIT SURV A: +1..+5 with the drink, never a +20)');
  assert.equal(drunk.strength, undefined);
});

test('SURV1: one world minute - a comfortable fed player pays nothing; a naked player on a desert noon pays fatigue, health and exposure', () => {
  const mk = () => ({ stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, raceId: RACES.Breton, items: [], activeEffects: [], health: 50, fatigue: 3000 });
  const sinksOf = (log) => ({ drainFatigue: (n) => log.push(['fatigue', n]), hurt: (n) => log.push(['hurt', n]), restoreFatigue: (n) => log.push(['restore', n]), say: (t) => log.push(['say', t]) });
  let log = [], e = mk();
  const now = 30000;
  const temp = survivalMinute(e, now, { ...noon }, { worn: worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151), [S.Feet]: item(149) }), sinks: sinksOf(log), ctx: { raceId: RACES.Breton } });
  assert.equal(temp.felt, 0 + 5 + 22 - 5, 'dressed on a summer noon: warm');
  assert.deepEqual(log.filter((l) => l[0] !== 'say'), [['fatigue', DRAIN.heatPer20]], 'warm (22): one band of heat drain, nothing else');
  assert.equal(e.survival.thirst > 0, true);
  log = []; e = mk();
  survivalMinute(e, now, { ...noon, climateIndex: CLIMATES.Desert2, month: 6, inSunlight: true }, { worn: worn({}), sinks: sinksOf(log), ctx: { raceId: RACES.Breton } });
  const kinds = log.map((l) => l[0]);
  assert.ok(kinds.includes('fatigue') && kinds.includes('hurt'), 'a naked Breton at 70: fatigue and health');
  assert.equal(log.find((l) => l[0] === 'fatigue')[1], DRAIN.heatPer20 * 3, 'three bands');
  assert.ok(log.some((l) => l[0] === 'hurt' && l[1] === 3), '(70 - 40) / 10 a minute');
  assert.ok(log.some((l) => l[1] === 'The sun burns your bare skin.'), 'and the sun on bare skin');
  assert.equal(e.survival.exposure, 1);
});

test('SURV1: hunger, thirst and sleep move on the clock, say their stage once, and pay their drains; a skin answers thirst by itself', () => {
  const e = { stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, raceId: RACES.Breton, items: [{ templateIndex: TEMPLATE.Waterskin, water: 0.3 }], activeEffects: [], health: 50, fatigue: 3000 };
  const log = [];
  const sinks = { drainFatigue: (n) => log.push(['fatigue', n]), hurt: (n) => log.push(['hurt', n]), restoreFatigue: () => {}, say: (t) => log.push(['say', t]) };
  const start = 40000;
  survivalOf(e, start);
  const env = { ...noon, insideBuilding: true };   // sheltered: no heat drain to muddy the count
  runSurvivalMinutes(e, start, start + 300, env, { worn: worn({ [S.ChestClothes]: item(158) }), sinks, ctx: { raceId: RACES.Breton } });
  assert.equal(log.filter((l) => l[1] === 'Your stomach rumbles...').length, 1, 'peckish at 240, said once');
  assert.ok(e.survival.thirst < NEED.THIRSTY + 10, 'the skin was drunk from before parched');
  assert.equal(log.filter((l) => l[1] === 'You drink from your waterskin.' || l[1] === 'Your waterskin is nearly empty.').length, 1);
  assert.equal(e.items[0].water, 0.2);
  runSurvivalMinutes(e, start + 300, start + 17 * 60, env, { worn: worn({}), sinks, ctx: { raceId: RACES.Breton } });
  assert.equal(hungerStage(start + 1020 - e.survival.lastAte), 'hungry');
  assert.equal(log.filter((l) => l[1] === 'You have not eaten in a long while...').length, 1);
  assert.equal(e.survival.sleepDebt > 0 && e.survival.sleepDebt < 1.1, true, 'seventeen hours awake: an hour of debt');
  assert.equal(log.filter((l) => l[1] === 'You stifle a yawn...').length, 0, 'not yet tired');
  assert.ok(log.some((l) => l[1] === 'You are getting thirsty...'), 'the skin ran dry and thirst rose');
  assert.ok(log.some((l) => l[0] === 'fatigue' && l[1] === DRAIN.parched), 'parched: the fatigue tax');
});

test('SURV1: sleep pays the debt by its quality - a bed clears it, a rough rest only to tired; rations feed a starving player by themselves', () => {
  const e = { stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, raceId: RACES.Breton, items: [{ templateIndex: TEMPLATE.Rations, group: 'UselessItems2', stackCount: 2 }], activeEffects: [], health: 50, fatigue: 3000 };
  const now = 50000;
  const s = survivalOf(e, now);
  s.sleepDebt = 10;
  const quiet = { drainFatigue: () => {}, hurt: () => {}, restoreFatigue: () => {}, say: () => {} };
  runSurvivalMinutes(e, now, now + 240, { ...noon, insideBuilding: true, resting: true, sleeping: 'rough' }, { worn: worn({}), sinks: quiet });
  assert.equal(Math.round(s.sleepDebt * 10) / 10, 8, 'four hours rough: half an hour of debt an hour');
  runSurvivalMinutes(e, now + 240, now + 240 + 600, { ...noon, insideBuilding: true, resting: true, sleeping: 'rough' }, { worn: worn({}), sinks: quiet });
  assert.equal(s.sleepDebt, NEED.SLEEP_TIRED, 'and never below tired');
  runSurvivalMinutes(e, now + 840, now + 840 + 180, { ...noon, insideBuilding: true, resting: true, sleeping: 'bed' }, { worn: worn({}), sinks: quiet });
  assert.equal(Math.round(s.sleepDebt * 10) / 10, 0, 'three hours in a bed clears four');
  assert.equal(s.awakeSince, now + 1020, 'the waking marker moves with the sleep');
  s.lastAte = now + 1020 - 1500;
  const log = [];
  survivalMinute(e, now + 1021, { ...noon, insideBuilding: true }, { worn: worn({}), sinks: { ...quiet, say: (t) => log.push(t) } });
  assert.ok(log.includes('You eat some rations.'), 'starving with a sack: it is eaten');
  assert.equal(e.items[0].stackCount, 1);
  assert.equal(hungerStage(now + 1021 - s.lastAte), 'fed');
  eatRations(e, e.items[0], now + 1030);
  assert.equal(e.items.length, 0, 'the last one empties the sack');
});

test('SURV1: a jump owes at most two days, and a player arriving from longer away is aligned fed, watered and rested rather than charged', () => {
  const e = { stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, raceId: RACES.Breton, items: [], activeEffects: [], health: 50, fatigue: 3000 };
  const quiet = { drainFatigue: () => {}, hurt: () => {}, restoreFatigue: () => {}, say: () => {} };
  let n = 0;
  const now = 60000;
  survivalOf(e, now);
  const orig = e.survival.lastAte;
  runSurvivalMinutes(e, now, now + 10 * 1440, { ...noon, insideBuilding: true }, { worn: worn({}), sinks: quiet, rolls: () => { n++; return 0.5; } });
  assert.equal(e.survival.rotDays, 4, 'two days of catch-up at most (720 rot minutes a day)');
  assert.equal(MAX_CATCHUP_MINUTES, 2880);
  assert.equal(e.survival.lastAte, orig, 'the marker itself is untouched by a jump');
  assert.equal(alignSurvival(e, now + 10 * 1440, now), true, 'ten days away: aligned');
  assert.equal(e.survival.lastAte, now + 10 * 1440 - 10);
  assert.equal(e.survival.thirst, 0);
  assert.equal(e.survival.sleepDebt, 0);
  e.survival.sleepDebt = 6;
  assert.equal(alignSurvival(e, now + 10 * 1440 + 100, now + 10 * 1440), false, 'a hundred minutes away: charged as normal');
  assert.equal(e.survival.sleepDebt, 6);
  e.survival.lastAte = now + 99999;
  assert.equal(alignSurvival(e, now, now), true, 'a marker from the future (a clock set back) is aligned too');
  assert.equal(drinkWater(e, now), false, 'no skin, no drink');
  assert.equal(THIRST_PER_MINUTE, 100 / 360);
});

test('SURV1: by source - liveStat reads the survival entry, and the model is three modules that import no host', () => {
  assert.match(read('src/systems/statMods.js'), /if \(a\.kind === 'survival'\) \{ mod \+= a\.statMods\?\.\[statName\] \?\? 0; continue; \}/);
  for (const f of ['temperature', 'food', 'needs']) {
    const src = read(`src/systems/survival/${f}.js`);
    assert.doesNotMatch(src, /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|document\.|window\./, `${f}.js is pure - and off the formulas -> equip cycle`);
  }
  assert.match(read('src/systems/survival/needs.js'), /export const MAX_CATCHUP_MINUTES = 2 \* MINUTES_PER_DAY;/);
});

// ── SURV-THIRST1: A BODY PAST DEHYDRATED FAILS WHEREVER IT STANDS ──
//
// Mac, 2026-09-19: "You should also should die on dehydration".
//
// Climates & Calories bleeds you for thirst only in HEAT. THE PORT
// DEPARTS: water is not a climate. The mod's own line is recorded in
// bible/06-Systems/Climates-Calories.md, so a tidy-up cannot put the
// gate back by mistake - these pins are what stop it.
const thirstRig = () => {
  const mk = () => ({
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    raceId: RACES.Breton, items: [], activeEffects: [], health: 25, maxHealth: 25, fatigue: 6400,
  });
  // dressed, so the bare-skin harms (which leave the last five points and
  // are NOT what this measures) never fire
  const dressed = worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151), [S.Feet]: item(149) });
  /** Walk a cool dungeon minute by minute with no drink, and answer the
   *  minute the player dies of thirst - or null. */
  const walk = (env, minutes = 60 * 24) => {
    const e = mk(); let dead = null;
    const sinks = { hurt: (n) => { e.health = Math.max(0, e.health - n); }, drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {} };
    for (let m = 1; m <= minutes && dead === null; m++) {
      survivalMinute(e, m, { ...env, month: 6, hour: 13 }, { worn: dressed, sinks, autoDrink: false, autoEat: false, ctx: { raceId: RACES.Breton } });
      if (e.health <= 0) dead = m;
    }
    return { dead, thirst: e.survival.thirst };
  };
  return { walk };
};

test('SURV-THIRST1: a cool dungeon KILLS a player who never drinks - the mod would have let him walk for ever', () => {
  const { walk } = thirstRig();
  const cool = walk({ insideDungeon: true, climateIndex: CLIMATES.Woodlands });
  assert.equal(cool.thirst, NEED.THIRST_MAX, 'thirst reached its ceiling with no drink');
  assert.ok(cool.dead !== null, 'and the player died of it, out of the sun');
  // and it is not instant: dehydrated at six hours, blood later, death
  // later still - a player has game-hours of warnings and a chance to drink
  assert.ok(cool.dead > 8 * 60, `death at ${(cool.dead / 60).toFixed(1)}h - it must not be a sudden one`);
  assert.ok(cool.dead < 14 * 60, `death at ${(cool.dead / 60).toFixed(1)}h - but thirst must really be fatal`);
});

test('SURV-THIRST1: the harm follows AUDIT SURV E’s shape - the harm TICK, escalating, and it may kill', () => {
  const log = [];
  const e = {
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    raceId: RACES.Breton, items: [], activeEffects: [], health: 50, maxHealth: 50, fatigue: 6400,
  };
  const dressed = worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151), [S.Feet]: item(149) });
  const cool = { insideDungeon: true, climateIndex: CLIMATES.Woodlands, month: 6, hour: 13 };
  const sinks = { hurt: (n) => log.push(n), drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {} };
  const step = (minute, thirst) => {
    log.length = 0;
    survivalOf(e, minute).thirst = thirst;
    survivalMinute(e, minute, cool, { worn: dressed, sinks, autoDrink: false, autoEat: false, ctx: { raceId: RACES.Breton } });
    return log;
  };
  // the TICK: ten minutes apart, not every minute (the old line fired sixty
  // times an hour, which takes a starting character out in twenty-five)
  assert.deepEqual(step(101, NEED.THIRST_HARM), [], 'a minute that is not the harm tick costs nothing');
  assert.deepEqual(step(100, NEED.THIRST_HARM), [1], 'the harm tick does');
  // ESCALATING, as exposure's does - off how far past the threshold
  assert.deepEqual(step(200, NEED.THIRST_HARM + 10), [2]);
  assert.deepEqual(step(300, NEED.THIRST_MAX), [4], 'at the ceiling, four a tick');
  // and BELOW the threshold, nothing - dehydrated alone is a fatigue tax
  assert.deepEqual(step(400, NEED.DEHYDRATED), [], 'dehydrated is not yet bleeding');
  // NOT in your sleep, and not sat resting: nothing in systems/rest.js
  // refuses a rest for thirst, so a sleeper who cannot wake to drink must
  // not be killed by a window he was allowed to open
  survivalOf(e, 500).thirst = NEED.THIRST_MAX;
  log.length = 0;
  survivalMinute(e, 500, { ...cool, sleeping: 'bed' }, { worn: dressed, sinks, autoDrink: false, autoEat: false, ctx: { raceId: RACES.Breton } });
  assert.deepEqual(log, [], 'asleep, thirst takes no blood');
  survivalOf(e, 600).thirst = NEED.THIRST_MAX;
  log.length = 0;
  survivalMinute(e, 600, { ...cool, resting: true }, { worn: dressed, sinks, autoDrink: false, autoEat: false, ctx: { raceId: RACES.Breton } });
  assert.deepEqual(log, [], 'resting, thirst takes no blood');
  // and it may KILL: no HEALTH_FLOOR, because the bare-skin harms leave the
  // last five points BECAUSE they are not meant to kill, and this one is
  const src = readFileSync(new URL('../src/systems/survival/needs.js', import.meta.url), 'utf8');
  const line = src.slice(src.indexOf('if (rules.health && s.thirst >= NEED.THIRST_HARM'));   // SURV-TIERS: the wound is Hard's (`rules.health`)
  assert.match(line.slice(0, line.indexOf('\n    }')), /sinks\.hurt\?\.\(/, 'the raw sink, not hurtFloored');
  assert.doesNotMatch(line.slice(0, line.indexOf('\n    }')), /hurtFloored/);
  // THE DEPARTURE ITSELF: no climate term anywhere in the condition
  assert.doesNotMatch(line.slice(0, line.indexOf(')')), /temp\.|felt|EXPOSURE_AT/,
    'thirst no longer asks the weather - that was the mod’s law and is the port’s departure');
});

test('SURV-THIRST1 AUDIT: a clock JUMP wounds to the floor and does not kill on arrival', () => {
  // THE REGRESSION THIS CAUGHT, found auditing SURV-THIRST1 before merge.
  // `playerTicker.advance` (scenes/shared.js) runs the SAME tick with a
  // fabricated dt, so a fast travel, a rest or a training session replays
  // every minute it crossed. Six game-hours is thirty-six harm ticks in
  // ONE frame: a starting character left at full health and arrived DEAD,
  // from thirst zero at departure, having never been warned.
  //
  // Every minute but the last is a replay and may wound only to
  // HEALTH_FLOOR; the last is the minute the player is standing in, and
  // that one may finish them. So a thirsty journey lands you at death's
  // door and the next minute you do not drink is the one that kills.
  const dressed = worn({ [S.ChestClothes]: item(158), [S.LegsClothes]: item(151), [S.Feet]: item(149) });
  const jump = (hours, startThirst, health = 25) => {
    const e = {
      stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
      raceId: RACES.Breton, items: [], activeEffects: [], health, maxHealth: health, fatigue: 6400,
    };
    const s = survivalOf(e, 0);
    s.thirst = startThirst; s.lastMinute = 0; s.lastAte = 0; s.awakeSince = 0;
    const sinks = { hurt: (n) => { e.health = Math.max(0, e.health - n); }, drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {} };
    runSurvivalMinutes(e, 0, hours * 60, { climateIndex: CLIMATES.Woodlands, month: 6, hour: 13 },
      { worn: dressed, sinks, autoDrink: false, autoEat: false, ctx: { raceId: RACES.Breton } });
    return e.health;
  };
  // the case that killed: a healthy player, not even thirsty, fast travelling
  for (const hours of [6, 12, 24]) {
    assert.ok(jump(hours, 0) > 0, `a ${hours}h jump from thirst 0 must not be fatal - it was`);
    assert.ok(jump(hours, NEED.DEHYDRATED) > 0, `a ${hours}h jump already dehydrated must not be fatal either`);
  }
  // it HURTS, though - arriving at death's door is the whole point
  assert.ok(jump(12, 0) < 5, 'and it really does wound - the floor is not a free pass');
  // and the walk is bounded: a longer jump costs no more, because the
  // replayed minutes stop at the floor whatever their number
  assert.equal(jump(24, 0), jump(12, 0), 'a longer jump cannot cost more than the floor allows');
});

test('SURV-THIRST1 AUDIT: the replay flag is the WALK’s, and only the last minute is live', () => {
  const src = readFileSync(new URL('../src/systems/survival/needs.js', import.meta.url), 'utf8');
  // one object for the whole walk, not one per minute (EV2: this loop
  // runs up to MAX_CATCHUP_MINUTES times)
  assert.match(src, /const walk = \{ \.\.\.deps, replay: true \};\s*\n\s*for \(let m = start \+ 1; m <= end; m\+\+\) \{ walk\.replay = m < end;/,
    'the walk marks every minute but the last as a replay, from one object');
  // a bare survivalMinute - the live per-minute call every host makes -
  // is NOT a replay, or nothing would ever die of thirst
  assert.match(src, /autoEat = true, replay = false \} = deps;\n\s+const rules = deps\.rules \?\? HARD_RULES;/, 'a caller that says nothing is live (and, SURV-TIERS, runs Hard - AUDIT SURV-TIERS: a null too)');
});
