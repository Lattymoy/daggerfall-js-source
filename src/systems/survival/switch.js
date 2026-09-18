// SURV2 - THE ONE SWITCH. Mac: "All on by default." The whole arc
// (needs, items, camps, the rest law, the HUD) reads this one answer,
// declared on its feature row (systems/features.js, RF4's law: the row
// owns the key and the default) and read through the prefs shelf so
// the online lane can force it for a room. A leaf: it imports the
// shelf and nothing else, so the item minters (equip.js's starting
// kit, shopStock.js's shelf) can ask without a cycle.
import { getPref } from '../uiPrefs.js';

export const SURVIVAL_PREF = 'survival';
export const survivalOn = () => getPref(SURVIVAL_PREF) !== false;
