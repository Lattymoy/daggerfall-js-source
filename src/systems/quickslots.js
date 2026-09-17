// QS1 - THE QUICKSLOTS: the model behind the enhanced HUD's diamond.
//
// Mac's reference is the bottom-left diamond of the Demon's Souls
// remake: the weapon in the right hand, the shield in the left, and
// the consumable under them with its count. Daggerfall has no such
// thing - DFU's HUD carries no item slots at all - so this is a PORT
// DEPARTURE of the enhanced skin alone, and this module is the whole
// of its state: two CONSUMABLE slots the player fills from the
// enhanced inventory's tooltip, and one SWAP slot that names a second
// weapon to change into. The main hand and the off hand are not
// state here at all - they are READ each frame from the equip table
// and the lit light source, because the hands already have an owner
// (systems/equip.js, entity.lightSource) and a second copy would
// drift from it.
//
// A SLOT HOLDS A KIND, NOT A RECORD. No item in this port carries a
// unique id (itemFields.js declares none), the save shallow-copies
// every record (save.js snapshotPlayer), and the pack reorders by
// splice - so a reference or an index would not survive a load, a
// drag, or the last bottle drunk. What a slot keeps is the item's
// KEY (`quickslotKey`: the fields that make two records "the same
// thing" to a player - a Potion of Healing is any Potion of Healing)
// and its NAME. Each frame the pack is walked for the key: the FIRST
// match is the record a use consumes, and the COUNT is every match's
// stackCount summed, so two stacks of the same potion read as one
// number. A slot whose key matches nothing is a GHOST - it keeps its
// name and reads 0 - so buying more of the same potion refills it
// without a trip to the tooltip. That is the Souls behaviour and the
// one a player expects from a slot.
//
// THE USE AND THE SWAP GO THROUGH THE LAWS THAT EXIST. A consumable is
// used by the one `useItem` ladder the inventory window uses, with
// the same host hooks (drinkPotion is the cast engine's, U44); a swap
// is `equipItem`, which already evicts the occupant, splits a stack,
// bumps a shield for a two-hander, plays the equip sound and tells
// the enchantment hooks. The window's refusals stand here too: a
// broken item and a forbidden one are refused with the window's own
// words, because a hotkey is not a way round the window's law.
//
// THE SWAP BILLS THE EQUIP PAUSE. DFU bills the swap delay when the
// inventory window closes (billEquipDelayOnClose, FX1), and a hotkey
// that swapped for free would be the exploit the pause exists to
// stop - so the swap takes the same snapshot-and-bill the window
// takes, around the one equip it makes.
import { isPotion, isDrug, useItem, USE_PENDING } from './useItem.js';   // ...and the ladder's own stand-ins for a host that handed no hook
import { equipItem, equipTableOf, EQUIP_SLOTS, isBrokenItem, isForbiddenEquip, isEquipped, unequipSlot,
  getItemHands, ITEM_HANDS,
  equipDelaySnapshot, billEquipDelayOnClose, ITEM_BROKEN_TEXT_ID, FORBIDDEN_EQUIPMENT_TEXT_ID } from './equip.js';
import { isShieldTemplate } from './armorMaterials.js';
import { itemLongName, conditionPercentage } from './itemInfo.js';

/** The slots a player fills. The two consumables are what the diamond's
 *  top and bottom cells show; `swap` is the second weapon the off-hand
 *  cell offers when the off hand is empty. */
export const QUICKSLOTS = Object.freeze(['c1', 'c2', 'swap']);
const CONSUMABLE_SLOTS = Object.freeze(['c1', 'c2']);
const ARROW = 131;

/** What the HUD says for an empty press, and what a swap says when it
 *  cannot. The window's two refusals are TEXT.RSC ids the host's rows
 *  resolve; the rest are the port's own words. */
export const QUICKSLOT_TEXT = Object.freeze({
  emptySlot: 'Nothing is in that slot.',
  noneLeft: (name) => `You have no ${name} left.`,
  noSwap: 'No weapon is set to swap to.',
  swapGone: (name) => `Your ${name} is not in your pack.`,
  swapHeld: (name) => `You are already holding your ${name}.`,
  swapped: (name) => `You ready your ${name}.`,
  putAway: (name) => `You put away your ${name}.`,
  handsEmpty: 'Your hands are already empty.',
});

/** AUDIT QS F2 - BARE HANDS ARE A SWAP TARGET. A swap out of empty hands
 *  used to CLEAR the slot, because nothing had left the hand to become
 *  the next swap - so the first press a new player made emptied the
 *  cell and the second said there was nothing to swap to. What left
 *  the hand was NOTHING, and nothing is a kind too: the slot points at
 *  bare hands, and the next press puts the weapon away again. The key
 *  names the hand, because a left-only bow swaps in and out of the
 *  left. */
export const BARE_KEYS = Object.freeze({ R: 'bare:R', L: 'bare:L' });
export const BARE_NAME = 'Bare hands';
const bareHandOf = (key) => (key === BARE_KEYS.L ? 'L' : key === BARE_KEYS.R ? 'R' : null);

const state = { c1: null, c2: null, swap: null };

/** THE KEY. The fields a player reads as "the same item": the template
 *  and its group, the material (an elven dagger is not an iron one),
 *  the potion's recipe (every potion is one Glass_Bottle template -
 *  AUDIT 22 F5's lesson), the enchantments, the legendary name and
 *  the affixes the loot arc mints. Condition and stack size are NOT in
 *  it: a worn Potion of Healing is still a Potion of Healing, and a
 *  swap weapon that has taken a knock is still the swap weapon. */
/** Per record, for the PLAIN ones: template, group, material and recipe
 *  are set at the mint and never move, so a plain record's key is computed
 *  once for the life of the object. A record carrying enchantments or
 *  affixes is NOT cached - the item maker writes `item.enchantments` onto
 *  an existing record (systems/enchanting.js), and a cached key would say
 *  the enchanted sword is still the plain one until the next load said
 *  otherwise. Those are few in a pack, and they pay the stringify. */
const _keys = new WeakMap();
const plain = (it) => !(it.enchantments?.length || it.customEnchantments?.length || it.affixes?.length);
export function quickslotKey(item) {
  if (!item || typeof item !== 'object') return null;
  if (!plain(item)) return computeKey(item);
  const had = _keys.get(item);
  if (had !== undefined) return had;
  const key = computeKey(item);
  _keys.set(item, key);
  return key;
}
function computeKey(item) {
  const ench = Array.isArray(item.enchantments) && item.enchantments.length
    ? JSON.stringify(item.enchantments) : '';
  const custom = Array.isArray(item.customEnchantments) && item.customEnchantments.length
    ? JSON.stringify(item.customEnchantments) : '';
  const affixes = Array.isArray(item.affixes) && item.affixes.length ? JSON.stringify(item.affixes) : '';
  return [item.group ?? '', item.templateIndex ?? '', item.material ?? '', item.potionRecipeKey ?? '',
    item.legendary ?? '', ench, custom, affixes].join('|');
}

/** What a consumable slot takes: a potion or a drug - the two arms of
 *  `useItem` that CONSUME and act on the entity. A torch is not one (it
 *  is the off-hand cell's, through entity.lightSource), a book is not,
 *  an ingredient does nothing when used. */
export const isQuickConsumable = (item) => isPotion(item) || isDrug(item);

/** What the swap slot takes: a weapon that is not an arrow. The
 *  equipped one is refused - swapping to what is in your hand is a
 *  no-op the tooltip should not offer. */
export const canSwapTo = (item) => !!item && item.group === 'Weapons' && item.templateIndex !== ARROW && !isEquipped(item);

const assertSlot = (slot) => { if (!QUICKSLOTS.includes(slot)) throw new Error(`quickslots: no slot ${slot}`); };

/** Fill a slot with the item's kind. Answers false and changes nothing
 *  when the item is not the slot's kind. The same key in the OTHER
 *  consumable slot is cleared: one kind lives in one slot. */
export function assignQuickslot(slot, item) {
  assertSlot(slot);
  const ok = slot === 'swap' ? canSwapTo(item) : isQuickConsumable(item);
  if (!ok) return false;
  const key = quickslotKey(item);
  const name = itemLongName(item);
  if (slot !== 'swap') for (const s of CONSUMABLE_SLOTS) if (s !== slot && state[s]?.key === key) state[s] = null;
  state[slot] = { key, name };
  return true;
}

export function clearQuickslot(slot) { assertSlot(slot); state[slot] = null; }
export function clearQuickslots() { for (const s of QUICKSLOTS) state[s] = null; }

/** The slot this item's kind is in, or null. The tooltip's buttons
 *  read it to show "Unslot" on the one that holds the item. */
export function quickslotOf(item) {
  const key = quickslotKey(item);
  if (key == null) return null;
  for (const s of QUICKSLOTS) if (state[s]?.key === key) return s;
  return null;
}

/** The slot's stored kind, or null. A copy: nothing outside writes it. */
export const quickslotEntry = (slot) => (assertSlot(slot), state[slot] ? { ...state[slot] } : null);

const packOf = (entity) => (Array.isArray(entity?.items) ? entity.items : []);

/** A consumable slot, resolved against the pack: the first record of
 *  the kind (what a use consumes) and the count of every one. Null
 *  when the slot is unassigned; a GHOST (item null, count 0) when the
 *  kind is assigned and the pack holds none. */
export function resolveConsumable(entity, slot) {
  const e = state[slot];
  if (!e) return null;
  let item = null; let count = 0;
  for (const it of packOf(entity)) {
    if (quickslotKey(it) !== e.key) continue;
    if (!item) item = it;
    count += Math.max(0, it.stackCount ?? 1);
  }
  return { key: e.key, name: e.name, item, count };
}

/** The swap slot, resolved: a record of the kind that is not in a
 *  hand - a SOUND one first, because condition is not in the key and
 *  two daggers of one kind can differ by it; the broken one is the
 *  answer only when it is the only one, so the refusal can say so.
 *  Null when unassigned; a ghost when none is in the pack. */
export function resolveSwap(entity) {
  const e = state.swap;
  if (!e) return null;
  const bare = bareHandOf(e.key);
  if (bare) return { key: e.key, name: e.name, item: null, bare };
  const ofKind = packOf(entity).filter((it) => quickslotKey(it) === e.key);
  const matches = ofKind.filter((it) => !isEquipped(it));
  const item = matches.find((it) => !isBrokenItem(it)) ?? matches[0] ?? null;
  // AUDIT QS F7: a record of the kind that is IN A HAND is not "not in
  // your pack" - the cell draws it as held and the press says so.
  const held = item ? null : (ofKind.find((it) => isEquipped(it)) ?? null);
  return { key: e.key, name: e.name, item, held };
}

const cell = (item, extra = {}) => ({ item, name: itemLongName(item), condition: conditionPercentage(item), ...extra });

/**
 * THE VIEW - what the diamond paints, once per frame. Pure over the
 * entity and the rig's two facts (the held weapon and whether it is
 * sheathed, which drawHud already carries).
 *
 * `main`: the weapon in the hand, or null with nothing held.
 * `off`:  the off-hand cell, in this order - a LIT light source (it is
 *         in the hand, and its "condition" is what is left to burn -
 *         Handheld Torches burns currentCondition down), else the
 *         SHIELD on the left hand, else any other WEAPON on the left
 *         hand (a bow), else the SWAP when one is set - the weapon, or
 *         bare hands (`bare`), or the record already in a hand
 *         (`held`), or a ghost when it left the pack - else `empty`.
 * `c1`, `c2`: the consumables, each null when unassigned.
 */
export function quickslotView(entity, { weapon = null, sheathed = false } = {}) {
  const main = weapon ? cell(weapon, { sheathed: !!sheathed }) : null;
  let off;
  const lit = entity?.lightSource ?? null;
  const left = entity ? (equipTableOf(entity)[EQUIP_SLOTS.LeftHand] ?? null) : null;
  if (lit) off = cell(lit, { kind: 'torch' });
  else if (left && isShieldTemplate(left.templateIndex)) off = cell(left, { kind: 'shield' });
  // AUDIT QS F4: anything else on the left hand - a bow under
  // Enhancements.BowLeftHandWithSwitching - is IN the off hand, and the
  // cell is the off hand's readout before it is the swap's offer.
  else if (left) off = cell(left, { kind: 'weapon' });
  else if (state.swap) {
    const r = resolveSwap(entity);
    off = r.item ? cell(r.item, { kind: 'swap' })
      : r.bare ? { kind: 'swap', item: null, name: r.name, condition: null, bare: true }
        : r.held ? cell(r.held, { kind: 'swap', held: true })
          : { kind: 'swap', item: null, name: r.name, condition: null };
  } else off = { kind: 'empty', item: null, name: null, condition: null };
  return { main, off, c1: resolveConsumable(entity, 'c1'), c2: resolveConsumable(entity, 'c2') };
}

/**
 * THE USE. `hooks` are the host's own use hooks - the same object the
 * inventory window is handed (drinkPotion, revealMap, getQuest,
 * nowMinute, rows) - and `say` its popup channel. Answers what
 * happened; the HUD's count says the rest.
 */
export function useQuickslot(slot, { entity = null, items = null, hooks = {}, say = null } = {}) {
  if (!CONSUMABLE_SLOTS.includes(slot)) throw new Error(`quickslots: ${slot} is not a consumable slot`);
  const r = resolveConsumable(entity, slot);
  if (!r) { say?.(QUICKSLOT_TEXT.emptySlot); return { kind: 'empty' }; }
  if (!r.item) { say?.(QUICKSLOT_TEXT.noneLeft(r.name)); return { kind: 'none', name: r.name }; }
  const pack = items ?? packOf(entity);
  const res = useItem(r.item, pack, {
    entity,
    localItems: pack,
    spellCount: () => entity?.spells?.length ?? 0,
    isEnchanted: hooks.isEnchanted ?? (() => false),
    nowMinute: hooks.nowMinute?.() ?? 0,
    revealMap: hooks.revealMap ?? null,
    drinkPotion: hooks.drinkPotion ?? null,
    getQuest: hooks.getQuest ?? null,
  });
  // The window's own ladder (enhancedInventory useResultAction), read
  // here rather than imported: an explicit text, then a TEXT.RSC id
  // through the host's rows, then the pending stand-in, and the
  // enchanted RIDER only when the arm itself said nothing (AUDIT 22
  // F9). A potion drunk through a live hook says nothing - the effect
  // is the HUD's, and the count is the slot's.
  const text = res.text
    ?? (res.textId && hooks.rows ? (hooks.rows(res.textId) ?? []).map((row) => (typeof row === 'string' ? row : row?.text ?? '')).join(' ').trim() : null)
    ?? (res.pending ? (USE_PENDING[res.kind] ?? 'Nothing happens.') : null)
    ?? (res.enchanted ? USE_PENDING.enchanted : null);
  if (text) say?.(text);
  return { kind: 'used', name: r.name, result: res };
}

/**
 * THE SWAP. Equips the swap weapon through `equipItem`, then points
 * the slot at the weapon that LEFT the hand so the next press swaps
 * back - the Souls behaviour. Out of empty hands there is nothing to
 * swap back to, and the slot clears.
 *
 * `rows` resolves the window's two refusal ids (broken, forbidden) to
 * their text; without it the refusal is silent but still a refusal.
 */
export function swapQuickslot({ entity = null, say = null, rows = null } = {}) {
  const r = resolveSwap(entity);
  if (!r) { say?.(QUICKSLOT_TEXT.noSwap); return { kind: 'none' }; }
  const table = equipTableOf(entity);
  const snap = equipDelaySnapshot(entity);
  // Bare hands: put the weapon in that hand away, and it becomes the swap.
  if (r.bare) {
    const hand = r.bare === 'L' ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand;
    const held = table[hand] ?? null;
    if (!held) { say?.(QUICKSLOT_TEXT.handsEmpty); return { kind: 'none' }; }
    unequipSlot(entity, hand);
    billEquipDelayOnClose(entity, snap);
    state.swap = canSwapTo(held) ? { key: quickslotKey(held), name: itemLongName(held) } : null;
    say?.(QUICKSLOT_TEXT.putAway(itemLongName(held)));
    return { kind: 'swapped', name: r.name, item: null, previous: held };
  }
  if (!r.item) {
    if (r.held) { say?.(QUICKSLOT_TEXT.swapHeld(r.name)); return { kind: 'held', name: r.name }; }
    say?.(QUICKSLOT_TEXT.swapGone(r.name)); return { kind: 'gone', name: r.name };
  }
  const refuse = (id, kind) => {
    const text = rows ? (rows(id) ?? []).map((row) => (typeof row === 'string' ? row : row?.text ?? '')).join(' ').trim() : '';
    if (text) say?.(text);
    return { kind, name: r.name };
  };
  if (isBrokenItem(r.item)) return refuse(ITEM_BROKEN_TEXT_ID, 'broken');
  if (isForbiddenEquip(entity?.career, r.item)) return refuse(FORBIDDEN_EQUIPMENT_TEXT_ID, 'forbidden');
  // THE HAND THE SWAP IS FOR. A left-only weapon (a bow under
  // Enhancements.BowLeftHandWithSwitching) lives in the left; everything
  // else the swap puts in the RIGHT, and what was there is the leaver.
  const leftOnly = getItemHands(r.item) === ITEM_HANDS.LeftOnly;
  const hand = leftOnly ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand;
  const previous = table[hand] ?? null;
  // QS2 - A SWAP REPLACES WHAT IS IN THE HAND, and `equipItem` alone does not.
  // GetEquipSlot's weapon arm is `getFirstSlot(RightHand, LeftHand)` for an
  // EITHER-handed weapon (ItemEquipTable.cs, characters/equipTable.js) - the
  // FIRST OPEN hand - which is exactly right for the inventory window, where
  // equipping a second dagger with a free off hand means "hold both". It is
  // not what a swap means. A player holding a longsword with an empty off hand
  // - the common case - pressed the key and got a dagger in the LEFT hand, the
  // sword still in the right, nothing leaving the hand, and so (no leaver) the
  // slot CLEARED: the swap did not swap, and the next press said there was
  // nothing to swap to. So the main hand is emptied first when the swap weapon
  // would otherwise land beside it rather than in it; a left-only weapon keeps
  // its own hand, and `equipItem` evicts that hand's occupant itself.
  const bumped = previous && !leftOnly ? unequipSlot(entity, EQUIP_SLOTS.RightHand) : null;
  const un = equipItem(entity, r.item);
  if (un === null) {
    if (bumped) equipItem(entity, bumped);   // the refusal changes nothing: the hand goes back as it was
    return { kind: 'refused', name: r.name };
  }
  billEquipDelayOnClose(entity, snap);
  // THE NEXT SWAP is what left the hand: the weapon that was there, or
  // bare hands when nothing was (AUDIT QS F2). A leaver that is not a
  // weapon - a shield a left-only bow bumped - is not a swap, and the
  // slot clears.
  const leaver = previous && !isEquipped(previous) ? previous : null;
  if (leaver && canSwapTo(leaver)) state.swap = { key: quickslotKey(leaver), name: itemLongName(leaver) };
  else if (!previous) state.swap = { key: leftOnly ? BARE_KEYS.L : BARE_KEYS.R, name: BARE_NAME };
  else state.swap = null;
  say?.(QUICKSLOT_TEXT.swapped(r.name));
  return { kind: 'swapped', name: r.name, item: r.item, previous: leaver };
}

// ── THE SAVE ──────────────────────────────────────────────────────
// Rides composeSessionState / restoreSessionState (systems/save.js),
// the seam every host's save already passes through, so no host is
// edited and none can forget it. A save without the block CLEARS the
// slots - a pre-QS save, or another character's - exactly as FE1's
// escort faces and U41's travel map treat a missing block.

export function quickslotSaveData() {
  const out = {};
  for (const s of QUICKSLOTS) out[s] = state[s] ? { key: state[s].key, name: state[s].name } : null;
  return out;
}

export function restoreQuickslotSaveData(data) {
  clearQuickslots();
  if (!data || typeof data !== 'object') return;
  for (const s of QUICKSLOTS) {
    const e = data[s];
    if (e && typeof e.key === 'string' && typeof e.name === 'string') state[s] = { key: e.key, name: e.name };
  }
}
