// @ts-check
// TECH1 (bible/05-Combat/Weapon-Techniques.md): A TECHNIQUE'S BLOW - the shape and the weight a weapon's technique
// carries into the two resolutions every host already shares: the swing (combat/playerWeapon.js resolveHit - every
// host's melee pool resolves through it) and the shaft (combat/arrowFlight.js playerArrowHitFoe - every host's player
// arrow lands through it). Neither grows a second performer: the swing still runs DFU's CalculateAttackDamage on every
// foe it reaches and each pool's own door still lands the number (its corpse, its crime, a puppet's owner); the blow
// only answers WHICH foes it reaches and WHAT the formula's number is weighed by - and (MARTIAL3) tells who listens that
// it landed. A leaf but for the one share law (combat/healthShare.js, itself a leaf).
//
// A blow (combat/techniques.js makes them):
//   { id, mult, wounded, toHit, reach, arc, lane, single, feet, yaw }
//   mult     the technique's multiplier at its line's power (techniqueRoster.js techniqueMult) - on the formula's damage
//   wounded  Headsman's Chop: this much more for a foe at no health, in proportion to what it has lost
//   toHit    the technique's own chance-to-hit term, added to the swing's (CalculateSwingModifiers' channel)
//   reach    metres from the feet to the foe's capsule edge (the 'view' arc: from the eye, DFU's own measure)
//   arc      'all' (every way), 'view' (DFU's camera view, MeleeDamage's own test) or a half-angle about `yaw` (radians)
//   lane     { from: [x, z], dir: [x, z] (unit), len, halfW } - a dash's path: every foe the body passed
//   single   the nearest foe it reaches alone
//   feet     where the strike is made from, in the host's frame; `yaw` the look's

import { healthShare } from '../healthShare.js';   // AUDIT FB1018f L3-5: Headsman's Chop reads a body's share by the one law

/** A foe's capsule (the DaggerfallEnemy prefab's controller radius) when its record states none. */
export const TECH_BODY_RADIUS = 0.45;
/** How far above or below the feet a technique's strike reaches (a foe on a step, a stair). */
export const TECH_REACH_UP = 2.2;
/** The foe at your feet is in every arc - a body this close is struck whichever way you face. */
export const TECH_POINT_BLANK = 0.6;

/** A body's radius (AUDIT TECH1): its record's own, or a big body's on its AI (the court's boss, a crystal, one of his
 *  host - dungeonContext.js's stand-ins keep it there), else a foe's capsule. */
export const bodyRadius = (foe) => (Number.isFinite(foe?.radius) ? foe.radius : Number.isFinite(foe?.ai?.radius) ? foe.ai.radius : TECH_BODY_RADIUS);

/** A body that is a player's - a duel's, a siege's or the open zone's (marked `duel` - world.js duelArrowTargets), or an
 *  arena rival's stand-in (`rival` - dungeonContext.js arenaRivalBody). A technique never meets one (TECH law 3): it is
 *  struck, if at all, as the plain swing or shot strikes it. */
export const playerBody = (foe) => !!foe && (foe.rival != null || foe.duel === true);

/**
 * Does the blow reach this foe? `sight` is the host's own test for it ({ dist, inView, losClear } - the eye's distance
 * to its capsule centre or a big body's surface, DFU's camera view, a clear line from the eye): nothing behind a wall
 * is ever struck.
 * @param {any} blow @param {any} foe @param {{ dist: number, inView: boolean, losClear: boolean }} sight
 */
export function blowReaches(blow, foe, sight) {
  if (!blow || !sight?.losClear) return false;
  const f = foe?.ai?.feet;
  const r = bodyRadius(foe);
  const level = (y) => !blow.feet || Math.abs(y - blow.feet[1]) <= TECH_REACH_UP;
  if (blow.lane) {
    if (!f || !level(f[1])) return false;
    const L = blow.lane, rx = f[0] - L.from[0], rz = f[2] - L.from[1];
    const along = rx * L.dir[0] + rz * L.dir[1];
    const across = Math.abs(rx * L.dir[1] - rz * L.dir[0]);
    return along >= -0.5 && along <= L.len + r && across <= L.halfW + r;
  }
  // AUDIT TECH1: a blow with a TARGET (Shadowstep's) is that foe's alone, all round within its reach - the dash lands it
  // behind the foe, and no view or other body decides it
  if (blow.target && foe !== blow.target) return false;
  const arc = blow.target ? 'all' : blow.arc;
  if (arc === 'view') return !!sight.inView && sight.dist <= blow.reach;
  if (!f || !blow.feet) return sight.dist <= blow.reach;
  const dx = f[0] - blow.feet[0], dz = f[2] - blow.feet[2], d = Math.hypot(dx, dz);
  // the capsule's edge within reach on the level - or, a big body (the court's boss), its surface by the host's own sight
  if (!((d - r <= blow.reach && level(f[1])) || sight.dist <= blow.reach)) return false;
  if (arc === 'all' || d < TECH_POINT_BLANK) return true;
  const cos = (dx * Math.sin(blow.yaw ?? 0) + dz * Math.cos(blow.yaw ?? 0)) / d;
  return cos >= Math.cos(/** @type {number} */ (blow.arc));
}

/** The blow's weight on this foe: its multiplier, and Headsman's Chop's share of what the foe has lost. AUDIT FB1018f L3-5:
 *  that share by the one law (combat/healthShare.js healthShare) - a body the relay runs by the relay's word of it, never its
 *  stand-in's 1e9 placeholder (whole, so the Chop gave nothing on any of them); none heard, whole, as before. */
export function blowMult(blow, foe) {
  let m = Number.isFinite(blow?.mult) ? blow.mult : 1;
  if (blow?.wounded > 0) m += blow.wounded * Math.max(0, Math.min(1, 1 - (healthShare(foe?.entity) ?? 1)));
  return m;
}

/** The formula's number weighed by the technique: a blow that landed lands for at least 1, a miss stays a miss. */
export const scaleBlowDamage = (damage, mult) => (damage > 0 ? Math.max(1, Math.round(damage * mult)) : damage);

// MARTIAL3 (bible/05-Combat/Martial-Specialisations.md section 6): A TECHNIQUE'S BLOW LANDED - NAMED listeners
// `fn({ blow, foe, damage })`, told by the two resolutions every host shares, once for each foe a technique's blow reached
// (its weighed number, a miss its 0), before the pool's own door lands it: the swing (combat/playerWeapon.js resolveHit)
// and the shaft (combat/arrowFlight.js playerArrowHitFoe). Never a player's body - neither resolution weighs one by a
// technique. `blow` is the technique's own (its `id`, and `use` - one token for every blow and shaft of one press,
// combat/techniques.js). The martial paths' riders answer it (systems/martialPowers.js). A list, a listener that throws is
// skipped.
/** @type {Array<[string, (landing: { blow: any, foe: any, damage: number }) => void]>} */
let _landed = [];
export function registerTechniqueLandedListener(name, fn) {
  _landed = _landed.filter(([n]) => n !== name);
  if (typeof fn === 'function') _landed.push([name, fn]);
}
/** A technique's blow reached `foe` for `damage` - every listener told. */
export function tellTechniqueLanded(blow, foe, damage) {
  if (!blow || _landed.length === 0) return;
  for (let i = 0; i < _landed.length; i++) { try { _landed[i][1]({ blow, foe, damage }); } catch { /* a listener is not the blow's problem */ } }
}

// AUDIT MARTIAL (L1 L3, L1 L7): A TECHNIQUE WENT - NAMED listeners `fn({ id, use, entity })`, told once a press, as its
// price is paid at the release (combat/techniques.js pay): `id` the technique's, `use` the press's token its blows carry,
// `entity` the body that paid. A path's rider whose words open a window "for N seconds" on the press opens it here - told
// at a landing, it opened mid-sweep (the cleave's own second foe took its +15%, its first not) and never on a whiff. A
// list, a listener that throws is skipped.
/** @type {Array<[string, (press: { id: string, use: any, entity: any }) => void]>} */
let _used = [];
export function registerTechniqueUsedListener(name, fn) {
  _used = _used.filter(([n]) => n !== name);
  if (typeof fn === 'function') _used.push([name, fn]);
}
/** Technique `id` went, its price paid by `entity` - every listener told. */
export function tellTechniqueUsed(id, use, entity) {
  if (_used.length === 0) return;
  for (let i = 0; i < _used.length; i++) { try { _used[i][1]({ id, use, entity }); } catch { /* a listener is not the press's problem */ } }
}
