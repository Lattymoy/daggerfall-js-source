// THE GUN LAB (Mac, 2026-09-19): a NEW WEAPON TYPE prototyped before a
// line of the game changes - the same door grass-proto and the water
// lab came through.
//
// NOTHING HERE TOUCHES THE GAME. This page is not an arm of
// combat/fpsWeapon.js, it is not reachable from `play/`, and no module
// under src/ outside this file imports it. The port is a 1:1 DFU
// translation and a gun is not in Daggerfall; the place to find out
// what one FEELS like on the classic surface is a lab, not the
// weapon rig.
//
// What it DOES borrow, deliberately and by value, is the classic
// placement law, so that what you tune here transfers if the type is
// ever built for real:
//
//   - the 320x200 DESIGN SURFACE. FPSWeapon draws every weapon image
//     over a 320x200 rect stretched to the screen, bottom-anchored,
//     aligned Left/Center/Right with a fractional Offset
//     (FPSWeapon.cs:378-388, ported at combat/fpsWeapon.js
//     drawFpsWeapon). `placeSprite` below is that arithmetic, with
//     ONE departure: a width fraction, because these frames are not
//     CIF records sized in native pixels.
//
//   - the 1-BIT CUTOUT. drawScreenQuad discards texels under 0.5
//     alpha - the port's law for every screen quad - so the
//     background key here is hard-edged on purpose. A soft mask would
//     look right in this page and wrong in the game.
//
//   - the HANDEDNESS MIRROR. FLIP_STATES (FPSWeapon.cs:378, :459)
//     mirrors only the hand-symmetric states and swaps AlignRight for
//     AlignLeft. A gun's idle and fire are both centre-ish, so the
//     lab mirrors the whole cycle behind one switch.
//
// The ART is ours (Mac's), and it arrives as two files rather than a
// CIF: `public/art/gun-idle.png` (one pose) and
// `public/art/gun-fire-sheet.webp` (a 3x2 contact sheet, the six fire
// frames, numbered). The sheet is sliced AT RUNTIME instead of being
// pre-cut into six PNGs, which is what makes the background key a
// LIVE CONTROL - the threshold that makes a muzzle flash survive and
// a white page die is the thing you want a slider on.

/** The contact sheet's layout. `badgeGutter` is the fraction of each
 *  cell's width that carries the frame NUMBER - a grey disc the key
 *  cannot remove (it is neutral, not white) and the trim would
 *  otherwise weld to the frame's box. Cropped before anything reads a
 *  pixel. */
export const SHEET_GRID = Object.freeze({ cols: 3, rows: 2, badgeGutter: 0.12 });

/** The fire cycle's length - the sheet's own frame count. */
export const FIRE_FRAMES = SHEET_GRID.cols * SHEET_GRID.rows;

/**
 * Cell `i` of the sheet, reading rows first (1,2,3 / 4,5,6 - the
 * numbering on the art), with the badge gutter already gone.
 * Integer rects: a half-pixel source rect resamples, and this page
 * has to be able to claim its pixels are the file's.
 */
export function cellRect(i, sheetW, sheetH, grid = SHEET_GRID) {
  const cw = Math.floor(sheetW / grid.cols);
  const ch = Math.floor(sheetH / grid.rows);
  const gut = Math.round(cw * grid.badgeGutter);
  const col = i % grid.cols;
  const row = Math.floor(i / grid.cols);
  return { x: col * cw + gut, y: row * ch, w: cw - gut, h: ch };
}

/**
 * THE BACKGROUND KEY. A flood fill from the border, not a threshold
 * sweep, and the difference is the muzzle flash: its core is very
 * bright, and a plain "every near-white pixel dies" rule punches a
 * hole straight through it. Two guards keep the art:
 *
 *   - CONNECTIVITY. Only background reachable from the frame's edge
 *     is cleared, so an enclosed highlight inside the receiver is
 *     safe whatever its value.
 *   - NEUTRALITY. The page white is grey-neutral; the flash core is
 *     warm (max-min channel spread well over `chroma`). A warm pixel
 *     is never background, even touching the edge.
 *
 * Alpha goes to 0 or stays as it was - 1-bit, per the port's quad
 * law. Mutates `img.data` and answers how many texels it cleared.
 */
export function keyBackground(img, threshold = 244, chroma = 10) {
  const { width: w, height: h, data } = img;
  const isBg = (p) => {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (data[p + 3] === 0) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min >= threshold && max - min <= chroma;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  let cleared = 0;
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    if (!isBg(p)) continue;
    if (data[p + 3] !== 0) { data[p + 3] = 0; cleared++; }
    const x = i % w, y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return cleared;
}

/** The box of everything still opaque, or null for an empty frame. */
export function contentBox(img) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * THE ONE BOX ALL SIX FRAMES SHARE, and the reason the lab looks like
 * a gun rather than a gun having a seizure.
 *
 * Every frame trimmed to its OWN content and then bottom-anchored is
 * the obvious build and it is wrong: the flash and smoke grow up and
 * to the left across the cycle, so each frame's box is a different
 * size and the WEAPON slides a dozen pixels a frame under it. The
 * cells are registered to each other by construction - the gun is
 * painted in the same place in all six - so one union box, applied to
 * all six, keeps that registration and gives the flash its room.
 */
export function unionBox(boxes) {
  const live = boxes.filter(Boolean);
  if (!live.length) return null;
  const x0 = Math.min(...live.map((b) => b.x));
  const y0 = Math.min(...live.map((b) => b.y));
  const x1 = Math.max(...live.map((b) => b.x + b.w));
  const y1 = Math.max(...live.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ONE HOME: the alignment enum is FPSWeapon's, imported rather than
// restated, so an offset tuned in the lab means in the lab exactly
// what it means in the game. The arrow points ONE WAY - the lab reads
// the port's law and the port does not know the lab exists
// (test/gunLab.test.js fails if that ever stops being true).
export { ALIGN } from '../combat/fpsWeapon.js';
import { ALIGN } from '../combat/fpsWeapon.js';

/**
 * FPSWeapon's OnGUI rect (:378-388), with the width taken as a
 * fraction of the screen instead of from a CIF record's native size -
 * the declared departure. Everything else is the classic law: bottom
 * anchored, aligned by the table's Alignment/Offset, and AlignRight
 * becoming AlignLeft under the handedness mirror (:459-464).
 *
 * `kick` is the lab's own: the recoil offset in NATIVE (320x200)
 * units, scaled with the surface so it reads the same at any window
 * size.
 */
export function placeSprite({
  canvasW, canvasH, frameW, frameH,
  widthPct = 0.62, align = ALIGN.Center, offset = 0,
  flip = false, kick = { x: 0, y: 0 }, offsetHeight = 0,
}) {
  const w = canvasW * widthPct;
  const h = w * (frameH / frameW);
  const a = (flip && align === ALIGN.Right) ? ALIGN.Left : align;
  let x;
  if (a === ALIGN.Left) x = canvasW * offset;
  else if (a === ALIGN.Center) x = canvasW / 2 - w / 2;
  else x = canvasW * (1 - offset) - w;
  const y = canvasH - h - offsetHeight;
  const sx = canvasW / 320, sy = canvasH / 200;
  return { x: x + kick.x * sx * (flip ? -1 : 1), y: y + kick.y * sy, w, h };
}

/**
 * THE CYCLE. A gun is not a sword: WeaponManager's six directional
 * strikes and the drag-to-swing gesture have nothing to say here, so
 * the lab runs the smallest machine that can be judged -
 *
 *   Idle -> Firing (frames 0..5 at `fps`) -> Cooling (`cooldownMs`,
 *   the pump) -> Idle
 *
 * - and keeps the two things the classic machine DOES have that
 * matter: a hit frame the damage would land on (FPSWeapon.GetHitFrame,
 * 2 for melee) and a one-shot that cannot be interrupted
 * (FPSWeapon.OnAttackDirection's rule). `auto` holds the trigger.
 */
export function createGunMachine({ fps = 14, cooldownMs = 260, hitFrame = 1 } = {}) {
  const m = {
    state: 'Idle', frame: 0, fps, cooldownMs, hitFrame,
    trigger: false, shots: 0,
    _t: 0, _cool: 0, _hitThisShot: false,
  };
  m.fire = () => {
    if (m.state !== 'Idle') return false;   // the one-shot cannot be replaced
    m.state = 'Firing'; m.frame = 0; m._t = 0; m._hitThisShot = false; m.shots++;
    return true;
  };
  /** Answers the event this step produced: 'hit' on the hit frame,
   *  'ready' when the pump finishes, null otherwise. */
  m.step = (dt) => {
    let event = null;
    if (m.state === 'Firing') {
      m._t += dt;
      const adv = Math.floor(m._t * m.fps);
      m.frame = Math.min(adv, FIRE_FRAMES - 1);
      if (!m._hitThisShot && m.frame >= m.hitFrame) { m._hitThisShot = true; event = 'hit'; }
      if (adv >= FIRE_FRAMES) { m.state = 'Cooling'; m._cool = 0; m.frame = 0; }
    } else if (m.state === 'Cooling') {
      m._cool += dt * 1000;
      if (m._cool >= m.cooldownMs) { m.state = 'Idle'; event = 'ready'; }
    } else if (m.trigger) {
      m.fire();
    }
    return event;
  };
  return m;
}

/**
 * The muzzle light. The flash is on frames 1-2 of the sheet
 * (0-indexed), so the room it lights brightens on those and falls
 * away over the smoke - a lamp, not a step. Answers 0..1.
 */
export function muzzleLight(state, frame) {
  if (state !== 'Firing') return 0;
  const curve = [0, 1, 0.82, 0.3, 0.12, 0.04];
  return curve[frame] ?? 0;
}

/**
 * The recoil, in native units: a hard kick on the shot, settling back
 * exponentially. `amount` is the peak rise in 320x200 pixels.
 */
export function recoilOffset(state, frame, amount = 10) {
  if (state !== 'Firing' || amount === 0) return { x: 0, y: 0 };
  const fall = Math.exp(-frame * 0.62);
  return { x: -amount * 0.28 * fall, y: amount * fall };
}

/** The walk bob - the lab's own, so the pose can be judged moving. */
export function bobOffset(t, amount, moving) {
  if (!moving || !amount) return { x: 0, y: 0 };
  return { x: Math.sin(t * 5.2) * amount, y: Math.abs(Math.sin(t * 10.4)) * amount * 0.6 };
}

/**
 * THE ANCHOR, and the second half of the alignment story unionBox
 * starts.
 *
 * One box for all six frames holds the gun still RELATIVE TO ITSELF,
 * but that box is dominated by the flash and smoke, which live up and
 * to the left of the barrel. Lay the screen rect out from the union
 * box and Center puts the SMOKE in the middle of the screen and the
 * weapon off to the right.
 *
 * So the layout is computed from the ANCHOR box - the frame with no
 * flash in it, which is the gun and nothing else - and this turns
 * that rect into the rect the full (union-sized) image is drawn at.
 * The gun lands where you aligned it and the flash overflows around
 * it, which is what it does in the art.
 */
export function unionDrawRect(anchorRect, anchor, union) {
  const scale = anchorRect.w / anchor.w;
  return {
    x: anchorRect.x - (anchor.x - union.x) * scale,
    y: anchorRect.y - (anchor.y - union.y) * scale,
    w: union.w * scale,
    h: union.h * scale,
  };
}
