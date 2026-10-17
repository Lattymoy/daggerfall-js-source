// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FORAGE3 (2026-09-28): PlayerActivate.OnLootSpawned (PlayerActivate.cs
// :60) - the event ActivateLootContainer raises after it stocks a shop
// shelf (:885) or a house container (:914), with DFU's
// ContainerLootSpawnedEventArgs: the container's type and its items.
//
// ONE HOME for the event (ONE DFU MEMBER, ONE EXPORT): the host that
// stocks - scenes/worldModes.js, both exterior hosts' interiors - raises
// it at each place it stocks, and each mod subscribes by name, in the
// order the mods load (UL1's shape, scenes/corpseMarker.js). RRI2's
// three shelf subscribers are the first (systems/roleplayRealismItems/rriKits.js
// onShopShelfStocked); the hosts had called them by name, and a house
// container raised nothing.
//
// THE ARGS are DFU's two - `containerType`, `items` - and what DFU's
// subscribers read off PlayerEnterExit.Interior.BuildingData and
// GameManager.PlayerEntity, handed by the host instead: `buildingType`,
// `quality`, and the player's live `luck`. `rolls` is the stocking's own
// stream, where the host has one.
// ═══════════════════════════════════════════════════════════════════

import { onShopShelfStocked } from './roleplayRealismItems/rriKits.js';
import { RRI_VENDOR } from './roleplayRealismItems/rriItems.js';

/**
 * @typedef {object} ContainerLootArgs
 * @property {number} containerType   LOOT_CONTAINER_TYPES (ShopShelves 4, HouseContainers 5)
 * @property {object[]} items          the freshly stocked list, added to in place
 * @property {number} [buildingType]   the interior's BUILDING_TYPES
 * @property {number} [quality]        the interior's quality
 * @property {number} [luck]           the player's live Luck
 * @property {() => number} [rolls]
 */

const _handlers = new Map([
  [RRI_VENDOR, (/** @type {ContainerLootArgs} */ a) => {
    onShopShelfStocked(a.items, /** @type {any} */ ({ buildingType: a.buildingType, quality: a.quality, containerType: a.containerType }), a.rolls ? { rolls: a.rolls } : {});
  }],
]);
/** A mod's subscriber, by name; `null` unsubscribes. */
export function registerContainerLootHandler(name, fn) { if (typeof fn === 'function') _handlers.set(name, fn); else _handlers.delete(name); }
/** Every subscriber over one container; one that throws is logged and the rest still run (UL1's rule). Answers the
 *  items, so a host can write `shelf.items = raiseContainerLootSpawned({ ... })`. */
export function raiseContainerLootSpawned(/** @type {ContainerLootArgs} */ args) {
  for (const fn of _handlers.values()) {
    try { fn(args); } catch (e) { console.warn('[lootSpawned] a container handler threw', e); }
  }
  return args.items;
}
