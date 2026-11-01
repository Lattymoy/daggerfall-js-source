// A GROWN TOWN'S OUTSKIRTS HUG IT AND FOLLOW ITS ROADS. Each
// sector starts at its town's square's own edge along its span, a street out and a setback; it reaches out as squarely as
// it faces a road leaving the town, a road's sector its whole depth; a road bars a building, never its cell, so houses line
// it; an end is left ragged. A Bay village and a Hammerfell town beside it (TAMRIEL-WIDE). Pins mutation-checked
// (tools/mutants/rmbc6.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { coreEdge, rectEdge, roadReach, layoutSettlement, TAU } from '../../../src/world/settlement/settlementLayout.js';
import { onRoad, dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { townGrowthJob, standTownGrowth, roadsOut, growthInput, growthBlocked } from '../../../src/world/settlement/townGrowth.js';
import { validateSettlement } from '../../../src/world/settlement/settlementContract.js';
import { distanceToSegment as distance } from '../../../src/world/settlement/settlementGeometry.js';
import { SAMPLE_M, sampleEnv } from '../../../src/world/settlement/settlementStand.js';
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

test('ORGANIC a core\'s edge along a span: at a corner the span holds, else at its end nearer one; never under the shorter half; a town wider than deep a rectangle (mutants: the corner, the ends, the rectangle)', () => {
  const square = [100, 100], long = [150, 50];
  assert.ok(Math.abs(coreEdge(square, 0.6, 1.0) - 100 * Math.SQRT2) < 1e-9, 'a span over the north-east corner');
  assert.ok(Math.abs(coreEdge(square, -0.1, 0.1) - 100 / Math.cos(0.1)) < 1e-9, 'a span over the north side\'s middle');
  assert.ok(Math.abs(coreEdge(square, 0.2, 0.5) - 100 / Math.cos(0.5)) < 1e-9, 'the end nearer the corner');
  assert.ok(Math.abs(coreEdge(square, TAU + 0.6, TAU + 1.0) - 100 * Math.SQRT2) < 1e-9, 'past a turn');
  for (let u = 0; u < TAU; u += 0.05) assert.ok(coreEdge(square, u, u + 0.05) >= 100 - 1e-9 && coreEdge(long, u, u + 0.05) >= 50 - 1e-9);
  assert.ok(Math.abs(coreEdge(long, -0.1, 0.1) - 50 / Math.cos(0.1)) < 1e-9, 'its long north side, half its depth away');
  assert.ok(Math.abs(coreEdge(long, TAU / 4 - 0.1, TAU / 4 + 0.1) - 150 / Math.cos(0.1)) < 1e-9, 'its short east side, half its width');
  const corner = Math.atan2(150, 50);
  assert.ok(Math.abs(coreEdge(long, corner - 0.01, corner + 0.01) - Math.hypot(150, 50)) < 1e-9, 'its own corner, not a square\'s');
  assert.ok(Math.abs(coreEdge(long, TAU / 2 - corner - 0.01, TAU / 2 - corner + 0.01) - Math.hypot(150, 50)) < 1e-9, 'the south-east one');
  assert.ok(Math.abs(rectEdge(long, TAU / 8) - 50 / Math.cos(TAU / 8)) < 1e-9 && rectEdge(long, TAU / 4) === 150, 'its edge at a bearing');
});

test('ORGANIC the outskirts hug the town: no cell on its square, and a side\'s cells nearer it than the circle round its corners (mutant: the hug)', () => {
  const g = town((P) => { for (let x = 0; x < T; x++) P[64 * T + x] = 1; });
  const { half, centre } = g.layout.core, band1 = g.layout.cells.filter((c) => c.k === 1);
  assert.ok(band1.length > 0);
  for (const c of band1) for (const [e, n] of c.poly) assert.ok(Math.abs(e - centre[0]) >= half[0] - 1e-6 || Math.abs(n - centre[1]) >= half[1] - 1e-6, `${c.id} off the square`);
  assert.ok(band1.some((c) => c.a < half[0] * 1.2 + 12), 'a side\'s cell within a street and a setback of the square');
  assert.ok(Math.min(...band1.map((c) => c.a)) < Math.hypot(half[0], half[1]), 'nearer than the corners\' circle');
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
  const ways = roadsOut(cross, [64 * SAMPLE_M, 64 * SAMPLE_M], [100, 100]).sort((a, b) => a - b);
  assert.equal(ways.length, 4);
  for (const [w, want] of ways.map((w, i) => [w, i * 90])) assert.ok(Math.abs(w - want) < 3 || Math.abs(w - want - 360) < 3, `${w} for ${want}`);
  const wide = new Uint8Array(T * T);   // a road five tiles wide leaving due east: its run's middle, not its first tile
  for (let x = 64; x < T; x++) for (let y = 62; y <= 66; y++) wide[y * T + x] = 1;
  const [east] = roadsOut(wide, [64.5 * SAMPLE_M, 64.5 * SAMPLE_M], [100, 100]);
  assert.ok(Math.abs(east - 90) < 2, `${east} for 90`);
  assert.deepEqual(roadsOut(new Uint8Array(T * T), [400, 400], [100, 100]), []);
  assert.deepEqual(roadsOut(new Uint8Array(T * T).fill(1), [400, 400], [100, 100]), []);
  assert.deepEqual(roadsOut(null, [400, 400], [100, 100]), []);
});

test('ORGANIC a road bars a plot, never a cell: a plot its bearing falls in, widened by a margin, wraps the turn (mutant: the wrap)', () => {
  assert.equal(onRoad([1.0], 0.9, 1.1, 0), true);
  assert.equal(onRoad([1.0], 1.2, 1.4, 0.05), false);
  assert.equal(onRoad([1.0], 1.2, 1.4, 0.25), true, 'the margin');
  assert.equal(onRoad([0.05], TAU - 0.1, TAU + 0.1, 0), true, 'across a turn');
  assert.equal(onRoad([TAU - 0.05], -0.1, 0.1, 0), true, 'and back');
});

test('ORGANIC a town grows along its roads: more buildings within a twelfth of a turn of a road than in as wide a span off them, houses either side, and a plot it drops renames none (a Hammerfell town; mutants: the reach, a plot numbered by those kept)', () => {
  const g = town((P) => { for (let y = 0; y < T; y++) P[y * T + 56] = 1; }, 'Hammerfell', 7002, 2);
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
  // a plot the road drops renames none after it: each left keeps its number, ground, building, key and height
  const blindPlot = new Map(blind.plots.map((x) => [x.id, x])), blindAt = new Map(blind.buildings.map((x) => [x.anchor, x]));
  for (const x of plan.plots) assert.deepEqual(x.poly, blindPlot.get(x.id)?.poly, `${x.id} where it was`);
  for (const b of plan.buildings) assert.deepEqual([b.key, b.footprint, b.storeys], [blindAt.get(b.anchor)?.key, blindAt.get(b.anchor)?.footprint, blindAt.get(b.anchor)?.storeys], `${b.anchor} as it was`);
  const roadE = 56.5 * SAMPLE_M;
  assert.ok(plan.buildings.some((b) => b.at[0] < roadE - 5) && plan.buildings.some((b) => b.at[0] > roadE + 5), 'on both sides of it');
});

test('ORGANIC the details: ends ragged but never bare where roads lead; a core\'s sectors at most 24, a ring\'s 16; a road\'s bearings within a turn; a district for each built sector, from its inner edge (mutants: the ragged end, the cap, the wrap, the district skip, its inner radius)', () => {
  const flat = new Float32Array(D * D).fill(60 / M), rect = { xMin: 48, xMax: 80, yMin: 48, yMax: 80 };
  let full = 0, all = 0;
  for (let id = 6000; id < 6010; id++) {
    const job = townGrowthJob({ mapTableData: { mapId: id, locationType: 2 }, name: 'R' }, 'IliacBay', 17);
    const L = layoutSettlement(growthInput(job, 200, 200, rect, 60, Array.from({ length: 24 }, (_, i) => i * 15)), sampleEnv(flat));
    for (const r of L.reachOf) { all++; if (r === L.bands) full++; assert.ok(r >= 1, 'a road\'s sector keeps a band'); }
  }
  assert.ok(full / all > 0.3 && full / all < 0.8, `${full} of ${all} road sectors their whole depth: ragged, not stubby`);
  const job = townGrowthJob({ mapTableData: { mapId: 6001, locationType: 2 }, name: 'R' }, 'IliacBay', 17);
  assert.equal(layoutSettlement({ ...growthInput(job, 200, 200, rect, 60), params: { sectors: 40, bands: 3 } }, sampleEnv(flat)).sectors, 24);
  assert.equal(layoutSettlement({ place: 9, origin: { px: 200, py: 200, east: 0, north: 0 }, seed: 1, archetype: 'fort', style: 'HighRock', site: { east: 400, north: 400, radius: 90 }, params: { sectors: 40 } }, sampleEnv(flat)).sectors, 16);
  const g = town((P) => { for (let y = 0; y < T; y++) P[y * T + 56] = 1; }, 'Hammerfell', 7002, 2);
  for (const c of g.layout.cells) for (const u of c.road ?? []) assert.ok(u >= 0 && u < TAU, `${c.id}'s road at ${u}`);
  const { plan } = dressSettlement(g.input, g.layout), L = g.layout;
  const built = L.reachOf.map((r, j) => [r, j]).filter(([r]) => r >= 1).map(([, j]) => `d${j}`);
  assert.deepEqual(plan.districts.map((d) => d.id).sort(), built.sort(), 'a district for each sector with a band');
  for (const d of plan.districts) {
    const j = Number(d.id.slice(1)), near = Math.min(...d.poly.map(([e, n]) => Math.hypot(e - L.c[0], n - L.c[1])));
    assert.ok(Math.abs(near - L.radii[j][0]) < 1, `${d.id} from its sector's inner edge: ${near} for ${L.radii[j][0]}`);
  }
});

test('ORGANIC the road circle and the bare town: a spur ending inside a street past the corners is no road out; a town whose land is all barred grows none (mutants: the circle\'s radius, the empty town)', () => {
  const half = 60, c = [64 * SAMPLE_M, 64 * SAMPLE_M];
  const spur = (to, [east, north] = [Math.SQRT1_2, Math.SQRT1_2]) => { const P = new Uint8Array(T * T); for (let r = 0; r <= to; r += 1) P[Math.floor((c[1] + r * north) / SAMPLE_M) * T + Math.floor((c[0] + r * east) / SAMPLE_M)] = 1; return P; };
  assert.deepEqual(roadsOut(spur(half * Math.SQRT2 + 4), c, [half, half]), [], 'a spur short of the circle');
  assert.equal(roadsOut(spur(half * Math.SQRT2 + 30), c, [half, half]).length, 1, 'one past it');
  // a town wider than deep: a street past its long side, not a circle round its far corners
  assert.deepEqual(roadsOut(spur(40 + 4, [0, 1]), c, [150, 40]), [], 'a spur short of its north side\'s street');
  assert.equal(roadsOut(spur(40 + 30, [0, 1]), c, [150, 40]).length, 1, 'one past it, though inside the circle round its corners');
  const s = new Float32Array(D * D).fill(60 / M), rect = { xMin: 56, xMax: 72, yMin: 56, yMax: 72 };
  const job = townGrowthJob({ mapTableData: { mapId: 7003, locationType: 2 }, name: 'Sunk' }, 'IliacBay', 17);
  assert.equal(standTownGrowth(200, 200, s, job, rect, { tilemap: new Uint8Array(T * T) }), null, 'all water: no outskirts');
});

test('ORGANIC a house stands a margin off its road: no wall within a metre and a half of a road tile, at a crossroads of a High Rock town (mutant: the margin)', () => {
  const g = town((P) => { for (let i = 0; i < T; i++) { P[i * T + 70] = 1; P[52 * T + i] = 1; } }, 'HighRock', 7006, 3);
  const tiles = [];
  for (let i = 0; i < T; i++) tiles.push([70, i], [i, 52]);
  const gap = ([e, n]) => Math.min(...tiles.map(([x, y]) => Math.hypot(Math.max(x * SAMPLE_M - e, 0, e - (x + 1) * SAMPLE_M), Math.max(y * SAMPLE_M - n, 0, n - (y + 1) * SAMPLE_M))));
  const { plan } = dressSettlement(g.input, g.layout);
  assert.ok(plan.buildings.length > 10);
  const clear = Math.min(...plan.buildings.flatMap((b) => b.footprint.map(gap)));
  assert.ok(clear > 1.5, `every wall a margin off the road: ${clear} m`);
});

test('ORGANIC a town wider than deep grows round its own rectangle: its core its rect and a street, every link from it a metre inside its town\'s level ground, the carve keeping that rectangle and no more (mutants: the core\'s sides, the link\'s start, the keep)', () => {
  const s = new Float32Array(D * D), rect = { xMin: 40, xMax: 88, yMin: 56, yMax: 72 };
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (60 + 0.1 * y * SAMPLE_M) / M;
  const mid = s[64 * D + 64];
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = mid;
  const job = townGrowthJob({ mapTableData: { mapId: 5011, locationType: 1 }, name: 'Longton' }, 'IliacBay', 17), before = Float32Array.from(s);
  const g = standTownGrowth(200, 200, s, job, rect, {});
  const { half, centre } = g.layout.core, street = g.input.core.clear;
  assert.deepEqual(half, [24 * SAMPLE_M + street, 8 * SAMPLE_M + street], 'its own sides, not a square on the longer');
  const [w, so, e, n] = [rect.xMin * SAMPLE_M, rect.yMin * SAMPLE_M, rect.xMax * SAMPLE_M, rect.yMax * SAMPLE_M];
  const out = dressSettlement(g.input, g.layout).plan.links.filter((l) => l.from === 'plaza');
  assert.ok(out.length > 8);
  for (const l of out) {
    const inside = Math.min(l.a[0] - w, e - l.a[0], l.a[1] - so, n - l.a[1]);
    assert.ok(Math.abs(inside - 1) < 0.02, `${l.id} from a metre inside the town: ${inside}`);
  }
  // north of the town past its street the land is carved for the outskirts; within the rectangle never
  const sample = (x, y) => [s[x * D + y], before[x * D + y]];
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
    const [ex, ny] = [x * SAMPLE_M, y * SAMPLE_M];
    if (Math.abs(ex - centre[0]) <= half[0] && Math.abs(ny - centre[1]) <= half[1]) assert.equal(...sample(x, y), `kept at ${x}, ${y}`);
  }
  assert.ok(g.layout.cells.some((c) => c.k === 1 && c.poly.some(([, cn]) => cn > centre[1] + half[1] && cn < centre[1] + half[1] + 20)), 'a first band hard by its long side');
  let carved = 0;
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) if (Math.abs(x * SAMPLE_M - centre[0]) < half[0] && Math.abs(y * SAMPLE_M - centre[1]) > half[1] && s[x * D + y] !== before[x * D + y]) carved++;
  assert.ok(carved > 20, 'the carve reaches in past its long side, where a square would keep it');
});

test('ORGANIC grown towns keep the contract: square, long and deep towns, no road, one, a crossroads, on level and sloping ground, in four styles (mutant: any break the host would stand unchecked)', () => {
  const rects = [[64, 64, 8, 8], [64, 64, 24, 8], [60, 66, 8, 20], [64, 60, 16, 16]];
  const roads = [() => {}, (P) => { for (let y = 0; y < T; y++) P[y * T + 58] = 1; }, (P) => { for (let i = 0; i < T; i++) { P[64 * T + i] = 1; P[i * T + 64] = 1; } }];
  let stood = 0;
  for (const [ri, [cx, cy, hx, hy]] of rects.entries()) for (const [ki, road] of roads.entries()) {
    const style = ['IliacBay', 'Hammerfell', 'Skyrim', 'BlackMarsh'][(ri + ki) % 4], slope = (ri + ki) % 2 ? 0.08 : 0;
    const s = new Float32Array(D * D), rect = { xMin: cx - hx, xMax: cx + hx, yMin: cy - hy, yMax: cy + hy };
    for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (60 + slope * x * SAMPLE_M + 2 * Math.sin(y / 9)) / M;
    for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = s[cx * D + cy];
    const paths = new Uint8Array(T * T);
    road(paths);
    const job = townGrowthJob({ mapTableData: { mapId: 7100 + ri * 3 + ki, locationType: ri % 3 }, name: 'Corpus' }, style, style === 'IliacBay' ? 17 : 63);
    const g = standTownGrowth(200, 200, s, job, rect, { paths });
    if (!g) continue;
    stood++;
    const { plan } = dressSettlement(g.input, g.layout);
    assert.deepEqual(validateSettlement(plan), [], `${style} ${hx}x${hy} road ${ki}`);
  }
  assert.ok(stood >= 10, `${stood} stood`);
});

test('ORGANIC a yard tree keeps off a road through its cell, its lane and every way between pads, at any sectors the editor allows (mutants: the road, the lane, the ways)', () => {
  // a straight road through a two-block village at every bearing a twelfth of a turn apart
  const rect = { xMin: 48, xMax: 80, yMin: 48, yMax: 80 }, flat = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) flat[x * D + y] = (60 + 6 * Math.sin(y / 9)) / M;
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) flat[x * D + y] = flat[64 * D + 64];
  const job = townGrowthJob({ mapTableData: { mapId: 5003, locationType: 2 }, name: 'Testford' }, 'IliacBay', 17);
  let crossed = 0;
  for (let deg = 0; deg < 180; deg += 30) {
    const paths = new Uint8Array(T * T), a = (deg * Math.PI) / 180;
    for (let t = -200; t <= 200; t += 0.25) { const x = Math.floor(64 + t * Math.sin(a)), y = Math.floor(64 + t * Math.cos(a)); if (x >= 0 && y >= 0 && x < T && y < T) paths[y * T + x] = 1; }
    const g = standTownGrowth(200, 200, Float32Array.from(flat), job, rect, { paths }), road = growthBlocked({ paths });
    crossed += g.layout.cells.filter((c) => c.road?.length).length;
    for (const t of dressSettlement(g.input, g.layout).plan.features.filter((f) => f.kind === 'tree')) assert.ok(!road(t.at[0], t.at[1]), `${deg}: ${t.id} off the road`);
  }
  assert.ok(crossed > 10, 'roads through its cells');
  for (const sectors of [12, 16]) {
    const input = { place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 1, archetype: 'oasis', style: 'IliacBay', site: { east: 400, north: 400, radius: 90 }, params: { sectors }, env: { heightAt: () => 50 } };
    const L = layoutSettlement(input, input.env), at = dressSettlement(input, L).plan;
    for (const t of at.features.filter((f) => f.kind === 'tree')) {
      for (const l of at.links) assert.ok(distance(t.at, l.a, l.b) >= l.width / 2 + 1, `${sectors}: ${t.id} off ${l.id}`);
      const cell = L.cells.find((c) => c.id === t.pad), v = Math.hypot(t.at[0] - L.c[0], t.at[1] - L.c[1]);
      let u = Math.atan2(t.at[0] - L.c[0], t.at[1] - L.c[1]);
      while (u < cell.u0 - 1e-6) u += TAU;
      assert.ok((u - cell.u0) * v >= L.gap / 2 + L.wl + 1 - 0.02, `${sectors}: ${t.id} off its lane`);
    }
  }
});

test('ORGANIC a grown town\'s first band is paved in to its core\'s edge, the street round the town at each sector\'s level, its ground carved so; a core\'s flight short enough for its own street (mutants: the apron, its corner, the core\'s flight)', () => {
  const g = town(() => {}), { half, centre } = g.layout.core, onEdge = (p) => Math.abs(Math.max(Math.abs(p[0] - centre[0]) / half[0], Math.abs(p[1] - centre[1]) / half[1]) - 1) < 1e-3;
  const firsts = g.layout.pads.filter((p) => g.layout.cells.find((c) => c.id === p.id)?.k === 1);
  assert.ok(firsts.length > 4);
  for (const pad of firsts) assert.ok(pad.poly.filter(onEdge).length >= 2, `${pad.id} reaches the core's edge`);
  const corner = firsts.find((pad) => pad.poly.some((p) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => Math.hypot(p[0] - centre[0] - a * half[0], p[1] - centre[1] - b * half[1]) < 0.02)));
  assert.ok(corner, 'one round a corner of the core, the corner among its points');
  const { plan } = dressSettlement(g.input, g.layout);
  assert.deepEqual(validateSettlement(plan), []);
  for (const l of plan.links.filter((x) => x.from === 'plaza')) {
    const rise = Math.abs(plan.pads.find((p) => p.id === l.to).y);
    assert.ok(rise <= 0.75 * (g.input.core.clear - 0.5) + 1e-6, `${l.id}: ${rise} m, a flight its street holds`);
  }
});
