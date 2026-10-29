// NOTICE-PANEL (bible/01-Overview/bugs/Field-Bugs-2026-10-29f.md; AUDIT FB1029f R2; the owner: "remove the notice board
// prop from all cities"): the town packs' rooms place Daggerfall's board model (41739) in taverns, temples, manors and
// gate blocks - none stands indoors either. The room is built on doorvoid's fakes; the board is skipped where it lies, so
// every piece after it keeps its index (`int:<n>`, the key an owner's furniture list is saved by).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { BULLETIN_BOARD_MODEL_ID } from '../../src/world/rmbLayout.js';

const mint = (pts, archive = 166) => dfMeshToModel({
  totalVertices: pts.length, totalTriangles: pts.length - 2,
  subMeshes: [{ textureArchive: archive, textureRecord: 0, totalTriangles: pts.length - 2, planes: [{ points: pts.map(([x, y, z]) => ({ x: x * 40, y: -y * 40, z: z * 40, nx: 0, ny: 0, nz: 0, u: 0, v: 0 })) }] }],
}, () => ({ width: 64, height: 64 }));
const ROOM = 31715, TABLE = 41120;
const MODELS = {
  [ROOM]: () => mint([[-3, 0, -3], [3, 0, -3], [3, 0, 3], [-3, 0, 3]]),
  [TABLE]: () => mint([[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], 167),
  [BULLETIN_BOARD_MODEL_ID]: () => mint([[0, 0, 2], [1, 0, 2], [1, 2, 2], [0, 2, 2]], 168),
};
function pipeline() {
  const cpuModels = new Map(), asked = [];
  return {
    asked, cpuModels, getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null, getMachineryParts: null,
    getGpuMesh: async (id) => { asked.push(id); const m = MODELS[id]?.(); if (!m) return null; cpuModels.set(id, { modelIdNum: id, ...m }); return { id }; },
  };
}
const noop = () => {};
const renderer = { createBillboardBatch: () => ({}), destroyBatch: noop, createMesh: () => ({}), destroyMesh: noop };
const obj = (id, type = 0) => ({ modelIdNum: id, objectType: type, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 });
const blockOf = (objs) => ({
  index: 7, name: 'TVRNAM08.RMB',
  rmbBlock: {
    fldHeader: { buildingDataList: [{ buildingType: 15, factionId: 0, quality: 1, nameSeed: 1 }] },
    subRecords: [{
      xPos: 0, zPos: 0, yRotation: 0,
      exterior: { header: { num3dObjectRecords: 0 }, block3dObjectRecords: [], blockFlatObjectRecords: [], blockPeopleRecords: [], blockDoorRecords: [] },
      interior: { header: { num3dObjectRecords: objs.length }, block3dObjectRecords: objs, blockFlatObjectRecords: [], blockPeopleRecords: [], blockSection3Records: [], blockDoorRecords: [] },
    }],
  },
});

test('NOTICE-PANEL (AUDIT FB1029f R2): a town pack\'s room places the board - none is drawn, mapped or walked into, and the pieces after it keep their keys (mutants: AFB-R2-the-board-indoors)', async () => {
  const deps = { renderer, ...pipeline() };
  const ctx = await buildInteriorContext(deps, blockOf([obj(ROOM), obj(BULLETIN_BOARD_MODEL_ID), obj(TABLE, 3)]), 7, 0, 300, 0, null, {});
  const keys = ctx.drawList.map((d) => d.key);
  assert.ok(keys.includes('int:0') && keys.includes('int:2'), `the room and the table stand at their own indices: ${keys}`);
  assert.ok(!keys.includes('int:1'), 'the board does not');
  assert.ok(!ctx.automapEntries?.some?.((e) => e.key === 'int:1'), 'nor on the map');
  ctx.destroy();
});
