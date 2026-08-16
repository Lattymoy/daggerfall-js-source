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

/** Remove ONE item by templateIndex: decrements a stack, splices a
 *  single. Returns true when one was removed (parity audit 2026-08-17:
 *  the player's bow never consumed an Arrow - WeaponManager removes
 *  one per loose). */
export function removeOne(list, templateIndex) {
  const i = list.findIndex((it) => it.templateIndex === templateIndex);
  if (i < 0) return false;
  const it = list[i];
  if ((it.stackCount ?? 1) > 1) it.stackCount--;
  else list.splice(i, 1);
  return true;
}

export function transferAll(fromList, toList) {
  let n = 0;
  for (const item of fromList) { addItem(toList, item); n++; }
  fromList.length = 0;
  return n;
}

/** Unity Mathf.Round: half rounds to EVEN (2.5 -> 2, 3.5 -> 4). */
const roundHalfEven = (x) => {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

/** Leather armor weight AS CODED in DFU (audit F13): the Erisceres
 *  COMMENT says Round, but the code int-divides - (int)(w*4)/2 -
 *  making Mathf.Round a no-op, so verbatim = truncate. Converges
 *  with half-even on every classic template (only Gauntlets scale
 *  odd, and 5/2 banks to 2 both ways); the shapes split at
 *  scaled = 3 mod 4 (2.75 kg -> 1.25, where Round would give 1.5). */
export const leatherWeight = (weightKg) => Math.trunc(Math.trunc(weightKg * 4) / 2) / 4;

/** ItemBuilder.CalculateWeightForMaterial VERBATIM: quarter-kg
 *  quantized - Round(trunc(w*4) * multiplier / 4) / 4 with Unity's
 *  half-to-even Round. (The weapons.js comment 'baseWeight * value/4'
 *  is the shorthand; this is the exact function - an iron and a
 *  daedric dagger BOTH weigh 0.5 kg because Round(2.5) banks to 2.) */
export function weightForMaterial(weightKg, weaponMaterial) {
  const quarterKgs = Math.trunc(weightKg * 4);
  const matQuarterKgs = (quarterKgs * (weightMultipliersByMaterial[weaponMaterial] ?? 4)) / 4;
  return roundHalfEven(matQuarterKgs) / 4;
}

/** Weight in kg: template baseWeight (x stack); weapons + plate armor
 *  through the verbatim material function; leather through the
 *  Erisceres formula AS CODED - trunc(INT(w*4)/2)/4, the int division
 *  making Round a no-op (F13); chain unchanged (its x2 is a VALUE
 *  rule, not weight). */
export function itemWeight(item) {
  const t = templates[item.templateIndex];
  let base = t ? t.baseWeight : 0;
  if (item.group === 'Weapons' && item.name !== 'Arrow' && item.material != null) {
    base = weightForMaterial(base, item.material);
  }
  if (item.group === 'Armor' && item.material != null) {
    if (item.material === 0x0000) base = leatherWeight(base);
    else if (item.material >= 0x0200) base = weightForMaterial(base, item.material - 0x0200); // plate
  }
  return base * (item.stackCount ?? 1);
}

export const totalWeight = (list) => list.reduce((a, i) => a + itemWeight(i), 0);
