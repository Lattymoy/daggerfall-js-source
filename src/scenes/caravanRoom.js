// @ts-check
// WAGONS1: THE CARAVAN'S ROOM ON THE INTERIOR HOST'S DOOR (systems/caravanRoom.js says what it is). scenes/sailingCabin.js's
// two halves for a parked caravan: the ENTRY the interior transition takes (a borrowed block, a logical door at the
// caravan, the owner's room) and the ACCESS the world host builds - whether the room may be entered or restored, and
// where its door lets the player out.
import { CARAVAN_BLOCK, CARAVAN_BUILDING_KEY, CARAVAN_TEXT, readCaravanRoom } from '../systems/caravanRoom.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { trs } from '../world/mat4.js';

/** The interior transition's hit, entries and building for a caravan room (`saved` its descriptor), or null. The room
 *  stands axis-aligned on the caravan on every visit (its pieces are measured from its door, as a cabin's are). */
export function caravanRoomEntry(blocks, saved, fromNative) {
  const room = readCaravanRoom(saved);
  if (!room || typeof fromNative !== 'function') return null;
  const dfBlock = blocks.getBlockByName(CARAVAN_BLOCK);
  if (!dfBlock?.rmbBlock?.subRecords?.[0]?.interior) return null;
  const origin = fromNative(room.origin);
  if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) return null;
  const door = { matrix: trs(...origin, 0, 0, 0), blockIndex: dfBlock.index, recordIndex: 0, doorIndex: 0, centre: { x: 0, y: 0, z: 0 } };
  // `sailingCabin` is the interior host's one slot for a private room of the player's own - a ship's or this
  const hit = { dfBlock, recordIndex: 0, door, climateBase: 2, season: 0, sailingCabin: room };
  const building = { buildingType: BUILDING_TYPES.Ship, buildingKey: CARAVAN_BUILDING_KEY, regionIndex: -1, name: 'Caravan', factionId: 0, quality: 0, insideOpenShop: false };
  return { hit, entries: [hit], building, room };
}

/**
 * The world host's caravan door: `deps` = { available() (the interior host can take a room now), mode(), busy(),
 * say(text), toNative(p), fromNative(p), parked() -> { position, rotation, step, yaw } | null (my caravan standing,
 * from the cart's presentation - its pose, the ground behind its door and the way out), enterInterior(room) ->
 * Promise<boolean>, log }.
 */
export function createCaravanAccess(deps) {
  let entering = false;
  return {
    fromNative: deps.fromNative,
    /** A saved room comes back while the player still drives a caravan (the save's own). */
    canRestore: (saved) => deps.available() && !!readCaravanRoom(saved) && !!deps.ownsCaravan?.(),
    async enter() {
      if (entering || deps.mode() !== 'exterior' || deps.busy()) return false;
      const at = deps.parked();
      if (!at || !deps.available()) { deps.say(at ? CARAVAN_TEXT.unavailable : CARAVAN_TEXT.notHere); return false; }
      const room = readCaravanRoom({ v: 1, kind: 'caravan', origin: deps.toNative(at.position), step: deps.toNative(at.step), yaw: at.yaw });
      if (!room) return false;
      entering = true;
      try {
        const entered = !!(await deps.enterInterior(room));
        if (!entered) deps.say(CARAVAN_TEXT.unavailable);
        return entered;
      } catch (e) { deps.log?.(e); deps.say(CARAVAN_TEXT.unavailable); return false; } finally { entering = false; }
    },
    /** Where the room's door lets the player out: the ground behind the caravan's rear door (`ground` stands a point
     *  on what is there now, as a door's landing is - scenes/worldModes.js stands a private room's landing as given),
     *  facing away from it. */
    returnToWagon(saved) {
      const room = readCaravanRoom(saved);
      if (!room) return null;
      const at = deps.fromNative(room.step);
      return { position: deps.ground ? deps.ground(at) : at, yaw: room.yaw };
    },
  };
}
