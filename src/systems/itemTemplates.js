// E1 economy: item templates (DFU ItemHelper over ItemTemplates.txt,
// MIT Daggerfall Workshop). The 288-template table and the per-group
// template-index arrays live in itemTemplatesData.js (GENERATED - see
// its head). The template is the price/rarity/weight ground truth the
// shop laws consume; the C# enum VALUES are template indices, so a
// group's j-th entry is GROUP_TEMPLATE_INDICES[group][j]
// (ItemHelper.GetEnumArray/GetItemTemplate).

import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import TEMPLATES_JSON from '../characters/itemTemplates.json' with { type: 'json' };
import { playerArchiveFor } from '../characters/paperdollArt.js';   // AUDIT 17f: SetRace, one home

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

export const templateByIndex = (i) => ITEM_TEMPLATES[i] ?? null;

/** GetItemTemplate(group, groupIndex) - the group's j-th template. */
export function templateFor(group, groupIndex) {
  const idx = GROUP_TEMPLATE_INDICES[group]?.[groupIndex];
  return idx == null ? null : ITEM_TEMPLATES[idx];
}

/** The group's template metas in enum order (GetEnumArray + lookups). */
export function groupTemplates(group) {
  return (GROUP_TEMPLATE_INDICES[group] ?? []).map((i) => ITEM_TEMPLATES[i]);
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

// ---- AUDIT 17e F9: GetItemImage's INVENTORY branch, verbatim ----
// (ItemHelper.cs:399-430 + DaggerfallUnityItem.GetInventoryTexture*
// :1728-1764 + UseWorldTexture :1830-1855.) The item lists draw the
// PLAYER texture for most items; only these groups keep the world
// sprite. Ingredients are the isIngredient flag, not a group.
const WORLD_TEXTURE_GROUPS = new Set(['UselessItems1', 'ReligiousItems', 'MiscItems']);
const ARROW_TEMPLATE = 131;
const KATANA_TEMPLATE = 121;
const CLOAK_TEMPLATES = new Set([154, 155, 191, 192]);

/** UseWorldTexture verbatim. */
export function usesWorldTexture(item, template = templateByIndex(item.templateIndex)) {
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
export function inventoryItemImage(item, identity = undefined) {
  const t = templateByIndex(item.templateIndex);
  if (!t) return null;
  let archive, record;
  if (usesWorldTexture(item, t)) {
    archive = t.worldTextureArchive; record = t.worldTextureRecord;
  } else {
    archive = playerArchiveFor(item, t, identity);
    if ((t.variants ?? 0) > 0) {
      // GetInventoryTextureRecord: start + variant, cloaks skipping
      // their interior-first record
      record = t.playerTextureRecord + (CLOAK_TEMPLATES.has(item.templateIndex) ? 1 : 0)
        + Math.min(item.variant ?? 0, t.variants - 1);
    } else {
      record = t.playerTextureRecord;
    }
    // "Katanas need +1 for inventory image as they use right-hand
    // image instead of left" (ItemHelper.cs:418-421) - the INVENTORY
    // branch only; the paperdoll has its own Either-hand rule.
    if (item.group === 'Weapons' && item.templateIndex === KATANA_TEMPLATE) record += 1;
  }
  // "Use world texture archive if inventory texture not set"
  if (archive === 0 && record === 0) { archive = t.worldTextureArchive; record = t.worldTextureRecord; }
  return { archive, record };
}
