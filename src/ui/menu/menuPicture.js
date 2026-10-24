// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MENU-ORDER (2026-10-12) — A PIECE'S PICTURE FOR A MENU'S ROW.
//
// The owner, of the stores and the crafting menus: "I just feel like text lists are too much". A material in the
// Stores, a row on the Market and a trader's piece show the game's own item picture beside their name: the picture of
// the item the Stores would hand out (systems/professions/profItems.js mintMaterialItem), or of the piece itself, read off its
// inventory record (systems/item/itemTemplates.js inventoryItemImage) and fitted to a row's box (ui/textureCanvas.js
// requestFittedIcon - the pack's and the shop's own door). It is read from the player's data at runtime and never
// shipped (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA); with no data, there is none, and the row is words as
// before.
//
// The tabs that draw these rows read no game law of their own (the Notice Board's tabs and the Stores page take what
// they show from their hosts), so the host hands them these two as `picture`: `(key|item, wake) => { src, w, h } | null`
// - null while the picture is made, `wake` called when it lands; the tab draws it with ui/menu/menuGlyphs.js pictureNode.
// ═══════════════════════════════════════════════════════════════════

import { inventoryItemImage } from '../../systems/item/itemTemplates.js';
import { mintMaterialItem } from '../../systems/professions/profItems.js';
import { requestFittedIcon } from '../textureCanvas.js';
import { screenDpr, SLOT_BOX } from '../iconFit.js';

/** A menu row's picture box - the shop's row's (UI1). */
export const MENU_PICTURE_BOX = SLOT_BOX.row;

/** A piece's picture, fitted: `{ src, w, h }`, or null while it is made (`onReady` when it lands) or for none. */
export function itemPicture(item, { box = MENU_PICTURE_BOX, onReady = null } = /** @type {any} */ ({})) {
  let img = null;
  try { img = item ? inventoryItemImage(item) : null; } catch { img = null; }
  if (!img?.archive) return null;
  return requestFittedIcon(img.archive, img.record, { box, dpr: screenDpr(), dye: img.dye ?? null, dyeTarget: img.dyeTarget ?? null, onReady });
}

/** A material's picture - the item the Stores would withdraw it as, pictured; null for a key with no item. */
export function materialPicture(key, opts = undefined) {
  let item = null;
  try { item = mintMaterialItem(key); } catch { item = null; }
  return itemPicture(item, opts);
}
