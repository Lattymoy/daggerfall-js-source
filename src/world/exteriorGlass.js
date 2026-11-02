// @ts-check
// WL1 (2026-10-29, the owner: "So all windows on the outside/inside should be see through"): the windows DFU's table
// (climateSwaps.isExteriorWindow) names whose glass is not the palette's 0xff. Read off a real ARENA2
// (tools/exteriorGlassScan.mjs), twelve such records stand in a building's climate - the desert's merchant homes and
// temples, the mountain and temperate castles in both seasons, DFU's named exceptions - and showed no room from the
// street, no street from inside and no glow at night. Their glass colour is named here and GLASS-ALL's cleanup
// (interiorGlass.js paneTexels) keeps the panes - a departure from GetWindowColors32. 036 #3, also named, is a wall.

import { isExteriorWindow } from './climateSwaps.js';
import { paneTexels } from './interior/interiorGlass.js';

/** Each record's glass colours (palette indices), keyed `archive_record` - read off the data, every one a window DFU's
 *  table names. */
export const EXTERIOR_GLASS = Object.freeze({
  '42_3': Object.freeze([97]), // desert merchant homes: the lattice's panes in the blue run
  '61_3': Object.freeze([221]), // desert temple: dark panes in a lattice
  '109_3': Object.freeze([127]), // mountain castle
  '110_3': Object.freeze([127]), // mountain castle, winter (the icicles hang over it)
  '309_3': Object.freeze([127]), // temperate castle
  '310_3': Object.freeze([127]), // temperate castle, winter
  '151_3': Object.freeze([126]), // DFU's exceptions: a narrow arched window, dark
  '351_3': Object.freeze([126]),
  '154_3': Object.freeze([138]), // an arched window of teal glass behind bars
  '171_2': Object.freeze([104, 105, 106]), // a timber wall's four blue panes
  '172_3': Object.freeze([131]), // the same wall, pale glass
  '173_3': Object.freeze([131]),
});

/** The glass colours of a record, or null when the table does not name it. */
export function exteriorGlassIndices(archive, record) {
  return EXTERIOR_GLASS[`${archive}_${record}`] ?? null;
}

/** THE WINDOW MASK, the pipeline's one ask for an exterior window record: DFU's own (getWindowColors32 - white where the
 *  bitmap holds 0xff, rows bottom-up) when it finds glass, else the panes of the record's glass colours in that shape,
 *  else null (not a window of DFU's table). `t` is the archive's TextureFile.
 * @param {number} archive @param {number} record
 * @param {{ width: number, height: number, data: Uint8Array }} bitmap the classic bitmap (rows top first)
 * @param {{ getWindowColors32: (b: any) => { colors: Uint8ClampedArray, width: number, height: number } }} t */
export function exteriorWindowMask(archive, record, bitmap, t) {
  if (!isExteriorWindow(archive, record)) return null;
  if (!bitmap?.data) return t.getWindowColors32(bitmap);
  const own = t.getWindowColors32(bitmap);
  if (hasGlass(own)) return own;
  const indices = exteriorGlassIndices(archive, record);
  if (!indices) return own; // DFU's (empty) mask: the window stands as DFU draws it
  const { width: W, height: H, data } = bitmap;
  const want = new Set(indices),
    cand = new Uint8Array(W * H);
  for (let i = 0; i < cand.length; i++) cand[i] = want.has(data[i]) ? 1 : 0;
  const glass = fillPaneSpecks(paneTexels(cand, W, H), W, H);
  const colors = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!glass[y * W + x]) continue;
      colors.fill(255, ((H - 1 - y) * W + x) * 4, ((H - 1 - y) * W + x) * 4 + 4);
    }
  return { colors, width: W, height: H };
}

/** A speck of another colour inside a pane (a dot of the wall's grain in the castle's glass) is glass: a run of at most
 *  SPECK_MAX texels with glass on every side, joined corner to corner too - a lattice's diagonal lead is one long run. */
export const SPECK_MAX = 3;
export function fillPaneSpecks(glass, W, H) {
  const seen = new Uint8Array(W * H),
    run = [];
  for (let i0 = 0; i0 < glass.length; i0++) {
    if (glass[i0] || seen[i0]) continue;
    run.length = 0;
    let closed = true;
    const stack = [i0];
    seen[i0] = 1;
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop()),
        x = i % W,
        y = (i - x) / W;
      run.push(i);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) closed = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            j = ny * W + nx;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (!glass[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
    }
    if (closed && run.length <= SPECK_MAX) for (const i of run) glass[i] = 1;
  }
  return glass;
}

/** A mask (rgba, white where glass) with any glass in it. */
export function hasGlass(mask) {
  const c = mask?.colors;
  if (!c) return false;
  for (let i = 0; i < c.length; i += 4) if (c[i] > 127) return true;
  return false;
}
