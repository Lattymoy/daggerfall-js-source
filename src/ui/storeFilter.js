// @ts-check
// WAGON-FILTER (2026-10-04, Mac: "The wagon needs a filter option"). THE PLAYER'S OWN STORES, FILTERED.
//
// DFU's inventory window filters only the LOCAL list: its four tabs are AddLocalItem's (nativeInventory.js tabAccepts),
// and the remote list - the wagon, a chest, a corpse - is shown whole. A wagon holds 750 kg and the player fills it with
// everything the pack cannot carry, so finding the one ingot in it meant scrolling the lot. The enhanced pack's remote
// pane now carries a filter while it shows one of the player's OWN stores: the wagon, their storage (the ship's chest,
// a house's cupboards, a placed chest - SHIP-STORE) and the Materials Bag. A corpse, a container, the ground and a
// reward tray stay as they were: those are a glance and a take, and their window never scrolls (PX21e).
//
// AUDIT WAGON-FILTER C1: ONE ROW - the search and a category menu side by side. The first cut stood a wrapping row of
// chips under the search and a hint under them, 202-236 px of fixed furniture in a frame PX21e keeps from scrolling:
// measured in Chromium, a phone on its side kept 1 px of the wagon's list (it had 203), and a 1366x625 screen 3 rows of
// 7.
//
// The categories are the pack's own nine pages (packPages.js pageOf - one law for where an item lives, never a second
// copy) plus MATERIALS, the Materials Bag's own test (materialsBag.js isMaterialItem: every herb, food, ore, ingot,
// log, hide and reagent the professions mint). It crosses the pages - an ingot is Misc and a herb Ingredients - which
// is why it stands beside them rather than among them. The search matches the row's own name, lower-cased.
//
// Classic skin: not drawn there. THE NATIVE-WINDOW RULE (bible/Home.md) holds every element of a native window to a DFU
// source, and DFU's window has no control for this; shift-click (ui/native/nativeInventory.js) is the classic skin's half.
import { PACK_PAGES, pageOf } from './packPages.js';
import { isMaterialItem } from '../systems/materialsBag.js';

/** The remote kinds (enhancedInventory.js remoteModel) that are the player's own stores. */
export const STORE_FILTER_KINDS = Object.freeze(new Set(['wagon', 'storage', 'bag']));
/** The categories, in the order the menu lists them: [id, label]. */
export const STORE_FILTERS = Object.freeze([['all', 'All'], ['materials', 'Materials'], ...PACK_PAGES]);
const IDS = new Set(STORE_FILTERS.map(([id]) => id));
/** The filter a store opens on - fresh for every store shown (AUDIT WAGON-FILTER: the wagon's category and search
 *  followed the player into the bag, which showed "Nothing here matches." over a bag that held an ingot). */
export const freshStoreFilter = (kind = null) => ({ kind, cat: 'all', query: '' });

/** Whether an item answers a category. Total over the ids; an id the list does not have answers everything. */
export const storeFilterAccepts = (it, cat) => (!IDS.has(cat) || cat === 'all' ? true : cat === 'materials' ? isMaterialItem(it) : pageOf(it) === cat);

/** The search's own form of a typed text: trimmed, lower-cased, at most 40 characters. */
export const storeQuery = (q) => String(q ?? '').trim().toLowerCase().slice(0, 40);

/**
 * The items a filter shows, in the store's own order. `nameOf` is the row's name (enhancedInventory.js itemLine), so
 * what the search reads is what the row says. Pure.
 * @param {any[]} items
 * @param {{ cat?: string, query?: string }} filter
 * @param {(it: any) => string} nameOf
 */
export function filterStore(items, { cat = 'all', query = '' } = {}, nameOf = (it) => it?.name ?? '') {
  const q = storeQuery(query);
  return items.filter((it) => storeFilterAccepts(it, cat) && (!q || String(nameOf(it) ?? '').toLowerCase().includes(q)));
}

/**
 * The menu's entries: All, then every category the store holds something of, each with its count - and the chosen one
 * even when it holds nothing now (the last ingot just taken out), so the choice never vanishes from under the hand.
 * @param {any[]} items
 * @param {string} chosen
 * @returns {{ id: string, label: string, count: number }[]}
 */
export function storeFilterOptions(items, chosen = 'all') {
  const out = [];
  for (const [id, label] of STORE_FILTERS) {
    const count = id === 'all' ? items.length : items.filter((it) => storeFilterAccepts(it, id)).length;
    if (id === 'all' || count > 0 || id === chosen) out.push({ id, label, count });
  }
  return out;
}
