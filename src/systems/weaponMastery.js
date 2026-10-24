// @ts-check
// MARTIAL2 (2026-10-17) - THE WEAPON PAST 100. bible/05-Combat/Martial-Specialisations.md section 4.
//
// Measured first (the page's section 2): past 100 a weapon skill bought its TO-HIT alone - PCAAO's `ceil(skill * 1.5)`
// and DFU's `skill` - against a chance clamped at 97, so a Long Blade mastered to 200 struck an armoured Orc Warlord no
// harder and no more often than at 100. Hand-to-Hand alone kept paying, its damage read off the skill (formulas.js
// handToHandMinDamage / MaxDamage: 11-21 at 100, 15-29 at effective 140). The schools' climb had paid in price alone
// until BAL9b and SCHOOLS2 made it pay in each school's own dimension; the owner chose the same for the weapons ("Past-100
// perk per weapon"). So, BAL9b's law for every weapon whose formula stops paying at 100 - each effective point of the
// skill's CLIMB past 100 (skillSoftcap.js climbedSkill - the climb the foes' edge reads, so the climb that raises them is
// the climb that pays) is worth this, to effective 140 at 200:
//
//   Long Blade    every blow 1% harder (x1.4)                                   the WEAPON BLOW modifier
//   Archery       every arrow 1% harder (x1.4) - the Thunderlock's shot too,     the WEAPON BLOW modifier
//                 scored on Archery (its departure)
//   Axe           a blow at a foe under half its health 2% harder (x1.8):        the WEAPON BLOW modifier
//                 the axe finishes
//   Blunt Weapon  a blow at a foe at half its health or more 2% harder (x1.8):   the WEAPON BLOW modifier
//                 the hammer opens
//   Short Blade   every swing 1% quicker (x1.4 the swings) - never past the      the SWING PACE (characters/weaponStates.js)
//                 swing law's floor of 0.45 s a swing (SWING_FRAME_MIN)
//   Hand-to-Hand  nothing more - its formula reads the climb in its damage already
//
// The two halves of a fight read as one: a foe killed from full health by a blow of one size takes its first half at x1
// and its second at x1.8 (the Axe) - x1.29 over the fight - so the heavy two-handers, which lead the six raw (a War Axe
// 15.2 a second at Strength 80, a Warhammer 15.7, a Longsword 12.6), climb a little less than the sword does.
//
// Online alone, as BAL9b and SCHOOLS2: offline the game is Daggerfall's, and so is the weapon past 100. MY blow (a
// player's own, no peer's stand-in) at a foe - never a player (a refereed fight's stand-in is a player: combat/
// duelCombat.js duelStub), never the Warden's ward, never in a refereed fight (sigil.js sigilDueling), never while
// mentoring (the edge reads no climb then either), never the beast's claws (BAL6 balanced the curse on its own claws).

import { SKILLS } from './skills.js';
import { SKILL_SOFT_CAP, climbedSkill } from './skillSoftcap.js';
import { isOnlinePage } from './online/onlineLane.js';
import { sigilDueling } from './sigil/sigil.js';
import { SCHOOL_POTENCY_PER_POINT } from './spell/spellPower.js';   // CLIMB-PAST's one number: a point past 100 is 1%
import { registerWeaponBlowMod } from './entityMods.js';
import { registerSwingPaceMod } from '../characters/weaponStates.js';
import { swingFamily } from '../combat/swingLaw.js';   // AUDIT MARTIAL L2 F3: the swing's family, no record built
import { techniqueFamily } from '../combat/technique/techniqueRoster.js';
import { healthShare } from '../combat/healthShare.js';   // FIELD BUGS 2026-10-18f RELAY-SHARE: a body's share of its health, the one law

/** Each effective point of a weapon's climb past 100 is this much more of what it does (BAL9b's per point). */
export const WEAPON_POTENCY_PER_POINT = SCHOOL_POTENCY_PER_POINT;
/** The Axe's and the Blunt Weapon's: twice that, on their half of a foe's health. */
export const WEAPON_HALF_PER_POINT = 2 * WEAPON_POTENCY_PER_POINT;
/** The line between the two halves: a share of the foe's health. */
export const WEAPON_HALF_LINE = 0.5;

/** The skill a blow is struck with, by its family (combat/technique/techniqueRoster.js techniqueFamily - an RRI class's
 *  own included): the bare hand Hand-to-Hand, the Thunderlock Archery (it is scored on it). Null for anything else. */
const SKILL_OF_FAMILY = Object.freeze({
  longBlade: SKILLS.LongBlade, shortBlade: SKILLS.ShortBlade, axe: SKILLS.Axe, blunt: SKILLS.BluntWeapon,
  archery: SKILLS.Archery, thunderlock: SKILLS.Archery, handToHand: SKILLS.HandToHand,
});
export const blowSkillOf = (weapon) => (weapon ? SKILL_OF_FAMILY[techniqueFamily(weapon) ?? ''] ?? null : SKILLS.HandToHand);

/** The effective points of `skill`'s CLIMB past 100 that pay for `entity` now (0 to 40): mine, online, not mentoring,
 *  not the beast. */
export function weaponClimb(entity, skill, { online = isOnlinePage() } = {}) {
  if (!online || !entity?.isPlayer || entity.peer || entity._mentor || entity.isInBeastForm || !Number.isInteger(skill)) return 0;
  const c = climbedSkill(entity, skill);
  return c > SKILL_SOFT_CAP ? c - SKILL_SOFT_CAP : 0;
}

/** The struck foe's share of its health - null where this machine cannot know it: a body the relay runs, its health here
 *  a placeholder nothing empties (world/gate/gateBoss.js bossStandIn `relayHealth` - the Warden, his crystals and host,
 *  the Remnant, the Elite Gates' court, the sea serpent), with no word of its own heard. AUDIT MARTIAL L3 F2: read as
 *  full, the hammer took its x1.8 on every blow of a boss fight and the axe never its own. FIELD BUGS 2026-10-18f
 *  RELAY-SHARE: the one law (combat/healthShare.js) - such a body now reads the relay's own word of its health (its
 *  stand-in's owner's reader), so each half pays its own there too, and the mean only where no word is heard. */
const shareOf = healthShare;
/** The percent MY blow with `weapon` at `target` lands harder for its skill past 100 (0 for a blow it does not pay). */
export function weaponPastPct(weapon, attacker, target, opts = {}) {
  const skill = blowSkillOf(weapon);
  const climb = weaponClimb(attacker, skill, opts);
  if (!(climb > 0)) return 0;
  switch (skill) {
    case SKILLS.LongBlade: case SKILLS.Archery: return climb * (WEAPON_POTENCY_PER_POINT * 100);
    case SKILLS.Axe: case SKILLS.BluntWeapon: {
      const share = shareOf(target);
      if (share === null) return climb * (WEAPON_POTENCY_PER_POINT * 100);   // the line unread: the halves' mean (x1.4), the sword's own
      return (skill === SKILLS.Axe ? share < WEAPON_HALF_LINE : share >= WEAPON_HALF_LINE) ? climb * (WEAPON_HALF_PER_POINT * 100) : 0;
    }
    default: return 0;
  }
}

/** The fraction a percent of a blow leaves, carried to the next, by weapon (or by my fists). */
let _carry = new WeakMap();
/** THE BLOW: my blow at a foe, its skill past 100 - the fraction carried, never past the blow's whole. */
export function weaponMasteryBlow(weapon, damage, attacker, target, info = null) {
  if (!(damage > 0) || !attacker?.isPlayer || attacker.peer || !target || target.isPlayer || target.warded || sigilDueling()) return damage;
  const pct = weaponPastPct(weapon, attacker, target);
  if (!(pct > 0)) return damage;
  const key = weapon ?? attacker;
  const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
  const more = Math.floor(exact + 1e-9);
  if (!info?.estimate) _carry.set(key, Math.max(0, exact - more));   // AUDIT MARTIAL L2 F7: the Stats page's estimate keeps nothing
  return damage + more;
}

/** THE PACE: a short blade's swing, its skill past 100 - 1% quicker a point. `w` the swing reader's answer
 *  (combat/swingLaw.js readSwing), read here only once a climb would pay (AUDIT MARTIAL L2 F3). */
export function weaponMasteryPace(ctx, w) {
  if (sigilDueling()) return 0;
  const climb = weaponClimb(ctx?.entity, SKILLS.ShortBlade);
  if (!(climb > 0)) return 0;
  return (w ? w.family : swingFamily(ctx)) === 'shortBlade' ? climb * (WEAPON_POTENCY_PER_POINT * 100) : 0;
}

export const WEAPON_MASTERY = 'weaponMastery';
registerWeaponBlowMod(WEAPON_MASTERY, weaponMasteryBlow);
registerSwingPaceMod(WEAPON_MASTERY, weaponMasteryPace);

/** Tests only: no fraction carried. */
export function _resetWeaponMasteryForTests() { _carry = new WeakMap(); }
