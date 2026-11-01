// @ts-check
// THE CART'S HORSE, OURS. Horse Cart and Cargo 1.0.0-rc12 drew a saddled horse of
// its own: five views standing (`horse1..5.png`, 121x94) and a five-view, eight-frame walk (`Walk.<view>-<frame>.png`,
// 121x95), read by its HorseTextureSet and HorseWalkAnimationSet. Ours keeps those names, sizes, views and frames. Each
// picture is built from the player's own ARENA2: Daggerfall's horse under its rider (TEXTURE.495 records 0-4, the
// rider's walk, frames 0-7), the rider taken off (his mask, eotbRiderMasks.js, and his colours), the flank under his
// leg filled from the hide beside it, and our own saddle painted on (art/ownPainter.js). Pure but for `ownHorsePicture`.
import { createPainter, poly, rect, stroke, hex, RAMP } from '../../art/ownPainter.js';
import { FRONT_RIDER_MASKS, FRONT_RIDER_SIZE } from './horseFrontRider.js';

/** Daggerfall's mounted rider set the horse is taken from, its palette, and the masks' key for it (EOTB's 112382). */
export const HORSE_ART_ARCHIVE = 495;
export const HORSE_ART_PALETTE = 'ART_PAL.COL';
export const HORSE_ART_MASK_SET = 112382;
/** The pictures' sizes - the names' own (horseCartLaw.js HORSE_SPRITE_WIDTH and the heights). */
export const HORSE_ART_WIDTH = 121;
export const HORSE_ART_STILL_HEIGHT = 94;
export const HORSE_ART_WALK_HEIGHT = 95;
/** How many rows above a picture's bottom edge the hooves stand. */
export const HORSE_ART_GROUND_GAP = 2;

/** A picture's name -> `{ view, frame, still }` (0-based), or null for a name that is no horse picture. */
export function horseArtOf(/** @type {string} */ file) {
  let parts = /^horse([1-5])\.png$/.exec(file);
  if (parts) return { view: Number(parts[1]) - 1, frame: 0, still: true };
  parts = /^Walk\.([0-4])-([1-8])\.png$/.exec(file);
  return parts ? { view: Number(parts[1]), frame: Number(parts[2]) - 1, still: false } : null;
}
/** Every name, the standing five then the forty walk frames. */
export const HORSE_ART_FILES = Object.freeze([
  ...Array.from({ length: 5 }, (_, view) => `horse${view + 1}.png`),
  ...Array.from({ length: 40 }, (_, i) => `Walk.${Math.floor(i / 8)}-${(i % 8) + 1}.png`),
]);

/** A rider mask (`<w>x<h>:<runs>`, tools/bakeEotbRiders.mjs packMask) as rows top first, 1 a rider's pixel. */
export function unpackRiderMask(/** @type {string} */ packed) {
  const at = packed.indexOf(':'),
    [wide, tall] = packed.slice(0, at).split('x').map(Number);
  const bin = globalThis.atob(packed.slice(at + 1)),
    out = new Uint8Array(wide * tall);
  let i = 0,
    his = 0;
  for (let byte = 0; byte < bin.length;) {
    let run = 0,
      shift = 0,
      code;
    do {
      code = bin.charCodeAt(byte++);
      run += (code & 127) * 2 ** shift;
      shift += 7;
    } while (code & 128);
    if (his) out.fill(1, i, Math.min(out.length, i + run));
    i += run;
    his ^= 1;
  }
  return { width: wide, height: tall, mask: out };
}

function hsv(/** @type {number} */ red, /** @type {number} */ green, /** @type {number} */ blue) {
  const most = Math.max(red, green, blue) / 255,
    least = Math.min(red, green, blue) / 255,
    spread = most - least;
  let hue = 0;
  if (spread)
    hue =
      most * 255 === red
        ? ((green - blue) / 255 / spread) % 6
        : most * 255 === green
          ? (blue - red) / 255 / spread + 2
          : (red - green) / 255 / spread + 4;
  hue *= 60;
  return [hue < 0 ? hue + 360 : hue, most ? spread / most : 0, most];
}
/** Whether a drawn pixel is the rider's by its colour alone: his clothes are cool (green, blue, violet), his steel pale
 *  and grey. The horse is warm browns and near-black. */
export function riderColour(/** @type {number} */ red, /** @type {number} */ green, /** @type {number} */ blue) {
  const [hue, sat, value] = hsv(red, green, blue);
  return (sat >= 0.22 && hue >= 55 && hue <= 320 && value > 0.12) || (sat < 0.12 && value > 0.45);
}
const DARK = 0.2;
/** Pixels too few to be the horse: a piece under this share of the largest is the rider's last scrap. */
const SCRAP_SHARE = 0.1;

/**
 * THE HORSE WITHOUT ITS RIDER: `pic` (top-down RGBA, the record) less the mask's pixels, the rider's colours, a thin dark
 * line left of his outline, and any scrap cut off from the horse. Answers `keep`, 1 a pixel of the horse's.
 */
export function riderless(
  /** @type {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} */ pic,
  /** @type {Uint8Array|null} */ mask,
) {
  const { width: wide, height: tall, data: src } = pic,
    count = wide * tall;
  const keep = new Uint8Array(count),
    dark = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (!src[i * 4 + 3] || mask?.[i] || riderColour(src[i * 4], src[i * 4 + 1], src[i * 4 + 2])) continue;
    keep[i] = 1;
    dark[i] = Math.max(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) / 255 < DARK ? 1 : 0;
  }
  const kept = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 && y >= 0 && x < wide && y < tall && keep[y * wide + x] === 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < count; i++) {
      if (!keep[i] || !dark[i]) continue;
      const x = i % wide,
        y = (i - x) / wide;
      if (+kept(x - 1, y) + +kept(x + 1, y) + +kept(x, y - 1) + +kept(x, y + 1) < 2) keep[i] = 0;
    }
  }
  const piece = new Int32Array(count).fill(-1),
    sizes = [];
  for (let i = 0; i < count; i++) {
    if (!keep[i] || piece[i] >= 0) continue;
    const queue = [i];
    piece[i] = sizes.length;
    for (let next = 0; next < queue.length; next++) {
      const at = queue[next],
        x = at % wide,
        y = (at - x) / wide;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nearX = x + dx,
            nearY = y + dy,
            j = nearY * wide + nearX;
          if (nearX >= 0 && nearY >= 0 && nearX < wide && nearY < tall && keep[j] && piece[j] < 0) {
            piece[j] = sizes.length;
            queue.push(j);
          }
        }
    }
    sizes.push(queue.length);
  }
  const big = Math.max(0, ...sizes);
  for (let i = 0; i < count; i++) if (keep[i] && sizes[piece[i]] < big * SCRAP_SHARE) keep[i] = 0;
  return keep;
}

/** Where a rider sits: the centre of his mask's lowest RIDER_SEAT_ROWS rows (his seat, not his swinging arm), or null
 *  for an empty mask. */
export const RIDER_SEAT_ROWS = 8;
export function riderSeatOf(/** @type {Uint8Array} */ mask, /** @type {number} */ wide) {
  let low = -1;
  for (let i = mask.length - 1; i >= 0 && low < 0; i--) if (mask[i]) low = Math.floor(i / wide);
  if (low < 0) return null;
  let n = 0,
    sumX = 0,
    sumY = 0;
  for (let i = Math.max(0, (low - RIDER_SEAT_ROWS + 1) * wide); i <= (low + 1) * wide - 1; i++)
    if (mask[i]) {
      n++;
      sumX += i % wide;
      sumY += Math.floor(i / wide);
    }
  return [sumX / n, sumY / n];
}
/** Whether a frame's mask is its rider's: its lowest row within MASK_DROP rows of frame 0's, its pixels under
 *  MASK_GROWTH times frame 0's. */
const MASK_DROP = 6,
  MASK_GROWTH = 1.6;
export function saneMask(/** @type {Uint8Array} */ mask, /** @type {Uint8Array} */ first, /** @type {number} */ wide) {
  const stat = (/** @type {Uint8Array} */ bits) => {
    let n = 0,
      low = -1;
    for (let i = 0; i < bits.length; i++)
      if (bits[i]) {
        n++;
        low = Math.floor(i / wide);
      }
    return { n, low };
  };
  const now = stat(mask),
    then = stat(first);
  return now.low <= then.low + MASK_DROP && now.n <= then.n * MASK_GROWTH;
}

// ── OUR SADDLE ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A blue saddle cloth with a pale hem, a dark leather seat, a girth, and a stirrup on an iron ring. None of its colours
// is a hide's (horseCoats.js isCoatPixel: warm with saturation 0.2 or more; the leather stays under it), so no coat or
// look ever dyes it.
const LEATHER = Object.freeze(
  ['#171513', '#282521', '#3b3732', '#524d46', '#6b655c'].map((colour) => Object.freeze(hex(colour))),
);
const HEM = Object.freeze(['#5b5a55', '#8a8981', '#b4b2a8', '#d6d3c8'].map((colour) => Object.freeze(hex(colour))));
const CLOTH = RAMP.blue;

/**
 * Each view's saddle where the rider sat, in the record's own pixels at frame 0: `cloth` the saddle cloths (polygons),
 * `seat` the leather with its pommel and cantle risen, `girth` the strap under the belly, `stirrup` each leather and
 * ring. `under` lays the whole saddle (`all`) or its cloth (`cloth`) only where the horse is not drawn - behind the
 * neck from the front, behind the croup from the back. `clear` are boxes where nothing of the horse is, so nothing of
 * the rider stays. Views as the walk's records: 0 the front, 1 the front quarter, 2 the side, 3 the back quarter, 4 the
 * back; the horse faces left.
 */
export const SADDLES = Object.freeze([
  Object.freeze({
    cloth: [
      [
        [5, 31],
        [13, 28],
        [14, 47],
        [7, 49],
        [4, 40],
      ],
      [
        [34, 28],
        [42, 31],
        [43, 40],
        [40, 49],
        [33, 47],
      ],
    ],
    seat: [
      [13, 26],
      [17, 22],
      [30, 22],
      [34, 26],
      [32, 30],
      [15, 30],
    ],
    girth: null,
    stirrup: [
      [
        [7, 42],
        [6, 52],
      ],
      [
        [40, 42],
        [41, 52],
      ],
    ],
    under: 'all',
    clear: [
      [0, 0, 14, 28],
      [31, 0, 47, 28],
    ],
  }),
  Object.freeze({
    cloth: [
      [
        [44, 31],
        [70, 34],
        [73, 47],
        [63, 50],
        [47, 45],
      ],
    ],
    seat: [
      [46, 30],
      [48, 27],
      [51, 30],
      [62, 32],
      [65, 28],
      [68, 31],
      [66, 37],
      [49, 35],
    ],
    girth: [
      [54, 45],
      [55, 57],
    ],
    stirrup: [
      [
        [59, 36],
        [62, 52],
      ],
    ],
    under: null,
    clear: [],
  }),
  Object.freeze({
    cloth: [
      [
        [50, 29],
        [80, 30],
        [80, 45],
        [53, 45],
        [49, 37],
      ],
    ],
    seat: [
      [52, 28],
      [54, 25],
      [57, 28],
      [70, 28],
      [74, 23],
      [77, 25],
      [76, 32],
      [55, 33],
    ],
    girth: [
      [57, 44],
      [57, 55],
    ],
    stirrup: [
      [
        [64, 32],
        [64, 49],
      ],
    ],
    under: null,
    clear: [],
  }),
  Object.freeze({
    cloth: [
      [
        [27, 31],
        [66, 31],
        [68, 43],
        [44, 46],
        [29, 43],
      ],
    ],
    seat: [
      [32, 29],
      [34, 26],
      [37, 29],
      [56, 29],
      [60, 25],
      [63, 28],
      [61, 34],
      [35, 34],
    ],
    girth: [
      [38, 42],
      [39, 54],
    ],
    stirrup: [
      [
        [33, 36],
        [31, 52],
      ],
    ],
    under: null,
    clear: [[26, 0, 93, 21]],
  }),
  Object.freeze({
    cloth: [
      [
        [6, 33],
        [39, 33],
        [41, 48],
        [33, 50],
        [12, 50],
        [4, 48],
      ],
    ],
    seat: [
      [12, 32],
      [14, 28],
      [31, 28],
      [33, 32],
      [32, 35],
      [13, 35],
    ],
    girth: null,
    stirrup: [
      [
        [5, 42],
        [3, 53],
      ],
      [
        [40, 42],
        [42, 53],
      ],
    ],
    under: 'cloth',
    clear: [[0, 0, 45, 31]],
  }),
]);

/** Paints view `view`'s saddle at offset (`dx`, `dy`) on two clear layers `wide` x `tall`: `cloth`, and `top` (the
 *  seat, the girth and the stirrups) laid over it. */
export function paintSaddle(
  /** @type {number} */ view,
  /** @type {number} */ wide,
  /** @type {number} */ tall,
  dx = 0,
  dy = 0,
) {
  const saddle = SADDLES[view],
    cloth = createPainter(wide, tall),
    top = createPainter(wide, tall);
  const at = (/** @type {number[][]} */ pts) => pts.map(([x, y]) => [x + dx, y + dy]);
  for (const shape of saddle.cloth) cloth.fill(poly(at(shape)), CLOTH, { gain: 1.1 });
  // the hem: the cloth's lower edge, two pixels deep
  for (const shape of saddle.cloth) {
    const pts = at(shape),
      low = pts.filter(([, y]) => y >= Math.max(...pts.map((point) => point[1])) - 4);
    if (low.length >= 2)
      cloth.fill(
        stroke(
          low.sort((a, b) => a[0] - b[0]),
          1,
        ),
        HEM,
        { over: true },
      );
  }
  cloth.outline({ dark: [10, 9, 12], keep: 0.35, edges: false });
  if (saddle.girth) top.fill(stroke(at(saddle.girth), 1.1), LEATHER);
  top.fill(poly(at(saddle.seat)), LEATHER, { bias: -0.05, gain: 0.9 });
  for (const strap of saddle.stirrup) {
    const [a, b] = at(strap);
    top.fill(stroke([a, b], 0.75), LEATHER);
    top.fill(rect(b[0] - 2, b[1] - 0.5, b[0] + 2.5, b[1] + 2), RAMP.iron, { bias: 0.1 });
  }
  top.outline({ dark: [10, 9, 12], keep: 0.35, edges: false });
  return { cloth: cloth.picture(), top: top.picture() };
}

/** The 4x4 ordered dither's order. */
const BAYER = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
/**
 * The flank under the rider's leg, filled: a pixel not the horse's, drawn in the record or under the saddle, with the
 * horse's own pixels within `reach` either side of it in its row and below it in its column (or the saddle above), takes
 * the left or the right one by the ordered dither - the hide's own colours, never a blend. In place on `out`.
 */
export function fillFlank(
  /** @type {Uint8Array} */ out,
  /** @type {Uint8Array} */ keep,
  /** @type {Uint8Array|Uint8ClampedArray} */ src,
  /** @type {Uint8Array} */ cover,
  /** @type {number} */ wide,
  /** @type {number} */ tall,
  reach = 14,
) {
  for (let y = 0; y < tall; y++) {
    for (let x = 0; x < wide; x++) {
      const i = y * wide + x;
      if (keep[i] || !src[i * 4 + 3]) continue;
      let left = -1,
        right = -1;
      for (let k = 1; k <= reach && left < 0; k++) if (x - k >= 0 && keep[i - k]) left = x - k;
      for (let k = 1; k <= reach && right < 0; k++) if (x + k < wide && keep[i + k]) right = x + k;
      if (left < 0 || right < 0) continue;
      let below = false,
        above = false;
      for (let k = 1; k <= 10 && !below; k++) if (y + k < tall && keep[i + k * wide]) below = true;
      for (let k = 1; k <= 16 && !above; k++)
        if (y - k >= 0 && (keep[i - k * wide] || cover[i - k * wide])) above = true;
      if (!below || !above) continue;
      const share = (x - left) / (right - left),
        from = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < share ? right : left;
      const at = (y * wide + from) * 4;
      out[i * 4] = src[at];
      out[i * 4 + 1] = src[at + 1];
      out[i * 4 + 2] = src[at + 2];
      out[i * 4 + 3] = 255;
    }
  }
}

/** What is left of the rider above the seat - an arm, a hilt - goes: in the seat's columns, nothing of the horse's
 *  stands over the saddle. In place on `keep`. */
export function clearAboveSeat(
  /** @type {Uint8Array} */ keep,
  /** @type {Uint8Array} */ cover,
  /** @type {number[][]} */ seat,
  /** @type {number} */ dx,
  /** @type {number} */ wide,
  /** @type {number} */ tall,
) {
  const x0 = Math.max(0, Math.min(...seat.map((point) => point[0])) + dx + 1),
    x1 = Math.min(wide - 1, Math.max(...seat.map((point) => point[0])) + dx);
  for (let x = x0; x <= x1; x++) {
    let top = -1;
    for (let y = 0; y < tall && top < 0; y++) if (cover[y * wide + x]) top = y;
    for (let y = 0; y < top; y++) keep[y * wide + x] = 0;
  }
}

/**
 * ONE PICTURE, PURE: view `view` from `record` (top-down RGBA, TEXTURE.495 record `view`) and its rider `mask`, the
 * saddle moved by `bob` (the rider's seat this frame less frame 0's), on a canvas `HORSE_ART_WIDTH` x `height`, the
 * record centred and its bottom HORSE_ART_GROUND_GAP rows above the canvas's.
 */
export function composeHorse(
  /** @type {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} */ record,
  /** @type {Uint8Array|null} */ mask,
  /** @type {number} */ view,
  /** @type {number} */ height,
  bob = [0, 0],
) {
  const { width: wide, height: tall, data: src } = record;
  const saddle = SADDLES[view],
    dx = Math.round(bob[0]),
    dy = Math.round(bob[1]);
  const keep = riderless(record, mask);
  for (const [x0, y0, x1, y1] of saddle.clear)
    for (let y = Math.max(0, y0 + dy); y < Math.min(tall, y1 + dy); y++)
      keep.fill(0, y * wide + Math.max(0, x0 + dx), y * wide + Math.min(wide, x1 + dx));
  const { cloth, top } = paintSaddle(view, wide, tall, dx, dy);
  const cover = new Uint8Array(wide * tall);
  for (let i = 0; i < wide * tall; i++) cover[i] = cloth.data[i * 4 + 3] || top.data[i * 4 + 3] ? 1 : 0;
  if (!saddle.under) clearAboveSeat(keep, cover, saddle.seat, dx, wide, tall);
  const pixels = new Uint8Array(wide * tall * 4);
  for (let i = 0; i < wide * tall; i++) if (keep[i]) pixels.set(src.subarray(i * 4, i * 4 + 4), i * 4);
  fillFlank(pixels, keep, src, cover, wide, tall);
  /** @type {[typeof cloth, boolean][]} */
  const layers = [
    [cloth, !!saddle.under],
    [top, saddle.under === 'all'],
  ];
  for (const [layer, behind] of layers) {
    for (let i = 0; i < wide * tall; i++)
      if (layer.data[i * 4 + 3] && !(behind && keep[i])) pixels.set(layer.data.subarray(i * 4, i * 4 + 4), i * 4);
  }
  const out = new Uint8Array(HORSE_ART_WIDTH * height * 4);
  const left = Math.round((HORSE_ART_WIDTH - wide) / 2),
    drop = height - HORSE_ART_GROUND_GAP - tall;
  for (let y = 0; y < tall; y++) {
    const toY = y + drop;
    if (toY < 0 || toY >= height) continue;
    for (let x = 0; x < wide; x++) {
      const toX = x + left;
      if (toX < 0 || toX >= HORSE_ART_WIDTH || !pixels[(y * wide + x) * 4 + 3]) continue;
      out.set(pixels.subarray((y * wide + x) * 4, (y * wide + x) * 4 + 4), (toY * HORSE_ART_WIDTH + toX) * 4);
    }
  }
  return { width: HORSE_ART_WIDTH, height, data: out };
}

/** The masks' module, loaded on the first picture (it is large) - a test hands its own. */
const loadMasks = () => import('../../player/eyeOfTheBeholder/eotbRiderMasks.js').then((masks) => masks.RIDER_MASKS);

/**
 * OUR HORSE PICTURE `file` (a name horseArtOf knows), top-down RGBA, built from the player's TEXTURE.495. `art` the
 * session's reader (systems/classicArt.js), `masks` the rider masks' loader. Rejects for an unknown name or a missing
 * record, as a failed fetch did.
 */
export async function ownHorsePicture(
  /** @type {string} */ file,
  /** @type {{ art?: any, masks?: () => Promise<Record<string, string>> }} */ { art = null, masks = loadMasks } = {},
) {
  const named = horseArtOf(file);
  if (!named) throw new Error(`${file}: no horse picture of that name`);
  const reader = art ?? (await import('../classicArt.js')).classicArt();
  const [record, all] = await Promise.all([
    reader.picture(HORSE_ART_ARCHIVE, named.view, named.frame, HORSE_ART_PALETTE),
    masks(),
  ]);
  if (!record)
    throw new Error(
      `${file}: TEXTURE.${HORSE_ART_ARCHIVE} record ${named.view} frame ${named.frame} is not in the player's data`,
    );
  const maskOf = (/** @type {number} */ frame) => {
    const packed = all?.[`${HORSE_ART_MASK_SET}_${5 + named.view}-${frame}`];
    if (!packed) return null;
    const unpacked = unpackRiderMask(packed);
    return unpacked.width === record.width && unpacked.height === record.height ? unpacked.mask : null;
  };
  const first = named.frame ? maskOf(0) : null,
    own = maskOf(named.frame);
  // a frame's mask that runs far below its rider's frame-0 seat took the horse for him (the bake's alignment failed on
  // the quarter view's walk): the frame-0 mask stands in for it
  const mask = own && first && !saneMask(own, first, record.width) ? first : own;
  let bob = [0, 0];
  if (first && mask && mask !== first) {
    const seat = riderSeatOf(mask, record.width),
      seatThen = riderSeatOf(first, record.width);
    if (seat && seatThen) bob = [0, seat[1] - seatThen[1]];
  }
  const height = named.still ? HORSE_ART_STILL_HEIGHT : HORSE_ART_WALK_HEIGHT;
  return composeHorse(
    record,
    named.view === 0 ? withFrontRider(mask, record, named.frame) : mask,
    named.view,
    height,
    bob,
  );
}

/** The front view's rider as we drew him (horseFrontRider.js) laid over the baked mask, on a record of the
 *  size he was drawn over; any other record keeps the baked mask alone. */
export function withFrontRider(
  /** @type {Uint8Array|null} */ mask,
  /** @type {{width:number,height:number}} */ record,
  /** @type {number} */ frame,
) {
  const [wide, tall] = FRONT_RIDER_SIZE,
    packed = FRONT_RIDER_MASKS[frame];
  if (!packed || record.width !== wide || record.height !== tall) return mask;
  const drawn = unpackRiderMask(packed).mask;
  if (mask) for (let i = 0; i < drawn.length; i++) drawn[i] |= mask[i];
  return drawn;
}
