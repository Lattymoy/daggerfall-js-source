// @ts-check
// WAGONS1 (2026-10-09, Mac: "Is a closed wagon varient that also increases storage but also acts as an enterable and
// customizable interior"): THE CARAVAN'S ROOM - THE LAW.
//
// The caravan is entered as a ship's cabin is (SAILING-CABINS, scenes/sailingCabin.js): through the interior host's own
// transition (scenes/worldModes.js interiorTransition), its door a logical anchor at the parked caravan (never drawn,
// never clicked), and out again onto the ground behind the caravan's painted rear door (world/wagonModels.js doorFor).
// It is the player's own: no one lives in it, no quest stands in it, it is kept for good in the save's scene cache under
// one name (CARAVAN_SCENE_NAME - a character has one caravan), and the decorator (scenes/decorTool.js) furnishes it as
// it furnishes a house or a ship, paid from the purse and kept in the save - its crafting stations, its storage, a bed
// slept in. Inside, the wagon's storage is the room's chest too: Horse Cart and Cargo's door law gives the wagon's
// inventory to a building whose door stands within its 50 m - and this door stands at the wagon.
//
// WAGONS2 (2026-10-09, Mac: "People should be able to use the interior just like houses ... allowing players to see
// inside/outside of house windows + the new wagon"; asked, "Caravan-shaped room"): THE ROOM IS THE CARAVAN'S OWN.
// WAGONS1 borrowed the small ship's cabin (Warm Ashes' SHIPAA00.RMB), a room of another shape stood axis-aligned on the
// wagon however it was parked. The room now is the caravan's inside (world/caravanRoomModel.js), one model in a block
// of its own making (`caravanRoomBlock` - RMB's shape, read by world/interiorLayout.js as any record is: the model, an
// enter marker inside the door and a lantern under the roof), stood ON the caravan - at its pose, turned with it - so
// its windows look out of the caravan's own windows onto where it stands. No ARENA2 block is read for it.
//
// The descriptor - what a save, an entry and a restore carry - is `{ v: 2, kind: 'caravan', origin, turn, step, yaw }`:
// `origin` the parked caravan's frame in natives (its pose's point - world/wagonModels.js's lifted frame, the room's),
// `turn` its heading (degrees about up: 0 the caravan pulled toward +z), `step` where the player stands when they come
// out (natives) and `yaw` the way they face. Every piece placed in the room is kept in the room's own frame, unturned
// (`roomToSaved` / `savedToRoom`), so a caravan parked another way round keeps its furniture where it stood in it. A
// WAGONS1 descriptor (v 1, never released) reads as unturned. Pure. Not a DFU member. Ledger A (WAGONS1, WAGONS2).
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { EDITOR_FLATS_ARCHIVE } from '../world/rmbFlats.js';
import { INTERIOR_MARKER } from '../world/interiorLayout.js';

/** The room's block name (no ARENA2 block carries it - the place hold and the automap key on it). */
export const CARAVAN_BLOCK = 'CARAVAN [WAGONS2]';
/** The room's one model: an id no ARCH3D carries (the interior host serves it beside the pipeline's). */
export const CARAVAN_ROOM_MODEL_ID = -38181;
/** How far (natives, forty a metre) a caravan may stand from where its room was entered and still be the caravan the
 *  room stands on: a parked caravan does not drift, so two metres is a re-park, never a rounding or its grounding's
 *  lean (WAGONS2 AUDIT: the owner's room restored only onto it; WAGONS2-VISIT: a visitor stood out past it). */
export const CARAVAN_STANDS_NATIVES = 80;
/** FINAL AUDIT: and how far (degrees) it may have turned - a caravan re-parked on its own spot facing another way is
 *  another room (its walls and windows the old turn's, its rear door's step inside the re-parked body). Its live pose
 *  leans on the ground it stands on; a re-park turned is tens of degrees. */
export const CARAVAN_STANDS_TURN = 15;
/** The least angle (degrees) between two headings. */
export const turnGap = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
/** The lantern under the roof: Daggerfall's round lantern on its chain (archive 210 record 22 - the light it casts is
 *  world/interiorLights.js's for that record). */
export const CARAVAN_LANTERN_FLAT = Object.freeze([210, 22]);
/** The room's scene-cache name: one a character, kept for good (worldModes addPermanentScene). */
export const CARAVAN_SCENE_NAME = 'Caravan [WAGONS1]';
/** The building record's key: a negative one no town building or ship cabin (-uid) carries. */
export const CARAVAN_BUILDING_KEY = -2_000_000_001;
/** What the plaque's row says, and what a refusal says. */
export const CARAVAN_TEXT = Object.freeze({
  enter: 'Step inside',
  exit: 'Step outside',
  where: 'Your caravan',
  unavailable: 'Your caravan is unavailable here.',
  notHere: 'Your caravan is not here.',
  outside: 'You stand outside the caravan.',   // FINAL AUDIT: a save or an anchor made in one whose room cannot come back
});

const vec = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);
const angle = (v) => Number.isFinite(v) && Math.abs(v) <= 1e9;
/** A caravan room's descriptor, checked - or null. A WAGONS1 one (v 1) reads unturned. */
export function readCaravanRoom(v) {
  if (!v || (v.v !== 1 && v.v !== 2) || v.kind !== 'caravan' || !vec(v.origin) || !vec(v.step) || !angle(v.yaw)) return null;
  const turn = v.v === 2 ? v.turn : 0;
  if (!angle(turn)) return null;
  return { v: 2, kind: 'caravan', origin: [...v.origin], turn, step: [...v.step], yaw: v.yaw };
}
/** Whether a private room descriptor is a caravan's (the interior host keeps one slot for a ship's cabin or this). */
export const isCaravanRoom = (room) => room?.kind === 'caravan';

/** A point of the room's (lifted wagon frame, metres) as an RMB record carries it (world/interiorLayout.js's reading:
 *  x and z times GLOBAL_SCALE, y negated). */
const rmbPoint = ([x, y, z]) => ({ xPos: x / GLOBAL_SCALE, yPos: -y / GLOBAL_SCALE, zPos: z / GLOBAL_SCALE });
/**
 * THE ROOM'S BLOCK: a block in RMB's shape (BlocksFile's - world/interiorLayout.js layoutInterior reads it as it reads
 * any) holding one interior record: the room's model at the record's origin (`CARAVAN_ROOM_MODEL_ID` - not a prop, so
 * never furniture to take out), an enter marker at `enter` and the lantern hung from `lantern` (both points of the room -
 * world/caravanRoomModel.js CARAVAN_ENTER, CARAVAN_LANTERN), no door of its own (the host's synthesised exit stands at
 * the marker - MAC-BUG1), nobody in it.
 */
export function caravanRoomBlock(enter, lantern) {
  return {
    name: CARAVAN_BLOCK, index: -1,
    rmbBlock: { subRecords: [{ interior: {
      header: { num3dObjectRecords: 1 },
      block3dObjectRecords: [{ modelIdNum: CARAVAN_ROOM_MODEL_ID, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
      blockFlatObjectRecords: [
        { textureArchive: EDITOR_FLATS_ARCHIVE, textureRecord: INTERIOR_MARKER.ENTER, ...rmbPoint(enter) },
        { textureArchive: CARAVAN_LANTERN_FLAT[0], textureRecord: CARAVAN_LANTERN_FLAT[1], ...rmbPoint(lantern), hang: true },   // hung from the roof (world/interiorLayout.js)
      ],
      blockDoorRecords: [], blockPeopleRecords: [], blockSection3Records: [],
    } }] },
  };
}

/** A room point (relative to its origin, this visit's frame - turned with the caravan) as the save keeps it, unturned. */
export function roomToSaved(p, turn) {
  const a = (-turn * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}
/** A point the save keeps (unturned) as this visit's (turned with the caravan by `turn` degrees about up: Ry). */
export function savedToRoom(p, turn) { return roomToSaved(p, -turn); }

const wrapYaw = (d) => { const w = ((d % 360) + 360) % 360; return w > 180 ? w - 360 : w; };
/**
 * A caravan room's scene (scenes/worldModes.js currentSceneState's shape - its floor's piles, its torches, its placed
 * pieces, each measured from the room's origin) turned about up by `turn` degrees' inverse: this visit's frame (turned
 * with the caravan) to the save's (unturned) for `turn`, and the save's to this visit's for `-turn`. Every point is
 * turned and a piece's heading with it; anything else rides as it is. A new object; `data` untouched.
 */
export function turnCaravanScene(data, turn) {
  if (!data || !turn) return data;
  const p3 = (p) => (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) ? roomToSaved(p, turn) : p);
  const list = (v, f) => (Array.isArray(v) ? v.map((d) => (d && typeof d === 'object' ? f(d) : d)) : v);
  return {
    ...data,
    droppedPiles: list(data.droppedPiles, (d) => ({ ...d, pos: p3(d.pos) })),
    droppedTorches: list(data.droppedTorches, (d) => ({ ...d, position: p3(d.position) })),
    decor: list(data.decor, (d) => ({ ...d, pos: p3(d.pos), ...(Array.isArray(d.rot) && Number.isFinite(d.rot[0]) ? { rot: [wrapYaw(d.rot[0] - turn), ...d.rot.slice(1)] } : {}) })),
  };
}
