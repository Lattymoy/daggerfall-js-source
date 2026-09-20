// DFUSAVE2 (2026-09-20) - the Daggerfall Unity import core
// (systems/dfuSaveImport.js): a DFU save, opened by the reader, becomes
// the port's own SAVE_VERSION envelope and restorePlayer takes it. The
// fixtures are DFU-shaped by test/dfuSaveFixture.mjs (the C# field
// lists a second time, independently of the converter); the quest and
// talk halves are ROUND-TRIPPED - the port's own machine and mill save,
// shaped as DFU prints, imported, and compared to what they saved - so
// every shape the restore reads is proven. The enum tables and the
// effect-key table are REGENERATED from the reference clone (PY1's
// DFU_PATH). The producers' shapes (a disease, an infection, a curse,
// a drain, a poison, an item) are pinned against the port's own mints.
// NOT SEEN AGAINST A REAL SAVE - see dfusave.test.js's corpus gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDfuSave, parseFsJson, unwrapFs } from '../src/formats/dfuSave.js';
import * as E from '../src/formats/dfuEnums.js';
import {
  dfuSaveToSnapshot, dfuDateToSeconds, dfuSecondsToClassicMinutes, dfuSecondsToClassicSeconds, flagIndex, typeShortName,
  dfuGender, dfuCareerToRecord, dfuCareerIndex, dfuStats, dfuSkills, statModsMap, dfuItem, dfuSpell, dfuEffectSettings,
  dfuActiveEffects, dfuWorldBag, dfuAnchor, dfuWeather, dfuTransport, dfuMembershipBook, dfuRegionData, dfuBank,
  dfuFaces, dfuDiscovery, dfuFactionRep, dfuTalk, dfuQuest, dfuQuestEnvelope, dfuToken,
} from '../src/systems/dfuSaveImport.js';
import {
  v1, nameOf, dfuDate, classicSecondsToDate, classicMinutesToSeconds, pairs, shapeItem, shapeQuestMachine, shapeTalk, dfCareer, buildDfuSaveFiles, typeName,
} from './dfuSaveFixture.mjs';
import { dfuFile, missingDfu, DFU_ROOT } from './dfuRoot.mjs';
import { restorePlayer, SAVE_VERSION, snapshotFactionRep } from '../src/systems/save.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { classicItemFromRecord } from '../src/systems/classicSave.js';
import { startDisease, DISEASES } from '../src/systems/diseases.js';
import { createInfection, INFECTION, VAMPIRE_CLANS, LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { createLycanthropyCurse } from '../src/systems/lycanthropy.js';
import { startPoison, POISONS } from '../src/systems/poisons.js';
import { restoreRegionConditions, snapshotRegionConditions } from '../src/systems/regionConditions.js';
import { restoreDiscovery, snapshotDiscovery } from '../src/systems/discovery.js';
import { RumorMill } from '../src/systems/rumorMill.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { CLASSIC_EPOCH_IN_SECONDS } from '../src/systems/gameDate.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { STAT_KEYS_ORDER } from '../src/systems/statMods.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { WEATHER_TYPES } from '../src/world/weather.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { templeOf, orderOf } from '../src/systems/guildVariants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A fixture through the reader: files -> DfuSave. */
const open = (over = {}) => readDfuSave(0, buildDfuSaveFiles(over));

// ------------------------------------------------------------ small laws

test('DFUSAVE2: the clock - DaggerfallDateTime.ToSeconds over the six fields, the classic minute counter, the port\'s classic seconds', () => {
  const dt = { Year: 405, Month: 4, Day: 3, Hour: 13, Minute: 30, Second: 7.9 };
  const s = dfuDateToSeconds(dt);
  assert.equal(s, 31104000 * 405 + 2592000 * 4 + 86400 * 3 + 3600 * 13 + 60 * 30 + 7, 'Month and Day zero-based, Second truncated');
  assert.deepEqual(dfuDate(s), { ...dt, Second: 7 }, 'FromSeconds is the inverse');
  assert.equal(dfuSecondsToClassicMinutes(CLASSIC_EPOCH_IN_SECONDS + 523530 * 60 + 59), 523530, 'ToClassicDaggerfallTime floors to the minute');
  assert.equal(dfuSecondsToClassicSeconds(CLASSIC_EPOCH_IN_SECONDS + 100), 100);
  assert.equal(dfuSecondsToClassicMinutes('12597427800'), (12597427800 - CLASSIC_EPOCH_IN_SECONDS) / 60, 'a decimal string (past the reader\'s big-int door) reads as a number');
  assert.equal(dfuDateToSeconds(null), 0);
});

test('DFUSAVE2: a [Flags] bit to the port\'s index, a System.Type to its class name, an enum name to the port\'s own words', () => {
  assert.equal(flagIndex('CasterOnly', E.DFU_TARGET_TYPES), 0);
  assert.equal(flagIndex('AreaAtRange', E.DFU_TARGET_TYPES), 4);
  assert.equal(flagIndex('Cold', E.DFU_ELEMENT_TYPES), 1);
  assert.equal(flagIndex(16, E.DFU_ELEMENT_TYPES), 4);
  assert.equal(flagIndex('None', E.DFU_ELEMENT_TYPES), 0);
  assert.equal(typeShortName('DaggerfallWorkshop.Game.Questing.Person, Assembly-CSharp, Version=0.0.0.0'), 'Person');
  assert.equal(typeShortName('DaggerfallWorkshop.Game.Questing.Actions.WhenTask, Assembly-CSharp'), 'WhenTask');
  assert.equal(typeShortName('Outer+Nested, X'), 'Nested');
  assert.equal(typeShortName(null), null);
  assert.equal(dfuGender('Female'), 'female'); assert.equal(dfuGender('Male'), 'male'); assert.equal(dfuGender(1), 'female');
  assert.equal(dfuWeather('Fog'), 'fog'); assert.equal(dfuWeather('Snow_Normal'), 'snow'); assert.equal(dfuWeather(undefined), WEATHER_TYPES[0]);
  assert.equal(dfuTransport('Horse'), 'Horse'); assert.equal(dfuTransport(3), 'Ship'); assert.equal(dfuTransport(undefined), 'Foot');
  assert.equal(dfuCareerIndex('Healer'), 4); assert.equal(dfuCareerIndex('My Custom Class'), -1);
  assert.deepEqual(dfuToken({ formatting: 'TextHighlight', text: 'a' }), { formatting: 'highlight', text: 'a', x: 0, y: 0 });
  assert.deepEqual(dfuToken({ formatting: 'NewLine', text: '', x: 1, y: 2 }), { formatting: 'newline', text: '', x: 1, y: 2 });
  assert.equal(dfuToken({ formatting: 'FontPrefix', text: '' }).formatting, 'fontprefix', 'a name the port has no word for rides lower-cased');
});

test('DFUSAVE2: DFCareer back into the raw CLASS*.CFG record - DFCareer.cs:557-631\'s exact inverse, every bit where the decode reads it', () => {
  const rec = dfuCareerToRecord(dfCareer());
  // tolerance bytes over EffectFlags {Paralysis 1, Magic 2, Poison 4, Fire 8, Frost 16, Shock 32, Disease 64}
  assert.equal(rec.resistanceFlags, 2 | 64, 'Magic + Disease resistant');
  assert.equal(rec.immunityFlags, 4, 'Poison immune');
  assert.equal(rec.lowToleranceFlags, 8, 'Fire low tolerance');
  assert.equal(rec.criticalWeaknessFlags, 16, 'Frost critical weakness');
  // ability/spell-point bitfield: abilities in the low byte (:739), magery at 6-7 / 8-9 (:619-620), multiplier at 10-12 (:782)
  const expectAbility = 2 /* Athleticism */ | 8 /* NoRegen */ | 32 /* HolyDamage */;
  assert.equal(rec.abilityFlagsAndSpellPointsBitfield & 0xff, expectAbility);
  assert.equal((rec.abilityFlagsAndSpellPointsBitfield & 0x300) >> 8, 2, 'DarknessPoweredMagery ReducedPowerInLight');
  assert.equal((rec.abilityFlagsAndSpellPointsBitfield & 0xc0) >> 6, 0, 'LightPoweredMagery Normal');
  assert.equal((rec.abilityFlagsAndSpellPointsBitfield & 0x1c00) >> 8, 12, 'Times_1_50');
  assert.equal(rec.attackModifierFlags, 0x01 | 0x40, 'Undead bonus, Humanoid phobia (:824-844)');
  assert.equal(rec.forbiddenMaterialsFlags, 1 | 512, 'Iron, Daedric');
  assert.equal((rec.weaponArmorShieldsBitfield >> 9) & 0x0f, 8, 'TowerShield (:604)');
  assert.equal((rec.weaponArmorShieldsBitfield >> 6) & 0x07, 4, 'Plate (:605)');
  assert.equal(rec.weaponArmorShieldsBitfield & 0x3f, 4, 'HandToHand forbidden (:606)');
  assert.equal((rec.weaponArmorShieldsBitfield >> 16) & 0x3f, 2 | 32, 'LongBlades + MissileWeapons expert (:607)');
  assert.equal(rec.rapidHealing, 4); assert.equal(rec.regeneration, 4); assert.equal(rec.spellAbsorptionFlags, 2);
  assert.deepEqual(rec.primarySkills, [29, 31, 32]); assert.deepEqual(rec.majorSkills, [33, 28, 34]); assert.deepEqual(rec.minorSkills, [20, 3, 21, 18, 17, 0]);
  assert.equal(rec.hitPointsPerLevel, 20); assert.equal(rec.advancementMultiplier, 1.5); assert.equal(rec.advancementMultiplierRaw, 1.5 * 65536);
  assert.deepEqual([rec.strength, rec.intelligence, rec.willpower, rec.agility, rec.endurance, rec.personality, rec.speed, rec.luck], [60, 40, 40, 50, 55, 45, 50, 50]);
  assert.equal(rec.name, 'Warrior'); assert.equal(rec.unknown1, 0);
  // the record's KEY SET is the reader's (formats/classFile.js load)
  const loadKeys = [...rd('src/formats/classFile.js').matchAll(/^\s*c\.(\w+) = /gm)].map((m) => m[1]);
  assert.deepEqual(Object.keys(rec).sort(), [...new Set(loadKeys)].sort(), 'no key the CFG reader does not mint, none missing');
  // integers arriving as names or numbers both read
  assert.equal(dfuCareerToRecord(dfCareer({ Magic: 2, SpellPointMultiplier: 0 })).resistanceFlags, 2 | 64);
  assert.equal((dfuCareerToRecord(dfCareer({ SpellPointMultiplier: 0 })).abilityFlagsAndSpellPointsBitfield & 0x1c00) >> 8, 0, 'Times_3_00');
});

test('DFUSAVE2: stats by the eight names, skills by DFCareer.Skills order, an int[8] of mods to the port\'s map', () => {
  assert.deepEqual(dfuStats({ Strength: 1, Intelligence: 2, Willpower: 3, Agility: 4, Endurance: 5, Personality: 6, Speed: 7, Luck: 8 }),
    { strength: 1, intelligence: 2, willpower: 3, agility: 4, endurance: 5, personality: 6, speed: 7, luck: 8 });
  assert.equal(dfuStats(null).luck, 50, 'DaggerfallStats\' default');
  const sk = dfuSkills({ Medical: 5, CriticalStrike: 99, Archery: 33 });
  assert.equal(sk.length, 35); assert.equal(sk[0], 5); assert.equal(sk[34], 99); assert.equal(sk[33], 33); assert.equal(sk[1], 0);
  assert.deepEqual(statModsMap([0, -3, 0, 0, 0, 0, 5, 0]), { intelligence: -3, speed: 5 });
  assert.deepEqual(statModsMap(null), {});
});

// ---------------------------------------------------------------- items

const weapon = (over = {}) => ({
  uid: 33554501, shortName: 'Broadsword', nativeMaterialValue: 3, dyeColor: 'Unchanged', weightInKg: 4.5, drawOrder: 0,
  value1: 320, value2: ((0x20 | 0x800) << 16) | 0x1234, hits1: 88, hits2: 120, hits3: (3 << 8) | 0x11,
  stackCount: 1, enchantmentPoints: 15, message: 0, legacyMagic: [1, 5, -1, 0], customMagic: null,
  playerTextureArchive: 233, playerTextureRecord: 6, worldTextureArchive: 207, worldTextureRecord: 6,
  itemGroup: 'Weapons', groupIndex: 6, currentVariant: 0, isQuestItem: false, questUID: 0, questItemSymbol: null,
  trappedSoulType: 'None', className: null, poisonType: 'None', potionRecipe: 0,
  repairData: { sceneName: null, timeStarted: 0, repairTime: 0 }, timeForItemToDisappear: 0, timeHealthLeechLastUsed: 0, artifactIndexBitfield: 0,
  ...over,
});

test('DFUSAVE2: ItemData_v1 -> a port item, FromItemData\'s map under the port\'s names, and only fields the port\'s own mints declare', () => {
  const warnings = [];
  const it = dfuItem(weapon(), warnings);
  assert.deepEqual(it, {
    group: 'Weapons', templateIndex: GROUP_TEMPLATE_INDICES.Weapons[6], name: 'Broadsword', material: 3, value: 320, flags: 0x820,
    currentCondition: 88, maxCondition: 120, typeDependentData: 3, enchantmentPoints: 15, message: 0, stackCount: 1, weightInKg: 4.5,
    playerTextureArchive: 233, playerTextureRecord: 6, worldTextureArchive: 207, worldTextureRecord: 6,
    artifact: true, isIdentified: true, enchantments: [{ type: 1, param: 5 }, { type: -1, param: 0 }], magic: true,
  });
  assert.deepEqual(warnings, []);
  for (const k of Object.keys(it)) assert.ok(k in ITEM_FIELDS, `${k} is a declared item field`);
  // the low sixteen of value2 are DFU's `unknown` and the low eight of hits3 its `unknown2` - neither is a port field
  assert.equal(it.flags, (weapon().value2 >>> 16));
  // a quest item, a soul, a poison, a recipe, a repair job, a summoned item's timer, a clothing dye and variant
  const q = dfuItem(weapon({
    itemGroup: 'MensClothing', groupIndex: 2, isQuestItem: true, questUID: 33554600, questItemSymbol: { original: '_item_', name: 'item' },
    trappedSoulType: 28, poisonType: 'Arsenic', potionRecipe: 0, dyeColor: 'Red', currentVariant: 2,
    repairData: { sceneName: 'DaggerfallInterior [MapID=12345, BuildingKey=777]', timeStarted: classicMinutesToSeconds(523000), repairTime: 240 },
    timeForItemToDisappear: 523999, timeHealthLeechLastUsed: 5, legacyMagic: [],
  }), warnings);
  assert.equal(q.questItem, true); assert.equal(q.questUID, 33554600); assert.deepEqual(q.questSymbol, { original: '_item_', name: 'item' }, 'a live Symbol shape - world.js reads questSymbol.name');
  assert.equal(q.trappedSoulType, 28); assert.equal(q.poisonType, POISONS.Arsenic); assert.equal(q.dye, 2); assert.equal(q.variant, 2);
  assert.deepEqual(q.repairData, { buildingKey: 777, timeStarted: 523000, repairTime: 240 });
  assert.equal(q.timeForItemToDisappear, 523999); assert.equal(q.timeHealthLeechLastUsed, 5);
  assert.equal('enchantments' in q, false); assert.equal('magic' in q, false);
  for (const k of Object.keys(q)) assert.ok(k in ITEM_FIELDS, `${k} is a declared item field`);
  // a numbered group and a named soul
  assert.equal(dfuItem(weapon({ itemGroup: 3 }), warnings).group, 'Weapons');
  const named = dfuItem(weapon({ trappedSoulType: 'Vampire' }), warnings);
  assert.equal('trappedSoulType' in named, false); assert.match(warnings.at(-1), /trapped soul "Vampire"/);
  // the drops: an unknown group, a groupIndex off the table, custom enchantments
  assert.equal(dfuItem(weapon({ itemGroup: 'MagicItems', groupIndex: 0 }), warnings), null); assert.match(warnings.at(-1), /has no template/);
  assert.equal(dfuItem(weapon({ itemGroup: 'Nope' }), warnings), null); assert.match(warnings.at(-1), /unknown group/);
  const cm = dfuItem(weapon({ customMagic: [{ EffectKey: 'CastWhenUsed', CustomParam: '1' }] }), warnings);
  assert.ok(cm && !cm.customEnchantments); assert.match(warnings.at(-1), /custom enchantment/);
});

test('DFUSAVE2: the item map agrees with the classic importer on the same record - one law, two doors', () => {
  // classicItemFromRecord reads the classic record; FromItemData is
  // that record under DFU's names. Feed both the same weapon.
  const classic = classicItemFromRecord({ parsedData: {
    group: 3, index: 6, name: 'Broadsword', material: 3, value: 320, flags: 0x820, currentCondition: 88, maxCondition: 120,
    typeDependentData: 3, enchantmentPoints: 15, message: 0, image1: (233 << 7) | 6, image2: (207 << 7) | 6, color: 0,
    magic: [{ type: 1, param: 5 }, { type: -1, param: 0 }],
  } });
  const dfu = dfuItem(weapon());
  for (const k of ['group', 'templateIndex', 'name', 'material', 'value', 'flags', 'currentCondition', 'maxCondition', 'typeDependentData',
    'enchantmentPoints', 'message', 'artifact', 'isIdentified', 'playerTextureArchive', 'playerTextureRecord', 'worldTextureArchive', 'worldTextureRecord', 'stackCount', 'enchantments']) {
    assert.deepEqual(dfu[k], classic[k], k);
  }
});

// --------------------------------------------------------------- spells

test('DFUSAVE2: the spellbook - a stock index rides as the index, a made spell comes back as the classic record through the effects\' own ClassicKey table', () => {
  const warnings = [];
  let n = -1;
  const next = () => n--;
  assert.equal(dfuSpell({ StandardSpellIndex: 12, Name: 'Fireball' }, next, warnings), 12);
  const made = dfuSpell({
    Version: 1, BundleType: 'Spell', TargetType: 'AreaAtRange', ElementType: 'Fire', Name: 'My Blast', IconIndex: 3, Icon: { key: '', index: 0 },
    Effects: [
      { Key: 'Damage-Health', Settings: { DurationBase: 0, DurationPlus: 0, DurationPerLevel: 0, ChanceBase: 0, ChancePlus: 0, ChancePerLevel: 0, MagnitudeBaseMin: 5, MagnitudeBaseMax: 10, MagnitudePlusMin: 1, MagnitudePlusMax: 2, MagnitudePerLevel: 1 }, EnchantmentParam: null },
      { Key: 'Paralyze', Settings: { DurationBase: 3, DurationPlus: 1, DurationPerLevel: 2, ChanceBase: 50, ChancePlus: 5, ChancePerLevel: 1, MagnitudeBaseMin: 0, MagnitudeBaseMax: 0, MagnitudePlusMin: 0, MagnitudePlusMax: 0, MagnitudePerLevel: 0 } },
      { Key: 'MageLight-Inferno', Settings: {} },
    ],
    StandardSpellIndex: null,
  }, next, warnings);
  assert.deepEqual(made.effects[0], { type: 4, subType: 0, durationBase: 0, durationMod: 0, durationPerLevel: 0, chanceBase: 0, chanceMod: 0, chancePerLevel: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 10, magnitudeLevelBase: 1, magnitudeLevelHigh: 2, magnitudePerLevel: 1 });
  assert.equal(made.effects[1].type, 0); assert.equal(made.effects[1].subType, -1, 'subgroup 255 is the port\'s -1');
  assert.equal(made.effects[1].durationMod, 1, 'DurationPlus -> durationMod');
  assert.equal(made.effects[2].type, -1, 'the slot the unknown key left is EMPTY, not missing');
  assert.equal(made.element, 0); assert.equal(made.rangeType, 4); assert.equal(made.name, 'My Blast'); assert.equal(made.icon, 3, 'Icon.index 0 with no key -> the legacy iconIndex');
  assert.equal(made.index, -1); assert.equal(made.custom, true); assert.equal(made.cost, 0);
  assert.match(warnings[0], /MageLight-Inferno.*no classic key/);
  assert.equal(dfuSpell({ Name: 'Nothing', Effects: [{ Key: 'Poison-Arsenic' }] }, next, warnings), null);
  assert.equal(n, -2, 'a dropped spell takes no index');
  assert.deepEqual(Object.keys(dfuEffectSettings({ MagnitudeBaseMin: 1 })).length, 11);
});

// ------------------------------------------------------------- effects

test('DFUSAVE2: the effects that outlive a load - each in the exact shape the port\'s own producer mints, a timed spell counted and dropped', () => {
  const warnings = [];
  const out = dfuActiveEffects([
    { bundleType: 'Disease', liveEffects: [{ key: 'Disease-Plague', statMods: [0, 0, -2, 0, 0, 0, 0, 0], effectSpecific: { forcedRoundsRemaining: 1, incubationOver: true, lastDay: 3400, daysOfSymptomsLeft: 4 } }] },
    { bundleType: 'Disease', liveEffects: [{ key: 'Vampirism-Infection', statMods: null, effectSpecific: { incubationOver: false, lastDay: 1, daysOfSymptomsLeft: 255, customDiseaseData: { $type: 'X', warningDreamVideoPlayed: true, fakeDeathVideoPlayed: false, startingDay: 3390, infectionRegionIndex: 17 } } }] },
    { bundleType: 'None', liveEffects: [{ key: 'Vampirism-Curse', statMods: [0, 0, 0, 0, 0, 0, 0, 0], effectSpecific: { compoundRace: {}, vampireClan: 'Montalion', lastTimeFed: 523400, hasStartedInitialVampireQuest: true } }] },
    { bundleType: 'None', liveEffects: [{ key: 'Lycanthropy-Curse', statMods: null, effectSpecific: { compoundRace: {}, infectionType: 'Wereboar', lastKilledInnocent: 5, lastCastMorphSelf: 6, wearingHircineRing: true, isTransformed: true } }] },
    { bundleType: 'Spell', liveEffects: [{ key: 'Drain-Speed', statMods: [0, 0, 0, 0, 0, 0, -7, 0], effectSpecific: { magnitude: 7, drainStat: 'Speed', forcedRoundsRemaining: 1 } }] },
    { bundleType: 'Poison', liveEffects: [{ key: 'Poison-Magebane', statMods: null, effectSpecific: { lastMinute: 523500, minutesToStart: 2, minutesRemaining: 9, currentState: 'Active', forcedRoundsRemaining: 1, positiveStatsRemoved: true } }] },
    { bundleType: 'Spell', liveEffects: [{ key: 'Shield', effectSpecific: { startingShield: 20, shieldRemaining: 12 } }, { key: 'Fortify-Luck', effectSpecific: { fortifyStat: 'Luck' } }] },
  ], warnings);
  assert.equal(out.length, 6);
  assert.deepEqual(out[0], { kind: 'disease', disease: DISEASES.Plague, permanent: true, incubationOver: true, lastDay: 3400, daysOfSymptomsLeft: 4, statMods: { willpower: -2 } });
  assert.deepEqual(out[1], { ...createInfection(INFECTION.Vampirism, { day: 3390, regionIndex: 17 }), dreamPlayed: true, deployed: false });
  assert.equal(out[2].clan, VAMPIRE_CLANS.Montalion); assert.equal(out[2].lastTimeFed, 523400); assert.equal(out[2].hasStartedInitialVampireQuest, true);
  assert.equal(out[3].infectionType, LYCANTHROPY_TYPES.Wereboar); assert.equal(out[3].isTransformed, true); assert.equal(out[3].wearingHircineRing, true);
  assert.deepEqual(out[4], { kind: 'drainAttribute', stat: 'speed', magnitude: 7, permanent: true });
  assert.deepEqual(out[5], { kind: 'poison', poison: POISONS.Magebane, permanent: true, state: 'active', minutesToStart: 2, minutesRemaining: 9, lastMinute: 523500, statMods: {}, positiveStatsRemoved: true });
  assert.deepEqual(warnings, ['2 timed or item-bound effect(s) in flight were not carried']);

  // THE SHAPE THE PRODUCER MINTS: key sets against the real producers.
  const keysOf = (o) => Object.keys(o).sort();
  const sick = { stats: {}, activeEffects: [], isPlayer: true, level: 5 };
  assert.ok(startDisease(sick, DISEASES.Plague, 3400, () => 0), 'the producer minted');
  assert.deepEqual(keysOf(out[0]), keysOf(sick.activeEffects[0]), 'a disease');
  const vamp = { activeEffects: [], spells: [], stats: {} };
  createVampirismCurse(vamp, VAMPIRE_CLANS.Montalion, { now: 1 });
  assert.deepEqual(keysOf(out[2]), keysOf(vamp.activeEffects.find((a) => a.kind === 'racialOverride')), 'the vampire curse');
  const wolf = { activeEffects: [], spells: [], stats: {} };
  createLycanthropyCurse(wolf, LYCANTHROPY_TYPES.Wereboar, { now: 1, rolls: () => 0 });
  assert.deepEqual(keysOf(out[3]), keysOf(wolf.activeEffects.find((a) => a.kind === 'racialOverride')), 'the lycanthropy curse');
  const poisoned = { stats: {}, activeEffects: [] };
  startPoison(poisoned, POISONS.Magebane, 523500, () => 0);
  assert.deepEqual(keysOf(out[5]), keysOf(poisoned.activeEffects[0]), 'a poison');
  assert.match(rd('src/systems/effects.js'), /entry = \{ kind, stat, magnitude: 0, permanent: true \};/, 'a permanent drain (effects.js pushPermanent\'s entry)');
  assert.deepEqual(dfuActiveEffects(null, []), []);
});

// ------------------------------------------------------- the world half

test('DFUSAVE2: where the player stands - worldPosX/Z are PlayerGPS world units, the pixel is WorldCoordToMapPixel, the height is compensation-free; the anchor rides makeAnchor\'s record', () => {
  const p = { position: { x: 1, y: 5.5, z: 2 }, worldCompensation: { x: 0, y: 1.5, z: 0 }, worldPosX: 4000 * 32768 + 100, worldPosZ: (499 - 250) * 32768 + 7 };
  assert.deepEqual(dfuWorldBag(p), { pixel: { x: 4000, y: 250 }, nativeX: 4000 * 32768 + 100, nativeZ: (499 - 250) * 32768 + 7, y: 4, piles: [], droppedTorches: [], foes: [], guards: [] });
  const a = dfuAnchor({ ...p, worldContext: 'Exterior', yaw: 10, pitch: -2 });
  assert.equal(a.worldContext, 'Exterior'); assert.deepEqual(a.pixel, { x: 4000, y: 250 }); assert.equal(a.nativeX, p.worldPosX); assert.equal(a.y, 4); assert.equal(a.yaw, 10); assert.equal(a.local, null);
  const d = dfuAnchor({ ...p, worldContext: 'Dungeon' });
  assert.equal(d.worldContext, 'Dungeon'); assert.deepEqual(d.local, [1, 5.5, 2]); assert.equal(d.insideDungeon, true);
  assert.equal(dfuAnchor(null), null); assert.equal(dfuAnchor({ worldPosX: 0, worldPosZ: 0 }), null, 'a never-set anchor is null');
});

// ------------------------------------------------- guilds, regions, bank

test('DFUSAVE2: guild memberships by group with the temple and the order named from `variant`; region data into the three stores; the sparse bank scattered by region', () => {
  const warnings = [];
  const book = dfuMembershipBook(pairs([
    [GUILD_GROUPS.FightersGuild, { rank: 3, lastRankChange: 700, variant: 0, flags: 0 }],
    [GUILD_GROUPS.HolyOrder, { rank: 1, lastRankChange: 701, variant: 21, flags: 0 }],   // Arkay, not the first divine
    [GUILD_GROUPS.KnightlyOrder, { rank: 2, lastRankChange: 702, variant: 368, flags: 4 | 8 }],
    [GUILD_GROUPS.GeneralPopulace, { rank: 0, lastRankChange: 703, variant: 0, flags: 0 }],
    [GUILD_GROUPS.Necromancers, { rank: 1, lastRankChange: 704, variant: 0, flags: 0 }],
  ]), warnings);
  assert.deepEqual(book[GUILD_GROUPS.FightersGuild], { guild: 'FightersGuild', rank: 3, lastRankChange: 700 });
  assert.deepEqual(book[GUILD_GROUPS.HolyOrder], { guild: templeOf('Arkay').name, rank: 1, lastRankChange: 701 });
  assert.notEqual(templeOf('Arkay').name, templeOf('Akatosh').name);
  assert.deepEqual(book[GUILD_GROUPS.KnightlyOrder], { guild: orderOf('Dragon').name, rank: 2, lastRankChange: 702, flags: 12 });
  assert.equal(book[GUILD_GROUPS.GeneralPopulace].guild, 'ThievesGuild');
  assert.equal(GUILD_GROUPS.Necromancers in book, false); assert.match(warnings[0], /group 14/);
  assert.deepEqual(dfuMembershipBook({ 11: { rank: 1, lastRankChange: 1 } }), { 11: { guild: 'FightersGuild', rank: 1, lastRankChange: 1 } }, 'an object-shaped dictionary too');

  const rec = { Values: Array.from({ length: 29 }, (_, i) => i), Flags: Array.from({ length: 29 }, (_, i) => i % 2 === 0), Flags2: Array.from({ length: 14 }, (_, i) => i === 3), LegalRep: -12, PrecipitationOverride: 2, SeverePunishmentFlags: 1, IDOfPersecutedTemple: 26, PriceAdjustment: 1050 };
  const rows = new Array(62).fill(null); rows[5] = rec; rows[7] = { ...rec, LegalRep: 0 };
  const { regionConditions, legalRep, regionPrices } = dfuRegionData(rows);
  assert.equal(regionConditions.length, 62);
  assert.deepEqual(regionConditions[5], { v: rec.Values, f: '10101010101010101010101010101', g: '00010000000000', p: 2, s: 1, t: 26 });
  assert.deepEqual(regionConditions[0], { v: new Array(29).fill(0), f: '0'.repeat(29), g: '0'.repeat(14), p: 0, s: 0, t: 0 });
  assert.deepEqual(legalRep, { 5: -12 }, 'only the non-zero rows, the classic importer\'s law');
  assert.deepEqual(regionPrices, { 5: 1050, 7: 1050 });
  // the rows ARE the port's snapshot shape: restore, snapshot, equal
  assert.deepEqual(snapshotRegionConditions(restoreRegionConditions(regionConditions)), regionConditions);

  const bank = dfuBank([{ accountGold: 500, loanTotal: 100, loanDueDate: 523999, regionIndex: 17, hasDefaulted: false }, { accountGold: 1, regionIndex: 99 }], { shipType: 1, houses: [{ location: 'Daggerfall', mapID: 12345, buildingKey: 777, regionIndex: 17 }] });
  assert.equal(bank.bankAccounts.length, 62);
  assert.deepEqual(bank.bankAccounts[17], { regionIndex: 17, accountGold: 500, loanTotal: 100, loanDueDate: 523999, hasDefaulted: false });
  assert.deepEqual(bank.bankAccounts[3], { regionIndex: 3, accountGold: 0, loanTotal: 0, loanDueDate: 0, hasDefaulted: false });
  assert.deepEqual(bank.houses[17], { regionIndex: 17, location: 'Daggerfall', mapId: 12345, buildingKey: 777 });
  assert.equal(bank.ownedShip, 1);
  assert.equal(dfuBank(null, null).ownedShip, -1);
});

// ------------------------------------------------------- the other files

test('DFUSAVE2: escort faces, discovery (round-tripped through the port\'s store), faction rep (the columnar snapshot)', () => {
  assert.deepEqual(dfuFaces([{ questUID: 5, targetPerson: { original: '_p_', name: 'p' }, targetFoe: null, targetRace: 'Redguard', gender: 'Female', isChild: false, faceIndex: 4, factionFaceIndex: -1 }]),
    [{ questUID: 5, targetPerson: '_p_', targetFoe: null, targetRace: 2, gender: 1, isChild: false, faceIndex: 4, factionFaceIndex: -1 }]);
  const disc = dfuDiscovery(pairs([[1234, {
    mapID: 0x12345678, mapPixelID: 1234, regionName: 'Daggerfall', locationName: 'Daggerfall',
    discoveredBuildings: pairs([[777, { buildingKey: 777, displayName: 'The Odd Blades', oldDisplayName: null, isOverrideName: false, factionID: 41, quality: 12, buildingType: 'WeaponSmith', lastLockpickAttempt: 0, customUserDisplayName: null }]]),
  }], [99, { mapID: 7, mapPixelID: 99, regionName: 'Wayrest', locationName: 'Wayrest', discoveredBuildings: {} }]]));
  assert.deepEqual(disc.locations, { [0x12345678 & 0xfffff]: { regionName: 'Daggerfall', locationName: 'Daggerfall' }, 7: { regionName: 'Wayrest', locationName: 'Wayrest' } });
  assert.deepEqual(disc.buildings, { 'Daggerfall:Daggerfall': { 777: { buildingKey: 777, displayName: 'The Odd Blades', factionId: 41, quality: 12, buildingType: 13, lastLockpickAttempt: 0, customUserDisplayName: '', isOverrideName: false, oldDisplayName: null } } });
  restoreDiscovery(disc);
  assert.deepEqual(snapshotDiscovery(), disc, 'the port\'s store takes it and hands it back unchanged');
  restoreDiscovery(null);
  const rep = dfuFactionRep({ factionDict: pairs([[42, { id: 42, rep: -5, flags: 1, power: 30, ally1: 1, ally2: 2, ally3: 3, enemy1: 4, enemy2: 5, enemy3: 6, ruler: 7, rulerPowerBonus: 8, rulerNameSeed: 9 }], [41, { id: 41, rep: 10, flags: 0, power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ruler: 0, rulerPowerBonus: 0, rulerNameSeed: 0 }]]) });
  assert.deepEqual(rep.ids, [41, 42]); assert.deepEqual(rep.rep, [10, -5]); assert.deepEqual(rep.ally3, [0, 3]); assert.deepEqual(rep.rulerNameSeed, [0, 9]);
  const store = { dict: new Map([[41, { rep: 0, flags: 0, power: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ruler: 0, rulerPowerBonus: 0, rulerNameSeed: 0 }]]) };
  assert.deepEqual(Object.keys(snapshotFactionRep(store)).sort(), Object.keys(rep).sort(), 'the port\'s own columns, no more');
  assert.equal(dfuFactionRep(null), null);
});

test('DFUSAVE2: the talk halves round-trip - the mill\'s own save, shaped as DFU prints, imported, is the mill\'s save again', () => {
  const mill = new RumorMill({});
  mill.listRumorMill.push({ rumorType: 2, listRumorVariants: [[{ formatting: 'text', text: 'A rumor.', x: 0, y: 0 }]], questID: 5, timeLimit: 600, faction1: 1, faction2: 2, regionID: 17, flags: 0, type: 3, textID: 1001 });
  mill.dictQuestorPostQuestMessage.set(5, [{ formatting: 'text', text: 'Thanks.', x: 0, y: 0 }, { formatting: 'newline', text: '', x: 0, y: 0 }]);
  const portTalk = {
    ...mill.getSaveData(),
    dictQuestInfo: [{ questID: 5, resourceInfo: [{ name: 'foe', resourceType: 3, anyInfoAnswers: [[{ formatting: 'text', text: 'x', x: 0, y: 0 }]], rumorsAnswers: [], availableForDialog: true, hasEntryInTellMeAbout: true, hasEntryInWhereIs: false, questPlaceResourceHintTypeReceived: 1, dialogLinkedLocations: ['a'], dialogLinkedPersons: [], dialogLinkedThings: ['t'] }] }],
    npcsWithWork: [[12, { npc: { hash: 1, flags: 2, factionID: 3, nameSeed: 12, gender: 1, race: 2, context: 2, mapID: 5, locationID: 6, buildingKey: 7, nameBank: 1, billboardArchiveIndex: 182, billboardRecordIndex: 3 }, socialGroup: 1, buildingName: 'The Bank' }]],
    castleNPCsSpokenTo: [[9, true]],
  };
  const shaped = unwrapFs(parseFsJson(JSON.stringify(shapeTalk(portTalk))));
  assert.deepEqual(dfuTalk(shaped), portTalk);
  const back = new RumorMill({});
  back.restoreSaveData(dfuTalk(shaped));
  assert.deepEqual(back.getSaveData(), mill.getSaveData());
  assert.equal(dfuTalk(null), null);
  // an OBJECT-shaped dictionary (a string-keyed print) still hands the port NUMBER keys
  const obj = dfuTalk({ dictQuestInfo: { 5: { resourceInfo: {} } }, npcsWithWork: { 12: { npc: null, socialGroup: 'Merchants', buildingName: 'B' } }, castleNPCsSpokenTo: { 9: true } });
  assert.strictEqual(obj.dictQuestInfo[0].questID, 5); assert.strictEqual(obj.npcsWithWork[0][0], 12); assert.strictEqual(obj.castleNPCsSpokenTo[0][0], 9);
});

test('DFUSAVE2: the quest machine round-trips - a real quest parsed by the port, saved, shaped as DFU prints, imported, restored on a fresh machine', () => {
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f)).replace(/^﻿/, '');
  }
  loadQuestTables(sources);
  const m = new QuestMachine({ nowSeconds: () => 523530 * 60 });
  const lines = rd('vendor/dfu-quests/Quests/B0B40Y09.txt').replace(/^﻿/, '').split(/\r?\n/);
  const q = m.scheduleQuest(lines, 0, { rolls: () => 0.25 });
  m.quests.set(q.uid, q);
  const saved = m.getSaveData();
  assert.deepEqual([...new Set(saved.quests[0].resources.map((r) => r.type))].sort(), ['Clock', 'Foe', 'Item', 'Person', 'Place'], 'the quest carries every resource type');
  const shaped = unwrapFs(parseFsJson(JSON.stringify(shapeQuestMachine(saved))));
  const env = dfuQuestEnvelope(shaped, [{ index: 3, name: 'X', value: true }], { notebookEntries: [['a', 'b']], finishedQuestEntries: [] }, ['M0B00Y00']);
  // What the port writes as null where C# has a value type: an unplaced
  // Person's nameBank (C# prints its zero, Breton), a Foe's null queues
  // (an empty list on the way back). Restore-equivalent, not byte-equal.
  // An ItemData_v1 carries EVERY field, so a port item that came through
  // one carries the zeros the mint left out - the same item to the
  // restore, with more columns written down.
  const asDfuItem = (it) => (it ? {
    group: it.group, templateIndex: it.templateIndex, name: it.name ?? '', material: it.material ?? 0, value: it.value ?? 0, flags: it.flags ?? 0,
    currentCondition: it.currentCondition ?? 0, maxCondition: it.maxCondition ?? 0, typeDependentData: it.typeDependentData ?? 0,
    enchantmentPoints: it.enchantmentPoints ?? 0, message: it.message ?? 0, stackCount: it.stackCount ?? 1, weightInKg: it.weightInKg ?? 0,
    playerTextureArchive: it.playerTextureArchive ?? 0, playerTextureRecord: it.playerTextureRecord ?? 0, worldTextureArchive: it.worldTextureArchive ?? 0, worldTextureRecord: it.worldTextureRecord ?? 0,
    artifact: !!it.artifact, isIdentified: !!it.isIdentified,
    ...(it.group === 'MensClothing' || it.group === 'WomensClothing' ? { dye: it.dye ?? 18, variant: it.variant ?? 0 } : it.variant ? { variant: it.variant } : {}),
    ...(it.artifactIndexBitfield ? { artifactIndexBitfield: it.artifactIndexBitfield } : {}),
    ...(it.enchantments?.length ? { enchantments: it.enchantments, magic: true } : {}),
    ...(it.questItem ? { questItem: true, questUID: it.questUID, questSymbol: { original: it.questSymbol.original, name: it.questSymbol.name } } : {}),
  } : null);
  const expected = structuredClone(saved.quests);
  for (const q of expected) {
    for (const r of q.resources) {
      const sp = r.resourceSpecific ?? {};
      if (r.type === 'Person' && sp.nameBank == null) sp.nameBank = 0;
      if (r.type === 'Foe') { sp.spellQueue ??= []; sp.itemQueue = (sp.itemQueue ?? []).map(asDfuItem); }
      if (r.type === 'Item') sp.item = asDfuItem(sp.item);
    }
  }
  assert.deepEqual(env.machine.quests, expected, 'every quest field, resource and task back as the port saved it');
  assert.deepEqual(env.machine.siteLinks, saved.siteLinks);
  assert.deepEqual(env.machine.globalVars, [[3, true]]);
  assert.deepEqual(env.notebook, { notebookEntries: [['a', 'b']], finishedQuestEntries: [] });
  assert.deepEqual(env.oneTimeQuestsAccepted, ['M0B00Y00']);
  const m2 = new QuestMachine({ nowSeconds: () => 523530 * 60 });
  m2.restoreSaveData(env.machine);
  assert.equal(m2.quests.size, 1, 'the fresh machine took the quest');
  assert.deepEqual(m2.getSaveData().quests, expected, 'and saves it identically');
  // the three mechanical differences, on their own
  const one = dfuQuest({ uid: 7, questName: 'Q', questStartTime: classicSecondsToDate(120), questTombstoned: false, questTombstoneTime: null, smallerDungeonsState: 'Enabled', resources: [{ type: typeName('Clock'), symbol: { original: '_c_', name: 'c' }, resourceSpecific: { lastWorldTimeSample: classicSecondsToDate(90), startingTimeInSeconds: 30, remainingTimeInSeconds: 10, flag: 0, minRange: 0, maxRange: 0, clockEnabled: true, clockFinished: false } }], questors: pairs([['bob', { symbol: { original: '_b_', name: 'b' }, name: 'Bob' }]]), tasks: [{ symbol: { original: '_t_', name: 't' }, type: 'PersistUntil', actions: [{ type: typeName('WhenTask', 'DaggerfallWorkshop.Game.Questing.Actions'), actionSpecific: { a: 1 } }] }] });
  assert.equal(one.questStartTime, 120); assert.equal(one.questTombstoneTime, 0); assert.equal(one.smallerDungeonsState, 2); assert.equal(one.displayName, null);
  assert.equal(one.resources[0].type, 'Clock'); assert.equal(one.resources[0].resourceSpecific.lastWorldTimeSample, 90);
  assert.deepEqual(one.questors, [{ name: 'bob', symbol: { original: '_b_' }, displayName: 'Bob' }]);
  assert.equal(one.tasks[0].type, 'persistUntil'); assert.equal(one.tasks[0].actions[0].type, 'WhenTask'); assert.deepEqual(one.tasks[0].actions[0].actionSpecific, { a: 1 });
  assert.equal(one.tasks[0].globalVarLink, -1);
});

// ------------------------------------------------------- the whole save

test('DFUSAVE2: the whole save -> the envelope: every ENTITY_FIELDS key minted, the equip table on the items, the light source by uid, and restorePlayer takes it', () => {
  const sword = weapon({ uid: 501 });
  const torch = weapon({ uid: 502, shortName: 'Torch', itemGroup: 'UselessItems2', groupIndex: 0, legacyMagic: [], value2: 0 });
  const equipTable = new Array(27).fill(0); equipTable[EQUIP_SLOTS.RightHand] = 501;
  // the sword SECOND, so a slot written on items[0] is a wrong item
  const save = open({ items: [torch, sword], equipTable, lightSourceUID: 502, spellbook: [{ StandardSpellIndex: 3 }], modInfoData: [{ title: 'Roads', fileName: 'roads.dfmod' }], bio: 'I was born.\nI grew up.\n', anchorPosition: null });
  const out = dfuSaveToSnapshot(save);
  const s = out.snap;
  assert.equal(s.v, SAVE_VERSION);
  const ENTITY_FIELDS = [...rd('src/systems/save.js').match(/const ENTITY_FIELDS = \[([\s\S]*?)\];/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.ok(ENTITY_FIELDS.length > 25);
  for (const k of ENTITY_FIELDS) assert.notEqual(s[k], undefined, `${k} is minted (the restore copies it blind)`);
  assert.equal(s.name, 'Tester'); assert.equal(s.gender, 'female'); assert.equal(s.race, 'Nord'); assert.equal(s.raceId, 3); assert.equal(s.reflexes, 1);
  assert.equal(s.careerIndex, 16, 'Warrior is stock row 16'); assert.equal(s.career.name, 'Warrior');
  assert.equal(s.health, 61); assert.equal(s.maxHealth, 80); assert.equal(s.fatigue, 5000); assert.equal(s.magicka, 33);
  assert.equal(s.lastSkillCheckTime, 523000); assert.equal(s.minMetalToHit, 2); assert.equal(s.crimeCommitted, 2);
  assert.deepEqual(s.skillsRecentlyRaised, [5, 9]); assert.equal(s.skills[34], 44); assert.equal(s.skillUses[2], 6);
  assert.equal(s.goldPieces, 1234); assert.equal(s.items.length, 2);
  assert.equal(s.items[1].equipSlot, EQUIP_SLOTS.RightHand, 'the equip table names the sword by uid');
  assert.equal('equipSlot' in s.items[0], false);
  assert.equal(s.lightSourceIndex, 0, 'the lit torch by uid'); assert.equal(s.items[s.lightSourceIndex].name, 'Torch');
  assert.deepEqual(s.spells, [3]);
  assert.deepEqual(s.sGroupReputations, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(s.previousVampireClan, 153); assert.equal(s.timeToBecomeVampireOrWerebeast, 11); assert.equal(s.lastTimePlayerAteOrDrankAtTavern, 12);
  assert.equal(s.classicMinutes, 523530 + 120); assert.equal(out.classicMinutes, s.classicMinutes);
  assert.deepEqual(s.pose, { yaw: 91.5, pitch: -4.25, crouching: true, weaponDrawn: true, usingRightHand: false, transport: 'Horse' });
  assert.equal(s.weather, 'fog'); assert.equal(s.smallerDungeonsState, 2);
  assert.equal(s.locationKey, 'world'); assert.deepEqual(s.world.pixel, { x: 4000, y: 250 }); assert.equal(s.world.y, 2);
  assert.equal(s.position, null); assert.equal(s.interior, null); assert.equal(s.dungeon, null);
  assert.deepEqual(s.quest.machine.globalVars, [[0, false], [3, true]]); assert.deepEqual(s.quest.oneTimeQuestsAccepted, ['M0B00Y00']); assert.equal(s.quest.notebook, null);
  assert.deepEqual(s.travelMap, { filterDungeons: false, filterTemples: false, filterHomes: false, filterTowns: false, filterRoads: false, filterTracks: false, filterRivers: false, filterStreams: false, sleepInn: true, speedCautious: true, travelShip: true });
  assert.deepEqual(s.sceneCache, { permanentScenes: ['DaggerfallInterior [MapID=1, BuildingKey=2]'], scenes: [] });
  assert.deepEqual(s.backStory, ['I was born.', 'I grew up.']);
  assert.deepEqual(s.guildMemberships, { mortal: {}, vampire: {} });
  assert.equal(s.factionRep, null); assert.equal(s.automap, null); assert.equal(s.talk, null);
  assert.equal(s.ownedShip, -1); assert.equal(s.boardShipPosition, null); assert.equal(s.anchorPosition, null); assert.equal(s.racialOverridePending, null);
  assert.deepEqual(s.pendingFactionRep, []); assert.deepEqual(s.legalRep, {}); assert.deepEqual(s.regionPrices, {});
  assert.equal(out.saveName, 'Quick'); assert.equal(out.characterName, 'Tester'); assert.equal(out.screenshot, null);
  assert.deepEqual(out.warnings, ['mod "Roads" was loaded; its own saved state does not come over']);

  // restorePlayer takes it whole and hands back the thirteen extras
  const entity = {};
  const extras = restorePlayer(entity, structuredClone(s), null);
  assert.ok(extras, 'the version gate passes');
  assert.deepEqual(Object.keys(extras).sort(), ['classicMinutes', 'dungeon', 'escortingFaces', 'interior', 'locationKey', 'pose', 'position', 'quest', 'readiedSpellIndex', 'smallerDungeonsState', 'talk', 'travelMap', 'world']);
  assert.equal(entity.name, 'Tester'); assert.equal(entity.items.length, 2); assert.equal(entity.goldPieces, 1234, 'goldPieces minted, so no Currency migration ran');
  assert.equal(entity.lightSource, entity.items[0], 'the torch relinked');
  assert.deepEqual(entity.guildMemberships, { mortal: {}, vampire: {} });
});

test('DFUSAVE2: the honest halves - inside a dungeon or a building lands outside with a line, at sea disembarks at the ship, the scene\'s enemies are named as not carried', () => {
  const dungeon = dfuSaveToSnapshot(open({ worldContext: 'Dungeon', insideDungeon: true, enemyData: [v1({ loadID: 1 })] }));
  assert.ok(dungeon.warnings.includes('the save was made inside a dungeon: you start outside it'));
  assert.ok(dungeon.warnings.includes('the scene you stood in (its enemies, loot and doors) is not carried'));
  assert.equal(dungeon.snap.locationKey, 'world');
  const building = dfuSaveToSnapshot(open({ worldContext: 'Interior', insideBuilding: true }));
  assert.ok(building.warnings.includes('the save was made inside a building: you start outside it'));
  const sea = dfuSaveToSnapshot(open({ bankDeeds: v1({ shipType: 0, houses: [] }), boardShipPosition: v1({ worldPosX: 4001 * 32768 + 5, worldPosZ: 249 * 32768 + 5, yaw: 3, position: { x: 0, y: 0, z: 0 }, worldCompensation: { x: 0, y: 0, z: 0 } }) }));
  assert.deepEqual(sea.snap.boardShipPosition, { mapPixel: { x: 4001, y: 250 }, pos: null, yaw: 3 });
  assert.ok(sea.warnings.includes('the save was made at sea: you disembark at the ship'));
  assert.equal(sea.snap.ownedShip, 0);
  const noShip = dfuSaveToSnapshot(open({ boardShipPosition: v1({ worldPosX: 5, worldPosZ: 5, yaw: 0 }) }));
  assert.equal(noShip.snap.boardShipPosition, null, 'a boarding memory without a ship is dropped');
  const rooms = dfuSaveToSnapshot(open({ rentedRooms: [{ name: 'The Inn', mapID: 5, buildingKey: 6, allocatedBedIndex: 1, expiryTime: classicMinutesToSeconds(524000) }] }));
  assert.deepEqual(rooms.snap.rentedRooms, [{ name: 'The Inn', mapId: 5, buildingKey: 6, allocatedBedIndex: 1, expiryMinutes: 524000 }]);
  const unknownRace = dfuSaveToSnapshot(open({ raceId: 9 }));
  assert.equal(unknownRace.snap.race, 'Breton'); assert.match(unknownRace.warnings[0], /race id 9/);
  const gap = dfuSaveToSnapshot(open({ equipTable: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 999] }));
  assert.match(gap.warnings[0], /equip slot 12 names an item that is not in the pack/);
});

// ------------------------------------------------------------ the source

/** A C# enum's members from the reference: `Name = value,` or implicit. */
function csEnum(file, name) {
  const cs = readFileSync(dfuFile(file), 'utf8');
  const m = new RegExp(`enum ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(cs);
  assert.ok(m, `${file}: enum ${name}`);
  const out = {};
  let next = 0;
  for (let line of m[1].split('\n')) {
    line = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/\((?:int|byte|ushort|short|uint)\)/g, '').trim();
    if (!line || line.startsWith('[')) continue;
    for (const part of line.split(',')) {
      const mm = /^\s*(\w+)\s*(?:=\s*([^,]+?))?\s*$/.exec(part);
      if (!mm) continue;
      let v;
      if (mm[2] != null) {
        const expr = mm[2].trim();
        if (/^-?0x[0-9a-f]+$/i.test(expr) || /^-?\d+$/.test(expr)) v = Number(expr);
        else if (expr in out) v = out[expr];
        else if (/^[\w\s|]+$/.test(expr) && expr.includes('|')) v = expr.split('|').map((e) => out[e.trim()]).reduce((a, b) => a | b, 0);
        else if (/^\(?\w+\)?\s*[+-]\s*\d+$/.test(expr)) { const [, a, op, b] = /^\(?(\w+)\)?\s*([+-])\s*(\d+)$/.exec(expr); v = op === '+' ? out[a] + Number(b) : out[a] - Number(b); }
        else v = expr;
      } else v = next;
      out[mm[1]] = v;
      if (typeof v === 'number') next = v + 1;
    }
  }
  return out;
}

const TABLES = [
  ['GENDERS', 'Assets/Scripts/Game/Entities/EntityEnums.cs', 'Genders'],
  ['RACES', 'Assets/Scripts/Game/Entities/EntityEnums.cs', 'Races'],
  ['PLAYER_REFLEXES', 'Assets/Scripts/Game/Entities/EntityEnums.cs', 'PlayerReflexes'],
  ['WORLD_CONTEXT', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'WorldContext'],
  ['WEATHER_TYPE', 'Assets/Scripts/Game/Weather/Weather.cs', 'WeatherType'],
  ['TRANSPORT_MODES', 'Assets/Scripts/Game/TransportManager.cs', 'TransportModes'],
  ['ITEM_GROUPS', 'Assets/Scripts/Game/Items/ItemEnums.cs', 'ItemGroups'],
  ['DYE_COLORS', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'DyeColors'],
  ['CRIMES', 'Assets/Scripts/Game/Entities/PlayerEntity.cs', 'Crimes'],
  ['VAMPIRE_CLANS', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'VampireClans'],
  ['LYCANTHROPY_TYPES', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'LycanthropyTypes'],
  ['WEAPON_MATERIAL_TYPES', 'Assets/Scripts/Game/Items/ItemEnums.cs', 'WeaponMaterialTypes'],
  ['POISONS', 'Assets/Scripts/Game/Items/ItemEnums.cs', 'Poisons'],
  ['EQUIP_SLOTS', 'Assets/Scripts/Game/Items/ItemEnums.cs', 'EquipSlots'],
  ['BUNDLE_TYPES', 'Assets/Scripts/Game/MagicAndEffects/MagicAndEffectsEnums.cs', 'BundleTypes'],
  ['TARGET_TYPES', 'Assets/Scripts/Game/MagicAndEffects/MagicAndEffectsEnums.cs', 'TargetTypes'],
  ['ELEMENT_TYPES', 'Assets/Scripts/Game/MagicAndEffects/MagicAndEffectsEnums.cs', 'ElementTypes'],
  ['ENTITY_TYPES', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'EntityTypes'],
  ['SKILLS', 'Assets/Scripts/API/DFCareer.cs', 'Skills'],
  ['STATS', 'Assets/Scripts/API/DFCareer.cs', 'Stats'],
  ['TOLERANCE', 'Assets/Scripts/API/DFCareer.cs', 'Tolerance'],
  ['PROFICIENCY', 'Assets/Scripts/API/DFCareer.cs', 'Proficiency'],
  ['ATTACK_MODIFIER', 'Assets/Scripts/API/DFCareer.cs', 'AttackModifier'],
  ['MATERIAL_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'MaterialFlags'],
  ['SHIELD_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'ShieldFlags'],
  ['ARMOR_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'ArmorFlags'],
  ['PROFICIENCY_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'ProficiencyFlags'],
  ['DARKNESS_MAGERY_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'DarknessMageryFlags'],
  ['LIGHT_MAGERY_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'LightMageryFlags'],
  ['SPELL_ABSORPTION_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'SpellAbsorptionFlags'],
  ['REGENERATION_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'RegenerationFlags'],
  ['RAPID_HEALING_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'RapidHealingFlags'],
  ['EFFECT_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'EffectFlags'],
  ['SPECIAL_ABILITY_FLAGS', 'Assets/Scripts/API/DFCareer.cs', 'SpecialAbilityFlags'],
  ['SPELL_POINT_MULTIPLIERS', 'Assets/Scripts/API/DFCareer.cs', 'SpellPointMultipliers'],
  ['SOCIAL_GROUPS', 'Assets/Scripts/API/FactionFile.cs', 'SocialGroups'],
  ['QUEST_SMALLER_DUNGEONS_STATE', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'QuestSmallerDungeonsState'],
  ['DISEASES', 'Assets/Scripts/Game/MagicAndEffects/MagicAndEffectsEnums.cs', 'Diseases'],
  ['POISON_STATES', 'Assets/Scripts/Game/MagicAndEffects/Effects/Poisons/PoisonEffect.cs', 'PoisonStates'],
  ['SITE_TYPES', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'SiteTypes'],
  ['MARKER_TYPES', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'MarkerTypes'],
  ['PLACE_SCOPES', 'Assets/Scripts/Game/Questing/Place.cs', 'Scopes'],
  ['TASK_TYPES', 'Assets/Scripts/Game/Questing/Task.cs', 'TaskType'],
  ['BANK_TYPES', 'Assets/Scripts/Game/Utility/NameHelper.cs', 'BankTypes'],
  ['NPC_CONTEXT', 'Assets/Scripts/Game/StaticNPC.cs', 'Context'],
  ['QUEST_INFO_RESOURCE_TYPE', 'Assets/Scripts/Game/TalkManager.cs', 'QuestInfoResourceType'],
  ['RUMOR_TYPE', 'Assets/Scripts/Game/TalkManager.cs', 'RumorType'],
  ['BUILDING_LOCATION_HINT', 'Assets/Scripts/Game/TalkManager.cs', 'BuildingLocationHintTypeGiven'],
  ['MOBILE_GENDER', 'Assets/Scripts/DaggerfallUnityEnums.cs', 'MobileGender'],
  ['BUILDING_TYPES', 'Assets/Scripts/API/DFLocation.cs', 'BuildingTypes'],
  ['TEXT_FORMATTING', 'Assets/Scripts/API/TextFile.cs', 'Formatting'],
];
const SKIP_DFU = missingDfu('Assets/Scripts/DaggerfallUnityEnums.cs') && 'no DFU checkout (DFU_PATH)';

test('DFUSAVE2: every enum table IS the C# declaration (regenerated from the reference clone)', { skip: SKIP_DFU }, () => {
  for (const [table, file, name] of TABLES) {
    const cs = csEnum(file, name);
    const ours = E[`DFU_${table}`];
    assert.ok(ours, `formats/dfuEnums.js exports DFU_${table}`);
    for (const [k, v] of Object.entries(cs)) {
      if (typeof v !== 'number') continue;
      assert.equal(ours[k], v, `${table}.${k} (${file} enum ${name})`);
    }
    for (const k of Object.keys(ours)) assert.ok(k in cs, `${table}.${k} is not in the C# enum ${name}`);
  }
  const mt = csEnum('Assets/Scripts/DaggerfallUnityEnums.cs', 'MobileTypes');
  assert.equal(E.DFU_MOBILE_TYPES_NONE, mt.None);
});

test('DFUSAVE2: the effect-key table IS the effect classes\' own EffectKey + MakeClassicKey pairs (regenerated from Effects/**)', { skip: SKIP_DFU }, () => {
  const dir = fileURLToPath(new URL('Assets/Scripts/Game/MagicAndEffects/Effects/', DFU_ROOT));
  const found = {};
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.cs')) continue;
      const cs = readFileSync(p, 'utf8');
      const key = /EffectKey\s*=\s*"([^"]+)"/.exec(cs);
      const ck = /MakeClassicKey\((\d+),\s*(\d+)\)/.exec(cs);
      if (key && ck) found[key[1]] = [Number(ck[1]), Number(ck[2])];
      else if (key) found[key[1]] = null;
    }
  };
  walk(dir);
  assert.ok(Object.keys(found).length > 80, `the sweep found ${Object.keys(found).length} literal keys`);
  for (const [key, pair] of Object.entries(found)) {
    if (!(key in E.DFU_EFFECT_CLASSIC_KEYS)) {
      assert.equal(pair, null, `${key} has a classic key in DFU and no row in the table`);
      continue;
    }
    assert.deepEqual(E.DFU_EFFECT_CLASSIC_KEYS[key], pair, key);
  }
  // the variant families are built by code in DFU (ElementalResistance-{...} on 8, Pacify-{...} on 33): their rows are pinned by the formula
  const er = readFileSync(join(dir, 'Alteration/ElementalResistance.cs'), 'utf8');
  assert.match(er, /MakeClassicKey\(8, \(byte\)variantIndex\)/);
  assert.deepEqual(['Fire', 'Frost', 'Poison', 'Shock', 'Magicka'].map((n) => E.DFU_EFFECT_CLASSIC_KEYS[`ElementalResistance-${n}`]), [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4]]);
  const pa = readFileSync(join(dir, 'Thaumaturgy/PacifyEffect.cs'), 'utf8');
  assert.match(pa, /MakeClassicKey\(33, \(byte\)variantIndex\)/);
  assert.deepEqual(['Animal', 'Undead', 'Humanoid', 'Daedra'].map((n) => E.DFU_EFFECT_CLASSIC_KEYS[`Pacify-${n}`]), [[33, 0], [33, 1], [33, 2], [33, 3]]);
  const ee = readFileSync(dfuFile('Assets/Scripts/Game/MagicAndEffects/EntityEffect.cs'), 'utf8');
  assert.match(ee, /return \(\(int\)family << 16\) \+ \(groupIndex << 8\) \+ subgroupIndex;/, 'MakeClassicKey\'s formula');
});

test('DFUSAVE2: the bit positions the career inverse writes are the ones DFCareer.cs reads', { skip: SKIP_DFU }, () => {
  const cs = readFileSync(dfuFile('Assets/Scripts/API/DFCareer.cs'), 'utf8');
  for (const needle of [
    '(cfg.WeaponArmorShieldsBitfield >> 9) & 0x0f', '(cfg.WeaponArmorShieldsBitfield >> 6) & 0x07', 'cfg.WeaponArmorShieldsBitfield & 0x3f',
    '(cfg.WeaponArmorShieldsBitfield >> 16) & 0x3f', '(cfg.AbilityFlagsAndSpellPointsBitfield & 0x300) >> 8', '(cfg.AbilityFlagsAndSpellPointsBitfield & 0x00C0) >> 6',
    '(cfg.AbilityFlagsAndSpellPointsBitfield & 0x1C00) >> 8', 'HasFlags(cfg.AttackModifierFlags, 0x01)', 'HasFlags(cfg.AttackModifierFlags, 0x80)',
  ]) assert.ok(cs.includes(needle), needle);
  const sp = readFileSync(dfuFile('Assets/Scripts/Game/Serialization/SerializablePlayer.cs'), 'utf8');
  assert.match(sp, /data\.usingLeftHand = !weaponManager\.UsingRightHand;/, 'usingLeftHand is the negation the import undoes');
  assert.match(sp, /playerPosition\.worldPosX = StreamingWorld\.LocalPlayerGPS\.WorldX;/, 'worldPosX is PlayerGPS.WorldX');
  const sm = readFileSync(dfuFile('Assets/Scripts/Terrain/StreamingWorld.cs'), 'utf8');
  assert.match(sm, /worldX \+= \(playerPos\.x - lastPlayerPos\.x\) \* SceneMapRatio;/, 'world units = scene units * SceneMapRatio, the port\'s own ratio');
});
