// @ts-check
// WBX3 (2026-09-26, Mac: "Loot drops should show their sprite and have a small colored loot line that extrudes from the
// sprite itself"): AN ITEM'S OWN PICTURE, FOR THE WORLD'S GL - the picture the pack shows (systems/itemTemplates.js
// inventoryItemImage: the archive, the record and the item's dye), through the pack's own door (ui/textureCanvas.js
// requestIcon - the vendored arm, a replacement by the dye, the classic TEXTURE file with its mask stripped), handed back
// in the port's color32 order (formats/color32Order.js - a canvas reads top row first; the GL wants the bottom row
// first), so a world billboard can wear it. ONE LAW with the pack: the floor never draws an item the pack would draw
// differently.
//
// `key` names the picture (its archive, record and dye), so two pieces that look alike share one upload. Null for an
// item with no picture, a picture that has not come in ICON_WAIT_MS, and a page with no canvas (node - the pins).
//
// Not a DFU member. Ledger A (WB).
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { requestIcon } from './textureCanvas.js';
import { dyeToken } from '../characters/dyes.js';
import { toColor32 } from '../formats/color32Order.js';

/** How long a picture is waited for before the piece keeps its pile, and how often it is asked for meanwhile. */
export const ICON_WAIT_MS = 4000;
export const ICON_ASK_MS = 200;

/** The picture's key: archive, record and dye - what makes two pictures the same. Pure. */
export function itemIconKey(img) {
  const token = dyeToken(img?.dye ?? null);
  return `${img?.archive}_${img?.record}${token ? `_${token}` : ''}`;
}

/**
 * The item's own picture as `{ key, width, height, colors }` (color32 order), or null.
 * @param {any} item
 * @param {{ wait?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<{key: string, width: number, height: number, colors: Uint8ClampedArray}|null>}
 */
export async function itemIconColor32(item, { wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const img = item ? inventoryItemImage(item) : null;
  if (img?.archive == null || !Number.isInteger(img.record) || typeof document === 'undefined' || typeof Image === 'undefined') return null;
  let url = null;
  for (let t = 0; !url && t <= ICON_WAIT_MS; t += ICON_ASK_MS) {
    url = requestIcon(img.archive, img.record, { scale: 1, dye: img.dye });   // the first ask starts the load; the cache answers after
    if (!url) await wait(ICON_ASK_MS);
  }
  if (!url) return null;
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    const cv = document.createElement('canvas');
    cv.width = el.naturalWidth; cv.height = el.naturalHeight;
    const cx = cv.getContext('2d');
    if (!cx || !(cv.width > 0) || !(cv.height > 0)) return null;
    cx.drawImage(el, 0, 0);
    const raster = cx.getImageData(0, 0, cv.width, cv.height).data;
    const c = toColor32({ width: cv.width, height: cv.height, data: new Uint8Array(raster.buffer, raster.byteOffset, raster.byteLength) });
    return { key: itemIconKey(img), ...c };
  } catch { return null; }
}
