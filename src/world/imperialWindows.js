// @ts-check
// BLD (2026-10-26, the owner: "no lighting sources like the original layouts"; bible/03-World/Arena-Provinces.md
// IC-GRAND, BLD) - THE FABRIC'S WINDOWS LIT AT NIGHT, as Daggerfall's are.
//
// DFU's reference: an exterior window's glass glows with the window style after dark - MaterialReader's IsExteriorWindow
// arm uploads an emission map of the picture's glass (TextureReader GetWindowColors32: the window's texels white, every
// other black, rows in the texture's own order), and the renderer lights it by the window style (scenes/dataPipeline.js
// "Exterior windows also get their emission mask", render/realWindows.js RW1). A stand-in picture has no classic bitmap
// to cut a mask from, so the port's facades carried none and the city's own walls stood dark at night beside
// Daggerfall's lit blocks. Here each facade's glass is read from its own painting (world/imperialArt.js: every texel's
// ramp - the glass's is the window's own, ramp 1 of every wall and of the shopfront, its window of wares) and handed to
// the same upload as a window's mask, in the same bottom-up order (formats/color32Order.js). The arcade's ramp 1 is its
// loggia's shade, no glass - it stays dark, as an open arch does.
import { imperialArt } from './imperialArt.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART } from './capitalShapes.js';
import { toColor32 } from '../formats/color32Order.js';

/** The facades whose ramp 1 is glass. */
export const LIT_FACADES = Object.freeze(
  ['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop'].map((k) => CAPITAL_ART[k]),
);
/** The ramp a facade's glass is painted in (world/imperialArt.js: GLASS, its window's second ramp). */
export const FACADE_GLASS_RAMP = 1;
let _masks = null;
/** Each lit facade's glass (record -> { width, height, data }: the painting's rows, top first - white the glass). */
function masks() {
  if (_masks) return _masks;
  const tones = new Map();
  // the painting's own laws, read for their ramp alone: its kit's painter answers the tone law it was handed
  imperialArt(tones, {
    painted: (/** @type {any} */ _ramps, /** @type {Function} */ tone, /** @type {any} */ o) => ({
      tone,
      w: o.w,
      h: o.h,
    }),
    ramp: (/** @type {any} */ stops) => stops,
    masonry: () => ({ tone: () => 0.5 }),
    noise: () => () => 0.5,
  });
  _masks = new Map();
  for (const record of LIT_FACADES) {
    const { tone, w, h } = tones.get(record),
      data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = tone(x, y);
        if (Array.isArray(v) && v[1] === FACADE_GLASS_RAMP) data.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 4);
      }
    _masks.set(record, Object.freeze({ width: w, height: h, data }));
  }
  return _masks;
}
/** A facade's glass as its window mask's raster (top row first), or null for a picture of no window. */
export const facadeGlass = (archive, record) => (archive === CAPITAL_ARCHIVE ? (masks().get(record) ?? null) : null);
/**
 * THE WINDOW MASK A STAND-IN PICTURE CARRIES - the renderer's emission upload's shape (`{ colors, width, height }`, rows
 * bottom-up as getWindowColors32 lays them), or null.
 */
export function standInWindowMask(archive, record) {
  const m = facadeGlass(archive, record);
  return m ? toColor32({ width: m.width, height: m.height, data: m.data.slice() }) : null;
}
