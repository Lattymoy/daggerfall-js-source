// ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
// Sounds, add the wind noise to it"): ONE SWITCH FOR THE PORT'S OWN
// SOUNDS - the ones Daggerfall never played and the enhanced skin adds.
//
// Two things ride it today:
//   - the wind loop (systems/windAudio.js, WIND3): Daggerfall's own wind
//     clips under the enhanced outdoors, rising and falling with the
//     wind's strength, silent indoors. It had its own row and pref
//     (`windSound`) from WIND3 to here; that row IS this row now.
//   - the enhanced inventory's transfer cues (ui/enhancedInventory.js,
//     MAC-O6): DoTransferItem's own gold clink and button click, which
//     the classic window always played and the enhanced one never did.
//
// The switch is the row `enhanced-sounds` on the Features home
// (systems/features.js), its pref `soundEnhancements` (RF4: the shelf
// derives the default from the row), the player's own online. The key
// does not begin with `enhanced` on purpose: the online lane's law (OL1)
// forces every `enhanced*` pref on for everyone, and a sound is the
// player's own - a look and a sound the room has no stake in, WIND3's
// own reading - so the key is named outside that family. The
// enhanced skin is the outer gate as it is for every enhanced row - the
// classic skin plays exactly what DFU plays and nothing more.
import { getPref } from './uiPrefs.js';
import { isEnhanced } from './uiSkin.js';

/** The pref's key - one spelling, read here and declared on the row. */
export const ENHANCED_SOUNDS_KEY = 'soundEnhancements';

/** Are the port's own sounds on: the enhanced skin and the pref. */
export function enhancedSoundsOn() {
  return isEnhanced() && !!getPref(ENHANCED_SOUNDS_KEY);
}
