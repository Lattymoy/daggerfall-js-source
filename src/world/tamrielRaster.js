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
import { PROVINCES, pts } from './tamrielGeography.js';
import { TAMRIEL_W, TAMRIEL_H, PIXELS_PER_PICTURE_UNIT, BAY_ORIGIN, BAY_W, BAY_H } from './tamrielFrame.js';
import { authoredHeightByte, groundHash, SHORE_BYTE, INLAND_BYTE, SNOW_BYTE, PLAIN_REACH } from './tamrielGround.js';   // TAMRIEL2: the one height law, the streamed ground's
import { CLIMATES } from '../formats/mapsTables.js';

export const PROVINCE_NONE = 255;
export { SHORE_BYTE, INLAND_BYTE, SNOW_BYTE, PLAIN_REACH };

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
  // TAMRIEL2: each land cell's height is the ground law's at the cell's centre (world/tamrielGround.js) - the streamed
  // ground past the Bay and this raster are one law by construction
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = province[i];
      if (p === PROVINCE_NONE) continue;
      climate[i] = PROVINCES[p].climate;
      heightBytes[i] = Math.max(SHORE_BYTE, authoredHeightByte((x + 0.5) / unit, (y + 0.5) / unit, (groundHash(x, y) - 0.5) * 4));   // a cell the fill says is land stands at least on the shore
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
