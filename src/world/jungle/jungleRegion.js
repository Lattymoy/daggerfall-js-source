// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (bible/03-World/Bantha-Jungle.md): WHERE THE JUNGLE IS - how far a point stands inside Bantha, as one
// continuous field the layout (on the terrain worker) and the haze (on the main thread) both read, so the trees thin and
// the air clears at the same border.
//
// BANTHA2 (2026-10-19, the owner: "The area is red in bantha and should be the jungle biome"): Bantha is the area the
// owner painted on the Hammerfell shore (world/jungle/banthaArea.js, a set of map pixels, 819.2 m square), where BANTHA1
// stood the jungle on Glenpoint's political region - either way an edge that is a staircase of pixel edges. Here:
//   - THE FIELD. Each pixel near the area carries its SIGNED DISTANCE from the area's edge - from its centre to the
//     nearest pixel of the other side's square, in pixels, positive inside and negative outside, held at
//     JUNGLE_FIELD_REACH past it - read the first time a pixel is asked and kept (jungleField: no sweep of the map). Read between pixel centres (bilinearly,
//     jungleSignedAt) the field crosses zero along the pixels' shared edges and rounds the staircase's corners.
//   - THE BORDER WANDERS. Two octaves of the ecotone's own value noise (world/ecotone.js ecoNoise - integer-hashed on
//     world tile lattices, the same on every engine and in the worker) move the line by up to JUNGLE_WANDER's
//     amplitudes, so the jungle's edge bends through the land and never runs along a pixel's edge.
//   - TWO SHARES OF IT. The layout's (jungleShare: none JUNGLE_EDGE.out outside the line, whole JUNGLE_EDGE.in inside)
//     and the haze's (world/jungle/jungleHaze.js JUNGLE_HAZE.edge: the haze drifts out past the trees and thickens further
//     in) - each a smoothstep of the one depth.
// A job to the terrain worker carries the pixel's 3x3 of distances (jungleNine) - nine numbers, nothing else crosses.
// ═══════════════════════════════════════════════════════════════════
import { ecoNoise, ecoOrigin } from '../ecotone.js';
import { banthaAreaHas } from './banthaArea.js';

/** How far (pixels) from the edge the field is exact; past it a pixel reads this much and a half, its side's sign. */
export const JUNGLE_FIELD_REACH = 6;
/** A map pixel (m) - terrainSampler.js TERRAIN_SIZE, held here as ecotone.js holds its own. */
const PIXEL_M = 819.2;
const TILE_M = 6.4;
/** The border's wander: two octaves of the ecotone's value noise - a lattice cell (tiles) and an amplitude (m) each -
 *  and their salt (the ecotone's own seams take 101 and 211 - the jungle's line bends its own way). */
export const JUNGLE_WANDER = Object.freeze({
  octaves: Object.freeze([Object.freeze({ cell: 64, amp: 150 }), Object.freeze({ cell: 8, amp: 40 })]),
  salt: 467,
});
/** The layout's share across the line (m of depth): none this far outside it, whole this far inside. */
export const JUNGLE_EDGE = Object.freeze({ out: 60, in: 480 });

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * THE FIELD over a `width` x `height` map, ASKED, NEVER SWEPT: `at(x, y)` a pixel's signed distance (pixels; the file's
 * head), `-(reach + 0.5)` off the map and wherever nothing of the other side is within the reach. A pixel's distance is
 * read the first time it is asked - its neighbours' sides out to the reach, ring by ring, stopping once no nearer ring
 * can beat what it found - and kept, as each pixel's side is kept once read: a pixel the stream never builds is never
 * read, and no frame or boot pays for the map's other 499,000 pixels. `insideAt(x, y)` whether a pixel is the jungle's
 * (banthaArea.js banthaAreaHas, the owner's area); a pixel off the map is outside.
 * @param {{ width: number, height: number, insideAt?: (x: number, y: number) => boolean, reach?: number }} o
 */
export function jungleField({ width, height, insideAt = banthaAreaHas, reach = JUNGLE_FIELD_REACH }) {
  const side = new Uint8Array(width * height).fill(2);   // 2 not yet read, 1 the jungle's, 0 not
  const dist = new Float32Array(width * height).fill(NaN);
  const far = reach + 0.5;
  const sideAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const i = y * width + x;
    let v = side[i];
    if (v === 2) side[i] = v = insideAt(x, y) ? 1 : 0;
    return v;
  };
  const toOther = (me, x, y, dx, dy, best) => {
    if (sideAt(x + dx, y + dy) === me) return best;
    return Math.min(best, Math.hypot(Math.max(Math.abs(dx) - 0.5, 0), Math.max(Math.abs(dy) - 0.5, 0)));
  };
  return {
    width, height, reach,
    /** A pixel read as the jungle's (1) or not (0) - off the map, not. */
    inside: sideAt,
    /** A pixel's signed distance from the jungle's edge (pixels). */
    at(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return -far;
      const i = y * width + x;
      const known = dist[i];
      if (known === known) return known;   // read before
      const me = sideAt(x, y);
      let best = far;
      // ring r's nearest square is r - 0.5 off: past the best found, no ring can beat it
      for (let r = 1; r <= reach && r - 0.5 < best; r++) {
        for (let k = -r; k <= r; k++) { best = toOther(me, x, y, k, -r, best); best = toOther(me, x, y, k, r, best); }
        for (let k = -r + 1; k <= r - 1; k++) { best = toOther(me, x, y, -r, k, best); best = toOther(me, x, y, r, k, best); }
      }
      dist[i] = me ? best : -best;
      return dist[i];   // AUDIT BANTHA1 LAY-8: the first read the float32 every later read is - never the float64 it came from
    },
  };
}

/** The field's cache, one a world (its maps object - a new install of the map is a new world). */
const _fields = new WeakMap();
/**
 * The world's field, made the first time it is asked (nothing read until a pixel is) and kept with its world.
 * `insideAt` the jungle's pixels (the owner's area; a test's own).
 * @param {object} maps the world's map, its key @param {number} width @param {number} height
 * @param {(x: number, y: number) => boolean} [insideAt]
 */
export function jungleFieldOf(maps, width, height, insideAt = banthaAreaHas) {
  let f = _fields.get(maps);
  if (!f) { f = jungleField({ width, height, insideAt }); _fields.set(maps, f); }
  return f;
}

/**
 * A PIXEL'S 3x3 OF DISTANCES - indexed (dz + 1) * 3 + (dx + 1), dx east and dz north (the map row py - dz), as the
 * ecotone's 3x3 of climates is - or null when the jungle is nowhere near (every one of the nine at the field's far
 * outside: no share can reach this pixel).
 * `out` the nine's array (AUDIT BANTHA1 HOST-8: a frame's own scratch; a terrain job's a new one).
 * @param {ReturnType<typeof jungleField>} field @param {number} px @param {number} py @param {any[]} [out]
 */
export function jungleNine(field, px, py, out = new Array(9)) {
  if (!field) return null;
  const far = -(field.reach + 0.5);
  let any = false;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const v = field.at(px + dx, py - dz);
      out[(dz + 1) * 3 + dx + 1] = v;
      if (v > far) any = true;
    }
  }
  return any ? out : null;
}

/**
 * THE SIGNED DISTANCE (m) at a pixel-local point (x east, z north, metres - natureStandsAt's frame): the 3x3's values
 * read bilinearly between the pixel centres about the point - positive inside the jungle.
 * @param {ArrayLike<number>} nine jungleNine's @param {number} x @param {number} z
 */
export function jungleSignedAt(nine, x, z) {
  const u = x / PIXEL_M, v = z / PIXEL_M;
  const i = u < 0.5 ? -1 : 0, j = v < 0.5 ? -1 : 0;
  const fx = u - 0.5 - i, fz = v - 0.5 - j;
  const a = nine[(j + 1) * 3 + i + 1], b = nine[(j + 1) * 3 + i + 2], c = nine[(j + 2) * 3 + i + 1], e = nine[(j + 2) * 3 + i + 2];
  return ((a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + e * fx) * fz) * PIXEL_M;
}

/**
 * HOW DEEP IN THE JUNGLE a pixel-local point stands (m, negative outside): the signed distance moved by the border's
 * wander (JUNGLE_WANDER) - continuous across every pixel edge, the same on the worker and the main thread.
 * @param {number} px @param {number} py @param {ArrayLike<number>} nine @param {number} x @param {number} z
 */
export function jungleDepthAt(px, py, nine, x, z) {
  const origin = ecoOrigin(px, py), tx = x / TILE_M, tz = z / TILE_M;
  let w = 0;
  JUNGLE_WANDER.octaves.forEach((o, k) => { w += o.amp * (2 * ecoNoise(origin, tx, tz, o.cell, JUNGLE_WANDER.salt + k) - 1); });
  return jungleSignedAt(nine, x, z) + w;
}

/** The layout's share at a depth (m): 0 past JUNGLE_EDGE.out outside the line, 1 past JUNGLE_EDGE.in inside it. */
export const jungleShare = (depth) => smoothstep(-JUNGLE_EDGE.out, JUNGLE_EDGE.in, depth);

/** BANTHA2: A POINT'S OWN DRAW against the layout's share (0..1) - an integer hash of its world place at an eighth of a
 *  metre (x east, z north; jungleHost's frame), the same on every client and at every origin: the jungle floor's plant
 *  stands where it is under the share and the meadow's grass where it is not (scenes/jungleFloorHost.js), so the two
 *  carpets trade places across the edge and never stand twice. Pure. */
export function jungleFloorDraw(wx, wz) {
  let h = (Math.imul(Math.round(wx * 8), 0x27d4eb2d) ^ Math.imul(Math.round(wz * 8), 0x165667b1) ^ 0x464c5252) >>> 0;   // 'FLRR'
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 8) / 16777216;
}

/** AUDIT PRECIP AIR-12: THE JUNGLE'S AIR leans in over a band of its own (m of depth: none this far outside the line,
 *  whole this far inside) - kilometres, where the haze's is a few hundred metres (it held the tropics' air and the
 *  mountain woods' a 19 C step apart across 1.5 km, and the sleet between them to 75 m). Over this band a Dragontail
 *  winter (the area's western foothills, the Mountain's climate) walks from snow through sleet into the jungle's rain. Inside the field's exact reach
 *  (JUNGLE_FIELD_REACH, 4.9 km) both ways; the jungle stands 32 km deep at its heart (Mournoth's, BANTHA2). */
export const JUNGLE_AIR_EDGE = Object.freeze({ out: 2000, in: 4000 });
/** The jungle's air's share at a depth (m): 0 past JUNGLE_AIR_EDGE.out outside the line, 1 past JUNGLE_AIR_EDGE.in in. */
export const jungleAirShare = (depth) => smoothstep(-JUNGLE_AIR_EDGE.out, JUNGLE_AIR_EDGE.in, depth);

/** The most the wander moves the line (m) - a pixel whose 3x3 is all farther outside than this and the layout's own
 *  reach stands no jungle at all. */
export const JUNGLE_WANDER_MAX = JUNGLE_WANDER.octaves.reduce((s, o) => s + o.amp, 0);
