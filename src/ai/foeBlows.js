// @ts-check
// TACT4 - TELEGRAPHED BLOWS (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Introducing new attack patterns
// and smaller telegraphed attacks (like our world boss) but not overdoing it"; his calls: one or two, tier-based -
// level 10 and up, or an elite foe).
//
// The world boss's language at a foe's scale: a short wind-up with its shape drawn on the ground where it will land,
// resolved by where the player's feet stand at the landing (net/gateStrike.js's law). Three shapes - the LUNGE (a short
// lane ahead), the SWEEP (a front cone), the SLAM (a disc just ahead) - one or two per family. A blow is the foe's own
// blow, delayed and shaped: at the landing the brain (ai/tactics.js) forces the swing, and the host's ordinary hit
// resolution asks `blowConnects` (the shape's verdict, in place of the reach test) and `blowScaled` (the shape's
// weight on DFU's own damage roll - armour, skill and all).
//
// Sparingly: a cooldown per foe, at most one wind-up near its mark at a time, only from a foe holding a melee token
// in reach (TACT2), only ever at the local player - or, on the arena's sand, a bout-mate (AUDIT ARENA-LADDER, ai/tactics.js
// blowAim). With the Enhanced AI switch off the brain never starts one, and both helpers answer the classic value.

import { tacticsNow } from './tacticsClock.js';   // AUDIT TACT: the foes' own time

export { BLOW, blowShapesOf, inBlow } from './blowShapes.js';   // the shapes' one home - a leaf the ground's pass reads too; AUDIT ARENA-LADDER: the families and the verdict too (the relay reads them)
import { BLOW, blowShapesOf } from './blowShapes.js';
export const BLOW_TIER_LEVEL = 10;      // Mac: level 10 and up, or an elite
export const BLOW_COOLDOWN_MIN = 8;     // seconds between one foe's blows
export const BLOW_COOLDOWN_MAX = 15;
export const BLOW_CHANCE = 1 / 10;      // a classic tick in reach with a token: the roll to wind one up
export const BLOW_NEAR = 20;            // at most one wind-up from any foe within this of the player
export const BLOW_FLASH = 0.3;          // the landing's flash on the ground (seconds)
export const BLOW_VERDICT_LIFE = 1;     // a verdict the swing never spent (a knock, a death) goes stale - a swing's own length
export const BLOW_STALE = 0.3;          // AUDIT TACT D4: a blow whose foe the brain has not seen this long (dead, gone, another host's) is gone

// The families (which shapes a kind may throw) and the landing's verdict (`inBlow`) live in ai/blowShapes.js - AUDIT
// ARENA-LADDER moved them to the leaf the relay can read, and they are handed on above.
/** Is this body of the tier that telegraphs (Mac: level 10 and up, or an elite)? */
export function blowTier(entity) {
  if (!entity) return false;
  return (entity.level ?? 0) >= BLOW_TIER_LEVEL || entity.elite === true || entity.eliteFoe === true;
}
/** Does this foe telegraph at all? */
export const throwsBlows = (entity) => blowTier(entity) && blowShapesOf(entity.mobileType).length > 0;

/** A blow wound up at `origin` facing `yaw` (atan2(dx, dz)), at `now`. */
export function makeBlow(kind, origin, yaw, now, color = null) {
  const P = BLOW[kind];
  return { kind, origin: [origin[0], origin[1], origin[2]], yaw, start: now, land: now + P.windup, mult: P.mult, color };
}

/**
 * AUDIT TACT D8: THE GROUND UNDER A BLOW. The mark is one flat quad; on a hillside or a stair it sank into the rise and
 * floated over the fall. So the ground is sampled under it - at its foot, 2 m ahead, 2 m across - and the quad tilts to
 * that plane: `origin`'s y the ground's, `slope` the rise per metre (across, along), each clamped to 1 (45 degrees).
 * No collider, or nothing under a sample: flat at the feet, as before.
 */
export function fitBlowToGround(b, collider) {
  if (!b || !collider?.raycast) return b;
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), wx = -fz, wz = fx;
  const at = (x, z) => { const d = collider.raycast([x, b.origin[1] + 2.5, z], DOWN, 5); return Number.isFinite(d) ? b.origin[1] + 2.5 - d : null; };   // a stair's rise 2 m off is within reach
  const h0 = at(b.origin[0], b.origin[2]);
  if (h0 == null) return b;
  const hf = at(b.origin[0] + fx * 2, b.origin[2] + fz * 2), hw = at(b.origin[0] + wx * 2, b.origin[2] + wz * 2);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  b.origin[1] = h0;
  b.slope = [hw == null ? 0 : clamp((hw - h0) / 2), hf == null ? 0 : clamp((hf - h0) / 2)];
  return b;
}
const DOWN = Object.freeze([0, -1, 0]);


/** The ground's own question: how far through its wind-up (0..1), and the landing's flash (1 at the landing, 0 after
 *  BLOW_FLASH) - null once it is gone. */
export function blowPhase(b, now) {
  if (!b) return null;
  if (now < b.land) return { t: Math.max(0, (now - b.start) / (b.land - b.start)), flash: 0 };
  const after = now - b.land;
  if (after > BLOW_FLASH) return null;
  return { t: 1, flash: 1 - after / BLOW_FLASH };
}

/** The live blows, by foe: the brain winds them up, the ground draws them. */
const _live = new Map();
export function liveBlows() { return _live; }
export function setLiveBlow(ai, b) { if (b) _live.set(ai, b); else _live.delete(ai); }
/** Is any foe winding up within BLOW_NEAR of `feet`? (one at a time near the player) */
export function windupNear(feet, now, except = null) {
  for (const [ai, b] of _live) {
    if (ai === except || now >= b.land || gone(ai, now)) continue;
    if (Math.hypot(b.origin[0] - feet[0], b.origin[2] - feet[2]) <= BLOW_NEAR) return true;
  }
  return false;
}
/** What the ground draws now: each live blow within `range` of `near` (the player's feet in the host's frame) with its
 *  phase; a blow past its flash is dropped from the registry here. */
/** AUDIT ARENA-LADDER: a blow wound up between two fighters on the sand (`b.sand`, ai/tactics.js) is drawn for the
 *  stands - the colosseum is 93 m end to end, and a watcher on its far tier is past the 40 m a street's blow is drawn. */
export const SAND_DRAW_RANGE = 100;
export function drawableBlows(now, near = null, range = 40) {
  const out = [];
  for (const [ai, b] of _live) {
    const phase = blowPhase(b, now);
    if (!phase || (now < b.land && gone(ai, now))) { _live.delete(ai); continue; }   // AUDIT TACT D4: a dead foe's wind-up goes with it
    if (near && Math.hypot(b.origin[0] - near[0], b.origin[2] - near[2]) > (b.sand ? Math.max(range, SAND_DRAW_RANGE) : range)) continue;
    out.push({ blow: b, phase });
  }
  return out;
}
/** AUDIT TACT D4: a blow whose foe is no longer stepped (dead, despawned, left behind in another host) is no one's. */
const gone = (ai, now) => ai?._tac?.seen != null && now - ai._tac.seen > BLOW_STALE;
/** AUDIT TACT D3: a floating-origin recentre moves every live wind-up with the world. */
export function offsetBlows(offset) {
  for (const b of _live.values()) { b.origin[0] += offset[0]; b.origin[1] += offset[1]; b.origin[2] += offset[2]; }
}
/** Tests: forget every blow. */
export function resetBlows() { _live.clear(); }

/**
 * The host's hit resolution, asked in place of its reach test: a foe whose telegraphed blow just landed answers the
 * shape's verdict (the feet in it, or out of it - dodged), once; any other swing answers `classic`.
 */
export function blowConnects(ai, classic, now = tacticsNow()) {
  const v = ai?._blowVerdict;
  if (v == null) return classic;
  const fresh = now == null || ai._blowAt == null || now - ai._blowAt <= BLOW_VERDICT_LIFE;
  // AUDIT ARENA-LADDER 2: a verdict is its mark's alone (`_blowFor`, the target key it landed on - ai/tactics.js): a foe
  // whose target changed between the landing and its damage frame (the motor turns on an attacker at once, the brain
  // only at its next tick) swings classically - a lunge landed on a bout-mate never decided a blow at me, nor mine one
  // at a foe in the street
  const turned = ai._blowFor !== undefined && !!_blowTargetOf && _blowTargetOf(ai) !== ai._blowFor;
  ai._blowVerdict = null;
  if (!fresh || turned) { ai._blowMult = undefined; return classic; }
  if (!v) { ai._blowMult = undefined; tellDodged(ai); }   // dodged: the weight is spent with it, and the dodge is told
  return v;
}
/** AUDIT ARENA-LADDER 2: the brain's own spelling of a foe's target (ai/tactics.js targetKey), registered upward - the
 *  brain imports this file. */
let _blowTargetOf = null;
export function setBlowTargetOf(fn) { _blowTargetOf = typeof fn === 'function' ? fn : null; }
/** AUDIT ARENA-LADDER: A DODGED BLOW IS A MISS - the hosts' hit resolution returns before DFU's damage roll on a dodge,
 *  so the formula's resolution observer (combat/formulas.js) never heard it: the arena's judges counted no miss for the
 *  fighter whose lunge was stepped out of, and its replay showed no swing. Keyed listeners (the formula's own shape):
 *  `fn(ai)` for the foe whose telegraphed blow was dodged. */
const _dodged = new Map();
export function registerBlowDodgedListener(name, fn) { if (typeof fn === 'function') _dodged.set(name, fn); else _dodged.delete(name); }
function tellDodged(ai) { for (const fn of _dodged.values()) { try { fn(ai); } catch { /* a listener's fault is not the blow's */ } } }
/** ...and its weight on the damage DFU rolled (spent once). */
export function blowScaled(ai, dmg) {
  const m = ai?._blowMult;
  if (m == null) return dmg;
  ai._blowMult = undefined;
  return dmg > 0 ? Math.max(1, Math.round(dmg * m)) : dmg;
}

/** The colour a blow is drawn in - the boss's weight, a foe's ember. */
export const BLOW_COLOR = Object.freeze([1.0, 0.42, 0.12]);
