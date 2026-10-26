// FIELD BUGS 2026-10-25 (players: "fall through the floor inside homes, specifically in player-purchased properties").
// The owned home's own build was not the cause - built as a stranger's room and as an owned one, every residence lets a
// body fall in the same places. Two holes were:
// - DOOR-VOID: an interior door with a floor on one side and none on the other (Beautiful Cities' House2, DARKAB00-02
//   record 0, and blocks of Daggerfall's own no town places). It is sealed when the room is built, and nothing opens it
//   (world/interior/doorsToNowhere.js, world/actionSystem.js `sealed`).
// - BAD-CELL: DFU's IsBadInteriorModel dropped EVERY 31000 of a listed block/record. Beautiful Cities rebuilds seven of
//   those rooms with a 31000 room cell of its own, and the repair took it out, leaving a ground-floor corner with no
//   floor (FIGHGL00 #1, GENRGL01 #2-4, TVRNGL04 #6, RESIGL04 #3, RESIGL03 #1). The repair now drops the misplaced 31000
//   alone (world/interior/interiorLayout.js).
// The last two tests read the player's ARENA2 and both town packs.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { Collider } from '../../src/player/collider.js';
import { ActionSystem } from '../../src/world/actionSystem.js';
import { trs } from '../../src/world/mat4.js';
import { dfMeshToModel, DOOR_TYPE } from '../../src/world/meshReader.js';
import { layoutInterior } from '../../src/world/interior/interiorLayout.js';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { midScreenText } from '../../src/ui/midScreenText.js';
import { sealDoorsToNowhere, doorSidesFloored, SEALED_DOOR_TEXT, DOOR_FLOOR_REACH, DOOR_SIDE_STEP } from '../../src/world/interior/doorsToNowhere.js';

// ── the shapes ────────────────────────────────────────────────────────────────────────────────────────────
/** A box's triangles, metres: positions and indices as meshReader mints them. */
function box([x0, y0, z0], [x1, y1, z1]) {
  const positions = new Float32Array([
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ]);
  const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
  const indices = new Uint32Array(quads.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]));
  return { positions, indices };
}
/** A door's leaf as Daggerfall's 9000-9004 stand it: 1.2 m wide along x from its hinge, 2.2 m tall, thin in z. */
const LEAF = box([0, 0, -0.05], [1.2, 2.2, 0.05]);
/** A floor slab at height `y`, metres, over [x0, x1] x [z0, z1]. */
const slab = (x0, x1, z0, z1, y = 0) => box([x0, y - 0.1, z0], [x1, y, z1]);

/** A room: its floors in one collider bucket, one door at `matrix` - the ActionSystem the context builds. */
function room(floors, matrix = trs(0, 0, 0, 0, 0, 0)) {
  const collider = new Collider(() => -Infinity);
  floors.forEach((f, i) => collider.addMesh(`floor${i}`, f.positions, f.indices, trs(0, 0, 0, 0, 0, 0)));
  const actions = new ActionSystem(collider);
  const door = actions.addDoor(LEAF, matrix);
  return { collider, actions, door };
}

test('DOOR-VOID: a door is sealed when its room has a floor on one side of it and none on the other - and only then', () => {
  // the leaf spans z -0.05..0.05; its sides are -z and +z
  const near = slab(-2, 3, -3, -0.05), far = slab(-2, 3, 0.05, 3);
  const oneSide = room([near]);
  assert.deepEqual(doorSidesFloored(oneSide.collider, oneSide.door), [true, false]);
  assert.deepEqual(sealDoorsToNowhere(oneSide.actions), ['door:0']);
  assert.equal(oneSide.door.sealed, true);
  const otherSide = room([far]);
  assert.deepEqual(sealDoorsToNowhere(otherSide.actions), ['door:0'], 'whichever side the floor is on');
  const both = room([near, far]);
  assert.deepEqual(sealDoorsToNowhere(both.actions), [], 'a door between two floors opens');
  assert.equal(both.door.sealed, false);
  assert.deepEqual(sealDoorsToNowhere(room([]).actions), [], 'a door in no room is left as it is');
});

test('DOOR-VOID: a lip of floor past the leaf is not a floor - the far side is read a stride out', () => {
  // Beautiful Cities' House2 door: floor half a metre past the leaf, then nothing
  const near = slab(-2, 3, -3, -0.05);
  const lip = room([near, slab(-2, 3, 0.05, 0.5)]);
  assert.deepEqual(sealDoorsToNowhere(lip.actions), ['door:0'], 'half a metre');
  const stride = room([near, slab(-2, 3, 0.05, DOOR_SIDE_STEP + 0.05)]);
  assert.deepEqual(sealDoorsToNowhere(stride.actions), [], 'a stride of floor opens');
});

test('DOOR-VOID: the way through is the leaf\'s own thin axis, turned with it', () => {
  // turned a quarter, the leaf is thin in x: its sides are -x and +x
  const turned = trs(0, 0, 0, 0, 90, 0);
  const sideways = room([slab(-3, -0.05, -2, 2)], turned);
  assert.deepEqual(sealDoorsToNowhere(sideways.actions), ['door:0']);
  const across = room([slab(-3, -0.05, -2, 2), slab(0.05, 3, -2, 2)], turned);
  assert.deepEqual(sealDoorsToNowhere(across.actions), [], 'floors on both of the turned leaf\'s sides');
  // a leaf modelled thin in x, unturned: the way through is x
  const collider = new Collider(() => -Infinity);
  const floor = slab(-3, -0.05, -2, 2);
  collider.addMesh('floor', floor.positions, floor.indices, trs(0, 0, 0, 0, 0, 0));
  const actions = new ActionSystem(collider);
  actions.addDoor(box([-0.05, 0, 0], [0.05, 2.2, 1.2]), trs(0, 0, 0, 0, 0, 0));
  assert.deepEqual(sealDoorsToNowhere(actions), ['door:0'], 'a leaf thin in its own x');
});

test('DOOR-VOID: a floor below the doorway is a floor - a stairwell or a cellar - within the reach, and not past it', () => {
  const near = slab(-2, 3, -3, -0.05);
  const cellar = room([near, slab(-2, 3, 0.05, 3, -(DOOR_FLOOR_REACH - 1))]);
  assert.deepEqual(sealDoorsToNowhere(cellar.actions), [], `a floor ${DOOR_FLOOR_REACH - 1} m down`);
  const pit = room([near, slab(-2, 3, 0.05, 3, -(DOOR_FLOOR_REACH + 1))]);
  assert.deepEqual(sealDoorsToNowhere(pit.actions), ['door:0'], `a floor ${DOOR_FLOOR_REACH + 1} m down is nothing`);
});

test('DOOR-VOID: nothing opens a sealed door - the player, a spell, a bash, a foe, a chain or a save - and the player hears why', () => {
  const { actions, door, collider } = room([slab(-2, 3, -3, -0.05)]);
  sealDoorsToNowhere(actions);
  const said = [];
  const spells = [];
  actions.onSealedDoor = (o) => said.push(o.key);
  actions.onDoorSpell = (_o, kind) => spells.push(kind);
  assert.equal(actions.activate('door:0'), true, 'the activation is answered');
  assert.equal(actions.activate('door:0', { doorSpell: { kind: 'open', holderLevel: 99 } }), true);
  assert.deepEqual(spells, [], 'an armed Open is not spent on it');
  assert.deepEqual(said, ['door:0', 'door:0']);
  assert.equal(actions.toggleDoor(door), false, 'a foe\'s toggle');
  assert.equal(actions.attemptBash(door, 0), false, 'the surest bash');
  door.actionFlag = 0; door.currentLockValue = 0;
  assert.equal(actions._openDoor(door, true), false, 'a chain\'s open, past every lock');
  actions.restoreSaveData([{ key: 'door:0', state: 'end', t: 1, lock: 0 }], { remote: true });
  assert.equal(door.state, 'start', 'a peer\'s word that it stands open');
  assert.ok(Number.isFinite(collider.raycast([0.6, 1, -1], [0, 0, 1], 2)), 'and its leaf still blocks the doorway');
  // the same door unsealed opens as it always did
  const open = room([slab(-2, 3, -3, -0.05)]);
  assert.equal(open.actions.activate('door:0'), true);
  assert.equal(open.door.state, 'forward');
});

// ── the context ───────────────────────────────────────────────────────────────────────────────────────────
/** A DFMesh (Arch3dFile.getMesh's shape) of `planes` given in metres in Unity's frame - dfMeshToModel turns them back
 *  (fb1004d_voidentry.test.js's own builder). */
function dfMesh(planes) {
  const subMeshes = planes.map(({ archive, record = 0, points }) => ({
    textureArchive: archive, textureRecord: record, totalTriangles: points.length - 2,
    planes: [{ points: points.map(([x, y, z]) => ({ x: x * 40, y: -y * 40, z: z * 40, nx: 0, ny: 0, nz: 0, u: 0, v: 0 })) }],
  }));
  return { totalVertices: planes.reduce((n, p) => n + p.points.length, 0), totalTriangles: subMeshes.reduce((n, s) => n + s.totalTriangles, 0), subMeshes };
}
const mint = (planes) => dfMeshToModel(dfMesh(planes), () => ({ width: 64, height: 64 }));
const quad = (archive, pts) => ({ archive, points: pts });
/** 31714, a room whose floor stops at the door's plane (z 0): the -z half has one, the +z half none. */
const HALF_ROOM = 31714;
const halfRoom = () => mint([quad(166, [[-3, 0, -3], [3, 0, -3], [3, 0, 0], [-3, 0, 0]])]);
/** 31715, the same room floored on both halves. */
const WHOLE_ROOM = 31715;
const wholeRoom = () => mint([quad(166, [[-3, 0, -3], [3, 0, -3], [3, 0, 3], [-3, 0, 3]])]);
/** 9000, the door's leaf - two faces, 1.2 m by 2.2 m, thin in z. */
const doorLeaf = () => mint([
  quad(74, [[0, 2.2, -0.05], [1.2, 2.2, -0.05], [1.2, 0, -0.05], [0, 0, -0.05]]),
  quad(74, [[0, 2.2, 0.05], [1.2, 2.2, 0.05], [1.2, 0, 0.05], [0, 0, 0.05]]),
]);
const noPictures = async (archive) => (archive === 210 ? null : { recordCount: 0 });
function pipelineOf(models) {
  const cpuModels = new Map();
  return {
    cpuModels, getTexture: noPictures, uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null, getMachineryParts: null,
    getGpuMesh: async (id) => {
      const m = models[id]?.();
      if (!m) return null;
      cpuModels.set(id, { modelIdNum: id, ...m });
      return { id };
    },
  };
}
const noop = () => {};
const fakeRenderer = { createBillboardBatch: () => ({}), destroyBatch: noop, createMesh: () => ({}), destroyMesh: noop };
/** One building whose interior is `roomModel` with one action door at its origin, in the z = 0 plane. */
const blockOf = (roomModel) => ({
  index: 7, name: 'TESTAA00.RMB',
  rmbBlock: {
    fldHeader: { buildingDataList: [{ buildingType: 18, factionId: 0, quality: 1, nameSeed: 1 }] },
    subRecords: [{
      xPos: 0, zPos: 0, yRotation: 0,
      exterior: { header: { num3dObjectRecords: 0 }, block3dObjectRecords: [], blockFlatObjectRecords: [], blockPeopleRecords: [], blockDoorRecords: [] },
      interior: {
        header: { num3dObjectRecords: 1 },
        block3dObjectRecords: [{ modelIdNum: roomModel, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
        blockFlatObjectRecords: [], blockPeopleRecords: [], blockSection3Records: [],
        blockDoorRecords: [{ position: 0, xPos: 0, yPos: 0, zPos: 0, yRotation: 0, openRotation: -512, doorModelIndex: 0 }],
      },
    }],
  },
});

test('DOOR-VOID: the room is built with its door to nothing sealed, and the player is told it will not open', async () => {
  const pipeline = pipelineOf({ [HALF_ROOM]: halfRoom, [WHOLE_ROOM]: wholeRoom, 9000: doorLeaf });
  const deps = { renderer: fakeRenderer, ...pipeline };
  const half = await buildInteriorContext(deps, blockOf(HALF_ROOM), 7, 0, 300, 0, null, {});
  const door = half.actions.objects.get('door:0');
  assert.equal(door.sealed, true);
  midScreenText.text = '';
  half.actions.activate('door:0');
  assert.equal(midScreenText.text, SEALED_DOOR_TEXT);
  assert.equal(door.state, 'start');
  half.destroy();
  const whole = await buildInteriorContext(deps, blockOf(WHOLE_ROOM), 7, 0, 300, 0, null, {});
  assert.equal(whole.actions.objects.get('door:0').sealed, false, 'a door between two floors');
  whole.actions.activate('door:0');
  assert.equal(whole.actions.objects.get('door:0').state, 'forward');
  whole.destroy();
});

test('DOOR-VOID: a home\'s owner cannot take a sealed door out - its doorway would open onto nothing; a door between two floors stays theirs to take', async () => {
  const pipeline = pipelineOf({ [HALF_ROOM]: halfRoom, [WHOLE_ROOM]: wholeRoom, 9000: doorLeaf });
  const deps = { renderer: fakeRenderer, ...pipeline };
  const half = await buildInteriorContext(deps, blockOf(HALF_ROOM), 7, 0, 300, 0, null, { baseEditable: true, houseOwned: true });
  assert.deepEqual(half.base.roomDoors.list(), [], 'not on the owner\'s list');
  assert.equal(half.base.roomDoors.apply(['intdoor:0']), 0, 'an owner\'s list saved before the seal takes nothing out');
  assert.ok(half.actions.objects.get('door:0'), 'the door still hangs');
  half.destroy();
  const whole = await buildInteriorContext(deps, blockOf(WHOLE_ROOM), 7, 0, 300, 0, null, { baseEditable: true, houseOwned: true });
  assert.deepEqual(whole.base.roomDoors.list().map((d) => d.key), ['intdoor:0']);
  whole.destroy();
});

// ── BAD-CELL ──────────────────────────────────────────────────────────────────────────────────────────────
test('BAD-CELL: a listed room drops the misplaced 31000 and keeps a 31000 standing anywhere else', () => {
  const cell = { modelIdNum: 31000, objectType: 0, xRotation: 0, yRotation: 0, zRotation: 0 };
  const dfBlock = { rmbBlock: { subRecords: [null, { interior: {
    header: { num3dObjectRecords: 2 },
    block3dObjectRecords: [{ ...cell, xPos: 192, yPos: -192, zPos: 64 }, { ...cell, xPos: 64, yPos: -63, zPos: 448 }],
    blockFlatObjectRecords: [], blockDoorRecords: [],
  } }] } };
  const model = { positions: new Float32Array([0, 0, 0]), doors: [] };
  // FIGHGL00.RMB is block 106, its record 1 in the table
  const placed = layoutInterior(dfBlock, 106, 1, () => model).placements;
  assert.equal(placed.length, 1);
  assert.deepEqual([...placed[0].matrix.slice(12, 15)].map((v) => Math.round(v / 0.025)), [64, 63, 448], 'the pack\'s own cell');
  assert.equal(layoutInterior(dfBlock, 105, 1, () => model).placements.length, 2, 'a block the table does not list keeps both');
});

// ── with ARENA2 ───────────────────────────────────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));
const packJson = (v) => JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'));

/** Daggerfall's own BLOCKS.BSA and ARCH3D.BSA, the town packs, and a pipeline over them (fb1004d_voidentry's). */
async function arena2() {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { patchSeams } = await import('../../src/world/arch3dSeams.js');
  const { installTownStandIns } = await import('../../src/world/townStandIns.js');
  const { customModelBuilt, customAliasFor } = await import('../../src/world/customModels.js');
  const { openWorldDataPack } = await import('../../src/formats/worldData/worldDataPack.js');
  const { blockFromJson } = await import('../../src/formats/worldData/worldDataReplacement.js');
  const blocks = new BlocksFile(); assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
  installTownStandIns(() => true);
  const size = () => ({ width: 64, height: 64 });
  const classicModel = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : dfMeshToModel(arch.getMesh(i), size); };
  const cpuModels = new Map(), built = new Map();
  const getGpuMesh = async (id) => {
    if (built.has(id)) return built.get(id);
    let m = await customModelBuilt(id, { classicModel });
    if (!m) { const al = customAliasFor(id), mid = al ? al.model : id, i = arch.getRecordIndex(mid); m = i === -1 ? null : dfMeshToModel(patchSeams(mid, arch.getMesh(i)), size); }
    if (m) cpuModels.set(id, { modelIdNum: id, ...m, doors: m.doors ?? [] });
    built.set(id, m ? { id } : null);
    return built.get(id);
  };
  const deps = { renderer: fakeRenderer, getGpuMesh, cpuModels, getTexture: noPictures, uploadRecord: noop, uploadRecordFrame: noop, palette: null, getMachineryParts: null };
  const packs = {};
  let next = 5000;
  for (const v of ['beautiful-villages', 'beautiful-cities']) {
    const pack = openWorldDataPack(packJson(v), { blocks });
    packs[v] = { names: pack.names().filter((n) => /\.RMB\.json$/i.test(n)).map((n) => n.replace(/\.json$/i, '')),
      block: (n) => { const i = blocks.getBlockIndex(n); return blockFromJson(pack.rebuild(`${n}.json`), i >= 0 ? i : next++); } };
  }
  return { blocks, deps, packs };
}
/** Every building record of `block` with an exterior door, and that door (the first) - the room the player walks into. */
async function buildingsOf(block, deps) {
  const { layoutRmbBlock } = await import('../../src/world/rmbLayout.js');
  const { getStaticDoors } = await import('../../src/world/staticDoors.js');
  const out = new Map();
  for (const p of layoutRmbBlock(block).models) {
    if (p.recordIndex === undefined || out.has(p.recordIndex)) continue;
    await deps.getGpuMesh(p.modelIdNum);
    const cpu = deps.cpuModels.get(p.modelIdNum);
    const door = (cpu?.doors?.length ? getStaticDoors(cpu, block.index, p.recordIndex, p.matrix) : [])?.find((d) => d.doorType === DOOR_TYPE.BUILDING);
    if (door) out.set(p.recordIndex, door);
  }
  return out;
}
async function quietly(fn) {
  const saved = [console.warn, console.log];
  console.warn = console.log = noop;
  try { return await fn(); } finally { [console.warn, console.log] = saved; }
}

test('BAD-CELL with ARENA2: Daggerfall\'s own listed rooms lose their misplaced 31000 as DFU\'s do, and Beautiful Cities\' seven keep their own room cell - FIGHGL00 #1\'s ground-floor corner has its floor', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 300000 }, async () => {
  const { blocks, deps, packs } = await arena2();
  const getModel = (id) => deps.cpuModels.get(id);
  const LISTED = [[51, [1]], [84, [8, 9, 10, 11]], [88, [2, 3, 4]], [96, [2, 5, 6]], [106, [1]], [154, [0, 1, 2]], [155, [0, 1, 2, 3]], [156, [0, 1]], [158, [6, 7]], [159, [0]], [169, [5, 8]], [388, [2, 3, 4, 5]], [502, [2]], [513, [1, 2, 12]], [514, [0, 5, 6]], [516, [0]], [534, [10]], [537, [5]], [538, [12]], [574, [10, 12]], [575, [12, 13]], [597, [7, 8]], [601, [6, 7]], [680, [7, 8]], [697, [0, 1, 2, 3]], [1195, [1]], [1278, [1, 2, 3, 4]]];
  let classicDropped = 0;
  const packKept = [];
  await quietly(async () => {
    for (const [bi, records] of LISTED) {
      const block = blocks.getBlock(bi);
      for (const ri of records) {
        for (const o of block.rmbBlock.subRecords[ri].interior.block3dObjectRecords) await deps.getGpuMesh(o.modelIdNum);
        const placed = layoutInterior(block, bi, ri, getModel).placements;
        assert.equal(placed.filter((p) => p.modelIdNum === 31000).length, 0, `${block.name} #${ri}`);
        classicDropped++;
      }
      const name = blocks.getBlockName(bi);
      for (const [v, pack] of Object.entries(packs)) {
        if (!pack.names.includes(name)) continue;
        const served = pack.block(name);
        for (const ri of records) {
          const rec = served.rmbBlock.subRecords[ri];
          if (!rec?.interior?.block3dObjectRecords?.some((o) => o.modelIdNum === 31000)) continue;
          for (const o of rec.interior.block3dObjectRecords) await deps.getGpuMesh(o.modelIdNum);
          if (layoutInterior(served, bi, ri, getModel).placements.some((p) => p.modelIdNum === 31000)) packKept.push(`${v}:${name}#${ri}`);
        }
      }
    }
  });
  assert.equal(classicDropped, 60, 'every record of the table');
  assert.deepEqual(packKept.sort(), ['beautiful-cities:FIGHGL00.RMB#1', 'beautiful-cities:GENRGL01.RMB#2', 'beautiful-cities:GENRGL01.RMB#3',
    'beautiful-cities:GENRGL01.RMB#4', 'beautiful-cities:RESIGL03.RMB#1', 'beautiful-cities:RESIGL04.RMB#3', 'beautiful-cities:TVRNGL04.RMB#6']);
  // the corner the field report fell through: FIGHGL00 #1's ground-floor cell, entered at its own door
  const fighgl00 = packs['beautiful-cities'].block('FIGHGL00.RMB');
  const door = (await buildingsOf(fighgl00, deps)).get(1);
  const ctx = await quietly(() => buildInteriorContext(deps, fighgl00, fighgl00.index, 1, 300, 0, door.matrix, {}));
  try {
    const cell = ctx.drawList.find((d) => d.mesh?.id === 31000);
    assert.ok(cell, 'the cell stands');
    const [cx, cz] = [(cell.aabb.min[0] + cell.aabb.max[0]) / 2, (cell.aabb.min[2] + cell.aabb.max[2]) / 2];
    const below = ctx.collider.raycast([cx, cell.aabb.min[1] + 0.5, cz], [0, -1, 0], 1);
    assert.ok(below < 0.6, `a floor under the corner (${below})`);
  } finally { ctx.destroy(); }
});

test('DOOR-VOID with ARENA2: every house a player can own, in both town packs and Daggerfall\'s own blocks - the doors sealed are exactly the doors to nothing', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 600000 }, async () => {
  const { blocks, deps, packs } = await arena2();
  const { isResidence, BUILDING_TYPES } = await import('../../src/world/buildingNames.js');
  const sealed = [];
  let rooms = 0, doors = 0;
  async function sweep(label, names, blockOf) {
    for (const name of names) {
      const block = blockOf(name);
      for (const [ri, door] of await buildingsOf(block, deps)) {
        const type = block.rmbBlock.fldHeader.buildingDataList[ri]?.buildingType;
        if (!isResidence(type) && type !== BUILDING_TYPES.HouseForSale) continue;
        let ctx;
        try { ctx = await buildInteriorContext(deps, block, block.index, ri, 300, 0, door.matrix, {}); } catch { continue; }
        rooms++;
        for (const o of ctx.actions.objects.values()) {
          if (o.kind !== 'door') continue;
          doors++;
          const [a, b] = doorSidesFloored(ctx.collider, o);
          assert.equal(o.sealed, a !== b, `${label}:${name}#${ri} ${o.key}`);
          if (o.sealed) sealed.push(`${label}:${name}#${ri}:${o.key}`);
        }
        ctx.destroy();
      }
    }
  }
  await quietly(async () => {
    for (const [v, pack] of Object.entries(packs)) await sweep(v, pack.names, pack.block);
    const classic = [];
    for (let i = 0; i < blocks.count; i++) { const n = blocks.getBlockName(i); if (/\.RMB$/i.test(n ?? '')) classic.push(n); }
    await sweep('classic', classic, (n) => blocks.getBlock(blocks.getBlockIndex(n)));
  });
  assert.deepEqual({ rooms, doors }, { rooms: 10439, doors: 30831 });
  // the town packs: Beautiful Cities' House2, a door on a lip of floor half a metre deep - placed in towns, sold as homes
  assert.deepEqual(sealed.filter((s) => !s.startsWith('classic:')),
    ['beautiful-cities:DARKAB00.RMB#0:door:1', 'beautiful-cities:DARKAB01.RMB#0:door:1', 'beautiful-cities:DARKAB02.RMB#0:door:1']);
  // Daggerfall's own: fifty, every one in a block no location of MAPS.BSA places
  assert.deepEqual(sealed.filter((s) => s.startsWith('classic:')).map((s) => s.slice('classic:'.length)), [
    'ALCHAS03.RMB#0:door:1', 'ALCHAS03.RMB#5:door:0', 'ALCHAS03.RMB#5:door:12', 'ALCHAS03.RMB#5:door:13', 'ALCHAS03.RMB#6:door:0',
    'ALCHAS03.RMB#6:door:12', 'ALCHAS03.RMB#6:door:13', 'ALCHAS01.RMB#2:door:0', 'ALCHAS01.RMB#2:door:1', 'ALCHAS01.RMB#8:door:0',
    'ALCHAS01.RMB#8:door:1', 'ALCHAS00.RMB#2:door:0', 'ALCHAS00.RMB#2:door:1', 'ALCHAS00.RMB#7:door:0', 'ALCHAS00.RMB#7:door:1',
    'LIBRAM00.RMB#10:door:0', 'LIBRAM00.RMB#10:door:1', 'LIBRAS00.RMB#4:door:3', 'LIBRAS00.RMB#4:door:4', 'LIBRAS00.RMB#8:door:3',
    'LIBRAS00.RMB#8:door:4', 'BOOKAS01.RMB#0:door:3', 'BOOKAS02.RMB#5:door:0', 'BOOKAS02.RMB#5:door:1', 'THIEAS00.RMB#0:door:0',
    'THIEAS00.RMB#0:door:1', 'THIEAS00.RMB#7:door:3', 'LIBRAM02.RMB#5:door:0', 'LIBRAM02.RMB#5:door:12', 'LIBRAM02.RMB#5:door:13',
    'LIBRAM02.RMB#6:door:2', 'LIBRAM02.RMB#6:door:6', 'LIBRAM02.RMB#6:door:7', 'LIBRAM02.RMB#6:door:9', 'LIBRAM02.RMB#6:door:10',
    'LIBRAM02.RMB#6:door:15', 'LIBRAM02.RMB#8:door:0', 'LIBRAM02.RMB#8:door:2', 'LIBRAM02.RMB#8:door:5', 'BANKAS01.RMB#4:door:0',
    'BANKAS01.RMB#4:door:1', 'BANKAS01.RMB#7:door:0', 'BANKAS01.RMB#7:door:1', 'PAWNAS01.RMB#7:door:0', 'PAWNAS01.RMB#7:door:12',
    'PAWNAS01.RMB#7:door:13', 'PAWNAS02.RMB#11:door:3', 'WAY2.RMB#0:door:0', 'WAY2.RMB#0:door:2', 'WAY2.RMB#0:door:5',
  ]);
});
