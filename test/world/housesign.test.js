// HOUSE-SIGN (the owner, 2026-10-25: "remove the shop signs outside of buildings when the building is actually a house
// and not a shop"). A shop's sign (ARCH3D 43700-43799) is a block's misc model that DFU stands tied to no building
// (RMBLayout.AddProps), so a block that types a shop's model as a house kept the shop's sign at the house's door. The
// sign now belongs to the building whose door is nearest it within SIGN_REACH_M, and a house's sign does not stand
// (world/houseSigns.js; bible/01-Overview/bugs/Field-Bugs-2026-10-09.md SIGN-HOUSE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHouseSign, signedBuildingOf, isShopSignModel, isHouseType, SIGN_REACH_M } from '../../src/world/houseSigns.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { DOOR_TYPE, GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { RMB_DIMENSION } from '../../src/formats/blocksFile.js';
import { skipReal, game } from '../lwRealTown.mjs';

const TAVERN_SIGN = 43727;   // TVRNAM00's sign (SIGN-HOUSE)
const NOT_A_SIGN = 41209;    // a misc model TVRNAM00 places beside its signs
const flatGround = () => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, isRotated: false, isFlipped: false })));
const record = (modelIdNum) => ({ modelId: String(modelIdNum), modelIdNum, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 });

/**
 * A block as BLOCKS.BSA's reader hands it, laid out by the producer (layoutRmbBlock): one building per entry, its model
 * placed at (x, z) metres in the block's frame, and the misc models at theirs. Each building's model id is 100 + its
 * record, and its door is the model's own (doorsOf), so a test places a door by placing its building.
 */
function townBlock(buildings, misc) {
  const dfBlock = {
    name: 'HOUSESIGN.RMB',
    rmbBlock: {
      fldHeader: { buildingDataList: buildings.map((b) => ({ buildingType: b.type })), groundData: { groundTiles: flatGround() } },
      subRecords: buildings.map((b, i) => ({
        xPos: b.x / GLOBAL_SCALE, zPos: RMB_DIMENSION - b.z / GLOBAL_SCALE, yRotation: 0,
        exterior: { block3dObjectRecords: [record(100 + i)] },
      })),
      misc3dObjectRecords: misc.map((m) => ({ ...record(m.id), xPos: m.x / GLOBAL_SCALE, zPos: m.z / GLOBAL_SCALE - RMB_DIMENSION })),
    },
  };
  return { dfBlock, layout: layoutRmbBlock(dfBlock) };
}
/** Every building model's one building door, at its origin. */
const doorsOf = (modelIdNum) => (modelIdNum >= 100 && modelIdNum < 200 ? [{ type: DOOR_TYPE.BUILDING, vert0: { x: -0.5, y: 0, z: 0 }, vert2: { x: 0.5, y: 2, z: 0 } }] : undefined);
const signsOf = (block) => block.layout.models.filter((m) => m.recordIndex == null);
const standing = (block, lookup = doorsOf) => signsOf(block).filter((m) => !isHouseSign(m, block, lookup)).map((m) => m.modelIdNum);

test('HOUSE-SIGN a shop\'s sign 2.4 m from a house\'s door does not stand; the same sign at a tavern\'s door, or at a bank\'s, stands (mutants: the house test dropped; the sign range closed)', () => {
  const at = (type) => townBlock([{ type, x: 50, z: 50 }], [{ id: TAVERN_SIGN, x: 50, z: 52.4 }]);
  assert.deepEqual(standing(at(BUILDING_TYPES.House2)), []);
  assert.deepEqual(standing(at(BUILDING_TYPES.HouseForSale)), []);
  assert.deepEqual(standing(at(BUILDING_TYPES.Tavern)), [TAVERN_SIGN]);
  assert.deepEqual(standing(at(BUILDING_TYPES.Bank)), [TAVERN_SIGN]);
  assert.equal(signedBuildingOf(signsOf(at(BUILDING_TYPES.House2))[0], at(BUILDING_TYPES.House2), doorsOf), 0);
});

test('HOUSE-SIGN the nearest door names the sign\'s building: a house\'s door 3 m off and a tavern\'s 5 m off take the sign down, the two swapped leave it standing (mutants: the farthest door kept)', () => {
  const block = (houseZ, tavernZ) => townBlock(
    [{ type: BUILDING_TYPES.House2, x: 50, z: houseZ }, { type: BUILDING_TYPES.Tavern, x: 50, z: tavernZ }],
    [{ id: TAVERN_SIGN, x: 50, z: 50 }],
  );
  assert.deepEqual(standing(block(47, 55)), []);
  assert.deepEqual(standing(block(55, 47)), [TAVERN_SIGN]);
  assert.equal(signedBuildingOf(signsOf(block(55, 47))[0], block(55, 47), doorsOf), 1);
});

test('HOUSE-SIGN a sign farther than SIGN_REACH_M from every door hangs on no building and stands, even with a house\'s door the nearest (mutants: the reach widened)', () => {
  assert.equal(SIGN_REACH_M, 8);
  const block = (distance) => townBlock([{ type: BUILDING_TYPES.House2, x: 50, z: 50 }], [{ id: TAVERN_SIGN, x: 50 + distance, z: 50 }]);
  assert.deepEqual(standing(block(7.9)), []);
  assert.deepEqual(standing(block(8.1)), [TAVERN_SIGN]);
  assert.equal(signedBuildingOf(signsOf(block(9))[0], block(9), doorsOf), -1);
});

test('HOUSE-SIGN only a shop\'s sign is asked: another misc model at a house\'s door stands, a building\'s own model is never a sign, a dungeon\'s door names no building, and a building whose model is not loaded has no door (mutants: a building model asked; the door type ignored)', () => {
  const block = townBlock([{ type: BUILDING_TYPES.House2, x: 50, z: 50 }], [{ id: NOT_A_SIGN, x: 50, z: 51 }, { id: TAVERN_SIGN, x: 50, z: 51 }]);
  assert.deepEqual(standing(block), [NOT_A_SIGN]);
  const building = block.layout.models.find((m) => m.recordIndex === 0);
  assert.equal(isHouseSign({ ...building, modelIdNum: TAVERN_SIGN }, block, doorsOf), false);
  const dungeonDoor = () => [{ type: DOOR_TYPE.DUNGEON_ENTRANCE, vert0: { x: -0.5, y: 0, z: 0 }, vert2: { x: 0.5, y: 2, z: 0 } }];
  assert.deepEqual(standing(block, dungeonDoor), [NOT_A_SIGN, TAVERN_SIGN]);
  assert.deepEqual(standing(block, () => undefined), [NOT_A_SIGN, TAVERN_SIGN]);
  assert.deepEqual([43699, 43700, 43799, 43800].map(isShopSignModel), [false, true, true, false]);
  assert.deepEqual([BUILDING_TYPES.HouseForSale, BUILDING_TYPES.House1, BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.Tavern].map(isHouseType), [true, true, true, false, false]);
});

test('HOUSE-SIGN the game\'s own blocks (ARENA2): of BLOCKS.BSA\'s 668 shops\' signs, the six at a house\'s door come down - TVRNAM00\'s tavern sign among them - and every other stands, the two on a big tavern\'s side wall 19 m from its door included', { skip: skipReal }, () => {
  const { blocks, modelOf } = game();
  const lookup = (id) => modelOf(id)?.doors;
  let signs = 0;
  const down = [];
  for (let i = 0; i < blocks.count; i++) {
    const name = blocks.getBlockName(i);
    if (!name?.endsWith('.RMB')) continue;
    const dfBlock = blocks.getBlock(i);
    if (!dfBlock?.rmbBlock) continue;
    const block = { dfBlock, layout: layoutRmbBlock(dfBlock) };
    for (const placed of block.layout.models) {
      if (placed.recordIndex != null || !isShopSignModel(placed.modelIdNum)) continue;
      signs++;
      if (isHouseSign(placed, block, lookup)) down.push(`${name} ${placed.modelIdNum} record ${signedBuildingOf(placed, block, lookup)}`);
    }
  }
  assert.equal(signs, 668);
  assert.deepEqual(down.sort(), [
    'ARMRAM01.RMB 43746 record 10',
    'ARMRAM03.RMB 43736 record 14',
    'BANKAS01.RMB 43708 record 0',
    'BOOKAL01.RMB 43754 record 18',
    'FURNAL03.RMB 43731 record 1',
    'TVRNAM00.RMB 43727 record 0',
  ]);
});
