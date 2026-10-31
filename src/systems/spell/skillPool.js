// @ts-check
// SPELL-SKILL POOL (bible/05-Combat/Fixed-PvE.md section 13, 2026-10-30: half cost, a pool that grows with
// skill/2): A MAGE'S POOL GROWS WITH THE SCHOOL. Under fixed PvE a spell's Magicka grows with its power, and a pool of
// Intelligence x the class multiplier alone held 3 to 9 casts. My pool gains half a per cent of Daggerfall's own
// maximum for each point of my best magic school's live skill, through the folds' magicka channel (entityMods.js,
// renownLayer.js foldMpOf) - online, never saved. Off with fixed PvE. Ledger A (FIXED-PVE).
import { registerEntityFold } from '../entityMods.js';
import { skillValue, SKILLS } from '../skills.js';
import { spellPoints, spellPointMultiplier } from '../chargen.js';
import { liveStat } from '../statMods.js';
import { skillCasts } from './castLevel.js';

/** The share of the pool each point of the best school adds. */
export const POOL_PER_SKILL = 0.005;
export const MAGIC_SCHOOLS = Object.freeze([SKILLS.Destruction, SKILLS.Restoration, SKILLS.Illusion, SKILLS.Alteration, SKILLS.Thaumaturgy, SKILLS.Mysticism]);

/** My best magic school's live skill. @param {any} e */
export const bestSchool = (e) => Math.max(0, ...MAGIC_SCHOOLS.map((id) => skillValue(e, id) || 0));

/** The Magicka my school adds to my pool: 0 with the switch off, for a foe, or with no career. @param {any} e @param {{ on?: boolean }} [o] */
export function skillPoolMp(e, o = {}) {
  if (!skillCasts(e, o) || !e.career) return 0;
  const raw = spellPoints(liveStat(e, 'intelligence'), spellPointMultiplier(e.career.abilityFlagsAndSpellPointsBitfield ?? 0x1000));
  return Math.max(0, Math.trunc(raw * POOL_PER_SKILL * bestSchool(e)));
}

export const SKILL_POOL_FOLD = 'spellSkillPool';
registerEntityFold(SKILL_POOL_FOLD, (e) => { const mp = skillPoolMp(e); return mp ? { magicka: mp } : null; });
