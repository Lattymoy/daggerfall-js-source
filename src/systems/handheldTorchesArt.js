// OWN-WORK4 (2026-10-31; bible/06-Systems/Handheld-Torches.md): THE TORCHES' PICTURES, OUR OWN. The hand holding a lit
// torch (112359 record 0, 90 x 205) and a lantern (record 1, 110 x 138), the torch on the floor (112358 record 0,
// 31 x 34) and doused (record 10): recipes for our painter (art/ownPainter.js) at the sizes, records and four frames
// the game reads; and the two candles doused, by our rule over the player's own. No pixel of the release is read.
import { createPainter, RAMP, ellipse, poly, stroke, rect, union } from '../art/ownPainter.js';

/** The flame's sway and reach by frame: four frames, as the hand's loop and the floor's flat play them. */
export const FLAME_FRAMES = Object.freeze([
  Object.freeze({ lean: 0, reach: 0, tongue: -1 }),
  Object.freeze({ lean: 0.18, reach: -0.08, tongue: 1 }),
  Object.freeze({ lean: -0.06, reach: 0.06, tongue: 0 }),
  Object.freeze({ lean: -0.2, reach: -0.04, tongue: 1 }),
]);

/** A flame rising from (x, y), `h` tall and `w` wide at its root, in frame `f`'s sway: three layers, dark to bright. */
function flame(p, x, y, h, w, f) {
  const k = FLAME_FRAMES[f % FLAME_FRAMES.length];
  const H = h * (1 + k.reach);
  const tip = [x + k.lean * h, y - H];
  const mid = [x + k.lean * h * 0.35, y - H * 0.5];
  p.fill(stroke([[x, y - w * 0.2], mid, tip], w, 0.4), RAMP.flame.slice(1, 4), { gain: 0.5 });
  const side = k.tongue * w * 0.55;
  p.fill(stroke([[x + side, y - w * 0.5], [x + side * 1.6 + k.lean * h * 0.4, y - H * 0.55]], w * 0.38, 0.3), RAMP.flame.slice(2, 4), { gain: 0.4 });
  p.fill(stroke([[x, y - w * 0.1], [mid[0], y - H * 0.42], [x + k.lean * h * 0.7, y - H * 0.78]], w * 0.68, 0.3), RAMP.flame.slice(3, 6), { gain: 0.5 });
  p.fill(stroke([[x, y - w * 0.05], [x + k.lean * h * 0.2, y - H * 0.38]], w * 0.36, 0.25), RAMP.flame.slice(5, 7), { gain: 0.4 });
}

/** The hand holding a lit torch, frame `f`: the left hand from the screen's foot, the torch upright, the flame on top. */
function torchHand(f) {
  const p = createPainter(90, 205);
  p.fill(stroke([[22, 214], [36, 176], [46, 146]], 19, 14), RAMP.brown, { seed: 11, rough: 0.2 });
  p.fill(stroke([[44, 156], [47, 144]], 15), RAMP.brown, { bias: -0.12 });
  p.fill(stroke([[42, 160], [46, 150]], 15.5), RAMP.leather, { bias: -0.2, clip: rect(0, 150, 90, 158) });
  p.fill(stroke([[48, 162], [54, 112], [58, 66]], 4.2, 4.8), RAMP.wood, { seed: 12, rough: 0.25 });
  p.fill(stroke([[57, 76], [59, 56]], 8.2, 7.6), RAMP.black, { seed: 13, rough: 0.5 });
  for (const yy of [60, 66, 72]) p.fill(stroke([[51, yy + 2], [66, yy - 1]], 1.3), RAMP.leather, { bias: -0.05 });
  p.fill(ellipse(50, 131, 15, 14, -0.2), RAMP.skin, { gain: 1.1 });
  for (let i = 0; i < 4; i++) p.fill(stroke([[52, 120 + i * 7], [62, 119 + i * 7]], 3.6), RAMP.skin, { bias: 0.05 - i * 0.04 });
  p.fill(stroke([[40, 124], [50, 114], [58, 113]], 3.6, 3), RAMP.skin, { bias: 0.12 });
  p.outline();
  flame(p, 59, 58, 52, 12.5, f);
  return p.picture();
}

/** The hand holding a lantern by its ring, frame `f`: the lantern hangs to the hand's right, its candle burning. */
function lanternHand(f) {
  const p = createPainter(110, 138);
  p.fill(stroke([[4, 152], [30, 80], [58, 30]], 18, 12), RAMP.brown, { seed: 21, rough: 0.2 });
  p.fill(stroke([[54, 44], [59, 33]], 13), RAMP.brown, { bias: -0.12 });
  p.fill(stroke([[60, 44], [64, 30], [74, 26], [84, 30], [88, 44]], 1.4), RAMP.iron, { bias: 0.1 });
  p.fill(poly([[52, 52], [96, 52], [88, 44], [60, 44]]), RAMP.iron, { gain: 1.2 });
  p.fill(ellipse(74, 44, 8, 5), RAMP.iron, { bias: 0.05 });
  const glass = rect(56, 54, 93, 110);
  p.fill(glass, ({ t, px, py }) => RAMP.flame[Math.min(6, 3 + Math.floor(t * 2 + ((px + py + f) % 3) / 3 + (f % 2) * 0.4))], { gain: 0.6 });
  flame(p, 74, 98, 22, 5.5, f);
  p.fill(rect(72, 98, 77, 108), RAMP.egg, { bias: 0.1 });
  for (const x of [56, 68, 81, 92]) p.fill(rect(x, 53, x + 2, 111), RAMP.iron, { bias: x < 74 ? 0.05 : -0.1 });
  p.fill(poly([[50, 110], [98, 110], [94, 120], [54, 120]]), RAMP.iron, { gain: 1.2 });
  p.fill(rect(54, 53, 95, 56), RAMP.iron, { bias: -0.05 });
  p.fill(ellipse(70, 24, 12, 11, -0.4), RAMP.skin, { gain: 1.1 });
  for (let i = 0; i < 3; i++) p.fill(stroke([[71, 18 + i * 6], [81, 17 + i * 6]], 3.2), RAMP.skin, { bias: 0.05 - i * 0.05 });
  p.fill(stroke([[56, 40], [60, 30]], 12.5), RAMP.brown, { bias: -0.2, under: false, clip: rect(40, 36, 66, 46) });
  p.outline();
  return p.picture();
}

/** The torch lying on the floor: handle low left, head high right; `lit` frame `f` burning, or doused. */
function droppedTorch(f, lit = true) {
  const p = createPainter(31, 34);
  p.fill(stroke([[3, 32], [19, 22]], 1.6, 1.8), RAMP.wood, { seed: 31, rough: 0.2 });
  p.fill(stroke([[17, 23.5], [23, 20]], 2.8), lit ? RAMP.black : RAMP.grey.slice(0, 3), { seed: 32, rough: 0.6 });
  p.outline({ keep: 0.4 });
  if (lit) flame(p, 22, 20, 18, 4, f);
  else {
    p.fill(stroke([[22, 17], [20, 12], [23, 8], [21, 3]], 0.9, 0.5), RAMP.grey.slice(3, 6), { gain: 0.4 });
    p.set(22, 21, RAMP.ember[3]);
  }
  return p.picture();
}

/** A candle doused, by our rule, from the player's own lit candle (top-down RGBA in, a new one out): every drawn pixel
 *  above the wax's first solid row that is not wax goes clear - the flame - and a charred wick stands in its place,
 *  a wisp of smoke over it. Wax is a grey pixel (its channels within 40 of each other). Pure. */
export function dousedCandle(pic) {
  const { width: w, height: h } = pic;
  const data = pic.data.slice();
  const drawn = (x, y) => data[(y * w + x) * 4 + 3] !== 0;
  const wax = (x, y) => {
    const o = (y * w + x) * 4;
    return drawn(x, y) && Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]) < 40;
  };
  let top = h;
  for (let y = 0; y < h && top === h; y++) {
    const row = [...Array(w).keys()].filter((x) => drawn(x, y));
    if (row.length >= 3 && row.every((x) => wax(x, y))) top = y;
  }
  let sum = 0, n = 0;
  for (let y = 0; y < top; y++)
    for (let x = 0; x < w; x++)
      if (drawn(x, y) && !wax(x, y)) { data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4); sum += x; n++; }
  const out = { width: w, height: h, data };
  const p = { set: (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) data.set([...c, 255], (y * w + x) * 4); } };
  const cx = n ? Math.round(sum / n) : Math.floor(w / 2);
  p.set(cx, top - 1, RAMP.black[1]);
  p.set(cx, top - 2, RAMP.black[2]);
  p.set(cx, top, RAMP.grey[2]);
  for (const [dx, dy, c] of [[0, -4, 3], [1, -5, 4], [1, -6, 3], [0, -8, 4]]) p.set(cx + dx, top + dy, RAMP.grey[c]);
  return out;
}
/** The two candles doused: our rule over the player's own lit candle, TEXTURE.210 record 3 or 4 in PAL.PAL. */
export const TORCH_OVER = Object.freeze({
  '112358_11-0': Object.freeze({ from: Object.freeze([210, 3, 0]), pal: 'PAL.PAL' }),
  '112358_12-0': Object.freeze({ from: Object.freeze([210, 4, 0]), pal: 'PAL.PAL' }),
});

/** Each picture's recipe, by name (`archive_record-frame`, an emission twin `_Emission` after it). */
export const TORCH_ART = Object.freeze({
  ...Object.fromEntries([0, 1, 2, 3].map((f) => [`112359_0-${f}`, () => torchHand(f)])),
  ...Object.fromEntries([0, 1, 2, 3].map((f) => [`112359_1-${f}`, () => lanternHand(f)])),
  ...Object.fromEntries([0, 1, 2, 3].map((f) => [`112358_0-${f}`, () => droppedTorch(f)])),
  ...Object.fromEntries([0, 1, 2, 3].map((f) => [`112358_0-${f}_Emission`, () => droppedTorch(f)])),
  '112358_10-0': () => droppedTorch(0, false),
});
/** Our picture `name`, top-down RGBA - or null where it is none of ours. */
export const ownTorchPicture = (name) => (Object.hasOwn(TORCH_ART, name) ? TORCH_ART[name]() : null);
