// RMB block assembly: placed model matrices and ground tilemap.
// 1:1 translation of the layout math in Daggerfall Unity's RMBLayout.cs and
// MeshReader.GetSimpleGroundPlaneMesh (MIT, Daggerfall Workshop). Verbatim:
//   - Subrecord matrix: T(XPos, 0, RMBDimension - ZPos) * scale,
//     R(0, -YRotation / RotationDivisor, 0).
//   - Building model matrix: subRecordMatrix * TRS((X, -Y, Z) * scale,
//     euler(-XRot, -YRot, -ZRot) / RotationDivisor, modelScale). Classic data
//     never sets model scale (fields exist only for mod injection), so scale
//     is identity here.
//   - Misc models: TRS((X, -Y + propsOffsetY, Z + RMBDimension) * scale, ...).
//   - Ground tiles read GroundTiles[x][15 - y]; records >= 56 are random
//     markers reset to grass. DFU writes tilemap INDEX 8 there, which is
//     texture RECORD 2 (index = record * 4 + variant; TerrainTexturing's
//     grass = 2), so our decoded tile is record 2. Ground sits at
//     GroundOffset (-1)
//     to minimise depth-fighting, tile size 256, 16x16 tiles.
// Flats/billboards live in rmbFlats.js (milestone 3). Interiors and people
// records are later features of this arc; see bible/03-World/World-Arc.md.

import { ROTATION_DIVISOR, RMB_DIMENSION } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { trs, multiply } from './mat4.js';

const PROPS_OFFSET_Y = -4;
export const GROUND_OFFSET = -1;
export const GROUND_TILE_SIZE = 256;   // RMBTileSide mirror - value-pinned, no mesh consumer yet (AUDIT 23 wa-5)
export const GROUND_TILE_DIM = 16;

/**
 * Assemble an RMB block into world placements.
 * @param {object} dfBlock - output of BlocksFile.getBlock() (type Rmb).
 * @returns {{models:Array<{modelId:string,modelIdNum:number,matrix:Float32Array}>,
 *   groundTiles:Array<Array<{record:number,rotated:boolean,flipped:boolean}>>}}
 */
export function layoutRmbBlock(dfBlock) {
  const rmb = dfBlock.rmbBlock;
  const models = [];

  // Exterior building models per subrecord (recordIndex feeds the
  // interior transition - PlayerEnterExit keys interiors on it).
  for (let recordIndex = 0; recordIndex < rmb.subRecords.length; recordIndex++) {
    const subRecord = rmb.subRecords[recordIndex];
    const subRecordMatrix = trs(
      subRecord.xPos * GLOBAL_SCALE,
      0,
      (RMB_DIMENSION - subRecord.zPos) * GLOBAL_SCALE,
      0,
      -subRecord.yRotation / ROTATION_DIVISOR,
      0
    );

    for (const obj of subRecord.exterior.block3dObjectRecords) {
      const modelMatrix = trs(
        obj.xPos * GLOBAL_SCALE,
        -obj.yPos * GLOBAL_SCALE,
        obj.zPos * GLOBAL_SCALE,
        -obj.xRotation / ROTATION_DIVISOR,
        -obj.yRotation / ROTATION_DIVISOR,
        -obj.zRotation / ROTATION_DIVISOR
      );
      models.push({
        modelId: obj.modelId,
        modelIdNum: obj.modelIdNum,
        matrix: multiply(subRecordMatrix, modelMatrix),
        recordIndex,
      });
    }
  }

  // Miscellaneous scene models.
  for (const obj of rmb.misc3dObjectRecords) {
    models.push({
      modelId: obj.modelId,
      modelIdNum: obj.modelIdNum,
      matrix: trs(
        obj.xPos * GLOBAL_SCALE,
        (-obj.yPos + PROPS_OFFSET_Y) * GLOBAL_SCALE,
        (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE,
        -obj.xRotation / ROTATION_DIVISOR,
        -obj.yRotation / ROTATION_DIVISOR,
        -obj.zRotation / ROTATION_DIVISOR
      ),
    });
  }

  return { models, groundTiles: buildGroundTilemap(dfBlock) };
}

/**
 * 16x16 ground tilemap, row 0 nearest Z=0, with the verbatim
 * GroundTiles[x][15 - y] source flip and grass override for records >= 56.
 * DFU writes the marker as tilemap INDEX 8 (`new Color32(8, 0, 0, 8)`) in
 * the same space as `record * 4 + variant`, i.e. texture RECORD 2 - which
 * is TerrainTexturing.cs:44's `const byte grass = 2`. We store decoded
 * records, so the marker is record 2, not 8.
 * Indexed [y][x].
 */
export function buildGroundTilemap(dfBlock) {
  const src = dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
  const tiles = new Array(GROUND_TILE_DIM);
  for (let y = 0; y < GROUND_TILE_DIM; y++) {
    tiles[y] = new Array(GROUND_TILE_DIM);
    for (let x = 0; x < GROUND_TILE_DIM; x++) {
      const tile = src[x][GROUND_TILE_DIM - 1 - y];
      if (tile.textureRecord < 56) {
        tiles[y][x] = {
          record: tile.textureRecord,
          rotated: tile.isRotated,
          flipped: tile.isFlipped,
        };
      } else {
        // Random marker reset to grass: DFU's index 8 == record 2, variant 0.
        tiles[y][x] = { record: 2, rotated: false, flipped: false };
      }
    }
  }
  return tiles;
}
