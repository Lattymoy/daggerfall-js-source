// RDB dungeon block assembly: placed models, action doors, flats, lights,
// markers, exit doors, and linked action records for one block.
// 1:1 translation of the layout paths of Daggerfall Unity's RDBLayout.cs
// (MIT, Daggerfall Workshop): AddModels, GetModelMatrix, IsActionDoor,
// AddActionDoors, AddFlats, AddLights, AddAction and the action vector
// builders, LinkActionNodes. Verbatim:
//   - Model matrix is T * Rz * Rx * Ry composed from separate multiplies -
//     NOT the RMB TRS order (Ry * Rx * Rz). Kept exactly.
//   - Exit door models (70300) are filtered unless allowExitDoors (only the
//     starting block gets them); red brick doors (72100) are never action
//     doors despite the DOR tag; action doors are model refs described
//     DOR / DDR / NEW / CAV and are placed by the action-door pass, closed,
//     with the starting lock decoded from triggerFlagStartingLock >> 4
//     through DFU's 16-entry lock table.
//   - Tapestries/banners (42500..42571 without actions) are collider-free
//     standalone adds in DFU; a pure layout has no colliders, so they are
//     ordinary placements here (noted for the Player arc).
//   - Static doors accumulate from every placed model via getStaticDoors
//     with recordIndex 0 and the block's BSA index.
//   - Flats sit at (X, -Y, Z) * scale. Editor flats (archive 199) become
//     data-only markers (DFU spawns-then-hides): record 10 start markers
//     (which also carry the block water level: soundIndex != 0 ->
//     -8 * soundIndex else 10000, and castleBlock = magnitude != 0),
//     record 8 enter markers; 15/16 are enemy markers (SetActive(false) in
//     DFU). Fixed-treasure flats (archive 216) are renderer-disabled in DFU
//     and land in markers too. Everything else renders.
//   - Lights are point data: position and radius * GlobalScale (DFU's
//     range * 3 is prefab-side, Rendering arc's call).
//   - Actions: models act when actionResource.flags != 0; flats when
//     flatResource.action > 0. Action/trigger flags only bind when the raw
//     value is a defined enum member (Enum.IsDefined), else None.
//     Translation vectors NEGATE x and z relative to the axis sign;
//     rotation vectors do not, and divide by RotationDivisor. Flag cases
//     PositiveX..NegativeZ force duration 50 and magnitude = axisRaw * 8.
//     Special-case rotations: LID -> (0, 0, -90), WHE -> (0, -360, 0);
//     TRP with raw axis 13 -> NegativeX at magnitude 400 (DFU's classic
//     workaround, classic value 392). AddActionFlatHelper passes the flat's
//     MAGNITUDE as the raw axis (verbatim DFU quirk).
//   - Action links key on obj.position; model links carry
//     next/previousObjectOffset, flat links next only (prev -1). Editor
//     flats always join the link dict; other flats only when they act.
// Not built here (routed): enemies fixed/random (Characters arc), treasure
// piles/loot (Systems arc), torch/animal audio (Audio arc), point-light and
// water rendering (Rendering arc), door/action behavior (Player arc).

import { ROTATION_DIVISOR, RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { getStaticDoors } from './staticDoors.js';
import { trs, multiply } from './mat4.js';

export const RDB_SIDE = 2048 * GLOBAL_SCALE;

const EXIT_DOOR_MODEL_ID = 70300;
const RED_BRICK_DOOR_MODEL_ID = 72100;
const MIN_TAPESTRY_ID = 42500;
const MAX_TAPESTRY_ID = 42571;
const EDITOR_FLATS_ARCHIVE = 199;
const FIXED_TREASURE_FLATS_ARCHIVE = 216;

// DFBlock.RdbActionFlags, defined members only (Enum.IsDefined parity).
export const ACTION_FLAGS = Object.freeze({
  None: 0x00, Translation: 0x01,
  PositiveX: 0x02, NegativeX: 0x03, PositiveY: 0x04, NegativeY: 0x05,
  PositiveZ: 0x06, NegativeZ: 0x07,
  Rotation: 0x08, CastSpell: 0x09, ShowText: 0x0b, ShowTextWithInput: 0x0c,
  Teleport: 0x0e, LockDoor: 0x10, UnlockDoor: 0x11, OpenDoor: 0x12,
  CloseDoor: 0x14, Hurt21: 0x15, Hurt22: 0x16, Hurt23: 0x17, Hurt24: 0x18,
  Hurt25: 0x19, Poison: 0x1a, Unknown27: 0x1b, DrainMagicka: 0x1c,
  Dialogue: 0x1d, Activate: 0x1e, SetGlobalVar: 0x1f, Unknown32: 0x20,
});

// DFBlock.RdbTriggerFlags, defined members only.
export const TRIGGER_FLAGS = Object.freeze({
  None: 0x00, Collision01: 0x01, Direct: 0x02, Collision03: 0x03,
  Attack: 0x05, Direct6: 0x06, MultiTrigger: 0x08, Collision09: 0x09,
  Door: 0x0a,
});

// DFBlock.RdbActionAxes.
const AXES = Object.freeze({
  None: 0, NegativeX: 1, PositiveX: 2, NegativeY: 3, PositiveY: 4,
  NegativeZ: 5, PositiveZ: 6,
});

const ACTION_FLAG_VALUES = new Set(Object.values(ACTION_FLAGS));
const TRIGGER_FLAG_VALUES = new Set(Object.values(TRIGGER_FLAGS));

// AddActionDoor starting-lock table, verbatim.
const LOCK_VALUES = [
  0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e,
  0x10, 0x12, 0x14, 0x19, 0x1e, 0x32, 0x80, 0xff,
];

/** Verbatim RDBLayout.GetModelMatrix: T * Rz * Rx * Ry. */
export function getModelMatrix(obj) {
  const mr = obj.resources.modelResource;
  const degreesX = -mr.xRotation / ROTATION_DIVISOR;
  const degreesY = -mr.yRotation / ROTATION_DIVISOR;
  const degreesZ = -mr.zRotation / ROTATION_DIVISOR;
  const t = trs(
    obj.xPos * GLOBAL_SCALE, -obj.yPos * GLOBAL_SCALE, obj.zPos * GLOBAL_SCALE,
    0, 0, 0);
  const rz = trs(0, 0, 0, 0, 0, degreesZ);
  const rx = trs(0, 0, 0, degreesX, 0, 0);
  const ry = trs(0, 0, 0, 0, degreesY, 0);
  return multiply(multiply(multiply(t, rz), rx), ry);
}

/** Verbatim RDBLayout.IsActionDoor. */
export function isActionDoor(rdb, modelReference) {
  // Always reject red brick doors, not action doors despite the DOR tag.
  if (rdb.modelReferenceList[modelReference].modelIdNum === RED_BRICK_DOOR_MODEL_ID) {
    return false;
  }
  // Door (DOR), double-door (DDR), NEW tag (55007/55024/5018 - always
  // doors), CAV cave-wall doors (like 55033 in S0000204.RDB).
  const description = rdb.modelReferenceList[modelReference].description;
  return description === 'DOR' || description === 'DDR' ||
    description === 'NEW' || description === 'CAV';
}

function hasAction(obj) {
  return obj.resources.modelResource.actionResource.flags !== 0;
}

// GetRotationActionVector, verbatim (including the TRP raw-axis-13 hack).
function rotationActionVector(action, axis) {
  if (action.axisRaw === 13 && action.description === 'TRP') {
    axis = AXES.NegativeX;
    action.magnitude = 400; // Classic is 392 but the player can stick to that angle
  }
  const v = { x: 0, y: 0, z: 0 };
  const magnitude = action.magnitude;
  switch (axis) {
    case AXES.NegativeX: v.x = -magnitude; break;
    case AXES.NegativeY: v.y = -magnitude; break;
    case AXES.NegativeZ: v.z = -magnitude; break;
    case AXES.PositiveX: v.x = magnitude; break;
    case AXES.PositiveY: v.y = magnitude; break;
    case AXES.PositiveZ: v.z = magnitude; break;
    default: break;
  }
  action.rotation = {
    x: v.x / ROTATION_DIVISOR,
    y: v.y / ROTATION_DIVISOR,
    z: v.z / ROTATION_DIVISOR,
  };
}

// GetTranslationActionVector, verbatim: x and z NEGATE the axis sign.
function translationActionVector(action, axis) {
  const v = { x: 0, y: 0, z: 0 };
  const magnitude = action.magnitude;
  switch (axis) {
    case AXES.NegativeX: v.x = magnitude; break;
    case AXES.NegativeY: v.y = -magnitude; break;
    case AXES.NegativeZ: v.z = magnitude; break;
    case AXES.PositiveX: v.x = -magnitude; break;
    case AXES.PositiveY: v.y = magnitude; break;
    case AXES.PositiveZ: v.z = -magnitude; break;
    default: break;
  }
  action.translation = {
    x: v.x * GLOBAL_SCALE,
    y: v.y * GLOBAL_SCALE,
    z: v.z * GLOBAL_SCALE,
  };
}

// AddAction, verbatim data paths (components/audio are their arcs').
function buildAction(description, soundIndex, duration, magnitude, axisRaw, triggerRaw, actionRaw, isFlat) {
  const action = {
    description,
    index: soundIndex,
    duration,
    magnitude,
    axisRaw,
    triggerFlag: TRIGGER_FLAG_VALUES.has(triggerRaw) ? triggerRaw : TRIGGER_FLAGS.None,
    actionFlag: ACTION_FLAG_VALUES.has(actionRaw) ? actionRaw : ACTION_FLAGS.None,
    isFlat,
    rotation: { x: 0, y: 0, z: 0 },
    translation: { x: 0, y: 0, z: 0 },
    nextObject: -1,
    previousObject: -1,
  };

  switch (action.actionFlag) {
    case ACTION_FLAGS.Translation:
      translationActionVector(action, axisRaw);
      break;
    case ACTION_FLAGS.Rotation:
      rotationActionVector(action, axisRaw);
      break;
    case ACTION_FLAGS.PositiveX:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.PositiveX);
      break;
    case ACTION_FLAGS.NegativeX:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.NegativeX);
      break;
    case ACTION_FLAGS.PositiveY:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.PositiveY);
      break;
    case ACTION_FLAGS.NegativeY:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.NegativeY);
      break;
    case ACTION_FLAGS.PositiveZ:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.PositiveZ);
      break;
    case ACTION_FLAGS.NegativeZ:
      action.duration = 50;
      action.magnitude = axisRaw * 8;
      translationActionVector(action, AXES.NegativeZ);
      break;
    default:
      break;
  }

  // Quick hack for special-case rotations, verbatim DFU.
  switch (description) {
    case 'LID': action.rotation = { x: 0, y: 0, z: -90 }; break; // Coffin lids (e.g. Scourg Barrow)
    case 'WHE': action.rotation = { x: 0, y: -360, z: 0 }; break; // Wheels (e.g. Direnni Tower)
  }

  return action;
}

// AddActionModelHelper data path.
function modelAction(rdb, obj) {
  const mr = obj.resources.modelResource;
  const description = rdb.modelReferenceList[mr.modelIndex].description;
  return buildAction(
    description,
    mr.soundIndex,
    mr.actionResource.duration,
    mr.actionResource.magnitude,
    mr.actionResource.axis,
    mr.triggerFlagStartingLock,
    mr.actionResource.flags,
    false,
  );
}

// AddActionFlatHelper data path. axis = magnitude is a verbatim DFU quirk.
function flatAction(obj) {
  const fr = obj.resources.flatResource;
  return buildAction('FLT', fr.soundIndex, 0, fr.magnitude, fr.magnitude, fr.flags, fr.action, true);
}

function* rdbObjects(rdb) {
  for (const group of rdb.objectRootList) {
    if (!group.rdbObjects) continue; // Skip empty object groups
    yield* group.rdbObjects;
  }
}

/**
 * Assemble one RDB dungeon block.
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rdb).
 * @param {number} blockIndex - the block's BSA record index (door identity).
 * @param {boolean} allowExitDoors - exit door models (70300) placed only
 *   when set (the starting block).
 * @param {(modelIdNum:number) => object} getModel - resolves a model id to
 *   dfMeshToModel output.
 * @returns {{placements:Array,actionDoors:Array,flats:Array,markers:Array,
 *   startMarkers:Array,enterMarkers:Array,lights:Array,exitDoors:Array,
 *   actionLinks:Map,waterLevel:number,castleBlock:boolean}}
 */
export function layoutRdbBlock(dfBlock, blockIndex, allowExitDoors, getModel) {
  const rdb = dfBlock.rdbBlock;
  const placements = [];
  const actionDoors = [];
  const flats = [];
  const markers = [];
  const startMarkers = [];
  const enterMarkers = [];
  const lights = [];
  const exitDoors = [];
  const actionLinks = new Map(); // position -> { nextKey, prevKey, action }

  const addModelLink = (obj, action) => {
    if (!actionLinks.has(obj.position)) {
      actionLinks.set(obj.position, {
        nextKey: obj.resources.modelResource.actionResource.nextObjectOffset,
        prevKey: obj.resources.modelResource.actionResource.previousObjectOffset,
        action,
      });
    }
  };

  for (const obj of rdbObjects(rdb)) {
    if (obj.type === RDB_RESOURCE_TYPES.Model) {
      const modelReference = obj.resources.modelResource.modelIndex;
      const modelIdNum = rdb.modelReferenceList[modelReference].modelIdNum;

      // Filter exit door models where flag not set.
      if (modelIdNum === EXIT_DOOR_MODEL_ID && !allowExitDoors) continue;

      const matrix = getModelMatrix(obj);
      const acts = hasAction(obj);
      const action = acts ? modelAction(rdb, obj) : null;

      // Action doors are placed by their own pass, closed.
      if (isActionDoor(rdb, modelReference)) {
        const mr = obj.resources.modelResource;
        actionDoors.push({
          modelIdNum,
          matrix,
          startingLockValue: LOCK_VALUES[mr.triggerFlagStartingLock >> 4],
          action,
        });
        if (acts) addModelLink(obj, action);
        continue;
      }

      const model = getModel(modelIdNum);
      const staticDoors = getStaticDoors(model, blockIndex, 0, matrix);
      if (staticDoors) exitDoors.push(...staticDoors);

      placements.push({ modelIdNum, matrix, action, position: obj.position });
      if (acts) addModelLink(obj, action);
    } else if (obj.type === RDB_RESOURCE_TYPES.Flat) {
      const fr = obj.resources.flatResource;
      const x = obj.xPos * GLOBAL_SCALE;
      const y = -obj.yPos * GLOBAL_SCALE;
      const z = obj.zPos * GLOBAL_SCALE;
      const acts = fr.action > 0;
      const action = acts ? flatAction(obj) : null;

      if (fr.textureArchive === EDITOR_FLATS_ARCHIVE) {
        const marker = { record: fr.textureRecord, x, y, z, position: obj.position, action };
        markers.push(marker);
        if (fr.textureRecord === 10) {
          startMarkers.push(marker);
        } else if (fr.textureRecord === 8) {
          enterMarkers.push(marker);
        }
        // Editor flats always join the link dict (prev -1), verbatim.
        if (!actionLinks.has(obj.position)) {
          actionLinks.set(obj.position, { nextKey: fr.nextObjectOffset, prevKey: -1, action });
        }
      } else if (fr.textureArchive === FIXED_TREASURE_FLATS_ARCHIVE) {
        // Renderer-disabled in DFU, restored in place by AddFixedTreasure
        // (Systems arc). Marker data only.
        markers.push({ record: fr.textureRecord, archive: fr.textureArchive, x, y, z, position: obj.position, action });
        if (acts && !actionLinks.has(obj.position)) {
          actionLinks.set(obj.position, { nextKey: fr.nextObjectOffset, prevKey: -1, action });
        }
      } else {
        flats.push({ archive: fr.textureArchive, record: fr.textureRecord, x, y, z, action });
        if (acts && !actionLinks.has(obj.position)) {
          actionLinks.set(obj.position, { nextKey: fr.nextObjectOffset, prevKey: -1, action });
        }
      }
    } else if (obj.type === RDB_RESOURCE_TYPES.Light) {
      lights.push({
        x: obj.xPos * GLOBAL_SCALE,
        y: -obj.yPos * GLOBAL_SCALE,
        z: obj.zPos * GLOBAL_SCALE,
        radius: obj.resources.lightResource.radius * GLOBAL_SCALE,
      });
    }
  }

  // LinkActionNodes: resolve next/prev keys into action references.
  for (const link of actionLinks.values()) {
    if (!link.action) continue;
    if (actionLinks.has(link.nextKey)) link.action.nextObject = link.nextKey;
    if (actionLinks.has(link.prevKey)) link.action.previousObject = link.prevKey;
  }

  // Block water level and castle flag ride on the first start marker,
  // verbatim SetRDBResourceData + FindMarkers.
  let waterLevel = 10000; // no water
  let castleBlock = false;
  if (startMarkers.length > 0) {
    const first = startMarkers[0];
    const src = findFlatResource(rdb, first.position);
    if (src.soundIndex !== 0) waterLevel = -8 * src.soundIndex;
    castleBlock = src.magnitude !== 0;
  }

  return {
    placements, actionDoors, flats, markers, startMarkers, enterMarkers,
    lights, exitDoors, actionLinks, waterLevel, castleBlock,
  };
}

function findFlatResource(rdb, position) {
  for (const obj of rdbObjects(rdb)) {
    if (obj.position === position) return obj.resources.flatResource;
  }
  throw new Error(`flat resource not found at position ${position}`);
}
