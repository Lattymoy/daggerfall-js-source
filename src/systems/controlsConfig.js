// I4 - THE CONTROLS STAGING LAW: ControlsConfigManager.cs (MIT,
// Daggerfall Workshop). The controls window edits a STAGED copy of
// both binding dicts; nothing reaches the live registry until the
// window closes on a valid configuration (SetAllKeyBindValues on
// OnPop), and Default resets through the registry's own law.
//
// A8 RETIRED THE COMBO FLAG THAT STOOD HERE. It said GetDuplicates'
// second and third phases had nothing to walk because the port had no
// key combos. It has them now (inputActions.js's comboCode pack), so
// all three phases are below and live, and this file is the whole of
// ControlsConfigManager rather than most of it.
//
// The one structural difference from C# stands: DFU's staged dicts
// hold DISPLAY STRINGS and parse them back with ParseKeyCodeString /
// GetComboCode(String); the port's hold CODES, because the port's code
// alphabet is already strings. comboString() in inputActions.js is the
// display face when one is wanted.

import {
  ACTIONS, getBinding, setBinding, addRemovedPrimaryAction, resetDefaults,
  isCombo, getCombo, comboCode,
} from './inputActions.js';

/** internalDupeColor / crossDupeColor (:44-45): red for a clash
 *  inside the shown dict, the blue for one across the two. */
export const INTERNAL_DUPE_COLOR = Object.freeze([1, 0, 0, 1]);
export const CROSS_DUPE_COLOR = Object.freeze([0, 0.58, 1, 1]);

/** The label cap under the classic font (:64 - the non-SDF arm) and
 *  the elongation stand-in (:56). */
export const MAX_BUTTON_TEXT = 10;
export const ELONGATED_TEXT = '...';

/** ResetUnsavedKeybinds (:270-281): both dicts, every action, from
 *  the LIVE registry. Unbound stays null (DFU stores "None"). */
export function createUnsavedKeybinds(store) {
  const primary = new Map(), secondary = new Map();
  for (const a of ACTIONS) {
    primary.set(a, getBinding(store, a, true));
    secondary.set(a, getBinding(store, a, false));
  }
  return { primary, secondary, usingPrimary: true };
}

export const currentDict = (u) => (u.usingPrimary ? u.primary : u.secondary);

/** SetUnsavedBinding (:141-144) - the staged write. */
export function setUnsavedBinding(u, action, code) {
  currentDict(u).set(action, code);
}

/**
 * GetDuplicates (:144-215), ALL THREE PHASES. A8 made the second and
 * third reachable by giving the port combos; before that the simple
 * same-code pass was the whole story.
 *
 * The first pass is DFU's OrderByDescending key selector (:152-174),
 * and its SIDE EFFECTS are the point: LINQ runs the selector once per
 * element, in source order, before the sort is enumerated, and the
 * selector records each combo's MODIFIER into `recorded` - which is
 * what makes a later independent bind on that same modifier read as a
 * duplicate. The sort then puts the combos first (stable, so equals
 * keep source order) and the simple pass walks that list.
 *
 * Unbound is DFU's KeyCode.None string, which `str != none` keeps out
 * of the dupe set; here unbound is null and skips the same way.
 */
export function getDuplicates(codes) {
  const recorded = new Set();
  const dupes = new Set();
  const modifiers = new Map();   // modifier code -> the combos it heads
  const list = [...codes];

  // the key selector's pass (:152-174), in source order
  const isComboCode = list.map((c) => {
    if (c == null || !isCombo(c)) return false;
    const [mod] = getCombo(c);
    // "Add modifier to 'recorded' so it cannot be used as an
    // independent keybind"
    if (!recorded.has(mod)) recorded.add(mod);
    if (!modifiers.has(mod)) modifiers.set(mod, new Set());
    modifiers.get(mod).add(c);
    return true;
  });
  // OrderByDescending(bool): combos first, stable within each group
  const sorted = [
    ...list.filter((_, i) => isComboCode[i]),
    ...list.filter((_, i) => !isComboCode[i]),
  ];

  // "Simple check for duplicates in the list" (:178-186)
  for (const c of sorted) {
    if (c == null) continue;
    if (!recorded.has(c)) recorded.add(c);
    else dupes.add(c);
  }

  // "Mark combos as dupes too if a modifier has been used as an
  // independent keybind" (:188-196) - Shift+T against a bare Shift.
  for (const [mod, combos] of modifiers) {
    if (dupes.has(mod)) for (const c of combos) dupes.add(c);
  }

  // "Mark combos as dupes if the combo'd key is also used as a
  // modifier" (:198-214) - Shift+T against Z+Shift.
  for (const c of sorted) {
    if (c == null || !isCombo(c)) continue;
    const [, key] = getCombo(c);
    const mods = modifiers.get(key);
    if (mods) { for (const m of mods) dupes.add(m); dupes.add(c); }
  }
  return dupes;
}

/** InternalDuplicateKeyCodesExist (:223-228). */
export const internalDuplicatesExist = (u) =>
  getDuplicates([...currentDict(u).values()]).size > 0;

/** CheckDuplicateKeyCodes (:230-267) as data: which codes clash
 *  INSIDE the shown dict (red), which clash ACROSS the two dicts
 *  (blue, never overriding red), and whether the window may close -
 *  DFU's return is `noRedDupes && crossDupes.Count == 0`: BOTH kinds
 *  block the exit. The cross check dedupes each dict first (:256-258)
 *  so an internal pair does not read as a cross clash too. */
export function checkDuplicates(u) {
  const internal = getDuplicates([...currentDict(u).values()]);
  const cross = getDuplicates([
    ...new Set([...u.primary.values()].filter((c) => c != null)),
    ...new Set([...u.secondary.values()].filter((c) => c != null)),
  ]);
  return { internal, cross, ok: internal.size === 0 && cross.size === 0 };
}

/** SetAllKeyBindValues (:284-288) + SetKeyBindValues (:541-559): the
 *  apply, both dicts, rebinding ONLY where the staged code differs
 *  from the live one - and an emptied PRIMARY slot is marked removed
 *  so the autofill pass cannot quietly restore its default.
 *
 *  THE CONTRACT, which is DFU's and not a port shortcut: this runs
 *  only on a DUPLICATE-FREE set. SetBinding steals a code from
 *  whoever holds it, so applying a set where two actions share one
 *  code is ORDER-DEPENDENT - the later action wins and the earlier
 *  ends up unbound. DFU never reaches that state because the window
 *  refuses to close while checkDuplicates reports either kind of
 *  clash (AllowCancel false), which is exactly why that gate blocks
 *  the exit rather than merely colouring the labels. Callers that
 *  bypass the window must run checkDuplicates themselves. */
export function applyUnsavedKeybinds(store, u) {
  for (const primary of [true, false]) {
    const dict = primary ? u.primary : u.secondary;
    for (const [action, code] of dict) {
      const cur = getBinding(store, action, primary);
      if (cur !== code) {
        if (primary && code == null) addRemovedPrimaryAction(store, action);
        setBinding(store, code ?? null, action, primary);
      }
    }
  }
}

/** SetDefaults (:229-238 in the window): the registry's own reset,
 *  then a fresh staging copy. */
export function resetUnsavedToDefaults(store, u) {
  resetDefaults(store);
  const fresh = createUnsavedKeybinds(store);
  u.primary = fresh.primary;
  u.secondary = fresh.secondary;
}

// GetButtonText's classic table (:322-410, the non-SDF arm - the
// port draws the classic font), translated to the port's e.code
// alphabet key for key. What the table does not name falls to
// FormatButtonText (:561-568): camel case split by spaces, and past
// ten characters the '...' stand-in.
const CLASSIC_NAMES = Object.freeze({
  AltLeft: 'LALT', AltRight: 'RALT',
  ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT',
  PageUp: 'PG UP', PageDown: 'PG DN',
  Insert: 'INS', Delete: 'DEL',
  Backspace: 'BCKSPC', CapsLock: 'CAPS',
  Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
});

/** GetButtonText + FormatButtonText. `full` skips the length cap
 *  (the tooltip/full-string arm). */
export function buttonText(code, full = false) {
  if (code == null) return 'NONE';   // KeyCode.None.ToString(), through the classic-font ToUpper tail (NT3 F082)
  // A8: the COMBO arm (:509-513). Each half goes through GetButtonText
  // ITSELF, at its DEFAULT fullString - so a combo reads in the classic
  // names, "LSHIFT + T" - and only the JOINED string meets
  // FormatButtonText, whose ten-character cap most combos overrun into
  // the '...' the tooltip stands behind.
  if (isCombo(code)) {
    const [mod, key] = getCombo(code);
    return formatButtonText(`${buttonText(mod)} + ${buttonText(key)}`, full);
  }
  if (CLASSIC_NAMES[code]) return CLASSIC_NAMES[code];
  let t = code;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) t = `A${digit[1]}`;                   // Alpha0..Alpha9 -> A0..A9
  const pad = /^Numpad(\w+)$/.exec(code);
  if (pad) t = `KPAD${pad[1]}`;                    // Keypad0.. -> KPAD0..
  else if (/^Key([A-Z])$/.test(code)) t = code.slice(3);   // KeyW -> W
  // NT3 (F082): the arrows fall past the classic table to the friendly
  // switch, which names them "Left"/"Right"/"Up"/"Down" (:468-479) -
  // not "Left Arrow" - and the classic-font tail UPPERCASES everything
  // (`SDFFontRendering ? text : text.ToUpper()`, :521; the port draws
  // the classic font, so the non-SDF arm is its law). ENTER, SPACE,
  // LEFT - as the DOS-inspired window shows them.
  else if (/^Arrow(\w+)$/.test(code)) t = code.slice(5);
  return formatButtonText(t, full);
}

/** FormatButtonText (:561-568) plus the classic-font ToUpper tail
 *  (:521), which is where both arms of GetButtonText land. */
function formatButtonText(text, full) {
  if (text.length <= MAX_BUTTON_TEXT || full) {
    return text.replace(/(?<=[a-z])([A-Z])/g, ' $1').trim().toUpperCase();
  }
  return ELONGATED_TEXT;
}

// ── the two helpers both rebinding windows need (ROAD-G G6) ─────────
//
// They were private to ui/controlsWindow.js until the ADVANCED tab's
// destination - ui/mouseControlsWindow.js, the other window that
// captures keys and prompts to remove them - needed the same two. The
// grid imports the WINDOW, so the shared halves cannot live in the
// grid without a cycle, and PromptRemoveKeybindMessage is
// ControlsConfigManager's own method anyway (:290-320).

/** The three virtual modifiers a KeyboardEvent reports, each mapped to
 *  the LEFT physical key. The modifier keys themselves are excluded:
 *  pressing Shift alone must bind Shift, not a Shift+Shift combo. DFU
 *  takes TWO key-downs and lets ANY key be the modifier
 *  (DaggerfallControlsWindow.WaitForKeyPress :380-424); a browser
 *  KeyboardEvent reports three flags and no side, so this door offers
 *  the LEFT side of the three - which is what every DFU default binds.
 *  The storage, the duplicate law and the runtime read take any pair. */
const EVENT_MODIFIERS = Object.freeze([
  ['ctrlKey', 'ControlLeft', ['ControlLeft', 'ControlRight']],
  ['shiftKey', 'ShiftLeft', ['ShiftLeft', 'ShiftRight']],
  ['altKey', 'AltLeft', ['AltLeft', 'AltRight']],
]);
export function comboFromEvent(code, e) {
  if (!e) return null;
  for (const [flag, mod, own] of EVENT_MODIFIERS) {
    if (e[flag] && !own.includes(code)) return comboCode(mod, code);
  }
  return null;
}

/** The remove prompt's action face (:302): camel case split. */
export const splitCamel = (s) => s.replace(/(?<=[a-z])([A-Z])/g, ' $1').trim();

/** PromptRemoveKeybindMessage's text (:298-302): the "removeKeybind"
 *  record formatted with the camel-split action name and the FULL
 *  button text of the code being removed. */
export function removeKeybindPromptRows(action, code) {
  return [
    'Are you sure you want to remove the keybind',
    `for ${splitCamel(action)} ('${buttonText(code, true)}')?`,
  ];
}
