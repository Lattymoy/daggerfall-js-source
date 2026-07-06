// Inventory core (Systems S2). Verbatim rules from DFU
// DaggerfallUnityItem.IsStackable + ItemCollection.AddItem (MIT,
// Daggerfall Workshop):
//   "Only ingredients, potions, gold pieces, oil and arrows are
//    stackable, but equipped items, enchanted ingredients and quest
//    items are never stackable."
// Potions/oil don't exist as items yet (their groups pend the magic
// and general-items slices) - the rule covers them the day they do.
// Weight: template baseWeight; weapons scale by the ItemBuilder rule
// "Weight is baseWeight * value / 4" through the material multiplier
// table (already single-sourced in weapons.js). Armor material
// weight pends S2b (FLAGGED - leather/chain/plate multipliers).

import templates from '../characters/itemTemplates.json' with { type: 'json' };
import { weightMultipliersByMaterial } from '../characters/weapons.js';

const INGREDIENT_GROUPS = new Set([
  'PlantIngredients1', 'PlantIngredients2', 'CreatureIngredients1',
  'CreatureIngredients2', 'CreatureIngredients3',
  'MiscellaneousIngredients1', 'MiscellaneousIngredients2',
]);

export function isStackable(item) {
  if (item.equipped || item.enchanted || item.questItem) return false;   // never stack
  if (item.group === 'Currency') return true;
  if (item.group === 'Weapons' && item.name === 'Arrow') return true;
  if (INGREDIENT_GROUPS.has(item.group)) return true;
  // Potions + oil join here when their groups exist (the rule names them).
  return false;
}

/** Two records stack when the rule allows and they are the same
 *  thing: group + templateIndex (+ material where it exists). */
export function stacksWith(a, b) {
  return isStackable(a) && isStackable(b) &&
    a.group === b.group && a.templateIndex === b.templateIndex &&
    (a.material ?? null) === (b.material ?? null);
}

/** ItemCollection.AddItem: merge into an existing stack or append. */
export function addItem(list, item) {
  for (const held of list) {
    if (stacksWith(held, item)) {
      held.stackCount = (held.stackCount ?? 1) + (item.stackCount ?? 1);
      return held;
    }
  }
  list.push(item);
  return item;
}

export function transferAll(fromList, toList) {
  let n = 0;
  for (const item of fromList) { addItem(toList, item); n++; }
  fromList.length = 0;
  return n;
}

/** Weight in kg: template baseWeight (x stack); weapons scale by
 *  material multiplier / 4 (ItemBuilder verbatim). */
export function itemWeight(item) {
  const t = templates[item.templateIndex];
  let base = t ? t.baseWeight : 0;
  if (item.group === 'Weapons' && item.name !== 'Arrow' && item.material != null) {
    base = base * (weightMultipliersByMaterial[item.material] ?? 4) / 4;
  }
  // Armor material weight: S2b (FLAGGED)
  return base * (item.stackCount ?? 1);
}

export const totalWeight = (list) => list.reduce((a, i) => a + itemWeight(i), 0);
