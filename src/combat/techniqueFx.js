// TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL; 2026-10-10, the owner: "lets do code driven design for each
// technique, like real detail and ensure performance remains in tact"): WHAT A TECHNIQUE FEELS LIKE - the camera's
// springs, the hands' push, the shake, the world's burst and the sound, at each of its moments.
//
// The runner (combat/techniques.js) cues a moment - `release`, `hit`, `loose`, `shaft`, `close` - with the host's door
// and the place; this file answers it from its table (TECH_FX). The camera's channel is read by the climb's own view
// step (player/climbFeel.js createClimbFeelHost - first person only, every lens's field of view, the sky's pitch); the
// hands' by the rig's draw (combat/weaponRig.js drawInner, through the renderer's screen offset); the shake, the burst
// and the sound go out through the door at the moment (betterAmbience.weaponKick, the cast engine's impact engine,
// the audio bus).
//
// PERFORMANCE LAW: a frame at rest does nothing and makes nothing - the springs live in one preallocated typed array,
// the two outputs are objects filled in place, and the step returns at once when every spring is still. A moment
// allocates only the burst's own sparks (render/spellImpactFx.js, under its caps) - never a frame.

import { getPref } from '../systems/uiPrefs.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';
import { SOUND } from '../systems/soundClips.js';

const DEG = Math.PI / 180;

/** A shaft's flight, m/s (systems/spellcast.js MISSILE_SPEED - a test holds them equal; this leaf imports no engine). */
export const TECH_ARROW_MPS = 25;

/** The springs: the camera's pitch (rad), roll (rad), eye height (m) and field of view (degrees), and the hands' push
 *  across and down (screen heights). Each is critically damped toward rest at its own stiffness (1/s). */
export const FX_CH = Object.freeze({ pitch: 0, roll: 1, eye: 2, fov: 3, handX: 4, handY: 5 });
export const FX_K = Object.freeze([17, 11, 14, 9, 15, 15]);
const N = FX_K.length;
/** The springs' state: position then velocity, a channel each. */
const _sv = new Float64Array(N * 2);
let _live = false;
/** Below these, a spring has settled and is put to rest exactly. */
const REST_X = 1e-5, REST_V = 1e-4;

/** THE OUTPUTS, filled in place - the shape player/climbFeel.js applyClimbView reads (`pitch`, `roll`, `eye`), and the
 *  field of view's kick in degrees; the hands' push in screen heights (+y down). A class each, never a literal: a
 *  literal's shape is shared with every `{ x, y }` and `{ pitch, roll, ... }` the game makes, and one of those holding
 *  anything but a number turns the field general - then each write here boxed its number (32 bytes a frame in flight,
 *  test/techfx1.test.js). A class's shape is its own, its fields numbers alone, written in place. */
class TechView { constructor() { this.pitch = 0; this.roll = 0; this.eye = [0, 0, 0]; this.fov = 0; } }
class TechHands { constructor() { this.x = 0; this.y = 0; } }
const VIEW = new TechView();
const HANDS = new TechHands();

/**
 * THE TABLE: each technique's moments. A moment's `cam` are the springs' PEAKS (degrees for pitch, roll and the field of
 * view - up and toward the right positive; metres for the eye, down negative; screen heights for the hands, down and
 * right positive), `shake` a Better Ambience kick, `burst` the impact engine's recipe (`r` its radius), `sound` a
 * SOUND name with its volume and pitch. bible/05-Combat/Weapon-Techniques.md THE FEEL's table says each in words.
 */
export const TECH_FX = Object.freeze({
  volley: Object.freeze({
    release: Object.freeze({ cam: { pitch: 0.9, fov: -2 }, hands: { y: 0.03 } }),
    loose: Object.freeze({ burst: 'flare', sound: ['ArrowShoot', 0.75, 0.85] }),
    shaft: Object.freeze({ burst: 'shaft' }),
    close: Object.freeze({ burst: 'close', shake: 0.5 }),
  }),
  pierce: Object.freeze({
    release: Object.freeze({ cam: { fov: -1.5 }, hands: { y: 0.02 } }),
    loose: Object.freeze({ cam: { pitch: 1.4, fov: -3.5 }, hands: { y: 0.05 }, shake: 0.8, burst: 'tracer', sound: ['ArrowShoot', 0.95, 0.7] }),
  }),
  leap: Object.freeze({
    release: Object.freeze({ cam: { fov: 7, pitch: -1 }, hands: { y: -0.06 }, sound: ['SwingLowPitch', 0.9, 0.8] }),
    hit: Object.freeze({ cam: { pitch: -3, eye: -0.12, fov: -4 }, hands: { y: 0.08 }, shake: 2.6, burst: 'land', r: 2.5, sound: ['FallHard', 0.9, 0.85] }),
  }),
  kick: Object.freeze({
    release: Object.freeze({ cam: { fov: 6, pitch: -0.8 }, hands: { y: -0.05 }, sound: ['SwingLowPitch', 0.8, 0.95] }),
    hit: Object.freeze({ cam: { pitch: -2.2, eye: -0.09 }, hands: { y: 0.06 }, shake: 1.8, burst: 'land', r: 2, sound: ['FallHard', 0.75, 1.05] }),
  }),
  whirlwind: Object.freeze({
    release: Object.freeze({ cam: { roll: -7 }, hands: { x: 0.1 }, sound: ['SwingMediumPitch', 1, 0.75] }),
    hit: Object.freeze({ cam: { roll: 5 }, hands: { x: -0.14 }, shake: 0.9, burst: 'sweep', r: 3 }),
  }),
  slam: Object.freeze({
    release: Object.freeze({ cam: { pitch: 2 }, hands: { y: -0.07 }, sound: ['SwingLowPitch', 1, 0.7] }),
    hit: Object.freeze({ cam: { pitch: -3.5, eye: -0.14, fov: -3 }, hands: { y: 0.11 }, shake: 3.2, burst: 'shock', r: 3.5, sound: ['FallHard', 1, 0.7] }),
  }),
  crush: Object.freeze({
    release: Object.freeze({ cam: { pitch: 1.2 }, hands: { y: -0.05 }, sound: ['SwingLowPitch', 0.9, 0.85] }),
    hit: Object.freeze({ cam: { pitch: -2.2 }, hands: { y: 0.07 }, shake: 1.6, burst: 'star' }),
  }),
  haymaker: Object.freeze({
    release: Object.freeze({ cam: { fov: -3, roll: 3 }, hands: { x: -0.05, y: -0.03 }, sound: ['SwingLowPitch', 0.9, 0.95] }),
    hit: Object.freeze({ cam: { pitch: -1.2, fov: 2 }, hands: { x: 0.07 }, shake: 1.4, burst: 'punch' }),
  }),
  cleave: Object.freeze({
    release: Object.freeze({ cam: { roll: 4 }, hands: { x: -0.08 }, sound: ['SwingMediumPitch', 1, 0.8] }),
    hit: Object.freeze({ cam: { roll: -4, pitch: -0.8 }, hands: { x: 0.12 }, shake: 1.1, burst: 'arc', r: 3.2 }),
  }),
  execute: Object.freeze({
    release: Object.freeze({ cam: { pitch: 1.6 }, hands: { y: -0.06 }, sound: ['SwingLowPitch', 1, 0.75] }),
    hit: Object.freeze({ cam: { pitch: -2.8, eye: -0.06 }, hands: { y: 0.09 }, shake: 2, burst: 'chop' }),
  }),
  shadowstep: Object.freeze({
    release: Object.freeze({ cam: { fov: 8, roll: 4 }, hands: { y: 0.06 }, burst: 'vanish', sound: ['SwingHighPitch', 0.8, 1.25] }),
    hit: Object.freeze({ cam: { fov: -3, roll: -4 }, hands: { y: -0.04 }, shake: 1, burst: 'star' }),
  }),
  lunge: Object.freeze({
    release: Object.freeze({ cam: { fov: 7, pitch: -0.6 }, hands: { y: -0.04 }, sound: ['SwingMediumPitch', 0.9, 1.1] }),
    hit: Object.freeze({ cam: { pitch: -1.4, fov: -3 }, hands: { y: 0.06 }, shake: 1.2, burst: 'trail' }),
  }),
});

/** How much a technique moves the screen: the player's own "Technique camera motion" (0..1, systems/uiPrefs.js
 *  techniqueMotion) - the springs, the shake and the hands alike. */
export function techniqueMotion() {
  const v = Number(getPref('techniqueMotion'));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** A spring kicked so its peak from rest is `peak` (a critically damped spring kicked to velocity v peaks at v/(k e)). */
function kick(ch, peak) {
  if (!peak) return;
  _sv[ch * 2 + 1] += peak * FX_K[ch] * Math.E;
  _live = true;
}

/**
 * A MOMENT. `id` the technique, `moment` one of release / hit / loose / shaft / close, `door` the host's technique door
 * (`fx(recipe, at, o)`, `shake(k)`, `sound(clip, volume, pitch)` - each optional), `place` the burst's where
 * (`{ at, ground, yaw, dir, to, len, r }`; null: no burst). Answers whether the technique has the moment.
 */
export function techniqueCue(id, moment, door = null, place = null) {
  const row = TECH_FX[id]?.[moment];
  if (!row) return false;
  const m = techniqueMotion();
  if (m > 0) {
    const c = row.cam;
    if (c) { kick(FX_CH.pitch, (c.pitch ?? 0) * DEG * m); kick(FX_CH.roll, (c.roll ?? 0) * DEG * m); kick(FX_CH.eye, (c.eye ?? 0) * m); kick(FX_CH.fov, (c.fov ?? 0) * m); }
    if (row.hands) { kick(FX_CH.handX, (row.hands.x ?? 0) * m); kick(FX_CH.handY, (row.hands.y ?? 0) * m); }
    if (row.shake) door?.shake?.(row.shake * m);
  }
  if (row.burst && place?.at) door?.fx?.(row.burst, place.at, row.r != null ? { ...place, r: row.r } : place);
  if (row.sound && enhancedSoundsOn()) {
    const clip = SOUND[row.sound[0]];
    if (clip != null) door?.sound?.(clip, row.sound[1], row.sound[2]);
  }
  return true;
}

/** A FRAME: every spring stepped `dt` toward rest, exactly (the critically damped closed form - any frame rate the same
 *  curve), and the outputs filled. At rest it returns at once. */
export function stepTechniqueFx(dt) {
  if (!_live || !(dt > 0)) return;
  let any = false;
  for (let i = 0; i < N; i++) {
    const x = _sv[i * 2], v = _sv[i * 2 + 1];
    if (x === 0 && v === 0) continue;
    const k = FX_K[i], e = Math.exp(-k * dt), b = v + k * x;
    let x1 = (x + b * dt) * e, v1 = (v - k * b * dt) * e;
    if (Math.abs(x1) < REST_X && Math.abs(v1) < REST_V) { x1 = 0; v1 = 0; } else any = true;
    _sv[i * 2] = x1; _sv[i * 2 + 1] = v1;
  }
  _live = any;
  VIEW.pitch = _sv[FX_CH.pitch * 2]; VIEW.roll = _sv[FX_CH.roll * 2]; VIEW.eye[1] = _sv[FX_CH.eye * 2]; VIEW.fov = _sv[FX_CH.fov * 2];
  HANDS.x = _sv[FX_CH.handX * 2]; HANDS.y = _sv[FX_CH.handY * 2];
}

/** The camera's channel now (`pitch`, `roll` radians, `eye` metres, `fov` degrees) - filled in place, never a copy. */
export const techniqueView = () => VIEW;
/** The hands' push now, in screen heights (+x right, +y down) - filled in place. */
export const techniqueHands = () => HANDS;
/** Whether a spring is still moving. */
export const techniqueFxLive = () => _live;

/** Everything at rest (a load, a test). */
export function resetTechniqueFx() {
  _sv.fill(0);
  _live = false;
  VIEW.pitch = 0; VIEW.roll = 0; VIEW.eye[1] = 0; VIEW.fov = 0;
  HANDS.x = 0; HANDS.y = 0;
}
