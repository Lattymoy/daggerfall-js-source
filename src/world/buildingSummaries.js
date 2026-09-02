// ROAD-C c2/S10 HALF B: RMBLayout.GetBuildingData's POSITION half
// (RMBLayout.cs:550-582), which is what the exterior automap's
// nameplate anchor is computed from and what nothing in the port could
// answer before this stage.
//
// The port already owns the identity half and this module REUSES it
// rather than restating it: mergeNamedBuildings is
// GetCompleteBuildingData's pool merge, blockBuildingCount is DFU's
// `SubRecords.Length` bound, and makeBuildingKey is
// BuildingDirectory.MakeBuildingKey - all three from
// systems/talkTopics.js, all three already pinned there. What is NEW
// is exactly what RMBLayout.cs:570-571 sets and nothing else:
//
//   Position = new Vector3(subRecord.XPos, 0, RMBDimension - subRecord.ZPos) * GlobalScale
//   Rotation = new Vector3(0, -subRecord.YRotation / RotationDivisor, 0)
//
// plus the two columns the automap's name law reads (isResidence for
// the residence arm, BuildingNames.GetName for
// revealUndiscoveredBuildings).
//
// WHY IT IS PER-BLOCK AND CARRIES THE GRID CELL. ExteriorAutomap walks
// `RMBLayout.GetBuildingData(blocks[index], x, y)` per block and pairs
// each result with `exteriorLayout[index]`, whose rect is that block's
// grid cell x64 (:653-666). The anchor is the sum, so the cell rides
// along on every row.
//
// NOTE THE BOUND. DFU sizes the array by `RmbBlock.SubRecords.Length`
// and indexes BuildingDataList by the same i; the port's
// `min(list.length, blockBuildingCount)` is that rule, and a garbage
// entry past the declared record count is not a building (AUDIT 39r
// R10 - rmbLayout's enhanced windmill appends a subrecord without
// bumping numBlockDataRecords, which is why the bound exists at all).

import { mergeNamedBuildings, blockBuildingCount, makeBuildingKey } from '../systems/talkTopics.js';
import { generateBuildingName, isResidence } from './buildingNames.js';
import { GLOBAL_SCALE } from './meshReader.js';
// ONE HOME (the audit24 ratchet): BlocksFile.RMBDimension and
// BlocksFile.RotationDivisor already live with the format that defines
// them - this module reads them, it does not redeclare them.
import { RMB_DIMENSION, ROTATION_DIVISOR } from '../formats/blocksFile.js';

/**
 * BuildingSummary.Position for ONE subrecord (RMBLayout.cs:570).
 * `sub` is the port's rmbBlock subRecord shape ({ xPos, zPos,
 * yRotation }). Pure.
 */
export function buildingPosition(sub, globalScale = GLOBAL_SCALE) {
  return [
    (sub?.xPos ?? 0) * globalScale,
    0,
    (RMB_DIMENSION - (sub?.zPos ?? 0)) * globalScale,
  ];
}

/** BuildingSummary.Rotation's y (RMBLayout.cs:571) - degrees. */
export const buildingRotationY = (sub) => -(sub?.yRotation ?? 0) / ROTATION_DIVISOR;

/**
 * Every building of every block, each carrying its buildingKey, its
 * block grid cell, its Position and the two name columns the exterior
 * automap reads.
 *
 * @param exteriorBuildings the DFLocation.BuildingData array
 * @param blocks the laid-out block instances ({ x, y, dfBlock })
 * @param nameOpts BuildingNames.GetName's context (locationName,
 *   regionName, ...) - consulted only for the
 *   revealUndiscoveredBuildings arm, which is what DFU calls
 *   BuildingNames.GetName for at :712-719.
 */
export function buildingSummaries(exteriorBuildings, blocks, nameOpts = {}) {
  const merged = mergeNamedBuildings(exteriorBuildings ?? [], blocks ?? []);
  const out = [];
  for (const b of blocks ?? []) {
    const list = merged.get(b) ?? [];
    const subs = b.dfBlock?.rmbBlock?.subRecords ?? [];
    const count = Math.min(list.length, blockBuildingCount(b.dfBlock) ?? list.length);
    for (let i = 0; i < count; i++) {
      const data = list[i];
      if (!data) continue;
      const sub = subs[i] ?? null;
      out.push({
        buildingKey: makeBuildingKey(b.x ?? 0, b.y ?? 0, i),
        recordIndex: i,
        blockX: b.x ?? 0,
        blockY: b.y ?? 0,
        position: buildingPosition(sub),
        rotationY: buildingRotationY(sub),
        buildingType: data.buildingType,
        factionId: data.factionId,
        quality: data.quality,
        nameSeed: data.nameSeed,
        isResidence: isResidence(data.buildingType),
        name: generateBuildingName(data.nameSeed, data.buildingType, { ...nameOpts, factionId: data.factionId }),
      });
    }
  }
  return out;
}
