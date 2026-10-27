// RUMARE-WATER (2026-10-26, the owner: "City lake needs to be apart of the overall water structure. Not just a flattened
// land. Make this work and be detailed about it"; bible/03-World/Tamriel.md RUMARE-WATER): the Imperial City's lake is the
// sea's where its canal stands - the plan's mouth through its far shore to the canal (world/imperialCity.js
// IMPERIAL.mouth), the city's water law (world/rumareWaters.js), a capital at the sea's ground - its water the sea's own
// height, its land a freeboard over it (world/terrain/capitalSea.js, world/terrain/terrainGen.js) - the land let down about
// it (world/tamriel/tamrielGround.js), its harbour the Waterfront (world/tamrielCapitals.js), the continent's Deep Waters
// bake flooding it from the canal (world/tamrielWatersBake.js), and the sea's ways at the map's scale sailing it (the lanes,
// the voyages' sea, the ports' shore). Pinned on synthetic pictures, and on the player's own files where ARENA2_PATH names
// them.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { IMPERIAL, IMPERIAL_SPAN, imperialLand, imperialTile } from '../../src/world/imperialCity.js';
import { WATERFRONT_CANAL } from '../../src/world/tamriel/tamrielGeography.js';
import { setTamrielTrace, waterfrontCanal, IMPERIAL_ID } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { rumareCity, rumareSeaAt, rumareSeaPixel, rumareSlice, rumareMouthPixel, rumareBasin, rumareLandHeight, rumareSliceRect, RUMARE_BASIN } from '../../src/world/rumareWaters.js';
import { capitalSeaGround, CAPITAL_LAND, CAPITAL_SEA, CAPITAL_FREEBOARD } from '../../src/world/terrain/capitalSea.js';
import { tamrielHeightByte, tamrielLargeMap, dropGroundCache, groundWoods, SHORE_BYTE } from '../../src/world/tamriel/tamrielGround.js';
import { GROUND_ROLL_VERSION } from '../../src/world/tamrielRoads.js';
import { CAPITALS, CAPITAL_RIM_TILES, capitalHarbourSlice, capitalCanalOpen, synthesizeCapitalLocation } from '../../src/world/tamrielCapitals.js';
import { TamrielWatersBake, rumareWaterSampler } from '../../src/world/tamrielWatersBake.js';
import { worldLaneWater } from '../../src/scenes/naval/worldLanes.js';
import { laneNetwork, LANE_NEIGHBOURS } from '../../src/systems/naval/seaLanes.js';
import { beyondPorts, CANAL_PORT_NEIGHBOURS, CANAL_PORT_REACH_PX } from '../../src/world/worldWide/worldPorts.js';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { routeGround, planSeaLanes } from '../../src/systems/travel/travelRoute.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { CLIMATES, LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { hostText } from '../hostText.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });

/** The freeware's fit over a 320 x 200 picture of the Imperial Province's land, its water every row from `row` down -
 *  row 101 the canal's (2068-2070 by 671-681 under the city's span at (2069, 658)). */
function lakeBelow(row = 101) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 0; y < row; y++) for (let x = 0; x < w; x++) { land[y * w + x] = 1; province[y * w + x] = IMPERIAL_ID; }
  setTamrielTrace({ w, h, land, province });
  setTamrielFit(FIT);
}
/** A Bay point in the city's metres off its centre pixel (2069, 658). */
const at = (x, z) => [2069.5 + x / 819.2, 658.5 + z / 819.2];

test('RUMARE-WATER the plan\'s mouth: the lake south through its far shore to the span\'s edge, the Waterfront canal\'s width - water to the plan\'s land law and its tiles; its sides, the far shore beside it and the Waterfront\'s quay before it land (mutants: the mouth uncut; cut the plan\'s width round; cut north)', () => {
  assert.ok(Math.abs(IMPERIAL.mouth - (WATERFRONT_CANAL.half + 0.5) * 819.2) < 1e-9, 'the canal\'s three pixels');
  const H = (IMPERIAL_SPAN * 819.2) / 2;
  for (const z of [IMPERIAL.lake + 1, IMPERIAL.lake + 120, H - 1]) {
    for (const x of [0, -1200, 1200]) { assert.equal(imperialLand(x, z), false, `(${x}, ${z}) the mouth's`); assert.equal(imperialTile(x, z), 0); }
    for (const x of [-1240, 1240, 3000]) assert.equal(imperialLand(x, z), true, `(${x}, ${z}) the far shore beside it`);
  }
  assert.equal(imperialLand(0, -(IMPERIAL.lake + 120)), true, 'north of the city: the far shore whole');
  assert.equal(imperialLand(IMPERIAL.lake + 120, 0), true, 'east: whole');
  assert.equal(imperialLand(0, IMPERIAL.waterfront.r1 - 10), true, 'the Waterfront\'s quay before it, land');
});

test('RUMARE-WATER the city\'s law: its sea the plan\'s no-land on its span where its canal stands - the lake round the isle and the mouth; the isle, the far shore and the land past the span not; no canal, no city (mutants: the law the land\'s; the span unbounded; the canal unasked)', () => {
  lakeBelow();
  assert.deepEqual(rumareCity(), { cx: 2069, cy: 658 });
  assert.equal(rumareSeaAt(...at(0, 9000)), true, 'the lake south of the isle');
  assert.equal(rumareSeaAt(...at(-9000, 0)), true, 'west');
  assert.equal(rumareSeaAt(...at(0, -9000)), true, 'north');
  assert.equal(rumareSeaAt(...at(0, 10200)), true, 'the mouth');
  assert.equal(rumareSeaAt(...at(0, 3000)), false, 'the city');
  assert.equal(rumareSeaAt(...at(0, -10100)), false, 'the far shore');
  assert.equal(rumareSeaAt(...at(0, 10300)), false, 'past the span: the canal\'s own, never the city\'s');
  assert.equal(rumareSeaPixel(2069, 669), true);
  assert.equal(rumareSeaPixel(2069, 662), false);
  assert.ok(rumareSlice(2057, 646) && rumareSlice(2081, 670) && !rumareSlice(2056, 658) && !rumareSlice(2069, 671));
  setTamrielTrace(null);
  assert.equal(rumareCity(), null);
  assert.equal(rumareSeaAt(...at(0, 9000)), false, 'no canal: the city\'s lake its own ground');
  assert.equal(rumareSlice(2069, 658), false);
});

test('RUMARE-WATER the ground about it: the mouth\'s pixels the sea\'s bytes; the land let down to the shore on the span and eased back over the basin\'s ramp, the large map\'s detail with it; the sea never lifted; no canal, none of it (mutants: the mouth\'s pixels land; the basin unread; its ramp unbounded; the large map\'s detail whole)', () => {
  assert.ok(GROUND_ROLL_VERSION >= 5, 'the roads laid again on the basin');   // PIN MOVED (GHOSTFENCE): 6 - a later law's own move
  lakeBelow();
  for (const x of [2068, 2069, 2070]) assert.ok(rumareMouthPixel(x, 670) && tamrielHeightByte(x, 670) === 0, `(${x}, 670) the mouth's`);
  for (const [x, y] of [[2067, 670], [2071, 670], [2069, 669]]) assert.equal(rumareMouthPixel(x, y), false, `(${x}, ${y})`);
  assert.equal(rumareBasin(2069, 658), 1);
  assert.equal(rumareBasin(2081, 646), 1, 'the span\'s corner');
  const r = (IMPERIAL_SPAN - 1) / 2;
  let last = 1;
  for (let d = 1; d <= RUMARE_BASIN.ramp; d++) { const b = rumareBasin(2069 + r + d, 658); assert.ok(b < last && b >= 0, `ramp ${d}: ${b}`); last = b; }
  assert.equal(rumareBasin(2069 + r + RUMARE_BASIN.ramp + 1, 658), 0);
  assert.equal(tamrielHeightByte(2069, 650), SHORE_BYTE, 'the span\'s land at the shore');
  assert.equal(tamrielHeightByte(2069, 690), 0, 'the canal\'s water');
  const far = tamrielHeightByte(2069 + r + RUMARE_BASIN.ramp + 2, 640);
  assert.ok(far > SHORE_BYTE, `past the basin the land's own (${far})`);
  assert.ok(tamrielLargeMap(2069, 650).every((col) => col.every((v) => v === 0)), 'the span: no detail');
  assert.ok(tamrielLargeMap(2069 + r + RUMARE_BASIN.ramp + 2, 640).some((col) => col.some((v) => v > 0)), 'past the basin: the swell');
  setTamrielTrace(null);
  dropGroundCache();
  assert.equal(rumareBasin(2069, 658), 0);
  assert.equal(rumareMouthPixel(2069, 670), false);
});

test('RUMARE-WATER the city\'s land: the freeboard inside its far shore, rising past it to the land\'s own on the span\'s edge (smoothly, from the far shore or the mouth\'s side), never under the freeboard; its slices\' rects the capital\'s rim on its outer sides (mutants: the ramp past the edge; the mouth\'s side unread; the rim on an inner side)', () => {
  lakeBelow();
  const H = (IMPERIAL_SPAN * 819.2) / 2, L = 0.5, N = 0.9;
  assert.equal(rumareLandHeight(...at(0, 3000), L, N), L, 'the isle');
  assert.equal(rumareLandHeight(...at(0, -IMPERIAL.lake), L, N), L, 'the far shore\'s water line');
  assert.ok(Math.abs(rumareLandHeight(...at(0, -H), L, N) - N) < 1e-12, 'the span\'s edge: the land\'s own');
  const mid = rumareLandHeight(...at(0, -(IMPERIAL.lake + H) / 2), L, N);
  assert.ok(mid > L && mid < N, `between (${mid})`);
  assert.ok(rumareLandHeight(...at(-1230, IMPERIAL.lake + 200), L, N) < rumareLandHeight(...at(-3000, IMPERIAL.lake + 200), L, N), 'low by the mouth\'s side');
  assert.ok(rumareLandHeight(...at(-1232, IMPERIAL.lake + 200), L, N) < L + (N - L) * 0.1, 'beside the mouth, near the water\'s line (its far shore 274 m off)');
  assert.equal(rumareLandHeight(...at(0, -H + 10), L, 0.2), L, 'never under the freeboard');
  assert.deepEqual(rumareSliceRect(2057, 646, CAPITAL_RIM_TILES), { xMin: 11, xMax: 130, yMin: -3, yMax: 117 }, 'the north-west corner: rims west and north');
  assert.deepEqual(rumareSliceRect(2069, 670, CAPITAL_RIM_TILES), { xMin: -3, xMax: 130, yMin: 11, yMax: 130 }, 'the south edge: its rim south');
  assert.deepEqual(rumareSliceRect(2069, 658, CAPITAL_RIM_TILES), { xMin: -3, xMax: 130, yMin: -3, yMax: 130 });
  assert.equal(rumareSliceRect(2050, 658, CAPITAL_RIM_TILES), null);
});

/** A pixel's samples at `v` everywhere. */
const flat = (v) => new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(v);
const H129 = HEIGHTMAP_DIMENSION;

test('RUMARE-WATER a capital at the sea\'s ground: its stamped water\'s corners the sea\'s own height, its land a freeboard over it; its rim the sea where the land\'s own is, its land never under the freeboard; its outer edge the land\'s own; a seam with its sea slice water both sides (mutants: the freeboard none; a tile\'s corner read turned; the rim\'s sea unread; the outer edge the city\'s; the sea\'s seam unread)', () => {
  assert.equal(CAPITAL_SEA, Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT));
  assert.ok(CAPITAL_FREEBOARD > 0.25, 'past the carve\'s headroom');
  assert.ok((SCALED_OCEAN_ELEVATION + CAPITAL_FREEBOARD) * 1.25 > 34, 'past the hull\'s 34 m line');
  const rect = { xMin: 11, xMax: 117, yMin: 11, yMax: 117 }, tm = new Uint8Array(128 * 128);
  tm[40 + 50 * 128] = 0xff;   // record 0
  tm[80 + 80 * 128] = 7;   // record 28: water at its (1, 0) corner alone (WATER_DRAW_MASK_TABLE 2)
  const land = Math.fround(60 / MAX_TERRAIN_HEIGHT), natural = flat(land);
  for (let x = 0; x < H129; x++) for (let y = 0; y < 6; y++) natural[x * H129 + y] = CAPITAL_SEA;   // the sea along its south rim
  for (let y = 118; y < H129; y++) natural[64 * H129 + y] = Math.fround((CAPITAL_SEA + CAPITAL_LAND) / 2);   // a strand under the freeboard on its north rim
  const S = flat(CAPITAL_LAND);
  for (let x = 0; x < H129; x++) for (let y = 0; y < H129; y++) if (y < 11 || y > 117 || x < 11 || x > 117) S[x * H129 + y] = Math.fround((CAPITAL_LAND + natural[x * H129 + y]) / 2);   // a rim's blend
  capitalSeaGround(S, natural, tm, rect, 400, 200, null);
  for (const [x, y] of [[40, 50], [41, 50], [40, 51], [41, 51]]) assert.equal(S[x * H129 + y], CAPITAL_SEA, `the pond's corner ${x},${y}`);
  for (const [x, y] of [[39, 50], [42, 51], [40, 52]]) assert.equal(S[x * H129 + y], CAPITAL_LAND, `${x},${y} land`);
  assert.equal(S[81 * H129 + 80], CAPITAL_SEA, 'a shore tile\'s one water corner');
  for (const [x, y] of [[80, 80], [80, 81], [81, 81]]) assert.equal(S[x * H129 + y], CAPITAL_LAND, `its corner ${x},${y} land`);
  assert.equal(S[64 * H129 + 3], CAPITAL_SEA, 'the rim the sea\'s where the land\'s own is');
  assert.equal(S[64 * H129 + 120], CAPITAL_LAND, 'the rim\'s land never under the freeboard (its strand lifted to it)');
  assert.ok(S[60 * H129 + 120] > CAPITAL_LAND, 'and over it, the rim\'s blend');
  assert.equal(S[60 * H129 + 128], natural[60 * H129 + 128], 'the outer edge the land\'s own');
  assert.equal(S[0 * H129 + 64], natural[64], 'west too');
  // a seam with its sea slice: no rim there, its edge water whatever its own tiles
  const inner = { xMin: 11, xMax: 117, yMin: -3, yMax: 117 }, S2 = flat(CAPITAL_LAND);
  capitalSeaGround(S2, flat(land), new Uint8Array(128 * 128), inner, 400, 200, { S: true });
  assert.equal(S2[64 * H129 + 0], CAPITAL_SEA, 'its south seam the sea\'s');
  assert.equal(S2[64 * H129 + 1], CAPITAL_LAND);
});

test('RUMARE-WATER the Imperial City\'s ground: its law\'s water the sea\'s own height on every slice, its land the freeboard and the far shore\'s rise, a seam between two slices one height from both, the mouth\'s edge the canal\'s (mutants: the seams the tiles\'; the law unread)', () => {
  lakeBelow();
  const slice = (px, py, natural = flat(Math.fround(60 / MAX_TERRAIN_HEIGHT)), tm = null) => {
    const rect = rumareSliceRect(px, py, CAPITAL_RIM_TILES), S = flat(CAPITAL_LAND);
    capitalSeaGround(S, natural, tm, rect, px, py, null);
    return S;
  };
  const a = slice(2069, 669), b = slice(2070, 669);
  for (let y = 0; y < H129; y++) assert.equal(a[128 * H129 + y], b[y], `the seam's ${y}`);
  assert.equal(a[64 * H129 + 64], CAPITAL_SEA, 'the lake south of the isle');
  const pond = new Uint8Array(128 * 128);
  pond[127 + 64 * 128] = 0xff;   // a tile's water at its east edge, on the city's land
  const c = slice(2069, 660, undefined, pond), d = slice(2070, 660);
  assert.equal(c[64 * H129 + 64], CAPITAL_LAND, 'the city');
  assert.equal(c[127 * H129 + 64], CAPITAL_SEA, 'its tile\'s water inside the slice');
  for (let y = 0; y < H129; y++) assert.equal(c[128 * H129 + y], d[y], `a seam on the city's land ${y}: the law's, never one slice's tiles`);
  const sea = flat(CAPITAL_SEA), m = slice(2069, 670, sea);
  for (let x = 0; x < H129; x++) assert.equal(m[x * H129], CAPITAL_SEA, `the mouth's edge ${x}`);
  const corner = slice(2057, 646);
  assert.ok(corner[64 * H129 + 64] > CAPITAL_LAND, 'the far shore\'s rise');
});

test('RUMARE-WATER the harbour: the Waterfront\'s own slice on the middle line - its quay and its piers\' ends - a port where the canal meets the span\'s south edge; the city flattened to the sea then, its own ground with no canal (mutants: the harbour the edge\'s; the canal asked of the harbour\'s row; the city at the sea with no canal)', () => {
  const k = CAPITALS.findIndex((c) => c.key === 'imperial-city'), cap = CAPITALS[k], n = IMPERIAL_SPAN, r = (n - 1) / 2;
  assert.equal(capitalHarbourSlice(cap), 22 * n + r);
  const z0 = (22 - n / 2) * 819.2, z1 = z0 + 819.2;
  assert.ok(z0 < IMPERIAL.waterfront.r1 && IMPERIAL.waterfront.pierTo < z1, 'the quay and the piers\' ends on it');
  const names = new Map(['MAGE', 'GENR', 'TVRN', 'RESI', 'LIBR', 'ALCH', 'GEMS', 'BOOK', 'ARMR', 'TEMP', 'PAWN', 'GRVE', 'BANK', 'FIGH', 'THIE', 'CUST'].map((kk) => [kk, [`${kk}AA00.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 0, buildingDataList: [] } } };
  const base = { name: 'Broadvale', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
  const loc = () => synthesizeCapitalLocation({ cap, k, s: capitalHarbourSlice(cap) }, { base, names, blockOf: () => fh, px: 2069, py: 668 });
  lakeBelow(101);
  assert.equal(capitalCanalOpen(k), true);
  assert.deepEqual(loc().capital.flattenAt, { px: 2069, py: 658, sea: true });
  lakeBelow(102);   // the water past the canal's reach: no canal
  assert.equal(capitalCanalOpen(k), false);
  assert.equal(loc().capital.flattenAt.sea, undefined, 'its own ground');
});

/** A raw WOODS.WLD of one height everywhere. */
function rawWoods(height = 60) {
  const N = 1000 * 500, hdr = 32 + 28 * 4, offs = N * 4, blk = 22 + 25;
  const heightOffset = hdr + offs, dataOffset = heightOffset + N;
  const bytes = new Uint8Array(dataOffset + blk);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, 4, true); v.setUint32(4, 1000, true); v.setUint32(8, 500, true); v.setUint32(28, heightOffset, true);
  for (let i = 0; i < N; i++) v.setUint32(hdr + i * 4, dataOffset, true);
  bytes.fill(height, heightOffset, heightOffset + N);
  const w = new WoodsFile();
  assert.ok(w.load(bytes));
  return w;
}

test('RUMARE-WATER the continent\'s bake: the city\'s span asked whole, its water its ground\'s - the lake round the isle the sea\'s, flooded from the canal through the mouth; the city none (mutants: the span\'s class the bound\'s; the fine water the plain sampler\'s; the city\'s sea unseeded)', () => {
  lakeBelow();
  const b = new TamrielWatersBake({ woods: groundWoods(rawWoods()) });
  const kind = (bits) => (!bits ? 'null' : bits.every((v) => v === 0xff) ? 'all' : bits.every((v) => v === 0) ? 'none' : 'part');
  assert.equal(kind(b.seaBits(2069, 676)), 'all', 'the canal');
  assert.equal(kind(b.seaBits(2069, 670)), 'all', 'the mouth');
  assert.equal(kind(b.seaBits(2069, 669)), 'all', 'the lake south');
  assert.notEqual(kind(b.seaBits(2069, 648)), 'none', 'the lake north, round the isle');
  assert.equal(kind(b.seaBits(2069, 660)), 'none', 'the city');
  assert.ok(b.mapPixelHasFineWaterCells(2080, 658), 'the lake east: fine water');
  assert.equal(b.mapPixelHasFineWaterCells(2069, 660), false);
});

test('AUDIT BAY-LEFT F1 the city\'s water to the bake off its law: every vertex of every kind of slice the kernel\'s answer (generateSamples, the flatten, capitalSeaGround), with no kernel run; the isle and the far shore LAND, the lake SEA, a shore MIXED; the all-land test exact; a mixed slice\'s fine water the kernel\'s; the city\'s bits kept past an eviction (mutants: the span all mixed; the fine water the plain sampler\'s; the all-land test unread; a vertex the kernel\'s grid turned; the bits made again)', async () => {
  lakeBelow();
  const { rumareClass } = await import('../../src/world/tamrielWatersBake.js');
  const { rumareSliceAllLand, rumareSeaGrid } = await import('../../src/world/rumareWaters.js');
  const { generateSamples } = await import('../../src/world/terrain/terrainSampler.js');
  const { blendLocationTerrain } = await import('../../src/world/terrain/terrainTiles.js');
  const { WATER_THRESHOLD, PIXEL_LAND, PIXEL_SEA, PIXEL_MIXED, fineMaskBits } = await import('../../src/world/deepWater/deepWatersBake.js');
  const woods = groundWoods(rawWoods());
  const kernel = (px, py) => {
    const rect = rumareSliceRect(px, py, CAPITAL_RIM_TILES), S = generateSamples(woods, px, py), natural = Float32Array.from(S);
    blendLocationTerrain(S, CAPITAL_LAND, rect);
    capitalSeaGround(S, natural, null, rect, px, py);
    return (x, y) => S[x * H129 + y] <= WATER_THRESHOLD;
  };
  // the centre, the isle by its shore, the lake south and north, the mouth, the span's corners and edges, the Waterfront
  for (const [px, py] of [[2069, 658], [2067, 667], [2069, 669], [2069, 648], [2069, 670], [2057, 646], [2081, 670], [2081, 658], [2069, 646], [2076, 666], [2069, 668]]) {
    const law = rumareWaterSampler(woods, px, py), k = kernel(px, py);
    let diff = 0;
    for (let x = 0; x < H129; x++) for (let y = 0; y < H129; y++) if (law.water(x, y) !== k(x, y)) diff++;
    assert.equal(diff, 0, `(${px}, ${py}) its vertices the kernel's`);
  }
  assert.equal(rumareClass(2069, 658), PIXEL_LAND, 'the centre');
  assert.equal(rumareClass(2069, 669), PIXEL_SEA, 'the lake south of the isle');
  assert.equal(rumareClass(2069, 668), PIXEL_MIXED, 'the isle\'s shore: the Waterfront');
  assert.equal(rumareClass(2067, 667), PIXEL_LAND, 'land by its every vertex, past the quick test\'s margin');
  assert.equal(rumareClass(2069, 646), PIXEL_MIXED, 'the span\'s outer edge: its land\'s own');
  assert.equal(rumareClass(2050, 658), null, 'off the span');
  for (const [px, py, all] of [[2069, 658, true], [2058, 647, true], [2069, 666, true], [2069, 669, false], [2067, 667, false], [2069, 668, false], [2075, 670, true]]) {   // (2075, 670): the far shore by the law, its class MIXED for the outer edge alone
    assert.equal(rumareSliceAllLand(px, py), all, `(${px}, ${py}) all land`);
    if (all) assert.ok(rumareSeaGrid(px, py).every((v) => v === 0), 'and the grid agrees');
  }
  const b = new TamrielWatersBake({ woods });
  for (const [px, py] of [[2069, 668], [2069, 646]]) {   // a mixed slice's fine water - the only slices the bake asks it of - the kernel's
    const k = kernel(px, py);
    assert.deepEqual([...b.fineBits(px, py)], [...fineMaskBits({ water: k, quick: (x, y) => (k(x, y) ? 1 : 0), exact: k })], `(${px}, ${py}) its fine water the kernel's`);
  }
  b.seaBits(2069, 669);
  const coarse =b._cityBits(2069, 669, 'coarse') ?? null, mixed = b._cityBits(2069, 668, 'coarse');
  b.evictOutside(0, 0, 4);
  b.seaBits(2069, 669);
  assert.equal(b._cityBits(2069, 668, 'coarse'), mixed, 'a shore slice\'s bits kept past the eviction');
  assert.equal(b._cityBits(2069, 669, 'coarse') ?? null, coarse);
});

test('AUDIT BAY-LEFT F1 imperialLand with its compounds\' centres made once a plan answers as it did - the Prison\'s and the University\'s grounds land, the lake beside them water (mutant: the centres turned)', () => {
  const { prison, university } = IMPERIAL;
  for (const c of [prison, university]) {
    const b = (c.b * Math.PI) / 180, [x, z] = [c.r * Math.sin(b), -c.r * Math.cos(b)];
    assert.equal(imperialLand(x, z), true, 'the compound\'s middle');
    assert.equal(imperialLand(x + c.half + 23, z), true, 'its edge');
  }
  const a = (prison.b * Math.PI) / 180, r = (IMPERIAL.isle + IMPERIAL.lake) / 2;
  assert.equal(imperialLand(r * Math.sin(a + 0.3), -r * Math.cos(a + 0.3)), false, 'the lake beside it');
  // the University's grounds' corner past City Isle's shore (the Prison's lie inside the shore whole): land to 8,000 m along
  // its bearing - its box's own half, never the Prison's - and the lake past it
  const u = (university.b * Math.PI) / 180, at = (d) => imperialLand(d * Math.sin(u), -d * Math.cos(u));
  assert.deepEqual([at(7950), at(8000), at(8030)], [true, true, false], 'the University\'s corner in the lake');
});

test('RUMARE-WATER the sea\'s ways at the map\'s scale: the lanes\' water and a voyage\'s sea take the city\'s lake, the land\'s step never; a canal harbour asks its lanes of CANAL_PORT_NEIGHBOURS ports (mutants: the lanes\' water unread; the voyage\'s sea the land\'s; the neighbours the lanes\')', () => {
  lakeBelow();
  const lw = worldLaneWater({ bayOpen: () => false, water: (x, y) => y >= 671, climateAt: () => CLIMATES.Ocean, beyond: () => true });
  assert.equal(lw.open(2069, 669), true, 'the lake');
  assert.equal(lw.open(2069, 660), false, 'the city');
  const g = routeGround(() => 0, (x, y) => (y >= 671 ? 0 : 20), 5, 4000, 1000, null, null, rumareSeaPixel);
  assert.equal(g.isWater(2069, 669), false, 'walked as the city\'s ground');
  assert.equal(g.seaWater(2069, 669), true, 'sailed');
  assert.equal(g.seaWater, g.seaWater, 'one function a water (its kept lanes)');
  const plain = routeGround(() => 0, () => 20, 5, 10, 10);
  assert.equal(plain.seaWater, plain.isWater, 'none said: the land\'s water');
  const v = planSeaLanes({ x: 2069, y: 720 }, { x: 2069, y: 668 }, { ...g, sea: { start: 'sea', voyage: true } });
  assert.ok(v, 'a voyage up the canal');
  assert.ok(v.pixels.some((p) => p.y === 669), 'across the lake');
  const west = planSeaLanes({ x: 2069, y: 720 }, { x: 2058, y: 658 }, { ...g, sea: { start: 'sea', voyage: true } });   // the lake west of the isle, past any landfall from the canal
  assert.deepEqual(west?.pixels.at(-1), { x: 2058, y: 658 }, 'round the isle to its west');
  assert.ok(west.pixels.every((p) => g.seaWater(p.x, p.y)), 'every pixel of it the sea a boat sails');
  assert.ok(CANAL_PORT_NEIGHBOURS > LANE_NEIGHBOURS);
  const ports = [{ id: 1, px: 0, py: 0, reach: 1200, neighbours: 4 }, { id: 2, px: 100, py: 0 }, { id: 3, px: 200, py: 0 }, { id: 4, px: 300, py: 0 }, { id: 5, px: 400, py: 0 }];
  assert.deepEqual(laneNetwork(ports, () => true, 50).map((l) => l.key).filter((k) => k.startsWith('1-')), ['1-2', '1-3', '1-4', '1-5']);
  const places = createWorldPlaces();
  places.register('t', [{ mapId: 1, name: 'Waterfront District', px: 2069, py: 668, type: LOCATION_TYPES.TownCity, port: true }]);
  assert.deepEqual(beyondPorts(places, rumareSeaPixel).map((p) => [p.name, p.reach, p.neighbours]), [['Imperial City', CANAL_PORT_REACH_PX, CANAL_PORT_NEIGHBOURS]], 'its shore the city\'s lake');
});

test('RUMARE-WATER the host\'s wiring: the ports\' open sea and the voyages\' sea take the city\'s lake; the terrain job lays a capital at the sea\'s ground (mutants: the ports\' unwired; the voyages\' unwired)', () => {
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('return tamrielLand && ((seaPixel(x, y) && !pastBayLakeAt(x, y)) || rumareSeaPixel(x, y));'), 'the ports\' open sea');
  assert.ok(w.includes("WATER_BYTE, 1000, 500, (x, y) => !tvWater(x, y), undefined, rumareSeaPixel))"), 'the voyages\' sea');
  const gen = rd('src/world/terrain/terrainGen.js');
  assert.ok(gen.includes('if (natural) for (const [S, n] of [[samples, natural[0]], [classic, natural[1]]]) if (S && n) capitalSeaGround(S, n, tilemap, locationRect, px, py, flattenAt.seaEdges);'));
  assert.ok(gen.includes('flattenAt.sea ? CAPITAL_SEA_FLAT :'));
});

const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
test('RUMARE-WATER (ARENA2): on the player\'s own files the Imperial City stands at the sea - its lake\'s samples the sea\'s own height, its isle a freeboard over it, its mouth the canal\'s water to the span\'s edge; the hull sails the lake and not the streets; the bake carves the lake deep; its harbour the Waterfront with lanes to Senchal and Torval and a voyage from the Topal Bay ashore at it', { skip: realSkip }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { groundMaps, tamrielClimateAt } = await import('../../src/world/tamriel/tamrielGround.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { terrainSampleHeightAt } = await import('../../src/world/terrain/terrainSurface.js');
  const { buildDeepWatersPixel } = await import('../../src/world/deepWater/deepWatersPixel.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { createWorldPorts } = await import('../../src/world/worldWide/worldPorts.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows } = await import('../../src/world/pastBayRows.js');
  const { beyondLaneWay, BEYOND_LANE_MAX_PX } = await import('../../src/scenes/naval/worldLanes.js');
  const { WATER_BYTE } = await import('../../src/world/roadsProducer.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(FIT);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); assert.ok(blocks.load(bytes('BLOCKS.BSA')));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  installCapitals({ addTextures: () => 0 });
  const ground = groundWoods(woods), base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
  const gen = (px, py) => {
    const a = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
    const loc = tc.synthesizeCapitalLocation(/** @type {any} */ (a), { base, names, blockOf: (nm) => blocks.getBlockByName(nm), px, py }), rect = setLocationTiles(loc, maps, blocks, tm);
    return { loc, ...generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true }) };
  };
  const M = MAX_TERRAIN_HEIGHT * 1.25, SEA = SCALED_OCEAN_ELEVATION * 1.25;
  const k = tc.CAPITALS.findIndex((c) => c.key === 'imperial-city');
  assert.deepEqual(tc.capitalCentrePixel(k), { px: 2069, py: 658 });
  const lake = gen(2069, 669), city = gen(2069, 660), mouth = gen(2069, 670);
  assert.deepEqual(lake.loc.capital.flattenAt, { px: 2069, py: 658, sea: true });
  assert.ok(Math.abs(lake.samples[64 * 129 + 64] * M - SEA) < 0.01, 'the lake at the sea\'s own height');
  assert.ok(Math.abs(city.samples[64 * 129 + 64] * M - (SEA + 1)) < 0.01, 'the city a metre over it');
  for (let x = 0; x <= 128; x++) assert.ok(Math.abs(mouth.samples[x * 129] * M - SEA) < 0.01, `the mouth's edge ${x} the canal's water`);
  // the hull: Come Sail Away's line (systems/comeSailAway/comeSailAway.js nodeReadingAt) - under 34 m water
  const hull = (r) => terrainSampleHeightAt(r.samples, TERRAIN_SIZE / 2, TERRAIN_SIZE / 2);
  assert.ok(hull(lake) < 34, `the lake sailed (${hull(lake)})`);
  assert.ok(hull(city) > 34, `the streets not (${hull(city)})`);
  // Deep Waters: the lake flooded from the canal and carved deep
  const b = new TamrielWatersBake({ woods: ground });
  assert.ok(b.seaBits(2069, 669).every((v) => v === 0xff));
  const climates = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) climates.push(tamrielClimateAt(2069 + dx, 669 + dy));
  const dw = buildDeepWatersPixel({ px: 2069, py: 669, samples: lake.samples, tilemap: lake.tilemap, tilemapBytes: lake.tilemapBytes, climates, waterDepth: 200 }, b);
  let deep = 0;
  for (const y of dw.floor.vertexLocalY) deep = Math.max(deep, SEA - y);
  assert.ok(deep > 30, `the lake's floor ${deep.toFixed(1)} m down`);
  assert.ok(dw.holes.every((h) => h === 0), 'every cell of it carved');
  // the harbour, its lanes and a voyage
  const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
  const lw = worldLaneWater({ bayOpen: () => false, water, climateAt: (x, y) => tamrielClimateAt(x, y), beyond: () => true });
  const places = createWorldPlaces();
  places.register('tesa', pastBayPlaceRows({ pixels: arenaPixels(), templateOf: () => ({ exterior: { exteriorData: { width: 1, height: 1 } } }), capitals: true }));
  const ports = createWorldPorts({ places, openSea: (x, y) => (water(x, y) && !pastBayLakeAt(x, y)) || rumareSeaPixel(x, y) }).list();
  const ic = /** @type {any} */ (ports.find((p) => p.name === 'Imperial City'));
  assert.deepEqual([ic?.px, ic?.py], [2069, 668], 'the Waterfront');
  const lanes = laneNetwork(ports, lw.open, BEYOND_LANE_MAX_PX).filter((l) => [l.a.id, l.b.id].includes(ic.id) && beyondLaneWay(l, lw.openNative));
  assert.deepEqual(lanes.map((l) => (l.a.id === ic.id ? l.b.name : l.a.name)).sort(), ['Senchal', 'Torval']);
  const sea = (x, y) => ground.getHeightMapValue(x, y) <= WATER_BYTE || rumareSeaPixel(x, y);
  const voyage = planSeaLanes({ x: 2350, y: 1470 }, { x: 2069, y: 668 }, { isWater: (x, y) => ground.getHeightMapValue(x, y) <= WATER_BYTE, seaWater: sea, sea: { start: 'sea', voyage: true } });
  assert.deepEqual(voyage?.pixels.at(-1), { x: 2069, y: 668 }, 'ashore at the Waterfront');
});
