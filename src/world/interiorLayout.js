// Building interior assembly: placed models, flats, action doors, and static
// door triggers for one building subrecord.
// 1:1 translation of the geometry paths of Daggerfall Unity's
// DaggerfallInterior.cs (MIT, Daggerfall Workshop): AddModels, AddFlats and
// AddActionDoors. Verbatim:
//   - Models: position (X, -Y, Z) * scale, rotation
//     euler(-XRot, -YRot, -ZRot) / RotationDivisor, classic scale identity.
//   - Prop models (ObjectType 3): position (X, +Y, Z) * scale - Y is NOT
//     negated - then the axis is transformed to the lowest vertex Y of the
//     model (+= -bottomY). DFU stops these combining (loot containers); for
//     us they are ordinary placements.
//   - IsBadInteriorModel: DFU's classic-data repair table - 27 block/record
//     combos where a misplaced model 31000 overlaps stairs and traps the
//     player upstairs. Filtered identically.
//   - Flats: position (X, -Y, Z) * scale, billboard bottom-anchored.
//     Editor flats (archive 199) are kept as markers but hidden from the
//     render list, exactly as DFU spawns-then-hides them. Light flats
//     (archive 210) render as billboards; their point-light components are
//     the Rendering arc's (Port-Ledger C).
//   - Action doors: model 9000 + DoorModelIndex % 5 (identical door models
//     also exist at 900x..980x but with differing origins - DFU pins the
//     9000 range), rotation (0, -YRot / RotationDivisor, 0), position
//     (X, -Y, Z) * scale. Placed closed; open/close behavior is the Player
//     arc's. openRotation rides along for it.
//   - Static door triggers accumulate from every placed model's ModelDoor
//     data via getStaticDoors (these are the interior faces of archive 74
//     doors - the way back out).
// Not built here (routed): people flats (Characters arc), furniture actions /
// house containers / loot (Systems arc), point lights (Rendering arc),
// ladder behavior 41409 (Player arc). Spawn points ARE built here (HC1) -
// they are pure layout data, position-only.

import { ROTATION_DIVISOR } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { EDITOR_FLATS_ARCHIVE } from './rmbFlats.js';
import { getStaticDoors } from './staticDoors.js';
import { trs } from './mat4.js';

const PROP_MODEL_TYPE = 3;
const DOOR_MODEL_BASE_ID = 9000;

// DFU InteriorMarkerTypes (editor flat texture records), same values.
export const INTERIOR_MARKER = {
  REST: 4,
  ENTER: 8,
  TREASURE: 19,
  LADDER_BOTTOM: 21,
  LADDER_TOP: 22,
};

// IsBadInteriorModel, verbatim: blockIndex -> building record indexes where
// model 31000 is filtered. DFU's comments name the blocks; kept here.
const BAD_MODEL_ID = 31000;
const BAD_INTERIOR_MODEL_RECORDS = new Map([
  [51, [1]],              // ARMRGL01.RMB
  [84, [8, 9, 10, 11]],   // GENRGM00.RMB
  [88, [2, 3, 4]],        // GENRGL01.RMB
  [96, [2, 5, 6]],        // TVRNGL04.RMB
  [106, [1]],             // FIGHGL00.RMB
  [154, [0, 1, 2]],
  [155, [0, 1, 2, 3]],
  [156, [0, 1]],
  [158, [6, 7]],
  [159, [0]],
  [169, [5, 8]],
  [388, [2, 3, 4, 5]],
  [502, [2]],
  [513, [1, 2, 12]],
  [514, [0, 5, 6]],
  [516, [0]],
  [534, [10]],
  [537, [5]],
  [538, [12]],
  [574, [10, 12]],
  [575, [12, 13]],
  [597, [7, 8]],
  [601, [6, 7]],
  [680, [7, 8]],
  [697, [0, 1, 2, 3]],
  [1195, [1]],            // ARMRBL01.RMB
  [1278, [1, 2, 3, 4]],   // CUSTGA05.RMB
]);

/** Verbatim DaggerfallInterior.IsBadInteriorModel. */
export function isBadInteriorModel(blockIndex, recordIndex, modelIdNum) {
  if (modelIdNum !== BAD_MODEL_ID) return false;
  const records = BAD_INTERIOR_MODEL_RECORDS.get(blockIndex);
  return records !== undefined && records.includes(recordIndex);
}

/**
 * Assemble one building interior.
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rmb).
 * @param {number} blockIndex - the block's BSA record index (door identity).
 * @param {number} recordIndex - building subrecord index within the block.
 * @param {(modelIdNum:number) => object} getModel - resolves a model id to
 *   dfMeshToModel output (positions for the prop bottom-Y, doors for
 *   triggers).
 * @returns {{placements:Array<{modelIdNum:number,matrix:Float32Array}>,
 *   actionDoors:Array<{modelIdNum:number,matrix:Float32Array,openRotation:number}>,
 *   flats:Array<{archive:number,record:number,x:number,y:number,z:number}>,
 *   markers:Array<{type:number,x:number,y:number,z:number}>,
 *   doors:Array<object>}}
 */
export function layoutInterior(dfBlock, blockIndex, recordIndex, getModel) {
  const recordData = dfBlock.rmbBlock.subRecords[recordIndex];
  if (recordData.interior.header.num3dObjectRecords === 0) {
    throw new Error(`No interior 3D models found for record index ${recordIndex}`);
  }

  const placements = [];
  const doors = [];

  // AddModels.
  for (const obj of recordData.interior.block3dObjectRecords) {
    // Filter out bad interior models.
    if (isBadInteriorModel(blockIndex, recordIndex, obj.modelIdNum)) continue;

    const model = getModel(obj.modelIdNum);
    // NEVER TRAPS: getModel resolves through getGpuMesh, which returns
    // NOTHING for a model id the player's own ARCH3D does not carry.
    // Both arms below dereference it - `model.positions` for a prop and
    // getStaticDoors(model) for everything else - so ONE absent model
    // rejected the whole interior build and the door simply never
    // opened, with a raw TypeError in the console. The three sibling
    // builders all drop the placement instead; this one now does too.
    if (!model) {
      console.warn(`[interior] model ${obj.modelIdNum} is not in this ARCH3D - the placement is skipped`);
      continue;
    }

    // Get model position by type (3 seems to indicate props/clutter).
    let px, py, pz;
    if (obj.objectType === PROP_MODEL_TYPE) {
      // Props axis needs to be transformed to lowest Y point.
      const verts = model.positions;
      let bottomY = verts[1];
      for (let i = 4; i < verts.length; i += 3) {
        if (verts[i] < bottomY) bottomY = verts[i];
      }
      px = obj.xPos * GLOBAL_SCALE;
      py = obj.yPos * GLOBAL_SCALE + -bottomY;
      pz = obj.zPos * GLOBAL_SCALE;
    } else {
      px = obj.xPos * GLOBAL_SCALE;
      py = -obj.yPos * GLOBAL_SCALE;
      pz = obj.zPos * GLOBAL_SCALE;
    }

    // Classic data never sets model scale; identity (as rmbLayout.js).
    const matrix = trs(
      px, py, pz,
      -obj.xRotation / ROTATION_DIVISOR,
      -obj.yRotation / ROTATION_DIVISOR,
      -obj.zRotation / ROTATION_DIVISOR,
    );

    placements.push({ modelIdNum: obj.modelIdNum, matrix });

    // Any static doors on this model become triggers under its matrix.
    const staticDoors = getStaticDoors(model, blockIndex, recordIndex, matrix);
    if (staticDoors) doors.push(...staticDoors);
  }

  // AddFlats.
  const flats = [];
  const markers = [];
  for (const obj of recordData.interior.blockFlatObjectRecords) {
    const x = obj.xPos * GLOBAL_SCALE;
    const y = -obj.yPos * GLOBAL_SCALE;
    const z = obj.zPos * GLOBAL_SCALE;
    if (obj.textureArchive === EDITOR_FLATS_ARCHIVE) {
      // Spawned but hidden from the live scene in DFU; data only.
      markers.push({ type: obj.textureRecord, x, y, z });
      continue;
    }
    flats.push({ archive: obj.textureArchive, record: obj.textureRecord, x, y, z });
  }

  // AddActionDoors. Placed closed; openRotation is for the Player arc.
  const actionDoors = [];
  for (const obj of recordData.interior.blockDoorRecords) {
    const matrix = trs(
      obj.xPos * GLOBAL_SCALE,
      -obj.yPos * GLOBAL_SCALE,
      obj.zPos * GLOBAL_SCALE,
      0,
      -obj.yRotation / ROTATION_DIVISOR,
      0,
    );
    actionDoors.push({
      modelIdNum: DOOR_MODEL_BASE_ID + (obj.doorModelIndex % 5),
      matrix,
      openRotation: obj.openRotation,
    });
  }

  // AddSpawnPoints (DaggerfallInterior.cs:915-921): the Section3
  // records are "spawn/waypoint data for placing interior enemies"
  // (DFU's own note on the method) - position-only, same axis flip and
  // scale as every flat.
  const spawnPoints = [];
  for (const obj of recordData.interior.blockSection3Records ?? []) {
    spawnPoints.push([obj.xPos * GLOBAL_SCALE, -obj.yPos * GLOBAL_SCALE, obj.zPos * GLOBAL_SCALE]);
  }

  return { placements, actionDoors, flats, markers, doors, spawnPoints };
}
