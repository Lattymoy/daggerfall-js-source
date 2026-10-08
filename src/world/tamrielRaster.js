// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - THE RASTER: the continent as the Bay's own kind of data.
//
// Mac: "a gigantic map that can be used for later use". The streamed world reads the Bay as three byte planes -
// WOODS.WLD's height (byte * 8 metres, the sea at 3 and under), CLIMATE.PAK's climate (formats/mapsTables.js CLIMATES)
// and POLITIC.PAK's region - at one byte a map pixel. This lays the authored continent (world/tamrielGeography.js) out
// in that shape over the whole frame (world/tamrielFrame.js), at a cell size the caller picks, and then COMPOSES the
// Bay's own bytes over its rectangle, so a later consumer (a far horizon, a province's weather, a road laid past the
// Bay's edge) reads one array and finds the data where there is data and the authored ground past it.
//
// NOTHING IN THE GAME LOOP CALLS THIS. It is a tool for the later use, pinned here so it is right when that use
// comes; the held map draws the continent from the vector model (ui/tamrielInk.js), never from a raster.
//
// THE HEIGHT LAW is WOODS' own: the sea's byte is 0; land starts at SHORE_BYTE and rises with distance from the coast
// to INLAND_BYTE; a range lifts its band toward the snowline (overworldModel SNOWLINE_BYTE 104) by its gain; a
// little lattice noise keeps a plain from reading as a contour. The climate is the province's. The province byte is
// its index in PROVINCES, PROVINCE_NONE at sea.
// ═══════════════════════════════════════════════════════════════════
import { PROVINCES, RANGES, pts } from './tamrielGeography.js';
import { TAMRIEL_W, TAMRIEL_H, PIXELS_PER_PICTURE_UNIT, BAY_ORIGIN, BAY_W, BAY_H } from './tamrielFrame.js';
import { CLIMATES } from '../formats/mapsTables.js';

export const PROVINCE_NONE = 255;
export const SHORE_BYTE = 5;
export const INLAND_BYTE = 22;
export const SNOW_BYTE = 112;
/** How far inland (picture units) the plain takes to rise from the shore to INLAND_BYTE. */
export const PLAIN_REACH = 6;

/** A small stable lattice hash, 0..1 (the fog's own shape, ui/wildMapInk.js - a hash, not a table). */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263 + 0x51ed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Scanline-fill a closed ring (points in CELL units) into `out` with `value`, even-odd. */
function fillRing(ring, w, h, out, value) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of ring) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const xs = [];
  for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y < Math.min(h, Math.floor(y1 + 0.5) + 1); y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.y > cy) !== (b.y > cy)) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x < Math.min(w, Math.floor(xs[k + 1] - 0.5) + 1); x++) out[y * w + x] = value;
    }
  }
}

/** Distance from a point to a polyline (same units). */
function distToLine(x, y, line) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}

/**
 * The frame rasterised at `cell` Bay pixels a cell: {width, height, cell, height: Uint8Array, climate: Uint8Array,
 * province: Uint8Array}. Pure and deterministic.
 */
export function rasterizeTamriel({ cell = 8 } = {}) {
  const width = Math.ceil(TAMRIEL_W / cell), height = Math.ceil(TAMRIEL_H / cell);
  const n = width * height;
  const province = new Uint8Array(n).fill(PROVINCE_NONE);
  const climate = new Uint8Array(n).fill(CLIMATES.Ocean);
  const heightBytes = new Uint8Array(n);
  const unit = PIXELS_PER_PICTURE_UNIT / cell;   // cells a picture unit
  const toCell = (p) => ({ x: p.x * unit, y: p.y * unit });
  PROVINCES.forEach((p, idx) => {
    for (const r of p.rings) fillRing(pts(r).map(toCell), width, height, province, idx);
  });
  // the coast's distance, for the plain: a cheap pass - each land cell's nearest sea cell within PLAIN_REACH, by
  // a dilation of the sea in rings
  const reach = Math.max(1, Math.round(PLAIN_REACH * unit));
  const dist = new Uint8Array(n).fill(reach);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (province[y * width + x] === PROVINCE_NONE) dist[y * width + x] = 0;
  for (let d = 1; d < reach; d++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (dist[i] !== reach) continue;
        const near = (x > 0 && dist[i - 1] === d - 1) || (x + 1 < width && dist[i + 1] === d - 1)
          || (y > 0 && dist[i - width] === d - 1) || (y + 1 < height && dist[i + width] === d - 1);
        if (near) dist[i] = d;
      }
    }
  }
  const ranges = RANGES.map((rg) => ({ ...rg, line: rg.pts.map(([x, y]) => toCell({ x, y })), w: rg.w * unit }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = province[i];
      if (p === PROVINCE_NONE) continue;
      climate[i] = PROVINCES[p].climate;
      const inland = dist[i] / reach;
      let h = SHORE_BYTE + (INLAND_BYTE - SHORE_BYTE) * inland + (hash(x, y) - 0.5) * 4;
      for (const rg of ranges) {
        const d = distToLine(x + 0.5, y + 0.5, rg.line);
        if (d < rg.w) h = Math.max(h, SHORE_BYTE + (SNOW_BYTE - SHORE_BYTE) * rg.gain * (1 - d / rg.w));
      }
      heightBytes[i] = Math.max(SHORE_BYTE, Math.min(255, Math.round(h)));
    }
  }
  return { width, height, cell, heightBytes, climate, province };
}

/**
 * The Bay's own bytes laid over its rectangle of the raster: each cell whose centre stands on the Bay's map takes
 * WOODS' height byte and CLIMATE.PAK's value at that pixel. The province byte keeps the authored answer (the Bay
 * is High Rock north of its water and Hammerfell south of it, which the rings already say). Answers the cells written.
 * @param {ReturnType<typeof rasterizeTamriel>} raster
 * @param {{ heightBytes: ArrayLike<number>, width?: number, climateAt?: (x: number, y: number) => number }} bay
 */
export function composeBay(raster, bay) {
  const bw = bay.width ?? BAY_W;
  let written = 0;
  const cx0 = Math.floor(BAY_ORIGIN.x / raster.cell), cx1 = Math.ceil((BAY_ORIGIN.x + BAY_W) / raster.cell);
  const cy0 = Math.floor(BAY_ORIGIN.y / raster.cell), cy1 = Math.ceil((BAY_ORIGIN.y + BAY_H) / raster.cell);
  for (let y = Math.max(0, cy0); y < Math.min(raster.height, cy1); y++) {
    for (let x = Math.max(0, cx0); x < Math.min(raster.width, cx1); x++) {
      const bx = Math.floor((x + 0.5) * raster.cell - BAY_ORIGIN.x), by = Math.floor((y + 0.5) * raster.cell - BAY_ORIGIN.y);
      if (bx < 0 || by < 0 || bx >= BAY_W || by >= BAY_H) continue;
      const i = y * raster.width + x;
      raster.heightBytes[i] = bay.heightBytes[by * bw + bx] ?? 0;
      const c = bay.climateAt?.(bx, by);
      if (typeof c === 'number' && c >= 0) raster.climate[i] = c;
      written++;
    }
  }
  return written;
}
