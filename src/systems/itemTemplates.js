// E1 economy: item templates (DFU ItemHelper over ItemTemplates.txt,
// MIT Daggerfall Workshop). The 288-template table and the per-group
// template-index arrays live in itemTemplatesData.js (GENERATED - see
// its head). The template is the price/rarity/weight ground truth the
// shop laws consume; the C# enum VALUES are template indices, so a
// group's j-th entry is GROUP_TEMPLATE_INDICES[group][j]
// (ItemHelper.GetEnumArray/GetItemTemplate).

import { clampArmorVariant } from './armorMaterials.js';   // AUDIT 23 (items-6)
import { conditionMultipliersByMaterial } from '../characters/weapons.js';   // AUDIT 23 (items-5)
import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import TEMPLATES_JSON from '../characters/itemTemplates.json' with { type: 'json' };
import { playerArchiveFor, resolvePaperdollRecord } from '../characters/paperdollArt.js';   // AUDIT 17f: SetRace, one home; NT3 (F006): the record law too
import { itemDyeColor } from './itemDye.js';
import { customItemClass, rriVariantFields, rriStoredWeight } from './rriItems.js';   // RRI1: DFU's custom-item dispatch, asked first   // DW3: GetItemImage's `color = (int)item.dyeColor` (ItemHelper.cs:402) rides the image

export { GROUP_TEMPLATE_INDICES };

/** index -> the VERBATIM DFU template row (ItemTemplates.txt), with
 *  the port's short aliases kept for the shop laws that already read
 *  them. AUDIT 17e F9: this used to come from a lossy generated copy
 *  carrying only the world texture - the player/inventory texture,
 *  the variant count and the paperdoll draw order were all missing,
 *  so inventory icons drew world sprites. */
const _rows = new Array(288).fill(null);
for (const t of TEMPLATES_JSON) {
  _rows[t.index] = Object.freeze({
    ...t,
    weight: t.baseWeight,                 // the port's alias
    worldTexArchive: t.worldTextureArchive,
    worldTexRecord: t.worldTextureRecord,
  });
}
export const ITEM_TEMPLATES = Object.freeze(_rows);

// SURV2: THE PORT'S OWN TEMPLATES, above DFU's 288. A vendored mod's
// items (Climates & Calories' food, waterskin, camping gear, 530-540)
// and the port's own (the campfire, 541) register rows here with the
// same columns, marked `custom`; every reader that goes through
// templateByIndex sees them and the frozen DFU table stays what it is.
const _custom = new Map();
export function registerCustomTemplates(rows) {
  for (const t of rows ?? []) {
    if (!Number.isFinite(t?.index) || t.index < ITEM_TEMPLATES.length) continue;
    _custom.set(t.index, Object.freeze({ custom: true, variants: 0, rarity: 1, enchantmentPoints: 0, playerTextureArchive: 0, playerTextureRecord: 0, isIngredient: false, ...t, weight: t.baseWeight, worldTexArchive: t.worldTextureArchive, worldTexRecord: t.worldTextureRecord }));
  }
  return _custom.size;
}
export const customTemplateCount = () => _custom.size;
// RRI1: A MOD'S PATCHES TO CLASSIC ROWS. ItemHelper.LoadItemTemplates
// (:1488-1494) merges every loaded mod's ItemTemplates.json over the
// classic table by index the moment the mod loads - a Katana at 3.5 kg
// under Roleplay & Realism: Items, whatever its modules say. The frozen
// DFU table stays what it is; a patched row is the classic row with the
// patch over it, and templateByIndex answers it first.
const _overrides = new Map();
export function registerTemplateOverrides(rows) {
  _overrides.clear();
  for (const r of rows ?? []) {
    const base = ITEM_TEMPLATES[r?.index];
    if (!base) continue;
    const t = { ...base, ...r };
    _overrides.set(r.index, Object.freeze({ ...t, weight: t.baseWeight, worldTexArchive: t.worldTextureArchive, worldTexRecord: t.worldTextureRecord }));
  }
  return _overrides.size;
}
export const templateOverrideCount = () => _overrides.size;
export const templateByIndex = (i) => _overrides.get(i) ?? ITEM_TEMPLATES[i] ?? _custom.get(i) ?? null;

/** GetItemTemplate(group, groupIndex) - the group's j-th template. */
export function templateFor(group, groupIndex) {
  const idx = GROUP_TEMPLATE_INDICES[group]?.[groupIndex];
  return idx == null ? null : (_overrides.get(idx) ?? ITEM_TEMPLATES[idx]);   // AUDIT-RR2 G9: GetItemTemplate reads the MERGED table (ItemHelper.cs:1494) - a mod's rarity patch
}

/** The group's template metas in enum order (GetEnumArray + lookups). */
export function groupTemplates(group) {
  return (GROUP_TEMPLATE_INDICES[group] ?? []).map((i) => _overrides.get(i) ?? ITEM_TEMPLATES[i]);   // AUDIT-RR2 G9: the shelf's rarity gate (DaggerfallLoot.cs:219-222) reads the patched row
}

// ItemBuilder.valueMultipliersByMaterial (weapons + plate armor).
export const VALUE_MULT_BY_MATERIAL = Object.freeze([1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);

/** The item's BASE VALUE for cost math (DaggerfallUnityItem.value
 *  after ItemBuilder): weapons/plate = basePrice * 3 * mult[material];
 *  chain armor doubles; everything else is the template basePrice.
 *  Armor materials arrive as the 0x0000/0x0100/0x02xx enum. */
export function itemBaseValue(item) {
  const t = templateByIndex(item.templateIndex);
  if (!t) return 1;
  // AUDIT 17e F14: CreateWeapon's arrow branch never applies the
  // material multiplier (ItemBuilder.cs) - an arrow is worth its
  // basePrice, not 6x it.
  if (item.group === 'Weapons' && item.templateIndex === 131) return t.basePrice;
  if (item.group === 'Weapons') return t.basePrice * 3 * (VALUE_MULT_BY_MATERIAL[item.material ?? 0] ?? 1);
  if (item.group === 'Armor') {
    const m = item.material ?? 0;
    if (m === 0x0100) return t.basePrice * 2;                     // chain
    if (m >= 0x0200) return t.basePrice * 3 * (VALUE_MULT_BY_MATERIAL[m - 0x0200] ?? 1);   // plate
    return t.basePrice;                                           // leather
  }
  return t.basePrice;
}

/** DaggerfallUnityItem.SetItem's two READABLE writes (DaggerfallUnity
 *  Item.cs:555 `shortName = itemTemplate.name`, :563 `value =
 *  itemTemplate.basePrice`, the latter through SetItemPropertiesBy
 *  Material's multiplier - ItemBuilder.cs:649 - which is what
 *  itemBaseValue answers). NO DFU item exists without either, and the
 *  trade window reads `item.value` raw: an undefined one sums to NaN
 *  and CalculateTradePrice's `>> 8` collapses that to 0.
 *
 *  MAC-N1 (2026-09-16, Mac: "Weapon and Armorsmiths dont want to pay
 *  for loot"): this law lived as FIVE private copies - loot.js,
 *  unleveledLoot.js, startingGear.js and two in shopStock.js - and the
 *  corpse's armor (combat/enemyEquipment.js equipmentItems) was minted
 *  by none of them. A cuirass off a dead knight had no value, so the
 *  whole staged lot it sat in priced at NaN, the strip printed NaN and
 *  the smith offered 0 - at exactly the two shops that BUY armor. ONE
 *  DFU MEMBER, ONE EXPORT: this is that member, and every minter
 *  reads it. Fills only what is absent - an item minted with its own
 *  value (an enchantment's sum, a book's price, a recipe's) keeps it -
 *  and answers a COPY, as the copies it replaces did. */
export function setItemFields(item) {
  const named = { ...item, name: item.name ?? templateByIndex(item.templateIndex)?.name };
  // RRI1: a custom class's CurrentVariant setter runs ONCE at the mint
  // (ApplyArmorSettings -> SetVariant): the name's prefix, and for fur
  // the material folded to Leather with `message` 1. Marked, so a
  // second read of the same item does not prefix it twice.
  const variant = named.rriVariant ? null : rriVariantFields(named);
  // AUDIT-RR2 G7: a fur piece folded before AUDIT-RR F5 carries no weightInKg (its save predates the field) and would
  // read the derived leather half; the fold's stored number is written once on the way in
  const legacyWeight = (named.rriVariant && !Number.isFinite(named.weightInKg)) ? rriStoredWeight(named) : null;
  return {
    ...named,
    ...(variant ? { ...variant, rriVariant: true } : {}),
    ...(legacyWeight != null ? { weightInKg: legacyWeight } : {}),
    // AUDIT-RR F5: ApplyArmorMaterial runs BEFORE the class's SetVariant (ItemBuilder.cs:466-485), so a fur piece's
    // value is the CHAIN stage's (x2) - the fold to Leather comes after and value is a stored field; priced on `named`
    value: itemValueOf(named),
  };
}
/** JAN1 (2026-09-18, Janome: "when I try to sell certain items I get COST:NaN ... he offers me 0"): THE ONE VALUE
 *  READ. DFU's `item.value` is always an int; the port's can be absent (an item saved before MAC-N1 set every minter)
 *  or, worse, NaN (a sum over an absent term), and `??` lets NaN through. A value that is not a finite number is no
 *  value: the template's base price answers, as SetItem's own write does. Every price arm reads through here. */
export const itemValueOf = (item) => (Number.isFinite(item?.value) ? item.value : itemBaseValue(item ?? {}));

// ---- AUDIT 17e F9: GetItemImage's INVENTORY branch, verbatim ----
// (ItemHelper.cs:399-430 + DaggerfallUnityItem.GetInventoryTexture*
// :1728-1764 + UseWorldTexture :1830-1855.) The item lists draw the
// PLAYER texture for most items; only these groups keep the world
// sprite. Ingredients are the isIngredient flag, not a group.
const WORLD_TEXTURE_GROUPS = new Set(['UselessItems1', 'ReligiousItems', 'MiscItems']);
const ARROW_TEMPLATE = 131;
const KATANA_TEMPLATE = 121;

/** UseWorldTexture verbatim. */
export function usesWorldTexture(item, template = templateByIndex(item.templateIndex)) {
  if (template?.custom) return true;   // SURV2: a custom template draws its world icon (the item's own fields first, as DFU's world arm does)
  if (WORLD_TEXTURE_GROUPS.has(item.group)) return true;
  if (template?.isIngredient) return true;
  if (item.group === 'Weapons' && item.templateIndex === ARROW_TEMPLATE) return true;
  return false;
}

/** The archive+record an item's INVENTORY LIST icon draws
 *  (GetItemImage with forPaperDoll false). Returns null when the
 *  template is unknown.
 *
 *  AUDIT 17f: the list drew the TEMPLATE's player archive, which is
 *  only the BASE - DFU's SetRace/ApplyArmorSettings offset it by the
 *  wearer's body morphology at creation and GetInventoryTextureArchive
 *  hands that same offset field back (DaggerfallUnityItem.cs:1728-
 *  1735). Nothing added the offset here, so every list drew clothing
 *  from the morphology-0 (Argonian) row and armor from the men's
 *  Argonian archive whoever was wearing it - a human male's short
 *  shirt came off archive 239 instead of 241. `identity` is the
 *  wearer; it defaults to the Breton male the pre-chargen entity is. */

/** AUDIT 23 (items-5): DFU mints EVERY item with condition = template
 *  hitPoints (DaggerfallUnityItem.cs:566-567), and weapons + plate
 *  armor scale it by material (ItemBuilder.SetItemPropertiesByMaterial
 *  :651-652, C# int division). The port's plain-object factories
 *  minted none, so every torch/lantern/candle read as empty and no
 *  looted weapon carried a condition. Idempotent - an item that
 *  already has a condition (magic uses, a save round-trip) keeps it. */
/** The OTHER SetItem law with a draw in it (DaggerfallUnityItem.cs
 *  :571): `message = (itemGroup == ItemGroups.Paintings) ?
 *  UnityEngine.Random.Range(0, 65536) : 0`. A painting's message is
 *  its whole identity - InitPaintingInfo (itemInfo.js) seeds DFRandom
 *  with it and regenerates the picture, the four description records
 *  and the artist from there - so a painting minted without one is a
 *  painting with no picture. It lives beside mintCondition because
 *  every template-backed mint owes both. */
export const PAINTING_MESSAGE_RANGE = 65536;
export const rollPaintingMessage = (rolls = Math.random) => Math.floor(rolls() * PAINTING_MESSAGE_RANGE);

/** DaggerfallUnityItem.ConditionPercentage (:460-463): `maxCondition > 0
 *  ? 100 * currentCondition / maxCondition : 100`, C# integer division. */
export const conditionPercentage = (item) => ((item?.maxCondition ?? 0) > 0 ? Math.trunc(100 * (item.currentCondition ?? 0) / item.maxCondition) : 100);

// ---- ItemHelper.RegisterItemUseHandler (ItemHelper.cs:113-116) --------
/** `Dictionary<int, ItemUseHandler> itemUseHandlers` - a mod's handler for
 *  a template, asked by DaggerfallInventoryWindow.UseItem ahead of the
 *  normal-items ladder (:1703-1709). RRI2: the bandage. */
const _useHandlers = new Map();
export function registerItemUseHandler(templateIndex, handler) { if (typeof handler === 'function') _useHandlers.set(templateIndex, handler); else _useHandlers.delete(templateIndex); }
export const itemUseHandler = (templateIndex) => _useHandlers.get(templateIndex) ?? null;

export function mintCondition(item) {
  if (item.maxCondition != null) return item;
  if (!Object.isExtensible(item)) return item;   // C-slice: the frozen pre-chargen stand-ins (INTERIM_WEAPON) carry no condition
  const t = templateByIndex(item.templateIndex);
  let max = t?.hitPoints ?? 0;
  const mat = item.material;
  if (mat != null && max > 0) {
    if (item.group === 'Weapons') max = Math.trunc((max * (conditionMultipliersByMaterial[mat] ?? 4)) / 4);
    else if (item.group === 'Armor' && mat >= 0x0200) max = Math.trunc((max * (conditionMultipliersByMaterial[mat - 0x0200] ?? 4)) / 4);
  }
  item.maxCondition = max;
  item.currentCondition = max;
  return item;
}

export function inventoryItemImage(item, identity = undefined) {
  const t = templateByIndex(item.templateIndex);
  if (!t) return null;
  // RRI1: a custom class answers InventoryTextureArchive/Record itself
  // (DaggerfallUnityItem's virtuals, ItemHelper.cs:405-406) - the weapons
  // their own archive (513/514) at the template's record, the chain set
  // the body's archive at a record by material, the leather set their
  // own archive at a record by body and material. GetItemImage's katana
  // bump and the world fallback are for the classic rows, not these.
  const cls = customItemClass(item.templateIndex);
  if (cls) {
    const bodyArchive = playerArchiveFor(item, t, identity);
    const archive = cls.inventoryTextureArchive ?? bodyArchive;
    const record = cls.inventoryTextureRecord ? cls.inventoryTextureRecord(item, { playerTextureArchive: bodyArchive }) : t.playerTextureRecord;
    return { archive, record, dye: itemDyeColor(item) };
  }
  let archive, record;
  if (usesWorldTexture(item, t)) {
    // AUDIT 63 F20/F21: GetInventoryTextureArchive/Record's WORLD arms
    // return the ITEM's own fields (DaggerfallUnityItem.cs:1730-1731,
    // :1742-1743), not the template's. The template only SEEDS them
    // (SetItem :556-557); three writers overwrite them afterwards -
    // SetArtifact (:608-609, world = player, which is how the Sanguine
    // Rose and every other world-textured artifact base get their art),
    // the PotionRecipeKey setter (:396-397, `if (IsPotion)
    // worldTextureRecord = potionRecipe.TextureRecord` - the bottle's
    // icon per recipe), and FromItemRecord (:1555-1556, the classic
    // save's own image2 bitfield). Reading the template alone erased
    // all three: every potion drew the same glass bottle.
    archive = Number.isFinite(item.worldTextureArchive) ? item.worldTextureArchive : t.worldTextureArchive;
    record = Number.isFinite(item.worldTextureRecord) ? item.worldTextureRecord : t.worldTextureRecord;
  } else if (item.artifact && Number.isFinite(item.playerTextureRecord)) {
    // AUDIT 63 F21: GetInventoryTextureRecord's artifact carve-out
    // (:1745-1747), verbatim including DFU's own reason - "Use texture
    // record retrieved from MAGIC.DEF for artifacts. Otherwise the
    // below code will give the Oghma Infinium record 2, from the
    // 'Book' template." It stands BEFORE the variants block, and the
    // archive beside it is the item's own playerTextureArchive
    // (:1733), which SetArtifact wrote from GetArtifactTextureIndices
    // (432/433 by gender). The port recomputed both from the base
    // template, so the Oghma Infinium really did draw 209/2.
    archive = Number.isFinite(item.playerTextureArchive) ? item.playerTextureArchive : playerArchiveFor(item, t, identity);
    record = item.playerTextureRecord;
  } else {
    archive = playerArchiveFor(item, t, identity);
    if ((t.variants ?? 0) > 0) {
      // GetInventoryTextureRecord: start + variant, cloaks skipping
      // their interior-first record. AUDIT 23 (items-6): armor rides
      // ItemBuilder.SetVariant's material-family clamps exactly as the
      // paperdoll does - chain/plate armor drew the leather-look icon.
      const v = item.group === 'Armor'
        ? clampArmorVariant(item.templateIndex, item.material ?? 0, item.variant ?? 0)
        : Math.min(item.variant ?? 0, t.variants - 1);
      // NT3 (F006): the record law runs from its ONE home now -
      // resolvePaperdollRecord IS GetInventoryTextureRecord's variant
      // resolution (start + variant, cloaks skipping their
      // interior-first record). This file used to carry a private
      // second copy with its own CLOAK_TEMPLATES set; a correction to
      // the home copy would never have reached the running path.
      record = resolvePaperdollRecord(t, v);
    } else {
      record = t.playerTextureRecord;
    }
  }
  // "Katanas need +1 for inventory image as they use right-hand image
  // instead of left" (ItemHelper.cs:418-420) - the INVENTORY branch
  // only; the paperdoll has its own Either-hand rule. AUDIT 63 F21:
  // this and the fallback below are GetItemImage's, one level ABOVE
  // GetInventoryTexture*, so they run after every arm of the chain -
  // including the artifact carve-out - exactly as C# has them.
  if (item.group === 'Weapons' && item.templateIndex === KATANA_TEMPLATE) record += 1;
  // "Use world texture archive if inventory texture not set" - and the
  // TEMPLATE's, deliberately (ItemHelper.cs:425-429 reads
  // item.ItemTemplate, not the item).
  if (archive === 0 && record === 0) { archive = t.worldTextureArchive; record = t.worldTextureRecord; }
  // DW3: the DYE rides the image - GetItemImage reads item.dyeColor
  // first (:402) and asks the replacement door by it (:453, :458), so
  // an icon door that draws this must ask by it too.
  return { archive, record, dye: itemDyeColor(item) };
}
