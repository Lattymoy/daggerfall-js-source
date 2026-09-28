// CRUX-DOOR (2026-09-27, Discord, "Final Main Quest Dungeon": "In the Mantellan Crux (final MQ dungeon) when reaching
// entrance to the Fire Skull Room after touching the big crystal, it will not go there, instead it leads back to
// outside"; the door's name read "To High Rock sea coast Region").
//
// A block's `exitDoors` is DFU's own misnomer (RDBLayout.cs:37, :621, :637): every door face of every model the block
// places - building (texture archive 74), dungeon-entrance (56/331) and dungeon-exit (95). The dungeon host took every
// entry as a way out, so a model's entrance-type door face in the Crux became an "exit:" target, named "To <region>
// Region" and sent the click to the outside - in front of the model's own Teleport, whose box it padded over. Only a
// DungeonExit door leaves (PlayerActivate.cs:649) and only an exit door gets a collider (DaggerfallStaticDoors.cs:44-66).
//
// Driven through the real producer: a synthetic RDB block laid by `layoutRdbBlock` over meshes read by `dfMeshToModel`
// (no ARENA2 - the door type is the mesh reader's verdict off the texture archive, as for a real model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutRdbBlock } from '../src/world/rdbLayout.js';
import { dfMeshToModel, DOOR_TYPE } from '../src/world/meshReader.js';
import { RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';
import { isDungeonExitDoor } from '../src/world/dungeonLayout.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quad = (x) => ({ points: [{ x, y: 0, z: 0, u: 0, v: 0 }, { x: x + 40, y: 0, z: 0, u: 0, v: 0 }, { x: x + 40, y: -80, z: 0, u: 0, v: 0 }, { x, y: -80, z: 0, u: 0, v: 0 }] });
// a wall submesh (archive 19) and one door-face submesh of the archive given
const mesh = (doorArchive) => ({ totalVertices: 8, totalTriangles: 4, subMeshes: [
  { textureArchive: 19, textureRecord: 0, planes: [quad(-100)] },
  { textureArchive: doorArchive, textureRecord: 1, planes: [quad(0)] },
] });
const size = () => ({ width: 1, height: 1 });
const MODELS = { 60001: dfMeshToModel(mesh(56), size), 60002: dfMeshToModel(mesh(174), size), 60003: dfMeshToModel(mesh(95), size) };
const obj = (position, modelIndex) => ({
  type: RDB_RESOURCE_TYPES.Model, position, xPos: 0, yPos: 0, zPos: 0,
  resources: { modelResource: { modelIndex, xRotation: 0, yRotation: 0, zRotation: 0, triggerFlagStartingLock: 0,
    actionResource: { flags: 0, nextObjectOffset: -1, previousObjectOffset: -1, axis: 0, duration: 0, magnitude: 0, position: 0 } } },
});
const BLOCK = { position: 0, rdbBlock: {
  modelReferenceList: [{ modelIdNum: 60001, description: 'XXX' }, { modelIdNum: 60002, description: 'XXX' }, { modelIdNum: 60003, description: 'XXX' }],
  objectRootList: [{ rdbObjects: [obj(100, 0), obj(200, 1), obj(300, 2)] }],
} };

test('CRUX-DOOR: a block\'s door list is every door face its models carry, and only the DungeonExit one leaves the dungeon (PlayerActivate.cs:649)', () => {
  const layout = layoutRdbBlock(BLOCK, 7, false, (id) => MODELS[id]);   // a block past the first: no 70300 exit model
  assert.deepEqual(layout.exitDoors.map((d) => d.doorType), [DOOR_TYPE.DUNGEON_ENTRANCE, DOOR_TYPE.BUILDING, DOOR_TYPE.DUNGEON_EXIT],
    'DFU\'s own list, the misnomer kept: an entrance face, a building face and a baked exit face');
  assert.deepEqual(layout.exitDoors.filter(isDungeonExitDoor).map((d) => d.doorType), [DOOR_TYPE.DUNGEON_EXIT], 'one way out');
  assert.deepEqual(Object.values(DOOR_TYPE).map((t) => isDungeonExitDoor({ doorType: t })), [false, false, false, true]);
  assert.equal(isDungeonExitDoor(null), false);
  assert.equal(isDungeonExitDoor({}), false, 'a door with no type is no exit');
});

test('CRUX-DOOR: the dungeon host takes a block\'s DungeonExit doors alone as its exits - the court\'s and the portal\'s made doors join after', () => {
  const src = rd('src/scenes/dungeonContext.js');
  const loop = src.slice(src.indexOf('for (const door of b.layout.exitDoors)'), src.indexOf('exitDoors.push({ ...door, matrix: multiply(originMatrix, door.matrix) });'));
  assert.ok(loop.length > 0 && loop.length < 600, 'the copy loop was found');
  assert.match(loop, /if \(!isDungeonExitDoor\(door\)\) continue;/, 'a door that is not a DungeonExit is the model\'s, not a way out');
  assert.match(src, /import \{ layoutDungeon, isDungeonExitDoor \} from '\.\.\/world\/dungeonLayout\.js';/);
  // the overlap registry reads the one law too - no second literal
  const dl = rd('src/world/dungeonLayout.js');
  assert.equal((dl.match(/DOOR_TYPE\.DUNGEON_EXIT/g) ?? []).length, 1, 'isDungeonExitDoor is the one reading of the type');
});
