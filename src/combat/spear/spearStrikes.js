// THE SPEAR'S STRIKES - the left sweep, the right sweep and the thrust, frame by frame (SPEAR-LAB, 2026-10-27).
//
// The owner: "This needs to have left, right and thrust attacks. This needs to be as detailed as possible." The owner's
// five frames are one thrust (spearStrip.js SPEAR_POSE). Every strike here is drawn from those five and nothing else:
// each frame is one of them, turned, scaled and moved on the screen by RotSprite (formats/rotSprite.js), which puts no
// colour in a frame that is not the owner's. A leaf with the strip's: the lab's build reads it. Design and record:
// bible/05-Combat/Spear-Lab.md.

import { SPEAR_POSE, SPEAR_STRIP } from './spearStrip.js';
import { rotSpriteUp, drawTurned, turnedPoint } from '../../formats/rotSprite.js';

/** Where the five sit at rest, on DFU's 320x200 surface: their canvas's bottom-right corner on the screen's (FPSWeapon's
 *  AlignRight, Offset 0, one art texel a texel of the surface - they are drawn at Daggerfall's own scale). */
export const SPEAR_REST_AT = Object.freeze([320 - SPEAR_STRIP.cellW, 200 - SPEAR_STRIP.cellH]);
/** The crosshair, on the same surface. */
export const SPEAR_AIM = Object.freeze([160, 100]);

/**
 * THE STAGE every strike frame is drawn on: the 320x200 surface with room around it (`x`, `y` the surface's corner in the
 * stage), so a frame and the idle share one registration - the draw seats the stage once and the frames move inside it,
 * as the Pistolet's union box does. The margins are what Weapon Widget's Bob and Inertia can carry past the screen.
 */
export const SPEAR_STAGE = Object.freeze({ w: 320 + 64 + 96, h: 200 + 48 + 96, x: 64, y: 48 });

/**
 * THE STRIKES. A frame is `pose` (one of the owner's five), `turn` (degrees counter-clockwise about the strike's `pivot`
 * on the 320x200 surface), `scale` (about the pivot) and `shift` (surface texels); `smear` marks the fastest frames. `hit`
 * is the frame the blow lands on. Every strike ends near the rest pose, so the idle after it does not jump.
 *   - LEFT: drawn back and up to the right, swept across the aim, carried on low to the left, then home.
 *   - RIGHT: gathered low on the left, swept up and across to the right.
 *   - THRUST: the owner's thrust as drawn, turned onto the crosshair, held a beat at full reach, then drawn home.
 */
const F = (pose, turn = 0, shift = [0, 0], { scale = 1, smear = false } = {}) => Object.freeze({ pose, turn, shift: Object.freeze(shift), scale, smear });
const SMEAR = { smear: true };
export const SPEAR_STRIKES = Object.freeze({
  left: Object.freeze({
    pivot: Object.freeze([265, 150]), hit: 5,
    frames: Object.freeze([
      F('chamber', -5, [6, 2]),
      F('chamber', -11, [12, 3]),
      F('chamber', -14, [14, 3]),     // the top of the wind-up
      F('drive', -8, [8, 1]),
      F('rest', 3, [-2, 0], SMEAR),
      F('extend', 14, [-6, 3], SMEAR),   // across the aim: the hit
      F('full', 24, [-24, 3], SMEAR),
      F('full', 30, [-32, 6]),
      F('full', 31, [-34, 7]),        // the end of the sweep
      F('extend', 20, [-18, 4]),      // home: reaching, then at rest - never back through the drawn-in drive
      F('rest', 10, [-8, 2]),
      F('rest', 3, [-2, 0]),
    ]),
  }),
  right: Object.freeze({
    pivot: Object.freeze([265, 150]), hit: 5,
    frames: Object.freeze([
      F('chamber', 8, [-8, 3]),
      F('chamber', 18, [-18, 6]),
      F('chamber', 24, [-24, 8]),
      F('drive', 26, [-24, 9]),       // the bottom of the wind-up
      F('rest', 20, [-14, 10], SMEAR),
      F('extend', 10, [2, 12], SMEAR),    // across the aim: the hit
      F('full', -2, [12, 4], SMEAR),
      F('full', -12, [20, -2]),
      F('full', -16, [24, -4]),       // the end of the sweep
      F('extend', -12, [20, -2]),
      F('rest', -7, [9, 2]),
      F('rest', -2, [2, 0]),
    ]),
  }),
  thrust: Object.freeze({
    pivot: Object.freeze([300, 260]), hit: 5,
    frames: Object.freeze([
      F('chamber', 0, [4, 4]),
      F('chamber', -1, [8, 8]),
      F('chamber', -1, [9, 9]),       // drawn back
      F('drive', 2, [4, 6]),
      F('extend', 5, [2, 10], SMEAR),
      F('full', 8, [0, 14], { scale: 0.97, smear: true }),   // on the aim, fully out: the hit
      F('full', 8, [-1, 16], { scale: 0.96 }),   // and a beat further
      F('extend', 6, [2, 10]),
      F('drive', 3, [4, 5]),
      F('rest', 1, [1, 1]),
      F('rest', 0, [0, 0]),
    ]),
  }),
});

/** The rest pose - what Idle draws. */
export const SPEAR_IDLE = F('rest');

/** Which strike each of the machine's six plays: a sideways drag sweeps that way (its downward diagonal too), and a drag
 *  up or down thrusts. A spear has three blows, not six. */
export const SPEAR_STRIKE_OF = Object.freeze({
  StrikeLeft: 'left', StrikeDownLeft: 'left',
  StrikeRight: 'right', StrikeDownRight: 'right',
  StrikeUp: 'thrust', StrikeDown: 'thrust',
});

/** A frame's pose as drawTurned takes it, on the stage: the bled picture's corner (`set.bled[i].origin` texels left of
 *  the owner's canvas) seated at the rest place, the pivot and the shift moved onto the stage. */
export function stagePose(frame, pivot, bled, stage = SPEAR_STAGE) {
  return {
    deg: frame.turn, scale: frame.scale,
    origin: [stage.x + SPEAR_REST_AT[0] - bled.origin[0], stage.y + SPEAR_REST_AT[1] - bled.origin[1]],
    pivot: [stage.x + pivot[0], stage.y + pivot[1]], shift: frame.shift,
  };
}

/** Where a point of the owner's canvas (pose `pose`, canvas texels) lands on the 320x200 surface under a frame. */
export function surfacePoint(point, frame, pivot, bled, stage = SPEAR_STAGE) {
  const p = turnedPoint([point[0] + bled.origin[0], point[1] + bled.origin[1]], stagePose(frame, pivot, bled, stage));
  return [p[0] - stage.x, p[1] - stage.y];
}

/**
 * EVERY FRAME, DRAWN: the idle and each strike's frames, each a stage-sized picture (`img`), the same frame with its
 * smear (`smeared`, for a frame marked so) and where the spear's point lands on the surface (`tip`). `set` is
 * spearFrameSet's. The costly part is each pose's 8x picture (rotSpriteUp, ~28 MB), so the frames are drawn pose by
 * pose and each 8x picture is let go before the next is made.
 */
export function drawSpearFrames(set, { strikes = SPEAR_STRIKES, stage = SPEAR_STAGE } = {}) {
  const jobs = [{ key: 'idle', k: 0, frame: SPEAR_IDLE, pivot: [0, 0], prev: null }];
  for (const [key, s] of Object.entries(strikes)) s.frames.forEach((frame, k) => jobs.push({ key, k, frame, pivot: s.pivot, prev: s.frames[k - 1] ?? SPEAR_IDLE }));
  const out = { idle: null, ...Object.fromEntries(Object.keys(strikes).map((key) => [key, []])) };
  const blank = () => ({ width: stage.w, height: stage.h, data: new Uint8ClampedArray(stage.w * stage.h * 4) });
  for (let i = 0; i < SPEAR_STRIP.frames; i++) {
    const mine = jobs.filter((j) => SPEAR_POSE[j.frame.pose] === i);
    if (!mine.length) continue;
    const up = rotSpriteUp(set.bled[i]), bled = set.bled[i];
    for (const { key, k, frame, pivot, prev } of mine) {
      const img = drawTurned(blank(), up, stagePose(frame, pivot, bled, stage));
      let smeared = null;
      if (frame.smear) {
        smeared = blank();
        for (let g = 1; g <= SMEAR_GHOSTS; g++) drawTurned(smeared, up, stagePose(between(prev, frame, g / (SMEAR_GHOSTS + 1)), pivot, bled, stage), headOf(set, i));
        drawTurned(smeared, up, stagePose(frame, pivot, bled, stage));
      }
      const drawn = { img, smeared, tip: surfacePoint(set.tips[i], frame, pivot, bled, stage) };
      if (key === 'idle') out.idle = drawn; else out[key][k] = drawn;
    }
  }
  return out;
}

/**
 * THE SMEAR. On a frame marked `smear` - the blow's fastest, where the head travels furthest between two frames - the
 * spearhead is drawn SMEAR_GHOSTS times more on the way from the frame before, every other texel (a checkerboard - one
 * bit of alpha has no half), behind the frame itself. Its own pixels, so still no new colour: a classic sprite's speed
 * lines, from the owner's head.
 */
export const SMEAR_GHOSTS = 2;
/** How far down the shaft from the point the head reaches, along the owner's diagonal (x + y), in canvas texels: the
 *  blade and a hand's width of the shaft. */
export const HEAD_REACH = 70;
const headOf = (set, i) => {
  const [tx, ty] = set.tips[i], [ox, oy] = set.bled[i].origin;
  return (X, Y, qx, qy) => ((X + Y) & 1) === 0 && (qx - ox - tx) + (qy - oy - ty) < HEAD_REACH;
};
/** The pose `t` of the way from `a` to `b`, in turn, shift and scale (the picture is `b`'s). */
const between = (a, b, t) => ({
  turn: a.turn + (b.turn - a.turn) * t, scale: a.scale + (b.scale - a.scale) * t,
  shift: [a.shift[0] + (b.shift[0] - a.shift[0]) * t, a.shift[1] + (b.shift[1] - a.shift[1]) * t],
});
