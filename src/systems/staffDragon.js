// @ts-check
// DRAGON-RIDE (2026-10-28, Staff-Events.md section 12): an Admin rides the Dwarven Dragon. /dragon mounts it: I fly
// at ten times levitation's pace, the saddle is drawn over my view, and a click fires both shoulder cannons - shock
// balls that strike monsters alone, for DRAGON_BOLT_DAMAGE each. /dragon again lands me. This page alone: the ride,
// the pace and the balls are mine, never sent; no relay, no account change.
import { POSE_RIDE, relaySupportsDragonRide } from '../net/wire.js'; // DRAGON1: the ride's code and its one relay gate

/** The glyphs that may ride: the Developer's (the panel's Admin) and Shadow Fang's. */
export const DRAGON_GLYPHS = Object.freeze(['dev', 'shadowfang']);
/** Levitation's pace, times this, while I ride. */
export const DRAGON_FLY_MULT = 10;
/** What one shock ball takes off a monster it meets. */
export const DRAGON_BOLT_DAMAGE = 999_999;
/** A shock ball's flight, metres a second (a spell's is 25). */
export const DRAGON_BOLT_SPEED = 120;
/** The least time between two volleys, ms. */
export const DRAGON_BOLT_COOLDOWN_MS = 350;
/** Where the two barrels sit from my eye: metres to each side, below, ahead. */
export const DRAGON_BARRELS = Object.freeze({ side: 1.4, down: 0.6, ahead: 2.0 });
/** How far down the look the two balls meet with nothing under my aim, metres - far enough that they fly near level
 *  (DRAGON-AIM, 2026-10-29, mob: they crossed at a fixed 40 m and split past it). */
export const DRAGON_BOLT_MEET = 300;
/** DRAGON-AIM: how far off my look a body may stand and still be what I aim at, metres. */
export const DRAGON_AIM_SLACK = 3;
/** How long the saddle shows the firing picture after a volley, ms. */
export const DRAGON_FIRE_SHOW_MS = 160;
/** The saddle's two pictures under public/art/dwarven-dragon/: at rest, and the cannons firing. */
export const SADDLE_PICTURES = Object.freeze(['saddle-0', 'saddle-1']);
/** The pose's ride while I ride - the wire's POSE_RIDE.Dragon, which others draw as the dragon itself. An older relay
 *  clamps it to the cart, so it is said only to a relay the wire's own gate names (DRAGON1: this file kept a copy of
 *  that number, and a merge that renumbered the relay left the copy opening on relays that clamp it). */
export const DRAGON_POSE_RIDE = POSE_RIDE.Dragon;
let _relayKeepsRide = false;
/** The relay's version, as each welcome says it (scenes/world.js onRelayVersion). @param {unknown} v */
export function noteDragonRelay(v) {
  _relayKeepsRide = relaySupportsDragonRide(v);
}
/** My pose's `rd` while I ride - an Admin's ride, or DRAGON5's tamed dragon (`mode` my transport's) - on a relay that keeps
 *  it, else null (the pose's own ride stands). @param {unknown} [mode] */
export const dragonPoseRide = (mode = null) =>
  (_ride || mode === 'Dragon') && _relayKeepsRide ? DRAGON_POSE_RIDE : null;

/** @type {{ flyWas: boolean, firedAt: number, look: number } | null} */
let _ride = null;

/** Whether a player wearing `glyphs` may ride. @param {unknown} glyphs */
export const mayRideDragon = (glyphs) => Array.isArray(glyphs) && glyphs.some((g) => DRAGON_GLYPHS.includes(g));
export const ridingDragon = () => _ride !== null;
/** Mount: `flyWas` is /fly before it, given back when I land; `look` the dragon's (1 the Aetherbright, DRAGON-BLUE). */
export function mountDragon(flyWas = false, look = 0) {
  _ride = { flyWas: !!flyWas, firedAt: -Infinity, look: look === 1 ? 1 : 0 };
}
/** DRAGON-BLUE (2026-10-29, as the owner asked): the look of the dragon I ride - 1 the Aetherbright
 *  (Dwarven-Dragon.md section 11, the tame's own palette), 0 the brass or on foot. My saddle and the pose's `rc` read it. */
export const dragonRideLook = () => (_ride ? _ride.look : 0);
/** DRAGON-BLUE: the ride's look changed in the saddle. @param {number} look */
export function setDragonRideLook(look) {
  if (_ride) _ride.look = look === 1 ? 1 : 0;
}
/** Land: answers what /fly was before the ride, or null when I was not riding. */
export function landDragon() {
  const was = _ride ? _ride.flyWas : null;
  _ride = null;
  return was;
}
/** The flight's multiplier now (player/motor.js registerFlySpeedMod). */
export const dragonFlyMult = () => (_ride ? DRAGON_FLY_MULT : 1);
/** DRAGON-SHOTS (2026-10-29, as the owner asked): the volleys fired, for the wire. The pose's
 *  cast count (`cn`) was the rig's alone, counted as the hands play a cast, and the cannons play none - so no peer drew a ball. */
let _volleys = 0;
/** A volley at `now` (ms): true and the clock set when the cannons are ready. @param {number} now */
export function dragonFire(now) {
  if (!_ride || now - _ride.firedAt < DRAGON_BOLT_COOLDOWN_MS) return false;
  _ride.firedAt = now;
  _volleys = (_volleys + 1) & 0xffff;
  return true;
}
/** DRAGON-SHOTS: the pose's cast from the rig's (`{ n, rangeType, element }`, combat/weapon/weaponRig.js) - its count plus my
 *  volleys, so each volley moves `cn` as a cast does; in the saddle every press is the cannons', a ranged shock.
 *  @param {{ n: number, rangeType: number, element: number }} cast */
export const dragonWireCast = (cast) => ({
  n: (cast.n + _volleys) & 0xffff,
  rangeType: _ride ? 2 : cast.rangeType,
  element: _ride ? 3 : cast.element,
});
/** DRAGON-SHOTS: a peer's cast drawn (`fx`, the engine's spellVisual, with `look` its { from, dir, ... }) - from both cannons
 *  when the peer rides the dragon (`rd`, the pose's ride), else from the eye as any cast.
 *  @param {(look: any) => unknown} fx @param {{ from: number[], dir: number[] }} look @param {unknown} rd */
export function drawPeerCast(fx, look, rd) {
  if (rd !== DRAGON_POSE_RIDE) {
    fx(look);
    return;
  }
  for (const v of dragonVolley(look.from, look.dir)) fx({ ...look, from: v.pos, dir: v.dir });
}
/** Whether the saddle shows its firing picture at `now`. @param {number} now */
export const dragonFiring = (now) => !!_ride && now - _ride.firedAt < DRAGON_FIRE_SHOW_MS;

/** The shock ball's bundle: shock, at range, Damage Health - drawn and sounded as a spell, landed by the ball's own hurt. */
export function dragonBolt() {
  const e = {
    type: 4,
    subType: -1,
    magnitudeBaseLow: DRAGON_BOLT_DAMAGE,
    magnitudeBaseHigh: DRAGON_BOLT_DAMAGE,
    magnitudeLevelBase: 0,
    magnitudeLevelHigh: 0,
    magnitudePerLevel: 1,
    durationBase: 0,
    durationMod: 0,
    durationPerLevel: 1,
    chanceBase: 100,
    chanceMod: 0,
    chancePerLevel: 1,
  };
  return {
    name: '',
    index: -1,
    element: 3,
    rangeType: 2,
    icon: 0,
    effects: [e, { type: -1, subType: -1 }, { type: -1, subType: -1 }],
  };
}

/** DRAGON-AIM: how far down the look the balls should meet - the nearest live body (`{ feet, height }`, a foe's `ai`)
 *  within DRAGON_AIM_SLACK of the look and nearer than DRAGON_BOLT_MEET, else DRAGON_BOLT_MEET.
 *  @param {number[]} eye @param {number[]} dir @param {Iterable<{ feet?: number[], height?: number } | null | undefined>} bodies */
export function dragonAimDistance(eye, dir, bodies) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  let best = DRAGON_BOLT_MEET;
  for (const b of bodies) {
    const p = b?.feet;
    if (!Array.isArray(p) || p.length < 3) continue;
    const c = [p[0] - eye[0], p[1] + (b.height ?? 2) / 2 - eye[1], p[2] - eye[2]];
    const t = (c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2]) / len;
    if (t <= 2 || t >= best) continue;
    if (Math.hypot(c[0], c[1], c[2]) ** 2 - t * t <= DRAGON_AIM_SLACK ** 2) best = t;
  }
  return best;
}

/** The volley for an eye and a look: a ball from each barrel (left and right of the eye, a little below and ahead), both
 *  aimed at the point `meet` metres down the look, so they meet on what I aim at (dragonAimDistance).
 *  @param {number[]} eye @param {number[]} dir @param {number} [meet] */
export function dragonVolley(eye, dir, meet = DRAGON_BOLT_MEET) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const f = [dir[0] / len, dir[1] / len, dir[2] / len];
  const flat = Math.hypot(f[0], f[2]) || 1;
  const r = [f[2] / flat, 0, -f[0] / flat]; // level, square to the look
  const { side, down, ahead } = DRAGON_BARRELS;
  const aim = [eye[0] + f[0] * meet, eye[1] + f[1] * meet, eye[2] + f[2] * meet];
  return [-1, 1].map((s) => {
    const pos = [
      eye[0] + f[0] * ahead + r[0] * side * s,
      eye[1] + f[1] * ahead - down,
      eye[2] + f[2] * ahead + r[2] * side * s,
    ];
    const d = [aim[0] - pos[0], aim[1] - pos[1], aim[2] - pos[2]];
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    return { pos, dir: [d[0] / n, d[1] / n, d[2] / n] };
  });
}

/** The line /staff adds for the ride. */
export const DRAGON_HELP_LINE =
  '/dragon [on|off|blue|brass] - ride the Dwarven Dragon, blue the Aetherbright (Admins only)';
/** /dragon [on|off|blue|brass], or null when the line is not one (its own grammar, beside net/staffCommands.js's: the relay
 *  reads that file's bytes, and the ride is this page's alone). A bare /dragon turns the ride over (`on` undefined); blue
 *  (or aether, aetherbright) mounts the Aetherbright or turns my dragon to it, brass back (DRAGON-BLUE).
 *  @param {unknown} text */
export function parseDragonCommand(text) {
  const m = /^\/dragon(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const words = (m[1] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const look = { blue: 1, aether: 1, aetherbright: 1, brass: 0 }[words[0] ?? ''];
  if (words.length > 1 || (words.length && words[0] !== 'on' && words[0] !== 'off' && look === undefined))
    return { error: 'Usage: /dragon [on|off|blue|brass].' };
  if (look !== undefined) return { cmd: 'dragon', on: true, look };
  return words.length ? { cmd: 'dragon', on: words[0] === 'on' } : { cmd: 'dragon' };
}

/** For tests: no ride. */
export function _resetDragonRide() {
  _ride = null;
  _relayKeepsRide = false;
  _volleys = 0;
}
