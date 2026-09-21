// @ts-check
// Daggerfall Unity save import (DFUSAVE2, 2026-09-20). Mac: "Can players
// easily bring their DFU characters over?" - "Begin."
//
// ONE pure producer: `dfuSaveToSnapshot` builds the port's own
// SAVE_VERSION envelope (systems/save.js's snapshotPlayer shape) from a
// save `formats/dfuSave.js` opened, so the EXISTING restore seam
// (restorePlayer + the hosts' load path) is the only consumer - the
// same storage substitution classicSaveToSnapshot made for a classic
// save. DFU has no such converter: its LoadGame (SaveLoadManager.cs
// :1330-1555) writes the JSON straight into live singletons. The
// member-by-member map, with a verdict and a reason for each, is
// bible/06-Systems/DFU-Save-Import.md; the short form:
//
//   direct     the same field, at most renamed;
//   converted  a real transformation, named at the site;
//   partial    diseases, infections, the curse and permanent drains
//              out of instancedEffectBundles - not a timed spell;
//              the ship's pixel, not its deck spot;
//   not yet    the scene the player was standing IN (dungeonData,
//              enemyData, lootContainers, the per-scene cache, the
//              interior/dungeon halves of playerPosition), automap,
//              world variants, mod data, advanced climbing.
//
// Every "not yet" lands the player somewhere honest (the location's
// exterior pixel) and says so in `warnings`, which the door shows.
//
// Enum NAMES arrive from the save (Full Serializer's default) and the
// tables in formats/dfuEnums.js turn them into DFU's integers; where
// the port keeps its own value (a 'male' string, a 'local' scope, a
// lower-case weather) the site converts once more and says so.
//
// NOT SEEN AGAINST A REAL SAVE: none is in the tree. The pins build
// DFU-shaped fixtures from the C#'s field lists and round-trip the
// port's own quest and talk envelopes through the shaper, so every
// shape the restore reads is proven; a real file's disagreement is the
// corpus gate's to surface (DFU_SAVES_PATH).

import { dictEntries, enumValue } from '../formats/dfuSave.js';
import * as E from '../formats/dfuEnums.js';
import { SAVE_VERSION, FACTION_RELATION_COLUMNS } from './save.js';
import { raceById } from './races.js';
import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import { ITEM_GROUP_BY_ID } from './biography.js';
import { ITEM_IDENTIFIED_MASK, ITEM_ARTIFACT_MASK, legacyArtifactIndexBitfieldCheck, CLASSIC_RECIPE_KEYS } from './loot.js';
import { isPotion, isPotionRecipe } from './useItem.js';
import { CLASSIC_EPOCH_IN_SECONDS, SECONDS_PER_MINUTE, dateToSeconds } from './gameDate.js';
import { worldCoordToMapPixel, REGION_NAMES } from '../formats/mapsFile.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG } from './lycanthropy.js';
import { spellPoints, spellPointMultiplier, CLASS_CAREERS } from './chargen.js';
import { levelUpSkillSum } from './advancement.js';
import { LEVELING_CLASSIC } from './oblivionLeveling.js';   // ORL1: a DFU character levels by Daggerfall's own law
import { Formatting as MessageFormatting } from './quest/message.js';
import { WEATHER_TYPES } from '../world/weather.js';
import { TRANSPORT_MODES } from './transport.js';
import { createBankAccounts, createHouses, BANK_REGION_COUNT } from './banking.js';
import { makeAnchor, WORLD_CONTEXT } from './teleportAnchor.js';
import { createInfection } from './infection.js';
import { VAMPIRISM_CURSE_KEY } from './vampirism.js';
import { LYCANTHROPY_CURSE_KEY } from './lycanthropy.js';
import { STAT_KEYS_ORDER } from './statMods.js';
import { VALUES_WIDTH, FLAGS_WIDTH, FLAGS2_WIDTH, REGION_COUNT } from './regionConditions.js';
import { SOCIAL_GROUP_COUNT, GUILD_GROUPS } from '../formats/factionFile.js';
import { GUILDS } from './guilds.js';
import { DIVINES, ORDERS, templeOf, orderOf } from './guildVariants.js';
import { Scopes } from './quest/place.js';
import { TaskType } from './quest/task.js';

// ── small laws ────────────────────────────────────────────────────

/** DaggerfallDateTime.ToSeconds (:430-441) over the six serialised
 *  fields (Year, Month, Day, Hour, Minute, Second - Month and Day
 *  zero-based, Second truncated). ONE home: gameDate.js's
 *  dateToSeconds IS that member; this only lowers the C# field case.
 *  (AUDIT-DFUSAVE D1: the first draft re-wrote the sum.) */
export function dfuDateToSeconds(dt) {
  if (!dt) return 0;
  return dateToSeconds({ year: num(dt.Year), month: num(dt.Month), day: num(dt.Day), hour: num(dt.Hour), minute: num(dt.Minute), second: Math.trunc(num(dt.Second)) });
}

/** ToClassicDaggerfallTime (:475-478): absolute seconds -> the classic
 *  minute counter the port's clock keeps. */
export const dfuSecondsToClassicMinutes = (s) => Math.floor((Number(s) - CLASSIC_EPOCH_IN_SECONDS) / SECONDS_PER_MINUTE);

/** The port's quest clock is `classicMinutes * 60` (world.js
 *  classicSeconds) - DFU's absolute seconds less the classic epoch. */
export const dfuSecondsToClassicSeconds = (s) => Number(s) - CLASSIC_EPOCH_IN_SECONDS;

/** A [Flags] value that names ONE bit -> that bit's index (TargetTypes
 *  CasterOnly=1 -> 0 ... AreaAtRange=16 -> 4), the port's own numbering
 *  for rangeType and element. */
export function flagIndex(v, table) {
  const n = enumValue(v, table);
  if (n <= 0) return 0;
  return Math.round(Math.log2(n));
}

/** A `System.Type` as Full Serializer prints it ("DaggerfallWorkshop.
 *  Game.Questing.Person, Assembly-CSharp, Version=...") -> its short
 *  class name, which is what the port's resolvers key on
 *  (RESOURCE_TYPES / the action templates' typeName). A nested type's
 *  '+' is a dot for this purpose. */
export function typeShortName(t) {
  if (typeof t !== 'string') return null;
  const full = t.split(',')[0].trim();
  const last = full.split(/[.+]/).pop();
  return last || null;
}

/** DFU's Symbol {original, name} rides two ways, as the port writes
 *  it two ways: a resource's, a task's or a questor's symbol is
 *  symbolToSaveData's `{ original }` (symbol.js:60, the restore
 *  rebuilds the name); a site link's or a marker's is a LIVE Symbol
 *  cloned whole, and the machine's site-link walk reads its `name`
 *  (machine.js:726, getResource by symbol.name). */
const symbol = (s) => (s && typeof s === 'object' ? { original: s.original ?? null } : null);
const liveSymbol = (s) => (s && typeof s === 'object' ? { original: s.original ?? null, name: s.name ?? innerName(s.original) } : null);
const innerName = (o) => (typeof o === 'string' ? o.replace(/^_+|_+$/g, '') : null);

/** TextFile.Token -> the port's token: the formatting NAME to the
 *  port's own lower-case word (systems/quest/message.js Formatting,
 *  notebook.js's 'newline' and the talk halves' four); a name the port
 *  has no word for rides lower-cased, and the port ignores it. */
const TOKEN_FORMATTING = Object.freeze({
  ...MessageFormatting,   // Nothing, Text, JustifyCenter - the quest machine's own words (AUDIT-DFUSAVE D4: one home)
  TextHighlight: 'highlight', TextQuestion: 'question', TextAnswer: 'answer',
  NewLine: 'newline', NewLineOffset: 'newline',
});
export function dfuToken(t) {
  if (!t || typeof t !== 'object') return t;
  const f = t.formatting;
  const formatting = typeof f === 'string' ? (TOKEN_FORMATTING[f] ?? f.toLowerCase()) : f;
  return { formatting, text: t.text ?? '', x: t.x ?? 0, y: t.y ?? 0 };
}
const tokenLines = (lines) => (lines ?? []).map((l) => (l ?? []).map(dfuToken));

const num = (v, d = 0) => (v == null ? d : Number(v));
const bool = (v) => !!v;

// ── the character ─────────────────────────────────────────────────

/** Genders -> the port's 'male'/'female' (playerEntity.js:31). */
export const dfuGender = (g) => (enumValue(g, E.DFU_GENDERS) === E.DFU_GENDERS.Female ? 'female' : 'male');

/** DFCareer.cs:557-631 IS the decode of a CLASS*.CFG record; this is
 *  its exact inverse, back into the raw record the port's career is
 *  (formats/classFile.js). Every bit position is the C#'s:
 *  the four tolerance bytes over EffectFlags, SpecialAbilityFlags in
 *  the low byte of AbilityFlagsAndSpellPointsBitfield with the
 *  magery pairs at 6-7 / 8-9 and the multiplier at 10-12 (:619-620,
 *  :782), the attack-modifier byte's bonus/phobia nibbles (:824-844),
 *  the weapon/armor/shield bitfield's four fields (:604-607). */
export function dfuCareerToRecord(c) {
  const tol = (name) => enumValue(c[name], E.DFU_TOLERANCE);
  // EffectFlags (Paralysis 1 .. Disease 64) name DFCareer's seven
  // tolerance fields; SpecialAbilityFlags name its six booleans (the
  // last two under DamageFromSunlight/DamageFromHolyPlaces). Both
  // tables are regenerated from the C# (AUDIT-DFUSAVE D2: the first
  // draft wrote the bits by hand a second time).
  const flagsOf = (which) => {
    let out = 0;
    for (const [field, bit] of Object.entries(E.DFU_EFFECT_FLAGS)) {
      if (bit && tol(field) === which) out |= bit;
    }
    return out;
  };
  const skill = (name) => enumValue(c[name], E.DFU_SKILLS);
  const ABILITY_FIELD = { AcuteHearing: 'AcuteHearing', Athleticism: 'Athleticism', AdrenalineRush: 'AdrenalineRush', NoRegenSpellPoints: 'NoRegenSpellPoints', SunDamage: 'DamageFromSunlight', HolyDamage: 'DamageFromHolyPlaces' };
  let ability = 0;
  for (const [flag, bit] of Object.entries(E.DFU_SPECIAL_ABILITY_FLAGS)) if (bit && c[ABILITY_FIELD[flag]]) ability |= bit;
  const magery = (enumValue(c.LightPoweredMagery ?? 0, E.DFU_LIGHT_MAGERY_FLAGS) << 6)
    | (enumValue(c.DarknessPoweredMagery ?? 0, E.DFU_DARKNESS_MAGERY_FLAGS) << 8);
  const spellPoints = enumValue(c.SpellPointMultiplier ?? 16, E.DFU_SPELL_POINT_MULTIPLIERS) << 8;
  const attackMod = (name, bonusBit, phobiaBit) => {
    const m = enumValue(c[name] ?? 0, E.DFU_ATTACK_MODIFIER);
    return m === E.DFU_ATTACK_MODIFIER.Bonus ? bonusBit : m === E.DFU_ATTACK_MODIFIER.Phobia ? phobiaBit : 0;
  };
  const attackModifierFlags = attackMod('UndeadAttackModifier', 0x01, 0x10) | attackMod('DaedraAttackModifier', 0x02, 0x20)
    | attackMod('HumanoidAttackModifier', 0x04, 0x40) | attackMod('AnimalsAttackModifier', 0x08, 0x80);
  const weaponArmorShieldsBitfield = ((enumValue(c.ExpertProficiencies ?? 0, E.DFU_PROFICIENCY_FLAGS) & 0x3f) << 16)
    | ((enumValue(c.ForbiddenShields ?? 0, E.DFU_SHIELD_FLAGS) & 0x0f) << 9)
    | ((enumValue(c.ForbiddenArmors ?? 0, E.DFU_ARMOR_FLAGS) & 0x07) << 6)
    | (enumValue(c.ForbiddenProficiencies ?? 0, E.DFU_PROFICIENCY_FLAGS) & 0x3f);
  const advancementMultiplier = Math.round(num(c.AdvancementMultiplier, 1) * 100) / 100;
  return {
    name: String(c.Name ?? '').trim(),   // SerializablePlayer.cs:372 Career.Name.Trim()
    resistanceFlags: flagsOf(E.DFU_TOLERANCE.Resistant),
    immunityFlags: flagsOf(E.DFU_TOLERANCE.Immune),
    lowToleranceFlags: flagsOf(E.DFU_TOLERANCE.LowTolerance),
    criticalWeaknessFlags: flagsOf(E.DFU_TOLERANCE.CriticalWeakness),
    abilityFlagsAndSpellPointsBitfield: (ability | magery | spellPoints) & 0xffff,
    rapidHealing: enumValue(c.RapidHealing ?? 0, E.DFU_RAPID_HEALING_FLAGS),
    regeneration: enumValue(c.Regeneration ?? 0, E.DFU_REGENERATION_FLAGS),
    unknown1: 0,
    spellAbsorptionFlags: enumValue(c.SpellAbsorption ?? 0, E.DFU_SPELL_ABSORPTION_FLAGS),
    attackModifierFlags,
    forbiddenMaterialsFlags: enumValue(c.ForbiddenMaterials ?? 0, E.DFU_MATERIAL_FLAGS),
    weaponArmorShieldsBitfield: weaponArmorShieldsBitfield >>> 0,
    primarySkills: [skill('PrimarySkill1'), skill('PrimarySkill2'), skill('PrimarySkill3')],
    majorSkills: [skill('MajorSkill1'), skill('MajorSkill2'), skill('MajorSkill3')],
    minorSkills: [skill('MinorSkill1'), skill('MinorSkill2'), skill('MinorSkill3'), skill('MinorSkill4'), skill('MinorSkill5'), skill('MinorSkill6')],
    hitPointsPerLevel: num(c.HitPointsPerLevel),
    advancementMultiplierRaw: Math.round(num(c.AdvancementMultiplier, 1) * 65536) >>> 0,
    advancementMultiplier,
    strength: num(c.Strength), intelligence: num(c.Intelligence), willpower: num(c.Willpower), agility: num(c.Agility),
    endurance: num(c.Endurance), personality: num(c.Personality), speed: num(c.Speed), luck: num(c.Luck),
  };
}

/** The stock row whose name the career carries, else -1 (the classic
 *  import's own answer: the career rides WHOLE). */
export const dfuCareerIndex = (name) => CLASS_CAREERS.indexOf(String(name ?? ''));

/** DaggerfallStats' eight [SerializeField] permanent values. */
export function dfuStats(s) {
  const out = {};
  const NAMES = ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck'];
  STAT_KEYS_ORDER.forEach((k, i) => { out[k] = num(s?.[NAMES[i]], 50); });
  return out;
}

/** DaggerfallSkills' 35 [SerializeField] shorts, in DFCareer.Skills
 *  order = the port's SKILLS order. */
export function dfuSkills(s) {
  const out = new Array(35).fill(0);
  for (const [name, i] of Object.entries(E.DFU_SKILLS)) {
    if (i >= 0 && i < 35) out[i] = num(s?.[name]);
  }
  return out;
}

/** An int[8] of stat mods -> the port's { statKey: n } map of the
 *  non-zero ones (a disease's statMods, diseases.js:178-187). */
export function statModsMap(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;
  STAT_KEYS_ORDER.forEach((k, i) => { if (arr[i]) out[k] = Number(arr[i]); });
  return out;
}

// ── items ─────────────────────────────────────────────────────────

/**
 * ItemData_v1 -> a port item. DaggerfallUnityItem.FromItemData
 * (:1622-1688) is the map, classicItemFromRecord the port's pattern:
 * the classic record's fields under DFU's names. A group without a
 * template table (MagicItems) or a groupIndex off it is dropped with
 * a warning - a templateIndex the port cannot resolve is an orphan
 * the next load would sweep anyway (RemoveOrphanedItems).
 * @returns {object|null}
 */
export function dfuItem(d, warnings = []) {
  const group = typeof d.itemGroup === 'string' ? d.itemGroup : ITEM_GROUP_BY_ID[Number(d.itemGroup)];
  if (!(group in E.DFU_ITEM_GROUPS) || group === 'None') { warnings.push(`item "${d.shortName ?? '?'}": unknown group ${d.itemGroup}`); return null; }
  const templateIndex = GROUP_TEMPLATE_INDICES[group]?.[num(d.groupIndex)];
  if (templateIndex == null) { warnings.push(`item "${d.shortName ?? '?'}": ${group}/${d.groupIndex} has no template`); return null; }
  const flags = num(d.value2) >>> 16;
  const item = {
    group,
    templateIndex,
    name: String(d.shortName ?? ''),
    material: num(d.nativeMaterialValue),
    value: num(d.value1),
    flags,
    currentCondition: num(d.hits1),
    maxCondition: num(d.hits2),
    typeDependentData: num(d.hits3) >>> 8,
    enchantmentPoints: num(d.enchantmentPoints),
    message: num(d.message),
    stackCount: num(d.stackCount, 1),   // verbatim, as FromItemData copies it (AUDIT-DFUSAVE C13)
    weightInKg: num(d.weightInKg),
    playerTextureArchive: num(d.playerTextureArchive),
    playerTextureRecord: num(d.playerTextureRecord),
    worldTextureArchive: num(d.worldTextureArchive),
    worldTextureRecord: num(d.worldTextureRecord),
    artifact: (flags & ITEM_ARTIFACT_MASK) > 0,
    isIdentified: (flags & ITEM_IDENTIFIED_MASK) > 0,
  };
  if (group === 'MensClothing' || group === 'WomensClothing') item.dye = enumValue(d.dyeColor ?? 0, E.DFU_DYE_COLORS);
  const variant = num(d.currentVariant);
  if (variant > 0 || group === 'MensClothing' || group === 'WomensClothing') item.variant = variant;
  if (num(d.artifactIndexBitfield)) item.artifactIndexBitfield = num(d.artifactIndexBitfield);
  // legacyMagic: flat (type, param) pairs (FromItemData :1641-1652), all
  // ten slots as DFU writes them; kept whole when any slot is real,
  // dropped whole when none is - classicItemFromRecord's own law.
  const lm = Array.isArray(d.legacyMagic) ? d.legacyMagic : [];
  const enchantments = [];
  for (let i = 0; i + 1 < lm.length; i += 2) enchantments.push({ type: num(lm[i], -1), param: num(lm[i + 1]) });
  if (enchantments.some((e) => e.type !== -1 && e.type !== 0xffff)) { item.enchantments = enchantments; item.magic = true; }
  if (Array.isArray(d.customMagic) && d.customMagic.length) {
    warnings.push(`item "${item.name}": ${d.customMagic.length} custom enchantment(s) have no port shape and are dropped`);
  }
  if (d.isQuestItem) {
    item.questItem = true;
    item.questUID = num(d.questUID);
    item.questSymbol = liveSymbol(d.questItemSymbol);   // a Symbol clone on the port's item (quest/item.js:173); world.js reads its .name
  }
  // trappedSoulType is a MobileTypes ENUM (SerializableGameObject.cs
  // :295), so the save carries its NAME ("Daedroth"); the port's own
  // MOBILE_TYPES table (characters/mobileTypes.js, DaggerfallUnityEnums
  // .cs verbatim) is the one home for it. AUDIT-DFUSAVE C3: the first
  // draft accepted a number only and emptied every filled soul gem.
  if (d.trappedSoulType != null) {
    const soul = enumValue(d.trappedSoulType, MOBILE_TYPES);
    if (soul !== MOBILE_TYPES.None) item.trappedSoulType = soul;
  }
  const poison = d.poisonType;
  if (poison != null && poison !== 'None') {
    const p = enumValue(poison, E.DFU_POISONS);
    if (p >= 128) item.poisonType = p;
  }
  if (num(d.potionRecipe)) item.potionRecipeKey = num(d.potionRecipe);
  // FromItemData's three back-fills (:1673-1687), which DFU runs on
  // every item it loads (AUDIT-DFUSAVE C8): the classic recipe key
  // from typeDependentData, the artifact bitfield an older save
  // lacks, and the Ark'ay book id 10000 -> 5.
  else if ((isPotion(item) || isPotionRecipe(item)) && item.typeDependentData < CLASSIC_RECIPE_KEYS.length) {
    item.potionRecipeKey = CLASSIC_RECIPE_KEYS[item.typeDependentData];
  }
  legacyArtifactIndexBitfieldCheck(item);
  if (group === 'Books' && item.message === 10000) item.message = 5;
  if (d.repairData && num(d.repairData.timeStarted)) {
    // The port keys the job by the shop's buildingKey; DFU by the
    // interior's scene name, which carries it. DFU's repairTime is
    // SECONDS (FormulaHelper.cs:1931-1932, floored at SecondsPerDay);
    // the port's is classic MINUTES (repairService.js). AUDIT-DFUSAVE
    // C1: the first draft copied it verbatim, sixty times too long.
    const m = /BuildingKey=(\d+)/.exec(String(d.repairData.sceneName ?? ''));
    item.repairData = {
      buildingKey: m ? Number(m[1]) : 0,
      timeStarted: dfuSecondsToClassicMinutes(d.repairData.timeStarted),
      repairTime: Math.max(1, Math.round(num(d.repairData.repairTime) / SECONDS_PER_MINUTE)),
    };
  }
  if (num(d.timeForItemToDisappear)) item.timeForItemToDisappear = num(d.timeForItemToDisappear);
  if (num(d.timeHealthLeechLastUsed)) item.timeHealthLeechLastUsed = num(d.timeHealthLeechLastUsed);
  return item;
}

/** A collection: the converted items and, beside each, the DFU uid it
 *  had, for the equip table and the light source to find. */
function dfuCollection(list, warnings) {
  const items = [], uids = [];
  for (const d of list ?? []) {
    const it = dfuItem(d, warnings);
    if (!it) continue;
    items.push(it);
    uids.push(String(d.uid ?? '0'));
  }
  return { items, uids };
}

// ── spells ────────────────────────────────────────────────────────

const SPELL_ICON_COUNT = 55;   // spellMaker.js's SetIcon law: index % count
const EMPTY_EFFECT = () => ({
  type: -1, subType: -1, durationBase: 0, durationMod: 0, durationPerLevel: 0,
  chanceBase: 0, chanceMod: 0, chancePerLevel: 0, magnitudeBaseLow: 0, magnitudeBaseHigh: 0,
  magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0,
});

/** EffectSettings -> the classic record's fields (spellMaker.js:243-253
 *  is the port's own rename of the same struct). */
export function dfuEffectSettings(st) {
  return {
    durationBase: num(st?.DurationBase), durationMod: num(st?.DurationPlus), durationPerLevel: num(st?.DurationPerLevel),
    chanceBase: num(st?.ChanceBase), chanceMod: num(st?.ChancePlus), chancePerLevel: num(st?.ChancePerLevel),
    magnitudeBaseLow: num(st?.MagnitudeBaseMin), magnitudeBaseHigh: num(st?.MagnitudeBaseMax),
    magnitudeLevelBase: num(st?.MagnitudePlusMin), magnitudeLevelHigh: num(st?.MagnitudePlusMax),
    magnitudePerLevel: num(st?.MagnitudePerLevel),
  };
}

/**
 * An EffectBundleSettings out of the spellbook -> a port spell entry:
 * the SPELLS.STD index when StandardSpellIndex names one, else a made
 * spell in the classic record shape, each effect key back to its
 * (type, subType) through the effects' own ClassicKey table. `null`
 * when nothing of it can be carried.
 */
export function dfuSpell(b, nextIndex, warnings = []) {
  // A TAGGED bundle is a vampire's or a werebeast's granted spell
  // (PlayerEntity.cs:1139 vampireSpellTag, :1164 lycanthropySpellTag,
  // both with MinimumCastingCost): DFU stores it as a stock spell with
  // a StandardSpellIndex AND the tag, and the port stores it as a
  // tagged custom record (vampirism.js:163, lycanthropy.js:199) - the
  // tag is what the cast-cost floor, the cure and the spellbook's
  // no-delete note key on. AUDIT-DFUSAVE C5: the first draft answered
  // the bare index and the spell came back untagged at full cost.
  const tag = typeof b?.Tag === 'string' && b.Tag ? b.Tag : null;
  if (b?.StandardSpellIndex != null && !tag) return num(b.StandardSpellIndex);
  const effects = [];
  let over = 0;
  for (const e of b?.Effects ?? []) {
    const pair = E.DFU_EFFECT_CLASSIC_KEYS[e?.Key];
    if (!pair) { warnings.push(`spell "${b?.Name ?? '?'}": effect "${e?.Key}" has no classic key - dropped`); continue; }
    if (effects.length >= 3) { over++; continue; }   // the classic record's three slots
    effects.push({ type: pair[0], subType: pair[1] === 255 ? -1 : pair[1], ...dfuEffectSettings(e.Settings) });
  }
  if (over) warnings.push(`spell "${b?.Name ?? '?'}": ${over} effect(s) past the classic record's three were dropped`);
  if (!effects.length) { warnings.push(`spell "${b?.Name ?? '?'}": no effect survived - dropped`); return null; }
  while (effects.length < 3) effects.push(EMPTY_EFFECT());
  if (b.Icon?.key) warnings.push(`spell "${b?.Name ?? '?'}": its icon pack "${b.Icon.key}" does not come over; the classic icon index does`);
  const record = {
    effects,
    element: flagIndex(b.ElementType ?? 'Magic', E.DFU_ELEMENT_TYPES),
    rangeType: flagIndex(b.TargetType ?? 'CasterOnly', E.DFU_TARGET_TYPES),
    name: String(b.Name ?? ''),
    // RestoreInstancedBundleSaveData's icon migration (EntityEffectManager.cs:2315-2318): a SpellIcon with no key and index 0 means the legacy flat IconIndex. The port's icon is the classic 0-54 index (SPELL_ICON_COUNT); a pack key has no home here.
    icon: (((b.Icon && (b.Icon.key || num(b.Icon.index)) ? num(b.Icon.index) : num(b.IconIndex)) % SPELL_ICON_COUNT) + SPELL_ICON_COUNT) % SPELL_ICON_COUNT,
    cost: 0,
    index: nextIndex(),
    custom: true,
  };
  if (tag) {
    record.tag = tag === 'vampire' ? VAMPIRE_SPELL_TAG : tag === 'lycanthrope' ? LYCANTHROPY_SPELL_TAG : tag;
    record.minimumCastingCost = true;
  } else if (b.MinimumCastingCost) {
    record.minimumCastingCost = true;
  }
  return record;
}

// ── the effects that outlive a load ───────────────────────────────

const POISON_STATE_WORD = ['waiting', 'active', 'complete'];

/**
 * instancedEffectBundles -> the port's activeEffects, PARTIAL by
 * design: what changes who the character is - a disease, an
 * infection, the deployed curse, a permanent drain, a poison - comes
 * over in the exact shape the port's own producers mint (diseases.js
 * startDisease, infection.js createInfection, vampirism.js /
 * lycanthropy.js createXCurse, effects.js pushPermanent, poisons.js).
 * A timed spell in flight is counted and named in the warnings.
 */
export function dfuActiveEffects(bundles, warnings = []) {
  const out = [];
  let dropped = 0;
  for (const b of bundles ?? []) {
    // A HeldMagicItem bundle is the port's held-item runtime's to
    // rebuild from the worn item; DFU itself drops one whose item is
    // gone (EntityEffectManager.cs:2311-2313). AUDIT-DFUSAVE C13.
    if (enumValue(b?.bundleType ?? 'None', E.DFU_BUNDLE_TYPES) === E.DFU_BUNDLE_TYPES.HeldMagicItem) continue;
    for (const fx of b?.liveEffects ?? []) {
      if (fx?.effectEnded) continue;   // EntityEffect.cs:550 - an ended effect still in the list (AUDIT-DFUSAVE C10)
      const key = String(fx?.key ?? '');
      const sp = fx?.effectSpecific ?? null;
      if (key.startsWith(E.DFU_DISEASE_KEY_PREFIX)) {
        const name = key.slice(E.DFU_DISEASE_KEY_PREFIX.length);
        if (!(name in E.DFU_DISEASES)) { warnings.push(`disease "${key}" unknown - dropped`); continue; }
        out.push({
          kind: 'disease', disease: E.DFU_DISEASES[name], permanent: true,
          incubationOver: bool(sp?.incubationOver), lastDay: num(sp?.lastDay), daysOfSymptomsLeft: num(sp?.daysOfSymptomsLeft),
          statMods: statModsMap(fx.statMods),
        });
      } else if (key === E.DFU_VAMPIRISM_INFECTION_KEY || key === E.DFU_WEREWOLF_INFECTION_KEY || key === E.DFU_WEREBOAR_INFECTION_KEY) {
        const cd = sp?.customDiseaseData ?? null;
        const entry = createInfection(key, { day: num(cd?.startingDay), regionIndex: num(cd?.infectionRegionIndex, -1) });
        entry.dreamPlayed = bool(cd?.warningDreamVideoPlayed);
        entry.deployed = bool(cd?.fakeDeathVideoPlayed) || bool(cd?.deployedFullBlownLycanthropy);
        out.push(entry);
      } else if (key === E.DFU_VAMPIRISM_CURSE_KEY) {
        out.push({
          kind: 'racialOverride', racial: 'vampirism', key: VAMPIRISM_CURSE_KEY,
          clan: enumValue(sp?.vampireClan ?? 'Lyrezi', E.DFU_VAMPIRE_CLANS) || E.DFU_VAMPIRE_CLANS.Lyrezi,
          lastTimeFed: num(sp?.lastTimeFed), hasStartedInitialVampireQuest: bool(sp?.hasStartedInitialVampireQuest),
          raceNameOverride: 'Vampire', sunDamage: true, holyDamage: true, immuneParalysis: true,
          statMods: statModsMap(fx.statMods), skillMods: {},
        });
      } else if (key === E.DFU_LYCANTHROPY_CURSE_KEY) {
        out.push({
          kind: 'racialOverride', racial: 'lycanthropy', key: LYCANTHROPY_CURSE_KEY,
          infectionType: enumValue(sp?.infectionType ?? 'Werewolf', E.DFU_LYCANTHROPY_TYPES),
          isTransformed: bool(sp?.isTransformed), lastKilledInnocent: num(sp?.lastKilledInnocent),
          lastCastMorphSelf: num(sp?.lastCastMorphSelf), wearingHircineRing: bool(sp?.wearingHircineRing),
          urgeToKillRising: false, lastUrgeNotify: 0, raceNameOverride: null,
          statMods: statModsMap(fx.statMods), skillMods: {},
          moveSoundTimer: 0,   // InitMoveSoundTimer runs at the curse; a fresh wait starts on the first frame
        });
      } else if ((key.startsWith(E.DFU_DRAIN_KEY_PREFIX) || key.startsWith(E.DFU_TRANSFER_KEY_PREFIX)) && sp && sp.drainStat != null) {
        // TransferEffect : DrainEffect (TransferEffect.cs:18) - the same
        // permanent drain under the other key; the port's statMods.js
        // reads both kinds. AUDIT-DFUSAVE C4.
        const stat = STAT_KEYS_ORDER[enumValue(sp.drainStat, E.DFU_STATS)];
        if (!stat) { dropped++; continue; }
        out.push({ kind: key.startsWith(E.DFU_TRANSFER_KEY_PREFIX) ? 'transferAttribute' : 'drainAttribute', stat, magnitude: num(sp.magnitude), permanent: true });
      } else if (key.startsWith(E.DFU_POISON_KEY_PREFIX)) {
        const name = key.slice(E.DFU_POISON_KEY_PREFIX.length);
        if (!(name in E.DFU_POISONS)) { warnings.push(`poison "${key}" unknown - dropped`); continue; }
        out.push({
          kind: 'poison', poison: E.DFU_POISONS[name], permanent: true,
          state: POISON_STATE_WORD[enumValue(sp?.currentState ?? 0, E.DFU_POISON_STATES)] ?? 'waiting',
          minutesToStart: num(sp?.minutesToStart), minutesRemaining: num(sp?.minutesRemaining),
          lastMinute: num(sp?.lastMinute), statMods: statModsMap(fx.statMods), positiveStatsRemoved: bool(sp?.positiveStatsRemoved),
        });
      } else {
        dropped++;
      }
    }
  }
  if (dropped) warnings.push(`${dropped} timed or item-bound effect(s) in flight were not carried`);
  return out;
}

// ── the world half ────────────────────────────────────────────────

/** PlayerPositionData_v1 -> what the port's world host reads on a
 *  load: the map pixel and native world units (PlayerGPS.WorldX/Z,
 *  what RestorePositionHelper respawns from, PlayerEnterExit.cs
 *  :623-650) and the compensation-free height. */
export function dfuWorldBag(p) {
  const nativeX = num(p?.worldPosX), nativeZ = num(p?.worldPosZ);
  return {
    pixel: worldCoordToMapPixel(nativeX, nativeZ),
    nativeX, nativeZ,
    y: num(p?.position?.y) - num(p?.worldCompensation?.y),
    piles: [], droppedTorches: [], foes: [], guards: [],
  };
}

/** The same struct as the player's, into makeAnchor's record (the
 *  Recall anchor, PlayerEntity.AnchorPosition). */
export function dfuAnchor(p, warnings = []) {
  if (!p || (num(p.worldPosX) === 0 && num(p.worldPosZ) === 0)) return null;
  const ctx = enumValue(p.worldContext ?? 'Exterior', E.DFU_WORLD_CONTEXT);
  if (ctx !== E.DFU_WORLD_CONTEXT.Exterior) {
    // An anchor set inside carries DFU's door (exteriorDoors) and its
    // raw Unity local; the port's interior anchor needs the port's door
    // record and the dungeon's local frame, neither of which is carried
    // yet (the same gap as a save made inside). Without them the spell
    // would be consumed and land outside - so no anchor, and the
    // Recall says 'set an anchor first'. AUDIT-DFUSAVE C7.
    warnings.push('your Recall anchor was set inside a building or dungeon: it does not come over');
    return null;
  }
  const nativeX = num(p.worldPosX), nativeZ = num(p.worldPosZ);
  return makeAnchor({
    worldContext: WORLD_CONTEXT.Exterior, pixel: worldCoordToMapPixel(nativeX, nativeZ), nativeX, nativeZ,
    y: num(p.position?.y) - num(p.worldCompensation?.y),
    local: null,
    yaw: num(p.yaw), pitch: num(p.pitch), interior: null, buildingKey: 0,
  });
}

/** WeatherType name -> the port's lower-case word (world/weather.js
 *  WEATHER_TYPES is the enum by index). */
export const dfuWeather = (w) => WEATHER_TYPES[enumValue(w ?? 'Sunny', E.DFU_WEATHER_TYPE)] ?? WEATHER_TYPES[0];

/** TransportModes -> the port's TRANSPORT_MODES string. */
export function dfuTransport(t) {
  const n = enumValue(t ?? 'Foot', E.DFU_TRANSPORT_MODES);
  return [TRANSPORT_MODES.Foot, TRANSPORT_MODES.Horse, TRANSPORT_MODES.Cart, TRANSPORT_MODES.Ship][n] ?? TRANSPORT_MODES.Foot;
}

// ── guilds, regions, bank ─────────────────────────────────────────

/** @type {Map<number, string>} */
const DIVINE_BY_ID = new Map(Object.entries(DIVINES).map(([k, v]) => [Number(v), k]));
/** @type {Map<number, string>} */
const ORDER_BY_ID = new Map(Object.entries(ORDERS).map(([k, v]) => [Number(v), k]));

/** GuildMembership_v1 by guild group -> the port's book: the record
 *  keeps the guild's NAME beside the rank (guilds.js joinGuild) - for a
 *  temple or a knightly order that is the `variant`, the divine's or
 *  the order's faction id (Temple.cs:527, KnightlyOrder.cs:278). */
export function dfuMembershipBook(dict, warnings = []) {
  const book = {};
  for (const [k, m] of dictEntries(dict)) {
    const group = Number(k);
    let guildName = null;
    if (group === GUILD_GROUPS.FightersGuild) guildName = GUILDS.FightersGuild.name;
    else if (group === GUILD_GROUPS.MagesGuild) guildName = GUILDS.MagesGuild.name;
    else if (group === GUILD_GROUPS.GeneralPopulace) guildName = GUILDS.ThievesGuild.name;
    else if (group === GUILD_GROUPS.DarkBrotherHood) guildName = GUILDS.DarkBrotherhood.name;
    else if (group === GUILD_GROUPS.HolyOrder) guildName = templeOf(/** @type {any} */ (DIVINE_BY_ID.get(num(m?.variant))))?.name ?? null;
    else if (group === GUILD_GROUPS.KnightlyOrder) { const order = /** @type {any} */ (ORDER_BY_ID.get(num(m?.variant))); guildName = order ? (orderOf(order)?.name ?? null) : null; }
    if (!guildName) { warnings.push(`guild membership in group ${group} (variant ${m?.variant}) has no port guild - dropped`); continue; }
    const rec = { guild: guildName, rank: num(m?.rank), lastRankChange: num(m?.lastRankChange) };
    if (num(m?.flags)) rec.flags = num(m.flags);
    book[group] = rec;
  }
  return book;
}

/** PlayerEntity.RegionDataRecord[] -> the port's three stores: the
 *  compact condition rows (regionConditions.js snapshot shape), the
 *  region-keyed legalRep and regionPrices. */
export function dfuRegionData(records) {
  const regionConditions = [], legalRep = {}, regionPrices = {};
  const bits = (arr, width) => Array.from({ length: width }, (_, i) => (arr?.[i] ? '1' : '0')).join('');
  for (let i = 0; i < REGION_COUNT; i++) {
    const r = records?.[i] ?? null;
    regionConditions.push({
      v: Array.from({ length: VALUES_WIDTH }, (_, j) => num(r?.Values?.[j])),
      f: bits(r?.Flags, FLAGS_WIDTH),
      g: bits(r?.Flags2, FLAGS2_WIDTH),
      p: num(r?.PrecipitationOverride), s: num(r?.SeverePunishmentFlags), t: num(r?.IDOfPersecutedTemple),
    });
    if (num(r?.LegalRep)) legalRep[i] = num(r.LegalRep);
    if (r && r.PriceAdjustment != null) regionPrices[i] = num(r.PriceAdjustment);
  }
  return { regionConditions, legalRep, regionPrices };
}

/** BankRecordData_v1[] (sparse, by regionIndex) and BankDeedData_v1. */
export function dfuBank(accountsIn, deeds) {
  const bankAccounts = createBankAccounts();
  for (const a of accountsIn ?? []) {
    const i = num(a?.regionIndex, -1);
    if (i < 0 || i >= BANK_REGION_COUNT) continue;
    bankAccounts[i] = { regionIndex: i, accountGold: num(a.accountGold), loanTotal: num(a.loanTotal), loanDueDate: num(a.loanDueDate), hasDefaulted: bool(a.hasDefaulted) };
  }
  const houses = createHouses(BANK_REGION_COUNT);
  for (const h of deeds?.houses ?? []) {
    const i = num(h?.regionIndex, -1);
    if (i < 0 || i >= BANK_REGION_COUNT) continue;
    houses[i] = { regionIndex: i, location: String(h.location ?? ''), mapId: num(h.mapID), buildingKey: num(h.buildingKey) };
  }
  return { bankAccounts, houses, ownedShip: deeds ? num(deeds.shipType, -1) : -1 };
}

// ── the other files ───────────────────────────────────────────────

/** FaceDetails[] -> the port's escort records (hudEscortFaces.js). */
export const dfuFaces = (faces) => (faces ?? []).map((f) => ({
  questUID: num(f.questUID),
  targetPerson: f.targetPerson?.original ?? null,
  targetFoe: f.targetFoe?.original ?? null,
  targetRace: enumValue(f.targetRace ?? 'Breton', E.DFU_RACES),
  gender: enumValue(f.gender ?? 'Male', E.DFU_GENDERS),
  isChild: bool(f.isChild), faceIndex: num(f.faceIndex), factionFaceIndex: num(f.factionFaceIndex, -1),
}));

/** DiscoveryData.txt (Dictionary<int, DiscoveredLocation>) -> the
 *  port's two stores: locations by `mapID & 0xfffff`, buildings by the
 *  port's location id, which is `${regionINDEX}:${locationName}`
 *  (world.js:7265 discoveryLocationId, townTalk.js:1058 through
 *  regionNow() = the index). DFU carries the region's NAME; the 62
 *  names are MAPS.BSA's order (mapsFile.js REGION_NAMES). AUDIT-DFUSAVE
 *  C2: the first draft keyed by the name, which nothing reads. */
export function dfuDiscovery(dict, warnings = []) {
  const buildings = {}, locations = {};
  for (const [, loc] of dictEntries(dict)) {
    if (!loc) continue;
    const regionName = String(loc.regionName ?? ''), locationName = String(loc.locationName ?? '');
    locations[num(loc.mapID) & 0xfffff] = { regionName, locationName };
    const regionIndex = REGION_NAMES.indexOf(regionName);
    const b = {};
    for (const [, rec] of dictEntries(loc.discoveredBuildings)) {
      if (!rec) continue;
      b[num(rec.buildingKey)] = {
        buildingKey: num(rec.buildingKey), displayName: String(rec.displayName ?? ''), factionId: num(rec.factionID),
        quality: num(rec.quality), buildingType: enumValue(rec.buildingType ?? 'None', E.DFU_BUILDING_TYPES),
        lastLockpickAttempt: num(rec.lastLockpickAttempt), customUserDisplayName: rec.customUserDisplayName ?? '',
        isOverrideName: bool(rec.isOverrideName), oldDisplayName: rec.oldDisplayName ?? null,
      };
    }
    if (!Object.keys(b).length) continue;
    if (regionIndex < 0) { warnings.push(`discovered buildings in "${locationName}": region "${regionName}" is not one of the 62 - dropped`); continue; }
    buildings[`${regionIndex}:${locationName}`] = b;
  }
  return { buildings, locations };
}

/** FactionData_v2.factionDict -> the port's columnar snapshot
 *  (save.js snapshotFactionRep). */
export function dfuFactionRep(factionData) {
  const rows = dictEntries(factionData?.factionDict).map(([k, f]) => [Number(k), f]).filter(([, f]) => f).sort((a, b) => a[0] - b[0]);
  const out = { ids: [], rep: [], flags: [], power: [] };
  for (const k of FACTION_RELATION_COLUMNS) out[k] = [];
  for (const [id, f] of rows) {
    out.ids.push(id); out.rep.push(num(f.rep)); out.flags.push(num(f.flags)); out.power.push(num(f.power));
    for (const k of FACTION_RELATION_COLUMNS) out[k].push(num(f[k]));
  }
  return out.ids.length ? out : null;
}

/** An enum value with NO name (Races has no 0, and a zero NPCData
 *  struct carries one) prints as JSON null - fsEnumConverter's
 *  Enum.GetName miss - and reads back as the struct's zero, exactly
 *  the port's own ZERO_NPC_DATA. */
const zeroEnum = (v, table) => (v == null ? 0 : enumValue(v, table));
const npcData = (n) => (n ? {
  hash: num(n.hash), flags: num(n.flags), factionID: num(n.factionID), nameSeed: num(n.nameSeed),
  gender: zeroEnum(n.gender, E.DFU_GENDERS), race: zeroEnum(n.race, E.DFU_RACES),
  context: zeroEnum(n.context, E.DFU_NPC_CONTEXT), mapID: num(n.mapID), locationID: num(n.locationID),
  buildingKey: num(n.buildingKey), nameBank: zeroEnum(n.nameBank, E.DFU_BANK_TYPES),
  billboardArchiveIndex: num(n.billboardArchiveIndex), billboardRecordIndex: num(n.billboardRecordIndex),
} : null);

/** ConversationData.txt (SaveDataConversation) -> the port's flat
 *  `talk` bag: the same five members, DFU's dictionaries as the
 *  arrays the three restore halves read (rumorMill.js:400-404,
 *  topicTree.js:840-858, npcSession.js:722-737). */
export function dfuTalk(c) {
  if (!c) return null;
  return {
    listRumorMill: (c.listRumorMill ?? []).map((r) => ({
      rumorType: enumValue(r.rumorType ?? 'CommonRumor', E.DFU_RUMOR_TYPE),
      listRumorVariants: tokenLines(r.listRumorVariants),
      questID: num(r.questID), timeLimit: num(r.timeLimit), faction1: num(r.faction1), faction2: num(r.faction2),
      regionID: num(r.regionID), flags: num(r.flags), type: num(r.type), textID: num(r.textID),
    })),
    dictQuestorPostQuestMessage: dictEntries(c.dictQuestorPostQuestMessage).map(([k, tokens]) => ({ questID: Number(k), tokens: (tokens ?? []).map(dfuToken) })),
    dictQuestInfo: dictEntries(c.dictQuestInfo).map(([k, q]) => ({
      questID: Number(k),
      resourceInfo: dictEntries(q?.resourceInfo).map(([name, r]) => ({
        name: String(name),
        resourceType: enumValue(r?.resourceType ?? 'NotSet', E.DFU_QUEST_INFO_RESOURCE_TYPE),
        anyInfoAnswers: tokenLines(r?.anyInfoAnswers), rumorsAnswers: tokenLines(r?.rumorsAnswers),
        availableForDialog: bool(r?.availableForDialog), hasEntryInTellMeAbout: bool(r?.hasEntryInTellMeAbout), hasEntryInWhereIs: bool(r?.hasEntryInWhereIs),
        questPlaceResourceHintTypeReceived: enumValue(r?.questPlaceResourceHintTypeReceived ?? 'None', E.DFU_BUILDING_LOCATION_HINT),
        dialogLinkedLocations: [...(r?.dialogLinkedLocations ?? [])], dialogLinkedPersons: [...(r?.dialogLinkedPersons ?? [])], dialogLinkedThings: [...(r?.dialogLinkedThings ?? [])],
      })),
    })),
    npcsWithWork: dictEntries(c.npcsWithWork).map(([k, w]) => [Number(k), { npc: npcData(w?.npc), socialGroup: enumValue(w?.socialGroup ?? 'Commoners', E.DFU_SOCIAL_GROUPS), buildingName: String(w?.buildingName ?? '') }]),
    castleNPCsSpokenTo: dictEntries(c.castleNPCsSpokenTo).map(([k, v]) => [Number(k), bool(v)]),
  };
}

// ── quests ────────────────────────────────────────────────────────

const SCOPE_WORD = Object.freeze({ 0: Scopes.None, 1: Scopes.Fixed, 2: Scopes.Remote, 3: Scopes.Local });
const TASK_WORD = Object.freeze({ 0: TaskType.Headless, 1: TaskType.Standard, 2: TaskType.PersistUntil, 3: TaskType.Variable, 4: TaskType.GlobalVarLink });

const marker = (m) => (m ? {
  questUID: num(m.questUID), placeSymbol: liveSymbol(m.placeSymbol),
  targetResources: Array.isArray(m.targetResources) ? m.targetResources.map(liveSymbol) : null,
  markerType: enumValue(m.markerType ?? 'None', E.DFU_MARKER_TYPES),
  flatPosition: { x: num(m.flatPosition?.x), y: num(m.flatPosition?.y), z: num(m.flatPosition?.z) },
  dungeonX: num(m.dungeonX), dungeonZ: num(m.dungeonZ), buildingKey: num(m.buildingKey), markerID: num(m.markerID),
} : null);

function siteDetails(s) {
  if (!s) return null;
  return {
    questUID: num(s.questUID), siteType: enumValue(s.siteType ?? 'None', E.DFU_SITE_TYPES), mapId: num(s.mapId), locationId: num(s.locationId),
    regionIndex: num(s.regionIndex), regionName: String(s.regionName ?? ''), locationName: String(s.locationName ?? ''),
    buildingKey: num(s.buildingKey), buildingName: String(s.buildingName ?? ''),
    questSpawnMarkers: (s.questSpawnMarkers ?? []).map(marker), questItemMarkers: (s.questItemMarkers ?? []).map(marker),
    selectedQuestSpawnMarker: num(s.selectedQuestSpawnMarker), selectedQuestItemMarker: num(s.selectedQuestItemMarker),
    selectedMarker: marker(s.selectedMarker), magicNumberIndex: num(s.magicNumberIndex),
  };
}

/** The per-type half of ResourceSaveData_v1.resourceSpecific: the
 *  enums by table, the Symbols, the dates in the port's clock, and the
 *  ItemData_v1 an Item or a Foe carries through dfuItem. */
function resourceSpecific(type, sp, warnings) {
  if (!sp) return null;
  switch (type) {
    case 'Clock':
      return {
        lastWorldTimeSample: dfuSecondsToClassicSeconds(dfuDateToSeconds(sp.lastWorldTimeSample)),
        startingTimeInSeconds: num(sp.startingTimeInSeconds), remainingTimeInSeconds: num(sp.remainingTimeInSeconds),
        flag: num(sp.flag), minRange: num(sp.minRange), maxRange: num(sp.maxRange),
        clockEnabled: bool(sp.clockEnabled), clockFinished: bool(sp.clockFinished),
      };
    case 'Foe':
      return {
        spawnCount: num(sp.spawnCount),
        // v1 carries foeType by name, v2 foeId (Foe.cs:317-330, the migration ctor's `foeId = (int)foeType`).
        foeId: sp.foeId != null ? num(sp.foeId) : (typeof sp.foeType === 'number' ? sp.foeType : -1),
        humanoidGender: enumValue(sp.humanoidGender ?? 'Male', E.DFU_GENDERS),
        injuredTrigger: bool(sp.injuredTrigger), restrained: bool(sp.restrained), killCount: num(sp.killCount),
        displayName: sp.displayName ?? null, typeName: sp.typeName ?? null,
        spellQueue: (sp.spellQueue ?? []).map((r) => ({ ClassicID: num(r?.ClassicID), CustomKey: r?.CustomKey ?? null })),
        itemQueue: (sp.itemQueue ?? []).map((d) => dfuItem(d, warnings)).filter(Boolean),
      };
    case 'Item':
      return {
        artifact: bool(sp.artifact), useClicked: bool(sp.useClicked), actionWatching: bool(sp.actionWatching),
        allowDrop: bool(sp.allowDrop), playerDropped: bool(sp.playerDropped), madePermanent: bool(sp.madePermanent),
        item: sp.item ? dfuItem(sp.item, warnings) : null,
      };
    case 'Person':
      return {
        race: sp.race == null ? -1 : enumValue(sp.race, E.DFU_RACES), nameBank: zeroEnum(sp.nameBank, E.DFU_BANK_TYPES),
        npcGender: enumValue(sp.npcGender ?? 'Male', E.DFU_GENDERS), faceIndex: num(sp.faceIndex), nameSeed: num(sp.nameSeed),
        isQuestor: bool(sp.isQuestor), isIndividualNPC: bool(sp.isIndividualNPC), isIndividualAtHome: bool(sp.isIndividualAtHome),
        displayName: sp.displayName ?? null, homePlaceSymbol: symbol(sp.homePlaceSymbol), lastAssignedPlaceSymbol: symbol(sp.lastAssignedPlaceSymbol),
        assignedToHome: bool(sp.assignedToHome), factionID: num(sp.factionID), factionTableKey: sp.factionTableKey ?? null,
        questorData: npcData(sp.questorData), discoveredThroughTalkManager: bool(sp.discoveredThroughTalkManager),
        isMuted: bool(sp.isMuted), isDestroyed: bool(sp.isDestroyed),
      };
    case 'Place':
      return {
        scope: SCOPE_WORD[enumValue(sp.scope ?? 'None', E.DFU_PLACE_SCOPES)] ?? Scopes.None,
        name: String(sp.name ?? ''), p1: num(sp.p1), p2: num(sp.p2), p3: num(sp.p3),
        siteDetails: siteDetails(sp.siteDetails),
      };
    default:
      return structuredClone(sp);
  }
}

/** QuestSaveData_v1 -> the port's quest.getSaveData shape (quest.js
 *  :478-498), which was ported from this struct field for field: the
 *  three mechanical differences are a Type (its class name), a
 *  DaggerfallDateTime (the port's classic seconds) and the questors
 *  Dictionary (an array). */
export function dfuQuest(q, warnings = []) {
  return {
    uid: num(q.uid), questComplete: bool(q.questComplete), questSuccess: bool(q.questSuccess),
    questName: String(q.questName ?? ''), displayName: q.displayName ?? null, factionId: num(q.factionId),
    questStartTime: dfuSecondsToClassicSeconds(dfuDateToSeconds(q.questStartTime)),
    questTombstoned: bool(q.questTombstoned),
    questTombstoneTime: q.questTombstoned ? dfuSecondsToClassicSeconds(dfuDateToSeconds(q.questTombstoneTime)) : 0,
    smallerDungeonsState: enumValue(q.smallerDungeonsState ?? 'NotSet', E.DFU_QUEST_SMALLER_DUNGEONS_STATE),
    compiledByVersion: '',
    activeLogMessages: (q.activeLogMessages ?? []).map((l) => ({ stepID: num(l.stepID), messageID: num(l.messageID), time: dfuSecondsToClassicSeconds(dfuDateToSeconds(l.dateTime)) })),
    messages: (q.messages ?? []).map((m) => ({ id: num(m.id), lines: [...(m.lines ?? [])] })),
    resources: (q.resources ?? []).map((r) => {
      const type = typeShortName(r.type);
      return {
        type, symbol: symbol(r.symbol), infoMessageID: num(r.infoMessageID), usedMessageID: num(r.usedMessageID),
        rumorsMessageID: num(r.rumorsMessageID), hasPlayerClicked: bool(r.hasPlayerClicked), isHidden: bool(r.isHidden),
        resourceSpecific: resourceSpecific(type, r.resourceSpecific, warnings),
      };
    }),
    questors: dictEntries(q.questors).map(([name, d]) => ({ name: String(name), symbol: symbol(d?.symbol), displayName: d?.name ?? null })),
    tasks: (q.tasks ?? []).map((t) => ({
      symbol: symbol(t.symbol), targetSymbol: symbol(t.targetSymbol), triggered: bool(t.triggered), prevTriggered: bool(t.prevTriggered),
      type: TASK_WORD[enumValue(t.type ?? 'Standard', E.DFU_TASK_TYPES)] ?? TaskType.Standard,
      dropped: bool(t.dropped), globalVarName: t.globalVarName ?? null, globalVarLink: num(t.globalVarLink, -1),
      hasTriggerConditions: bool(t.hasTriggerConditions),
      actions: (t.actions ?? []).map((a) => ({
        type: typeShortName(a.type), isComplete: bool(a.isComplete), isTriggerCondition: bool(a.isTriggerCondition),
        isAlwaysOnTriggerCondition: bool(a.isAlwaysOnTriggerCondition), debugSource: a.debugSource ?? null,
        actionSpecific: a.actionSpecific == null ? null : structuredClone(a.actionSpecific),
      })),
    })),
    oneTimeDisplayedMessages: [...(q.oneTimeDisplayedMessages ?? [])].map(Number),
  };
}

/** QuestData.txt + the player's globalVars + NotebookData.txt + the
 *  one-time list -> the quest bridge's envelope (questBridge.js
 *  snapshot: { machine, notebook, oneTimeQuestsAccepted }). */
export function dfuQuestEnvelope(questData, globalVars, notebookData, oneTime, warnings = []) {
  const machine = {
    siteLinks: (questData?.siteLinks ?? []).map((l) => ({
      questUID: num(l.questUID), placeSymbol: liveSymbol(l.placeSymbol), siteType: enumValue(l.siteType ?? 'None', E.DFU_SITE_TYPES),
      mapId: num(l.mapId), buildingKey: num(l.buildingKey), magicNumberIndex: num(l.magicNumberIndex),
    })),
    quests: (questData?.quests ?? []).map((q) => dfuQuest(q, warnings)),
    globalVars: (globalVars ?? []).map((g) => [num(g.index), bool(g.value)]).sort((a, b) => a[0] - b[0]),
  };
  const notebook = notebookData ? {
    notebookEntries: (notebookData.notebookEntries ?? []).map((e) => [...(e ?? [])]),
    finishedQuestEntries: (notebookData.finishedQuestEntries ?? []).map((e) => [...(e ?? [])]),
  } : null;
  return { machine, notebook, oneTimeQuestsAccepted: oneTime ? [...oneTime] : null };
}

// ── the producer ──────────────────────────────────────────────────

/**
 * @typedef {object} DfuImport
 * @property {object} snap  the port's SAVE_VERSION envelope, complete
 * @property {string} saveName
 * @property {string} characterName
 * @property {number} classicMinutes
 * @property {string[]} warnings  what did not come over, in words the door can show
 * @property {Uint8Array|null} screenshot
 */

/**
 * The whole conversion. `save` is what `readDfuSave` opened.
 * @param {import('../formats/dfuSave.js').DfuSave} save
 * @returns {DfuImport}
 */
export function dfuSaveToSnapshot(save) {
  const warnings = [];
  const sd = save.saveData;
  const pd = sd.playerData ?? {};
  const pe = pd.playerEntity ?? {};
  const pos = pd.playerPosition ?? {};

  const importedMinutes = dfuSecondsToClassicMinutes(sd.dateAndTime?.gameTime ?? save.info?.dateAndTime?.gameTime ?? CLASSIC_EPOCH_IN_SECONDS);

  // The character.
  const raceId = num(pe.raceTemplate?.ID, 1);
  const race = raceById(raceId)?.key ?? 'Breton';
  if (!raceById(raceId)) warnings.push(`race id ${raceId} is not one of the eight - Breton stands in`);
  const career = pe.careerTemplate ? dfuCareerToRecord(pe.careerTemplate) : null;
  const stats = dfuStats(pe.stats);
  const skills = dfuSkills(pe.skills);
  // SerializablePlayer.RestorePlayerData's two guards (:295-296, :350-
  // 351): a zero current sum is recomputed from the career's skills,
  // a non-positive starting sum estimated from the level. AUDIT-DFUSAVE
  // C9: without them advancement.js's calculatePlayerLevel reads a
  // character as many levels overdue.
  let currentLevelUpSkillSum = num(pe.currentLevelUpSkillSum);
  if (currentLevelUpSkillSum === 0 && career) currentLevelUpSkillSum = levelUpSkillSum({ career, skills });
  let startingLevelUpSkillSum = num(pe.startingLevelUpSkillSum);
  if (startingLevelUpSkillSum <= 0) {
    // EstimateStartingLevelUpSkillSum (PlayerEntity.cs:1480-1489)
    const estimatedSum = Math.trunc(((num(pe.level, 1) + 0.5) * 15) - (28 + currentLevelUpSkillSum)) * -1;
    startingLevelUpSkillSum = (currentLevelUpSkillSum > 0 && startingLevelUpSkillSum > currentLevelUpSkillSum) ? currentLevelUpSkillSum : estimatedSum;
  }

  // Items, and the two things that name an item by its DFU uid.
  const items = dfuCollection(pe.items, warnings);
  const wagon = dfuCollection(pe.wagonItems, warnings);
  const other = dfuCollection(pe.otherItems, warnings);
  const equip = Array.isArray(pe.equipTable) ? pe.equipTable : [];
  for (let slot = 0; slot < equip.length && slot < 27; slot++) {
    const uid = String(equip[slot] ?? '0');
    if (uid === '0') continue;
    const i = items.uids.indexOf(uid);
    if (i >= 0) items.items[i].equipSlot = slot;
    else warnings.push(`equip slot ${slot} names an item that is not in the pack`);
  }
  const lightUid = String(pe.lightSourceUID ?? '0');
  const lightSourceIndex = lightUid === '0' ? -1 : items.uids.indexOf(lightUid);

  // Spells.
  let nextCustom = -1;
  const spells = [];
  for (const b of pe.spellbook ?? []) {
    const s = dfuSpell(b, () => nextCustom--, warnings);
    if (s != null) spells.push(s);
  }

  const { regionConditions, legalRep, regionPrices } = dfuRegionData(pe.regionData);
  const bank = dfuBank(sd.bankAccounts, sd.bankDeeds);
  const anchorPosition = dfuAnchor(pe.anchorPosition, warnings);
  const discovery = dfuDiscovery(save.discoveryData, warnings);
  const worldContext = enumValue(pos.worldContext ?? 'Exterior', E.DFU_WORLD_CONTEXT);
  if (pos.insideDungeon || worldContext === E.DFU_WORLD_CONTEXT.Dungeon) warnings.push('the save was made inside a dungeon: you start outside it');
  else if (pos.insideBuilding || worldContext === E.DFU_WORLD_CONTEXT.Interior) warnings.push('the save was made inside a building: you start outside it');
  for (const m of sd.modInfoData ?? []) warnings.push(`mod "${m?.title ?? m?.fileName ?? '?'}" was loaded; its own saved state does not come over`);
  const droppedScene = (sd.enemyData?.length ?? 0) + (sd.lootContainers?.length ?? 0) + (sd.sceneCache?.sceneCache?.length ?? 0);
  if (droppedScene) warnings.push('the scene you stood in (its enemies, loot and doors) is not carried');

  const sGroupReputations = new Array(SOCIAL_GROUP_COUNT).fill(0);
  const REP = ['reputationCommoners', 'reputationMerchants', 'reputationScholars', 'reputationNobility', 'reputationUnderworld',
    'reputationSGroup5', 'reputationSupernaturalBeings', 'reputationGuildMembers', 'reputationSGroup8', 'reputationSGroup9', 'reputationSGroup10'];
  REP.forEach((k, i) => { sGroupReputations[i] = num(pe[k]); });

  const snap = {
    v: SAVE_VERSION,
    position: null,
    pose: {
      yaw: num(pos.yaw), pitch: num(pos.pitch), crouching: bool(pos.isCrouching),
      weaponDrawn: bool(pd.weaponDrawn), usingRightHand: !pd.usingLeftHand,
      transport: dfuTransport(pd.transportMode),
    },
    classicMinutes: importedMinutes,
    readiedSpellIndex: null,
    world: dfuWorldBag(pos),
    locationKey: 'world',
    quest: dfuQuestEnvelope(save.questData, pe.globalVars, save.notebookData, pd.oneTimeQuestsAccepted, warnings),
    talk: dfuTalk(save.conversationData),
    interior: null,
    dungeon: null,
    travelMap: {
      filterDungeons: bool(sd.travelMapData?.filterDungeons), filterTemples: bool(sd.travelMapData?.filterTemples),
      filterHomes: bool(sd.travelMapData?.filterHomes), filterTowns: bool(sd.travelMapData?.filterTowns),
      filterRoads: false, filterTracks: false, filterRivers: false, filterStreams: false,
      sleepInn: sd.travelMapData?.sleepInn ?? true, speedCautious: sd.travelMapData?.speedCautious ?? true, travelShip: sd.travelMapData?.travelShip ?? true,
    },
    escortingFaces: dfuFaces(sd.escortingFaces),
    quickslots: null,   // QS1's diamond and TTL1's spawned-dungeon ledger are the port's own; DFU has neither, and the restore reads null as empty
    spawns: null,
    smallerDungeonsState: enumValue(pos.smallerDungeonsState ?? 'NotSet', E.DFU_QUEST_SMALLER_DUNGEONS_STATE),
    weather: dfuWeather(pos.weather),

    // ENTITY_FIELDS, every one minted (the restore copies them blind).
    name: String(pe.name ?? '').trim(),   // SerializablePlayer.cs:371 Name.Trim()
    gender: dfuGender(pe.gender ?? 'Male'),
    race, raceId,
    faceIndex: num(pe.faceIndex),
    careerIndex: dfuCareerIndex(pe.careerTemplate?.Name),
    level: num(pe.level, 1),
    reflexes: enumValue(pe.reflexes ?? 'Average', E.DFU_PLAYER_REFLEXES),
    health: num(pe.currentHealth), maxHealth: num(pe.maxHealth),
    // MaxMagicka is DERIVED in DFU (never serialised); the port's stored
    // ceiling computes through the same formula home the classic import
    // uses (classicSave.js:751). AUDIT-DFUSAVE C11.
    magicka: num(pe.currentMagicka), maxMagicka: spellPoints(stats.intelligence, spellPointMultiplier(career?.abilityFlagsAndSpellPointsBitfield ?? 0x1000)),
    fatigue: num(pe.currentFatigue),
    currentBreath: num(pe.currentBreath),
    startingLevelUpSkillSum, currentLevelUpSkillSum,
    readyToLevelUp: false, pendingLevel: null, pendingBonusPool: null, chargenDone: true,   // no level owed, so no ORL1 bonus pool pending either (classicSave.js's own mint)
    // ORL1's leveling choice is a chargen answer no DFU save can carry: the classic law, with the mod's bar at zero - the classic import's own mint (classicSave.js:772)
    levelingSystem: LEVELING_CLASSIC, levelProgress: 0, levelRollUp: 0,
    biographyResistDiseaseMod: num(pe.biographyResistDiseaseMod), biographyResistMagicMod: num(pe.biographyResistMagicMod),
    biographyAvoidHitMod: num(pe.biographyAvoidHitMod), biographyResistPoisonMod: num(pe.biographyResistPoisonMod),
    biographyFatigueMod: num(pe.biographyFatigueMod), biographyReactionMod: num(pe.biographyReactionMod),
    timeOfLastSkillTraining: num(pe.timeOfLastSkillTraining),
    lastSkillCheckTime: num(pe.timeOfLastSkillIncreaseCheck),
    daedraSummonDay: num(pe.daedraSummonDay), daedraSummonIndex: num(pe.daedraSummonIndex),
    lastTimePlayerAteOrDrankAtTavern: num(pe.lastTimePlayerAteOrDrankAtTavern),
    minMetalToHit: enumValue(pe.minMetalToHit ?? 'None', E.DFU_WEAPON_MATERIAL_TYPES),

    stats,
    skills,
    skillUses: Array.from({ length: 35 }, (_, i) => num(pe.skillUses?.[i])),
    career,
    items: items.items,
    goldPieces: num(pe.goldPieces),
    wagonItems: wagon.items,
    otherItems: other.items,
    sceneCache: { permanentScenes: [...(sd.sceneCache?.permanentScenes ?? [])], scenes: [] },
    bankAccounts: bank.bankAccounts,
    houses: bank.houses,
    ownedShip: bank.ownedShip,
    // The boarding memory: DFU's Unity-local `position` is under ITS
    // floating origin and cannot be re-expressed here, but the world
    // units can, and the ship arrival (world.js shipTransition's
    // consumer) converts them under the port's origin once the pixel
    // is built. AUDIT-DFUSAVE C6: the first draft's `pos: null` landed
    // the disembarking player at the pixel's centre.
    boardShipPosition: pd.boardShipPosition && num(pd.boardShipPosition.worldPosX)
      ? {
        mapPixel: worldCoordToMapPixel(num(pd.boardShipPosition.worldPosX), num(pd.boardShipPosition.worldPosZ)),
        pos: null,
        nativeX: num(pd.boardShipPosition.worldPosX), nativeZ: num(pd.boardShipPosition.worldPosZ),
        y: num(pd.boardShipPosition.position?.y) - num(pd.boardShipPosition.worldCompensation?.y),
        yaw: num(pd.boardShipPosition.yaw),
      }
      : null,
    rentedRooms: (pe.rentedRooms ?? []).map((r) => ({
      name: String(r.name ?? ''), mapId: num(r.mapID), buildingKey: num(r.buildingKey),
      allocatedBedIndex: num(r.allocatedBedIndex), expiryMinutes: dfuSecondsToClassicMinutes(r.expiryTime),
    })),
    anchorPosition,
    racialOverridePending: null,
    spells,
    activeEffects: dfuActiveEffects(pe.instancedEffectBundles, warnings),
    sGroupReputations,
    crimeCommitted: enumValue(pe.crimeCommitted ?? 'None', E.DFU_CRIMES),
    haveShownSurrenderDialogue: bool(pe.haveShownSurrenderToGuardsDialogue),
    thievesGuildRequirementTally: num(pe.thievesGuildRequirementTally),
    darkBrotherhoodRequirementTally: num(pe.darkBrotherhoodRequirementTally),
    timeForThievesGuildLetter: num(pe.timeForThievesGuildLetter),
    timeForDarkBrotherhoodLetter: num(pe.timeForDarkBrotherhoodLetter),
    legalRep,
    pendingFactionRep: [],
    backStory: [...(save.backStory ?? [])],
    lightSourceIndex,
    factionRep: dfuFactionRep(save.factionData),
    guildMemberships: { mortal: dfuMembershipBook(pd.guildMemberships, warnings), vampire: dfuMembershipBook(pd.vampireMemberships, warnings) },
    discovery,
    automap: null,
    regionPrices,
    regionConditions,
    skillsRecentlyRaised: [num(pe.skillsRecentlyRaised?.[0]), num(pe.skillsRecentlyRaised?.[1])],
    previousVampireClan: enumValue(pe.previousVampireClan ?? 'None', E.DFU_VAMPIRE_CLANS),
    timeToBecomeVampireOrWerebeast: num(pe.timeToBecomeVampireOrWerebeast),
  };
  if (bank.ownedShip < 0 && pd.boardShipPosition) snap.boardShipPosition = null;
  if (pd.boardShipPosition && snap.boardShipPosition) warnings.push('the save was made aboard your ship: leaving it puts you back where you boarded');

  return {
    snap,
    saveName: String(save.info?.saveName ?? ''),
    characterName: String(save.info?.characterName ?? snap.name),
    classicMinutes: importedMinutes,
    warnings,
    screenshot: save.screenshot ?? null,
  };
}
