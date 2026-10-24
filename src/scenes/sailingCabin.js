// SAILING-CABINS: adapt the bank-ship layout to the existing interior transition.
import { cabinBlockName, readSailingCabin, cabinEntryRefusal, hasSailingCabin, CABIN_REFUSAL } from '../systems/sailingCabin.js';
import { deckPose, localOf, worldOf } from './comeSailAway/comeSailAwayAboard.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { trs } from '../world/mat4.js';
import { fleetShip } from '../systems/fleet.js';   // CABIN-LOOK: her cabin's stain, her Fleet record's
import { cabinRestyle } from './cabinLook.js';

/** `guest` (AUDIT 2): the cabin is another player's (a visit, cabinOwner) - her stain is her captain's ledger's, which
 *  this page has not: as built (it read MY ledger by her number - as built, or my own ship's stain where the numbers
 *  met). */
export function sailingCabinEntry(blocks, saved, fromNative, guest = false) {
  const cabin = readSailingCabin(saved);
  if (!cabin || typeof fromNative !== 'function') return null;
  const dfBlock = blocks.getBlockByName(cabinBlockName(cabin.hull));
  if (!dfBlock?.rmbBlock?.subRecords?.[0]?.interior) return null;
  const origin = fromNative(cabin.origin);
  if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) return null;
  // Keep the room axis-aligned on EVERY visit. Existing furniture and loose-item
  // caches are relative to the building origin, so the boat's yaw must not rotate it.
  const door = { matrix: trs(...origin, 0, 0, 0), blockIndex: dfBlock.index, recordIndex: 0, doorIndex: 0,
    centre: { x: 0, y: 0, z: 0 } };   // a logical entry anchor, never a rendered or clickable exterior door
  const hit = { dfBlock, recordIndex: 0, door, climateBase: 2, season: 0, sailingCabin: cabin, restyle: cabinRestyle(guest ? 0 : fleetShip(cabin.uid)?.cabin ?? 0) };   // CABIN-LOOK: her cabin stained as her captain chose
  const building = { buildingType: BUILDING_TYPES.Ship, buildingKey: -cabin.uid, regionIndex: -1,
    name: 'Ship cabin', factionId: 0, quality: 0, insideOpenShop: false };
  return { hit, entries: [hit], building, cabin };
}

/** The world supplies its existing sailing state and interior transition. This
 * adapter owns only the cabin visit: it never spawns a boat or takes its helm. */
export function createSailingCabinAccess(deps) {
  let entering = false;
  const boatFor = (c) => deps.boats().find((b) => b.uid === c.uid && b.hull === c.hull && hasSailingCabin(b) && deps.nearby(b));
  // FB1020c CABIN-FOES: the helm read off the runtime itself (`csa()` - Come Sail Away's, or null), and `hostile()` a
  // hostile ship near the player on her deck (the world's navalHostileNear)
  const reason = (boat) => !deps.available() ? CABIN_REFUSAL.unavailable : cabinEntryRefusal(boat, {
    boats: deps.boats(), sailing: !!deps.csa?.()?.isSailing?.(), disembarking: !!deps.csa?.()?.state?.disembarking,
    aboard: deps.aboard(boat), hostile: !!deps.hostile?.(),
  });
  return {
    reason,
    fromNative: deps.fromNative,
    canRestore(saved, savedBoat = undefined) {
      const c = readSailingCabin(saved);
      return deps.available() && !!c && (savedBoat === undefined ? !!boatFor(c)
        : !!savedBoat && savedBoat.UID === c.uid && savedBoat.Hull === c.hull && !savedBoat.inside);
    },
    async enter(boat) {
      if (entering || deps.mode() !== 'exterior' || deps.busy()) return false;
      const no = reason(boat);
      if (no) { deps.say(no); return false; }
      const cabin = readSailingCabin({ v: 1, uid: boat.uid, hull: boat.hull,
        origin: deps.toNative(boat.GameObject.position), deck: localOf(deckPose(boat), deps.feet()), yaw: deps.yaw() });
      if (!cabin) return false;
      entering = true;
      try {
        const entered = !!(await deps.enterInterior(cabin));
        if (!entered) deps.say(CABIN_REFUSAL.unavailable);
        return entered;
      }
      catch (e) { deps.log?.(e); deps.say(CABIN_REFUSAL.unavailable); return false; }
      finally { entering = false; }
    },
    returnToDeck(saved, owner = null) {
      const c = readSailingCabin(saved);
      const boat = c && (owner ? deps.peerBoat?.(owner, c.uid) : boatFor(c));
      if (boat && owner && !deps.boardPeer?.(boat)) return null;
      return boat ? { position: worldOf(deckPose(boat), c.deck), yaw: c.yaw } : null;
    },
  };
}
