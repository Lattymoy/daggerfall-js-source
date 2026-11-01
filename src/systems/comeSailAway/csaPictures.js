// @ts-check
// COME SAIL AWAY'S PICTURES, OURS, painted from numbers on fixed seeds at their first ask: the wind widget's arrow
// (frame i turned i steps clockwise from ahead, comeSailAway.js windWidgetFrameOf's), the wake's splash
// (WakeMaterial's), and the coasts' breakers - two paints of surf, the foam their key lays and the 32 frames' recipes
// render/comeSailAwayRender.js composes. Come Sail Away 2.1 laid its breakers over Daggerfall's snow; ours lay our own
// foam. Each picture is `{ width, height, data }`, RGBA top-down. Not a DFU member. Ledger A.
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { WAVE_FRAME_COUNT } from './comeSailAwayWaves.js';
import { windWidgetFrameCount } from './comeSailAway.js';

const picture = (width, height) => ({ width, height, data: new Uint8Array(width * height * 4) });
const put = (img, x, y, red, green, blue, alpha) => {
  const i = (y * img.width + x) * 4;
  img.data[i] = red;
  img.data[i + 1] = green;
  img.data[i + 2] = blue;
  img.data[i + 3] = alpha;
};
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/** The wind widget's size (square) and its arrow's colours: a pale shaft and head, a darker rim. */
export const WIND_WIDGET_SIZE = 128;
const ARROW = Object.freeze({ fill: [196, 222, 246], rim: [44, 84, 138], tail: [120, 164, 210] });

/** How far a point is inside the arrow pointing up from the widget's middle (positive inside, in texels). */
function arrowDepth(x, y) {
  const shaft = Math.min(9 - Math.abs(x), y + 46, 10 - y);
  const along = (y - 8) / 40;
  const head = along >= 0 && along <= 1 ? Math.min((1 - along) * 26 - Math.abs(x), (y - 8) * 0.6 + 2) : -1e9;
  const fin = y <= -30 && y >= -46 ? Math.min(20 - Math.abs(x) - (y + 46) * 0.6, y + 46, -30 - y) : -1e9;
  return Math.max(shaft, head, fin);
}

/** Wind widget frame `i`: the arrow turned `i` steps clockwise from straight up (the wind blowing the way you face). */
export function windWidgetFrame(i) {
  const size = WIND_WIDGET_SIZE,
    img = picture(size, size);
  const a = (i * 2 * Math.PI) / windWidgetFrameCount();
  const cos = Math.cos(a),
    sin = Math.sin(a);
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      // the texel's centre, y up, turned back by the frame's angle into the upright arrow's frame (4x supersampled)
      let inside = 0,
        rim = 0,
        tail = 0;
      for (let k = 0; k < 4; k++) {
        const x = px + 0.25 + (k & 1) * 0.5 - size / 2,
          y = size / 2 - (py + 0.25 + (k >> 1) * 0.5);
        const uprightX = cos * x - sin * y,
          uprightY = sin * x + cos * y;
        const depth = arrowDepth(uprightX, uprightY);
        if (depth > 0) inside++;
        if (depth > 0 && depth < 2.5) rim++;
        if (depth > 0 && uprightY < -28) tail++;
      }
      if (!inside) continue;
      const col = rim >= 2 ? ARROW.rim : tail >= 2 ? ARROW.tail : ARROW.fill;
      put(img, px, py, col[0], col[1], col[2], Math.round((inside / 4) * 255));
    }
  return img;
}

/** The wake's splash: a ring of foam, ragged at its edge and thin at its middle - 52 x 41, cut at half its alpha. */
export function splashPicture() {
  const width = 52,
    height = 41,
    img = picture(width, height);
  const die = mulberry32(0x5b1a5);
  const lobes = Array.from({ length: 9 }, () => [die() * Math.PI * 2, 0.06 + die() * 0.1]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5 - width / 2) / (width / 2),
        dy = (y + 0.5 - height / 2) / (height / 2);
      const ang = Math.atan2(dy, dx),
        distance = Math.hypot(dx, dy);
      const edge =
        0.92 - lobes.reduce((sum, [phase, amp]) => sum + amp * Math.max(0, Math.cos(ang * 3 - phase)), 0) * 0.5;
      if (distance > edge) continue;
      const ring = 1 - Math.abs(distance - edge * 0.62) / (edge * 0.5);
      const fleck = die();
      const a = clamp(ring * 1.4 + fleck * 0.35 - 0.1, 0, 1);
      const shade = 200 + Math.round(fleck * 55);
      put(img, x, y, shade - 12, shade, 255 - Math.round((1 - ring) * 30), Math.round(a * 255));
    }
  return img;
}

/** A breaker frame's size, square, and the paints' key: the texel the foam is laid in. */
export const WAVE_SIZE = 640;
export const WAVE_KEY = 'ff00ffff';
const KEY = Object.freeze([255, 0, 255, 255]);
/** The foam's picture (tiled under the key). */
export const FOAM_SIZE = 64;

/** The foam: churned white over a pale green-blue, tileable. */
export function foamPicture() {
  const size = FOAM_SIZE,
    img = picture(size, size);
  const die = mulberry32(0xf0a3);
  const lat = Array.from({ length: 64 }, () => die());
  const at = (i, j) => lat[(((j % 8) + 8) % 8) * 8 + (((i % 8) + 8) % 8)];
  const smooth = (along) => along * along * (3 - 2 * along);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cellX = x / 8,
        cellY = y / 8,
        i = Math.floor(cellX),
        j = Math.floor(cellY);
      const blendX = smooth(cellX - i),
        blendY = smooth(cellY - j);
      const n =
        at(i, j) * (1 - blendX) * (1 - blendY) +
        at(i + 1, j) * blendX * (1 - blendY) +
        at(i, j + 1) * (1 - blendX) * blendY +
        at(i + 1, j + 1) * blendX * blendY;
      const shade = n > 0.42 ? 236 + Math.round(n * 19) : 168 + Math.round(n * 120);
      put(img, x, y, shade - 10, shade, Math.min(255, shade + 8), 255);
    }
  return img;
}

/** The crest's broken edge: teeth a crest, up to WAVE_TOOTH rows deep. */
export const WAVE_TEETH = 28;
export const WAVE_TOOTH = 2;

/**
 * Breaker paint `paintIndex` (0 or 1): rows of surf running across it, each a crest of foam (the key) over the wave's face -
 * blue-green, opaque - and clear water between, the fronts wavering along x. Tileable both ways. The frames alternate
 * the two paints, so both lay the same fronts and only the crest's teeth trade places: the foam churns, never jumps.
 */
export function wavePaint(paintIndex) {
  const size = WAVE_SIZE,
    img = picture(size, size);
  const die = mulberry32(0x3a7e);
  const fronts = Array.from({ length: 5 }, (_, n) => ({
    y0: Math.floor((n + 0.5) * (size / 5)) % size,
    waves: [1, 2, 3].map((harmonic) => [harmonic, (die() * 2 - 1) * (10 / harmonic), die() * Math.PI * 2]),
    face: 34 + Math.floor(die() * 14),
    crest: 9 + Math.floor(die() * 6),
    churn: die() * Math.PI * 2,
  }));
  for (const front of fronts)
    for (let x = 0; x < size; x++) {
      const frontY =
        front.y0 +
        front.waves.reduce(
          (sum, [harmonic, amp, phase]) => sum + amp * Math.sin((2 * Math.PI * harmonic * x) / size + phase),
          0,
        );
      const tooth = Math.round(
        WAVE_TOOTH * Math.sin((2 * Math.PI * WAVE_TEETH * x) / size + front.churn + paintIndex * Math.PI),
      );
      for (let depth = -front.crest - tooth; depth < front.face; depth++) {
        const y = (((Math.round(frontY) + depth) % size) + size) % size;
        if (depth < 0) {
          put(img, x, y, KEY[0], KEY[1], KEY[2], KEY[3]);
          continue;
        }
        const along = depth / front.face;
        const green = Math.round(150 - 60 * along),
          b = Math.round(176 - 40 * along);
        put(img, x, y, Math.round(70 - 30 * along), green, b, along > 0.92 ? 0 : 255);
      }
    }
  return img;
}

/** The 32 frames' recipes, in the shape render/comeSailAwayRender.js setWaveFrames reads: frame i shows paint i % 2
 *  scrolled 9 rows a step, its foam laid from a point that walks along with it. */
export function waveSpecs() {
  return Array.from({ length: WAVE_FRAME_COUNT }, (_, i) => ({
    paint: i % 2,
    scroll: (WAVE_SIZE - 9 * Math.floor(i / 2)) % WAVE_SIZE,
    tile: [0, (((FOAM_SIZE - 3 * i) % FOAM_SIZE) + FOAM_SIZE) % FOAM_SIZE],
    size: [WAVE_SIZE, WAVE_SIZE],
  }));
}

/** Everything the breakers' pass is given (render/comeSailAwayRender.js setWaveFrames). */
export const waveFrames = () => ({ paints: [wavePaint(0), wavePaint(1)], snow: foamPicture(), specs: waveSpecs() });
