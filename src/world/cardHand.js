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
import { multiply, trs, quatToMat4 } from './mat4.js';
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

/** AUDIT CARDS-3 C1: the most the hand is lifted clear of the panel (metres, in the view), and the gap kept over it (CSS
 *  pixels). */
export const HELD_LIFT_MAX = 0.08;
export const HELD_PANEL_GAP_PX = 10;

/**
 * The world matrices of a held hand of `n` cards (the cloth's order), `view` the frame's view matrix, `peek` 0..1,
 * `lift` metres up the view (AUDIT CARDS-3 C1: clear of the panel).
 * @param {ArrayLike<number>} view @param {number} n @param {number} [peek] @param {number} [lift]
 */
export function heldMatrices(view, n, peek = 0, lift = 0) {
  const p = Math.max(0, Math.min(1, peek));
  const camera = invert4(view);
  const lean = HELD_LEAN_DEG + (PEEK_LEAN_DEG - HELD_LEAN_DEG) * p;
  const gap = HELD_GAP + (PEEK_GAP - HELD_GAP) * p;
  return Array.from({ length: n }, (_, i) => {
    const k = i - (n - 1) / 2;
    // the screen's right-hand card in front (the view's -X is the screen's right), the fan opening upward
    const local = trs(HELD_AT[0] + k * gap, HELD_AT[1] + PEEK_RISE * p + Math.max(0, Math.min(HELD_LIFT_MAX, lift)), HELD_AT[2] - k * 0.002, -lean, 0, -k * HELD_FAN_DEG);
    return multiply(camera, multiply(local, FACE_THE_EYE));
  });
}

/** AUDIT CARDS-3 C3: how long a card takes to come up off the cloth into the hand, or to leave it (a fold), seconds. */
export const HOLD_S = 0.25;

/** A rigid matrix's rotation as a unit quaternion [x, y, z, w] (mat4.js quatToMat4's inverse). */
function quatOf(m) {
  const tr = m[0] + m[5] + m[10];
  let q;
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; q = [(m[6] - m[9]) / k, (m[8] - m[2]) / k, (m[1] - m[4]) / k, k / 4]; }
  else if (m[0] > m[5] && m[0] > m[10]) { const k = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2; q = [k / 4, (m[4] + m[1]) / k, (m[8] + m[2]) / k, (m[6] - m[9]) / k]; }
  else if (m[5] > m[10]) { const k = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2; q = [(m[4] + m[1]) / k, k / 4, (m[9] + m[6]) / k, (m[8] - m[2]) / k]; }
  else { const k = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2; q = [(m[8] + m[2]) / k, (m[9] + m[6]) / k, k / 4, (m[1] - m[4]) / k]; }
  return q;
}

/**
 * AUDIT CARDS-3 C3: a card's matrix part way (`u` 0..1) from `a` (its pose on the cloth) to `b` (held) - the place
 * along the line, the turn along the shorter way (a normalised blend of the two rotations): a card picked up or let go
 * moves, it never jumps.
 * @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number} u
 */
export function blendMatrix(a, b, u) {
  const k = Math.max(0, Math.min(1, u));
  const qa = quatOf(a), qb = quatOf(b);
  const sign = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0 ? -1 : 1;
  const q = qa.map((v, i) => v + (qb[i] * sign - v) * k);
  const n = Math.hypot(...q) || 1;
  const m = quatToMat4(q.map((v) => v / n));
  for (let i = 0; i < 3; i++) m[12 + i] = a[12 + i] + (b[12 + i] - a[12 + i]) * k;
  return m;
}

/**
 * AUDIT CARDS-3 C1: how far (metres, up the view) a held hand whose lowest point is at screen y `bottomPx` must rise to
 * clear a panel whose top is at `panelTopPx` (both CSS pixels down the canvas, `h` its height), `proj` the frame's
 * projection (its [5] is 1 / tan(fov / 2)) - 0 when it is clear already.
 * @param {number} bottomPx @param {number} panelTopPx @param {number} h @param {ArrayLike<number>} proj
 */
export function heldLift(bottomPx, panelTopPx, h, proj) {
  const over = bottomPx - (panelTopPx - HELD_PANEL_GAP_PX);
  if (!(over > 0) || !(h > 0) || !(proj[5] > 0)) return 0;
  return Math.min(HELD_LIFT_MAX, (over * 2 * -HELD_AT[2]) / (proj[5] * h));
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
 * AUDIT CARDS-3 C6: true when `p` is on the table's top (tableFrame's `{centre, axisYaw, halfLong, halfShort}`), `inset`
 * in from its edge - a ray meeting the top's endless plane past the table is no point on it.
 * @param {number[]|null} p @param {{centre: number[], axisYaw: number, halfLong: number, halfShort: number}|null|undefined} frame @param {number} [inset]
 */
export function onTable(p, frame, inset = 0) {
  if (!p || !frame) return false;
  const dx = p[0] - frame.centre[0], dz = p[2] - frame.centre[2];
  const a = [Math.sin(frame.axisYaw), Math.cos(frame.axisYaw)];
  return Math.abs(dx * a[0] + dz * a[1]) <= frame.halfLong - inset && Math.abs(dx * a[1] - dz * a[0]) <= frame.halfShort - inset;
}

/**
 * True when `p` is in the player's betting ground: on the table (AUDIT CARDS-3 C6, when its frame is given) and nearer
 * its middle than his stack, by his seat's own facing (the cloth in front of his cards and beyond).
 * @param {number[]|null} p @param {{stack: number[], holes: number[][], yaw: number}} place @param {any} [frame]
 */
export function inBetZone(p, place, frame = null) {
  if (!p || (frame && !onTable(p, frame))) return false;
  const f = [Math.sin(place.yaw), Math.cos(place.yaw)];
  const depth = (q) => q[0] * f[0] + q[2] * f[1];
  return depth(p) > depth(place.holes[0]) + 0.02;
}

/**
 * The bet a drag carries - the panel's choice: a raise to the slider's value when the slider was set (clamped to the
 * law's range), else the call; with nothing to call, the least bet; else nothing (a check needs no chips). AUDIT
 * CARDS-3 C7 (section 19, DECIDED: chips pushed in without touching the slider CALL - a drag never raised a player
 * who meant to call). `{id, value, amount}` (`amount` the chips that move), or null.
 * @param {any} legal @param {number|null} sliderValue @param {number} myBet - what the player has in front of him already
 */
export function dragBet(legal, sliderValue, myBet = 0) {
  if (!legal) return null;
  if (legal.raise && (sliderValue != null || !(legal.call > 0))) {
    const to = Math.min(legal.raise.max, Math.max(legal.raise.min, Math.floor(Number(sliderValue) || legal.raise.min)));
    return { id: 'raise', value: to, amount: to - myBet };
  }
  if (legal.call > 0) return { id: 'call', value: legal.call, amount: legal.call };
  return null;
}
