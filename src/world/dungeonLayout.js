// Dungeon assembly: RDB blocks on their grid with the per-dungeon texture
// table, start/enter markers, water levels, and overlapping-door removal.
// 1:1 translation of Daggerfall Unity's DaggerfallDungeon.cs layout paths
// (MIT, Daggerfall Workshop). Verbatim:
//   - Block (X, Z) sits at (X * RDBSide, 0, Z * RDBSide), RDBSide = 2048 *
//     GlobalScale = 51.2. No row inversion.
//   - Exit doors (model 70300) only lay out in the starting block
//     (allowExitDoors = IsStartingBlock).
//   - Texture table comes from RandomTextureTableClassic seeded with the
//     dungeon's LocationId (classic algorithm; DFU's default for classic
//     parity).
//   - Water level and castleBlock read from each block's first start
//     marker; blocks without one have no water (10000).
//   - RemoveOverlappingDoors: the registry seeds with the DungeonExit
//     static door centre in DUNGEON-ROOT space - DFU multiplies the
//     building matrix only, without the block origin (benign because the
//     starting block sits at grid 0,0; kept verbatim). Then every action
//     door (world position, block order) within 1.4 of a registry entry is
//     disabled; survivors join the registry.

import { layoutRdbBlock, RDB_SIDE } from './rdbLayout.js';
import { dungeonTextureTable } from './dungeonTextures.js';   // AUDIT 28 W3c: the whole modes-0-4 fork
import { DOOR_TYPE } from './meshReader.js';
import { transformPoint } from './mat4.js';

export { RDB_SIDE };

const OVERLAP_TOLERANCE = 1.4;

/**
 * Assemble a full dungeon from location data.
 * @param {object} dfLocation - MapsFile.getLocationByName output
 *   (hasDungeon true).
 * @param {object} blocksFile - loaded BlocksFile.
 * @param {(modelIdNum:number) => object} getModel - resolves a model id to
 *   dfMeshToModel output.
 * @returns {{blocks:Array<{name:string,originX:number,originZ:number,
 *   isStartingBlock:boolean,layout:object}>,textureTable:number[],
 *   startMarker:{x,y,z}|null,enterMarker:{x,y,z}|null}}
 */
export function layoutDungeon(dfLocation, blocksFile, getModel) {
  if (!dfLocation.hasDungeon) {
    throw new Error(`location has no dungeon: ${dfLocation.name}`);
  }

  // AUDIT 28 W3c: the whole RandomDungeonTextures fork (modes 0-4 with
  // the main-story gate on the raw MapId), not the bare classic call -
  // the setting had sat stored while the port always answered mode 0.
  const textureTable = dungeonTextureTable({
    locationId: dfLocation.dungeon.recordElement.header.locationId,
    mapId: dfLocation.mapTableData?.mapId ?? 0,   // a fixture without a map-table entry is nobody's main story
    worldClimate: dfLocation.climate.worldClimate,
  });

  const blocks = [];
  let startMarker = null;
  let enterMarker = null;

  for (const block of dfLocation.dungeon.blocks) {
    const blockIndex = blocksFile.getBlockIndex(block.blockName);
    if (blockIndex === -1) throw new Error(`block not found: ${block.blockName}`);
    const dfBlock = blocksFile.getBlock(blockIndex);
    const layout = layoutRdbBlock(dfBlock, blockIndex, block.isStartingBlock, getModel);
    const originX = block.x * RDB_SIDE;
    const originZ = block.z * RDB_SIDE;

    // Start and enter markers assign from the starting block only,
    // verbatim FindMarkers (first marker wins).
    if (block.isStartingBlock) {
      if (layout.startMarkers.length > 0) {
        const m = layout.startMarkers[0];
        startMarker = { x: m.x + originX, y: m.y, z: m.z + originZ };
      }
      if (layout.enterMarkers.length > 0) {
        const m = layout.enterMarkers[0];
        enterMarker = { x: m.x + originX, y: m.y, z: m.z + originZ };
      }
    }

    blocks.push({
      name: block.blockName,
      originX,
      originZ,
      isStartingBlock: block.isStartingBlock,
      layout,
      dfBlock, // retained for per-block consumers (R6 dungeon lights)
    });
  }

  removeOverlappingDoors(blocks);

  return { blocks, textureTable, startMarker, enterMarker };
}

// Verbatim DaggerfallDungeon.RemoveOverlappingDoors: disabled doors get
// `disabled: true` (DFU SetActive(false)).
function removeOverlappingDoors(blocks) {
  const registry = [];

  // Seed with DungeonExit static door centres - dungeon-root space,
  // building matrix only (no block origin). DFU breaks after the first
  // exit per collection (block) but keeps scanning collections, verbatim.
  for (const b of blocks) {
    for (const door of b.layout.exitDoors) {
      if (door.doorType === DOOR_TYPE.DUNGEON_EXIT) {
        registry.push(transformPoint(door.matrix, door.centre.x, door.centre.y, door.centre.z));
        break;
      }
    }
  }

  for (const b of blocks) {
    for (const actionDoor of b.layout.actionDoors) {
      const pos = [
        actionDoor.matrix[12] + b.originX,
        actionDoor.matrix[13],
        actionDoor.matrix[14] + b.originZ,
      ];
      let duplicateFound = false;
      for (const p of registry) {
        const d = Math.hypot(pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]);
        if (d < OVERLAP_TOLERANCE) {
          actionDoor.disabled = true;
          duplicateFound = true;
          break;
        }
      }
      if (!duplicateFound) registry.push(pos);
    }
  }
}
