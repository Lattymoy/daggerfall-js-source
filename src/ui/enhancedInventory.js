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
// Taking something off is `unequipSlot`. The four tab pages are
// nativeInventory.js's own `TABS` and `filterByTab`. Weight,
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

import { TABS, filterByTab, USE_PENDING } from './nativeInventory.js';
import { useItem } from '../systems/useItem.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { inventoryItemImage, templateByIndex } from '../systems/itemTemplates.js';
import { requestIcon, paperDollDataUrl } from './textureCanvas.js';
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
import { itemWeight, isEnchanted, totalWeight, addItem, goldStack } from '../systems/inventory.js';
import { goldAmount, deductGold } from '../systems/court.js';
// U56/U57: DFU's transfer ladder and DFU's remote side, both extracted
// from the classic window so this pane runs them rather than a second
// reading of them.
import {
  planStore, planTake, applyTransfer, planDropGold, WAGON_KG_LIMIT,
} from '../systems/itemTransfer.js';
import {
  openState, remoteTarget, planWagonToggle, hasCart,
} from '../systems/inventorySession.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';   // AUDIT 26: PlayerEntity.MaxEncumbrance, enchantment allowance and all
import { liveStat } from '../systems/statMods.js';
import { conditionWord, conditionPercentage, materialName } from '../systems/itemInfo.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { overlayAction } from './input.js';

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
  const carried = items.reduce((kg, it) => kg + itemWeight(it), 0);
  return {
    tabs: TABS.map((tab) => ({ tab, items: filterByTab(items, tab) })),
    worn,
    gold: items.find((it) => it.group === 'Currency')?.stackCount ?? 0,
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
  return {
    rows: rows.filter((r) => r.item || !r.hidden),
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
  return {
    name: item.name ?? t?.name ?? 'Unknown',
    weight: itemWeight(item),
    condition: (item.maxCondition ?? 0) > 0 ? conditionPercentage(item) : null,
    word: (item.maxCondition ?? 0) > 0 ? conditionWord(item) : null,
    material: item.group === 'Armor' || item.group === 'Weapons' ? materialName(item) : null,
    stack: (item.stackCount ?? 1) > 1 ? item.stackCount : null,
    equipped: isEquipped(item),
    broken: isBrokenItem(item),
    // The address only. Fetching is the view's business, because a
    // model has no repaint to schedule.
    image: img,
  };
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
export function useResultAction(r, { openBook = null, openSpellbook = null } = {}) {
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
  // The classic window's own ladder, in its own order: an explicit
  // text, then a TEXT.RSC id, then the pending stand-in. AUDIT 22 F9:
  // `enchanted` is a RIDER on the arm's result, not a kind that
  // replaced it, so it only speaks when the arm itself said nothing.
  const out = { kind: 'message', text: null, textId: null,
    repaint: r.kind === 'variant', closesWindow: !!r.closesWindow };
  if (r.text) out.text = r.text;
  else if (r.textId) out.textId = r.textId;
  else if (r.pending) out.text = USE_PENDING[r.kind] ?? 'Nothing happens.';
  if (r.enchanted && !r.text && !r.textId) out.text = USE_PENDING.enchanted;
  return out;
}

// ── THE VIEW ─────────────────────────────────────────────────────

let host = null;
let deps = {};
let model = null;
let worn = { rows: [], filled: 0, total: 0 };   // U59: the slots, as rows
let tab = TABS[0];
let picked = null;      // the selected item object
let side = 'local';     // which list `picked` came out of
let notice = null;
// U57: the window's own session - which list is remote, and the
// session's drop pile. `dropped` is DFU's droppedItems and it MINTS ON
// CLOSE (AUDIT B-C1), which is why the door reads it back out.
let session = { usingWagon: false, allowDungeonWagonAccess: false, chooseOne: null };
let dropped = [];
let wagonLocal = [];
let remote = null;
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
function wear(item) {
  notice = null;
  if (isBrokenItem(item)) { notice = `${item.name} is broken and cannot be worn.`; return render(); }
  if (isForbiddenEquip(deps.entity?.career, item)) {
    notice = `A ${deps.entity?.career?.name ?? 'character'} may not use ${item.name}.`;
    return render();
  }
  if (equipItem(deps.entity, item) === null) { notice = `${item.name} cannot be worn.`; return render(); }
  refresh();
  refreshFigure();   // U59: the avatar is wearing it now
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
  const act = useResultAction(r, { openBook: deps.openBook, openSpellbook: deps.openSpellbook });
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
  if (act.textId && deps.rows) {
    const rows = deps.rows(act.textId) ?? [];
    notice = rows.map((row) => (typeof row === 'string' ? row : row?.text ?? '')).join(' ').trim() || null;
  } else if (act.text) {
    notice = act.text;
  }
  refresh();
  if (act.closesWindow) { onExit(); return; }
  render();
}

function takeOff(slot) {
  notice = null;
  unequipSlot(deps.entity, slot);
  refresh();
  refreshFigure();
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
  // The item that ARRIVES stays picked - a split leaves the remainder
  // behind and mints a new record, and following the one that moved is
  // what lets the player put it straight back.
  picked = applyTransfer(item, plan, deps.items?.() ?? [], to);
  side = 'remote';
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
  const taken = applyTransfer(item, plan, from, bag);
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
  picked = taken;
  side = 'local';
  // The pack's TAB follows what just arrived, or the player takes a
  // sword on the Ingredients page and watches nothing happen.
  tab = TABS.find((t) => filterByTab([taken], t).length) ?? tab;
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
  const player = deps.entity ?? { items: deps.items?.() ?? [] };
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
 *  HEAD sits above it, CHEST below it - on the body - and the
 *  families flank it symmetrically, five rows a side, the whole
 *  region SIZED TO FIT its space: no scrolling character sheet.
 *      Cloaks   HEAD    Neck
 *      Arms    [DOLL]   Rings
 *      Hands   [DOLL]   Tokens
 *      R-Wpn   [DOLL]   L-Wpn
 *      Legs    CHEST    Feet         */
const WORN_FAMILIES = Object.freeze([
  { id: 'cloaks', label: 'Cloaks', area: '1 / 1', slots: ['Cloak'] },
  { id: 'head', label: 'Head', area: '1 / 2', slots: ['Head'] },
  { id: 'neck', label: 'Neck', area: '1 / 3', slots: ['Amulet'] },
  { id: 'arms', label: 'Arms', area: '2 / 1', slots: ['Right arm', 'Left arm', 'Bracer'] },
  { id: 'rings', label: 'Rings', area: '2 / 3', slots: ['Ring'] },
  { id: 'hands', label: 'Hands', area: '3 / 1', slots: ['Gloves', 'Bracelet'] },
  { id: 'tokens', label: 'Tokens', area: '3 / 3', slots: ['Mark', 'Crystal', 'Unnamed'] },
  { id: 'rhand', label: 'R\u00b7Weapon', area: '4 / 1', slots: ['Right hand'] },
  { id: 'lhand', label: 'L\u00b7Weapon', area: '4 / 3', slots: ['Left hand'] },
  { id: 'legs', label: 'Legs', area: '5 / 1', slots: ['Legs, armour', 'Legs, clothes'] },
  { id: 'chest', label: 'Chest', area: '5 / 2', slots: ['Chest, armour', 'Chest, clothes'] },
  { id: 'feet', label: 'Feet', area: '5 / 3', slots: ['Feet'] },
]);
const DOLL_AREA = '2 / 2 / span 3 / auto';
function equippedList() {
  const wrap = el('section', 'equipped');
  const head = el('div', 'equippedhead');
  head.append(el('h3', null, 'Worn'));
  head.append(el('p', 'meta', `${worn.filled} of ${worn.total} slots filled`));
  wrap.append(head);
  const map = el('div', 'wornmap');
  // PX19g: the doll's FRAME is part of the composition and is always
  // there - art inside it when the paperdoll can draw, a quiet
  // Avatar plaque when it cannot. Slapped-behind is over.
  const dollUrl = paperDollDataUrl(paperDollPixels(), { scale: 3 });
  const dollFrame = el('div', 'wornmap-doll');
  dollFrame.style.gridArea = DOLL_AREA;
  if (dollUrl) {
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
      d.append(el('span', 'worntile', '\u25c7'), el('span', 'wornslot', fam.label), el('span', 'wornname wornempty', '\u2014'));
      map.append(d);
      continue;
    }
    const top = filled.find((r) => r.item === picked) ?? filled[0];
    const line = itemLine(top.item, deps.entity);
    const b = el('button', `wornrow${filled.some((r) => r.item === picked) ? ' on' : ''}`);
    b.title = filled.map((r) => `${r.label}: ${itemLine(r.item, deps.entity).name}`).join('\n');
    b.style.gridArea = fam.area;
    b.append(itemTile(line));
    b.append(el('span', 'wornslot', fam.label));
    b.append(el('span', 'wornname', line.name));
    if (filled.length > 1) b.append(el('span', 'worncount', String(filled.length)));
    // SELECTS, never undresses (the mis-click law) - and a click on an
    // already-picked family CYCLES to its next piece and wraps, so a
    // family of four is four taps and all 27 slots stay reachable
    // from eleven panels.
    b.onclick = () => {
      const i = filled.findIndex((r) => r.item === picked);
      picked = filled[(i + 1) % filled.length].item;
      side = 'local'; notice = null; render();
    };
    map.append(b);
  }
  return wrap;
}

function characterCol() {
  // PX19d: the doll lives INSIDE the worn map now (behind the tiles);
  // stacking figurePanel above it would draw the avatar twice - or
  // the schematic beside the map, which is the same information told
  // twice. The map alone is the figure.
  const col2 = el('section', 'charcol');
  col2.append(equippedList());
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
  const src = line.image
    ? requestIcon(line.image.archive, line.image.record, { scale: 2, onReady: render })
    : null;
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
    tile.title = line.name;
    return tile;
  }
  const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  tile.title = line.image
    ? `${line.name} — TEXTURE.${line.image.archive} record ${line.image.record}`
    : line.name;
  return tile;
}

function itemRow(item, from = 'local') {
  const line = itemLine(item, deps.entity);
  const row = el('button', `itemrow${picked === item && side === from ? ' on' : ''}`);
  row.append(itemTile(line));
  const mid = el('span', 'itemname');
  mid.append(el('span', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
  const sub = [line.material, line.word].filter(Boolean).join(' · ');
  if (sub) mid.append(el('small', null, sub));
  row.append(mid);
  row.append(el('span', 'itemwt', `${line.weight.toFixed(2)} kg`));
  row.onclick = () => {
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
    picked = item; side = from; notice = null; render();
  };
  return row;
}

// ── THE REMOTE SIDE ──────────────────────────────────────────────
// DFU's window is TWO lists, and every flow the enhanced pack could
// not answer - the wagon, a corpse, a guild's reward tray, dropping
// anything at all - was the second one missing. It is a peer of the
// pack list rather than a panel hung off it, because that is what it
// is: the ground is a container the player is standing in.
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
  // GOLD IS NOT AN ITEM ROW. It is one stack in the pack that the list
  // shows as a line, and DFU gives it its own button and its own
  // numeric popup because "drop 40 of 12000" is not a click.
  const g = el('button', 'act', 'Gold');
  g.onclick = () => { goldEntry = goldEntry == null ? '0' : null; notice = null; render(); };
  acts.append(g);
  head.append(acts);
  col.append(head);
  if (goldEntry != null) col.append(goldField());
  if (!remote.items.length) {
    col.append(el('p', 'packempty', remote.kind === 'ground'
      ? 'Nothing dropped here yet.'
      : 'Empty.'));
  }
  for (const it of remote.items) col.append(itemRow(it, 'remote'));
  return col;
}

/** A numeric field of 8, opening on "0" (:1272). The REFUSAL is
 *  silent and outright rather than a clamp, which is why this shows
 *  what the player has: a field that rejects without saying why needs
 *  the ceiling written next to it. */
function goldField() {
  const form = el('form', 'goldfield');
  const carried = goldAmount(deps.entity ?? { items: deps.items?.() ?? [] });
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
  for (const t of TABS) {
    const b = el('button', `packtab${t === tab ? ' on' : ''}`, t[0].toUpperCase() + t.slice(1));
    const n = model.tabs.find((x) => x.tab === t)?.items.length ?? 0;
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
  const big = line.image
    ? requestIcon(line.image.archive, line.image.record, { scale: 4, onReady: render })
    : null;
  if (big) {
    const fig = el('div', 'bigicon');
    const img = el('img');
    img.src = big;
    img.alt = '';
    fig.append(img);
    c.append(fig);
  }
  c.append(el('h3', null, line.name));
  const meta = [line.material, line.stack ? `${line.stack} of them` : null].filter(Boolean).join(' · ');
  if (meta) c.append(el('p', 'meta', meta));
  const dl = el('dl', 'stats');
  const pair = (k, v) => { if (v != null) dl.append(el('dt', null, k), el('dd', null, String(v))); };
  pair('Weight', `${line.weight.toFixed(2)} kg`);
  pair('Condition', line.condition != null ? `${line.word} · ${line.condition}%` : null);
  if (side === 'local') pair('Worn', line.equipped ? 'yes' : 'no');
  else pair('Where', remote.title);
  c.append(dl);
  const acts = el('div', 'acts');
  if (side === 'local') {
    // REACHABLE, unlike a badge on a row: the selection survives the
    // press, so the item you just wore is still here and can come
    // straight back off. Every OTHER way to take something off is the
    // slot map.
    if (line.equipped) {
      const b = el('button', 'act primary', 'Take off');
      b.onclick = () => takeOff(picked.equipSlot);
      acts.append(b);
    } else {
      const b = el('button', 'act primary', 'Wear');
      b.onclick = () => wear(picked);
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
  const u = el('button', 'act', 'Use');
  // THE COLLECTION IS THE LIVE LIST, not the model's. `useItem`
  // CONSUMES out of what it is handed (:2048-2051 - a potion drunk
  // from a corpse must leave the corpse), and `remoteModel.items` is a
  // filtered COPY, so passing that would drink the potion and leave it
  // sitting in the pile. The bag travels separately for AUDIT 22 F4's
  // reason, inside `use`.
  u.onclick = () => use(picked,
    side === 'remote' ? remoteTarget(deps, sessionState()) : (deps.items?.() ?? []));
  acts.append(u);
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
  repaints++;
  repaintKeepingScroll(host, () => {
    host.innerHTML = '';
    // PX16b (Mac: "really study the reference"): the reference's
    // ground is THE GAME - two translucent columns on the left third,
    // the world showing through the right. So no sky here: the paused
    // frame is the ground (the pause door's law, one window over) and
    // every column carries its own scrim.
    const shell = el('div', 'pack-shell');
    // PX19 (Mac: centered, window-based; creative authority): THE
    // PACK IS A WINDOW NOW - the pause window's own frame (corner
    // gems, 2px border, the 0.72 glass) centered over the game, and
    // it ARRIVES like the dial: a stepped fade while the world drops
    // into the same depth-of-field. One entrance gesture for every
    // floating surface. The window carries its own footer; the right
    // column is the showcase compressed - figure above, plaque
    // beneath.
    requestAnimationFrame(() => requestAnimationFrame(() => shell.classList.add('on')));
    const win = el('div', 'pack-win');
    for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
    const head = el('header', 'pack-id');
    const who = el('div');
    who.append(el('h2', null, 'Pack'));
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
    const main = el('div', 'pack-main');
    main.append(characterCol(), el('div', 'packstage'));
    main.querySelector('.packstage').append(detailCol());
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
    if (notice) win.append(el('p', 'sheet-notice', notice));
    shell.append(win);
    if (remote.kind !== 'ground' || remote.count > 0) {
      const loot = el('aside', 'loot-win');
      for (const c of ['tl', 'tr', 'bl', 'br']) loot.append(el('span', `px-gem px-corner px-${c}`));
      loot.append(remoteCol());
      shell.append(loot);
    }
    host.append(shell);
  });
}

// ── THE KEYBOARD ─────────────────────────────────────────────────
// ESCAPE AND F6, the two keys the classic window closes on. F6 is a
// host BINDING rather than overlay vocabulary, so it is read from the
// event and CLAIMED - the same law U52's sheet applies to F5.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (overlayAction(e) !== 'back' && e.key !== 'F6') return;
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
  host = hostEl;
  deps = d;
  onExit = d.onExit ?? (() => {});
  tab = TABS[0];
  picked = null;
  side = 'local';
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
  return {
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
      hostEl.innerHTML = '';
      host = null;
      deps = {};
      onExit = () => {};
      picked = null;
      remote = null;
      delete globalThis.__pack;
    },
  };
}
