// @ts-check
// CARDS3b (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 19; Mac: "Do 3 4 and 5"; section 3's DECIDED "the
// player's own hand is held up in the seat view, fanned, and can be peeked ... a drag slides chips into the pot"): THE
// HAND IN THE SEAT'S VIEW AND THE CHIPS UNDER THE MOUSE - pure, DOM-free.
//
// THE HELD HAND. Once the player's two cards have landed and turned on the cloth, they are drawn held before the eye
// (`heldMatrices` - a matrix in the world for each, the camera's own frame composed: invert4(view)), low in the view and
// fanned, leaning back the shy way a player holds them; PEEKED (`peek` 0..1 - the cursor over them, or held on them)
// they come up toward the eye and spread. The picture only: what the cards are is the law's.
//
// THE CHIPS. Seated, the cursor is the player's (the panel holds it); a press on his own stack picks up a bet - the
// panel's choice (its raise slider, else the call) - carried on the cloth under the cursor (`tablePoint`: the cursor's
// ray met with the table top) and let go into the betting ground (`inBetZone`: nearer the middle than his stack) is
// the bet; let go anywhere else, it goes back.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { invert4 } from '../player/tapRay.js';
import { multiply, trs } from './mat4.js';
import { CARD_W } from './cardMotion.js';

/** MEASURE (CARDS3b): where the hand is held in the view (metres along the view's X, up, forward - forward is its -Z;
 *  the world is drawn through a mirror, so the view's +X shows on the screen's LEFT), the
 *  fan between the cards (degrees), the lean back while held and when peeked, the spread when peeked. */
export const HELD_AT = Object.freeze([-0.03, -0.115, -0.27]);   // a little right of the middle, on the screen
export const HELD_FAN_DEG = 9;
export const HELD_LEAN_DEG = 58;
export const PEEK_LEAN_DEG = 14;
export const HELD_GAP = CARD_W * 0.42;
export const PEEK_GAP = CARD_W * 0.62;
export const PEEK_RISE = 0.035;
/** MEASURE (CARDS3b): how fast a peek eases in and out (per second), and how high a carried bet rides over the cloth. */
export const PEEK_RATE = 10;
export const DRAG_LIFT = 0.015;

/** A card's plate (face +Y, its top +Z) turned to face the eye in the view's frame: face toward +Z, top toward +Y (trs
 *  turns Rz, then Rx, then Ry: -90 about X stands the face toward -Z with the top up, 180 about Y turns it to the eye). */
export const FACE_THE_EYE = trs(0, 0, 0, -90, 180, 0);

/**
 * The world matrices of a held hand of `n` cards (the cloth's order), `view` the frame's view matrix, `peek` 0..1.
 * @param {ArrayLike<number>} view @param {number} n @param {number} [peek]
 */
export function heldMatrices(view, n, peek = 0) {
  const p = Math.max(0, Math.min(1, peek));
  const camera = invert4(view);
  const lean = HELD_LEAN_DEG + (PEEK_LEAN_DEG - HELD_LEAN_DEG) * p;
  const gap = HELD_GAP + (PEEK_GAP - HELD_GAP) * p;
  return Array.from({ length: n }, (_, i) => {
    const k = i - (n - 1) / 2;
    // the screen's right-hand card in front (the view's -X is the screen's right), the fan opening upward
    const local = trs(HELD_AT[0] + k * gap, HELD_AT[1] + PEEK_RISE * p, HELD_AT[2] - k * 0.002, -lean, 0, -k * HELD_FAN_DEG);
    return multiply(camera, multiply(local, FACE_THE_EYE));
  });
}

/**
 * Where the cursor's ray (from `eye` along `dir`, the frame's own - player/tapRay.js rayDirFromScreen) meets the table
 * top at height `top`: the point, or null (a ray that never comes down to it, or meets it behind the eye).
 * @param {number[]} eye @param {number[]|null} dir @param {number} top
 */
export function tablePoint(eye, dir, top) {
  if (!dir || !(dir[1] < -1e-6)) return null;
  const s = (top - eye[1]) / dir[1];
  if (!(s > 0)) return null;
  return [eye[0] + dir[0] * s, top, eye[2] + dir[2] * s];
}

/** MEASURE (CARDS3b): how near the press must land to the stack's middle to pick it up. */
export const STACK_GRAB_M = 0.07;
/** True when `p` (on the cloth) is on the player's stack at `place` (tablePlaces' seat). */
export const onStack = (p, place) => !!p && Math.hypot(p[0] - place.stack[0], p[2] - place.stack[2]) <= STACK_GRAB_M;

/**
 * True when `p` is in the player's betting ground: nearer the table's middle than his stack, by his seat's own facing
 * (the cloth in front of his cards and beyond).
 * @param {number[]|null} p @param {{stack: number[], holes: number[][], yaw: number}} place
 */
export function inBetZone(p, place) {
  if (!p) return false;
  const f = [Math.sin(place.yaw), Math.cos(place.yaw)];
  const depth = (q) => q[0] * f[0] + q[2] * f[1];
  return depth(p) > depth(place.holes[0]) + 0.02;
}

/**
 * The bet a drag carries - the panel's choice: a raise to the slider's value when a raise is allowed (clamped to the
 * law's range), else the call, else nothing (a check needs no chips). `{id, value, amount}` (`amount` the chips that
 * move), or null.
 * @param {any} legal @param {number|null} sliderValue @param {number} myBet - what the player has in front of him already
 */
export function dragBet(legal, sliderValue, myBet = 0) {
  if (!legal) return null;
  if (legal.raise) {
    const to = Math.min(legal.raise.max, Math.max(legal.raise.min, Math.floor(Number(sliderValue) || legal.raise.min)));
    return { id: 'raise', value: to, amount: to - myBet };
  }
  if (legal.call > 0) return { id: 'call', value: legal.call, amount: legal.call };
  return null;
}
