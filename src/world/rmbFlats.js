// RMB flat (billboard) collection: misc block flats, exterior subrecord
// flats, and ground scenery. 1:1 with Daggerfall Unity's RMBLayout
// AddMiscBlockFlats / AddExteriorBlockFlats / AddNatureFlats and
// MeshReader.GetScaledBillboardSize (MIT, Daggerfall Workshop). Verbatim:
//   - blockFlatsOffsetY -6, natureFlatsOffsetY -2 (raw constants).
//   - Flat position = (XPos, -YPos + blockFlatsOffsetY, ZPos + 4096) * scale.
//   - Exterior subrecord flats offset by (subX, 0, -subZ) * scale with NO
//     subrecord rotation - DFU does not rotate exterior flats with the
//     building subrecord.
//   - Exterior flats in the nature archive range (500-511) swap to the
//     climate nature archive and then DFU assigns
//     billboardPosition.z = natureFlatsOffsetY (the raw -2, post-scale).
//     This looks like an upstream y/z typo but is kept verbatim for parity;
//     flagged in World-Arc.md.
//   - Ground scenery reads GroundScenery[x][15 - y], skips records < 1
//     (0 is a marker), places at (x*256, natureFlatsOffsetY, y*256+256)*scale
//     with the climate nature archive.
//   - Editor flats (archive 199) are skipped for subrecord exteriors.
//   - Scaled billboard size: change = trunc(size * scale / 256) per axis,
//     final = (size + change) * GlobalScale. Billboards are bottom-anchored:
//     AlignToBase raises the centre by half the final height.
// Lights (archive 210) get their billboard here; the point-light component
// and NPC/faction metadata are later features (see World-Arc.md).

import { RMB_DIMENSION, SCALE_DIVISOR } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';

const BLOCK_FLATS_OFFSET_Y = -6;
const NATURE_FLATS_OFFSET_Y = -2;
export const EDITOR_FLATS_ARCHIVE = 199;
export const LIGHTS_ARCHIVE = 210;
const NATURE_ARCHIVE_MIN = 500; // ClimateTextureSet.Nature_RainForest
const NATURE_ARCHIVE_MAX = 511; // ClimateTextureSet.Nature_Mountains_Snow

/**
 * World-unit billboard size for a texture record, verbatim
 * GetScaledBillboardSize.
 * @param {{width:number,height:number}} size - record dimensions.
 * @param {{width:number,height:number}} scale - record scale fields.
 * @returns {{w:number,h:number}}
 */
export function scaledBillboardSize(size, scale) {
  const xChange = Math.trunc(size.width * (scale.width / SCALE_DIVISOR));
  const yChange = Math.trunc(size.height * (scale.height / SCALE_DIVISOR));
  return {
    w: (size.width + xChange) * GLOBAL_SCALE,
    h: (size.height + yChange) * GLOBAL_SCALE,
  };
}

/**
 * Collect every flat of one RMB block as {archive, record, x, y, z} with the
 * position at the billboard BASE (AlignToBase handled by the renderer via
 * the scaled size).
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rmb).
 * @param {number} natureArchive - climate nature archive
 *   (dfLocation.climate.natureArchive).
 * @returns {Array<{archive:number,record:number,x:number,y:number,z:number}>}
 */
export function collectBlockFlats(dfBlock, natureArchive) {
  const rmb = dfBlock.rmbBlock;
  const flats = [];

  // Misc block flats (lights included - AddLights uses the same position).
  for (const obj of rmb.miscFlatObjectRecords) {
    flats.push({
      archive: obj.textureArchive,
      record: obj.textureRecord,
      x: obj.xPos * GLOBAL_SCALE,
      y: (-obj.yPos + BLOCK_FLATS_OFFSET_Y) * GLOBAL_SCALE,
      z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE,
    });
  }

  // Exterior subrecord flats: unrotated subrecord offset, editor flats
  // skipped, nature range swapped to the climate archive.
  for (const subRecord of rmb.subRecords) {
    const subX = subRecord.xPos * GLOBAL_SCALE;
    const subZ = -subRecord.zPos * GLOBAL_SCALE;
    for (const obj of subRecord.exterior.blockFlatObjectRecords) {
      let archive = obj.textureArchive;
      if (archive === EDITOR_FLATS_ARCHIVE) continue;

      let x = obj.xPos * GLOBAL_SCALE + subX;
      let y = (-obj.yPos + BLOCK_FLATS_OFFSET_Y) * GLOBAL_SCALE;
      let z = (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE + subZ;

      if (archive >= NATURE_ARCHIVE_MIN && archive <= NATURE_ARCHIVE_MAX) {
        archive = natureArchive;
        // Verbatim DFU: billboardPosition.z = natureFlatsOffsetY (raw -2).
        z = NATURE_FLATS_OFFSET_Y;
      }

      flats.push({ archive, record: obj.textureRecord, x, y, z });
    }
  }

  // Ground scenery -> climate nature flats.
  const scenery = rmb.fldHeader.groundData.groundScenery;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const item = scenery[x][15 - y];
      if (item.textureRecord < 1) continue;
      flats.push({
        archive: natureArchive,
        record: item.textureRecord,
        x: x * 256 * GLOBAL_SCALE,
        y: NATURE_FLATS_OFFSET_Y * GLOBAL_SCALE,
        z: (y * 256 + 256) * GLOBAL_SCALE,
      });
    }
  }

  return flats;
}
