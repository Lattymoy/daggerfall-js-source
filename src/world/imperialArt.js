// @ts-check
// IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND) - THE FABRIC'S PICTURES: the Imperial City's street walls (the
// KPbICA spec the owner forwarded, 2026-10-26: "buildings in cut stone, brick and half-timbering") and their ground
// floors - a storey of each, painted by world/capitalModels.js's own laws (TESA-LORE: a few dozen shades off a material's
// ramp through the ordered dither, every texel its own grain, masonry laid stone by stone) at vanilla's own wall format:
// 64 x 128 texels over 1.6 by 3.2 m (TESA-LORE's measure, 40.9 texels a metre), a window a picture. No game data.
//
// Each picture tiles along a wall (its left edge meets its right) and stands a storey: world/imperialFabricModels.js lays
// its top row at a storey's top, counted down from the eave, so a window sits where a window is on every floor.
import { CAPITAL_ART } from './capitalShapes.js';

/** A facade's picture, texels: vanilla's 64 x 128 wall. */
export const FACADE_TEXELS = Object.freeze({ w: 64, h: 128 });
/** The window every facade carries, texels of its picture: [x0, y0, x1, y1] (its frame inside), its mullion's column and
 *  its transom's row - 0.8 m wide, 1.4 m tall, its sill 1.0 m over the floor. */
export const FACADE_WINDOW = Object.freeze({ rect: Object.freeze([16, 30, 48, 86]), mullion: 31, transom: 50 });
/** BLD: A FACADE'S PLAIN ROWS - the run of a storey's picture between its window's sill (and the shadow under it, the
 *  window's foot + 6) and the next storey's window's lintel cap (its head - 9, the cut stone's heaviest), through the
 *  picture's wrap: `top` its first row, `rows` how many. No window, frame, shutter, sill or lintel of any of the five
 *  walls stands in it (the half-timbering's posts, rail, cross and plates do - its framing), so a strip of wall that is
 *  no whole storey (a plinth, a mezzanine over a shopfront, a gable, a party wall) is laid in it
 *  (world/imperialFabricModels.js) and never shows a window cut. */
export const FACADE_PLAIN = Object.freeze({
  top: FACADE_WINDOW.rect[3] + 6,
  rows: FACADE_TEXELS.h - (FACADE_WINDOW.rect[3] + 6) + FACADE_WINDOW.rect[1] - 9,
});

/**
 * THE FABRIC'S PICTURES on `out` (record to picture), painted by the capitals' own kit (world/capitalModels.js
 * capitalArt: `painted(ramps, tone, {seed, grain, w, h})`, `ramp(stops)`, `masonry(seed, o)`, `noise(seed, n)`).
 * @param {Map<number, any>} out
 * @param {{ painted: Function, ramp: Function, masonry: Function, noise: Function }} kit
 */
export function imperialArt(out, { painted, ramp, masonry, noise }) {
  const size = FACADE_TEXELS,
    [wx0, wy0, wx1, wy1] = FACADE_WINDOW.rect;
  const GLASS = ramp(
    [
      [26, 32, 44],
      [52, 62, 80],
      [86, 100, 120],
      [130, 146, 164],
    ],
    12,
  );
  const INSIDE = ramp(
    [
      [40, 34, 28],
      [66, 58, 48],
      [94, 84, 70],
      [122, 110, 94],
    ],
    12,
  ); // a loggia's shade, its back wall lit by the street
  const FRAME = ramp(
    [
      [34, 22, 12],
      [70, 48, 28],
      [112, 80, 50],
    ],
    10,
  );
  const STONE = ramp([
    [78, 74, 66],
    [128, 122, 110],
    [172, 166, 152],
    [208, 202, 188],
  ]);
  const TIMBER = ramp(
    [
      [52, 38, 24],
      [84, 62, 40],
      [114, 86, 56],
      [144, 110, 74],
    ],
    14,
  );
  /** A window's texel: glass (its panes darker low, a glint high), its frame and leading, else null. */
  const pane = (x, y) => {
    if (x < wx0 || x >= wx1 || y < wy0 || y >= wy1) return null;
    const edge = x < wx0 + 2 || x >= wx1 - 2 || y < wy0 + 2 || y >= wy1 - 2;
    if (edge || x === FACADE_WINDOW.mullion || x === FACADE_WINDOW.mullion + 1 || y === FACADE_WINDOW.transom)
      return [0.35 + (x === wx0 || y === wy0 ? 0.3 : 0), 2];
    const glint = x - wx0 + (y - wy0) < 12 && (x + y) % 5 === 0;
    return [glint ? 0.9 : 0.5 + ((y - wy0) / (wy1 - wy0)) * -0.15 + ((x + y * 3) % 7 === 0 ? 0.12 : 0), 1];
  };
  /** The window's sill (a stone lit on its top, shadowed under) and its lintel, on the wall's own ramp `k`. */
  const surround = (x, y, k = 3) => {
    if (x >= wx0 - 3 && x < wx1 + 3 && y >= wy1 && y < wy1 + 4)
      return [y === wy1 ? 0.92 : y === wy1 + 3 ? 0.2 : 0.62, k];
    if (x >= wx0 - 2 && x < wx1 + 2 && y >= wy0 - 4 && y < wy0)
      return [y === wy0 - 4 ? 0.85 : y === wy0 - 1 ? 0.18 : 0.55, k];
    if (y >= wy1 + 4 && y < wy1 + 6 && x >= wx0 - 2 && x < wx1 + 2) return [0.1, 0]; // the sill's shadow on the wall
    return null;
  };
  /** A plaster wall's tone law: mottled, the floor's string course at its foot. */
  const plasterOf = (seed) => {
    const a = noise(seed, 8),
      b = noise(seed + 1, 16);
    return (x, y) =>
      y >= 122
        ? y === 122
          ? 0.86
          : y === 127
            ? 0.18
            : 0.6
        : 0.42 + (a(x, y & 63) * 0.6 + b(x, y & 63) * 0.4 - 0.5) * 0.5;
  };

  // ochre stucco (the Market's, the Arena's): shutters either side of its window
  const ochre = plasterOf(0x9101),
    lime = plasterOf(0x9301);
  const SHUT = ramp(
    [
      [22, 44, 32],
      [46, 84, 62],
      [84, 124, 94],
      [120, 156, 120],
    ],
    14,
  );
  out.set(
    CAPITAL_ART.facadeOchre,
    painted(
      [
        ramp([
          [110, 76, 40],
          [160, 116, 64],
          [192, 150, 94],
          [216, 182, 130],
        ]),
        GLASS,
        FRAME,
        STONE,
        SHUT,
      ],
      (x, y) => {
        const w = pane(x, y) ?? surround(x, y);
        if (w) return w;
        if (y >= wy0 && y < wy1 && ((x >= wx0 - 10 && x < wx0 - 1) || (x >= wx1 + 1 && x < wx1 + 10)))
          return [(y - wy0) % 5 === 0 ? 0.2 : x === wx0 - 10 || x === wx1 + 1 ? 0.75 : 0.5, 4];
        return [ochre(x, y), 0];
      },
      { seed: 0x9102, grain: 0.07, ...size },
    ),
  );

  // brick (the Market's, the Arena's, the Waterfront's): courses of four, bricks stretcher bond, each its own fire; the
  // window in cut stone
  const fire = noise(0x9201, 16);
  out.set(
    CAPITAL_ART.facadeBrick,
    painted(
      [
        ramp([
          [62, 26, 16],
          [120, 52, 34],
          [164, 82, 56],
          [200, 124, 90],
        ]),
        GLASS,
        FRAME,
        STONE,
      ],
      (x, y) => {
        const w = pane(x, y) ?? surround(x, y);
        if (w) return w;
        const course = y >> 2,
          dy = y & 3,
          xs = (x + (course & 1 ? 4 : 0)) % 64,
          brick = Math.floor(xs / 8) + course * 9,
          dx = xs % 8;
        if (dy === 3 || dx === 7) return [0.6, 3]; // the mortar - pale; a brick 8 texels (0.2 m) by 4, eight to a course
        const base = 0.3 + ((((brick * 2654435761) >>> 0) % 1000) / 1000) * 0.4;
        return [base + (fire(x, y & 63) - 0.5) * 0.25 + (dy === 0 ? 0.12 : 0), 0];
      },
      { seed: 0x9202, grain: 0.06, ...size },
    ),
  );

  // white lime (the Arboretum's, the Elven Gardens', the Temple's): its window round-headed, a keystone over it
  const KEY = { x: 32, y: wy0 + 14, r: 16 };
  out.set(
    CAPITAL_ART.facadeWhite,
    painted(
      [
        ramp([
          [124, 120, 110],
          [160, 156, 146],
          [184, 180, 170],
          [204, 200, 190],
        ]),
        GLASS,
        FRAME,
        STONE,
      ],
      (x, y) => {
        const d = Math.hypot(x + 0.5 - KEY.x, y + 0.5 - KEY.y);
        if (y < KEY.y && x >= wx0 && x < wx1) {
          if (d < KEY.r - 2)
            return [0.5 + (x === FACADE_WINDOW.mullion || x === FACADE_WINDOW.mullion + 1 ? 0.15 : 0), 1];
          if (d < KEY.r) return [0.5, 2];
          if (d < KEY.r + 3) return [Math.abs(x + 0.5 - KEY.x) < 3 ? 0.9 : 0.66 - (d - KEY.r) * 0.08, 3]; // the arch's ring, its keystone
        }
        const w = (y >= KEY.y ? pane(x, y) : null) ?? (y >= wy1 ? surround(x, y) : null);
        if (w) return w;
        return [lime(x, y), 0];
      },
      { seed: 0x9302, grain: 0.05, ...size },
    ),
  );

  // cut stone (the Temple's, Talos Plaza's, the University's): ashlar in courses, its window under a heavier lintel
  const ashlar = masonry(0x9401, { rows: [14, 18], stones: [20, 32], mottle: 0.12, chips: 0.015 });
  out.set(
    CAPITAL_ART.facadeStone,
    painted(
      [STONE, GLASS, FRAME, STONE],
      (x, y) => {
        const w = pane(x, y) ?? surround(x, y);
        if (w) return w;
        if (x >= wx0 - 4 && x < wx1 + 4 && y >= wy0 - 9 && y < wy0 - 4) return [y === wy0 - 9 ? 0.9 : 0.66, 0]; // the lintel's cap
        return [ashlar.tone(x, y & 63), 0];
      },
      { seed: 0x9402, grain: 0.05, ...size },
    ),
  );

  // half-timbering (the Arena District's, the Waterfront's): a post at each picture's edge, a plate at the storey's top
  // and a sill at its foot, a rail under the window and a St Andrew's cross below it, the panels plastered
  const daub = noise(0x9501, 8);
  out.set(
    CAPITAL_ART.facadeTimber,
    painted(
      [
        ramp([
          [128, 114, 90],
          [164, 150, 122],
          [190, 178, 150],
          [210, 200, 176],
        ]),
        GLASS,
        FRAME,
        TIMBER,
      ],
      (x, y) => {
        const w = pane(x, y);
        if (w) return w;
        const beam = (lit) => [lit ? 0.8 : 0.55 + (daub(x * 3, y) - 0.5) * 0.3, 3];
        if (x < 4) return beam(x === 0);
        if (y < 5 || y >= 122) return beam(y === 0 || y === 122);
        if (y >= wy1 && y < wy1 + 4) return beam(y === wy1); // the rail under the window
        if (y >= wy1 + 4) {
          // the cross below it
          const t = (y - (wy1 + 4)) / (122 - (wy1 + 4)),
            xa = 4 + t * 60,
            xb = 64 - t * 60;
          if (Math.abs(x - xa) < 2.2 || Math.abs(x - xb) < 2.2) return beam(false);
        }
        if ((x >= wx0 - 3 && x < wx0) || (x >= wx1 && x < wx1 + 3)) return beam(false); // the window's studs
        return [0.4 + (daub(x, y & 63) - 0.5) * 0.35, 0];
      },
      { seed: 0x9502, grain: 0.06, ...size },
    ),
  );

  // a shopfront (a ground floor on a street): its fascia under the floor over it, its window of goods over a stall board,
  // a pier of stone between it and the next (half of it at each edge, so the fronts tile)
  out.set(
    CAPITAL_ART.groundShop,
    painted(
      [STONE, GLASS, FRAME, TIMBER],
      (x, y) => {
        if (x < 3 || x >= 61) return [ashlar.tone(x, y & 63) + (x === 2 || x === 61 ? -0.2 : 0), 0];
        if (y < 8) return [ashlar.tone(x, y), 0];
        if (y < 24) return [y === 8 ? 0.8 : y === 23 ? 0.15 : 0.5 + ((x >> 2) & 1 ? 0.06 : 0), 2]; // the fascia
        if (y < 92) {
          if (x < 6 || x >= 58 || y < 27 || x === 32 || x === 33) return [0.4 + (x === 3 || y === 24 ? 0.3 : 0), 2];
          // behind the glass its shelves, and the wares on them
          if (y === 50 || y === 70) return [0.3, 2];
          const ware = ((y > 38 && y < 50) || (y > 58 && y < 70)) && (x * 5 + Math.floor(y / 6) * 3) % 9 < 4;
          return ware ? [0.62 + ((x + y) % 3) * 0.08, 2] : [0.36 + (y - 27) / 260, 1];
        }
        if (y === 92) return [0.85, 2];
        return [0.42 + ((x - 3) % 11 === 0 || y === 126 ? -0.25 : 0), 3]; // the stall board
      },
      { seed: 0x9601, grain: 0.06, ...size },
    ),
  );

  // an arcade (a ground floor under a portico): stone piers at the picture's edges, a round arch between springing at a
  // man's height and a half, the loggia's shadow through it
  const ARCH = { x: 32, y: 60, r: 22 };
  out.set(
    CAPITAL_ART.groundArcade,
    painted(
      [STONE, INSIDE, FRAME, STONE],
      (x, y) => {
        const d = Math.hypot(x + 0.5 - ARCH.x, y + 0.5 - ARCH.y),
          inside = x >= ARCH.x - ARCH.r && x < ARCH.x + ARCH.r && (y >= ARCH.y || d < ARCH.r);
        if (inside) return [0.55 + (y > 118 ? 0.12 : 0) + Math.max(0, (y - ARCH.y) / 500), 1];
        if (y < ARCH.y && d < ARCH.r + 4) {
          // the voussoirs: one stone each 18 degrees, the key lit
          const a = Math.atan2(ARCH.y - y - 0.5, x + 0.5 - ARCH.x),
            k = Math.floor(a / (Math.PI / 10));
          return [Math.abs(a - Math.PI / 2) < 0.12 ? 0.92 : 0.5 + (k & 1 ? 0.12 : 0) + (d > ARCH.r + 3 ? -0.25 : 0), 0];
        }
        if (y >= ARCH.y - 2 && y < ARCH.y + 2 && (x < ARCH.x - ARCH.r || x >= ARCH.x + ARCH.r))
          return [y === ARCH.y - 2 ? 0.9 : 0.6, 0]; // the impost
        return [ashlar.tone(x, y & 63) + 0.04, 0];
      },
      { seed: 0x9701, grain: 0.05, ...size },
    ),
  );
  return out;
}
