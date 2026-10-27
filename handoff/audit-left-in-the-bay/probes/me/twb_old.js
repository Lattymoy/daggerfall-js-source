// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL-DEEP (2026-10-26, the owner: "Overhaul coastlines to properly have sand/dirt and arc into the deep, with the
// ability to slightly see through water and actually see the depth"; bible/03-World/Deep-Waters.md TAMRIEL-DEEP) - THE
// CONTINENT'S SEA, CARVED BY THE BAY'S OWN LAW. Iliac Puddle No More carves the Bay's sea against a distance bake of its
// map (deepWater/deepWatersBake.js), and ETHER-DEEP gave the Eltheric Ocean's box a bake of its own
// (etherWatersBake.js); the sea past the Bay's edge - the continent's coasts, the Niben, Lake Rumare - was the kernel's
// own water tiles over a bed a few metres down (TAMRIEL2: "Deep Waters' bathymetry is the Bay's"). This is the same bake
// over the continent's FRAME (world/tamriel/tamrielFrame.js tamrielFrameInBay, on the fit it was made on): the same
// planes, built by the same rules from the same composed ground (world/tamriel/tamrielGround.js groundWoods), so its
// floor shelves from every beach into the deep as the Bay's does (deepBathymetry.js: the Ocean's 210 m off its coasts,
// under the player's Water Depth) and the clear water above it shows it.
//
// WHAT DIFFERS is only how the open sea is found. The Bay floods its water from its map's border, once, at boot; the
// Eltheric floods an isle's cell from the cell's ring, which is all sea. The continent's sea is neither: its water is
// whatever the trace says it is, so the flood runs a CELL at a time (TAMRIEL_CELL_PX square, with TAMRIEL_APRON_PX round
// it so a channel that leaves the cell and comes back is followed), seeded from every pixel of it that is the picture's
// own open sea (the trace's water its border joins - tamrielLand.js pictureLakes leaves the lakes out) and the bound
// calls all sea; on the Bay's own pixels the Bay's bake seeds (its flood's fully reached pixels). A lake the picture
// draws (Hammerfell's two) is never seeded and stays the kernel's, as the Bay's lakes do.
//
// Pure and worker-safe (formats/ and world/ alone): the Deep Waters worker and this thread build the same planes from the
// same trace and fit, and a pixel the worker built hands its 3 x 3's sea bits and classes back (adoptPlanes).
// ═══════════════════════════════════════════════════════════════════
import { DeepWatersBake, floodSteps, classifyPixel, coarseCandidateBits, fineMaskBits, pixelWaterSampler, PIXEL_MIXED, PIXEL_SEA, PIXEL_LAND, inFrame, WATER_THRESHOLD } from './deepWater/deepWatersBake.js';
import { tamrielTrace, pictureLakes } from './tamriel/tamrielLand.js';
import { tamrielFrameInBay, bayToPicture, inBay } from './tamriel/tamrielFrame.js';
import { generateSamples, HEIGHTMAP_DIMENSION } from './terrain/terrainSampler.js';
import { blendLocationTerrain } from './terrain/terrainTiles.js';
import { CAPITAL_LAND, capitalSeaGround } from './terrain/capitalSea.js';   // RUMARE-WATER: the city's ground, as the streamed build lays it
import { CAPITAL_RIM_TILES } from './capitalPlans.js';
import { rumareSlice, rumareSeaPixel, rumareSliceRect } from './rumareWaters.js';

/** An exported row's frame: the composed bakes route it here by it. */
export const TAMRIEL_ROW = 'tamriel';
/** The flood's cell (Bay pixels a side) and the apron round it the flood also walks. */
export const TAMRIEL_CELL_PX = 32;
export const TAMRIEL_APRON_PX = 16;

const ALL8 = new Uint8Array(8).fill(0xff);
const NONE8 = new Uint8Array(8);

/** The continent's frame on the live fit, whole pixels: its box (tamrielFrameInBay) floored and grown to whole pixels. */
export function tamrielWaterFrame() {
  const f = tamrielFrameInBay(), x0 = Math.floor(f.x0), y0 = Math.floor(f.y0);
  return Object.freeze({ x0, y0, w: Math.ceil(f.x0 + f.w) - x0, h: Math.ceil(f.y0 + f.h) - y0 });
}

/** Is a Bay pixel past the Bay the picture's open sea - its centre's picture pixel off the trace's land and no lake's -
 *  on the installed trace (none: false). */
export function pictureOpenSeaAt(px, py) {
  const trace = tamrielTrace();
  if (!trace || inBay(px, py)) return false;
  const [qx, qy] = bayToPicture(px + 0.5, py + 0.5), x = Math.floor(qx), y = Math.floor(qy);
  if (x < 0 || y < 0 || x >= trace.w || y >= trace.h) return true;   // off the picture: the sea's (pictureSea's own reading)
  const i = y * trace.w + x;
  return !trace.land[i] && !pictureLakes(trace)[i];
}

/**
 * RUMARE-WATER (bible/03-World/Tamriel.md RUMARE-WATER): THE IMPERIAL CITY'S WATER TO THE BAKE - a pixel of its span read as
 * the streamed build lays it (world/terrain/terrainGen.js: flattened to a capital at the sea's land, its water let down to
 * the sea by world/terrain/capitalSea.js capitalSeaGround - the plan's law alone, no tile laid here), so its lake and its
 * mouth are the bake's water as they are the ground's; every other pixel the plain sampler's.
 */
export function rumareWaterSampler(woods, px, py) {
  const rect = rumareSliceRect(px, py, CAPITAL_RIM_TILES);
  if (!rect) return pixelWaterSampler(woods, px, py, null);
  const S = generateSamples(woods, px, py), natural = Float32Array.from(S);
  blendLocationTerrain(S, CAPITAL_LAND, rect);
  capitalSeaGround(S, natural, null, rect, px, py);
  const water = (x, y) => S[x * HEIGHTMAP_DIMENSION + y] <= WATER_THRESHOLD;
  return { water, quick: (x, y) => (water(x, y) ? 1 : 0), exact: water };
}

/** The Deep Waters bake of the continent's frame - DeepWatersBake's queries, its planes built as they are asked. */
export class TamrielWatersBake extends DeepWatersBake {
  /**
   * @param {object} deps
   * @param {object} deps.woods - the composed ground (world/tamriel/tamrielGround.js groundWoods over the world's reader)
   * @param {{ x0: number, y0: number, w: number, h: number }} [deps.frame] - its pixels (tamrielWaterFrame on the live fit)
   * @param {?{ seaBits: (px: number, py: number) => ?Uint8Array, fullBits?: (px: number, py: number) => ?Uint8Array }} [deps.bay] -
   *   the Bay's bake, whose open sea seeds the flood on the Bay's own pixels and answers its planes there
   */
  constructor({ woods, frame = tamrielWaterFrame(), bay = null }) {
    super({ woods, global: null, frame, fineAt: (px, py) => fineMaskBits(rumareWaterSampler(woods, px, py)) });   // RUMARE-WATER: the city's fine water its ground's
    this.bay = bay;
    /** @type {Map<number, number>} */
    this._cls = new Map();
    /** @type {Map<number, Uint8Array>} */
    this._sea = new Map();
  }

  /** The Bay's own pixels are the Bay's bake's: this one answers the rest of its frame. */
  inFrame(px, py) { return inFrame(this.frame, px, py) && !inBay(px, py); }

  _class(i, px, py) {
    let c = this._cls.get(i);
    if (c === undefined) { c = rumareSlice(px, py) ? PIXEL_MIXED : classifyPixel(this.woods, px, py); this._cls.set(i, c); }   // RUMARE-WATER: the city's span asked whole
    return c;
  }

  _caches() { return [this._fine, this._full, this._dist, this._edge, this._sea, this._cls]; }

  /** Whether this thread holds the sea bits the dry check reads - the pixel's and its cardinal neighbours' in the frame -
   *  without a flood (etherWatersBake.js's own law). */
  holdsSea(px, py) {
    for (const [x, y] of [[px, py], [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) if (this.inFrame(x, y) && !this._sea.has(this._index(x, y))) return false;
    return true;
  }

  /** The sea bits of a pixel: its cell's flood's (8 bytes); on the Bay's own map the Bay's bake's (a distance plane at
   *  the seam reads the Bay's sea across it); null outside the frame. */
  seaBits(px, py) {
    if (inBay(px, py)) return this.bay?.seaBits(px, py) ?? null;
    if (!this.inFrame(px, py)) return null;
    const i = this._index(px, py);
    return this._sea.get(i) ?? this._floodCell(px, py, i);
  }

  /** The all-fine-water bits: the Bay's bake's on its map, as the sea's. */
  fullBits(px, py) { return inBay(px, py) ? (this.bay?.fullBits?.(px, py) ?? null) : super.fullBits(px, py); }

  /** THE FLOOD of the cell holding (px, py) and its apron, seeded from its open sea; the cell's pixels kept. Answers
   *  (px, py)'s. */
  _floodCell(px, py, want) {
    const { x0: fx, y0: fy } = this.frame, C = TAMRIEL_CELL_PX, A = TAMRIEL_APRON_PX;
    const cx0 = fx + Math.floor((px - fx) / C) * C, cy0 = fy + Math.floor((py - fy) / C) * C;
    const x0 = cx0 - A, y0 = cy0 - A, n = C + 2 * A;
    const cls = (x, y) => (this.inFrame(x, y) ? this._class(this._index(x, y), x, y) : classifyPixel(this.woods, x, y));   // past the frame or on the Bay: asked, never kept by another pixel's slot
    const seed = (x, y) => {
      const X = x0 + x, Y = y0 + y;
      if (inBay(X, Y)) { const b = this.bay?.seaBits(X, Y); return !!b && b.every((v) => v === 0xff); }
      return (pictureOpenSeaAt(X, Y) && cls(X, Y) === PIXEL_SEA) || rumareSeaPixel(X, Y);   // RUMARE-WATER: the city's lake the sea's, through its mouth and the canal
    };
    const steps = floodSteps(n, n, (x, y) => cls(x0 + x, y0 + y),
      (x, y) => coarseCandidateBits(rumareWaterSampler(this.woods, x0 + x, y0 + y)), seed);
    let r = steps.next();
    while (!r.done) r = steps.next();
    const { state, partialIndex, partialBits } = /** @type {any} */ (r.value);
    const partial = new Map();
    for (let k = 0; k < partialIndex.length; k++) partial.set(partialIndex[k], partialBits.slice(k * 8, k * 8 + 8));
    let out = NONE8;
    for (let y = A; y < A + C; y++) {
      for (let x = A; x < A + C; x++) {
        const X = x0 + x, Y = y0 + y;
        if (!this.inFrame(X, Y)) continue;
        const k = y * n + x, s = state[k], i = this._index(X, Y);
        const bits = s === 1 ? ALL8 : s === 2 ? partial.get(k) : NONE8;
        this._sea.set(i, bits);
        if (i === want) out = bits;
      }
    }
    return out;
  }

  /** A row carries its pixel's sea bits and class too: this thread's queries flood nothing the worker flooded. */
  _row(i, row) {
    const sea = this._sea.get(i), cls = this._cls.get(i);
    return { ...row, f: TAMRIEL_ROW, sea: sea ? sea.slice() : null, cls: cls ?? null };
  }

  prepare(px, py) {
    this._keep(px, py);
    super.prepare(px, py);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.inFrame(px + dx, py + dy)) this.seaBits(px + dx, py + dy);
  }

  adoptPlanes(rows) {
    for (const r of rows ?? []) {
      if (!Number.isInteger(r?.i) || r.i < 0 || r.i >= this.frame.w * this.frame.h) continue;
      if (r.sea && r.sea.length === 8 && !this._sea.has(r.i)) this._sea.set(r.i, r.sea);
      if ((r.cls === PIXEL_LAND || r.cls === PIXEL_SEA || r.cls === PIXEL_MIXED) && !this._cls.has(r.i)) this._cls.set(r.i, r.cls);
    }
    super.adoptPlanes(rows);
  }
}
