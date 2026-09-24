// ENHANCED TRADE — the shop counter (Buy / Sell / SellMagic / Repair /
// Identify) drawn in the ENHANCED INVENTORY's own structure: the same
// `.packcol` / `.itemrow` / `.packtabs` shape enhancedInventory.js
// builds for the pack, the same `.px-home/.px-win` frame every other
// enhanced screen wears, instead of nativeTrade.js's INVE00I0 canvas.
//
// ui/tradeDoor.js is the gate: this module mounts ONLY when the
// player is in enhanced mode (isEnhanced()) - a host in native/classic
// mode keeps NativeTradeWindow exactly as it was, untouched by this
// file. Nothing here is reachable from the classic skin.
//
// THE LAW IS BORROWED, NOT REWRITTEN, the same standing rule
// ui/enhancedInventory.js states at its own head. Every number this
// screen shows or spends comes out of systems/tradeModes.js (cost,
// haggle price, the Yes/No decision, sell proceeds, the local-list and
// click gates), systems/itemTransfer.js (the capacity-checked Buy
// transfer), systems/repairService.js (the repair counter's own
// clock) and systems/theft.js (the steal roll) - the SAME modules
// nativeTrade.js reads, so the two skins cannot disagree about a
// price or a refusal. This file positions rows and wires the click
// each mode's click means, mirroring nativeTrade.js's own decisions
// (_pickLocal/_pickRemote/_modeAction/_confirm/_doSteal) rather than
// re-deriving them.
//
// THE HOOKS BAG IS nativeTrade.js's, UNCHANGED - see its own doc
// comment above `NativeTradeWindow`. ui/tradeDoor.js hands both
// windows the identical hooks object a host builds, so a host never
// has to know or care which skin is about to read it.
//
// WHAT IT DOES NOT DRAW: the classic art panels (INVE00I0/SHOP00I0)
// and the ARENA2 item icon textures those panels frame. Like
// enhancedSpellbook.js ("this window reads no ARENA2"), a trade
// counter reachable from a fresh install with no classic assets must
// stand on its own - so this reads item icons the same OPTIONAL way
// enhancedInventory's own item tile does (requestIcon over the item's
// texture record), falling back to two letters when that record is
// unavailable, and never blocks on it.

import { itemLine } from './enhancedInventory.js';   // RF6/MW-D38: one item model, read by both packs
import { requestIcon } from './textureCanvas.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { audio } from '../systems/audio.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';
import { SOUND } from '../systems/soundClips.js';
import {
  tradeCost, getTradePrice, tradeDecision, sellProceeds,
  localListAccepts, localClickDecision, DOESNT_NEED_IDENTIFY,
  MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID, DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID,
} from '../systems/tradeModes.js';
import {
  CANNOT_BE_REPAIRED_TEXT, INTERRUPT_REPAIR_TEXT,
  isBeingRepaired as itemIsBeingRepaired, isRepairFinished, collectRepaired,
} from '../systems/repairService.js';
import { planTake, applyTransfer, clearLightSourceOnLeave, CANNOT_CARRY_TEXT } from '../systems/itemTransfer.js';
import { isSummoned, carriedWeight, totalWeight, transferAll } from '../systems/inventory.js';
import { shopliftAttempt } from '../systems/theft.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../systems/createItem.js';
import { questTransferRefused, SMALL_CART_TEMPLATE, TABS, tabAccepts } from './nativeInventory.js';
import { initialTradeTab, STEAL_SUCCESS_TEXT, STEAL_FAILURE_TEXT } from './nativeTrade.js';
import { expandGuildMacros } from '../systems/guildServiceActions.js';
import { firstName } from '../systems/talkSession.js';   // MACRO-4: %pct's shop arm

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The mode label a player reads as this window's title, and the verb
 *  its mode-action button carries - MODE_ACTION_BUTTON's letters
 *  (nativeTrade.js) are a classic hotkey name; this is the plain word. */
const MODE_LABEL = Object.freeze({
  Buy: 'Buy', Sell: 'Sell', SellMagic: 'Sell', Repair: 'Repair', Identify: 'Identify',
});
const TAB_LABEL = Object.freeze({
  weapons: 'Weapons & Armor', magic: 'Magic Items', clothing: 'Clothing & Misc', ingredients: 'Ingredients',
});

let host = null;
let deps = {};      // the hooks bag, nativeTrade.js's own shape
let onExit = () => {};
let mode = 'Buy';
let tab = 'weapons';
let basket = [];    // Buy mode's staged lot (shown in the LOCAL column)
let staged = [];    // every other mode's staged lot (shown in the REMOTE column)
let usingWagon = false;
let box = null;     // { rows, buttons: 'YesNo'|null, onYes }
let selected = null;   // { item, side: 'local'|'remote' } - a single click's tooltip, not yet transferred
let unregisterOutside = () => {};
// A manual double-click tracker. render() below tears down and rebuilds
// EVERY row on EVERY click (even a plain single click, just to draw the
// tooltip) - so the row a first click lands on is already a different
// DOM node by the time a second click arrives. Browsers only count two
// clicks as a double click when they hit the SAME node, so the native
// `dblclick` event never fires here once a re-render has happened in
// between. Tracking the clicked ITEM and a timestamp, rather than
// relying on the browser's own node-identity click counting, sidesteps
// that entirely.
//
// The timestamp itself has to be the CLICK EVENT'S OWN `timeStamp`,
// not `Date.now()` read inside the handler: a bigger shelf (General
// Store's - it stocks from seven item groups plus a horse, a cart and
// a provisions list, easily the largest render in the building set)
// takes longer to rebuild, and while that rebuild from the FIRST
// click is running, JS is single-threaded - the SECOND click's own
// handler cannot even start until it finishes. `Date.now()` read at
// that point measures from AFTER the render delay, not from the
// actual click, so a real double click on a slow-to-redraw shelf can
// read as "too far apart" purely because the shop was slow, not
// because the player was. `event.timeStamp` is stamped by the browser
// at the moment of the real input, before any of that queuing, so it
// stays accurate regardless of how long the render in between took.
let lastRowClick = { item: null, time: 0 };
const DOUBLE_CLICK_MS = 500;
let keyHandler = null;

const inBuy = () => mode === 'Buy';
const selling = () => mode === 'Sell' || mode === 'SellMagic';

/** remoteItems (nativeTrade.js's own getter): the in-repair collection
 *  in Repair mode, `staged` in every other. */
function remoteItems() { return mode === 'Repair' ? (deps.otherItems?.() ?? staged) : staged; }
/** stagedForCost: what the cost strip totals. */
function stagedForCost() {
  if (inBuy()) return basket;
  return mode === 'Repair' ? remoteList() : staged;
}

function localList() {
  const equipped = deps.isEquipped ?? (() => false);
  const held = remoteItems();
  const onTab = (it) => tabAccepts(it, tab);
  const pack = (deps.packItems?.() ?? []).filter((it) => !equipped(it) && localListAccepts(mode, it, {
    accepts: deps.accepts, enchanted: deps.enchanted,
  }) && onTab(it) && !held.includes(it));
  return inBuy() ? [...basket.filter((it) => !equipped(it) && onTab(it)), ...pack] : pack;
}
function remoteList() {
  if (inBuy()) return deps.shelfItems?.() ?? [];
  if (mode === 'Repair') return deps.repairItems?.() ?? remoteItems();
  return staged;
}

function cost() {
  return tradeCost(mode, stagedForCost(), {
    ...(deps.priceCtx?.() ?? {}),
    usingIdentifySpell: deps.usingIdentifySpell ?? false,
    isBeingRepaired: deps.isBeingRepaired ?? (() => false),
  });
}

/** A QUOTED PRICE for one item, staged or not - what the aggregate
 *  Cost readout in the footer cannot show while nothing has been
 *  staged yet (it is the STAGED lot's total, zero with an empty one).
 *  The tooltip strip below reads this for whichever item is currently
 *  selected, so previewing an item on the shelf, or one of your own
 *  that this window's quick-sell reaches for, answers a real number
 *  rather than the aggregate's 0. Same law, single-item pass. */
function quotePriceFor(item, side) {
  const ctx = deps.priceCtx?.() ?? {};
  const quality = ctx.quality ?? 0; const skills = ctx.skills ?? {};
  const priced = (m) => getTradePrice(m, tradeCost(m, [item], ctx).cost, quality, skills);
  if (side === 'remote') {
    // Buying: the shelf. Every other mode's remote pane is the STAGED
    // lot already, not something new to quote.
    if (inBuy()) return { label: 'Buy for', price: priced('Buy') };
    return null;
  }
  // side === 'local': your own item, whatever this window's mode is.
  if (inBuy()) {
    // Nothing to BUY from your own pack - the quick-sell shortcut
    // (footer button relabelled 'Sell') is the only thing a click here
    // can do, so that is the price worth quoting.
    return isQuickSellCandidate() ? { label: 'Sell for', price: priced('Sell') } : null;
  }
  // Sell/SellMagic/Repair/Identify: the SAME decision a click would
  // make (localClickDecision) - a quote for an item this mode would
  // refuse (an unrepairable trinket, an already-identified ring, a
  // wagon in use) would just be misleading.
  const d = localClickDecision(mode, item, {
    allowMagicRepairs: deps.allowMagicRepairs ?? false,
    usingIdentifySpell: deps.usingIdentifySpell ?? false,
    wagonLoaded: (deps.entity?.wagonItems ?? []).length > 0,
    usedWagon: (deps.entity?.items ?? []).find(
      (i) => i.group === 'Transportation' && i.templateIndex === SMALL_CART_TEMPLATE) ?? null,
  });
  if (d.kind !== 'stage') return null;
  if (mode === 'Identify' && deps.usingIdentifySpell) return { label: 'Identify for', price: 0 };
  return { label: `${MODE_LABEL[mode] ?? 'Trade'} for`, price: priced(mode) };
}

function rowsFor(id, amount = null) {
  return (deps.rows?.(id) ?? []).map((r) => ({
    ...r,
    text: expandGuildMacros(r.text, {
      amount, gold: deps.gold?.() ?? 0, shopName: deps.shopName ?? '',
      cityName: deps.cityName?.() ?? '', playerName: deps.entity?.name ?? '',
      guildTitle: deps.guildTitle?.() ?? firstName(deps.entity?.name ?? ''),   // MACRO-4: %pct (TradeMacroDataSource.GuildTitle)
    }),
  }));
}

function refuse(refusal) {
  const rows = (id) => rowsFor(id);
  const text = {
    magic: rows(MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID),
    undamaged: rows(DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID),
    notRepairable: [{ text: CANNOT_BE_REPAIRED_TEXT, center: true }],
    identified: [{ text: DOESNT_NEED_IDENTIFY, center: true }],
  }[refusal] ?? [];
  box = { rows: text.length ? text : [{ text: '...', center: true }], buttons: null };
  render();
}

function refuseTransfer(item) {
  const refused = isSummoned(item) || questTransferRefused(item, {
    fromLocal: true, toWagon: false, getQuest: deps.getQuest ?? null,
  });
  if (!refused) return false;
  box = { rows: [{ text: CANNOT_REMOVE_ITEM_TEXT, center: true }], buttons: null };
  render();
  return true;
}

function move(item, from, to) {
  const i = from.indexOf(item);
  if (i >= 0) from.splice(i, 1);
  to.push(item);
}

/** Whether a pending local (your own pack) selection in Buy mode is a
 *  quick-sell candidate rather than a basket item to unstage: still
 *  really yours, and Sell mode's own law (localClickDecision) would
 *  actually take it - not the loaded-wagon 'ignore' arm. */
/** DISABLED: this window opens from a shelf you can interact with
 *  directly, in a room that also has the trader NPC in it - selling
 *  is meant to be the NPC's own Sell screen only. This used to check
 *  localClickDecision('Sell', ...) for a pending selection and let a
 *  Buy-mode click on your own pack item sell it on the spot; forced
 *  to always answer `false` so every call site downstream (the
 *  footer's primary button, the click/double-click handler, the price
 *  quote strip) treats a pack-item click in Buy mode as a no-op, same
 *  as clicking a pack item that Sell mode itself would refuse. Buying
 *  off the shelf is untouched; talking to the trader and choosing
 *  Sell still opens the real Sell-mode window exactly as before. */
function isQuickSellCandidate() {
  return false;
}

/** A DRY RUN of pickLocal/pickRemote's own decision, for a pending
 *  selection - never moves anything, only answers whether the footer
 *  button (or a double click) would actually do something if pressed.
 *  Reads the SAME decision functions those two use, so this cannot
 *  drift from what a click actually does. */
function canTransferSelected() {
  if (!selected) return false;
  const { item, side } = selected;
  if (side === 'local') {
    // Buy mode's own law (tradeModes.js's localClickDecision): a pack
    // item that is not already in the basket is 'ignore' - there is
    // nothing to BUY from your own pack. In Buy mode specifically that
    // is not the end of it, though - see isQuickSellCandidate below,
    // which the footer reaches for instead when this says no.
    const d = localClickDecision(mode, item, {
      inBasket: (i) => basket.includes(i),
      allowMagicRepairs: deps.allowMagicRepairs ?? false,
      usingIdentifySpell: deps.usingIdentifySpell ?? false,
      wagonLoaded: (deps.entity?.wagonItems ?? []).length > 0,
      usedWagon: (deps.entity?.items ?? []).find(
        (i) => i.group === 'Transportation' && i.templateIndex === SMALL_CART_TEMPLATE) ?? null,
    });
    return d.kind === 'stage' || d.kind === 'unstage' || isQuickSellCandidate();
  }
  // side === 'remote': in Buy mode this is the shelf, and planTake is
  // the same capacity/carry check pickRemote itself asks before
  // moving anything. Every other mode's remote click is "take this
  // back" and always answers something (at worst a Yes/No interrupt
  // box, which is still a real action, not a refusal).
  if (inBuy()) return planTake(item, { bag: [...deps.packItems(), ...basket], entity: deps.entity ?? null }).ok;
  return true;
}

function pickLocal(item) {
  const d = localClickDecision(mode, item, {
    inBasket: (i) => basket.includes(i),
    allowMagicRepairs: deps.allowMagicRepairs ?? false,
    usingIdentifySpell: deps.usingIdentifySpell ?? false,
    wagonLoaded: (deps.entity?.wagonItems ?? []).length > 0,
    usedWagon: (deps.entity?.items ?? []).find(
      (i) => i.group === 'Transportation' && i.templateIndex === SMALL_CART_TEMPLATE) ?? null,
  });
  if (d.kind === 'stage') {
    if (refuseTransfer(item)) return;
    clearLightSourceOnLeave(item, deps.entity, true);
    move(item, deps.packItems(), remoteItems());
    playTransferSound();
    render();
    return;
  }
  if (d.kind === 'unstage') { move(item, basket, deps.shelfItems()); playTransferSound(); render(); return; }
  if (d.kind === 'refuse') refuse(d.refusal);
}

function takeItemFromRepair(item) {
  move(item, remoteItems(), deps.packItems());
  collectRepaired(item);
}

function pickRemote(item) {
  if (inBuy()) {
    const plan = planTake(item, { bag: [...deps.packItems(), ...basket], entity: deps.entity ?? null });
    if (!plan.ok) {
      box = { rows: [{ text: plan.refusal?.text ?? CANNOT_CARRY_TEXT, center: true }], buttons: null };
      render();
      return;
    }
    applyTransfer(item, plan, deps.shelfItems(), basket);
    playTransferSound();
    render();
    return;
  }
  if (mode === 'Repair') {
    const now = deps.nowMinutes?.() ?? 0;
    if (itemIsBeingRepaired(item) && !isRepairFinished(item, now)) {
      box = {
        rows: [{ text: INTERRUPT_REPAIR_TEXT, center: true }], buttons: 'YesNo',
        onYes: () => { takeItemFromRepair(item); render(); },
      };
      render();
      return;
    }
    takeItemFromRepair(item);
    render();
    return;
  }
  move(item, remoteItems(), deps.packItems());
  playTransferSound();
  render();
}

/** A single click: read the item, don't move it - the tooltip
 *  enhancedInventory.js's own `picked` card shows, not a transfer.
 *  Clicking the SAME item again closes it (that card's own toggle);
 *  clicking a different one just switches the tooltip to it. */
function selectItem(item, side) {
  selected = (selected?.item === item) ? null : { item, side };
  render();
}

/** The actual move selectItem() deliberately does not do - a double
 *  click, or the footer's primary button reaching for a pending
 *  selection (below), both land here. */
function transferSelected() {
  if (!selected) return;
  const { item, side } = selected;
  selected = null;
  if (side === 'local') pickLocal(item); else pickRemote(item);
}

function clear() {
  selected = null;
  if (inBuy()) { while (basket.length) move(basket[0], basket, deps.shelfItems()); return; }
  if (mode === 'Repair') {
    const now = deps.nowMinutes?.() ?? 0;
    for (const it of [...remoteList()]) {
      if (itemIsBeingRepaired(it) && !isRepairFinished(it, now)) continue;
      takeItemFromRepair(it);
    }
    return;
  }
  const remote = remoteItems();
  while (remote.length) move(remote[0], remote, deps.packItems());
}

function playTransferSound() {
  // ES1/MAC-O6: the pack's own transfer cue, gated the same way.
  if (enhancedSoundsOn()) audio.playOneShot(SOUND.ButtonClick, 1);
}

/** What Steal reaches for: the basket if anything is staged in it
 *  (DFU's own law - stage first, then steal instead of paying) or,
 *  with the basket still empty, whatever shelf item is currently
 *  selected - so a single click's tooltip preview is itself enough to
 *  steal that one item, rather than needing a double click to stage
 *  it first only to steal it straight back out again. */
function stealTargets() {
  if (basket.length) return basket;
  if (selected?.side === 'remote' && inBuy()) return [selected.item];
  return [];
}
function stealCost() {
  const items = stealTargets();
  return items.length ? tradeCost('Buy', items, deps.priceCtx?.() ?? {}).cost : 0;
}

/** ENHANCED-ONLY UX: a click on Steal ASKS first, rather than rolling
 *  immediately. nativeTrade.js's own `_doSteal` fires at the click -
 *  DFU's DoSteal never confirms either - but a one-click, irrevocable
 *  crime (guards, a Thieves Guild mark) reads as a misclick on a
 *  screen built around Yes/No everywhere else on it. The roll and its
 *  five effects are unchanged; only the ask in front of them is new. */
function doSteal() {
  if (!inBuy() || !(stealCost() > 0)) return;
  box = {
    rows: [{ text: 'Steal these goods rather than pay for them?', center: true }],
    buttons: 'YesNo',
    onYes: runSteal,
  };
  render();
}

function runSteal() {
  const items = stealTargets();
  if (!items.length) return;
  const ctx = deps.priceCtx?.() ?? {};
  const out = shopliftAttempt({ basket: items, pickpocketSkill: deps.pickpocketSkill?.() ?? 0, shopQuality: ctx.quality ?? 0 });
  deps.tallyPickpocket?.(1);
  if (!out.caught) {
    deps.say?.(STEAL_SUCCESS_TEXT, 2);
    if (basket.length) transferAll(basket, deps.packItems());
    else move(items[0], deps.shelfItems(), deps.packItems());
    selected = null;
    deps.tallyCrimeGuild?.(true, 1);
  } else {
    deps.say?.(STEAL_FAILURE_TEXT, 2);
    deps.crimeTheft?.();
    deps.spawnCityGuards?.(true);
  }
  close();
}

function castIdentifySpell() {
  if (deps.commit?.(mode, [...staged], 0, null) === false) return;
  clear();
  render();
}

function confirmTrade(price) {
  const isSelling = selling();
  const proceeds = isSelling ? sellProceeds(price, deps.weight?.() ?? {}) : null;
  deps.commit?.(mode, [...stagedForCost()], price, proceeds);
  if (inBuy()) basket.length = 0;
  else if (isSelling) staged.length = 0;
  audio.playOneShot(proceeds?.kind === 'letterOfCredit' ? SOUND.ParchmentScratching : SOUND.GoldPieces, 1);
  if (proceeds?.kind === 'letterOfCredit') {
    box = { rows: [{ text: 'You are paid with a letter of credit.', center: true }], buttons: null };
  }
  render();
}

/** BUY-WINDOW QUICK SELL: one of your own items, sold on the spot
 *  through the SAME Sell-mode law (tradeCost/getTradePrice/
 *  tradeDecision/sellProceeds/commit) a real Sell-mode window runs -
 *  this only skips the STAGING step, because Buy and Sell are two
 *  different window instances in DFU (a shop's Talk/Sell/Exit popup
 *  opens Sell separately) and there is no in-place mode switch to
 *  reach for. The window's own `mode` never changes; only this one
 *  item's own trade is asked for as 'Sell'. `deps.commit` reads the
 *  mode it is GIVEN, not the window's (worldModes.js's commitTrade
 *  switches on its own `mode` parameter), so this is exactly as real
 *  a sale as the staged-and-confirmed kind. */
function quickSellSelected() {
  if (!selected || !isQuickSellCandidate()) return;
  const item = selected.item;
  const ctx = deps.priceCtx?.() ?? {};
  const c = tradeCost('Sell', [item], ctx).cost;
  const price = getTradePrice('Sell', c, ctx.quality ?? 0, ctx.skills ?? {});
  const d = tradeDecision('Sell', { cost: c, tradePrice: price, gold: deps.gold?.() ?? 0 });
  box = {
    rows: rowsFor(d.textId, price),
    buttons: 'YesNo',
    onYes: () => {
      const proceeds = sellProceeds(price, deps.weight?.() ?? {});
      deps.commit?.('Sell', [item], price, proceeds);
      selected = null;
      audio.playOneShot(proceeds?.kind === 'letterOfCredit' ? SOUND.ParchmentScratching : SOUND.GoldPieces, 1);
      if (proceeds?.kind === 'letterOfCredit') {
        box = { rows: [{ text: 'You are paid with a letter of credit.', center: true }], buttons: null };
      }
      render();
    },
  };
  render();
}

/** The footer's one primary button, doing whichever of its jobs the
 *  moment calls for: a quick-sell candidate sells it outright; any
 *  other pending selection (a single click's tooltip, not yet moved)
 *  takes the click as "transfer this" - the same move a double click
 *  makes - and clears the tooltip; with nothing selected it is the
 *  ordinary Buy/Sell/Repair/Identify confirmation, unchanged. */
function primaryAction() {
  if (selected && isQuickSellCandidate()) { quickSellSelected(); return; }
  if (selected) { transferSelected(); render(); return; }
  modeAction();
}

function modeAction() {
  const { cost: c, modeActionEnabled } = cost();
  if (!modeActionEnabled) return;
  if (deps.usingIdentifySpell) { castIdentifySpell(); return; }
  const ctx = deps.priceCtx?.() ?? {};
  const price = getTradePrice(mode, c, ctx.quality ?? 0, ctx.skills ?? {});
  const d = tradeDecision(mode, { cost: c, tradePrice: price, gold: deps.gold?.() ?? 0 });
  if (d.kind === 'notEnoughGold') {
    box = { rows: d.textIds.flatMap((id) => rowsFor(id, price)), buttons: null };
    render();
    return;
  }
  box = { rows: rowsFor(d.textId, price), buttons: 'YesNo', onYes: () => confirmTrade(price) };
  render();
}

function dismissBox(yes) {
  const b = box;
  box = null;
  if (yes && b?.buttons === 'YesNo') b.onYes?.();
  render();
}

function close() {
  // OnPop's ClearSelectedItems (nativeTrade.js's own `_close`): every
  // exit from this screen puts back whatever is still staged. `onExit`
  // is ui/tradeDoor.js's own teardown - the host's `hooks.onClose` is
  // left untouched here, as NativeTradeWindow leaves it: a window that
  // needs cleanup on close hangs it off the host's `done` sweep instead
  // (ui/tradeDoor.js's overlay wrapper answers `done` the same way
  // NativeTradeWindow does).
  clear();
  unregisterOutside();
  onExit();
}

function setTab(t) { tab = t; render(); }

// ── ROWS ──────────────────────────────────────────────────────────

function itemTile(line) {
  const src = line.image ? requestIcon(line.image.archive, line.image.record, { scale: 2, onReady: render }) : null;
  if (src) {
    const tile = el('span', 'tile has-icon');
    const img = el('img');
    img.src = src; img.alt = '';
    tile.append(img);
    tile.title = line.name;
    return tile;
  }
  const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  tile.title = line.name;
  return tile;
}

function itemRow(item, from) {
  const line = itemLine(item, deps.entity);
  const row = el('button', 'itemrow');
  row.append(itemTile(line));
  const mid = el('span', 'itemname');
  mid.append(el('span', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
  const sub = [line.material, line.word].filter(Boolean).join(' · ');
  if (sub) mid.append(el('small', null, sub));
  row.append(mid);
  row.append(el('span', 'itemwt', `${line.weight.toFixed(2)} kg`));
  if (mode === 'Repair' && from === 'remote') {
    const now = deps.nowMinutes?.() ?? 0;
    const done = itemIsBeingRepaired(item) ? isRepairFinished(item, now) : true;
    row.classList.add(done ? 'on' : 'ghost');
  }
  if (selected?.item === item) row.classList.add('picked');
  // A single click reads the item (the tooltip strip below the lists);
  // a double click - or the footer's primary button, reaching for
  // this same pending selection - is what actually moves it.
  // A single click reads the item (the tooltip strip below the lists);
  // a double click - or the footer's primary button, reaching for
  // this same pending selection - is what actually moves it.
  //
  // Wired as a manually-timed "second click on the same item" check
  // (see lastRowClick's own comment above) rather than the native
  // `dblclick` event: render() rebuilds this row into a fresh DOM node
  // on the first click alone, which breaks the browser's own
  // same-node double-click detection before a native `dblclick` would
  // ever get a chance to fire.
  row.onclick = (e) => {
    const now = e.timeStamp;
    if (lastRowClick.item === item && now - lastRowClick.time <= DOUBLE_CLICK_MS) {
      lastRowClick = { item: null, time: 0 };
      selected = null;
      (from === 'local' ? pickLocal(item) : pickRemote(item));
      return;
    }
    lastRowClick = { item, time: now };
    selectItem(item, from);
  };
  return row;
}

function localCol() {
  const col = el('section', 'packcol');
  const tabsEl = el('div', 'packtabs');
  for (const t of TABS) {
    const b = el('button', `packtab${t === tab ? ' on' : ''}`, TAB_LABEL[t]);
    b.onclick = () => setTab(t);
    tabsEl.append(b);
  }
  col.append(tabsEl);
  const list = el('div', 'remotelist');
  const items = localList();
  if (!items.length) list.append(el('p', 'packempty', 'Nothing here answers to that page.'));
  for (const it of items) list.append(itemRow(it, 'local'));
  col.append(list);
  return col;
}

function remoteHeading() {
  if (inBuy()) return 'On the shelf';
  if (mode === 'Repair') return 'At the counter';
  if (mode === 'Identify') return 'Staged';
  return 'Staged to sell';
}

function remoteCol() {
  const col = el('section', 'packcol packremote');
  const head = el('div', 'remotehead');
  const who = el('div', 'remotewho');
  who.append(el('h3', null, remoteHeading()));
  const items = remoteList();
  who.append(el('p', 'meta', `${items.length} item${items.length === 1 ? '' : 's'}`));
  head.append(who);
  col.append(head);
  const list = el('div', 'remotelist');
  if (!items.length) list.append(el('p', 'packempty', 'Nothing staged yet.'));
  for (const it of items) list.append(itemRow(it, 'remote'));
  col.append(list);
  return col;
}

/** The single-click tooltip: itemLine's own stats, the same fields
 *  enhancedInventory.js's own detail card reads, laid out as one
 *  compact strip rather than that card's sliding third column - this
 *  window is two columns, not three, and a bought or sold item's
 *  stats are a glance, not a page. */
function detailStrip() {
  if (!selected) return null;
  const line = itemLine(selected.item, deps.entity);
  const bar = el('div', 'trade-detail');
  bar.append(itemTile(line));
  const info = el('div', 'trade-detail-info');
  info.append(el('h4', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
  const bits = [line.material, line.word, `${line.weight.toFixed(2)} kg`];
  if (line.damage != null) bits.push(`Damage ${line.damage}`);
  if (line.armour != null) bits.push(`Armour ${line.armour}`);
  if (line.hands != null) bits.push(line.hands);
  for (const t of line.survival ?? []) bits.push(t);
  info.append(el('p', 'meta', bits.filter(Boolean).join(' · ')));
  const quote = quotePriceFor(selected.item, selected.side);
  if (quote) info.append(el('p', 'trade-quote', `${quote.label} ${quote.price} gold`));
  bar.append(info);
  const closeBtn = el('button', 'act', 'Close');
  closeBtn.onclick = () => { selected = null; render(); };
  bar.append(closeBtn);
  return bar;
}

function footer() {
  const bar = el('div', 'remoteacts trade-footer');
  const { cost: c, modeActionEnabled } = cost();
  bar.append(el('span', 'meta trade-cost', `Cost: ${c}   Gold: ${deps.gold?.() ?? 0}`));
  if (inBuy()) {
    const steal = el('button', 'act', 'Steal');
    steal.disabled = !(stealCost() > 0);
    steal.onclick = doSteal;
    bar.append(steal);
  }
  const clearBtn = el('button', 'act', 'Clear');
  clearBtn.onclick = () => { clear(); render(); };
  bar.append(clearBtn);
  const action = el('button', 'act primary', isQuickSellCandidate() ? 'Sell' : (MODE_LABEL[mode] ?? 'Trade'));
  // A pending selection (a single click's tooltip) makes this button
  // reach for THAT item instead of the ordinary confirm - but only
  // when the item is one this button could actually do something with
  // (canTransferSelected's dry run of pickLocal/pickRemote's own
  // decision): your own item in Buy mode, not yet in the basket, has
  // no Buy to offer it, so the button greys out rather than reading
  // as an action that would do nothing.
  action.disabled = selected ? !canTransferSelected() : !modeActionEnabled;
  action.onclick = primaryAction;
  bar.append(action);
  return bar;
}

function boxScrim() {
  const scrim = el('div', 'sb-ask');
  const ask = el('div', 'card');
  for (const r of box.rows) ask.append(el('p', 'px-note', r.text));
  const acts = el('div', 'sb-acts');
  if (box.buttons === 'YesNo') {
    const yes = el('button', 'act primary', 'Yes');
    yes.onclick = () => dismissBox(true);
    const no = el('button', 'act', 'No');
    no.onclick = () => dismissBox(false);
    acts.append(yes, no);
  } else {
    const ok = el('button', 'act primary', 'OK');
    ok.onclick = () => dismissBox(false);
    acts.append(ok);
  }
  ask.append(acts);
  scrim.append(ask);
  return scrim;
}

function render() {
  if (!host) return;
  // The scroll position of each list-column, captured before the
  // rebuild below throws them away - render() runs on EVERY state
  // change (a single click just to preview an item included), and
  // without this a click halfway down a long shelf snapped the view
  // back to its top every time.
  const prevScroll = Array.from(host.querySelectorAll('.packcol')).map((c) => c.scrollTop);
  host.innerHTML = '';
  const shell = el('div', 'px-home px-over trade-shell');
  const win = el('div', 'px-win trade-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const head = el('header', 'sb-top');
  const who = el('div', 'sb-who');
  who.append(el('h2', null, `${deps.shopName ?? 'Shop'} — ${MODE_LABEL[mode] ?? mode}`));
  head.append(el('span', 'sb-spacer'), who);
  const closeBtn = el('button', 'act', 'Close');
  closeBtn.onclick = close;
  head.append(closeBtn);
  win.append(head);

  const body = el('div', 'px-body trade-body');
  const lists = el('div', 'packlists');
  lists.append(localCol(), remoteCol());
  body.append(lists);
  const detail = detailStrip();
  if (detail) body.append(detail);
  win.append(body);
  win.append(footer());

  if (box) {
    for (const b of win.querySelectorAll('button')) b.disabled = true;
    win.append(boxScrim());
  }
  shell.append(win);
  host.append(shell);
  host.querySelectorAll('.packcol').forEach((c, i) => { if (prevScroll[i] != null) c.scrollTop = prevScroll[i]; });
  unregisterOutside();
  unregisterOutside = closeOnOutsideTap(shell, '.px-win', () => { if (!box) close(); });
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (box) {
    if (box.buttons === 'YesNo') {
      if (e.code === 'KeyY') { e.preventDefault(); dismissBox(true); }
      else if (e.code === 'KeyN' || overlayAction(e) === 'back') { e.preventDefault(); dismissBox(false); }
    } else if (overlayAction(e) === 'back' || e.key === 'Enter') { e.preventDefault(); dismissBox(false); }
    return;
  }
  if (overlayAction(e) === 'back') { e.preventDefault(); close(); return; }
  if (e.key === 'Enter') { e.preventDefault(); modeAction(); }
}

/**
 * Mounts the enhanced trade counter. `hooks` is nativeTrade.js's own
 * hooks bag (see the doc comment above `NativeTradeWindow`) - the
 * door hands the SAME object to either skin, so a host never builds
 * two.
 */
export function mountEnhancedTrade(hostEl, hooks = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  deps = hooks;
  mode = hooks.mode ?? 'Buy';
  tab = initialTradeTab(mode);
  basket = [];
  staged = [];
  usingWagon = false;
  box = null;
  selected = null;
  onExit = hooks.onExit ?? (() => {});
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  return {
    repaint: render,
    unmount() {
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      keyHandler = null;
      unregisterOutside();
      unregisterOutside = () => {};
      host = null;
      deps = {};
      basket = [];
      staged = [];
      box = null;
      selected = null;
    },
  };
}

/** GetCarriedWeight override, re-exported for a host that wants it
 *  (parity with nativeTrade.js's own `_carriedWeight`). */
export function tradeCarriedWeight(entity) {
  return carriedWeight(entity ?? {}) + totalWeight(basket);
}
export function tradeMaxEncumbrance(entity) { return entityMaxEncumbrance(entity ?? {}); }
