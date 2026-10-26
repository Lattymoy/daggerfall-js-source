// HOUSE-SIGN (the owner, 2026-10-25: "remove the shop signs outside of buildings when the building is actually a house
// and not a shop"): a shop's sign that hangs at a house's door does not stand.
//
// WHAT DFU DOES. A shop's sign is one of a block's misc models (ARCH3D 43700-43799), and RMBLayout.AddProps stands every
// misc model where the block places it, tied to no building. A block whose building list types a shop's model as a
// house therefore keeps the shop's sign at the house's door: TVRNAM00 record 0 is a tavern's model and sign typed House2
// (bible/01-Overview/bugs/Field-Bugs-2026-10-09.md, SIGN-HOUSE). The departure: here a sign is tied to a building, and
// a house's sign is left out.
//
// THE TIE. A sign belongs to the building whose door is nearest it, seen from above, within SIGN_REACH_M. The door is
// used, not the building's box, because a sign hangs off a wall into the street and a neighbour's box can hold it. Over
// BLOCKS.BSA's 668 signs, wherever the box and the door name different buildings, the door names the building of the
// sign's own trade (an armourer's sign at an armourer's, a tavern's at a tavern's). A sign farther than SIGN_REACH_M
// from every door hangs on a big building's side wall or stands alone, and it stands.
//
// THE TYPE is the block's own list (fldHeader.buildingDataList). The location's merge draws names and factions, never a
// type (systems/talk/talkTopics.js drawNamedBuildings), and a world-data replacement writes its type into the served
// block (formats/blocksFile.js), so a mod's block that types a shop as a house loses that sign too.

import { BUILDING_TYPES, isResidence } from './buildingNames.js';
import { DOOR_TYPE } from './meshReader.js';

/** The ARCH3D records of the shops' signs: every misc model in this range hangs at a shop's door in BLOCKS.BSA. */
export const SHOP_SIGN_FIRST_MODEL = 43700;
export const SHOP_SIGN_LAST_MODEL = 43799;

/** How far (metres, seen from above) a sign may hang from the door of its building. Over BLOCKS.BSA, the signs at a
 *  house's door hang 6.02 m from it or nearer, and the next sign whose nearest door is a house's is 14.79 m from it. */
export const SIGN_REACH_M = 8;

/** @param {number} modelIdNum */
export const isShopSignModel = (modelIdNum) => modelIdNum >= SHOP_SIGN_FIRST_MODEL && modelIdNum <= SHOP_SIGN_LAST_MODEL;

/** A house, not a shop: DFU's residences (RMBLayout.IsResidence, House1-House4) and the house for sale, which is a
 *  residence offered to the player. @param {number} buildingType */
export const isHouseType = (buildingType) => buildingType === BUILDING_TYPES.HouseForSale || isResidence(buildingType);

/**
 * @typedef {{ x: number, y: number, z: number }} Vec3
 * @typedef {{ type: number, vert0: Vec3, vert2: Vec3 }} ModelDoor - a door as dfMeshToModel mints it, in model space
 * @typedef {{ modelIdNum: number, matrix: ArrayLike<number>, recordIndex?: number }} PlacedModel - layoutRmbBlock's
 * @typedef {{ dfBlock: { rmbBlock: { fldHeader: { buildingDataList: Array<{ buildingType: number }> } } },
 *   layout: { models: PlacedModel[] } }} LaidOutBlock - one of layoutLocation's blocks
 */

/**
 * The building a placed shop's sign hangs on: the record of the nearest building door within SIGN_REACH_M.
 * @param {PlacedModel} sign
 * @param {LaidOutBlock} block - the sign's own block
 * @param {(modelIdNum: number) => ModelDoor[] | null | undefined} doorsOf - a building model's doors (the host's loaded
 *   models; a model not loaded has none)
 * @returns {number} the building's record index in its block, or -1 for none
 */
export function signedBuildingOf(sign, block, doorsOf) {
  const signX = sign.matrix[12];
  const signZ = sign.matrix[14];
  let nearestRecord = -1;
  let nearestDistance = SIGN_REACH_M;
  for (const building of block.layout.models) {
    if (building.recordIndex == null) continue;
    const m = building.matrix;
    for (const door of doorsOf(building.modelIdNum) ?? []) {
      if (door.type !== DOOR_TYPE.BUILDING) continue;
      // the door's centre, placed in the block's frame (only its x and z are read)
      const cx = (door.vert0.x + door.vert2.x) / 2;
      const cy = (door.vert0.y + door.vert2.y) / 2;
      const cz = (door.vert0.z + door.vert2.z) / 2;
      const doorX = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
      const doorZ = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
      const distance = Math.hypot(doorX - signX, doorZ - signZ);
      if (distance > nearestDistance) continue;
      nearestDistance = distance;
      nearestRecord = building.recordIndex;
    }
  }
  return nearestRecord;
}

/**
 * Whether a placed model is a shop's sign hanging at a house's door - a model the town leaves out. A host asks it of
 * each placed model it would stand; the block's buildings come first in layoutRmbBlock's order, so their models are
 * loaded by the time its signs are asked.
 * @param {PlacedModel} placed
 * @param {LaidOutBlock} block - the model's own block
 * @param {(modelIdNum: number) => ModelDoor[] | null | undefined} doorsOf - as signedBuildingOf's
 * @returns {boolean}
 */
export function isHouseSign(placed, block, doorsOf) {
  if (placed.recordIndex != null) return false;
  if (!isShopSignModel(placed.modelIdNum)) return false;
  const record = signedBuildingOf(placed, block, doorsOf);
  if (record < 0) return false;
  const buildingType = block.dfBlock.rmbBlock.fldHeader.buildingDataList[record]?.buildingType;
  return isHouseType(buildingType);
}
