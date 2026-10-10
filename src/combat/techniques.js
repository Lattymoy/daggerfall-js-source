// @ts-check
// TECH1 (2026-10-10, the owner: "detailed weapon skill affixes for each weapon type ... a bow could roll with an attack
// that allows you to aim and place a telegraph that shoots a volley of arrows, or a sword attack that allows you to leap
// and attack your opponent ... This would have its own keybinding"; "This is your baby. I want you to be as detailed as
// possible and take your time. No exceptions"): THE TECHNIQUE KEY - what a press of WeaponTechnique does with the weapon
// in hand. Design and laws: bible/05-Combat/Weapon-Techniques.md.
//
// ONE RUNNER, EVERY HOST. Every host builds a weapon rig (combat/weaponRig.js - exterior.js, world.js, worldModes.js'
// interior arm, dungeonContext.js), and the rig that owns the frame steps THIS module, as it steps the one pair of
// casting hands (combat/fpsSpellCasting.js): the cooldowns are the player's, not a rig's, so walking through a door
// neither resets one nor runs two. A rig that is not the last to step finds the aim and the flight set aside (a door
// mid-leap ends the leap; its price is paid).
//
// WHAT IT RIDES - nothing it does grows a second performer:
//   the swing      the rig starts the machine's own strike (machineAttack + the arm's fpAttack), the technique's BLOW
//                  on it (combat/techniqueBlow.js); every host's 'hit' resolves it through PlayerWeapon.resolveHit and
//                  each pool's own door - the corpse, the crime, a puppet's owner, the referee's clip on a boss
//   the shaft      the bow's own loose (the rig hands the machine's hit frame here instead of to the host), then real
//                  arrows through the host's own lane (the door's fireArrow - combat/arrowFlight.js, or the dungeon's
//                  missiles), each one landing through playerArrowHitFoe
//   the body       the motor's own flight (player/motor.js techniqueLaunch): the collider stops it, gravity lands it
//   the price      fatigue through the host's own drain (its exhaustion law), arrows through spendAmmoFor, the skill
//                  through tallySwingSkills - the ones a plain swing or shot spends
//
// THE HOST'S DOOR (`door`, handed to createWeaponRig): { motor() - the player's PlayerMotor; fireArrow(from, dir,
// { sky, weapon, technique, speedScale }) - a player shaft through the host's lane (`sky`: from that very point, not the
// bow hand; `weapon` the bow that loosed it); drainFatigue(n) - the host's fatigue door; face(point, from) - turn the
// view toward a point from where the body lands (Shadowstep's turn); blocked() - a window holds the world (the street's
// hosts); and THE FEEL's three (combat/techniqueFx.js): fx(recipe, at, o) - a burst in the host's cast engine's impact
// pass, shake(k) - the one shaker, sound(clip, volume, pitch) - the audio bus }.
// A host that hands none still swings its techniques; it cannot leap, dash or shoot one (said so).

import { techniqueById, techniqueMult, TECHNIQUE_MAX_SPEED, TECHNIQUES } from './techniqueRoster.js';
import { techniqueLineOf, lootRarityOn, rarityKnown } from '../systems/lootRarity.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { sigilDueling } from '../systems/sigil.js';
import { FATIGUE_MULTIPLIER } from '../systems/statMods.js';
import { spendAmmoFor, ammoCountFor } from '../systems/inventory.js';
import { tallySwingSkills, SWING_FATIGUE_COST } from '../scenes/hostCombat.js';
import { playerDoor } from '../systems/playerDoor.js';
import { GRAVITY } from '../player/motor.js';
import { restoresSoFar } from '../systems/save.js';   // AUDIT TECH1: every load passes the one door (PORTAL1's count)
import { blowSchedule } from '../characters/weaponStates.js';
import { MISSILE_SPEED } from '../systems/spellcast.js';   // AUDIT TECH-FX: a shaft's flight - DFU's one constant (ONE DFU MEMBER, ONE EXPORT)
import { WEAPON_REACH, friendlyProtected } from './playerWeapon.js';
import { playerBody, bodyRadius } from './techniqueBlow.js';
import { techniqueCue, resetTechniqueFx, TECH_FX } from './techniqueFx.js';   // TECH-FX: what each moment looks, moves and sounds like (bible/05-Combat/Weapon-Techniques.md THE FEEL)

/** The registry action (systems/inputActions.js). */
export const TECHNIQUE_ACTION = 'WeaponTechnique';
/** The player's own marks on the ground - a cool blue, never a foe's orange - and a mark that cannot be reached. */
export const TECH_COLOR = Object.freeze([0.35, 0.78, 1]);   // the HUD chip's is its twin (techniqueRoster.js TECH_CHIP_COLOUR - the leaf the HUD may import)
export const TECH_BAD_COLOR = Object.freeze([0.95, 0.32, 0.3]);
/** How far below and above the feet a leap or a dash may land (metres): a body leaps down a little and up less. */
export const TECH_DROP_MAX = 4;
export const TECH_RISE_MAX = 2.5;
/** A swing that never comes back to idle (a host that stopped stepping it) lets its blow go after this long. */
const SWING_GIVE_UP_S = 3;

// ── the words ───────────────────────────────────────────────────────
export const NO_TECHNIQUE_TEXT = 'This weapon has no technique.';
export const LADDER_OFF_TEXT = 'Weapon techniques need the loot ladder, which is off.';
export const DUEL_TEXT = 'Techniques sleep in a duel.';
export const TIRED_TEXT = 'You are too tired.';
export const SHEATHED_TEXT = 'Draw your weapon first.';
export const NO_AMMO_TEXT = 'You have nothing to shoot.';
export const OUT_OF_REACH_TEXT = 'Out of reach.';
export const NO_FOE_TEXT = 'No foe there.';
export const CANNOT_LEAP_TEXT = 'You cannot leap from here.';
export const NOT_HERE_TEXT = 'Not here.';
export const BEAST_TEXT = 'The beast knows no technique.';
export const GAUNTLETS_TEXT = 'Your gauntlets\' technique is for bare hands.';
export const NO_ROOM_TEXT = 'No room to leap.';
/** AUDIT TECH1: what a technique is called before its piece is known - an unidentified Rare's card names no line, and the
 *  key, the chip and the lines say no more than the card (DFU's IsIdentified). The technique works all the same. */
export const UNKNOWN_TECHNIQUE = 'Your technique';
export const notReadyText = (name, s) => `${name} is not ready (${s}s).`;
export const readyAgainText = (name) => `${name} is ready again.`;

// ── the state: the player's, one ───────────────────────────────────
/** AUDIT TECH-FX: the roster's ids in order - the cooldowns' index (a number a technique, written in place: a Map's
 *  iterator, its entries and its boxed numbers made 96 bytes a frame for the 8-16 s after every use). */
const TECH_IDS = Object.freeze(Object.keys(TECHNIQUES));
const TECH_INDEX = Object.freeze(Object.fromEntries(TECH_IDS.map((id, i) => [id, i])));
const fresh = () => ({
  /** seconds of play left on each technique's cooldown, by TECH_INDEX */
  wait: new Float64Array(TECH_IDS.length),
  /** the key held while an aiming technique waits for its release: { hand, t, target } */
  aim: null,
  /** the technique in flight: a swing, a leap, a dash, a shot waiting for its loose, a volley falling */
  act: null,
  /** the key's last frame */
  prev: false,
  /** the rig that last stepped */
  owner: null,
  /** the last say door handed in */
  say: null,
  /** the loads it has seen (AUDIT TECH1: a load starts it fresh - systems/save.js restoresSoFar, the count every load
   *  moves; the player's entity is one object for the page's life, refilled in place) */
  restores: null,
});
let _s = fresh();

/** The item a technique is read from: the weapon in the hand that swings (DFU's used hand - PlayerWeapon.weapon, the equip
 *  table's own object), or bare-handed the Gauntlets worn. The beast's claws have none. */
export function techniqueItem(entity, pw) {
  const w = pw?.weapon ?? null;
  if (w?.werecreatureClaws) return null;
  if (w) return w;
  return entity?.equip?.slots?.[EQUIP_SLOTS.Gloves] ?? null;
}
/** The technique in hand - { id, value, tech, item, known } - or null. Read whatever the ladder's switch says (the
 *  refusal says it: a piece found under the ladder keeps its line, and sleeps with it off). AUDIT TECH-FX: the HUD asks
 *  it every frame, so the last answer is kept while nothing it was read from has moved (the piece, its line, the line's
 *  technique and value, whether it is known) - a snapshot no caller writes, so one is as good as another. */
let _handMemo = null;
export function techniqueInHand(entity, pw) {
  const item = techniqueItem(entity, pw);
  const line = techniqueLineOf(item);
  const tech = line ? techniqueById(line.param) : null;
  if (!tech) return null;
  const known = rarityKnown(item), h = _handMemo;
  if (h && h.item === item && h.line === line && h.id === line.param && h.value === line.value && h.known === known) return h.hand;
  const hand = { id: line.param, value: line.value, tech, item, known };
  _handMemo = { item, line, id: line.param, value: line.value, known, hand };
  return hand;
}
/** The name a technique is said by: its own once its piece is known, else UNKNOWN_TECHNIQUE (AUDIT TECH1). */
export const techniqueName = (hand) => (hand?.known === false ? UNKNOWN_TECHNIQUE : hand?.tech?.name ?? UNKNOWN_TECHNIQUE);
/** Seconds left on a technique's cooldown (0 ready). */
export const techniqueWait = (id) => Math.max(0, _s.wait[TECH_INDEX[id]] ?? 0);
/** The fatigue a technique costs, in the entity's own units (the sheet's points x FATIGUE_MULTIPLIER). A technique is a
 *  burst bought on purpose, so BALANCE1's drain scale is not on it (statMods.js FATIGUE_DRAIN_SCALE's own exception). */
export const techniqueFatigue = (tech) => Math.max(0, Math.round((tech?.fatigue ?? 0) * FATIGUE_MULTIPLIER));

// ── the vector arithmetic ───────────────────────────────────────────
const lookOf = (cam) => {
  const y = cam?.yaw ?? 0, p = cam?.pitch ?? 0;
  return [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
};
const flatOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
/** AUDIT TECH-FX: a point, whatever holds it - the motor's feet are a Float32Array (player/motor.js `pos`), never an
 *  Array, and `Array.isArray` on them dropped every burst in every host. */
const vec3 = (v) => v != null && v.length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
/** TECH-FX: where a moment's burst stands (combat/techniqueFx.js TECH_FX names the recipe): a ring at the feet, a star
 *  where the blow falls in front, a flare and a tracer from the bow down the look, a trail from where a dash began, a
 *  Volley's arrow where it lands. null: no burst for this moment. A sweep spins the way its strike travels (AUDIT
 *  TECH-FX: a StrikeLeft - the Whirlwind's - carries the blade to the left: combat/weaponWidget.js leanFor, bloodDecals.js
 *  SWING_PUSH), and an arc spans the technique's own half-angle (techniqueRoster.js `arc`). */
function fxPlace(id, moment, ctx, extra = null) {
  const burst = TECH_FX[id]?.[moment]?.burst, f = ctx.cam?.feet;
  if (!burst || !vec3(f)) return null;
  const yaw = ctx.cam.yaw ?? 0, fw = flatOf(yaw), tech = techniqueById(id);
  switch (burst) {
    case 'star': case 'chop': case 'punch':
      return { at: [f[0] + fw[0] * 1.2, f[1] + 1.1, f[2] + fw[2] * 1.2], ground: f[1], yaw, dir: [-fw[0], 0, -fw[2]] };
    case 'tracer': case 'flare': {
      const look = lookOf(ctx.cam), e = vec3(ctx.cam.pos) ? ctx.cam.pos : [f[0], f[1] + 1.6, f[2]];
      return { at: [e[0] + look[0] * 0.9, e[1] + look[1] * 0.9 - 0.15, e[2] + look[2] * 0.9], ground: f[1], yaw, dir: look, len: extra?.len ?? 0 };
    }
    case 'trail':
      return vec3(extra?.from) ? { at: extra.from, to: [f[0], f[1], f[2]], ground: f[1], yaw } : null;
    case 'shaft': case 'close':
      return vec3(extra?.at) ? { at: extra.at, ground: extra.at[1], yaw, r: extra.r ?? 2.5 } : null;
    default:   // shock, land, sweep, arc, vanish: at the feet
      return { at: [f[0], f[1], f[2]], ground: f[1], yaw, spin: tech?.strike === 'StrikeRight' ? -1 : 1, ...(typeof tech?.arc === 'number' ? { half: tech.arc } : {}) };
  }
}
/** TECH-FX: a moment cued - the springs, the shake, the burst and the sound (combat/techniqueFx.js techniqueCue). */
const cue = (hand, moment, ctx, extra = null) => techniqueCue(hand.id, moment, ctx.door, fxPlace(hand.id, moment, ctx, extra));
const at = (o, d, s) => [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
const flatDist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);

/** THE GROUND'S HEIGHT at (x, z), or NaN: the terrain the host draws (the collider's surfaceAt - BLOOD1 AUDIT 3's drawn
 *  ground), else its sampler (heightAt). Outdoors the ground is not a mesh: `raycast` never meets it (player/collider.js
 *  surfaceHit's own note). Indoors and underground the sampler answers -Infinity, and the floors are meshes. */
function groundAt(collider, x, z) {
  try {
    const h = typeof collider?.surfaceAt === 'function' ? collider.surfaceAt(x, z) : collider?.heightAt?.(x, z);
    return Number.isFinite(h) ? h : NaN;
  } catch { return NaN; }
}
/** Steps the look's march takes along the ground (metres), and the halvings that refine where it crossed. */
const GROUND_MARCH_STEP = 0.25;
const GROUND_MARCH_REFINE = 10;

/**
 * WHERE A RAY FIRST MEETS THE WORLD, within `max` metres: the nearer of the collider's meshes (`raycast` - a wall, a
 * floor indoors, a building) and the terrain (marched against groundAt, then halved down to the crossing), as a
 * distance along the unit `dir`; Infinity when it meets neither. AUDIT TECH1 (2026-10-10): every look a technique casts
 * reads this - a mesh ray alone never met the outdoor ground, so every Volley and every ground leap outdoors answered
 * "Out of reach".
 */
export function rayHit(origin, dir, max, collider) {
  let best = Infinity;
  try { const m = collider?.raycast?.(origin, dir, max); if (Number.isFinite(m) && m >= 0) best = m; } catch { /* no meshes */ }
  if (!Number.isFinite(groundAt(collider, origin[0], origin[2]))) return best;   // no terrain here (indoors, underground)
  const end = Math.min(max, best);
  const above = (t) => {
    const g = groundAt(collider, origin[0] + dir[0] * t, origin[2] + dir[2] * t);
    return !Number.isFinite(g) || origin[1] + dir[1] * t > g;
  };
  if (!above(0)) return best;   // an origin under the ground meets nothing it can see
  for (let t = GROUND_MARCH_STEP, prev = 0; prev < end; prev = t, t = Math.min(end, t + GROUND_MARCH_STEP)) {
    if (above(t)) { if (t >= end) break; continue; }
    let lo = prev, hi = t;
    for (let i = 0; i < GROUND_MARCH_REFINE; i++) { const mid = (lo + hi) / 2; if (above(mid)) lo = mid; else hi = mid; }
    return Math.min(best, hi);
  }
  return best;
}

/**
 * THE FLOOR UNDER A POINT - the nearest ground at or below `p`, or null when there is none within 40 m: the collider's
 * surfaceHit, which answers the nearer of its meshes and its terrain (player/collider.js), or its mesh ray alone where it
 * has no surfaceHit.
 */
export function floorUnder(p, collider) {
  const o = [p[0], p[1] + 1, p[2]];
  try {
    const h = collider?.surfaceHit?.(o, [0, -1, 0], 41) ?? null;
    const d = h && Number.isFinite(h.dist) ? h.dist : collider?.raycast?.(o, [0, -1, 0], 41);
    return Number.isFinite(d) ? o[1] - d : null;
  } catch { return null; }
}

/**
 * WHERE THE LOOK MEETS THE GROUND, within `range` metres of the feet on the level: the first thing the look strikes
 * (or its end), the floor under it - pulled back off a wall it struck. `{ point, dist }` (`dist` on the level from the
 * feet) or null.
 */
export function groundAim(eye, look, feet, collider, range) {
  let d = range + 2;
  const hit = rayHit(eye, look, range + 2, collider);   // a wall, a floor - or the open ground outdoors
  if (Number.isFinite(hit)) d = Math.max(0, hit - 0.3);
  let p = at(eye, look, d);
  const h = flatDist(feet, p);
  if (h > range) {   // past the reach on the level: the reach's own point, along the look's way
    const k = range / h;
    p = [feet[0] + (p[0] - feet[0]) * k, p[1], feet[2] + (p[2] - feet[2]) * k];
  }
  const y = floorUnder(p, collider);
  if (y == null) return null;
  const point = [p[0], y, p[2]];
  return { point, dist: flatDist(feet, point) };
}

/** THE FOE UNDER THE CROSSHAIR within `range`: the live foe nearest the look's line (a cone that widens a little with
 *  distance), in sight - never a player's body, never one behind the eye. Off the player's door (systems/playerDoor.js
 *  - the host running now). */
export function foeUnderLook(eye, look, range, collider, foes = playerDoor()?.foes?.() ?? []) {
  let best = null, score = Infinity;
  for (const f of foes) {
    if (!f || f.dead || !f.ai?.feet || playerBody(f) || f.companion != null || friendlyProtected(f)) continue;   // AUDIT TECH1: never an ally, a companion, a foe at peace
    const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? 1.8) * 0.5, f.ai.feet[2]];
    const v = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]];
    const dist = Math.hypot(v[0], v[1], v[2]);
    if (!(dist > 0.1) || dist > range + 1.5) continue;
    const along = v[0] * look[0] + v[1] * look[1] + v[2] * look[2];
    if (along <= 0) continue;
    const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
    if (perp > 0.6 + 0.06 * along) continue;
    const wall = rayHit(eye, [v[0] / dist, v[1] / dist, v[2] / dist], dist, collider);   // a wall, or a hill between
    if (Number.isFinite(wall) && wall < dist - 0.4) continue;
    const s = perp + along * 0.05;
    if (s < score) { score = s; best = f; }
  }
  return best;
}

/**
 * A BALLISTIC FLIGHT from `from` to `to` on the motor's own gravity: the arc's peak at least `apex` above the start (and
 * over the landing), raised until the run along the level is no faster than `maxSpeed` (TECHNIQUE_MAX_SPEED - what a
 * refereed room believes of a body). `{ dir, along, up, time }`: the horizontal unit, the speeds, and the time to land.
 */
export function launchTo(from, to, apex, maxSpeed = TECHNIQUE_MAX_SPEED, g = GRAVITY) {
  const dx = to[0] - from[0], dz = to[2] - from[2], dy = to[1] - from[1];
  const h = Math.hypot(dx, dz);
  const timeAt = (top) => Math.sqrt((2 * top) / g) + Math.sqrt((2 * Math.max(0, top - dy)) / g);
  let top = Math.max(apex, dy + 0.4, 0.05);
  if (h / timeAt(top) > maxSpeed) {
    let lo = top, hi = top + 40;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (h / timeAt(mid) > maxSpeed) lo = mid; else hi = mid; }
    top = hi;
  }
  const time = timeAt(top);
  return { dir: h > 1e-6 ? [dx / h, 0, dz / h] : [0, 0, 0], along: h / time, up: Math.sqrt(2 * g * top), time };
}

/** A VOLLEY'S FALL: `n` points spread evenly over a disc of `radius` about `centre` (a sunflower's spiral - no two
 *  shafts on one spot), turned by `turn` (0..1) so two volleys do not fall alike. */
export function volleyPoints(centre, radius, n, turn = 0) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n), a = i * golden + turn * Math.PI * 2;
    out.push([centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r]);
  }
  return out;
}

/** THE BLOW a technique's swing carries (combat/techniqueBlow.js), at its line's power, from the feet and look now. */
export function swingBlow(id, value, cam, extra = {}) {
  const t = techniqueById(id);
  if (!t) return null;
  return {
    id, mult: techniqueMult(t.base, value), wounded: t.wounded ?? 0, toHit: t.toHit ?? 0,
    reach: t.mech === 'leap' ? t.radius : (t.reach ?? WEAPON_REACH), arc: t.mech === 'leap' ? 'all' : (t.arc ?? 'view'),
    single: !!t.single, lane: null, target: null, feet: cam?.feet ? [...cam.feet] : null, yaw: cam?.yaw ?? 0, ...extra,
  };
}

/** A dash's own apex: a low hop (raised by launchTo while the run would pass TECHNIQUE_MAX_SPEED). */
export const DASH_APEX = 0.25;
/** Whether a flight's arc keeps the body's top (`bodyH` over the feet) under whatever stands over its path - sampled along
 *  the arc, a ray up from inside the body at each sample. */
function flightFits(from, fl, bodyH, collider) {
  for (let i = 1; i < 8; i++) {
    const t = (fl.time * i) / 8;
    const p = [from[0] + fl.dir[0] * fl.along * t, from[1] + fl.up * t - 0.5 * GRAVITY * t * t, from[2] + fl.dir[2] * fl.along * t];
    if (Number.isFinite(rayHit([p[0], p[1] + 0.3, p[2]], [0, 1, 0], Math.max(0.1, bodyH - 0.2), collider))) return false;
  }
  return true;
}
/**
 * THE ROOM A FLIGHT NEEDS (AUDIT TECH1): the highest apex - the technique's own, then lower, down to a dash's hop - whose
 * arc fits under every ceiling along it; null when none does. A leap that met a beam turned back at it (the motor reverses
 * a rising body at a ceiling) and landed metres short, its price paid: under a 2.8 m ceiling a 9 m Leap Strike came down
 * at 3.75 m. A long leap under a low roof now asks for an apex the run's speed cap needs, finds no room, and says so.
 */
export function flightApex(from, to, apex, bodyH, collider) {
  for (const a of [apex, apex * 0.6, apex * 0.35, DASH_APEX]) {
    if (a > apex + 1e-9) continue;
    if (flightFits(from, launchTo(from, to, a), bodyH, collider)) return a;
  }
  return null;
}

// ── the aim ─────────────────────────────────────────────────────────
/**
 * WHAT AN AIMING TECHNIQUE AIMS AT NOW, off the look: `{ ok, point, foe, lane, why, apex }` - a flight's aim carries the
 * apex that fits the room over its path (flightApex), or is no aim at all (NO_ROOM_TEXT).
 */
export function aimFor(tech, cam, collider, foes = undefined) {
  const res = aimAt(tech, cam, collider, foes);
  if (!res.ok || !res.point || (tech.mech !== 'leap' && tech.mech !== 'dash') || !cam?.feet || !cam?.pos) return res;
  const apex = flightApex(cam.feet, res.point, tech.mech === 'leap' ? tech.apex : DASH_APEX, Math.max(1, cam.pos[1] - cam.feet[1] + 0.15), collider);
  return apex == null ? { ...res, ok: false, why: NO_ROOM_TEXT } : { ...res, apex };
}
/**
 * The aim off the look, before the room is asked:
 *   ground (Volley)          the ground the look meets, within its range
 *   target (Leap, Kick)      the foe under the crosshair - the ground before it - or the ground the look meets
 *   foe (Shadowstep)         the foe under the crosshair, and the ground behind it (beside it if a wall stands there)
 *   lane (Piercing, Lunge)   the look's way from the feet - a shot's to its length or the first wall, a dash's on the level
 * A landing too far below or above the feet, or past the reach, is no aim (`ok` false, `why` the line said on release).
 */
function aimAt(tech, cam, collider, foes) {
  const eye = cam.pos, feet = cam.feet, look = lookOf(cam);
  if (!eye || !feet) return { ok: false, why: NOT_HERE_TEXT };
  const level = (p) => p[1] - feet[1] >= -TECH_DROP_MAX && p[1] - feet[1] <= TECH_RISE_MAX;
  if (tech.aim === 'ground') {
    const g = groundAim(eye, look, feet, collider, tech.range[1]);
    if (!g) return { ok: false, why: OUT_OF_REACH_TEXT };
    return { ok: g.dist >= tech.range[0] - 1e-6, point: g.point, why: OUT_OF_REACH_TEXT };
  }
  if (tech.aim === 'lane') {
    const yaw = cam.yaw ?? 0, way = flatOf(yaw);
    if (tech.mech === 'pierce') {
      let len = tech.length;
      const hit = rayHit(eye, look, tech.length, collider);   // the shot's length: to a wall, or into the ground
      if (Number.isFinite(hit)) len = Math.max(0.5, hit);
      return { ok: true, lane: { from: [feet[0], feet[2]], dir: [way[0], way[2]], len: len * Math.hypot(look[0], look[2]), halfW: 0.3, yaw, y: feet[1] }, point: null };
    }
    const chest = [feet[0], feet[1] + 1, feet[2]];
    let len = tech.length;
    const hit = rayHit(chest, way, tech.length + 0.6, collider);   // the dash's length: to a wall, or a rise it cannot run
    if (Number.isFinite(hit)) len = Math.max(0, hit - 0.6);
    const end = at(feet, way, len);
    const y = floorUnder([end[0], feet[1] + 0.6, end[2]], collider);
    const point = [end[0], y ?? feet[1], end[2]];
    return { ok: len >= 1 && y != null && level(point), point, lane: { from: [feet[0], feet[2]], dir: [way[0], way[2]], len, halfW: tech.halfW ?? 0.9, yaw, y: feet[1] }, why: CANNOT_LEAP_TEXT };
  }
  const foe = foeUnderLook(eye, look, tech.range[1], collider, foes);
  if (tech.aim === 'foe' && !foe) return { ok: false, why: NO_FOE_TEXT };
  if (foe) {
    const f = foe.ai.feet, r = bodyRadius(foe) + 0.55;
    const toward = flatDist(feet, f) > 1e-6 ? [(f[0] - feet[0]) / flatDist(feet, f), 0, (f[2] - feet[2]) / flatDist(feet, f)] : flatOf(cam.yaw ?? 0);
    const spots = tech.aim === 'foe'
      ? (() => { const fy = foe.ai.yaw ?? 0, back = flatOf(fy + Math.PI), side = flatOf(fy + Math.PI / 2); return [at(f, back, tech.behind ?? 1), at(f, side, tech.behind ?? 1), at(f, side, -(tech.behind ?? 1)), at(f, toward, -r)]; })()
      : [at(f, toward, -r)];
    for (const s of spots) {
      const chest = [f[0], f[1] + 1, f[2]], dir = [s[0] - f[0], 0, s[2] - f[2]], dl = Math.hypot(dir[0], dir[2]);
      if (dl > 1e-6) { const wall = rayHit(chest, [dir[0] / dl, 0, dir[2] / dl], dl + 0.4, collider); if (Number.isFinite(wall) && wall < dl + 0.35) continue; }
      const y = floorUnder([s[0], f[1] + 0.8, s[2]], collider);
      if (y == null) continue;
      const point = [s[0], y, s[2]];
      const d = flatDist(feet, point);
      return { ok: level(point) && d >= tech.range[0] - 1e-6 && d <= tech.range[1] + 1, point, foe, why: OUT_OF_REACH_TEXT };
    }
    return { ok: false, foe, why: OUT_OF_REACH_TEXT };
  }
  const g = groundAim(eye, look, feet, collider, tech.range[1]);
  if (!g) return { ok: false, why: OUT_OF_REACH_TEXT };
  return { ok: level(g.point) && g.dist >= tech.range[0] - 1e-6, point: g.point, why: OUT_OF_REACH_TEXT };
}

// ── the step ────────────────────────────────────────────────────────
/**
 * ONE FRAME of the technique key, for the rig that owns the frame. `ctx` (`holding`: the rig holds a shot's hit for the
 * Morrowind arm's release - a bow technique's loose still to come):
 *   rig            the stepping rig (its identity - a change of rig sets the aim and the flight aside)
 *   entity, pw     the player and its PlayerWeapon
 *   cam            the rig's camera: { pos (eye), yaw, pitch, feet }
 *   collider       the host's collider (raycast / surfaceHit, and the terrain's surfaceAt / heightAt - rayHit)
 *   held           the key, held this frame
 *   ready          the rig's own gate - drawn, no spell, no cast, no climb, no equip pause, no act's tool, not paralyzed
 *   startSwing(s)  start the machine's strike `s` (and the arm's): true when it began
 *   cancel         the press that sets an aim aside (ActivateCenterObject held - the drawn bow's own un-draw)
 *   paralyzed      the body is held: a swing's or a shot's clock stops with the machine (AUDIT TECH1)
 *   blocked        a window holds the world (the host's gamePaused): the key, the aim and the clock with it (AUDIT TECH1)
 *   door, say, noteShot(weapon)
 */
export function stepTechnique(dt, ctx) {
  if (!ctx || !ctx.entity || !ctx.pw) return;
  if (_s.owner !== ctx.rig) { _s.owner = ctx.rig; _s.aim = null; endAct(ctx.pw); }
  const loads = restoresSoFar();
  if (_s.restores !== loads) {   // AUDIT TECH1: a load - nothing of the moment before it flies on, falls, or waits
    if (_s.restores != null) { _s.aim = null; endAct(ctx.pw); _s.wait.fill(0); }
    if (_s.restores != null) resetTechniqueFx();   // TECH-FX: and no spring of the moment before it still moving the view
    _s.restores = loads;
  }
  _s.say = ctx.say ?? _s.say;
  // AUDIT TECH1: A WINDOW HOLDS IT ALL. The world under a talk window, the pack or a map is held (the host's gamePaused);
  // so is the key - a press there is the window's - the aim, the act and the clock. A key still down as the window closes
  // asks to be pressed again.
  if (ctx.blocked) { _s.aim = null; _s.prev = true; return; }
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const W = _s.wait;
  for (let i = 0; i < W.length; i++) {
    if (!(W[i] > 0)) continue;
    const next = W[i] - step;
    if (next > 0) { W[i] = next; continue; }
    W[i] = 0;
    const hand = techniqueInHand(ctx.entity, ctx.pw);
    if (hand?.id === TECH_IDS[i]) say(readyAgainText(techniqueName(hand)));   // the classic HUD has no chips: the line says it
  }
  const held = !!ctx.held, pressed = held && !_s.prev, released = !held && _s.prev;
  _s.prev = held;
  if (_s.act) stepAct(step, ctx);   // AUDIT TECH-FX: no act, no call (its number boxed a frame at rest)
  if (_s.aim) {
    const a = _s.aim;
    a.t += step;
    const hand = techniqueInHand(ctx.entity, ctx.pw);
    if (!hand || hand.id !== a.hand.id || hand.item !== a.hand.item || !ctx.ready || ctx.cancel) { _s.aim = null; return; }   // the weapon changed, sheathed, a spell readied - or set aside
    a.target = aimFor(hand.tech, ctx.cam, ctx.collider);
    if (!released) return;
    _s.aim = null;
    const why = refusal(hand, ctx);   // asked again at the release: a run may have spent the fatigue, a duel begun
    if (why) { if (why !== true) say(why); return; }
    if (!a.target?.ok) { say(a.target?.why ?? OUT_OF_REACH_TEXT); return; }
    execute(hand, ctx, a.target);
    return;
  }
  if (!pressed) return;
  const hand = techniqueInHand(ctx.entity, ctx.pw);
  const why = refusal(hand, ctx);
  if (why) { if (why !== true) say(why); return; }
  if (hand.tech.aim) { _s.aim = { hand, t: 0, target: aimFor(hand.tech, ctx.cam, ctx.collider) }; return; }
  execute(hand, ctx, null);
}

/** Why a press does nothing now - a line to say, `true` for a silent refusal (the hands are busy), null for none. */
export function refusal(hand, ctx) {
  const pw = ctx.pw;
  if (pw?.weapon?.werecreatureClaws) return BEAST_TEXT;
  if (!hand) return pw?.weapon && techniqueLineOf(ctx.entity?.equip?.slots?.[EQUIP_SLOTS.Gloves]) ? GAUNTLETS_TEXT : NO_TECHNIQUE_TEXT;   // AUDIT TECH1: the gauntlets' line sleeps while a weapon is drawn - say so
  if (!lootRarityOn()) return LADDER_OFF_TEXT;   // Loot-II law 6: off is DFU exactly - a found line sleeps
  if (sigilDueling()) return DUEL_TEXT;   // TECH law 3: never at a player - every power that sleeps in a duel, or a bout between players, sleeps
  if (pw.sheathed) return SHEATHED_TEXT;
  if (_s.act) return true;   // one at a time
  if (!ctx.ready || pw.machine?.state !== 'Idle' || (pw.machine.now < pw.machine.cooldownUntil)) return true;   // mid-swing, a bow's recovery, a spell's hands
  const left = techniqueWait(hand.id);
  if (left > 0) return notReadyText(techniqueName(hand), Math.ceil(left));
  // AUDIT TECH1: the price AND the blow's own drain after it - a technique never spends the last of a body (exhaustion
  // with a foe near is death: systems/rest.js)
  if ((ctx.entity.fatigue ?? 0) <= techniqueFatigue(hand.tech) + SWING_FATIGUE_COST) return TIRED_TEXT;
  const t = hand.tech;
  if (t.mech === 'rain' || t.mech === 'pierce') {
    if (!ctx.door?.fireArrow) return NOT_HERE_TEXT;
    if (ammoCountFor(ctx.entity.items, pw.weapon) < 1) return NO_AMMO_TEXT;
  }
  if (t.mech === 'leap' || t.mech === 'dash') {
    const m = ctx.door?.motor?.();
    if (!m) return NOT_HERE_TEXT;
    if (m.climb?.isClimbing || m._wall || m._pkMove || m.swimming || m.onExteriorWater || m.isPlayerSwimming || m.levitating || m.slowFalling || m.riding || m.isDown?.() || !m.grounded) return CANNOT_LEAP_TEXT;   // AUDIT TECH1: the open water too - DFU refuses a jump there
  }
  return null;
}

/** Pay a technique's price: its fatigue through the host's drain (or the entity, with no door), its cooldown. */
function pay(hand, ctx) {
  const n = techniqueFatigue(hand.tech);
  if (ctx.door?.drainFatigue) ctx.door.drainFatigue(n);
  else ctx.entity.fatigue = Math.max(0, (ctx.entity.fatigue ?? 0) - n);
  _s.wait[TECH_INDEX[hand.id]] = hand.tech.cooldown;
}

/** RELEASE: the technique goes - its price paid as it leaves. */
function execute(hand, ctx, target) {
  const t = hand.tech, pw = ctx.pw;
  if (t.mech === 'swing') {
    const blow = swingBlow(hand.id, hand.value, ctx.cam);
    pw.techniqueBlow = blow;
    if (!ctx.startSwing?.(t.strike)) { pw.techniqueBlow = null; return; }
    pay(hand, ctx);
    _s.act = { kind: 'swing', hand, blow, pw, t: 0 };
    cue(hand, 'release', ctx);   // TECH-FX
    return;
  }
  if (t.mech === 'rain' || t.mech === 'pierce') {
    pw.techniqueBlow = null;
    if (!ctx.startSwing?.('StrikeDown')) return;
    pay(hand, ctx);
    _s.act = { kind: 'shot', hand, target, pw, t: 0, loosed: false, weapon: pw.weapon };
    cue(hand, 'release', ctx);   // TECH-FX
    return;
  }
  // a leap or a dash: the body flies first, and the strike is started to land with it
  const m = ctx.door?.motor?.();
  const from = ctx.cam.feet;
  if (!m || !from || !target?.point) return;
  const apex = target.apex ?? (t.mech === 'leap' ? t.apex : DASH_APEX);   // AUDIT TECH1: the apex that fits the room (aimFor)
  const fl = launchTo(from, target.point, apex);
  if (!m.techniqueLaunch?.(fl.dir, fl.along, fl.up)) { say(CANNOT_LEAP_TEXT); return; }
  pay(hand, ctx);
  const lane = t.aim === 'lane' && target.lane ? { from: target.lane.from, dir: target.lane.dir, len: target.lane.len, halfW: target.lane.halfW } : null;
  // TECH-FX: `from` - where the leap or the dash began (a Lunge's trail runs from it)
  _s.act = { kind: 'flight', hand, target, pw, t: 0, time: fl.time, struck: false, lane, foe: target.foe ?? null, from: [from[0], from[1], from[2]] };
  cue(hand, 'release', ctx);   // TECH-FX
}

/** The flight, the swing, the shot and the fall, a frame on. */
function stepAct(dt, ctx) {
  const a = _s.act;
  if (!a) return;
  // AUDIT TECH1: a paralysis freezes the machine, and with it a swing's or a shot's clock - the give-up never fires under
  // a long one, so the hit it waits for is still the technique's (claimShot), never a plain arrow's or a plain swing's
  if (ctx.paralyzed && (a.kind === 'swing' || a.kind === 'shot')) return;
  a.t += dt;
  const pw = ctx.pw;
  if (a.kind === 'swing') {
    // the blow follows the feet to its hit frame (a leap's landing, a step in the swing), then waits for the machine
    if (a.blow && !a.blow.lane && ctx.cam?.feet) { a.blow.feet = [...ctx.cam.feet]; if (a.blow.arc !== 'all' && !a.blow.target) a.blow.yaw = ctx.cam.yaw ?? a.blow.yaw; }
    if ((a.t > 0 && pw.machine?.state === 'Idle') || a.t > SWING_GIVE_UP_S) endAct(pw);
    return;
  }
  if (a.kind === 'shot') {
    // the loose never came (a climb took the hands) - unless the rig holds the shot's hit for the Morrowind arm's release
    // (combat/weaponRig.js MW-D42: the arrow leaves with the string, after the machine is idle again)
    if (!a.loosed && !ctx.holding && ((pw.machine?.state === 'Idle' && a.t > 0.05) || a.t > SWING_GIVE_UP_S)) endAct(pw);
    return;
  }
  if (a.kind === 'rain') {
    // TECH-FX: each shaft's landing, and the circle closing with the last (before the act can end)
    while (a.lands && a.li < a.lands.length && (a.lands[a.li].t <= a.t || a.t >= a.until)) { cue(a.hand, 'shaft', ctx, { at: a.lands[a.li].at }); a.li++; }
    if (a.lands && a.li === a.lands.length && !a.closed) { a.closed = true; cue(a.hand, 'close', ctx, { at: a.point, r: a.hand.tech.radius }); }
    while (a.queue.length && a.queue[0].at <= a.t) {
      const q = a.queue.shift();
      ctx.door?.fireArrow?.(q.from, q.dir, { sky: true, weapon: a.weapon, technique: { id: a.hand.id, mult: a.mult, pierce: 1 } });   // AUDIT TECH1: the bow that loosed it, whatever is in hand now
    }
    if (!a.queue.length && a.t >= a.until) _s.act = null;
    return;
  }
  if (a.kind === 'flight') {
    const m = ctx.door?.motor?.();
    const landed = !m || (a.t > 0.08 && m.grounded);
    // the strike is started to land WITH the body: when the time left in the air is the swing's own time to its hit
    const hitAt = a.hitAt ??= strikeHitAt(pw, a.hand.tech.strike, dt);   // AUDIT TECH-FX: asked once a flight (its copy of the machine was a frame's garbage)
    if (!a.struck && (landed || a.time - a.t <= hitAt || a.t > a.time + 0.6)) {
      a.struck = true;
      // AUDIT TECH1: the swing's own gate at the strike, as at the press - sheathed, a spell readied, paralyzed, the weapon
      // changed in the air: no blow (a bow swapped in would have looked a plain shot on landing)
      if (!ctx.ready || techniqueInHand(ctx.entity, pw)?.item !== a.hand.item) { endAct(pw); return; }
      // Shadowstep: turn on the foe - FROM WHERE YOU LAND (AUDIT TECH1: turned from mid-dash, the view looked on along the
      // dash and the body landed behind the foe facing away from it)
      if (a.foe && a.hand.tech.mech === 'dash' && !a.lane) ctx.door?.face?.(a.foe.ai?.feet ?? null, a.target?.point ?? null);
      const blow = swingBlow(a.hand.id, a.hand.value, ctx.cam, a.lane ? { lane: a.lane, arc: 'all', reach: a.lane.len }
        : a.hand.tech.mech === 'dash' && a.foe ? { target: a.foe } : {});
      pw.techniqueBlow = blow;
      // TECH-FX: the landing's strike knows where the body left (`from` - a Lunge's trail runs from it)
      if (ctx.startSwing?.(a.hand.tech.strike)) _s.act = { kind: 'swing', hand: a.hand, blow, pw, t: 0, from: a.from };
      else { pw.techniqueBlow = null; _s.act = null; }
    }
  }
}
/** When a strike begun now would land its hit (seconds) - the machine's own schedule, asked of a copy. */
function strikeHitAt(pw, strike, dt) {
  try {
    const m = pw?.machine;
    if (!m) return 0;
    const s = blowSchedule({ ...m, state: strike ?? 'StrikeDown' }, pw.liveSpeed, pw.animCtx?.() ?? null, dt);
    return s?.hitAt ?? 0;
  } catch { return 0; }
}
/** The act ends: its blow is taken off the weapon it was set on (the act's own - a door may have changed the rig). */
function endAct(pw) {
  const a = _s.act;
  for (const w of [a?.pw, pw]) if (w && a?.blow && w.techniqueBlow === a.blow) w.techniqueBlow = null;
  _s.act = null;
}
function say(line) { try { _s.say?.(line); } catch { /* a line is never the technique's problem */ } }

/**
 * THE LOOSE - the rig's last word on its frame's events (combat/weaponRig.js frame): a bow's technique takes its own
 * hit frame, so no host looses a plain arrow on it. Answers the events the hosts are to see.
 */
export function claimShot(evs, ctx) {
  const a = _s.act;
  // TECH-FX: A SWING'S HIT IS THE MACHINE'S - the frame's own 'hit', as the host is handed it (AUDIT TECH-FX: a clock of
  // the runner's own ran a frame or two behind the machine, and on under a climb that swallows the hit and a window
  // that holds the runner but not the machine). A leap's and a dash's strike land with the body, so this is the landing.
  if (a?.kind === 'swing' && !a.hitCued && Array.isArray(evs) && evs.includes('hit')) { a.hitCued = true; cue(a.hand, 'hit', ctx, { from: a.from }); }
  if (!a || a.kind !== 'shot' || a.loosed || !Array.isArray(evs) || !evs.includes('hit')) return evs;
  a.loosed = true;
  loose(a, ctx);
  return evs.filter((e) => e !== 'hit');
}
function loose(a, ctx) {
  const { hand } = a, t = hand.tech, weapon = a.weapon ?? ctx.pw?.weapon ?? null, items = ctx.entity?.items;
  const mult = techniqueMult(t.base, hand.value);
  if (t.mech === 'pierce') {
    if (!spendAmmoFor(items, weapon)) { _s.act = null; return; }
    tallySwingSkills(ctx.entity, weapon);
    const look = lookOf(ctx.cam);
    ctx.door?.fireArrow?.(ctx.cam.pos, look, { sky: false, weapon, technique: { id: hand.id, mult, pierce: t.through }, speedScale: t.speed });
    ctx.noteShot?.(weapon);
    // TECH-FX: the shot's kick, its flare and its tracer - laid down the look the shaft flies, to the first thing it meets
    // there (AUDIT TECH-FX: the aim's lane was the release's, flat, and the player may turn before the string goes)
    const reach = rayHit(ctx.cam.pos, look, t.length, ctx.collider);
    cue(hand, 'loose', ctx, { len: Number.isFinite(reach) ? reach : t.length });
    _s.act = null;
    return;
  }
  // the Volley: as many shafts as the quiver gives, each spent, each a shot's tally, falling on the disc from above
  let n = 0;
  for (; n < t.arrows; n++) { if (!spendAmmoFor(items, weapon)) break; tallySwingSkills(ctx.entity, weapon); }
  if (!n || !a.target?.point) { _s.act = null; return; }
  ctx.noteShot?.(weapon);
  cue(hand, 'loose', ctx);   // TECH-FX: the bow's flare
  const c = a.target.point, feet = ctx.cam.feet ?? c;
  // the height they fall from: the sky outdoors, under the ceiling indoors
  let h = t.height;
  try { const up = ctx.collider?.raycast?.([c[0], c[1] + 0.3, c[2]], [0, 1, 0], t.height); if (Number.isFinite(up)) h = Math.max(1.6, up + 0.3 - 0.4); } catch { /* the sky */ }
  const toMe = flatDist(c, feet) > 1e-6 ? [(feet[0] - c[0]) / flatDist(c, feet), (feet[2] - c[2]) / flatDist(c, feet)] : [0, 0];
  const queue = volleyPoints(c, t.radius, n, Math.random()).map((p, i) => {
    let from = [p[0] + toMe[0] * h * 0.25, c[1] + h, p[2] + toMe[1] * h * 0.25];   // they come in from the archer's side
    // AUDIT TECH1: each shaft starts in the open - pulled down its own line to short of a beam, a wall or a ceiling over its
    // point (the one ray up from the disc's middle never saw a corridor's walls; a shaft born inside one died on its first step)
    const base = [p[0], p[1] + 0.3, p[2]], back = [from[0] - base[0], from[1] - base[1], from[2] - base[2]], bl = Math.hypot(back[0], back[1], back[2]) || 1;
    const blocked = rayHit(base, [back[0] / bl, back[1] / bl, back[2] / bl], bl, ctx.collider);
    if (Number.isFinite(blocked)) from = at(base, [back[0] / bl, back[1] / bl, back[2] / bl], Math.max(0.6, blocked - 0.4));
    const d = [p[0] - from[0], p[1] - from[1], p[2] - from[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { at: t.delay + (n > 1 ? (t.spread * i) / (n - 1) : 0), from, dir: [d[0] / l, d[1] / l, d[2] / l], to: p };
  });
  _s.act = { kind: 'rain', hand, point: c, t: 0, queue, mult, until: t.delay + t.spread + h / MISSILE_SPEED + 0.2, weapon };
  // TECH-FX: where and when each shaft meets what is under it - its own line cast as the lane will fly it (AUDIT
  // TECH-FX: the disc's points all stand at its centre's height, so on a slope or a step the puff hung in the air or
  // sank; a line that meets nothing within its aim ends at its aim), its loose plus its flight at MISSILE_SPEED, in
  // order - each its own point (a recentre moves it: offsetTechniques)
  _s.act.lands = queue.map((q) => {
    const span = Math.hypot(q.to[0] - q.from[0], q.to[1] - q.from[1], q.to[2] - q.from[2]);
    const hit = rayHit(q.from, q.dir, span + 2, ctx.collider), d = Number.isFinite(hit) ? hit : span;
    return { t: q.at + d / MISSILE_SPEED, at: at(q.from, q.dir, d) };
  }).sort((x, y) => x.t - y.t);
  _s.act.li = 0;
}

// ── what the screen shows ──────────────────────────────────────────
/** A mark as the ground pass draws it (render/foeTelegraph.js - ai/foeBlows.js drawableBlows' shape). */
const mark = (kind, origin, yaw, sizes, t, flash, ok = true) => ({
  blow: { kind, origin, yaw, start: 0, land: 1, color: ok ? TECH_COLOR : TECH_BAD_COLOR, technique: true, ...sizes },
  phase: { t, flash }, nearFloor: 0.6,
});
/** TECH-FX: the list a frame with nothing to show answers - one, frozen, so a frame at rest makes nothing. */
const NONE = Object.freeze([]);
/** THE PLAYER'S MARKS on the ground now: the aim while the key is held (a disc where a Volley falls or a leap lands, the
 *  foe a Shadowstep goes behind, the lane a shot flies or a dash runs - red where it cannot be reached), the Volley's disc
 *  while it falls, a ring about the feet through a swing that strikes all round. */
export function techniqueMarks(now = 0) {
  if (!_s.aim && !_s.act) return NONE;   // TECH-FX: no aim and no act - no mark, and no new list a frame
  const out = [];
  const pulse = 0.55 + 0.25 * Math.sin(now * 6);
  const a = _s.aim;
  if (a?.target) {
    const g = a.target, t = a.hand.tech;
    if (g.lane && t.mech === 'pierce') out.push(mark('aimed', [g.lane.from[0], g.lane.y, g.lane.from[1]], g.lane.yaw, { ahead: g.lane.len, halfW: g.lane.halfW }, pulse, 0, g.ok));
    else if (g.lane) out.push(mark('lunge', [g.lane.from[0], g.lane.y, g.lane.from[1]], g.lane.yaw, { len: g.lane.len, halfW: g.lane.halfW }, pulse, 0, g.ok));
    if (g.point && (t.mech === 'rain' || t.mech === 'leap')) out.push(mark('leap', g.point, 0, { ahead: 0, r: t.radius }, pulse, 0, g.ok));
    if (g.foe?.ai?.feet && t.aim === 'foe') out.push(mark('leap', g.foe.ai.feet, 0, { ahead: 0, r: 0.9 }, pulse, 0, g.ok));
  }
  const act = _s.act;
  if (act?.kind === 'rain') out.push(mark('leap', act.point, 0, { ahead: 0, r: act.hand.tech.radius }, Math.min(1, act.t / act.until), act.t > act.until - 0.25 ? 1 : 0));
  if (act?.kind === 'swing' && act.blow?.arc === 'all' && !act.blow.lane && act.blow.feet && act.t < 0.6) out.push(mark('leap', act.blow.feet, 0, { ahead: 0, r: act.blow.reach }, Math.min(1, act.t / 0.6), 0));
  return out;
}
/** The player's marks now, for a host's ground pass - drawn by a call of their own right after the foes' wind-ups
 *  (renderer.drawFoeTelegraphs: an empty list draws nothing and costs nothing), so the foes' call stays the foes'. */
export const techniqueMarksNow = (now = undefined) => (!_s.aim && !_s.act ? NONE : techniqueMarks(now ?? (typeof performance !== 'undefined' ? performance.now() / 1000 : 0)));   // AUDIT TECH-FX: at rest, no clock read (its number boxed a frame)
/** AUDIT TECH-FX: the HUD's one chip and its list, filled in place (the HUD reads them into its tiles each frame and
 *  keeps neither), and the seconds' word made once a second. */
const _chip = { key: 'technique', set: 'technique', name: '', text: '', state: 'active' };
const _chips = Object.freeze([_chip]);
let _chipSecs = -1, _chipSecsText = '';
/** The HUD's chip for the technique in hand (ui/enhancedHud.js setHudSetChips' shape): its name, and its seconds while it
 *  recovers - or its key while ready. `keyName` the key's word, or a function that answers it - asked only when ready
 *  (AUDIT TECH-FX: the host's key lookup walked every binding a frame, whether a technique was in hand or not). [] with
 *  none in hand, or with the ladder off.
 *  @param {any} entity @param {any} pw @param {string | (() => string)} [keyName] */
export function techniqueHudChips(entity, pw, keyName = '') {
  const hand = techniqueInHand(entity, pw);
  if (!hand || !lootRarityOn()) return NONE;   // TECH-FX: no technique in hand - the frozen empty list, never a new one a frame
  const left = techniqueWait(hand.id);
  _chip.name = techniqueName(hand);
  if (left > 0) {
    const secs = Math.ceil(left);
    if (secs !== _chipSecs) { _chipSecs = secs; _chipSecsText = `${secs}s`; }
    _chip.text = _chipSecsText; _chip.state = 'recovering';
  } else {
    _chip.text = (typeof keyName === 'function' ? keyName() : keyName) || 'ready'; _chip.state = 'active';
  }
  return _chips;
}
/** AUDIT TACT D3's law for the player's own marks: a floating-origin recentre moves the aim, the flight and the fall. */
export function offsetTechniques(offset) {
  if (!offset) return;
  const move = (p) => { if (p != null && p.length >= 3) { p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2]; } };
  const a = _s.aim?.target;
  if (a) { move(a.point); if (a.lane) { a.lane.from[0] += offset[0]; a.lane.from[1] += offset[2]; } }
  const act = _s.act;
  if (act) {
    move(act.point);
    if (act.target) move(act.target.point);
    if (act.lane) { act.lane.from[0] += offset[0]; act.lane.from[1] += offset[2]; }
    if (act.blow) { move(act.blow.feet); if (act.blow.lane) { act.blow.lane.from[0] += offset[0]; act.blow.lane.from[1] += offset[2]; } }
    for (const q of act.queue ?? []) { move(q.from); move(q.to); }
    move(act.from);   // AUDIT TECH-FX: where a leap or a dash began (a Lunge's trail) - its own point, carried into the landing's swing
    for (const l of act.lands ?? []) move(l.at);   // ...and where each falling shaft lands (each its own point, never a queue's)
  }
}
/** A leap or a dash in the air (AUDIT TECH1): the rig asks no gesture while it is - a click in the air started a plain
 *  swing, and the strike the technique was flying to land had no machine to start on. */
export const techniqueFlying = () => _s.act?.kind === 'flight';
/** What is in flight (tests, probes): the aim, the act's kind, the cooldowns. */
export function techniqueState() {
  const wait = new Map();
  for (let i = 0; i < TECH_IDS.length; i++) if (_s.wait[i] > 0) wait.set(TECH_IDS[i], _s.wait[i]);
  return { aiming: !!_s.aim, aim: _s.aim?.target ?? null, act: _s.act?.kind ?? null, wait };
}
/** Tests only: everything fresh. */
export function _resetTechniquesForTests() { _s = fresh(); resetTechniqueFx(); }
