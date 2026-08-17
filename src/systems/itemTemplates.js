// E1 economy: item templates (DFU ItemHelper over ItemTemplates.txt,
// MIT Daggerfall Workshop). The 288-template table and the per-group
// template-index arrays live in itemTemplatesData.js (GENERATED - see
// its head). The template is the price/rarity/weight ground truth the
// shop laws consume; the C# enum VALUES are template indices, so a
// group's j-th entry is GROUP_TEMPLATE_INDICES[group][j]
// (ItemHelper.GetEnumArray/GetItemTemplate).

import { TEMPLATE_ROWS, GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';

export { GROUP_TEMPLATE_INDICES };

/** index -> { index, name, basePrice, rarity, weight, hitPoints,
 *  worldTexArchive, worldTexRecord } (the world/inventory icon -
 *  U8c; material-dyed weapon/armor icon variants FLAGGED). */
export const ITEM_TEMPLATES = Object.freeze(TEMPLATE_ROWS.map(([index, name, basePrice, rarity, weight, hitPoints, worldTexArchive, worldTexRecord]) =>
  Object.freeze({ index, name, basePrice, rarity, weight, hitPoints, worldTexArchive, worldTexRecord })));

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
  if (item.group === 'Weapons') return t.basePrice * 3 * (VALUE_MULT_BY_MATERIAL[item.material ?? 0] ?? 1);
  if (item.group === 'Armor') {
    const m = item.material ?? 0;
    if (m === 0x0100) return t.basePrice * 2;                     // chain
    if (m >= 0x0200) return t.basePrice * 3 * (VALUE_MULT_BY_MATERIAL[m - 0x0200] ?? 1);   // plate
    return t.basePrice;                                           // leather
  }
  return t.basePrice;
}
