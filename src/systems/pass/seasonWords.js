// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): THE SEASON'S WORDS IN THE WORLD - the tremor's line
// by the stage, a Brass Fissure's card and legend, the Colossus's and the Maul's lines, in the player's language.
// One home for scenes/seasonHost.js and the held map. Not a DFU member. Ledger A (STOREFRONT).
import { t } from '../textManager.js';

/** The tremor's line, by the stage: it grows. */
export const TREMOR_TEXT = Object.freeze([
  () => t('season.tremor.0', 'The ground shudders. Far below, brass grinds on brass.'),
  () => t('season.tremor.1', 'The ground heaves. Steam hisses out of cracks in the earth.'),
  () => t('season.tremor.2', 'The earth roars. Deep below, something vast is waking.'),
]);
/** A fissure's words: its name on the map, the Heart Fissure's, where it is, what stands at it, the legend. */
export const FISSURE_TEXT = Object.freeze({
  name: () => t('season.fissure.name', 'Brass Fissure'),
  heart: () => t('season.fissure.heart', 'Heart Fissure'),
  near: (/** @type {string} */ near) => t('season.fissure.near', 'Near {near}', { near }),
  guards: () => t('season.fissure.guards', 'Dwemer constructs guard it.'),
  wakes: () => t('season.fissure.wakes', 'The Brass Colossus waits below it.'),
  quiet: () => t('season.fissure.quiet', 'Quiet while the gate stands beside it.'),
  legend: () => t('season.fissure.legend', 'Brass Fissure'),
});
/** The Colossus: its name, its waking and its fall; the Maul found. */
export const COLOSSUS_TEXT = Object.freeze({
  name: () => t('season.colossus.name', 'Brass Colossus'),
  wakes: (/** @type {string} */ near) => t('season.colossus.wakes', 'The Brass Colossus climbs out of the Heart Fissure near {near}.', { near }),
  falls: () => t('season.colossus.falls', 'The Brass Colossus falls, and its heart-bell rings out.'),
  maul: () => t('season.colossus.maul', 'You take the Resonant Maul from the wreck.'),
});
