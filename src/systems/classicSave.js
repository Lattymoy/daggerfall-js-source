// Classic-save conversion. SAV1 shipped the character half: a 1:1
// translation of DFU API/Save/CharacterRecord.cs's ToCharacterDocument
// + StripTransformedRace (MIT, Daggerfall Workshop). SAV2 adds the
// IMPORT CORE: StartGameBehaviour.StartFromClassicSave's data half and
// the PlayerEntity/manager members it calls - AssignItemsAndSpells,
// ImportSpells, AssignGuildMemberships, AssignDiseasesAndPoisons,
// RestoreOldClassSpecials, DaggerfallUnityItem.FromItemRecord,
// FactionFile.Merge, PersistentGlobalVars.ImportClassicGlobalVars,
// DaggerfallBankManager.ReadNativeBankData, Guild.ImportLastRankChange
// and the classic pitch/yaw/weather conversion laws - reshaped into
// ONE pure producer: classicSaveToSnapshot builds the port's own
// SAVE_VERSION envelope (systems/save.js) from an opened SaveGames,
// so the EXISTING restore seam (restorePlayer + the hosts' quickload
// path) is the only consumer a load-classic entry will ever need.
// DFU mutates live singletons instead; the envelope is the recorded
// storage substitution, the same shape S1 chose for made spells.
// Fields the envelope does not carry restore as an old save would -
// additively, by restorePlayer's own charter.
//
// SAV3 mounted the consumers: ui/loadClassicWindow.js is the window,
// scenes/menu.js runs the picker + flow and stashes the opened
// SaveGames (the hand-off slot below), and world.js's classicLoadBoot
// feeds the bundle to the quickload path (snap), the weather sim
// (climateWeathers), the quest machine (globalVars) and the streaming
// world (position).
//
// Recorded divergences (all narrow, all in the Ledger row):
//   - a BROKEN worn item imports into the bag, not the doll - DFU's
//     EquipTable.EquipItem(alwaysEquip) has no broken gate, the
//     port's one equip law does;
//   - GodMode and UsingLeftHandWeapon are read but dropped - the port
//     has neither consumer (no cheat toggles, no left-hand rig);
//   - classic DISEASES import as nothing, verbatim: DFU's own arm is
//     commented out ("TODO: Import classic disease effect") and only
//     the 101/102 lycanthropy ids are read.

import { SKILLS } from './skills.js';
import { VAMPIRE_CLANS, LYCANTHROPY_TYPES } from './infection.js';
import { raceById } from './races.js';
import { RECORD_TYPES, ENVIRONMENTS, isWagonRecord } from '../formats/saveTreeFile.js';
import { readMapSaveDiscovery } from '../formats/saveGames.js';
import { SHIP_TYPES } from './banking.js';
import { SAVE_VERSION } from './save.js';
import { STAT_KEYS_ORDER } from './statMods.js';
import { SOCIAL_GROUP_COUNT } from '../formats/factionFile.js';
import { ITEM_GROUP_BY_ID } from './biography.js';
import { GROUP_TEMPLATE_INDICES, templateFor } from './itemTemplates.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';   // the None sentinel FromItemRecord tests
import { isPotion, isPotionRecipe } from './useItem.js';
import {
  CLASSIC_RECIPE_KEYS,   // PotionRecipe.classicRecipeKeys
  // A4: the flag masks and the legacy artifact-index recovery, at
  // their one home beside createArtifact.
  ITEM_ARTIFACT_MASK, ITEM_IDENTIFIED_MASK, legacyArtifactIndexBitfieldCheck,
} from './loot.js';
import { goldStack } from './inventory.js';
import { equipItem } from './equip.js';
import { guildGroupOfFaction, daySinceZero } from './guilds.js';
import { dateFromClassicMinutes } from './gameDate.js';
import { createVampirismCurse } from './vampirism.js';
import { createLycanthropyCurse } from './lycanthropy.js';
import { SPECIAL_ABILITY_BITS } from './specialAdvantages.js';
import { spellPoints, spellPointMultiplier } from './chargen.js';
import { levelUpSkillSum } from './advancement.js';
import { ClassFile } from '../formats/classFile.js';

/** EntityEnums.Races' transformed tail (races.js owns the selectable
 *  1-8 half; classic stores these three when the player is turned). */
export const TRANSFORMED_RACES = Object.freeze({
  None: -1,           // Races.None
  Vampire: 9, Werewolf: 10, Wereboar: 11,
});

// DFCareer.Stats order (the statMods charter): 0 Strength,
// 1 Intelligence, 2 Willpower, 3 Agility, 4 Endurance, 5 Personality,
// 6 Speed, 7 Luck.
const STAT = Object.freeze({
  Strength: 0, Intelligence: 1, Willpower: 2, Agility: 3,
  Endurance: 4, Personality: 5, Speed: 6, Luck: 7,
});

/**
 * CharacterRecord.StripTransformedRace. Restores the original race for
 * a vampire/werething and removes classic's baked stat and skill
 * bonuses - DFU re-applies them through the effect system instead.
 * MUTATES parsedData.currentStats and parsedData.skills, exactly as
 * the C# writes through its class references.
 * @param {object} parsedData - parseCharacterRecordData output.
 * @param {number} [stripLycanthropyType] - LYCANTHROPY_TYPES value to
 *   strip when the infection was read separately (a were-character
 *   whose racial transform is not active).
 * @returns {{liveRace: number, classicTransformedRace: number}}
 */
export function stripTransformedRace(parsedData, stripLycanthropyType = LYCANTHROPY_TYPES.None) {
  // "If player is not transformed then this will simply return race + 1"
  let liveRace = parsedData.race + 1;
  let classicTransformedRace = TRANSFORMED_RACES.None;
  if (liveRace === TRANSFORMED_RACES.Vampire ||
      liveRace === TRANSFORMED_RACES.Werewolf ||
      liveRace === TRANSFORMED_RACES.Wereboar) {
    classicTransformedRace = liveRace;
    liveRace = parsedData.race2 + 1;
  }

  const stats = parsedData.currentStats;
  const skills = parsedData.skills;

  // Remove vampire bonuses: +20 to every stat but Intelligence, which
  // only the Anthotis add (the vampirism.js law), and +30 to the six
  // vampire skills.
  if (classicTransformedRace === TRANSFORMED_RACES.Vampire) {
    stats[STAT.Strength] -= 20;
    stats[STAT.Willpower] -= 20;
    stats[STAT.Agility] -= 20;
    stats[STAT.Endurance] -= 20;
    stats[STAT.Personality] -= 20;
    stats[STAT.Speed] -= 20;
    stats[STAT.Luck] -= 20;
    if (parsedData.vampireClan === VAMPIRE_CLANS.Anthotis)
      stats[STAT.Intelligence] -= 20;

    skills[SKILLS.Jumping] -= 30;
    skills[SKILLS.Running] -= 30;
    skills[SKILLS.Stealth] -= 30;
    skills[SKILLS.CriticalStrike] -= 30;
    skills[SKILLS.Climbing] -= 30;
    skills[SKILLS.HandToHand] -= 30;
  }

  // Remove werewolf/wereboar bonuses: +40 to four stats, +30 to the
  // seven lycanthrope skills (the vampire six plus Swimming).
  if (classicTransformedRace === TRANSFORMED_RACES.Werewolf ||
      classicTransformedRace === TRANSFORMED_RACES.Wereboar ||
      stripLycanthropyType !== LYCANTHROPY_TYPES.None) {
    stats[STAT.Strength] -= 40;
    stats[STAT.Speed] -= 40;
    stats[STAT.Agility] -= 40;
    stats[STAT.Endurance] -= 40;

    skills[SKILLS.Swimming] -= 30;
    skills[SKILLS.Running] -= 30;
    skills[SKILLS.Stealth] -= 30;
    skills[SKILLS.CriticalStrike] -= 30;
    skills[SKILLS.Climbing] -= 30;
    skills[SKILLS.HandToHand] -= 30;
    skills[SKILLS.Jumping] -= 30;
  }

  return { liveRace, classicTransformedRace };
}

/**
 * CharacterRecord.ToCharacterDocument - the prototypical character
 * document for import, field-for-field. Two laws worth naming:
 * doc.maxHealth comes from parsedData.BASEhealth (the transformed
 * pseudo-race may have altered maxHealth), and the strip above runs
 * FIRST, so the stats and skills below are the restored ones.
 * @param {object} parsedData - parseCharacterRecordData output.
 * @param {number} [stripLycanthropyType]
 */
export function toCharacterDocument(parsedData, stripLycanthropyType = LYCANTHROPY_TYPES.None) {
  const { liveRace, classicTransformedRace } =
    stripTransformedRace(parsedData, stripLycanthropyType);

  return {
    raceTemplate: raceById(liveRace),
    gender: parsedData.gender,
    career: parsedData.career,
    name: parsedData.characterName,
    faceIndex: parsedData.faceIndex,
    workingStats: parsedData.currentStats,
    workingSkills: parsedData.skills,
    reflexes: parsedData.reflexes,
    currentHealth: parsedData.currentHealth,
    maxHealth: parsedData.baseHealth,
    currentSpellPoints: parsedData.currentSpellPoints,
    reputationCommoners: parsedData.reputationCommoners,
    reputationMerchants: parsedData.reputationMerchants,
    reputationNobility: parsedData.reputationNobility,
    reputationScholars: parsedData.reputationScholars,
    reputationUnderworld: parsedData.reputationUnderworld,
    currentFatigue: parsedData.currentFatigue,
    skillUses: parsedData.skillUses,
    skillsRaisedThisLevel1: parsedData.skillsRaisedThisLevel1,
    skillsRaisedThisLevel2: parsedData.skillsRaisedThisLevel2,
    startingLevelUpSkillSum: parsedData.startingLevelUpSkillSum,
    minMetalToHit: parsedData.minMetalToHit,
    armorValues: parsedData.armorValues,
    timeToBecomeVampireOrWerebeast: parsedData.timeToBecomeVampireOrWerebeast,
    hasStartedInitialVampireQuest: parsedData.hasStartedInitialVampireQuest,
    lastTimeVampireNeedToKillSatiated: parsedData.lastTimeVampireNeedToKillSatiated,
    lastTimePlayerAteOrDrankAtTavern: parsedData.lastTimePlayerAteOrDrankAtTavern,
    lastTimePlayerBoughtTraining: parsedData.lastTimePlayerBoughtTraining,
    timeForThievesGuildLetter: parsedData.timeForThievesGuildLetter,
    timeForDarkBrotherhoodLetter: parsedData.timeForDarkBrotherhoodLetter,
    vampireClan: parsedData.vampireClan,
    darkBrotherhoodRequirementTally: parsedData.darkBrotherhoodRequirementTally,
    thievesGuildRequirementTally: parsedData.thievesGuildRequirementTally,
    biographyReactionMod: parsedData.biographyReactionMod,
    classicTransformedRace,
  };
}

// ────────────────────────── SAV2: the import core ──────────────────────────

/** StartFromClassicSave's look conversions (:541-552): classic pitch
 *  -256..256 spans ±45 degrees; 2048 units of classic yaw are 360
 *  degrees. Both keep the `if (x != 0)` guard verbatim (an exact zero
 *  skips the scale - same value, DFU's own shape). */
export const classicPitchDegrees = (pitch) => (pitch !== 0 ? (pitch * 45) / 256 : 0);
export const classicYawDegrees = (yaw) => (yaw !== 0 ? (yaw * 360) / 2048 : 0);

/** The StartFromClassicSave weather loop (:633-643): the 0x80 fog flag
 *  is masked off (DFU's own TODO - fog-on-snow/rain is not built), and
 *  the thunder/snow enum values 5 and 6 swap because classic and Unity
 *  order them opposite ways. Returns a fresh 6-entry array. */
export function convertClassicClimateWeathers(climateWeathers) {
  const out = Uint8Array.from(climateWeathers ?? []);
  for (let i = 0; i < out.length; i++) {
    out[i] &= 0x7f;
    if (out[i] === 5) out[i] = 6;
    else if (out[i] === 6) out[i] = 5;
  }
  return out;
}

/** PersistentGlobalVars.ImportClassicGlobalVars: the 64 quest global
 *  variables, each byte STRICTLY 0 or 1 - anything else throws,
 *  verbatim. Returns [index, bool] entries in the quest machine's
 *  globalVars shape. */
export function classicGlobalVars(saveVars) {
  const entries = [];
  const globals = saveVars.globalVars ?? [];
  for (let i = 0; i < globals.length; i++) {
    if (globals[i] !== 0 && globals[i] !== 1)
      throw new Error('ImportClassicGlobalVars() Ecnountered an unexpected global variable value.');
    entries.push([i, globals[i] === 1]);
  }
  return entries;
}

/** DaggerfallBankManager.ReadNativeBankData - the BankAccount record's
 *  13-byte rows (gold i32, loan i32, due u32, defaulted bool), indexed
 *  by read order. TWO quirks kept verbatim: the loop guard is
 *  `position + 13 < RecordLength`, so the LAST 13-byte row - the one
 *  that ends exactly at the record's end - is never read; and an
 *  over-long record stops at the region count with DFU's error arm.
 *  @param {object|null} bankRecord - the SaveTree BankAccount record.
 *  @param {number} regionCount */
export function classicBankAccounts(bankRecord, regionCount = 62) {
  const accounts = Array.from({ length: regionCount }, (_, regionIndex) => ({
    regionIndex, accountGold: 0, loanTotal: 0, loanDueDate: 0, hasDefaulted: false,
  }));
  if (!bankRecord || bankRecord.recordType !== RECORD_TYPES.BankAccount) return accounts;
  const data = bankRecord.recordData;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  let count = 0;
  while (pos + 13 < data.length) {
    if (count >= accounts.length) break;   // "error reading bank data from classic save"
    accounts[count] = {
      regionIndex: count,
      accountGold: v.getInt32(pos, true),
      loanTotal: v.getInt32(pos + 4, true),
      loanDueDate: v.getUint32(pos + 8, true),
      hasDefaulted: data[pos + 12] !== 0,
    };
    pos += 13;
    count++;
  }
  return accounts;
}

/** PlayerEntity.AssignDiseasesAndPoisons: scan the character's
 *  DiseaseOrPoison records. Ids under 100 are diseases and import as
 *  NOTHING - DFU's own arm is commented out - while 101/102 mark the
 *  lycanthropy strain. */
export function classicLycanthropyType(saveTree) {
  let lycanthropyType = LYCANTHROPY_TYPES.None;
  const character = saveTree.findRecord(RECORD_TYPES.Character);
  if (!character) return lycanthropyType;
  for (const record of saveTree.findRecords(RECORD_TYPES.DiseaseOrPoison, character)) {
    const id = record.parsedData?.id ?? 0;
    if (id === 101) lycanthropyType = LYCANTHROPY_TYPES.Werewolf;
    else if (id === 102) lycanthropyType = LYCANTHROPY_TYPES.Wereboar;
  }
  return lycanthropyType;
}

/** DaggerfallUnityItem.FromItemRecord - one classic item record to the
 *  port's item shape. group/index resolve through the ONE template
 *  table (GetItemTemplate); the classic value/condition/enchantments
 *  ride verbatim; weapons and armor take no dye because the port
 *  renders them from material, which is exactly where GetDyeColor's
 *  weapon/armor arms derive theirs. */
export function classicItemFromRecord(record) {
  const d = record.parsedData;
  const group = ITEM_GROUP_BY_ID[d.group] ?? null;
  const template = group ? templateFor(group, d.index) : null;
  const templateIndex = group ? (GROUP_TEMPLATE_INDICES[group]?.[d.index] ?? null) : null;
  const item = {
    group,
    templateIndex,
    name: d.name,
    material: d.material,      // nativeMaterialValue, raw
    value: d.value,
    flags: d.flags,
    currentCondition: d.currentCondition,
    maxCondition: d.maxCondition,
    typeDependentData: d.typeDependentData,
    enchantmentPoints: d.enchantmentPoints,
    message: d.message,
    // A4: the two IDENTITY BITS the classic flags word carries
    // (DaggerfallUnityItem.cs:96-97). The port models both as booleans
    // on the record - createArtifact writes them where DFU writes the
    // word (:617) - so an import that copied `flags` alone left every
    // classic artifact reading as a plain enchanted item: itemInfo
    // printed its material and armor rating (which an artifact never
    // shows), an imported Oghma Infinium opened the plain book reader
    // instead of its Used payload (useItem.js isBook), and the trade
    // window offered to IDENTIFY an item classic had already
    // identified, at (25 * value) >> 8.
    artifact: (d.flags & ITEM_ARTIFACT_MASK) > 0,
    isIdentified: (d.flags & ITEM_IDENTIFIED_MASK) > 0,
  };
  // "If item is an arrow, typeDependentData is the stack count" -
  // Weapons group index 18.
  item.stackCount = (d.group === 3 && d.index === 18) ? d.typeDependentData : 1;
  // "Convert classic recipes to DFU recipe key" (:1577-1579). The same
  // byte names the recipe on a potion or a recipe sheet; without the
  // conversion an imported bottle carries no key and drinks as
  // nothing. The guard is DFU's - the upper bound only, and the byte
  // is unsigned.
  if ((isPotion(item) || isPotionRecipe(item)) && d.typeDependentData < CLASSIC_RECIPE_KEYS.length) {
    item.potionRecipeKey = CLASSIC_RECIPE_KEYS[d.typeDependentData];
  }
  // "Try to generate artifactIndexBitfield if this data is missing
  // from save" (:1581-1582) - DFU's own comment, at DFU's own place in
  // FromItemRecord: after the recipe conversion, before the variant.
  // A classic record has no bitfield at all, so this is the ONLY thing
  // that gives an imported artifact its index - and the index is what
  // names the artifact's Info description (record 8700 + subtype) and
  // what the Special enchantment's payload dispatch keys on.
  legacyArtifactIndexBitfieldCheck(item);
  // Clothing keeps its dye byte (DyeColors values match classic);
  // currentVariant = playerRecord - template.playerTextureRecord, the
  // cloak's +1 exactly as IsCloak carves it out.
  if (group === 'MensClothing' || group === 'WomensClothing') {
    item.dye = d.color;
    if (template?.variants > 0) {
      const playerRecord = d.image1 & 0x7f;
      const CLOAK_INDICES = new Set([147, 148, 152, 153]);   // Casual/Formal cloaks, both wardrobes (IsCloak's template list)
      item.variant = playerRecord - template.playerTextureRecord - (CLOAK_INDICES.has(templateIndex) ? 1 : 0);
    }
  } else if (template?.variants > 0) {
    item.variant = (d.image1 & 0x7f) - template.playerTextureRecord;
  }
  // The legacy magic array becomes item.enchantments, DISCARDED whole
  // when no entry carries a real type. AUDIT 39: the sentinel is
  // EnchantmentTypes.None = -1 (ItemsFile.cs:113), NOT 0 - 0 is
  // CastWhenUsed, a real enchantment. Classic writes 0xFFFF into the
  // empty slots and the reader takes them signed, so testing against
  // 0 kept a ten-entry array on EVERY imported item and isEnchanted
  // answered true for all of them.
  const enchantments = (d.magic ?? []).map((m) => ({ type: m.type, param: m.param }));
  if (enchantments.some((e) => e.type !== ENCHANTMENT_TYPES.None)) item.enchantments = enchantments;
  return item;
}

/** ImportSpells' record walk: the spellbook CONTAINER's first child is
 *  the spellbook item, and ITS children are the spell records. Each
 *  parsed record keeps the classic name ("player might have custom
 *  names"). A record whose index matches a stock SPELLS.STD entry AND
 *  whose name still matches travels as the index (the envelope's
 *  compact shape); anything else rides whole as a made spell. */
export function classicSpellsFromContainer(containerRecord, spellsByIndex = null) {
  const spells = [];
  const book = containerRecord?.children?.[0];
  if (!book || !(book.children?.length)) return spells;
  for (const spellRecord of book.children) {
    const rec = spellRecord.parsedData;
    if (!rec) continue;   // the C# skips a record the reader refused
    const stock = spellsByIndex?.get?.(rec.index) ?? null;
    if (stock && stock.name === rec.name) spells.push(rec.index);
    else spells.push({ ...rec, effects: rec.effects.map((e) => ({ ...e })), custom: true });
  }
  return spells;
}

/** PlayerEntity.AssignItemsAndSpells + the gold assign (:602-603).
 *  Walks the character's container-held item records into port items,
 *  wagon and bag apart, equips what the character record's 27 equip
 *  slots name, imports the spellbook's spells, and mints the physical
 *  gold as the port's one Currency stack.
 *  @returns {{items, wagonItems, spells, scratch}} */
export function classicItemsAndSpells(saveTree, { spellsByIndex = null } = {}) {
  // The scratch entity exists so the ONE equip law places equipSlot -
  // its table and armor writes are discarded with it.
  const scratch = { items: [], wagonItems: [], spells: [] };
  const character = saveTree.findRecord(RECORD_TYPES.Character);
  if (!character) return { items: [], wagonItems: [], spells: [], scratch };

  const itemRecords = saveTree.findRecords(RECORD_TYPES.Item, character);
  const filtered = saveTree.filterRecordsByParentType(itemRecords, RECORD_TYPES.Container);
  const equippedIds = new Set(character.parsedData?.equippedItems ?? []);

  let spells = [];
  for (const record of filtered) {
    const containerRecord = record.parent;
    const d = record.parsedData;
    // "Some (most likely hacked) classic items have 0 or 65535 in
    // image data" - discarded so bad data cannot crash the game.
    if (d.image1 === 0 || d.image1 === 0xffff) continue;

    const item = classicItemFromRecord(record);

    // The spellbook (MiscItems, group index 0) carries the spells.
    if (item.group === 'MiscItems' && d.index === 0) {
      spells = classicSpellsFromContainer(containerRecord, spellsByIndex);
    }

    // A soul gem (MiscItems, group index 1): the trapped soul rides a
    // child record, its monster id in the child's root SpriteIndex.
    // No child = an empty gem, which the port marks by ABSENCE
    // (mysticism.js's own empty test), where DFU writes
    // MobileTypes.None.
    if (item.group === 'MiscItems' && d.index === 1 && record.children.length > 0) {
      item.trappedSoulType = record.children[0].recordRoot.spriteIndex;
    }

    // The Create Item flag: 0x1000 marks a conjured item, and its
    // record root's Time is the minute it vanishes.
    if ((d.flags & 0x1000) !== 0) item.timeForItemToDisappear = record.recordRoot.time;

    // Wagon or bag by the container (ContainerRecord.IsWagon).
    if (isWagonRecord(containerRecord)) scratch.wagonItems.push(item);
    else scratch.items.push(item);

    // Equip through the port's one equip law when the character
    // record's equip slots name this RecordID - DFU runs this check
    // for EVERY record, wagon-held included (:955-960), so no wagon
    // guard here. (Recorded divergence: the port's law refuses a
    // BROKEN item where DFU's alwaysEquip arm has no such gate - it
    // imports into the bag instead.)
    if (equippedIds.has(record.recordRoot.recordId)) {
      equipItem(scratch, item);
    }
  }

  // GoldPieces (:602-603): the port's gold is the one Currency stack.
  const physicalGold = character.parsedData?.physicalGold ?? 0;
  if (physicalGold > 0) scratch.items.push(goldStack(physicalGold));

  return { items: scratch.items, wagonItems: scratch.wagonItems, spells, scratch };
}

/** PlayerEntity.AssignGuildMemberships + GuildManager.
 *  ImportMembershipData + Guild.ImportLastRankChange: the LIVE
 *  memberships (GuildMembership records) land in the book matching the
 *  character's current state - the vampire book when the character IS
 *  a vampire - and the OldGuild records land in the other. Rank rides
 *  verbatim; the classic minute stamp converts to the port's
 *  day-since-zero through the one date home. */
export function classicGuildMemberships(saveTree, factionDict, vampire = false) {
  const character = saveTree.findRecord(RECORD_TYPES.Character);
  const store = { mortal: {}, vampire: {} };
  if (!character) return store;
  const buildBook = (records) => {
    const book = {};
    for (const record of records) {
      const d = record.parsedData;
      const group = guildGroupOfFaction(factionDict, d.factionId);
      if (group == null || group < 0) continue;
      book[group] = {
        guild: factionDict?.get?.(d.factionId)?.name ?? '',
        rank: d.rank,
        lastRankChange: daySinceZero(dateFromClassicMinutes(d.timeOfLastRankChange)),
      };
    }
    return book;
  };
  const live = buildBook(saveTree.findRecords(RECORD_TYPES.GuildMembership, character));
  const old = buildBook(saveTree.findRecords(RECORD_TYPES.OldGuild, character));
  if (vampire) { store.vampire = live; store.mortal = old; }
  else { store.mortal = live; store.vampire = old; }
  return store;
}

/** FactionFile.Merge - the classic faction table meets the port's
 *  FACTION.TXT store: ONLY the live reputation copies across, "to
 *  prevent bad save data polluting faction structure". Emits the
 *  envelope's own {ids, rep, flags, power} columns. */
export function classicFactionRep(saveVars, store) {
  if (!store?.dict) return null;
  const repById = new Map();
  for (const f of saveVars.factions ?? []) repById.set(f.id, f.rep);
  const ids = [...store.dict.keys()].sort((a, b) => a - b);
  const rep = [], flags = [], power = [];
  for (const id of ids) {
    const f = store.dict.get(id);
    rep.push(repById.has(id) ? repById.get(id) : f.rep);
    flags.push(f.flags);
    power.push(f.power);
  }
  return { ids, rep, flags, power };
}

/** The SAVEVARS region table fanned out to the port's three homes:
 *  legalRep (the court's region-keyed object), regionPrices
 *  (PriceAdjustment, the shops' 750..1250 band), and the CONDITION
 *  half in regionConditions' own snapshot shape. */
export function classicRegionData(saveVars) {
  const legalRep = {};
  const regionPrices = {};
  const regionConditions = [];
  (saveVars.regionData ?? []).forEach((r, i) => {
    if (r.legalRep !== 0) legalRep[i] = r.legalRep;
    regionPrices[i] = r.priceAdjustment;
    regionConditions.push({
      v: [...r.values],
      f: r.flags.map((b) => (b ? 1 : 0)).join(''),
      g: r.flags2.map((b) => (b ? 1 : 0)).join(''),
      p: r.precipitationOverride,
      s: r.severePunishmentFlags,
      t: r.idOfPersecutedTemple,
    });
  });
  return { legalRep, regionPrices, regionConditions };
}

// DFCareer.EffectFlags (DFCareer.cs:399-410): the Paralysis and
// Disease bits, which RestoreOldClassSpecials copies across the four
// tolerance flag bytes.
const EFFECT_FLAG_PARALYSIS = 1;
const EFFECT_FLAG_DISEASE = 64;
const TOLERANCE_FLAG_FIELDS = ['resistanceFlags', 'immunityFlags', 'lowToleranceFlags', 'criticalWeaknessFlags'];

/** StartGameBehaviour.RestoreOldClassSpecials: a transformed character
 *  carries the PRE-curse class in an OldClass record; the specials the
 *  transform overwrote are copied back onto the live career - sunlight
 *  and holy-place damage plus the Paralysis and Disease tolerances for
 *  a vampire, the Disease tolerance alone for a lycanthrope. In the
 *  port's raw-CFG career these live as bits: the two ability bits and
 *  the element's bit in each of the four tolerance bytes. Failures are
 *  swallowed exactly as DFU logs-and-continues. */
export function restoreOldClassSpecials(saveTree, career, classicTransformedRace, lycanthropyType) {
  try {
    const oldClassRecord = saveTree.findRecord(RECORD_TYPES.OldClass);
    if (!oldClassRecord) return false;
    const classFile = new ClassFile();
    classFile.load(oldClassRecord.recordData);
    const old = classFile.career;

    const copyBit = (field, mask) => {
      career[field] = (career[field] & ~mask) | (old[field] & mask);
    };
    const copyTolerance = (mask) => {
      for (const field of TOLERANCE_FLAG_FIELDS) copyBit(field, mask);
    };
    if (classicTransformedRace === TRANSFORMED_RACES.Vampire) {
      copyBit('abilityFlagsAndSpellPointsBitfield', SPECIAL_ABILITY_BITS.sunDamage);
      copyBit('abilityFlagsAndSpellPointsBitfield', SPECIAL_ABILITY_BITS.holyDamage);
      copyTolerance(EFFECT_FLAG_PARALYSIS);
      copyTolerance(EFFECT_FLAG_DISEASE);
    } else if (lycanthropyType !== LYCANTHROPY_TYPES.None) {
      copyTolerance(EFFECT_FLAG_DISEASE);
    }
    return true;
  } catch {
    return false;   // "Could not restore old class specials" - logged and survived
  }
}

/**
 * StartGameBehaviour.StartFromClassicSave's data half, as ONE pure
 * producer: an opened SaveGames in, the port's whole restore bundle
 * out. The `snap` half is a SAVE_VERSION envelope restorePlayer
 * consumes as-is; the rest are the module-store imports the wiring
 * applies beside it (weather array, quest globals, discovery, and the
 * classic world position, which is a host-frame decision).
 *
 * @param {import('../formats/saveGames.js').SaveGames} saveGames - with openSave() done.
 * @param {object} [deps]
 * @param {Map} [deps.spellsByIndex] - the SPELLS.STD index (stock-spell dedup).
 * @param {object} [deps.factionStore] - the live FACTION.TXT store ({dict}).
 * @param {Function} [deps.resolveLocation] - (regionIndex, locationIndex) ->
 *   {mapId, regionName, locationName}|null, MAPS.BSA's side of the
 *   MAPSAVE discovery walk. Absent = no discovery imports (recorded).
 * @param {number[]} [deps.regionLocationCounts] - per-region location
 *   counts for the MAPSAVE walk (with resolveLocation).
 */
export function classicSaveToSnapshot(saveGames, {
  spellsByIndex = null, factionStore = null,
  resolveLocation = null, regionLocationCounts = null,
} = {}) {
  const saveTree = saveGames.saveTree;
  const saveVars = saveGames.saveVars;

  // "should always be a singleton" - the C# throws on anything else.
  const characterRecords = saveTree.findRecords(RECORD_TYPES.Character);
  if (characterRecords.length !== 1) throw new Error('SaveTree CharacterRecord not found.');
  const characterRecord = characterRecords[0];
  const parsed = characterRecord.parsedData;

  // Diseases first - the lycanthropy strain feeds the strip.
  const lycanthropyType = classicLycanthropyType(saveTree);
  const doc = toCharacterDocument(parsed, lycanthropyType);
  const vampire = doc.classicTransformedRace === TRANSFORMED_RACES.Vampire;

  // AssignCharacter's Trim law: classic strings carry trailing
  // whitespace.
  const name = doc.name.trim();
  const career = { ...doc.career, name: doc.career.name.trim() };
  restoreOldClassSpecials(saveTree, career, doc.classicTransformedRace, lycanthropyType);

  // Items, spells, gold and the worn set - the equip law runs on the
  // scratch, whose slot marks ride each item into the envelope.
  const { items, wagonItems, spells, scratch } = classicItemsAndSpells(saveTree, { spellsByIndex });

  // The stats object in the port's keyed shape.
  const stats = {};
  STAT_KEYS_ORDER.forEach((k, i) => { stats[k] = doc.workingStats[i]; });

  // The transform curses re-apply through the effect system, exactly
  // as StartFromClassicSave restores them - on the scratch, so the
  // entry (and the vampire's granted spells) ride the envelope.
  scratch.stats = stats;
  scratch.skills = doc.workingSkills;
  scratch.spells = spells;
  scratch.activeEffects = [];
  if (vampire) {
    createVampirismCurse(scratch, doc.vampireClan, { now: saveVars.gameTime });
  } else if (lycanthropyType !== LYCANTHROPY_TYPES.None) {
    createLycanthropyCurse(scratch, lycanthropyType, { now: saveVars.gameTime });
  }

  const { legalRep, regionPrices, regionConditions } = classicRegionData(saveVars);

  // The 11-wide social-group array; AssignCharacter's five writes.
  const sGroupReputations = new Array(SOCIAL_GROUP_COUNT).fill(0);
  sGroupReputations[0] = doc.reputationCommoners;
  sGroupReputations[1] = doc.reputationMerchants;
  sGroupReputations[2] = doc.reputationScholars;
  sGroupReputations[3] = doc.reputationNobility;
  sGroupReputations[4] = doc.reputationUnderworld;

  const snap = {
    v: SAVE_VERSION,
    // The clock IS classic minutes (FromClassicDaggerfallTime's whole
    // job); restorePlayer derives lastGameMinutes from it, which is
    // exactly PlayerEntity.LastGameMinutes = saveVars.GameTime.
    classicMinutes: saveVars.gameTime,
    position: null,          // the host frame owns it - see the bundle
    pose: {
      yaw: classicYawDegrees(0),   // the CharacterPositionRecord's yaw/pitch land in the bundle
      pitch: 0,
      crouching: false,
      weaponDrawn: saveVars.weaponDrawn,
    },
    readiedSpellIndex: null,
    world: null, locationKey: null, quest: null, talk: null,
    weather: null,           // the sky stands; the zone array rides the bundle

    name,
    gender: doc.gender === 1 ? 'female' : 'male',
    race: doc.raceTemplate?.key ?? 'Breton',
    raceId: doc.raceTemplate?.id ?? 1,
    faceIndex: doc.faceIndex,
    careerIndex: -1,         // the career rides WHOLE; classic saves name no template row
    career,
    level: parsed.level,
    reflexes: doc.reflexes,
    health: doc.currentHealth,
    maxHealth: doc.maxHealth,          // BASEhealth, the ToCharacterDocument law
    magicka: doc.currentSpellPoints,
    // MaxMagicka is DERIVED in DFU (never read from the record); the
    // port's stored ceiling computes through the same formula home.
    maxMagicka: spellPoints(stats.intelligence, spellPointMultiplier(career.abilityFlagsAndSpellPointsBitfield ?? 0x1000)),
    fatigue: doc.currentFatigue,
    currentBreath: saveVars.breathRemaining,
    stats,
    skills: [...doc.workingSkills],
    skillUses: [...doc.skillUses],
    startingLevelUpSkillSum: doc.startingLevelUpSkillSum,
    // SetCurrentLevelUpSkillSum() straight after AssignCharacter.
    currentLevelUpSkillSum: levelUpSkillSum({ career, skills: doc.workingSkills }),
    readyToLevelUp: false, pendingLevel: null,
    chargenDone: true,

    biographyResistDiseaseMod: saveVars.biographyResistDiseaseMod,
    biographyResistMagicMod: saveVars.biographyResistMagicMod,
    biographyAvoidHitMod: saveVars.biographyAvoidHitMod,
    biographyResistPoisonMod: saveVars.biographyResistPoisonMod,
    biographyFatigueMod: saveVars.biographyFatigueMod,
    biographyReactionMod: doc.biographyReactionMod,

    lastSkillCheckTime: saveVars.lastSkillCheckTime,
    timeOfLastSkillTraining: doc.lastTimePlayerBoughtTraining,
    // AUDIT 39: the rest of AssignCharacter's clock/tally block
    // (PlayerEntity.cs:856-861). The document carried all five and the
    // envelope carried none, so restorePlayer's `?? 0` arms zeroed
    // both crime-guild tallies and both letter clocks - a character
    // nine thefts into the Thieves Guild requirement imported at zero
    // and a scheduled invitation never came - and the tavern meal
    // clock arrived undefined.
    lastTimePlayerAteOrDrankAtTavern: doc.lastTimePlayerAteOrDrankAtTavern,
    timeForThievesGuildLetter: doc.timeForThievesGuildLetter,
    timeForDarkBrotherhoodLetter: doc.timeForDarkBrotherhoodLetter,
    darkBrotherhoodRequirementTally: doc.darkBrotherhoodRequirementTally,
    thievesGuildRequirementTally: doc.thievesGuildRequirementTally,
    // A4: the last two AssignCharacter members the document carried
    // and the envelope dropped (PlayerEntity.cs:855-856).
    // timeToBecomeVampireOrWerebeast is classic's three-days stamp and
    // this import is the ONLY way it ever reaches a character - the
    // temple's cure counts it as one more disease and clears it
    // (guildServiceActions.js); dropped, an imported character three
    // days from turning was cured of everything but the turn.
    // minMetalToHit is the weapon-material floor CalculateAttackDamage
    // reads on the target: classic writes Silver on a live
    // vampire/werebeast, and the two curses re-arm it on their next
    // constant round, so this is the value that stands in between.
    timeToBecomeVampireOrWerebeast: doc.timeToBecomeVampireOrWerebeast,
    minMetalToHit: doc.minMetalToHit,
    // And the two masks classic calls SkillsRaisedThisLevel, which
    // AssignCharacter lands word for word in skillsRecentlyRaised
    // (:851-852) - the marks the character sheet highlights on the
    // first visit after an import.
    skillsRecentlyRaised: [doc.skillsRaisedThisLevel1, doc.skillsRaisedThisLevel2],

    items, wagonItems,
    otherItems: [],
    // The envelope's spell shape (save.js S1): a NUMBER is a stock
    // SPELLS.STD index, an OBJECT is a made spell riding whole. The
    // scratch already holds that shape for the imported book; a curse
    // grant (grantVampireSpells) pushes LIVE records, which travel by
    // their index.
    spells: scratch.spells
      .filter((sp) => sp != null)
      .map((sp) => (typeof sp === 'number' ? sp : (sp.custom ? sp : sp.index))),
    activeEffects: scratch.activeEffects,
    lightSourceIndex: -1,

    sGroupReputations,
    reactionMods: null,
    crimeCommitted: saveVars.crimeCommitted,
    haveShownSurrenderDialogue: false,
    legalRep,
    regionPrices,
    regionConditions,
    pendingFactionRep: [],
    factionRep: classicFactionRep(saveVars, factionStore),
    guildMemberships: classicGuildMemberships(
      saveTree, factionStore?.dict ?? null, vampire),

    bankAccounts: classicBankAccounts(saveTree.findRecord(RECORD_TYPES.BankAccount)),
    ownedShip: saveVars.playerOwnedShip ?? SHIP_TYPES.None,
    houses: [], rentedRooms: [],
    anchorPosition: null,
    racialOverridePending: null,

    backStory: [...(saveGames.bioFile?.lines ?? [])],
    sceneCache: null,
    automap: null,
    discovery: null,
  };

  // The MAPSAVE discovery walk lands in the envelope's own discovery
  // shape when the caller supplies the MAPS side of the seam.
  if (resolveLocation && saveGames.mapSave && regionLocationCounts) {
    const perRegion = readMapSaveDiscovery(saveGames.mapSave, regionLocationCounts);
    if (perRegion) {
      const locations = {};
      perRegion.forEach((hits, regionIndex) => {
        for (const locationIndex of hits) {
          const info = resolveLocation(regionIndex, locationIndex);
          if (info?.mapId != null) {
            locations[info.mapId & 0xfffff] = {
              regionName: info.regionName ?? '', locationName: info.locationName ?? '',
            };
          }
        }
      });
      // A4 VERIFIED (Road to 1:1): `buildings` stays EMPTY because the
      // reference leaves it empty. SaveGames.cs:215-248 is the whole
      // of DFU's MAPSAVE handling and it walks locations only - the
      // 0x40 bit per location index, then
      // `gps.DiscoverLocation(regionName, location.Name)` - and
      // PlayerGPS.DiscoverBuilding (:917) has no classic-import caller
      // anywhere in the tree (its callers are PlayerActivate,
      // PlayerEnterExit, TalkManager, the bank and the two secret
      // guilds - all live play). A classic character arrives with
      // every town they had found and no building inside any of them,
      // exactly as they do in DFU. Not a gap; do not "fix" it.
      snap.discovery = { buildings: {}, locations };
    }
  }

  // The CharacterPositionRecord (0x04), NOT the header triple, places
  // the player (SaveTree.cs's own comment); StartFromClassicSave
  // always lands the import in the EXTERIOR world at its X/Z,
  // whatever the save's environment byte says.
  const positionRecord = saveTree.findRecord(RECORD_TYPES.CharacterPositionRecord);
  const root = positionRecord?.recordRoot ?? null;
  if (root) {
    snap.pose.pitch = classicPitchDegrees(root.pitch);
    snap.pose.yaw = classicYawDegrees(root.yaw);
  }

  return {
    snap,
    position: root ? { worldX: root.position.worldX, worldY: root.position.worldY, worldZ: root.position.worldZ } : null,
    environment: saveTree.header?.environment ?? ENVIRONMENTS.Outside,
    climateWeathers: convertClassicClimateWeathers(saveVars.climateWeathers),
    globalVars: classicGlobalVars(saveVars),
    lycanthropyType,
    classicTransformedRace: doc.classicTransformedRace,
    vampireClan: doc.vampireClan,
    saveName: saveGames.saveName,
  };
}

// ── SAV3: the menu -> world hand-off ──────────────────────────────
// The menu's classic-load flow opens the SaveGames and the world host
// converts it once its live deps (spell index, faction dict, maps)
// exist - two hosts, one object, so the slot lives here beside the
// converter rather than in either scene. Taking it clears it: a
// second boot cannot replay a consumed import.
let _pendingClassicSave = null;
export const setPendingClassicSave = (saveGames) => { _pendingClassicSave = saveGames; };
export const peekPendingClassicSave = () => _pendingClassicSave;
export function takePendingClassicSave() {
  const s = _pendingClassicSave;
  _pendingClassicSave = null;
  return s;
}
