// FIELD BUGS 2026-10-14 INN-BEDS (Mona Polca on the Discord: "Inns with this room layout can't be used to sleep - No
// prompt to rest or loiter when clicking the beds" - a dormitory of beds between wooden partitions). The interior
// builder listed a bed only when its placement was a prop (ObjectType 3), the gate DFU puts on furniture's actions
// (DaggerfallInterior.cs:500); Roleplay Realism's BedActivation is keyed on the model id alone (RoleplayRealism.cs:126-128)
// and DFU stands a custom-activation model on its own whatever its ObjectType. A bed written as scenery (ObjectType 0 or
// 4 - 38 of the 39 bed placements in the vendored world data) was never a click target. Driven through the real builder.
// bible/01-Overview/bugs/Field-Bugs-2026-10-14.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';

const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
const at = (modelIdNum, objectType, xPos) => ({ modelIdNum, objectType, xPos, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 });

test('INN-BEDS: every bed model is a bed whatever its ObjectType - a prop\'s, scenery\'s (0) and a bunk\'s (4) - and furniture\'s actions stay the prop\'s alone (mutant: the bed gated on the prop again)', async () => {
  const cpuModels = new Map();
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {}, createMesh: () => ({}) };
  const deps = { renderer, getGpuMesh: async (id) => { cpuModels.set(id, model); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const records = [at(41000, 3, 0), at(41001, 0, 100), at(41002, 4, 200), at(41001, 0, 300), at(41800, 0, 400), at(41800, 3, 500)];
  const dfBlock = { name: 'T.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: records.length },
    block3dObjectRecords: records, blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } };
  const ctx = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, {});
  assert.equal(ctx.beds.length, 4, 'the prop bed and the three written as scenery');
  assert.deepEqual(ctx.beds.map((b) => b.matrix[12] / ctx.beds[1].matrix[12]), [0, 1, 2, 3], 'each bed at its own placement, in the record\'s order');
  assert.equal(ctx.containers.length, 1, 'a chest written as scenery is still geometry (AUDIT 64 F17) - the prop chest alone opens');
  ctx.destroy();
});
