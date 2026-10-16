// @ts-check
// HORSE-REINS (2026-10-16, from Discord - Redclaw, reskinning the horse: "are there reins that chunk out like this
// towards the back? I haven't seen any designed like this before"; the owner: "You can fix this"): THE REIN MENDED.
//
// Horse Cart and Cargo's horse (vendor/horse-cart-and-cargo/Textures, demifiend000's 45 pictures) is a small render of
// a saddled horse grazing, and its rein came out of the render as a thick dark loop slung under the throat - from the
// bit back along the jaw, down under the neck and into the chest, with the sky showing through it in steps. A rein is
// one thin strap from the bit to the rider's hands, resting on the neck in front of the pommel when no one holds it.
// So each picture is mended as it is decoded, before the dye (systems/horseCoats.js recolorHorse) and the upload:
//  - THE LOOP CLEARED: under the throat line the mend names (`throat`, a polyline in the picture's own pixels, rows
//    top first), each column's run of the loop - every pixel below the line down to the open air under it - is let go,
//    and the gaps the loop held against the throat are closed with the throat's own shade (`closeGaps`);
//  - THE REIN DRAWN: one pixel wide from the bit (`bit`) to the pommel's front (`to`, or read off the saddle: the
//    front of its largest patch of tack leather - `pommelOf`), sagging `sag` pixels at its middle, in the bridle's own
//    leather (REIN_LEATHER; REIN_LEATHER_LIT where it crosses the dark throat), which the dye's tack rule leaves as it
//    is on every coat;
//  - and from the front (`drop`) the loop's strands hanging under the chest are let go.
// The vendored files stay the assembly's byte for byte (test/hcc_assets.test.js): the mend is the upload's, as the dye
// is. Not a DFU member, and not the mod's: Ledger A (HORSE-REINS).

/** The bridle's leather as the art paints it (its darkest step) - inside the dye's tack rule (hue 31, saturation
 *  0.38, value 0.26), so a dyed coat keeps its rein brown. */
export const REIN_LEATHER = Object.freeze([66, 54, 41]);
/** The bridle's lit step, where the rein crosses a pixel darker than REIN_LEATHER_UNDER (the throat's shadow) - the
 *  dark leather would vanish into it. Hue 33, saturation 0.47, value 0.38: the tack rule's too. */
export const REIN_LEATHER_LIT = Object.freeze([96, 76, 51]);
/** The value (0..1) under which the rein crosses a pixel in REIN_LEATHER_LIT. */
export const REIN_LEATHER_UNDER = 0.22;

/**
 * Each picture's mend, by the mod's file name. `throat` the new underside of the jaw and neck (left to right, the
 * columns strictly between its ends mended); `bit` where the rein leaves the mouth; `to` where it meets the withers
 * (absent: read off the saddle, `pommelOf`); `sag` its droop at the middle (pixels); `drop` [x0, y0, x1, y1] boxes let
 * go (the front view's strands hanging between the forelegs). A picture not named here is drawn as the mod drew it.
 * @type {Readonly<Record<string, { throat?: number[][], bit?: number[], to?: number[], sag?: number, drop?: number[][] }>>}
 */
export const REIN_MENDS = Object.freeze({
  // the front (horse1, Walk.0-*): the strands hanging between the forelegs
  'horse1.png': { drop: [[57, 59, 57, 60], [58, 58, 60, 60]] },
  'Walk.0-1.png': { drop: [[55, 58, 61, 60]] },
  'Walk.0-2.png': { drop: [[55, 60, 61, 61]] },
  'Walk.0-3.png': { drop: [[56, 61, 56, 61]] },
  'Walk.0-4.png': { drop: [[58, 59, 59, 61], [56, 61, 56, 61]] },
  'Walk.0-5.png': { drop: [[53, 60, 61, 61]] },
  'Walk.0-6.png': { drop: [[54, 60, 61, 64]] },
  'Walk.0-7.png': { drop: [[55, 61, 62, 63]] },
  'Walk.0-8.png': { drop: [[54, 59, 62, 61]] },
  // three quarters from the front (horse2, Walk.1-*): the bit where the picture's own steel ring is, where it has one
  'horse2.png': { throat: [[28, 43], [29, 39], [31, 38], [33, 37], [36, 40]], bit: [26, 42], sag: 1 },
  'Walk.1-1.png': { throat: [[31, 44], [32, 40], [34, 39], [36, 38], [39, 41]], bit: [29, 43], sag: 1 },
  'Walk.1-2.png': { throat: [[25, 43], [28, 39], [31, 38], [33, 38], [37, 39], [39, 41]], bit: [25, 40], sag: 1 },
  'Walk.1-3.png': { throat: [[21, 40], [24, 38], [28, 38], [33, 37], [38, 39]], bit: [23, 37], sag: 1 },
  'Walk.1-4.png': { throat: [[26, 43], [28, 39], [31, 38], [34, 37], [37, 39], [40, 41]], bit: [25, 40], sag: 1 },
  'Walk.1-5.png': { throat: [[29, 44], [31, 41], [35, 39], [39, 41]], bit: [28, 43], sag: 1 },
  'Walk.1-6.png': { throat: [[29, 42], [31, 38], [34, 37], [37, 39], [40, 41]], bit: [28, 39], sag: 1 },
  'Walk.1-7.png': { throat: [[24, 40], [26, 39], [28, 37], [33, 37], [37, 38], [40, 40]], bit: [26, 36], sag: 1 },
  'Walk.1-8.png': { throat: [[30, 42], [31, 38], [33, 37], [37, 37], [40, 40]], bit: [28, 39], sag: 1 },
  // the side (horse3, Walk.2-*) - Redclaw's picture; Walk.2-1's head is horse3's three rows down
  'horse3.png': { throat: [[16, 43], [19, 40], [23, 37], [29, 37], [35, 39]], bit: [13, 41], sag: 1 },
  'Walk.2-1.png': { throat: [[16, 46], [19, 43], [23, 40], [29, 40], [35, 42]], bit: [13, 44], sag: 1 },
  'Walk.2-2.png': { throat: [[13, 45], [17, 42], [22, 41], [27, 39], [35, 43]], bit: [10, 40], sag: 1 },
  'Walk.2-3.png': { throat: [[10, 42], [13, 41], [19, 40], [24, 39], [29, 39], [33, 42]], bit: [9, 39], sag: 1 },
  'Walk.2-4.png': { throat: [[13, 45], [17, 43], [22, 41], [27, 40], [31, 41], [34, 43]], bit: [10, 41], sag: 1 },
  'Walk.2-5.png': { throat: [[15, 46], [18, 43], [22, 40], [27, 40], [31, 42], [35, 44]], bit: [12, 44], sag: 1 },
  'Walk.2-6.png': { throat: [[12, 44], [16, 42], [21, 41], [25, 39], [29, 40], [33, 43]], bit: [10, 41], sag: 1 },
  'Walk.2-7.png': { throat: [[10, 40], [14, 39], [19, 38], [25, 38], [30, 40], [33, 43]], bit: [8, 36], sag: 1 },
  'Walk.2-8.png': { throat: [[12, 44], [16, 42], [21, 40], [26, 39], [30, 41], [33, 43]], bit: [10, 41], sag: 1 },
  // three quarters from behind (horse4, Walk.3-*): the loop a bridge from the jaw to the chest
  'horse4.png': { throat: [[31, 39], [33, 39], [36, 40]], bit: [31, 42], sag: 1 },
  'Walk.3-1.png': { throat: [[31, 44], [33, 44], [36, 45]], bit: [31, 47], sag: 1 },
  'Walk.3-2.png': { throat: [[32, 44], [33, 43], [36, 44]], bit: [31, 45], sag: 1 },
  'Walk.3-3.png': { bit: [30, 43], sag: 1 },
  'Walk.3-4.png': { throat: [[32, 43], [36, 43]], bit: [31, 45], sag: 1 },
  'Walk.3-5.png': { throat: [[31, 44], [36, 44]], bit: [31, 47], sag: 1 },
  'Walk.3-6.png': { throat: [[26, 45], [30, 44], [36, 44]], bit: [28, 45], sag: 1 },
  'Walk.3-7.png': { throat: [[22, 43], [27, 42], [33, 42], [36, 43]], bit: [24, 44], sag: 1 },
  'Walk.3-8.png': { throat: [[27, 44], [30, 43], [36, 43]], bit: [28, 44], sag: 1 },
});

/** How far either side of the head's middle a billboard horse's bit ring stands (metres) - half the muzzle the front
 *  view draws (horse1.png: some 6 pixels at the global scale), a finger outside it. */
export const REIN_RING = 0.08;
/** The side view of a pose - the standing one (`frame` null) or walk frame `frame` (0-based, HorseWalkAnimationSet's) -
 *  the picture its bit is read off: the side shows the bit where it is, the others where it turns to. */
export const sideViewOf = (frame) => (frame == null ? 'horse3.png' : `Walk.2-${frame + 1}.png`);
/**
 * Where the rein meets a billboard horse in a pose: its bit ring on the horse's own frame (metres - wagonModels.js
 * TEAM's: x its right, y up, z the way it faces), read off the side view's mended bit (its head to the picture's left):
 * forward of the picture's middle column, up from its foot, and REIN_RING out on `side`. Null for a pose with no bit.
 * @param {number | null} frame the walk frame, null standing
 * @param {number} side +1 its right, -1 its left
 * @param {{ width: number, height: number, scale: number }} picture the side view's size (pixels) and its metres a pixel
 */
export function billboardBit(frame, side, { width, height, scale }) {
  const bit = REIN_MENDS[sideViewOf(frame)]?.bit;
  if (!bit) return null;
  return [(side < 0 ? -1 : 1) * REIN_RING, (height - bit[1] - 0.5) * scale, (width / 2 - bit[0] - 0.5) * scale];
}

/** How deep a loop runs under the throat line, and how far above it a gap it held is closed (pixels) - past it, a
 *  column is the chest's or a leg's, never the loop's. */
export const REIN_LOOP_DEPTH = 8;

/** HSV value (0..1) of an RGB triple. */
const valueOf = (r, g, b) => Math.max(r, g, b) / 255;
/** The dye's tack rule (systems/horseCoats.js isCoatPixel, the leather it spares), restated on raw bytes - kept in
 *  step by test/horsereins.test.js against the dye's own. */
function isLeather(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!max || !d) return false;
  const s = d / max, v = max / 255;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h >= 28 && h <= 48 && s >= 0.36 && s < 0.58 && v >= 0.24 && v < 0.5;
}

/**
 * The transparent pixels the open air reaches - 4-connected to the picture's edge through transparent pixels.
 * @param {Uint8Array} data @param {number} w @param {number} h
 */
export function openAir(data, w, h) {
  const air = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => { const i = y * w + x; if (!air[i] && !data[i * 4 + 3]) { air[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop()), x = i % w, y = (i - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  return air;
}

/** The polyline's row at column `x` (rounded), or NaN outside it. @param {number[][]} line @param {number} x */
export function lineRow(line, x) {
  for (let k = 1; k < line.length; k++) {
    const [x0, y0] = line[k - 1], [x1, y1] = line[k];
    if (x >= x0 && x <= x1) return Math.round(x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return NaN;
}

/**
 * The saddle's front: the leftmost column (or rightmost, `facing` +1) of the picture's largest 8-connected patch of
 * tack leather, at that column's top pixel - where a rein laid on the neck meets the pommel. Null with no leather.
 * @param {Uint8Array} data @param {number} w @param {number} h @param {number} [facing] -1 the head to the left
 */
export function pommelOf(data, w, h, facing = -1) {
  const seen = new Uint8Array(w * h);
  let best = /** @type {number[]} */ ([]);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (seen[i] || !data[o + 3] || !isLeather(data[o], data[o + 1], data[o + 2])) continue;
    const patch = [], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = /** @type {number} */ (stack.pop()); patch.push(j);
      const x = j % w, y = (j - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx, q = k * 4;
        if (!seen[k] && data[q + 3] && isLeather(data[q], data[q + 1], data[q + 2])) { seen[k] = 1; stack.push(k); }
      }
    }
    if (patch.length > best.length) best = patch;
  }
  if (!best.length) return null;
  let px = -1, py = -1;
  for (const j of best) {
    const x = j % w, y = (j - x) / w;
    if (px < 0 || (facing < 0 ? x < px : x > px) || (x === px && y < py)) { px = x; py = y; }
  }
  return [px, py];
}

/**
 * The rein's pixels, bit to withers: the sagging line sampled finely, each pixel once, and every L-corner taken out
 * (a pixel whose neighbours either side already touch) - one pixel wide on the diagonal, as a pixel artist draws it.
 * @param {number[]} a @param {number[]} b @param {number} sag
 */
export function reinPixels(a, b, sag = 0) {
  const n = Math.max(2, 4 * Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  /** @type {number[][]} */
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t + 4 * sag * t * (1 - t));
    const last = out[out.length - 1];
    if (!last || last[0] !== x || last[1] !== y) out.push([x, y]);
  }
  for (let k = 1; k < out.length - 1;) {
    const p = out[k - 1], q = out[k + 1];
    if (Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1) out.splice(k, 1); else k++;
  }
  return out;
}

/**
 * The rein a mend draws, bit to `to` (its pommel's front): reinPixels' sagging line, and - under the throat - laid along
 * the throat's new underside (a pixel under `throat`, no lower), so no sliver of sky shows between the strap and the
 * jaw, the loop's own fault; where the throat lifts it, the strap is joined again pixel to pixel and thinned.
 * @param {{ throat?: number[][], bit: number[], sag?: number }} m @param {number[]} to
 */
export function reinPath(m, to) {
  const line = reinPixels(m.bit, to, m.sag ?? 0);
  if (!m.throat) return line;
  const x0 = m.throat[0][0], x1 = m.throat[m.throat.length - 1][0];
  const hugged = line.map(([x, y]) => (x > x0 && x < x1 ? [x, Math.min(y, lineRow(m.throat, x) + 1)] : [x, y]));
  /** @type {number[][]} */
  const out = [hugged[0]];
  for (let k = 1; k < hugged.length; k++) {
    const [px, py] = out[out.length - 1], [x, y] = hugged[k];
    const n = Math.max(Math.abs(x - px), Math.abs(y - py));
    for (let i = 1; i <= n; i++) out.push([Math.round(px + ((x - px) * i) / n), Math.round(py + ((y - py) * i) / n)]);
  }
  const seen = new Set();
  const once = out.filter(([x, y]) => (seen.has(`${x},${y}`) ? false : (seen.add(`${x},${y}`), true)));
  // thinned - but never of a pixel lying on the throat (taking it would open the sliver this lays it to close)
  const onThroat = (/** @type {number[]} */ p) => p[0] > x0 && p[0] < x1 && p[1] === lineRow(m.throat ?? [], p[0]) + 1;
  for (let k = 1; k < once.length - 1;) {
    const p = once[k - 1], q = once[k + 1];
    if (!onThroat(once[k]) && Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1) once.splice(k, 1); else k++;
  }
  return once;
}

/**
 * The mend: `image` (top row first, RGBA bytes - a PNG as decoded) with its rein mended by REIN_MENDS[file] - a NEW
 * image, the old untouched; the image itself where the file has no mend.
 * @param {string} file the mod's name for the picture (`horse3.png`, `Walk.2-5.png`)
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @param {Readonly<Record<string, any>>} [mends]
 */
export function mendHorseReins(file, image, mends = REIN_MENDS) {
  const m = mends[file];
  if (!m) return image;
  const { width: w, height: h } = image;
  const data = new Uint8Array(image.data);
  const at = (x, y) => (y * w + x) * 4;
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const clear = (x, y) => data.fill(0, at(x, y), at(x, y) + 4);   // as a decode hands back the open air: no colour
  if (m.throat) {
    const air = openAir(image.data, w, h);
    const x0 = m.throat[0][0], x1 = m.throat[m.throat.length - 1][0];
    /** @type {number[]} */
    const gaps = [];
    for (let x = x0 + 1; x < x1; x++) {
      const edge = lineRow(m.throat, x);
      // the loop: everything under the line down to the open air under it
      for (let y = edge + 1; y < h && y <= edge + REIN_LOOP_DEPTH && !air[y * w + x]; y++) clear(x, y);
      // the gaps the loop held: the transparent pixels above the line the air never reached
      for (let y = edge; y >= 0 && y > edge - REIN_LOOP_DEPTH; y--) {
        if (air[y * w + x]) break;
        if (!data[at(x, y) + 3]) gaps.push(x, y);
      }
    }
    closeGaps(data, w, h, gaps);
  }
  for (const [xa, ya, xb, yb] of m.drop ?? []) for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (inside(x, y)) clear(x, y);
  if (m.bit) {
    const to = m.to ?? withersOf(image.data, w, h, m.bit);
    if (to) {
      for (const [x, y] of reinPath(m, to)) {
        if (!inside(x, y)) continue;
        const o = at(x, y);
        const lit = data[o + 3] && valueOf(data[o], data[o + 1], data[o + 2]) < REIN_LEATHER_UNDER;
        const c = lit ? REIN_LEATHER_LIT : REIN_LEATHER;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data };
}

/** Where a rein laid on the neck from `bit` ends: a pixel in front of the pommel and under its top (`pommelOf`, the
 *  head's side read off which side of the saddle the bit is). */
function withersOf(data, w, h, bit) {
  const facing = bit[0] < w / 2 ? -1 : 1;
  const p = pommelOf(data, w, h, facing);
  return p ? [p[0] + facing, p[1] + 1] : null;
}

/**
 * The gaps closed: each takes the mean of its opaque neighbours (8-connected), the gaps nearest the throat first, until
 * none is left - so a closed gap is the shade around it. @param {Uint8Array} data @param {number} w @param {number} h
 * @param {number[]} gaps x, y pairs
 */
function closeGaps(data, w, h, gaps) {
  let open = [];
  for (let k = 0; k < gaps.length; k += 2) open.push([gaps[k], gaps[k + 1]]);
  while (open.length) {
    /** @type {number[][]} */
    const next = [];
    /** @type {Array<[number, number, number[]]>} */
    const fills = [];
    for (const [x, y] of open) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const o = (ny * w + nx) * 4;
        if (data[o + 3]) { r += data[o]; g += data[o + 1]; b += data[o + 2]; n++; }
      }
      if (n) fills.push([x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n)]]); else next.push([x, y]);
    }
    if (!fills.length) break;
    for (const [x, y, c] of fills) { const o = (y * w + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; }
    open = next;
  }
}
