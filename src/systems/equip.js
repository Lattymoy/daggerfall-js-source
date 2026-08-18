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
import { ITEM_GROUPS, SLOT_RULES } from '../characters/equipRules.js';
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
  updateEquippedArmorValues(entity, item, false);   // U8h: the armor table adds back
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
  updateEquippedArmorValues(entity, item, true);   // U8h: the armor table subtracts
  return unequipped;
}

export const isEquipped = (item) => item.equipSlot != null;

/** AUDIT 17e C1 - SerializablePlayer.RestoreItems verbatim
 *  (SerializablePlayer.cs:301, :355-368): after items are restored,
 *  the equip TABLE is rebuilt by re-linking each worn item into its
 *  slot, then the armor values are wiped to 100 and re-applied from
 *  the rebuilt table. DFU relinks by item UID; our items carry the
 *  slot itself (item.equipSlot), which survives the JSON round trip,
 *  so the slot IS the link.
 *  Without this, a load left the table empty (every worn item
 *  unreachable - filterByTab hides equipped items, so they vanished
 *  from all four tabs AND the paperdoll, with no way to take them
 *  off) while a same-session load left the table pointing at the
 *  PRE-load item objects and kept the old armor bonus forever. */
export function rebuildEquipState(entity) {
  const slots = equipTableOf(entity);
  slots.fill(null);
  for (const it of entity.items ?? []) {
    if (it.equipSlot == null) continue;
    if (slots[it.equipSlot]) { delete it.equipSlot; continue; }   // two items claiming one slot: the first wins
    slots[it.equipSlot] = it;
  }
  const av = armorValuesOf(entity);
  av.fill(100);   // "Initialize body part armor values to 100 (no armor)"
  for (const it of slots) if (it) updateEquippedArmorValues(entity, it, true);
  return slots;
}

/** INTERIM starting equipment (chargen's starting-gear roll
 *  replaces this): the C8 interim Iron Dagger moves INTO the bag,
 *  equipped, so the worn-weapon FP-rig binding serves it like any
 *  other item. Idempotent per entity. */
export function seedStartingEquipment(entity) {
  if (entity.equip || (entity.items ?? []).length) return;
  entity.items = entity.items ?? [];
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0, flags: 0x10, minDamage: 1, maxDamage: 6 };
  entity.items.push(dagger);
  equipItem(entity, dagger);
}

// ---- U8h: ARMOR VALUES (DaggerfallEntity.UpdateEquippedArmorValues
// verbatim) ----
// The 7-part table starts at 100 each (CharacterDocument: no armor);
// equipping armor SUBTRACTS GetMaterialArmorValue()*5 on its body
// part; shields subtract GetShieldArmorValue()*5 on their protected
// parts MATERIAL-BLIND; unequip adds back. The to-hit law consumes
// armorValues[struckBodyPart] directly (calculateSuccessfulHit), and
// the paperdoll shows (100 - av)/5 per part (RefreshArmourValues;
// the Increased/DecreasedArmorValueModifier channels pend their
// effects). The clothing branch (shoes/boots group indices) runs as
// a no-op in DFU - GetMaterialArmorValue returns 0 for clothing -
// so it is omitted here.

export const BODY_PARTS = Object.freeze({ Head: 0, RightArm: 1, LeftArm: 2, Chest: 3, Hands: 4, Legs: 5, Feet: 6 });
export const NUMBER_BODY_PARTS = 7;
// GetBodyPartForEquipSlot
const SLOT_BODY_PART = new Map([
  [EQUIP_SLOTS.Head, BODY_PARTS.Head], [EQUIP_SLOTS.RightArm, BODY_PARTS.RightArm],
  [EQUIP_SLOTS.LeftArm, BODY_PARTS.LeftArm], [EQUIP_SLOTS.ChestArmor, BODY_PARTS.Chest],
  [EQUIP_SLOTS.Gloves, BODY_PARTS.Hands], [EQUIP_SLOTS.LegsArmor, BODY_PARTS.Legs],
  [EQUIP_SLOTS.Feet, BODY_PARTS.Feet],
]);
// GetMaterialArmorValue: leather 3, chain 6, plate iron..daedric
const PLATE_ARMOR_VALUES = [7, 9, 9, 11, 13, 15, 15, 17, 19, 21];   // iron, steel, silver, elven, dwarven, mithril, adamantium, ebony, orcish, daedric
export function materialArmorValue(material) {
  if (material === 0x0000) return 3;                                   // leather
  if (material === 0x0100 || material === 0x0101) return 6;            // chain
  if (material >= 0x0200) return PLATE_ARMOR_VALUES[material - 0x0200] ?? 0;
  return 0;
}
// GetShieldArmorValue + GetShieldProtectedBodyParts
const SHIELD_VALUES = new Map([[109, 1], [110, 2], [111, 3], [112, 4]]);
const SHIELD_PARTS = new Map([
  [109, [BODY_PARTS.LeftArm, BODY_PARTS.Hands]],
  [110, [BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
  [111, [BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
  [112, [BODY_PARTS.Head, BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
]);
const isShield = (item) => SHIELD_VALUES.has(item.templateIndex);

export const armorValuesOf = (entity) => (entity.armorValues ??= new Array(NUMBER_BODY_PARTS).fill(100));

export function updateEquippedArmorValues(entity, item, equipping) {
  if (item.group !== 'Armor') return;   // (DFU's clothing branch is a value-0 no-op)
  const av = armorValuesOf(entity);
  const sign = equipping ? -1 : 1;
  if (!isShield(item)) {
    // a non-shield armor piece's slot is FIXED by template (the C5c
    // rule table) - no equip-table state involved (DFU GetArmorSlot)
    const rule = SLOT_RULES.Armor[item.templateIndex];
    const part = rule ? SLOT_BODY_PART.get(EQUIP_SLOTS[rule.slot]) : null;
    if (part == null) return;
    av[part] += sign * materialArmorValue(item.material ?? 0) * 5;
  } else {
    const bonus = SHIELD_VALUES.get(item.templateIndex);
    for (const part of SHIELD_PARTS.get(item.templateIndex)) av[part] += sign * bonus * 5;
  }
}
