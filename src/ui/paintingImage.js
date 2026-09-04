// ROAD-A7: THE PAINTING'S PICTURE. DaggerfallInventoryWindow's
// ShowInfoPopup painting arm (:1619-1631, MIT Daggerfall Workshop):
//
//     ImageData paintingImg = ImageReader.GetImageData(
//         item.GetPaintingFilename(), item.GetPaintingFileIdx(), 0, true, true);
//     messageBox.ImagePanel... = paintingImg;
//     messageBox.ClickAnywhereToClose = true;
//
// The filename and the record index come out of InitPaintingInfo -
// `(paintingIndex >> 3) + 'A'` names one of A..W PAINT.CIF and
// `paintingIndex & 7` names the record inside it (itemInfo.js has
// that half). This module is the other half: the CIF -> texture, and
// the cache in front of it.
//
// AUDIT 39 F156 loaded PAINT.DAT and got the DESCRIPTION right; the
// picture itself was still nowhere - the port's Info box for a
// painting drew the text and no painting.
//
// The registration shape is loadMagicRegistries' and setPaintFile's,
// for the same reason both of those exist: the info box is drawn from
// a window that holds an item and a font, with nowhere to thread a
// renderer, a palette and a file reader through. The inventory
// window's own art preload already receives all three, so it hands
// them here on the way past.

import { CifRciFile } from '../formats/cifRciFile.js';
import { bitmapToColor32 } from './hud.js';

let _deps = null;
/** { renderer, fetchBytes, palette } - the inventory art preload's own
 *  deps object, registered on the way through. */
export function setPaintingArtDeps(deps) {
  _deps = (deps?.renderer && deps?.fetchBytes && deps?.palette) ? deps : null;
}
export const paintingArtReady = () => !!_deps;

/** key -> { tex, w, h } once loaded, null once known-bad. A key that
 *  is not present at all has never been asked for. */
const _cache = new Map();
const _pending = new Set();
export function _resetPaintingImagesForTests() { _cache.clear(); _pending.clear(); _deps = null; }

const keyOf = (info) => `${info?.filename ?? ''}:${info?.fileIdx ?? 0}`;

/** The painting's texture, or null while it is still coming (or if it
 *  never will). SYNCHRONOUS by design - the draw pass asks every frame
 *  and the first ask starts the load, the icon drawer's shape. Frame 0
 *  of the record, as GetImageData's third argument says. */
export function paintingImage(info) {
  if (!info?.filename) return null;
  const key = keyOf(info);
  if (_cache.has(key)) return _cache.get(key);
  if (!_deps || _pending.has(key)) return null;
  _pending.add(key);
  (async () => {
    try {
      const cif = new CifRciFile();
      const name = info.filename;
      cif.load(await _deps.fetchBytes(name), name, _deps.palette);
      const bmp = cif.getDFBitmap(info.fileIdx, 0);
      _cache.set(key, {
        tex: _deps.renderer.uploadTexture('img', `paint:${key}`, bitmapToColor32(bmp, _deps.palette)),
        w: bmp.width, h: bmp.height,
      });
    } catch (e) {
      console.warn(`[painting] ${info.filename} record ${info.fileIdx} unavailable:`, e?.message ?? e);
      _cache.set(key, null);   // asked and answered - never retried
    } finally { _pending.delete(key); }
  })();
  return null;
}
