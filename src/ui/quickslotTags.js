// QS3 - THE TAG LAW: what each corner of the quickslot diamond says
// the player should press.
//
// Pure over a bindings store, so the whole of it runs in node. The HUD
// re-derives all four tags every frame and writes one only when its
// string changed - the readout's own law - which is only cheap because
// nothing here touches a document.
//
// THREE RULES, and the third is the one that matters:
//
//   - THE PAD WINS WHILE THE PAD IS THE LIVE DEVICE. A player holding a
//     controller wants the BUTTON, not "A1", so when `controller` is
//     true and the action carries a JoystickButton0..9 binding in
//     either dict, the tag is the glyph (ui/padGlyphs.js).
//   - OTHERWISE IT IS THE KEY'S CLASSIC NAME, through the one function
//     that names keys in this port - `buttonText`, DFU's own
//     GetButtonText - at its SHORT form, which is what a ten-pixel chip
//     has room for.
//   - AN UNBOUND ACTION SHOWS NO TAG AT ALL. `buttonText(null)` answers
//     'NONE' because KeyCode.None.ToString() does, and a chip reading
//     NONE on a HUD is furniture that tells a player to press a key
//     that does not exist. Null, and the chip is display:none.
//
// And one tail: an action bound ONLY to the pad still shows its glyph
// with the keyboard live, because there is no key to name and a blank
// corner would be a lie of a different kind.
import { getBinding, isCombo, getCombo } from '../systems/inputActions.js';
import { buttonText } from '../systems/controlsConfig.js';
import { modSetting } from '../systems/modSettings.js';
import { domCodeForKeyCode } from '../systems/keyCodes.js';
import { unityButtonGlyph } from './padGlyphs.js';

/** Which action each cell of the diamond announces. The off hand's is
 *  decided by what is IN it, so it is a function of the kind rather
 *  than a constant - see `quickslotOffAction`. */
export const CELL_ACTIONS = Object.freeze({
  main: 'ReadyWeapon',   // draw / sheathe: the one thing the main hand's cell does
  c1: 'QuickUse1',
  c2: 'QuickUse2',
  swap: 'QuickSwap',
});

/** Handheld Torches binds its toggle as a MOD TextKey rather than an
 *  InputManager action (systems/handheldTorches.js readTorchSettings,
 *  default "O"), so the torch cell's tag is read from the mod's own
 *  store and is KEYBOARD ONLY - a TextKey cannot name a pad button. */
export const TORCH_TOGGLE_SETTING = 'Handling.ToggleLightInput';
export const TORCH_VENDOR = 'handheld-torches';

/** The key's name on a chip. `buttonText` is DFU's GetButtonText and
 *  names the digit row Alpha1..Alpha0 - 'A1' on the controls grid,
 *  which is where a player rebinds and where DFU's own word belongs.
 *  A chip at the corner of a HUD cell is read at a glance, and 'A1'
 *  there reads as a grid reference; the digit row shows its DIGIT,
 *  the numpad its digit with the pad's own prefix, and every other key
 *  the classic name. */
export function tagText(code) {
  // AUDIT QS F6: a COMBO is each half through this same law, joined
  // tight - `LSHIFT+1` - because `buttonText`'s short form caps the
  // joined classic string at ten characters and a chip reading '...'
  // says nothing at all.
  if (isCombo(code)) { const [mod, key] = getCombo(code); return `${tagText(mod)}+${tagText(key)}`; }
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];
  const pad = /^Numpad([0-9])$/.exec(code);
  if (pad) return `KP${pad[1]}`;
  return buttonText(code, true);
}

/**
 * The tag for one action:
 *   { kind: 'key', text }              - a keyboard key, named the classic way
 *   { kind: 'glyph', family, code }    - a pad button, drawn by padGlyphs
 *   null                               - nothing is bound, so nothing is drawn
 */
export function quickslotTag(action, { bindings = null, controller = false, family = 'xbox' } = {}) {
  if (!action || !bindings) return null;
  const codes = [getBinding(bindings, action), getBinding(bindings, action, false)].filter(Boolean);
  const pad = codes.find((c) => unityButtonGlyph(family, c));
  if (controller && pad) return { kind: 'glyph', family, code: pad };
  // AUDIT QS F6: the KEY arm is everything that is not a drawable pad
  // button - a keyboard key, a mouse button, a pad AXIS key - so an
  // action bound only to `JoystickAxis3+` reads as bound, not as nothing.
  const key = codes.find((c) => !unityButtonGlyph(family, c));
  if (key) return { kind: 'key', text: tagText(key) };
  if (pad) return { kind: 'glyph', family, code: pad };
  return null;
}

/** The torch cell's tag - the mod's key, named by the same function.
 *  Null when the mod names no key the port can bind. */
export function torchTag(read = () => modSetting(TORCH_VENDOR, TORCH_TOGGLE_SETTING)) {
  let code = null;
  try { code = domCodeForKeyCode(read()); } catch { code = null; }   // a store that is not there is not a key
  return code ? { kind: 'key', text: tagText(code) } : null;
}

/** The off-hand cell's action, by what is standing in it: a lit torch
 *  is the mod's key, a swap weapon is QuickSwap, and a shield or an
 *  empty socket has nothing to press. */
export function quickslotOffTag(kind, opts = {}) {
  if (kind === 'torch') return torchTag(opts.readTorchKey ?? undefined);
  if (kind === 'swap') return quickslotTag(CELL_ACTIONS.swap, opts);
  return null;
}

/** The tag as ONE STRING, for the HUD's changed-only write. Two tags
 *  that read the same are the same tag. */
export const tagKey = (t) => (t ? (t.kind === 'glyph' ? `g:${t.family}:${t.code}` : `k:${t.text}`) : '');
