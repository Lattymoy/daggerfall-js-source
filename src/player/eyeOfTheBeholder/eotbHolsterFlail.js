// @ts-check
// FLAIL-BACK (2026-10-31, the owner: "The flail when holstered on the back needs to look different. Adjust the
// placement of the ball and chain"). Stood up as the doll draws it (eotbHolster.js uprightWeaponPicture), the chain
// stuck out sideways from the cap and the ball rode the top like a flag. On the back the handle stands cap up, its
// hand gap bridged, and the chain hangs from the cap down beside it, the ball by the handle's foot. The split is the
// hands' own (layeredWeapon.js heldPicture, heldChain).
import { uprightWeaponPicture, loadHolsterPicture, PAPERDOLL_MPP } from './eotbHolster.js';
import { heldPicture, heldChain, layeredWeaponOf } from './layeredWeapon.js';
import { EOTB_FIGURE } from '../../render/auraRing.js';
import { itemIconColor32 } from '../../ui/item/itemIconColor32.js';
import { drawnPiece } from '../../net/appearanceLaw.js';

/** Doll px between the handle's edge and the hanging chain's: none, the top link against the cap. */
export const FLAIL_BACK_GAP = 0;

/** Is this item drawn as a flail (the Flail, the Light Flail)? */
export const isFlailItem = (item) => /^(fl|lf)/.test(layeredWeaponOf(item) ?? '');

/**
 * A flail's picture for the back: as uprightWeaponPicture's answer (color32, row 0 the bottom, `mirror`, `w` and `h`
 * in metres), the handle upright, cap on top, the chain and ball hanging from the cap beside it. A picture the hands
 * cannot split is stood up as any weapon is. Pure.
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function uprightFlailPicture(img) {
  const P0 = heldPicture(img), P = P0 ? heldChain(P0) : null;
  if (!P?.chain) return uprightWeaponPicture(img);
  const W = img.width, H = img.height, C = P.chain, hand = P.handle.colors, bridge = P.bridge?.colors ?? null;
  const at = (x, y) => (y * W + x) * 4;
  const top = (C.x - P.gx) * P.ux + (C.y - P.gy) * P.uy;   // the cap, along the handle from the grip
  let s0 = Infinity, c0 = Infinity, c1 = -Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hand[at(x, y) + 3] <= 127 && !(bridge && bridge[at(x, y) + 3] > 127)) continue;
    const s = (x - P.gx) * P.ux + (y - P.gy) * P.uy, c = (x - P.gx) * P.rx + (y - P.gy) * P.ry;
    if (s < s0) s0 = s;
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
  }
  const off = c1 + FLAIL_BACK_GAP + C.half;   // the chain's middle, beside the handle
  const sMin = Math.min(s0, top - C.len), sMax = top + 1, cMin = c0, cMax = off + C.half;
  const step = EOTB_FIGURE.mpp / PAPERDOLL_MPP;
  const oh = Math.max(1, Math.ceil((sMax - sMin + 1) / step)), ow = Math.max(1, Math.ceil((cMax - cMin + 1) / step));
  /** @returns {number} the source px at (s, c), its byte offset in `buf` - or -1 */
  const sample = (s, c) => {
    const x = Math.round(P.gx + P.ux * s + P.rx * c), y = Math.round(P.gy + P.uy * s + P.ry * c);
    if (x >= 0 && y >= 0 && x < W && y < H) {
      if (hand[at(x, y) + 3] > 127) return at(x, y);
      if (bridge && bridge[at(x, y) + 3] > 127) return -2 - at(x, y);
    }
    const a = top - s, b = c - off;   // down the chain from the cap, and across it
    if (a < -0.5) return -1;
    const cx = Math.round(C.x + C.dx * (a + (C.lead ?? 0)) - C.dy * b), cy = Math.round(C.y + C.dy * (a + (C.lead ?? 0)) + C.dx * b);
    return cx >= 0 && cy >= 0 && cx < W && cy < H && C.img.colors[at(cx, cy) + 3] > 127 ? -1e9 - at(cx, cy) : -1;
  };
  const out = new Uint8Array(ow * oh * 4), mirror = new Uint8Array(ow * oh * 4);
  for (let row = 0; row < oh; row++) for (let col = 0; col < ow; col++) {
    let k = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const q = sample(sMin - 0.5 + (row + (i + 0.5) / 3) * step, cMin - 0.5 + (col + (j + 0.5) / 3) * step);
      if (q === -1) continue;
      const [buf, o] = q >= 0 ? [hand, q] : q > -1e9 ? [/** @type {ArrayLike<number>} */ (bridge), -2 - q] : [C.img.colors, -1e9 - q];
      k++; r += buf[o]; g += buf[o + 1]; b += buf[o + 2];
    }
    if (k < 3) continue;
    for (const [buf, cc] of /** @type {[Uint8Array, number][]} */ ([[out, col], [mirror, ow - 1 - col]])) {
      const o = (row * ow + cc) * 4;
      buf[o] = Math.round(r / k); buf[o + 1] = Math.round(g / k); buf[o + 2] = Math.round(b / k); buf[o + 3] = 255;
    }
  }
  return { width: ow, height: oh, colors: out, mirror, w: ow * step * PAPERDOLL_MPP, h: oh * step * PAPERDOLL_MPP };
}

/** BACK-HOLSTER's picture door (eotbHolster.js loadHolsterPicture), a flail's FLAIL-BACK's. */
export async function loadBackPicture(item, identity) {
  if (!isFlailItem(item)) return loadHolsterPicture(item, identity);
  const img = await itemIconColor32(drawnPiece(item), { identity: identity ?? undefined });
  return img ? uprightFlailPicture(/** @type {any} */ (img)) : null;
}
