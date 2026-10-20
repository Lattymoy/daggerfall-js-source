// @ts-check
// WB14c (2026-10-19, Mac: "the chance of a gate to spawn with platforms of wave based adds that need to be defeated before
// encountering the boss"; bible/11-Multiplayer/Breach-Portents.md sections 4 and 6): THE VANGUARD ON MY SCREEN - what its
// stages say (the relay's `vgw` words, net/gate/gateBrain.js VG_WORD) and whether it still holds the approach. Its bodies
// are his host's (scenes/gate/gateHost.js draws, hears and judges them), its progress the bar's (ui/gate/gateBossBar.js),
// its walkways the court's floor law. Pure.
//
// Not a DFU member. Ledger A (WB).
import { VG_WORD } from '../../net/gate/gateBrain.js';
import { t } from '../../systems/textManager.js';

/** The Vanguard's lines - the event and the order, no more (WB13b). */
export const VANGUARD_TEXT = Object.freeze({
  rises: () => t('gate.vanguard.rises', 'His vanguard rises from the fire!'),
  clear: () => t('gate.vanguard.clear', 'The Bridgehead is clear.'),
  lord: () => t('gate.vanguard.lord', 'The Markynaz rises.'),
  broken: () => t('gate.vanguard.broken', 'The Vanguard is broken. The way to the Warden opens.'),
  patience: (boss) => t('gate.vanguard.patience', '{boss} tires of waiting.', { boss }),
});

/** Does the state's Vanguard still hold the approach (its stage short of broken)? */
export const vanguardOut = (s) => !!s?.vg && s.vg[0] < 2;

/** The line a Vanguard word says, or null: its first wave rising, a platform cleared, the Markynaz risen, the Vanguard
 *  broken, his patience - `boss` his name. Every other wave says itself on the bar alone. */
export function vanguardLine(w, boss) {
  if (!w) return null;
  switch (w.e) {
    case VG_WORD.wave: return w.s === 0 && w.w === 1 ? VANGUARD_TEXT.rises() : null;
    case VG_WORD.clear: return VANGUARD_TEXT.clear();
    case VG_WORD.lord: return VANGUARD_TEXT.lord();
    case VG_WORD.broken: return VANGUARD_TEXT.broken();
    case VG_WORD.patience: return VANGUARD_TEXT.patience(boss);
    default: return null;
  }
}
