// Exterior location assembly: resolve and place every RMB block of a
// location on the world grid. 1:1 with Daggerfall Unity's
// DaggerfallLocation.LayoutLocation (MIT, Daggerfall Workshop):
//   - Block name = BlocksFile.CheckName(MapsFile.GetRmbBlockName(x, y)),
//     which routes unresolvable names through the prefix/suffix alternate
//     search.
//   - Block (x, y) sits at world (x * RMBSide, 0, y * RMBSide),
//     RMBSide = 4096 * GlobalScale = 102.4. No row inversion.
//   - The location climate's ground archive textures the tilemaps
//     (dfLocation.climate.groundArchive from GetWorldClimateSettings).
// Billboard batches (nature/lights/animals) and climate texture swaps on
// architecture are queued features - see World-Arc.md.

import { GLOBAL_SCALE } from './meshReader.js';
import { layoutRmbBlock } from './rmbLayout.js';
import { RMB_DIMENSION } from '../formats/blocksFile.js';

export const RMB_SIDE = RMB_DIMENSION * GLOBAL_SCALE;

/**
 * DFLocation.HasCustomLocationPosition (DFLocation.cs:88-97), verbatim
 * including its comment's uncertainty: "Some 1x1 locations (e.g.
 * Privateer's Hold exterior) are positioned differently. Seems to be
 * 1x1 blocks using CUST prefix, but possibly more research needed."
 *
 * ROAD-C c2/S10 needs it because the exterior automap's player marker
 * takes a hand correction at exactly those locations
 * (ExteriorAutomap.cs:1391-1395: -64 on x, +3 on z).
 */
export function hasCustomLocationPosition(dfLocation) {
  const ext = dfLocation?.exterior?.exteriorData;
  if (!ext || ext.width !== 1 || ext.height !== 1) return false;
  return String(ext.blockNames?.[0] ?? '').startsWith('CUST');
}

/**
 * Lay out a full exterior location.
 * @param {object} dfLocation - MapsFile.getLocation output.
 * @param {MapsFile} mapsFile - for block-name resolution.
 * @param {BlocksFile} blocksFile - block source.
 * @param {{enhanced?:boolean}} [opts] - the caller's skin, passed to
 *   layoutRmbBlock (the mill subrecord it attaches is enhanced-only).
 * @returns {{width:number,height:number,groundArchive:number,
 *   blocks:Array<{x:number,y:number,blockName:string,dfBlock:object,
 *   layout:object,originX:number,originZ:number}>}}
 */
export function layoutLocation(dfLocation, mapsFile, blocksFile, { enhanced = false } = {}) {
  const width = dfLocation.exterior.exteriorData.width;
  const height = dfLocation.exterior.exteriorData.height;
  const blocks = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const blockName = blocksFile.checkName(mapsFile.getRmbBlockName(dfLocation, x, y));
      const dfBlock = blocksFile.getBlockByName(blockName);
      if (!dfBlock) continue; // unresolvable even after alternate search
      blocks.push({
        x,
        y,
        blockName,
        dfBlock,
        layout: layoutRmbBlock(dfBlock, { enhanced }),
        originX: x * RMB_SIDE,
        originZ: y * RMB_SIDE,
      });
    }
  }

  return {
    width,
    height,
    groundArchive: dfLocation.climate.groundArchive,
    blocks,
  };
}
