// @ts-check
// AUDIT CAPTAIN'S SEA S3's helper, moved out of bootWorld whole (HOST-SPLIT - bible/01-Overview/Host-Split.md, THE HOSTS
// DO NOT GROW: SERPENT5's one wiring line, the Old Coil's honour popup, was the first line past bootWorld's ceiling after
// main's own merges had taken its room - AUDIT WORLD-REWARDS's merge of main moved this out in its place). It reads
// nothing of the host's scope: the live bindings, the skin, the Plus d-pad's map and the pad's glyphs, every one a
// module's own.
import { bindings } from '../ui/input.js';
import { getBinding } from '../systems/inputActions.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { plusDpadMap, DPAD_CODES } from '../ui/plus/plusPad.js';
import { hdGlyphName } from '../ui/padGlyphsHD.js';

/** AUDIT CAPTAIN'S SEA S3: the pad's press for the glass, as its foot names it - the button chosen for it, else the
 *  d-pad's tap or hold the player gave it (Plus's d-pad), else none. */
export function glassPadWords(padHand) {
  const code = getBinding(bindings(), 'Spyglass', false);
  if (code && /^Joystick/.test(code)) return hdGlyphName(padHand, code);
  if (!isEnhancedPlus()) return null;
  for (const [dir, m] of Object.entries(plusDpadMap())) {
    if (m.tap === 'Spyglass') return hdGlyphName(padHand, DPAD_CODES[dir]);
    if (m.hold === 'Spyglass') return `Hold ${hdGlyphName(padHand, DPAD_CODES[dir])}`;
  }
  return null;
}
