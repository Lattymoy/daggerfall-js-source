// Equip table + slot assignment (Characters C5c).
// 1:1 translation of DFU ItemEquipTable's assignment layer (MIT,
// Daggerfall Workshop) over the extraction-generated rules. Verbatim:
//   - GetFirstSlot: first OPEN of the pair, else just the first (the
//     classic multi-slot behaviour).
//   - GetEquipSlot: group router; a 2H weapon in the right hand makes
//     the next non-LeftOnly weapon replace it THERE; weapons route by
//     hands (RightOnly/Both -> right, LeftOnly -> left, Either ->
//     first open of right,left).
//   - GetItemHands: weapon map -> shields LeftOnly -> None. Bows ride
//     DFU's BowLeftHandWithSwitching setting whose default (false)
//     is the classic Both - we port the default (Ledger note in arc).
// Items here are the data shape {group, templateIndex}; equip/unequip
// mechanics (unequip lists, prohibitions) are Systems-arc territory.

import { EQUIP_SLOTS } from './paperdoll.js';
import { ITEM_GROUPS, SLOT_RULES, WEAPON_HANDS, SHIELD_INDICES } from './equipRules.js';

export const ITEM_HANDS = Object.freeze({ None: 0, RightOnly: 1, LeftOnly: 2, Either: 3, Both: 4 });
const GROUP_NAME = { [ITEM_GROUPS.Armor]: 'Armor', [ITEM_GROUPS.Jewellery]: 'Jewellery', [ITEM_GROUPS.MensClothing]: 'MensClothing', [ITEM_GROUPS.WomensClothing]: 'WomensClothing' };

export function getItemHands(item) {
  if (item.group !== ITEM_GROUPS.Weapons && item.group !== ITEM_GROUPS.Armor) {
    return ITEM_HANDS.None;
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
