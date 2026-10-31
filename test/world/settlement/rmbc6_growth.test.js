// RMB-CONTRACTS RMBC6 (bible/03-World/RMB-Contracts.md RD-18, RD-19): A TOWN GROWS. Every city, town and village keeps its
// legacy core whole and grows outskirts in rings round it, on the land its pixel leaves - never on a road, its own ground,
// a camp or water, never near its pixel's edge - carved round a core the carve never touches; the host dresses the same
// layout from the input the worker handed back, in a model run of its own. A Bay village and a Hammerfell town beside it
// (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/rmbc6.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { townGrowthJob, growthInput, growthBlocked, standTownGrowth, growthClearing, grownMovedAt, GROWTH_MARGIN, GROWTH_TYPES } from '../../../src/world/settlement/townGrowth.js';
import { growthJobAt } from '../../../src/world/settlement/townGrowthJob.js';
import { dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { validateSettlement, keyBandOf } from '../../../src/world/settlement/settlementContract.js';
import { pointInRing, edgeDistance } from '../../../src/world/settlement/settlementGeometry.js';
import { PAD_REACH, GROUND_EASE } from '../../../src/world/settlement/settlementGround.js';
import { SAMPLE_M } from '../../../src/world/settlement/settlementStand.js';
import { settlementGroundAt } from '../../../src/world/settlement/settlementGround.js';
import { SETTLEMENT_ARCHETYPES } from '../../../src/world/settlement/settlementStyles.js';
import { standSettlement, GROWTH_SLOT_FIRST } from '../../../src/scenes/settlementHost.js';
import { buildingModelId, groundModelId } from '../../../src/world/settlement/settlementModels.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';

const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, D = 129, T = 128;
const HAMMERFELL = [1150, 380];
/** A pixel's ground: `slope` metres a metre east, a gentle swell north; the town's rect flattened to its middle. */
function ground(slope, rect) {
  const s = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (60 + slope * x * SAMPLE_M + 6 * Math.sin(y / 9)) / M;
  const mid = s[64 * D + 64];
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = mid;
  return s;
}
const rectOf = (blocks) => ({ xMin: 64 - blocks * 8, xMax: 64 + blocks * 8, yMin: 64 - blocks * 8, yMax: 64 + blocks * 8 });
const village = (mapId, style, region = 17) => townGrowthJob({ mapTableData: { mapId, locationType: 2 }, name: 'Testford' }, style, region);

test('RMBC6 the job: a city, town or village grows; a farm, a dungeon, a capital does not; past the Bay its province\'s style and region (mutants: the types, the capital)', () => {
  assert.deepEqual(GROWTH_TYPES, [0, 1, 2]);
  for (const t of [0, 1, 2]) assert.ok(townGrowthJob({ mapTableData: { mapId: 9, locationType: t }, name: 'A' }, 'IliacBay', 1));
  for (const t of [3, 4, 5, 6, 7, 8, 12]) assert.equal(townGrowthJob({ mapTableData: { mapId: 9, locationType: t }, name: 'A' }, 'IliacBay', 1), null, `type ${t}`);
  assert.equal(townGrowthJob({ mapTableData: { mapId: 9, locationType: 0 }, name: 'A', capital: {} }, 'IliacBay', 1), null, 'a capital spans pixels');
  const past = growthJobAt({ mapTableData: { mapId: 77, locationType: 2 }, name: 'Sentinel Rise' }, ...HAMMERFELL);
  assert.equal(past.style, 'Hammerfell');
  assert.equal(past.regionIndex, 63, 'Hammerfell\'s region, never a Bay region');
  assert.equal(growthJobAt({ mapTableData: { mapId: 77, locationType: 2 }, name: 'Bayside', regionIndex: 17 }, 200, 200).regionIndex, 17);
  assert.ok(!SETTLEMENT_ARCHETYPES.village.core && SETTLEMENT_ARCHETYPES.outskirts.core, 'the outskirts stand round a core alone');
});

test('RMBC6 the outskirts keep the contract round a core that never moves: its pad legacy, at the datum, no building on it, the way in its; Valenwood\'s decks on a slope too (mutants: the core\'s fixed give, the datum, the gate, a deck too steep kept)', () => {
  for (const [job, slope, blocks] of [[village(5001, 'IliacBay'), 0, 4], [village(5002, 'Hammerfell', 63), 0.04, 2], [village(5003, 'Valenwood', 67), 0.08, 2]]) {
    const rect = rectOf(blocks), g = standTownGrowth(...HAMMERFELL, ground(slope, rect), job, rect, {});
    assert.ok(g, job.style);
    const { plan, report } = dressSettlement(g.input, g.layout);
    assert.deepEqual(validateSettlement(plan), [], job.style);
    assert.ok(report.ok, `${job.style}: ${JSON.stringify(report.fit)}`);
    const core = plan.pads.find((p) => p.legacy);
    assert.equal(core.id, 'plaza');
    assert.equal(core.y, 0, 'the town stands at the datum');
    assert.equal(plan.pads.filter((p) => p.legacy).length, 1);
    assert.ok(plan.buildings.every((b) => b.pad !== 'plaza'), 'no building on the town\'s own ground');
    assert.equal(plan.gates[0].pad, 'plaza', 'the outskirts\' way in is their town');
    assert.ok(!plan.features.some((f) => f.pad === 'plaza'), 'no well in the town\'s square');
    assert.ok(plan.buildings.length >= 3 && plan.buildings.every((b) => keyBandOf(b.key) === 'minted'));
    for (const b of plan.buildings) for (const [e, n] of b.footprint) assert.ok(!pointInRing([e, n], core.poly), 'outside the core');
    if (job.style === 'Valenwood') assert.ok(plan.pads.some((p) => p.base === 'raised'), 'its decks stand where their links hold');
  }
});

test('RMBC6 barred ground: no cell on the town\'s own ground, a camp or water, none within the margin of the pixel\'s edge; a road bars a building, never its cell (mutants: the bounds, the barred sweep, each bar, the road soft)', () => {
  const rect = rectOf(3), paths = new Uint8Array(T * T), mask = new Uint8Array(T * T), tilemap = new Uint8Array(T * T).fill(2);
  for (let x = 0; x < T; x++) paths[64 * T + x] = 1;   // a road across, north 64
  for (let y = 0; y < 30; y++) for (let x = 90; x < 128; x++) tilemap[y * T + x] = 0;   // a lake in the south-east
  for (let y = 70; y < 90; y++) for (let x = 20; x < 40; x++) mask[y * T + x] = 1;   // the town's fields
  const camps = [{ xMin: 90, xMax: 110, yMin: 95, yMax: 115 }];
  const g = standTownGrowth(200, 200, ground(0, rect), village(5003, 'IliacBay'), rect, { paths, mask, tilemap, camps });
  assert.ok(g);
  const hard = growthBlocked({ mask, tilemap, camps }), road = growthBlocked({ paths }), far = T * SAMPLE_M - GROWTH_MARGIN;
  for (const pad of g.layout.pads.filter((p) => !p.legacy)) {
    for (const [e, n] of pad.poly) assert.ok(e >= GROWTH_MARGIN && e <= far && n >= GROWTH_MARGIN && n <= far, `${pad.id} inside the margin`);
    for (let e = 0; e < T * SAMPLE_M; e += 3) for (let n = 0; n < T * SAMPLE_M; n += 3) {
      if (pointInRing([e, n], pad.poly)) assert.ok(!hard(e, n), `${pad.id} on barred ground at ${e}, ${n}`);
    }
  }
  const { plan } = dressSettlement(g.input, g.layout);
  for (const b of plan.buildings) for (let t = 0; t <= 1; t += 0.125) for (let s = 0; s <= 1; s += 0.125) {
    const [a, b1, c, d] = b.footprint, e = (a[0] * (1 - t) + b1[0] * t) * (1 - s) + (d[0] * (1 - t) + c[0] * t) * s, n = (a[1] * (1 - t) + b1[1] * t) * (1 - s) + (d[1] * (1 - t) + c[1] * t) * s;
    assert.ok(!road(e, n), `${b.anchor} on the road`);
  }
  const crossed = g.layout.cells.filter((c) => c.road?.length);
  assert.ok(crossed.length > 0, 'the road crosses cells it keeps');
  assert.ok(plan.buildings.some((b) => crossed.some((c) => c.id === b.pad)), 'and houses stand beside it in them');
  assert.ok(hard(10, 64 * SAMPLE_M + 1) === false && road(10, 64 * SAMPLE_M + 1), 'a road is no hard bar');
  assert.ok(hard(100 * SAMPLE_M, 10) && hard(25 * SAMPLE_M, 75 * SAMPLE_M) && hard(95 * SAMPLE_M, 100 * SAMPLE_M));
  assert.ok(!hard(30 * SAMPLE_M, 30 * SAMPLE_M));
  // a town by its pixel's west edge: its west cells would cross the margin, and are not built
  const west = { xMin: 14, xMax: 38, yMin: 52, yMax: 76 }, w = standTownGrowth(200, 200, ground(0, west), village(5006, 'IliacBay'), west, {});
  assert.ok(w && w.layout.pads.some((p) => !p.legacy));
  for (const pad of w.layout.pads.filter((p) => !p.legacy)) for (const [e] of pad.poly) assert.ok(e >= GROWTH_MARGIN, `${pad.id} past the west margin`);
});

test('RMBC6 the carve: the core and the town\'s own ground never move, nor the pixel\'s edge; what moved is handed back as a record\'s frame reads it (mutants: the keep, the moved field\'s units, a legacy pad carved)', () => {
  const rect = rectOf(3), job = village(5004, 'Skyrim', 64);
  // the town's own ground laid in the ease beside an outskirts pad, touching none: the carve would move it, and must not
  const first = standTownGrowth(200, 200, ground(0.05, rect), job, rect, {}), mask = new Uint8Array(T * T);
  const near = first.layout.pads.filter((p) => !p.legacy);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const c = [(x + 0.5) * SAMPLE_M, (y + 0.5) * SAMPLE_M], d = Math.min(...near.map((p) => (pointInRing(c, p.poly) ? 0 : edgeDistance(c, p.poly))));
    const corners = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].map(([a, b]) => [a * SAMPLE_M, b * SAMPLE_M]);
    if (d > PAD_REACH + 4 && d < PAD_REACH + GROUND_EASE - 4 && !corners.some((q) => near.some((p) => pointInRing(q, p.poly)))) mask[y * T + x] = 1;
  }
  assert.ok(mask.some(Boolean), 'ground in the ease to keep');
  const before = ground(0.05, rect), after = Float32Array.from(before);
  const g = standTownGrowth(200, 200, after, job, rect, { mask });
  assert.deepEqual(g.layout.pads.map((p) => p.id), first.layout.pads.map((p) => p.id), 'the mask bars no cell');
  assert.ok(g);
  const half = g.layout.core.half, [ce, cn] = g.layout.core.centre;
  let moved = 0;
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
    const i = x * D + y, e = x * SAMPLE_M, n = y * SAMPLE_M;
    const edge = x === 0 || y === 0 || x === D - 1 || y === D - 1, inCore = Math.abs(e - ce) <= half && Math.abs(n - cn) <= half;
    const onMask = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < T && y + dy < T && mask[(y + dy) * T + x + dx]);
    if (edge || inCore || onMask) assert.equal(after[i], before[i], `kept at ${x}, ${y}`);
    if (after[i] !== before[i]) {
      moved++;
      assert.ok(Math.abs(g.moved[i] - (after[i] - before[i]) * MAX_TERRAIN_HEIGHT) < 1e-3, 'kernel units');
    }
  }
  assert.ok(moved > 100, 'the outskirts carved');
  assert.equal(settlementGroundAt(g.layout.pads, g.layout.datum, ce, cn, 123), null, 'a legacy pad asks nothing of its ground');
  const corner = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [ce + a * (half - 1), cn + b * (half - 1)])
    .find((q) => g.layout.pads.some((p) => !p.legacy && edgeDistance(q, p.poly) < PAD_REACH));
  assert.ok(corner, 'a core corner beside its outskirts');
  assert.equal(settlementGroundAt(g.layout.pads, g.layout.datum, corner[0], corner[1], 123), null, 'not even beside its outskirts');
  const out = g.layout.pads.find((p) => !p.legacy && p.base === 'cut'), [oe, on] = out.poly.reduce(([a, b], [e, n]) => [a + e / out.poly.length, b + n / out.poly.length], [0, 0]);
  assert.equal(settlementGroundAt(g.layout.pads, g.layout.datum, oe, on, 123), g.layout.datum + out.y - 0.2, 'an outskirts pad its paving\'s ground');
  const k = g.moved.findIndex((v) => Math.abs(v) > 0.5), kx = Math.floor(k / D), ky = k % D, cell = SAMPLE_M;
  assert.ok(Math.abs(grownMovedAt(g, [0, 0, 0], kx * cell, ky * cell, cell) - g.moved[k] * STREAMING_TERRAIN_SCALE) < 1e-4, 'read where it moved, metres');
  assert.equal(grownMovedAt({ growth: false, moved: g.moved }, [0, 0, 0], kx * cell, ky * cell, cell), 0);
  const clear = growthClearing({ ...rect, shape: {} }, g);
  assert.ok(clear.xMin <= g.rect.xMin && clear.xMax >= g.rect.xMax && clear.yMin <= rect.yMin && !('shape' in clear), 'the trees clear town and outskirts as one');
  assert.equal(growthClearing(rect, null), rect);
});

test('RMBC6 one layout, every client: the same job, rect and ground lay the same plan twice, and the host dresses it in a run of its own (mutants: the slot\'s run, the growth\'s input)', () => {
  const rect = rectOf(2), job = village(5005, 'HighRock', 62);
  const a = standTownGrowth(200, 200, ground(0.02, rect), job, rect, {}), b = standTownGrowth(200, 200, ground(0.02, rect), job, rect, {});
  assert.deepEqual(a.layout, b.layout);
  assert.deepEqual(growthInput(job, 200, 200, rect, a.input.core.y), a.input);
  const p1 = dressSettlement(a.input, a.layout).plan, p2 = dressSettlement(b.input, b.layout).plan;
  assert.deepEqual(p1.buildings.map((x) => x.key), p2.buildings.map((x) => x.key), 'the keys a ledger mints in order');
  const made = standSettlement({ px: 200, py: 200, settlement: a }, null, GROWTH_SLOT_FIRST + 3);
  assert.equal(made.groundId, groundModelId(GROWTH_SLOT_FIRST + 3));
  assert.equal(made.pieces[0].id, buildingModelId(GROWTH_SLOT_FIRST + 3, 0));
  assert.deepEqual([made.pieces[0].record.townMapId, made.pieces[0].record.townName, made.pieces[0].record.regionIndex], [5005, 'Testford', 62], 'its doors are its town\'s');
  assert.equal(standSettlement({ px: 200, py: 200, settlement: a }, null, 3), null, 'a grown town never takes a published row\'s run');
});

test('RMBC6 the wiring (by source): the kernel grows a location\'s pixel, the build hands it its town, the trees clear both, the frame reads the carve (mutants: each seam)', () => {
  const read = (f) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');
  const gen = read('world/terrain/terrainGen.js');
  assert.match(gen, /const settlement = hasLocation \? \(growth && locationRect \? standTownGrowth\(px, py, samples, growth, locationRect, \{ paths, tilemap, camps \}\) : null\) : standSettlementGround\(px, py, samples, bare\);/);   // PIN MOVED (RMBC9): a published settlement laid on the land with no road
  assert.match(gen, /locationRect: wodResult\?\.locationRect \?\? growthClearing\(locationRect, settlement\) \?\? settlement\?\.rect \?\? null,/);
  assert.match(read('scenes/pixelBuild.js'), /\n {6}growth: growthJobAt\(groundLocation, px, py\),/);
  assert.match(read('scenes/groundFrameHost.js'), /if \(liftRectAt\(px, py\)\) return grownMovedAt\(built\.get\(`\$\{px\},\$\{py\}`\)\?\.settlement, host\.state\.pixelTranslation\(px, py\), x, z, heightCell\);/);
  assert.match(read('scenes/settlementHost.js'), /standSettlement\(p, blocksFile\(\), p\.settlement\.growth \? nextGrowthSlot\(\) : -1\)/);
});
