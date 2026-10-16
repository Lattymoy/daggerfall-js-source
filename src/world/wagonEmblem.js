// @ts-check
// WAGON-EMBLEM (2026-10-16, Mac: "a guild master's emblem painted on the sides of their open wagon"): A GUILD'S
// ARMS ON THE OPEN WAGON'S SIDES - the two long outer walls a passer-by reads at riding distance.
//
// THE SIDE, AND WHY THE REPEAT IS NOT A REPEAT ANY MORE. world/wagonModels.js layFace gives a face whose normal runs
// along x, looks OUT and stands under 2.6 m the open wagon's TEX.openSide - a BAND (world/wagonArt.js BANDS), not a
// plain face: v runs the whole of it (SIDE_Y0 0.94 m to SIDE_Y1 3.06 m, 2.12 m of wall) and u is laid by
// `banded('openSide')` off WAGON_TILE.openSide[0]. That figure was SIDE_TILE_M, 1.3 m, and the picture repeated: the
// texture wraps (render/renderer.js textureParams' REPEAT - wagon faces upload through it), every tile byte-identical,
// so the arms stood four times down a side (read off the bake by test/wagonheraldry.test.js: the wall is 5.82 m with
// its u running -0.54 to 3.94, the four tiles at z 0, 1.3, 2.6 and 3.9 m, the last cut at 94%).
//
// The fix is the picture's shape, not the cloth's. `WAGON_TILE.openSide[0]` is now SIDE_CELLS * SIDE_TILE_M, and the
// record is `SIDE_CELLS` COPIES OF ITSELF ACROSS (classicArt.js composedPicture's `repeat`) - the same 256-square cell
// of Daggerfall's sailcloth, four times side by side, NEAREST, the same bytes. The face's u now runs ONCE over all
// four, and a cell is 1/4 of the picture, so the cell boundaries fall at 1.3 m, 2.6 m and 3.9 m - the same metres as
// before. The sailcloth is therefore not merely unbroken but BYTE-FOR-BYTE the cloth of the repeating picture: same
// cell, same 256 texels over the same 1.3 m, same NEAREST. Stretching the tile instead (which is what
// "suppress the repeat" means without this) would have smeared the weave 3.94-fold across a face where a texel is
// 5.1 mm wide; this does not touch it at all. The arms go on ONE cell (EMBLEM_CELL, the second), so the wagon carries
// the one emblem that stood at z 1.3 to 2.6 m and no other.
//
// A SHIELD, NOT THE HALL'S THREE-TALL BANNER (ui/heraldryArt.js drawBanner - the same field, border and device, a
// different box). The cell is 1.3 m of u by 2.12 m of v and the banner is one part in three of it, so a banner here is
// 0.34 m wide against this shield's 1.0 m, and the DEVICE - the thing that actually reads - comes out twice the size
// on the same square metre of cloth. ui/heraldryArt.js's own HERALDRY-SHOWN says the same of every box that is not a
// banner's. Swapping it back is the one line of `drawWagonEmblem` below, which is the only place the shape is chosen.
//
// THE BRIDGE. composedPicture's `paint` is handed the ASSEMBLED picture as a mutable RGBA buffer, last, after the body
// and every inset; the arms are drawn into a Canvas2D context and read back with getImageData, then stamped over the
// cloth ALPHA-BLENDED - the insets' binary threshold does not apply here, and a shield's dark edge over a lit sail
// wants the blend, not a hole. There is no canvas in a Worker without one, nor in the suite: no canvas leaves the
// cloth bare and the wagon whole, never a throw.
//
// VISUAL ONLY. Nothing here rides the wire: no field, no RELAY_VERSION, no PARK_WAGON_LOOK_MAX, no new paint. Whose
// arms it is, whose wagon it is on and what a look may choose are all phase 2; what is here is the picture.
//
// Not a DFU member: Daggerfall Unity has no player guilds, and no wagon pictures. Ledger A (ONLINE, WAGONS1).
import { COMPOSE } from './classicArt.js';   // a composed cell's size, four of its texels to the layout's one
import { heraldryOf } from '../net/heraldryLaw.js';   // GUILD1d: a heraldry in the law's shape, or nothing
import { drawShield } from '../ui/heraldryArt.js';   // GUILD1d: THE HERALDRY AS A SHIELD, drawn on a canvas

// ── THE ARMS ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The arms a wagon's side wears when no guild stands behind it: Crimson fielded, a Gold border, a Gold crown - the
 *  throne's own, and the loudest pair in the palette. A prototype that drew nothing would look like a wagon; this is
 *  what the operator sees before a guild is ever chosen, and it must not be a subtle grey-on-grey. */
export const WAGON_EMBLEM_ARMS = Object.freeze({ field: 'crimson', border: 'gold', device: 'crown' });

/** @type {() => any} the reader's own guild's heraldry, asked fresh; a value stands in for one that never changes. */
let _armsOf = () => null;
/**
 * THE DOOR the world's one caller opens (scenes/world.js, beside the GuildBook): `of` a heraldry or a function of one.
 * A FUNCTION, not a value - the book refreshes under us, and the wagon's pictures are built once, so a value handed
 * here would freeze the arms of whichever guild was standing at the moment the door was opened.
 */
export function setWagonHeraldry(of) { _armsOf = typeof of === 'function' ? /** @type {() => any} */ (of) : () => of ?? null; }
/** THE ARMS A WAGON'S SIDE WEARS: the reader's own guild's, or WAGON_EMBLEM_ARMS for none - never null, so the
 *  prototype always shows the operator something and a guildmaster always sees his own. */
export function wagonHeraldry() { return heraldryOf(/** @type {any} */ (_armsOf())) ?? heraldryOf(WAGON_EMBLEM_ARMS); }

// ── WHERE IT STANDS, AND HOW BIG ───────────────────────────────────────────────────────────────────────────────────

/** The shield's own box, ui/heraldryArt.js SHIELD_BOX - 100 across by 104 down (its SHIELD_CLOTH, 'M8 4 H92 V46 C92
 *  74 74 92 50 102 C26 92 8 74 8 46 Z', is drawn inset inside it). The two numbers are what a picture is squashed
 *  to, so they are read once here rather than guessed at each call. */
const SHIELD_BOX_W = 100, SHIELD_BOX_H = 104;
/** How wide the emblem stands across the side, metres. A metre on a 1.3 m cell: cloth shows either side of it, and it
 *  is the width a rider's eye reads as ONE thing at twenty paces - the whole point of the prototype. */
export const EMBLEM_M = 1.0;
/** WHICH CELL OF THE SIDE'S PICTURE CARRIES THE ARMS - 0 the first, 1 the second, and so on along the side from its
 *  rear. The operator's own word (2026-10-16): "Can we make it only show on the second iteration?" - the cell whose
 *  metres are z 1.3 to 2.6 m. Every other cell is bare cloth, and because the face's u no longer repeats, there is
 *  nothing anywhere on the wagon that can bring a second one back. */
export const EMBLEM_CELL = 1;

/**
 * THE EMBLEM'S PLACE in a picture `pic` whose cells are `cellW` texels wide - `tileM` of u to a cell, `bandM` of v
 * over the lot. The rect is kept SQUARE IN METRES, not in texels: a composed picture's texels are not square on this
 * face (u is `tileM` over a cell, v is `bandM` over the whole height), so a box square in texels comes out as a tall
 * shield on the wall. Pure.
 * @param {{width:number,height:number}} pic @param {number} tileM @param {number} bandM @param {number} [emblemM]
 * @param {number} [cell] which cell it stands in @param {number} [cellW] that cell's width in texels
 * @returns {{x0:number,y0:number,w:number,h:number}}
 */
export function emblemRect(pic, tileM, bandM, emblemM = EMBLEM_M, cell = 0, cellW = COMPOSE) {
  if (!(tileM > 0) || !(bandM > 0) || !(emblemM > 0) || !(cellW > 0) || cell < 0) return { x0: 0, y0: 0, w: 0, h: 0 };
  const w = Math.min(cellW, Math.max(1, Math.round((emblemM / tileM) * cellW)));
  const h = Math.min(pic.height, Math.max(1, Math.round((emblemM / bandM) * pic.height)));
  return { x0: cell * cellW + Math.floor((cellW - w) / 2), y0: Math.floor((pic.height - h) / 2), w, h };
}

/**
 * A PICTURE'S TEXELS WHERETHAN OVER `src`'s, at (`x0`, `y0`) of it - alpha-blended, the source-over of a canvas's
 * straight-alpha read-back. The destination's ALPHA IS NOT TOUCHED: composedPicture's body is opaque, and a heraldry
 * is paint on cloth, never a hole through it (test/wagons2.test.js holds every wagon texel to whole or clear). Off
 * either edge is dropped, not wrapped - the stamp is one emblem in the middle of a tile, never a seam. Pure.
 * @param {{width:number,height:number,data:Uint8Array}} pic
 * @param {{width:number,height:number,data:Uint8ClampedArray|Uint8Array}} src @param {number} x0 @param {number} y0
 */
export function stampRgba(pic, src, x0, y0) {
  for (let y = 0; y < src.height; y++) {
    const dy = y0 + y;
    if (dy < 0 || dy >= pic.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = x0 + x;
      if (dx < 0 || dx >= pic.width) continue;
      const s = (y * src.width + x) * 4, d = (dy * pic.width + dx) * 4, a = src.data[s + 3];
      if (a === 0) continue;
      if (a === 255) { pic.data[d] = src.data[s]; pic.data[d + 1] = src.data[s + 1]; pic.data[d + 2] = src.data[s + 2]; continue; }
      const k = a / 255, m = 1 - k;
      pic.data[d] = src.data[s] * k + pic.data[d] * m;
      pic.data[d + 1] = src.data[s + 1] * k + pic.data[d + 1] * m;
      pic.data[d + 2] = src.data[s + 2] * k + pic.data[d + 2] * m;
    }
  }
}

// ── THE PAINT ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The arms drawn into `ctx` over `w` by `h` - the shield on its own box, squashed neither way. THE SEAM: this is the
 *  one line a phase-2 banner stands on (drawBanner's own box is 100 by 300, three times, not EMBLEM_M wide). */
export function drawWagonEmblem(ctx, heraldry, w, h) {
  ctx.setTransform(w / SHIELD_BOX_W, 0, 0, h / SHIELD_BOX_H, 0, 0);
  return drawShield(ctx, heraldry, 0, 0, SHIELD_BOX_W);
}

/** A canvas of `w` by `h` to draw into, or null where this runtime has none - a Worker's host without OffscreenCanvas,
 *  and the suite (which stands its own; see test/wagonheraldry.test.js). */
function emblemCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const doc = typeof document === 'undefined' ? null : document;
  if (typeof doc?.createElement !== 'function') return null;
  const c = doc.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * THE EMBLEM PAINTED OVER A WAGON'S SIDE - the `paint` of a composed picture (world/classicArt.js): the reader's own
 * guild's arms drawn into a canvas the size of the rect emblemRect puts them in, read back and stamped over ONE CELL
 * of the cloth. `tileM` of u to a cell and `bandM` of v over the lot are the side's own metres (world/wagonArt.js
 * SIDE_TILE_M and BANDS), so the emblem is measured on the wagon and not in texels; `cell`/`cellW` say which cell of a
 * repeated picture it belongs to. Whether it was painted - false where there is no canvas to draw in, where the law
 * refuses the arms, or where nothing is left of the box.
 * @param {{width:number,height:number,data:Uint8Array}} pic @param {number} tileM @param {number} bandM
 * @param {number} [cell] @param {number} [cellW] @param {number} [emblemM]
 */
export function paintWagonEmblem(pic, tileM, bandM, cell = EMBLEM_CELL, cellW = COMPOSE, emblemM = EMBLEM_M) {
  const arms = wagonHeraldry();
  const { x0, y0, w, h } = emblemRect(pic, tileM, bandM, emblemM, cell, cellW);
  if (!arms || w < 1 || h < 1) return false;
  const canvas = emblemCanvas(w, h);
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || typeof ctx.setTransform !== 'function' || typeof ctx.getImageData !== 'function') return false;
  if (!drawWagonEmblem(ctx, arms, w, h)) return false;
  stampRgba(pic, ctx.getImageData(0, 0, w, h), x0, y0);
  return true;
}