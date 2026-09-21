// ENHANCED TAVERN — the innkeeper's four-button panel (Room / Talk /
// Food / Exit), drawn in the same framed-window family as
// enhancedTrade.js and enhancedSpellbook.js rather than nativeMenu's
// TVRN00I0 canvas panel.
//
// ui/tavernDoor.js is the gate: this module mounts ONLY in enhanced
// mode (isEnhanced()) - native/classic mode keeps ui/tavernWindow.js's
// `TavernWindow` exactly as it was.
//
// THE LAW IS BORROWED, NOT REWRITTEN. Every number this screen shows or
// spends comes out of systems/tavern.js (the room formula, the rental
// decision, the classic food-and-drink table) and, when the survival
// switch is on, systems/survival/tavernMenu.js's own regional menu and
// its eat/drink/blackout law - the SAME modules tavernWindow.js reads,
// so the two skins cannot disagree about a price or an effect. This
// file positions rows and wires the click each step means.
//
// THE HOOKS BAG IS tavernWindow.js's OWN, unchanged (see the doc
// comment above `TavernWindow`) - ui/tavernDoor.js hands both windows
// the identical object a host builds.
//
// "Consumed instantly": a meal or a drink here spends its gold and
// applies its effect (health healed, the drunk counter, a blackout to
// morning) the moment the row is picked - there is no basket, no
// mode-action button and nothing staged, exactly as DFU's own
// FoodAndDrink_OnItemPicked never stages either.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { noticeHold, noticeRelease } from './enhancedNotice.js';   // ENH-NOTICE3: this window's own click-anywhere box, as the enhanced panel
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { macroRows } from './guildServiceWindows.js';
import { totalGoldAmount, deductGold } from '../systems/court.js';
import { dayOfYearFromMinutes } from '../systems/gameDate.js';
import {
  TOO_MANY_DAYS_ID, OFFER_PRICE_ID, NOT_ENOUGH_GOLD_ID,
  HOW_MANY_DAYS_ID, HOW_MANY_ADDITIONAL_DAYS_ID,
  ROOM_FREE_FOR_KNIGHT, ROOM_FREE_HEARTS_DAY, YOU_ARE_NOT_HUNGRY,
  TAVERN_MENU, TAVERN_PRICES, removeExpiredRooms, findRentedRoom, roomRemainingHours,
  rentalDecision, rentRoom, canEat, eatOrDrink,
} from '../systems/tavern.js';
import { survivalOn } from '../systems/survival/switch.js';
import { tavernMenu, tavernEat, tavernDrink, blackout } from '../systems/survival/tavernMenu.js';
import { survivalOf } from '../systems/survival/needs.js';
import { stiffen } from '../systems/survival/rest.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let host = null;
let deps = {};
let onExit = () => {};
let screen = 'main';      // 'main' | 'room'
let roomDraft = '1';       // the days field, as typed
let box = null;            // { rows, buttons: 'YesNo'|null, onYes }
let menu = null;           // the food/drink rows, while that picker is up
let unregisterOutside = () => {};
let keyHandler = null;
/** ENH-NOTICE3: the notice panel's OWNER for this window. A module-level
 *  object rather than the view the mount returns, because `render()`
 *  runs during the mount (before the view exists) and again from
 *  `unmount` - and the owner has to be the same object across both or
 *  the release cannot find the panel the raise minted. One tavern is
 *  ever up, so one owner is enough; the module stamps `_noticeKey` on
 *  it and re-uses it, which is what keeps two consecutive boxes from
 *  stacking two panels. */
const noticeOwner = {};

const line = (text) => [{ text, center: true }];
/** DFU's own "Good day, %ra." quotes the player's race back at them
 *  (MacroHelper.cs's %ra, systems/guildServiceActions.js) - a hook
 *  this window never wires (no greeting anywhere else in this file
 *  names the player), so the token was going out unexpanded rather
 *  than resolved. Rather than wire a fifth hook for one line, this
 *  strips the clause instead, on request: the tavern master says
 *  "Good day." and stops, same as its own greeting screen does. */
const rows = (id, ctx = {}) => macroRows(deps.rows ?? (() => []), id, {
  gold: totalGoldAmount(deps.entity ?? {}),
  playerName: deps.entity?.name ?? '',
  ...ctx,
}).map((r) => (typeof r.text === 'string'
  ? { ...r, text: r.text.replace(/,?\s*%ra\b/, '') }
  : r));

function say(rowList, opts = {}) {
  box = { rows: rowList, buttons: null, ...opts };
  render();
}
/** ClickAnywhereToClose, said once. Every door that dismisses a TEXT
 *  box - the scrim's click on the enhanced skin, the card's OK button,
 *  Escape and Enter - comes here, so the box's `onDismiss` chain
 *  (the Heart's Day line handing over to the price offer) cannot fire
 *  down one path and be forgotten down another. The panel is released
 *  by `render()` below, which is the one place that knows whether a
 *  box is still up. */
function dismiss() {
  const cb = box?.onDismiss;
  box = null;
  cb?.();
  render();
}
function ask(rowList, onYes) {
  box = { rows: rowList, buttons: 'YesNo', onYes };
  render();
}

function close() {
  unregisterOutside();
  onExit();
}

function talk() {
  deps.onTalk?.();
  close();
}

// ── ROOM ────────────────────────────────────────────────────────

function currentRoom() {
  const h = deps;
  const now = h.now();
  h.entity.rentedRooms = removeExpiredRooms(h.entity.rentedRooms ?? [], now, h.sceneCache?.());
  return { room: findRentedRoom(h.entity.rentedRooms, h.mapId(), h.buildingKey()), now };
}

function openRoom() {
  screen = 'room';
  roomDraft = '1';
  render();
}

function submitRoom() {
  const { room, now } = currentRoom();
  const d = rentalDecision(roomDraft, {
    room, nowMinutes: now, date: { dayOfYear: dayOfYearFromMinutes(now) },
    quality: deps.quality?.() ?? 0, free: !!deps.freeRooms?.(), skills: deps.skills?.(),
  });
  if (d.kind === 'ignore') return;   // int.TryParse: nothing at all
  if (d.kind === 'tooMany') { say(rows(TOO_MANY_DAYS_ID, { room, roomHours: room ? roomRemainingHours(room, now) : null })); return; }
  if (d.kind === 'free') {
    rent(room, d.days);
    say(line(ROOM_FREE_FOR_KNIGHT));
    return;
  }
  const offerRows = [
    ...rows(OFFER_PRICE_ID, { amount: d.price, roomHours: room ? roomRemainingHours(room, now) : null }),
    ...realTimeRows(room, d.days, now),
  ];
  const raise = () => ask(offerRows, () => confirmRoom(room, d));
  if (d.heartsDay) { say(line(ROOM_FREE_HEARTS_DAY), { onDismiss: raise }); return; }
  raise();
}

function realTimeRows(room, days, now) {
  const expiry = (room ? room.expiryMinutes : now) + 24 * 60 * days;
  const t = deps.realTimeOf?.(expiry);
  return t ? [{ text: `The room is yours until ${t} by your clock - the world's time runs while you are away.`, center: true }] : [];
}

function confirmRoom(room, d) {
  if (totalGoldAmount(deps.entity) < d.price) { say(rows(NOT_ENOUGH_GOLD_ID, { amount: d.price })); return; }
  deductGold(deps.entity, d.price);
  rent(room, d.days);
  screen = 'main';
  render();
}

function rent(room, days) {
  const h = deps;
  h.entity.rentedRooms = h.entity.rentedRooms ?? [];
  rentRoom(h.entity.rentedRooms, {
    room, days, nowMinutes: h.now(),
    mapId: h.mapId(), buildingKey: h.buildingKey(),
    name: h.buildingName?.() ?? '', bedCount: h.bedCount?.() ?? 1,
    rolls: h.rolls ?? Math.random,
    sceneCache: h.sceneCache?.() ?? null,
  });
}

// ── FOOD & DRINK ──────────────────────────────────────────────────

function openFood() {
  const h = deps;
  if (survivalOn() && typeof h.climateIndex === 'function') { openSurvivalMenu(); return; }
  const now = h.now();
  if (!canEat(h.entity.lastTimePlayerAteOrDrankAtTavern, now)) { say(line(YOU_ARE_NOT_HUNGRY)); return; }
  menu = {
    rows: TAVERN_MENU.map((text, i) => ({ name: text.replace(/\s*\([^)]*\)\s*$/, ''), price: TAVERN_PRICES[i] })),
    pick: (i) => pickClassic(i, now),
  };
  render();
}

function pickClassic(i, now) {
  audio.playOneShot(SOUND.ButtonClick, 1);
  const h = deps;
  const r = eatOrDrink(i, { gold: totalGoldAmount(h.entity), gameMinutes: now });
  if (r.kind === 'ignore') return;
  menu = null;
  if (r.kind === 'poor') { say(rows(NOT_ENOUGH_GOLD_ID)); return; }
  if (r.spend) deductGold(h.entity, r.spend);
  h.heal?.(r.heal);
  h.entity.lastTimePlayerAteOrDrankAtTavern = now;
  render();   // DFU shows nothing at all on a meal - back to the panel, silently
}

function openSurvivalMenu() {
  const h = deps;
  const now = h.now();
  const m = tavernMenu({ climateIndex: h.climateIndex(), quality: h.quality?.() ?? 5, hour: Math.trunc((now % 1440) / 60) });
  if (m.closed) { say(line(m.closedText)); return; }
  menu = { rows: m.rows, pick: (i) => pickSurvival(m.rows[i], now) };
  render();
}

function pickSurvival(row, now) {
  if (!row || row.kind === 'header') return;
  audio.playOneShot(SOUND.ButtonClick, 1);
  const h = deps;
  if (totalGoldAmount(h.entity) < row.price) { say(rows(NOT_ENOUGH_GOLD_ID)); return; }
  deductGold(h.entity, row.price);
  const s = survivalOf(h.entity, now);
  const endurance = h.endurance?.() ?? 50;
  const r = row.kind === 'food' ? tavernEat(s, now, row.worth) : tavernDrink(s, row.strength, { endurance });
  h.advanceMinutes?.(r.minutes);
  h.entity.lastTimePlayerAteOrDrankAtTavern = now;
  if (r.blackout) {
    const b = blackout(s, now + r.minutes, { endurance });
    stiffen(h.entity, now + r.minutes + b.minutes);
    h.advanceMinutes?.(b.minutes);
  }
  menu = null;
  say(line(r.text));
}

// ── RENDER ────────────────────────────────────────────────────────

function mainButtons() {
  const wrap = el('div', 'tavern-menu-acts');
  wrap.append(el('p', 'px-note tavern-greeting', greeting()));
  const room = el('button', 'act tavern-act', 'Rent a room');
  room.onclick = openRoom;
  const talkBtn = el('button', 'act tavern-act', 'Talk');
  talkBtn.onclick = talk;
  const food = el('button', 'act tavern-act', 'Food & drink');
  food.onclick = openFood;
  const exit = el('button', 'act tavern-act', 'Leave');
  exit.onclick = close;
  wrap.append(room, talkBtn, food, exit);
  return wrap;
}

/** A short greeting line under the title - an original addition (DFU's
 *  own panel carries no innkeeper line at all, just the four buttons)
 *  rather than a borrowed piece of law, so it stays out of
 *  systems/tavern.js and lives beside the one other place this port
 *  invents flavour text (systems/gravestoneLore.js). Named after
 *  whichever room the player is already standing in, the one thing
 *  about this tavern that is actually true of it. */
function greeting() {
  const name = deps.buildingName?.() || 'the tavern';
  const { room } = currentRoom();
  return room
    ? `Welcome back to ${name}. Your room is still yours.`
    : `Welcome to ${name}. What can I get you?`;
}

function roomForm() {
  const wrap = el('div', 'tavern-room');
  const { room, now } = currentRoom();
  wrap.append(el('p', 'px-note', (rows(room ? HOW_MANY_ADDITIONAL_DAYS_ID : HOW_MANY_DAYS_ID,
    { roomHours: room ? roomRemainingHours(room, now) : null })[0]?.text) ?? 'How many days?'));
  const form = el('form', 'goldfield');
  const input = el('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.maxLength = 3;
  input.value = roomDraft;
  input.setAttribute('aria-label', 'How many days');
  input.oninput = () => { roomDraft = input.value; };
  form.append(input);
  const go = el('button', 'act primary', 'Rent');
  go.type = 'submit';
  form.onsubmit = (e) => { e.preventDefault(); submitRoom(); };
  form.append(go);
  wrap.append(form);
  const back = el('button', 'act', 'Back');
  back.onclick = () => { screen = 'main'; render(); };
  wrap.append(back);
  return wrap;
}

function foodMenu() {
  const wrap = el('div', 'packcol tavern-menu');
  const list = el('div', 'tavern-menu-list');
  menu.rows.forEach((r, i) => {
    if (r.kind === 'header') { list.append(el('p', 'tavern-menu-header', r.text)); return; }
    const row = el('button', 'itemrow tavern-row');
    row.append(el('span', 'itemname', r.name));
    row.append(el('span', 'itemwt tavern-price', `${r.price} gp`));
    row.onclick = () => menu.pick(i);
    list.append(row);
  });
  wrap.append(list);
  const back = el('button', 'act', 'Back');
  back.onclick = () => { menu = null; render(); };
  wrap.append(back);
  return wrap;
}

function boxScrim() {
  // ENH-NOTICE3 - WHICH OF THIS WINDOW'S BOXES IS A NOTICE, decided off
  // DaggerfallTavernWindow.cs box by box. A `DaggerfallUI.MessageBox`
  // is ClickAnywhereToClose by construction (DaggerfallUI.cs:1337-1365,
  // every overload sets it) and therefore the panel's:
  //
  //   - tooManyDaysFutureId            (:190)       -> panel
  //   - "roomFreeForKnightSuchAsYou"   (:194)       -> panel
  //   - "roomFreeDueToHeartsDay"       (FormulaHelper.cs:1872) -> panel
  //   - notEnoughGoldId, after the Yes (:224)       -> panel
  //   - "youAreNotHungry"              (:301)       -> panel
  //   - notEnoughGoldId, on a meal     (:326)       -> panel
  //   - the survival menu's closed line and its eat/drink report
  //     (Climates & Calories, systems/survival/tavernMenu.js) -> panel,
  //     which is ENH-NOTICE3's whole point: "All mods, including
  //     climates and calories".
  //
  // The two that are NOT notices keep the card, because they are
  // DECISIONS and a decision needs its controls under the words:
  //
  //   - the offerPriceId box with Yes/No (:202-207) -> the card
  //   - howManyDays / howManyAdditionalDays, which is a
  //     DaggerfallInputMessageBox with a numeric TextBox (:161-170) ->
  //     `roomForm()` above, never this scrim at all.
  //
  // `box.buttons` is exactly that division as this window already
  // carries it, so the test is the division rather than a second list.
  const onPanel = noticeHold(noticeOwner, box.buttons ? null : box.rows);
  const scrim = el('div', 'sb-ask');
  if (onPanel) {
    // THE SCRIM IS THE CLICK, and nothing else. With the words on the
    // panel the card has nothing to hold, so the dimming scrim over the
    // disabled panel becomes the invisible click-catcher - which is a
    // truer ClickAnywhereToClose than the OK button it replaces, since
    // DFU's parchment takes the press anywhere on the screen. The
    // keyboard's half (Escape / Enter, `onKey` below) is unchanged.
    scrim.onclick = dismiss;
    return scrim;
  }
  const ask2 = el('div', 'card');
  for (const r of box.rows) ask2.append(el('p', 'px-note', r.text));
  const acts = el('div', 'sb-acts');
  if (box.buttons === 'YesNo') {
    const yes = el('button', 'act primary', 'Yes');
    yes.onclick = () => { const cb = box.onYes; box = null; cb?.(); render(); };
    const no = el('button', 'act', 'No');
    no.onclick = () => { box = null; render(); };
    acts.append(yes, no);
  } else {
    const ok = el('button', 'act primary', 'OK');
    ok.onclick = dismiss;
    acts.append(ok);
  }
  ask2.append(acts);
  scrim.append(ask2);
  return scrim;
}

function render() {
  if (!host) return;
  host.innerHTML = '';
  const shell = el('div', 'px-home px-over tavern-shell');
  const win = el('div', 'px-win tavern-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const head = el('header', 'sb-top');
  const who = el('div', 'sb-who');
  who.append(el('h2', null, deps.buildingName?.() || 'The Tavern'));
  head.append(el('span', 'sb-spacer'), who);
  win.append(head);

  const body = el('div', 'px-body');
  if (menu) body.append(foodMenu());
  else if (screen === 'room') body.append(roomForm());
  else body.append(mainButtons());
  win.append(body);

  if (box) {
    for (const b of win.querySelectorAll('button, input')) b.disabled = true;
    win.append(boxScrim());
  } else noticeRelease(noticeOwner);   // ENH-NOTICE3: no box, no panel - the same `} else noticeRelease(this)` the classic windows keep (ui/restWindow.js:868)
  shell.append(win);
  host.append(shell);
  unregisterOutside();
  unregisterOutside = closeOnOutsideTap(shell, '.px-win', () => { if (!box) close(); });
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (box) {
    if (box.buttons === 'YesNo') {
      if (e.code === 'KeyY') { e.preventDefault(); const cb = box.onYes; box = null; cb?.(); render(); }
      else if (e.code === 'KeyN' || overlayAction(e) === 'back') { e.preventDefault(); box = null; render(); }
    } else if (overlayAction(e) === 'back' || e.key === 'Enter') {
      e.preventDefault();
      dismiss();
    }
    return;
  }
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.isContentEditable)) return;
  if (overlayAction(e) === 'back') {
    e.preventDefault();
    if (menu) { menu = null; render(); }
    else if (screen === 'room') { screen = 'main'; render(); }
    else close();
  }
}

/** Mounts the enhanced tavern panel. `hooks` is tavernWindow.js's own
 *  hooks bag (see the doc comment above `TavernWindow`). */
export function mountEnhancedTavern(hostEl, hooks = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  deps = hooks;
  onExit = hooks.onExit ?? (() => {});
  screen = 'main';
  roomDraft = '1';
  box = null;
  menu = null;
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
      // ENH-NOTICE3 / EVERY ALLOCATION HAS AN OWNER: a held panel has no
      // watchdog, so the window going away without this leaves the
      // notice painted over the world for the rest of the session. The
      // release is here rather than only in `close()` because the door
      // can unmount this pane without any of its own buttons being
      // pressed (a scene change, the overlay slot taken).
      noticeRelease(noticeOwner);
      host = null;
      deps = {};
      box = null;
      menu = null;
    },
  };
}
