// RRI2 - THE KITS. RoleplayRealismItemsMod.cs (Hazelnut & Ralzar, MIT):
// the starting equipment by skill (:759-897), the starting spellbook by
// skill (:900-1096, nine new spells), the three shelf hooks the mod
// subscribes to PlayerActivate.OnLootSpawned (:173-220, :280-310) and
// the bandage's use handler (:186-201). The laws that touch no entity
// (rriRealism.js) and the enemy kit (combat/rriEnemyEquipment.js) are
// beside it; this module is the one that mints and equips, so it
// imports the port's factories and is itself a leaf of nothing.
import { mintCondition, setItemFields, templateByIndex, itemBaseValue } from './itemTemplates.js';
import { addItem, addGoldPieces } from './inventory.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { createRandomPotion, ITEM_GROUPS } from './loot.js';
import { createRandomBook } from './books.js';
import { randomizeArmorVariant } from './shopStock.js';
import { CLOTHING_DYES, DYE_COLORS } from '../characters/dyes.js';
import { WEAPON_MATERIALS, WEAPONS } from '../characters/weapons.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { SKILLS, skillValue, tallySkill } from './skills.js';
import { MATERIAL_BITS } from './specialAdvantages.js';
import { getBool } from './settings.js';
import { addSurvivalProvisions } from './startingGear.js';
import { classicCastingCost } from './spellcost.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { LOOT_CONTAINER_TYPES } from './sceneCache.js';
import { rriModule } from './rriItems.js';
import { liveStat } from './statMods.js';
import { equipTableOf, equipItem } from './equip.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { WEAPON_TYPES } from '../combat/fpsWeapon.js';
import {
  BANDAGE_TEMPLATE, bandageHeal, shelfBandageStack, storeQualityItemCondition, storeQualityOn,
  alchemistPotionCount, alchemistPotionsOn, weaponBalanceOn, rriMeleeWeaponAnimTime,
} from './rriRealism.js';

// ---- GetMeleeWeaponAnimTime (:381-409), the registered override --------------
/** The C# reads the weapon in the hand WeaponManager is using off the
 *  player's equip table and its ItemTemplate.baseWeight, and the live
 *  strength; `weaponType == Melee || weapon == null` is the bare-hands
 *  arm. The port's callers hand `ctx` = { entity, weaponType,
 *  usingRightHand }; without one there is no strength to read and DFU's
 *  line stands. */
export function rriAnimTimeOverride(liveSpeed, ctx, classicFrameUpdate) {
  if (!weaponBalanceOn() || !ctx?.entity) return null;
  const slots = equipTableOf(ctx.entity);
  const weapon = slots?.[ctx.usingRightHand === false ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null;
  const melee = ctx.weaponType === WEAPON_TYPES.Melee || !weapon;
  return rriMeleeWeaponAnimTime({
    liveSpeed, liveStrength: liveStat(ctx.entity, 'strength'),
    weaponWeight: melee ? null : (templateByIndex(weapon.templateIndex)?.baseWeight ?? 0), melee,
  }, classicFrameUpdate);
}

// ---- ItemEnums.cs, the templates the kit names ---------------------------
export const KIT = Object.freeze({
  Spellbook: 132, Torch: 247, Candle: 253,
  // armor
  Cuirass: 102, Gauntlets: 103, Greaves: 104, Right_Pauldron: 106, Helm: 107, Boots: 108,
  // men's / women's clothing
  MensShoes: 147, MensCasualPants: 151, MensCasualCloak: 154, MensKhajiitSuit: 156, MensFormalTunic: 159, MensLoincloth: 162, MensShortShirt: 165,
  WomensShoes: 186, WomensCasualPants: 190, WomensCasualCloak: 191, WomensKhajiitSuit: 193, WomensEveningGown: 195, WomensLoincloth: 199, WomensShortShirtClosed: 206,
});

const range = (rolls, lo, hi) => lo + Math.floor(rolls() * (hi - lo));   // UnityEngine.Random.Range(int, int)
const dice100 = (chance, rolls) => 1 + Math.floor(rolls() * 100) <= chance;   // Dice100.SuccessRoll
const mint = (item) => mintCondition(setItemFields(item));
/** AddOrEquipWornItem (:500-510) over the player: the 30-75% condition
 *  on armor, weapons and garments; `equip` puts it on. */
function addOrEquipWornItem(entity, item, equip, rolls) {
  addItem(entity.items, item);
  if (item.group === 'Armor' || item.group === 'Weapons' || item.group === 'MensClothing' || item.group === 'WomensClothing') {
    item.currentCondition = Math.trunc((0.3 + rolls() * (0.75 - 0.3)) * (item.maxCondition ?? 0));
  }
  if (equip) equipItem(entity, item);
  return item;
}
/** ItemBuilder.CreateMensClothing / CreateWomensClothing (:135-186): a
 *  variant of -1 rolls `Range(0, variants)`, the dye defaults to Blue. */
function clothing(female, templateIndex, rolls, { variant = -1, dye = DYE_COLORS.Blue } = {}) {
  const variants = templateByIndex(templateIndex)?.variants ?? 0;
  return mint({ group: female ? 'WomensClothing' : 'MensClothing', templateIndex, variant: variant < 0 ? (variants > 0 ? range(rolls, 0, variants) : 0) : variant, dye });
}
/** ItemBuilder.CreateArmor (:296-310): a variant of -1 takes
 *  RandomizeArmorVariant. */
function armor(templateIndex, material, rolls, variant = 0) {
  return mint({ group: 'Armor', templateIndex, material, variant: variant < 0 ? randomizeArmorVariant(templateIndex, material, rolls) : variant });
}
const pick = (list, rolls) => list[range(rolls, 0, list.length)];
/** ItemBuilder.CreateRandomGem (:312-319) / CreateRandomIngredient(group)
 *  (:670-699): a uniform draw over the group. */
const randomOf = (group, rolls) => mint({ group, templateIndex: pick(ITEM_GROUPS[group], rolls) });

/** DFCareer.IsMaterialForbidden / IsArmorForbidden (DFCareer.cs:647,
 *  :667): `(flags & f) == f` over ForbiddenMaterials and ForbiddenArmors
 *  (`(WeaponArmorShieldsBitfield >> 6) & 0x07`, :605; Leather 1, Chain 2). */
const materialForbidden = (career, bit) => ((career?.forbiddenMaterialsFlags ?? 0) & bit) === bit;
const armorForbidden = (career, bit) => ((((career?.weaponArmorShieldsBitfield ?? 0) >>> 6) & 0x07) & bit) === bit;
const ARMOR_FLAG_LEATHER = 1, ARMOR_FLAG_CHAIN = 2;

// ---- AssignSkillItems (:812-897) -------------------------------------------
export function assignSkillItems(entity, skill, rolls = Math.random) {
  const career = entity.career ?? {};
  const female = entity.gender === 'female';
  const luck = career.luck ?? 50;
  const upgrade = dice100(Math.trunc(luck / (luck < 56 ? 2 : 1)), rolls);
  let weaponMaterial = WEAPON_MATERIALS.Iron;
  if ((upgrade && !materialForbidden(career, MATERIAL_BITS.steel)) || materialForbidden(career, MATERIAL_BITS.iron)) weaponMaterial = WEAPON_MATERIALS.Steel;
  let armorMaterial = ARMOR_MATERIAL.Leather;
  if ((upgrade && !armorForbidden(career, ARMOR_FLAG_CHAIN)) || armorForbidden(career, ARMOR_FLAG_LEATHER)) armorMaterial = ARMOR_MATERIAL.Chain;
  const worn = (item, equip = false) => addOrEquipWornItem(entity, item, equip, rolls);
  const items = entity.items;
  switch (skill) {
    case SKILLS.Archery: {
      worn(createWeapon(WEAPONS.Short_Bow, weaponMaterial, rolls));
      const arrowPile = createWeapon(WEAPONS.Arrow, WEAPON_MATERIALS.Iron, rolls);
      arrowPile.stackCount = 30;
      addItem(items, arrowPile);
      return;
    }
    case SKILLS.Axe: worn(createWeapon(pick(rriModule('newWeapons') ? [WEAPONS.Battle_Axe, WEAPONS.War_Axe, 513] : [WEAPONS.Battle_Axe, WEAPONS.War_Axe], rolls), weaponMaterial, rolls)); return;
    case SKILLS.Backstabbing: worn(armor(KIT.Right_Pauldron, armorMaterial, rolls)); return;
    case SKILLS.BluntWeapon: worn(createWeapon(pick(rriModule('newWeapons') ? [WEAPONS.Mace, WEAPONS.Flail, WEAPONS.Warhammer, 514] : [WEAPONS.Mace, WEAPONS.Flail, WEAPONS.Warhammer], rolls), weaponMaterial, rolls)); return;
    case SKILLS.Climbing: worn(armor(KIT.Helm, armorMaterial, rolls, -1)); return;
    case SKILLS.CriticalStrike: worn(armor(KIT.Greaves, armorMaterial, rolls)); return;
    case SKILLS.Dodging: worn(clothing(female, female ? KIT.WomensCasualCloak : KIT.MensCasualCloak, rolls)); return;
    case SKILLS.Etiquette: worn(clothing(female, female ? KIT.WomensEveningGown : KIT.MensFormalTunic, rolls)); return;
    case SKILLS.HandToHand: worn(armor(KIT.Gauntlets, armorMaterial, rolls)); return;
    case SKILLS.Jumping: worn(armor(KIT.Boots, armorMaterial, rolls)); return;
    case SKILLS.Lockpicking: addItem(items, createRandomPotion(rolls)); return;
    case SKILLS.LongBlade: worn(createWeapon(dice100(50, rolls) ? WEAPONS.Saber : WEAPONS.Broadsword, weaponMaterial, rolls)); return;
    case SKILLS.Medical: {
      const bandages = mint({ group: 'UselessItems2', templateIndex: BANDAGE_TEMPLATE });
      bandages.stackCount = 4;
      addItem(items, bandages);
      return;
    }
    case SKILLS.Mercantile: addGoldPieces(entity, range(rolls, luck, luck * 4)); return;
    case SKILLS.Pickpocket: addItem(items, randomOf('Gems', rolls)); return;
    case SKILLS.Running: worn(clothing(female, female ? KIT.WomensShoes : KIT.MensShoes, rolls)); return;
    case SKILLS.ShortBlade: worn(createWeapon(dice100(50, rolls) ? WEAPONS.Shortsword : WEAPONS.Tanto, weaponMaterial, rolls)); return;
    case SKILLS.Stealth: worn(clothing(female, female ? KIT.WomensKhajiitSuit : KIT.MensKhajiitSuit, rolls)); return;
    case SKILLS.Streetwise: worn(armor(KIT.Cuirass, armorMaterial, rolls)); return;
    case SKILLS.Swimming: addItem(items, clothing(female, female ? KIT.WomensLoincloth : KIT.MensLoincloth, rolls)); return;
    case SKILLS.Daedric: case SKILLS.Dragonish: case SKILLS.Giantish: case SKILLS.Harpy: case SKILLS.Impish: case SKILLS.Orcish:
      addItem(items, createRandomBook(rolls));
      for (let i = 0; i < 4; i++) addItem(items, randomOf('CreatureIngredients1', rolls));
      return;
    case SKILLS.Centaurian: case SKILLS.Nymph: case SKILLS.Spriggan:
      addItem(items, createRandomBook(rolls));
      for (let i = 0; i < 4; i++) addItem(items, randomOf('PlantIngredients1', rolls));
      return;
    default: return;
  }
}

/** The mod's RandomAxe / RandomBlunt (:427-433) draw the custom weapon
 *  too under newWeapons - spelled inline above by index (513, 514). */

// ---- AssignSkillEquipment (:759-810) ----------------------------------------
/** StartGameBehaviour.AssignStartingEquipment's replacement. The whole
 *  of ItemHelper.AssignStartingGear is set aside: no class weapon, no
 *  100 gold. Instead the ebony dagger a biography answer gave is worn
 *  to 20%, the three primary and three major skills each hand out
 *  their item, the gender's shirt and pants go on (a random dye, a
 *  random variant), the spellbook, `Range(5, Luck)` gold, an iron
 *  dagger, and six torches and four candles under PlayerTorchFromItems.
 *  Answers the items added (newest last), the shape assignStartingGear
 *  answers. */
export function assignSkillEquipment(entity, { rolls = Math.random, torchesFromItems = getBool('Enhancements', 'PlayerTorchFromItems') } = {}) {
  entity.items = entity.items ?? [];
  const before = entity.items.length;
  const career = entity.career ?? {};
  const female = entity.gender === 'female';
  // "Set condition of ebony dagger if player has one from char creation questions"
  for (const dagger of entity.items) {
    if (dagger?.group === 'Weapons' && dagger.templateIndex === WEAPONS.Dagger && (dagger.material ?? 0) > WEAPON_MATERIALS.Steel) {
      dagger.currentCondition = Math.trunc((dagger.maxCondition ?? 0) * 0.2);
    }
  }
  for (const skill of career.primarySkills ?? []) assignSkillItems(entity, skill, rolls);
  for (const skill of career.majorSkills ?? []) assignSkillItems(entity, skill, rolls);
  // "Starting clothes are gender-specific, randomise shirt dye and pants variant"
  const shortShirt = clothing(female, female ? KIT.WomensShortShirtClosed : KIT.MensShortShirt, rolls, { variant: 0, dye: CLOTHING_DYES[range(rolls, 0, CLOTHING_DYES.length)] });
  const casualPants = clothing(female, female ? KIT.WomensCasualPants : KIT.MensCasualPants, rolls);   // RandomizeClothingVariant is the -1 draw
  addOrEquipWornItem(entity, shortShirt, true, rolls);
  addOrEquipWornItem(entity, casualPants, true, rolls);
  // "Add spellbook, all players start with one - also a little gold and a crappy iron dagger for those with no weapon skills."
  addItem(entity.items, mint({ group: 'MiscItems', templateIndex: KIT.Spellbook }));
  addGoldPieces(entity, range(rolls, 5, career.luck ?? 50));
  addItem(entity.items, createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, rolls));
  if (torchesFromItems) {
    for (let i = 0; i < 6; i++) addItem(entity.items, mint({ group: 'UselessItems2', templateIndex: KIT.Torch }));
    for (let i = 0; i < 4; i++) addItem(entity.items, mint({ group: 'UselessItems2', templateIndex: KIT.Candle }));
  }
  const added = entity.items.slice(before);
  addSurvivalProvisions(entity, added);   // the port's own kit rides either assigner (AUDIT SURV E)
  return added;
}

// ---- the nine spells (:1001-1096) as classic records -----------------------
// The mod builds EffectBundleSettings; the port's spellbook and caster
// read SPELLS.STD-shaped records (formats/spellsStd.js), which is the
// same data the other way round - EntityEffectBroker
// .ClassicEffectRecordToEffectSettings (:950-977) maps durationBase/
// Mod/PerLevel, chanceBase/Mod/PerLevel and magnitudeBaseLow/High,
// LevelBase/High, PerLevel onto DurationBase/Plus/PerLevel, Chance...,
// MagnitudeBaseMin/Max, PlusMin/Max, PerLevel, and ClassicTargetIndex/
// ClassicElementIndex onto the two enums (:985-1027). A field the mod's
// initialiser leaves unset is the C# struct's 0, carried as 0 here.
// Each effect's classic key is its DFU class's MakeClassicKey.
const TARGET = Object.freeze({ CasterOnly: 0, ByTouch: 1, SingleTargetAtRange: 2 });
const ELEMENT = Object.freeze({ Shock: 3, Magic: 4 });
const EFFECT_KEY = Object.freeze({
  DamageHealth: [4, 0], Slowfall: [25, 255], LightNormal: [15, 255], CreateItem: [2, 255],
  HealHealth: [10, 8], HealFatigue: [10, 9], Levitate: [14, 255], Open: [17, 255],
});
const UNUSED_EFFECT = Object.freeze({ type: -1, subType: -1, durationBase: 0, durationMod: 0, durationPerLevel: 0, chanceBase: 0, chanceMod: 0, chancePerLevel: 0, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 });
const effect = (key, { duration = [0, 0, 0], chance = [0, 0, 0], magnitude = [0, 0, 0, 0, 0] } = {}) => ({
  type: EFFECT_KEY[key][0], subType: EFFECT_KEY[key][1],
  durationBase: duration[0], durationMod: duration[1], durationPerLevel: duration[2],
  chanceBase: chance[0], chanceMod: chance[1], chancePerLevel: chance[2],
  magnitudeBaseLow: magnitude[0], magnitudeBaseHigh: magnitude[1], magnitudeLevelBase: magnitude[2], magnitudeLevelHigh: magnitude[3], magnitudePerLevel: magnitude[4],
});
/** The port's own indices for the nine, past every SPELLS.STD record. */
export const RRI_SPELL_INDEX_BASE = 990;
function spell(i, name, target, element, icon, effects) {
  const rec = { effects: [...effects, UNUSED_EFFECT, UNUSED_EFFECT].slice(0, 3).map((e) => ({ ...e })), element, rangeType: target, name, icon, index: RRI_SPELL_INDEX_BASE + i, rri: true };
  rec.cost = classicCastingCost(rec);
  return Object.freeze(rec);
}
/** RoleplayRealismItemsModData.csv - the spell names. */
export const RRI_SPELLS = Object.freeze({
  minorShock: spell(0, 'Minor Shock', TARGET.ByTouch, ELEMENT.Shock, 37, [effect('DamageHealth', { magnitude: [2, 10, 1, 2, 1] })]),           // "2-10 + 1-2 per 1 lev"
  arcaneArrow: spell(1, 'Arcane Arrow', TARGET.SingleTargetAtRange, ELEMENT.Magic, 57, [effect('DamageHealth', { magnitude: [5, 6, 1, 1, 2] })]),
  gentleFall: spell(2, 'Gentle Fall', TARGET.CasterOnly, ELEMENT.Magic, 31, [effect('Slowfall', { duration: [2, 1, 2] })]),
  candle: spell(3, 'Candle', TARGET.CasterOnly, ELEMENT.Magic, 22, [effect('LightNormal', { duration: [4, 4, 1] })]),
  knickKnack: spell(4, 'Knick-Knack', TARGET.CasterOnly, ELEMENT.Magic, 26, [effect('CreateItem', { duration: [4, 1, 2] })]),
  salveBruise: spell(5, 'Salve Bruise', TARGET.CasterOnly, ELEMENT.Magic, 13, [effect('HealHealth', { magnitude: [3, 6, 0, 0, 1] })]),
  smellingSalts: spell(6, 'Smelling Salts', TARGET.CasterOnly, ELEMENT.Magic, 10, [effect('HealFatigue', { magnitude: [3, 6, 0, 0, 1] })]),
  rise: spell(7, 'Rise', TARGET.CasterOnly, ELEMENT.Magic, 13, [effect('Levitate', { duration: [1, 1, 2] })]),
  knock: spell(8, 'Knock', TARGET.CasterOnly, ELEMENT.Magic, 3, [effect('Open', { duration: [1, 1, 0], chance: [8, 0, 2] })]),
});

// ---- AssignSkillSpells (:916-968) -------------------------------------------
/** "Classic spell indexes are on https://en.uesp.net/wiki/Daggerfall:SPELLS.STD_indices" */
export function assignSkillSpells(spells, skill, primary, spellsByIndex) {
  const classic = (id) => { const sp = spellsByIndex?.get?.(id); if (sp) spells.push(sp); };
  switch (skill) {
    case SKILLS.Alteration:
      spells.push(RRI_SPELLS.gentleFall);
      if (primary) classic(38);   // Jumping
      return;
    case SKILLS.Destruction:
      spells.push(RRI_SPELLS.arcaneArrow);
      if (primary) spells.push(RRI_SPELLS.minorShock);
      return;
    case SKILLS.Illusion:
      spells.push(RRI_SPELLS.candle);
      if (primary) classic(44);   // Chameleon
      return;
    case SKILLS.Mysticism:
      spells.push(RRI_SPELLS.knock);
      spells.push(RRI_SPELLS.knickKnack);
      if (primary) { classic(1); classic(94); }   // Fenrik's Door Jam, Recall!
      return;
    case SKILLS.Restoration:
      spells.push(RRI_SPELLS.salveBruise);
      if (primary) { spells.push(RRI_SPELLS.smellingSalts); classic(97); }   // Balyna's Balm
      return;
    case SKILLS.Thaumaturgy:
      classic(2);   // Buoyancy
      if (primary) spells.push(RRI_SPELLS.rise);
      return;
    default: return;
  }
}
/** AssignSkillSpellbook (:900-914): StartGameBehaviour.AssignStartingSpells'
 *  replacement - the three primary skills (primary: true) then the three
 *  major. Answers the spell list. */
export function assignSkillSpellbook(career, spellsByIndex) {
  const spells = [];
  for (const skill of career?.primarySkills ?? []) assignSkillSpells(spells, skill, true, spellsByIndex);
  for (const skill of career?.majorSkills ?? []) assignSkillSpells(spells, skill, false, spellsByIndex);
  return spells;
}

// ---- the shelf hooks (PlayerActivate.OnLootSpawned, :884-885) -------------
/** The three subscribers in InitMod's order - StackableBandages (bandaging),
 *  StoreQualityItemCondition (conditionBasedPrices + storeQualityItemCondition),
 *  AddPotions (alchemistPotions) - each gated on `ContainerType ==
 *  ShopShelves`, the last on the Alchemist too. `items` is the shelf's
 *  freshly stocked list; answers it. */
export function onShopShelfStocked(items, { buildingType, quality = 0, containerType = LOOT_CONTAINER_TYPES.ShopShelves } = {}, { rolls = Math.random, randomPotion = createRandomPotion } = {}) {
  if (!Array.isArray(items) || containerType !== LOOT_CONTAINER_TYPES.ShopShelves) return items;
  if (rriModule('bandaging')) {
    const bandage = items.find((it) => it?.group === 'UselessItems2' && it.templateIndex === BANDAGE_TEMPLATE);   // ItemCollection.GetItem: the first
    if (bandage) bandage.stackCount = shelfBandageStack(quality, rolls);
  }
  if (storeQualityOn()) storeQualityItemCondition(items, quality, rolls);
  if (alchemistPotionsOn() && buildingType === BUILDING_TYPES.Alchemist) {
    let numPotions = alchemistPotionCount(quality, rolls);
    while (numPotions > 0) {
      const item = randomPotion(rolls);
      item.value = (item.value ?? itemBaseValue(item)) * 2;
      items.push(item);
      numPotions--;
    }
  }
  return items;
}

// ---- UseBandage (:186-201), the registered use handler ----------------------
/** `Min(medical / 3, MaxHealth * 0.4f)` healed, the bandage taken off the
 *  stack (RemoveOne), Medical tallied once. Handles only with a
 *  collection, as the C# does (`if (collection != null)`), and answers
 *  true either way - the click is consumed. The port's shape is the
 *  result useItem hands its window. */
export function useBandage(item, collection, { entity = null } = {}) {
  if (!rriModule('bandaging')) return null;   // the handler is registered only under bandaging (InitMod :93) - off, the ladder's turn
  if (!collection || !entity) return { kind: 'bandaged', healed: 0 };
  const medical = skillValue(entity, SKILLS.Medical);
  const heal = bandageHeal(medical, entity.maxHealth ?? 0);
  const i = collection.indexOf(item);
  if (i >= 0) { if ((item.stackCount ?? 1) > 1) item.stackCount--; else collection.splice(i, 1); }
  entity.health = Math.min(entity.maxHealth ?? entity.health ?? 0, (entity.health ?? 0) + heal);   // PlayerEntity.IncreaseHealth
  tallySkill(entity, SKILLS.Medical, 1);
  return { kind: 'bandaged', healed: heal };
}
