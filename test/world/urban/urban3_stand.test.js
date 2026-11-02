// URBANIZER U3 (2026-10-26; bible/03-World/Urban-Fabric.md section 6): a town's fabric stood - which towns are dressed,
// where their main streets run, the plan and the model kept while near and let go after, the walkers shut by it, and the
// pixel build's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fabricTown, fabricEnds, fabricBlockOf, townFabricFor, townFabricOf, shutTownFabric, fabricWalkShut, isPortCell, _resetTownFabrics, TOWN_FABRIC_KEEP, TOWN_FABRIC_MODEL_BASE, GATE_IN_M } from '../../../src/world/urban/townFabricStand.js';
import { hasCustomModel, customModelNeeds, customModelBuilt } from '../../../src/world/customModels.js';
import { townFabricModel } from '../../../src/world/urban/townFabricModel.js';
import { registerTownWall, WALL_MODELS, GATE_OPENING } from '../../../src/world/townWalls.js';
import { CAPITALS, BLOCK_M } from '../../../src/world/tamrielCapitals.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { FABRIC_CELLS } from '../../../src/world/urban/townFabric.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const loc = (o = {}) => ({ name: 'T', mapTableData: { mapId: o.mapId ?? 0xa7000001, locationType: o.type ?? LOCATION_TYPES.TownCity }, exterior: { exteriorData: { width: o.w ?? 2, height: o.h ?? 1, blockNames: o.names ?? ['RESIAA00.RMB', 'RESIAA01.RMB'] } }, ...o.extra });

test('URBANIZER U3 which towns: Arena\'s places and the countryside\'s towns past the Bay, the capitals but the Imperial City - never a lair, a Bay town or a place with no exterior (mutants: the Imperial City dressed; a lair dressed)', () => {
  assert.equal(fabricTown(loc({ extra: { arena: { province: 'Skyrim' } } })), true);
  assert.equal(fabricTown(loc({ extra: { country: { px: 1, py: 2 } } })), true);
  assert.equal(fabricTown(loc({ extra: { country: { dungeon: true } } })), false);
  assert.equal(fabricTown(loc({ extra: { capital: { k: 1 } } })), true);
  assert.equal(fabricTown(loc({ extra: { capital: { k: 0 } } })), false, 'the Imperial City is its own district work');
  assert.equal(fabricTown(loc()), false, 'a Bay town');
  assert.equal(fabricTown({ arena: {} }), false);
  for (const n of ['TESAOPEN.RMB', 'TESW1A.RMB', 'TESASOP0.RMB', 'TESGSO0101.RMB', 'TESLSO0000.RMB']) assert.equal(isPortCell(n), true, n);
  for (const n of ['RESIAM04.RMB', 'TEMPAAD0.RMB', 'TVRNAM04.RMB']) assert.equal(isPortCell(n), false, n);
});

test('URBANIZER U3 where the main streets run: a walled city from each gate\'s opening GATE_IN_M in; a capital from the sides its gates face to its anchor; a city from its four sides\' middles, a hamlet from the ends of its longer axis; a village none (mutants: the gate\'s way in reversed; a capital\'s anchor read from the south; a hamlet crossed)', () => {
  const W = 3 * FABRIC_CELLS, H = 2 * FABRIC_CELLS;
  assert.deepEqual(fabricEnds(loc(), W, H), { mains: true, ends: [[W / 2, H], [W / 2, 0], [W, H / 2], [0, H / 2]], centre: [W / 2, H / 2] });
  assert.deepEqual(fabricEnds(loc({ type: LOCATION_TYPES.TownHamlet }), W, H).ends, [[0, H / 2], [W, H / 2]], 'along its longer axis');
  assert.deepEqual(fabricEnds(loc({ type: LOCATION_TYPES.TownHamlet }), H, W).ends, [[W / 2 - (W - H) / 2, 0], [W / 2 - (W - H) / 2, W]].map(([x, z]) => [H / 2, z]));
  assert.equal(fabricEnds(loc({ type: LOCATION_TYPES.TownHamlet }), FABRIC_CELLS, FABRIC_CELLS).mains, false, 'a hamlet of one block none');
  assert.equal(fabricEnds(loc({ type: LOCATION_TYPES.TownVillage }), W, H).mains, false);
  // Solitude: its gate south; its anchor (2, 3) - two blocks east, the plan's fourth row line from the north
  const so = CAPITALS.findIndex((c) => c.key === 'solitude'), S = 8 * FABRIC_CELLS;
  const e = fabricEnds(loc({ extra: { capital: { k: so } } }), S, S);
  assert.deepEqual(e.ends, [[S / 2, 0]]);
  assert.deepEqual(e.centre, [(2 * BLOCK_M) / 1.6, ((8 - 3) * BLOCK_M) / 1.6]);
  // a walled city: its wall's gates as it registered them - each its opening's middle (GATE-ROADS: PIN MOVED, the model's
  // way through stands GATE_OPENING.along on its +x, (out[1], -out[0]), from the piece's middle)
  const walled = loc({ mapId: 0xa7012345, extra: { outline: { walled: true } } });
  registerTownWall(walled, walled.exterior.exteriorData.blockNames, () => null, () => ({ RmbBlock: {} }), { pieces: [{ model: WALL_MODELS.gate, at: [100, 10], out: [0, -1] }, { model: WALL_MODELS.wall, at: [50, 10], out: [0, -1] }, { model: WALL_MODELS.gate, at: [10, 60], out: [-1, 0] }], markers: [] });
  assert.deepEqual(fabricEnds(walled, W, H).ends, [[(100 - GATE_OPENING.along) / 1.6, (10 + GATE_IN_M) / 1.6], [(10 + GATE_IN_M) / 1.6, (60 + GATE_OPENING.along) / 1.6]]);
});

/** A laid-out block of our own: houses on its town map, its ground dirt but a road along tile row 8 and grass on rows 0-9. */
const laid = (x, name = 'RESIAA00.RMB') => {
  const autoMapData = new Uint8Array(64 * 64);
  for (let r = 10; r <= 24; r++) for (let c = 8; c <= 24; c++) autoMapData[r * 64 + c] = 18;
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : ty < 3 ? 2 : 1 })));
  return { x, y: 0, blockName: name, dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } }, misc3dObjectRecords: [{ xPos: 1600, zPos: -2000, modelIdNum: 41818 }], miscFlatObjectRecords: [] } } };
};

test('URBANIZER U3 a block as the plan reads it: its town map, its ground (GroundTiles[x][y]) and its records\' places in its own metres; a port cell none (mutants: the ground\'s axes swapped; a record\'s z from the north)', () => {
  const b = fabricBlockOf(laid(0));
  assert.equal(b.automap[10 * 64 + 8], 18);
  assert.equal(b.ground(0, 8), 46); assert.equal(b.ground(5, 1), 2); assert.equal(b.ground(5, 12), 1);
  assert.deepEqual(b.records, [{ x: 40, z: (-2000 + 4096) * 0.025, id: 41818, plate: null }]);   // PIN MOVED (AUDIT PROP-GROUND): a model's id, its foot plate
  assert.equal(fabricBlockOf(laid(0, 'TESAOPEN.RMB')), null);
  assert.equal(fabricBlockOf(null), null);
});

test('URBANIZER U3 a town\'s fabric: planned once and kept by its map id (its steps a breath apart), its model on the model door under an id never reused, needing Daggerfall\'s fence and crate; the TOWN_FABRIC_KEEP most recent kept and the rest let go, their models off the door (mutants: a model left on the door; an id reused; the breath unasked; the model made in one piece)', async () => {
  _resetTownFabrics();
  const at = { px: 100, py: 100 }, blocks = [laid(0), laid(1, 'RESIAA01.RMB')];
  let breaths = 0;
  const a = await townFabricFor(loc({ extra: { arena: { province: 'Skyrim' } } }), blocks, { ...at, breathe: () => { breaths++; } });
  assert.ok(a && a.modelId >= TOWN_FABRIC_MODEL_BASE);
  assert.equal(breaths, 5);   // PIN MOVED (AUDIT PROP-GROUND): a breath before the street under the props
  assert.equal(a.style, 'granite');
  assert.equal(await townFabricFor(loc({ extra: { arena: { province: 'Skyrim' } } }), blocks, at), a, 'kept');
  assert.equal(townFabricOf(loc()), a);
  assert.ok(hasCustomModel(a.modelId));
  assert.deepEqual([...customModelNeeds(a.modelId)].sort(), [41206, 41818]);
  // the model made a breath at a time when the door is handed a breather (its streets, yards, props, its faces mapped) -
  // the same model as made whole
  let modelBreaths = 0;
  const sliced = await customModelBuilt(a.modelId, { classicModel: () => null }, () => { modelBreaths++; });
  assert.ok(modelBreaths >= 4, `${modelBreaths} breaths in the model's making`);
  const whole = townFabricModel(a.plan, a.style, { cobbles: true });   // a city's (the test's town is one)
  assert.deepEqual([[...sliced.positions], [...sliced.indices], sliced.subMeshes], [[...whole.positions], [...whole.indices], whole.subMeshes]);
  assert.equal(await townFabricFor(loc(), blocks, at), null, 'a Bay town none');
  const ids = [a.modelId];
  for (let k = 1; k <= TOWN_FABRIC_KEEP; k++) ids.push((await townFabricFor(loc({ mapId: 0xa7000001 + k, extra: { arena: { province: 'Elsweyr' } } }), blocks, at)).modelId);
  assert.equal(new Set(ids).size, ids.length, 'never reused');
  assert.equal(hasCustomModel(a.modelId), false, 'the oldest let go');
  assert.equal(townFabricOf(loc()), null);
  assert.ok(hasCustomModel(ids[ids.length - 1]));
  const again = await townFabricFor(loc({ extra: { arena: { province: 'Skyrim' } } }), blocks, at);
  assert.ok(again.modelId > ids[ids.length - 1], 'planned again, a new id');
  assert.deepEqual([...again.plan.shut], [...a.plan.shut], 'the same plan');
  _resetTownFabrics();
});

test('URBANIZER U3 the walkers: a town\'s walk grid shut where its fabric shuts it, after its own shut (the wall\'s, the ground\'s); a grid of another size untouched (mutants: the fabric\'s shut unread)', async () => {
  _resetTownFabrics();
  const town = loc({ extra: { arena: { province: 'Skyrim' } } });
  const f = await townFabricFor(town, [laid(0), laid(1, 'RESIAA01.RMB')], { px: 1, py: 1 });
  const nav = { grid: new Uint8Array(f.plan.shut.length).fill(0x70) };
  const order = [];
  fabricWalkShut((n) => { order.push('own'); assert.equal(n, nav); }, town)(nav);
  order.push('fabric');
  let shut = 0;
  for (let i = 0; i < nav.grid.length; i++) { if (f.plan.shut[i]) { assert.equal(nav.grid[i], 0); shut++; } else assert.equal(nav.grid[i], 0x70); }
  assert.ok(shut > 0);
  assert.deepEqual(order, ['own', 'fabric']);
  const other = { grid: new Uint8Array(10).fill(7) };
  shutTownFabric(other, town);
  assert.deepEqual([...other.grid], Array(10).fill(7));
  _resetTownFabrics();
});

test('URBANIZER U3 the pixel build\'s wiring by source: the fabric planned as the town is laid out, before its yards and walkers are placed; its walk shut the town\'s and the fabric\'s; the model stood at the location\'s origin, its Daggerfall pieces in the town\'s climate, merged and solid as its blocks\' are (mutants: the model unmerged; no collider; planned after the yards)', () => {
  const pb = rd('src/scenes/pixelBuild.js');
  assert.match(pb, /const walkShut = dfLocation \? fabricWalkShut\(townWalkShut\(dfLocation, townGround, paths\), dfLocation\) : null;/);   // PIN MOVED (TS10): and the paths its terrain painted
  // PIN MOVED (TOWN-BOARDS): planned on the town's ground and its painted roads, the terrain job's (test/world/urban/townboards.test.js)
  const plan = pb.indexOf('const fabric = await townFabricFor(dfLocation, loc.blocks, { px, py, breathe: () => breather.breathe(), ground: townGround, paths });');
  assert.ok(plan > 0 && plan < pb.indexOf('const places = yardTown || portTown ? await townPlacesFor('), 'before the yards');   // PIN MOVED (IC-STUTTER): awaited
  const stand = pb.slice(pb.indexOf('      if (fabric) {'), pb.indexOf('      // T2 towns: the streaming host\'s wandering population'));
  assert.match(stand, /await remapSubMeshes\(gpuF\.subMeshes, texRemap, townClimateArchive, pipeline, townClimateBase\);/);
  assert.match(stand, /const local = trs\(locLocal\[0\], locLocal\[1\], locLocal\[2\], 0, 0, 0\)/);
  assert.match(stand, /addStatic\(cpuF, local, false\); entry\._batched = true;/);
  assert.match(stand, /late\.add\(key, cpuF\.positions, cpuF\.indices, local,/);
  // PIN MOVED (IC-GRAND, test/world/icgrand_lod.test.js): the walkers' gate asks the Imperial City's far view first (`!farView &&`)
  assert.ok(pb.indexOf('      if (fabric) {') < pb.indexOf('if (!farView && populatesWanderingNpcs(dfLocation.mapTableData.locationType)) {'), 'before the walkers');
  assert.match(rd('src/scenes/modWorldData.js'), /installTownOutline\(\);[^\n]*\n\s+installUrbanArt\(\);/);
});
