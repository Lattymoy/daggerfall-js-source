// BAL9 (2026-10-12, the owner: "I think destruction needs a buff. A lot of players saying its lack luster";
// bible/05-Combat/Balance-Arc.md section 15). A PLAYER'S SPELL POWER - what a Destruction spell's damage is worth past
// Daggerfall's own magnitude. DFU rolls a damage spell's magnitude off the caster's LEVEL alone (EntityEffect.
// GetMagnitude); the school's skill prices the spell and moves nothing else. Two things here are the port's:
//
//   THE SCHOOL PAST 100 IS ITS POTENCY. Online a mastered school reads past 100 (SOFTCAP1, effective 140 at 200) and
//   SPELL-COST-PAST prices those points at 100 / skill - every one still cheaper, none free - while the same mastery
//   raises the foes (skillSoftcap.js combatEdge): a Destruction mastered to 200 paid x0.58 for a Crypt's foes at x1.30
//   health. CLIMB-PAST's law, for the school whose formula stops paying at 100: each effective point past it is 1% more
//   damage, to the effective cap (x1.4 at 140). The CLIMB alone (skillSoftcap.js climbedSkill) - what the foes' edge
//   reads, so the climb that raises them is the climb that pays: a worn Destruction line already pays in price (the
//   live value SPELL-COST-PAST reads) and strikes no harder. None while mentoring, as the edge is none. Offline
//   Daggerfall's price term stands (to nothing at 110), and so does Daggerfall's damage.
//
//   THE PORT'S MODIFIERS. Named registries, as SET2's spell-cost modifiers (systems/spellcost.js registerSpellCostMod)
//   and CAST-SPEED's rate (systems/castSpeed.js): `registerSpellPowerMod` a percent onto the damage (the loot's potency
//   lines and powers, systems/lootPowers.js), `registerSpellPierceMod` points off the target's saving throw.
//
// NEVER AT A PLAYER, NEVER A FOE'S. Only MY entity's spell (a player's, not a peer's stand-in) at a target that is no
// player: a refereed fight's stand-in is a player (combat/duelCombat.js duelStub), so the duel, the siege, the Wild Zone
// and the arena stand exactly where BAL8 left them; a foe's spell is its own (BAL3 keeps the place off a foe's spells).
//
// A leaf: the skills' ids, the softcap's climb and the page's lane, so systems/effects.js reads it with no cycle.

import { SKILLS } from './skills.js';
import { SKILL_SOFT_CAP, climbedSkill } from './skillSoftcap.js';
import { isOnlinePage } from './onlineLane.js';

/** Each effective point of Destruction past 100 is this much more damage (CLIMB-PAST's CLIMB_OVERCAP_SPEED_PER_POINT). */
export const DESTRUCTION_POTENCY_PER_POINT = 0.01;

/** MY spell at a target the port may strengthen: a player's own (no peer's stand-in), at no player. */
export const ownSpellAt = (caster, target) => !!caster?.isPlayer && !caster.peer && !!target && !target.isPlayer;

/** The school past 100: 1 to 100, then 1% a point of Destruction's CLIMB (effective 140 at most: x1.4). Online alone, and
 *  none while mentoring. */
export function schoolPotency(caster, { online = isOnlinePage() } = {}) {
  if (!online || !caster?.isPlayer || caster._mentor) return 1;
  const climbed = climbedSkill(caster, SKILLS.Destruction);
  return climbed > SKILL_SOFT_CAP ? 1 + (climbed - SKILL_SOFT_CAP) * DESTRUCTION_POTENCY_PER_POINT : 1;
}

const _power = new Map();
const _pierce = new Map();
/** Named modifiers, `fn(caster, target) -> percent` more damage. A non-function removes the name. */
export function registerSpellPowerMod(name, fn) { if (typeof fn === 'function') _power.set(name, fn); else _power.delete(name); }
/** Named modifiers, `fn(caster, target) -> points` off the target's saving throw. A non-function removes the name. */
export function registerSpellPierceMod(name, fn) { if (typeof fn === 'function') _pierce.set(name, fn); else _pierce.delete(name); }

/** The multiplier on MY damage spell's landed amount: the school past 100, times every modifier's percent. 1 for
 *  anything that is not my spell at a target the port may strengthen. */
export function spellPowerMult(caster, target, opts = {}) {
  if (!ownSpellAt(caster, target)) return 1;
  let pct = 0;
  for (const fn of _power.values()) {
    const v = fn(caster, target);
    if (Number.isFinite(v) && v > 0) pct += v;
  }
  return schoolPotency(caster, opts) * (1 + pct / 100);
}

/** The points MY damage spell takes off the target's saving throw - never negative, none but my own at no player. */
export function spellPierce(caster, target) {
  if (!ownSpellAt(caster, target)) return 0;
  let n = 0;
  for (const fn of _pierce.values()) {
    const v = fn(caster, target);
    if (Number.isFinite(v) && v > 0) n += v;
  }
  return n;
}
