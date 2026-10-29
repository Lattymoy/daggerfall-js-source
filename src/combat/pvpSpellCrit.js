// PVP-SPELL-CRIT (the PvP rework, 2026-10-29: "spell cit is for this", "otherwise maghes fall off"): a player's harmful
// spell at a player crits as a blow does under the overhaul (combat/combatStats.js criticalModel's damage arm) - chance
// Critical Strike / (4 - the Luck term) per cent, the size 1 + 5% for each 5 points of Critical Strike. PvE is left whole.
import { SKILLS, skillValue } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';

/** `{ chance, mult }` of `caster`'s spell crit: chance 0-1. */
export function pvpSpellCrit(caster) {
  const crit = Math.max(0, skillValue(caster, SKILLS.CriticalStrike) || 0);
  const luckTerm = Math.floor((liveStat(caster, 'luck') - 50) / 25);
  return { chance: Math.min(100, Math.trunc(crit / (4 - luckTerm))) / 100, mult: Math.floor(crit / 5) * 0.05 + 1 };
}

/** `harm` after one crit roll of `caster`'s. */
export function pvpCritHarm(harm, caster, rolls = Math.random) {
  if (!(harm > 0) || !caster) return harm;
  const { chance, mult } = pvpSpellCrit(caster);
  return rolls() < chance ? harm * mult : harm;
}
