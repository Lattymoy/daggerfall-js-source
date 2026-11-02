// @ts-check
// BACK-SHIELD (2026-10-31, the owner: "Implement the shield holstered on the back. The weapon should sit behind the
// shield"): a sheathed layered body's shield on its back, mine and every walker's. It hangs by the holster's law
// (eotbHolster.js hangSpriteHolster) with its own spec: upright on the spine, farther out than the sheathed weapon, so
// from behind it lies over the weapon and from before both are behind the body's card. Its face from behind, its inside
// from before, edge on from aside. The picture is the paper doll's (layeredShield.js), at the sprites' texel size.

import { EOTB_FIGURE } from '../../render/auraRing.js';
import { RECORD_OFFSETS, ORIENTATIONS } from './eotbBillboard.js';
import { PAPERDOLL_MPP, HOLSTER_RETRY_MS } from './eotbHolster.js';
import { loadShieldPicture, shieldPicture } from './layeredShield.js';

/** The shield's hang (hangSpriteHolster's spec): upright, its top a little over the shoulder line, farther behind the
 *  body than the weapon's (BACK_HOLSTER: 0.16, from aside 0.03 past the painted back), so the weapon lies under it. */
export const BACK_SHIELD = Object.freeze({ tilt: 0, back: 0.24, clear: 0.08, over: 0.18, nudge: 0.03 });
/** Its width's share by the record offset (0 front .. 4 back): turned with the body, edge on from aside. */
export const BACK_SHIELD_SQUEEZE = Object.freeze([0.92, 0.72, 0.3, 0.72, 0.92]);

/**
 * A shield's back picture: its face (`colors`, as seen from behind) and its inside turned round (`mirror`, as seen from
 * before), color32 RGBA with row 0 the bottom, resampled at the sprites' texel size; `w` and `h` its quad in metres on a
 * figure the sets' size (a picture px is a centimetre, PAPERDOLL_MPP). Null for no picture. Pure.
 * @param {any} P shieldPicture's
 */
export function backShieldPicture(P) {
  if (!P) return null;
  const step = EOTB_FIGURE.mpp / PAPERDOLL_MPP, W = Math.max(1, Math.ceil(P.width / step)), H = Math.max(1, Math.ceil(P.height / step));
  const colors = new Uint8Array(W * H * 4), mirror = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
    for (const [img, out, flip] of /** @type {[Uint8Array, Uint8Array, boolean][]} */ ([[P.face, colors, false], [P.inside, mirror, true]])) {
      let k = 0, r = 0, g = 0, b = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = Math.floor((col + (j + 0.5) / 3) * step), y = Math.floor((H - 1 - row + (i + 0.5) / 3) * step);
        const X = flip ? P.width - 1 - x : x;
        if (X < 0 || y < 0 || X >= P.width || y >= P.height) continue;
        const q = (y * P.width + X) * 4;
        if (!img[q + 3]) continue;
        k++; r += img[q]; g += img[q + 1]; b += img[q + 2];
      }
      if (k < 3) continue;
      out.set([Math.round(r / k), Math.round(g / k), Math.round(b / k), 255], (row * W + col) * 4);
    }
  }
  return { width: W, height: H, colors, mirror, w: W * EOTB_FIGURE.mpp, h: H * EOTB_FIGURE.mpp };
}

/** The renderer's archive a back shield is uploaded under (record 0 its face, 1 its inside turned round). */
export const backShieldArchive = (body, code) => `eotb-backshield:${body}:${code}`;

/**
 * One layer's back shields: `ensure(code, body)` answers `{ archive, w, h, pic }` once that shield's picture is up, else
 * null - in flight, or none to be had (asked again after HOLSTER_RETRY_MS). One upload a body and shield code, again if
 * the renderer let it go.
 * @param {() => any} getRenderer @param {(code: string, body: string) => Promise<any>} [load] @param {() => number} [clock]
 */
export function createBackShieldArt(getRenderer, load = loadShieldPicture, clock = () => Date.now()) {
  /** @type {Map<string, any>} `${body}:${code}` -> Promise in flight | { archive, w, h, pic } | { failedAt } */
  const art = new Map();
  const upload = (renderer, a) => {
    renderer.uploadTexture(a.archive, 0, { width: a.pic.width, height: a.pic.height, colors: a.pic.colors });
    renderer.uploadTexture(a.archive, 1, { width: a.pic.width, height: a.pic.height, colors: a.pic.mirror });
  };
  return {
    ensure(code, body) {
      const renderer = getRenderer();
      if (!renderer || !code) return null;
      const key = `${body}:${code}`, v = art.get(key);
      if (v instanceof Promise) return null;
      if (v?.archive) {
        if (renderer.textures?.has && !renderer.textures.has(`${v.archive}_0`)) upload(renderer, v);
        return v;
      }
      if (v && clock() - v.failedAt < HOLSTER_RETRY_MS) return null;
      const p = Promise.resolve().then(() => load(code, body)).then((img) => {
        const pic = img ? backShieldPicture(shieldPicture(img, code)) : null, r = getRenderer();
        if (art.get(key) !== p) return;
        if (!pic || !r) { art.set(key, { failedAt: clock() }); return; }
        const a = { archive: backShieldArchive(body, code), w: pic.w, h: pic.h, pic };
        upload(r, a);
        art.set(key, a);
      }, () => { if (art.get(key) === p) art.set(key, { failedAt: clock() }); });
      art.set(key, p);
      return null;
    },
  };
}

/** The shield's art as this view sees it: its width turned with the body (BACK_SHIELD_SQUEEZE). */
export function backShieldSeen(a, view) {
  const rec = RECORD_OFFSETS[((view % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS];
  return a ? { ...a, w: a.w * BACK_SHIELD_SQUEEZE[rec] } : null;
}
