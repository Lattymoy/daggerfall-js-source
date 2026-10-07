// FIELD BUGS 2026-10-07b TOWER-FLOORS (Jacob on Discord, #bug-reports: "The two Daggerfall Castle courtyard tower
// interiors are very bugged. Everything inside them seems to be shifted up several meters including stairs, and there
// is open void in some spots"). `01-Overview/Field-Bugs-2026-10-07b.md`.
//
// The towers are CUSTAA05 #0 and #1, five storeys of room shells. Classic writes those shells as ObjectType 5, the
// type it writes floor planes as, at the height of the storey each stands on - where the same shells, written as
// ObjectType 13 anywhere else, are put at their centre (YPos -63, half the shell's 126). DFU places type 5 like any
// model (DaggerfallInterior.cs:433-436), so each shell stood half a shell (1.58 m) under its storey: the furniture,
// lights and markers 1.58 m over the floor the player walks, the two-storey stair 3.2 m under its own, the room's door
// 1.6 m under the street's. world/interiorLayout.js stands an ObjectType 5 model on its lowest vertex, as a prop is
// stood - and the one model classic writes a storey over that (the hall 28703, in two shops) a storey lower.
//
// Fixtures: the layout's own input shape (BlocksFile's records), and with ARENA2 the player's own BLOCKS.BSA and
// ARCH3D.BSA through the port's readers - nothing of either is kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { layoutInterior, isBadInteriorModel, floorModelStoreysUnder, FLOOR_MODEL_TYPE, PROP_MODEL_TYPE, STOREY, INTERIOR_MARKER } from '../src/world/interiorLayout.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { identity } from '../src/world/mat4.js';
import { GLOBAL_SCALE, DOOR_TYPE, dfMeshToModel } from '../src/world/meshReader.js';
import { doorWorldPosition } from '../src/player/enterExit.js';

const STOREY_M = STOREY * GLOBAL_SCALE;   // 3.225
const approx = (a, b, msg, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);
/** A model as dfMeshToModel answers it: its Y-negated positions, and one building door plane up its middle. */
const modelOf = (lowY, highY, door = false) => ({
  positions: new Float32Array([-1, lowY, -1, 1, highY, 1, 1, (lowY + highY) / 2, -1]),
  doors: door ? [{ index: 0, type: DOOR_TYPE.BUILDING,
    vert0: { x: 0, y: lowY, z: -1 }, vert1: { x: 1, y: lowY, z: -1 }, vert2: { x: 0, y: highY, z: -1 }, normal: { x: 0, y: 0, z: 1 } }] : [],
});
const record = (modelIdNum, objectType, yPos) => ({ modelIdNum, objectType, xPos: 0, yPos, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 });
const roomOf = (records) => ({ rmbBlock: { subRecords: [{ interior: {
  header: { num3dObjectRecords: records.length }, block3dObjectRecords: records,
  blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [] } }] } });

test('TOWER-FLOORS: an ObjectType 5 model stands its lowest vertex on the storey it is written at - a centred shell rises half its height, the stair its own half, the hall 28703 to a storey under, a floor plane does not move - and every other type is placed as DFU places it', () => {
  assert.equal(FLOOR_MODEL_TYPE, 5);
  assert.equal(PROP_MODEL_TYPE, 3);
  assert.equal(STOREY, 129);
  assert.deepEqual([28703, 31024, 31023, 1000].map(floorModelStoreysUnder), [1, 0, 0, 0]);
  const models = {
    31024: modelOf(-1.575, 1.575, true),   // a room shell, centred on its origin, with the room's door
    31023: modelOf(-3.2, 3.17),            // the two-storey stair
    28703: modelOf(-3.975, 3.95),          // the hall: its floor at -0.75, a storey over the foot of its stair shaft
    1000: modelOf(0, 0),                   // a floor plane: no height
    41100: modelOf(-0.5, 0.7),             // a prop
  };
  const it = layoutInterior(roomOf([
    record(31024, 5, -129),   // the second storey's shell
    record(31023, 5, 0),      // the stair up from the ground storey
    record(28703, 5, -129),   // the hall, written at its floor's storey
    record(1000, 5, -258),    // the third storey's floor plane
    record(31024, 13, -63),   // an ordinary room: ObjectType 13 at its centre
    record(41100, 3, 2),      // a prop on the ground floor
    record(31024, 0, 80),     // any other type: DFU's (X, -Y, Z)
  ]), 0, 0, (id) => models[id]);
  const y = it.placements.map((p) => p.matrix[13]);
  approx(y[0] - 1.575, STOREY_M, 'the shell\'s floor is its storey, not half a shell under it');
  approx(y[1] - 3.2, 0, 'the stair stands on the ground storey, not 3.2 m under it');
  approx(y[2] - 3.975, 0, 'the hall\'s stair shaft stands on the ground storey');
  approx(y[2] - 0.75, STOREY_M, 'and its floor on the storey its record names');
  assert.equal(y[3], Math.fround(258 * GLOBAL_SCALE), 'a floor plane is placed exactly where DFU places it (the matrix is a Float32Array)');
  assert.equal(y[4], Math.fround(63 * GLOBAL_SCALE), 'ObjectType 13 is DFU\'s (X, -Y, Z)');
  assert.equal(y[5], Math.fround(2 * GLOBAL_SCALE + 0.5), 'the prop is DFU\'s +Y and lowest vertex');
  assert.equal(y[6], Math.fround(-80 * GLOBAL_SCALE), 'any other type is DFU\'s (X, -Y, Z)');
  // the shell's door rides the shell: the room's way out stands at its floor, where the street's door meets it
  assert.equal(it.doors.length, 3, 'the three placements of the door\'s shell');
  approx(doorWorldPosition(it.doors[0])[1], STOREY_M + 1.575, 'the door stands with its shell');
  approx(doorWorldPosition(it.doors[1])[1], 63 * GLOBAL_SCALE, 'the type-13 room\'s door is where DFU stands it');
  approx(doorWorldPosition(it.doors[2])[1], -80 * GLOBAL_SCALE, 'and any other type\'s');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));
const SKIP = HAVE_ARENA2 ? false : 'ARENA2_PATH not set';
let _data = null;
async function data() {
  if (_data) return _data;
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const blocks = new BlocksFile(); assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
  const cache = new Map();
  const getModel = (id) => {
    if (!cache.has(id)) { const i = arch.getRecordIndex(id); cache.set(id, i === -1 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 }))); }
    return cache.get(id);
  };
  const extent = (id) => { const p = getModel(id).positions; let lo = p[1], hi = p[1]; for (let i = 4; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); } return [lo, hi]; };
  _data = { blocks, getModel, extent };
  return _data;
}
const storeyOf = (y) => Math.round(y / STOREY_M);

test('TOWER-FLOORS with ARENA2: Castle Daggerfall\'s two courtyard towers (CUSTAA05 #0 and #1) - five storeys whose shells stand on 0, 3.225, 6.45, 9.675 and 12.9, every piece of furniture and every marker on a storey, each stair from its storey up to the next, and the room\'s two doors where the tower\'s outside has them', { skip: SKIP }, async () => {
  const { blocks, getModel, extent } = await data();
  const bi = blocks.getBlockIndex('CUSTAA05.RMB');
  const block = blocks.getBlock(bi);
  // the tower's outside: model 522, its street door (a building door) and its door to the castle's walls, in its own frame
  const outside = getStaticDoors(getModel(522), bi, 0, identity());
  const outsideY = (type) => doorWorldPosition(outside.find((d) => d.doorType === type))[1];
  const streetY = outsideY(DOOR_TYPE.BUILDING), wallY = outsideY(DOOR_TYPE.DUNGEON_ENTRANCE);
  for (const ri of [0, 1]) {
    assert.equal(block.rmbBlock.subRecords[ri].exterior.block3dObjectRecords[0].modelIdNum, 522, `#${ri} is a tower`);
    const it = layoutInterior(block, bi, ri, getModel);
    const recs = block.rmbBlock.subRecords[ri].interior.block3dObjectRecords;
    assert.equal(it.placements.length, 100);
    const storeys = new Set();
    let stairs = 0;
    it.placements.forEach((p, i) => {
      const [lo, hi] = extent(p.modelIdNum);
      const bottom = p.matrix[13] + lo;
      if (recs[i].objectType === FLOOR_MODEL_TYPE) {
        storeys.add(storeyOf(bottom));
        approx(bottom, storeyOf(bottom) * STOREY_M, `#${ri} shell ${p.modelIdNum} stands on a storey`, 1e-3);
        if (p.modelIdNum === 31023) {
          stairs++;
          // its ceiling is the third storey's floor, less the seam every storey has (a 3.16 m shell under a 3.225 m storey)
          approx(p.matrix[13] + hi, (storeyOf(bottom) + 2) * STOREY_M, `#${ri} the stair from storey ${storeyOf(bottom)} reaches up through the next`, 0.1);
        }
      } else {
        assert.equal(recs[i].objectType, PROP_MODEL_TYPE);
        const over = bottom - storeyOf(bottom) * STOREY_M;
        assert.ok(over >= 0 && over < 0.1, `#${ri} prop ${p.modelIdNum} stands on a storey (${over.toFixed(3)} over it)`);
      }
    });
    assert.deepEqual([...storeys].sort(), [0, 1, 2, 3, 4], `#${ri} five storeys from the street's own level`);
    assert.equal(stairs, 4, `#${ri} a stair up from each storey but the top`);
    for (const m of it.markers) approx(m.y, storeyOf(m.y) * STOREY_M, `#${ri} a marker on a storey`, 1e-3);
    const inside = it.doors.map((d) => doorWorldPosition(d)[1]).sort((a, b) => a - b);
    assert.equal(inside.length, 2);
    assert.ok(Math.abs(inside[0] - streetY) < 0.1, `#${ri} the room's door meets the street's (${inside[0].toFixed(2)} vs ${streetY.toFixed(2)})`);
    assert.ok(Math.abs(inside[1] - wallY) < 0.1, `#${ri} the top storey's door meets the wall's (${inside[1].toFixed(2)} vs ${wallY.toFixed(2)})`);
  }
});

test('TOWER-FLOORS with ARENA2: the two shops (LIBRAM00 #7, BOOKAS00 #8) - the ground storey\'s shells on the floor its furniture and markers stand on, and the hall 28703\'s floor on the upper storey, where the ladder\'s top and two enter markers are', { skip: SKIP }, async () => {
  const { blocks, getModel, extent } = await data();
  for (const [name, ri] of [['LIBRAM00.RMB', 7], ['BOOKAS00.RMB', 8]]) {
    const bi = blocks.getBlockIndex(name);
    const block = blocks.getBlock(bi);
    const it = layoutInterior(block, bi, ri, getModel);
    const recs = block.rmbBlock.subRecords[ri].interior.block3dObjectRecords;
    let hall = null;
    it.placements.forEach((p, i) => {
      if (recs[i].objectType !== FLOOR_MODEL_TYPE) return;
      const [lo, hi] = extent(p.modelIdNum);
      if (p.modelIdNum === 28703) { hall = p; return; }
      if (hi - lo > 0.01) approx(p.matrix[13] + lo, 0, `${name} #${ri} shell ${p.modelIdNum} on the ground storey`, 1e-3);
    });
    assert.ok(hall, `${name} #${ri} has the hall`);
    approx(hall.matrix[13] + extent(28703)[0], 0, `${name} #${ri} the hall's stair shaft stands on the ground storey`, 1e-3);
    approx(hall.matrix[13] - 0.75, STOREY_M, `${name} #${ri} the hall's floor is the upper storey`, 1e-3);
    const upper = it.markers.filter((m) => m.type === INTERIOR_MARKER.LADDER_TOP || (m.type === INTERIOR_MARKER.ENTER && m.y > 1));
    assert.equal(upper.length, 3, `${name} #${ri} the ladder's top and two enter markers upstairs`);
    for (const m of upper) approx(m.y, STOREY_M, `${name} #${ri} marker ${m.type} on the hall's floor`, 0.01);
  }
});

test('TOWER-FLOORS with ARENA2: across every RMB block the law moves only ObjectType 5 placements off DFU\'s - the 183 centred models of seven records (the two towers, the castle\'s three dungeon-door wings, the two shops) to their storeys, the two of floor plane 2700 by its 0.1 mm, and none of the other 1,248 planes at all', { skip: SKIP, timeout: 120000 }, async () => {
  const { blocks, getModel } = await data();
  const moved = new Map();
  let hairs = 0, planes = 0;
  for (let bi = 0; bi < blocks.count; bi++) {
    const name = blocks.getBlockName(bi);
    if (!/\.RMB$/i.test(name ?? '')) continue;
    const block = blocks.getBlock(bi);
    block.rmbBlock.subRecords.forEach((s, ri) => {
      if (s.interior?.header?.num3dObjectRecords === 0) return;
      const it = layoutInterior(block, bi, ri, getModel);
      // the records the layout places, in its order, against DFU's verbatim placement of a non-prop (DaggerfallInterior.cs:433-436)
      const recs = s.interior.block3dObjectRecords.filter((o) => !isBadInteriorModel(bi, ri, o.modelIdNum) && getModel(o.modelIdNum));
      assert.equal(recs.length, it.placements.length);
      recs.forEach((o, i) => {
        if (o.objectType === PROP_MODEL_TYPE) return;
        const off = it.placements[i].matrix[13] - Math.fround(-o.yPos * GLOBAL_SCALE);
        if (off === 0) { if (o.objectType === FLOOR_MODEL_TYPE) planes++; return; }
        assert.equal(o.objectType, FLOOR_MODEL_TYPE, `${name} #${ri}: only a floor model moves`);
        if (off < 0.001) { hairs++; assert.equal(o.modelIdNum, 2700); return; }
        moved.set(`${name}#${ri}`, (moved.get(`${name}#${ri}`) ?? 0) + 1);
      });
    });
  }
  assert.deepEqual(Object.fromEntries([...moved].sort()), {
    'BOOKAS00.RMB#8': 9, 'CUSTAA05.RMB#0': 69, 'CUSTAA05.RMB#1': 69, 'CUSTAA05.RMB#4': 9, 'CUSTAA05.RMB#5': 9, 'CUSTAA05.RMB#6': 9, 'LIBRAM00.RMB#7': 9,
  });
  assert.equal(hairs, 2, 'plane 2700, whose lowest vertex is 0.1 mm under its plane');
  assert.equal(planes, 1248, 'every other ObjectType 5 record is a floor plane, placed where DFU places it');
});
