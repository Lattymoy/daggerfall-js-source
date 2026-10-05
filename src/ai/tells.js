// @ts-check
// TELL1 - POISE AND THE STAGGER (bible/12-Enhanced-AI/Feud-Arc.md section 3; Mac, 2026-10-04: "player's can easily stun
// these enemies and breath more depth into it", then "Go" on every call of the arc).
//
// Before this, one landed hit of anything cancelled any telegraphed wind-up for free: every damaging weapon hit writes
// DFU's knockback (floored at 15 classic units, three times the hurt threshold) and the brain broke the wind-up on any
// knock, at the cost of the blow's cooldown alone. Now a foe WINDING UP holds through a blow - no shove, no Hurt - and
// the blow's WEIGHT fills its POISE meter; at its poise the wind-up BREAKS and the foe is STAGGERED: helpless for about
// a second, taking a quarter more from every blow. A heavy weapon, a blow at its back (and a revenant's weakness, RVN3)
// weigh more; a dagger rarely breaks a giant.
//
// The law here; the meter and the stagger on the brain (ai/tactics.js windupStruck), the doors in the pools.
// Outside a wind-up nothing here is asked: DFU's knockback, to the bit. The Enhanced AI switch off, no wind-up exists.

import { weaponSkillUsed } from '../characters/weapons.js';
import { SKILLS } from '../systems/skills.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { TELL_NOW, TELL_NEAR_M, TELL_NEAR_FLOOR, TELL_IRON_EXTRA, TELL_FEINT_FADE, isElite, wholeSet } from './blowShapes.js';   // TELL2: the ground's numbers, homed in the leaf the renderer reads; TELL3: the iron wind-up's extra

/** Every TELL number on one table (section 27). Seconds, shares, multipliers. */
export const TELL = Object.freeze({
  // the poise: a share of the kind's own health, by DFU's weight (classic units, formulas.enemyWeightClassicUnits)
  POISE_W: Object.freeze({ light: 0.2, medium: 0.3, heavy: 0.4, massive: 0.5 }),
  WEIGHT_MEDIUM: 200,
  WEIGHT_HEAVY: 700,
  WEIGHT_MASSIVE: 1500,
  // AUDIT TELL (the duel harness, tools/tellDuel.mjs - section 28's MASSIVE): a massive foe's poise is never under this,
  // whatever its health rolled - a Giant rolls 18 to 74, and at 0.5 of that the largest single front blow in the game
  // (a daedric warhammer at Strength 100: 34 x 1.725 = 58.6) broke most of them, a reference player's steel one (31)
  // half of them. The mass is the kind's, not the roll's.
  POISE_FLOOR_MASSIVE: 60,
  // ...and by what the foe is
  POISE_ELITE: 1.5,             // an elite (eliteFoes.js, `eliteFoe`)
  POISE_ELITE_DUNGEON: 1.25,    // an Elite Dungeon's foe (`elite`)
  POISE_CHAMPION: 1.25,         // a LOOT7 champion...
  POISE_STALWART: 1.5,          // ...a Stalwart one
  POISE_REVENANT_RANK: 0.1,     // a revenant, +0.1 a rank
  // a blow's weight: its damage by its kind
  K_BLUNT: 1.5,
  K_AXE: 1.25,
  K_LONG_BLADE: 1.0,
  K_SHORT_BLADE: 0.7,
  K_HANDS: 0.6,
  K_CLAWS: 1.0,                 // a werebeast's, or a monster's own
  K_TWO_HANDED: 1.15,           // on top of its class
  K_ARROW: 0.5,
  K_SPELL: 0.75,                // a spell's landing; its later rounds weigh nothing
  K_PEER: 1,                    // a peer's relayed blow (TELL8 carries its class)
  POISE_BACK: 1.5,              // a blow from behind the wind-up's locked facing...
  BACK_DEG: 110,                // ...more than this far off it (TACT's BACK_TURNED_DEG)
  POISE_WEAK: 2,                // a revenant's weakness (RVN3)
  // the stagger
  STAGGER_S: Object.freeze({ light: 1.4, medium: 1.2, heavy: 1.0, massive: 0.8 }),
  STAGGER_KNOCK: 1.5,           // the breaking blow's withheld knockback, written at this
  STAGGER_TAKEN: 1.25,          // every blow a staggered foe takes
  STAGGER_IMMUNE: 3,            // no new stagger for this long after one ends
  // TELL2: the tell - the glint on the body, the cues in the ear, the ground near the player
  GLINT_PULSE: 0.9,             // the glint's flare as the wind-up begins...
  GLINT_PULSE_S: 0.15,          // ...falling to the steady rim over this long
  GLINT_STEADY: 0.2,            // the rim through the wind-up
  TELL_NOW,                     // the last stretch before the landing: the glint rises to full ("now") - ai/blowShapes.js
  GLINT_REDUCED: 0.45,          // reduced motion: one steady rim, no pulses
  RELEASE_LEAD: 0.25,           // the release's whoosh this long before the landing
  WIND_PITCH: 0.85,             // the kind's bark as it winds up
  WIND_CLASS_PITCH: 0.6,        // ...a person's (muted by DFU): a low swing
  WIND_CLASS_VOLUME: 0.6,
  RELEASE_PITCH: 0.45,
  NEAR_M: TELL_NEAR_M,          // a wind-up this near the player... (ai/blowShapes.js)
  NEAR_FLOOR: TELL_NEAR_FLOOR,  // ...draws at no less than this through the fog
  // TELL3: iron blows - no poise; they land
  IRON_SHAPES: Object.freeze(['slam', 'ring']),   // a heavy or massive body's iron shapes (the ring is TELL6's)
  IRON_ELITE: 1 / 3,            // an elite's blow is iron one time in this
  IRON_EXTRA: TELL_IRON_EXTRA,  // an iron wind-up runs this much longer (ai/blowShapes.js)
  // TELL4: the punish window and the perfect dodge
  PUNISH_S: Object.freeze({ lunge: 1.0, sweep: 0.8, slam: 1.2, ring: 1.0, charge: 1.4, leap: 1.2 }),   // a missed blow's overreach
  PUNISH_IRON: 0.3,             // ...an iron one's, this much longer
  PUNISH_TAKEN: 1.3,            // every blow an overreached foe takes
  TELL_LATE: 0.25,              // the feet sampled this long before the landing: inside then, outside at it, a perfect dodge
  PERFECT_WINDOW: 1.5,          // ...whose window is this much longer
  PERFECT_PITCH: 1.25,          // ...and whose parry ring is bright (SOUND.Parry6)
  // TELL5: patterns - the length, the tracking, the feint, the chain
  WINDUP_VARY: Object.freeze([0.9, 1.25]),   // a wind-up's length: its shape's times U(these), drawn at its start
  WINDUP_ELITE: 0.9,            // ...an elite's times this
  WINDUP_RANK: 0.03,            // ...a revenant's less this a rank
  TELL_MIN_WINDUP: 0.55,        // ...never under this (iron's extra after)
  TRACKERS: Object.freeze(['lunge', 'charge']),   // the shapes that turn after their target
  TRACK_RATE: 120,              // degrees a second
  TRACK_SHARE: 0.5,             // through this share of the wind-up, then locked
  FEINT_CHANCE: 1 / 5,          // a higher-tier blade's wind-up, one in this
  FEINT_AT: 0.55,               // the mark fills to here, then is cut
  FEINT_GAP: 3,                 // never two feints within this many wind-ups
  FEINT_FADE: TELL_FEINT_FADE,  // the cut mark fades out dashed over this (ai/blowShapes.js)
  CHAIN_CHANCE: 0.35,           // at a landing, a second blow at once
  CHAIN_WINDUP: 0.5,            // its wind-up...
  CHAIN_FLOOR: 0.45,            // ...never under this
  CHAIN_GAP: 0.15,              // the landing's strike drawn before the chain winds up (a frame step and a margin)
  CHAIN_NEXT: Object.freeze({ sweep: 'lunge', lunge: 'sweep', slam: 'sweep', ring: 'slam' }),   // a sweep then a lunge; a slam then a sweep; a ring then a slam
  // TELL7: the cooldowns by tier (seconds between one foe's blows)
  COOLDOWN: Object.freeze({ ordinary: Object.freeze([8, 15]), champion: Object.freeze([7, 13]), elite: Object.freeze([6, 11]) }),
  COOLDOWN_RANK: 0.08,          // a revenant's, less this a rank
  // TELL6d: the aimed shot
  AIMED_SHARE: 1 / 3,           // an archer of the whole set's shots aimed, one in this
});

/** The weight class of a foe of `weight` classic units. */
export function weightClass(weight) {
  const w = Number.isFinite(weight) ? weight : 0;
  if (w >= TELL.WEIGHT_MASSIVE) return 'massive';
  if (w >= TELL.WEIGHT_HEAVY) return 'heavy';
  if (w >= TELL.WEIGHT_MEDIUM) return 'medium';
  return 'light';
}

/** The kind's own maximum health: `maxHealth` over every special multiplier stood on it (`healthMult`, written by
 *  each one - an elite's, a champion's, an Elite Dungeon's, a revenant's rank). */
export function kindHealth(entity) {
  const m = Number.isFinite(entity?.healthMult) && entity.healthMult > 0 ? entity.healthMult : 1;
  return Math.max(1, (entity?.maxHealth || 1) / m);
}

/** What the foe is, on its poise. */
export function poiseSpecial(entity) {
  if (!entity) return 1;
  let s = 1;
  if (entity.eliteFoe === true) s *= TELL.POISE_ELITE;
  else if (entity.elite === true) s *= TELL.POISE_ELITE_DUNGEON;
  if (entity.champion) s *= entity.champion === 'stalwart' ? TELL.POISE_STALWART : TELL.POISE_CHAMPION;
  const rank = entity.revenant?.rank | 0;
  if (rank > 0) s *= 1 + TELL.POISE_REVENANT_RANK * rank;
  const edge = entity.revenant?.edge?.poise;   // RVN2: Braced, Steadfast (systems/revenantFeud.js ADAPT)
  if (edge > 0) s *= edge;
  return s;
}

/** P: the poise of a foe (its entity; DFU's `weight`, classic units, kit and all). AUDIT TELL: a massive one's at least
 *  POISE_FLOOR_MASSIVE before what it is. */
export function poiseOf(entity, weight) {
  const c = weightClass(weight);
  const base = kindHealth(entity) * TELL.POISE_W[c];
  return (c === 'massive' ? Math.max(base, TELL.POISE_FLOOR_MASSIVE) : base) * poiseSpecial(entity);
}

/** How long a foe of `weight` stays staggered (seconds). */
export const staggerSeconds = (weight) => TELL.STAGGER_S[weightClass(weight)];

/**
 * K: a blow's weight by its kind and its weapon. `kind` the door's ('melee', 'arrow', 'spell'); `weapon` the striking
 * item (null bare-handed); `claws` a striker that fights with its own body (a monster, a werebeast in its form);
 * `round` a spell's later round; `peer` a blow relayed from another client. Anything else (a fall, a poison's tick)
 * weighs nothing.
 */
export function blowK({ kind = 'melee', weapon = null, claws = false, round = false, peer = false } = {}) {
  if (kind === 'spell') return round ? 0 : TELL.K_SPELL;
  if (peer) return TELL.K_PEER;
  if (kind === 'arrow') return TELL.K_ARROW;
  if (kind !== 'melee') return 0;
  if (!weapon) return claws ? TELL.K_CLAWS : TELL.K_HANDS;
  const skill = Number.isInteger(weapon.templateIndex) ? weaponSkillUsed(weapon.templateIndex) : null;
  let k;
  switch (skill) {
    case SKILLS.BluntWeapon: k = TELL.K_BLUNT; break;
    case SKILLS.Axe: k = TELL.K_AXE; break;
    case SKILLS.LongBlade: k = TELL.K_LONG_BLADE; break;
    case SKILLS.ShortBlade: k = TELL.K_SHORT_BLADE; break;
    case SKILLS.Archery: return TELL.K_ARROW;   // a bow swung, or a shaft a foe loosed (its blow carries the bow)
    default: k = TELL.K_LONG_BLADE;   // a weapon the table does not know: a sword's weight
  }
  let both = false;
  try { both = getItemHands(weapon) === ITEM_HANDS.Both; } catch { both = false; }
  return both ? k * TELL.K_TWO_HANDED : k;
}

/** Is `from` (a point, xz) behind a facing `yaw` (atan2(dx, dz)) at `origin` - more than BACK_DEG off it? */
export function behind(origin, yaw, from) {
  if (!origin || !from || !Number.isFinite(yaw)) return false;
  const vx = from[0] - origin[0], vz = from[2] - origin[2];
  const l = Math.hypot(vx, vz);
  if (l < 1e-6) return false;
  const dot = (vx / l) * Math.sin(yaw) + (vz / l) * Math.cos(yaw);
  return dot < Math.cos(TELL.BACK_DEG * Math.PI / 180);
}

/** v: a blow's weight on the meter - its final damage, by its kind, from behind, of its weakness. */
export function blowWeight(damage, k, { back = false, weak = false } = {}) {
  if (!(damage > 0) || !(k > 0)) return 0;
  return damage * k * (back ? TELL.POISE_BACK : 1) * (weak ? TELL.POISE_WEAK : 1);
}

/** TELL2: the glint's strength `sinceStart` seconds into a wind-up with `toLand` seconds left (0 none): a flare that
 *  falls to a steady rim, then a rise to full through the last TELL_NOW; reduced motion a steady rim alone. */
export function glintStrength(sinceStart, toLand, reduced = false) {
  if (!(sinceStart >= 0) || !(toLand >= 0)) return 0;
  if (reduced) return TELL.GLINT_REDUCED;
  /** @type {number} */
  let k = TELL.GLINT_STEADY;
  if (sinceStart < TELL.GLINT_PULSE_S) k = Math.max(k, TELL.GLINT_PULSE - (TELL.GLINT_PULSE - TELL.GLINT_STEADY) * (sinceStart / TELL.GLINT_PULSE_S));
  if (toLand < TELL.TELL_NOW) k = Math.max(k, TELL.GLINT_STEADY + (1 - TELL.GLINT_STEADY) * (1 - toLand / TELL.TELL_NOW));
  return k;
}

/** TELL3 (section 5): a blow's guard as it is wound up - 'iron' for the slam and the ring of a heavy or massive body
 *  (`weight` DFU's, in classic units), and one blow in IRON_ELITE from an elite (`isElite`: the ELITE FOES gold or an
 *  Elite Dungeon's - section 9's reading of the word, taken at TELL5); RVN2: a Steadfast revenant's one in two (its
 *  stand's `revenant.edge.iron` - the larger share where both are, on the one roll); else 'poise'. `roll` in [0, 1), drawn
 *  only for those. The revenant's other iron (its signature from rank 3, a last stand) joins with RVN4 and RVN5. */
export function blowGuard(kind, weight, ent = null, roll = null) {
  const cls = weightClass(weight);
  if (TELL.IRON_SHAPES.includes(kind) && (cls === 'heavy' || cls === 'massive')) return 'iron';
  const share = Math.max(isElite(ent) ? TELL.IRON_ELITE : 0, ent?.revenant?.edge?.iron > 0 ? ent.revenant.edge.iron : 0, ent?.revenant?.p2?.iron > 0 ? ent.revenant.p2.iron : 0);   // RVN4: phase two's half
  if (share > 0 && (roll ?? Math.random()) < share) return 'iron';
  return 'poise';
}

/** TELL4 (section 6.1): how long a missed blow of `kind` leaves its foe overreached - its shape's `PUNISH_S`, an iron
 *  blow's `PUNISH_IRON` longer, a perfect dodge's `PERFECT_WINDOW` times that. A shape with no row: the lunge's. */
export function punishSeconds(kind, guard = 'poise', perfect = false) {
  const base = TELL.PUNISH_S[kind] ?? TELL.PUNISH_S.lunge;
  return (base + (guard === 'iron' ? TELL.PUNISH_IRON : 0)) * (perfect ? TELL.PERFECT_WINDOW : 1);
}

// ── TELL5: PATTERNS (bible/12-Enhanced-AI/Feud-Arc.md section 7) ─────────────────────────────────────────────────
/** An elite: the ELITE FOES gold or an Elite Dungeon's - the leaf's (ai/blowShapes.js, beside the whole set it decides),
 *  handed on. */
export { isElite };
/** The revenant's rank (0 for none). */
export const revenantRank = (ent) => (Number.isFinite(ent?.revenant?.rank) ? ent.revenant.rank : 0);
/** The higher tier (7.3): an elite, a champion, a revenant of rank 2 or more - never an ordinary level-10 foe. */
export const higherTier = (ent) => isElite(ent) || !!ent?.champion || revenantRank(ent) >= 2;

/** TELL5 (7.1): a wind-up's length - its shape's `base` (s) times U(WINDUP_VARY) (`roll` in [0, 1)), an elite's
 *  x WINDUP_ELITE, a revenant's x(1 - WINDUP_RANK a rank); iron's extra after; never under `floor`. A chain's passes its
 *  own base and floor and `roll` null (no draw: a chain is quick by law). The fill runs on it, so the mark tells the truth.
 *  @param {number} base @param {any} [ent] @param {{ guard?: string, roll?: number|null, floor?: number }} [opts] */
export function windupSeconds(base, ent = null, { guard = 'poise', roll = Math.random(), floor = TELL.TELL_MIN_WINDUP } = {}) {
  const [lo, hi] = ent?.revenant?.edge?.wind ?? TELL.WINDUP_VARY;   // RVN2: a Patient revenant's wider band
  let w = base * (roll == null ? 1 : lo + (hi - lo) * roll);
  if (isElite(ent)) w *= TELL.WINDUP_ELITE;
  const rank = revenantRank(ent);
  if (rank > 0) w *= 1 - TELL.WINDUP_RANK * rank;
  if (ent?.revenant?.p2?.windup > 0) w *= ent.revenant.p2.windup;   // RVN4: phase two's quicker wind-ups
  if (guard === 'iron') w += TELL.IRON_EXTRA;
  return Math.max(floor, w);
}
/** TELL5 (7.3): may this foe feint - a blade of the higher tier - now (`sinceFeint` wind-ups since its last)? */
export function feints(family, ent, sinceFeint = Infinity) {
  return family === 'blade' && higherTier(ent) && sinceFeint >= TELL.FEINT_GAP;
}
/** RVN2: a feinting foe's chance to feint a wind-up - TELL5's, a Patient revenant's one in three (its stand's edge). */
export const feintChance = (ent) => ent?.revenant?.edge?.feint ?? TELL.FEINT_CHANCE;
/** RVN2: the share of a tracker's wind-up it turns through - TELL5's half, a Patient revenant's longer. */
export const trackShare = (ent) => ent?.revenant?.edge?.track ?? TELL.TRACK_SHARE;
/** RVN4: how many blows may chain after a first - TELL5's one, phase two's two (three in all). */
export const chainMax = (ent) => (ent?.revenant?.p2?.chainMax > 0 ? ent.revenant.p2.chainMax : 1);
/** TELL5 (7.4): may this foe chain - a brute of the higher tier, an elite, a revenant of rank 3 or more - with two shapes
 *  or more to chain between? */
export function chains(family, ent, shapes) {
  if (!Array.isArray(shapes) || shapes.length < 2) return false;
  return (family === 'brute' && higherTier(ent)) || isElite(ent) || revenantRank(ent) >= 3;
}
/** TELL5 (7.4): the chain's next shape - its law's (a sweep then a lunge; a slam then a sweep; a ring then a slam), or
 *  any other of its own. */
export function chainShape(prev, shapes) {
  const want = TELL.CHAIN_NEXT[prev];
  if (want && shapes.includes(want)) return want;
  return shapes.find((k) => k !== prev) ?? null;
}
/** TELL5 (7.2): `yaw` turned toward `want` by at most TRACK_RATE x `dt` (radians, the short way). */
export function trackYaw(yaw, want, dt) {
  let d = want - yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const max = (TELL.TRACK_RATE * Math.PI / 180) * Math.max(0, dt);
  return yaw + Math.max(-max, Math.min(max, d));
}

// ── TELL7: THE TIER AND THE COOLDOWNS (bible/12-Enhanced-AI/Feud-Arc.md section 9) ───────────────────────────────────
/** TELL7: an elite, a champion or a revenant (any rank) - who throws its family's whole set of shapes: the leaf's
 *  (ai/blowShapes.js, where the whole set is), handed on. */
export { wholeSet };
/** TELL7 (9): the seconds before this foe's next telegraphed blow - an ordinary foe's 8-15, a champion's 7-13, an elite's
 *  6-11 (the best of its tiers), a revenant's less 8% a rank (rank 5: 4.8-9 of an ordinary's). `roll` in [0, 1). A last
 *  stand's x0.7 joins with RVN4. */
export function blowCooldown(ent = null, roll = Math.random()) {
  const C = TELL.COOLDOWN;
  const [lo, hi] = isElite(ent) ? C.elite : ent?.champion ? C.champion : C.ordinary;
  const rank = revenantRank(ent);
  return (lo + (hi - lo) * roll) * (rank > 0 ? 1 - TELL.COOLDOWN_RANK * rank : 1) * (ent?.revenant?.p2?.cooldown > 0 ? ent.revenant.p2.cooldown : 1);   // RVN4: phase two's x0.7
}
