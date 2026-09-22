// FIX-F (Mac: "changing keybinds in classic/enhanced do not work") —
// THE ENHANCED SKIN'S REBINDING PANE.
//
// The bug was not that rebinding was broken. It was that the DEFAULT
// skin had no door to it at all: the only rebinding UI in the port is
// the classic canvas grid (ui/controlsWindow.js on CNFG00I0.IMG),
// reachable only from the classic pause window's `openControls`
// (ui/pauseWindow.js). A player on the enhanced skin — which is the
// default (systems/uiSkin.js) — pressed Escape, met Resume / Save /
// Load / Settings / Mods / About / Exit, and there was nowhere to go.
//
// SO THIS IS A SECOND FACE, NOT A SECOND LAW. Every rule below is
// ControlsConfigManager's, driven through the same two modules the
// classic grid drives:
//
//   systems/controlsConfig.js — the STAGING law. createUnsavedKeybinds
//     copies both live dicts, setUnsavedBinding writes only to the
//     copy, checkDuplicates reports the two kinds of clash and whether
//     the window may close, applyUnsavedKeybinds is SetAllKeyBindValues
//     and resetUnsavedToDefaults is the registry's own reset.
//   systems/inputActions.js — the registry itself, plus saveKeyBinds.
//
// Nothing here decides anything about keys. If the classic grid and
// this pane ever disagree it is because one of them stopped calling
// these functions, which is what test/enhancedControls.test.js holds.
//
// THE GESTURES, mirrored from ui/controlsWindow.js:
//  - LEFT CLICK a binding arms capture; the NEXT keydown OR MOUSE
//    BUTTON binds.
//    ReservedKeys is empty in DFU (InputManager.cs:73
//    `new KeyCode[] { }`, exposed :174-177), so the capture gate that
//    consults it (DaggerfallControlsWindow.cs:410) never refuses a key —
//    Escape included, which is why the shell's own Escape handler stands
//    down while armed (captureArmed(), ui/enhancedMenu.js's onKey).
//  - a key pressed under Ctrl/Shift/Alt binds the COMBO, through the
//    grid's own comboFromEvent — the port's narrowing of DFU's
//    two-key gesture onto the event's three virtual flags.
//  - RIGHT CLICK, or the row's ✕, prompts to remove the binding
//    (PromptRemoveKeybindMessage :290-320), and refuses on a slot that
//    is already unbound exactly as DFU's does (:292).
//  - DEFAULTS confirms, then resets the LIVE registry and re-stages.
//  - DUPLICATES colour the binding — red inside the shown dict, blue
//    across the two — and EITHER kind blocks CONTINUE with the classic
//    window's own multipleAssignments line.
//  - CONTINUE on a clean set applies the staged dicts and saves.
//  - LEAVING WITHOUT CONTINUE DISCARDS. That is the whole point of a
//    staged copy, and the shell calls discardControlsStaging() on
//    every navigation away and on unmount.
//
// THE CAPTURE LISTENER IS THE PART A BROWSER GETS WRONG. It is a
// `keydown` on the DOCUMENT with `{ capture: true }`, and it
// preventDefault()s and stopPropagation()s what it takes, so the hosts'
// own keydown ladders (scenes/world.js, exterior.js, worldModes.js —
// all bubble-phase listeners on the global) never see the key being
// bound. It is removed the instant the key lands, and again if the pane
// is left while still armed: a window-level listener that outlives its
// screen is the bug ui/enhancedMenu.js's own unmount note is about.
//
// AND THE CAPTURE TARGET IS A <button>, NEVER AN <input>. ui/input.js
// isTextEntryTarget answers on INPUT/TEXTAREA/contentEditable (CG2);
// a text field here would make every host's router treat the pane as
// a typing surface.

import { ACTIONS, saveKeyBinds } from '../systems/inputActions.js';
import { bindings, mouseCode } from './input.js';   // MAC-K1: a mouse button is a binding, so the capture must be able to take one
import {
  createUnsavedKeybinds, currentDict, setUnsavedBinding, checkDuplicates,
  applyUnsavedKeybinds, resetUnsavedToDefaults, buttonText, splitCamel,
  comboFromEvent, removeKeybindPromptRows,
} from '../systems/controlsConfig.js';

/** The shell's own `el`, three lines, kept LOCAL on purpose:
 *  ui/enhancedMenu.js imports this module, so importing its helper
 *  back would make the pair a cycle for the sake of a closure. */
const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

/** The grid's own coverage: ui/controlsWindow.js's KEY_GROUPS run
 *  Actions[2..40), which is DFU's SetupKeybindButtons (:146-152).
 *  Escape and ToggleConsole sit before it, QuickSave/QuickLoad/
 *  PrintScreen/AutoRun past its end — DFU's quirk, and the reason
 *  those six live in the ADVANCED window instead. */
export const GRID_ACTIONS = Object.freeze(ACTIONS.slice(2, 40));

/** The six the ADVANCED popup edits, with the Internal_Settings face
 *  each wears there — ui/mouseControlsWindow.js's KEYBIND_ROWS
 *  (:157-164), in its order. Restated rather than imported: that
 *  module is the classic canvas window, 600 lines of nativePanel
 *  drawing, and the enhanced skin must not pull it in to name six
 *  strings. test/enhancedControls.test.js pins the two against each
 *  other so the restatement cannot drift. */
export const ADVANCED_ROWS = Object.freeze([
  Object.freeze({ action: 'Escape', label: 'Escape' }),
  Object.freeze({ action: 'AutoRun', label: 'AutoRun' }),
  Object.freeze({ action: 'ToggleConsole', label: 'Console' }),
  Object.freeze({ action: 'PrintScreen', label: 'Screenshot' }),
  Object.freeze({ action: 'QuickSave', label: 'QuickSave' }),
  Object.freeze({ action: 'QuickLoad', label: 'QuickLoad' }),
]);

/** SOC5 (2026-09-16, Mac: "Players should be able to interact with others in
 *  the world upon encountering them by pressing F on their body"): A THIRD
 *  GROUP, because the first two are both SOMEONE ELSE'S LIST and this row
 *  belongs to neither.
 *
 *  GRID_ACTIONS is `Actions[2..40)` - DFU's SetupKeybindButtons, the classic
 *  window's thirty-eight fixed buttons - and widening that slice would claim
 *  the classic grid draws a thirty-ninth, which its art cannot (see
 *  ui/controlsWindow.js KEY_GROUPS). ADVANCED_ROWS is
 *  ui/mouseControlsWindow.js's KEYBIND_ROWS restated, and
 *  test/enhancedControls.test.js pins the two against each other row for row,
 *  so a seventh entry here would be a claim the classic ADVANCED popup edits
 *  something it has never heard of.
 *
 *  So the port's own actions get their own heading. Today it is one row. The
 *  pane's coverage rule - every bindable action has a row, none twice - is what
 *  makes this a requirement rather than a preference. */
const ONLINE_ROWS = Object.freeze([
  Object.freeze({ action: 'SocialInteract', label: 'Interact with player' }),
]);
/** QS2 (2026-09-17, Mac's quickslot diamond): A FOURTH GROUP, and the reason is
 *  the heading rather than the list. 'Online' is a true word for the F-menu and
 *  a false one for a potion press: a player scanning for "how do I drink the
 *  thing in slot one" would never look under it, and a group whose title does
 *  not describe its rows is worse than no group at all. So the port's rows are
 *  a LIST OF GROUPS now - one heading per kind of departure - and PORT_ROWS
 *  stays the flat union of them, because the pane's coverage rule (every
 *  bindable action has a row, none twice) is asked of the union. */
const QUICKSLOT_ROWS = Object.freeze([
  Object.freeze({ action: 'QuickUse1', label: 'Use quickslot 1' }),
  Object.freeze({ action: 'QuickUse2', label: 'Use quickslot 2' }),
  // QS6: the SPELL slot, beside the two consumables it behaves like -
  // a tap readies, a hold cycles the book.
  Object.freeze({ action: 'QuickSpell', label: 'Ready quickslot spell' }),
  // QS6: the swap keeps its row and its rebind; what it lost is the
  // default key, so a player who wants one of their own comes here.
  Object.freeze({ action: 'QuickSwap', label: 'Swap weapon' }),
  Object.freeze({ action: 'QuickOffHand', label: 'Off hand: light, douse or swap' }),
]);
/** The heading the third group wears. Its own constant so the pin names it. */
export const PORT_GROUP_TITLE = 'Online';
/** QS2's own, the same way. */
export const QUICKSLOT_GROUP_TITLE = 'Quickslots';
/** QUICK-LOOT B4: ...and the plaque's two, under their own heading for
 *  the same reason the two above have theirs - the CLASSIC windows
 *  cannot draw a row DFU never had, so a clash against one of these is
 *  a clash a classic player can neither see nor clear. */
export const QUICKLOOT_GROUP_TITLE = 'Quick loot';
const QUICKLOOT_ROWS = Object.freeze([
  Object.freeze({ action: 'QuickLootAll', label: 'Take everything' }),
  Object.freeze({ action: 'QuickLootOpen', label: 'Open the container' }),
]);
/** The port's own headings, in the order the pane draws them. */
export const PORT_GROUPS = Object.freeze([
  Object.freeze({ title: PORT_GROUP_TITLE, rows: ONLINE_ROWS }),
  Object.freeze({ title: QUICKSLOT_GROUP_TITLE, rows: QUICKSLOT_ROWS }),
  Object.freeze({ title: QUICKLOOT_GROUP_TITLE, rows: QUICKLOOT_ROWS }),
]);
/** Every port row, flat: the coverage rule's half of the answer. */
export const PORT_ROWS = Object.freeze([...ONLINE_ROWS, ...QUICKSLOT_ROWS, ...QUICKLOOT_ROWS]);

/** ShowMultipleAssignmentsMessage's line, the string the classic grid
 *  draws (ui/controlsWindow.js's `top === 'dupes'` row). The same
 *  words, because it is the same refusal. */
export const MULTIPLE_ASSIGNMENTS = 'You have multiple assignments...';
/** ConfirmDefaultsBox (:296-317). */
export const DEFAULTS_PROMPT = 'Are you sure you want to set default controls?';

// ── PER-VISIT STATE ──────────────────────────────────────────────
// `unsaved` is the staged pair of dicts. It is created on the first
// paint of the pane and DESTROYED on the way out, which is what makes
// leaving-without-CONTINUE a discard rather than a save.
let unsaved = null;
let dupes = { internal: new Set(), cross: new Set(), ok: true };
let armed = null;          // the action awaiting a key (:52 waitingForInput)
let armedHandler = null;   // the document keydown listener while it waits
let armedMouse = null;     // MAC-K1: and its mouse half - one arm, two doors
let prompt = null;         // { kind: 'defaults' } | { kind: 'remove', action }
let notice = null;         // the multipleAssignments line, or the saved note
let repaint = () => {};

const refresh = () => { dupes = checkDuplicates(unsaved); };

function stage() {
  if (!unsaved) {
    unsaved = createUnsavedKeybinds(bindings());
    refresh();
  }
  return unsaved;
}

/** The staged dicts, for tests and for nothing else. */
export const controlsStaging = () => unsaved;
/** The duplicate report the pane is currently painting. */
export const controlsDuplicates = () => dupes;

/** WHICH ACTION IS WAITING FOR A KEY, and why anyone outside asks:
 *  ui/enhancedMenu.js's Escape handler is a CAPTURE listener on the
 *  global, so it runs BEFORE this module's document listener and would
 *  eat the one key DFU is most careful to let through. It stands down
 *  while this answers. */
export const captureArmed = () => armed;

function disarm() {
  if (armedHandler && typeof document !== 'undefined') {
    document.removeEventListener('keydown', armedHandler, { capture: true });
    document.removeEventListener('mousedown', armedMouse, { capture: true });
  }
  armedHandler = null;
  armedMouse = null;
  armed = null;
}

/** The half both capture listeners share: take the code, bind it,
 *  stand down. `e` carries the modifier flags the combo arm reads. */
function bindCaptured(code, e) {
  // The host's ladder must never see a key that was being BOUND: the
  // four scene hosts listen on the global in the bubble phase, so a
  // capture-phase stop here is the whole of that guard.
  e.preventDefault?.();
  e.stopPropagation?.();
  const action = armed;
  disarm();
  if (!action || code == null) return;
  // The combo arm: a captured key held under Ctrl/Shift/Alt binds the
  // pair, anything else binds the single code.
  const combo = comboFromEvent(code, e);
  setUnsavedBinding(stage(), action, combo ?? code);
  notice = null;
  refresh();
  repaint();
}

/** WaitForKeyPress (:380-424). The next keydown binds, whatever it is. */
function onCaptureKey(e) { bindCaptured(e.code, e); }

/**
 * MAC-K1 (Mac: "Mouse keybindings not working properly"), and the
 * half of WaitForKeyPress this pane never had.
 *
 * DFU's capture is `Input.GetKeyDown` walked over EVERY KeyCode, and
 * Mouse0/1/2 are KeyCodes like any other - which is how three of its
 * own defaults come to be mouse buttons (AutoRun, SwingWeapon,
 * ActivateCenterObject). The port's capture listened for `keydown`
 * alone, so no action could ever be MOVED onto a button and one
 * cleared off a button could never be put back. The registry, the
 * storage, the duplicate law and every runtime reader had taken mouse
 * codes since AUDIT 39r; the one door a player uses had not.
 *
 * THE ARMING CLICK IS NOT THE BOUND ONE. `arm()` runs from the row
 * button's `onclick`, which the browser fires after that press has
 * already come and gone, so the listener added here can only ever see
 * the NEXT press. And while a capture is armed the pane is inert
 * (`act()`), exactly as DFU's `waitingForInput` makes it - so a click
 * meant to cancel binds instead, which is the same thing Escape does
 * on the keyboard side and for the same reason: ReservedKeys is empty.
 */
function onCaptureMouse(e) {
  const code = mouseCode(e.button);
  if (code == null) return;      // past the third button: not a binding
  bindCaptured(code, e);
}

function arm(action) {
  disarm();                      // one capture at a time
  armed = action;
  notice = null;
  if (typeof document !== 'undefined') {
    armedHandler = onCaptureKey;
    armedMouse = onCaptureMouse;
    document.addEventListener('keydown', armedHandler, { capture: true });
    document.addEventListener('mousedown', armedMouse, { capture: true });
  }
  repaint();
}

/** WHILE A CAPTURE IS ARMED THE PANE IS INERT.
 *  DaggerfallControlsWindow heads EVERY button handler with
 *  `if (waitingForInput) return;` — Joystick (:281), Mouse (:290),
 *  Defaults (:299), Continue (:321), CurrentBindings (:338), the
 *  keybind button itself (:361) and the right-click remove (:372,
 *  where it is ANDed with the unbound-slot refusal). The pending
 *  capture is the only live gesture on the screen. The classic grid
 *  carries the law in one line (ui/controlsWindow.js:355); this face
 *  carries it as ONE predicate wrapped round every click surface, so
 *  a control cannot be added without it. arm()'s own leading disarm()
 *  is then unreachable-by-click — which is DFU's shape, not a loss. */
const act = (fn) => (...a) => { if (armed) return undefined; return fn(...a); };

/**
 * LEAVING THE PANE. Drops the staged copy, so nothing that was not
 * pushed through CONTINUE reaches the registry, and takes the capture
 * listener with it. The shell calls this from every navigation away
 * and from its unmount.
 */
export function discardControlsStaging() {
  disarm();
  unsaved = null;
  dupes = { internal: new Set(), cross: new Set(), ok: true };
  prompt = null;
  notice = null;
  repaint = () => {};
}

// ── THE ACTS ─────────────────────────────────────────────────────

/** PromptRemoveKeybindMessage (:290-320), including its refusal on a
 *  slot that carries nothing (:292). */
function promptRemove(action) {
  if (currentDict(stage()).get(action) == null) return;
  prompt = { kind: 'remove', action };
  repaint();
}

function answerPrompt(yes) {
  const p = prompt;
  prompt = null;
  if (yes && p?.kind === 'remove') {
    setUnsavedBinding(unsaved, p.action, null);
    refresh();
  } else if (yes && p?.kind === 'defaults') {
    // SetDefaults (:296-317): the LIVE registry's own reset, saved
    // there and then, and a fresh staging copy over it.
    resetUnsavedToDefaults(bindings(), unsaved);
    saveKeyBinds(bindings());
    refresh();
  }
  repaint();
}

/** CONTINUE (:69-79 / OnPop :163-171): refused while EITHER kind of
 *  duplicate stands, and otherwise the apply and the save. */
function applyAndSave() {
  if (!dupes.ok) { notice = MULTIPLE_ASSIGNMENTS; repaint(); return false; }
  applyUnsavedKeybinds(bindings(), unsaved);
  saveKeyBinds(bindings());
  // Re-stage off the registry we just wrote: the pane stays open on
  // the enhanced skin, and a stale copy would let a second CONTINUE
  // re-apply a binding the player has since changed elsewhere.
  unsaved = createUnsavedKeybinds(bindings());
  refresh();
  notice = 'Controls saved.';
  repaint();
  return true;
}

/** The PRIMARY/SECONDARY toggle (:135-141), refused while the SHOWN
 *  dict clashes internally (:337-343). */
function switchDict() {
  if (dupes.internal.size) { notice = MULTIPLE_ASSIGNMENTS; repaint(); return; }
  unsaved.usingPrimary = !unsaved.usingPrimary;
  notice = null;
  refresh();
  repaint();
}

// ── THE PAINT ────────────────────────────────────────────────────

function keyRow(action, label) {
  const dict = currentDict(unsaved);
  const code = dict.get(action);
  const row = el('div', 'row ctl-row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', label));
  row.append(main);

  const ctl = el('div', 'ctl');
  // A BUTTON, never an input (CG2): isTextEntryTarget must stay false
  // over this pane or every host's router reads it as a typing field.
  const dupe = dupes.internal.has(code) ? ' ctl-dupe'
    : dupes.cross.has(code) ? ' ctl-cross' : '';
  const armedHere = armed === action;
  const key = el('button', `act rowact ctl-key${dupe}${armedHere ? ' ctl-arm' : ''}`,
    armedHere ? 'PRESS A KEY OR BUTTON' : buttonText(code, true));
  key.setAttribute('type', 'button');
  key.dataset.action = action;   // the probe's handle, and the test's
  key.onclick = act(() => arm(action));
  key.oncontextmenu = (e) => {
    // The preventDefault stays OUTSIDE the guard: DFU's bare `return`
    // (:372) costs nothing, but a refused right-click here would pop
    // the browser's own context menu over an armed pane.
    e?.preventDefault?.();
    act(() => promptRemove(action))();
    return false;
  };
  ctl.append(key);

  const clear = el('button', 'act ctl-clear', '✕');
  clear.setAttribute('type', 'button');
  clear.title = 'Remove this binding';
  clear.onclick = act(() => promptRemove(action));
  ctl.append(clear);

  row.append(ctl);
  return row;
}

function promptCard() {
  const c = el('div', 'card ctl-prompt');
  c.append(el('h3', null, prompt.kind === 'defaults' ? 'Default controls' : 'Remove keybind'));
  const rows = prompt.kind === 'defaults'
    ? [DEFAULTS_PROMPT]
    : removeKeybindPromptRows(prompt.action, currentDict(unsaved).get(prompt.action));
  for (const line of rows) c.append(el('p', 'meta', line));
  const acts = el('div', 'acts');
  const yes = el('button', 'act primary', 'Yes');
  yes.onclick = () => answerPrompt(true);
  const no = el('button', 'act', 'No');
  no.onclick = () => answerPrompt(false);
  acts.append(yes, no);
  c.append(acts);
  return c;
}

function group(body, heading, rows) {
  const c = el('div', 'card ctl-group');
  c.append(el('h3', null, heading));
  for (const [action, label] of rows) c.append(keyRow(action, label));
  body.append(c);
}

/**
 * THE PANE. `render` is the shell's own repaint — the same one every
 * other enhanced pane closes over — so a bind, a prompt or a clash
 * repaints the whole screen rather than this module reaching into a
 * node it built.
 */
export function paneControls(body, { render = () => {} } = {}) {
  repaint = render;
  stage();

  if (prompt) { body.append(promptCard()); return; }

  const head = el('div', 'card ctl-head');
  head.append(el('h3', null, 'Controls'));
  head.append(el('p', 'meta',
    'Click a binding, then press the key you want. Every key binds, Escape included. '
    + 'Hold Ctrl, Shift or Alt while you press to bind a combination. '
    + 'Right-click a binding, or press ✕, to remove it.'));
  head.append(el('p', 'meta',
    'Nothing is saved until you press Continue. Leave this page and your changes are dropped.'));

  const acts = el('div', 'acts');
  const which = el('button', 'act ctl-which', unsaved.usingPrimary ? 'Primary' : 'Secondary');
  which.title = 'Which of the two binding sets this page edits';
  which.onclick = act(switchDict);
  const defaults = el('button', 'act ctl-defaults', 'Defaults');
  defaults.onclick = act(() => { prompt = { kind: 'defaults' }; repaint(); });
  const cont = el('button', 'act primary ctl-continue', 'Continue');
  cont.onclick = act(applyAndSave);
  acts.append(which, defaults, cont);
  head.append(acts);

  if (notice) head.append(el('p', `ctl-notice${notice === MULTIPLE_ASSIGNMENTS ? ' bad' : ''}`, notice));
  if (!dupes.ok && notice !== MULTIPLE_ASSIGNMENTS) {
    head.append(el('p', 'ctl-notice bad', MULTIPLE_ASSIGNMENTS));
  }
  body.append(head);

  group(body, 'Actions', GRID_ACTIONS.map((a) => [a, splitCamel(a)]));
  group(body, 'Advanced', ADVANCED_ROWS.map((r) => [r.action, r.label]));
  // SOC5: the port's own row. It is drawn LAST because it is the newest law,
  // and because the classic window - which this pane is the skin of - has no
  // place for it at all: the enhanced window is the one door to rebinding F.
  for (const g of PORT_GROUPS) group(body, g.title, g.rows.map((r) => [r.action, r.label]));
}
