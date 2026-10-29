// @ts-check
// PVE-CAST (bible/05-Combat/Fixed-PvE.md section 5): THE MAGES' REWORK, ON A PVE FOE. A damage spell's landing is held
// to Destruction (live: trained, softcapped, and gear) x0.15, then crits as a blow does (combat/pcaao.js
// pcaaoCriticalStrike's chance and multiplier, read here - pcaao.js reaches back to systems/effects.js) and lands x1.1.
// The spell maker's level-scaled magnitude stops past what the skill pays. A new character's skill pays almost nothing,
// so a start of 15 sits on the hold and fades to none at level 30. Only MY spell at a foe that is no player, online
// (spellPower.js ownSpellAt): a duel's, a siege's and the arena's stand-ins are players. Ledger A (PVE-CAST).
import { SKILLS, skillValue } from '../skills.js';
import { isOnlinePage } from '../online/onlineLane.js';
import { effectiveLevel } from '../mentorMode.js';
import { liveStat } from '../statMods.js';
import { ownSpellAt } from './spellPower.js';

/** A landing's hold: this much of the school's live skill. */
export const PVE_CAST_PER_SKILL = 0.15;
/** The start on the hold at level 1, and the level it is gone by. */
export const PVE_CAST_START = 15;
export const PVE_CAST_START_GONE = 30;
/** What a landing is worth on a PvE foe. */
export const PVE_CAST_X = 1.1;

/** The start at `level`: whole at 1, none from PVE_CAST_START_GONE. */
export function pveCastStart(level) {
  const L = Math.max(1, Number.isFinite(level) ? level : 1);
  return L >= PVE_CAST_START_GONE ? 0 : (PVE_CAST_START * (PVE_CAST_START_GONE - L)) / (PVE_CAST_START_GONE - 1);
}

/** The most one landing of `caster`'s spell in `school` is, before the crit. @param {any} caster @param {number} [school] */
export const pveCastHold = (caster, school = /** @type {number} */ (SKILLS.Destruction)) =>
  PVE_CAST_PER_SKILL * Math.max(0, skillValue(caster, school)) + pveCastStart(effectiveLevel(caster));

/**
 * `n` landed by `caster`'s spell at `target`, under the rework - or null where the rework does not run (the caller keeps
 * its own law). Unrounded.
 * @param {number} n @param {any} caster @param {any} target
 * @param {{ school?: number|null, online?: boolean, rolls?: () => number }} [o]
 */
export function pveCastLanding(n, caster, target, { school = null, online = isOnlinePage(), rolls = Math.random } = {}) {
  if (!(n > 0) || !online || !ownSpellAt(caster, target)) return null;
  let v = Math.min(n, pveCastHold(caster, school ?? SKILLS.Destruction));
  const crit = skillValue(caster, SKILLS.CriticalStrike), luckTerm = Math.floor((liveStat(caster, 'luck') - 50) / 25);
  if (Math.floor(rolls() * 100) < Math.trunc(crit / (4 - luckTerm))) v *= Math.floor(crit / 5) * 0.05 + 1;
  return v * PVE_CAST_X;
}
