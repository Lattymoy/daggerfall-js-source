// TOWN-BOARDS (the owner's field report, 2026-10-27, item 3: "Random wooden board placement in smaller towns on the ground";
// bible/03-World/Urban-Fabric.md section 9) - THE BOARDS ON THE GROUND, and the two rules of URBANIZER's fabric that laid
// them:
//   - THE PAVEMENT ROUND THE CARRIAGEWAY. A main street's pavement had been its cells between FABRIC.carriage and 3.5 of
//     the walk in straight lines - a band a cell wide that met its next cell at a corner alone at every step of the walk
//     (four ways: a staircase wherever the street turns or runs aslant). Over every hamlet past the Bay 31,419 of the
//     40,052 pavement pieces under four cells were such steps (over every city 27,845 of 36,045): single flags apart in the
//     stone styles, single boards on the forest floor in the planks' (Valenwood, Black Marsh - no carriageway between
//     them). Now it is the carriageway's ring by the eight ways, FABRIC.kerb deep: its cells side by side round every step.
//   - THE FABRIC ON THE TOWN'S GROUND. The plan took every cell of a town's blocks for the town's, but TS2 flattens only
//     its outline (world/terrain/terrainTiles.js townGroundMask) and eases the rest back to the land; the fabric stands at
//     the flattened level, so a yard planned past the outline was fenced down the land's slope - its fence buried to its
//     top rail (a board on the ground) or hung - at a village's and a hamlet's edges (a city past the Bay stands on its
//     wall's round, its whole inside its ground). Now a cell past the town's ground is off the town (world/townShape.js
//     onTownGround - the walkers' own law): its yard fenced where the ground ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fabricGrid, fabricPlan, labelPieces, FABRIC, FABRIC_KIND as K, FABRIC_CELLS } from '../../../src/world/urban/townFabric.js';
import { townFabricFor, townFabricOf, fabricGroundKey, _resetTownFabrics } from '../../../src/world/urban/townFabricStand.js';
import { onTownGround, shutOffGround } from '../../../src/world/townShape.js';
import { getLocationTerrainTileOrigin } from '../../../src/world/terrain/terrainTiles.js';
import { hasCustomModel } from '../../../src/world/customModels.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const C = FABRIC_CELLS;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A block of our own (urban3_fabric.test.js's): its town map's rects (rows from the north), its ground a function of the
 *  town map's (row, column). */
function block({ ground = () => 1, rects = [] } = {}) {
  const automap = new Uint8Array(C * C);
  for (const [r0, r1, c0, c1, b] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) automap[r * C + c] = b;
  return { automap, ground: (tx, ty) => ground(ty * 4, tx * 4), records: [] };
}

/** The pavements' pieces (four ways) and the steps between them: two pieces meeting at a corner alone across the town's
 *  open ground (neither cell that would join them built or off the town). */
function pavements(plan) {
  const { W, H } = plan, pave = Uint8Array.from(plan.kind, (k) => (k === K.pave ? 1 : 0)), { id, sizes } = labelPieces(W, H, pave);
  let steps = 0;
  for (let i = 0; i < id.length; i++) {
    if (id[i] < 0) continue;
    const x = i % W;
    for (const [dx, dz] of [[1, 1], [-1, 1]]) {
      const j = i + dz * W + dx;
      const open = (c) => plan.kind[c] !== K.off && plan.kind[c] !== K.built;
      if (x + dx >= 0 && x + dx < W && j < id.length && id[j] >= 0 && id[j] !== id[i] && open(i + dx) && open(i + dz * W)) steps++;
    }
  }
  return { sizes, steps };
}

test('TOWN-BOARDS the pavement round the carriageway: a main street that turns a corner (Daggerfall\'s road east and then north) is paved unbroken round it - its outer pavement and its inner one, two pieces and no step where one meets the next at a corner alone; every pavement cell beside or across a corner of the carriageway, every carriageway cell within FABRIC.carriage of the walk (mutants: the old band in straight lines; the ring by four ways; no ring; the kerb two deep)', () => {
  // the road a tile wide along tile row 8 from the west edge to column 8, and up column 8 to the north edge
  const road = (r, c) => ((r >> 2) === 8 && (c >> 2) <= 8) || ((c >> 2) === 8 && (r >> 2) <= 8);
  const g = fabricGrid(1, 1, () => block({ ground: (r, c) => (road(r, c) ? 46 : 1) }));
  const plan = fabricPlan(g, { ends: [[0, 30], [34, C]], centre: [34, 30], seed: 1 });
  assert.equal(plan.paths.length, 2);
  const { sizes, steps } = pavements(plan);
  assert.equal(steps, 0, 'no pavement meets the next at a corner alone');
  assert.equal(sizes.length, 2, `the outer pavement and the inner one (${sizes.join(' ')})`);
  assert.ok(Math.min(...sizes) > 40, `each a street long (${sizes.join(' ')})`);
  const walk = plan.paths.flat(), dist = (i) => Math.min(...walk.map((p) => Math.hypot((p % C) - (i % C), Math.floor(p / C) - Math.floor(i / C))));
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] === K.main) assert.ok(dist(i) <= FABRIC.carriage + 1e-9, 'the carriageway within FABRIC.carriage');
    if (plan.kind[i] !== K.pave) continue;
    const x = i % C, z = Math.floor(i / C);
    let beside = false;
    for (let dz = -FABRIC.kerb; dz <= FABRIC.kerb; dz++) for (let dx = -FABRIC.kerb; dx <= FABRIC.kerb; dx++) {
      const j = (z + dz) * C + x + dx;
      if (x + dx >= 0 && x + dx < C && j >= 0 && j < plan.kind.length && plan.kind[j] === K.main) beside = true;
    }
    assert.ok(beside, 'a pavement round the carriageway');
  }
  assert.equal(FABRIC.kerb, 1);
});

test('TOWN-BOARDS the fabric on the town\'s ground: a cell its ground refuses is off the town - a yard reaching past it fenced where the ground ends, never down the land past it; nothing of the fabric (a fence, a gate, a wall, a woodpile, a pavement, a carriageway) on a refused cell; no refusal, every cell of the blocks the town\'s (mutants: the ground unread)', () => {
  // a house in the middle and Daggerfall's grass behind it to the block's east edge; the ground the town's west of column 48
  const b = () => block({ ground: (r, c) => (r >= 10 && r < 40 && c >= 20 ? 2 : 1), rects: [[20, 39, 10, 19, 18]] });
  const onGround = (x) => x < 48;
  const g = fabricGrid(1, 1, b, onGround), whole = fabricGrid(1, 1, b);
  for (let i = 0; i < C * C; i++) assert.equal(g.town[i], (i % C) < 48 ? 1 : 0);
  assert.equal(whole.town.reduce((a, v) => a + v, 0), C * C, 'no refusal, the whole block');
  assert.equal(g.house.reduce((a, v) => a + v, 0), whole.house.reduce((a, v) => a + v, 0), 'its houses read whatever its ground');
  const plan = fabricPlan(g, { ends: [], mains: false, seed: 3 }), wide = fabricPlan(whole, { ends: [], mains: false, seed: 3 });
  assert.ok(plan.counts.yards >= 1 && wide.counts.yards >= 1);
  const off = (i) => (i % C) >= 48;
  for (const e of [...plan.fences, ...plan.gates, ...plan.walls]) assert.ok(!off(e.inner), 'every edge on the ground');
  for (const p of plan.props) assert.ok(!off(p.cell), 'every woodpile on the ground');
  for (let i = 0; i < plan.kind.length; i++) if (off(i)) assert.equal(plan.kind[i], K.off);
  // the yard fenced along the ground's edge: its east run at column 48's west side
  const edge = plan.fences.filter((e) => (e.inner % C) === 47 && e.dir === 0);
  assert.ok(edge.length >= 10, `the yard's fence along the ground's edge (${edge.length})`);
  assert.ok(wide.fences.some((e) => off(e.inner)), 'the whole block\'s yard ran past it');
});

/** A location past the Bay of our own (urban3_stand.test.js's): two blocks, an Arena place. */
const loc = (o = {}) => ({ name: 'T', arena: { province: 'Skyrim' }, mapTableData: { mapId: o.mapId ?? 0xa7000101, locationType: LOCATION_TYPES.TownHamlet }, exterior: { exteriorData: { width: 2, height: 1, blockNames: ['RESIAA00.RMB', 'RESIAA01.RMB'] } } });
const laid = (x, name = 'RESIAA00.RMB') => {
  const autoMapData = new Uint8Array(64 * 64);
  for (let r = 10; r <= 24; r++) for (let c = 8; c <= 24; c++) autoMapData[r * 64 + c] = 18;
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : ty < 3 ? 2 : 1 })));
  return { x, y: 0, blockName: name, dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } } };
};
/** A ground mask of the pixel's tiles: the town's where `keep(tx, ty)` (its grid's tile, x east, y north). */
function groundOf(town, keep) {
  const o = getLocationTerrainTileOrigin(town), m = new Uint8Array(128 * 128);
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 32; tx++) if (keep(tx, ty)) m[(o.x + tx) + (o.y + ty) * 128] = 1;
  return m;
}

test('TOWN-BOARDS one ground law: a cell of a town\'s grid is on its ground where its tile is the town\'s - the walkers shut off it (shutOffGround) and the fabric planned on it (onTownGround), cell for cell (mutants: the tiles turned)', () => {
  const town = loc(), o = getLocationTerrainTileOrigin(town), ground = groundOf(town, (tx, ty) => (tx * 7 + ty * 3) % 5 !== 0 && tx < 29);
  const nav = { width: 2 * C, height: C, grid: new Uint8Array(2 * C * C).fill(0x10) };
  shutOffGround(nav, ground, o);
  for (let gy = 0; gy < C; gy++) for (let gx = 0; gx < 2 * C; gx++) {
    const on = onTownGround(ground, o, gx, gy), tx = gx >> 2, ty = gy >> 2;
    assert.equal(on, (tx * 7 + ty * 3) % 5 !== 0 && tx < 29, `cell ${gx},${gy}`);
    assert.equal(nav.grid[gy * nav.width + gx] !== 0, on);
  }
  assert.equal(onTownGround(ground, { x: 126, y: 0 }, 12, 0), false, 'past the pixel none');
});

test('TOWN-BOARDS the stand plans on the ground it is handed: the plan\'s town its ground\'s; kept while asked on the same ground, planned again on another (its old model off the door) and none for no ground - its whole grid; a build that planned it meanwhile kept for both, its model never pulled from under a build in flight (mutants: the stand\'s ground dropped; the plan kept on another ground; the old model left on the door; the ground\'s key blind; the meanwhile planned over)', async () => {
  _resetTownFabrics();
  const town = loc(), blocks = [laid(0), laid(1, 'RESIAA01.RMB')], at = { px: 100, py: 100 };
  const half = groundOf(town, (tx) => tx < 24), all = groundOf(town, () => true);
  const a = await townFabricFor(town, blocks, { ...at, ground: half });
  for (let i = 0; i < a.plan.kind.length; i++) if ((i % (2 * C)) >= 96) assert.equal(a.plan.kind[i], K.off, 'past the ground none');
  assert.ok(a.plan.kind.some((k, i) => (i % (2 * C)) < 96 && k !== K.off));
  assert.equal(await townFabricFor(town, blocks, { ...at, ground: Uint8Array.from(half) }), a, 'the same ground: kept');
  assert.equal(townFabricOf(town), a);
  const b = await townFabricFor(town, blocks, { ...at, ground: all });
  assert.notEqual(b, a, 'another ground: planned again');
  assert.equal(hasCustomModel(a.modelId), false, 'its old model off the door');
  assert.ok(hasCustomModel(b.modelId));
  assert.ok(b.plan.kind.some((k, i) => (i % (2 * C)) >= 96 && k !== K.off), 'the whole ground its own');
  assert.notEqual(fabricGroundKey(half, getLocationTerrainTileOrigin(town), 32, 16), fabricGroundKey(all, getLocationTerrainTileOrigin(town), 32, 16));
  assert.equal(fabricGroundKey(null, { x: 0, y: 0 }, 32, 16), '');
  const none = await townFabricFor(town, blocks, at);
  assert.notEqual(none, b);
  assert.equal(none.plan.kind.filter((k) => k === K.off).length, 0, 'no ground: its whole grid');
  // two builds of one town in flight: the one that lands first is kept for both - its model never pulled from under the
  // build that has it in hand - and a later build on the other ground plans it again
  _resetTownFabrics();
  let release;
  const held = new Promise((r) => { release = r; });
  const slow = townFabricFor(town, blocks, { ...at, ground: half, breathe: () => held });
  const quick = await townFabricFor(town, blocks, { ...at, ground: all });
  release();
  assert.equal(await slow, quick, 'the one planned meanwhile');
  assert.ok(hasCustomModel(quick.modelId), 'its model still on the door');
  assert.equal(townFabricOf(town), quick);
  const again = await townFabricFor(town, blocks, { ...at, ground: half });
  assert.notEqual(again, quick, 'asked on its own ground after: planned again');
  assert.equal(hasCustomModel(quick.modelId), false);
  _resetTownFabrics();
});

test('TOWN-BOARDS the pixel build plans the fabric on the terrain job\'s townGround - the outline TS2 flattened, the same the walkers are shut by (mutants: the host unwired)', () => {
  const pb = rd('src/scenes/pixelBuild.js');
  assert.match(pb, /const \{ samples, [^\n]*townGround[^\n]* \} = await terrainGen\.generate\(\{/);
  assert.match(pb, /const fabric = await townFabricFor\(dfLocation, loc\.blocks, \{ px, py, breathe: \(\) => breather\.breathe\(\), ground: townGround \}\);/);
  assert.match(pb, /fabricWalkShut\(townWalkShut\(dfLocation, townGround, paths\), dfLocation\)/);
});

test('TOWN-BOARDS with ARENA2: the world\'s small towns on the player\'s data - past the Bay every 61st village, hamlet and city as cloned and outlined, no pavement step and nothing of the fabric off its ground; the towns whose fences the land buried or hung, laid on their pixels as the terrain kernel flattens them, none buried or hung now; on the Bay no town dressed by the fabric and no timber lying on the ground in any village\'s or hamlet\'s block', { skip: skipReal }, async () => {
  const sweep = await import('../../../tools/townBoardsSweep.mjs');
  const log = console.log;
  console.log = (...a) => { if (!/^\[worlddata\]/.test(String(a[0]))) log(...a); };
  try {
    const sw = await sweep.openSweep(ARENA2);
    let towns = 0, pieces = 0;
    for (const kind of sweep.SWEEP_KINDS) {
      for (let j = 0; j < sw.templates[kind].length; j += 61) {
        const loc = sweep.sweepClone(sw, kind, j), outline = sweep.outlineGround(sw, loc), { plan, g } = await sweep.sweepPlan(sw, loc, outline);
        const pc = sweep.paveCorners(plan, g), off = sweep.offGround(plan, loc, outline);
        assert.equal(pc.stair, 0, `${kind} #${j} ${loc.name}: ${pc.stair} pavement steps`);
        assert.deepEqual(off, { fences: 0, gates: 0, walls: 0, piles: 0, pave: 0, main: 0 }, `${kind} #${j} ${loc.name}`);
        towns++; pieces += pc.pieces;
      }
    }
    assert.ok(towns >= 50 && pieces > 500, `${towns} towns, ${pieces} pavement pieces`);
    // the towns the sweep found buried or hung before TOWN-BOARDS (tools/townBoardsSweep.mjs --land 10, Urban-Fabric.md section 9)
    for (const [kind, j] of LAND_TOWNS) {
      const loc = sweep.sweepClone(sw, kind, j), L = sweep.sweepLand(sw, loc), { plan } = await sweep.sweepPlan(sw, loc, L.ground);
      const r = sweep.onLand(plan, L.groundAt);
      assert.deepEqual([r.fenceBuried, r.fenceHung, r.pileBuried, r.pileHung, r.paveBuried], [0, 0, 0, 0, 0], `${kind} #${j} ${loc.name} at ${L.px},${L.py}`);
    }
    const bay = sweep.bayBoards(sw);
    assert.ok(bay.towns > 3000 && bay.blocks > 200, `${bay.towns} towns, ${bay.blocks} blocks`);
    assert.equal(bay.fabric, 0, 'the Bay\'s towns are Daggerfall\'s');
    assert.equal(bay.wood, 0, `timber lying on the ground: ${[...bay.flat].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  } finally {
    console.log = log;
  }
});

/** Towns past the Bay whose fabric the land buried or hung before TOWN-BOARDS (tools/townBoardsSweep.mjs --land 10, on
 *  the freeware; Urban-Fabric.md section 9): [kind, template index] - the villages Blackcester (25 fence edges buried,
 *  1.9 m), Lamdale (21 hung, 1.6 m) and Atruhisa (40 hung, 1.7 m); the hamlets Holmarket (56 buried, 13.1 m into its
 *  hillside, and a woodpile), Hortower Derry (43 hung, 2.0 m, and 20 cells of pavement under the land), Tunbeth (94 cells
 *  of pavement under the land) and Aldingmoth Wood (22 hung, 2.1 m). */
const LAND_TOWNS = Object.freeze([['village', 150], ['village', 400], ['village', 730], ['town', 1110], ['town', 530], ['town', 660], ['town', 1100]]);
