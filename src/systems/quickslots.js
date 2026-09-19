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
import { isPotion, isDrug, isLightSource, useItem, USE_PENDING } from './useItem.js';   // ...and the ladder's own stand-ins for a host that handed no hook
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
  noLight: 'You have no light source.',
  // QS6 - the spell slot's own three. The READY says nothing here: DFU's
  // SetReadySpell speaks for itself ("Press button to fire spell.", the
  // silence line, the spell-point refusal), and a second line over it
  // would be the port talking across the game.
  noSpells: 'You know no spells.',
  spellGone: (name) => `You no longer know ${name}.`,
  unreadied: (name) => `You put away ${name}.`,
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
/** QS6 - THE SPELL SLOT, which is not one of those. A spell is not an
 *  item: it carries no group, no template and no material, so
 *  `quickslotKey` has nothing to say about it. What it does carry is an
 *  INDEX - a SPELLS.STD record number, or the negative one a made spell
 *  mints (systems/spellMaker.js:212-230) - and that index is already
 *  this port's name for "which spell": it is what the save writes
 *  (systems/save.js:284), what a restore reads back, and what
 *  `setReadiedByIndex` resolves a readied spell by. So the slot keeps
 *  the same key the rest of the port keeps, and a book that changed
 *  under it (a spell sold, a made spell deleted) leaves a GHOST that
 *  reads by name, exactly as a spent potion does. */
let spellState = null;   // { index, name }

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
export function clearQuickslots() { for (const s of QUICKSLOTS) state[s] = null; spellState = null; }   // QS6: the spell slot is a slot too

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
export function quickslotView(entity, { weapon = null, sheathed = false, readiedIndex = null } = {}) {
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
  // QS6: and the spell, which is the caption's chip rather than a
  // corner - `readied` is the host's own read of the engine's readied
  // index, so the chip lights for the spell that is actually in hand
  // and not merely for the one the slot points at.
  const sp = resolveSpellQuickslot(entity);
  const spell = sp ? { ...sp, readied: readiedIndex != null && readiedIndex === sp.index } : null;
  return { main, off, spell, cycling: quickslotCycling(),
    c1: resolveConsumable(entity, 'c1'), c2: resolveConsumable(entity, 'c2') };
}

/** QS6 - DOES THE OFF-HAND CELL OFFER A SWAP RIGHT NOW?
 *
 *  The swap gave up its default key to the spell slot, and the cell it
 *  is DRAWN in is the off hand's - so the off hand's key presses it,
 *  under the rule the diamond has had since QS4: the key does what the
 *  cell shows. A host asks this before it lights a torch, because a
 *  free off hand offering a weapon is offering the weapon, not a light.
 *
 *  It is the VIEW's own answer, not a second reading of the same facts:
 *  the order a lit light, a shield, an off-hand weapon and the swap
 *  stand in lives in one place. */
export const offHandOffersSwap = (entity) => quickslotView(entity).off.kind === 'swap';

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

/**
 * QS4 (Mac: "The 4th quickslot doesnt have a keybind") - THE OFF-HAND
 * CELL'S OWN PRESS.
 *
 * Three of the diamond's four corners named a key and the fourth did
 * not: the off hand spoke only when it held a lit torch (Handheld
 * Torches' own mod key, which no pad can carry and the enhanced pane
 * cannot rebind) or when it was offering a swap. A cell with no key is
 * a slot a player cannot use, which is the drawn door PX14 named,
 * wearing a diamond.
 *
 * SO THE OFF HAND HAS ONE ACT, AND IT IS THE ONE DAGGERFALL HAS: light
 * your light source, or put it out. `toggleLight` is the host's door
 * onto the mod's own `toggleLightPress` - its free-hand guard, its
 * relaxed-lantern carve-out and its refusal line are the mod's, not
 * restated here - so a shield in that hand refuses in the mod's own
 * words, which is exactly what the player needs to hear.
 *
 * The one thing said here is the case the mod says nothing about: a
 * player carrying no light at all pressing a key that is about light.
 */
export function offHandQuickslot({ entity = null, say = null, toggleLight = null, switchHand = null } = {}) {
  // MAC-R3 (2026-09-17, Mac: "Tapping the equip hand in the quickbar
  // doesn't switch to your other weapon in hand (still bound to H). Even
  // if a torch isn't equipped a message still shows up that you can't
  // light the torch"): THE PRESS IS WHAT THE CELL SHOWS, in full. The
  // cell is the OFF HAND's readout (quickslotView: a lit light, else the
  // shield, else the weapon on the left hand, else the swap, else empty)
  // and QS4 gave its press ONE act - the light's toggle - so a cell
  // showing a bow said "You have no light source." A hand cell's own act
  // is DFU's SwitchHand (WeaponManager.cs:271-273, the H key): the other
  // weapon in hand. So: a lit light douses; an empty hand with a light
  // carried ignites it (the mod's own equip-and-light); the shield, the
  // off-hand weapon and an empty hand with no light SWITCH HANDS, and
  // the light's refusal is said only where there is no hand to switch
  // (a host with no rig door). The swap is the caller's arm
  // (offHandOffersSwap) and is answered before this is asked.
  const kind = quickslotView(entity).off.kind;
  if (kind === 'swap') return { kind: 'swap' };
  const carries = !!entity?.lightSource || packOf(entity).some(isLightSource);
  const light = kind === 'torch' || (kind === 'empty' && carries);
  if (!light) {
    if (typeof switchHand !== 'function') { say?.(QUICKSLOT_TEXT.noLight); return { kind: 'none' }; }
    // The rig's verdict: it switched (and said which hand), or refused
    // silently as DFU's ToggleHand does over a shield (:704-705).
    return switchHand() === true ? { kind: 'hand' } : { kind: 'refused' };
  }
  if (typeof toggleLight !== 'function') return { kind: 'none' };
  // The verdict is the mod's: it acted, or it has already said why not.
  // `lit` is the state AFTER the press - what is in the hand now.
  return toggleLight() === true ? { kind: 'light', lit: !!entity?.lightSource } : { kind: 'refused' };
}

// ── QS6: THE SPELL SLOT, AND THE HOLD THAT PICKS WHAT IS IN A SLOT ──
//
// Mac, 2026-09-17: "for slot 3, I want to change it to be for spells.
// So you should be able to hold the keybind to switch between
// applicable spells, and then press the keybind to equip. Same for 2/3.
// Pressing the keybind, if not equipped, should equip the slot."
//
// TWO THINGS, and they are separable. The first is a SPELL SLOT: the
// third key readies a spell instead of swapping a weapon. The second is
// a HOLD: a slot's contents are chosen by holding its own key rather
// than by a trip to a window, which is the whole point of a quick bar -
// the bar you fill without opening anything.
//
// WHAT THE KEY DOES IS WHAT THE CELL SHOWS, still. The weapon swap did
// not lose its action (it is in the registry, rebindable, and the
// off-hand cell already DRAWS it whenever that hand is free) - it lost
// its DEFAULT KEY, because the cell it is drawn in is the off hand's
// and the off hand's key is the one a player will press looking at it.
// Three of the four cells took a hold; the off hand did not, because
// what it offers is not a list the player picks from - it is whatever
// is in that hand.
//
// "APPLICABLE" IS THE PACK AND THE BOOK, not a filter over them. A
// spell you cannot presently afford is still a spell you know, and
// SetReadySpell already refuses it in DFU's own words at the press
// (EntityEffectManager.cs:337-343); hiding it from the cycle would
// make the list flicker as magicka moved, and would teach the player a
// spell had been forgotten. So the cycle offers the whole book and the
// whole of the pack's consumables, and every refusal stays where the
// refusals already live.

const bookOf = (entity) => (Array.isArray(entity?.spells) ? entity.spells : []);
/** A spell this slot can hold: one with the numeric index that is the
 *  port's name for it. Everything the book can contain has one. */
const keyedSpell = (sp) => !!sp && typeof sp === 'object' && Number.isFinite(sp.index);

/** The slot's stored spell kind, or null. A copy, as quickslotEntry is. */
export const spellQuickslot = () => (spellState ? { ...spellState } : null);

/** Point the slot at a spell. False, and nothing changed, for anything
 *  the book could not have given us. */
export function setSpellQuickslot(sp) {
  if (!keyedSpell(sp)) return false;
  spellState = { index: sp.index, name: String(sp.name ?? '') };
  return true;
}

export function clearSpellQuickslot() { spellState = null; }

/** The slot resolved against the BOOK: the live record a press readies,
 *  and the name to draw. Null when unassigned; `spell` null for a ghost
 *  - a spell the player no longer knows - which keeps its name so the
 *  refusal can say which one it was. */
export function resolveSpellQuickslot(entity) {
  if (!spellState) return null;
  const spell = bookOf(entity).find((sp) => sp?.index === spellState.index) ?? null;
  return { index: spellState.index, name: spell?.name || spellState.name, spell };
}

/**
 * THE SPELL SLOT'S PRESS. Mac: "Pressing the keybind, if not equipped,
 * should equip the slot."
 *
 * `magic` is the host's ONE cast engine (scenes/hostMagic.js) and every
 * law about readying is its own: the silence gate, the spell-point
 * refusal, the CasterOnly instant cast, the "Press button to fire
 * spell." line. This asks it and says nothing over it.
 *
 * A press with the slot ALREADY readied puts the spell away, through
 * the engine's own AbortReadySpell (EntityEffectManager.cs:268-270) -
 * the same shape the swap cell has, where a second press swaps back.
 *
 * An UNSET slot takes the book's first spell rather than refusing: a
 * player who has never held the key has an empty slot, and a key that
 * says "nothing is here" while the book is full is a key that teaches
 * nothing. The hold is how you choose; the first press is how you start.
 */
export function spellQuickslotPress({ entity = null, magic = null, say = null } = {}) {
  let r = resolveSpellQuickslot(entity);
  if (!r) {
    const first = bookOf(entity).find(keyedSpell) ?? null;
    if (!first) { say?.(QUICKSLOT_TEXT.noSpells); return { kind: 'none' }; }
    setSpellQuickslot(first);
    r = resolveSpellQuickslot(entity);
  }
  if (!r.spell) { say?.(QUICKSLOT_TEXT.spellGone(r.name)); return { kind: 'gone', name: r.name }; }
  // ALREADY IN HAND: the press puts it away. `readiedIndex` is the
  // engine's own read of which spell is readied - the same index this
  // slot keys on, so the two cannot disagree about identity.
  if (magic?.readiedIndex?.() === r.index) {
    const put = magic.abortReadySpell?.() === true;
    if (put) say?.(QUICKSLOT_TEXT.unreadied(r.name));
    // `readied` is the state AFTER the press, as QS4's `lit` is.
    return { kind: put ? 'unreadied' : 'pressed', name: r.name, readied: !put };
  }
  magic?.readySpell?.(r.spell);
  // THE KIND DOES NOT JUDGE THE ENGINE. `readied` is simply whether the
  // spell is in hand now, and a spell NOT in hand is not a refusal: a
  // CasterOnly spell readies and CASTS in the same breath (DFU's
  // SetReadySpell :350-351), so it is spent rather than held. Which of
  // those two happened is the engine's to say, and it has said it.
  return { kind: 'pressed', name: r.name, readied: magic?.readiedIndex?.() === r.index };
}

// ── THE CYCLE ─────────────────────────────────────────────────────

/** The consumable KINDS the pack holds, in pack order, one entry per
 *  kind - what a consumable slot can be pointed at. The kind the OTHER
 *  consumable slot holds is not offered: "one kind lives in one slot"
 *  is assignQuickslot's law, and a cycle that could steal the other
 *  cell's potion would enforce it by emptying that cell. */
export function consumableCandidates(entity, slot) {
  const taken = CONSUMABLE_SLOTS.filter((s) => s !== slot).map((s) => state[s]?.key).filter((k) => k != null);
  const out = [];
  const seen = new Set();
  for (const it of packOf(entity)) {
    if (!isQuickConsumable(it)) continue;
    const key = quickslotKey(it);
    if (key == null || seen.has(key) || taken.includes(key)) continue;
    seen.add(key);
    out.push({ key, name: itemLongName(it), item: it });
  }
  return out;
}

/** The book, as the spell slot's candidate list. */
export const spellCandidates = (entity) => bookOf(entity).filter(keyedSpell);

/** The slots a hold can cycle - the two consumables and the spell. The
 *  off hand is not one: see the header. */
export const CYCLE_SLOTS = Object.freeze(['c1', 'c2', 'spell']);

export const QUICK_CYCLE_LINGER_MS = 1200;   // how long the HUD keeps showing what a cycle chose
let cycling = null;   // { slot, ms } - what the HUD lights up

/** The slot a cycle last landed in, while it is still worth showing, or
 *  null. The HUD reads it; a cycle raises it and the frame's tick lets
 *  it fall, so a hold on a KEY and a hold on a phone's own cell light
 *  the same lamp. */
export const quickslotCycling = () => (cycling ? cycling.slot : null);

/**
 * ADVANCE a slot through its candidates and answer what it landed on
 * (null when there is nothing to land on). This CHANGES the slot and
 * performs NOTHING - the tap is what acts, which is the whole of the
 * hold/press split Mac described.
 *
 * A slot whose kind is not in the list - an empty slot, or a ghost
 * whose potion is spent - starts at the list's near end rather than
 * nowhere, so the first step of a hold always shows something.
 */
export function cycleQuickslot(slot, { entity = null, dir = 1 } = {}) {
  const step = dir < 0 ? -1 : 1;
  if (slot === 'spell') {
    const list = spellCandidates(entity);
    if (!list.length) return null;
    const at = spellState ? list.findIndex((sp) => sp.index === spellState.index) : -1;
    const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
    setSpellQuickslot(list[next]);
    cycling = { slot, ms: QUICK_CYCLE_LINGER_MS };
    return { slot, index: list[next].index, name: list[next].name, spell: list[next] };
  }
  if (!CONSUMABLE_SLOTS.includes(slot)) throw new Error(`quickslots: ${slot} does not cycle`);
  const list = consumableCandidates(entity, slot);
  if (!list.length) return null;
  const at = state[slot] ? list.findIndex((c) => c.key === state[slot].key) : -1;
  const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
  state[slot] = { key: list[next].key, name: list[next].name };
  cycling = { slot, ms: QUICK_CYCLE_LINGER_MS };
  return { slot, key: list[next].key, name: list[next].name, item: list[next].item };
}

// ── THE HOLD ──────────────────────────────────────────────────────
//
// THE FRAME OWNS THESE KEYS, not the keydown. A press that acts on its
// DOWN edge cannot also be the start of a hold - the potion is already
// drunk by the time the player has held long enough to mean "let me
// choose one". So the three are POLLED_ACTIONS (ui/input.js): the
// keyboard dispatch declines them and each host's frame drives this
// machine instead, the same way ReadyWeapon and SwitchHand are driven.
//
// The TAP is the host's - a potion needs the window's use hooks and a
// spell needs the cast engine - and the CYCLE is ours, because a
// candidate list is the model's own knowledge.

export const QUICK_HOLD_MS = 350;    // past this the press is a hold, not a tap
export const QUICK_STEP_MS = 300;    // ...and it steps this often while it is held
const QUICK_TICK_MAX_MS = 250;       // a frame longer than this was a stall, not play
/** AUDIT QS6 F6 - AND A GAP IN THE FRAMES IS A BLOCKED FRAME NOBODY DECLARED.
 *
 *  F2 taught that a hold carried across a window must not perform on the way
 *  out, and `blocked` says so - but only where a host remembers to pass it,
 *  and only where the tick is REACHED. `scenes/dungeon.js` had the call
 *  inside its own `!overlayHeld` gate, so its `blocked` argument was dead;
 *  the two outdoor hosts return above the tick while a full-screen video
 *  holds the frame (`frameHeld`, scenes/shared.js), and a backgrounded tab
 *  gets no frames at all. Each of those is the same hazard behind a
 *  different door, and a law enforced by four hosts is a law enforced by
 *  memory.
 *
 *  So the machine defends itself: if the WALL CLOCK says the frames stopped,
 *  every hold disarms, whatever the caller declared. This is the one place
 *  real time is read here, and it is read about FRAMES rather than about the
 *  game - `dt` is still what measures a hold. */
export const QUICK_GAP_MS = 1000;
let lastTickAt = 0;

/** slot -> action. The registry's own names; a rebind moves the key,
 *  not this. */
export const CYCLE_ACTIONS = Object.freeze({ c1: 'QuickUse1', c2: 'QuickUse2', spell: 'QuickSpell' });

const holds = new Map();

/** Every hold forgotten and the lamp put out. Nothing in `src/` calls
 *  this - the hosts pass `blocked` instead, which is the same act
 *  without the gap - so it exists for a driver that wants a clean
 *  machine between two runs (the pins, and any probe). */
export function resetQuickslotHolds() { holds.clear(); cycling = null; lastTickAt = 0; }

/** AUDIT QS6 F2 - A HOLD THAT SPANS AN OVERLAY MUST NOT PERFORM ON THE
 *  WAY OUT, and CLEARING the holds was not enough to stop it.
 *
 *  The sequence, driven: the player holds 1 in play; a window opens and
 *  the frame goes `blocked`, which dropped every hold; the window closes
 *  WHILE THE KEY IS STILL DOWN; the next tick finds no state for the
 *  slot, reads the key as down, and calls that a RISING EDGE - so the
 *  release a moment later is a tap and a potion is drunk that the player
 *  never asked for. The guard had moved the bug one step later rather
 *  than removing it.
 *
 *  So a blocked frame DISARMS rather than forgets: every slot is held
 *  down, already cycled (so its release performs nothing) and stepping
 *  never (so it does not quietly walk the book under the window). The
 *  key has to come up and go down again to mean anything. */
const disarm = () => ({ down: true, ms: 0, next: Infinity, cycled: true });

/**
 * ONE FRAME of the hold machine.
 *
 *   isHeld(action)   the host's own `held(keys, action)`
 *   entity           whose pack and book the candidates come from
 *   onTap(slot)      the host's performer for a short press
 *   onCycle(slot, r) optional; what the hold landed on
 *   blocked          true while this frame's keys are not the player's
 *                    (an overlay, a pause) - every hold drops, silently
 */
export function tickQuickslotHold(dt, { isHeld = null, entity = null, onTap = null, onCycle = null, blocked = false } = {}) {
  const ms = Math.min(QUICK_TICK_MAX_MS, Math.max(0, (Number(dt) || 0) * 1000));
  if (cycling) { cycling.ms -= ms; if (cycling.ms <= 0) cycling = null; }
  const at = Date.now();
  const gap = lastTickAt ? at - lastTickAt : 0;
  lastTickAt = at;
  if (blocked || gap > QUICK_GAP_MS || typeof isHeld !== 'function') {
    for (const slot of CYCLE_SLOTS) holds.set(slot, disarm());
    return;
  }
  for (const slot of CYCLE_SLOTS) {
    const st = holds.get(slot) ?? { down: false, ms: 0, next: QUICK_HOLD_MS, cycled: false };
    const down = isHeld(CYCLE_ACTIONS[slot]) === true;
    if (down && !st.down) { st.down = true; st.ms = 0; st.next = QUICK_HOLD_MS; st.cycled = false; }
    else if (down) {
      st.ms += ms;
      while (st.ms >= st.next) {
        st.next += QUICK_STEP_MS;
        st.cycled = true;
        onCycle?.(slot, cycleQuickslot(slot, { entity }));   // the cycle raises the lamp itself
      }
    } else if (st.down) {
      st.down = false;
      // A HOLD IS NOT A PRESS. The release of a hold performs nothing -
      // it has already done its work, which was choosing.
      if (!st.cycled) onTap?.(slot);
      else cycling = { slot, ms: QUICK_CYCLE_LINGER_MS };
    }
    holds.set(slot, st);
  }
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
  // QS6: the spell slot rides the same block, keyed the way save.js
  // already keys a spell - by index (systems/save.js:284).
  out.spell = spellState ? { index: spellState.index, name: spellState.name } : null;
  return out;
}

export function restoreQuickslotSaveData(data) {
  clearQuickslots();
  if (!data || typeof data !== 'object') return;
  for (const s of QUICKSLOTS) {
    const e = data[s];
    if (e && typeof e.key === 'string' && typeof e.name === 'string') state[s] = { key: e.key, name: e.name };
  }
  const sp = data.spell;
  if (sp && Number.isFinite(sp.index) && typeof sp.name === 'string') spellState = { index: sp.index, name: sp.name };
}
