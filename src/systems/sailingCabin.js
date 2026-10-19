// SAILING-CABINS: each owned, enclosed sailing ship has its own housing interior.
// The bank's rooms are templates only: no bank deed, balance or ownedShip flag is changed.
import { SHIP_TYPES } from './banking.js';
import { WA_SHIP_BLOCKS } from './warmAshesShips.js';

// The open Rowboat / Large Boat have no cabin door. The Small Ship uses the small
// room; the Large Galley and Carrack use the large bank-ship room, as requested.
export const cabinShipType = (hull) => hull === 2 ? SHIP_TYPES.Small : hull === 3 || hull === 4 ? SHIP_TYPES.Large : SHIP_TYPES.None;
export const cabinBlockName = (hull) => WA_SHIP_BLOCKS[cabinShipType(hull)] ?? null;
export { boatUid as cabinUid, readSailingCabin } from '../net/boatIdentity.js';
import { boatUid as cabinUid, readSailingCabin } from '../net/boatIdentity.js';
export const cabinSceneName = (uid) => cabinUid(uid) ? `SailingCabin [UID=${uid}]` : null;
export const hasSailingCabin = (boat) => !!boat && !boat.charter && cabinUid(boat.uid) && cabinBlockName(boat.hull) !== null && !boat.inside;   // AUDIT PASSAGE B4: no cabin of mine in a booked ship - what was put in it went with her

export const CABIN_REFUSAL = Object.freeze({
  helm: 'Leave the helm before entering the cabin.',
  aboard: 'Board your ship before entering the cabin.',
  unavailable: 'This ship\'s cabin is unavailable.',
});

// Rechecked on press: a picker may have been open while the boat or player moved.
export function cabinEntryRefusal(boat, { boats = [], sailing = false, disembarking = false, aboard = false } = {}) {
  if (!boats.includes(boat) || !hasSailingCabin(boat) || !boat.GameObject?.activeSelf) return CABIN_REFUSAL.unavailable;
  if (sailing || disembarking) return CABIN_REFUSAL.helm;
  if (!aboard) return CABIN_REFUSAL.aboard;
  return null;
}

/** A restored cabin must belong to a boat in THIS save, not an earlier character. */
export function savedCabinBoat(cabin, record) {
  const c = readSailingCabin(cabin);
  return c ? (record?.placedBoats ?? []).find((b) => b.UID === c.uid && b.Hull === c.hull && !b.inside) ?? null : null;
}
