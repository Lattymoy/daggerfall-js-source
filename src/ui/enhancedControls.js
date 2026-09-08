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
//  - LEFT CLICK a binding arms capture; the NEXT keydown binds.
//    ReservedKeys is empty in DFU (DaggerfallControlsWindow.cs:73), so
//    EVERY key binds — Escape included, which is why the shell's own
//    Escape handler stands down while a capture is armed (see
//    captureArmed() and ui/enhancedMenu.js's onKey).
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
// preventDefault()s and stopPropagation()s what it takes, so the
// hosts' own keydown ladders (scenes/world.js, exterior.js,
// worldModes.js — all bubble-phase listeners on the global) never see
// the key being bound. It is removed the instant the key lands, and
// again if the pane is left while still armed: a window-level listener
// that outlives its screen is the bug ui/enhancedMenu.js's own unmount
// note is about.
//
// AND THE CAPTURE TARGET IS A <button>, NEVER AN <input>. ui/input.js
// isTextEntryTarget answers on INPUT/TEXTAREA/contentEditable (CG2);
// a text field here would make every host's router treat the pane as
// a typing surface.

import { ACTIONS, saveKeyBinds } from '../systems/inputActions.js';
import { bindings } from './input.js';
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
let armedHandler = null;   // the document listener while it waits
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
  }
  armedHandler = null;
  armed = null;
}

/** WaitForKeyPress (:380-424). The next keydown binds, whatever it is. */
function onCaptureKey(e) {
  // The host's ladder must never see a key that was being BOUND: the
  // four scene hosts listen on the global in the bubble phase, so a
  // capture-phase stop here is the whole of that guard.
  e.preventDefault?.();
  e.stopPropagation?.();
  const action = armed;
  disarm();
  if (!action) return;
  // The combo arm: a captured key held under Ctrl/Shift/Alt binds the
  // pair, anything else binds the single code.
  const combo = comboFromEvent(e.code, e);
  setUnsavedBinding(stage(), action, combo ?? e.code);
  notice = null;
  refresh();
  repaint();
}

function arm(action) {
  disarm();                      // one capture at a time
  armed = action;
  notice = null;
  if (typeof document !== 'undefined') {
    armedHandler = onCaptureKey;
    document.addEventListener('keydown', armedHandler, { capture: true });
  }
  repaint();
}

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
    armedHere ? 'PRESS A KEY' : buttonText(code, true));
  key.setAttribute('type', 'button');
  key.dataset.action = action;   // the probe's handle, and the test's
  key.onclick = () => arm(action);
  key.oncontextmenu = (e) => { e?.preventDefault?.(); promptRemove(action); return false; };
  ctl.append(key);

  const clear = el('button', 'act ctl-clear', '✕');
  clear.setAttribute('type', 'button');
  clear.title = 'Remove this binding';
  clear.onclick = () => promptRemove(action);
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
  which.onclick = switchDict;
  const defaults = el('button', 'act ctl-defaults', 'Defaults');
  defaults.onclick = () => { prompt = { kind: 'defaults' }; repaint(); };
  const cont = el('button', 'act primary ctl-continue', 'Continue');
  cont.onclick = applyAndSave;
  acts.append(which, defaults, cont);
  head.append(acts);

  if (notice) head.append(el('p', `ctl-notice${notice === MULTIPLE_ASSIGNMENTS ? ' bad' : ''}`, notice));
  if (!dupes.ok && notice !== MULTIPLE_ASSIGNMENTS) {
    head.append(el('p', 'ctl-notice bad', MULTIPLE_ASSIGNMENTS));
  }
  body.append(head);

  group(body, 'Actions', GRID_ACTIONS.map((a) => [a, splitCamel(a)]));
  group(body, 'Advanced', ADVANCED_ROWS.map((r) => [r.action, r.label]));
}
