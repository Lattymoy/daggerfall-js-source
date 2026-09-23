// RRI1 - ROLEPLAY & REALISM: ITEMS 1.3 (Hazelnut & Ralzar, MIT) - THE
// ITEMS: fourteen custom item classes, the template rows they ride, the
// twenty vanilla template patches the mod's ItemTemplates.json merges,
// and the mod's switches. The source is vendored verbatim under
// vendor/roleplay-realism-items/Scripts/ (each class named beside the
// law it restates); the manifest, settings, templates and string table
// beside it.
//
// WHAT A CUSTOM ITEM IS IN DFU. `ItemHelper.RegisterCustomItem(index,
// group, type)` puts a template row past the classic 288 and a CLASS
// whose virtuals DaggerfallUnityItem dispatches to: the inventory
// archive and record, the folded material, the equip slot, the armor
// value, the enchantment power, the equip and swing sounds, the weapon
// type, hands, skill and damage, and a CurrentVariant setter that fixes
// the name. The port's items are plain rows and its laws are pure
// functions, so a class here is a table of those virtuals, and each law
// site asks `customItemClass(templateIndex)` first - DFU's dispatch, one
// line at a time (ONE DFU MEMBER, ONE EXPORT: the law stays where it
// lives; this file only says what the class answers).
//
// Names, not constants, cross to the law sites - 'ChestArmor', 'Either',
// 'Axe', 'EquipAxe', 'Battleaxe' - and the site maps them onto its own
// enum, so this module imports none of the systems it feeds (no cycle,
// no TDZ - the lesson of DW3's install).
import { modSetting } from './modSettings.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { DYE_COLORS, DYE_NAMES } from '../characters/dyes.js';
import { RRI_SPRITES } from './rriIndex.js';

export const RRI_VENDOR = 'roleplay-realism-items';
export const RRI_MOD = Object.freeze({
  guid: '68589945-3fbb-4d58-81a3-3066f3f08539',
  title: 'RoleplayRealism-Items',
  version: '1.3',
  author: 'Hazelnut & Ralzar',
});

/** The mod's switches, read live (RoleplayRealismItemsMod.cs Awake:
 *  every module is a bool in [Modules]; `Enabled` is the mod being
 *  loaded at all). */
export const rriEnabled = () => modSetting(RRI_VENDOR, 'Enabled') === true;
export const rriModule = (key) => rriEnabled() && modSetting(RRI_VENDOR, key) === true;

// ---- the templates ---------------------------------------------------

/** The fourteen rows the bundle's ItemTemplates.json adds (indices
 *  513-526), verbatim. */
export const RRI_TEMPLATES = Object.freeze([
  { index: 513, name: "Archer's Axe", baseWeight: 3, hitPoints: 500, capacityOrTarget: 0, basePrice: 14, enchantmentPoints: 500, rarity: 2, variants: 0, drawOrderOrEffect: 100, isBluntWeapon: false, isLiquid: false, isOneHanded: true, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 4, playerTextureArchive: 513, playerTextureRecord: 0 },
  { index: 514, name: 'Light Flail', baseWeight: 4, hitPoints: 500, capacityOrTarget: 0, basePrice: 14, enchantmentPoints: 500, rarity: 2, variants: 0, drawOrderOrEffect: 100, isBluntWeapon: true, isLiquid: false, isOneHanded: true, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 6, playerTextureArchive: 514, playerTextureRecord: 0 },
  { index: 515, name: 'Hauberk', baseWeight: 10, hitPoints: 2048, capacityOrTarget: 0, basePrice: 80, enchantmentPoints: 360, rarity: 4, variants: 1, drawOrderOrEffect: 50, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 11, playerTextureArchive: 245, playerTextureRecord: 3 },
  { index: 516, name: 'Chausses', baseWeight: 2, hitPoints: 1536, capacityOrTarget: 0, basePrice: 62, enchantmentPoints: 50, rarity: 4, variants: 1, drawOrderOrEffect: 30, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 10 },
  { index: 517, name: 'Left Spaulder', baseWeight: 1.6, hitPoints: 1024, capacityOrTarget: 0, basePrice: 52, enchantmentPoints: 40, rarity: 4, variants: 1, drawOrderOrEffect: 60, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 17 },
  { index: 518, name: 'Right Spaulder', baseWeight: 1.6, hitPoints: 1024, capacityOrTarget: 0, basePrice: 52, enchantmentPoints: 40, rarity: 4, variants: 1, drawOrderOrEffect: 60, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 22 },
  { index: 519, name: 'Sollerets', baseWeight: 1.6, hitPoints: 1536, capacityOrTarget: 0, basePrice: 42, enchantmentPoints: 160, rarity: 4, variants: 1, drawOrderOrEffect: 20, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 204, worldTextureRecord: 1, playerTextureArchive: 245, playerTextureRecord: 0 },
  { index: 520, name: 'Jerkin', baseWeight: 8, hitPoints: 1600, capacityOrTarget: 0, basePrice: 60, enchantmentPoints: 320, rarity: 4, variants: 1, drawOrderOrEffect: 50, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 11, playerTextureArchive: 245, playerTextureRecord: 3 },
  { index: 521, name: 'Cuisse', baseWeight: 1.8, hitPoints: 1400, capacityOrTarget: 0, basePrice: 54, enchantmentPoints: 40, rarity: 4, variants: 1, drawOrderOrEffect: 30, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 10 },
  { index: 522, name: 'Helmet', baseWeight: 1.5, hitPoints: 1400, capacityOrTarget: 0, basePrice: 60, enchantmentPoints: 740, rarity: 3, variants: 1, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 12, playerTextureArchive: 245, playerTextureRecord: 27 },
  { index: 523, name: 'Boots', baseWeight: 1.4, hitPoints: 1250, capacityOrTarget: 0, basePrice: 35, enchantmentPoints: 150, rarity: 4, variants: 1, drawOrderOrEffect: 20, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 204, worldTextureRecord: 1, playerTextureArchive: 245, playerTextureRecord: 0 },
  { index: 524, name: 'Gloves', baseWeight: 1, hitPoints: 1024, capacityOrTarget: 0, basePrice: 36, enchantmentPoints: 300, rarity: 2, variants: 1, drawOrderOrEffect: 70, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 8 },
  { index: 525, name: 'Left Vambrace', baseWeight: 1.4, hitPoints: 1024, capacityOrTarget: 0, basePrice: 43, enchantmentPoints: 40, rarity: 4, variants: 1, drawOrderOrEffect: 60, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 17 },
  { index: 526, name: 'Right Vambrace', baseWeight: 1.4, hitPoints: 1024, capacityOrTarget: 0, basePrice: 43, enchantmentPoints: 40, rarity: 4, variants: 1, drawOrderOrEffect: 60, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 207, worldTextureRecord: 13, playerTextureArchive: 245, playerTextureRecord: 22 },
].map(Object.freeze));

/** The twenty patches the same file makes to classic rows, verbatim -
 *  DFU merges them by index when the mod is loaded (ItemHelper.cs:1494
 *  TextAssetReader.Merge), whatever its modules say: a Tanto with 40
 *  hit points, a Katana at 3.5 kg, a torch at 0.35 with world record
 *  16, the arrow and every gem at 0.1. */
export const RRI_TEMPLATE_PATCHES = Object.freeze([
  { index: 93, baseWeight: 600.0, basePrice: 1000 },
  { index: 94, basePrice: 3000 },
  { index: 114, hitPoints: 40, rarity: 2 },
  { index: 116, baseWeight: 2, hitPoints: 400 },
  { index: 117, baseWeight: 2.25, hitPoints: 150, rarity: 2 },
  { index: 118, hitPoints: 700, basePrice: 12 },
  { index: 121, baseWeight: 3.5, hitPoints: 350, rarity: 2 },
  { index: 123, baseWeight: 5.5, hitPoints: 450, rarity: 3 },
  { index: 124, baseWeight: 6.0, basePrice: 12 },
  { index: 126, baseWeight: 8.5 },
  { index: 129, hitPoints: 80 },
  { index: 130, hitPoints: 120 },
  { index: 131, baseWeight: 0.1 },
  { index: 140, baseWeight: 0.1 },
  { index: 247, baseWeight: 0.35, worldTextureRecord: 16 },
  { index: 249, baseWeight: 0.15 },
  { index: 252, baseWeight: 0.15 },
  { index: 275, baseWeight: 0.1 },
  { index: 278, baseWeight: 0.1 },
  { index: 279, baseWeight: 0.1 },
].map(Object.freeze));

// ---- the material tables ---------------------------------------------

/** ItemJerkin.GetLeatherMaterialArmorValue, verbatim - the light set's
 *  value by material, `message` 1 being fur. */
export function leatherMaterialArmorValue(material, message) {
  const M = ARMOR_MATERIAL;
  switch (material) {
    case M.Leather: return message === 0 ? 3 : 5;   // Leather (0) / Fur (1)
    case M.Chain: case M.Chain2: return 6;          // Chain (unused)
    case M.Iron: return 5;                          // Brigandine
    case M.Steel: case M.Silver: return 7;
    case M.Elven: return 8;
    case M.Dwarven: return 9;
    case M.Mithril: return 11;
    case M.Adamantium: return 11;
    case M.Ebony: return 12;
    case M.Orcish: return 13;
    case M.Daedric: return 14;
    default: return 0;
  }
}

/** ItemHauberk.GetChainmailMaterialArmorValue, verbatim. */
export function chainmailMaterialArmorValue(material) {
  const M = ARMOR_MATERIAL;
  switch (material) {
    case M.Leather: return 3;
    case M.Chain: case M.Chain2: return 5;
    case M.Iron: return 6;
    case M.Steel: case M.Silver: return 8;
    case M.Elven: return 9;
    case M.Dwarven: return 11;
    case M.Mithril: case M.Adamantium: return 13;
    case M.Ebony: return 15;
    case M.Orcish: return 17;
    case M.Daedric: return 18;
    default: return 0;
  }
}

// ---- the classes -----------------------------------------------------

/** The string table (RoleplayRealismItemsModData.csv), the three name
 *  prefixes. */
export const RRI_TEXT = Object.freeze({ mail: 'Mail ', fur: 'Fur ', brig: 'Brigandine ' });

/** ItemBuilder.firstFemaleArchive - the base the classes measure
 *  PlayerTextureArchive against: 245 + morphology for a woman, 249 +
 *  morphology for a man, so `offset` is 0-3 for her and 4-7 for him. */
export const FIRST_FEMALE_ARCHIVE = 245;
const raw = (item) => item?.material ?? ARMOR_MATERIAL.Leather;   // the class's `nativeMaterialValue` field
const msg = (item) => item?.message ?? 0;

/** The light set's InventoryTextureRecord (ItemJerkin, ItemCuisse,
 *  ItemBoots, ItemGloves, ItemLeftVambrace, ItemRightVambrace share
 *  it): the body's row by gender, fur its own record, brigandine +8,
 *  else the leather record. */
function lightRecord(item, { playerTextureArchive }) {
  let offset = playerTextureArchive - FIRST_FEMALE_ARCHIVE;
  offset = (offset < 4) ? 2 : 6;
  if (raw(item) === ARMOR_MATERIAL.Leather && msg(item) === 1) return offset;
  if (raw(item) >= ARMOR_MATERIAL.Iron) return 8 + offset;
  return (offset < 4) ? 16 : 17;
}
/** ItemHelmet's own: four body rows. */
function helmetRecord(item, { playerTextureArchive }) {
  let offset = playerTextureArchive - FIRST_FEMALE_ARCHIVE;
  let leather = 16;
  switch (offset) {
    case 1: case 2: case 3: offset = 2; leather = 16; break;
    case 4: case 6: offset = 6; leather = 17; break;
    case 0: offset = 1; leather = 18; break;
    case 5: case 7: offset = 5; leather = 19; break;
    default: break;
  }
  if (raw(item) === ARMOR_MATERIAL.Leather && msg(item) === 1) return offset;
  if (raw(item) >= ARMOR_MATERIAL.Iron) return 8 + offset;
  return leather;
}

/** The light set's CurrentVariant setter: a plate material is
 *  brigandine (the name says so), Chain is FUR - the material folds to
 *  Leather, `message` 1 marks it, and (the jerkin alone) 2 kg comes
 *  off. Runs once, at the mint - as SetVariant runs once in
 *  ApplyArmorSettings. Answers the fields it changes. */
function lightVariant(item, { jerkin = false } = {}) {
  const out = {};
  let name = item.name ?? '';
  if (raw(item) >= ARMOR_MATERIAL.Iron) name = RRI_TEXT.brig + name;
  if (raw(item) === ARMOR_MATERIAL.Chain) {
    name = RRI_TEXT.fur + name;
    out.material = ARMOR_MATERIAL.Leather;
    out.message = 1;
    // AUDIT-RR F5: weightInKg is a stored field ApplyArmorMaterial left at the template's for Chain (ItemBuilder.cs:495-497:
    // only Leather halves it) and the fold does not touch; the jerkin alone takes 2 kg off (ItemJerkin.cs:43). Written
    // here so the port's derived read (which would halve a Leather piece) answers the stored number instead.
    const stored = Number.isFinite(item.weightInKg) ? item.weightInKg : (RRI_TEMPLATES.find((t) => t.index === item.templateIndex)?.baseWeight ?? 0);   // the mod's own row - no reach into the registry this module feeds
    out.weightInKg = jerkin ? stored - 2 : stored;
  }
  if (name !== (item.name ?? '')) out.name = name;
  return out;
}
/** The chain set's: a plate material is MAIL. */
function mailVariant(item) {
  return raw(item) >= ARMOR_MATERIAL.Iron ? { name: RRI_TEXT.mail + (item.name ?? '') } : {};
}

/** GetEnchantmentPower, the same in every armor class: the raw material's
 *  multiplier over the template's points (FormulaHelper
 *  .GetArmorEnchantmentMultiplier), floored. `multiplier` is the
 *  site's own table, handed in. */
const armorEnchant = (item, { enchantmentPoints, armorEnchantmentMultiplier }) =>
  enchantmentPoints + Math.floor(enchantmentPoints * armorEnchantmentMultiplier(raw(item)));

const weaponClass = (index, groupIndex, { min, max, skill, type, magicType, equipSound }) => Object.freeze({
  index, group: 'Weapons', groupIndex,
  inventoryTextureArchive: index,
  baseDamageMin: () => min, baseDamageMax: () => max,
  weaponSkillUsed: skill,                     // DFCareer.ProficiencyFlags -> the site's SKILLS name
  itemHands: 'Either',
  weaponType: (enchanted) => (enchanted ? magicType : type),
  equipSound, swingSound: 'SwingMediumPitch',
});
const chainClass = (index, slot, { leatherRecord, otherRecord, record = null }) => Object.freeze({
  index, group: 'Armor', equipSlot: slot,
  // the chain set keeps the template's archive (245: the body's) and
  // answers a record by material alone
  inventoryTextureArchive: null,
  inventoryTextureRecord: (item) => (record ?? (raw(item) === ARMOR_MATERIAL.Leather ? leatherRecord : otherRecord)),
  nativeMaterialValue: (item) => (raw(item) >= ARMOR_MATERIAL.Iron ? raw(item) - 0x0100 : raw(item)),
  materialArmorValue: (item) => chainmailMaterialArmorValue(raw(item)),
  enchantmentPower: armorEnchant,
  onVariantSet: mailVariant,
});
const lightClass = (index, slot, { jerkin = false, helmet = false } = {}) => Object.freeze({
  index, group: 'Armor', equipSlot: slot,
  inventoryTextureArchive: index,
  inventoryTextureRecord: helmet ? helmetRecord : lightRecord,
  nativeMaterialValue: (item) => (raw(item) >= ARMOR_MATERIAL.Iron ? raw(item) - 0x0200 : raw(item)),
  materialArmorValue: (item) => leatherMaterialArmorValue(raw(item), msg(item)),
  enchantmentPower: armorEnchant,
  equipSound: 'EquipLeather',
  onVariantSet: (item) => lightVariant(item, { jerkin }),
});

/** The fourteen, by template index. */
export const RRI_CLASSES = Object.freeze({
  513: weaponClass(513, 3, { min: 2, max: 10, skill: 'Axe', type: 'Battleaxe', magicType: 'Battleaxe_Magic', equipSound: 'EquipAxe' }),          // ItemArchersAxe
  514: weaponClass(514, 6, { min: 3, max: 10, skill: 'BluntWeapon', type: 'Flail', magicType: 'Flail_Magic', equipSound: 'EquipFlail' }),         // ItemLightFlail
  515: chainClass(515, 'ChestArmor', { leatherRecord: 3, otherRecord: 7 }),      // ItemHauberk
  516: Object.freeze({ ...chainClass(516, 'LegsArmor', { leatherRecord: 10, otherRecord: 16 }),
    // ItemChausses alone has a middle arm: chain-family materials draw 11
    inventoryTextureRecord: (item) => (raw(item) === ARMOR_MATERIAL.Leather ? 10 : (raw(item) >= ARMOR_MATERIAL.Chain && raw(item) < ARMOR_MATERIAL.Silver) ? 11 : 16) }),
  517: chainClass(517, 'LeftArm', { leatherRecord: 17, otherRecord: 21 }),       // ItemLeftSpaulder
  518: chainClass(518, 'RightArm', { leatherRecord: 22, otherRecord: 26 }),      // ItemRightSpaulder
  519: chainClass(519, 'Feet', { record: 0 }),                                   // ItemSollerets
  520: lightClass(520, 'ChestArmor', { jerkin: true }),                          // ItemJerkin
  521: lightClass(521, 'LegsArmor'),                                             // ItemCuisse
  522: lightClass(522, 'Head', { helmet: true }),                                // ItemHelmet
  523: lightClass(523, 'Feet'),                                                  // ItemBoots
  524: lightClass(524, 'Gloves'),                                                // ItemGloves
  525: lightClass(525, 'LeftArm'),                                               // ItemLeftVambrace
  526: lightClass(526, 'RightArm'),                                              // ItemRightVambrace
});

/** DFU's dispatch: the class for a template index, or null - and null
 *  while the mod is off, as an unregistered class is. A class's items
 *  registered under its own switch (newWeapons, newArmor:
 *  RoleplayRealismItemsMod.cs InitMod) answer only while that switch
 *  is on too. */
export function customItemClass(templateIndex) {
  const cls = RRI_CLASSES[templateIndex];
  if (!cls) return null;
  if (!rriModule(cls.group === 'Weapons' ? 'newWeapons' : 'newArmor')) return null;   // rriModule reads Enabled too
  return cls;
}

/** AUDIT-RR F7: the class's NativeMaterialValue virtual (ItemHauberk.cs:31-34, ItemJerkin.cs:65-68) - what
 *  DaggerfallInventoryWindow's forbidden-armor test reads (:1352); a classic item answers its own material. */
export function rriNativeMaterialValue(item) {
  const cls = item ? customItemClass(item.templateIndex) : null;
  return cls?.nativeMaterialValue ? cls.nativeMaterialValue(item) : (item?.material ?? 0);
}
/** AUDIT-RR F8: the class's GetEquipSound virtual (ItemJerkin.cs:82-85 - EquipLeather whatever the material),
 *  by the clip's NAME (this law is a leaf; the equip system owns the clip table); null for a classic item. */
export function rriEquipSound(item) {
  const cls = item ? customItemClass(item.templateIndex) : null;
  return cls?.equipSound ?? null;
}

/** ItemHelper.GetCustomItemsForGroup: the registered custom template
 *  indices for a group, in registration order (the two weapons, the
 *  chain five then the leather seven), empty while off. */
export function customItemsForGroup(group) {
  return Object.values(RRI_CLASSES).filter((c) => c.group === group && customItemClass(c.index)).map((c) => c.index);
}

/** The CurrentVariant setter's writes for a freshly minted item of one
 *  of these classes, or null. The port's minters run this where
 *  ApplyArmorSettings would have run SetVariant. */
export function rriVariantFields(item) {
  const cls = customItemClass(item?.templateIndex);
  if (!cls?.onVariantSet) return null;
  return cls.onVariantSet(item);
}

// ---- the art -----------------------------------------------------------

/** The sprite index, decoded: `<archive>_<record>-<frame>[_<Dye>][_Mask]`
 *  -> { archive, record, frame, dye, map, width, height, rect }. The
 *  `_Mask` names are the helmet's paper-doll masks (TextureMap.Mask,
 *  ItemHelper.cs:453). */
export function rriSpriteEntries(sprites = RRI_SPRITES) {
  const out = [];
  const byName = Object.fromEntries(Object.entries(DYE_NAMES).map(([v, n]) => [n, Number(v)]));
  for (const [name, row] of Object.entries(sprites)) {
    const m = /^(\d{3})_(\d+)-(\d+)(?:_(?!Mask)([A-Z][a-z]+))?(_Mask)?$/.exec(name);
    if (!m) continue;
    const dye = m[4] ? byName[m[4]] : null;
    if (m[4] && dye === undefined) continue;   // a suffix that is not a dye
    if (dye === DYE_COLORS.Unchanged) continue;   // never asked for (dyes.js DYE_NAMES)
    const [width, height, x, y, w, h] = row;
    out.push({ name, archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), dye, map: m[5] ? 'Mask' : 'Albedo', width, height, rect: x === undefined ? null : { x, y, width: w, height: h } });
  }
  return out;
}
