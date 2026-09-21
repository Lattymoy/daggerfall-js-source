// ═══════════════════════════════════════════════════════════════════
// U53 — THE ENHANCED PACK, and THE SLOT MAP
//
// ui/inventoryDoor.js chooses; this draws. It answers ONE of the
// classic window's flows - open your pack, see what you are wearing,
// wear something else - and the door hands loot piles and reward
// pickers to the classic window, which is stated there.
//
// ── THE SIGNATURE ────────────────────────────────────────────────
//
// src/tools/enhancedUI.js's header calls the slot map the most
// Daggerfall thing in the game, and it is right: twenty-seven equip
// slots, TWO amulets, TWO bracelets, TWO marks, TWO crystals, and
// chest armour and chest clothes as separate layers. The classic
// paperdoll draws this as a picture of a person and you hunt for the
// slots by clicking at them.
//
// Here it is an information graphic. Every slot is a node on a body
// schematic, filled nodes are lit, and the whole state of a
// character's kit reads in one glance at any size. A picture of a
// person tells you how they look; this tells you what you are
// carrying, which is what the screen is for.
//
// IT IS INLINE SVG, NOT THE PROTOTYPE'S THREE.JS. `mountFigure` in
// tools/enhancedVisuals.js builds a small three.js scene and
// enhanced.html loads that library from a CDN - and the port's
// doctrine already carries exactly one third-party request (Ledger A,
// the web fonts), which is one more than it wants. Twenty-seven
// positioned nodes need no library at all, and an SVG scales to a
// phone where a fixed-size WebGL canvas does not.
//
// ── THE LAW IS BORROWED, NOT REWRITTEN ───────────────────────────
//
// Nothing about items is decided here. Equipping is systems/equip.js's
// `equipItem`, which carries DFU's whole chain - the two-hander
// clearing both hands, a shield bumping a held two-hander, the
// forbidden-material and broken-item refusals, the swap delay billed
// per transition, the armour-value table and the enchantment hooks.
// Taking something off is `unequipSlot`. The pages are PX31's nine
// (ui/packPages.js; the classic keeps DFU's four). Weight,
// condition, material and damage strings are systems/itemInfo.js's,
// every one of them cited to DFU. This module positions nodes and
// prints rows.
//
// ── WHAT IT DOES NOT DRAW ────────────────────────────────────────
//
// THE ITEM ICONS. The classic window draws them from the TEXTURE
// archives through GL textures the host hands it (`icons:
// { getTexture, uploadRecord, textures }`), which a DOM list cannot
// use. The path a DOM screen would need - archive record to canvas
// through ui/bitmapCanvas.js - does not exist yet, and inventing a
// second icon pipeline in this file is how the port ends up with two.
// The PROTOTYPE hit the same wall and answered it the same way, with
// two initials and the real archive/record in the tile's title, which
// is what this does. Recorded as a real loss; it is the next
// inventory slice's first job.
// ═══════════════════════════════════════════════════════════════════

import { USE_PENDING } from './nativeInventory.js';
import { PACK_PAGES, PAGE_IDS, pageOf, filterByPage } from './packPages.js';   // PX31: the pack's nine pages (the classic keeps DFU's four)
import { useItem, isLightSource, usableItem } from '../systems/useItem.js';   // HT2: the light source's own act; Mac: Use only where the law has an arm
// QS2: the quickslot model (systems/quickslots.js). This screen is the ONE
// place a slot is filled - Mac's own words, "in the enhanced menu through the
// tooltip to slot 1/2" - and it fills one by naming the item's KIND, which is
// all a slot ever holds.
import { isQuickConsumable, canSwapTo, quickslotOf, assignQuickslot, clearQuickslot } from '../systems/quickslots.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';   // PX25
import { hasDaggerfallArrows } from '../combat/fpArm.js';   // PX26
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';   // PX25
import { inventoryItemImage, templateByIndex } from '../systems/itemTemplates.js';
import { requestIcon, paperDollDataUrl } from './textureCanvas.js';
import { modelIconUrl as modelIconUrlOf } from './itemIconUrl.js';   // MW-D38, shared with the HUD's quickslots (QS3)
// U59: the AVATAR. The compositor is ui/paperDoll.js - the same one
// the classic window draws - and this reads its finished pixels rather
// than re-deriving PaperDollRenderer's layer order for a second time.
import {
  refreshPaperDoll, paperDollPixels, slotAtPaperDoll, PAPERDOLL_W, PAPERDOLL_H,
} from './paperDoll.js';
import {
  equipItem, unequipSlot, equipTableOf, isEquipped,
  isForbiddenEquip, isBrokenItem,
} from '../systems/equip.js';
import { getEquipSlot } from '../systems/equip.js';   // Mac (2026-09-18): Wear only where a slot would take it
import {
  itemWeight, isEnchanted, totalWeight, addItem, goldStack,
  goldPiecesOf, GOLD_PIECE_WEIGHT_KG,   // E4: the counter and its per-coin weight
} from '../systems/inventory.js';
import { goldAmount, deductGold } from '../systems/court.js';
import { noticeHold, noticeRelease } from './enhancedNotice.js';   // ENH-NOTICE3: this window's own click-anywhere boxes, as the enhanced panel
// U56/U57: DFU's transfer ladder and DFU's remote side, both extracted
// from the classic window so this pane runs them rather than a second
// reading of them.
import {
  planStore, planTake, applyTransfer, planDropGold, WAGON_KG_LIMIT,
} from '../systems/itemTransfer.js';
import {
  openState, remoteTarget, planWagonToggle, hasCart, hasHorse, transportItem,
} from '../systems/inventorySession.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';   // AUDIT 26: PlayerEntity.MaxEncumbrance, enchantment allowance and all
import { liveStat } from '../systems/statMods.js';
import { conditionWord, conditionPercentage, itemNameParts, itemLongName, itemDamageLine, itemArmourLine, itemHandsLine } from '../systems/itemInfo.js';   // RF6: the long name's two parts, ResolveItemLongName's arms once
import { survivalInfoTokens } from '../systems/itemInfo.js';   // AUDIT SURV C: the survival items' tokens on this skin's card too
import { isSurvivalItem } from '../systems/survival/items.js';
import { rarityAttr, rarityLines } from '../systems/lootRarity.js';   // LR1: the row's tier attribute and the card's lines
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';   // OT1
import { repaintKeepingScroll } from './domRepaint.js';
import { overlayAction, actionOf } from './input.js';   // MAC-C: and the REGISTRY's answer for the two window keys
import { audio } from '../systems/audio.js';   // MAC-O6: the pack's own transfer cue - this window carried none at all
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';   // ES1: both cues ride the Enhanced sounds switch
import { SOUND } from '../systems/soundClips.js';

import { expandRowValues } from '../systems/quest/questMacros.js';   // MACROS1: a used item's record through its own context (%map)
/** Slot id -> where it sits on the body, and what to call it.
 *
 *  THE FIGURE FACES THE READER, so the character's RIGHT arm is drawn
 *  on the LEFT of the schematic - the same convention the classic
 *  paperdoll uses, and getting it backwards would put a shield in the
 *  wrong hand at a glance.
 *
 *  The four MAGIC slots (marks, crystals) and DFU's two unnamed ones
 *  have no place on a body, so they sit in a row underneath rather
 *  than being hidden: a slot the player cannot see is a slot they
 *  cannot empty. */
/** HT5: the held light's row id. No EQUIP_SLOTS member is minted for it -
 *  DFU has no light slot, and inventing one would put a fake column in
 *  the equip table every law here reads.
 *
 *  AUDIT HT5 F3: -1 is EXACTLY `EQUIP_SLOTS.None`, so the old comment's
 *  "negative so it can never collide" was the opposite of true - None is
 *  the one negative the equip vocabulary already uses. Nothing here
 *  indexes the table with this id (SLOT_MAP has no -1 entry and no
 *  reader compares row.slot against None), and THAT is the safety. */
export const LIGHT_SLOT = -1;

export const SLOT_MAP = Object.freeze({
  [EQUIP_SLOTS.Head]: { x: 110, y: 32, label: 'Head' },
  [EQUIP_SLOTS.Amulet0]: { x: 94, y: 60, label: 'Amulet' },
  [EQUIP_SLOTS.Amulet1]: { x: 126, y: 60, label: 'Amulet' },
  [EQUIP_SLOTS.Cloak1]: { x: 72, y: 76, label: 'Cloak' },
  [EQUIP_SLOTS.Cloak2]: { x: 148, y: 76, label: 'Cloak' },
  [EQUIP_SLOTS.ChestClothes]: { x: 110, y: 92, label: 'Chest, clothes' },
  [EQUIP_SLOTS.ChestArmor]: { x: 110, y: 116, label: 'Chest, armour' },
  [EQUIP_SLOTS.RightArm]: { x: 64, y: 106, label: 'Right arm' },
  [EQUIP_SLOTS.LeftArm]: { x: 156, y: 106, label: 'Left arm' },
  [EQUIP_SLOTS.Bracer0]: { x: 56, y: 134, label: 'Bracer' },
  [EQUIP_SLOTS.Bracer1]: { x: 164, y: 134, label: 'Bracer' },
  [EQUIP_SLOTS.Bracelet0]: { x: 50, y: 160, label: 'Bracelet' },
  [EQUIP_SLOTS.Bracelet1]: { x: 170, y: 160, label: 'Bracelet' },
  [EQUIP_SLOTS.Ring0]: { x: 62, y: 186, label: 'Ring' },
  [EQUIP_SLOTS.Ring1]: { x: 158, y: 186, label: 'Ring' },
  [EQUIP_SLOTS.RightHand]: { x: 42, y: 190, label: 'Right hand' },
  [EQUIP_SLOTS.LeftHand]: { x: 178, y: 190, label: 'Left hand' },
  [EQUIP_SLOTS.Gloves]: { x: 110, y: 172, label: 'Gloves' },
  [EQUIP_SLOTS.LegsArmor]: { x: 110, y: 200, label: 'Legs, armour' },
  [EQUIP_SLOTS.LegsClothes]: { x: 110, y: 224, label: 'Legs, clothes' },
  [EQUIP_SLOTS.Feet]: { x: 110, y: 258, label: 'Feet' },
  [EQUIP_SLOTS.Mark0]: { x: 44, y: 296, label: 'Mark', off: true },
  [EQUIP_SLOTS.Mark1]: { x: 72, y: 296, label: 'Mark', off: true },
  [EQUIP_SLOTS.Crystal0]: { x: 148, y: 296, label: 'Crystal', off: true },
  [EQUIP_SLOTS.Crystal1]: { x: 176, y: 296, label: 'Crystal', off: true },
  // DFU names these nothing. They are drawn ONLY when something is in
  // them, because a node with no name and no contents is noise - but a
  // node with no name and an ITEM in it is a player's belonging they
  // would otherwise have no way to reach.
  [EQUIP_SLOTS.Unknown1]: { x: 104, y: 296, label: 'Unnamed', off: true, hidden: true },
  [EQUIP_SLOTS.Unknown2]: { x: 116, y: 296, label: 'Unnamed', off: true, hidden: true },
});

/** The stroked figure the nodes sit on. Deliberately a schematic and
 *  not a drawing of a person: this screen answers "what am I
 *  carrying", and the classic paperdoll already answers the other. */
const FIGURE = [
  'M110 16 a16 16 0 1 1 -0.1 0',            // head
  'M110 48 L110 60',                          // neck
  'M84 62 L136 62 L140 150 L80 150 Z',        // torso
  'M84 66 L58 132 L46 186',                   // right arm (reader's left)
  'M136 66 L162 132 L174 186',                // left arm
  'M92 150 L88 250 M128 150 L132 250',        // legs
  'M84 254 L136 254',                         // feet line
];

/**
 * THE PACK, as data. Pure: no DOM, no mutation, every figure lifted
 * from the module that owns it.
 */
export function packModel(deps = {}) {
  const entity = deps.entity ?? {};
  const items = (deps.items?.() ?? []).filter(Boolean);
  const slots = equipTableOf(entity);
  const worn = new Map();
  for (const [slot, item] of Object.entries(slots ?? {})) {
    if (item) worn.set(Number(slot), item);
  }
  // E4: PlayerEntity.CarriedWeight (:184) - the item list PLUS the
  // gold counter's own weight. `deps.items()` and `entity.items` are
  // the same collection in every host, but the pane is handed the
  // list rather than the entity, so the total is composed from both
  // halves the same member does.
  const carried = items.reduce((kg, it) => kg + itemWeight(it), 0)
    + goldPiecesOf(entity) * GOLD_PIECE_WEIGHT_KG;
  return {
    tabs: PACK_PAGES.map(([tab, label]) => ({ tab, label, items: filterByPage(items, tab) })),   // PX31
    worn,
    // PlayerEntity.GoldPieces, the COUNTER - gold has not been an item
    // in the pack since E4, so there is no stack here to find.
    gold: goldPiecesOf(entity),
    // FormulaHelper.MaxEncumbrance over LIVE strength, the same
    // expression the character sheet and the classic window use.
    encumbrance: { now: Math.trunc(carried), max: entityMaxEncumbrance(entity) },
    count: items.length,
  };
}

/**
 * U59: WHAT YOU ARE WEARING, as a list rather than as dots.
 *
 * The slot map put every worn item behind a 7px circle. That is a
 * fine PICTURE of a kit and a poor READING of one: you cannot see
 * what a filled node holds without hovering it, and the one action it
 * offers - take it off - is a click on a target the size of a full
 * stop. So the same twenty-seven slots also come out as rows, named,
 * with what is in them.
 *
 * THE ORDER IS THE BODY'S, and it is read off SLOT_MAP's own
 * positions rather than from a second table: head to feet, then left
 * to right. EQUIP_SLOTS' numbering is DFU's enum order, which starts
 * at the jewellery and would put a ring above a helm.
 *
 * EMPTY SLOTS ARE ROWS TOO. A list of only what you wear cannot
 * answer "what could I still put on", which is half of what the
 * schematic was for - and DFU's two unnamed slots stay hidden until
 * something is in them, for the reason SLOT_MAP gives.
 */
export function equippedModel(entity = {}) {
  const table = equipTableOf(entity) ?? [];
  const rows = Object.entries(SLOT_MAP).map(([id, at]) => ({
    slot: Number(id),
    label: at.label,
    item: table[Number(id)] ?? null,
    hidden: !!at.hidden,
    x: at.x,
    y: at.y,
  })).sort((a, b) => a.y - b.y || a.x - b.x);
  // HT5 (2026-09-15, Mac: "the torch doesnt appear slotted in
  // inventory"): THE HELD LIGHT IS A ROW, and it is the only row here
  // that is not one of DFU's slots.
  //
  // A light source HAS no equip slot - getEquipSlot answers None for
  // all four, which is why HT2 had to make the act a USE - so the lit
  // torch lived only in `entity.lightSource` and the worn side of this
  // window had nothing to show. The list marked it gold (HT2) and that
  // is all: a player holding a torch saw an empty pair of hands.
  //
  // Handheld Torches' own fiction is that it OCCUPIES A HAND (its
  // with no free hand the mod stows the LIGHT, not the weapon), so a hand is where
  // it belongs on the body. It carries a sentinel slot rather than a
  // made-up EQUIP_SLOTS value, and the counts below still walk the
  // REAL table, so "27 slots" stays DFU's 27 and nothing that counts
  // slots learns about this one.
  const light = entity?.lightSource ?? null;
  const visible = rows.filter((r) => r.item || !r.hidden);
  return {
    rows: light
      ? [...visible, { slot: LIGHT_SLOT, label: 'Light', item: light, hidden: true, x: 110, y: 190 }]
      : visible,
    filled: rows.filter((r) => r.item).length,
    total: rows.length,
  };
}

/** What the remote side is CALLED, per DFU's four claims. The word is
 *  the port's; which claim is showing is inventorySession's. */
export const REMOTE_TITLE = Object.freeze({
  wagon: 'Wagon', reward: 'Choose one', container: 'Loot', ground: 'Ground',
});
/** What moving an item THERE is called. A verb per destination,
 *  because "Transfer" tells the player nothing about where. */
export const STOW_LABEL = Object.freeze({
  wagon: 'Stow in wagon', reward: 'Stow', container: 'Put back', ground: 'Drop',
});

/**
 * THE REMOTE SIDE, as data. Pure, like packModel: which list is
 * showing, what it is called, what it weighs, and - for the wagon
 * alone - what it is allowed to weigh.
 *
 * The KIND is derived in the same order inventorySession answers the
 * target in, because a pane that named the ground while showing the
 * wagon would be a second reading of that order.
 */
export function remoteModel(deps = {}, state = {}) {
  const items = (remoteTarget(deps, state) ?? []).filter(Boolean);
  const kind = state.usingWagon ? 'wagon'
    : state.chooseOne ? 'reward'
      : deps.loot ? 'container' : 'ground';
  return {
    kind,
    title: REMOTE_TITLE[kind],
    items,
    count: items.length,
    weight: totalWeight(items),
    // ItemHelper.WagonKgLimit is the ONLY capacity a remote list has -
    // the ground and a corpse hold anything.
    capacity: kind === 'wagon' ? WAGON_KG_LIMIT : null,
  };
}

/**
 * One item's line, from the modules that own each part of it.
 *
 * THE ICON ADDRESS IS `inventoryItemImage`'s, AND U53 GOT THIS WRONG.
 * It read `playerTextureArchive ?? worldTextureArchive` off the
 * template, which looks like the same thing and is not: that one
 * expression is four ported laws, two of them with audits behind
 * them. GetItemImage draws the WORLD texture for UselessItems1,
 * ingredients, arrows, ReligiousItems and MiscItems - 111 of 288
 * templates differ (AUDIT 17e F9). The player archive is offset by the
 * WEARER's body morphology, or every list draws the morphology-0
 * Argonian row (AUDIT 17f). Variants index off the record, with cloaks
 * skipping their interior-first one and armour riding SetVariant's
 * material-family clamps (AUDIT 23 items-6). And katanas take +1 on
 * the inventory branch alone.
 *
 * `identity` is the wearer, and it matters for exactly the morphology
 * reason above - the classic drawer passes `hooks.entity` for it.
 */
export function itemLine(item, identity = undefined) {
  const img = inventoryItemImage(item, identity);
  // The TEMPLATE's name is the fallback, not 'Unknown'. A stack minted
  // by a loot roll or a quest can arrive with no name of its own, and
  // this dropped that fallback for one commit when the template read
  // it replaced went away with it.
  const t = templateByIndex(item.templateIndex);
  // RF6: ResolveItemLongName's two parts (itemInfo.itemNameParts) - the
  // name on the line, the material prefix on the sub-line - so the
  // skin derives none of the arms itself. LR1's law rides it: an
  // UNIDENTIFIED enchanted item reads as its bare template
  // (ItemHelper.cs:265-292's early return) and shows no material
  // (LR4, as %mat is). The template stays the fallback.
  const parts = itemNameParts(item, { getQuest: deps.getQuest ?? null });
  return {
    item,   // MW-D38: the icon door resolves the item itself
    name: parts.name || t?.name || 'Unknown',
    weight: itemWeight(item),
    // AUDIT SURV C (review): a survival item's condition is its uses or its keeping, said in its own tokens below -
    // "Condition New 100%" on a stale bread and "Used 50%" beside "25 uses left" were two words for one thing
    condition: (item.maxCondition ?? 0) > 0 && !isSurvivalItem(item) ? conditionPercentage(item) : null,
    word: (item.maxCondition ?? 0) > 0 && !isSurvivalItem(item) ? conditionWord(item) : null,
    material: parts.material || null,
    // MAC-M1 (Mac: "Damage values arent showing on weapon tool tips.
    // Also, not sure if armor has values either"): THE TWO NUMBERS A
    // PLAYER PICKS A WEAPON BY. `weaponDamageString` and
    // `armourModString` have existed since U25 with exactly one reader
    // between them - the CLASSIC popup's macro pass - and this skin's
    // card builds its rows from this line rather than from a record, so
    // it showed weight and condition and never the damage. The
    // NUMBERS come from the same producers the classic popup uses, so
    // the two surfaces cannot drift; only the question of whether to
    // show a row at all is this skin's (systems/itemInfo.js).
    damage: itemDamageLine(item),
    armour: itemArmourLine(item),
    // MAC-M2 (Mac: "The Tooltip of weapons should also show if the
    // weapon is 1h or 2h"): the same shape as the two above - the
    // ANSWER is systems/itemInfo's, off the port's one GetItemHands, so
    // the card cannot tell a player a claymore is one-handed while the
    // equip table is emptying both their hands for it.
    hands: itemHandsLine(item),
    // AUDIT SURV C: a food's worth and stage, a skin's water, the gear's uses - the classic popup's tokens (systems/itemInfo.js
    // survivalInfoTokens, less the name and the weight this card already carries), so a Waterskin says its water here too
    survival: isSurvivalItem(item) ? survivalInfoTokens(item).slice(2).map((r) => r.text) : null,
    stack: (item.stackCount ?? 1) > 1 ? item.stackCount : null,
    equipped: isEquipped(item),
    // HT2: the LIT light source, by REFERENCE, exactly as
    // ItemBackgroundColourHandler compares it (:401-411, and
    // ui/itemScroller.js's port of it). The classic list paints that
    // row gold; this skin had no way to say it at all, so a player who
    // lit a torch could not tell which of three torches was burning.
    lit: !!item && identity?.lightSource === item,
    broken: isBrokenItem(item),
    // The address only. Fetching is the view's business, because a
    // model has no repaint to schedule.
    image: img,
  };
}

/**
 * HT2 (Mac: "so you cant equip the torch in your offhand, you can only
 * drop it on the ground") - THE PRIMARY ACT ON A LOCAL ITEM, decided
 * once, performed by the view.
 *
 * A LIGHT SOURCE HAS NO EQUIP SLOT. `getEquipSlot` answers None for
 * every one of the four (Torch, Lantern, Candle, Holy candle - they
 * are UselessItems2 and ReligiousItems, not Weapons or Armor), so
 * `equipItem` returns null and this pane's `wear` said "torch cannot
 * be worn." and stopped. That refusal was TRUE about the equip table
 * and WRONG about the game: DFU's own equip click on a light source
 * does not equip it, it USES it -
 * `DaggerfallInventoryWindow.LocalItemListScroller_OnItemClick`
 * (:1976-1985) sends the item to `UseItem(item)` with NO collection
 * (AUDIT 22 F6 - so an equip click can consume nothing), and UseItem's
 * light arm is what lights a torch in play. The classic window here
 * carries that arm (ui/nativeInventory.js's equip branch); this pane
 * never grew it, so the enhanced skin - the DEFAULT skin, and the only
 * one online - had no way to light a torch at all. The one act left on
 * the card was Drop, which is exactly what Mac found.
 *
 * The LABEL is decided here too rather than at the button, because
 * "Wear" over a torch is the lie that hid this: the act a player is
 * offered must name what pressing it does. Lighting and dousing are
 * the SAME act (UseItem toggles the single LightSource slot), so both
 * kinds perform `use(item, null)` and only the word changes.
 *
 * @param item     the picked item, or null
 * @param entity   the player, for the lit-by-reference compare
 * @returns {{kind: 'takeOff'|'wear'|'light'|'douse', label: string}|null}
 */
export function localPrimaryAct(item, entity = null) {
  if (!item) return null;
  // Worn first: the way out of a slot is Take off, whatever the item is.
  if (isEquipped(item)) return { kind: 'takeOff', label: 'Take off' };
  if (isLightSource(item)) {
    return entity?.lightSource === item
      ? { kind: 'douse', label: 'Douse' }
      : { kind: 'light', label: 'Light' };
  }
  // Mac (2026-09-18, off the audit's review shots): "Hide wear for non wearables" - a waterskin, a raw meat, a
  // gem offered WEAR. The equip table's own answer decides: no slot would take it, no verb. A throwaway table
  // answers when no entity is at hand (the slot rules are the item's, not the wearer's).
  if (getEquipSlot(entity ?? {}, item) === EQUIP_SLOTS.None) return null;
  return { kind: 'wear', label: 'Wear' };
}

/**
 * WHAT TO DO WITH A `useItem` RESULT - decided once, performed by the
 * view.
 *
 * `systems/useItem.js` owns the LAW (which item does what); what the
 * classic window adds on top is presentation plus ONE ordering rule
 * that is not presentation at all, and this exists so that rule is
 * written down and testable rather than retyped from memory:
 *
 * THE TWO HAND-OFFS RUN IN OPPOSITE ORDERS, and that is deliberate in
 * the classic window rather than an accident to copy carelessly. Both
 * exist because DFU PUSHES those windows over the inventory - a window
 * stack - while the port's hosts hold ONE overlay slot, so the
 * inventory must run its own close law or the pile it was about to
 * drop never mints (AUDIT B-C1). But:
 *
 *   BOOK:      hand over, THEN close. The reader takes a failure
 *              callback, and "a failed open still reports on this
 *              window - it is the live overlay until the reader
 *              actually shows".
 *   SPELLBOOK: close, THEN hand over. There is no callback, so the
 *              slot is freed first.
 *
 * The first draft of this module gave both `closeFirst: true` and its
 * pin asserted the same thing, because the code and the pin were
 * written from one wrong reading. The browser found it: closing first
 * also cleared the deps the hook was about to be read from, so the
 * book arm threw `deps.openBook is not a function`.
 *
 * A host that handed no hook keeps its window and SAYS SO, which is
 * why `pending` exists and why the classic window's own USE_PENDING
 * strings are reused here rather than reworded.
 */
export function useResultAction(r, { openBook = null, openSpellbook = null, placeCamp = null } = {}) {
  if (!r) return { kind: 'nothing' };
  // AUDIT 26: DaggerfallUI.PopToHUD() + return (:1687-1688). A watched
  // quest item that is neither parchment nor clothing closes the whole
  // window stack so the quest system gets first shot at the click in
  // the game world. NOTHING else on the ladder runs and NO message
  // shows - and PopToHUD is not the exit button, so no click plays.
  // First, because DFU returns before every arm below.
  if (r.popToHUD) return { kind: 'close' };
  if (r.kind === 'book') {
    return openBook
      ? { kind: 'openBook', item: r.item, failText: r.failText, closeFirst: false }
      : { kind: 'message', text: USE_PENDING.book };
  }
  if (r.kind === 'spellbook') {
    return openSpellbook
      ? { kind: 'openSpellbook', closeFirst: true }
      : { kind: 'message', text: USE_PENDING.spellbook };
  }
  // SURV3: a placeable - close, then hand the item to the host's ground (the spellbook arm's shape)
  if (r.kind === 'pitchCamp' || r.kind === 'placeFire') {
    return placeCamp
      ? { kind: 'placeCamp', item: r.item, closeFirst: true }
      : { kind: 'message', text: USE_PENDING[r.kind] };
  }
  // The classic window's own ladder, in its own order: an explicit
  // text, then a TEXT.RSC id, then the pending stand-in. AUDIT 22 F9:
  // `enchanted` is a RIDER on the arm's result, not a kind that
  // replaced it, so it only speaks when the arm itself said nothing.
  const out = { kind: 'message', text: null, textId: null,
    repaint: r.kind === 'variant', closesWindow: !!r.closesWindow };
  if (r.text) out.text = r.text;
  else if (r.textId) { out.textId = r.textId; if (r.macros) out.macros = r.macros; }   // MACROS1: the record's context rides with its id
  else if (r.pending) out.text = USE_PENDING[r.kind] ?? 'Nothing happens.';
  if (r.enchanted && !r.text && !r.textId) out.text = USE_PENDING.enchanted;
  return out;
}

// ── THE VIEW ─────────────────────────────────────────────────────

let host = null;
let deps = {};
let _view = null;   // JAN2: the live mount's handle - a second mount tears the first down
let model = null;
let worn = { rows: [], filled: 0, total: 0 };   // U59: the slots, as rows
let pickedAt = null;   // PX19i: WHERE the pick happened ('worn'|'dock'|'loot') - the same item highlights in two places, and the tooltip anchors to the one the hand touched
let tab = PAGE_IDS[0];
const _scrollMemo = new Map();   // PX22: scrollTop per tab across repaints
let _renderedTab = null;          // PX22: the tab the current DOM shows
let picked = null;      // the selected item object
let side = 'local';     // which list `picked` came out of
let notice = null;
/** ENH-NOTICE3: the notice panel's OWNER. A module-level object and not
 *  `_view`, because `_view` is null through the whole of the mount's
 *  first `render()` and again from the moment `unmount` nulls it - and
 *  the object that RAISED a panel has to be the object that releases
 *  it, or the key is lost and the panel is a leak. */
const noticeOwner = {};
// U57: the window's own session - which list is remote, and the
// session's drop pile. `dropped` is DFU's droppedItems and it MINTS ON
// CLOSE (AUDIT B-C1), which is why the door reads it back out.
let session = { usingWagon: false, allowDungeonWagonAccess: false, chooseOne: null };
let dropped = [];
let wagonLocal = [];
let remote = null;
/* PX20b (Mac: "when looting items, only open the loot tooltip, not the
   entire inventory window"). DFU opens the whole parchment because DFU
   has ONE window and both lists live in it; PX19c already split the
   remote into its own smaller frame, which makes a lighter answer
   possible: opening a CONTAINER shows that frame alone. Everything
   behind the glass is unchanged - the transfer ladder, the remote
   model, the take/stow arms, the wagon, the gold popup - because this
   is which frames are DRAWN, not what the window does. Opening the pack
   from a key (F6) or the world opens both, exactly as before.
   MAC-M2 B: PX20b's sentence here used to read "the pack is a press
   away", and that press was the loot bar's Pack button, which Mac has
   had removed. A loot session therefore never opens the pack: it is
   drawn or it is not, decided on the way in, and the way to the pack is
   to close the pile and press the key that has always opened it. */
let packOpen = true;
let goldEntry = null;   // the drop-gold field's live text, or null
let onExit = () => {};
let keyHandler = null;
let lockHandler = null;
// U54: how many times this screen has rebuilt itself. Every cold icon
// repaints when it lands, which is what makes the letters give way to
// the picture - so the count should be ROUGHLY the number of distinct
// icons and no more. A cache that forgot its in-flight records decodes
// each one once per repaint until the first lands, and the count
// doubles; the probe measures it, which is the only way that shows.
let repaints = 0;

/** "1 item", not "1 items". A count printed by a template literal is
 *  right eleven times out of twelve and wrong on the twelfth, which is
 *  the one the player is looking at when they drop something. */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const svg = (t, attrs) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

const sessionState = () => ({ ...session, dropped, wagonLocal });
const refresh = () => {
  model = packModel(deps);
  remote = remoteModel(deps, sessionState());
  worn = equippedModel(deps.entity);
  // PX25 (Mac: equipping and unequipping does not update the sprite
  // until the inventory is closed and reopened): THE PACK TELLS THE
  // RIG. D32 reads the equip table from the weapon rig's frame tick,
  // and the host's frame does not reach that tick while a window is
  // up - so the rebuild waited for the close. The pack is the one
  // place that knows the table just changed while it is open, so it
  // hands the worn list through the same door, setWorn, whose key
  // compare makes a no-change a no-op; the build settles, the
  // subscription (D36) repaints, the figure follows the action.
  const arm = deps.fpArm;
  if (arm && typeof arm.setWorn === 'function' && deps.entity) {
    try { arm.setWorn(dfWornEquipment(equipTableOf(deps.entity), EQUIP_SLOTS, ARMOR_ENUM)); } catch { /* the rig's own card carries its reasons */ }
    // PX26 F2: AND THE HAND. PX25 handed the rig the worn TABLE while a
    // window is up, and stopped there - so a cloak equipped in the pack
    // showed at once and a SWORD did not, because the weapon rides its
    // own door (setWeapon) off the same frame tick the window blocks.
    // Same read, same door, same key-compare fast path.
    try {
      const slots = equipTableOf(deps.entity);
      arm.setWeapon?.(slots?.[EQUIP_SLOTS.RightHand] ?? null,
        { hasAmmo: hasDaggerfallArrows(deps.entity.items) });
    } catch { /* see above */ }
  }
};

/** U59: recompose the avatar and repaint when it lands. The
 *  compositor coalesces overlapping requests itself (AUDIT 17e F16),
 *  so an equip during a compose is not dropped - which is why this can
 *  be fired at every change without a guard of its own. A build with
 *  no doll art returns immediately and the panel keeps the schematic. */
let _dollWarned = false;
function refreshFigure() {
  Promise.resolve(refreshPaperDoll(deps.entity))
    .then(() => { if (host) render(); })
    .catch((e) => {
      // PX19c: the schematic fallback is the honest DISPLAY, but a
      // SILENT failure reads as "the doll was never integrated" - it
      // says why, once, so a live report carries its own diagnosis.
      if (!_dollWarned) { _dollWarned = true; console.warn('[pack] the paper doll could not draw:', e?.message ?? e); }
    });
}

/** Wearing something, through the ONE chain. A refusal is REPORTED -
 *  the classic window pops TEXT.RSC for the same two cases, and a
 *  press that silently does nothing is what the anti-lie law forbids. */
/** INV1 (2026-09-15, Mac: "Add the ability to click and drag items to
 *  equip or reorganize in inventory").
 *
 *  THE DRAG PERFORMS THE ACT THE CARD ALREADY OFFERS. It does not grow
 *  a second rule for what a drop means: `localPrimaryAct` decides, the
 *  same function the act button reads, so dragging a torch onto the
 *  body LIGHTS it and dragging a cuirass WEARS it - and a refusal
 *  (broken, class-forbidden) says the same sentence either way.
 *
 *  Reordering is the pack's own list and nothing else's: it moves the
 *  item inside `entity.items`, which is what every page filter reads,
 *  so the order a player arranges is the order every tab shows and the
 *  save carries. It never crosses a side - a drag out of a loot pile is
 *  a TAKE, which is a click, and mixing the two would make a slip a
 *  transfer. */
/** AUDIT INV2 (2026-09-15, Mac: "I want it to be perfect") - THE DRAG IS
 *  THE PANE'S, NOT THE ROW'S, AND IT ENDS WHATEVER HAPPENS.
 *
 *  INV1 and INV2 hung the whole gesture off the originating row: its own
 *  `at` closure, its own pointer capture, its own up/cancel handlers.
 *  Three lenses found the same omission from three sides, and each one
 *  was confirmed by driving a real browser:
 *
 *  - TWO FINGERS, TWO ROWS. `at` was per row and the carried item was
 *    one module global, so a second finger on a second row passed the
 *    "one pointer" guard (that row's `at` was null), overwrote the
 *    global, and the FIRST finger's release dropped the SECOND finger's
 *    item. Silent item loss, on the touch device INV1 exists for.
 *  - THE ROW STOPS EXISTING. `render()` empties the host on an archive
 *    icon landing, on the paperdoll settling, on the arm rig rebuilding
 *    - all asynchronous, all reachable while a pointer is down. The
 *    capturing row is detached, its handlers never fire again, the drag
 *    never ends and the ghost freezes on screen.
 *  - THE POINTER IS TAKEN BACK. A right-click (and Android's long-press)
 *    raises `lostpointercapture` with no `pointercancel` behind it.
 *    Nothing listened for it, so the drag stayed live with `moved` true
 *    and the row was un-draggable for the rest of its life.
 *  - ESCAPE. `unmount` empties the host, and the ghost is the BODY's
 *    child, so closing the pack mid-drag left an item icon glued over
 *    the world until some later drag happened to clear it.
 *
 *  So the drag is ONE session owned by the pane, its listeners are on
 *  the WINDOW (which no repaint can detach), and every way it can end -
 *  release, cancel, capture loss, Escape, unmount - ends it through one
 *  door. The source is identified by ITEM rather than by row node, so a
 *  repaint mid-drag cannot make the item's own new row look like someone
 *  else's. */
let drag = null;

/** INV2: the ghost - the item's own tile under the pointer, carrying the
 *  act a release would perform.
 *
 *  IT IS `itemTile`'S TILE, not a second one. This file's header names
 *  the trap directly ("a second icon pipeline in this file is how the
 *  port ends up with two") - the Morrowind ground mesh, the classic
 *  sprite and the initials fallback are one function's answer already,
 *  and the ghost asks the same function.
 *
 *  It is `pointer-events: none` and lives on the BODY rather than inside
 *  the window: the hit test under it must answer the thing the cursor is
 *  over, and a node under the cursor would answer itself every time -
 *  and a ghost clipped to the panel could not be carried off it, which
 *  is the other half of what was asked for. */
let ghost = null;
const ghostEnd = () => { ghost?.remove(); ghost = null; };
function ghostStart(item) {
  ghostEnd();
  ghost = el('div', 'dragghost');
  ghost.append(itemTile(itemLine(item, deps.entity)));
  ghost.append(el('span', 'ghostact', ''));
  document.body?.appendChild(ghost);
}
/** AUDIT INV2 A3/A4: CLEAR OF THE FINGER, AND ON THE SCREEN.
 *  The ghost is a 44px tile over a verb chip, about 64px tall, and it
 *  was drawn centred on the reported point - so on a touch screen the
 *  contact patch covered the bottom of the icon and ALL of the verb,
 *  which is the only thing saying what a release would do. A touch
 *  carries it a thumb's height above the finger. And nothing clamped it,
 *  so at the screen edges it drew half off - precisely where the
 *  off-panel drop region is. */
const GHOST_LIFT_TOUCH = 52;
function ghostAt(x, y, verb) {
  if (!ghost) return;
  const w = globalThis.innerWidth ?? 0;
  const h = globalThis.innerHeight ?? 0;
  const lift = drag?.touch ? GHOST_LIFT_TOUCH : 0;
  ghost.style.left = `${w ? Math.min(Math.max(x, 40), w - 40) : x}px`;
  ghost.style.top = `${h ? Math.min(Math.max(y - lift, 40), h - 16) : y - lift}px`;
  const act = ghost.querySelector('.ghostact');
  if (act) { act.textContent = verb ?? ''; act.classList.toggle('on', !!verb); }
  ghost.classList.toggle('refused', verb === null);
}

/** WHAT A RELEASE HERE WOULD DO - one answer, read by the ghost's label
 *  while the pointer moves and by the release itself when it lands, so
 *  the word the player was shown is the act they get.
 *
 *  OUTSIDE THE WINDOWS IS THE TRANSFER THE SCREEN ALREADY OFFERS. It
 *  does not invent a drop: `stow` is the function behind the button
 *  beside the item, so carrying something off the panel Drops it on the
 *  ground, Stows it in the wagon or Puts it back in the chest exactly as
 *  pressing that button would.
 *
 *  AUDIT INV2 B-F3/B-F4: AND THE VERB IS THE REAL ANSWER, not `canStow`.
 *  `canStow` asks "should this BUTTON exist" - a refusal that SPEAKS
 *  earns a button - and INV2 reused it for "what will this release do",
 *  which are different questions. A quest item and a full wagon both
 *  refuse with text, so `canStow` said yes and the ghost read "Drop" in
 *  white before refusing on release; a cart refuses in SILENCE, so
 *  `canStow` said no, the ghost reddened, and the release then called
 *  `stow` on the one path where `stow` is guaranteed mute - a dead
 *  gesture that also wiped whatever the screen was saying. The plan's
 *  own `ok` is the honest answer to both, so the label is the plan's. */
function stowIntent(item) {
  const plan = planStore(item, {
    remote: remote.items, usingWagon: session.usingWagon, chooseOne: session.chooseOne,
    dryRun: true,   // as canStow's own note says: the quest rung WRITES, and a label must not
  });
  // A refusal that speaks is still worth releasing on - the player gets
  // the sentence. One that cannot speak is shown as refused and does
  // nothing, because a silent no-op is the drawn door PX14 forbids.
  if (plan.ok) return { kind: 'stow', label: STOW_LABEL[remote.kind] };
  return plan.refusal?.text ? { kind: 'stow', label: null, speaks: true } : { kind: 'nope', label: null };
}
function dropIntent(item, over, fromItem, source = 'local') {
  // MAC-M2 (2026-09-16, Mac: "Hold to drag enhanced functionality
  // doesn't work when trying to take items off your character"): A DRAG
  // THAT STARTED ON THE BODY HAS ONE DESTINATION, AND IT IS THE PACK.
  //
  // It is INV1's own law read in the other direction: the drop performs
  // the act the card already offers, so `dropOnBody` asks
  // `localPrimaryAct` and that answers Take off for a worn piece (and
  // Douse for the held light, the one body row that is not an equip
  // slot). One function for both directions, because two would drift.
  //
  // AND NOWHERE ELSE IS A TARGET. DFU's local list is FilterLocalItems,
  // which never shows an equipped item, so there is no transfer law
  // that can reach one: a worn cuirass released over the ground or over
  // an open chest would lie there AND stay in the equip table. Off the
  // dock the answer is the same "never mind" the pack's chrome gives.
  if (source === 'worn') {
    const act = localPrimaryAct(item, deps.entity);
    return over?.closest?.('.pack-dock') && act
      ? { kind: 'offbody', label: act.label }
      : { kind: 'none', label: '' };
  }
  if (over?.closest?.('.wornmap')) {
    const act = localPrimaryAct(item, deps.entity);
    return act ? { kind: 'body', label: act.label } : { kind: 'nope', label: null };
  }
  const onRow = over?.closest?.('.itemrow');
  const target = onRow ? rowItems.get(onRow) : null;
  // AUDIT INV2 A-F3: the source is the ITEM, never the row NODE - a
  // repaint mid-drag stands a NEW row for the same item, and an identity
  // test then read the item's own row as someone else's and offered to
  // move it above itself.
  if (target && target !== fromItem) return { kind: 'reorder', label: 'Move here', item: target };
  // AUDIT INV2 B-F7: the remote WINDOW is a drop target in its own
  // right. Dragging onto the open chest is the first gesture a player
  // tries for "store this", and reading it as panel chrome meant the
  // only way to store something was to drop it in the void beside the
  // window that was asking for it.
  if (over?.closest?.('.loot-win')) return stowIntent(item);
  if (over?.closest?.('.pack-win')) return { kind: 'none', label: '' };
  return stowIntent(item);
}

/** AUDIT INV1 Fb: THE DRAG IS POINTER EVENTS, NOT THE HTML5 DRAG API.
 *
 *  The first cut used `draggable` + dragstart/drop. Those do not fire
 *  from a touch, so the whole feature was mouse-only - on a screen the
 *  port ships to and whose 44px target law this arc has now enforced
 *  twice. Every other drag here is pointerdown/move/up
 *  (ui/heldMap.js's pan); this follows it.
 *
 *  ONE POINTER FOR THE PANE, and a 4px threshold, so a tap is still a
 *  pick - the row's own click law is untouched below that distance and
 *  suppressed above it. */
const dragHighlight = () => {
  for (const n of document.querySelectorAll('.dragover, .itemrow.dragging, .wornrow.dragging')) n.classList.remove('dragover', 'dragging');
};
/** Move the carried item to a point, and say what a release there does. */
function dragTo(x, y) {
  if (!drag) return;
  drag.x = x; drag.y = y;
  if (!drag.moved) return;
  dragHighlight();
  drag.row?.classList.add('dragging');
  const want = dropIntent(drag.item, document.elementFromPoint?.(x, y), drag.item, drag.source);
  drag.want = want;
  ghostAt(x, y, want?.label ?? null);
  if (want?.kind === 'body') document.elementFromPoint?.(x, y)?.closest?.('.wornmap')?.classList.add('dragover');
  // MAC-M2: the other direction lights the DOCK - the pack is one
  // target the way the map is one, not a grid of twelve tiles.
  else if (want?.kind === 'offbody') document.elementFromPoint?.(x, y)?.closest?.('.pack-dock')?.classList.add('dragover');
  else if (want?.kind === 'reorder') { for (const n of document.querySelectorAll('.itemrow')) if (rowItems.get(n) === want.item) n.classList.add('dragover'); }
}
/** THE ONE DOOR OUT. `commit` false is an abort - a cancel, a lost
 *  capture, Escape, the pane going away; nothing moves and nothing is
 *  said. */
function dragStop(commit) {
  const d = drag;
  drag = null;
  if (d?.hold) clearTimeout(d.hold);
  dragLock(false);
  ghostEnd();
  dragHighlight();
  if (typeof globalThis !== 'undefined') {
    globalThis.removeEventListener?.('pointermove', onDragMove, true);
    globalThis.removeEventListener?.('pointerup', onDragUp, true);
    globalThis.removeEventListener?.('pointercancel', onDragAbort, true);
    globalThis.removeEventListener?.('scroll', onDragScroll, true);
    globalThis.removeEventListener?.('contextmenu', onDragMenu, true);
    globalThis.removeEventListener?.('touchmove', onDragHold, true);
  }
  if (!d?.moved) return;
  _dragged = true;   // the click that follows a real drag is not a pick
  if (!commit) return;
  // AUDIT INV2 A-F8: the item is a reference held across time. Something
  // else can empty the pack under a live drag - a peer, a quest, a
  // script - and a stale one minted a ground pile for an item the player
  // no longer owned.
  if (!(deps.items?.() ?? []).includes(d.item)) return;
  const want = dropIntent(d.item, document.elementFromPoint?.(d.x, d.y), d.item, d.source);
  if (want?.kind === 'body') dropOnBody(d.item);
  // MAC-M2: THE SAME DOOR. A piece carried OFF the body performs the
  // act its own card offers, exactly as one carried onto it does, so
  // the two directions cannot answer differently - and the closed act
  // set INV1 wrote is still three.
  else if (want?.kind === 'offbody') dropOnBody(d.item);
  else if (want?.kind === 'reorder') reorderPack(d.item, want.item);
  else if (want?.kind === 'stow') stow(d.item);
}
/** AUDIT INV2 A1: A FINGER THAT MEANT TO SCROLL MUST NOT DROP THE ITEM.
 *  The shipped pack is not a list of rows - under `.pack-shell` every row
 *  is a 56px TILE in a wrapping grid inside a scrolling column - and
 *  every tile carried `touch-action: none`, so the only surface that
 *  could start a scroll was the 6px gap between them. Every finger-down
 *  was therefore a drag at a 4px threshold, and INV2 had just made a
 *  release off the panel a DROP: on a phone the off-panel region is a
 *  thin band down each side and across the top and bottom, which is
 *  exactly where a flick ends. A failed scroll threw the item on the
 *  floor, with no confirmation and no undo.
 *
 *  So a touch drag begins on a HOLD, the way every other touch surface
 *  in the world begins one: the rows pan by default (`touch-action:
 *  pan-y`), a flick scrolls and is never a drag, and only a finger that
 *  stays still picks anything up. Once it has, `.draglock` takes the
 *  pan back for the rest of the gesture. A MOUSE keeps the 4px
 *  threshold - a mouse has no scroll to steal.
 *
 *  INV3 corrects two of A1's numbers below: the slop is per-axis rather
 *  than one Manhattan sum, and `.draglock` does NOT take the pan back
 *  for the gesture in flight - `onDragHold` does. */
const TOUCH_HOLD_MS = 320;
/** INV3 (2026-09-17, Mac: "Hold to drag functionality in inventory
 *  sometimes doesnt work"): AND THE AXIS THAT CANNOT SCROLL IS NOT
 *  EVIDENCE OF A SCROLL.
 *
 *  A1 was right about the law and wrong about the measurement. It asked
 *  `|dx| + |dy| > 8` - one Manhattan sum over BOTH axes against half the
 *  room the browser itself allows - and a resting thumb does not hold
 *  still to five pixels. Measured in Chromium on a 430x860 phone
 *  (`tools/invDragProbe.mjs`), on the `touch-action: pan-y` tile this
 *  law is written for:
 *
 *  - the browser takes the gesture (`pointercancel`) at **16 CSS px**
 *    of VERTICAL travel and keeps it at 15 - the same number at device
 *    pixel ratio 1, 2 and 3, so it is CSS px and not device px;
 *  - it never takes it for HORIZONTAL travel at all, out to 160px,
 *    because a `pan-y` surface has no sideways pan to hand over.
 *
 *  So the old sum cancelled the hold twice over: at 8px when the
 *  browser allows 16, and on an axis where the browser has nothing to
 *  take. A finger drifting 5px across and 4px down - neither of which
 *  can scroll anything - lost the item it was reaching for. That is the
 *  SOMETIMES: the hold survived 0 of 12 trials at a 6px drift before
 *  this and 12 of 12 after.
 *
 *  ONE AXIS IS THE SCROLLER'S. The slop is per-axis now: vertical,
 *  where a pan really can start, at 12 - under the browser's own 16, so
 *  this law is the one that fires and it fires the same way every time -
 *  and horizontal at twice that, because nothing can take the gesture
 *  there and the only thing sideways travel proves is that the finger is
 *  going somewhere rather than resting.
 *
 *  A1'S LAW IS UNTOUCHED: a flick is vertical, so it still scrolls and
 *  is still never a drag, and a MOUSE still crosses at 4px. */
const TOUCH_HOLD_SLOP = 12;
const TOUCH_HOLD_SLOP_X = TOUCH_HOLD_SLOP * 2;
/** Has this finger left the hold? `dy` is the axis the list pans in and
 *  is judged tightly; `dx` is an axis nothing can pan and is judged
 *  loosely. Exported so the law can be pinned as a LAW rather than as
 *  whatever the drag happened to do on one path. */
export const holdBroken = (dx, dy) => Math.abs(dy) > TOUCH_HOLD_SLOP || Math.abs(dx) > TOUCH_HOLD_SLOP_X;
const dragLock = (on) => document.body?.classList?.toggle('draglock', !!on);
function dragArm() {
  if (!drag || drag.moved) return;
  drag.held = true;
  drag.moved = true;
  dragLock(true);
  ghostStart(drag.item);
  dragTo(drag.x, drag.y);
}
const onDragMove = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.ox;
  const dy = e.clientY - drag.oy;
  if (!drag.moved) {
    // a finger that moves before the hold was scrolling: let it go
    if (drag.touch) {
      if (holdBroken(dx, dy)) { dragStop(false); return; }
      // INV3: the hold STANDS, and it stands HERE. The origin is what
      // the slop is measured from, but the ghost must arm under the
      // finger's real position - drifting the allowed 12px and then
      // lifting an icon a dozen pixels away (and asking `dropIntent`
      // what is under THAT point) is the tell that the two were one
      // field.
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) <= 4) return;
    drag.moved = true;
    ghostStart(drag.item);
  }
  dragTo(e.clientX, e.clientY);
};
/** INV3: AND `.draglock` CANNOT TAKE THE PAN BACK ON ITS OWN.
 *
 *  A1 wrote "once the hold has armed, `.draglock` takes the pan back
 *  for the rest of the gesture", and the browser does not work that
 *  way: Chromium reads the effective `touch-action` when the touch
 *  SEQUENCE begins, and a rule that lands 320ms later does not reach
 *  the gesture already in flight. Measured, on a bare `pan-y` tile in a
 *  scroller with the lock applied the instant the hold armed: the list
 *  scrolled anyway and the pointer was cancelled anyway, exactly as
 *  with no lock at all. So the ghost lifted and then VANISHED the
 *  moment the carry moved down a scrollable list - the other half of
 *  Mac's "sometimes".
 *
 *  The one thing that still holds a live gesture is `preventDefault` on
 *  a cancelable `touchmove`, and an armed drag takes them (same probe:
 *  no cancel, and the list did not move). It is registered from the
 *  press rather than from the arming, because the first move after the
 *  hold is the one that must not get through, and it refuses nothing
 *  while the drag is unarmed - a flick still scrolls.
 *
 *  `.draglock` stays: it is what stops a SECOND finger panning the list
 *  out from under a live drag, which is a gesture that does begin under
 *  the class. */
const onDragHold = (e) => { if (drag?.moved && drag.touch && e.cancelable) e.preventDefault(); };
const onDragUp = (e) => { if (drag && e.pointerId === drag.id) dragStop(true); };
/** MAC-R4: the long-press menu never opens over a live session (see dragFrom). */
const onDragMenu = (e) => { if (drag && e.cancelable) e.preventDefault(); };
const onDragAbort = (e) => { if (drag && (e.pointerId === undefined || e.pointerId === drag.id)) dragStop(false); };
// AUDIT INV2 A-F5: a wheel moves the DOM under a STATIONARY cursor, so
// the highlight and the verb went on naming a row the pointer had left
// while the release hit-tested the one really under it - the player was
// shown one row and given another ten away. The intent is recomputed at
// the unchanged point.
const onDragScroll = () => { if (drag?.moved) dragTo(drag.x, drag.y); };

/** MAC-M2: `source` is 'local' for a pack row and 'worn' for a panel on
 *  the body. It is a WORD, not a node - AUDIT INV2 A-F3's law stands and
 *  the carried thing is still identified by ITEM - and the intent needs
 *  it, because the held light sits on the body with no `equipSlot` at
 *  all, so `isEquipped` cannot answer "did this come off the map". */
function dragFrom(row, item, source = 'local') {
  row.onpointerdown = (e) => {
    if (drag || e.button > 0) return;   // ONE pointer for the PANE: a second finger on a second row was how one drag dropped another's item
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    // INV3: `ox`/`oy` is where the finger LANDED and the slop is measured
    // from it; `x`/`y` is where the finger is NOW and the ghost arms on it.
    drag = { id: e.pointerId, item, row, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, moved: false, want: null, touch, hold: null, source };
    if (touch) drag.hold = setTimeout(dragArm, TOUCH_HOLD_MS);
    // MAC-R4 (2026-09-17, Mac: "Hold to drag in the enhanced inventory
    // sometimes doesn't work properly"): A TOUCH POINTER CAPTURES THE ROW
    // IT LANDS ON, IMPLICITLY, and a captured row that a repaint detaches
    // raises `lostpointercapture` - which INV2 read as "the pointer taken
    // back" and ended the session. `render()` runs on things a hold
    // cannot see coming (an archive icon landing, the doll settling, the
    // arm rig rebuilding - INV2's own list), so a press that overlapped
    // one died with no ghost and no refusal: the "sometimes". The
    // session's listeners are the window's and need no capture at all,
    // so it is given back the moment it is granted - synchronously here
    // (Chromium sets it before the pointerdown is dispatched) and again
    // on `gotpointercapture` for an agent that grants it after. With no
    // capture there is no capture to lose, and the abort that read its
    // loss is gone with it: a pointer really taken back arrives as
    // `pointercancel`, which is still an end (onDragAbort).
    const giveBack = () => { try { row.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ } };
    if (touch) { giveBack(); row.addEventListener?.('gotpointercapture', giveBack, { once: true }); }
    // The listeners are the WINDOW's: a repaint detaches this row, and a
    // drag that lived on it died there with the ghost still on screen.
    globalThis.addEventListener?.('pointermove', onDragMove, true);
    globalThis.addEventListener?.('pointerup', onDragUp, true);
    globalThis.addEventListener?.('pointercancel', onDragAbort, true);
    globalThis.addEventListener?.('scroll', onDragScroll, true);
    // MAC-R4: and the long-press menu - Android raises `contextmenu` at
    // about the hold's own length, and a menu that opens takes the
    // pointer (a cancel). The hosts' guard (ui/input.js
    // installContextMenuGuard) already refuses it on a host's document;
    // this refuses it for the session's own life on any document, so a
    // pane mounted without a host holds too.
    globalThis.addEventListener?.('contextmenu', onDragMenu, true);
    // INV3: passive FALSE, or the preventDefault above is ignored - a
    // window `touchmove` listener is passive by default in Chromium.
    globalThis.addEventListener?.('touchmove', onDragHold, { passive: false, capture: true });
  };
  rowItems.set(row, item);
}
/** Whether a drag is carrying something right now - the click law and
 *  the key law both have to know. */
export const dragLive = () => !!drag?.moved;
/** AUDIT INV2 A-F6/B-F6: THE CLICK GUARD WAS DEAD CODE. The row's own
 *  `onclick` tested for the `.dragging` class, and the release strips
 *  that class before it acts, so the test never fired - a drag released
 *  on the panel's own chrome ("never mind") went on to SELECT the row it
 *  had left, tooltip and all. The release leaves a latch instead, which
 *  the click that follows it consumes. */
let _dragged = false;
export const takeDragClick = () => { const was = _dragged; _dragged = false; return was; };
/** AUDIT INV2 A-F4: the pane going away ends the drag. The ghost is the
 *  body's child, so emptying the host cannot reach it. */
export const dragAbort = () => { if (drag) dragStop(false); };
/** Which item a rendered row stands for - the hit test answers an
 *  ELEMENT, and the reorder needs the thing it represents. */
const rowItems = new WeakMap();

function dropOnBody(item) {
  const act = localPrimaryAct(item, deps.entity);
  if (!act) return;
  if (act.kind === 'wear') { wear(item); return; }
  if (act.kind === 'takeOff') { takeOff(item.equipSlot); return; }
  // AUDIT 22 F6: the light arm takes NO collection, as DFU's equip click does
  use(item, null);
}

/** Move `item` to `before`'s place in the player's own list. */
function reorderPack(item, before) {
  const list = deps.entity?.items;
  if (!Array.isArray(list) || item === before) return;
  const from = list.indexOf(item);
  const to = list.indexOf(before);
  if (from < 0 || to < 0) return;
  // AUDIT INV1 Fa: the drop line is drawn ABOVE the target row, so the
  // item must LAND above it - and `to` was computed before the splice
  // that shifts everything after `from` down one. Dragging downward
  // therefore landed the item BELOW the row the line was drawn on
  // ([A,B,C] dragging A onto B gave BAC), so the affordance lied in one
  // of the two directions. Take the shift off when moving down.
  list.splice(from, 1);
  list.splice(from < to ? to - 1 : to, 0, item);
  refresh();
  render();
}

function wear(item) {
  notice = null;
  const named = itemLongName(item, { getQuest: deps.getQuest ?? null });   // RF6: the resolver's name, never the record's raw one (an unidentified magic item's)
  if (isBrokenItem(item)) { notice = `${named} is broken and cannot be worn.`; return render(); }
  if (isForbiddenEquip(deps.entity?.career, item)) {
    notice = `A ${deps.entity?.career?.name ?? 'character'} may not use ${named}.`;
    return render();
  }
  if (equipItem(deps.entity, item) === null) { notice = `${named} cannot be worn.`; return render(); }
  refresh();
  refreshFigure();   // U59: the avatar is wearing it now
  picked = null;     // PX24 (Mac): an action taken CLOSES the tooltip; a refusal above keeps it
  return render();
}

/** USING something, through the ONE law. The deps are the classic
 *  window's own, hook for hook - a host that hands none leaves the arm
 *  silent in exactly the way it leaves the classic window's silent. */
function use(item, collection = deps.items?.() ?? []) {
  notice = null;
  const r = useItem(item, collection, {
    entity: deps.entity,
    // AUDIT 22 F4: the oil arm looks for its lantern in the LOCAL pack
    // whatever list the click came from, so the bag travels separately.
    localItems: deps.items?.() ?? [],
    spellCount: () => deps.entity?.spells?.length ?? 0,
    isEnchanted,
    nowMinute: deps.nowMinute?.() ?? 0,
    revealMap: deps.revealMap ?? null,
    drinkPotion: deps.drinkPotion ?? null,
    // AUDIT 26: QuestMachine.GetQuest (:1673) - the use-click block's
    // reach. The same seam the transfer ladder's quest arm reads.
    getQuest: deps.getQuest ?? null,
  });
  const act = useResultAction(r, { openBook: deps.openBook, openSpellbook: deps.openSpellbook, placeCamp: deps.placeCamp });
  // AUDIT 26's PopToHUD: the window stack goes, nothing is said.
  if (act.kind === 'close') { onExit(); return; }
  // THE HOOKS ARE READ BEFORE ANYTHING CLOSES. `onExit` unmounts, and
  // unmounting clears `deps` - so a hook read after it is undefined.
  // That is not hypothetical: the first draft closed first and threw
  // `deps.openBook is not a function` on the first real press.
  if (act.kind === 'openBook') {
    const open = deps.openBook, fail = act.failText;
    // HAND OVER, THEN CLOSE - the reader's failure callback reports on
    // this window while it is still the live overlay.
    open(act.item, () => { notice = fail; render(); });
    onExit();
    return;
  }
  if (act.kind === 'openSpellbook') {
    const open = deps.openSpellbook;
    onExit();   // CLOSE, THEN HAND OVER - no callback, so free the slot
    open();
    return;
  }
  if (act.kind === 'placeCamp') {
    const place = deps.placeCamp;
    onExit();   // SURV3: the same law - the host's HUD line says where the camp stands, or why not
    place(act.item);
    return;
  }
  if (act.textId && deps.rows) {
    const rows = expandRowValues(deps.rows(act.textId) ?? [], act.macros ?? null);   // MACROS1: %map is the map's name
    notice = rows.map((row) => (typeof row === 'string' ? row : row?.text ?? '')).join(' ').trim() || null;
  } else if (act.text) {
    notice = act.text;
  }
  refresh();
  if (act.closesWindow) { onExit(); return; }
  picked = null;     // PX24: a use, however it reported, closes the tooltip
  render();
}

function takeOff(slot) {
  notice = null;
  unequipSlot(deps.entity, slot);
  refresh();
  refreshFigure();
  picked = null;     // PX24: the action closes the tooltip
  render();
}

/** A refusal, rendered. The LADDER decides whether a transfer happens
 *  and whether the player is told; a refusal with no text - DFU's
 *  transport block, the choose-one pile - is a click that does
 *  nothing, and this pane does not draw a control for one (see
 *  `canStow`), so reaching here silently means the law changed under
 *  the view rather than the view guessing. */
function refuse(refusal) {
  notice = refusal.text ?? null;
  render();
}

/** Whether STOW is a control at all. Asked of the LAW rather than
 *  decided here: a refusal the player would never see is a button
 *  that can only do nothing, and U53 deleted a "worn" badge for
 *  exactly that. A refusal that SPEAKS still gets its button - the
 *  full wagon has something to say. */
function canStow(item) {
  // DRY RUN, and it has to be: AUDIT 26's quest rung WRITES as it
  // passes (playerDropped, and re-permanenting a clone), which is
  // right for a click and catastrophic for a render - every repaint
  // would mark a quest item as dropped. The dry run cannot change the
  // answer, because that rung's refusal speaks.
  const plan = planStore(item, {
    remote: remote.items, usingWagon: session.usingWagon, chooseOne: session.chooseOne,
    dryRun: true,
  });
  return plan.ok || !!plan.refusal.text;
}

/** LOCAL -> REMOTE, through U56's ladder. */
function stow(item) {
  notice = null;
  const to = remoteTarget(deps, sessionState());
  const plan = planStore(item, {
    remote: to, usingWagon: session.usingWagon, chooseOne: session.chooseOne,
    getQuest: deps.getQuest ?? null,
  });
  if (!plan.ok) return refuse(plan.refusal);
  // AUDIT INV2 B-F2: THE MAP IS AN INTERCEPTION, not a transfer. AUDIT
  // 26 F156: planStore answers `{ ok: true, map: true }` for a
  // MiscItems.Map - the reveal runs, the paper is consumed, nothing
  // lands in the destination. The classic window routes it
  // (nativeInventory.js:829) and this one did not, so dragging a
  // treasure map out of the pack dropped the paper on the floor and
  // revealed nothing.
  if (plan.map) { use(item, deps.items?.() ?? []); return; }
  // MAC-O6: the same cue this window's `take()` gained - storing (selling,
  // banking, dropping into a wagon or a pile) is a transfer too, and
  // planStore already hands back the sound (itemTransfer.js:220), unread
  // until now.
  if (enhancedSoundsOn()) audio.playOneShot(plan.sound === 'gold' ? SOUND.GoldPieces : SOUND.ButtonClick, 1);   // ES1: the row's switch
  // PX24 (Mac: an action taken closes the tooltip): the transfer
  // happens and the tip goes. The earlier law kept the ARRIVING item
  // picked so it could be put straight back; the player can pick it
  // again on the other side, and a tip that stays open after every
  // press is the quirk being fixed.
  // AUDIT INV2 B-F1: THE ENTITY AND THE PROVENANCE RIDE, as they do at
  // the classic window's own call (nativeInventory.js:789). Without them
  // `clearLightSourceOnLeave` - AUDIT 26 F157's first statement inside
  // applyTransfer - is a no-op, so a LIT TORCH dropped on the ground
  // went on lighting the player from where it lay. INV2 made that a
  // gesture; it was already the button's.
  applyTransfer(item, plan, deps.items?.() ?? [], to, { entity: deps.entity, fromLocal: true });
  // AUDIT INV2 B-F9: `stow` was written for the BUTTON, whose argument
  // is always `picked`; a drag hands it any row. Closing a tooltip the
  // player opened on some OTHER item, and moving `side` to a remote list
  // with nothing picked on it, is the button's business and not this
  // item's.
  if (picked === item) { picked = null; side = 'remote'; }
  refresh();
  render();
}

/** REMOTE -> LOCAL, through the same ladder. */
function take(item) {
  notice = null;
  const from = remoteTarget(deps, sessionState());
  const bag = deps.items?.() ?? [];
  const plan = planTake(item, {
    bag, entity: deps.entity, mode: 'remove',
    chooseOne: session.chooseOne, usingWagon: session.usingWagon,
    getQuest: deps.getQuest ?? null,
  });
  if (!plan.ok) return refuse(plan.refusal);
  // AUDIT INV2 B-F2: the map is an interception in EITHER direction
  // (itemTransfer.js:242, "F156: either direction") - taking one off a
  // pile reveals and consumes it, exactly as stowing one does. The
  // classic window routes both; this one routed neither.
  if (plan.map) { use(item, remoteTarget(deps, sessionState())); return; }
  // MAC-O6 (report: "looting gold/items makes no sound"): DoTransferItem's
  // own cue (:1569 gold's clink, :1583 everything else), which the classic
  // window plays (nativeInventory.js:855) and this one never did - the ONLY
  // difference between the two windows' calls to planTake/applyTransfer was
  // that this one dropped `plan.sound` on the floor. Played here, ahead of
  // the gold interception below, exactly as DFU's own PlayOneShot sits
  // ahead of that arm's `return` in DoTransferItem.
  if (enhancedSoundsOn()) audio.playOneShot(plan.sound === 'gold' ? SOUND.GoldPieces : SOUND.ButtonClick, 1);   // ES1: the row's switch
  // E4: the pack IS the destination here, so DoTransferItem's gold
  // interception (:1562-1571) fires and answers null - its `return`
  // skips the choose-one close below, and there is no arriving record
  // for the tab to follow.
  const taken = applyTransfer(item, plan, from, bag, { entity: deps.entity, toPlayer: true });
  if (taken === null) { picked = null; refresh(); render(); return; }
  // G6 (:1585-1591): ONE is the whole gift. The window closes and the
  // callback runs - the claim and the taking are one event, so this
  // arm must not repaint a screen that is going away.
  if (plan.claimsChoice) {
    const cb = session.chooseOne.onChoose;
    session.chooseOne = null;
    onExit();
    cb?.(taken);
    return;
  }
  // PX28 (Mac: "when looting, there's a 2nd popup when you take
  // something, there shouldn't be"): looting just takes - no card
  // pops over the frame you are reading. PX24/AUDIT 35 (Mac: the same
  // when looting containers, bodies, etc.): the pack-open flow used to
  // keep the TAKEN item selected in the bag, which raised the tooltip
  // on the other side after every take - the very quirk PX24 closed
  // for wear, use and stow. An action taken closes the tooltip, on
  // both sides of the window; the tab still follows the arrival.
  picked = null;
  if (packOpen) {
    side = 'local';
    // The pack's TAB follows what just arrived, or the player takes a
    // sword on the Ingredients page and watches nothing happen.
    tab = pageOf(taken);   // PX31: the page an item lives on is total
  }
  refresh();
  render();
}

/** WagonButton_OnMouseClick's ladder (:1234-1243), through U57. */
function toggleWagon() {
  notice = null;
  const plan = planWagonToggle(deps, session);
  if (!plan.ok) return refuse(plan.refusal);
  session.usingWagon = plan.usingWagon;
  // The selection belonged to the list that just went away.
  if (side === 'remote') { picked = null; side = 'local'; }
  refresh();
  render();
}

/** DropGoldPopup_OnGotUserInput (:1269-1303), through U56. The FIELD
 *  is this pane's; the range refusal and the wagon clamp are not. */
function dropGold(text) {
  notice = null;
  const player = deps.entity ?? {};
  const to = remoteTarget(deps, sessionState());
  const plan = planDropGold(text, {
    carried: goldAmount(player), usingWagon: session.usingWagon, remote: to,
  });
  if (plan.notice) notice = plan.notice;
  if (plan.ok) {
    deductGold(player, plan.amount);
    addItem(to, goldStack(plan.amount));
    goldEntry = null;
  }
  refresh();
  render();
}

// ── THE CHARACTER PANEL ──────────────────────────────────────────
// The screen's one picture of the player, and the place the VOXEL
// character render lands when it is ready: this panel owns the space
// and the sizing. PX19d: what fills it is the WORN MAP - the tiles on
// the body's own coordinates ARE the schematic now (they need no
// ARENA2, so a player with no game data still sees their slots), and
// the paperdoll stands behind them whenever its art can draw.

// ── MW-D36: the model figure ─────────────────────────────────────────
let _figureYaw = 0;
let _figureCache = { key: null, img: null };   // MF1: the pixels (ImageData), not a PNG
let _figureRaf = 0;   // MF1: the one pending drag repaint
let _unsubscribeFigure = null;
/** The built third-person body's pixels at the current yaw, or null
 *  when no body stands. Cached per (yaw, build) so a re-render of the
 *  window does not re-read the GPU.
 *
 *  MF1 (Mac: the model in the inventory is "overall clunky"): THE
 *  FIGURE IS PIXELS, NOT A PNG. This used to hand back a data URL:
 *  every fresh yaw and every settlement was a GPU readback, a PNG
 *  ENCODE of a 384px image, and an `<img>` DECODE of it on the other
 *  side - three of the four costs were the encoding, and the decode
 *  landed a frame or two late, which is the lag a drag felt. The
 *  ImageData goes straight onto a canvas now (modelFigure), and a
 *  drag repaints that one canvas on the animation frame instead of
 *  rebuilding anything. */
function modelFigureImage() {
  const armMod = deps.fpArm;
  if (!armMod || typeof armMod.figure !== 'function') return null;
  const st = armMod.status?.();
  // AUDIT 33 F2: the yaw is QUANTISED to a tenth of a radian, so a drag
  // re-renders the figure about sixty times per turn instead of once
  // per pixel, and dragging back lands on cached frames. The build's
  // settlement clears this cache (subscribe).
  const yaw = Math.round(_figureYaw / 0.1) * 0.1;
  const key = `${st?.pieces ?? 0}:${st?.skeletonPath ?? ''}:${yaw.toFixed(1)}`;
  if (_figureCache.key === key) return _figureCache.img;
  let px = null;
  try { px = armMod.figure({ yaw, height: 384 }); } catch { px = null; }
  let img = null;
  if (px && px.width && px.height) {
    try { img = new ImageData(px.data, px.width, px.height); } catch { img = null; }
  }
  _figureCache = { key, img };
  return img;
}
/** MF1: the pixels onto a canvas - no encode, no decode. */
function paintFigure(cv, img) {
  if (cv.width !== img.width) cv.width = img.width;
  if (cv.height !== img.height) cv.height = img.height;
  cv.getContext('2d')?.putImageData(img, 0, 0);
}
/** The figure as a canvas element, or null when no body stands. */
function modelFigure() {
  const img = modelFigureImage();
  if (!img) return null;
  const cv = document.createElement('canvas');
  paintFigure(cv, img);
  return cv;
}
/** MW-D38: a Daggerfall item's Morrowind icon as a data URL, or null.
 *  QS3 moved the body to ui/itemIconUrl.js, because the HUD's quickslot
 *  diamond wants the same picture of the same item and importing this
 *  screen to reach twenty lines would drag the whole window into every
 *  frame drawHud makes. The rig it reads is still the one the host
 *  mounted this screen with - a page with no Morrowind data behind it
 *  draws the classic icon, exactly as before. */
const modelIconUrl = (item, size) => modelIconUrlOf(item, size, deps.fpArm);

/** Drag left/right to turn the figure; a tap does nothing (display only).
 *  MF1: the move records the yaw and asks for ONE repaint on the next
 *  animation frame - a pointer reports faster than the screen draws,
 *  and rendering the body per report was work the eye never saw. */
function attachFigureTurn(cv) {
  let down = null;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, yaw: _figureYaw }; cv.setPointerCapture?.(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!down) return;
    _figureYaw = down.yaw + (e.clientX - down.x) * 0.02;
    if (_figureRaf) return;
    _figureRaf = requestAnimationFrame(() => {
      _figureRaf = 0;
      if (!cv.isConnected) return;   // the window repainted under the drag; its new canvas owns the next frame
      const img = modelFigureImage();
      if (img) paintFigure(cv, img);
    });
  });
  const up = () => { down = null; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}

/** The avatar, at whatever scale the column gives it. */
function dollPanel(url) {
  const wrap = el('div', 'figure-doll');
  const img = el('img');
  img.src = url;
  img.alt = 'Your character, wearing what is equipped';
  // GetEquipIndex, through the compositor's own click mask
  // (PaperDollRenderer's itemLayout walked backwards). The panel is
  // drawn at a whole-number scale, so a click maps back by division -
  // and the mask is in PANEL pixels, which is what slotAtPaperDoll
  // wants.
  img.onclick = (e) => {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const slot = slotAtPaperDoll(
      Math.floor((e.clientX - r.left) * PAPERDOLL_W / r.width),
      Math.floor((e.clientY - r.top) * PAPERDOLL_H / r.height),
    );
    if (slot != null) takeOff(slot);
  };
  wrap.append(img);
  return wrap;
}


/** The twenty-seven slots, named, with what is in them.
 *  PX19d (Mac's concept reference): THE SLOTS STAND ON THE BODY. The
 *  SLOT_MAP has carried the classic doll's anatomical coordinates
 *  since U59 - the tiles now sit AT them, scaled: helm above, amulets
 *  and rings on their flanks, hands at the hands, feet below, the
 *  marks and crystals settling into the off-body row the map already
 *  gives them. The DOLL STANDS BEHIND the tiles when it has art;
 *  names retreat to the plaque (the tile is monogram + slot word,
 *  the reference's own reading) but stay in the DOM for every probe
 *  that counts them. */
/** PX19d composition: the classic dot coordinates were made for 12px
 *  markers - 56px tiles at those centers pile onto each other - so
 *  the map is a DESIGNED grid instead: five columns, seven rows, the
 *  paired slots split to the sides the classic gives them (the
 *  viewer's left is the character's RIGHT, exactly as the doll is
 *  drawn), the anatomy down the center, marks and crystals in the
 *  off-body bottom row. Keyed by label + occurrence, in worn.rows'
 *  own y-then-x order, so the first Bracer is the right-side one. */
/** PX19e (Mac: "instead of a thousand equipment slots, a smart
 *  system with minimal slots"): ELEVEN FAMILIES, TWENTY-SEVEN SLOTS.
 *  The data keeps DFU's 27 - equip.js, equippedModel and every law
 *  are untouched - but the MAP shows the reference's own count:
 *  eleven large panels, each a slot FAMILY. CHEST holds the armour
 *  layered over the clothes; NECK both amulets; ARMS the arm pieces
 *  and bracers; HANDS the gloves and bracelets; TOKENS the marks,
 *  crystals and the unnamed pair (which therefore surface exactly
 *  when filled, keeping U53's hidden-slot law). A filled family
 *  shows its TOP piece with a count badge when it holds more, and
 *  clicking CYCLES the family - minimal to look at, nothing out of
 *  reach. The composition is the reference's: helm crowned, neck
 *  and rings on the right flank, the big chest center spanning two
 *  rows, weapons flanking low, feet grounding it. */
/** PX19g (Mac: "stop making incremental improvements and actually
 *  look"): THE CHARACTER REGION COMPOSED. The doll is not decoration
 *  slapped behind a grid - it OWNS the center column, framed, with a
 *  home whether or not its art can draw (an empty frame reads
 *  Avatar, so the composition never collapses to a pile of tiles).
 *  PX20a (Mac: "spread out and organize the center ... enlarge the
 *  paper sprite"): the doll's cell was three of five rows in the
 *  middle column - LANDSCAPE, and a paperdoll is a standing figure.
 *  HEAD and CHEST moved to the flanks, so the doll takes the WHOLE
 *  centre column, six rows tall, and the sprite is portrait at last.
 *  The two sides now say something: what you WEAR down the left, top
 *  to toe, and what you CARRY (and stand in) down the right.
 *      Head    [DOLL]   Rings
 *      Neck    [DOLL]   Tokens
 *      Cloaks  [DOLL]   R-Wpn
 *      Chest   [DOLL]   L-Wpn
 *      Arms    [DOLL]   Legs
 *      Hands   [DOLL]   Feet        */
const WORN_FAMILIES = Object.freeze([
  { id: 'head', label: 'Head', area: '1 / 1', slots: ['Head'] },
  { id: 'neck', label: 'Neck', area: '2 / 1', slots: ['Amulet'] },
  { id: 'cloaks', label: 'Cloaks', area: '3 / 1', slots: ['Cloak'] },
  { id: 'chest', label: 'Chest', area: '4 / 1', slots: ['Chest, armour', 'Chest, clothes'] },
  { id: 'arms', label: 'Arms', area: '5 / 1', slots: ['Right arm', 'Left arm', 'Bracer'] },
  { id: 'hands', label: 'Hands', area: '6 / 1', slots: ['Gloves', 'Bracelet'] },
  { id: 'rings', label: 'Rings', area: '1 / 3', slots: ['Ring'] },
  { id: 'tokens', label: 'Tokens', area: '2 / 3', slots: ['Mark', 'Crystal', 'Unnamed'] },
  { id: 'rhand', label: 'R\u00b7Weapon', area: '3 / 3', slots: ['Right hand'] },
  // HT5: the held light shares the off hand's panel and is listed
  // FIRST, because the mod frees a hand to hold one - so when both are
  // filled the torch is the thing you just did, and the weapon is one
  // tap away on the family's own cycle.
  { id: 'lhand', label: 'L\u00b7Hand', area: '4 / 3', slots: ['Light', 'Left hand'] },
  { id: 'legs', label: 'Legs', area: '5 / 3', slots: ['Legs, armour', 'Legs, clothes'] },
  { id: 'feet', label: 'Feet', area: '6 / 3', slots: ['Feet'] },
]);
const DOLL_AREA = '1 / 2 / span 6 / auto';
function equippedList() {
  // PX20c (Mac: "move the name outside of the space and to the top
  // bar, remove the slots filled subtext... utilize the entire area").
  // PX19h put the character's NAME over the map as a plate, and PX19g
  // put a count under it; between them they took ~50px off the top of
  // the region for two things that are not the region. The name is a
  // WINDOW title now, beside 'Pack' in the bar that already names the
  // window; the count is gone, because 0 of 27 slots filled is a
  // number nobody reads and the tiles say it by being empty. The whole
  // area is the map's.
  const wrap = el('section', 'equipped');
  const map = el('div', 'wornmap');
  // INV1: the body is the equip target - `dragFrom`'s pointerup finds
  // the MAP by hit test, so the map itself needs no handler.
  // MAC-M2: the panels ON it do. INV1's sentence here used to read "so
  // the map needs no handler of its own", which was true of the
  // direction it shipped and is why the other one was unreachable - a
  // press on a filled slot started no drag session at all.
  // PX19g: the doll's FRAME is part of the composition and is always
  // there - art inside it when the paperdoll can draw, a quiet
  // Avatar plaque when it cannot. Slapped-behind is over.
  // PX20a: 4x, not 3x - the cell is half again as tall as it was, and
  // a 3x sprite scaled up by object-fit is a blur where every other
  // pixel on this window is exact.
  // MW-D36: THE MODEL STANDS WHERE THE DOLL STOOD. When the Morrowind
  // third-person body is built - dressed by this very equip table,
  // wearing the matched face - the panel shows THAT, rendered off the
  // GPU as an image, turnable by drag. Display only, by Mac's call:
  // unequip stays with the list. No body built = the classic doll,
  // exactly as before; the classic skin never sees any of this.
  // MF1: the model is a CANVAS of its pixels; the classic doll stays
  // the data-URL `<img>` it was (one composite per equip, cached).
  const figure = modelFigure();
  const dollUrl = figure ? null : paperDollDataUrl(paperDollPixels(), { scale: 4 });
  // PX20a: the frame belongs to the PLACEHOLDER, not to the sprite -
  // with art the figure stands on the window's own glass.
  const dollFrame = el('div', `wornmap-doll${figure || dollUrl ? ' hasart' : ' noart'}${figure ? ' model' : ''}`);
  dollFrame.style.gridArea = DOLL_AREA;
  if (figure) {
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', 'Your character, as the Morrowind body wears it');
    attachFigureTurn(figure);
    dollFrame.append(figure);
  } else if (dollUrl) {
    const img = document.createElement('img');
    img.src = dollUrl;
    img.alt = 'Your character';
    dollFrame.append(img);
  } else {
    dollFrame.append(el('span', 'worntile', '\u25c7'), el('span', 'wornslot', 'Avatar'));
  }
  map.append(dollFrame);
  wrap.append(map);
  const byLabel = new Map();
  for (const row of worn.rows) {
    if (!byLabel.has(row.label)) byLabel.set(row.label, []);
    byLabel.get(row.label).push(row);
  }
  for (const fam of WORN_FAMILIES) {
    const rows = fam.slots.flatMap((s) => byLabel.get(s) ?? []);
    // Slot order within a family IS the layer order: armour before
    // clothes, arms before bracers - the first filled row is the top
    // of the pile, the piece a body shows.
    const filled = rows.filter((r) => r.item);
    // AN EMPTY FAMILY IS NOT A CONTROL, so it is not a BUTTON - the
    // law that shaped the old per-slot rows (twenty-two disabled 24px
    // buttons on a bare character), one size up. `wornempty`, not
    // `empty`: the stylesheet owns `.empty` as a component, the third
    // collision of that shape in the arc after `.detail`/`.packcol`.
    if (!filled.length) {
      const d = el('div', 'wornrow wornempty');
      d.title = fam.slots.join(' \u00b7 ');
      d.style.gridArea = fam.area;
      const txt = el('span', 'worntext');
      txt.append(el('span', 'wornslot', fam.label), el('span', 'wornname wornempty', '\u2014'));
      d.append(el('span', 'worntile', '\u25c7'), txt);
      map.append(d);
      continue;
    }
    const top = filled.find((r) => r.item === picked) ?? filled[0];
    const line = itemLine(top.item, deps.entity);
    const b = el('button', `wornrow${filled.some((r) => r.item === picked) ? ' on' : ''}`);
    // MAC-M1: the WORN map's hover carries the rating too, and this is
    // the surface Mac's second sentence is about - "not sure if armor
    // has values either". Armour is the thing you are wearing, so the
    // place a player asks that question is here, over the slot, not in
    // the pack. One item per line, its number in brackets when it has
    // one.
    b.title = filled.map((r) => {
      const l = itemLine(r.item, deps.entity);
      return `${r.label}: ${l.name}${itemStatSuffix(l)}`;
    }).join('\n');
    b.style.gridArea = fam.area;
    b.append(itemTile(line));
    const txt = el('span', 'worntext');
    txt.append(el('span', 'wornslot', fam.label), el('span', 'wornname', line.name));
    b.append(txt);
    if (filled.length > 1) b.append(el('span', 'worncount', String(filled.length)));
    // MAC-M2 (Mac: "hold to drag ... doesn't work when trying to take
    // items off your character"): A FILLED PANEL DRAGS, on the same hold
    // and the same threshold a pack row takes. INV1 attached `dragFrom`
    // to the LIST's rows alone and made the body a drop TARGET, so the
    // gesture only ever ran one way: a press on the doll started no
    // session at all, which is not a refusal a player can read - it is a
    // dead hold. The piece carried is the one the panel SHOWS (a family
    // cycles on the click, and the drag takes what is on top).
    dragFrom(b, top.item, 'worn');
    // SELECTS, never undresses (the mis-click law) - and a click on an
    // already-picked family CYCLES to its next piece and wraps, so a
    // family of four is four taps and all 27 slots stay reachable
    // from eleven panels.
    b.onclick = () => {
      // MAC-M2: and a release that DRAGGED is not a pick here either -
      // the same latch the list's rows consume (AUDIT INV2 A-F6).
      // Without it every unequip-by-drag also cycled the family it left.
      if (takeDragClick()) return;
      // PX19i: cycle through the family, and when the cycle would
      // land back where it started the tooltip goes AWAY instead -
      // a single-piece family is a plain toggle.
      const i = filled.findIndex((r) => r.item === picked);
      const next = filled[(i + 1) % filled.length].item;
      picked = (i >= 0 && next === picked) ? null : next;
      pickedAt = 'worn';
      side = 'local'; notice = null; render();
    };
    map.append(b);
  }
  return wrap;
}

/** PX21a (Mac: "we need to find a way to fit in the mounts/wagon in
 *  the inventory"). A horse and a cart are ItemGroups.Transportation,
 *  and filterByTab has no arm for them - they fall through into the
 *  fourth tab with the shirts, which is DFU's own behaviour and is why
 *  a player who buys a horse cannot find it. They are not WORN and not
 *  really CARRIED: they are what you TRAVEL with, so they get their own
 *  strip under the map, beside the wear-left/carry-right map that has
 *  no room for a third idea.
 *
 *  The CART plaque is also the wagon's door - the one the loot frame's
 *  Wagon button opens - so the thing and the place it opens are the
 *  same control. It refuses the way the session refuses (no cart, or a
 *  dungeon with the exit too far), because the refusal is
 *  inventorySession's law and this is a button, not a second rule. */
const TRANSPORT = Object.freeze([
  { id: 'mount', label: 'Mount', owned: hasHorse, empty: 'On foot' },
  { id: 'cart', label: 'Cart', owned: hasCart, empty: 'None' },
]);

function transportStrip() {
  const items = deps.items?.() ?? [];
  const strip = el('div', 'transport');
  for (const t of TRANSPORT) {
    // U58's law, honoured: the SESSION answers "do you have one" and
    // hands back the item to draw. No template index is read here.
    const owned = t.owned(items) ? transportItem(items, t.id) : null;
    const isCart = t.id === 'cart';
    // A plaque that opens something is a BUTTON; one that only reports
    // is not - the empty-family law from the worn map, one strip down.
    const node = el(isCart && owned ? 'button' : 'div',
      `tplaque${owned ? '' : ' tempty'}${isCart && session.usingWagon ? ' on' : ''}`);
    const line = owned ? itemLine(owned, deps.entity) : null;
    node.append(line ? itemTile(line) : el('span', 'worntile', '\u25c7'));
    const txt = el('span', 'worntext');
    txt.append(el('span', 'wornslot', t.label),
      el('span', `wornname${owned ? '' : ' wornempty'}`, line ? line.name : t.empty));
    node.append(txt);
    if (isCart && owned) {
      node.append(el('span', 'tgo', session.usingWagon ? 'Close' : 'Open'));
      node.onclick = toggleWagon;
      node.title = session.usingWagon ? 'Leave the wagon' : 'Open the wagon';
    }
    strip.append(node);
  }
  return strip;
}

function characterCol() {
  // PX19d: the doll lives INSIDE the worn map now (behind the tiles);
  // stacking figurePanel above it would draw the avatar twice - or
  // the schematic beside the map, which is the same information told
  // twice. The map alone is the figure.
  const col2 = el('section', 'charcol');
  col2.append(equippedList());
  col2.append(transportStrip());
  return col2;
}


// NO "WORN" MARK ON A ROW, and the reason is DFU's: filterByTab is
// FilterLocalItems, and its first line drops every equipped item -
// worn kit leaves the list. A badge here could never render, and a
// decoration that cannot render is the same lie as a button that does
// nothing. Worn items live on the SLOT MAP, which is the whole
// argument this screen makes.
/**
 * The item's own icon, or its initials.
 *
 * THE INITIALS ARE THE FALLBACK NOW, not the answer. A screen with no
 * ARENA2 behind it - a test page, a failed archive, a record past the
 * end - still tells a Longsword from a Lockpick in a list you are
 * scanning, which is what the prototype's tile was for. When the real
 * record lands the whole screen repaints and the letters give way.
 */
function itemTile(line) {
  // MW-D38: the Morrowind ground mesh stands in for the sprite when a
  // body is built and the item resolves through the one map; the
  // classic icon stands otherwise. Enhanced only, like everything here.
  const src = modelIconUrl(line.item, 96)
    || (line.image
      ? requestIcon(line.image.archive, line.image.record, { scale: 2, onReady: render })
      : null);
  if (src) {
    const tile = el('span', 'tile has-icon');
    const img = el('img');
    img.src = src;
    img.alt = '';
    // NO WIDTH ATTRIBUTE. These sprites are not square - a dagger is
    // tall and narrow, a cuirass wide - and forcing 30 across squashes
    // every one of them. The CSS caps both axes instead, which scales
    // to fit and keeps the shape.
    tile.append(img);
    // MAC-M1: the GRID's own hover, which is the most literal reading of
    // "weapon tool tips" - it said the name and nothing else.
    tile.title = line.name + itemStatSuffix(line);
    return tile;
  }
  const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  tile.title = (line.image
    ? `${line.name} — TEXTURE.${line.image.archive} record ${line.image.record}`
    : line.name) + itemStatSuffix(line);
  return tile;
}

/** MAC-M1: the one number an item is FOR, as a hover suffix - `" (0 - 5)"`
 *  for a weapon, `" (+7)"` for armour, and nothing at all for a book.
 *  Three surfaces show it (the grid tile, the tile's no-icon fallback,
 *  the worn map's slot) and they share this rather than each spelling
 *  the `??` themselves: three copies of a rule is three chances to
 *  disagree, which is the shape half of this month's findings had.
 *
 *  MAC-M2 put the HANDS beside it on the same three hovers. Mac said
 *  "the Tooltip of weapons should ALSO show" it, and the surface MAC-M1
 *  read that word onto is this one - the row is on the card either way,
 *  but a player scanning a list of blades is hovering, not clicking.
 *  Joined with the card's own ' · ', and the word is itemInfo's
 *  verbatim, so the two surfaces cannot say it differently. */
export const itemStatSuffix = (line) => {
  const stat = [line?.damage ?? line?.armour, line?.hands].filter(Boolean).join(' · ');
  return stat ? ` (${stat})` : '';
};

function itemRow(item, from = 'local') {
  const line = itemLine(item, deps.entity);
  const row = el('button', `itemrow${picked === item && side === from ? ' on' : ''}`);
  { const r = rarityAttr(item); if (r) row.dataset.rarity = r; }   // LR1: the tier colours the name (enhancedStyle's [data-rarity] rules)
  const wasPicked = picked === item && side === from;
  row.append(itemTile(line));
  const mid = el('span', 'itemname');
  mid.append(el('span', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
  const sub = [line.material, line.word, line.lit ? 'lit' : null].filter(Boolean).join(' · ');   // HT2: the classic list paints the lit row gold; this one says the word
  if (sub) mid.append(el('small', null, sub));
  row.append(mid);
  row.append(el('span', 'itemwt', `${line.weight.toFixed(2)} kg`));
  // QS2: THE CHIP. A slot holds a KIND, so the row that answers to it is the
  // row that says so - otherwise the only way to learn what is in slot 1 is to
  // open every tooltip in the pack. LOCAL rows only: a slot resolves against
  // the pack, and a loot row is not in it.
  if (from === 'local') {
    const slot = quickslotOf(item);
    if (slot) row.append(el('span', 'qs-mark', slot === 'swap' ? 'SWAP' : (slot === 'c1' ? '1' : '2')));
  }
  // INV1: a LOCAL row drags. A loot row does not - taking from a pile
  // is a click, and a drag that could also transfer would make a slip
  // a theft.
  if (from === 'local') dragFrom(row, item);
  row.onclick = () => {
    // AUDIT INV1 Fb: a release that DRAGGED is not a pick. The click
    // fires after pointerup, so without this a reorder would also
    // select the row it left.
    if (takeDragClick()) return;   // AUDIT INV2 A-F6: a release that DRAGGED is not a pick
    // AUDIT 26: "Send click to quest system" (:2027-2037) - the FIRST
    // act of RemoteItemListScroller_OnItemClick, ahead of the
    // action-mode branch, so LOOKING at a quest item in a pile counts
    // as well as taking it. The ClickedItem trigger polls
    // hasPlayerClicked. Only the REMOTE list does this;
    // LocalItemListScroller_OnItemClick (:1974-2007) has no such call,
    // which is why this sits behind `from === 'remote'` rather than in
    // the pick itself.
    if (from === 'remote' && item.questItem) {
      deps.getQuest?.(item.questUID)?.getItem?.(item.questSymbol)?.setPlayerClicked();
    }
    // IG7 (Mac: "opening a container or body and clicking to loot an
    // item - the item isn't picked up properly and the tooltip
    // remains"): a LOOT-SIDE click TAKES, immediately. DFU's remote
    // list transfers on the click itself
    // (DaggerfallInventoryWindow.RemoteItemListScroller_OnItemClick's
    // remove arm); this skin's pick-then-Take card made the first
    // click look like a broken take with a tooltip stuck open. The
    // REWARD tray alone keeps the two-step - a single click must not
    // claim a one-shot choice (G6: taking closes the window and
    // spends the claim).
    if (from === 'remote' && remote.kind !== 'reward') { take(item); return; }
    // PX19i: the tooltip's toggle - a second click on the picked item
    // puts it away (the quest-click above already fired either way,
    // exactly as DFU counts a look).
    picked = wasPicked ? null : item;
    pickedAt = from === 'remote' ? 'loot' : 'dock';
    side = from; notice = null; render();
  };
  return row;
}

// ── THE REMOTE SIDE ──────────────────────────────────────────────
// DFU's window is TWO lists, and every flow the enhanced pack could
// not answer - the wagon, a corpse, a guild's reward tray, dropping
// anything at all - was the second one missing. It is a peer of the
// pack list rather than a panel hung off it, because that is what it
// is: the ground is a container the player is standing in.
/** PX21e: how many rows fit ONE column of the loot window at its cap.
 *  Past this it widens to two rather than scrolling - a container is a
 *  glance, and a title that scrolls away is the part that reads broken. */
export const LOOT_ONE_COLUMN = 8;

function remoteCol() {
  const col = el('section', 'packcol packremote');
  const head = el('div', 'remotehead');
  const who = el('div', 'remotewho');
  who.append(el('h3', null, remote.title));
  who.append(el('p', 'meta', remote.capacity != null
    ? `${plural(remote.count, 'item')} · ${remote.weight.toFixed(2)} / ${remote.capacity} kg`
    : `${plural(remote.count, 'item')} · ${remote.weight.toFixed(2)} kg`));
  head.append(who);
  const acts = el('div', 'remoteacts');
  // THE WAGON BUTTON EXISTS ONLY WITH A CART IN THE BAG. DFU draws it
  // always and answers "You don't own a wagon." - and DFU has a fixed
  // parchment layout with a place for it. This one would be a control
  // whose whole purpose is to refuse, so it appears when there is
  // something to open. The DUNGEON refusal still speaks, because that
  // one is temporary: the door is somewhere the player can walk to.
  if (hasCart(deps.items?.() ?? [])) {
    const b = el('button', `act${session.usingWagon ? ' primary' : ''}`,
      session.usingWagon ? 'Leave wagon' : 'Wagon');
    b.onclick = toggleWagon;
    acts.append(b);
  }
  // MAC-M2 B (2026-09-16, Mac: "Remove the gold and pack buttons from
  // the looting menu"): THE LOOT WINDOW IS FOR TAKING, and its bar
  // carries the wagon and nothing else.
  //
  // Neither button is DFU's in this frame. DFU has ONE parchment, so its
  // goldButton (DaggerfallInventoryWindow.cs:47/:515-517) sits on the
  // player's own panel beside BOTH lists, and there is no "Pack" button
  // anywhere in the reference at all - PX20b minted that one to reopen
  // the pack its loot-only frame had replaced. Over a corpse the gold
  // field's own verb is "Drop", and `dropGold` adds the stack to
  // `remoteTarget` - so the control on a body offers to put the purse
  // INTO it, which is not what anyone opened it for.
  //
  // Both are still reachable, and in the one place they read as
  // themselves: the pack. Escape or the inventory key closes the pile
  // and opens it, with the gold field on its own remote side.
  //
  // THE GATE IS THE SESSION, not the frame. `deps.loot` is what opened
  // this window (`packOpen = !d.loot`), so a pack opened on F6 keeps its
  // Gold button over the ground, the wagon and a reward tray exactly as
  // it had it - this changes the LOOT session alone.
  if (!deps.loot) {
    // GOLD IS NOT AN ITEM ROW. It is one stack in the pack that the list
    // shows as a line, and DFU gives it its own button and its own
    // numeric popup because "drop 40 of 12000" is not a click.
    const g = el('button', 'act', 'Gold');
    g.onclick = () => { goldEntry = goldEntry == null ? '0' : null; notice = null; render(); };
    acts.append(g);
  }
  head.append(acts);
  col.append(head);
  if (goldEntry != null) col.append(goldField());
  // PX21e (Mac: "in the tooltip for looting, it makes you scroll which
  // should not be a thing at all"): THE LIST IS ITS OWN BOX. The rows
  // sat directly in the column beside the head and the WHOLE WINDOW
  // carried overflow-y - so a pile past the cap scrolled the title and
  // the buttons away with it, which is the part that reads as broken.
  // The head is fixed furniture now and the rows live in a list, which
  // is also what lets them FLOW INTO A SECOND COLUMN before anything
  // scrolls at all.
  const list = el('div', 'remotelist');
  if (!remote.items.length) {
    list.append(el('p', 'packempty', remote.kind === 'ground'
      ? 'Nothing dropped here yet.'
      : 'Empty.'));
  }
  for (const it of remote.items) list.append(itemRow(it, 'remote'));
  col.append(list);
  return col;
}

/** A numeric field of 8, opening on "0" (:1272). The REFUSAL is
 *  silent and outright rather than a clamp, which is why this shows
 *  what the player has: a field that rejects without saying why needs
 *  the ceiling written next to it. */
function goldField() {
  const form = el('form', 'goldfield');
  const carried = goldAmount(deps.entity ?? {});
  const input = el('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.maxLength = 8;
  input.value = goldEntry;
  input.setAttribute('aria-label', 'How much gold');
  input.oninput = () => { goldEntry = input.value; };
  form.append(input);
  const go = el('button', 'act primary', session.usingWagon ? 'Stow' : 'Drop');
  go.type = 'submit';
  form.onsubmit = (e) => { e.preventDefault(); dropGold(goldEntry); };
  form.append(go);
  form.append(el('p', 'meta', `${carried.toLocaleString()} gold in the purse`));
  return form;
}

/** PX16b: the reference's LEFT SPINE - categories stacked vertically,
 *  small caps, the chosen one bright with the gem at its edge. Same
 *  TABS, same counts, same handlers; only the axis changed. */
function catsCol() {
  const col = el('section', 'packcol packcats');
  const tabs = el('div', 'packtabs');
  // PX31: the nine pages, each with its count; an empty page stays in
  // its place, dimmed, so the spine never shuffles under the hand.
  for (const { tab: t, label, items: rows } of model.tabs) {
    const n = rows.length;
    const b = el('button', `packtab${t === tab ? ' on' : ''}${n ? '' : ' empty'}`, label);
    b.append(el('span', 'count', String(n)));
    b.onclick = () => { tab = t; picked = null; render(); };
    tabs.append(b);
  }
  col.append(tabs);
  return col;
}

function listCol() {
  const col = el('section', 'packcol');
  const rows = model.tabs.find((x) => x.tab === tab)?.items ?? [];
  if (!rows.length) {
    col.append(el('p', 'packempty', 'Nothing in this pack answers to that page.'));
  }
  for (const it of rows) col.append(itemRow(it));
  return col;
}

// `packdetail`, NOT `detail`. The settings pane's phone sheet already
// owns `.detail` in the same stylesheet - `position: fixed;
// transform: translateY(101%)` - so this column inherited it and sat
// 101% below the fold on every phone, with the Wear button in it. The
// desktop was perfect and the source read correctly; only a browser
// could see it. A generic class name in a shared stylesheet is a
// collision waiting for the second screen that wants the word.
//
// THE PHONE WANTS A SHEET ANYWAY, which is why the collision was so
// easy to miss: three columns do not fit one phone, and the settings
// pane answered the same problem the same way (AUDIT F8). So this is
// that behaviour written deliberately - the detail rises when an item
// is picked and closes back down - rather than borrowed by accident.
/**
 * QS2 - THE SLOT BUTTONS (2026-09-17, Mac: consumables are assigned "in the
 * enhanced menu through the tooltip to slot 1/2").
 *
 * The KIND decides which buttons exist, and the model decides what a kind is:
 * `isQuickConsumable` (a potion or a drug - the two arms of `useItem` that
 * consume and act on the entity) and `canSwapTo` (an unequipped weapon that is
 * not an arrow). A torch is neither - it is the off-hand cell's, through
 * entity.lightSource - and a book is neither, so neither grows a button. This
 * screen asks those two questions rather than answering them, for the same
 * reason the Use button is offered for everything: a judgement made twice is a
 * judgement that drifts.
 *
 * THE BUTTON THAT HOLDS THE ITEM SAYS "UNSLOT" AND CARRIES `on`. A button that
 * looked the same whether the thing was in the slot or not would make the
 * player press it to find out, and pressing it is exactly what un-slots it.
 * `assignQuickslot` moves a kind BETWEEN the two consumable slots itself, so
 * pressing the other one is a move and not a second copy.
 *
 * AND THE TOOLTIP STAYS UP. PX24's law is that a USE closes it - the item is
 * gone or changed and the card is stale - but slotting changes nothing about
 * the item, and the player's next act is usually to read the other button. So
 * this re-renders in place: the labels flip, the row chips appear, the card
 * keeps its place.
 */
function quickslotActs(item) {
  const inSlot = quickslotOf(item);
  const button = (slot, set, unset) => {
    const on = inSlot === slot;
    const b = el('button', `act qs-act${on ? ' on' : ''}`, on ? unset : set);
    b.onclick = () => {
      if (on) clearQuickslot(slot); else assignQuickslot(slot, item);
      refresh();   // the pack list is where the chips are drawn
      render();   // ...and the card stays up, with its labels flipped
    };
    return b;
  };
  if (isQuickConsumable(item)) return [button('c1', 'Slot 1', 'Unslot 1'), button('c2', 'Slot 2', 'Unslot 2')];
  if (canSwapTo(item)) return [button('swap', 'Swap to', 'Unset swap')];
  return [];
}

function detailCol() {
  const col = el('section', `packcol packdetail${picked ? ' open' : ''}`);
  // PX16c: the plaque wears the pause window's own corners - one
  // frame language across every enhanced surface.
  for (const c of ['tl', 'tr', 'bl', 'br']) col.append(el('span', `px-gem px-corner px-${c}`));
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { picked = null; render(); };
  col.append(close);
  if (!picked) {
    col.append(el('p', 'packempty', 'Pick something to read it.'));
    return col;
  }
  const line = itemLine(picked, deps.entity);
  const c = el('div', 'card');
  // The detail draws it BIGGER - this is the one place there is room
  // to see what the thing actually looks like.
  const big = modelIconUrl(line.item, 192)
    || (line.image
      ? requestIcon(line.image.archive, line.image.record, { scale: 4, onReady: render })
      : null);
  if (big) {
    const fig = el('div', 'bigicon');
    const img = el('img');
    img.src = big;
    img.alt = '';
    fig.append(img);
    c.append(fig);
  }
  c.append(el('h3', null, line.name));
  { const r = rarityAttr(picked); if (r) c.dataset.rarity = r; }   // LR1: the card's heading wears the tier too
  const meta = [line.material, line.stack ? `${line.stack} of them` : null].filter(Boolean).join(' · ');
  if (meta) c.append(el('p', 'meta', meta));
  // LR1: the tier, then each affix as a line, then the enchantment - or
  // "Unidentified" until the Identify spell or the guild reads it.
  { const lines = rarityLines(picked); if (lines.length) { const ul = el('ul', 'rarity'); for (const l of lines) ul.append(el('li', null, l)); c.append(ul); } }
  const dl = el('dl', 'stats');
  const pair = (k, v) => { if (v != null) dl.append(el('dt', null, k), el('dd', null, String(v))); };
  // MAC-M1: the headline stat FIRST - a player reading this card is
  // deciding whether to swing the thing, and weight is not that
  // question. Only one of the two ever draws: an item is a weapon or it
  // is armour, and `pair` skips a null.
  pair('Damage', line.damage);
  pair('Armour', line.armour);
  // MAC-M2: under the damage, because it is the same question - how the
  // thing is swung - and above the weight, which is not. Null for
  // everything that is not a weapon, so no book grows an empty row.
  pair('Hands', line.hands);
  for (const t of line.survival ?? []) {   // AUDIT SURV C: the classic popup's tokens, each under a word of its own
    const i = t.indexOf(': ');
    if (i > 0) pair(t.slice(0, i), t.slice(i + 2));
    else pair(/^Nourishes/.test(t) ? 'Food' : /^Raw/.test(t) ? 'Raw' : /uses left/.test(t) ? 'Uses' : /skillet/i.test(t) ? 'Cooking' : 'Note', t);
  }
  pair('Weight', `${line.weight.toFixed(2)} kg`);
  pair('Condition', line.condition != null ? `${line.word} · ${line.condition}%` : null);
  // HT2: a light source is never WORN - the honest line for one is
  // whether it is the lit one, which is the same fact the classic
  // list's gold row carries.
  if (side === 'local') {
    if (isLightSource(picked)) pair('Lit', line.lit ? 'yes' : 'no');
    else pair('Worn', line.equipped ? 'yes' : 'no');
  }
  else pair('Where', remote.title);
  c.append(dl);
  const acts = el('div', 'acts');
  if (side === 'local') {
    // REACHABLE, unlike a badge on a row: the selection survives the
    // press, so the item you just wore is still here and can come
    // straight back off. Every OTHER way to take something off is the
    // slot map.
    // HT2: the act is `localPrimaryAct`'s, label and all - a torch is
    // LIT here, not worn, because DFU's equip click on a light source
    // is a use (:1976-1985) and nothing in the equip table will ever
    // take one. The button says which it is doing.
    const act = localPrimaryAct(picked, deps.entity);
    if (act) {   // null: nothing would wear it (Mac: no WEAR on a waterskin)
      const b = el('button', 'act primary', act.label);
      b.onclick = act.kind === 'takeOff' ? () => takeOff(picked.equipSlot)
        : act.kind === 'wear' ? () => wear(picked)
        // AUDIT 22 F6: DFU's equip click hands UseItem NO collection
        // (:1980), so the act that lights a torch can consume nothing.
        : () => use(picked, null);
      acts.append(b);
    }
    // The verb names the DESTINATION, and the destination is whichever
    // list is showing. Drawn only when the law would either move
    // something or say something (`canStow`).
    // WORN ITEMS HAVE NO STOW. filterByTab IS FilterLocalItems, so an
    // equipped item is never in the list a Remove click can reach -
    // the classic window cannot transfer one and neither can this. The
    // way out is Take off, which is the button beside it.
    if (!line.equipped && canStow(picked)) {
      const t = el('button', 'act', STOW_LABEL[remote.kind]);
      t.onclick = () => stow(picked);
      acts.append(t);
    }
  } else {
    // G6: taking ONE from a reward tray IS the claim, and the window
    // goes with it. The label says so rather than letting a player
    // discover it by pressing.
    const b = el('button', 'act primary',
      remote.kind === 'reward' ? 'Take this one' : 'Take');
    b.onclick = () => take(picked);
    acts.append(b);
  }
  // USE is offered for EVERYTHING, exactly as the classic window's Use
  // mode is: `useItem` has an arm for every group and the honest answer
  // for a thing with no use is its own "Nothing happens." A button that
  // appeared only for items this screen believed were usable would be
  // this screen making a judgement the law already makes. DFU offers
  // it on the REMOTE list too (:2048-2051), so this pane does.
  // Mac (2026-09-18): ...WAS. "Same for use for non-usables" - the law's own predicate (useItem.js usableItem)
  // says which items an arm would do something with; a sword or a gem gets no Use button.
  const u = el('button', 'act', 'Use');
  // THE COLLECTION IS THE LIVE LIST, not the model's. `useItem`
  // CONSUMES out of what it is handed (:2048-2051 - a potion drunk
  // from a corpse must leave the corpse), and `remoteModel.items` is a
  // filtered COPY, so passing that would drink the potion and leave it
  // sitting in the pile. The bag travels separately for AUDIT 22 F4's
  // reason, inside `use`.
  if (usableItem(picked)) {
    u.onclick = () => use(picked,
      side === 'remote' ? remoteTarget(deps, sessionState()) : (deps.items?.() ?? []));
    acts.append(u);
  }
  // QS2: ...and the quickslot buttons, LOCAL ONLY. A slot resolves against the
  // PACK every frame (quickslots resolveConsumable), so slotting something
  // that is still in a corpse would name a kind the player does not carry - a
  // ghost from the moment it was made. The remote side gets none; take it
  // first, then slot it.
  if (side === 'local') for (const b of quickslotActs(picked)) acts.append(b);
  c.append(acts);
  col.append(c);
  // The address, for the player who wants it and the developer who
  // needs it - the same place the classic window's own info panel
  // would never put it. Shown only when the picture is NOT here, so it
  // reads as an explanation rather than as clutter.
  if (line.image && !big) {
    col.append(el('p', 'iconnote',
      `No picture for this one yet — TEXTURE.${line.image.archive} record ${line.image.record}.`));
  }
  return col;
}

function render() {
  // JAN2: UNMOUNTED - nothing to paint into. `unmount` nulls `host`,
  // and the repaints that can land after it are not all async: the
  // book reader's failure report renders after `onExit` by design
  // (the `open(act.item, ...)` arm), and the two async ones
  // (refreshFigure, the fpArm subscription) already guarded. A repaint
  // after the pane is gone is a no-op, not a crash.
  if (!host) return;
  repaints++;
  // ENH-NOTICE3 - THE `notice` LINE IS DFU'S CLICK-ANYWHERE BOX, not a
  // status line, and on the enhanced skin it is the panel's. Every
  // writer of `notice` above is one of DaggerfallInventoryWindow.cs's
  // own `DaggerfallMessageBox ... ClickAnywhereToClose = true` /
  // `DaggerfallUI.MessageBox` sites - which is exactly how the CLASSIC
  // twin renders them (ui/nativeInventory.js pushes each onto its
  // `boxes` queue, the click-anywhere queue):
  //
  //   wear()   broken     -> :1330-1341 (itemBrokenTextId 29, ClickAnywhereToClose)
  //            forbidden  -> :1370-1381 (forbiddenEquipmentTextId 1068, ditto)
  //   use()    the use ladder's text/textId -> :1600-1618 (the info box
  //            and its AddNextMessageBox chain), :1721 bookUnavailable,
  //            :1736 cannotUseThis, :1754 the no-spells box,
  //            :1777-1800 the five lantern lines, :1836-1844 the map's
  //            own box and readMapFail
  //   refuse() the transfer ladder's refusals -> :1420 cannotCarryAnymore,
  //            :1431 cannotHoldAnymore, :1467/:1491 cannotRemoveItem
  //   toggleWagon()        -> :1237 noWagon, :1239 exitTooFar
  //   dropGold()           -> :1303 wagonFullGold
  //
  // The one line with no DFU box behind it is wear()'s "cannot be
  // worn" (DFU's EquipItem simply returns when ItemEquipTable finds no
  // slot, :1383-1392) - the PORT'S own refusal, added because this
  // window offers Wear on rows DFU's window never would. It is the
  // same KIND of thing - a refusal with no control under it - so it
  // rides the same panel rather than being the one line left behind on
  // a sheet nothing else writes to.
  //
  // What is NOT here, and stays where it is: the gold FIELD
  // (DaggerfallInputMessageBox, :1274-1285) and the split-stack field
  // (:1528-1545) are inputs, and the item's own info plaque is the
  // window's, not a box.
  //
  // Decided ONCE per render, before the tree is built, because the
  // sheet paints the line in two places (the pack's footer and the
  // loot frame) and a second call would mint a second panel.
  // (The `!onPanel` arms below are this module's classic-skin fork
  // and unreachable in the shipping game - ui/inventoryDoor.js mounts
  // this pane only under the enhanced skin with a document; kept so
  // the fork is one place, unit-testable on both skins. AUDIT
  // ENH-NOTICE3 B19.)
  // No hint (AUDIT ENH-NOTICE3 B3): this pane takes no click and no
  // key for a refusal - it clears when the next action rewrites it
  // (a wear, a take-off, a transfer, a tab) - so the panel promises no
  // dismissal the pane does not keep. (The classic twin queues each of
  // these as a real click-anywhere box; the enhanced pane never did.)
  const onPanel = noticeHold(noticeOwner, notice ? [{ text: notice, center: true }] : null, { hint: false });
  repaintKeepingScroll(host, () => {
    // PX22: the list's scroll position survives a repaint, per tab - an
    // equip, a drop or a tab's own re-render rebuilds the DOM, and a
    // list that jumped to the top on every action was the second half
    // of the scrunch complaint.
    // Keyed by the tab that was RENDERED, not the one about to be: a tab
    // click changes `tab` before it repaints, and the first draft filed
    // the old list's scroll under the new tab's name (197 -> 0 on a
    // round trip, measured).
    const prevList = host.querySelector('.packlists');
    if (prevList && _renderedTab) _scrollMemo.set(_renderedTab, prevList.scrollTop);
    host.innerHTML = '';
    // PX16b (Mac: "really study the reference"): the reference's
    // ground is THE GAME - two translucent columns on the left third,
    // the world showing through the right. So no sky here: the paused
    // frame is the ground (the pause door's law, one window over) and
    // every column carries its own scrim.
    // PX19k (Mac: "why does the UI refresh every time you click"):
    // every click re-renders the window - that is the one-way render
    // law and it is fine - but the ENTRANCE was keyed inside render,
    // so the 220ms fade + rise + depth-of-field REPLAYED on every
    // pick: the player watched the window re-arrive per click. The
    // entrance belongs to the FIRST paint only; every later render is
    // born already-arrived (created WITH .on, no transition runs on a
    // freshly inserted element's initial style).
    const arriving = repaints === 1;
    const shell = el('div', `pack-shell${arriving ? '' : ' on'}`);
    // PX19 (Mac: centered, window-based; creative authority): THE
    // PACK IS A WINDOW NOW - the pause window's own frame (corner
    // gems, 2px border, the 0.72 glass) centered over the game, and
    // it ARRIVES like the dial: a stepped fade while the world drops
    // into the same depth-of-field. One entrance gesture for every
    // floating surface. The window carries its own footer; the right
    // column is the showcase compressed - figure above, plaque
    // beneath.
    if (arriving) requestAnimationFrame(() => requestAnimationFrame(() => shell.classList.add('on')));
    const win = el('div', 'pack-win');
    if (packOpen) {
    for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
    const head = el('header', 'pack-id');
    const who = el('div');
    // PX20c: PACK, and whose. The name rides the title bar rather than
    // standing on the composition it describes.
    const title = el('h2', null, 'Pack');
    const name = deps.entity?.name;
    if (name) title.append(el('span', 'pack-who', name));
    who.append(title);
    head.append(who);
    const close = el('button', 'act', 'Close');
    close.onclick = () => onExit();
    head.append(close);
    win.append(head);
    const grid = el('div', 'pack');
    // The two lists are a PAIR - DFU's window is local beside remote -
    // so they share one grid cell and split it, which keeps the outer
    // column shape (and every phone rule written against it) exactly
    // as it was.
    // A CONTAINER or a REWARD TRAY is what the player opened the
    // window FOR, so on a stacked layout that list goes first. The
    // ground and the wagon are the other way round - there the pack is
    // what you came to empty.
    // PX19c (Mac: containers/bodies/ground as their OWN smaller
    // window): the pack's middle column is the LOCAL list alone now -
    // the room the split buys - and the remote rides a second,
    // smaller window in the same frame language beside the pack,
    // present only when it has a reason to be: always for a
    // container, a corpse's tray, or the wagon (the thing you opened
    // the window FOR), and for the ground only once something lies on
    // it. The PAIR LAW survives the furniture: same remoteModel, same
    // remoteCol, same take/stow arms - only the wall between them
    // moved.
    // PX19f (Mac: "you are ignoring the entire UI panel"): THE WHOLE
    // ANATOMY, not one organ. The reference's skeleton adopted:
    // CHARACTER REGION LEFT (the worn families with the doll - the
    // big area), DETAILS RIGHT (the plaque column, where the concept
    // hangs its Details), and the INVENTORY AS A BOTTOM DOCK - a tile
    // GRID with its category tabs as a horizontal strip directly
    // above it, exactly where Equipment/Consumables sit in the
    // concept. The pair law is untouched: the loot rides its own
    // window (PX19c).
    // PX19i (Mac: no right panel - a tooltip that pops up and off on
    // click): the details column is GONE and the character region
    // takes the width it frees; the plaque rides as a TOOLTIP
    // anchored beside whatever was clicked (positioned after the DOM
    // lands, clamped to the window), dismissed by a click away or a
    // second click on the same thing. The PHONE keeps its bottom
    // SHEET - same component, the .packdetail phone rules' physics.
    // PX20b: with a loot target and the pack still closed, the pack's
    // whole frame is never BUILT - not built and hidden. A hidden
    // window that still runs its layout is a window whose bugs you
    // cannot see (and the tooltip would anchor into it).
    const main = el('div', 'pack-main');
    main.append(characterCol());
    const dock = el('div', 'pack-dock');
    const lists = el('div', 'packlists');
    lists.append(listCol());
    dock.append(catsCol(), lists);
    grid.append(main, dock);
    win.append(grid);
    // PX16b: the reference's BOTTOM BAR - carry weight as a meter
    // (blood past four-fifths, the reference's red), gold beside it.
    const bar = el('footer', 'packbar');
    const carry = el('div', 'packcarry');
    const heavy = model.encumbrance.max > 0 && model.encumbrance.now / model.encumbrance.max >= 0.8;
    carry.append(el('span', 'k', 'Carry Weight'),
      el('span', 'v', `${model.encumbrance.now} / ${model.encumbrance.max}`));
    const meter = el('div', 'px-meter');
    const fill = el('div', `px-fill${heavy ? ' blood' : ''}`);
    fill.style.width = `${model.encumbrance.max > 0 ? Math.min(100, (model.encumbrance.now / model.encumbrance.max) * 100) : 0}%`;
    meter.append(fill);
    carry.append(meter);
    const gold = el('div', 'packgold');
    gold.append(el('span', 'k', 'Gold'), el('span', 'v', model.gold.toLocaleString()));
    bar.append(el('span', 'packitems', plural(model.count, 'item')), carry, gold);
    win.append(bar);
    if (notice && !onPanel) win.append(el('p', 'sheet-notice', notice));
    }

    // The LOOT frame is built next, because with the pack closed it is
    // the frame the tooltip anchors into and the click-away listens on.
    // PX21e: a long pile WIDENS rather than scrolls - two columns of
    // rows hold twice as much in the same height.
    const loot = (remote.kind !== 'ground' || remote.count > 0)
      ? el('aside', `loot-win${remote.count > LOOT_ONE_COLUMN ? ' wide' : ''}`) : null;
    if (loot) {
      for (const c of ['tl', 'tr', 'bl', 'br']) loot.append(el('span', `px-gem px-corner px-${c}`));
      loot.append(remoteCol());
      if (!packOpen && notice && !onPanel) loot.append(el('p', 'sheet-notice', notice));
    }
    // PX20b: one FRAME owns the tooltip and the click-away - the pack
    // when it is open, the loot window when it is alone. Without this
    // the tip anchored into a window nobody could see.
    const frame = packOpen ? win : (loot ?? win);
    if (picked) {
      const tip = detailCol();
      tip.classList.add('packtip');
      frame.append(tip);
      // After layout: anchored beside the picked element, flipped
      // left when the right edge refuses, clamped to the frame.
      requestAnimationFrame(() => {
        const at = { worn: '.wornmap .wornrow.on', dock: '.pack-dock .itemrow.on', loot: '.loot-win .itemrow.on' }[pickedAt];
        const on = (at && (frame.querySelector(at) ?? shell.querySelector(at)))
          ?? frame.querySelector('.wornrow.on, .itemrow.on');
        if (!on || !tip.isConnected) return;
        const w = frame.getBoundingClientRect();
        const r = on.getBoundingClientRect();
        const tw = tip.offsetWidth; const th = tip.offsetHeight;
        let left = r.right - w.left + 12;
        if (left + tw > w.width - 10) left = r.left - w.left - tw - 12;
        if (left < 10) left = 10;
        let top = r.top - w.top + r.height / 2 - th / 2;
        top = Math.max(10, Math.min(top, w.height - th - 10));
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
      });
    }
    // A click that lands on nothing interactive puts the tooltip away.
    frame.addEventListener('click', (e) => {
      if (!picked) return;
      if (e.target.closest('.packtip') || e.target.closest('button')) return;
      picked = null; render();
    });
    if (packOpen) shell.append(win);
    if (loot) shell.append(loot);
    host.append(shell);
    // OT1 (Mac: "tapping outside of any UI closes the UI"): a tap on the
    // ground beside the pack and the loot column closes the pack - the
    // same exit the Close button takes, so the close law (the drop, the
    // equip cue) runs as it always does.
    closeOnOutsideTap(shell, '.pack-win, .loot-win', () => onExit());
    const list = host.querySelector('.packlists');
    if (list && _scrollMemo.has(tab)) list.scrollTop = _scrollMemo.get(tab);
    _renderedTab = tab;
  });
}

// ── THE KEYBOARD ─────────────────────────────────────────────────
// ESCAPE AND THE INVENTORY KEY, the two the classic window closes on.
//
// MAC-C (2026-09-17, Mac: "you can exit out of the F6 menu (inventory)
// by pressing F6 again, but you cannot do the same for the F5 one
// (char sheet)" + "it would be extra cool if you could like, be on the
// F5 page, press F6 and then go straight from char sheet to inv.").
//
// This line used to read `e.key !== 'F6'` - the DFU DEFAULT spelled as
// a literal, which is I2's and FIX-F's bug twice over: a player who
// rebinds Inventory in the controls window gets a pack that opens on
// their key and closes on nobody's. It reads the REGISTRY now, the same
// `actionOf` the hosts' own ladders read.
//
// And the other window key CROSSES OVER rather than doing nothing: the
// pack closes and the sheet opens, in that order, because `showOverlay`
// REPLACES the host's one slot (the same note `openSpellbook` carries
// four lines of hooks above). A host that hands no sheet door gets a
// key that falls through, which is the honest refusal every other
// optional hook here gives.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  // AUDIT INV2 A-F7: A DRAG HAS AN ABORT, and it is the key every other
  // gesture aborts with. There was none: the only release that changed
  // nothing was one inside the windows, so a player who had picked up
  // the wrong thing had nowhere safe to let go, and Escape - the obvious
  // try - CLOSED THE PACK mid-drag and left the ghost stuck over the
  // world (A-F4). Escape ends the drag and keeps the window; a second
  // one closes it, as it always did.
  if (overlayAction(e) === 'back' && drag) { e.preventDefault(); e.stopPropagation(); dragStop(false); return; }
  const act = actionOf(e);
  if (act === 'CharacterSheet' && typeof deps?.openCharSheet === 'function') {
    e.preventDefault();
    e.stopPropagation();
    // JAN1 (2026-09-18, Janome: "got this while toggling between F5 and F6 menus" - CRASH `openCharSheet is not a
    // function`): THE HOOK IS READ BEFORE ANYTHING CLOSES - the file's own law at the close arm above - because
    // `onExit` unmounts, and the unmount clears `deps` to `{}` before this line ran on it.
    const openCharSheet = deps.openCharSheet;
    onExit();                 // the pack's own close law runs FIRST...
    openCharSheet();          // ...and this replaces the slot it just freed
    return;
  }
  if (overlayAction(e) !== 'back' && act !== 'Inventory') return;
  e.preventDefault();
  e.stopPropagation();
  onExit();
}

function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

export function mountEnhancedInventory(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  // JAN2 (2026-09-21, a player's CRASH "can't access property
  // querySelector, l is null"): this module is ONE pane - `host`,
  // `deps` and the view state are singletons - and the door mounts a
  // fresh element on every push. A second mount over a live one left
  // the first pane ORPHANED on screen, still clickable, and the newer
  // view's unmount then nulled `host` under it: every button on the
  // old pane threw. A second mount tears the first down - its
  // listeners, its DOM, its element - so there is never an orphan.
  if (host && host !== hostEl) {
    const prev = host;
    _view?.unmount();
    prev.remove?.();
  }
  host = hostEl;
  deps = d;
  // MW-D36: repaint when the body's build settles, so an equip change
  // that rebuilt the model asynchronously shows on the panel.
  if (d.fpArm && typeof d.fpArm.subscribe === 'function') {
    _unsubscribeFigure?.();
    _unsubscribeFigure = d.fpArm.subscribe(() => { _figureCache = { key: null, img: null }; if (host) render(); });
  }
  onExit = d.onExit ?? (() => {});
  tab = PAGE_IDS[0];
  picked = null;
  // PX20b: a LOOT target opens its own frame alone; every other way in
  // (F6, the world's inventory door) opens the pack as it always did.
  packOpen = !d.loot;
  side = d.loot ? 'remote' : 'local';
  // MAC-M2: the "that release was a drag" latch belongs to a GESTURE,
  // so it must not outlive the pane that held it - a session that ended
  // on a release no click ever followed (one off the panel lands on the
  // body, not on a row) would otherwise hand the next pane a latch that
  // eats its first pick.
  _dragged = false;
  notice = null;
  goldEntry = null;
  repaints = 0;
  // U57: the three things opening the window already decided -
  // selectedActionMode, CheckWagonAccess and SetChooseOne - read once,
  // from the module the classic window reads them from. The pack has
  // no action MODE (every row carries its own verbs), so `mode` is the
  // one answer this screen does not use.
  const open = openState(d);
  session = {
    usingWagon: open.usingWagon,
    allowDungeonWagonAccess: open.allowDungeonWagonAccess,
    chooseOne: open.chooseOne,
  };
  dropped = [];
  wagonLocal = [];
  refresh();
  render();
  // The classic window composes on construction; so does this. Without
  // it the panel shows the schematic until the first equip.
  refreshFigure();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  globalThis.__pack = () => JSON.stringify({
    tab, repaints, count: model.count, worn: model.worn.size,
    side, remoteKind: remote.kind, remoteCount: remote.count,
    figure: hostEl.querySelector('.figure-doll img') ? 'doll' : 'schematic',
    wornRows: [...hostEl.querySelectorAll('.wornrow')].length,
    wornFilled: [...hostEl.querySelectorAll('.wornrow:not(.wornempty)')].length,
    wornNames: [...hostEl.querySelectorAll('.wornrow:not(.wornempty) .wornname')].map((n) => n.textContent),
    remoteRows: [...hostEl.querySelectorAll('.packremote .itemrow')].length,
    dropped: dropped.length, gold: model.gold, goldOpen: goldEntry != null,
    usingWagon: session.usingWagon,
    acts: [...hostEl.querySelectorAll('.acts .act')].map((b) => b.textContent),
    rows: [...hostEl.querySelectorAll('.itemrow')].length,
    nodes: [...hostEl.querySelectorAll('.node')].length,
    filled: [...hostEl.querySelectorAll('.node.filled')].length,
    picked: picked?.name ?? null, notice,
  });
  _view = {
    repaint() { refresh(); render(); },
    /** The session's dropped items, for the door's close law. AUDIT
     *  B-C1: they MINT A WORLD PILE when this window goes, and the
     *  window going is the door's event, not this module's. */
    dropped: () => dropped,
    unmount() {
      // EVERY LISTENER HAS AN OWNER, and this one claims F6 - an orphan
      // eats the key that opens the pack, for the rest of the session.
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
      keyHandler = null;
      lockHandler = null;
      // MW-D36: the figure's subscription has an owner too.
      _unsubscribeFigure?.(); _unsubscribeFigure = null;
      // AUDIT INV2 A-F4: and so does a drag in flight. The ghost is the
      // BODY's child, so emptying the host below cannot reach it - the
      // pack closed mid-drag and left an item icon glued over the world,
      // which re-opening the pack did not clear either.
      dragAbort();
      // ENH-NOTICE3 / EVERY ALLOCATION HAS AN OWNER: a HELD panel arms
      // no watchdog, so nothing but this releases it. The pane is
      // unmounted from paths that never touch `notice` (F6 again, the
      // door's close law, a scene change), and a refusal left on
      // screen would then outlive the pack that said it.
      noticeRelease(noticeOwner);
      hostEl.innerHTML = '';
      host = null;
      deps = {};
      onExit = () => {};
      picked = null;
      remote = null;
      _view = null;
      delete globalThis.__pack;
    },
  };
  return _view;
}
