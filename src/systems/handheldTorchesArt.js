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

/** A flame rising from (x, y), `height` tall and `width` wide at its root, in `frame`'s sway: three layers, dark to bright. */
function flame(painter, x, y, height, width, frame) {
  const k = FLAME_FRAMES[frame % FLAME_FRAMES.length];
  const flameHeight = height * (1 + k.reach);
  const tip = [x + k.lean * height, y - flameHeight];
  const mid = [x + k.lean * height * 0.35, y - flameHeight * 0.5];
  painter.fill(stroke([[x, y - width * 0.2], mid, tip], width, 0.4), RAMP.flame.slice(1, 4), { gain: 0.5 });
  const side = k.tongue * width * 0.55;
  painter.fill(stroke([[x + side, y - width * 0.5], [x + side * 1.6 + k.lean * height * 0.4, y - flameHeight * 0.55]], width * 0.38, 0.3), RAMP.flame.slice(2, 4), { gain: 0.4 });
  painter.fill(stroke([[x, y - width * 0.1], [mid[0], y - flameHeight * 0.42], [x + k.lean * height * 0.7, y - flameHeight * 0.78]], width * 0.68, 0.3), RAMP.flame.slice(3, 6), { gain: 0.5 });
  painter.fill(stroke([[x, y - width * 0.05], [x + k.lean * height * 0.2, y - flameHeight * 0.38]], width * 0.36, 0.25), RAMP.flame.slice(5, 7), { gain: 0.4 });
}

/** The hand holding a lit torch, in `frame`: the left hand from the screen's foot, the torch upright, the flame on top. */
function torchHand(frame) {
  const painter = createPainter(90, 205);
  painter.fill(stroke([[22, 214], [36, 176], [46, 146]], 19, 14), RAMP.brown, { seed: 11, rough: 0.2 });
  painter.fill(stroke([[44, 156], [47, 144]], 15), RAMP.brown, { bias: -0.12 });
  painter.fill(stroke([[42, 160], [46, 150]], 15.5), RAMP.leather, { bias: -0.2, clip: rect(0, 150, 90, 158) });
  painter.fill(stroke([[48, 162], [54, 112], [58, 66]], 4.2, 4.8), RAMP.wood, { seed: 12, rough: 0.25 });
  painter.fill(stroke([[57, 76], [59, 56]], 8.2, 7.6), RAMP.black, { seed: 13, rough: 0.5 });
  for (const bandY of [60, 66, 72]) painter.fill(stroke([[51, bandY + 2], [66, bandY - 1]], 1.3), RAMP.leather, { bias: -0.05 });
  painter.fill(ellipse(50, 131, 15, 14, -0.2), RAMP.skin, { gain: 1.1 });
  for (let i = 0; i < 4; i++) painter.fill(stroke([[52, 120 + i * 7], [62, 119 + i * 7]], 3.6), RAMP.skin, { bias: 0.05 - i * 0.04 });
  painter.fill(stroke([[40, 124], [50, 114], [58, 113]], 3.6, 3), RAMP.skin, { bias: 0.12 });
  painter.outline();
  flame(painter, 59, 58, 52, 12.5, frame);
  return painter.picture();
}

/** The hand holding a lantern by its ring, in `frame`: the lantern hangs to the hand's right, its candle burning. */
function lanternHand(frame) {
  const painter = createPainter(110, 138);
  painter.fill(stroke([[4, 152], [30, 80], [58, 30]], 18, 12), RAMP.brown, { seed: 21, rough: 0.2 });
  painter.fill(stroke([[54, 44], [59, 33]], 13), RAMP.brown, { bias: -0.12 });
  painter.fill(stroke([[60, 44], [64, 30], [74, 26], [84, 30], [88, 44]], 1.4), RAMP.iron, { bias: 0.1 });
  painter.fill(poly([[52, 52], [96, 52], [88, 44], [60, 44]]), RAMP.iron, { gain: 1.2 });
  painter.fill(ellipse(74, 44, 8, 5), RAMP.iron, { bias: 0.05 });
  const glass = rect(56, 54, 93, 110);
  painter.fill(glass, ({ t: light, px, py }) => RAMP.flame[Math.min(6, 3 + Math.floor(light * 2 + ((px + py + frame) % 3) / 3 + (frame % 2) * 0.4))], { gain: 0.6 });
  flame(painter, 74, 98, 22, 5.5, frame);
  painter.fill(rect(72, 98, 77, 108), RAMP.egg, { bias: 0.1 });
  for (const x of [56, 68, 81, 92]) painter.fill(rect(x, 53, x + 2, 111), RAMP.iron, { bias: x < 74 ? 0.05 : -0.1 });
  painter.fill(poly([[50, 110], [98, 110], [94, 120], [54, 120]]), RAMP.iron, { gain: 1.2 });
  painter.fill(rect(54, 53, 95, 56), RAMP.iron, { bias: -0.05 });
  painter.fill(ellipse(70, 24, 12, 11, -0.4), RAMP.skin, { gain: 1.1 });
  for (let i = 0; i < 3; i++) painter.fill(stroke([[71, 18 + i * 6], [81, 17 + i * 6]], 3.2), RAMP.skin, { bias: 0.05 - i * 0.05 });
  painter.fill(stroke([[56, 40], [60, 30]], 12.5), RAMP.brown, { bias: -0.2, under: false, clip: rect(40, 36, 66, 46) });
  painter.outline();
  return painter.picture();
}

/** The torch lying on the floor: handle low left, head high right; `lit` in `frame` burning, or doused. */
function droppedTorch(frame, lit = true) {
  const painter = createPainter(31, 34);
  painter.fill(stroke([[3, 32], [19, 22]], 1.6, 1.8), RAMP.wood, { seed: 31, rough: 0.2 });
  painter.fill(stroke([[17, 23.5], [23, 20]], 2.8), lit ? RAMP.black : RAMP.grey.slice(0, 3), { seed: 32, rough: 0.6 });
  painter.outline({ keep: 0.4 });
  if (lit) flame(painter, 22, 20, 18, 4, frame);
  else {
    painter.fill(stroke([[22, 17], [20, 12], [23, 8], [21, 3]], 0.9, 0.5), RAMP.grey.slice(3, 6), { gain: 0.4 });
    painter.set(22, 21, RAMP.ember[3]);
  }
  return painter.picture();
}

/** A candle doused, by our rule, from the player's own lit candle (top-down RGBA in, a new one out): every drawn pixel
 *  above the wax's first solid row that is not wax goes clear - the flame - and a charred wick stands in its place,
 *  a wisp of smoke over it. Wax is a grey pixel (its channels within 40 of each other). Pure. */
export function dousedCandle(pic) {
  const { width, height } = pic;
  const data = pic.data.slice();
  const drawn = (x, y) => data[(y * width + x) * 4 + 3] !== 0;
  const wax = (x, y) => {
    const offset = (y * width + x) * 4;
    return drawn(x, y) && Math.max(data[offset], data[offset + 1], data[offset + 2]) - Math.min(data[offset], data[offset + 1], data[offset + 2]) < 40;
  };
  let top = height;
  for (let y = 0; y < height && top === height; y++) {
    const row = [...Array(width).keys()].filter((x) => drawn(x, y));
    if (row.length >= 3 && row.every((x) => wax(x, y))) top = y;
  }
  let sum = 0, n = 0;
  for (let y = 0; y < top; y++)
    for (let x = 0; x < width; x++)
      if (drawn(x, y) && !wax(x, y)) { data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 4); sum += x; n++; }
  const out = { width, height, data };
  const pen = { set: (x, y, colour) => { if (x >= 0 && y >= 0 && x < width && y < height) data.set([...colour, 255], (y * width + x) * 4); } };
  const wickX = n ? Math.round(sum / n) : Math.floor(width / 2);
  pen.set(wickX, top - 1, RAMP.black[1]);
  pen.set(wickX, top - 2, RAMP.black[2]);
  pen.set(wickX, top, RAMP.grey[2]);
  for (const [dx, dy, step] of [[0, -4, 3], [1, -5, 4], [1, -6, 3], [0, -8, 4]]) pen.set(wickX + dx, top + dy, RAMP.grey[step]);
  return out;
}
/** The two candles doused: our rule over the player's own lit candle, TEXTURE.210 record 3 or 4 in PAL.PAL. */
export const TORCH_OVER = Object.freeze({
  '112358_11-0': Object.freeze({ from: Object.freeze([210, 3, 0]), pal: 'PAL.PAL' }),
  '112358_12-0': Object.freeze({ from: Object.freeze([210, 4, 0]), pal: 'PAL.PAL' }),
});

/** Each picture's recipe, by name (`archive_record-frame`, an emission twin `_Emission` after it). */
export const TORCH_ART = Object.freeze({
  ...Object.fromEntries([0, 1, 2, 3].map((frame) => [`112359_0-${frame}`, () => torchHand(frame)])),
  ...Object.fromEntries([0, 1, 2, 3].map((frame) => [`112359_1-${frame}`, () => lanternHand(frame)])),
  ...Object.fromEntries([0, 1, 2, 3].map((frame) => [`112358_0-${frame}`, () => droppedTorch(frame)])),
  ...Object.fromEntries([0, 1, 2, 3].map((frame) => [`112358_0-${frame}_Emission`, () => droppedTorch(frame)])),
  '112358_10-0': () => droppedTorch(0, false),
});
/** Our picture `name`, top-down RGBA - or null where it is none of ours. */
export const ownTorchPicture = (name) => (Object.hasOwn(TORCH_ART, name) ? TORCH_ART[name]() : null);
