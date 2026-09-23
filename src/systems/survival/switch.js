// SURV2 - THE ONE SWITCH. Mac: "All on by default." The whole arc
// (needs, items, camps, the rest law, the HUD) reads this one answer,
// declared on its feature row (systems/features.js, RF4's law: the row
// owns the key and the default) and read through the prefs shelf so
// the online lane can force it for a room. A leaf: it imports the
// shelf and the tier table (itself import-free) and nothing else, so
// the item minters (equip.js's starting kit, shopStock.js's shelf)
// can ask without a cycle.
//
// SURV-TIERS (2026-09-23): THE ANSWER IS A TIER NOW - Off, Casual (the
// default) or Hard, on the same key (survival/difficulty.js is the table
// and says why). `survivalOn` keeps its meaning for everything the arc
// only switches on - the items, the camps, the HUD, the tavern menu -
// and `survivalRules` is what a law that CHARGES reads. A stored value
// that is no tier reads as the default, the same rule the Features bar
// draws it by (ui/enhancedMenu.js tileStates, BLOOD AUDIT 5), so the bar
// and the laws can never disagree; the old boolean is converted once, at
// the shelf's load (uiPrefs.js loadPrefs).
import { getPref } from '../uiPrefs.js';
import { SURVIVAL_OFF, normalizeTier, rulesForTier } from './difficulty.js';

export const SURVIVAL_PREF = 'survival';
/** 'off', 'casual' or 'hard'. */
export const survivalTier = () => normalizeTier(getPref(SURVIVAL_PREF));
export const survivalOn = () => survivalTier() !== SURVIVAL_OFF;
/** The live tier's rules (difficulty.js SURVIVAL_RULES), or null when the arc is off. */
export const survivalRules = () => rulesForTier(survivalTier());
