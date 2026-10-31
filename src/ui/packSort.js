// @ts-check
// PACK-SORT (2026-10-31, Sammy on Discord: "Add a sort button to the inventory!"). THE ORDER ONE PRESS OF SORT PUTS A
// LIST IN: the pack's pages in the spine's order (packPages.js), then rarity high to low (lootRarity.js RARITY_ORDER),
// then the row's own name, then value high to low. Quest items stay at the front in their own order, where DFU's
// transfer puts them (itemTransfer.js, AddPosition.Front). A tie keeps the list's order, so two records of one
// quickslot kind never swap and a slot still uses the same one (quickslots.js uses the first of its kind in the pack).
// One shot: nothing keeps a list sorted, so a drag after it stands and the save carries what the player left.
import { PAGE_IDS, pageOf } from './packPages.js';
import { RARITY_ORDER, rarityOf } from '../systems/loot/lootRarity.js';
import { itemNameParts } from '../systems/item/itemInfo.js';
import { itemValueOf } from '../systems/item/itemTemplates.js';

/** The side window's lists a Sort is offered on: the player's own wagon, Materials Bag and storage (enhancedInventory.js
 *  remoteModel's kinds). Never a container, the ground or a reward tray - those are not the player's to arrange. */
export const SORT_STORE_KINDS = Object.freeze(new Set(['wagon', 'bag', 'storage']));

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
/** The row's own name, as the pack prints it (itemInfo.js itemNameParts: an unidentified piece by what it shows). */
const rowName = (it) => itemNameParts(it).name || it?.name || '';

function keyOf(it, at, nameOf) {
  if (!it) return { it, hole: true, quest: false, page: 0, rank: 0, name: '', value: 0, at };
  const value = itemValueOf(it);
  return {
    it, hole: false, quest: !!it.questItem, at,
    page: PAGE_IDS.indexOf(pageOf(it)),
    rank: RARITY_ORDER.indexOf(rarityOf(it)),
    name: String(nameOf(it) ?? ''),
    value: Number.isFinite(value) ? value : 0,
  };
}

/** The sort's comparison over two items' keys. A hole (a list's stray null) goes last. */
function compareKeys(a, b) {
  if (a.hole !== b.hole) return a.hole ? 1 : -1;
  if (a.quest !== b.quest) return a.quest ? -1 : 1;
  if (a.quest || a.hole) return a.at - b.at;
  return a.page - b.page || b.rank - a.rank || collator.compare(a.name, b.name) || b.value - a.value || a.at - b.at;
}

/**
 * The list in the sort's order, as a new array. `nameOf` is the row's own name (enhancedInventory.js lineOf), so the
 * order a player reads is by the name the row says. Pure.
 * @param {any[]} items
 * @param {{ nameOf?: (it: any) => string }} [opts]
 */
export function sortedItems(items, { nameOf = rowName } = {}) {
  const keyed = (items ?? []).map((it, at) => keyOf(it, at, nameOf));
  keyed.sort(compareKeys);
  return keyed.map((k) => k.it);
}

/**
 * Sorts `list` IN PLACE - the array the save, every page and a later drag read - and answers whether anything moved.
 * @param {any[]} list
 * @param {{ nameOf?: (it: any) => string }} [opts]
 */
export function sortInPlace(list, opts = {}) {
  if (!Array.isArray(list) || list.length < 2) return false;
  const order = sortedItems(list, opts);
  let moved = false;
  for (let i = 0; i < order.length; i++) {
    if (list[i] !== order[i]) { list[i] = order[i]; moved = true; }
  }
  return moved;
}
