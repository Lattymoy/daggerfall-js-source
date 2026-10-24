// CONTAINER-PEEK - WHAT A HOUSE CONTAINER'S PLAQUE MAY LIST.
//
// World Tooltips names a Chest a Chest (worldTooltips.js houseContainerHover).
// The port's plaque already lists a pile and a body. A cupboard is neither:
// its list does not exist until the press stocks it (shopStock.js
// needsRestock, the interior's container arm), and the press is what asks
// the private-property question. This module answers the list the plaque
// may paint, and nothing else. It does not stock, does not roll, and does
// not write the container.
//
// An unstocked cupboard, a cupboard due to restock, somebody else's home
// and a hall's furniture (the click opens the guild chest) answer null.
// The plaque then stays a name, so it never says "Empty" over a list that
// has not been rolled. The player's own storage, and a stranger's cupboard
// already stocked today, answer the array the window would open.
import { needsRestock } from './shopStock.js';

/**
 * The items a `container:` key already holds, or null when the plaque
 * should stay a name.
 *
 * `owned` is the player's own house or ship: stockedDate stays 1, which
 * needsRestock would call stale, and the array is their storage.
 * `shut` is a home or a room that is not theirs. `hall` is a guild hall
 * or a palace, whose cupboards open the Stores chest rather than `c.items`.
 * `unborn` (OUTDOOR-LOOT, DESIGN 6.4): an online stranger's cupboard the ROOM has not spoken about and this client has not
 * opened - whatever list it holds is a roll that is no one's word (the scene cache's, an opener's before its Yes), so the
 * plaque names it and lists nothing, as it does one that has not been stocked.
 */
export function containerPreviewItems(key, containers, { owned = false, shut = false, hall = false, today = 0, unborn = false } = {}) {
  if (typeof key !== 'string' || !key.startsWith('container:')) return null;
  if (shut || hall || unborn) return null;
  const c = containers?.[Number(key.slice('container:'.length))];
  if (!c || !Array.isArray(c.items)) return null;
  if (!owned && needsRestock(c, today)) return null;
  return c.items;
}

/**
 * The items a placed storage piece already holds, or null.
 * A chair, a station and a piece that is somebody else's answer null.
 * `itemsOf` is the room's own reader and is asked only for a storage piece.
 */
export function decorPreviewItems(key, { pieceOf = null, itemsOf = null, shut = false } = {}) {
  if (shut || typeof key !== 'string' || !key.startsWith('decor:')) return null;
  const piece = pieceOf?.(key.slice('decor:'.length));
  if (!piece?.storage) return null;
  const items = itemsOf?.(key.slice('decor:'.length));
  return Array.isArray(items) ? items : null;
}

/** The interior host's one contents reader for both families. */
export function interiorHeldPreview(key, bag = {}) {
  if (typeof key !== 'string') return null;
  if (key.startsWith('container:')) return containerPreviewItems(key, bag.containers, bag);
  if (key.startsWith('decor:')) return decorPreviewItems(key, bag);
  return null;
}

/**
 * The interior host's contents rung, built once (HOST-SPLIT: the host wires it, it does not grow it). Each getter is
 * the host's own word, read only while the plaque is over a `container:` or a `decor:` key - a pile, a body and a door
 * never ask the room who owns it. `unborn(key)`: whether the room's cupboard is one this client has not heard of
 * (OUTDOOR-LOOT) - asked of a stranger's cupboard alone; the player's own storage lists what it holds.
 */
export function createInteriorPeek({ containers, decor, owned, shut, hall, today, unborn = () => false }) {
  return (key) => (typeof key === 'string' && (key.startsWith('container:') || key.startsWith('decor:'))
    ? interiorHeldPreview(key, {
      containers: containers(), pieceOf: (id) => decor()?.pieceOf(id), itemsOf: (id) => decor()?.itemsOf(id),
      owned: owned(), shut: shut(), hall: hall(), today: today(), unborn: !owned() && !!unborn(key),
    })
    : null);
}
