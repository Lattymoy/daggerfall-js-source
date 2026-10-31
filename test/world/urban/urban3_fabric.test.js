// URBANIZER U3 (2026-10-26; KPbICA's spec, forwarded by the owner: "Inner yards and backyards", "Wide main streets with
// pathways, alleys, side streets, dead ends"; bible/03-World/Urban-Fabric.md section 4): a town's fabric read off its own
// blocks - its main streets along Daggerfall's roads from its gates to its middle with their pavements, its side streets,
// its alleys, its fenced yards with their gates, its dead ends - and no cell a walker reached before cut off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fabricGrid, fabricPlan, planSteps, chamferField, labelPieces, cutOff, reachOf, maxNear, nearestOpen, edgeRuns, FABRIC, FABRIC_KIND as K, FABRIC_CELLS, ROAD_RECORDS } from '../../../src/world/urban/townFabric.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const C = FABRIC_CELLS;

/** A block of our own: `rect(r0, r1, c0, c1, byte)` on its town map (rows from the north), its ground a function of the
 *  town map's (row, column), its records. */
function block({ ground = () => 1, rects = [], records = [] } = {}) {
  const automap = new Uint8Array(C * C);
  for (const [r0, r1, c0, c1, b] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) automap[r * C + c] = b;
  return { automap, ground: (tx, ty) => ground(ty * 4, tx * 4), records };
}
/** The grid's cell of a block's town-map (row, column) - the grid's rows from the south. */
const cellOf = (bx, by, r, c, W) => (by * C + (C - 1 - r)) * W + bx * C + c;

/** THE TOWN: two blocks side by side - Daggerfall's road a tile wide along each one's tile row 8, a house above it and one
 *  below in each, grass behind the first house (rows 0 to 9) to the town's edge, dirt everywhere else. */
function town() {
  const road = (r) => (r >> 2) === 8 ? 46 : null;
  const b0 = block({ ground: (r, c) => road(r) ?? (r < 10 && c >= 8 && c <= 24 ? 2 : 1), rects: [[10, 24, 8, 24, 18], [40, 54, 30, 50, 18]] });
  const b1 = block({ ground: (r) => road(r) ?? 1, rects: [[12, 26, 10, 30, 19], [42, 56, 20, 44, 20]] });
  return fabricGrid(2, 1, (bx) => (bx === 0 ? b0 : b1));
}

test('URBANIZER U3 the grid: a block\'s town map and ground laid with its rows from the south - a building\'s byte built (and a house\'s), a prop\'s byte built and no house, the water built, the grass, Daggerfall\'s roads; a misc record\'s cell and the eight round it built; a cell no block lays off the town (mutants: the rows unflipped; a prop counted a house; the water walkable)', () => {
  const b = block({ ground: (r, c) => (r === 0 && c < 4 ? 0 : r >= 60 ? 2 : r >= 56 ? 46 : 1), rects: [[20, 20, 20, 20, 18], [30, 30, 30, 30, 250]], records: [{ x: 40 * 1.6 + 0.8, z: 10 * 1.6 + 0.8 }] });
  const g = fabricGrid(2, 1, (bx) => (bx === 0 ? b : null));
  assert.deepEqual([g.W, g.H], [128, 64]);
  const at = (r, c) => cellOf(0, 0, r, c, g.W);
  assert.equal(g.built[at(20, 20)], 1); assert.equal(g.house[at(20, 20)], 1);
  assert.equal(g.built[at(30, 30)], 1); assert.equal(g.house[at(30, 30)], 0, 'a prop is no house');
  assert.equal(g.built[at(0, 0)], 1, 'the water');
  assert.equal(g.grass[at(62, 5)], 1); assert.equal(g.road[at(57, 5)], 1);
  assert.deepEqual(ROAD_RECORDS, [46, 47, 55]);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) assert.equal(g.built[(10 + dz) * g.W + 40 + dx], 1, 'a record\'s cells');
  assert.equal(g.built[12 * g.W + 40], 0);
  assert.equal(g.town[64 + 5], 0, 'the second block none');
  assert.equal(g.town[5], 1);
});

test('URBANIZER U3 the fields: a chamfer distance in cells (a side 1, a diagonal 4/3), the most within a reach, the pieces four ways (mutants: the diagonal\'s weight; the reach)', () => {
  const W = 5, H = 5, from = new Uint8Array(W * H);
  from[12] = 1;
  const d = chamferField(from, W, H);
  assert.equal(d[12], 0); assert.equal(d[13], 1); assert.equal(d[14], 2); assert.ok(Math.abs(d[18] - 4 / 3) < 1e-6); assert.ok(Math.abs(d[0] - 8 / 3) < 1e-6);
  const v = new Float32Array(W * H); v[0] = 7;
  const m = maxNear(v, W, H, 2);
  assert.equal(m[12], 7); assert.equal(m[13], 0); assert.equal(m[24], 0);
  const mask = Uint8Array.from([1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  const { id, sizes } = labelPieces(W, H, mask);
  assert.deepEqual(sizes, [2, 4, 2, 1]);
  assert.equal(id[0], id[1]); assert.equal(id[3], id[9]); assert.equal(id[2], -1);
});

test('URBANIZER U3 the main streets: from each end to the middle along Daggerfall\'s roads (the walk\'s cells open, most on the road) - setts within FABRIC.carriage of the walk, pavements round them FABRIC.kerb deep by the eight ways and before a house; none for a town with no main streets (mutants: the road unread; the pavement band swapped; a village given streets; the corridor read by its cell)', () => {
  const g = town(), W = g.W;
  const plan = fabricPlan(g, { ends: [[0, 30], [W, 30]], centre: [W / 2, 30], seed: 1 });
  assert.equal(plan.paths.length, 2);
  for (const p of plan.paths) {
    assert.equal(p[p.length - 1], plan.centre, 'each ends at the middle');
    for (let k = 1; k < p.length; k++) { const a = p[k - 1], b = p[k]; assert.equal(Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W)), 1, 'a walk of steps'); }
    const on = p.filter((i) => g.road[i]).length;
    assert.ok(on >= p.length * 0.9, `along the road (${on} of ${p.length})`);
  }
  const walk = new Set(plan.paths.flat());
  for (const i of walk) assert.ok(plan.kind[i] === K.main || plan.kind[i] === K.pave, 'the walk is the street');
  const dist = (i) => Math.min(...[...walk].map((p) => Math.hypot((p % W) - (i % W), Math.floor(p / W) - Math.floor(i / W))));
  let mains = 0, paves = 0;
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] === K.main) { mains++; assert.ok(dist(i) <= FABRIC.carriage + 1e-9, 'setts within the carriageway'); }
    // PIN MOVED (TOWN-BOARDS): a pavement is the carriageway's ring by the eight ways, or the carriageway before a house -
    // it had been the band within 3.5 of the walk in straight lines (test/world/urban/townboards.test.js)
    if (plan.kind[i] === K.pave) {
      paves++;
      const x = i % W, z = Math.floor(i / W), nearCarriageway = [-1, 0, 1].some((dz) => [-1, 0, 1].some((dx) => { const j = (z + dz) * W + x + dx; return x + dx >= 0 && x + dx < W && j >= 0 && j < plan.kind.length && dist(j) <= FABRIC.carriage + 1e-9; }));
      assert.ok(nearCarriageway, 'pavements round the carriageway');
    }
  }
  assert.ok(mains > 400 && paves > 200, `${mains} setts, ${paves} pavement`);
  // a cell past the carriageway is pavement; one by a house is pavement however near the walk
  const p0 = plan.paths[0][Math.floor(plan.paths[0].length / 2)], x0 = p0 % W, z0 = Math.floor(p0 / W);
  assert.equal(plan.kind[(z0 + 3) * W + x0], K.pave);
  assert.equal(plan.kind[(z0 + 1) * W + x0], K.main);
  assert.deepEqual([FABRIC.carriage, FABRIC.kerb, FABRIC.pave], [2.5, 1, 1]);   // PIN MOVED (TOWN-BOARDS): the kerb a ring a cell deep, no longer 3.5 of the walk
  // a cell of dirt by a house on wide open ground is open ground, not an alley: a corridor's width is its middle's
  assert.equal(plan.kind[cellOf(0, 0, 25, 15, W)], K.open);
  const village = fabricPlan(g, { ends: [[0, 30], [W, 30]], mains: false });
  assert.equal(village.paths.length, 0);
  assert.equal(village.counts.main + village.counts.pave, 0);
  assert.ok(village.counts.side > 0, 'Daggerfall\'s roads its side streets');
});

test('URBANIZER U3 a yard: Daggerfall\'s grass behind a house fenced where it meets a way, open ground or the land past the town - never against the house - with one gate FABRIC.gate wide in its longest run onto a street; its fence\'s yard side shut to the walkers but the gate; a woodpile against its fence, clear of the house (mutants: a fence on the house\'s wall; no gate; the gate shut; the pile by the house)', () => {
  const g = town(), W = g.W, plan = fabricPlan(g, { ends: [[0, 30], [W, 30]], centre: [W / 2, 30], seed: 1 });
  const yardCell = cellOf(0, 0, 5, 15, W);
  assert.equal(plan.kind[yardCell], K.yard);
  assert.equal(plan.counts.yards, 1);
  const all = [...plan.fences, ...plan.gates];
  for (const e of all) { assert.equal(plan.kind[e.inner], K.yard); assert.ok(e.outer < 0 || !g.house[e.outer], 'never against a house'); }
  assert.ok(all.some((e) => e.outer < 0), 'its back on the town\'s edge');
  assert.equal(plan.gates.length, FABRIC.gate);
  assert.equal(edgeRuns(g, plan.gates).length, 1, 'one gate');
  for (const e of plan.fences) assert.equal(plan.shut[e.inner], 1);
  for (const e of plan.gates) assert.equal(plan.shut[e.inner], 0, 'the gate open');
  assert.equal(plan.props.length, 1);
  const pile = plan.props[0];
  assert.equal(pile.kind, 'woodpile');
  assert.ok(plan.fences.some((e) => e.inner === pile.cell && e.dir === pile.dir), 'against its fence');
  const nearHouse = chamferField(g.house, W, g.H);
  assert.ok(nearHouse[pile.cell] >= FABRIC.pileClear, 'clear of the house');
  assert.deepEqual(cutOff(g, Uint8Array.from(g.town, (t, i) => (t && !g.built[i] ? 1 : 0)), plan.shut), []);
  // on every seed: the yard's fence beside the house is no woodpile's
  for (let seed = 0; seed < 40; seed++) for (const p of fabricPlan(g, { mains: false, seed }).props) assert.ok(nearHouse[p.cell] >= 2, `seed ${seed}: clear of the house`);
  // a yard whose south fence passes small houses a cell off its corners: its woodpile on its east fence, never beside them
  const sheds = [2, 5, 8, 11, 14].map((c) => [12, 12, c, c, 18]);
  const yardB = block({ ground: (r, c) => (r >= 4 && r < 12 && c < 16 ? 2 : 1), rects: [[0, 3, 0, 15, 18], ...sheds] });
  const g3 = fabricGrid(1, 1, () => yardB), near3 = chamferField(g3.house, g3.W, g3.H);
  let piles = 0;
  for (let seed = 0; seed < 40; seed++) for (const p of fabricPlan(g3, { mains: false, seed }).props) { piles++; assert.ok(near3[p.cell] >= 2, `seed ${seed}: ${near3[p.cell].toFixed(2)} from a house`); }
  assert.ok(piles >= 40, `a woodpile every seed (${piles})`);
});

test('URBANIZER U3 no cell cut off: a yard a prop splits in two keeps both halves reached - a gate opened where the cut-off half meets a way; every piece of the open ground after the shut its streets\' (mutants: the reach unrun; a gate opened into nothing)', () => {
  // grass rows 0-9 between columns 8 and 40, a house below it; a row of props across the yard's middle splits it
  const b0 = block({ ground: (r, c) => (r < 10 && c >= 8 && c <= 40 ? 2 : (r >> 2) === 8 ? 46 : 1), rects: [[10, 24, 8, 40, 18]], records: [] });
  const props = [];
  for (let r = 0; r < 10; r++) props.push({ x: 24 * 1.6 + 0.8, z: (63 - r) * 1.6 + 0.8 });
  b0.records = props;
  const g = fabricGrid(1, 1, () => b0), open = Uint8Array.from(g.town, (t, i) => (t && !g.built[i] ? 1 : 0));
  const plan = fabricPlan(g, { mains: false, seed: 3 });
  assert.equal(plan.counts.yards, 2, 'two halves, two yards');
  assert.deepEqual(cutOff(g, open, plan.shut), []);
  const { after, own } = reachOf(g, open, plan.shut);
  for (let i = 0; i < open.length; i++) if (open[i] && !plan.shut[i]) assert.equal(own[after[i]], 1, 'every open cell its streets\'');
  // and with the gates closed by hand, both halves are cut off
  const shut = Uint8Array.from(plan.shut);
  for (const e of plan.gates) shut[e.inner] = 1;
  assert.ok(cutOff(g, open, shut).length > 0);
  // one yard of two lobes: a house under the west one, a row of props down the middle to a cell above the dirt - the lobes
  // joined only along the yard's south fence there, its cells shut; the first gate in the east lobe's run onto the dirt,
  // and the west lobe takes one from the reach
  const lobes = block({ ground: (r, c) => (r < 8 && c < 20 ? 2 : 1), rects: [[8, 14, 0, 8, 18]], records: [1, 3, 5].map((r) => ({ x: 10 * 1.6 + 0.8, z: (63 - r) * 1.6 + 0.8 })) });
  const g2 = fabricGrid(1, 1, () => lobes), open2 = Uint8Array.from(g2.town, (t, i) => (t && !g2.built[i] ? 1 : 0));
  const p2 = fabricPlan(g2, { mains: false, seed: 1 });
  assert.equal(p2.counts.yards, 1, 'one yard');
  assert.deepEqual(cutOff(g2, open2, p2.shut), [], 'both lobes reached');
  assert.ok(p2.gates.length > FABRIC.gate, `a gate a lobe (${p2.gates.length} edges)`);
});

test('URBANIZER U3 the alleys and the dead ends: a lane between two houses no wider than its middle\'s FABRIC.side is an alley; a through-alley walled at its mouth farther from the middle one time in FABRIC.deadEvery, still reached from its other; an alley running out of the town walled there, a capital\'s never (outWalls) (mutants: the corridor read by its cell; the nearer mouth walled; the capital\'s plazas walled off)', () => {
  // two houses with a two-cell lane between them from the road (rows 32-35) north to the dirt (rows 0-9)
  const lane = () => block({ ground: (r) => ((r >> 2) === 8 ? 46 : 1), rects: [[10, 31, 4, 30, 18], [10, 31, 33, 60, 18]] });
  const g = fabricGrid(1, 1, lane), W = g.W, open = Uint8Array.from(g.town, (t, i) => (t && !g.built[i] ? 1 : 0));
  const laneCell = cellOf(0, 0, 20, 31, W);
  let walled = null, kept = null;
  for (let seed = 0; seed < 16 && !(walled && kept); seed++) {
    const p = fabricPlan(g, { mains: false, seed });
    assert.equal(p.kind[laneCell], K.alley);
    if (p.walls.length) walled ??= p; else kept ??= p;
  }
  assert.ok(walled && kept, 'some seeds wall it, some keep it through');
  assert.deepEqual(cutOff(g, open, walled.shut), []);
  for (const e of walled.walls) assert.equal(walled.kind[e.inner], K.alley);
  // the middle is the grid's: the north mouth (rows 0-9's dirt) and the south (the road) - the wall at the one farther
  const zs = walled.walls.map((e) => Math.floor(e.inner / W));
  const north = Math.min(...zs) > 42;   // the lane runs z 33 to 52 between its houses
  const mid = g.H / 2, far = Math.abs((north ? 53 : 32) - mid) >= Math.abs((north ? 32 : 53) - mid);
  assert.ok(far, 'the farther mouth walled');
  assert.ok(walled.dead.length >= 1, 'its end dressed');
  // an alley out of the town: the lane run to the north edge with no dirt beyond - walled there, but not in a capital
  const out = () => block({ ground: (r) => ((r >> 2) === 8 ? 46 : 1), rects: [[0, 31, 4, 30, 18], [0, 31, 33, 60, 18]] });
  const g2 = fabricGrid(1, 1, out);
  const p2 = fabricPlan(g2, { mains: false, seed: 1 });
  assert.ok(p2.walls.length > 0 && p2.walls.every((e) => e.outer < 0), 'walled at the town\'s edge');
  assert.equal(fabricPlan(g2, { mains: false, seed: 1, outWalls: false }).walls.length, 0, 'a capital\'s never');
});

test('URBANIZER U3 the steps: planSteps yields between its fields, its main streets, its yards, its dead ends and its walkers (a host breathes there) and returns the plan fabricPlan returns (mutants: a step lost)', () => {
  const g = town(), o = { ends: [[0, 30], [g.W, 30]], centre: [g.W / 2, 30], seed: 5 };
  const it = planSteps(g, o);
  let r = it.next(), n = 0;
  while (!r.done) { n++; r = it.next(); }
  assert.equal(n, 5);   // PIN MOVED (AUDIT PROP-GROUND): a breath before the street under the props (propGround)
  const p = fabricPlan(g, o);
  assert.deepEqual([...r.value.kind], [...p.kind]);
  assert.deepEqual(r.value.counts, p.counts);
  assert.equal(nearestOpen(g, Uint8Array.from(g.town, (t, i) => (t && !g.built[i] ? 1 : 0)), chamferField(g.built, g.W, g.H), 0, 30) % g.W, 0);
});

test('URBANIZER U3 with ARENA2: over the cities and the hamlets past the Bay as they are cloned (their outline\'s blocks), every plan cuts no cell off, fences only a yard\'s edge and never a building, its streets on open ground, a city\'s main streets from its sides to its middle (four on the most, two at the least - a side its outline left out shares another\'s end); a town planned in well under a second on the median - a wall clock on a shared machine, its slowest left to the doc (mutants: the reach unrun; a yard\'s fence on a house)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../../src/world/arenaLocations.js');
  const { outlineTownLocation } = await import('../../../src/world/townOutline.js');
  const { fabricBlockOf } = await import('../../../src/world/urban/townFabricStand.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const t = arenaTemplates(rows), io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  let towns = 0, yards = 0, dead = 0;
  const mains = [], took = [];
  for (const [kind, every] of [['city-state', 23], ['town', 61]]) {
    for (let j = 0; j < t[kind].length; j += every) {
      const tpl = t[kind][j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
      const loc = outlineTownLocation({ ...tpl, mapTableData: { ...tpl.mapTableData, mapId } }, io), ed = loc.exterior.exteriorData;
      const g = fabricGrid(ed.width, ed.height, (bx, by) => { const name = ed.blockNames[by * ed.width + bx]; return fabricBlockOf({ blockName: name, dfBlock: blocks.getBlockByName(blocks.checkName(name)) }); });
      const t0 = performance.now();
      const ends = kind === 'city-state' ? [[g.W / 2, 0], [g.W / 2, g.H], [0, g.H / 2], [g.W, g.H / 2]] : [[0, g.H / 2], [g.W, g.H / 2]];
      const plan = fabricPlan(g, { ends, seed: mapId });
      took.push(performance.now() - t0);
      const open = Uint8Array.from(g.town, (v, i) => (v && !g.built[i] ? 1 : 0));
      assert.deepEqual(cutOff(g, open, plan.shut), [], `${tpl.name}: no cell cut off`);
      for (const e of [...plan.fences, ...plan.gates]) { assert.equal(plan.kind[e.inner], K.yard, tpl.name); assert.ok(e.outer < 0 || !g.built[e.outer] || !g.house[e.outer], `${tpl.name}: a fence on a house`); }
      for (let i = 0; i < open.length; i++) if ([K.main, K.pave, K.side, K.alley, K.yard].includes(plan.kind[i])) assert.equal(open[i], 1, `${tpl.name}: a street on a building`);
      for (let i = 0; i < open.length; i++) if (plan.shut[i]) assert.equal(open[i], 1);
      if (kind === 'city-state') { assert.ok(plan.paths.length >= 2, `${tpl.name}: ${plan.paths.length} main streets`); mains.push(plan.paths.length); }
      for (const p of plan.paths) assert.equal(p[p.length - 1], plan.centre);
      yards += plan.counts.yards; dead += plan.counts.dead; towns++;
    }
  }
  assert.ok(towns >= 20, `${towns} towns`);
  assert.ok(yards > towns * 4, `${yards} yards`);
  assert.ok(dead > 0, `${dead} dead ends`);
  assert.ok(mains.reduce((a, b) => a + b, 0) >= 3.5 * mains.length, `the cities' main streets from their sides (${mains.join(' ')})`);
  const median = took.sort((a, b) => a - b)[took.length >> 1];
  assert.ok(median < 1000, `planned in ${median.toFixed(0)} ms on the median`);
});
