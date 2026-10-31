// @ts-check
// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.5): A MOUNTED TROPHY'S PICTURE - a carved shield of dark
// wood with a brass plate, drawn here in code, and the beast's own front frame from the player's data set on it. Composed at
// runtime and uploaded under its own key (scenes/decor/decorRoom.js hangs it as a mount): nothing of ARENA2 is kept, as the
// doctrine's non-negotiables ask (01-Overview/Port-Doctrine.md). Pure but for the loader at the foot.
import { TextureFile } from '../../formats/textureFile.js';

/** The plaque, pixels, and the size it hangs at, metres (a shield a forearm wide). */
export const TROPHY_W = 96;
export const TROPHY_H = 120;
export const TROPHY_M = Object.freeze({ w: 0.6, h: 0.75 });
/** The wood, its rim and the plate - a dark stained oak, a lighter bevel, an old brass. */
export const TROPHY_WOOD = Object.freeze([74, 44, 24]);
export const TROPHY_RIM = Object.freeze([138, 90, 50]);
export const TROPHY_BRASS = Object.freeze([184, 145, 58]);
const RIM = 4;
/** Where the beast stands on the plaque (top-down rows), and the plate under it. */
const BEAST = Object.freeze({ x0: 8, x1: TROPHY_W - 8, y0: 6, y1: Math.round(TROPHY_H * 0.74) });
const PLATE = Object.freeze({
  x0: Math.round(TROPHY_W * 0.3),
  x1: Math.round(TROPHY_W * 0.7),
  y0: Math.round(TROPHY_H * 0.78),
  y1: Math.round(TROPHY_H * 0.86),
});

/** The shield's half width at a row (top-down): straight sides, rounded top corners, a rounded point below. */
export function shieldHalf(/** @type {number} */ y) {
  const half = TROPHY_W / 2 - 1;
  const r = 6;
  if (y < r) return half - (r - Math.sqrt(Math.max(0, r * r - (r - y) * (r - y))));
  const knee = TROPHY_H * 0.62;
  if (y < knee) return half;
  const t = (y - knee) / (TROPHY_H - knee);
  return half * Math.sqrt(Math.max(0, 1 - t * t));
}
/** A small stable hash of a texel - the grain's own noise, the same picture on every machine. */
const grain = (/** @type {number} */ x, /** @type {number} */ y) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h & 255) / 255;
};

/**
 * THE PLAQUE WITH ITS BEAST: `frame` a picture in the port's color32 order (`{ width, height, colors }`, row 0 the
 * bottom - formats/color32Order.js), its opaque box fitted into the plaque's upper part, kept in aspect, its feet on the
 * box's floor. Answers the same shape, TROPHY_W x TROPHY_H; outside the shield is clear.
 * @param {{ width: number, height: number, colors: ArrayLike<number> } | null} frame
 */
export function composeTrophy(frame) {
  const W = TROPHY_W,
    H = TROPHY_H;
  const out = new Uint8ClampedArray(W * H * 4);
  const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {ArrayLike<number>} */ c, a = 255) => {
    const i = ((H - 1 - y) * W + x) * 4; // top-down in, bottom-up out
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = a;
  };
  for (let y = 0; y < H; y++) {
    const half = shieldHalf(y);
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - W / 2);
      if (dx > half) continue;
      const edge = Math.min(half - dx, y, H - 1 - y);
      const g = 0.82 + 0.3 * grain(x >> 1, y) * (0.6 + 0.4 * Math.sin(x * 0.35 + grain(0, y >> 2) * 3));
      const base = edge < RIM ? TROPHY_RIM : TROPHY_WOOD;
      const lit = edge < RIM && y < H / 2 ? 1.12 : 1;
      put(
        x,
        y,
        base.map((v) => Math.min(255, Math.round(v * g * lit))),
      );
    }
  }
  for (let y = PLATE.y0; y < PLATE.y1; y++)
    for (let x = PLATE.x0; x < PLATE.x1; x++) {
      const rim = y === PLATE.y0 || y === PLATE.y1 - 1 || x === PLATE.x0 || x === PLATE.x1 - 1;
      put(x, y, rim ? TROPHY_BRASS.map((v) => Math.round(v * 0.7)) : TROPHY_BRASS);
    }
  if (frame && frame.width > 0 && frame.height > 0 && frame.colors?.length >= frame.width * frame.height * 4) {
    const { width: fw, height: fh, colors } = frame;
    const alpha = (/** @type {number} */ x, /** @type {number} */ yTop) => colors[((fh - 1 - yTop) * fw + x) * 4 + 3];
    let bx0 = fw,
      by0 = fh,
      bx1 = -1,
      by1 = -1;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++)
        if (alpha(x, y) > 0) {
          bx0 = Math.min(bx0, x);
          bx1 = Math.max(bx1, x);
          by0 = Math.min(by0, y);
          by1 = Math.max(by1, y);
        }
    if (bx1 >= bx0) {
      const bw = bx1 - bx0 + 1,
        bh = by1 - by0 + 1;
      const s = Math.min((BEAST.x1 - BEAST.x0) / bw, (BEAST.y1 - BEAST.y0) / bh);
      const dw = Math.max(1, Math.round(bw * s)),
        dh = Math.max(1, Math.round(bh * s));
      const ox = BEAST.x0 + Math.floor((BEAST.x1 - BEAST.x0 - dw) / 2),
        oy = BEAST.y1 - dh;
      for (let y = 0; y < dh; y++)
        for (let x = 0; x < dw; x++) {
          const sx = bx0 + Math.min(bw - 1, Math.floor(x / s)),
            sy = by0 + Math.min(bh - 1, Math.floor(y / s));
          const i = ((fh - 1 - sy) * fw + sx) * 4;
          if (colors[i + 3] > 0) put(ox + x, oy + y, [colors[i], colors[i + 1], colors[i + 2]]);
        }
    }
  }
  return { width: W, height: H, colors: out };
}

/**
 * The picture a trophy hangs as: its beast's front frame (record 0, frame 0 of `archive` - the spectral ones as the
 * world draws them) composed on the plaque and uploaded once under `trophy`/`archive` - `{ tex, w, h }` in metres, or
 * null (no archive, no texture). `deps` the room's or the tool's: getTexture, renderer.
 * @param {{ getTexture?: (a: number) => any, renderer?: any }} deps @param {number} archive
 */
export function loadTrophyArt({ getTexture, renderer }, archive) {
  return Promise.resolve(getTexture?.(archive))
    .then((t) => {
      if (!t || !(t.recordCount > 0)) return null;
      const bitmap = t.getDFBitmap(0, 0);
      let frame;
      if (TextureFile.isSpectralArchive(archive)) {
        const spec = { ...bitmap, data: bitmap.data.slice() };
        t.setSpectral(spec);
        frame = t.getColor32(spec, 0, 0, TextureFile.SPECTRAL_EYES_PATCHED, TextureFile.SPECTRAL_ALPHA);
      } else frame = t.getColor32(bitmap, 0);
      const tex =
        renderer?.uploadTexture?.('trophy', archive, composeTrophy(frame), { mips: false, variant: '' }) ?? null;
      return tex ? { tex, w: TROPHY_M.w, h: TROPHY_M.h } : null;
    })
    .catch(() => null);
}
