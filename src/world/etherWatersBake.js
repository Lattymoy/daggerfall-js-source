// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ETHER-DEEP (2026-10-12, the owner: "the area below water is very shallow and has no depth"; bible/03-World/
// Eltheric-Ocean.md ETHER-DEEP) - THE ELTHERIC OCEAN'S COASTLINE, BAKED BY THE BAY'S OWN LAW. Iliac Puddle No More
// carves its sea against a distance bake of the map (deepWatersBake.js), and its map was the Bay's 1000 x 500: past the
// Veil nothing was carved, so the sea's floor was the kernel's clamp at OceanElevation - the drawn water over ground a
// stride under it - and every query the swim asked of an Eltheric pixel read the Bay's clamped corner (ETHER-HOLD held
// the carve off it, and the water stayed a puddle). This is the same bake over the Eltheric's own FRAME (its box): the
// same planes, built by the same rules from the same composed ground (world/ethericSea.js etherWoods), so its floor, its
// cap, its surface and its swim agree as the Bay's do - and its open water is the Ocean's plain (deepBathymetry.js:
// the Ocean's 210 m off its coasts, under the player's Water Depth).
//
// WHAT DIFFERS is only how much of it is built, and when. The Bay's classes and its flood are one global record built
// at boot; the Eltheric's box is forty million pixels, so each is asked when first read and kept (bounded: deepWatersBake.js
// PLANE_KEEP_MAX a plane, the farthest let go past PLANE_KEEP_RADIUS - the Bay's planes' law too):
//   CLASSES   - the bound's (classifyPixel), over the composed ground.
//   THE FLOOD - an isle's CELL at a time (ISLE_CELL_PX square, world/ethericSea.js), from its own border: every cell's
//               outer ring of pixels is open sea by the bound - an isle's land bytes lie a pixel and more inside its
//               cell, and the kernel's window carries none of them to the ring (measured over every cell of three of
//               the box's rows, test/world/deepWater/ether_deep.test.js) - so the rings are one sea that reaches the box's edge, any
//               water in a cell that reaches the open sea reaches its ring, and the cell's flood IS the box's.
//   RECTS     - an isle's place (world/etherPlaces.js: a port's town, a ruin's dungeon) blends its pixel's ground as a
//               classic location's (the streamed build's own order), so its pixel is sampled with its template's rect -
//               the rects the host reads off the templates once (`etherPlaceRects`), picked by the place's own law
//               (etherTemplateOf: the same template every client clones).
// Pure and worker-safe (formats/ and world/ alone): the Deep Waters worker and this thread build the same planes, and
// a pixel the worker built hands its 3 x 3's back with its geometry (exportPlanes, `sea` and `cls` beside the planes)
// so this thread's queries never flood a cell twice.
// ═══════════════════════════════════════════════════════════════════
import {
  DeepWatersBake, BAY_FRAME, inFrame, floodSteps, classifyPixel, coarseCandidateBits, pixelWaterSampler, PIXEL_MIXED, PIXEL_SEA, PIXEL_LAND,
} from './deepWater/deepWatersBake.js';
import { ETHER_BOX, ISLE_CELL_PX, etherCellOf, etherFrame, isleAt } from './ethericSea.js';
import { etherTemplateOf } from './etherPlaces.js';

/** The Eltheric Ocean's frame: its box, as the stream holds it (world/ethericSea.js etherFrame). */
export const ETHER_FRAME = Object.freeze(etherFrame());
/** An exported row's frame: the composed bakes route it here by it. */
export const ETHER_ROW = 'ether';

const ALL8 = new Uint8Array(8).fill(0xff);
const NONE8 = new Uint8Array(8);

/**
 * THE PLACES' RECTS off their templates: `{ towns, havens, ruins }`, each the template list's (world/etherPlaces.js
 * etherTemplates) rect by rect - `rectOf(template)` SetLocationTiles' answer, `[xMin, xMax, yMin, yMax]`.
 * @param {{ towns?: any[], havens?: any[], ruins?: any[] } | null} templates
 * @param {(template: any) => { xMin: number, xMax: number, yMin: number, yMax: number }} rectOf
 */
export function etherPlaceRects(templates, rectOf) {
  const rows = (list) => (list ?? []).map((t) => { const r = rectOf(t); return [r.xMin, r.xMax, r.yMin, r.yMax]; });
  return { towns: rows(templates?.towns), havens: rows(templates?.havens), ruins: rows(templates?.ruins) };
}

/**
 * The rect a pixel's place blends, or null: an isle's centre pixel whose kind stands a place, its rect the one its
 * template's own pick names (etherTemplateOf over the rects, list for list).
 * @param {{ towns: number[][], havens: number[][], ruins: number[][] } | null} rects
 */
export function etherRectAt(rects) {
  return (px, py) => {
    const isle = rects ? isleAt(px, py) : null;
    if (!isle || isle.px !== px || isle.py !== py) return null;
    const r = etherTemplateOf(rects, isle);
    return r ? { xMin: r[0], xMax: r[1], yMin: r[2], yMax: r[3] } : null;
  };
}

/** The Deep Waters bake of the Eltheric Ocean's box - DeepWatersBake's queries, its planes built as they are asked. */
export class EtherWatersBake extends DeepWatersBake {
  /**
   * @param {object} deps
   * @param {object} deps.woods - the composed ground (world/ethericSea.js etherWoods over the world's reader)
   * @param {{ towns: number[][], havens: number[][], ruins: number[][] } | null} [deps.rects] - etherPlaceRects'
   */
  constructor({ woods, rects = null }) {
    super({ woods, global: null, frame: ETHER_FRAME, locationRectAt: etherRectAt(rects) });
    /** @type {Map<number, number>} */
    this._cls = new Map();
    /** @type {Map<number, Uint8Array>} */
    this._sea = new Map();
  }

  _class(i, px, py) {
    let c = this._cls.get(i);
    if (c === undefined) { c = classifyPixel(this.woods, px, py); this._cls.set(i, c); }
    return c;
  }

  _caches() { return [this._fine, this._full, this._dist, this._edge, this._sea, this._cls]; }

  /** AUDIT ETHER-OW C1-3: whether this thread holds the sea bits the dry check reads - the pixel's and its cardinal
   *  neighbours' in the box - without a flood: those the worker sent (adoptPlanes) or this thread already flooded. */
  holdsSea(px, py) {
    for (const [x, y] of [[px, py], [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) if (this.inFrame(x, y) && !this._sea.has(this._index(x, y))) return false;
    return true;
  }

  /** The sea bits of a pixel: its cell's flood's (8 bytes), null outside the box. */
  seaBits(px, py) {
    if (!this.inFrame(px, py)) return null;
    const i = this._index(px, py);
    return this._sea.get(i) ?? this._floodCell(px, py, i);
  }

  /** THE FLOOD of the cell holding (px, py), from its border; every pixel of it kept. Answers (px, py)'s. */
  _floodCell(px, py, want) {
    const [cx, cy] = etherCellOf(px, py);
    const x0 = ETHER_BOX.x0 + cx * ISLE_CELL_PX, y0 = ETHER_BOX.y0 + cy * ISLE_CELL_PX;
    const w = Math.min(ISLE_CELL_PX, ETHER_BOX.x1 - x0), h = Math.min(ISLE_CELL_PX, ETHER_BOX.y1 - y0);   // the box's east cells are cut short
    const steps = floodSteps(w, h, (x, y) => this._class(this._index(x0 + x, y0 + y), x0 + x, y0 + y),
      (x, y) => coarseCandidateBits(pixelWaterSampler(this.woods, x0 + x, y0 + y, this.locationRectAt(x0 + x, y0 + y))));
    let r = steps.next();
    while (!r.done) r = steps.next();
    const { state, partialIndex, partialBits } = /** @type {any} */ (r.value);
    const partial = new Map();
    for (let k = 0; k < partialIndex.length; k++) partial.set(partialIndex[k], partialBits.slice(k * 8, k * 8 + 8));
    let out = NONE8;
    for (let k = 0; k < w * h; k++) {
      const s = state[k], i = this._index(x0 + (k % w), y0 + Math.floor(k / w));
      const bits = s === 1 ? ALL8 : s === 2 ? partial.get(k) : NONE8;
      this._sea.set(i, bits);
      if (i === want) out = bits;
    }
    return out;
  }

  /** A row carries its pixel's sea bits and class too: this thread's queries flood nothing the worker flooded. */
  _row(i, row) {
    const sea = this._sea.get(i), cls = this._cls.get(i);
    return { ...row, f: ETHER_ROW, sea: sea ? sea.slice() : null, cls: cls ?? null };
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
    super.adoptPlanes(rows);   // the base keeps every cache bounded about the last row's pixel (its _keep reads this bake's six)
  }
}

/**
 * THE BAKES A WORLD CARVES BY: the Bay's, and with the Eltheric Ocean standing (ETHER-DEEP), its own beside it - every
 * query answered by the bake whose frame holds its pixel (a pixel in neither the Bay's, which answers as the mod does
 * off its map). The frames lie thousands of pixels apart: no query's window reaches from one into the other.
 */
export class DeepWatersBakes {
  /** @param {DeepWatersBake} bay @param {EtherWatersBake} ether */
  constructor(bay, ether) {
    this.bay = bay;
    this.ether = ether;
    this.loaded = true;
    this.hasFineWaterMask = true;
  }
  /** @returns {DeepWatersBake} - AUDIT ETHER-OW C1-5: the bake whose frame answers the pixel, by the one law of it
   *  (waterFrameOf, the host's own) */
  of(px, py) { return waterFrameOf(px, py, true) === ETHER_FRAME ? this.ether : this.bay; }
  frameOf(px, py) { return waterFrameOf(px, py, true); }
  holdsSea(px, py) { return this.of(px, py).holdsSea(px, py); }
  sampleDistanceMeters(x, y, fx, fz) { return this.of(x, y).sampleDistanceMeters(x, y, fx, fz); }
  sampleEdgeDistanceMeters(x, y, fx, fz) { return this.of(x, y).sampleEdgeDistanceMeters(x, y, fx, fz); }
  sampleLocalEdgeDistanceMeters(x, y, fx, fz) { return this.of(x, y).sampleLocalEdgeDistanceMeters(x, y, fx, fz); }
  isWaterAt(x, y, fx, fz) { return this.of(x, y).isWaterAt(x, y, fx, fz); }
  isCarvedWater(x, y, fx, fz) { return this.of(x, y).isCarvedWater(x, y, fx, fz); }
  mapPixelHasFineWaterCells(x, y) { return this.of(x, y).mapPixelHasFineWaterCells(x, y); }
  mapPixelHasWaterCells(x, y) { return this.of(x, y).mapPixelHasWaterCells(x, y); }
  mapPixelOrCardinalNeighborHasWaterCells(x, y) { return this.of(x, y).mapPixelOrCardinalNeighborHasWaterCells(x, y); }
  mapPixelHasLandCells(x, y) { return this.of(x, y).mapPixelHasLandCells(x, y); }
  prepare(px, py) { this.of(px, py).prepare(px, py); }
  exportPlanes(px, py) { return this.of(px, py).exportPlanes(px, py); }
  adoptPlanes(rows) {
    const list = rows ?? [];
    this.bay.adoptPlanes(list.filter((r) => r?.f !== ETHER_ROW));
    this.ether.adoptPlanes(list.filter((r) => r?.f === ETHER_ROW));
  }
  evictOutside(px, py, radius) { this.bay.evictOutside(px, py, radius); this.ether.evictOutside(px, py, radius); }
}

/**
 * The world's bakes: the Bay's alone, or with the Eltheric's beside it (`ether` its rects, or true for none known).
 * @param {any} bay
 * @param {{ woods?: any, ether?: any }} [opts]
 */
export function worldBakes(bay, { woods = null, ether = null } = {}) {
  if (!bay || !ether) return bay;
  return new DeepWatersBakes(bay, new EtherWatersBake({ woods, rects: ether === true ? null : ether }));
}

/** A pixel's frame for a world with the Eltheric standing or not: the Eltheric's in its box, the Bay's else (the mod's
 *  own clamps, off its map). Pure - the host asks it before the bake is in. */
export const waterFrameOf = (px, py, ether) => (ether && inFrame(ETHER_FRAME, px, py) ? ETHER_FRAME : BAY_FRAME);
