// ENH-NOTICE3 (2026-09-21, Mac: "the new enhanced pop up system isn't
// working for everything. All mods, including climates and calories
// need to utilize the enhanced notification popup. This needs a proper
// detailed audit, maybe a refactor"): THE ONE DOOR EVERY MESSAGE GOES
// THROUGH.
//
// WHAT THE AUDIT FOUND. ENH-NOTICE1/2 gave the enhanced skin its face
// (ui/enhancedNotice.js) and hooked it where the parchment was DRAWN:
// ActionTextBox, the no-options ChoiceWindow, eight windows' own
// boxes. Nothing made a producer BUILD one of those. Six host seams
// each decided by hand which class to raise; one of them
// (world.js's Travel Options wiring) handed the mod's
// DaggerfallUI.MessageBox lines to the HUD line instead; three
// DOM-native windows (the tavern, the inventory, the held map) grew
// their own notice cards; and the HUD-text kind - PopupText, the
// top-of-screen lines that Climates & Calories, Ambient Text and the
// torches speak through - had a column of its own. Four faces, no
// funnel.
//
// DFU HAS ONE. Every message in the reference goes through a static
// door on DaggerfallUI: MessageBox (DaggerfallUI.cs:1328/:1337/:1346/
// :1355 - four overloads, all built on `Instance.uiManager.TopWindow`,
// ClickAnywhereToClose set, Show()), AddHUDText (:759/:767/:775 ->
// PopupText.AddText), PopupMessage (:820-824, the same PopupText). A
// producer - the game's or a mod's - names the KIND and never the
// window. This module is that door for the BOX kind, and the ladder
// (`mountWindow`) for any window a host wants on the live slot. The
// HUD-text kind has a door here too (`hudText`, `popupMessage`), but
// AUDIT ENH-NOTICE3 F4 records the truth of the tree: no shipping
// producer walks through it yet - the hosts' own `say`/`hudSay` deps
// are still what AddHUDText's callers hold, and this door is what a
// producer WITHOUT a host handle would use, and what the fallback
// below lands on. SetMidScreenText stays ui/midScreenText.js's.
//
// THE LAW: notify decides WHICH MODEL; the draw decides WHICH FACE.
// This module does not import ui/uiSkin.js and never will: the skin
// fork lives where the enhanced idiom already put it - the box's own
// draw (ui/actionText.js), the HUD text's own draw (ui/hudText.js),
// the label's (ui/midScreenText.js). A second fork here would be a
// second home for the skin decision, and the faces would drift.
//
// THE SLOT. The port's hosts hold ONE overlay slot each and no window
// stack, so a box must reach the LIVE host's slot without every
// producer carrying a host handle. Hosts register a PRESENTER here
// (the registry idiom ui/enhancedOverlays.js already uses: functions,
// never DOM; an unregister the teardown MUST call), and a box is
// offered to the presenters by priority then by recency - the modal
// mode host before the town host, which is world.js's showQuestBox
// ladder written once instead of by hand. A presenter that REFUSES
// (its slot is taken and it does not push) passes the box on.
//
// FALLBACK, NOT SILENCE. A box with no presenter must not vanish - a
// dropped box is the failure showQuestBox was written to fix ("the
// first ten minutes of a new game were silent"). It lands on the HUD
// line, and the handle answers INERT - `mounted` false, `addNext` a
// no-op, `done` true - so a caller that cares can tell and a caller
// that chains without looking cannot throw.

import { ActionTextBox } from '../ui/actionText.js';

/**
 * @typedef {object} Presenter
 * @property {(win: object, opts: { push: boolean }) => boolean} [mount]
 *   Take the window into this host's slot. True when taken; false to pass it on
 *   (the slot is held and this host does not push). No close callback rides
 *   through: two of the three hosts' doors (the interior mount, the dungeon
 *   push) have none, and a contract one host honours and two drop is a lie
 *   (AUDIT ENH-NOTICE3 F6) - a caller that needs OnClose owns its window.
 * @property {(text: string, delay?: number) => boolean} [hudText]
 *   This host's PopupText model (ui/hudText.js - two are live at once, the town's
 *   and the dungeon's; AUDIT FONT F1 keys them). True when queued.
 * @property {() => boolean} [active]  false while the host is torn down or dormant
 * @property {number} [priority]       higher is asked first; ties go to the latest registered
 */

/** @type {Array<Presenter>} */
const presenters = [];

/** A host offers its slot. Returns the unregister its teardown must call.
 *  Not an object: nothing registered, a no-op unregister - `order()`
 *  reads `p.active?.()` and a stray null would throw the door down. */
export function registerPresenter(p) {
  if (!p || typeof p !== 'object') return () => {};
  presenters.push(p);
  return () => { const i = presenters.indexOf(p); if (i >= 0) presenters.splice(i, 1); };
}

/** The presenters in the order they are asked: priority, then recency. */
function order() {
  return presenters
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.active?.() !== false)
    .sort((a, b) => ((b.p.priority ?? 0) - (a.p.priority ?? 0)) || (b.i - a.i))
    .map(({ p }) => p);
}

/** For a probe: how many presenters stand, and their priorities in asking order. */
export const notifyPresenters = () => order().map((p) => p.priority ?? 0);

/** Tests: drop every presenter at once. */
export function _resetNotifyForTests() { presenters.length = 0; }

/** A message as rows: a string is one row (SetText's one Text token,
 *  DaggerfallMessageBox.cs:405-408, split on newlines the way the
 *  hosts already split a mod's multi-line message); an array is rows
 *  as given - strings, { text, center, highlight } records, or AUDIT 64
 *  F28's tab-stopped { cells } rows. */
export function toRows(text) {
  if (Array.isArray(text)) return text.length ? text : [''];
  if (text == null) return [''];
  return String(text).split('\n');
}

/**
 * THE LADDER on its own: a window - any window, a box the door minted
 * or a buttoned one a host built (world.js's quest ServiceFlowWindow)
 * - offered to the live presenters in asking order. True when a host
 * took it. AUDIT ENH-NOTICE3 F5: the showQuestBox ladder was written
 * here and then twice more by hand in the outer hosts; this is the
 * one home, so a fourth presenter is seen by every window at once.
 * @param {object} win  @param {{ push?: boolean }} [opts]
 */
export function mountWindow(win, { push = true } = {}) {
  if (!win) return false;
  for (const p of order()) {
    if (typeof p.mount !== 'function') continue;   // a host with a PopupText and no slot passes the window on
    if (p.mount(win, { push: !!push })) return true;
  }
  return false;
}

/**
 * @typedef {object} MessageBoxHandle
 * @property {(rows: any) => MessageBoxHandle} addNext  DaggerfallMessageBox.AddNextMessageBox: dismissing this box shows the next rows in its place
 * @property {boolean} done
 * @property {boolean} mounted  false when no presenter took it (the rows went to the HUD line)
 * @property {object|null} window  the ActionTextBox, for a host that draws it itself; null when not mounted
 */

/**
 * DaggerfallUI.MessageBox, the four overloads collapsed: a
 * ClickAnywhereToClose box with these rows, on whichever host's slot
 * is live. On the enhanced skin the box's own draw is the notice
 * panel; on the classic skin it is the SPOP.RCI parchment. Neither is
 * decided here.
 *
 * @param {string|any[]} text
 * @param {object} [opts]
 * @param {number[]} [opts.highlightColor]   SetHighlightColor (DaggerfallMessageBox.cs:455-458)
 * @param {boolean} [opts.previousWindow]    DaggerfallPopupWindow.previousWindow (:24, :56-59): the HUD stays painted under the box; false is DaggerfallAction's null (Internal/DaggerfallAction.cs:536)
 * @param {boolean} [opts.push]              PushWindow over the open window (UserInterfaceManager.cs:79-91), which is what every DaggerfallUI.MessageBox does (ROAD-B B5's law); false is CloseWindow-then-Push, for a caller that means to dispatch the window it stands in
 * @returns {MessageBoxHandle}               `mounted` false when no presenter took it (it went to the HUD line); the chain is then a no-op, never a throw (AUDIT ENH-NOTICE3 F7 - the status chains call addNext without looking)
 */
export function messageBox(text, { highlightColor = undefined, previousWindow = true, push = true } = {}) {
  const rows = toRows(text);
  const win = new ActionTextBox(rows, { highlightColor, previousWindow });
  const handle = {
    addNext(next) { win.addNext(toRows(next)); return handle; },
    get done() { return win.done; },
    mounted: true,
    window: win,
  };
  if (mountWindow(win, { push })) return handle;
  hudText(rows.map(rowText).join(' '));
  const inert = { addNext: () => inert, done: true, mounted: false, window: null };
  return inert;
}

/** A row's words, for the fallback line. */
function rowText(r) {
  if (typeof r === 'string') return r;
  if (Array.isArray(r?.cells)) return r.cells.map((c) => c?.text ?? '').join('  ');
  return r?.text ?? '';
}

/**
 * DaggerfallUI.AddHUDText (:759/:767/:775) - PopupText.AddText on the
 * live host's model. The delay is the row's own life
 * (PopupText.popDelay; AUDIT 28 W6 rides a mod's textDisplayTime
 * through). True when a host queued it.
 * @param {string} text  @param {number} [delay]
 */
export function hudText(text, delay = undefined) {
  for (const p of order()) {
    if (typeof p.hudText !== 'function') continue;
    if (p.hudText(String(text ?? ''), delay)) return true;
  }
  return false;
}

/** DaggerfallUI.Instance.PopupMessage (:820-824): the same PopupText,
 *  kept as its own name because the reference calls both in
 *  consecutive lines (PlayerActivate.cs:527-529). */
export const popupMessage = (text) => hudText(text);
