// @ts-check
// WAGONS1: THE CARAVAN'S ROOM ON THE INTERIOR HOST'S DOOR (systems/caravanRoom.js says what it is). scenes/sailingCabin.js's
// two halves for a parked caravan: the ENTRY the interior transition takes (the room's own block and model, a logical
// door at the caravan, the owner's room) and the ACCESS the world host builds - whether the room may be entered or
// restored, and where its door lets the player out.
//
// WAGONS2: the room is the caravan's own (world/caravanRoomModel.js), stood on the caravan at its pose and turned with
// it, its pictures the caravan's - the built ones or its owner's paint (systems/wagonLooks.js) - uploaded here, its
// windows' glass cut out so the world is seen through them.
import { CARAVAN_BUILDING_KEY, CARAVAN_TEXT, CARAVAN_ROOM_MODEL_ID, caravanRoomBlock, readCaravanRoom } from '../systems/caravanRoom.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { trs } from '../world/mat4.js';
import { caravanRoomModel, CARAVAN_ENTER, CARAVAN_LANTERN } from '../world/caravanRoomModel.js';
import { wagonArt, wagonLookArt, isGlassRecord, lookRecord, LOOK_RECORDS, LOOK_RECORD_STRIDE, TEX, WAGON_ARCHIVE } from '../world/wagonArt.js';
import { readWagonLook, CARAVAN_INSIDE_LOOKS, CARAVAN_INSIDE_PARTS } from '../systems/wagonLooks.js';
import { toColor32 } from '../formats/color32Order.js';
import { quatRotate } from '../world/quat.js';

/** WAGONS2: the room's faces wear its LIVE records - the built room records' as if a ninth choice
 *  (world/wagonArt.js lookRecord(rec, 9)), never a paint's own - and whatever paint the room wears is painted INTO them
 *  (`paintCaravanRoom`): a paint changed while the player stands in the room is on its walls the next frame, the
 *  room's merged mesh untouched. A paint's own records stay the outside draw's (scenes/horseCartPool.js lookRemap). */
export const CARAVAN_LIVE_CHOICE = 9;
/** The records the room's faces wear: each built room record's live one. */
export function caravanRoomRecords() {
  const out = {};
  for (const part of CARAVAN_INSIDE_PARTS) for (const rec of LOOK_RECORDS[part]) out[Object.keys(TEX).find((k) => TEX[k] === rec)] = lookRecord(rec, CARAVAN_LIVE_CHOICE);
  return out;
}

/** The pictures an inside paint (`look` - systems/wagonLooks.js) puts on the room's live records: `[record, picture]`,
 *  each part's built picture or its paint's. */
export function caravanRoomPictures(look) {
  const l = readWagonLook(look);
  const built = new Map(wagonArt());
  const out = [];
  for (const part of CARAVAN_INSIDE_PARTS) {
    const i = l[part[0]];
    const painted = i ? new Map(wagonLookArt(part, i, CARAVAN_INSIDE_LOOKS[part][i]).map(([rec, pic]) => [rec % LOOK_RECORD_STRIDE, pic])) : null;
    for (const rec of LOOK_RECORDS[part]) out.push([lookRecord(rec, CARAVAN_LIVE_CHOICE), painted?.get(rec) ?? built.get(rec)]);
  }
  return out;
}

/** THE ROOM PAINTED: the live records given `look`'s pictures on the renderer - each let go first (the renderer keeps
 *  the first picture asked under a key) and uploaded again, opaque, a cut-out where the glass is. */
export function paintCaravanRoom(renderer, look) {
  if (!renderer?.uploadTexture) return;
  for (const [rec, pic] of caravanRoomPictures(look)) {
    const key = `${WAGON_ARCHIVE}_${rec}`;
    renderer.evictTexture?.(key); renderer.evictTexture?.(`${key}#opaque`);
    renderer.uploadTexture(WAGON_ARCHIVE, rec, toColor32(pic), isGlassRecord(rec) ? { cutout: true } : { opaque: true });
  }
}

/** The caravan's heading (degrees about up, 0 pulled toward +z) from its pose's rotation. */
export const caravanTurnOf = (rotation) => { const f = quatRotate(rotation, [0, 0, 1]); return (Math.atan2(f[0], f[2]) * 180) / Math.PI; };

/** The interior transition's hit, entries and building for a caravan room (`saved` its descriptor), or null: the room's
 *  own block, its model served beside the pipeline's (`roomModels`, on the live records), its door the caravan's frame -
 *  at its pose, turned with it - and the room painted (`look` the inside's paint). */
export function caravanRoomEntry(saved, fromNative, { look = null, renderer = null } = {}) {
  const room = readCaravanRoom(saved);
  if (!room || typeof fromNative !== 'function') return null;
  const origin = fromNative(room.origin);
  if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) return null;
  const dfBlock = caravanRoomBlock(CARAVAN_ENTER, CARAVAN_LANTERN);
  paintCaravanRoom(renderer, look);
  const door = { matrix: trs(...origin, 0, room.turn, 0), blockIndex: dfBlock.index, recordIndex: 0, doorIndex: 0, centre: { x: 0, y: 0, z: 0 } };
  // `sailingCabin` is the interior host's one slot for a private room of the player's own - a ship's or this
  const hit = { dfBlock, recordIndex: 0, door, climateBase: 2, season: 0, sailingCabin: room, roomModels: new Map([[CARAVAN_ROOM_MODEL_ID, caravanRoomModel({ records: caravanRoomRecords() })]]) };
  const building = { buildingType: BUILDING_TYPES.Ship, buildingKey: CARAVAN_BUILDING_KEY, regionIndex: -1, name: 'Caravan', factionId: 0, quality: 0, insideOpenShop: false };
  return { hit, entries: [hit], building, room };
}

/**
 * The world host's caravan door: `deps` = { available() (the interior host can take a room now), mode(), busy(),
 * say(text), toNative(p), fromNative(p), parked() -> { position, rotation, step, yaw } | null (my caravan standing,
 * from the cart's presentation - its pose, the ground behind its door and the way out), enterInterior(room) ->
 * Promise<boolean>, look() and paint(part, i) (WAGONS2: my caravan's paint, and painting it), log }.
 */
export function createCaravanAccess(deps) {
  let entering = false;
  return {
    fromNative: deps.fromNative,
    /** WAGONS2: the paint my caravan's room wears. */
    look: () => deps.look?.() ?? null,
    /** WAGONS2: my caravan's inside painted (`part` walls, floor or ceiling, `i` its choice) - `{ ok, text }`, or null. */
    paint: (part, i) => deps.paint?.(part, i) ?? null,
    /** A saved room comes back while the player still drives a caravan (the save's own). */
    canRestore: (saved) => deps.available() && !!readCaravanRoom(saved) && !!deps.ownsCaravan?.(),
    async enter() {
      if (entering || deps.mode() !== 'exterior' || deps.busy()) return false;
      const at = deps.parked();
      if (!at || !deps.available()) { deps.say(at ? CARAVAN_TEXT.unavailable : CARAVAN_TEXT.notHere); return false; }
      const room = readCaravanRoom({ v: 2, kind: 'caravan', origin: deps.toNative(at.position), turn: caravanTurnOf(at.rotation), step: deps.toNative(at.step), yaw: at.yaw });
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

/** The room's models' meshes, made once per set of pictures and kept a few (a renderer's - freed past the fourth). */
const _roomGpus = new WeakMap();
/**
 * WAGONS2: THE ROOM'S OWN MODELS SERVED THROUGH THE BUILDING'S HOLD - the interior build reads its models as the
 * pipeline's contract has it (scenes/interiorContext.js: getGpuMesh warms the caches, then cpuModels reads the model
 * back), so the hold's getGpuMesh answers an id `roomModels` holds (the caravan room's - an id no ARCH3D carries) with
 * its mesh and stands its model in `cpuModels` for the read, and passes every other id to the hold as it was. A room of
 * Daggerfall's (no `roomModels`) leaves the hold untouched. The hold is this build's own (scenes/dataPipeline.js
 * holdPlace mints one a call).
 */
export function serveRoomModels(hold, roomModels, renderer, cpuModels) {
  if (!hold || !roomModels?.size) return hold;
  let cache = _roomGpus.get(renderer);
  if (!cache) _roomGpus.set(renderer, (cache = new Map()));
  const gpuOf = (id) => {
    const cpu = roomModels.get(id);
    const sig = `${id}|${cpu.subMeshes.map((sm) => sm.textureRecord).join(',')}`;
    if (!cache.has(sig)) {
      cache.set(sig, renderer?.createMesh ? renderer.createMesh(cpu) : null);
      if (cache.size > 4) { const [k, old] = cache.entries().next().value; cache.delete(k); if (old) renderer.destroyMesh?.(old); }
    }
    return cache.get(sig);
  };
  const base = hold.getGpuMesh;
  hold.getGpuMesh = (id, ...rest) => {
    if (!roomModels.has(id)) return base(id, ...rest);
    cpuModels?.set?.(id, roomModels.get(id));
    return Promise.resolve(gpuOf(id));
  };
  return hold;
}
