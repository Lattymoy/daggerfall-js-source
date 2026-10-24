// @ts-check
// THE LISTS A REALM CHARACTER HOLDS (INT2, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): what the item law
// judges and the id ledger reads (server-account/src/judge.js ledgerPieces). Moved here from the judge by AUDIT AUTO-HOLD
// (2026-10-16): the client's shelf asks the same question - which pieces does this character hold? - of the last save
// that landed (scenes/realmHoldHost.js), so a piece stowed in a ship's hold or a room's chest never lands back off a
// stale shop shelf as a second of itself. One home: the judge hands it on.
import { deedsOf } from '../../net/realm/realmGoldLaw.js';

const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
const arrayOf = (/** @type {unknown} */ x) => (Array.isArray(x) ? x : []);
const objectOf = (/** @type {unknown} */ x) => (x && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : {});

/** Come Sail Away's, the sea fight's and the feud's records in a save's per-mod slot (realmGoldLaw.js's own names). */
const CSA_VENDOR = 'come-sail-away', NAVAL_VENDOR = 'NavalCombat', REVENANT_VENDOR = 'Revenant';
/** A building's interior, by the name the scene cache files it under (sceneCache.js interiorSceneName; realmGoldLaw.js
 *  keeps the same). */
const interiorSceneName = (/** @type {unknown} */ mapId, /** @type {unknown} */ buildingKey) => `DaggerfallInterior [MapID=${mapId}, BuildingKey=${buildingKey}]`;

/**
 * THE LISTS THE CHARACTER HOLDS - what the item law judges and the id ledger reads: its five own lists (the pack, the
 * wagon, the Materials Bag, the furnisher's deliveries, the repairer's shelf); what it set out in a room (DECOR2a
 * `decorOwn`) or stored there (DECOR1c `decorItems`); the chests of the rooms its deeds stand for and of the rooms it
 * rents (tavern.js - a room's chest is the renter's); a boat's hold and its cargo; a companion's pack; a sworn
 * revenant's pack. Never what lies on the ground (groundItemLists - anyone may take a pile up), and never a list the
 * world fills: a dungeon's chest, a body, a shop's shelf.
 * @param {any} save
 */
export function possessedItemLists(save) {
  const out = lists(save?.items, save?.wagonItems, save?.bagItems, save?.furnishings, save?.otherItems);
  const rooms = new Set(deedsOf(save).map((d) => d.room).filter(Boolean));
  const rented = new Set(arrayOf(save?.rentedRooms).map((r) => interiorSceneName(/** @type {any} */ (r)?.mapId, /** @type {any} */ (r)?.buildingKey)));
  for (const scene of arrayOf(save?.sceneCache?.scenes)) {
    const sc = /** @type {any} */ (scene);
    for (const piece of Object.values(objectOf(sc?.decorOwn))) if (piece && typeof piece === 'object') out.push([piece]);
    for (const held of Object.values(objectOf(sc?.decorItems))) out.push(...lists(held));
    if (rooms.has(sc) || rented.has(sc?.sceneName)) for (const c of arrayOf(sc?.lootContainers)) out.push(...lists(/** @type {any} */ (c)?.items));
  }
  const csa = save?.modData?.[CSA_VENDOR];
  for (const boat of arrayOf(csa?.placedBoats)) out.push(...lists(/** @type {any} */ (boat)?.Items));
  out.push(...lists(...Object.values(objectOf(csa?.packedCargoes))));
  for (const c of arrayOf(save?.modData?.[NAVAL_VENDOR]?.party?.party)) out.push(...lists(/** @type {any} */ (c)?.items));
  for (const r of arrayOf(save?.modData?.[REVENANT_VENDOR]?.list)) if (/** @type {any} */ (r)?.sworn && !/** @type {any} */ (r).defeated) out.push(...lists(/** @type {any} */ (r).companion?.items));
  for (const r of arrayOf(save?.modData?.[REVENANT_VENDOR]?.list)) if (/** @type {any} */ (r)?.sworn && !/** @type {any} */ (r).defeated) out.push(...lists(Object.values(objectOf(/** @type {any} */ (r).companion?.gear)).filter((it) => it && typeof it === 'object')));   // RVN-GEAR: and the kit it wears (revenantGear.js)
  return out;
}

