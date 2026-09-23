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
// and `survivalRules` is what a law that CHARGES reads. The shelf holds
// the tier's STORED value (difficulty.js SURVIVAL_STORED: Off is the old
// switch's own `false`, Casual and Hard by name); a value that names no
// tier reads as the default, the same rule the Features bar draws it by
// (ui/enhancedMenu.js tileStates, BLOOD AUDIT 5), and the shelf's load
// drops it (uiPrefs.js loadPrefs), so the bar and the laws never disagree.
import { getPref } from '../uiPrefs.js';
import { SURVIVAL_OFF, tierOfStored, rulesForTier } from './difficulty.js';
import { isOnlinePage } from '../onlineLane.js';   // CORPSE-FOOD: a leaf too - it imports nothing

export const SURVIVAL_PREF = 'survival';
/** 'off', 'casual' or 'hard'. */
export const survivalTier = () => tierOfStored(getPref(SURVIVAL_PREF));
export const survivalOn = () => survivalTier() !== SURVIVAL_OFF;
/** The live tier's rules (difficulty.js SURVIVAL_RULES), or null when the arc is off. */
export const survivalRules = () => rulesForTier(survivalTier());
/**
 * CORPSE-FOOD (2026-09-23, Mac: "It needs to be accessible with people with it on"). ONLINE, A BODY'S FOOD IS THE
 * ROOM'S. A corpse is minted by whoever raises the death - the foe's owner in a cell, the host in a dungeon - and
 * looted by whoever opens it first (WORLD4, WORLD6b-iii(c)), so a kill raised on an Off machine, or a body a joiner
 * opened first, left a Casual or Hard party no meat and no rations. So online the food is minted whatever this
 * player's tier; an Off player sees it on a body, as they see a peer's campfire (SURV-OFFSIGHT), and uses what they
 * like. Offline it is the tier's, as ever.
 */
export const corpseFoodOn = (search) => survivalOn() || isOnlinePage(search);
