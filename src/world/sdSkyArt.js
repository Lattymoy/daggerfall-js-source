// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 5): WHAT THE HOUR'S SKY DRAWS IN STARS - the
// six Endings' signs (world/sdHallArt.js SD_SIGNS, the stones' own: one law, the lion, the sun, the ship, the tusk, the
// crown of bone, the dragon) sampled on a coarse grid into one small strip the sky's paint reads (render/sdSkyMap.js),
// so each sign becomes a constellation on the clock-face's inner ring; and the Roman numerals its twelve hours are
// written in, glyph by glyph (5 x 7, the I one column wide), as rows of bits.
//
// Pure. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_SIGNS } from './sdHallArt.js';

/** A sign's grid (cells a side): a star at each cell the sign fills. */
export const SD_SKY_SIGN_GRID = 11;
/** The strip: the six signs side by side, SD_SKY_SIGN_GRID square each - R8, 255 where a sign fills its cell, 128 where it
 *  half-fills (an eye, a sail's shadow), 0 elsewhere. */
export function sdSkySigns() {
  const N = SD_SKY_SIGN_GRID, W = N * SD_SIGNS.length, data = new Uint8Array(W * N);
  SD_SIGNS.forEach((sign, i) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N) * 2 - 1, v = 1 - ((y + 0.5) / N) * 2;   // v up, as the stones paint it
      const m = sign(u / 0.9, v / 0.9);
      data[y * W + i * N + x] = m >= 1 ? 255 : m > 0 ? 128 : 0;
    }
  });
  return { width: W, height: N, data };
}

/** The numerals' glyphs, rows top to bottom, each row's bits left to right from the glyph's width - 1 down to 0: I (one
 *  column), V and X (five). */
export const SD_GLYPHS = Object.freeze({
  I: Object.freeze({ w: 1, rows: Object.freeze([1, 1, 1, 1, 1, 1, 1]) }),
  V: Object.freeze({ w: 5, rows: Object.freeze([17, 17, 17, 10, 10, 4, 4]) }),
  X: Object.freeze({ w: 5, rows: Object.freeze([17, 17, 10, 4, 10, 17, 17]) }),
});
/** The twelve hours as written, XII first (the hour at the top). */
export const SD_HOUR_NUMERALS = Object.freeze(['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']);
/** A numeral's width in cells - its glyphs and a cell between each. */
export const numeralWidth = (s) => [...s].reduce((n, ch) => n + SD_GLYPHS[ch].w, 0) + s.length - 1;
/** Whether cell (cx, cy) of numeral `s` is lit - cx from its left edge, cy from its top row (0..6). Pure; the paint's
 *  GLSL is written from it (render/sdSkyMap.js numeralGlsl) and pinned equal. */
export function numeralCell(s, cx, cy) {
  if (cy < 0 || cy > 6) return false;
  let x = 0;
  for (const ch of s) {
    const g = SD_GLYPHS[ch];
    if (cx >= x && cx < x + g.w) return ((g.rows[cy] >> (g.w - 1 - (cx - x))) & 1) === 1;
    x += g.w + 1;
  }
  return false;
}
