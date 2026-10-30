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

// PVP-CAST-SKILL (2026-10-30: "it was ment to scale with skill", "magic scaled to 875 in dustruction"): PvE's mages'
// rework (PVE-CAST) at a player - a harmful spell lands at most 0.15 x the caster's live Destruction, gear counted and no
// ceiling, before the crit; the bar's Damage is sized to it (systems/wild/pvpKit.js), so damage is the skill's.
export const PVP_CAST_PER_SKILL = 0.15;
/** The most one cast of `caster`'s lands at a player before the crit. */
export const pvpCastHold = (caster) => PVP_CAST_PER_SKILL * Math.max(0, skillValue(caster, SKILLS.Destruction) || 0);

/** `harm` after one crit roll of `caster`'s. */
export function pvpCritHarm(harm, caster, rolls = Math.random) {
  if (!(harm > 0) || !caster) return harm;
  const { chance, mult } = pvpSpellCrit(caster);
  return rolls() < chance ? harm * mult : harm;
}
