// RMB-CONTRACTS RMBC6 ORGANIC (bible/03-World/RMB-Contracts.md): A GROWN TOWN'S OUTSKIRTS HUG IT AND FOLLOW ITS ROADS. Each
// sector starts at its town's square's own edge along its span, a street out and a setback; it reaches out as squarely as
// it faces a road leaving the town, a road's sector its whole depth; a road bars a building, never its cell, so houses line
// it; an end is left ragged. A Bay village and a Hammerfell town beside it (TAMRIEL-WIDE). Pins mutation-checked
// (tools/mutants/rmbc6.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { coreEdge, roadReach, TAU } from '../../../src/world/settlement/settlementLayout.js';
import { onRoad, dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { townGrowthJob, standTownGrowth, roadsOut } from '../../../src/world/settlement/townGrowth.js';
import { SAMPLE_M } from '../../../src/world/settlement/settlementStand.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';

const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, D = 129, T = 128;
function town(roadsFn, style = 'IliacBay', mapId = 7001, blocks = 3) {
  const s = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (60 + 0.01 * x * SAMPLE_M + 3 * Math.sin(y / 11)) / M;
  const half = blocks * 8, rect = { xMin: 64 - half, xMax: 64 + half, yMin: 64 - half, yMax: 64 + half };
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = s[64 * D + 64];
  const paths = new Uint8Array(T * T);
  roadsFn(paths);
  const job = townGrowthJob({ mapTableData: { mapId, locationType: 2 }, name: 'Oakmere' }, style, style === 'IliacBay' ? 17 : 63);
  return standTownGrowth(200, 200, s, job, rect, { paths });
}
const bearing = (e, n, c) => { const u = Math.atan2(e - c[0], n - c[1]); return u < 0 ? u + TAU : u; };
const apart = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('ORGANIC a square\'s edge along a span: at a corner the span holds, else at its end nearer one; never under the side\'s half (mutants: the corner, the ends)', () => {
  assert.ok(Math.abs(coreEdge(100, 0.6, 1.0) - 100 * Math.SQRT2) < 1e-9, 'a span over the north-east corner');
  assert.ok(Math.abs(coreEdge(100, -0.1, 0.1) - 100 / Math.cos(0.1)) < 1e-9, 'a span over the north side\'s middle');
  assert.ok(Math.abs(coreEdge(100, 0.2, 0.5) - 100 / Math.cos(0.5)) < 1e-9, 'the end nearer the corner');
  assert.ok(Math.abs(coreEdge(100, TAU + 0.6, TAU + 1.0) - 100 * Math.SQRT2) < 1e-9, 'past a turn');
  for (let u = 0; u < TAU; u += 0.05) assert.ok(coreEdge(100, u, u + 0.05) >= 100 - 1e-9);
});

test('ORGANIC the outskirts hug the town: no cell on its square, and a side\'s cells nearer it than the circle round its corners (mutant: the hug)', () => {
  const g = town((P) => { for (let x = 0; x < T; x++) P[64 * T + x] = 1; });
  const { half, centre } = g.layout.core, band1 = g.layout.cells.filter((c) => c.k === 1);
  assert.ok(band1.length > 0);
  for (const c of band1) for (const [e, n] of c.poly) assert.ok(Math.max(Math.abs(e - centre[0]), Math.abs(n - centre[1])) >= half - 1e-6, `${c.id} off the square`);
  assert.ok(band1.some((c) => c.a < half * 1.2 + 12), 'a side\'s cell within a street and a setback of the square');
  assert.ok(Math.min(...band1.map((c) => c.a)) < half * Math.SQRT2, 'nearer than the corners\' circle');
});

test('ORGANIC a sector reaches out as squarely as it faces a road: a road\'s the whole depth, one a sixth of a turn off none; no road, about a band (mutants: the lean, the floor on a road)', () => {
  const edges = Array.from({ length: 12 }, (_, j) => [(j * TAU) / 12, ((j + 1) * TAU) / 12]), rng = () => 0.45;
  const reach = new Array(12).fill(0);
  roadReach(reach, edges, [15], 3, rng);   // a road at 15 degrees: sector 0's middle
  assert.equal(reach[0], 3, 'its road\'s sector');
  assert.equal(reach[6], 0, 'the far side');
  assert.ok(reach[1] < reach[0] && reach[1] >= reach[3]);
  const none = new Array(12).fill(0);
  roadReach(none, edges, [], 3, rng);
  assert.ok(none.every((r) => r === Math.round(3 * 0.4)), 'no road: about a band all round');
  const thin = new Array(12).fill(0);
  roadReach(thin, edges, [15], 1, () => 0);
  assert.equal(thin[0], 1, 'a road\'s sector is never left unbuilt, however thin the draw');
});

test('ORGANIC the roads out: a run of path tiles on the circle past the square one road at its middle; none, or every way, no road (mutant: the run\'s middle)', () => {
  const cross = new Uint8Array(T * T);
  for (let i = 0; i < T; i++) { cross[64 * T + i] = 1; cross[i * T + 64] = 1; }
  const ways = roadsOut(cross, [64 * SAMPLE_M, 64 * SAMPLE_M], 100).sort((a, b) => a - b);
  assert.equal(ways.length, 4);
  for (const [w, want] of ways.map((w, i) => [w, i * 90])) assert.ok(Math.abs(w - want) < 3 || Math.abs(w - want - 360) < 3, `${w} for ${want}`);
  const wide = new Uint8Array(T * T);   // a road five tiles wide leaving due east: its run's middle, not its first tile
  for (let x = 64; x < T; x++) for (let y = 62; y <= 66; y++) wide[y * T + x] = 1;
  const [east] = roadsOut(wide, [64.5 * SAMPLE_M, 64.5 * SAMPLE_M], 100);
  assert.ok(Math.abs(east - 90) < 2, `${east} for 90`);
  assert.deepEqual(roadsOut(new Uint8Array(T * T), [400, 400], 100), []);
  assert.deepEqual(roadsOut(new Uint8Array(T * T).fill(1), [400, 400], 100), []);
  assert.deepEqual(roadsOut(null, [400, 400], 100), []);
});

test('ORGANIC a road bars a plot, never a cell: a plot its bearing falls in, widened by a margin, wraps the turn (mutant: the wrap)', () => {
  assert.equal(onRoad([1.0], 0.9, 1.1, 0), true);
  assert.equal(onRoad([1.0], 1.2, 1.4, 0.05), false);
  assert.equal(onRoad([1.0], 1.2, 1.4, 0.25), true, 'the margin');
  assert.equal(onRoad([0.05], TAU - 0.1, TAU + 0.1, 0), true, 'across a turn');
  assert.equal(onRoad([TAU - 0.05], -0.1, 0.1, 0), true, 'and back');
});

test('ORGANIC a town grows along its roads: more buildings within a twelfth of a turn of a road than in as wide a span off them, houses either side, and a plot it drops renames none (a Hammerfell town; mutants: the reach, a plot numbered by those kept)', () => {
  const g = town((P) => { for (let y = 0; y < T; y++) P[y * T + 56] = 1; }, 'Hammerfell', 7002, 2);   // PIN MOVED (AUDIT): column 60 dropped no plot before another
  const { plan } = dressSettlement(g.input, g.layout), c = g.layout.core.centre, roads = g.input.roads.map((d) => (d * Math.PI) / 180);
  assert.equal(roads.length, 2, 'the road leaves north and south');
  const near = plan.buildings.filter((b) => roads.some((w) => apart(bearing(b.at[0], b.at[1], c), w) < TAU / 12)).length;
  const off = plan.buildings.filter((b) => roads.every((w) => apart(bearing(b.at[0], b.at[1], c), w) > TAU / 6)).length;
  assert.ok(near > off * 1.5, `${near} along the road, ${off} away from it`);
  // the road takes plots: dressed with its bearings forgotten, the crossed cells hold more
  const blind = dressSettlement(g.input, { ...g.layout, cells: g.layout.cells.map(({ road, ...c }) => c) }).plan;
  const crossed = new Set(g.layout.cells.filter((x) => x.road?.length).map((x) => x.id));
  assert.ok(crossed.size > 0);
  assert.ok(plan.plots.filter((x) => crossed.has(x.pad)).length < blind.plots.filter((x) => crossed.has(x.pad)).length, 'fewer plots where the road runs');
  // a plot the road drops renames none after it: each left keeps its number, ground, building, key and height (RD-19)
  const blindPlot = new Map(blind.plots.map((x) => [x.id, x])), blindAt = new Map(blind.buildings.map((x) => [x.anchor, x]));
  for (const x of plan.plots) assert.deepEqual(x.poly, blindPlot.get(x.id)?.poly, `${x.id} where it was`);
  for (const b of plan.buildings) assert.deepEqual([b.key, b.footprint, b.storeys], [blindAt.get(b.anchor)?.key, blindAt.get(b.anchor)?.footprint, blindAt.get(b.anchor)?.storeys], `${b.anchor} as it was`);
  const roadE = 56.5 * SAMPLE_M;
  assert.ok(plan.buildings.some((b) => b.at[0] < roadE - 5) && plan.buildings.some((b) => b.at[0] > roadE + 5), 'on both sides of it');
});
