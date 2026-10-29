// BUILT-IN-MODS and BED-TURN on the player's own data (FIELD BUGS 2026-10-29b): the house a player bought in Alinor, past
// the Bay, and the same mod house in a Bay town. Alinor lays Beautiful Cities' RESIGL03 (world/tamrielCapitals.js), the
// mod's rebuild of a classic block; its first house is built through the real interior builder as an owned room: every
// furniture piece is a built-in one now, not the 29 props alone. Needs ARENA2 (sh tools/fetch-data.sh).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { openWorldDataPack, readPackText } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { cityBlockNames, capitalBlockNames, CAPITALS } from '../../src/world/tamrielCapitals.js';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { installTownStandIns } from '../../src/world/townStandIns.js';

const A = process.env.ARENA2_PATH;
const skip = !A && 'ARENA2_PATH not set';
installTownStandIns(() => true);

async function world() {
  const bf = new BlocksFile(); bf.load(new Uint8Array(readFileSync(`${A}/BLOCKS.BSA`)));
  const mf = new MapsFile(); mf.load(new Uint8Array(readFileSync(`${A}/MAPS.BSA`)), new Uint8Array(readFileSync(`${A}/CLIMATE.PAK`)), new Uint8Array(readFileSync(`${A}/POLITIC.PAK`)));
  const text = await readPackText(new Uint8Array(readFileSync(new URL('../../vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz', import.meta.url))));
  return { bf, mf, pack: openWorldDataPack(JSON.parse(text), { blocks: bf }) };
}
const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
async function ownedRoom(dfBlock, record) {
  const cpuModels = new Map();
  const deps = { renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {}, createMesh: () => ({}) },
    getGpuMesh: async (id) => { cpuModels.set(id, model); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  return buildInteriorContext(deps, dfBlock, 0, record, 300, 0, null, { baseEditable: true });
}

test('BUILT-IN-MODS Alinor lays Beautiful Cities\' RESIGL03, and its first house\'s furniture is all built in - as the same house in a Bay town', { skip }, async () => {
  const { bf, mf, pack } = await world();
  const rows = [];
  for (let r = 0; r < mf.regionCount; r++) for (let i = 0; i < mf.baseLocationCount(r); i++) { const l = mf.readClassicLocation(r, i); if (l) rows.push(l); }
  const k = CAPITALS.findIndex((c) => c.key === 'alinor');
  const cap = CAPITALS[k];
  const pool = cityBlockNames(rows);
  const laid = capitalBlockNames(cap.slicePlan ? cap.slicePlan(0) : cap.plan.slice(0, 8), k, pool);
  assert.ok(laid.includes('RESIGL03.RMB'), 'past the Bay: Alinor lays it');
  assert.ok(pool.get('RESI').includes('RESIGL03.RMB'), 'in the Bay: one of the Bay\'s own city houses, the pool Alinor draws from');
  const json = pack.rebuild('RESIGL03.RMB.json');
  const dfBlock = blockFromJson(json, bf.getBlockIndex('RESIGL03.RMB'));
  const types = dfBlock.rmbBlock.fldHeader.buildingDataList.map((b) => b.buildingType);
  const record = types.findIndex((t) => t >= 17 && t <= 20);
  assert.ok(record >= 0, 'a house');
  const objs = dfBlock.rmbBlock.subRecords[record].interior.block3dObjectRecords;
  const props = objs.filter((o) => o.objectType === 3 && o.modelIdNum !== 41409).length;
  const scenery = objs.filter((o) => o.objectType === 0 && o.modelIdNum >= 41000 && o.modelIdNum <= 43999 && o.modelIdNum !== 41409).length;
  assert.ok(scenery > 0, 'the mod wrote furniture as scenery');
  const ctx = await ownedRoom(dfBlock, record);
  const pieces = ctx.base.list().filter((p) => p.model != null).length;
  assert.ok(pieces >= props + scenery, `${pieces} built-in pieces, not the ${props} props alone`);
  ctx.destroy();
});
