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
import { PROVINCES } from './tamrielGeography.js';
import { tamrielSize, tamrielFit, BAY_W, BAY_H } from './tamrielFrame.js';   // TAMRIEL3: the live fit
import { provinceKeyAt } from './tamrielLand.js';   // TAMRIEL3: the picture's own land where it is traced
import { authoredHeightByte, groundHash, SHORE_BYTE, INLAND_BYTE, SNOW_BYTE, PLAIN_REACH } from './tamrielGround.js';   // TAMRIEL2: the one height law, the streamed ground's
import { CLIMATES } from '../formats/mapsTables.js';

export const PROVINCE_NONE = 255;
export { SHORE_BYTE, INLAND_BYTE, SNOW_BYTE, PLAIN_REACH };

/**
 * The frame rasterised at `cell` Bay pixels a cell: {width, height, cell, height: Uint8Array, climate: Uint8Array,
 * province: Uint8Array}. Pure and deterministic.
 */
export function rasterizeTamriel({ cell = 8 } = {}) {
  const size = tamrielSize();
  const width = Math.ceil(size.w / cell), height = Math.ceil(size.h / cell);
  const n = width * height;
  const province = new Uint8Array(n).fill(PROVINCE_NONE);
  const climate = new Uint8Array(n).fill(CLIMATES.Ocean);
  const heightBytes = new Uint8Array(n);
  const unit = tamrielFit().ppu / cell;   // cells a picture unit
  const index = new Map(PROVINCES.map((p, i) => [p.key, i]));
  // TAMRIEL3: each cell asks the land module at its centre - the picture's own land where it is traced, the authored
  // rings else - and TAMRIEL2's one height law (world/tamrielGround.js), so the streamed ground past the Bay and this
  // raster are one law by construction
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const key = provinceKeyAt((x + 0.5) / unit, (y + 0.5) / unit);
      if (!key) continue;
      const p = index.get(key);
      if (p === undefined) continue;
      province[i] = p;
      climate[i] = PROVINCES[p].climate;
      heightBytes[i] = Math.max(SHORE_BYTE, authoredHeightByte((x + 0.5) / unit, (y + 0.5) / unit, (groundHash(x, y) - 0.5) * 4));
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
  const { ox, oy } = tamrielFit();   // TAMRIEL3: the live origin
  const cx0 = Math.floor(ox / raster.cell), cx1 = Math.ceil((ox + BAY_W) / raster.cell);
  const cy0 = Math.floor(oy / raster.cell), cy1 = Math.ceil((oy + BAY_H) / raster.cell);
  for (let y = Math.max(0, cy0); y < Math.min(raster.height, cy1); y++) {
    for (let x = Math.max(0, cx0); x < Math.min(raster.width, cx1); x++) {
      const bx = Math.floor((x + 0.5) * raster.cell - ox), by = Math.floor((y + 0.5) * raster.cell - oy);
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
