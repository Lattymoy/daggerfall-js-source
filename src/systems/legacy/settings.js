// @ts-check
// LEGACY1: Project Legacy's settings as the family law reads them - the mod's own "Family" section and the port's
// "Legacy" section (systems/modSettings.js 'project-legacy'), resolved once per read into plain numbers. The mod's
// `LoadSettings` read them on a settings change; the port reads them at the moment they matter (a birth, a death),
// so a dial moved mid-game reaches the next birth and never re-rolls one made.
import { modSetting } from '../modSettings.js';
import { LEGACY_MOD, MODELS } from './family.js';

/** Arkay's toll, as a share of the lifespan, by the "Legacy.Toll" choice (Light, Standard, Heavy). */
export const TOLL_SHARES = Object.freeze([0.04, 0.06, 0.10]);

/** Is Project Legacy on. */
export const legacyOn = () => !!modSetting(LEGACY_MOD, 'Enabled');

/** Every dial, resolved: what family.js's `settings` arguments take. */
export function legacySettings() {
  const toll = Math.max(0, Math.min(TOLL_SHARES.length - 1, modSetting(LEGACY_MOD, 'Legacy.Toll') | 0));
  return {
    descendants: modSetting(LEGACY_MOD, 'Family.Descendants') | 0,
    maxSiblings: modSetting(LEGACY_MOD, 'Family.Max Siblings') | 0,
    siblingChance: modSetting(LEGACY_MOD, 'Family.Siblings Probability') | 0,
    model: (modSetting(LEGACY_MOD, 'Legacy.Model') | 0) === 1 ? MODELS.bloodline : MODELS.enduring,
    tollShare: TOLL_SHARES[toll],
    heirloomChance: (modSetting(LEGACY_MOD, 'Legacy.Heirloom Chance') | 0) / 100,
    familyInWorld: !!modSetting(LEGACY_MOD, 'Legacy.Family In World'),
  };
}
