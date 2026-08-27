// X11b: CREATE ITEM (Mysticism 2,255) and the CONJURED-ITEM FAMILY.
// Verbatim from DFU (MIT, Daggerfall Workshop):
//   Effects/Mysticism/CreateItem.cs   - the 29-row picker and the mint
//   Items/DaggerfallUnityItem.cs:405-419 - TimeForItemToDisappear / IsSummoned
//   Items/ItemCollection.cs:120-150   - RemoveExpiredItems
//   Items/ItemCollection.cs:370-405   - GetItem(priorityToConjured)
//   Items/ItemCollection.cs:700-718   - FindExistingStack's expiry clause
//   Entities/PlayerEntity.cs:420-421  - the per-minute sweep's home
//
// WHAT THE EFFECT IS. Almost nothing happens in the effect class: it
// supports DURATION alone, shows no spell icon, and its whole payload
// is `PromptPlayer()` in Start (:96-110) - push a list picker, and when
// the player picks, mint that item, drop it in the bag with a lifetime,
// and End() at once. The comment on that End is the design in one line:
// "End effect now - conjured item reports own lifetime". So there is no
// live effect entry to tick; the ITEM is the effect.
//
// THE LIFETIME. `TimeForItemToDisappear = gameMinutes + RoundsRemaining`
// (:236-237). RoundsRemaining is the FULL rolled duration, because
// SetDuration runs inside Start (EntityEffect.cs:528-534) and the
// picker is modal - the clock does not advance while it is up, and the
// initial magic round has not run yet. A round is a classic minute, so
// the duration in rounds IS the lifetime in minutes.
//
// THE PICKER CANNOT BE CANCELLED (`itemPicker.AllowCancel = false`,
// :70). The magicka is already spent; DFU makes you choose. And
// `lastSelectedIndex` is a STATIC (:35): the picker reopens on the row
// you took last time, across casts and across characters in one run.
//
// FOUR CONSUMERS make the lifetime mean something, and all four are
// laws rather than decoration:
//   1. the per-minute sweep, which UNEQUIPS before it removes -
//      otherwise a vanished cuirass leaves its armour value behind;
//   2. IsStackable's summoned clause (inventory.js) - only conjured
//      ARROWS stack, and FindExistingStack's expiry clause keeps two
//      conjured stacks with different lifetimes apart;
//   3. GetItem's priorityToConjured (inventory.js) - the bow spends the
//      arrows that are about to vanish anyway, shortest life first;
//   4. TransferItem's refusal - a summoned item cannot be dropped,
//      sold, or put in the wagon (DaggerfallInventoryWindow.cs:1465).
//
// NOT PORTED, and named rather than half-built: the inventory window's
// summonedItemBackgroundColor and the HUD's conjuredArrowsColor. Both
// are one row of an unbuilt feature - the port's native inventory
// window draws no item-background colours at all (quest items and the
// light source have none either), and the HUD arrow counter is not
// built (GUI/EnableArrowCounter is a stored setting with no consumer).
// A lone constant with no reader is the shape this project keeps
// catching; they land with their windows.

import { addItem, isSummoned, ARROW_TEMPLATE } from './inventory.js';
import { unequipSlot, equipTableOf } from './equip.js';
import { createWeapon } from '../combat/enemyEquipment.js';   // ItemBuilder.CreateWeapon, both arms
import { randomizeArmorVariant } from './shopStock.js';       // ItemBuilder.RandomizeArmorVariant
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { mintCondition, itemBaseValue, templateByIndex } from './itemTemplates.js';
import { DYE_COLORS } from '../characters/dyes.js';

export { isSummoned };

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

/** The picker's rows, in enum order. */
/** CreateItem.lastSelectedIndex (CreateItem.cs:29, :75, :121) - ONE
 *  static shared by every cast in a run, so the picker reopens on the
 *  row the player took last. AUDIT 26 F079: the port kept a module
 *  copy in EACH host, so casting in a dungeon and again outdoors
 *  opened at the other host's remembered row. The law's own module is
 *  the one static both hosts can share. */
let _lastSelectedIndex = 0;
export const lastCreateItemIndex = () => _lastSelectedIndex;
export const setLastCreateItemIndex = (i) => { _lastSelectedIndex = i | 0; };

export const createItemLabels = () => CREATE_ITEM_ROWS.map((r) => r.label);

/**
 * CreateItem.CreateTempItem (:239-286) plus the lifetime stamp
 * (:235-237). `nowMinutes` is ToClassicDaggerfallTime(), `rounds` is
 * the effect's RoundsRemaining.
 *
 * The three arms mirror ItemBuilder's three constructors:
 *  - CreateArmor(gender, race, piece, material) with its DEFAULT
 *    variant of -1, so ApplyArmorSettings takes RandomizeArmorVariant
 *    rather than SetVariant(0) - the same branch a shop shelf takes,
 *    and NOT the one CreateRandomArmor (loot) takes.
 *  - CreateWeapon(weapon, Steel), whose arrow arm ignores the material
 *    and rolls a stack of 1..20.
 *  - CreateMensClothing/CreateWomensClothing(Plain_robes, race) with
 *    variant -1 (a random one of the template's two) and the ctor's
 *    default dye, Blue.
 *
 * Returns null for an index outside the table - DFU's switch simply
 * falls through and `if (item != null)` skips the AddItem (:126-128),
 * so a bad index is silent there and silent here.
 */
export function createTempItem(index, { gender = 'male', nowMinutes = 0, rounds = 0, rolls = Math.random } = {}) {
  const row = CREATE_ITEM_ROWS[index];
  if (!row) return null;
  let item = null;
  if (row.kind === 'armor') {
    item = mintCondition({
      group: 'Armor', templateIndex: row.templateIndex, material: row.material,
      variant: randomizeArmorVariant(row.templateIndex, row.material, rolls),
      name: templateByIndex(row.templateIndex)?.name,
    });
    item.value = itemBaseValue(item);
  } else if (row.kind === 'weapon') {
    item = createWeapon(row.templateIndex, row.material, rolls);
    item.value = itemBaseValue(item);
  } else {
    // Genders.Female picks the women's template; the race decides the
    // art row, which the port resolves at DRAW time from the wearer.
    const templateIndex = gender === 'female' ? WOMENS_PLAIN_ROBES : MENS_PLAIN_ROBES;
    const variants = templateByIndex(templateIndex)?.variants ?? 0;
    item = mintCondition({
      group: gender === 'female' ? 'WomensClothing' : 'MensClothing',
      templateIndex,
      variant: Math.floor(rolls() * variants),
      dye: DYE_COLORS.Blue,
      name: templateByIndex(templateIndex)?.name,
    });
    item.value = itemBaseValue(item);
  }
  // "Set lifetime of item based on spell duration" (:235-237). This is
  // the ONE write that makes it conjured - IsSummoned is derived.
  item.timeForItemToDisappear = nowMinutes + rounds;
  return item;
}

/**
 * The whole spell, from a picked row: mint it, bag it, and answer what
 * was made. `AddItem` is the ordinary stacking add, which is why the
 * expiry clause in stacksWith matters - conjured arrows join a stack
 * only when its lifetime matches exactly.
 */
export function grantCreatedItem(entity, index, opts = {}) {
  const item = createTempItem(index, opts);
  if (!item) return null;
  addItem(entity.items ??= [], item);
  return item;
}

/**
 * ItemCollection.RemoveExpiredItems (:120-150). "Removes items that
 * have expired. Used for magically-created items. Only for the player."
 * DFU's own note on it is worth keeping: "Reverse-engineering suggests
 * this was intended behavior in classic, but classic does not correctly
 * set the item flags so magically-created items never disappear." So
 * this whole family is a DFU restoration of a classic intent, not a
 * classic behaviour - and the port follows DFU, as the doctrine says.
 *
 * THE UNEQUIP IS NOT OPTIONAL. DFU walks every equip slot and unequips
 * the item before removing it (:135-142), because the armour values are
 * a running total: remove a worn cuirass without restoring its slot and
 * the player keeps its protection for ever, on a piece that no longer
 * exists.
 *
 * DFU calls UnequipItem AND UpdateEquippedArmorValues(item, false) as a
 * pair, because its ItemEquipTable.UnequipItem does not touch the armour
 * table. The port's `unequipSlot` DOES - so it is called ONCE here, and
 * adding the second call would restore the value twice.
 *
 * @returns the items removed.
 */
export function removeExpiredItems(entity, nowMinutes) {
  const list = entity?.items;
  if (!Array.isArray(list) || !list.length) return [];
  const doomed = list.filter((it) => isSummoned(it) && it.timeForItemToDisappear < nowMinutes);
  if (!doomed.length) return [];
  const slots = equipTableOf(entity);
  for (const item of doomed) {
    for (let slot = 0; slot < slots.length; slot++) {
      if (slots[slot] === item) unequipSlot(entity, slot);
    }
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  }
  return doomed;
}

/** Internal_Strings "cannotRemoveItem" - the box TransferItem shows
 *  when the player tries to move a summoned item out of the pack
 *  (DaggerfallInventoryWindow.cs:1464-1469). */
export const CANNOT_REMOVE_ITEM_TEXT = 'You cannot remove this item.';
