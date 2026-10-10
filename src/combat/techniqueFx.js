// TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL; 2026-10-10, the owner: "lets do code driven design for each
// technique, like real detail and ensure performance remains in tact"): WHAT A TECHNIQUE FEELS LIKE - the camera's
// springs, the hands' dip, the shake, the world's burst and the sound, at each of its moments.
//
// The runner (combat/techniques.js) cues a moment - `release`, `hit`, `loose`, `shaft`, `close` - with the host's door
// and the place; this file answers it from its table (TECH_FX). The camera's channel is read by the climb's own view
// step (player/climbFeel.js createClimbFeelHost - the pitch, roll and eye first person only, the field of view's kick
// every lens's as the climb's, and the sky's pitch); the hands' by the rig's draw (combat/weaponRig.js drawInner: the
// classic sprites through the renderer's screen offset, the Morrowind arm through its own screen transform); the
// shake, the burst and the sound go out through the door at the moment (betterAmbience.weaponKick, the cast engine's
// impact engine, the audio bus).
//
// PERFORMANCE LAW: a frame at rest does nothing and makes nothing - the springs live in one preallocated typed array,
// the two outputs are filled in place, and the step returns at once when every spring is still. A moment allocates at
// the moment (its place, its burst's sparks under the impact engine's caps, a sound) - never a frame.

import { getPref } from '../systems/uiPrefs.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';
import { SOUND } from '../systems/soundClips.js';

const DEG = Math.PI / 180;

/** The springs: the camera's pitch (rad), roll (rad, the camera's own - see techniqueCue), eye height (m) and field of
 *  view (degrees), and the hands' dip (screen heights, down). Each is critically damped toward rest at its own
 *  stiffness (1/s). AUDIT TECH-FX: the hands only ever DIP - every first-person sprite sits flush on the screen's bottom
 *  edge (the classic weapon, the clone, the torch, the spell's hands) or a side edge (a right-aligned Idle, a
 *  left-aligned StrikeRight), so a push up or across lifted it off that edge and showed where its art ends; a dip only
 *  takes it further off the screen. */
export const FX_CH = Object.freeze({ pitch: 0, roll: 1, eye: 2, fov: 3, hands: 4 });
export const FX_K = Object.freeze([17, 11, 14, 9, 15]);
const N = FX_K.length;
/** The springs' state: position then velocity, a channel each. */
const _sv = new Float64Array(N * 2);
let _live = false;
/** Below these, a spring has settled and is put to rest exactly. */
const REST_X = 1e-5, REST_V = 1e-4;

/** THE OUTPUTS, filled in place - the shape player/climbFeel.js applyClimbView reads (`pitch`, `roll`, `eye`), and the
 *  field of view's kick in degrees; the hands' dip in screen heights (`y`, down). A class each, never a literal: a
 *  literal's shape is shared with every `{ x, y }` and `{ pitch, roll, ... }` the game makes, and one of those holding
 *  anything but a number turns the field general - then each write here boxed its number (32 bytes a frame in flight,
 *  test/techfx1.test.js). A class's shape is its own, its number fields only ever numbers, written in place. */
class TechView { constructor() { this.pitch = 0; this.roll = 0; this.eye = [0, 0, 0]; this.fov = 0; } }
class TechHands { constructor() { this.y = 0; } }
const VIEW = new TechView();
const HANDS = new TechHands();

/**
 * THE TABLE: each technique's moments. A moment's `cam` are the springs' PEAKS, AS THE SCREEN SHOWS THEM: `pitch` in
 * degrees, the look up positive; `roll` in degrees, the view leaning right positive (a head tilted to the right
 * shoulder: the horizon's right end rises); `fov` in degrees, wider positive; `eye` in metres, down negative. `hands` is
 * the hands' dip (`y`, screen heights, down - the only way they move: FX_CH). `shake` a Better Ambience kick, `burst`
 * the impact engine's recipe (`r` its radius), `sound` a SOUND name with its volume and pitch.
 *
 * A roll is at most 3 degrees: the sky's backdrop does not roll (render/skyRenderer.js draw(yaw, pitch, fovY, aspect) -
 * the climb's own roll shares it), so a larger one tilts the land against a level sky. A swing's roll leans with the
 * blade's travel: a StrikeLeft (Whirlwind) leans left into it and settles back past level; a StrikeRight (Cleave,
 * Shadowstep, Haymaker) winds up leaning left and lands leaning right. A bow's loose plays no layer of its own: the
 * host's bowSound plays the same ArrowShoot a tick earlier (and a Thunderlock's loose is its own shot), so a second one
 * only doubled it. bible/05-Combat/Weapon-Techniques.md THE FEEL's table says each in words.
 */
const f = Object.freeze;
export const TECH_FX = f({
  volley: f({
    release: f({ cam: f({ pitch: 0.9, fov: -2 }), hands: f({ y: 0.03 }) }),
    loose: f({ burst: 'flare' }),
    shaft: f({ burst: 'shaft' }),
    close: f({ burst: 'close', shake: 0.5 }),
  }),
  pierce: f({
    release: f({ cam: f({ fov: -1.5 }) }),
    loose: f({ cam: f({ pitch: 1.4, fov: -3.5 }), hands: f({ y: 0.05 }), shake: 0.8, burst: 'tracer' }),
  }),
  leap: f({
    release: f({ cam: f({ fov: 7, pitch: -1 }), sound: f(['SwingLowPitch', 0.9, 0.8]) }),
    hit: f({ cam: f({ pitch: -3, eye: -0.12, fov: -4 }), hands: f({ y: 0.08 }), shake: 2.6, burst: 'land', r: 2.5, sound: f(['FallHard', 0.9, 0.85]) }),
  }),
  kick: f({
    release: f({ cam: f({ fov: 6, pitch: -0.8 }), sound: f(['SwingLowPitch', 0.8, 0.95]) }),
    hit: f({ cam: f({ pitch: -2.2, eye: -0.09 }), hands: f({ y: 0.06 }), shake: 1.8, burst: 'land', r: 2, sound: f(['FallHard', 0.75, 1.05]) }),
  }),
  whirlwind: f({
    release: f({ cam: f({ roll: -3 }), sound: f(['SwingMediumPitch', 1, 0.75]) }),
    hit: f({ cam: f({ roll: 2 }), hands: f({ y: 0.04 }), shake: 0.9, burst: 'sweep', r: 3 }),
  }),
  slam: f({
    release: f({ cam: f({ pitch: 2 }), sound: f(['SwingLowPitch', 1, 0.7]) }),
    hit: f({ cam: f({ pitch: -3.5, eye: -0.14, fov: -3 }), hands: f({ y: 0.11 }), shake: 3.2, burst: 'shock', r: 3.5, sound: f(['FallHard', 1, 0.7]) }),
  }),
  crush: f({
    release: f({ cam: f({ pitch: 1.2 }), sound: f(['SwingLowPitch', 0.9, 0.85]) }),
    hit: f({ cam: f({ pitch: -2.2 }), hands: f({ y: 0.07 }), shake: 1.6, burst: 'star' }),
  }),
  haymaker: f({
    release: f({ cam: f({ fov: -3, roll: -2 }), sound: f(['SwingLowPitch', 0.9, 0.95]) }),
    hit: f({ cam: f({ pitch: -1.2, fov: 2, roll: 1.5 }), hands: f({ y: 0.05 }), shake: 1.4, burst: 'punch' }),
  }),
  cleave: f({
    release: f({ cam: f({ roll: -2.5 }), sound: f(['SwingMediumPitch', 1, 0.8]) }),
    hit: f({ cam: f({ roll: 2.5, pitch: -0.8 }), hands: f({ y: 0.05 }), shake: 1.1, burst: 'arc', r: 3.2 }),
  }),
  execute: f({
    release: f({ cam: f({ pitch: 1.6 }), sound: f(['SwingLowPitch', 1, 0.75]) }),
    hit: f({ cam: f({ pitch: -2.8, eye: -0.06 }), hands: f({ y: 0.09 }), shake: 2, burst: 'chop' }),
  }),
  shadowstep: f({
    release: f({ cam: f({ fov: 8, roll: -2 }), burst: 'vanish', sound: f(['SwingHighPitch', 0.8, 1.25]) }),
    hit: f({ cam: f({ fov: -3, roll: 2 }), hands: f({ y: 0.05 }), shake: 1, burst: 'star' }),
  }),
  lunge: f({
    release: f({ cam: f({ fov: 7, pitch: -0.6 }), sound: f(['SwingMediumPitch', 0.9, 1.1]) }),
    hit: f({ cam: f({ pitch: -1.4, fov: -3 }), hands: f({ y: 0.06 }), shake: 1.2, burst: 'trail' }),
  }),
});

/** How much a technique moves the screen: the player's own "Technique camera motion" (0..1, systems/uiPrefs.js
 *  techniqueMotion - Full, 75%, Half, Low, Off) - the springs, the shake and the hands alike. */
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
 * (`{ at, ground, yaw, dir, to, len, r, spin, half }`; null: no burst). Answers whether the technique has the moment.
 * AUDIT TECH-FX: the roll is kicked NEGATED - the table speaks the screen, and every host's lens mirrors the camera's x
 * (world/mat4.js mirrorProjectionX, HANDEDNESS), so the camera's own roll, positive, leans the view LEFT on screen
 * (test/techfx1_audit.test.js projects it through the hosts' own lens).
 */
export function techniqueCue(id, moment, door = null, place = null) {
  const row = TECH_FX[id]?.[moment];
  if (!row) return false;
  const m = techniqueMotion();
  if (m > 0) {
    const c = row.cam;
    if (c) { kick(FX_CH.pitch, (c.pitch ?? 0) * DEG * m); kick(FX_CH.roll, -(c.roll ?? 0) * DEG * m); kick(FX_CH.eye, (c.eye ?? 0) * m); kick(FX_CH.fov, (c.fov ?? 0) * m); }
    if (row.hands?.y > 0) kick(FX_CH.hands, row.hands.y * m);   // a dip only (FX_CH)
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
  HANDS.y = _sv[FX_CH.hands * 2];
}

/** The camera's channel now (`pitch`, `roll` radians in the camera's own frame, `eye` metres, `fov` degrees) - filled in
 *  place, never a copy. */
export const techniqueView = () => VIEW;
/** The hands' dip now, in screen heights (`y`, down - never up or across: FX_CH) - filled in place. */
export const techniqueHands = () => HANDS;
/** Whether a spring is still moving. */
export const techniqueFxLive = () => _live;

/** Everything at rest (a load, a teleport, a test). */
export function resetTechniqueFx() {
  _sv.fill(0);
  _live = false;
  VIEW.pitch = 0; VIEW.roll = 0; VIEW.eye[1] = 0; VIEW.fov = 0;
  HANDS.y = 0;
}
