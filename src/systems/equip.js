// U8f: EQUIP MECHANICS - DFU ItemEquipTable's equip/unequip half
// (MIT Daggerfall Workshop) over the EXISTING C5a/C5c foundation
// (characters/paperdoll.js EQUIP_SLOTS + characters/equipTable.js's
// verbatim GetEquipSlot/GetItemHands assignment layer, whose header
// defers "equip/unequip mechanics (unequip lists, prohibitions)"
// to this Systems module). Bag items carry STRING groups (the
// shopStock/loot shape); C5c compares numeric ITEM_GROUPS - the
// boundary translates and nothing is duplicated.
//
// EquipItem verbatim: arrows never equip; a worn stack splits ONE
// off (SplitStack - the single joins the bag); equipping a 2H
// unequips BOTH hands; equipping a shield unequips a held 2H; the
// destination slot swaps its occupant out (alwaysEquip); returns
// the unequipped list. Items STAY in the bag and carry equipSlot
// when worn (FilterLocalItems hides them). FLAGGED: equip sounds,
// enchantment start/stop payloads (no enchanted items yet).

import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { ITEM_GROUPS } from '../characters/equipRules.js';
import { createEquipTable, getItemHands as handsOf, ITEM_HANDS } from '../characters/equipTable.js';

export { EQUIP_SLOTS, ITEM_HANDS };
const ARROW = 131;

/** The bag speaks string groups; C5c speaks the numeric enum. */
const numeric = (item) => (typeof item.group === 'string' ? { ...item, group: ITEM_GROUPS[item.group] ?? ITEM_GROUPS.None } : item);
export const getItemHands = (item) => handsOf(numeric(item));

/** The entity's live equip table (lazy; C5c's shape). */
export const equipOf = (entity) => (entity.equip ??= createEquipTable());
export const equipTableOf = (entity) => equipOf(entity).slots;

export const getEquipSlot = (entity, item) => equipOf(entity).getEquipSlot(numeric(item));

/** UnequipItem(slot): clears the slot + the item's mark. */
export function unequipSlot(entity, slot) {
  const slots = equipTableOf(entity);
  const item = slots[slot];
  if (!item) return null;
  slots[slot] = null;
  delete item.equipSlot;
  return item;
}

/** EquipItem verbatim: the unequipped list, or null when the item
 *  cannot equip. */
export function equipItem(entity, item) {
  const slots = equipTableOf(entity);
  const slot = getEquipSlot(entity, item);   // computed ONCE up front (the DFU order)
  if (slot === EQUIP_SLOTS.None) return null;
  if (item.group === 'Weapons' && item.templateIndex === ARROW) return null;   // cannot equip arrows
  if ((item.stackCount ?? 1) > 1) {
    // SplitStack(item, 1): the worn single is its own record
    item.stackCount--;
    item = { ...item, stackCount: 1 };
    entity.items.push(item);
  }
  const unequipped = [];
  const un = (s) => { const it = unequipSlot(entity, s); if (it) unequipped.push(it); };
  if (item.group === 'Weapons' && getItemHands(item) === ITEM_HANDS.Both) {
    un(EQUIP_SLOTS.LeftHand); un(EQUIP_SLOTS.RightHand);   // 2H clears both hands
  }
  if (getItemHands(item) === ITEM_HANDS.LeftOnly) {
    const right = slots[EQUIP_SLOTS.RightHand];
    if (right && getItemHands(right) === ITEM_HANDS.Both) un(EQUIP_SLOTS.RightHand);   // a shield bumps a held 2H
  }
  un(slot);   // swap the occupant out (alwaysEquip)
  item.equipSlot = slot;
  slots[slot] = item;
  return unequipped;
}

export const isEquipped = (item) => item.equipSlot != null;
