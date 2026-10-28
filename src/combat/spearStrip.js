// THE SPEAR'S STRIP - the owner's five frames and their laws, and nothing else (SPEAR-LAB, 2026-10-27).
//
// A leaf, for pistolStrip.js's reason: the lab's standalone build (vite.config.spear.js) reads it and has no use for the
// texture pipeline or the weapon tables. Design and record: bible/05-Combat/Spear-Lab.md.

import { cutCell, bleedArm, armLean, EDGE_GAP, ARM_LEAN_ROWS } from './gun/pistolStrip.js';   // PISTOL-EDGE's walk-back, for the rear arm
import { contentBox, unionBox } from './gun/gunSheet.js';

/** The strip: the owner's five 187x189 canvases side by side, pixels unchanged, in the order they were given. */
export const SPEAR_STRIP = Object.freeze({ frames: 5, cellW: 187, cellH: 189, file: 'spear/spear-frames.png' });

/** What each of the five is. They are one thrust as the owner drew it: at rest, drawn back to the body, driven, reaching
 *  and fully out - the spear moves along its own line and away, so it shrinks. */
export const SPEAR_POSE = Object.freeze({ rest: 0, chamber: 1, drive: 2, extend: 3, full: 4 });

/**
 * THE ARMS GO ON PAST THE CANVAS (PISTOL-EDGE's law, for two arms). The canvases cut the arms at their bottom and right
 * edges (the chamber's sleeve at its left too), and a sweep turns the whole picture, which would lift a cut edge into
 * the screen. So each arm is carried on past every cut edge along its own lean, this many texels. Measured on every
 * strike frame: 80 already keeps every cut 24 texels off the screen (spearlab.test.js, THE CUT NEVER SHOWS).
 */
export const SPEAR_BLEED = Object.freeze({ side: 96, bottom: 96 });
/** How many rows (or columns) in from a cut edge an arm's lean is read from. */
export const ARM_LEAN_SPAN = 20;
/** The steepest lean an arm is carried along, texels sideways a texel out. */
export const LEAN_MAX = 2.5;

const opaque = (data, o) => data[o + 3] >= 128;

/** The runs of opaque texels along one cut edge, `[first, last]`, a notch of at most EDGE_GAP closed (pistolStrip's
 *  cutEdge: a notch the 1-bit cut left in a rim is not a gap in the arm). */
export function edgeRuns(isOn, len) {
  const runs = [];
  for (let i = 0; i < len;) {
    if (!isOn(i)) { i++; continue; }
    let j = i;
    while (j + 1 < len && isOn(j + 1)) j++;
    const last = runs[runs.length - 1];
    if (last && i - last[1] - 1 <= EDGE_GAP) last[1] = j;
    else runs.push([i, j]);
    i = j + 1;
  }
  return runs;
}

/**
 * AN ARM'S LEAN where it leaves a cut edge: walking `span` lines in from the edge, the run's two sides on each line (the
 * segment that overlaps the line before), and the slope of the sides that are free - a side on the canvas's own border
 * is a cut, not the arm's outline. Answers texels along the edge per texel out (clamped to LEAN_MAX); 0 with no free
 * side. `at(line, i)` says whether texel `i` of the line `line` in from the edge is opaque; `len` is a line's length.
 */
export function runLean(run, at, len, span = ARM_LEAN_SPAN) {
  let [s, e] = run;
  const lo = [], hi = [];
  for (let line = 0; line < span; line++) {
    let a = -1;
    for (let i = s; i <= e; i++) if (at(line, i)) { a = i; break; }
    if (a < 0) break;
    while (a > 0 && at(line, a - 1)) a--;
    let b = a;
    while (b + 1 < len && at(line, b + 1)) b++;
    if (line > 0 && Math.abs((b - a) - (e - s)) > 6) break;   // a merge with the hand above, not the arm
    if (a > 0) lo.push([line, a]);
    if (b < len - 1) hi.push([line, b]);
    s = a; e = b;
  }
  const slope = (pts) => {
    if (pts.length < 3) return null;
    const ml = pts.reduce((t, p) => t + p[0], 0) / pts.length, mv = pts.reduce((t, p) => t + p[1], 0) / pts.length;
    let num = 0, den = 0;
    for (const [l, v] of pts) { num += (l - ml) * (v - mv); den += (l - ml) ** 2; }
    return den > 0 ? -num / den : null;   // per line IN from the edge, negated: per texel OUT
  };
  const k = [slope(lo), slope(hi)].filter((v) => v != null);
  if (!k.length) return 0;
  const mean = k.reduce((t, v) => t + v, 0) / k.length;
  return Math.max(-LEAN_MAX, Math.min(LEAN_MAX, mean));
}

/** How far in from the right edge a bottom run may end and still be the REAR arm (the right hand on the butt): every
 *  frame's rear cuff or butt ends within it, every front sleeve or cuff short of it. */
export const REAR_REACH = 40;

/**
 * A FRAME CARRIED PAST ITS CUT: a picture `bleed.side` wider each side and `bleed.bottom` taller, the frame at `origin`.
 * Two arms leave the canvas, so two laws. THE REAR ARM (the right edge, and bottom runs ending within REAR_REACH of it)
 * takes PISTOL-EDGE's walk-back (pistolStrip.js bleedArm) along its cuff's lean. THE FRONT ARM (every other bottom run)
 * goes straight down its own lean (runLean); the chamber's sleeve, cut by the left edge too, goes on to the left. Every
 * new texel copies an edge texel, so a sleeve and its outline go on as an arm. Pure; the frame is not touched.
 */
export function bleedArms(img, bleed = SPEAR_BLEED) {
  const { width: w, height: h, data } = img;
  const L = bleed.side, W = w + 2 * bleed.side, H = h + bleed.bottom;
  const out = new Uint8ClampedArray(W * H * 4);
  const runs = edgeRuns((x) => opaque(data, ((h - 1) * w + x) * 4), w);
  const front = runs.filter((r) => r[1] < w - 1 - REAR_REACH);
  const rearFrom = Math.min(w, ...runs.filter((r) => !front.includes(r)).map((r) => r[0]));
  // the rear arm: the front runs kept out of the bottom row, and out of the rows its lean is read from
  const rear = new Uint8ClampedArray(data);
  for (const [s, e] of front) for (let x = s; x <= e; x++) rear[((h - 1) * w + x) * 4 + 3] = 0;
  const cuff = new Uint8ClampedArray(data.length);
  for (let y = Math.max(0, h - ARM_LEAN_ROWS); y < h; y++) for (let x = rearFrom; x < w; x++) cuff[(y * w + x) * 4 + 3] = data[(y * w + x) * 4 + 3];
  const lean = rearFrom < w ? rearLean(armLean({ width: w, height: h, data: cuff })) : null;
  const back = bleedArm({ width: w, height: h, data: rear }, lean, { right: bleed.side, bottom: bleed.bottom });
  for (let y = 0; y < back.height; y++) out.set(back.data.subarray(y * back.width * 4, (y + 1) * back.width * 4), (y * W + L) * 4);
  for (let y = 0; y < h; y++) out.set(data.subarray(y * w * 4, (y + 1) * w * 4), (y * W + L) * 4);   // the owner's pixels, whole
  const put = (x, y, o) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const d = (y * W + x) * 4; out[d] = data[o]; out[d + 1] = data[o + 1]; out[d + 2] = data[o + 2]; out[d + 3] = 255; };
  let cornerLean = 0;
  for (const run of front) {
    const k = runLean(run, (line, x) => opaque(data, ((h - 1 - line) * w + x) * 4), w);
    if (run[0] === 0) cornerLean = k;
    for (let t = 1; t <= bleed.bottom; t++) {
      const dx = Math.round(t * k);
      for (let x = run[0]; x <= run[1]; x++) if (opaque(data, ((h - 1) * w + x) * 4)) put(L + x + dx, h - 1 + t, ((h - 1) * w + x) * 4);
    }
  }
  // the chamber's sleeve is cut by the left edge as well: those texels go the way its bottom run goes, one band
  const side = edgeRuns((y) => opaque(data, y * w * 4), h).find((r) => r[1] === h - 1);   // the point at the top is no arm
  if (side && cornerLean < -0.1) {
    for (let t = 1; t <= bleed.side; t++) {
      const dy = Math.round(t / -cornerLean);
      for (let y = side[0]; y <= side[1]; y++) if (opaque(data, y * w * 4)) put(L - t, y + dy, y * w * 4);
    }
  }
  return { width: W, height: H, data: out, origin: [L, 0] };
}

/** The rear forearm's least lean, down and to the right: the elbow is off the screen's corner, below and right of the
 *  fist. A cuff whose outline reads steeper (or a sliver of glove that reads none) is carried along this. */
export const REAR_LEAN = Object.freeze([0.6, 0.8]);
/** The rear arm's lean: the cuff's own (armLean), never steeper than REAR_LEAN. */
export const rearLean = (read) => (read && read[0] / read[1] >= REAR_LEAN[0] / REAR_LEAN[1] ? read : REAR_LEAN);

/** The spear's point in a frame: the opaque texel furthest up and to the left, along the owner's diagonal (every frame
 *  holds the shaft at 135 to 136 degrees). Null for an empty frame. */
export function spearTip(img) {
  const { width: w, height: h, data } = img;
  let best = null, score = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(data, (y * w + x) * 4)) continue;
      if (x + y < score) { score = x + y; best = [x, y]; }
    }
  }
  return best;
}

/**
 * THE FRAME SET THE LAB DRAWS (and the game's loader will): the five cells cut at `cut`, their own boxes, each one's
 * point, and each carried past its cut (bleedArms). `anchor` is the REST frame's own box - the spear seated where the
 * owner drew it. Null for a strip with nothing in its rest frame.
 */
export function spearFrameSet(strip, cut = 128) {
  const cells = Array.from({ length: SPEAR_STRIP.frames }, (_, i) => cutCell(strip, i, cut, SPEAR_STRIP));
  const boxes = cells.map((c) => contentBox(c));
  const anchor = boxes[SPEAR_POSE.rest];
  if (!anchor) return null;
  return {
    cells, boxes, anchor, union: unionBox(boxes), tips: cells.map(spearTip),
    bled: cells.map((c) => bleedArms(c)), soft: cells.reduce((n, c) => n + c.soft, 0),
  };
}
