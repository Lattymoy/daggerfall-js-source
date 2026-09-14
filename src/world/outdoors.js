// FT4 (2026-09-14, the Features arc; Mac's own example of a condensed
// row: "our enhanced environments + dynamic skies"): THE OUTDOORS, ONE
// ROW. Two switches in two panes decided what the sky is - the Enhanced
// category's Enhanced environments (uiPrefs, EE1: the whole enhanced
// outdoors as one switch) and the Mods pane's Dynamic Skies `Enabled`
// (the mod's skybox in place of the port's dome while the outdoors are
// enhanced) - and a player reading either could not see the other's
// hand in what they were looking at. One row now, wearing Enhanced and
// Mod Authored, a THREE-WAY CHOICE: Daggerfall's outdoors, the enhanced
// outdoors under the port's own sky, or under Dynamic Skies' sky.
//
// The host's composition is unchanged and stays where it is
// (scenes/shared.js: enhancedLane, dynamicOn) - this module only reads
// and writes the two stores the way that composition reads them. OFF
// leaves the mod's switch as it was: a player who turns the outdoors
// off and on again gets the sky they had. The mod's OTHER knobs (fog
// density, pixel snow) are the mod's own and stay on the Mods page.

import { getPref, setPref } from '../systems/uiPrefs.js';
import { modSetting, setModSetting } from '../systems/modSettings.js';
import { registerFeatureLane } from '../systems/features.js';   // RF4: the row's lane is this module's

/** The row's tiers: value and label. */
export const OUTDOORS_TIERS = Object.freeze([
  ['off', 'Off - Daggerfall’s outdoors'],
  ['dome', 'On, with the port’s own sky'],
  ['dynamic', 'On, with Dynamic Skies'],
]);
/** Enhanced environments on (EE1) and every mod on (MO1): the mod's sky. */
export const OUTDOORS_DEFAULT = 'dynamic';

/** What the outdoors are set to, off the live stores. */
export function outdoorsRead() {
  if (!getPref('enhancedEnvironments')) return 'off';
  return modSetting('dynamic-skies', 'Enabled') ? 'dynamic' : 'dome';
}

/** ONE write, both stores: the environments switch, and - when the
 *  outdoors are on - which sky. Answers the tier written; an unknown
 *  value is the default. */
export function outdoorsWrite(v) {
  const tier = OUTDOORS_TIERS.some(([k]) => k === v) ? v : OUTDOORS_DEFAULT;
  setPref('enhancedEnvironments', tier !== 'off');
  if (tier !== 'off') setModSetting('dynamic-skies', 'Enabled', tier === 'dynamic');
  return tier;
}

// RF4: the Features row `enhanced-environments` reads its tiers, its default and its read/write from here.
registerFeatureLane('outdoors', { tiers: OUTDOORS_TIERS, default: OUTDOORS_DEFAULT, read: outdoorsRead, write: outdoorsWrite });
