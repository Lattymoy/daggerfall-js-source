// OVH2 - A UI PACK'S PICTURE ON THE GPU. The one door every classic art loader asks before it uploads its own
// decode of the ARENA2 file: given the worn pack's URL for that picture (systems/uiPack.js), the pack's PNG, decoded
// in screen order and uploaded SMOOTH (LINEAR/CLAMP - a 3x picture drawn at the integer scale nativePanel picks is a
// non-integer ratio, where NEAREST aliases) and ALPHA (the renderer blends it wherever it is drawn - the pack is
// soft-edged where the classic art was a 1-bit cutout). The caller keeps the classic w/h as the logical size.
//
// A picture the pack does not carry, or one that does not load, answers null and the classic art stands - a missing
// file must never cost a player a window.
import { packImgUrl, packCifRciUrl, packColourUrl, packBytes } from '../systems/uiPack.js';

const _byRenderer = new WeakMap();   // renderer -> Map<url, Promise<tex|null>>
let _decode = null;                  // test seam: bytes -> { width, height, data }

/** The pack texture for `url` (null when there is none), uploaded once per renderer. */
export function packTexture(renderer, url) {
  if (!url || typeof renderer?.uploadTexture !== 'function') return Promise.resolve(null);
  let cache = _byRenderer.get(renderer);
  if (!cache) _byRenderer.set(renderer, (cache = new Map()));
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const { toScreenOrder } = await import('../formats/color32Order.js');
      const decode = _decode ?? (await import('../systems/textureReplacement.js')).decodePng;
      const px = toScreenOrder(await decode(await packBytes(url)));
      return renderer.uploadTexture('pack', url, px, { smooth: true, alpha: true });
    })().catch((e) => { console.warn(`[ui pack] ${url} did not load - the classic art stands:`, e?.message ?? e); return null; });
    cache.set(url, p);
  }
  return p;
}
/** The worn pack's texture for an IMG, a CIF/RCI record, or a save window colour texture - or null. */
export const packImgTexture = (renderer, name) => packTexture(renderer, packImgUrl(name));
export const packCifRciTexture = (renderer, file, record, frame = 0) => packTexture(renderer, packCifRciUrl(file, record, frame));
export const packColourTexture = (renderer, name) => packTexture(renderer, packColourUrl(name));

export function _setPackDecodeForTests(fn) { _decode = fn; }
