// HT1: UNITY KEYCODE NAMES <-> DOM `KeyboardEvent.code`.
//
// A DFU mod binds a key by the NAME of a UnityEngine.KeyCode -
// Handheld Torches' modsettings carry `F`, `Tab`, `X` as TextKeys and
// its LoadSettings runs `Enum.TryParse<KeyCode>(text)` on them
// (HandheldTorches.SetKeyFromText, IL 0x40d0), falling back to
// KeyCode.None when the text is not a member. The port polls keys by
// `e.code`, so the same name has to answer a DOM code, and the pane's
// key capture has to spell a DOM code back as a KeyCode name that the
// mod's own parser would accept. One table, both ways, the members
// the port's keyboard can produce; anything else parses to None, as
// Unity's would.

const PAIRS = [
  // letters and digits
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, `Key${c}`]),
  ...'0123456789'.split('').map((d) => [`Alpha${d}`, `Digit${d}`]),
  ...'0123456789'.split('').map((d) => [`Keypad${d}`, `Numpad${d}`]),
  // function keys
  ...Array.from({ length: 15 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]),
  // the named keys, Unity's spelling
  ['Space', 'Space'], ['Tab', 'Tab'], ['Return', 'Enter'], ['KeypadEnter', 'NumpadEnter'], ['Escape', 'Escape'],
  ['Backspace', 'Backspace'], ['Delete', 'Delete'], ['Insert', 'Insert'], ['Home', 'Home'], ['End', 'End'],
  ['PageUp', 'PageUp'], ['PageDown', 'PageDown'], ['CapsLock', 'CapsLock'], ['Numlock', 'NumLock'], ['ScrollLock', 'ScrollLock'],
  ['Pause', 'Pause'], ['Print', 'PrintScreen'], ['Menu', 'ContextMenu'],
  ['UpArrow', 'ArrowUp'], ['DownArrow', 'ArrowDown'], ['LeftArrow', 'ArrowLeft'], ['RightArrow', 'ArrowRight'],
  ['LeftShift', 'ShiftLeft'], ['RightShift', 'ShiftRight'], ['LeftControl', 'ControlLeft'], ['RightControl', 'ControlRight'],
  ['LeftAlt', 'AltLeft'], ['RightAlt', 'AltRight'], ['LeftCommand', 'MetaLeft'], ['RightCommand', 'MetaRight'],
  ['BackQuote', 'Backquote'], ['Minus', 'Minus'], ['Equals', 'Equal'], ['LeftBracket', 'BracketLeft'], ['RightBracket', 'BracketRight'],
  ['Backslash', 'Backslash'], ['Semicolon', 'Semicolon'], ['Quote', 'Quote'], ['Comma', 'Comma'], ['Period', 'Period'], ['Slash', 'Slash'],
  ['KeypadDivide', 'NumpadDivide'], ['KeypadMultiply', 'NumpadMultiply'], ['KeypadMinus', 'NumpadSubtract'], ['KeypadPlus', 'NumpadAdd'], ['KeypadPeriod', 'NumpadDecimal'],
  // the mouse, as the port's held set spells it (ui/input.js MOUSE_CODES)
  ['Mouse0', 'Mouse0'], ['Mouse1', 'Mouse1'], ['Mouse2', 'Mouse2'],
];
const TO_DOM = new Map(PAIRS);
const TO_KEYCODE = new Map(PAIRS.map(([k, c]) => [c, k]));

/** KeyCode.None: what Enum.TryParse leaves on a name it does not know. */
export const KEYCODE_NONE = 'None';

/** A KeyCode name to the DOM code the port polls, or null for None /
 *  an unknown name (the mod's "Detected an invalid key code"). Unity's
 *  parse is case-sensitive; so is this. */
export function domCodeForKeyCode(name) {
  if (typeof name !== 'string') return null;
  return TO_DOM.get(name.trim()) ?? null;
}

/** A DOM code back to its KeyCode name, or null when Unity has no
 *  member for it (the pane refuses the capture). */
export function keyCodeForDomCode(code) {
  return TO_KEYCODE.get(code) ?? null;
}

/** Does the name parse - is it a KeyCode the port can bind? */
export const isBindableKeyCode = (name) => domCodeForKeyCode(name) !== null;
