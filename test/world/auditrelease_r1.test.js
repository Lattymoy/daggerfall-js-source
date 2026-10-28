// AUDIT RELEASE R1 (2026-10-26; bible/01-Overview/audits/Audit-Release-R1.md) - the seams between TESA's eleven streams,
// pinned where a finding was fixed:
//  R1-1  a town's wall model and the Imperial City's cells: TS4/TS7's walls ran their model ids from 3,000,000 + a map id's
//        low 20 bits, and IC-GRAND's fabric family owns 3,000,000 to 3,039,999 (world/imperialBlocks.js) - a model registered
//        by its id wins over a family's (world/customModels.js), and the pipeline keeps one mesh an id, so 43 of the Bay's 410
//        walled cities' walls answered for one of the city's cells. The walls run from 1,000,000 now (world/townWalls.js
//        TOWN_WALL_MODEL_BASE), clear of every other run of the port's own models.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { standTownWall, townWallBlockName, townWallModelId, TOWN_WALL_MODEL_BASE, WALL_MODELS } from '../../src/world/townWalls.js';
import { townOutlineBlockJson, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { IMPERIAL_FABRIC_MODEL, IMPERIAL_SKYLINE_MODEL, imperialFabricModelId, isFabricModelId, isSkylineId } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SPAN } from '../../src/world/imperialCity.js';
import { TOWN_FABRIC_MODEL_BASE } from '../../src/world/urban/townFabricStand.js';
import { CAPITAL_MODELS } from '../../src/world/tamrielCapitals.js';
import { ARENA_MODEL_ID } from '../../src/world/arena/arenaModel.js';
import { registerCustomModelFamily, customModelFor, customModelNeeds, _resetCustomModels } from '../../src/world/customModels.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
afterEach(() => _resetCustomModels());

/** Knightston's map id (MAPS.BSA, region 40): its low 20 bits 13420 - the Imperial City's cell (67, 20) under the old law. */
const KNIGHTSTON = 163591276;

/** A walled city of three by three, its ring the template's, stood (test/world/townwalls.test.js TS4's own fixture). */
function standWalled(mapId) {
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ subRecords: [{ xPos: 2048, zPos: z, exterior: { block3dObjectRecords: [{ modelIdNum: 446 }] } }] });
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': { rmbBlock: gate(3584) }, 'WALLAA10.RMB': { rmbBlock: gate(512) } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const loc = { name: 'Walled', mapTableData: { mapId }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true } };
  return standTownWall(loc, template, (n) => served[n] ?? null, townOutlineBlockJson);
}

test('AUDIT RELEASE R1-1: the walls\' model ids run clear of every other run of the port\'s own models - IC-GRAND\'s fabric (forty thousand cells) and skylines (625 slices), URBANIZER\'s fabrics, the capitals\' landmarks and the arena (mutants: the walls\' base back on the fabric\'s run, on the skylines\')', () => {
  const runs = [
    ['the walls', TOWN_WALL_MODEL_BASE, TOWN_WALL_MODEL_BASE + 0x100000],
    ['the Imperial City\'s fabric', IMPERIAL_FABRIC_MODEL, IMPERIAL_FABRIC_MODEL + IMPERIAL_CELLS * IMPERIAL_CELLS],
    ['the Imperial City\'s skylines', IMPERIAL_SKYLINE_MODEL, IMPERIAL_SKYLINE_MODEL + IMPERIAL_SPAN * IMPERIAL_SPAN],
    ['URBANIZER\'s fabrics (a session\'s million)', TOWN_FABRIC_MODEL_BASE, TOWN_FABRIC_MODEL_BASE + 1000000],
    ...Object.entries(CAPITAL_MODELS).map(([k, id]) => [`the capitals' ${k}`, id, id + 1]),
    ['Daggerfall\'s arena', ARENA_MODEL_ID, ARENA_MODEL_ID + 1],
  ];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const [a, a0, a1] = runs[i], [b, b0, b1] = runs[j];
      assert.ok(a1 <= b0 || b1 <= a0, `${a} [${a0}, ${a1}) and ${b} [${b0}, ${b1}) share ids`);
    }
  }
  for (const low of [0, 13420, 40000, 100000, 500007, 0xfffff]) {
    const id = townWallModelId(((0x1f << 20) | low) >>> 0);
    assert.ok(!isFabricModelId(id) && !isSkylineId(id), `a wall's model (low ${low}) none of the Imperial City's`);
    assert.equal(id - TOWN_WALL_MODEL_BASE, low, 'each its own: a map id\'s low 20 bits whole');
  }
});

test('AUDIT RELEASE R1-1: a Bay city\'s wall stood beside the Imperial City\'s families - the city\'s cell answers its own fabric, the wall its own pieces, Knightston\'s low bits and all (mutant: the walls\' base back on the fabric\'s run)', () => {
  registerCustomModelFamily({ owns: isFabricModelId, build: (id) => ({ ic: id }), keep: 8, climateFree: true });   // world/capitalModels.js installCapitals' own owner
  const wall = standWalled(KNIGHTSTON);
  assert.ok(wall, 'the wall stood');
  const cell = imperialFabricModelId(67, 20);
  assert.equal(cell, IMPERIAL_FABRIC_MODEL + (KNIGHTSTON & 0xfffff), 'the cell the old law gave Knightston\'s wall');
  assert.deepEqual(customModelFor(cell), { ic: cell }, 'the city\'s cell its own fabric, never a Bay city\'s wall');
  assert.deepEqual(customModelNeeds(cell), [], 'and no wall\'s pieces asked of the player\'s ARCH3D for it');
  assert.deepEqual([...customModelNeeds(townWallModelId(KNIGHTSTON))].sort(), Object.values(WALL_MODELS).sort(), 'the wall its own');
  // the families as the game installs them: the fabric and the skylines owned by their runs' own tests
  assert.match(read('src/world/capitalModels.js'), /registerCustomModelFamily\(\{ owns: isFabricModelId,[^\n]+\n\s+registerCustomModelFamily\(\{ owns: isSkylineId,/);
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('AUDIT RELEASE R1-1 with ARENA2: every walled Bay city (townOutline.js wallBayCity\'s own test, all 410) stands its wall on a model id of its own - none of the Imperial City\'s, no two alike', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const CLASSIC_WALL = /^WALLAA(0\d|1[01])\.RMB$/i, isWall = (n) => /^WALLAA\d\d/i.test(String(n ?? ''));
  const ids = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) {
      const loc = maps.getLocation(r, l), ed = loc?.exterior?.exteriorData;
      if (!ed?.blockNames || !(ed.width >= 3 && ed.height >= 3) || ed.blockNames.length !== ed.width * ed.height) continue;
      const border = (i) => { const x = i % ed.width, y = (i - x) / ed.width; return x === 0 || y === 0 || x === ed.width - 1 || y === ed.height - 1; };
      if (!ed.blockNames.every((n, i) => (border(i) ? CLASSIC_WALL.test(String(n ?? '')) : !isWall(n)))) continue;
      const id = townWallModelId(loc.mapTableData.mapId);
      assert.ok(!isFabricModelId(id) && !isSkylineId(id), `${loc.name}'s wall (${id}) one of the Imperial City's models`);
      assert.ok(!ids.has(id), `${loc.name} and ${ids.get(id)} one wall model`);
      ids.set(id, loc.name);
    }
  }
  assert.equal(ids.size, 410);
});
