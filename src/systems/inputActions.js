// I1 - the input registry: InputManager.cs's binding law, without the
// engine half (mouse smoothing, axes, joystick, combos - see the flags
// at the bottom). This is the LAW module; ui/input.js and the hosts
// consume it (I2), and the settings window's controls section (I3)
// edits through it.
//
// Keys are browser `KeyboardEvent.code` strings ('KeyW', 'F5',
// 'ShiftLeft'), plus 'Mouse0'/'Mouse1'/'Mouse2' for the three buttons
// exactly as Unity's KeyCode names them (left/right/middle). DFU
// serializes KeyCode NAMES into KeyBindings.txt, so the port's stored
// shape is the same idea one alphabet over.

import { appStorage } from './appStorage.js';   // DA1: the storage seam

/** InputManager.Actions (:324-384), names and ORDER verbatim.
 *  'Unknown' (:383) is the parse sentinel, not a bindable action -
 *  parseActionName answers it, the list does not carry it. */
export const ACTIONS = Object.freeze([
  'Escape', 'ToggleConsole',
  'MoveForwards', 'MoveBackwards', 'TurnLeft', 'MoveLeft', 'TurnRight', 'MoveRight',
  'FloatUp', 'FloatDown', 'Jump', 'Crouch', 'Slide', 'Run',
  'Rest', 'Transport', 'StealMode', 'GrabMode', 'InfoMode', 'TalkMode',
  'CastSpell', 'RecastSpell', 'AbortSpell', 'UseMagicItem',
  'ReadyWeapon', 'SwingWeapon', 'SwitchHand',
  'Status', 'CharacterSheet', 'Inventory',
  'ActivateCenterObject', 'ActivateCursor',
  'LookUp', 'LookDown', 'CenterView', 'Sneak',
  'LogBook', 'NoteBook', 'AutoMap', 'TravelMap',
  'QuickSave', 'QuickLoad',
  'PrintScreen',
  'AutoRun',
]);

const ACTION_SET = new Set(ACTIONS);

/** ActionNameToEnum: an unrecognized name parses to Unknown, never
 *  throws - that is what lets a newer build's saved file load. */
export const parseActionName = (name) => (ACTION_SET.has(name) ? name : 'Unknown');

/** ResetDefaults (:979-1032), row for row in DFU's calling order,
 *  KeyCode translated to the browser code for the same physical key.
 *  Unity Mouse0/1/2 = left/right/middle. */
export const DEFAULT_BINDINGS = Object.freeze([
  ['Escape', 'Escape'],
  ['Backquote', 'ToggleConsole'],
  ['KeyW', 'MoveForwards'],
  ['KeyS', 'MoveBackwards'],
  ['KeyA', 'MoveLeft'],
  ['KeyD', 'MoveRight'],
  ['ArrowLeft', 'TurnLeft'],
  ['ArrowRight', 'TurnRight'],
  ['PageUp', 'FloatUp'],
  ['PageDown', 'FloatDown'],
  ['Space', 'Jump'],
  ['KeyC', 'Crouch'],
  ['ControlLeft', 'Slide'],
  ['ShiftLeft', 'Run'],
  ['Mouse2', 'AutoRun'],
  ['KeyR', 'Rest'],
  ['KeyT', 'Transport'],
  ['F1', 'StealMode'],
  ['F2', 'GrabMode'],
  ['F3', 'InfoMode'],
  ['F4', 'TalkMode'],
  ['Backspace', 'CastSpell'],
  ['KeyQ', 'RecastSpell'],
  ['KeyE', 'AbortSpell'],
  ['KeyU', 'UseMagicItem'],
  ['KeyZ', 'ReadyWeapon'],
  ['Mouse1', 'SwingWeapon'],
  ['KeyH', 'SwitchHand'],
  ['KeyI', 'Status'],
  ['F5', 'CharacterSheet'],
  ['F6', 'Inventory'],
  ['Mouse0', 'ActivateCenterObject'],
  ['Enter', 'ActivateCursor'],
  ['Insert', 'LookUp'],
  ['Delete', 'LookDown'],
  ['Home', 'CenterView'],
  ['AltLeft', 'Sneak'],
  ['KeyL', 'LogBook'],
  ['KeyN', 'NoteBook'],
  ['KeyM', 'AutoMap'],
  ['KeyV', 'TravelMap'],
  ['F8', 'PrintScreen'],
  ['F9', 'QuickSave'],
  ['F11', 'QuickLoad'],
]);

/** THE ONE CONSTRUCTION SEAM. Both dicts are keyed CODE -> ACTION,
 *  DFU's orientation (:79-80) - a key answers to one action per dict,
 *  an action may hold several keys only via a hand-edited save file
 *  (see loadKeyBinds). `unknown`/`secondaryUnknown` (:92-93) carry a
 *  newer build's actions through a save/load cycle untouched. */
export function createBindings() {
  return {
    primary: new Map(),
    secondary: new Map(),
    removedPrimary: new Set(),   // :87 - "don't autofill this default back"
    unknown: new Map(),
    secondaryUnknown: new Map(),
  };
}

/** SetBinding (:727-758). The order is the law: steal the code from
 *  the OTHER dict first, then clear this dict's old code for the
 *  action, then bind - and binding an action that was force-removed
 *  un-removes it. `code = null` is KeyCode.None: a pure clear. */
export function setBinding(store, code, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  const alt = primary ? store.secondary : store.primary;
  alt.delete(code);
  clearBinding(store, action, primary);
  if (code != null) {
    if (primary) store.removedPrimary.delete(action);
    dict.delete(code);
    dict.set(code, action);
  }
}

/** ClearBinding(Actions) (:839-846) - every code the action holds in
 *  the named dict. */
export function clearBinding(store, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  for (const [code, a] of [...dict]) if (a === action) dict.delete(code);
}

/** ClearBinding(KeyCode) (:803-811). */
export function clearBindingByCode(store, code, primary = true) {
  (primary ? store.primary : store.secondary).delete(code);
}

/** AddRemovedPrimaryAction (:795-798) - the controls UI's "unbind and
 *  KEEP it unbound" arm; without the mark, resetDefaults(autofill)
 *  would quietly re-bind the default on next launch. */
export function addRemovedPrimaryAction(store, action) {
  store.removedPrimary.add(action);
}

/** GetBinding (:641-671). One-arg walks the primary dict ("first
 *  non-None KeyCode"); pass primary=false for the secondary dict. */
export function getBinding(store, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  for (const [code, a] of dict) if (a === action) return code;
  return null;
}

/** GetBindings (:706-724) - all primary codes for the action, in
 *  insertion order. More than one exists only after a hand-edited
 *  file loads. */
export function getBindings(store, action) {
  const out = [];
  for (const [code, a] of store.primary) if (a === action) out.push(code);
  return out;
}

/** The router's read (I2): the frame loop checks the primary dict
 *  then the secondary (GetKey :1084 falls through to
 *  GetSecondaryBinding). */
export function actionForCode(store, code) {
  return store.primary.get(code) ?? store.secondary.get(code) ?? null;
}

// TestSetBinding (:1405-1422): a default lands only if the action is
// missing from THIS dict, the code is free in BOTH, and the action was
// not force-removed. (DFU also skips codes serving as combo modifiers;
// the port has no combos - flagged below - so that guard has nothing
// to test.)
function testSetBinding(store, code, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  const alt = primary ? store.secondary : store.primary;
  if (dict.has(code) || alt.has(code)) return;
  for (const a of dict.values()) if (a === action) return;
  if (primary && store.removedPrimary.has(action)) return;
  setBinding(store, code, action, primary);
}

/** ResetDefaults (:954-1043). The quirk is the law: a FULL reset
 *  clears the PRIMARY dict and the removed list (:956-960) but NOT
 *  the secondary dict - each default then steals its code back out of
 *  the secondary via SetBinding's alt-removal, and a secondary
 *  binding on a non-default code SURVIVES the reset. Autofill mode is
 *  the startup "push new actions into an old save" pass (:445-448). */
export function resetDefaults(store, autofill = false) {
  if (!autofill) {
    store.primary.clear();
    store.removedPrimary.clear();
  }
  const set = autofill
    ? (code, action) => testSetBinding(store, code, action, true)
    : (code, action) => setBinding(store, code, action, true);
  for (const [code, action] of DEFAULT_BINDINGS) set(code, action);
}

/** SaveKeyBinds' KeyBindData_v1 (:871-930), minus the axis/joystick
 *  blocks the port has no engine for. Unknown actions seen at load
 *  are appended back (:899-916) so an older build never strips a
 *  newer one's file - unless the key was REBOUND here, in which case
 *  this build's meaning wins. */
export function serializeKeyBinds(store) {
  const actionKeyBinds = {};
  const secondaryActionKeyBinds = {};
  for (const [code, action] of store.primary) actionKeyBinds[code] = action;
  for (const [code, action] of store.secondary) secondaryActionKeyBinds[code] = action;
  for (const [code, name] of store.unknown) {
    if (!(code in actionKeyBinds)) actionKeyBinds[code] = name;
  }
  for (const [code, name] of store.secondaryUnknown) {
    if (!(code in secondaryActionKeyBinds)) secondaryActionKeyBinds[code] = name;
  }
  return {
    actionKeyBinds,
    secondaryActionKeyBinds,
    removedPrimaryActions: [...store.removedPrimary],
  };
}

// LoadActionKeybinds (:1950-1969). Raw map-set, NOT setBinding: a
// hand-edited file binding two keys to one action loads BOTH (GetKey
// answers to either), which setBinding's clear-first would collapse.
function loadActionKeybinds(store, saved, primary) {
  if (!saved) return;
  const dict = primary ? store.primary : store.secondary;
  const unknown = primary ? store.unknown : store.secondaryUnknown;
  for (const [code, name] of Object.entries(saved)) {
    const action = parseActionName(name);
    if (!dict.has(code) && action !== 'Unknown') dict.set(code, action);
    else unknown.set(code, name);
  }
}

/** LoadKeyBinds (:1971-2000). A removed-primary mark loads only for a
 *  KNOWN action that is not currently bound in either dict (:1983-1992).
 *  DFU's startup follows a load with resetDefaults(store, true) to
 *  autofill actions the file predates (:445-448) - callers do the same. */
export function loadKeyBinds(store, data) {
  if (!data) return;
  loadActionKeybinds(store, data.actionKeyBinds, true);
  loadActionKeybinds(store, data.secondaryActionKeyBinds, false);
  if (Array.isArray(data.removedPrimaryActions)) {
    for (const name of data.removedPrimaryActions) {
      const action = parseActionName(name);
      if (action === 'Unknown') continue;
      let bound = false;
      for (const a of store.primary.values()) if (a === action) bound = true;
      for (const a of store.secondary.values()) if (a === action) bound = true;
      if (!bound) store.removedPrimary.add(action);
    }
  }
}

// ── persistence ─────────────────────────────────────────────────────
// DFU keeps KeyBindings.txt BESIDE settings.ini, its own file with its
// own serializer (GetKeyBindsSavePath) - so the port keeps its own
// localStorage key beside the settings store's, same try/catch shield
// as systems/settings.js:150.
const STORAGE_KEY = 'dagger.keybinds';

// DA1: the storage seam - localStorage in a browser, the desktop
// shell's file store (KeyBindings beside the settings, as DFU keeps
// KeyBindings.txt beside settings.ini) in the app.
function storage() {
  return appStorage();
}

/** The startup path (:441-452): load the file if it exists then
 *  autofill, else write defaults. Always answers a usable store. */
export function loadOrCreateBindings() {
  const store = createBindings();
  const ls = storage();
  const raw = ls?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      loadKeyBinds(store, JSON.parse(raw));
      resetDefaults(store, true);
      return store;
    } catch { /* a corrupt file falls through to defaults */ }
  }
  resetDefaults(store);
  saveKeyBinds(store);
  return store;
}

/** SaveKeyBinds' write (:926-929). */
export function saveKeyBinds(store) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(serializeKeyBinds(store)));
}

// ── the frame model ─────────────────────────────────────────────────

/** currentActions/previousActions (:79-80 in spirit; :610-637 the
 *  readers). endFrame is DFU's LateUpdate swap. */
export function createActionState() {
  return { current: new Set(), previous: new Set() };
}
export const addAction = (state, action) => { state.current.add(action); };
export const hasAction = (state, action) => state.current.has(action);
export const actionStarted = (state, action) =>
  !state.previous.has(action) && state.current.has(action);
export const actionComplete = (state, action) =>
  state.previous.has(action) && !state.current.has(action);
export function endFrame(state) {
  state.previous = state.current;
  state.current = new Set();
}

// FLAGGED, each with the slice it waits on:
//  - KEY COMBOS (GetComboCode :1165-1218, modifierHeldFirstDict): DFU
//    packs "mod + key" into one 32-bit KeyCode, bindable only by
//    editing the file. No default uses one; the runtime held-order
//    logic pends a slice that needs it.
//  - AXES + JOYSTICK (AxisActions, JoystickUIActions): no gamepad
//    layer in the port; the serialized blocks are simply absent here,
//    and loadKeyBinds ignores them in a DFU-written file.
//  - The port's own standing key departures (C cast, X crouch,
//    E activate, V view) reconcile against this table in I2, each
//    becoming an adoption or a Ledger-A row - not here.
