// @ts-check
// WAGONS1 (2026-10-09, Mac: "Is a closed wagon varient that also increases storage but also acts as an enterable and
// customizable interior"): THE CARAVAN'S ROOM - THE LAW.
//
// The caravan is entered as a ship's cabin is (SAILING-CABINS, scenes/sailingCabin.js): through the interior host's own
// transition (scenes/worldModes.js interiorTransition), into a room Daggerfall already has - the small ship's cabin
// (Warm Ashes' SHIPAA00.RMB, systems/warmAshesShips.js WA_SHIP_BLOCKS; a wooden room the size of a wagon's bed), its
// door a logical anchor at the parked caravan (never drawn, never clicked), and out again onto the ground behind the
// caravan's painted rear door (world/wagonModels.js doorFor). It is the player's own: no one lives in it, no quest
// stands in it, it is kept for good in the save's scene cache under one name (CARAVAN_SCENE_NAME - a character has one
// caravan), and the decorator (scenes/decorTool.js) furnishes it as it furnishes a house or a ship, paid from the
// purse and kept in the save; the block's own furniture may be hidden (BASE-HIDE). Inside, the wagon's storage is the
// room's chest: Horse Cart and Cargo's door law gives the wagon's inventory to a building whose door stands within
// its 50 m - and this door stands at the wagon.
//
// The descriptor - what a save, an entry and a restore carry - is `{ v: 1, kind: 'caravan', origin, step, yaw }`:
// `origin` the parked caravan in natives (the room's frame - every placed piece is measured from it), `step` where the
// player stands when they come out (natives) and `yaw` the way they face (degrees). Pure. Not a DFU member. Ledger A.
import { WA_SHIP_BLOCKS } from './warmAshesShips.js';

/** The room borrowed: the small ship's cabin (WA_SHIP_BLOCKS[0], the Small Ship's - systems/sailingCabin.js). */
export const CARAVAN_BLOCK = WA_SHIP_BLOCKS[0];
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
});

const vec = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);
/** A caravan room's descriptor, checked - or null. */
export function readCaravanRoom(v) {
  if (!v || v.v !== 1 || v.kind !== 'caravan' || !vec(v.origin) || !vec(v.step) || !Number.isFinite(v.yaw) || Math.abs(v.yaw) > 1e9) return null;
  return { v: 1, kind: 'caravan', origin: [...v.origin], step: [...v.step], yaw: v.yaw };
}
/** Whether a private room descriptor is a caravan's (the interior host keeps one slot for a ship's cabin or this). */
export const isCaravanRoom = (room) => room?.kind === 'caravan';
