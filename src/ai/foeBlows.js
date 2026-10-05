// @ts-check
// TACT4 - TELEGRAPHED BLOWS (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Introducing new attack patterns
// and smaller telegraphed attacks (like our world boss) but not overdoing it"; his calls: one or two, tier-based -
// level 10 and up, or an elite foe; since TELL7 a champion and a revenant too).
//
// The world boss's language at a foe's scale: a short wind-up with its shape drawn on the ground where it will land,
// resolved by where the player's feet stand at the landing (net/gateStrike.js's law). Three shapes at TACT4 - the LUNGE
// (a short lane ahead), the SWEEP (a front cone), the SLAM (a disc just ahead) - and four since TELL6 (the RING, the
// CHARGE, the LEAP, the AIMED shot: Feud-Arc.md 8.1), each family its own (ai/blowShapes.js). A blow is the foe's own
// blow, delayed and shaped: at the landing the brain (ai/tactics.js) forces the swing, and the host's ordinary hit
// resolution asks `blowConnects` (the shape's verdict, in place of the reach test) and `blowScaled` (the shape's
// weight on DFU's own damage roll - armour, skill and all).
//
// Sparingly: a cooldown per foe, at most one wind-up near its mark at a time, only from a foe holding a melee token
// in reach (TACT2; since TELL6 a charge and a leap from their own bands, an aimed shot from a bow's) - at the local
// player, a peer it hunts (TELL8: each client judging its own feet, ai/puppetBlows.js) or, on the arena's sand, a
// bout-mate (AUDIT ARENA-LADDER: judged where both fighters run), one at a time near each (ai/tactics.js targetFeet).
// With the Enhanced AI switch off the brain never starts one, and both helpers answer the classic value.

import { tacticsNow } from './tacticsClock.js';   // AUDIT TACT: the foes' own time
import { TELL, isElite } from './tells.js';   // TELL7: the tier, the cooldowns' one home

export { BLOW, blowShapesOf, blowFamily, extraShapesOf, inBlow } from './blowShapes.js';   // the shapes' one home - a leaf the ground's pass reads too; AUDIT ARENA-LADDER: the families and the verdict too (the relay reads them); TELL7's whole set beside them
import { BLOW, blowShapesOf, TELL_NEAR_M, TELL_NEAR_FLOOR, TELL_IRON_EXTRA, TELL_FEINT_FADE as FEINT_FADE } from './blowShapes.js';
export const BLOW_TIER_LEVEL = 10;      // Mac: level 10 and up, or an elite
export const BLOW_COOLDOWN_MIN = TELL.COOLDOWN.ordinary[0];   // seconds between one foe's blows (TELL7: an ordinary foe's; ai/tells.js blowCooldown by tier)
export const BLOW_COOLDOWN_MAX = TELL.COOLDOWN.ordinary[1];
export const BLOW_CHANCE = 1 / 10;      // a classic tick in reach with a token: the roll to wind one up
export const BLOW_NEAR = 20;            // at most one wind-up from any foe within this of the player
export const BLOW_FLASH = 0.3;          // the landing's flash on the ground (seconds)
export const BLOW_VERDICT_LIFE = 1;     // a verdict the swing never spent (a knock, a death) goes stale - a swing's own length
export const BLOW_STALE = 0.3;          // AUDIT TACT D4: a blow whose foe the brain has not seen this long (dead, gone, another host's) is gone

// The families (which shapes a kind may throw), TELL5's family, TELL7's whole set and the landing's verdict (`inBlow`)
// live in ai/blowShapes.js - AUDIT ARENA-LADDER moved them to the leaf the relay can read, and they are handed on above.
/** Is this body of the tier that telegraphs (Mac: level 10 and up, or an elite)? TELL7: a champion too, and a revenant
 *  at any level; the level is the entity's live one (Meaner Monsters' too, after its row). */
export function blowTier(entity) {
  if (!entity) return false;
  return (entity.level ?? 0) >= BLOW_TIER_LEVEL || isElite(entity) || !!entity.champion || !!entity.revenant;
}
/** Does this foe telegraph at all? */
export const throwsBlows = (entity) => blowTier(entity) && blowShapesOf(entity.mobileType, entity).length > 0;

/** A blow wound up at `origin` facing `yaw` (atan2(dx, dz)), at `now`. TELL3: its `guard` - 'poise' (TELL1's meter) or
 *  'iron' (no meter: it lands; its wind-up TELL_IRON_EXTRA longer). TELL5: `windup` its drawn length (ai/tells.js
 *  windupSeconds - iron's extra in it), or null for the shape's own. */
export function makeBlow(kind, origin, yaw, now, color = null, guard = 'poise', windup = null) {
  const P = BLOW[kind];
  const iron = guard === 'iron';
  const w = Number.isFinite(windup) && windup > 0 ? windup : P.windup + (iron ? TELL_IRON_EXTRA : 0);
  return { kind, origin: [origin[0], origin[1], origin[2]], yaw, start: now, land: now + w, mult: P.mult, color, guard: iron ? 'iron' : 'poise' };
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
  // a stair's rise 2 m off is within reach. TELL6c: the terrain too - outdoors the ground is no mesh, and a ray of meshes
  // alone met nothing there (Collider.surfaceHit: the nearer of a mesh and the ground)
  const at = (x, z) => { const o = [x, b.origin[1] + 2.5, z]; const d = collider.surfaceHit ? collider.surfaceHit(o, DOWN, 5)?.dist : collider.raycast(o, DOWN, 5); return Number.isFinite(d) ? b.origin[1] + 2.5 - d : null; };
  const h0 = at(b.origin[0], b.origin[2]);
  if (h0 == null) return b;
  const far = b.ahead > 2 ? b.ahead : 2;   // TELL6: a leap's disc lies on the ground at its point
  const hf = at(b.origin[0] + fx * far, b.origin[2] + fz * far), hw = at(b.origin[0] + wx * 2, b.origin[2] + wz * 2);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  b.origin[1] = h0;
  b.slope = [hw == null ? 0 : clamp((hw - h0) / 2), hf == null ? 0 : clamp((hf - h0) / far)];
  return b;
}
const DOWN = Object.freeze([0, -1, 0]);


/** The ground's own question: how far through its wind-up (0..1), and the landing's flash (1 at the landing, 0 after
 *  BLOW_FLASH) - null once it is gone. */
export function blowPhase(b, now) {
  if (!b) return null;
  if (b.cut != null) {   // TELL5: a feint cut - its fill frozen where it stopped, fading out dashed over FEINT_FADE
    const after = now - b.cut;
    if (after > FEINT_FADE || after < 0) return null;
    return { t: Math.max(0, Math.min(1, (b.cut - b.start) / (b.land - b.start))), flash: 0, cut: 1 - after / FEINT_FADE };
  }
  if (now < b.land) return { t: Math.max(0, (now - b.start) / (b.land - b.start)), flash: 0 };
  const after = now - b.land;
  if (after > BLOW_FLASH) return null;
  return { t: 1, flash: 1 - after / BLOW_FLASH };
}

/** The live blows, by foe: the brain winds them up, the ground draws them. */
const _live = new Map();
export function liveBlows() { return _live; }
export function setLiveBlow(ai, b) { if (b) _live.set(ai, b); else _live.delete(ai); }
/** AUDIT TELL (bible/12-Enhanced-AI/Feud-Arc.md 3.2, built at last): a wind-up its poise broke SHATTERS - its mark a
 *  white, cracked flash going out over BLOW_SHATTER, never a landing's look (which is white-hot and whole). */
export const BLOW_SHATTER = 0.25;
/** The shattering marks: `{ blow, at }`, drawn until BLOW_SHATTER past `at`. */
const _shards = [];
/** `ai`'s live wind-up broken by a blow on its poise: no longer live (setLiveBlow's null) and shattering from `now`. A
 *  cut feint or a blow at or past its landing has no mark to break. */
export function shatterBlow(ai, now) {
  const b = _live.get(ai);
  _live.delete(ai);
  if (b && b.cut == null && now < b.land) _shards.push({ blow: b, at: now });
}
/** Is any foe winding up within BLOW_NEAR of `feet`? (one at a time near the player) */
export function windupNear(feet, now, except = null) {
  for (const [ai, b] of _live) {
    if (ai === except || b.cut != null || gone(ai, now)) continue;   // TELL5: a cut feint is no wind-up
    if (now >= b.land && !(b.chainUntil > now) && !(b.dashUntil > now)) continue;   // TELL5: a landing about to chain is still its foe's one; TELL6: a charge running its lane too
    if (Math.hypot(b.origin[0] - feet[0], b.origin[2] - feet[2]) <= BLOW_NEAR) return true;
  }
  return false;
}
/** What the ground draws now: each live blow within `range` of `near` (the player's feet in the host's frame) with its
 *  phase, and TELL2's `nearFloor` - the fog's floor for a mark within TELL_NEAR_M of the player; a blow past its flash is
 *  dropped from the registry here. */
/** AUDIT ARENA-LADDER: a blow wound up between two fighters on the sand (`b.sand`, ai/tactics.js) is drawn for the
 *  stands - the colosseum is 93 m end to end, and a watcher on its far tier is past the 40 m a street's blow is drawn. */
export const SAND_DRAW_RANGE = 100;
export function drawableBlows(now, near = null, range = 40) {
  const out = [];
  for (const [ai, b] of _live) {
    const phase = blowPhase(b, now);
    if (!phase || (now < b.land && gone(ai, now))) { _live.delete(ai); continue; }   // AUDIT TACT D4: a dead foe's wind-up goes with it
    const d = near ? Math.hypot(b.origin[0] - near[0], b.origin[2] - near[2]) : Infinity;
    if (near && d > (b.sand ? Math.max(range, SAND_DRAW_RANGE) : range)) continue;
    out.push({ blow: b, phase, nearFloor: d <= TELL_NEAR_M ? TELL_NEAR_FLOOR : 0 });
  }
  for (let i = _shards.length - 1; i >= 0; i--) {   // AUDIT TELL (3.2): the broken ones, going out
    const { blow: b, at } = _shards[i];
    const after = now - at;
    if (!(after >= 0 && after <= BLOW_SHATTER)) { _shards.splice(i, 1); continue; }
    const d = near ? Math.hypot(b.origin[0] - near[0], b.origin[2] - near[2]) : Infinity;
    if (near && d > (b.sand ? Math.max(range, SAND_DRAW_RANGE) : range)) continue;
    const t = Math.max(0, Math.min(1, (at - b.start) / (b.land - b.start)));
    out.push({ blow: b, phase: { t, flash: 0, shatter: 1 - after / BLOW_SHATTER }, nearFloor: d <= TELL_NEAR_M ? TELL_NEAR_FLOOR : 0 });
  }
  return out;
}
/** AUDIT TACT D4: a blow whose foe is no longer stepped (dead, despawned, left behind in another host) is no one's. */
const gone = (ai, now) => ai?._tac?.seen != null && now - ai._tac.seen > BLOW_STALE;
/** AUDIT TACT D3: a floating-origin recentre moves every live wind-up with the world. */
export function offsetBlows(offset) {
  for (const b of [..._live.values(), ..._shards.map((x) => x.blow)]) { b.origin[0] += offset[0]; b.origin[1] += offset[1]; b.origin[2] += offset[2]; }   // AUDIT TELL: a shattering one too
}
/** Tests: forget every blow. */
export function resetBlows() { _live.clear(); _shards.length = 0; }

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
/** TELL3 (section 5): an iron blow's colour - its mark, its glint. Never by colour alone: the mark's second rim and its
 *  hatch (render/telegraphStyle.js) say it too. */
export const IRON_COLOR = Object.freeze([1.0, 0.12, 0.08]);
