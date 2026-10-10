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
// { sky, technique, speedScale }) - a player shaft through the host's lane (`sky`: from that very point, not the bow
// hand); drainFatigue(n) - the host's fatigue door; face(point) - turn the view toward a point (Shadowstep's turn) }.
// A host that hands none still swings its techniques; it cannot leap, dash or shoot one (said so).

import { techniqueById, techniqueMult, TECHNIQUE_MAX_SPEED } from './techniqueRoster.js';
import { techniqueLineOf, lootRarityOn } from '../systems/lootRarity.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { sigilDueling } from '../systems/sigil.js';
import { FATIGUE_MULTIPLIER } from '../systems/statMods.js';
import { spendAmmoFor, ammoCountFor } from '../systems/inventory.js';
import { tallySwingSkills } from '../scenes/hostCombat.js';
import { playerDoor } from '../systems/playerDoor.js';
import { GRAVITY } from '../player/motor.js';
import { blowSchedule } from '../characters/weaponStates.js';
import { WEAPON_REACH } from './playerWeapon.js';
import { playerBody, TECH_BODY_RADIUS } from './techniqueBlow.js';

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
export const notReadyText = (name, s) => `${name} is not ready (${s}s).`;
export const readyAgainText = (name) => `${name} is ready again.`;

// ── the state: the player's, one ───────────────────────────────────
const fresh = () => ({
  /** id -> seconds of play left on its cooldown */
  wait: new Map(),
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
/** The technique in hand - { id, value, tech, item } - or null. Read whatever the ladder's switch says (the refusal says
 *  it: a piece found under the ladder keeps its line, and sleeps with it off). */
export function techniqueInHand(entity, pw) {
  const item = techniqueItem(entity, pw);
  const line = techniqueLineOf(item);
  const tech = line ? techniqueById(line.param) : null;
  return tech ? { id: line.param, value: line.value, tech, item } : null;
}
/** Seconds left on a technique's cooldown (0 ready). */
export const techniqueWait = (id) => Math.max(0, _s.wait.get(id) ?? 0);
/** The fatigue a technique costs, in the entity's own units (the sheet's points x FATIGUE_MULTIPLIER). A technique is a
 *  burst bought on purpose, so BALANCE1's drain scale is not on it (statMods.js FATIGUE_DRAIN_SCALE's own exception). */
export const techniqueFatigue = (tech) => Math.max(0, Math.round((tech?.fatigue ?? 0) * FATIGUE_MULTIPLIER));

// ── the vector arithmetic ───────────────────────────────────────────
const lookOf = (cam) => {
  const y = cam?.yaw ?? 0, p = cam?.pitch ?? 0;
  return [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
};
const flatOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
const at = (o, d, s) => [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
const flatDist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);

/**
 * THE FLOOR UNDER A POINT - the highest ground at or below `p` (the collider's meshes, and the terrain the mesh ray
 * never sees - its heightAt), or null when there is none within 40 m.
 */
export function floorUnder(p, collider) {
  const o = [p[0], p[1] + 1, p[2]];
  let y = null;
  try {
    const h = collider?.surfaceHit?.(o, [0, -1, 0], 41) ?? null;
    const d = h && Number.isFinite(h.dist) ? h.dist : collider?.raycast?.(o, [0, -1, 0], 41);
    if (Number.isFinite(d)) y = o[1] - d;
  } catch { /* no mesh floor */ }
  try {
    const t = collider?.heightAt?.(p[0], p[2]);
    if (Number.isFinite(t) && t <= o[1] && (y == null || t > y)) y = t;
  } catch { /* no terrain */ }
  return y;
}

/**
 * WHERE THE LOOK MEETS THE GROUND, within `range` metres of the feet on the level: the first thing the look strikes
 * (or its end), the floor under it - pulled back off a wall it struck. `{ point, dist }` (`dist` on the level from the
 * feet) or null.
 */
export function groundAim(eye, look, feet, collider, range) {
  let d = range + 2;
  try { const hit = collider?.raycast?.(eye, look, range + 2); if (Number.isFinite(hit)) d = Math.max(0, hit - 0.3); } catch { /* the look's end */ }
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
    if (!f || f.dead || !f.ai?.feet || playerBody(f)) continue;
    const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? 1.8) * 0.5, f.ai.feet[2]];
    const v = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]];
    const dist = Math.hypot(v[0], v[1], v[2]);
    if (!(dist > 0.1) || dist > range + 1.5) continue;
    const along = v[0] * look[0] + v[1] * look[1] + v[2] * look[2];
    if (along <= 0) continue;
    const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
    if (perp > 0.6 + 0.06 * along) continue;
    try { const wall = collider?.raycast?.(eye, [v[0] / dist, v[1] / dist, v[2] / dist], dist); if (Number.isFinite(wall) && wall < dist - 0.4) continue; } catch { /* in sight */ }
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

// ── the aim ─────────────────────────────────────────────────────────
/**
 * WHAT AN AIMING TECHNIQUE AIMS AT NOW, off the look: `{ ok, point, foe, lane, why }`.
 *   ground (Volley)          the ground the look meets, within its range
 *   target (Leap, Kick)      the foe under the crosshair - the ground before it - or the ground the look meets
 *   foe (Shadowstep)         the foe under the crosshair, and the ground behind it (beside it if a wall stands there)
 *   lane (Piercing, Lunge)   the look's way from the feet - a shot's to its length or the first wall, a dash's on the level
 * A landing too far below or above the feet, or past the reach, is no aim (`ok` false, `why` the line said on release).
 */
export function aimFor(tech, cam, collider, foes = undefined) {
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
      try { const hit = collider?.raycast?.(eye, look, tech.length); if (Number.isFinite(hit)) len = Math.max(0.5, hit); } catch { /* the shot's length */ }
      return { ok: true, lane: { from: [feet[0], feet[2]], dir: [way[0], way[2]], len: len * Math.hypot(look[0], look[2]), halfW: 0.3, yaw, y: feet[1] }, point: null };
    }
    const chest = [feet[0], feet[1] + 1, feet[2]];
    let len = tech.length;
    try { const hit = collider?.raycast?.(chest, way, tech.length + 0.6); if (Number.isFinite(hit)) len = Math.max(0, hit - 0.6); } catch { /* the dash's length */ }
    const end = at(feet, way, len);
    const y = floorUnder([end[0], feet[1] + 0.6, end[2]], collider);
    const point = [end[0], y ?? feet[1], end[2]];
    return { ok: len >= 1 && y != null && level(point), point, lane: { from: [feet[0], feet[2]], dir: [way[0], way[2]], len, halfW: tech.halfW ?? 0.9, yaw, y: feet[1] }, why: CANNOT_LEAP_TEXT };
  }
  const foe = foeUnderLook(eye, look, tech.range[1], collider, foes);
  if (tech.aim === 'foe' && !foe) return { ok: false, why: NO_FOE_TEXT };
  if (foe) {
    const f = foe.ai.feet, r = (Number.isFinite(foe.radius) ? foe.radius : TECH_BODY_RADIUS) + 0.55;
    const toward = flatDist(feet, f) > 1e-6 ? [(f[0] - feet[0]) / flatDist(feet, f), 0, (f[2] - feet[2]) / flatDist(feet, f)] : flatOf(cam.yaw ?? 0);
    const spots = tech.aim === 'foe'
      ? (() => { const fy = foe.ai.yaw ?? 0, back = flatOf(fy + Math.PI), side = flatOf(fy + Math.PI / 2); return [at(f, back, tech.behind ?? 1), at(f, side, tech.behind ?? 1), at(f, side, -(tech.behind ?? 1)), at(f, toward, -r)]; })()
      : [at(f, toward, -r)];
    for (const s of spots) {
      const chest = [f[0], f[1] + 1, f[2]], dir = [s[0] - f[0], 0, s[2] - f[2]], dl = Math.hypot(dir[0], dir[2]);
      try { if (dl > 1e-6) { const wall = collider?.raycast?.(chest, [dir[0] / dl, 0, dir[2] / dl], dl + 0.4); if (Number.isFinite(wall) && wall < dl + 0.35) continue; } } catch { /* clear */ }
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
 *   collider       the host's collider (raycast / surfaceHit / heightAt)
 *   held           the key, held this frame
 *   ready          the rig's own gate - drawn, no spell, no cast, no climb, no equip pause, no act's tool, not paralyzed
 *   startSwing(s)  start the machine's strike `s` (and the arm's): true when it began
 *   cancel         the press that sets an aim aside (ActivateCenterObject held - the drawn bow's own un-draw)
 *   door, say, noteShot(weapon)
 */
export function stepTechnique(dt, ctx) {
  if (!ctx || !ctx.entity || !ctx.pw) return;
  if (_s.owner !== ctx.rig) { _s.owner = ctx.rig; _s.aim = null; endAct(ctx.pw); }
  _s.say = ctx.say ?? _s.say;
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  for (const [id, left] of _s.wait) {
    const next = left - step;
    if (next > 0) { _s.wait.set(id, next); continue; }
    _s.wait.delete(id);
    const hand = techniqueInHand(ctx.entity, ctx.pw);
    if (hand?.id === id) say(readyAgainText(hand.tech.name));   // the classic HUD has no chips: the line says it
  }
  const held = !!ctx.held, pressed = held && !_s.prev, released = !held && _s.prev;
  _s.prev = held;
  stepAct(step, ctx);
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
  if (!hand) return NO_TECHNIQUE_TEXT;
  if (!lootRarityOn()) return LADDER_OFF_TEXT;   // Loot-II law 6: off is DFU exactly - a found line sleeps
  if (sigilDueling()) return DUEL_TEXT;   // TECH law 3: never at a player - every power that sleeps in a duel, or a bout between players, sleeps
  if (pw.sheathed) return SHEATHED_TEXT;
  if (_s.act) return true;   // one at a time
  if (!ctx.ready || pw.machine?.state !== 'Idle' || (pw.machine.now < pw.machine.cooldownUntil)) return true;   // mid-swing, a bow's recovery, a spell's hands
  const left = techniqueWait(hand.id);
  if (left > 0) return notReadyText(hand.tech.name, Math.ceil(left));
  if ((ctx.entity.fatigue ?? 0) < techniqueFatigue(hand.tech)) return TIRED_TEXT;
  const t = hand.tech;
  if (t.mech === 'rain' || t.mech === 'pierce') {
    if (!ctx.door?.fireArrow) return NOT_HERE_TEXT;
    if (ammoCountFor(ctx.entity.items, pw.weapon) < 1) return NO_AMMO_TEXT;
  }
  if (t.mech === 'leap' || t.mech === 'dash') {
    const m = ctx.door?.motor?.();
    if (!m) return NOT_HERE_TEXT;
    if (m.climb?.isClimbing || m._wall || m._pkMove || m.swimming || m.levitating || m.slowFalling || m.riding || m.isDown?.() || !m.grounded) return CANNOT_LEAP_TEXT;
  }
  return null;
}

/** Pay a technique's price: its fatigue through the host's drain (or the entity, with no door), its cooldown. */
function pay(hand, ctx) {
  const n = techniqueFatigue(hand.tech);
  if (ctx.door?.drainFatigue) ctx.door.drainFatigue(n);
  else ctx.entity.fatigue = Math.max(0, (ctx.entity.fatigue ?? 0) - n);
  _s.wait.set(hand.id, hand.tech.cooldown);
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
    return;
  }
  if (t.mech === 'rain' || t.mech === 'pierce') {
    pw.techniqueBlow = null;
    if (!ctx.startSwing?.('StrikeDown')) return;
    pay(hand, ctx);
    _s.act = { kind: 'shot', hand, target, pw, t: 0, loosed: false, weapon: pw.weapon };
    return;
  }
  // a leap or a dash: the body flies first, and the strike is started to land with it
  const m = ctx.door?.motor?.();
  const from = ctx.cam.feet;
  if (!m || !from || !target?.point) return;
  const apex = t.mech === 'leap' ? t.apex : 0.25;
  const fl = launchTo(from, target.point, apex);
  if (!m.techniqueLaunch?.(fl.dir, fl.along, fl.up)) { say(CANNOT_LEAP_TEXT); return; }
  pay(hand, ctx);
  const lane = t.aim === 'lane' && target.lane ? { from: target.lane.from, dir: target.lane.dir, len: target.lane.len, halfW: target.lane.halfW } : null;
  _s.act = { kind: 'flight', hand, target, pw, t: 0, time: fl.time, struck: false, lane, foe: target.foe ?? null };
}

/** The flight, the swing, the shot and the fall, a frame on. */
function stepAct(dt, ctx) {
  const a = _s.act;
  if (!a) return;
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
    while (a.queue.length && a.queue[0].at <= a.t) {
      const q = a.queue.shift();
      ctx.door?.fireArrow?.(q.from, q.dir, { sky: true, technique: { id: a.hand.id, mult: a.mult, pierce: 1 } });
    }
    if (!a.queue.length && a.t >= a.until) _s.act = null;
    return;
  }
  if (a.kind === 'flight') {
    const m = ctx.door?.motor?.();
    const landed = !m || (a.t > 0.08 && m.grounded);
    // the strike is started to land WITH the body: when the time left in the air is the swing's own time to its hit
    const hitAt = strikeHitAt(pw, a.hand.tech.strike, dt);
    if (!a.struck && (landed || a.time - a.t <= hitAt || a.t > a.time + 0.6)) {
      a.struck = true;
      if (a.foe && a.hand.tech.mech === 'dash' && !a.lane) ctx.door?.face?.(a.foe.ai?.feet ?? null);   // Shadowstep: turn on the foe behind which you land
      const blow = swingBlow(a.hand.id, a.hand.value, ctx.cam, a.lane ? { lane: a.lane, arc: 'all', reach: a.lane.len }
        : a.hand.tech.mech === 'dash' && a.foe ? { target: a.foe } : {});
      pw.techniqueBlow = blow;
      if (ctx.startSwing?.(a.hand.tech.strike)) _s.act = { kind: 'swing', hand: a.hand, blow, pw, t: 0 };
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
    ctx.door?.fireArrow?.(ctx.cam.pos, look, { sky: false, technique: { id: hand.id, mult, pierce: t.through }, speedScale: t.speed });
    ctx.noteShot?.(weapon);
    _s.act = null;
    return;
  }
  // the Volley: as many shafts as the quiver gives, each spent, each a shot's tally, falling on the disc from above
  let n = 0;
  for (; n < t.arrows; n++) { if (!spendAmmoFor(items, weapon)) break; tallySwingSkills(ctx.entity, weapon); }
  if (!n || !a.target?.point) { _s.act = null; return; }
  ctx.noteShot?.(weapon);
  const c = a.target.point, feet = ctx.cam.feet ?? c;
  // the height they fall from: the sky outdoors, under the ceiling indoors
  let h = t.height;
  try { const up = ctx.collider?.raycast?.([c[0], c[1] + 0.3, c[2]], [0, 1, 0], t.height); if (Number.isFinite(up)) h = Math.max(1.6, up + 0.3 - 0.4); } catch { /* the sky */ }
  const toMe = flatDist(c, feet) > 1e-6 ? [(feet[0] - c[0]) / flatDist(c, feet), (feet[2] - c[2]) / flatDist(c, feet)] : [0, 0];
  const queue = volleyPoints(c, t.radius, n, Math.random()).map((p, i) => {
    const from = [p[0] + toMe[0] * h * 0.25, c[1] + h, p[2] + toMe[1] * h * 0.25];   // they come in from the archer's side
    const d = [p[0] - from[0], p[1] - from[1], p[2] - from[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { at: t.delay + (n > 1 ? (t.spread * i) / (n - 1) : 0), from, dir: [d[0] / l, d[1] / l, d[2] / l], to: p };
  });
  _s.act = { kind: 'rain', hand, point: c, t: 0, queue, mult, until: t.delay + t.spread + h / 25 + 0.2 };
}

// ── what the screen shows ──────────────────────────────────────────
/** A mark as the ground pass draws it (render/foeTelegraph.js - ai/foeBlows.js drawableBlows' shape). */
const mark = (kind, origin, yaw, sizes, t, flash, ok = true) => ({
  blow: { kind, origin, yaw, start: 0, land: 1, color: ok ? TECH_COLOR : TECH_BAD_COLOR, technique: true, ...sizes },
  phase: { t, flash }, nearFloor: 0.6,
});
/** THE PLAYER'S MARKS on the ground now: the aim while the key is held (a disc where a Volley falls or a leap lands, the
 *  foe a Shadowstep goes behind, the lane a shot flies or a dash runs - red where it cannot be reached), the Volley's disc
 *  while it falls, a ring about the feet through a swing that strikes all round. */
export function techniqueMarks(now = 0) {
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
export const techniqueMarksNow = (now = undefined) => techniqueMarks(now ?? (typeof performance !== 'undefined' ? performance.now() / 1000 : 0));
/** The HUD's chip for the technique in hand (ui/enhancedHud.js setHudSetChips' shape): its name, and its seconds while it
 *  recovers - or its key while ready. [] with none in hand, or with the ladder off. */
export function techniqueHudChips(entity, pw, keyName = '') {
  const hand = techniqueInHand(entity, pw);
  if (!hand || !lootRarityOn()) return [];
  const left = techniqueWait(hand.id);
  return [{ key: 'technique', set: 'technique', name: hand.tech.name, text: left > 0 ? `${Math.ceil(left)}s` : (keyName || 'ready'), state: left > 0 ? 'recovering' : 'active' }];
}
/** AUDIT TACT D3's law for the player's own marks: a floating-origin recentre moves the aim, the flight and the fall. */
export function offsetTechniques(offset) {
  if (!offset) return;
  const move = (p) => { if (Array.isArray(p)) { p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2]; } };
  const a = _s.aim?.target;
  if (a) { move(a.point); if (a.lane) { a.lane.from[0] += offset[0]; a.lane.from[1] += offset[2]; } }
  const act = _s.act;
  if (act) {
    move(act.point);
    if (act.target) move(act.target.point);
    if (act.lane) { act.lane.from[0] += offset[0]; act.lane.from[1] += offset[2]; }
    if (act.blow) { move(act.blow.feet); if (act.blow.lane) { act.blow.lane.from[0] += offset[0]; act.blow.lane.from[1] += offset[2]; } }
    for (const q of act.queue ?? []) { move(q.from); move(q.to); }
  }
}
/** What is in flight (tests, probes): the aim, the act's kind, the cooldowns. */
export const techniqueState = () => ({ aiming: !!_s.aim, aim: _s.aim?.target ?? null, act: _s.act?.kind ?? null, wait: new Map(_s.wait) });
/** Tests only: everything fresh. */
export function _resetTechniquesForTests() { _s = fresh(); }
