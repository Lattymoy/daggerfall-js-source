// THE SHEET: a weapon whose frames arrive as one image, not as a CIF.
//
// Every classic first-person weapon is a WEAPON*.CIF - records of
// indexed frames, with the archive's own sizes and offsets - and the
// reader for those is formats/cifRciFile.js. The Dwarven Thunderlock
// is not classic and has no CIF: its art is one contact sheet of six
// fire frames, so the frames have to be FOUND rather than read.
//
// This is the finding. It was written for the gun lab
// (src/tools/gunLab.js, which prototyped the weapon before it existed)
// and moved here when the weapon became real, so there is one copy of
// it and the lab reads the GAME's law rather than the other way round
// - the same one-way arrow that fpsWeapon's ALIGN and Weapon Widget's
// movement modules already point along.

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
