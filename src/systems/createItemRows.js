// @ts-check
// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): CREATE ITEM'S ROWS, A LEAF. The rows were
// createItem.js's own, and that module pulls the UI in (its window's doors); the item law (systems/itemLaw.js) runs on
// the account service, which loads no UI, and asks one thing of them - which items a cast conjures, the only items that
// vanish. One home, two readers: createItem.js imports and re-exports every name here.

import { ARROW_TEMPLATE } from './inventory.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';

/** WeaponMaterialTypes.Steel (ItemEnums.cs:68). The armour materials
 *  come from ARMOR_MATERIAL, which is the other enum entirely - DFU
 *  keeps two, and CreateItem draws from both. */
const WEAPON_STEEL = 0x0001;

/** ItemGroups.Armor template indices (ARMOR_ENUM's values, named here
 *  so the table below reads like DFU's switch). */
const A = Object.freeze({
  Cuirass: 102, Gauntlets: 103, Greaves: 104, Left_Pauldron: 105,
  Right_Pauldron: 106, Helm: 107, Boots: 108, Buckler: 109,
});
/** ItemGroups.Weapons template indices. */
const W = Object.freeze({
  Dagger: 113, Staff: 115, Longsword: 120, Battle_Axe: 127, Short_Bow: 129,
});
/** MensClothing.Plain_robes / WomensClothing.Plain_robes. */
export const MENS_PLAIN_ROBES = 163;
export const WOMENS_PLAIN_ROBES = 200;

/**
 * CreateItemSelection (CreateItem.cs:38-68), IN ORDER. The order is
 * load-bearing twice over: it is the order the picker lists, and
 * `lastSelectedIndex` is an index into it that survives between casts.
 *
 * `label` is the Internal_Strings row TextManager resolves for each
 * enum name (Internal_Strings.csv - "LeatherCuirass,Leather Cuirass"),
 * read off the shipped CSV rather than spaced out by hand.
 */
const armor = (templateIndex, material) => ({ kind: 'armor', templateIndex, material });
const weapon = (templateIndex) => ({ kind: 'weapon', templateIndex, material: WEAPON_STEEL });
export const CREATE_ITEM_ROWS = Object.freeze([
  { label: 'Leather Cuirass', ...armor(A.Cuirass, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Gauntlets', ...armor(A.Gauntlets, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Greaves', ...armor(A.Greaves, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Left Pauldron', ...armor(A.Left_Pauldron, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Right Pauldron', ...armor(A.Right_Pauldron, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Helm', ...armor(A.Helm, ARMOR_MATERIAL.Leather) },
  { label: 'Leather Boots', ...armor(A.Boots, ARMOR_MATERIAL.Leather) },
  { label: 'Chain Cuirass', ...armor(A.Cuirass, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Gauntlets', ...armor(A.Gauntlets, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Greaves', ...armor(A.Greaves, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Left Pauldron', ...armor(A.Left_Pauldron, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Right Pauldron', ...armor(A.Right_Pauldron, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Helm', ...armor(A.Helm, ARMOR_MATERIAL.Chain) },
  { label: 'Chain Boots', ...armor(A.Boots, ARMOR_MATERIAL.Chain) },
  { label: 'Steel Cuirass', ...armor(A.Cuirass, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Gauntlets', ...armor(A.Gauntlets, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Greaves', ...armor(A.Greaves, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Left Pauldron', ...armor(A.Left_Pauldron, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Right Pauldron', ...armor(A.Right_Pauldron, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Helm', ...armor(A.Helm, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Boots', ...armor(A.Boots, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Buckler', ...armor(A.Buckler, ARMOR_MATERIAL.Steel) },
  { label: 'Steel Dagger', ...weapon(W.Dagger) },
  { label: 'Steel Longsword', ...weapon(W.Longsword) },
  { label: 'Steel Staff', ...weapon(W.Staff) },
  { label: 'Short Bow', ...weapon(W.Short_Bow) },
  { label: 'Arrows', ...weapon(ARROW_TEMPLATE) },
  { label: 'Steel Battle Axe', ...weapon(W.Battle_Axe) },
  { label: 'Robes', kind: 'robes' },
]);
