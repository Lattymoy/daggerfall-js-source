// @ts-check
// DRAGON-RIDE (2026-10-28, Staff-Events.md section 12): an Admin rides the Dwarven Dragon. /dragon mounts it: I fly
// at ten times levitation's pace, the saddle is drawn over my view, and a click fires both shoulder cannons - shock
// balls that strike monsters alone, for DRAGON_BOLT_DAMAGE each. /dragon again lands me. This page alone: the ride,
// the pace and the balls are mine, never sent; no relay, no account change.
import { POSE_RIDE, relaySupportsDragonRide } from '../net/wire.js';   // DRAGON1: the ride's code and its one relay gate

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
/** How far down the look the two balls cross, metres. */
export const DRAGON_BOLT_MEET = 40;
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
export function noteDragonRelay(v) { _relayKeepsRide = relaySupportsDragonRide(v); }
/** My pose's `rd` while I ride on a relay that keeps it, else null (the pose's own ride stands). */
export const dragonPoseRide = () => (_ride && _relayKeepsRide ? DRAGON_POSE_RIDE : null);

/** @type {{ flyWas: boolean, firedAt: number } | null} */
let _ride = null;

/** Whether a player wearing `glyphs` may ride. @param {unknown} glyphs */
export const mayRideDragon = (glyphs) => Array.isArray(glyphs) && glyphs.some((g) => DRAGON_GLYPHS.includes(g));
export const ridingDragon = () => _ride !== null;
/** Mount: `flyWas` is /fly before it, given back when I land. */
export function mountDragon(flyWas = false) { _ride = { flyWas: !!flyWas, firedAt: -Infinity }; }
/** Land: answers what /fly was before the ride, or null when I was not riding. */
export function landDragon() { const was = _ride ? _ride.flyWas : null; _ride = null; return was; }
/** The flight's multiplier now (player/motor.js registerFlySpeedMod). */
export const dragonFlyMult = () => (_ride ? DRAGON_FLY_MULT : 1);
/** A volley at `now` (ms): true and the clock set when the cannons are ready. @param {number} now */
export function dragonFire(now) {
  if (!_ride || now - _ride.firedAt < DRAGON_BOLT_COOLDOWN_MS) return false;
  _ride.firedAt = now;
  return true;
}
/** Whether the saddle shows its firing picture at `now`. @param {number} now */
export const dragonFiring = (now) => !!_ride && now - _ride.firedAt < DRAGON_FIRE_SHOW_MS;

/** The shock ball's bundle: shock, at range, Damage Health - drawn and sounded as a spell, landed by the ball's own hurt. */
export function dragonBolt() {
  const e = { type: 4, subType: -1, magnitudeBaseLow: DRAGON_BOLT_DAMAGE, magnitudeBaseHigh: DRAGON_BOLT_DAMAGE, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 };
  return { name: '', index: -1, element: 3, rangeType: 2, icon: 0, effects: [e, { type: -1, subType: -1 }, { type: -1, subType: -1 }] };
}

/** The volley for an eye and a look: a ball from each barrel (left and right of the eye, a little below and ahead), both
 *  aimed at the point DRAGON_BOLT_MEET metres down the look, so they cross on what I aim at.
 *  @param {number[]} eye @param {number[]} dir */
export function dragonVolley(eye, dir) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const f = [dir[0] / len, dir[1] / len, dir[2] / len];
  const flat = Math.hypot(f[0], f[2]) || 1;
  const r = [f[2] / flat, 0, -f[0] / flat];   // level, square to the look
  const { side, down, ahead } = DRAGON_BARRELS;
  const aim = [eye[0] + f[0] * DRAGON_BOLT_MEET, eye[1] + f[1] * DRAGON_BOLT_MEET, eye[2] + f[2] * DRAGON_BOLT_MEET];
  return [-1, 1].map((s) => {
    const pos = [eye[0] + f[0] * ahead + r[0] * side * s, eye[1] + f[1] * ahead - down, eye[2] + f[2] * ahead + r[2] * side * s];
    const d = [aim[0] - pos[0], aim[1] - pos[1], aim[2] - pos[2]];
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    return { pos, dir: [d[0] / n, d[1] / n, d[2] / n] };
  });
}

/** The line /staff adds for the ride. */
export const DRAGON_HELP_LINE = '/dragon [on|off] - ride the Dwarven Dragon (Admins only)';
/** /dragon [on|off], or null when the line is not one (its own grammar, beside net/staffCommands.js's: the relay reads that
 *  file's bytes, and the ride is this page's alone). A bare /dragon turns the ride over (`on` undefined).
 *  @param {unknown} text */
export function parseDragonCommand(text) {
  const m = /^\/dragon(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const words = (m[1] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 1 || (words.length && words[0] !== 'on' && words[0] !== 'off')) return { error: 'Usage: /dragon [on|off].' };
  return words.length ? { cmd: 'dragon', on: words[0] === 'on' } : { cmd: 'dragon' };
}

/** For tests: no ride. */
export function _resetDragonRide() { _ride = null; _relayKeepsRide = false; }
