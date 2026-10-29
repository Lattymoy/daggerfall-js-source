// BUILT-IN-MODS and BED-TURN (FIELD BUGS 2026-10-29b, a house bought in Alinor: "Beds backwards, and the rest just can't
// be removed or modified in any way"). Alinor's houses are classic house blocks, most of them Beautiful Cities' rebuilds,
// and the town mods write most of a room's furniture as scenery (ObjectType 0) - BASE-HIDE offered a prop (3) alone. Their
// coloured beds are drawn on Daggerfall's bed mesh, which faces half a turn from the mods' own. The same blocks stand in
// the Bay's towns, so the Bay's mod houses were the same. Driven through the real builder and the real layout.
// Mutants: tools/mutants/builtin_mods.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { layoutInterior } from '../../src/world/interior/interiorLayout.js';
import { installTownStandIns, TOWN_BED_FIRST, TOWN_BED_TURN } from '../../src/world/townStandIns.js';
import { isRoomFurnishing, MOD_ROOM_STRUCTURE } from '../../src/systems/decor/decorMods.js';

installTownStandIns(() => true);
/** A piece: a slant over a flat underside - a ray down from its middle meets its own underside first. */
const model = { positions: new Float32Array([0, 0, 0, 1, 1, 0, 0, 1, 1, -1, 0, -1, 2, 0, -1, 0, 0, 2]), indices: new Uint32Array([0, 1, 2, 3, 4, 5]), subMeshes: [] };
/** The room's floor (its shell, model 1000): every piece below stands on it. */
const floor = { positions: new Float32Array([-200, 0, -200, 200, 0, -200, 0, 0, 200]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
const FLOOR = 1000;
const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
const at = (modelIdNum, objectType, xPos, yRotation = 0) => ({ modelIdNum, objectType, xPos, yPos: 0, zPos: 0, xRotation: 0, yRotation, zRotation: 0 });
const block = (records) => ({ name: 'RESIGL03.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: records.length },
  block3dObjectRecords: records, blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } });
async function build(records, baseEditable = true) {
  const cpuModels = new Map();
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {}, createMesh: () => ({}) };
  const deps = { renderer, getGpuMesh: async (id) => { cpuModels.set(id, id === FLOOR ? floor : model); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  return buildInteriorContext(deps, block(records), 0, 0, 300, 0, null, { baseEditable });
}

test('BUILT-IN-MODS a town mod\'s furniture written as scenery is a built-in piece - its bed taken out with its rest; the room\'s shell, the ladder and a structural beam never are', async () => {
  const records = [
    at(FLOOR, 13, 0),   // the room's shell: its floor
    at(41100, 3, 0),   // a classic prop: as ever
    at(41101, 0, 100),   // a cupboard the mod wrote as scenery
    at(TOWN_BED_FIRST, 0, 200),   // a coloured bed, scenery
    at(45190, 0, 300),   // a mod's room piece (DET's sea chest)
    at(41409, 0, 400),   // the ladder
    at(62319, 0, 500),   // a wooden beam: structure
    at(41101, 13, 600),   // the room's shell
  ];
  const ctx = await build(records);
  assert.deepEqual(ctx.base.list().map((p) => p.key), ['m1:41100', 'm2:41101', `m3:${TOWN_BED_FIRST}`, 'm4:45190']);
  assert.equal(ctx.containers.filter((c) => c.modelIdNum === 41101).length, 0, 'a piece written as scenery is still no container (AUDIT 64 F17)');
  assert.equal(ctx.beds.length, 1);
  ctx.base.setHidden([`m3:${TOWN_BED_FIRST}`]);
  assert.equal(ctx.beds[0].hidden, true, 'the bed out, its rest goes with it');
  ctx.destroy();
  const plain = await build(records, false);
  assert.equal(plain.base, null, 'a room no one furnishes is built as ever');
  plain.destroy();
});

test('BUILT-IN-MODS the furnishings: a model Daggerfall lays as a prop in its rooms, or a mods\' room piece - never their structure, a ship\'s rigging or a beam (AUDIT FB1029B H1)', () => {
  for (const id of [41000, 41101, 41128, 51115, TOWN_BED_FIRST, 45190, 69420]) assert.equal(isRoomFurnishing(id), true, String(id));
  for (const id of [...MOD_ROOM_STRUCTURE, 41400, 41404, 41501, 41242, 43999, 40999, 62319, 1000, 45076, NaN]) assert.equal(isRoomFurnishing(id), false, String(id));
});

test('BUILT-IN-MODS (AUDIT FB1029B H2) a piece with no floor under it is the room\'s - taking it out would open a way into the void', async () => {
  const ctx = await build([at(FLOOR, 13, 0), at(41101, 0, 0), at(41100, 3, 40000)]);   // a piece on the floor; one 1 km off it
  assert.deepEqual(ctx.base.list().map((p) => p.key), ['m1:41101'], 'the piece over the void stays the room\'s');
  ctx.destroy();
});

test('BED-TURN a coloured bed is laid half a turn from its record, back onto Daggerfall\'s mesh; a classic bed as written', () => {
  assert.equal(TOWN_BED_TURN, 1024);
  const yaw = (id, rot) => {
    const { placements } = layoutInterior(block([at(id, 3, 0, rot)]), 0, 0, () => model);
    const m = placements[0].matrix;
    return Math.round(Math.atan2(m[8], m[10]) * 180 / Math.PI);
  };
  const classic = yaw(41000, 512), coloured = yaw(TOWN_BED_FIRST, 512 + 1024);
  assert.equal(coloured, classic, 'the mod\'s record, turned back, faces as the classic bed it replaced');
  assert.notEqual(yaw(TOWN_BED_FIRST, 512), classic);
});
