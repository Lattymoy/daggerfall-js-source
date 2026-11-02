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
//               (etherTemplateOf: the same template every client clones) - and AUDIT TESA III E1-4: with the ISLE'S OWN
//               OUTLINE (TOWN-SHAPES TS2), drawn off the template's outline basis under the isle's own map id
//               (etherPlaceId), its rect cut under it, as the clone's streamed build draws them. The bake had blended the
//               template's rect DFU's way.
// Pure and worker-safe (formats/ and world/ alone): the Deep Waters worker and this thread build the same planes, and
// a pixel the worker built hands its 3 x 3's back with its geometry (exportPlanes, `sea` and `cls` beside the planes)
// so this thread's queries never flood a cell twice.
// ═══════════════════════════════════════════════════════════════════
import {
  DeepWatersBake,
  BAY_FRAME,
  inFrame,
  floodSteps,
  classifyPixel,
  coarseCandidateBits,
  pixelWaterSampler,
  PIXEL_MIXED,
  PIXEL_SEA,
  PIXEL_LAND,
} from './deepWater/deepWatersBake.js';
import { ETHER_BOX, ISLE_CELL_PX, etherCellOf, etherFrame, isleAt } from './ethericSea.js';
import { etherTemplateOf, etherPlaceId } from './etherPlaces.js';
import { outlineOfBasis, rectOfBasis } from './terrain/terrainTiles.js'; // AUDIT TESA III E1-4: an isle's outline off its template's basis
import { TAMRIEL_ROW } from './tamrielWatersBake.js'; // TAMRIEL-DEEP: the continent's rows routed to its bake

/** The Eltheric Ocean's frame: its box, as the stream holds it (world/ethericSea.js etherFrame). */
export const ETHER_FRAME = Object.freeze(etherFrame());
/** An exported row's frame: the composed bakes route it here by it. */
export const ETHER_ROW = 'ether';

const ALL8 = new Uint8Array(8).fill(0xff);
const NONE8 = new Uint8Array(8);

/**
 * THE PLACES' RECTS off their templates: `{ towns, havens, ruins, bases }`, each the template list's (world/etherPlaces.js
 * etherTemplates) rect by rect - `rectOf(template)` SetLocationTiles' answer, `[xMin, xMax, yMin, yMax, basis]` - and AUDIT
 * TESA III E1-4: `basis` the index in `bases` of its outline's basis (terrainTiles.js locationOutlineBasis, riding on the
 * rect's `shape`), -1 for none; `bases` each distinct basis once (the templates name 384 blocks between them), its tiles a
 * bit apiece - the isles' bake draws each isle's outline off it (etherRectAt).
 * @param {{ towns?: any[], havens?: any[], ruins?: any[] } | null} templates
 * @param {(template: any) => { xMin: number, xMax: number, yMin: number, yMax: number, shape?: any }} rectOf
 */
export function etherPlaceRects(templates, rectOf) {
  const bases = [],
    seen = new Map();
  const pack = (a) => {
    const bits = new Uint8Array((a.length + 7) >> 3);
    for (let i = 0; i < a.length; i++) if (a[i]) bits[i >> 3] |= 1 << (i & 7);
    return bits;
  };
  const basisIndex = (b) => {
    if (!b) return -1;
    const bits = pack(b.padded),
      stamp = pack(b.stamp),
      fields = b.fields ? pack(b.fields) : null; // FB1028: and its crops' tiles
    const key = `${b.PW},${b.PH},${b.walled ? 1 : 0},${b.x0},${b.y0},${b.clear}:${bits.join(',')}:${stamp.join(',')}:${fields?.join(',') ?? ''}`;
    let k = seen.get(key);
    if (k === undefined) {
      seen.set(key, (k = bases.length));
      bases.push({ PW: b.PW, PH: b.PH, walled: b.walled, x0: b.x0, y0: b.y0, clear: b.clear, bits, stamp, fields });
    }
    return k;
  };
  const rows = (list) =>
    (list ?? []).map((t) => {
      const r = rectOf(t);
      return [r.xMin, r.xMax, r.yMin, r.yMax, basisIndex(r.shape?.basis ?? null)];
    });
  return { towns: rows(templates?.towns), havens: rows(templates?.havens), ruins: rows(templates?.ruins), bases };
}

/** AUDIT TESA III E1-4: an isle's rect and outline, drawn off its template's packed basis under the isle's own map id - the
 *  clone's (etherPlaces.js synthesizeEtherLocation stands it under etherPlaceId; setLocationTiles cuts its rect under it,
 *  terrainTiles.js rectOfBasis) - kept for the last ISLE_SHAPES_KEPT isles. */
const ISLE_SHAPES_KEPT = 64;
/** @type {Map<string, any>} */
const _isleRects = new Map();
function isleRect(basis, isle) {
  const k = `${isle.key}|${basis.PW},${basis.PH},${basis.x0},${basis.y0}`;
  let r = _isleRects.get(k);
  if (r) return r;
  const unpack = (bits) => {
    const a = new Uint8Array(basis.PW * basis.PH);
    for (let i = 0; i < a.length; i++) a[i] = (bits[i >> 3] >> (i & 7)) & 1;
    return a;
  };
  const b = {
    padded: unpack(basis.bits),
    stamp: unpack(basis.stamp),
    fields: basis.fields ? unpack(basis.fields) : null,
    PW: basis.PW,
    PH: basis.PH,
    walled: basis.walled,
    x0: basis.x0,
    y0: basis.y0,
    clear: basis.clear,
  };
  r = rectOfBasis(b, outlineOfBasis(b, etherPlaceId(isle)));
  if (_isleRects.size >= ISLE_SHAPES_KEPT) _isleRects.delete(/** @type {string} */ (_isleRects.keys().next().value));
  _isleRects.set(k, r);
  return r;
}

/**
 * The rect a pixel's place blends, or null: an isle's centre pixel whose kind stands a place, its rect the one its
 * template's own pick names (etherTemplateOf over the rects, list for list) - AUDIT TESA III E1-4: with the isle's own
 * outline (`shape`) where its template has one, so the bake's blend (deepWatersBake.js pixelWaterSampler) is the clone's
 * streamed build's.
 * @param {{ towns: number[][], havens: number[][], ruins: number[][], bases?: any[] } | null} rects
 */
export function etherRectAt(rects) {
  return (px, py) => {
    const isle = rects ? isleAt(px, py) : null;
    if (!isle || isle.px !== px || isle.py !== py) return null;
    const r = etherTemplateOf(rects, isle);
    if (!r) return null;
    const basis = r[4] >= 0 ? rects?.bases?.[r[4]] : null;
    return basis ? isleRect(basis, isle) : { xMin: r[0], xMax: r[1], yMin: r[2], yMax: r[3] };
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
    if (c === undefined) {
      c = classifyPixel(this.woods, px, py);
      this._cls.set(i, c);
    }
    return c;
  }

  _caches() {
    return [this._fine, this._full, this._dist, this._edge, this._sea, this._cls];
  }

  /** AUDIT ETHER-OW C1-3: whether this thread holds the sea bits the dry check reads - the pixel's and its cardinal
   *  neighbours' in the box - without a flood: those the worker sent (adoptPlanes) or this thread already flooded. */
  holdsSea(px, py) {
    for (const [x, y] of [
      [px, py],
      [px - 1, py],
      [px + 1, py],
      [px, py - 1],
      [px, py + 1],
    ])
      if (this.inFrame(x, y) && !this._sea.has(this._index(x, y))) return false;
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
    const x0 = ETHER_BOX.x0 + cx * ISLE_CELL_PX,
      y0 = ETHER_BOX.y0 + cy * ISLE_CELL_PX;
    const w = Math.min(ISLE_CELL_PX, ETHER_BOX.x1 - x0),
      h = Math.min(ISLE_CELL_PX, ETHER_BOX.y1 - y0); // the box's east cells are cut short
    const steps = floodSteps(
      w,
      h,
      (x, y) => this._class(this._index(x0 + x, y0 + y), x0 + x, y0 + y),
      (x, y) => coarseCandidateBits(pixelWaterSampler(this.woods, x0 + x, y0 + y, this.locationRectAt(x0 + x, y0 + y))),
    );
    let r = steps.next();
    while (!r.done) r = steps.next();
    const { state, partialIndex, partialBits } = /** @type {any} */ (r.value);
    const partial = new Map();
    for (let k = 0; k < partialIndex.length; k++) partial.set(partialIndex[k], partialBits.slice(k * 8, k * 8 + 8));
    let out = NONE8;
    for (let k = 0; k < w * h; k++) {
      const s = state[k],
        i = this._index(x0 + (k % w), y0 + Math.floor(k / w));
      const bits = s === 1 ? ALL8 : s === 2 ? partial.get(k) : NONE8;
      this._sea.set(i, bits);
      if (i === want) out = bits;
    }
    return out;
  }

  /** A row carries its pixel's sea bits and class too: this thread's queries flood nothing the worker flooded. */
  _row(i, row) {
    const sea = this._sea.get(i),
      cls = this._cls.get(i);
    return { ...row, f: ETHER_ROW, sea: sea ? sea.slice() : null, cls: cls ?? null };
  }

  prepare(px, py) {
    this._keep(px, py);
    super.prepare(px, py);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (this.inFrame(px + dx, py + dy)) this.seaBits(px + dx, py + dy);
  }

  adoptPlanes(rows) {
    for (const r of rows ?? []) {
      if (!Number.isInteger(r?.i) || r.i < 0 || r.i >= this.frame.w * this.frame.h) continue;
      if (r.sea && r.sea.length === 8 && !this._sea.has(r.i)) this._sea.set(r.i, r.sea);
      if ((r.cls === PIXEL_LAND || r.cls === PIXEL_SEA || r.cls === PIXEL_MIXED) && !this._cls.has(r.i))
        this._cls.set(r.i, r.cls);
    }
    super.adoptPlanes(rows); // the base keeps every cache bounded about the last row's pixel (its _keep reads this bake's six)
  }
}

/**
 * THE BAKES A WORLD CARVES BY: the Bay's, and with the Eltheric Ocean standing (ETHER-DEEP), its own beside it, and with
 * the land past the Bay standing (TAMRIEL-DEEP, world/tamrielWatersBake.js), the continent's, set when its trace lands -
 * every query answered by the bake whose frame holds its pixel (a pixel in none the Bay's, which answers as the mod does
 * off its map). The Eltheric's box lies thousands of pixels from the others; the continent's frame holds the Bay's map,
 * whose pixels stay the Bay's bake's (its seam reads the Bay's sea from the Bay's bake).
 */
export class DeepWatersBakes {
  /** @param {DeepWatersBake} bay @param {?EtherWatersBake} ether @param {?DeepWatersBake} [tamriel] */
  constructor(bay, ether, tamriel = null) {
    this.bay = bay;
    this.ether = ether;
    this.tamriel = tamriel;
    this.loaded = true;
    this.hasFineWaterMask = true;
  }
  /** TAMRIEL-DEEP: the continent's bake, set when the trace lands (or null: none again). @param {?DeepWatersBake} bake */
  setTamriel(bake) {
    this.tamriel = bake;
  }
  /** @returns {DeepWatersBake} - AUDIT ETHER-OW C1-5: the bake whose frame answers the pixel, by the one law of it
   *  (waterFrameOf, the host's own) */
  of(px, py) {
    const f = waterFrameOf(px, py, !!this.ether, this.tamriel?.frame ?? null);
    return f === ETHER_FRAME
      ? /** @type {DeepWatersBake} */ (this.ether)
      : f === BAY_FRAME
        ? this.bay
        : /** @type {DeepWatersBake} */ (this.tamriel);
  }
  frameOf(px, py) {
    return this.of(px, py).frameOf();
  }
  holdsSea(px, py) {
    return this.of(px, py).holdsSea(px, py);
  }
  sampleDistanceMeters(x, y, fx, fz) {
    return this.of(x, y).sampleDistanceMeters(x, y, fx, fz);
  }
  sampleEdgeDistanceMeters(x, y, fx, fz) {
    return this.of(x, y).sampleEdgeDistanceMeters(x, y, fx, fz);
  }
  sampleLocalEdgeDistanceMeters(x, y, fx, fz) {
    return this.of(x, y).sampleLocalEdgeDistanceMeters(x, y, fx, fz);
  }
  isWaterAt(x, y, fx, fz) {
    return this.of(x, y).isWaterAt(x, y, fx, fz);
  }
  isCarvedWater(x, y, fx, fz) {
    return this.of(x, y).isCarvedWater(x, y, fx, fz);
  }
  mapPixelHasFineWaterCells(x, y) {
    return this.of(x, y).mapPixelHasFineWaterCells(x, y);
  }
  mapPixelHasWaterCells(x, y) {
    return this.of(x, y).mapPixelHasWaterCells(x, y);
  }
  mapPixelOrCardinalNeighborHasWaterCells(x, y) {
    return this.of(x, y).mapPixelOrCardinalNeighborHasWaterCells(x, y);
  }
  mapPixelHasLandCells(x, y) {
    return this.of(x, y).mapPixelHasLandCells(x, y);
  }
  prepare(px, py) {
    this.of(px, py).prepare(px, py);
  }
  exportPlanes(px, py) {
    return this.of(px, py).exportPlanes(px, py);
  }
  adoptPlanes(rows) {
    const list = rows ?? [];
    this.bay.adoptPlanes(list.filter((r) => r?.f !== ETHER_ROW && r?.f !== TAMRIEL_ROW));
    this.ether?.adoptPlanes(list.filter((r) => r?.f === ETHER_ROW));
    this.tamriel?.adoptPlanes(list.filter((r) => r?.f === TAMRIEL_ROW));
  }
  evictOutside(px, py, radius) {
    this.bay.evictOutside(px, py, radius);
    this.ether?.evictOutside(px, py, radius);
    this.tamriel?.evictOutside(px, py, radius);
  }
}

/**
 * The world's bakes: the Bay's alone, or with the Eltheric's beside it (`ether` its rects, or true for none known), or
 * with room for the continent's (`continent`: the land past the Bay streams - TAMRIEL-DEEP; its bake is set when the trace
 * lands, DeepWatersBakes.setTamriel).
 * @param {any} bay
 * @param {{ woods?: any, ether?: any, continent?: boolean }} [opts]
 */
export function worldBakes(bay, { woods = null, ether = null, continent = false } = {}) {
  if (!bay || (!ether && !continent)) return bay;
  return new DeepWatersBakes(bay, ether ? new EtherWatersBake({ woods, rects: ether === true ? null : ether }) : null);
}

/** A pixel's frame for a world with the Eltheric standing or not, and TAMRIEL-DEEP the continent's frame where its bake
 *  stands (`tamriel`, that bake's frame, or null): the Eltheric's in its box, the continent's past the Bay's map within
 *  its frame, the Bay's else (the mod's own clamps, off its map). Pure - the host asks it before the bake is in.
 *  @param {number} px @param {number} py @param {boolean} ether @param {?{ x0: number, y0: number, w: number, h: number }} [tamriel] */
export const waterFrameOf = (px, py, ether, tamriel = null) =>
  ether && inFrame(ETHER_FRAME, px, py)
    ? ETHER_FRAME
    : tamriel && !inFrame(BAY_FRAME, px, py) && inFrame(tamriel, px, py)
      ? tamriel
      : BAY_FRAME;
