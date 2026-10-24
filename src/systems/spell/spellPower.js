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
//   lines and powers, systems/loot/lootPowers.js), `registerSpellPierceMod` points off the target's saving throw.
//
// NEVER AT A PLAYER, NEVER A FOE'S. Only MY entity's spell (a player's, not a peer's stand-in) at a target that is no
// player: a refereed fight's stand-in is a player (combat/duelCombat.js duelStub), so the duel, the siege, the Wild Zone
// and the arena stand exactly where BAL8 left them; a foe's spell is its own (BAL3 keeps the place off a foe's spells).
//
// SCHOOLS2 (bible/06-Systems/Arcane-Specialisations.md section 4; the owner chose "each mastered school also pays past
// 100 in its own way, not just in price" - BAL9's open "other schools" call): THE SAME LAW FOR EVERY SCHOOL. schoolPotency
// reads any school's climb (Destruction's by default, BAL9b's own); systems/effects.js lands each school's in its own
// dimension - Restoration's heals, Alteration's Shield, Illusion's concealments and Thaumaturgy's wards on MYSELF
// (`schoolMult` with `self`), Mysticism's chances at a foe - and a signature spell reads the school it is cast in
// (spellcost.js castSchool). And SCHOOLS3's LANDED listeners: the cast engine's word that MY spell landed, which the
// paths' riders answer (systems/arcanePowers.js).
//
// Its imports: the skills' ids, the softcap's climb, the page's lane and the refereed fight's word (sigil.js). No leaf -
// sigil.js reaches some 145 files (the wire, the folds, the price; AUDIT SCHOOLS L5) - but none of them imports this
// file or systems/effects.js back, so effects.js reads it with no cycle.

import { SKILLS } from '../skills.js';
import { SKILL_SOFT_CAP, climbedSkill } from '../skillSoftcap.js';
import { isOnlinePage } from '../online/onlineLane.js';
import { sigilDueling } from '../sigil/sigil.js';   // SCHOOLS2: a self perk sleeps in a refereed fight, as every loot and set power does

/** Each effective point of Destruction past 100 is this much more damage (CLIMB-PAST's CLIMB_OVERCAP_SPEED_PER_POINT). */
export const DESTRUCTION_POTENCY_PER_POINT = 0.01;
/** SCHOOLS2: and every school's own - one law, one number. */
export const SCHOOL_POTENCY_PER_POINT = DESTRUCTION_POTENCY_PER_POINT;

/** MY spell at a target the port may strengthen: a player's own (no peer's stand-in), at no player. */
export const ownSpellAt = (caster, target) => !!caster?.isPlayer && !caster.peer && !!target && !target.isPlayer;
/** SCHOOLS2: MY spell on MYSELF - my own player entity, its own caster, and no refereed fight in progress. */
export const ownSpellOnSelf = (caster, target) => !!caster?.isPlayer && !caster.peer && caster === target && !sigilDueling();

/** The school past 100: 1 to 100, then 1% a point of the school's CLIMB (effective 140 at most: x1.4) - Destruction's
 *  unless `school` names another (SCHOOLS2). Online alone, and none while mentoring. */
export function schoolPotency(caster, { online = isOnlinePage(), school = SKILLS.Destruction } = {}) {
  if (!online || !caster?.isPlayer || caster._mentor) return 1;
  const climbed = climbedSkill(caster, school);
  return climbed > SKILL_SOFT_CAP ? 1 + (climbed - SKILL_SOFT_CAP) * SCHOOL_POTENCY_PER_POINT : 1;
}

/** SCHOOLS2: what `school` past 100 multiplies on MY spell landing on `target` - its potency where the target is mine to
 *  strengthen (`self`: myself, for a heal, a Shield, a concealment or a ward; else a foe, for a chance at it); 1 for
 *  anything else - a peer's stand-in's cast, a foe's, a gift landing on a party mate, a duel's opponent. */
export function schoolMult(caster, target, school, { self = false, ...opts } = {}) {
  if (!(self ? ownSpellOnSelf(caster, target) : ownSpellAt(caster, target))) return 1;
  return schoolPotency(caster, { ...opts, school });
}

const _power = new Map();
const _pierce = new Map();
/** FIRM1: the least a spell's damage is multiplied by, whatever its modifiers' percents add to (only a price - a
 *  Firmament keystone's - is ever below none). */
export const SPELL_POWER_FLOOR = 0.5;
/** Named modifiers, `fn(caster, target) -> percent` more damage (FIRM1: or less, below none). A non-function removes the name. */
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
    if (Number.isFinite(v) && v !== 0) pct += v;   // FIRM1: a keystone's price may be a percent LESS (Martyr's Vow)
  }
  return schoolPotency(caster, opts) * Math.max(SPELL_POWER_FLOOR, 1 + pct / 100);
}

/** SCHOOLS3: named listeners told when MY spell LANDED - `fn({ caster, target, foe, spell, r, self, reflected, took,
 *  cast })`: `r` the landing's answer (systems/effects.js applySpell's); `foe` the door's record of the target (null on
 *  a relay's stand-in, whose body the relay holds); `self` true for my own cast on me, `reflected` for my spell a foe
 *  turned back at me; `took` what the target could lose (never the overkill past its health); `cast` the cast's token
 *  (`{ cost }`, the magicka it took - one token for every landing of one cast; null for a landing no cast released, a
 *  Cast When Strikes proc's). The cast engine tells them (scenes/hostMagic.js applySpellToFoe, applySpellToPlayer) - the
 *  one engine every host casts through - and the relay's stand-ins (scenes/gate/standInSpell.js tellStandIn - what can land
 *  there, FIELD BUGS 2026-10-19f STAND-IN-WHOLE; and the sea serpent's door, createSerpentSpell, out of bootWorld by BOSS-DOT -
 *  what a hand's purse can land, SERPENT_HIT_CAP_X of SERPENT_HAND_REF: 21). A non-function removes the name; one that throws is skipped. */
const _landed = new Map();
export function registerSpellLandedListener(name, fn) { if (typeof fn === 'function') _landed.set(name, fn); else _landed.delete(name); }
export function tellSpellLanded(info) {
  for (const fn of _landed.values()) { try { fn(info); } catch { /* a rider is not the cast's problem */ } }
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
