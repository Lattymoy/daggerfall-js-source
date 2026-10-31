// FIELD BUGS 2026-10-29c (bible/01-Overview/bugs/Field-Bugs-2026-10-29c.md): synthetic pins for the laws
// that moved the ground (GROUND_LAW 5). ROAD-DRY: "Large portion of road in jabivia is also a body of water" - Basic
// Roads paves the sea and the ground there stood at the sea's own height (the freeware's causeways:
// test/systems/travel/rpt1026_world_causeway.test.js). ACROSS-EDGE: "List of Ports with broken" - a port's quays met a
// cliff where its pixel's edge stood over the sea (the freeware's ports: test/world/fb1029_ground_real.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryRoadHeights, roadCrossings, PAVING, ARM_EDGE } from '../../src/world/road/roadDry.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { CAPITAL_LAND, CAPITAL_SEA } from '../../src/world/terrain/capitalSea.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { townMeetOf, applyTownMeets, meetLiftAt, townMeetsAbout, MEET_REACH, MEET_MIN_M } from '../../src/world/terrain/townMeet.js';
import { meetsOf, gridGround, restrideGrid } from '../../src/world/terrain/terrainGen.js';
import { townStanding, shapeGrade, locationShapeField } from '../../src/world/terrain/terrainTiles.js';
import { generateSamples, ghostSampler, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW, MEET_FRAME_LAW, TOWN_FRAME_LAW } from '../../src/world/terrain/terrainSampler.js';
import { createLandforms, landformLiftField, townMeetMovedField } from '../../src/world/landforms.js';
import { pixelWaterSampler, bakeMeetsAt, meetClass, WATER_THRESHOLD, PIXEL_SEA, PIXEL_MIXED, PIXEL_LAND } from '../../src/world/deepWater/deepWatersBake.js';
import { rectsLookup, rectsFingerprint } from '../../src/world/deepWater/deepWatersBakeCache.js';
import { readFileSync } from 'node:fs';
import { recordFrame } from '../../src/scenes/groundFrameHost.js';
import { meetsTown, createTownMeets } from '../../src/scenes/townMeetsHost.js';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';

const H = 129, T = 128;
/** The sea everywhere: every byte 0, so the sampler holds every sample at its ocean clamp. */
const SEA_WOODS = {
  getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d),
  getLargeHeightMapValuesRange: (x, y, d) => new Uint8Array(d * 3 * d * 3),
  getHeightMapValue: () => 0,
};
const corners = (x, y) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];

test('ROAD-DRY the producer: a Bay pixel of open sea with Basic Roads\' road across it - every corner of every painted paving tile at CAPITAL_LAND in the stream\'s samples and in DFU\'s own (the classic pass), its arms\' edge samples where the road crosses into its neighbour, never where only this side draws it, and nothing inside the location\'s rect (mutants: the lift unwired; the classic pass unlifted; the rotation bits read; the edges unread; a one-sided arm lifted; the rect unread)', () => {
  const px = 100, py = 100, W = 1000, roads = new Uint8Array(W * 500), tracks = new Uint8Array(W * 500);
  const at = (x, y) => y * W + x;
  roads[at(px, py)] = DIR.N | DIR.S | DIR.E | DIR.NE;   // north and south across the edges, east half-drawn, a diagonal north-east
  roads[at(px, py - 1)] = DIR.S; roads[at(px, py + 1)] = DIR.N; roads[at(px + 1, py - 1)] = DIR.SW;
  const rect = { xMin: 58, xMax: 70, yMin: 20, yMax: 30 };
  const tilemap = new Uint8Array(T * T);
  const t = generatePixelTerrain({ woods: SEA_WOODS, px, py, tilemap, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks, smooth: true }, landform: true });
  assert.ok(t.beach, 'the classic pass ran');
  let paving = 0, rotated = 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    if (!t.paths[i] || !PAVING.has(tilemap[i] & 0x3f)) continue;
    if (x >= rect.xMin && x < rect.xMax && y >= rect.yMin && y < rect.yMax) continue;
    paving++;
    if (tilemap[i] & 0xc0) rotated++;
    for (const [cx, cy] of corners(x, y)) {
      if (cx === 0 || cy === 0 || cx === T || cy === T) continue;
      assert.ok(t.samples[cx * H + cy] >= CAPITAL_LAND, `the stream's corner (${cx}, ${cy}) of a paving tile over the sea's line`);
      assert.ok(t.beach[cx * H + cy] >= CAPITAL_LAND, `DFU's own corner (${cx}, ${cy}) too`);
    }
  }
  assert.ok(paving > 200 && rotated > 0, `${paving} paving tiles, ${rotated} of them turned`);
  for (const k of ARM_EDGE) {
    assert.equal(t.samples[k * H + T], CAPITAL_LAND, `the north arm's edge sample ${k} lifted`);
    assert.equal(t.samples[k * H], CAPITAL_LAND, `the south arm's edge sample ${k} lifted`);
    assert.equal(t.samples[T * H + k], CAPITAL_SEA, `the east arm is this side's alone: its edge sample ${k} the sea's`);
  }
  assert.equal(t.samples[64 * H + 25], CAPITAL_SEA, 'the road through the location\'s rect left to its blend');
});

test('ROAD-DRY the law: only a painted paving tile rises, turned or not, outside the rect and the ring, and a sample over the line never falls; a crossing needs both pixels\' bytes (mutants: the paths unread; the ring unread; a sample lowered)', () => {
  const S = new Float32Array(H * H).fill(CAPITAL_SEA), tilemap = new Uint8Array(T * T), paths = new Uint8Array(T * T);
  const put = (x, y, v, painted = true) => { tilemap[y * T + x] = v; paths[y * T + x] = painted ? 1 : 0; };
  put(10, 10, 46); put(20, 20, 47 + 64); put(30, 30, 46, false); put(40, 40, 11); put(50, 50, 46); put(60, 60, 55 + 128);
  const ring = new Uint8Array(T * T); ring[50 * T + 50] = 1;
  S[61 * H + 61] = CAPITAL_LAND + 0.01;
  dryRoadHeights(S, tilemap, paths, H, { xMin: 0, xMax: 0, yMin: 0, yMax: 0, ring });
  for (const [x, y] of [[10, 10], [20, 20], [60, 60]]) for (const [cx, cy] of corners(x, y)) assert.ok(S[cx * H + cy] >= CAPITAL_LAND, `(${x}, ${y})'s corner lifted`);
  for (const [x, y, why] of [[30, 30, 'a stamped tile the painter never wrote'], [40, 40, 'a track'], [50, 50, 'the ring']]) assert.equal(S[(x + 1) * H + y], CAPITAL_SEA, why);
  assert.equal(S[61 * H + 61], Math.fround(CAPITAL_LAND + 0.01), 'ground over the line kept');
  const bytes = new Map([['5,5', DIR.N | DIR.E], ['5,4', DIR.S], ['6,5', 0]]);
  assert.deepEqual(roadCrossings(5, 5, (x, y) => bytes.get(`${x},${y}`) ?? 0, () => true), { N: true, S: false, E: false, W: false });
  assert.deepEqual(roadCrossings(5, 5, (x, y) => bytes.get(`${x},${y}`) ?? 0, (x, y) => y !== 4), { N: false, S: false, E: false, W: false }, 'a neighbour off the Bay paints no paving');
});

// ── ACROSS-EDGE: the ground meets a town across its pixel's edge ─────────────────────────────────────────────────────

/** The print's cliff (tools/groundPrint.mjs GROUND_PRINT_MEET): a 6 x 6-block town on land 30 bytes high, the three rows
 *  of pixels north of it the sea's - its north edge a cliff its ground cannot meet at SHAPE_GRADE. */
const TX = 150, TY = 400;
function cliffWorld(land = 30) {
  const woods = new WoodsFile();
  woods.load(syntheticWoodsBytes());
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) woods.heightMapBuffer[(TY + dy) * MAP_WIDTH + TX + dx] = dy < 0 ? 0 : land;
  return woods;
}
/** A town of `blocks` x `blocks` blocks, a house on each block's middle - its rect and outline (the print's own). */
function townRect(blocks) {
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  const am = new Uint8Array(64 * 64);
  for (let r = 16; r < 48; r++) for (let c = 16; c < 48; c++) am[r * 64 + c] = 5;
  const rmb = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [] };
  const loc = { exterior: { exteriorData: { width: blocks, height: blocks, blockNames: Array(blocks * blocks).fill('T.RMB') } }, mapTableData: { mapId: 1, locationType: 2 } };
  const lo = 64 - blocks * 8 - 2, hi = 64 + blocks * 8 + 1;
  return { xMin: lo, xMax: hi, yMin: lo, yMax: hi, shape: locationShapeField(loc, () => rmb) };
}
const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const WOODLANDS = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(CLIMATES.Woodlands);
/** The stream's build of a pixel of the cliff: the town's own with its rect, `about` the town (or none), the row on or off. */
const buildAt = (woods, px, py, { rect = null, about = null, landform = true } = {}) => generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(T * T), climateType: CLIMATES.Woodlands, roads: null, sites: null, climates: WOODLANDS, landform, about, ...(rect ? { locationRect: { ...rect }, hasLocation: true } : {}) });

test('ACROSS-EDGE the law (townMeet.js): a town over a cliff raises its edge to SHAPE_GRADE times its distance to the town\'s stood samples under its level, the next pixel takes the cone off it at the grade, raise-only; a town whose ease meets its edge, and one a cone of MEET_REACH cannot meet whole, move nothing (mutants: the cone not the grade; the cone lowered; the side beyond moved; the least unread; the point law parted from the field\'s)', () => {
  const woods = cliffWorld(), rect = townRect(6), g = shapeGrade(H), least = MEET_MIN_M / M;
  const S = generateSamples(woods, TX, TY), m = townMeetOf(S, rect.shape, S), st = townStanding(S, rect.shape, S, H);
  assert.ok(m?.edges.N, 'the north edge over the sea is met');
  let raised = 0;
  for (let k = 0; k < H; k++) {
    const { R, E } = m.edges.N, want = Math.fround(st.target - g * st.stood[T * H + k]);
    assert.ok(R[k] >= E[k], 'raise-only');
    if (R[k] !== E[k]) { raised++; assert.equal(R[k], want, `edge sample ${k} at the town's level less the grade`); assert.ok(R[k] - E[k] > least); assert.ok(R[k] <= g * MEET_REACH); }
  }
  assert.ok(raised > 100, `${raised} edge samples raised`);
  // the north neighbour takes the cone: every sample the highest edge sample's height less the grade a sample, or its own
  const N0 = generateSamples(woods, TX, TY - 1), N = Float32Array.from(N0), meets = [{ px: TX, py: TY, meet: m }];
  assert.ok(applyTownMeets(N, TX, TY - 1, meets) > 1000);
  for (let x = 0; x < H; x += 4) for (let y = 0; y < H; y += 4) {
    let cone = -Infinity;
    for (let k = 0; k < H; k++) if (m.edges.N.R[k] !== m.edges.N.E[k]) cone = Math.max(cone, m.edges.N.R[k] - g * Math.hypot(x - k, y));
    assert.ok(Math.abs(N[x * H + y] - Math.max(N0[x * H + y], cone)) < 1e-6, `(${x}, ${y}) the cone's or its own`);
    assert.equal(meetLiftAt(TX, TY - 1, meets, x, y, N0[x * H + y]), N[x * H + y], 'the point law the field\'s');
  }
  for (let k = 0; k < H; k++) assert.equal(N[k * H], m.edges.N.R[k], 'the shared edge the raised one');
  assert.equal(townMeetOf(...(() => { const r = townRect(4), s = generateSamples(woods, TX, TY + 2); return [s, r.shape, s]; })()), null, 'a town on its land: its own ease meets its edges');
  const tall = cliffWorld(127), Sh = generateSamples(tall, TX, TY), mt = townMeetOf(Sh, rect.shape, Sh);
  assert.equal(mt?.edges.N ?? null, null, 'a mountain town over the sea: a cone of MEET_REACH cannot meet it whole - nothing moves');
  // a meet is kept while the ground it was read on stands, and read again on another
  const about = [{ px: TX, py: TY, shape: rect.shape }], low = cliffWorld(20);
  const a1 = townMeetsAbout(about, { woods, px: TX, py: TY - 1 });
  assert.equal(townMeetsAbout(about, { woods, px: TX, py: TY - 1 })[0], a1[0], 'kept');
  const a2 = townMeetsAbout(about, { woods: low, px: TX, py: TY - 1 });
  assert.notDeepEqual(a2[0].plain.edges.N.R, a1[0].plain.edges.N.R, 'another world, another meet');
});

test('ACROSS-EDGE the producers agree: the stream\'s town and its neighbour share their edge with the row on and off; the classic pass is DFU\'s own build; the ghost rows are the neighbour\'s met ground; the records\' lift is the two builds\' difference; the Deep Waters bake\'s sea is the stream\'s; the records\' move is the meets\' (mutants: the classic pass unmet; the ghost rows unmet; the lift unmet; the bake unmet; the sea pixel not sampled; the move unread)', () => {
  const woods = cliffWorld(), rect = townRect(6), about = [{ px: TX, py: TY, shape: rect.shape }];
  const on = { town: buildAt(woods, TX, TY, { rect, about }), north: buildAt(woods, TX, TY - 1, { about }) };
  const off = { town: buildAt(woods, TX, TY, { rect, about, landform: false }), north: buildAt(woods, TX, TY - 1, { about, landform: false }) };
  const bare = buildAt(woods, TX, TY - 1, { landform: false });
  let raised = 0, most = 0;
  for (let i = 0; i < H * H; i++) { const d = (off.north.samples[i] - bare.samples[i]) * M; if (d > 0) { raised++; most = Math.max(most, d); } }
  assert.ok(raised > 1000 && most > 50, `the sea north raised at ${raised} samples, ${most.toFixed(1)} m the most`);
  for (const b of [on, off]) for (let x = 0; x < H; x++) assert.equal(b.town.samples[x * H + T], b.north.samples[x * H], `the shared edge at ${x}: no seam`);
  for (let i = 0; i < H * H; i++) assert.ok(Math.abs(on.town.beach[i] - off.town.samples[i]) < 1e-6, 'the classic pass is DFU\'s own build');
  // the ghost rows past the town's north edge: the neighbour's met ground
  const lf = createLandforms({ woods, roads: null, sites: null, climates: WOODLANDS }), raw = ghostSampler(woods, TX, TY, H, lf);
  for (let x = 0; x < H; x += 8) assert.ok(Math.abs(meetLiftAt(TX, TY, on.town.meets, x, H, raw(x, H)) - on.north.samples[x * H + 1]) < 1e-6, `ghost row at ${x}`);
  assert.deepEqual(on.town.meets, meetsOf(townMeetsAbout(about, { woods, landforms: lf, px: TX, py: TY }), true), 'the build hands its meets on');
  const W3 = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, cell = 819.2 / T;
  for (const x of [20, 64, 100]) {   // the grid's normals on the north edge read the ghost row the neighbour's met ground
    const hu = meetLiftAt(TX, TY, on.town.meets, x, H, raw(x, H)) * W3, hd = on.town.samples[x * H + T - 1] * W3;
    const nx = (on.town.samples[(x - 1) * H + T] - on.town.samples[(x + 1) * H + T]) * W3, nz = hd - hu, l = Math.hypot(nx, 2 * cell, nz), o = (T * H + x) * 3;
    assert.ok(Math.abs(on.town.normals[o + 2] - nz / l) < 1e-5, `the normal at (${x}, ${T})`);
  }
  const again = restrideGrid({ ...gridGround({ px: TX, py: TY, samples: on.town.samples, meets: on.town.meets }), woods, stride: 1, landform: true, climates: WOODLANDS });
  assert.deepEqual(again.normals, on.town.normals, 'a promotion re-grids the meets\' ghost rows (gridGround)');
  // the records' lift: the row's difference, both pixels
  for (const [b, px, py, r] of [['town', TX, TY, rect], ['north', TX, TY - 1, null]]) {
    const f = landformLiftField(woods, px, py, r ? { ...r } : null, H, lf, about);
    for (let x = 0; x < H; x += 8) for (let y = 0; y < H; y += 8) assert.ok(Math.abs(f(x, y) - (on[b].samples[x * H + y] - off[b].samples[x * H + y]) * MAX_TERRAIN_HEIGHT) < 1e-3, `${b} (${x}, ${y}): the lift`);
  }
  // the bake: its sea the classic pass's at every sample, the town's and the sea's north
  const rows = [[TY * 1000 + TX, rect.xMin, rect.xMax, rect.yMin, rect.yMax, rect.shape, 1]], at = rectsLookup(rows), met = bakeMeetsAt(woods, at);
  for (const [b, px, py] of [['town', TX, TY], ['north', TX, TY - 1]]) {
    const w = pixelWaterSampler(woods, px, py, at(px, py), met(px, py));
    let differ = 0;
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) if (w.water(x, y) !== (off[b].samples[x * H + y] <= WATER_THRESHOLD)) differ++;
    assert.equal(differ, 0, `${b}: the bake's sea parts from the stream's at ${differ} samples`);
  }
  assert.equal(meetClass(PIXEL_SEA, met(TX, TY - 1)), PIXEL_MIXED, 'a sea pixel a meet reaches is sampled');
  assert.equal(meetClass(PIXEL_SEA, met(TX, TY - 2)), PIXEL_SEA, 'past the town\'s 3 x 3 none reaches');
  assert.equal(meetClass(PIXEL_LAND, met(TX, TY - 1)), PIXEL_LAND, 'a meet only raises: land stays land');
  // the records written before law 5: DFU's own ground moved by the meets
  const moved = townMeetMovedField(woods, TX, TY - 1, null, about);
  for (let x = 0; x < H; x += 8) for (let y = 0; y < H; y += 8) assert.ok(Math.abs(moved(x, y) - (off.north.samples[x * H + y] - bare.samples[x * H + y]) * MAX_TERRAIN_HEIGHT) < 1e-3);
  assert.equal(townMeetMovedField(woods, TX, TY + 3, null, about), null, 'no meet reaches past the 3 x 3');
});

test('ACROSS-EDGE the levels: a location stands where it stood - its level, outline and reach read before the meets, the town\'s and a neighbour\'s (mutants: the town\'s level read after; a neighbour\'s mean read after)', () => {
  const woods = cliffWorld(), rect = townRect(6), about = [{ px: TX, py: TY, shape: rect.shape }];
  for (const landform of [true, false]) {
    assert.equal(buildAt(woods, TX, TY, { rect, about, landform }).avg, buildAt(woods, TX, TY, { rect, landform }).avg, `the town's level (row ${landform})`);
    const camp = { xMin: 60, xMax: 68, yMin: 20, yMax: 28 };   // a location of DFU's own blend in the met sea: the pixel's mean
    assert.equal(buildAt(woods, TX, TY - 1, { rect: camp, about, landform }).avg, buildAt(woods, TX, TY - 1, { rect: camp, landform }).avg, `the neighbour's (row ${landform})`);
  }
});

test('ACROSS-EDGE the records\' frame (MEET_FRAME_LAW 5): a record written before it rides the meets\' move, its height over the ground kept, the row on or off; one stamped 5 takes none; before 4 the town\'s test reads the ground less the meets (mutants: the move dropped; taken by a stamped record; the town\'s test read on the met ground)', () => {
  assert.deepEqual([GROUND_FRAME_LAW, MEET_FRAME_LAW, TOWN_FRAME_LAW], [6, 5, 4]);   // PIN MOVED (RMB-CONTRACTS RMBC3): the stamp 6 - a settlement's carve (PADS_FRAME_LAW, test/world/settlement/rmbc3_ground.test.js)
  const ground = 500, off = 2.5, x = 12, meet = () => 30, town = () => 24, lift = (xx) => 100 + xx;
  const state = { compensation: [0, 7, 0], localFromWorld: (nx, nz) => [nx, nz] };
  for (const landform of [true, false]) {
    const L = landform ? lift(x) : 0, heightAt = () => ground + L + 7;
    const f = recordFrame({ landform, liftAt: lift, heightAt, state, bayAt: () => true, meetMovedAt: meet, townMovedAt: town });
    assert.equal(f.restandHeight(ground - meet() + off, x, 0, STREAMING_TERRAIN_SCALE, 4), ground + L + off, `law 4: the meets' move (row ${landform})`);
    assert.equal(f.restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, 5), ground + L + off, 'law 5: none');
    assert.equal(f.restandHeight(ground - meet() - town() + off, x, 0, STREAMING_TERRAIN_SCALE, 3), ground + L + off, 'law 3: the town\'s and the meets\'');
    assert.equal(f.restandHeight(ground - meet() + off, x, 0, STREAMING_TERRAIN_SCALE, 3), ground + L + off, 'law 3 written on the town\'s ground of law 4: the meets\' alone');
  }
});

test('ACROSS-EDGE the towns: a city, a hamlet or a village of MAPS.BSA meets its neighbours - never a spawn, a capital or a place with no exterior; the host walks the Bay\'s 3 x 3, its own outline handed (mutants: the types unread; a spawn met; the Bay unread)', () => {
  const town = (type, o = {}) => ({ exterior: { exteriorData: {} }, mapTableData: { locationType: type }, ...o });
  assert.deepEqual([0, 1, 2].map((t) => meetsTown(town(t))), [true, true, true]);
  assert.deepEqual([3, 4, 5, 7, 12].map((t) => meetsTown(town(t))), [false, false, false, false, false]);
  assert.equal(meetsTown(town(0, { spawned: true })), false);
  assert.equal(meetsTown(town(0, { capital: { flattenAt: {} } })), false);
  assert.equal(meetsTown({ mapTableData: { locationType: 0 } }), false);
  const shapes = new Map([['5,5', new Uint8Array(1)], ['6,6', new Uint8Array(2)]]), asked = [];
  const host = createTownMeets({ groundLocationAt: (x, y) => { asked.push(`${x},${y}`); return null; }, maps: {}, blocks: {} });
  assert.equal(host.about(5, 5, null), null, 'no town about');
  assert.equal(asked.length, 8, 'its eight neighbours asked, its own handed');
  const own = shapes.get('5,5');
  assert.deepEqual(host.about(5, 5, own), [{ px: 5, py: 5, shape: own }]);
  asked.length = 0; host.about(0, 0, null);
  assert.deepEqual(asked.sort(), ['0,1', '1,0', '1,1'], 'off the Bay: none asked');
});

test('ACROSS-EDGE the wiring (by source): every pixel\'s job asks the towns of its 3 x 3 with its own outline; the records\' frame asks the same host and the lift takes it; the bake\'s rows name the towns and its build and its pixels read one meet a town (mutants: the job unasked; the lift unasked; the rows unflagged)', () => {
  const src = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  assert.match(src('src/scenes/pixelBuild.js'), /about: townMeets\?\.about\(px, py, meetsTown\(groundLocation\) \? locationRect\?\.shape : null\) \?\? null,/);
  assert.match(src('src/scenes/pixelBuild.js'), /meets: meets \?\? null,/, 'the published pixel keeps its meets for a restride');
  // AUDIT FB1029 D-S2: the tiles are classed on the classic pass - it takes the drawn ground's meets beside DFU's own, so a
  // town met on the shaped ground alone leaves no water tile on ground its meet raised (Ageliret: 21 before)
  assert.match(src('src/world/terrain/terrainGen.js'), /if \(classic\) applyTownMeets\(classic, px, py, \[\.\.\.\(meetsOf\(meets, null\) \?\? \[\]\), \.\.\.\(landforms \? meetsOf\(meets, landforms\) \?\? \[\] : \[\]\)\]\);/, 'the classic pass takes the shaped meets too');
  const frame = src('src/scenes/groundFrameHost.js');
  assert.match(frame, /const townMeets = createTownMeets\(\{ groundLocationAt: _liftLocationAt, maps, blocks \}\);/);
  assert.match(frame, /field = landformLiftField\(host\.woods, px, py, rect, HEIGHTMAP_DIMENSION, landformsHere\(\{ before \}\), about\);/);
  assert.match(frame, /return \{ \.\.\.law, landformLiftAt, groundMovedAt, townMovedAt, meetMovedAt, padsMovedAt, townMeets \};/);   // PIN MOVED (RMB-CONTRACTS RMBC3): and a settlement's carve beside it
  assert.match(src('src/scenes/world.js'), /const \{ groundFrameHeight, groundFrameNative, restandHeight, scaleOf, townMeets \} = createGroundFrame\(\{/);
  assert.match(src('src/scenes/deepWater/deepWatersHost.js'), /deepWatersLocationRects\(woods, locations, maps, blocks, meetsTown\)/);
  assert.match(src('src/world/deepWater/deepWatersClient.js'), /rows\.push\(\[py \* 1000 \+ px, r\.xMin, r\.xMax, r\.yMin, r\.yMax, \.\.\.\(r\.shape \? \[r\.shape, \.\.\.\(met \? \[1\] : \[\]\)\] : \[\]\)\]\);/);
  assert.match(src('src/world/deepWater/deepWatersWorker.js'), /meetsAt = bakeMeetsAt\(woods, locationRectAt\);[^\n]*\n[^\n]*buildGlobal\(woods, \{ locationRectAt, meetsAt \}\)/);
  const at = rectsLookup([[5, 1, 2, 3, 4, new Uint8Array(1), 1], [6, 1, 2, 3, 4, new Uint8Array(1)]]);
  assert.equal(at(5, 0).meets, true, 'a town the meets read');
  assert.equal(at(6, 0).meets, undefined);
  assert.notEqual(rectsFingerprint([[5, 1, 2, 3, 4, new Uint8Array(1), 1]]), rectsFingerprint([[5, 1, 2, 3, 4, new Uint8Array(1)]]), 'the bake kept under its rows\' key');
});
