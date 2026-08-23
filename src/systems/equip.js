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

import { mintCondition, templateByIndex } from './itemTemplates.js';   // AUDIT 23
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { ITEM_GROUPS, SLOT_RULES } from '../characters/equipRules.js';
import { createEquipTable, getItemHands as handsOf, ITEM_HANDS } from '../characters/equipTable.js';
import { BODY_PARTS, NUMBER_BODY_PARTS, materialArmorValue, SHIELD_VALUES, SHIELD_PARTS, isShieldTemplate } from './armorMaterials.js';
import { weaponSkillUsed } from '../characters/weapons.js';   // wave 29: GetWeaponSkillUsed keys on the TEMPLATE
import { SKILLS, WEAPON_SKILL } from './skills.js';   // S23: the weapon partition, single-sourced
import { EQUIP_DELAY_TIMES } from '../characters/weaponStates.js';   // CH3 (characters-13): the swap-pause table gains its consumer

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
/** CH3 (AUDIT 23 characters-13): the SWAP PAUSE - every hand item
 *  LEAVING or ARRIVING adds its group-index delay onto the entity's
 *  countdown, accumulating (the writer sums both sides per hand with
 *  += at DaggerfallInventoryWindow.cs:1198); the weapon rig blocks
 *  the attack while it runs and drains at the classic 980 units per
 *  second. The table quirk carries verbatim: EquipDelayTimes indexes
 *  by the item's index WITHIN ITS OWN GROUP, so a shield swap bills
 *  the low armor indexes against the weapon delay table. Leavers
 *  bill here (the one unequip door), arrivers in equipItem - each
 *  transition exactly once. */
function billEquipDelay(entity, item) {
  const gi = item.group === 'Weapons' ? item.templateIndex - 113
    : item.group === 'Armor' ? item.templateIndex - 102 : -1;
  if (gi >= 0 && gi < EQUIP_DELAY_TIMES.length) {
    entity.equipCountdown = (entity.equipCountdown ?? 0) + EQUIP_DELAY_TIMES[gi];
  }
}

export function unequipSlot(entity, slot) {
  const slots = equipTableOf(entity);
  const item = slots[slot];
  if (!item) return null;
  slots[slot] = null;
  delete item.equipSlot;
  updateEquippedArmorValues(entity, item, false);   // U8h: the armor table adds back
  if (slot === EQUIP_SLOTS.RightHand || slot === EQUIP_SLOTS.LeftHand) billEquipDelay(entity, item);   // CH3: the leaver's half
  _hooks.onEquipChange?.(entity);   // E1: the fold follows the worn set
  return item;
}

/** S23: THE CAREER EQUIP RESTRICTIONS
 *  (DaggerfallInventoryWindow.EquipItem :1343-1381, verbatim).
 *
 *  17 of the 18 classic classes carry these and the port had never
 *  enforced any of them - a Mage could wear plate, carry a tower shield
 *  and swing an axe. AUDIT 17n found the fields with zero consumers;
 *  U20b then made the same restrictions PURCHASABLE in the custom
 *  builder, which is what forced the slice.
 *
 *  The port's ARMOR_MATERIAL values ARE DFU's raw nativeMaterialValue
 *  (0x0000 leather / 0x0100 chain / 0x0200+ plate), so DFU's `>> 8` and
 *  `& 0xFF` expressions carry over unchanged.
 *
 *  TWO verbatim quirks ride along. The armor MATERIAL test is gated on
 *  `(nativeMaterialValue >> 8) == 2` - plate only - so a Barbarian
 *  forbidden orcish and daedric may still wear daedric CHAIN. And
 *  GetWeaponSkillUsed returns Skills.None = -1 for a template it does
 *  not name (:938), and -1 masks against every bit, so ANY item in the
 *  weapon group that is not one of the sixteen listed weapons reads as
 *  forbidden to a career with any forbidden proficiency at all.
 *
 *  WHERE THIS LIVES IS THE LAW: DFU hangs it on the inventory WINDOW,
 *  not on ItemEquipTable.EquipItem, so AssignStartingGear equips
 *  straight past it. A restricted class really can START in gear it
 *  could never put back on. Ported at the same seam, deliberately. */
export function isForbiddenEquip(career, item) {
  if (!career || !item) return false;
  const forbiddenArmors = (career.weaponArmorShieldsBitfield >>> 6) & 0x07;
  const forbiddenShields = (career.weaponArmorShieldsBitfield >>> 9) & 0x0f;
  const forbiddenProficiencies = career.weaponArmorShieldsBitfield & 0x3f;
  const forbiddenMaterials = career.forbiddenMaterialsFlags ?? 0;
  if (item.group === 'Armor') {
    // AUDIT 24 systems: DFU's armor branch is a THREE-arm chain
    // (DaggerfallInventoryWindow.cs:1345-1359). Arms 1 and 2 split on
    // IsShield - `if (item.IsShield && shield-bit)` then
    // `else if (!item.IsShield && armor-type-bit)` - but arm 3, the
    // plate-MATERIAL test, carries no shield guard at all. So a shield
    // whose TYPE bit is clear falls through to it, and a career that
    // forbids (say) Daedric refuses a Daedric tower shield. The port
    // returned at the shield arm and never reached the material test.
    const shield = isShieldTemplate(item.templateIndex);
    if (shield && ((1 << (item.templateIndex - SHIELD_TEMPLATE_START)) & forbiddenShields) !== 0) return true;
    if (!shield && ((1 << (item.material >> 8)) & forbiddenArmors) !== 0) return true;
    // the plate-only gate on the material test - shields included
    return (item.material >> 8) === 2 && ((1 << (item.material & 0xff)) & forbiddenMaterials) !== 0;
  }
  if (item.group === 'Weapons') {
    if ((weaponProficiencyFlag(item) & forbiddenProficiencies) !== 0) return true;
    return ((1 << item.material) & forbiddenMaterials) !== 0;
  }
  return false;
}

/** GetWeaponSkillUsed (:910-941) as a ProficiencyFlag. DFU switches on
 *  the TEMPLATE INDEX, and its `default:` really does return
 *  `(int)Skills.None`, which is -1 - so an unmatched template is all
 *  bits set, and `-1 & ForbiddenProficiencies` is non-zero for any
 *  career with any restriction at all. That quirk is kept.
 *
 *  AUDIT 24 (wave 29): this keyed on `item.name`, and a name is not the
 *  template. itemTemplates.json spells 117 "Wakizashi" and 123
 *  "Dai-katana" where the weapon table has Wakazashi / Dai_Katana, and
 *  loot.createRegularMagicItem RENAMES an enchanted weapon to its
 *  MAGIC.DEF name - so all three fell to the unmatched -1 and were
 *  REFUSED by every restricted career. characters/weapons.js already
 *  carried the correct template-index map, with a comment describing
 *  this exact trap, and this was a second copy that had not been
 *  fixed with it. */
export function weaponProficiencyFlag(item) {
  const flag = PROFICIENCY_OF_SKILL[weaponSkillUsed(item?.templateIndex)];
  return flag ?? -1;
}
const PROFICIENCY_OF_SKILL = Object.freeze({
  [SKILLS.ShortBlade]: 1, [SKILLS.LongBlade]: 2, [SKILLS.HandToHand]: 4,
  [SKILLS.Axe]: 8, [SKILLS.BluntWeapon]: 16, [SKILLS.Archery]: 32,
});
/** Armor.Buckler - the shield block's base template index. */
const SHIELD_TEMPLATE_START = 109;

/** The message DFU pops on a refused equip (:1325, :1372-1379). */
export const FORBIDDEN_EQUIPMENT_TEXT_ID = 1068;
/** ...and on a BROKEN one (:1324, :1330-1341), which is checked FIRST. */
export const ITEM_BROKEN_TEXT_ID = 29;
/** `if (item.currentCondition < 1)` - strictly less than one, so a
 *  condition of exactly 1 still equips. An item with no condition
 *  recorded is not broken (the port mints many without one). */
export const isBrokenItem = (item) => item?.currentCondition != null && item.currentCondition < 1;

/** EquipItem verbatim: the unequipped list, or null when the item
 *  cannot equip. */
export function equipItem(entity, item) {
  const slots = equipTableOf(entity);
  const slot = getEquipSlot(entity, item);   // computed ONCE up front (the DFU order)
  if (slot === EQUIP_SLOTS.None) return null;
  if (item.group === 'Weapons' && item.templateIndex === ARROW) return null;   // cannot equip arrows
  // AUDIT 24 (wave 29): DaggerfallInventoryWindow.cs:1330-1341 - a
  // BROKEN item pops TEXT.RSC 29 and returns, before the prohibition
  // chain is even reached. The port had no such gate, so an item worn
  // down to 0 condition could be taken off and put straight back on.
  if (isBrokenItem(item)) return null;
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
  if (slot === EQUIP_SLOTS.RightHand || slot === EQUIP_SLOTS.LeftHand) billEquipDelay(entity, item);   // CH3: the arriver's half
  slots[slot] = item;
  updateEquippedArmorValues(entity, item, true);   // U8h: the armor table subtracts
  _hooks.onEquipChange?.(entity);   // E1: the fold follows the worn set
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
  const dagger = mintCondition({ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0, flags: 0, minDamage: 1, maxDamage: 6 });   // AUDIT 23 (items-13/C13): no port site mints bit 0x10 (the claim is true again); items-5 condition
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

// AUDIT 17e F32: these tables lived here AND in ui/paperDoll.js with
// divergent constants; they now have one home.
export { BODY_PARTS, NUMBER_BODY_PARTS, materialArmorValue };

/** GetBodyPartForEquipSlot (DaggerfallUnityItem.cs:1131-1153): only
 *  these seven slots map to an armor body part. */
const SLOT_BODY_PART = new Map([
  [EQUIP_SLOTS.Head, BODY_PARTS.Head], [EQUIP_SLOTS.RightArm, BODY_PARTS.RightArm],
  [EQUIP_SLOTS.LeftArm, BODY_PARTS.LeftArm], [EQUIP_SLOTS.ChestArmor, BODY_PARTS.Chest],
  [EQUIP_SLOTS.Gloves, BODY_PARTS.Hands], [EQUIP_SLOTS.LegsArmor, BODY_PARTS.Legs],
  [EQUIP_SLOTS.Feet, BODY_PARTS.Feet],
]);

export const armorValuesOf = (entity) => (entity.armorValues ??= new Array(NUMBER_BODY_PARTS).fill(100));

export function updateEquippedArmorValues(entity, item, equipping) {
  // AUDIT 17e F10 - UpdateEquippedArmorValues verbatim
  // (DaggerfallEntity.cs:591-594): the branch admits Armor AND the
  // FOOTWEAR window of each clothing group - MensClothing GroupIndex
  // 6..8 = Shoes/Tall_Boots/Boots (141+6..8 = 147..149), WomensClothing
  // 4..6 = Shoes/Tall_boots/Boots (182+4..6 = 186..188). Sandals
  // (150/189) map to Feet but sit OUTSIDE the window and get nothing -
  // preserved as DFU has it. Their material is Leather (3), so a pair
  // of boots is worth 15 on the Feet part; the port granted 0.
  const FOOTWEAR = item.group === 'MensClothing' ? [147, 148, 149]
    : item.group === 'WomensClothing' ? [186, 187, 188] : null;
  if (item.group !== 'Armor' && !(FOOTWEAR && FOOTWEAR.includes(item.templateIndex))) return;
  const av = armorValuesOf(entity);
  const sign = equipping ? -1 : 1;
  if (!isShieldTemplate(item.templateIndex)) {
    // a non-shield armor piece's slot is FIXED by template (the C5c
    // rule table) - no equip-table state involved (DFU GetArmorSlot)
    const rule = SLOT_RULES.Armor[item.templateIndex];
    const part = rule ? SLOT_BODY_PART.get(EQUIP_SLOTS[rule.slot])
      : (FOOTWEAR ? BODY_PARTS.Feet : null);   // clothing footwear -> Feet
    if (part == null) return;
    av[part] += sign * materialArmorValue(item.material ?? 0) * 5;
  } else {
    const bonus = SHIELD_VALUES.get(item.templateIndex);
    for (const part of SHIELD_PARTS.get(item.templateIndex)) av[part] += sign * bonus * 5;
  }
}

/** GetEquipSlotForBodyPart (DaggerfallUnityItem.cs:1103-1125) - the
 *  inverse of SLOT_BODY_PART's seven pairs; None for anything else. */
const BODY_PART_SLOT = new Map([...SLOT_BODY_PART].map(([slot, part]) => [part, slot]));
export const slotForBodyPart = (part) => BODY_PART_SLOT.get(part) ?? EQUIP_SLOTS.None;

/** DaggerfallUnityItem.LowerCondition + ItemBreaks (:1170-1214).
 *  C-slice (AUDIT 23 combat-1): breaking clamps at 0, speaks the
 *  classic line - the plural variant for Gauntlets/Greaves/Boots
 *  (itemHasBroken / itemHasBrokenPlural; the string table is not in
 *  the source snapshot, so the prose is ours with the keys cited;
 *  DFU notes classic said "is" where it says "has") - and unequips
 *  from the owner, which restores the armor table through
 *  unequipSlot. A broken MUNDANE item stays in the pack; DFU removes
 *  only an ENCHANTED player item, and that arm rides the enchantment
 *  arc with the rest of the payloads. Returns true on a break. */
const PLURAL_BREAK_TEMPLATES = new Set([103, 104, 108]);   // Armor.Gauntlets, Greaves, Boots
export function lowerCondition(item, amount, owner = null, say = null) {
  mintCondition(item);
  if ((item.maxCondition ?? 0) <= 0) return false;   // no condition to lower: the frozen stand-ins and 0-hitPoint templates cannot break
  item.currentCondition -= amount;
  if (item.currentCondition > 0) return false;
  item.currentCondition = 0;
  const name = item.name ?? templateByIndex(item.templateIndex)?.name ?? 'Item';
  say?.(`${name} ${PLURAL_BREAK_TEMPLATES.has(item.templateIndex) ? 'have' : 'has'} broken.`);
  // E1: ItemBreaks' enchantment payload (DaggerfallUnityItem.cs:
  // 1217-1222 fires Breaks from inside LowerCondition's zero edge,
  // before the unequip) - through the hook so this leaf stays below
  // the enchantment module. SoulBound's break releases the soul.
  _hooks.onItemBroken?.(item, owner, say);
  if (owner && item.equipSlot != null) unequipSlot(owner, item.equipSlot);
  return true;
}

/** E1: the enchantment module's doors into this leaf (equip.js sits
 *  BELOW enchantments.js in the import graph, so the coupling is a
 *  registration, not an import). onEquipChange re-folds
 *  entity._enchantMods the moment the worn set changes - DFU's
 *  constant effects re-apply next frame (DoConstantEffects), and a
 *  fold that waited for the next magic round would lag up to a
 *  classic minute. onItemBroken is the Breaks payload edge above. */
const _hooks = { onEquipChange: null, onItemBroken: null };
export function setEnchantmentHooks({ onEquipChange = null, onItemBroken = null } = {}) {
  _hooks.onEquipChange = onEquipChange;
  _hooks.onItemBroken = onItemBroken;
}
export const notifyEquipChange = (entity) => _hooks.onEquipChange?.(entity);
