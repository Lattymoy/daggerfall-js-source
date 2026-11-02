// @ts-check
// ACROSS-EDGE (FB1029, bible/03-World/Town-Shapes.md "Across the edge"; a departure from DFU's BlendLocationTerrain, which
// keeps a pixel's edge the land's own): a Bay town standing over an edge its ground cannot meet at SHAPE_GRADE raises that
// edge to where it can, and the ground about it rises to meet it at the grade - so a port's quays meet a shore, not a
// cliff. A town's meet is read off its own pixel's samples before any meet, so every pixel that asks it gets the same; each
// pixel takes the cones of the towns in its 3 x 3 before its own blend. A town under its edge moves nothing: a cut into the
// land past it has no end the next pixel can promise. Pure and worker-safe.
import { townStanding, shapeGrade } from './terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, generateSamples } from './terrainSampler.js';

/** How far a meet's cone reaches at the most, in samples, falling at SHAPE_GRADE to the ground's floor (0) - short of a
 *  whole pixel, so only the 3 x 3 about a pixel can reach it, and every cone has met the land inside it. */
export const MEET_REACH = 120;
/** The least a town must miss its edge by to raise it, metres - under it the town's own ease stands as it was. */
export const MEET_MIN_M = 0.5;
/** A pixel's sides, and the sample (x, y) the k-th of each edge is (y north). */
export const MEET_SIDES = Object.freeze(['N', 'E', 'S', 'W']);
const edgeAt = (side, k, span) =>
  side === 'N' ? [k, span] : side === 'S' ? [k, 0] : side === 'E' ? [span, k] : [0, k];

/**
 * A TOWN'S MEET on its own pixel's samples before any meet (`S` the pass's, shaped or DFU's own; `ground` DFU's own, the
 * blend's water and level): per side the edge it needs (`R`, each sample raised to the town's height less SHAPE_GRADE
 * times its distance to the town's stood samples) beside the edge it has (`E`) - null for a side that needs none, or that
 * a cone of MEET_REACH could not meet whole (raised in part, a mountain town stood a ridge in the sea and kept its cliff).
 * @param {ArrayLike<number>} S @param {Uint8Array} shape @param {ArrayLike<number>} ground @param {number} [hDim]
 * @returns {?{ target: number, edges: Record<string, ?{ R: Float32Array, E: Float32Array }> }}
 */
export function townMeetOf(S, shape, ground, hDim = HEIGHTMAP_DIMENSION) {
  const st = townStanding(S, shape, ground, hDim);
  if (!st) return null;
  const span = hDim - 1,
    g = shapeGrade(hDim),
    top = g * MEET_REACH,
    least = MEET_MIN_M / (MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE);
  /** @type {Record<string, ?{ R: Float32Array, E: Float32Array }>} */
  const edges = {};
  let any = false;
  for (const side of MEET_SIDES) {
    const E = new Float32Array(hDim),
      R = new Float32Array(hDim);
    let moved = false,
      beyond = false;
    for (let k = 0; k <= span; k++) {
      const [x, y] = edgeAt(side, k, span),
        e = S[x * hDim + y],
        want = st.target - g * st.stood[y * hDim + x];
      E[k] = e;
      R[k] = want - e > least ? Math.fround(want) : e;
      if (R[k] !== e) {
        moved = true;
        beyond ||= want > top;
      }
    }
    edges[side] = moved && !beyond ? { R, E } : null; // a side the next pixel cannot meet whole moves nothing
    any ||= moved;
  }
  return any ? { target: st.target, edges } : null;
}

/** Each raised edge sample of the towns about a pixel, in its samples (x, y) with its height: `fn(kx, ky, r)`. */
function eachRaised(px, py, meets, span, fn) {
  for (const { px: qx, py: qy, meet } of meets ?? []) {
    if (!meet || Math.abs(qx - px) > 1 || Math.abs(qy - py) > 1) continue;
    const ox = (qx - px) * span,
      oy = (py - qy) * span;
    for (const side of MEET_SIDES) {
      const edge = meet.edges[side];
      if (!edge) continue;
      for (let k = 0; k <= span; k++)
        if (edge.R[k] !== edge.E[k]) {
          const [ex, ey] = edgeAt(side, k, span);
          fn(ox + ex, oy + ey, edge.R[k]);
        }
    }
  }
}

/**
 * THE MEETS ON A PIXEL: `S` its samples before any blend (x * hDim + y, y north), mutated - each raised to the highest
 * cone a raised edge stands over it (its height less SHAPE_GRADE a sample of distance). `meets` the towns of the 3 x 3
 * ({ px, py, meet }, townMeetOf's), a town's own pixel among them. Answers how many samples it raised.
 * @param {Float32Array} S @param {number} px @param {number} py
 * @param {ReadonlyArray<{ px: number, py: number, meet: ReturnType<typeof townMeetOf> }>} meets @param {number} [hDim]
 */
export function applyTownMeets(S, px, py, meets, hDim = HEIGHTMAP_DIMENSION) {
  const span = hDim - 1,
    g = shapeGrade(hDim),
    up = new Float32Array(hDim * hDim);
  let any = false;
  eachRaised(px, py, meets, span, (kx, ky, r) => {
    const reach = r / g,
      x0 = Math.max(0, Math.ceil(kx - reach)),
      x1 = Math.min(span, Math.floor(kx + reach));
    const y0 = Math.max(0, Math.ceil(ky - reach)),
      y1 = Math.min(span, Math.floor(ky + reach));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const c = r - g * Math.sqrt((x - kx) * (x - kx) + (y - ky) * (y - ky)),
          i = x * hDim + y;
        if (c > up[i]) {
          up[i] = c;
          any = true;
        }
      }
    }
  });
  let n = 0;
  for (let i = 0; any && i < up.length; i++)
    if (up[i] > S[i]) {
      S[i] = Math.fround(up[i]);
      n++;
    }
  return n;
}

/** The meets' cone at one sample of a pixel `(x, y)`, which may lie past its edges (a ghost row): applyTownMeets' law for
 *  one point of the land `v`. */
export function meetLiftAt(px, py, meets, x, y, v, hDim = HEIGHTMAP_DIMENSION) {
  const g = shapeGrade(hDim);
  let up = v;
  eachRaised(px, py, meets, hDim - 1, (kx, ky, r) => {
    const c = r - g * Math.sqrt((x - kx) ** 2 + (y - ky) ** 2);
    if (c > up) up = c;
  });
  return Math.fround(up);
}

/** The meets read this session, by town and by the ground they were read on (the world, the network, the tables). */
const _meets = new Map();
const MEETS_KEPT = 64;
/** A town's outline's key: its pixel and its bytes' hash (FNV-1a). @param {number} qx @param {number} qy @param {Uint8Array} shape */
const shapeKey = (qx, qy, shape) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < shape.length; i++) if (shape[i]) h = Math.imul(h ^ (i * 31 + shape[i]), 0x01000193) >>> 0;
  return `${qx},${qy}|${h.toString(36)}`;
};

/** Whether a kept meet was read on the ground asked: the same world and, on the shaped ground, the same landforms' inputs. */
const sameGround = (had, woods, lf) =>
  had.woods === woods &&
  (!lf ||
    (had.lf && ['woods', 'roads', 'sites', 'beyond', 'climates', 'hills', 'ranges'].every((k) => had.lf[k] === lf[k])));

/**
 * THE MEETS ABOUT A PIXEL: `about` the Bay towns of its 3 x 3 ([{ px, py, shape }], its own included -
 * scenes/townMeetsHost.js), each town's meet on its own pixel's samples before any meet: DFU's own (`plain`) and, with
 * `landforms`, the shaped ground's (`shaped`). `own` this pixel's own samples ({ samples, classic }, before any meet)
 * spare its own kernel pass. A meet is kept while the ground it was read on stands.
 * @returns {Array<{ px: number, py: number, plain: ReturnType<typeof townMeetOf>, shaped: ReturnType<typeof townMeetOf> }>}
 */
export function townMeetsAbout(about, { woods, landforms = null, px, py, own = null, hDim = HEIGHTMAP_DIMENSION }) {
  const out = [],
    lf = landforms?.inputs ?? null;
  for (const q of about ?? []) {
    if (!q?.shape || Math.abs(q.px - px) > 1 || Math.abs(q.py - py) > 1) continue;
    const key = `${shapeKey(q.px, q.py, q.shape)}|${landforms ? 1 : 0}`,
      had = _meets.get(key);
    if (had && sameGround(had, woods, landforms ? lf : null)) {
      out.push(had.m);
      continue;
    }
    let S = null,
      C = null;
    if (q.px === px && q.py === py && own) {
      S = own.samples;
      C = own.classic ?? own.samples;
    } else if (landforms) {
      C = new Float32Array(hDim * hDim);
      S = generateSamples(woods, q.px, q.py, hDim, landforms, C);
    } else {
      S = generateSamples(woods, q.px, q.py, hDim);
      C = S;
    }
    const m = {
      px: q.px,
      py: q.py,
      plain: townMeetOf(C, q.shape, C, hDim),
      shaped: landforms ? townMeetOf(S, q.shape, C, hDim) : null,
    };
    _meets.delete(key);
    _meets.set(key, { woods, lf, m });
    while (_meets.size > MEETS_KEPT) _meets.delete(_meets.keys().next().value);
    out.push(m);
  }
  return out;
}
