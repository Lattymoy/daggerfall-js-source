// SAILING-CABINS: each owned, enclosed sailing ship has its own housing interior.
// The bank's rooms are templates only: no bank deed, balance or ownedShip flag is changed.
import { SHIP_TYPES } from './banking.js';
import { WA_SHIP_BLOCKS } from './warmAshesShips.js';
import { t } from './textManager.js';

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
  // FB1020c CABIN-FOES, the house's own shape (portalStone.js, travelView.js), in the player's language (L10N4)
  get enemies() { return t('cabin.refusal.enemies', 'You cannot enter the cabin with enemies nearby.'); },
});

// Rechecked on press: a picker may have been open while the boat or player moved.
// FB1020c CABIN-FOES (the field, 2026-10-20: "you can despawn pirates by entering your cabin on a ship"): `hostile` - a
// hostile ship within the sea's reach of the player on her deck (scenes/naval/navalHost.js hostileNear, HOSTILE_NEAR_M).
// The cabin is an interior, and every interior transition empties the sea (scenes/world.js navalTransition - NAV-H: "a
// building has no sea"): its ships dropped, a boarding's raid withdrawn. The door was the one way off the sea that never
// asked what the rest, the journey, the time scale and the yard ask, so it took every pirate from the sea for good.
export function cabinEntryRefusal(boat, { boats = [], sailing = false, disembarking = false, aboard = false, hostile = false } = {}) {
  if (!boats.includes(boat) || !hasSailingCabin(boat) || !boat.GameObject?.activeSelf) return CABIN_REFUSAL.unavailable;
  if (sailing || disembarking) return CABIN_REFUSAL.helm;
  if (!aboard) return CABIN_REFUSAL.aboard;
  if (hostile) return CABIN_REFUSAL.enemies;
  return null;
}

/** A restored cabin must belong to a boat in THIS save, not an earlier character. */
export function savedCabinBoat(cabin, record) {
  const c = readSailingCabin(cabin);
  return c ? (record?.placedBoats ?? []).find((b) => b.UID === c.uid && b.Hull === c.hull && !b.inside) ?? null : null;
}
