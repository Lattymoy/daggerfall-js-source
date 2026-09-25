// PORT0: THE CLASSIC SCOPE - where the enhanced skin must NOT reach.
//
// Some classic screens stay classic under the enhanced skin BY THE
// PLAYER'S CHOICE: the settings offer DFU's own travel map beside the
// enhanced held map (ui/mapSkin.js heldMapChosen), and a player who
// picked the classic map picked its prompts and lists with it. The
// shared hooks that turn a box or a list into its enhanced face
// (ui/messageBox.js -> the decision box, ui/listPicker.js -> the
// enhanced list) ask this first. A classic window that owns such a
// choice draws inside `classicScope`.

let depth = 0;

/** Is a classic-by-choice window drawing right now? */
export const inClassicScope = () => depth > 0;

/** Run `fn` with the enhanced hooks stood down. */
export function classicScope(fn) {
  depth++;
  try { return fn(); } finally { depth--; }
}
