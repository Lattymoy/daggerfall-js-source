// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR2b (2026-09-25) — THE FURNISHER.
//
// Mac: decor "sold at shops not available in the world loot pool";
// asked, the furniture shop sells Daggerfall's own furniture,
// "delivered", and a delivered piece's look is its owner's to pick
// ("You pick it").
//
// Daggerfall has a Furniture group of twenty-nine items - beds, tables
// and chairs from oak to teak, curtains, pillows, rugs, tapestries and
// skins (ItemTemplates.txt 217-245) - that no loot table rolls and no
// shop ever sold: its Furniture Stores stand with empty shelves
// (DaggerfallLoot.StockShopShelf skips the group). Here the Furniture
// Store sells them, by Daggerfall's own stock law (a piece's rarity
// within the shop's quality, then the dice by its rarity) at
// Daggerfall's own prices (systems/shopStock.js).
//
// A bed weighs up to seven hundred and fifty, so nothing bought here is
// carried: it is DELIVERED - kept with the character (the save's
// `furnishings`) and set down from the decorate panel's "Your things",
// free, in any room the player may decorate, as whichever of
// Daggerfall's own pieces of its kind the owner picks: a bed any of the
// game's beds; a table or a chair any of its furniture; curtains, a
// rug, a tapestry or skins any furniture or decoration. A pillow has a
// picture of its own and stands as it. Taken down it is delivered
// again, and a room sold gives it back the same way.
// ═══════════════════════════════════════════════════════════════════

import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import { itemLongName } from './itemInfo.js';
import { decorDescriptorOf, decorItemFlat } from './decorItems.js';

/** Daggerfall's Furniture group, 217 to 245. */
export const FURNITURE_TEMPLATES = Object.freeze([...(GROUP_TEMPLATE_INDICES.Furniture ?? [])]);
/** The beds: plain and fancy, single and double. */
export const FURNISH_BEDS = Object.freeze(new Set([217, 218, 219, 220]));
/** The tables (large and small, oak, cherry, mahogany and teak) and the chairs (the same four woods). */
export const FURNISH_TABLES_AND_CHAIRS = Object.freeze(new Set([221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232]));
/** The pillows - the two with a picture of their own (TEXTURE.200 record 11), which stand as it. */
export const FURNISH_PILLOWS = Object.freeze(new Set([235, 236]));
/** Whether an item is a piece of furniture (Daggerfall's Furniture group) - delivered, never carried. */
export const isFurnishing = (item) => item?.group === 'Furniture' && FURNITURE_TEMPLATES.includes(item?.templateIndex);

/** The catalogue kinds a furnishing may take its look from (systems/decorCatalogue.js), or null for one with a
 *  picture of its own (a pillow) - and for anything that is no furnishing. */
export function furnishingKinds(item) {
  if (!isFurnishing(item)) return null;
  const t = item.templateIndex;
  if (FURNISH_PILLOWS.has(t)) return null;
  if (FURNISH_BEDS.has(t)) return ['bed'];
  if (FURNISH_TABLES_AND_CHAIRS.has(t)) return ['furniture'];
  return ['furniture', 'decor'];   // curtains, rugs, tapestries, skins
}

/** The catalogue entries a furnishing may become - its kinds' own. */
export function furnishingLooks(item, entries) {
  const kinds = furnishingKinds(item);
  return kinds ? (entries ?? []).filter((e) => kinds.includes(e.kind)) : [];
}

/**
 * The decorate panel's row for one delivered piece - `{ key, kind: 'own', own, furnishing: true, name, flat, looks,
 * item, ... }`: `looks` the kinds its shape is chosen among, or null when it stands as its own picture (`flat`, a
 * pillow's) - or null for anything that is no furnishing.
 */
export function decorFurnishingEntry(item, index) {
  if (!isFurnishing(item)) return null;
  const descriptor = decorDescriptorOf(item);
  if (!descriptor) return null;
  const looks = furnishingKinds(item);
  const flat = decorItemFlat(item);   // a pillow's; the rest of the group has none (ItemTemplates.txt: world 0, 0)
  if (!looks && !flat) return null;
  return {
    key: `furnish:${index}`, kind: 'own', own: item, furnishing: true, name: itemLongName(item), model: null, flat,
    looks, light: null, item: descriptor, storage: false, count: item.stackCount ?? 1,
    icon: flat ? { archive: flat[0], record: flat[1], dye: null } : null,
  };
}

/** What is said of pieces of furniture come back from a room - a sale, or a piece the online room no longer stands:
 *  back among "Your things", never the pack. */
export const furnishingBackLine = (n) => (n === 1 ? 'A piece of your furniture came back to Your things.'
  : `${n} pieces of your furniture came back to Your things.`);
/** The lines for one's own things come back from a room: the pack's (`packLine(n)`), then the furniture's. */
export function ownBackLines(items, packLine) {
  const furn = items.filter(isFurnishing).length;
  const rest = items.length - furn;
  return [rest ? packLine(rest) : null, furn ? furnishingBackLine(furn) : null].filter(Boolean).join(' ');
}

/** What is said when furniture is bought (or stolen) - it is delivered, not carried: the one piece by name, several by
 *  their count. */
export const furnishingDeliveredLine = (names) => (names.length === 1
  ? `The ${names[0]} will be delivered - set it down from the Decorate panel in any room you can decorate.`
  : `${names.length} pieces of furniture will be delivered - set them down from the Decorate panel in any room you can decorate.`);
