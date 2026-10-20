// FT18 (2026-09-25, Mac: "Lets do a comprehensive reorganize and consolidation of our mod/enhancements") - THE
// CONDENSED ROWS' LANES OVER THE PORT'S OWN PREFS.
//
// RF4 has a condensed row's lane registered by the module that owns its keys, and the two before these own real
// logic: world/landView.js caps one radius per lane, world/outdoors.js splits the sky across two stores. The three
// here own nothing but the composition - one bar over two or four prefs whose consumers go on reading them exactly as
// they did (combat/blood/bloodSwitch.js, ui/enhanced/enhancedHud.js, ui/enhanced/enhancedHotbar.js, systems/wind/windDrive.js,
// render/windWisps.js). So they live together, over the shelf alone, and no consumer learns they exist. Nothing a
// lane writes is a new key: every value it sets is one a row of its own could already set.
//
//   'wind'       - Sway (the trees' and the grass's) and Wisps: the bar is both, each is its own in the drawer.
//   'quickSlots' - QS's diamond switch and HB1's quickbar-or-hotbar: Off, Diamond, Hotbar, Diamonds (DIAMOND-HB).
//   'blood'      - BLOOD1's marks, BLOOD1b's overkill, BLOOD2e's lens and BLOOD2g's gore: the gore dial with an Off.
import { getPref, setPref } from './uiPrefs.js';
import { registerFeatureLane } from './features.js';
import { BLOOD_PREF, BLOOD_OVERKILL_PREF, BLOOD_SCREEN_PREF, BLOOD_GORE_PREF, GORE_TIERS, GORE_DEFAULT } from '../combat/blood/bloodSwitch.js';

/** How every one of these switches is read by its consumer: on unless it says false. */
const on = (k) => getPref(k) !== false;

// ── THE WIND ───────────────────────────────────────────────────────
export const WIND_PARTS = Object.freeze(['floraSway', 'windWisps']);
export const WIND_TIERS = Object.freeze([[false, 'Off'], [true, 'On']]);
/** On while either is: a tile that reads Off with the trees still swaying would be a lie. */
export const windRead = () => WIND_PARTS.some(on);
export function windWrite(v) { for (const k of WIND_PARTS) setPref(k, v === true || v === 'true'); }

// ── THE QUICK SLOTS ────────────────────────────────────────────────
/** HB1's key (ui/enhanced/enhancedHotbar.js HOTBAR_PREF, read by systems/uiSkin.js hotbarInForce) and QS's. */
export const QUICKBAR_STYLE_PREF = 'quickbarStyle';
export const QUICKSLOTS_PREF = 'quickslots';
/** DIAMOND-HB: slot shape of the ten-slot bar, 'square' (default) or 'diamond' (ui/enhanced/enhancedHotbar.js
 *  HOTBAR_SHAPE_PREF, read by its hotbarGems). */
export const QUICKBAR_SHAPE_PREF = 'hotbarShape';
/** DIAMOND-HB: Diamond is the hotbar's first four slots drawn as a diamond (style 'diamond'), so it works like the
 *  ten-slot bar. Off is unchanged: the old QS diamond, hidden, with its keys working. Diamonds is the ten-slot bar
 *  with diamond-shaped slots. */
export const QUICK_SLOTS_TIERS = Object.freeze([['off', 'Off'], ['diamond', 'Diamond'], ['hotbar', 'Hotbar'], ['gems', 'Diamonds']]);
export const QUICK_SLOTS_DEFAULT = 'hotbar';   // HB-LYCFREE: the hotbar is the default (systems/features.js 'quick-slots' initial)
/** The hotbar wins: while it is up the diamond is put away whatever its switch says (HB1). 'quickbar' with the switch
 *  on is an old save that chose Diamond; systems/uiPrefs.js moves it to 'diamond' on load. */
export function quickSlotsRead() {
  const style = getPref(QUICKBAR_STYLE_PREF);
  if (style === 'hotbar') return getPref(QUICKBAR_SHAPE_PREF) === 'diamond' ? 'gems' : 'hotbar';
  if (style === 'diamond') return 'diamond';
  return getPref(QUICKSLOTS_PREF) === false ? 'off' : 'diamond';
}
export function quickSlotsWrite(v) {
  if (v === 'hotbar' || v === 'gems') {
    setPref(QUICKBAR_STYLE_PREF, 'hotbar');
    setPref(QUICKBAR_SHAPE_PREF, v === 'gems' ? 'diamond' : 'square');
    return;
  }
  if (v === 'diamond') { setPref(QUICKBAR_STYLE_PREF, 'diamond'); setPref(QUICKSLOTS_PREF, true); return; }
  setPref(QUICKBAR_STYLE_PREF, 'quickbar');
  setPref(QUICKSLOTS_PREF, false);
}

// ── THE BLOOD ──────────────────────────────────────────────────────
export const BLOOD_PARTS = Object.freeze([BLOOD_PREF, BLOOD_OVERKILL_PREF, BLOOD_SCREEN_PREF]);
export const BLOOD_TIERS = Object.freeze([['off', 'Off'], ['light', 'Light'], ['normal', 'Normal'], ['heavy', 'Heavy'], ['abattoir', 'Abattoir']]);
/** Off only when all three are: a player who kept the lens alone still has blood. */
export function bloodRead() {
  if (!BLOOD_PARTS.some(on)) return 'off';
  const g = getPref(BLOOD_GORE_PREF);
  return typeof g === 'string' && Object.hasOwn(GORE_TIERS, g) ? g : GORE_DEFAULT;
}
/** Off turns the three off and keeps the amount; an amount from Off brings all three back, so one press answers
 *  "blood or no blood" both ways. */
export function bloodWrite(v) {
  if (v === 'off') { for (const k of BLOOD_PARTS) setPref(k, false); return; }
  if (!Object.hasOwn(GORE_TIERS, v)) return;
  if (!BLOOD_PARTS.some(on)) for (const k of BLOOD_PARTS) setPref(k, true);
  setPref(BLOOD_GORE_PREF, v);
}

registerFeatureLane('wind', { tiers: WIND_TIERS, default: true, read: windRead, write: windWrite });
registerFeatureLane('quickSlots', { tiers: QUICK_SLOTS_TIERS, default: QUICK_SLOTS_DEFAULT, read: quickSlotsRead, write: quickSlotsWrite });
registerFeatureLane('blood', { tiers: BLOOD_TIERS, default: GORE_DEFAULT, read: bloodRead, write: bloodWrite });
