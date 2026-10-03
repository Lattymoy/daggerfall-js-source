// WD3's fakes: a classic RMB block the size of a test, in the port's DFBlock shape (BlocksFile.readClassicBlock's), and
// a BLOCKS.BSA holding a few of them - the pack's reader (test/wd3_pack.test.js) and the world-data door
// (test/wd3_door.test.js) read through them.
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';

export const half = (models = [], flats = [], doors = []) => ({
  header: { num3dObjectRecords: models.length, numFlatObjectRecords: flats.length, numSection3Records: 1, numPeopleRecords: 0, numDoorRecords: doors.length },
  block3dObjectRecords: models, blockFlatObjectRecords: flats, blockSection3Records: [{ xPos: 1, yPos: 2, zPos: 3 }], blockPeopleRecords: [], blockDoorRecords: doors,
});
export const model = (id, x, extra = {}) => ({ modelId: String(id), modelIdNum: id, objectType: 3, xPos: x, yPos: -40, zPos: 300, xRotation: 0, yRotation: 512, zRotation: 0, ...extra });
export const flat = (a, r, x) => ({ position: 1000 + x, xPos: x, yPos: -8, zPos: 64, textureArchive: a, textureRecord: r, factionID: 0, flags: 0 });

/** A two-building RMB block: a subrecord with models (one scaled), a flat and a door outside and a bed inside, a second
 *  subrecord, a mill among the block's own models, ground tiles and scenery in every cell, an automap. */
export function tinyRmb(index = 7, name = 'TINYAA00.RMB') {
  const tiles = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ tileBitfield: (x + y) & 63, textureRecord: (x * 3 + y) % 56, isRotated: x % 2 === 1, isFlipped: y % 3 === 0 })));
  const scenery = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ textureRecord: (x + 2 * y) % 32 })));
  const autoMap = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) autoMap[i] = i % 97 === 0 ? 3 : 0;
  return {
    position: 1234, index, name, type: BLOCK_TYPES.Rmb, rdbBlock: null, rdiBlock: null,
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: 2, numMisc3dObjectRecords: 1, numMiscFlatObjectRecords: 1,
        blockPositions: [{ xPos: 0, zPos: 0, yRotation: 0 }, { xPos: 2048, zPos: 1024, yRotation: 512 }],
        buildingDataList: [
          { nameSeed: 101, factionId: 0, sector: 1, locationId: 0, buildingType: 18, quality: 7 },
          { nameSeed: 202, factionId: 41, sector: 2, locationId: 0, buildingType: 3, quality: 12 },
        ],
        blockDataSizes: new Array(32).fill(0), autoMapData: autoMap, name, otherNames: null,
        groundData: { header: [1, 2, 3, 4, 5, 6, 7, 8], groundTiles: tiles, groundScenery: scenery },
      },
      subRecords: [
        { xPos: 0, zPos: 0, yRotation: 0, exterior: half([model(41000, 10), model(41001, 20, { xScale: 1.5 })], [flat(210, 4, 5)], [{ position: 9, xPos: 1, yPos: 0, zPos: 2, yRotation: 512, openRotation: -512, doorModelIndex: 0 }]), interior: half([model(41002, 30)], [flat(205, 17, 6)]) },
        { xPos: 2048, zPos: 1024, yRotation: 512, exterior: half([model(41100, 40)]), interior: half() },
      ],
      misc3dObjectRecords: [model(41600, 50)], miscFlatObjectRecords: [flat(254, 2, 7)],
    },
  };
}

/** A BLOCKS.BSA of the blocks handed in, counting how often each is read; `count` past the last index. */
export function fakeBlocks(...list) {
  const reads = new Map();
  return {
    reads,
    count: 1000,
    getBlockName: (i) => list.find((b) => b.index === i)?.name ?? null,
    getBlockIndex: (n) => list.find((b) => b.name === n)?.index ?? -1,
    readClassicBlock: (i) => { reads.set(i, (reads.get(i) ?? 0) + 1); const b = list.find((x) => x.index === i); return b ? structuredClone(b) : null; },
  };
}
