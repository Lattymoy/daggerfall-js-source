// @ts-check
// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING WORLD'S SWITCH - the Features row `living-world`
// (systems/features.js), on by default, the enhanced lane's alone (LW0 decision 1): the classic skin, and the row off,
// keep DFU's PopulationManager walkers 1:1 (systems/townPopulation.js). Read where a town is built, so a change takes
// effect when a town next loads.
import { getPref } from '../uiPrefs.js';
import { isEnhanced } from '../uiSkin.js';

export const LIVING_WORLD_KEY = 'livingWorld';

/** Whether the streets are the living world's (an override for a pin). */
export const LIVING_WORLD_TUNING = { override: /** @type {boolean|null} */ (null) };
export const livingWorldOn = () => LIVING_WORLD_TUNING.override ?? (isEnhanced() && getPref(LIVING_WORLD_KEY) !== false);
