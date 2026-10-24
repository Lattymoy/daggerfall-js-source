// THE DWARVEN PISTOLET'S STRIP - its laws, and nothing else (PISTOLET, 2026-10-21).
//
// combat/gun/pistoletArt.js loads the strip for the game and src/tools/pistolLab.js cuts it for the lab, and both read
// these. A leaf, because the loader reaches the texture pipeline and the weapon tables, and the lab's standalone build
// (vite.config.pistol.js) has no use for either - combat/weapon/weaponAlign.js's reason, for the Thunderlock's lab. Its
// one import is another leaf's (combat/gun/gunSheet.js - the boxes; PISTOL-EDGE: the frame set below measures with them).

import { contentBox, unionBox } from './gunSheet.js';   // PISTOL-EDGE: the boxes, a leaf's

/** The strip: six frames, each its own registered canvas, in the order the owner gave them. */
export const PISTOL_STRIP = Object.freeze({ frames: 6, cellW: 88, cellH: 113, file: 'pistol-frames.png' });

/** Cell `i` of the strip, an integer source rect (a half pixel resamples). */
export function stripCellRect(i, strip = PISTOL_STRIP) {
  return { x: i * strip.cellW, y: 0, w: strip.cellW, h: strip.cellH };
}

/** THE 1-BIT CUT: alpha to 0 or 255 at `cut` (128 is drawScreenQuad's 0.5). Mutates `img.data`; answers how many soft
 *  texels it cleared. */
export function hardenAlpha(img, cut = 128) {
  const { data } = img;
  let cleared = 0;
  for (let p = 3; p < data.length; p += 4) {
    if (data[p] >= cut) data[p] = 255;
    else { if (data[p]) cleared++; data[p] = 0; }
  }
  return cleared;
}

/**
 * PISTOL-EDGE (2026-10-24, the owner: "the pistolet doesnt match the test prototype 1:1 like you said it does. It still
 * clips where you can see where the sprite isnt filled it"; bible/05-Combat/Dwarven-Pistolet.md "PISTOL-EDGE"): THE ARM
 * GOES ON PAST ITS CANVAS. The owner's frames cut the forearm at their canvas's bottom and right edges - the sleeve leaves
 * every frame through that corner - and the frame (combat/gun/gunViewmodel.js gunFrameRect) seats the gun with that corner
 * on the screen's. Weapon Widget's Bob and Inertia then carry it (the owner's tuning, PISTOLET_FEEL.widget): measured on
 * the game's own rig at 1280x800, a strafe slid the cut side 203 px into the screen and a shot's kick lifted the cut
 * bottom 7 px off it - the sleeve ending in a straight line in mid-air, on the page and in the game alike (they run one
 * frame). The mod says of its Inertia that it "requires double-scaled weapon textures": art that reaches past the screen.
 * So the art reaches past it. Each frame's forearm is carried on past the two cut edges along the arm's own lean
 * (`armLean`), PISTOL_BLEED texels to the right and below - every texel there takes the colour of the edge texel the arm
 * passes through, so the sleeve, its shading and its outline continue as an arm going off the corner. The motion is the
 * owner's, unmoved; the anchor (the rest frame's own box) is unmoved, so the gun stands where it stood; only the union
 * grows past the corner, and at rest everything it gained is off the screen.
 */
export const PISTOL_BLEED = Object.freeze({ right: 96, bottom: 64 });
/** How many of a frame's bottom rows the arm's lean is read from. */
export const ARM_LEAN_ROWS = 28;

/**
 * THE ARM'S LEAN, off a frame: the forearm's left edge in its bottom ARM_LEAN_ROWS rows - each row's leftmost opaque
 * texel, a least-squares line through them - as a unit direction `[dx, dy]` pointing out of the frame (right and down).
 * The rest frame's is the strip's (the arm moves little across the six; one lean keeps the continuation still). Null for
 * a frame with no arm on its bottom rows.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} img
 * @returns {[number, number] | null}
 */
export function armLean(img, rows = ARM_LEAN_ROWS) {
  const { width: w, height: h, data } = img;
  const pts = [];
  for (let y = Math.max(0, h - rows); y < h; y++) {
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 128) { pts.push([x, y]); break; }
  }
  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (y - my) * (y - my); }
  if (!(den > 0)) return null;
  const b = Math.max(0, num / den);   // texels right per row down - never back across the cut
  const len = Math.hypot(b, 1);
  return [b / len, 1 / len];
}

/** The widest notch in a cut edge that is still the arm (EDGE_GAP texels): the rest frame's right edge has one of two
 *  between the bracer's rim and the sleeve, which carried along the lean drew a stripe of the world through the arm. */
export const EDGE_GAP = 4;

/**
 * ONE CUT EDGE'S TEXELS (PISTOL-EDGE): `len` texels along it (`at(i)` the data offset of the i-th), each the offset of the
 * texel the bleed copies there - its own where it is opaque, -1 where the edge is empty, and across a notch of at most
 * EDGE_GAP transparent texels with opaque on both sides, the nearer side's (the arm is one piece where it leaves the
 * canvas; a notch the 1-bit cut left in its rim is not a gap in the arm).
 */
function cutEdge(data, len, at) {
  const src = Array.from({ length: len }, (_, i) => (data[at(i) + 3] >= 128 ? at(i) : -1));
  for (let i = 0; i < len;) {
    if (src[i] >= 0) { i++; continue; }
    let j = i;
    while (j < len && src[j] < 0) j++;
    if (i > 0 && j < len && j - i <= EDGE_GAP) for (let k = i; k < j; k++) src[k] = k - (i - 1) <= j - k ? src[i - 1] : src[j];
    i = j;
  }
  return src;
}

/**
 * A FRAME BLED PAST ITS CUT (PISTOL-EDGE): a new image PISTOL_BLEED larger to the right and below, the frame at its
 * origin, and every new texel the colour of the frame's edge texel reached by walking back along `lean` (armLean) to the
 * last column (right of the cut) or the last row (below it) - transparent where that edge is empty (cutEdge: a notch of
 * the rim's is the arm). Pure; the frame is not touched.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} img
 * @param {[number, number] | null} lean
 */
export function bleedArm(img, lean, bleed = PISTOL_BLEED) {
  const { width: w, height: h, data } = img;
  const W = w + bleed.right, H = h + bleed.bottom;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < h; y++) for (let i = 0; i < w * 4; i++) out[y * W * 4 + i] = data[y * w * 4 + i];
  if (!lean) return { width: W, height: H, data: out };
  const [dx, dy] = lean;
  const right = cutEdge(data, h, (y) => (y * w + w - 1) * 4), bottom = cutEdge(data, w, (x) => ((h - 1) * w + x) * 4);
  for (let y = 0; y < H; y++) {
    for (let x = y < h ? w : 0; x < W; x++) {
      const tx = x >= w ? (dx > 1e-6 ? (x - (w - 1)) / dx : Infinity) : 0, ty = y >= h ? (y - (h - 1)) / dy : 0;
      const t = Math.max(tx, ty);
      if (!Number.isFinite(t)) continue;
      const qx = Math.round(x - t * dx), qy = Math.round(y - t * dy);
      if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
      const o = tx >= ty ? right[qy] : bottom[qx];   // the edge the walk back crossed last
      if (o < 0) continue;
      const d = (y * W + x) * 4;
      out[d] = data[o]; out[d + 1] = data[o + 1]; out[d + 2] = data[o + 2]; out[d + 3] = data[o + 3];
    }
  }
  return { width: W, height: H, data: out };
}

/** Cell `i` of a decoded strip (`{ width, height, data }`), copied out and hardened at `cut` (hardenAlpha):
 *  `{ width, height, data, soft }` - `soft` the texels the cut cleared. */
export function cutCell(strip, i, cut = 128) {
  const r = stripCellRect(i);
  const data = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const src = ((y + r.y) * strip.width + r.x) * 4;
    for (let k = 0; k < r.w * 4; k++) data[y * r.w * 4 + k] = strip.data[src + k];
  }
  const img = { width: r.w, height: r.h, data };
  const soft = hardenAlpha(img, cut);
  return { ...img, soft };
}
/** An image cropped to `box`. Pure. */
export function cropImage(img, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const src = ((y + box.y) * img.width + box.x) * 4;
    for (let k = 0; k < box.w * 4; k++) out[y * box.w * 4 + k] = img.data[src + k];
  }
  return { width: box.w, height: box.h, data: out };
}

/**
 * PISTOL-EDGE: THE FRAME SET BOTH ENDS DRAW - the lab's page (pistol-proto.html, through src/tools/pistolLab.js) and the
 * game's loader (combat/gun/pistoletArt.js bledFrames) call this one function, FIELD-GUN12's one composition: the six
 * cells cut at `cut` (`cells`, as the owner drew them, and their own boxes), the arm's lean off the rest frame
 * (armLean), every cell bled past its cut along it (`bled`, bleedArm), and the union of what they now hold. `anchor` is
 * the REST frame's own box - the gun seated where the owner drew it, the bleed hanging past the screen's corner. Null
 * for a strip with nothing in its rest frame.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} strip
 */
export function pistolFrameSet(strip, cut = 128) {
  const cells = Array.from({ length: PISTOL_STRIP.frames }, (_, i) => cutCell(strip, i, cut));
  const boxes = cells.map((c) => contentBox(c));
  const anchor = boxes[0];
  if (!anchor) return null;
  const lean = armLean(cells[0]);
  const bled = cells.map((c) => bleedArm(c, lean));
  const union = unionBox(bled.map((b) => contentBox(b)));
  return { cells, boxes, anchor, lean, bled, union, soft: cells.reduce((n, c) => n + c.soft, 0) };
}
