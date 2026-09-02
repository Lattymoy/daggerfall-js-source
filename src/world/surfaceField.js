// ═══════════════════════════════════════════════════════════════════
// EE9: THE SURFACE FIELD. Snow that builds, deforms underfoot and
// melts; puddles that gather and dry. Design: EE9-Surface-Field-Design.md.
//
// This file is the PURE half: the arrays, the laws, the clock, the
// climate. No GL, no DOM. The renderer reads it as a texture; the host
// ticks and stamps it. Everything here is pinned in node.
//
// The lab's five laws, ported:
//   1. WATER POOLS IN HOLLOWS - accumulation weighted by the terrain's
//      own concavity, so puddles gather in dips and run off rises.
//   2. SNOW LIES ON THE FLAT - accumulation scales with flatness.
//   3. SNOW IS A HEIGHT - the renderer displaces by it; packed snow sits
//      lower than fresh, so a trail reads as a trail.
//   4. WALKING DEFORMS IT - a step compresses rather than deletes, throws
//      a little to the rim, leaves wear that outlasts the print, and
//      pushes standing water out.
//   5. MELT IS A CONVERSION - warmth turns snow into water at a third of
//      its depth (snow is mostly air); the sun dries the water, slower
//      in a hollow.
//
// And the game's own clock, which the lab did not have. The BASE depth
// is a function of the calendar and the climate - deep in midwinter,
// gone by spring, never in the desert - and the lab's dynamics ride ON
// TOP: a storm adds, warmth melts, feet deform, and the deviation from
// the base decays back toward it over hours. Nothing is saved, and the
// field can never disagree with the season the world already shows.
//
// One cell is a quarter of a tile: 4 x 4 cells per 6.4m tile, so a
// terrain pixel of 128 tiles is 512 x 512 cells of 1.6m. Coarser than
// the lab's 25cm and fine enough for a trail, a drift and a puddle.

import { DAYS_PER_YEAR } from '../systems/gameDate.js';

export const CELLS_PER_TILE = 4;
export const FIELD_DIM = 128 * CELLS_PER_TILE;        // 512
export const TILE_SIZE = 6.4;
export const CELL_SIZE = TILE_SIZE / CELLS_PER_TILE;   // 1.6m
export const SNOW_DEPTH_M = 1.35;                       // full snow, in metres - the lab's number

/** The climates' base warmth. Desert never holds snow; mountain holds
 *  it all; temperate holds it on the flats and loses a south face by
 *  afternoon. Keyed by climateSwaps' BASE enum. */
export const CLIMATE_WARMTH = Object.freeze({
  0: 1.0,     // Desert
  100: 0.2,   // Mountain
  300: 0.5,   // Temperate
  400: 0.55,  // Swamp
});

/** -0.4 at midwinter, +0.4 at midsummer, a cosine over Daggerfall's
 *  360-day year. Day 0 is 1 Morning Star; midwinter is near day 0. */
export function seasonWarmth(dayOfYear) {
  const t = (((dayOfYear % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR) / DAYS_PER_YEAR;
  return -0.4 * Math.cos(t * Math.PI * 2);
}

/** -0.15 before dawn, +0.15 mid-afternoon. */
export function diurnalWarmth(minuteOfDay) {
  const t = (((minuteOfDay % 1440) + 1440) % 1440) / 1440;
  return 0.15 * Math.sin((t - 0.29) * Math.PI * 2);   // trough ~4am, peak ~4pm
}

/**
 * Mac's function: how warm is this place, now. Above 0.5 melts; below
 * it, snow stays. `cover` is the eased weather row's cloud cover: a deck
 * costs a tenth.
 */
export function warmthAt({ climateBase, dayOfYear, minuteOfDay, cover = 0 }) {
  const base = CLIMATE_WARMTH[climateBase] ?? 0.5;
  return base + seasonWarmth(dayOfYear) + diurnalWarmth(minuteOfDay) - cover * 0.1;
}

/** The BASE snow depth the calendar and the climate decide, 0..1,
 *  before flatness and before any storm. */
export function baseSnowDepth({ climateBase, dayOfYear }) {
  const base = CLIMATE_WARMTH[climateBase] ?? 0.5;
  return Math.max(0, Math.min(1, (0.5 - seasonWarmth(dayOfYear) - base) * 1.6));
}

const cl = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * The field for one terrain piece. `heights` is the piece's corner
 * heightmap - (tileDim+1)^2 samples, x-major, already scaled to world
 * units - from which the pooling and flatness of every cell are read
 * once and cached, because the terrain does not move.
 */
export class SurfaceField {
  constructor({ heights, tileDim = 128, cellsPerTile = CELLS_PER_TILE, tileSize = TILE_SIZE }) {
    this.tileDim = tileDim;
    this.cells = cellsPerTile;
    this.dim = tileDim * cellsPerTile;
    this.cellSize = tileSize / cellsPerTile;
    const n = this.dim * this.dim;
    this.data = new Float32Array(n * 4);        // R water, G snow, B pack, A wear
    this.pixels = new Uint8Array(n * 4);         // the upload image
    this.pool = new Float32Array(n);
    this.flat = new Float32Array(n);
    this.dirtyRows = new Uint8Array(this.dim);  // rows that changed since the last upload
    /** EE10: HARDNESS per cell, 0..1 - a road or a path is 1. Mac: a
     *  walked path holds less snow. A travelled surface is packed from
     *  the start, takes less of a fall, and sheds nothing into the ground
     *  - so rain SHEETS on it and pools in its dips, which is where the
     *  rain-shine and the puddles on a road come from. Set from the
     *  tilemap by setHard; zero until then, which is the field as it was. */
    this.hard = new Float32Array(this.dim * this.dim);
    this.base = 0;                               // the calendar's snow depth, 0..1
    this._readTerrain(heights, tileDim + 1, tileSize);
  }

  _readTerrain(h, hDim, tileSize) {
    const at = (x, z) => h[cl(x, 0, hDim - 1) * hDim + cl(z, 0, hDim - 1)];
    const hAt = (lx, lz) => {
      const fx = lx / tileSize; const fz = lz / tileSize;
      const x0 = Math.floor(fx); const z0 = Math.floor(fz);
      const tx = fx - x0; const tz = fz - z0;
      return (at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx) * (1 - tz) + (at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx) * tz;
    };
    const r = this.cellSize * 1.5;
    for (let j = 0; j < this.dim; j++) {
      for (let i = 0; i < this.dim; i++) {
        const x = (i + 0.5) * this.cellSize; const z = (j + 0.5) * this.cellSize;
        const c = hAt(x, z);
        const around = (hAt(x + r, z) + hAt(x - r, z) + hAt(x, z + r) + hAt(x, z - r)) * 0.25;
        const slope = Math.hypot(hAt(x + r, z) - hAt(x - r, z), hAt(x, z + r) - hAt(x, z - r)) / (2 * r);
        const k = j * this.dim + i;
        this.flat[k] = cl(1 - slope * 2.6, 0, 1);
        // concave (below its ring) pools; convex sheds
        this.pool[k] = cl((around - c) / this.cellSize * 0.9 + 0.35, 0, 1) * 0.75 + this.flat[k] * 0.25;
      }
    }
  }

  /** Set the calendar's base depth. Cells below it fill toward it and
   *  cells above it settle toward it, both over hours, in tick(). */
  setBase(depth) { this.base = cl(depth, 0, 1); }

  /** EE10: mark the travelled cells from the piece's own tilemap. Every
   *  cell of a tile whose record is in `hardRecords` becomes hard; the
   *  edge cells of a hard tile are half-hard, so a road's verge is a
   *  gradient and not a cliff. Roads start PACKED, because they are. */
  setHard(tilemap, hardRecords) {
    const c = this.cells; const dim = this.dim;
    this.hard.fill(0);
    for (let tz = 0; tz < this.tileDim; tz++) {
      for (let tx = 0; tx < this.tileDim; tx++) {
        if (!hardRecords.has(tilemap[tz * this.tileDim + tx] >> 2)) continue;
        for (let dz = 0; dz < c; dz++) {
          for (let dx = 0; dx < c; dx++) {
            const edge = dx === 0 || dz === 0 || dx === c - 1 || dz === c - 1;
            const k = (tz * c + dz) * dim + (tx * c + dx);
            this.hard[k] = edge ? 0.5 : 1;
            this.data[k * 4 + 2] = Math.max(this.data[k * 4 + 2], this.hard[k] * 0.55);   // trodden from the start
          }
        }
      }
    }
    this.dirtyRows.fill(1);
  }

  /**
   * One step of the laws. `dt` in seconds of world time. Rates are per
   * second: rainRate and snowRate 0..1 from the weather, warmth from
   * warmthAt(). Marks every row dirty that changed.
   */
  tick(dt, { rainRate = 0, snowRate = 0, warmth = 0.5 } = {}) {
    const n = this.dim * this.dim;
    const d = this.data; const pool = this.pool; const flat = this.flat;
    const melt = Math.max(0, warmth - 0.5);
    const cold = Math.max(0, 0.5 - warmth);
    const base = this.base;
    const relax = dt * 0.0006;   // the deviation from the calendar decays over ~hours
    for (let k = 0; k < n; k++) {
      const o = k * 4;
      let water = d[o]; let snow = d[o + 1]; let pack = d[o + 2]; let wear = d[o + 3];
      const w0 = water; const s0 = snow; const p0 = pack; const e0 = wear;
      // 1. rain fills, where water actually goes
      const hard = this.hard[k];
      // EE10: rain SHEETS on a hard surface - nothing soaks in - so a road
      // wets faster than the ground beside it and pools in its dips
      if (rainRate > 0) water += rainRate * dt * (0.15 + pool[k] * 1.5 + hard * 0.9) * 0.02;
      // 2. snow lies on the flat, and packed snow takes less
      // EE10: a travelled road takes a fraction of a fall - Mac's walked path
      if (snowRate > 0) snow += snowRate * dt * (0.25 + flat[k] * 1.4) * (1 - pack * 0.45) * (1 - hard * 0.7) * 0.02;
      // the calendar: fill toward the base where the cold holds, settle toward it otherwise
      const target = base * (0.3 + flat[k] * 0.7) * (1 - hard * 0.75);   // EE10: the calendar's base is thin on a road too
      if (snow < target && cold > 0) snow += (target - snow) * relax * (0.5 + cold);
      else if (snow > target && melt === 0) snow += (target - snow) * relax * 0.5;
      // 5. melt is a CONVERSION: the snow becomes the water
      if (melt > 0 && snow > 0) {
        const m = Math.min(snow, melt * dt * 0.02 * (0.4 + (1 - flat[k]) * 0.8));
        snow -= m; water += m * 0.35;
        pack = Math.max(0, pack - melt * dt * 0.02);
      }
      // the sun dries what is left, slower in a hollow
      // the sun dries what is left, slower in a hollow - and SLOWER than a
      // thaw makes it, or the melt never pools and the lab's chain
      // (snow -> puddles -> ground) loses its middle. Measured: at 0.006
      // the sun outran the melt 3.6 to 1 and no thaw ever left a puddle.
      water = Math.max(0, water - Math.max(0, warmth) * dt * 0.0016 * (1.1 - pool[k] * 0.6) * (1 + hard * 0.4));   // EE10: a thin sheet on stone dries sooner than a soaked field
      // wind and fresh fall heal a print; wear outlasts it
      pack = Math.max(hard * 0.55, pack - dt * (0.0006 + snowRate * 0.02));   // EE10: a road never un-treads
      wear = Math.max(0, wear - dt * 0.00015);
      water = Math.min(1, water); snow = Math.min(1, snow); pack = Math.min(1, pack); wear = Math.min(1, wear);
      if (water !== w0 || snow !== s0 || pack !== p0 || wear !== e0) {
        d[o] = water; d[o + 1] = snow; d[o + 2] = pack; d[o + 3] = wear;
        this.dirtyRows[(k / this.dim) | 0] = 1;
      }
    }
  }

  /** A footfall at piece-local (x, z). The lab's stamp: compress, throw
   *  to the rim, wear, and push standing water out. The print is a
   *  2 x 2 CELL disc - the design's own size - because a cell is 1.6m
   *  and a 0.5m print would fall between cell centres and touch nothing.
   *  Coarser than the lab's 25cm texels, by design. */
  stamp(x, z, radius = null) {
    const cs = this.cellSize; const dim = this.dim; const d = this.data;
    radius = radius ?? cs * 1.15;
    const i0 = Math.max(0, Math.floor((x - radius * 1.6) / cs)); const i1 = Math.min(dim - 1, Math.ceil((x + radius * 1.6) / cs));
    const j0 = Math.max(0, Math.floor((z - radius * 1.6) / cs)); const j1 = Math.min(dim - 1, Math.ceil((z + radius * 1.6) / cs));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dist = Math.hypot((i + 0.5) * cs - x, (j + 0.5) * cs - z);
        const o = (j * dim + i) * 4;
        if (dist <= radius) {
          const w = 1 - dist / radius;
          const taken = d[o + 1] * w * 0.55;
          d[o + 1] -= taken;                                   // compressed, not deleted
          d[o + 2] = Math.min(1, d[o + 2] + w * 0.8);          // packed
          d[o + 3] = Math.min(1, d[o + 3] + w * 0.5);          // worn
          d[o] = Math.max(0, d[o] - w * 0.35);                 // the splash
          this.dirtyRows[j] = 1;
        } else if (dist <= radius * 1.6) {
          d[o + 1] = Math.min(1, d[o + 1] + 0.04);             // the rim
          this.dirtyRows[j] = 1;
        }
      }
    }
  }

  /** Fill the upload image for the dirty rows and return their span, or
   *  null when nothing changed. The host uploads exactly that span. */
  flush() {
    let first = -1; let last = -1;
    for (let j = 0; j < this.dim; j++) {
      if (!this.dirtyRows[j]) continue;
      if (first < 0) first = j;
      last = j;
      const d = this.data; const p = this.pixels;
      for (let i = 0; i < this.dim; i++) {
        const o = (j * this.dim + i) * 4;
        p[o] = d[o] * 255; p[o + 1] = d[o + 1] * 255; p[o + 2] = d[o + 2] * 255; p[o + 3] = d[o + 3] * 255;
      }
      this.dirtyRows[j] = 0;
    }
    return first < 0 ? null : { first, last };
  }

  /** The census the gate reads: mean snow and water depth, 0..1. */
  census() {
    const n = this.dim * this.dim; let s = 0; let w = 0;
    for (let k = 0; k < n; k++) { s += this.data[k * 4 + 1]; w += this.data[k * 4]; }
    return { snow: s / n, water: w / n };
  }

  /** Snow depth at piece-local (x, z), 0..1 - for the gate and for
   *  anything that wants to stand on the snow. */
  snowAt(x, z) {
    const i = cl(Math.floor(x / this.cellSize), 0, this.dim - 1);
    const j = cl(Math.floor(z / this.cellSize), 0, this.dim - 1);
    const o = (j * this.dim + i) * 4;
    return this.data[o + 1] * (1 - this.data[o + 2] * 0.55);
  }
}
