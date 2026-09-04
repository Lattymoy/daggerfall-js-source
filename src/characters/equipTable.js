// Equip table + slot assignment (Characters C5c).
// 1:1 translation of DFU ItemEquipTable's assignment layer (MIT,
// Daggerfall Workshop) over the extraction-generated rules. Verbatim:
//   - GetFirstSlot: first OPEN of the pair, else just the first (the
//     classic multi-slot behaviour).
//   - GetEquipSlot: group router; a 2H weapon in the right hand makes
//     the next non-LeftOnly weapon replace it THERE; weapons route by
//     hands (RightOnly/Both -> right, LeftOnly -> left, Either ->
//     first open of right,left).
//   - GetItemHands: weapon map -> shields LeftOnly -> None. Bows READ
//     DFU's BowLeftHandWithSwitching setting (ItemEquipTable.cs:
//     633-635): on = LeftOnly, off = the classic Both. AUDIT 58: the
//     port used to pin them to the default, which left the setting
//     half-applied - the two members that DO read it (hud's arrow
//     counter, playerWeapon's switch delay) both assume the table put
//     the bow in the LEFT hand, and it never could.
// Items here are the data shape {group, templateIndex}; equip/unequip
// mechanics (unequip lists, prohibitions) are Systems-arc territory.

import { EQUIP_SLOTS } from './paperdoll.js';
import { ITEM_GROUPS, SLOT_RULES, WEAPON_HANDS, SHIELD_INDICES } from './equipRules.js';
import { getBool } from '../systems/settings.js';   // AUDIT 58: ItemEquipTable.cs:635 reads BowLeftHandWithSwitching

export const ITEM_HANDS = Object.freeze({ None: 0, RightOnly: 1, LeftOnly: 2, Either: 3, Both: 4 });
/** Weapons.Short_Bow / Weapons.Long_Bow - the one switch case in
 *  GetItemHands that is not a constant (ItemEquipTable.cs:633-635). */
export const BOW_HAND_TEMPLATES = Object.freeze([129, 130]);
const GROUP_NAME = { [ITEM_GROUPS.Armor]: 'Armor', [ITEM_GROUPS.Jewellery]: 'Jewellery', [ITEM_GROUPS.MensClothing]: 'MensClothing', [ITEM_GROUPS.WomensClothing]: 'WomensClothing' };

export function getItemHands(item, { bowLeftHand = getBool('Enhancements', 'BowLeftHandWithSwitching') } = {}) {
  // U8f: the player bag speaks STRING groups (the shopStock/loot
  // shape) and worn bag items land in the slots verbatim - accept
  // both conventions here so the 2H-replace rule can inspect them.
  const group = typeof item.group === 'string' ? (ITEM_GROUPS[item.group] ?? ITEM_GROUPS.None) : item.group;
  if (group !== ITEM_GROUPS.Weapons && group !== ITEM_GROUPS.Armor) {
    return ITEM_HANDS.None;
  }
  // AUDIT 58: `case Weapons.Short_Bow: case Weapons.Long_Bow: return
  // DaggerfallUnity.Settings.BowLeftHandWithSwitching ?
  // ItemHands.LeftOnly : ItemHands.Both;` (ItemEquipTable.cs:633-635).
  // The generated WEAPON_HANDS row is DFU's OFF answer and stays the
  // default; this is the branch that made the row conditional. With
  // the setting on the bow lands in EQUIP_SLOTS.LeftHand and bumps a
  // held 2H exactly as a shield does - which is what hud's arrow
  // counter (hud.js:361-365) and playerWeapon.toggleHand (:238) have
  // assumed since AUDIT 28 made the key live.
  if (group === ITEM_GROUPS.Weapons && BOW_HAND_TEMPLATES.includes(item.templateIndex)) {
    return bowLeftHand ? ITEM_HANDS.LeftOnly : ITEM_HANDS.Both;
  }
  const w = WEAPON_HANDS[item.templateIndex];
  if (w) return ITEM_HANDS[w];
  if (SHIELD_INDICES.includes(item.templateIndex)) return ITEM_HANDS.LeftOnly;
  return ITEM_HANDS.None;
}

export function createEquipTable() {
  const slots = new Array(27).fill(null);

  const isSlotOpen = (slot) => slot !== EQUIP_SLOTS.None && slots[slot] === null;
  const getFirstSlot = (a, b) => (isSlotOpen(a) ? a : isSlotOpen(b) ? b : a);

  const resolveRule = (rule) => {
    if (!rule) return EQUIP_SLOTS.None;
    if (rule.slot) return EQUIP_SLOTS[rule.slot];
    return getFirstSlot(EQUIP_SLOTS[rule.pair[0]], EQUIP_SLOTS[rule.pair[1]]);
  };

  const getEquipSlot = (item) => {
    switch (item.group) {
      case ITEM_GROUPS.Gems:
        return getFirstSlot(EQUIP_SLOTS.Crystal0, EQUIP_SLOTS.Crystal1);
      case ITEM_GROUPS.Jewellery:
      case ITEM_GROUPS.Armor:
      case ITEM_GROUPS.MensClothing:
      case ITEM_GROUPS.WomensClothing:
        return resolveRule(SLOT_RULES[GROUP_NAME[item.group]][item.templateIndex]);
      case ITEM_GROUPS.Weapons: {
        // Verbatim: a 2H weapon equipped right-hand pulls the next
        // non-LeftOnly weapon into the right hand.
        const right = slots[EQUIP_SLOTS.RightHand];
        if (right && getItemHands(right) === ITEM_HANDS.Both
          && getItemHands(item) !== ITEM_HANDS.LeftOnly) {
          return EQUIP_SLOTS.RightHand;
        }
        switch (getItemHands(item)) {
          case ITEM_HANDS.RightOnly:
          case ITEM_HANDS.Both:
            return EQUIP_SLOTS.RightHand;
          case ITEM_HANDS.LeftOnly:
            return EQUIP_SLOTS.LeftHand;
          case ITEM_HANDS.Either:
            return getFirstSlot(EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand);
          default:
            return EQUIP_SLOTS.None;
        }
      }
      default:
        return EQUIP_SLOTS.None;
    }
  };

  return { slots, isSlotOpen, getFirstSlot, getEquipSlot };
}
