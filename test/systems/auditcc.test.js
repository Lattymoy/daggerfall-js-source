import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SURVIVAL_RULES } from '../../src/systems/survival/difficulty.js';
import { newSurvival, survivalMinute, runSurvivalMinutes, markOutCold, hungerStage, hungerMinutes, awakeHours, sleepStage, ROAD_MINUTES, STAGE_REPEAT_MINUTES, SURVIVAL_TEXT, feltCtx } from '../../src/systems/survival/needs.js';
import { createVampirismCurse, cureVampirism } from '../../src/systems/vampirism.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { CLIMATE_TEMP, CLIMATE_NAMES, CHEST_WARMTH, COVERING_CHEST, MONTH_TEMP, naturalTemperature, feltTemperature, temperatureBreakdown, clothingWarmth, sunlit } from '../../src/systems/survival/temperature.js';
import { createPlayerTicker } from '../../src/scenes/shared.js';
import { createArrestFlow, RELEASE_MINUTES } from '../../src/scenes/arrestFlow.js';
import { CRIMES } from '../../src/systems/court.js';
import { PrisonScreenWindow, PRISON_UPDATE_INTERVAL } from '../../src/ui/prisonScreen.js';
import { setWorldMinutes, worldMinutes, skyMinutes, ownMinutes, setSharedClock, setOwnMinutes, alignEntityClocks, resetMagicRoundMarker, CLASSIC_MINUTES_PER_SECOND } from '../../src/systems/worldTick.js';
import { playerEntity as PLAYER_LITERAL } from '../../src/characters/playerEntity.js';
import { createCharacter, STAT_KEYS_ORDER } from '../../src/systems/chargen.js';
import { assignStartingEquipment } from '../../src/systems/startingGear.js';
import { SKILLS } from '../../src/systems/skills.js';
import { maxFatigue, clampFatigue, liveStat } from '../../src/systems/statMods.js';
import { applySpell } from '../../src/systems/effects.js';
import { buildCustomSpell } from '../../src/systems/spell/spellMaker.js';
import { survivalFeed, feltNow } from '../../src/systems/survival/env.js';
import { SURVIVAL_PREF } from '../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY, applyRarity, legendaryById } from '../../src/systems/loot/lootRarity.js';
import '../../src/systems/loot/lootPowers.js';
import { dateFromClassicMinutes, dateToClassicMinutes } from '../../src/systems/gameDate.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { RACES } from '../../src/systems/races.js';
import { templateByIndex, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createEquipTable } from '../../src/characters/equipTable.js';
import { equipItem } from '../../src/systems/equip.js';

// ═══ AUDIT C&C (2026-10-12): THE OWNER'S DECISIONS, MADE, AND THE COMPREHENSIVE AUDIT ═══
//
// The owner: "Make the best decisions. DO a comprehensive audit on everything ensuring perfection". The open questions
// AUDIT SURV-BOONS and AUDIT TEMP-UI left (bible/06-Systems/Climates-Calories.md, AUDIT C&C) decided - E4 the sea at
// nought, E5 a jump felt at its own hours offline - and six cold lenses over the whole arc, read against the mod's
// published source: the needs law and the tiers (N), the temperature law (T), the items, food, camps, fires and the
// tavern (I), the four hosts, the save and the wire (H), what the player sees (S), and the records and the pins (R).
// Every finding was reproduced before it was fixed. This file pins the decisions, the temperature law, a jump, the
// collapse, the prison and the needs; auditcc_items, auditcc_tavern, auditcc_ui and auditcc_pvp pin the rest (and
// tempui's E2 pin the swim that wades). The numbers are LITERALS (A PIN MUST FAIL).

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CASUAL = SURVIVAL_RULES.casual;
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (from) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, survival: newSurvival(from) });
const deps = (extra = {}) => ({ sinks: {}, autoDrink: false, autoEat: false, rules: CASUAL, rolls: () => 0.99, ctx: { raceId: RACES.Breton }, ...extra });
afterEach(() => { _resetForTests(); });
const wearer = () => ({ ...body(0), isPlayer: true, career: {}, skills: new Array(35).fill(30), level: 5, gender: 'male', equip: createEquipTable() });
const garment = (templateIndex, extra = {}) => mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0, ...extra });
const wear = (e, item) => { e.items.push(item); equipItem(e, item); return e; };
/** A Fortify of `stat` by `n`: the spellmaker's record cast on oneself through the one spell door (auditcc_pvp's). */
const fortify = (e, stat, n) => applySpell(buildCustomSpell({
  slots: [{ type: 9, subType: STAT_KEYS_ORDER.indexOf(stat), settings: { magnitudeBaseLow: n, magnitudeBaseHigh: n, magnitudePerLevel: 20, durationBase: 60 } }],
  rangeType: 0, element: 4, name: 'Fortify',
}), 1, e, {}, () => 0.5, { entity: e });
/** The player as the game mints it: the pre-chargen literal, chargen's createCharacter, then AssignStartingGear (the
 *  clothes equipped, the C&C provisions while the arc is on). */
const mintPlayer = () => {
  const e = structuredClone(PLAYER_LITERAL);
  const career = {
    name: 'Pin', primarySkills: [SKILLS.LongBlade, SKILLS.CriticalStrike, SKILLS.Dodging], majorSkills: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Running],
    minorSkills: [SKILLS.Swimming, SKILLS.Jumping, SKILLS.Medical, SKILLS.Stealth, SKILLS.Backstabbing, SKILLS.Mercantile],
    hitPointsPerLevel: 10, advancementMultiplier: 0.3, abilityFlagsAndSpellPointsBitfield: 0x1000,
    strength: 45, intelligence: 45, willpower: 45, agility: 45, endurance: 45, personality: 45, speed: 45, luck: 45,
  };
  createCharacter(e, career, 16, { rolls: () => 0.5 });
  e.armorValues = new Array(7).fill(100); e.items = []; e.equip = null; e.activeEffects = [];
  assignStartingEquipment(e, { classIndex: 0, rolls: () => 0.5 });
  return e;
};
/** world.js survivalEnvNow's shape for the street, read when the ticker asks - BEFORE its clock moves: the sky's month
 *  and fractional hour, the weather the land wears, and the one sun law. */
const streetReader = (e, climateIndex, weather = () => 'sunny') => () => {
  const wm = skyMinutes(), hour = (((wm % 1440) + 1440) % 1440) / 60, w = weather();
  return {
    climateIndex, month: dateFromClassicMinutes(wm).month, hour, weather: w, insideBuilding: false, insideDungeon: false,
    inSunlight: sunlit({ hour, weather: w }), swimming: false, transport: false, byFire: false,
    resting: !!e.isResting, sleeping: e.isResting && !e.isLoitering ? (e.restKind ?? 'rough') : null,
    lycanthrope: false, beastForm: false, fireResist: 0, frostResist: 0,
  };
};
/** The minute law's own reading for `e` where the reader says it stands now (feltCtx - THE ONE CONSTRUCTION SEAM). */
const readingNow = (e, reader) => { const f = survivalFeed(e, reader()); return feltTemperature(f.env, f.deps.worn, feltCtx(e, e.survival, f.deps.ctx)).felt; };
const steel = (templateIndex) => mintCondition({ group: 'Armor', templateIndex, material: 0x0202, name: 'Steel', flags: 0, variant: 0 });
const hourOf = (m) => (((m % 1440) + 1440) % 1440) / 60;
/** The env a host hands at classic minute `m` (world.js survivalEnvNow: the sky's month and fractional hour). */
const skyAt = (base, m) => ({ ...base, hour: hourOf(m), month: dateFromClassicMinutes(m).month });

test('AUDIT C&C E4: THE SEA IS AT NOUGHT - Ocean, every pixel of which the port\'s one water law calls sea, is the season, the hour and the weather alone (SURV1\'s +20 beach made a winter crossing comfortable and a summer one hot; the mod\'s published Climate() answers the sea 0); the breakdown says Sea', () => {
  assert.equal(CLIMATE_TEMP[CLIMATES.Ocean], 0);
  assert.equal(CLIMATE_NAMES[CLIMATES.Ocean], 'Sea');
  // a winter crossing at noon is Morning Star's -20 alone; a summer one Sun's Height's +20, warm and no hotter
  assert.equal(naturalTemperature({ climateIndex: CLIMATES.Ocean, month: 0, hour: 12, weather: 'sunny' }), -20);
  assert.equal(naturalTemperature({ climateIndex: CLIMATES.Ocean, month: 6, hour: 12, weather: 'sunny' }), 20);
  // a winter night's storm at sea, -20 - 20 - 15 = -55
  assert.equal(naturalTemperature({ climateIndex: CLIMATES.Ocean, month: 0, hour: 2, weather: 'thunder' }), -55);
  // the land's own are untouched
  assert.equal(CLIMATE_TEMP[CLIMATES.Woodlands], -10); assert.equal(CLIMATE_TEMP[CLIMATES.Desert2], 50); assert.equal(CLIMATE_TEMP[CLIMATES.Mountain], -40);
  const env = { climateIndex: CLIMATES.Ocean, month: 0, hour: 12, weather: 'sunny' };
  const rows = temperatureBreakdown(env, feltTemperature(env, null, { raceId: RACES.Breton }));
  assert.deepEqual(rows[0], { key: 'climate', label: 'Sea', value: 0 }, 'the climate row, said even at nought');
});

test('AUDIT C&C E5: A JUMP\'S MINUTES ARE FELT AT THEIR OWN HOUR AND MONTH OFFLINE - the jump is the minutes walked one by one at their own sky; online the sky stands (LIVED1) and the host\'s hour holds; the tick says which (worldTick.js: offline the sky is the clock)', () => {
  // a mountain summer night into the morning: the night and the dawn past 30 degrees (exposure climbs), the day not (it falls)
  const MOUNTAIN = { climateIndex: CLIMATES.Mountain, weather: 'sunny' };
  const from = dateToClassicMinutes({ year: 405, month: 6, day: 10, hour: 0, minute: 0 }), to = from + 9 * 60;
  const walked = (stepped) => {
    const e = body(from);
    for (let m = from + 1; m <= to; m++) survivalMinute(e, m, stepped || m === to ? skyAt(MOUNTAIN, m) : skyAt(MOUNTAIN, to), deps({ replay: m < to, landing: m === to }));
    return e.survival;
  };
  // the env a host hands a jump is read BEFORE the clock moves - the departure's (AUDIT C&C R1: the pin had handed the
  // landing's own, which no host produces); online the sky stands at the world's hour, here the landing's day
  const jump = (skyFollows, envAt) => { const e = body(from); runSurvivalMinutes(e, from, to, skyAt(MOUNTAIN, envAt), deps({ skyFollows })); return e.survival; };
  const off = jump(true, from), on = jump(false, to);
  assert.equal(off.exposure, 357, 'offline: 00:01 to 07:59 past 30 (+479), then 08:00 to 09:00 by day (-2 x 61)');
  assert.equal(on.exposure, 0, 'online: the whole jump at the landing\'s day hour - never past 30');
  for (const k of ['exposure', 'thirst', 'wet', 'felt']) {
    assert.equal(off[k], walked(true)[k], `offline the jump is the minutes walked at their own hour (${k})`);
    assert.equal(on[k], walked(false)[k], `online the jump is the minutes walked at the host's hour (${k})`);
  }
  // AND THE MONTH: across a month's end in the subtropics, the old month's last hour is a month cooler (less thirst)
  const SUB = { climateIndex: CLIMATES.Subtropical, weather: 'sunny' };
  const turn = dateToClassicMinutes({ year: 405, month: 6, day: 0, hour: 0, minute: 0 });
  const t = (skyFollows) => { const e = body(turn - 60); runSurvivalMinutes(e, turn - 60, turn + 60, skyAt(SUB, skyFollows ? turn - 60 : turn + 60), deps({ skyFollows })); return e.survival.thirst; };
  const walkedMonth = () => { const e = body(turn - 60); for (let m = turn - 59; m <= turn + 60; m++) survivalMinute(e, m, skyAt(SUB, m), deps({ replay: m < turn + 60, landing: m === turn + 60 })); return e.survival.thirst; };
  assert.equal(t(true), walkedMonth(), 'offline: each side of the month\'s end at its own month');
  assert.ok(t(true) < t(false), `the old month's hour is cooler: ${t(true)} < ${t(false)}`);
  // the minute landed in is felt at its own hour too (AUDIT C&C N1/H4/R1): handed the midnight departure's env, a jump that
  // lands at 08:00 feels its last minute by day (it was felt at 00:00's night: 480)
  const edge = from + 8 * 60;
  const landed = () => { const e = body(from); runSurvivalMinutes(e, from, edge, skyAt(MOUNTAIN, from), deps({ skyFollows: true })); return e.survival.exposure; };
  assert.equal(landed(), 477, 'offline: 00:01 to 07:59 past 30 (+479), and the landing at 08:00 by day (-2)');
  // a one-minute step is no jump - that minute, the host's own env, stepped or not
  const one = (skyFollows) => { const e = body(from); runSurvivalMinutes(e, from, from + 1, skyAt(MOUNTAIN, from + 600), deps({ skyFollows })); return e.survival.felt; };
  assert.equal(one(true), one(false), 'one minute is lived in the host\'s env');
  // the tick says it: offline (no shared clock) the sky is the clock
  assert.match(read('src/systems/worldTick.js'), /runSurvivalMinutes\(entity, lastMinutes, nowMinutes, survival\.env \?\? \{\}, \{ [^\n]*skyFollows: !_sharedClock \}\);/);
});

test('AUDIT C&C T1: WHAT THE DOLL DRAWS OVER THE CUIRASS COVERS IT - COVERING_CHEST is the four robes (drawOrder 80 to the cuirass\'s 50; a cloak\'s 90), where SURV1\'s reading of the IL had a strap and a surcoat beside them and the mod\'s own list adds three gowns the doll draws under the cuirass', () => {
  assert.deepEqual([...COVERING_CHEST].map((i) => templateByIndex(i)?.name).sort(), ['Plain Robes', 'Plain Robes', 'Priest Robes', 'Priestess Robes']);
  // the rule, against DFU's own data: every chest garment the doll draws over the cuirass, and no other
  const over = Object.keys(CHEST_WARMTH).map(Number).filter((i) => templateByIndex(i).drawOrderOrEffect > templateByIndex(102).drawOrderOrEffect);
  assert.deepEqual(over.sort((a, b) => a - b), [...COVERING_CHEST].sort((a, b) => a - b));
  // through the equip path: a plate cuirass in the deep desert's noon sun, under each chest garment (or none)
  const NOON = { climateIndex: CLIMATES.Desert2, month: 6, hour: 12, weather: 'sunny', inSunlight: true };
  const under = (templateIndex, cloak = null) => {
    const e = { ...body(0), isPlayer: true, career: {}, skills: new Array(35).fill(30), level: 5, equip: createEquipTable() };
    equipItem(e, mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0200, name: 'Cuirass', flags: 0, variant: 0 }));
    if (templateIndex) equipItem(e, mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0 }));
    if (cloak) equipItem(e, mintCondition({ group: 'MensClothing', templateIndex: cloak, name: 'cloak', flags: 0, variant: 0 }));
    const t = feltTemperature(NOON, e.equip.slots, { raceId: RACES.Breton });
    return { metal: t.metal, note: temperatureBreakdown(NOON, t).find((r) => r.key === 'armour')?.note ?? null };
  };
  // the cuirass's metal is 4: the deep desert's noon of 70 makes it 14 in the sun
  assert.deepEqual(under(null), { metal: 14, note: 'hot metal' }, 'bare: the sun on the metal');
  for (const [i, name] of [[163, 'Plain Robes'], [164, 'Priest Robes'], [200, 'Plain Robes'], [201, 'Priestess Robes']]) assert.deepEqual(under(i), { metal: 0, note: null }, `${name} covers it`);
  assert.deepEqual(under(null, 154), { metal: 0, note: null }, 'a casual cloak covers it');
  for (const [i, name] of [[177, 'Challenger Straps'], [176, 'Anticlere Surcoat'], [157, 'Dwynnen Surcoat'], [195, 'Evening Gown'], [196, 'Day Gown'], [197, 'Casual Dress']]) {
    assert.deepEqual(under(i), { metal: 14, note: 'hot metal' }, `${name} does not - the doll draws it under the cuirass`);
  }
});

test('AUDIT C&C T1: UNDERGROUND THE RESISTANCES TURN THE DUNGEON\'S AIR TOWARD NOUGHT, AND THE AIR DRIES THE CLOTHES - they were laid on the surface\'s reading before the ground\'s correction, so a Resist Fire pushed a Dak\'fron hall from 5 to -20 and a Resist Frost did nothing in a mountain one while its row still showed; and a Resist Fire dried a soaked shirt six times slower', () => {
  const DAK = { climateIndex: CLIMATES.Desert2, month: 6, hour: 12, weather: 'sunny', insideDungeon: true };
  const bare = feltTemperature(DAK, null, { raceId: RACES.Breton }), fire = feltTemperature(DAK, null, { raceId: RACES.Breton, fireResist: 50 });
  assert.deepEqual([bare.natural, bare.air, bare.natTemp, fire.natTemp, fire.worldResist, fire.dungeon], [70, 5, 5, 0, -5, -65]);
  const MTN = { climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow', insideDungeon: true };
  const cold = feltTemperature(MTN, null, { raceId: RACES.Breton }), frost = feltTemperature(MTN, null, { raceId: RACES.Breton, frostResist: 25 });
  assert.deepEqual([cold.natTemp, frost.natTemp, frost.worldResist, frost.dungeon], [-20, 0, 20, 40]);
  // swept: a resistance never moves the world's part away from nought, and a Resistances row never shows for nothing
  for (const ci of Object.values(CLIMATES)) for (let month = 0; month < 12; month++) for (const insideDungeon of [false, true]) {
    const env = { climateIndex: ci, month, hour: 12, weather: 'sunny', insideDungeon };
    const base = feltTemperature(env, null, { raceId: RACES.Breton });
    for (const r of [{ fireResist: 25 }, { fireResist: 50 }, { fireResist: 100 }, { frostResist: 25 }, { frostResist: 50 }, { frostResist: 100 }]) {
      const t = feltTemperature(env, null, { raceId: RACES.Breton, ...r });
      assert.ok(Math.abs(t.natTemp) <= Math.abs(base.natTemp), `${ci}/${month}/${insideDungeon} ${JSON.stringify(r)}: ${base.natTemp} -> ${t.natTemp}`);
      if (t.worldResist !== 0) assert.notEqual(t.natTemp, base.natTemp);
      assert.equal(t.natural + t.dungeon + t.worldResist, t.natTemp, 'the rows still add up');
    }
  }
  // the drying: a Soaked shirt at an Alik'r noon gives up six a minute, resisted or not (the resisted 10 gave up one)
  const NOON = { climateIndex: CLIMATES.Desert, month: 6, hour: 12, weather: 'sunny', inSunlight: true };
  for (const fireResist of [0, 50]) {
    const e = body(0); e.survival.wet = 120;
    survivalMinute(e, 1, NOON, deps({ ctx: { raceId: RACES.Breton, fireResist } }));
    assert.equal(e.survival.wet, 114, `Resist Fire ${fireResist}`);
  }
});

test('AUDIT C&C T5: A HOOD\'S SHADE EASES IN - a degree a degree past a natural thirty, to its ten, before the wet: no warmer world reads cooler under any hooded cloak in the sun for any chest garment (the shade came off whole at 31), and the dry reading is the dry law\'s, never below nothing', () => {
  const HOODED = [[154, 1], [154, 2], [154, 5], [155, 1], [155, 2], [155, 5]];   // the casual and the formal cloak, the variants drawn hood up
  for (const chest of [null, ...Object.keys(CHEST_WARMTH).map(Number)]) for (const [cloak, variant] of HOODED) {
    const e = wearer(); if (chest) wear(e, garment(chest)); wear(e, garment(151)); wear(e, garment(cloak, { variant }));
    let last = null;
    for (let n = -60; n <= 80; n++) {
      const c = clothingWarmth(e.equip.slots, { natural: n, inSunlight: true });
      assert.ok(c.pure >= 0 && c.warmth >= 0);
      if (last !== null) assert.ok(n + c.warmth >= last, `${chest}+${cloak}/${variant}: a natural ${n} reads ${n + c.warmth}, cooler than ${n - 1}'s ${last}`);
      last = n + c.warmth;
    }
  }
  // the report's outfit: the Dwynnen Surcoat (12), casual pants (10) and a formal cloak drawn hood up (15) at a natural 30, 31,
  // 35 and 40 - a degree of shade a degree past thirty (the whole ten at 31 had made it 18 then 8: a world one degree warmer
  // reading nine degrees cooler)
  const e = wear(wear(wear(wearer(), garment(157)), garment(151)), garment(155, { variant: 1 }));
  assert.deepEqual([30, 31, 35, 40].map((n) => clothingWarmth(e.equip.slots, { natural: n, inSunlight: true }).warmth), [18, 17, 13, 8]);
  // the dry note: plain robes drawn hood up, pants and a formal cloak at a desert noon, wet 4 - the dry reading is the law's own dry
  const r = wear(wear(wear(wearer(), garment(163, { variant: 1 })), garment(151)), garment(155));
  const wet4 = clothingWarmth(r.equip.slots, { natural: 60, inSunlight: true, wet: 4 }), dry = clothingWarmth(r.equip.slots, { natural: 60, inSunlight: true, wet: 0 });
  assert.deepEqual([wet4.warmth, wet4.pure, dry.warmth], [Math.max(0, dry.warmth - 4), dry.warmth, dry.warmth]);
  // never below nothing: straps under a hooded casual cloak at a natural 45 - the shade's ten against a warmth of six
  const thin = wear(wear(wearer(), garment(141)), garment(154, { variant: 1 }));
  assert.deepEqual(clothingWarmth(thin.equip.slots, { natural: 45, inSunlight: true }), { warmth: 0, pure: 0, hood: true });
});

test('AUDIT C&C T7: THE LAW READS WHOLE WETNESS - a weatherproof garment turns part of each minute\'s soaking aside and the counter keeps the fraction, but the felt reading stays a whole number, so the plate\'s number and its word agree (a reading of -10.2 printed "-10" over "cold")', () => {
  const env = { climateIndex: CLIMATES.Ocean, month: 0, hour: 12, weather: 'rain' };
  assert.equal(feltTemperature(env, null, { raceId: RACES.Breton, wet: 2.9 }).felt, feltTemperature(env, null, { raceId: RACES.Breton, wet: 2 }).felt);
  setPref(SURVIVAL_PREF, 'casual'); setPref(LOOT_RARITY_KEY, true);
  const robes = applyRarity(garment(163), 'legendary', () => 0, [legendaryById('alikr-robes')]); robes.isIdentified = true;
  const e = wear(wear(wearer(), robes), garment(151));
  let fractional = false;
  for (let m = 1; m <= 240; m++) {
    const f = survivalFeed(e, { climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'rain' });
    survivalMinute(e, m, f.env, { ...f.deps, autoDrink: false, autoEat: false, rolls: () => 0.99 });
    if (!Number.isInteger(e.survival.wet)) fractional = true;
    assert.ok(Number.isInteger(feltNow(e).felt) && Number.isInteger(e.survival.felt), `minute ${m}: wet ${e.survival.wet}, felt ${feltNow(e).felt}`);
  }
  assert.ok(fractional, 'the weatherproofing kept a fraction on the counter');
});

test('AUDIT C&C E5, THROUGH THE TICKER (N1/H4/R1, T6/R3): EVERY minute of an offline jump - the one it lands in too - is felt at its own hour, month and sun; the host reads the sky BEFORE the clock moves, so the landing had been felt at the departure\'s hour (a mountain summer midnight landing at 09:00 read -45 where 09:00 reads -5) and a replayed night had kept the noon\'s sun on its metal', () => {
  setPref(SURVIVAL_PREF, 'casual');
  // a mountain summer night into the morning, through the real ticker and a reader shaped like world.js's
  const from = dateToClassicMinutes({ year: 405, month: 6, day: 10, hour: 0, minute: 0 });
  setWorldMinutes(from);
  const e = mintPlayer(); e.survival = { ...newSurvival(from), lastMinute: from };
  const reader = streetReader(e, CLIMATES.Mountain);
  createPlayerTicker(e, { survivalEnv: reader }).advance(9 * 60);
  assert.equal(worldMinutes(), from + 9 * 60);
  assert.equal(e.survival.felt, readingNow(e, reader), 'the landing is the 09:00 reading');
  assert.equal(e.survival.felt, -5);
  // the same nine hours walked a minute at a time, each at its own sky (the landing too)
  const w = mintPlayer(); w.survival = { ...newSurvival(from), lastMinute: from };
  for (let m = from + 1; m <= from + 9 * 60; m++) { setWorldMinutes(m); const f = survivalFeed(w, streetReader(w, CLIMATES.Mountain)()); survivalMinute(w, m, f.env, { ...f.deps, replay: m < from + 540, landing: m === from + 540, autoDrink: false, autoEat: false }); }
  assert.equal(e.survival.exposure, w.survival.exposure, 'the jump is the minutes walked at their own sky');
  // and the sun: plate in the Subtropics, a summer noon into the small hours - the night is felt with no sun on the metal
  const noon = dateToClassicMinutes({ year: 405, month: 6, day: 12, hour: 12, minute: 0 });
  setWorldMinutes(noon);
  const p = mintPlayer(); for (const t of [102, 104]) { const it = steel(t); p.items.push(it); equipItem(p, it); }
  p.survival = { ...newSurvival(noon), lastMinute: noon };
  const sub = streetReader(p, CLIMATES.Subtropical);
  createPlayerTicker(p, { survivalEnv: sub }).advance(14 * 60);
  assert.equal(p.survival.felt, readingNow(p, sub), 'the 02:00 landing, in the dark');
  setWorldMinutes(noon + 13 * 60);
  assert.equal(sunlit(sub()), false, '01:00 is no sunlit minute');
});

test('AUDIT C&C H3/N1: A ROAD MEETS NO WEATHER IT CANNOT KNOW - a jump of more than an hour that is not a rest is felt under a fair sky, so a fast travel set out in the rain no longer lands Drenched with its steel rusted; a rest, and an hour\'s jump, keep the host\'s weather', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const RAIN = () => 'rain';
  const run = ({ minutes, resting = false }) => {
    const from = dateToClassicMinutes({ year: 405, month: 6, day: 14, hour: 12, minute: 0 });
    setWorldMinutes(from);
    const e = mintPlayer(); const pieces = [102, 104].map(steel); for (const it of pieces) { e.items.push(it); equipItem(e, it); }
    e.survival = { ...newSurvival(from), lastMinute: from };
    if (resting) { e.isResting = true; e.restKind = 'rough'; }
    createPlayerTicker(e, { survivalEnv: streetReader(e, CLIMATES.Woodlands, RAIN) }).advance(minutes);
    return { wet: e.survival.wet, condition: pieces.map((i) => i.currentCondition === i.maxCondition) };
  };
  assert.deepEqual(run({ minutes: 2 * 1440 }), { wet: 0, condition: [true, true] }, 'two days on the road: dry, nothing rusted');
  assert.ok(run({ minutes: ROAD_MINUTES }).wet > 0, 'an hour\'s jump keeps the host\'s rain');
  assert.equal(run({ minutes: ROAD_MINUTES + 1 }).wet, 0, 'past an hour it is a road');
  assert.ok(run({ minutes: 2 * 60, resting: true }).wet > 0, 'a rest keeps the host\'s rain - its window re-reads it');
});

test('AUDIT C&C N2/H1: A JUMP NEVER EMPTIES THE POOL, AND THE COLLAPSE\'S HOUR IS A NIGHT ON THE GROUND - a Hard three-day journey collapsed from inside its own replay 83 times and landed 6.46 days out; now no replayed or landing minute takes the last point, and a host\'s collapse hour (markOutCold) is walked as a rough sleep', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const from = dateToClassicMinutes({ year: 405, month: 6, day: 16, hour: 12, minute: 0 });
  setWorldMinutes(from);
  const e = mintPlayer();
  e.survival = { ...newSurvival(from), lastMinute: from, lastAte: from - 1500, thirst: 90, sleepDebt: 13, awakeSince: from - 2000 };
  let collapses = 0;
  createPlayerTicker(e, { survivalEnv: streetReader(e, CLIMATES.Desert), onExhausted: () => { collapses++; } }).advance(3 * 1440);
  assert.equal(collapses, 0, 'no collapse inside the jump');
  assert.equal(worldMinutes(), from + 3 * 1440, 'the clock moved three days, and no more');
  assert.ok(e.fatigue >= 64, `the pool keeps its last point (${e.fatigue})`);
  // the collapse's hour: marked, it pays the rough night's half hour and the needs take nothing; unmarked, an hour awake
  const hour = (mark) => {
    const b = body(from); b.survival.sleepDebt = 13; b.survival.awakeSince = from - 2000; b.survival.lastMinute = from;
    let drained = 0;
    if (mark) assert.equal(markOutCold(b), true);
    runSurvivalMinutes(b, from, from + 60, { climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny' }, deps({ rules: SURVIVAL_RULES.hard, sinks: { drainFatigue: (n) => { drained += n; } } }));
    return { debt: Math.round(b.survival.sleepDebt * 1000) / 1000, drained, marked: 'outColdUntil' in b.survival };
  };
  assert.deepEqual(hour(true), { debt: 12.5, drained: 0, marked: false });
  assert.deepEqual(hour(false), { debt: 14, drained: 8 * 60, marked: false });
  // and fired from INSIDE a live minute, as the hosts' drain sink fires it - through the real ticker, in both lanes: the
  // hour is the sixty after the minute in hand, walked asleep to its last (the record's last paid minute is one behind
  // there, and the mark read alone left the hour's last minute awake)
  for (const lane of ['offline', 'online']) {
    const at = from + 10 * 1440, sky = { clock: at + 900 * 1440 };
    const b = { ...body(at), fatigue: 10, lastGameMinutes: at };
    Object.assign(b.survival, { lastMinute: at, lastAte: at - 1500, thirst: 90, sleepDebt: 13, awakeSince: at - 2000 });
    if (lane === 'online') { setSharedClock(() => sky.clock); setOwnMinutes(at); alignEntityClocks(b, sky.clock); } else { setSharedClock(null); setWorldMinutes(at); }
    resetMagicRoundMarker(at);
    let latch = false, collapses = 0, clock = null;
    const ticker = createPlayerTicker(b, {
      survivalEnv: () => ({ climateIndex: CLIMATES.Desert, month: 6, hour: 12, weather: 'sunny', inSunlight: true }),
      onExhausted: () => { if (latch) return; latch = true; collapses++; try { markOutCold(b); ticker.advance(60); b.fatigue = 6400; } finally { latch = false; } },
    });
    try {
      if (lane === 'online') sky.clock += 1;
      ticker.tick(1 / CLASSIC_MINUTES_PER_SECOND);   // a live minute, whose drain empties the pool
      if (lane === 'online') sky.clock += 0.01;
      ticker.tick(0.001);   // and the frame after it
      clock = Math.floor(ownMinutes()) - at;
    } finally { setSharedClock(null); }
    assert.deepEqual({ collapses, clock, asleepTo: b.survival.awakeSince - at, marked: 'outColdUntil' in b.survival }, { collapses: 1, clock: 61, asleepTo: 61, marked: false }, lane);
  }
  // the four hosts mark it as they raise it
  for (const [file, raise] of [['src/scenes/world.js', 'playerTicker.advance(60);'], ['src/scenes/exterior.js', 'playerTicker.advance(60);'], ['src/scenes/worldModes.js', 'interiorTicker.advance(60);'], ['src/scenes/dungeonContext.js', 'advanceOwnMinutes(60);']]) {
    const src = read(file), i = src.indexOf(raise);
    assert.ok(i > 0 && /markOutCold\(playerEntity\);[^\n]*\n\s*$/.test(src.slice(Math.max(0, i - 400), i)), `${file}: marked before the hour is raised`);
  }
});

test('AUDIT C&C N3/H2: A PRISONER LEAVES FED, WATERED AND RESTED - the sentence is a bare move of the clock, and the first frame out walked its last two days after the refill, awake and unfed, in the street\'s weather; the needs start fresh at the minute the sentence ends, and the walk resumes from there', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const start = dateToClassicMinutes({ year: 405, month: 0, day: 3, hour: 12, minute: 0 });
  setWorldMinutes(start);
  const slot = { win: null, onClosed: null };
  const townTalk = { slot, texts: () => null, showOverlay(win, onClosed = null) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; slot.onClosed = onClosed; }, close() { const cb = slot.onClosed; slot.win = null; slot.onClosed = null; cb?.(); } };
  const player = {
    name: 'Mack', health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
    stats: { ...STATS }, crimeCommitted: CRIMES.Murder, legalRep: { 17: -25 }, items: [], skills: 30,
    haveShownSurrenderDialogue: true, arrested: false, activeEffects: [], chargedCrime: CRIMES.Murder, raceId: RACES.Breton,
    survival: { ...newSurvival(start), lastMinute: start, lastAte: start - 2000, thirst: 110, sleepDebt: 13, awakeSince: start - 2000, wet: 250 },
  };
  // the real flow, with its own clock moves - the sentence's days and the release's four hours
  const flow = createArrestFlow({ townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99, guildRankOf: () => null, clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {} });
  flow.startCourtFlow();
  townTalk.slot.win.input('KeyG');
  const prison = townTalk.slot.win;
  assert.ok(prison instanceof PrisonScreenWindow);
  const days = prison.daysInPrison;
  assert.ok(days >= 1);
  for (let i = 0; i < days; i++) prison.tick(PRISON_UPDATE_INTERVAL);
  townTalk.close();
  flow.dispose();
  const s = player.survival, out = ownMinutes();
  assert.equal(s.lastMinute, out - RELEASE_MINUTES, 'the needs stand at the sentence\'s end - only the release\'s hours are left to walk');
  assert.deepEqual([s.thirst, s.wet, s.sleepDebt, s.awakeSince], [0, 0, 0, out - RELEASE_MINUTES]);
  // the first frame out, in a Hard winter street: the release's four hours, not the sentence
  runSurvivalMinutes(player, s.lastMinute, out, { climateIndex: CLIMATES.Woodlands, month: 0, hour: 16, weather: 'snow' }, deps({ rules: SURVIVAL_RULES.hard, skyFollows: true }));
  assert.equal(hungerStage(hungerMinutes(s, out)), 'peckish');
  assert.equal(sleepStage(s.sleepDebt), 'rested');
});

test('AUDIT C&C B11: THE ENHANCED MENU\'S ATTRIBUTES PAGE NAMES THE BOONS THAT RAISE THEM - under the meters, from the pack\'s one source (ui/temperatureCard.js boonStatRows: nothing outside the Boons tier), so a raised attribute is explained on every sheet that shows it', () => {
  const src = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(src, /import \{ boonStatRows \} from '\.\.\/temperatureCard\.js';/);
  const fn = src.slice(src.indexOf('function statsAttributes('), src.indexOf('\n}\n', src.indexOf('function statsAttributes(')));
  assert.match(fn, /const boons = boonStatRows\(playerEntity\);\n\s*if \(!boons\.length\) return;\n\s*detail\.append\(pxDivider\('Boons'\)\);/, 'the section only when a boon stands, after the eight meters');
  assert.match(fn, /r\.append\(el\('span', 'k', k\), el\('span', 'v', v\)\);/, 'each boon its name and what it gives');
  assert.ok(fn.indexOf('meterRow(') < fn.indexOf('boonStatRows('), 'the meters first');
});

test('AUDIT C&C N5: A DRAIN LANDS INSIDE THE POOL - DaggerfallEntity.SetFatigue clamps every write to [0, MaxFatigue], and the hosts\' drains clamped at nought alone: a pool a lapsed boon or a Fortify\'s end leaves over its ceiling (8,320 over 6,400) stayed over it through every drain (8,310); the one clamp (statMods.js clampFatigue) in the ticker\'s sinks and the four hosts\' own', () => {
  const e = { stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 8320 };
  const ticker = createPlayerTicker(e);
  ticker.sinks.drainFatigue(10);
  assert.equal(e.fatigue, 6400, 'the ceiling (50 + 50) x 64 - the drain lands in the pool');
  ticker.sinks.drainFatigue(10);
  assert.equal(e.fatigue, 6390, 'and drains from there');
  assert.equal(clampFatigue(e, -5), 0);
  for (const [file, sink] of [['src/scenes/world.js', 'const drainExteriorFatigue = (n) => {'], ['src/scenes/exterior.js', 'const drainExteriorFatigue = (n) => {'], ['src/scenes/worldModes.js', 'const drainInteriorFatigue = (n) => {'], ['src/scenes/dungeonContext.js', 'function drainFatigue(n) {'], ['src/scenes/shared.js', 'drainFatigue: (n, a = null) => {']]) {
    const src = read(file), i = src.indexOf(sink);
    assert.ok(i > 0 && /\n\s*(?:playerEntity|entity)\.fatigue = clampFatigue\((?:playerEntity|entity), \((?:playerEntity|entity)\.fatigue \?\? 0\) - n\);/.test(src.slice(i, i + 400)), `${file}: the one clamp`);
  }
});

test('AUDIT C&C N6: A LINE HEARD LATELY IS NOT SAID AGAIN, AND A LOAD SAYS NOTHING THE BODY WAS TOLD - a Hard winter\'s snow at 19:00, stepping in and out of a fire\'s reach every two minutes for an hour, said nineteen lines (eleven of them "Your teeth are chattering uncontrollably!") and says five; and a body Hungry, Thirsty, Tired, Damp and Cold, saved and loaded, heard all five again in the first minute after', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const from = dateToClassicMinutes({ year: 405, month: 0, day: 3, hour: 19, minute: 0 });
  setWorldMinutes(from);
  const e = mintPlayer(); e.survival = { ...newSurvival(from), lastMinute: from }; e.lastGameMinutes = from;
  equipItem(e, e.items.find((i) => i.templateIndex === 147));   // the start's own Shoes on (AUDIT C&C I7) - the stage lines alone
  let fire = false;
  const street = streetReader(e, CLIMATES.Woodlands, () => 'snow');
  const lines = [];
  const ticker = createPlayerTicker(e, { survivalEnv: () => ({ ...street(), byFire: fire }), say: (l) => lines.push(l) });
  ticker.tick(1 / CLASSIC_MINUTES_PER_SECOND);
  assert.deepEqual(lines, ['The cold is seeping into your bones...'], 'the first minute in the snow');
  lines.length = 0;
  for (let m = 0; m < 60; m++) { fire = Math.floor(m / 2) % 2 === 0; ticker.tick(1 / CLASSIC_MINUTES_PER_SECOND); }
  const heard = {};
  for (const l of lines) heard[l] = (heard[l] ?? 0) + 1;
  assert.deepEqual(heard, { 'You are warming up.': 1, 'You are a bit wet.': 1, 'Your teeth are chattering uncontrollably!': 2, 'You are quite wet.': 1 });
  assert.equal(STAGE_REPEAT_MINUTES, 30);
  // the load: the stages the record stands at are said already (needs.js savedNotes) - a worse one is news
  const at = from + 3 * 1440;
  setWorldMinutes(at);
  const b = body(at);
  Object.assign(b, { isPlayer: true, lastGameMinutes: at });
  Object.assign(b.survival, { lastMinute: at, lastAte: at - 800, thirst: 60, sleepDebt: 5, wet: 10, awakeSince: at - 20 * 60, felt: -15 });
  const said = [];
  const env = () => ({ climateIndex: CLIMATES.Woodlands, month: 0, hour: 12, weather: 'cloudy' });
  const first = createPlayerTicker(b, { survivalEnv: env, say: (l) => said.push(l) });
  first.tick(1 / CLASSIC_MINUTES_PER_SECOND);
  const STAGES = ['damp', 'hungry', 'thirsty', 'tired', 'cold'].map((k) => SURVIVAL_TEXT[k]);
  const stageLines = () => said.filter((l) => STAGES.includes(l) || l === SURVIVAL_TEXT.parched);
  assert.deepEqual(stageLines(), STAGES, 'the five, said once (the bare skin\'s and the bare feet\'s are paced lines of their own, the mod\'s)');
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(b, { classicMinutes: Math.floor(worldMinutes()) })));
  const back = { ...body(at), isPlayer: true };
  restorePlayer(back, snap);
  back.lastGameMinutes = b.lastGameMinutes;
  said.length = 0;
  const second = createPlayerTicker(back, { survivalEnv: env, say: (l) => said.push(l) });
  second.tick(1 / CLASSIC_MINUTES_PER_SECOND);
  assert.deepEqual(stageLines(), [], 'the first minute after the load says no stage it said before');
  back.survival.thirst = 79.9;
  second.tick(1 / CLASSIC_MINUTES_PER_SECOND);
  assert.deepEqual(stageLines(), [SURVIVAL_TEXT.parched], 'a worse stage is news');
  // and a red one keeps its way out: saved Freezing, the body warmed after the load is told so, once
  const r = body(at);
  Object.assign(r, { isPlayer: true, lastGameMinutes: at });
  Object.assign(r.survival, { lastMinute: at, felt: -45 });
  const red = { ...body(at), isPlayer: true };
  restorePlayer(red, JSON.parse(JSON.stringify(snapshotPlayer(r, { classicMinutes: at }))));
  red.lastGameMinutes = at;
  said.length = 0;
  createPlayerTicker(red, { survivalEnv: () => ({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true }), say: (l) => said.push(l) }).tick(1 / CLASSIC_MINUTES_PER_SECOND);
  assert.deepEqual(said.filter((l) => l === SURVIVAL_TEXT.warming), [SURVIVAL_TEXT.warming]);
});

test('AUDIT C&C N4: A BODY THAT DOES NOT EAT DOES NOT HUNGER - a vampire\'s hunger and wakefulness, and a beast\'s hunger and thirst, stand still while the need does (the mod reads a vampire and a beast fed and skips their thirst); the clock ran on under them, and a vampire cured after ten days was Starving and 240 hours awake in its first minute', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const T = dateToClassicMinutes({ year: 405, month: 3, day: 3, hour: 12, minute: 0 });
  setWorldMinutes(T);
  const INN = { climateIndex: CLIMATES.Woodlands, month: 3, hour: 12, weather: 'cloudy', insideBuilding: true };
  const walk = (e, from, to, env = INN) => { const f = survivalFeed(e, env); runSurvivalMinutes(e, from, to, f.env, { ...f.deps, autoDrink: false, autoEat: false }); };
  // ten days a vampire (the real curse), then cured (the real cure)
  const v = body(T);
  Object.assign(v.survival, { lastMinute: T, lastAte: T - 300, awakeSince: T - 5 * 60, thirst: 20 });
  assert.ok(createVampirismCurse(v, null, { now: T }));
  let at = T;
  for (let d = 0; d < 5; d++) { walk(v, at, at + 2 * 1440); at += 2 * 1440; }
  assert.deepEqual([hungerMinutes(v.survival, at), awakeHours(v.survival, at), v.survival.thirst], [300, 5, 20], 'ten days on, the needs where the curse found them');
  assert.ok(cureVampirism(v));
  walk(v, at, at + 1);
  assert.deepEqual([hungerStage(hungerMinutes(v.survival, at + 1)), Math.round(awakeHours(v.survival, at + 1) * 60)], ['peckish', 5 * 60 + 1], 'cured, the body is as it was - its first minute a mortal\'s');
  // a werewolf's night as the beast, changed Starving and Dehydrated: eight hours, the hunger and the thirst stand and
  // cost nothing - the beast is fed, the well-fed hour's point back as the mod's FoodEffects gives it; the sleep runs
  const w = body(T);
  Object.assign(w.survival, { lastMinute: T, lastAte: T - 1500, awakeSince: T - 60, thirst: 110, sleepDebt: 0 });
  const lines = []; let restored = 0;
  const night = (from, to, beastForm) => {
    const f = survivalFeed(w, { ...INN, lycanthrope: true, beastForm });
    runSurvivalMinutes(w, from, to, f.env, { ...f.deps, autoDrink: false, autoEat: false, sinks: { restoreFatigue: (n) => { restored += n; }, drainFatigue: () => {}, say: (l) => lines.push(l) } });
  };
  const drains = () => ({ ...(w.activeEffects.find((a) => a?.kind === 'survival')?.statMods ?? {}) });
  night(T, T + 8 * 60, true);
  assert.deepEqual([hungerMinutes(w.survival, T + 8 * 60), w.survival.thirst, Math.round(awakeHours(w.survival, T + 8 * 60))], [1500, 110, 9], 'the beast hunts: hunger and thirst where they were, nine hours awake');
  assert.deepEqual(lines.filter((l) => ['starving', 'hungry', 'peckish', 'dehydrated', 'parched', 'thirsty'].some((k) => l === SURVIVAL_TEXT[k])), [], 'no need of a meal or a drink said');
  assert.equal(restored, 8 * 64, 'fed: the well-fed hour, eight times');
  assert.deepEqual(drains(), {}, 'and no starving or dehydrated drain on the beast');
  night(T + 8 * 60, T + 9 * 60, false);
  assert.equal(hungerMinutes(w.survival, T + 9 * 60), 1560, 'back in the body, the meal\'s clock runs again');
  assert.equal(drains().strength, -5, 'and its drains with it: a starving day\'s two, and three for a thirst that ran its hour past dehydrated');
});

test('AUDIT C&C N8: THIRST RISES AT ITS BASE RATE IN THE COLD - a body loses water in any weather (the mod\'s rises at its least in the cold too); the floor meant to halve it there sat over a factor never under one, and is gone: an hour in a mountain blizzard and an hour in a comfortable room each add 100 / 6, and a desert noon more', () => {
  const hour = (env) => { const e = body(0); for (let m = 1; m <= 60; m++) survivalMinute(e, m, env, deps()); return Math.round(e.survival.thirst * 1000) / 1000; };
  assert.equal(hour({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow' }), 16.667);
  assert.equal(hour({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true }), 16.667);
  assert.ok(hour({ climateIndex: CLIMATES.Desert2, month: 6, hour: 12, weather: 'sunny' }) > 30);
  assert.doesNotMatch(read('src/systems/survival/needs.js'), /Math\.max\(0\.5, 1 \+ Math\.max\(0, temp\.felt - 10\) \/ 10\)/);
});

test('AUDIT C&C D5: BARE FEET READ THE NATURAL TEMPERATURE AGAINST THE LIVE ENDURANCE, OUTSIDE - the mod\'s FeetDmg: past half the live endurance, on foot, never inside; the port read the felt temperature (a robe and a cloak shod the feet), the permanent endurance (a Fortify Endurance did nothing) and underground too', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const WOODS = { climateIndex: CLIMATES.Woodlands, month: 0, hour: 12, weather: 'sunny' };   // a natural -30
  const bare = (e, env) => { const f = survivalFeed(e, env); survivalMinute(e, 1, f.env, { ...f.deps, autoDrink: false, autoEat: false }); return e.survival.notes.feet === 'on'; };
  // a robe and the formal cloak, hood up, barefoot: the felt -3, the ground -30 - the feet freeze
  const robed = wearer();
  for (const it of [garment(163), garment(155, { variant: 1 })]) wear(robed, it);
  assert.equal(bare(robed, WOODS), true, 'clothes shoe no foot');
  assert.equal(feltNow(robed).felt, -3);
  // naked, its endurance fortified to 70: half of it, 35, past the ground's 30 - the feet hold
  const hardy = wearer();
  fortify(hardy, 'endurance', 20);
  assert.equal(liveStat(hardy, 'endurance'), 70);
  assert.equal(bare(hardy, WOODS), false, 'the live endurance');
  assert.equal(bare(wearer(), WOODS), true, 'and without the spell, 25 is under 30');
  // underground the feet are never the ground's (a dungeon is inside): an endurance of 30 in a mountain hall's -20
  const deep = wearer(); deep.stats.endurance = 30;
  assert.equal(bare(deep, { climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow', insideDungeon: true }), false);
});

test('AUDIT C&C (lens T): A CASTLE\'S HALLS ARE NOT UNDERGROUND - the mod\'s Dungeon() corrects a castle\'s air as a dungeon\'s (IsPlayerInsideDungeonCastle beside IsPlayerInsideDungeon), so the law is one; the breakdown names the row by where the body stands, "Castle walls" in a castle block and "Underground" below it, and the dungeon host says which (mutants: the label ignores the castle; the host never says it; the feed drops it)', () => {
  setPref(SURVIVAL_PREF, 'casual');
  const hall = { climateIndex: CLIMATES.Woodlands, month: 0, hour: 12, weather: 'sunny', insideDungeon: true };
  const ground = (env) => temperatureBreakdown(env, feltTemperature(env, [], { raceId: RACES.Breton })).find((r) => r.key === 'ground') ?? null;
  assert.deepEqual(ground(hall), { key: 'ground', label: 'Underground', value: 10 }, 'a Woodlands winter\'s -30 held to the -20 below');
  assert.deepEqual(ground({ ...hall, castle: true }), { key: 'ground', label: 'Castle walls', value: 10 }, 'the same law in a palace, named for where it is');
  assert.equal(ground({ ...hall, insideDungeon: false }), null, 'on the surface, no row');
  // the feed carries the host's word (off by default - a host that says nothing stands in no castle), and the host says it
  assert.equal(survivalFeed(wearer(), { ...hall, castle: true }).env.castle, true);
  assert.equal(survivalFeed(wearer(), hall).env.castle, false);
  assert.match(read('src/scenes/dungeonContext.js'), /\n {6}castle: !!\(_fpFeet && castleBlockAt\(_fpFeet\[0\], _fpFeet\[2\]\)\),/);
});

test('AUDIT C&C (lens T): THE STANDALONE EXTERIOR READS THE REPAIRED CLIMATE - StreamingWorld.ReadyCheck dilates the coast\'s ocean pixels before DFU reads a climate, and the streaming host runs it at boot; the standalone exterior (?loc, ?region) read the raw buffer, so a coastal town whose own pixel is raw Ocean felt the sea\'s nought there and its land\'s climate in the world - it runs the same repair, after its maps load and before its first location read (mutant: no repair)', () => {
  const ext = read('src/scenes/exterior.js');
  const load = ext.indexOf('  maps.load(mapsBytes, climateBytes, politicBytes);');
  const repair = ext.indexOf('\n  dilateCoastalClimate(maps, 2);\n');
  const first = ext.indexOf('maps.getLocation');
  assert.ok(load >= 0 && repair >= 0 && first >= 0, 'the load, the repair and the first read all stand');
  assert.ok(load < repair && repair < first, 'the repair between the load and the first read');
  assert.match(read('src/scenes/world.js'), /\n {2}const dilated = dilateCoastalClimate\(maps, 2\);/, 'as the streaming host runs it');
});

test('AUDIT C&C (lens H): NO SAVE INSIDE A JOURNEY - DFU\'s fast travel is one frame (TeleportToCoordinates, then RaiseTime), and here the teleport is awaited with frames running before the clock moves: a save between them wrote the arrival\'s place with the departure\'s clock and needs; the save refuses while the journey stands, and the journey\'s flag stands from before the teleport to after the clock, and falls whatever happens (mutant: no refusal)', () => {
  const w = read('src/scenes/world.js');
  const at = w.indexOf('function worldQuickSave(');
  const save = w.slice(at, w.indexOf('const pf = walkMode && playerSpawned ? player.pos : cam.pos;', at));
  assert.match(save, /\n {4}if \(_traveling\) \{ if \(!quiet\) townTalk\.say\('You cannot save now\.'\); return false; \}/, 'refused, said to a save pressed');
  const rise = w.indexOf('      _traveling = true;\n'), teleport = w.indexOf('await _teleportToPixel(pick.pixel.x, pick.pixel.y', rise);
  const clock = w.indexOf('playerTicker.advance(computed.minutes);', teleport), fall = w.indexOf('        _traveling = false;\n', clock);
  assert.ok(rise > 0 && rise < teleport && teleport < clock && clock < fall, 'the flag over the teleport and the clock');
  assert.ok(/\} finally \{\n {6}try \{ if \(hccPostDue\)[^\n]*\n {6}finally \{\n {8}_traveling = false;/.test(w), 'and it falls in a finally');
});
