// I4 - THE CONTROLS STAGING LAW: ControlsConfigManager.cs (MIT,
// Daggerfall Workshop) minus its combo arms. The controls window
// edits a STAGED copy of both binding dicts; nothing reaches the
// live registry until the window closes on a valid configuration
// (SetAllKeyBindValues on OnPop), and Default resets through the
// registry's own law.
//
// FLAGGED with I1's combo flag: GetDuplicates' second and third
// phases (:147-221) exist to mark a combo's MODIFIER as clashing
// with an independent bind. The port has no key combos, so those
// arms have nothing to walk; the simple same-string phase is the
// whole reachable law and the combo phases land with combos.

import {
  ACTIONS, getBinding, setBinding, addRemovedPrimaryAction, resetDefaults,
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

/** GetDuplicates' reachable phase (:180-188): every code that appears
 *  twice, with unbound (null) never counting. */
export function getDuplicates(codes) {
  const seen = new Set(), dupes = new Set();
  for (const c of codes) {
    if (c == null) continue;
    if (seen.has(c)) dupes.add(c);
    else seen.add(c);
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
  if (t.length <= MAX_BUTTON_TEXT || full) {
    return t.replace(/(?<=[a-z])([A-Z])/g, ' $1').trim().toUpperCase();
  }
  return ELONGATED_TEXT;
}
