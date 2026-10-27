// PEAKS1 (2026-10-26, bible/03-World/Peaks.md; the owner: "The world of daggerfall mountains need to be completely redesigned
// from the ground up with more integration into the terrian, snow capped, and properly place throughout tamriel") - THE
// SNOW THAT NEVER MELTS: a perennial snowline by climate and zone (world/peaks/snowcap.js), a floor under the snowpack's
// lines near the player (scenes/snowCoverHost.js), a steep face over it bare rock in both terrain programs
// (render/snowCapGlsl.js), and the summits white on the far ring, the middle ring and the far field. Where ARENA2_PATH
// names the data, the caps are held on the freeware's own ranges: Skyrim's, the Jerall's, the Wrothgarians' and the
// Dragontails' summits white, Red Mountain and Eton Nir's coast bare, and the corners one number from either side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glslFunctions } from '../glsl.mjs';
import {
  SNOWCAP, CAP_NONE, capLineOfPixel, capLineAt, winterness, seasonalLine, capCover, faceRock, capShare, capSnowline, mergeCapLine, whiten,
} from '../../src/world/peaks/snowcap.js';
import { snowCapGlsl, STONE_RECORD } from '../../src/render/snowCapGlsl.js';
import { snowCoverGlsl, TWIN_LAYERS, SNOW_TILE_M } from '../../src/render/snowCoverGlsl.js';
import { ecotoneGlsl } from '../../src/render/ecotoneGlsl.js';
import { createLookupTable } from '../../src/world/terrain/terrainTiles.js';
import { coverAtHeight, latticeKey } from '../../src/systems/weather/snowpack.js';
import { createSnowCoverHost, SNOW_COVER } from '../../src/scenes/snowCoverHost.js';
import { setAirGround } from '../../src/systems/weather/airTemperature.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { buildFarRingGrid, ringSnowAt } from '../../src/render/farRing.js';
import { midRingVertices } from '../../src/render/midRing.js';
import { farFieldVertices } from '../../src/render/farField.js';
import { farFieldSide, FAR_SAMPLES } from '../../src/world/terrain/midRingGrid.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';

const read = (p) => readFileSync(p, 'utf8');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const SEA_Y = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;

test('PEAKS1 THE LINE BY CLIMATE ON THE BAY: each climate\'s own line, the Mountain\'s and the woods\' risen southward over the Bay (the Wrothgarians snowier than the Dragontails), the deserts, the jungles, the swamps and the sea none; a corner the mean of its four pixels (mutants: a climate\'s line, the southward rise, the corner\'s mean)', () => {
  const at = (c) => () => c;
  assert.equal(capLineOfPixel(500, 0, at(CLIMATES.Mountain)), 1350);
  assert.equal(capLineOfPixel(500, 100, at(CLIMATES.Mountain)), 1350, 'the north row: no rise');
  assert.equal(capLineOfPixel(500, 420, at(CLIMATES.Mountain)), 1850, 'the south row: the whole rise');
  assert.equal(capLineOfPixel(500, 260, at(CLIMATES.Mountain)), 1350 + 500 * 0.5, 'half way, half');
  assert.equal(capLineOfPixel(500, 499, at(CLIMATES.MountainWoods)), 2100);
  assert.equal(capLineOfPixel(10, 50, at(CLIMATES.Woodlands)), 2100);
  assert.equal(capLineOfPixel(10, 50, at(CLIMATES.HauntedWoodlands)), 2100);
  for (const c of [CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Rainforest, CLIMATES.Subtropical, CLIMATES.Swamp, CLIMATES.Ocean]) assert.equal(capLineOfPixel(500, 450, at(c)), CAP_NONE, `climate ${c} none`);
  assert.equal(capLineOfPixel(500, 50, at(0)), 2100, 'any other value the woodlands\'');
  const mixed = (x) => (x < 500 ? CLIMATES.Mountain : CLIMATES.Desert);
  assert.equal(capLineAt(500, 50, (x) => mixed(x)), (1350 + CAP_NONE) / 2, 'a border corner: the mean');
  assert.equal(capLineAt(400, 50, (x) => mixed(x)), 1350);
  // the line is a function of the corner alone: the pixels either side of an edge read it at its ends
  const clim = (x, y) => [CLIMATES.Mountain, CLIMATES.Woodlands, CLIMATES.Desert][(x * 7 + y * 3) % 3];
  for (const [cx, cy] of [[300, 120], [301, 121], [640, 333]]) assert.equal(capLineAt(cx, cy, clim), (capLineOfPixel(cx - 1, cy - 1, clim) + capLineOfPixel(cx, cy - 1, clim) + capLineOfPixel(cx - 1, cy, clim) + capLineOfPixel(cx, cy, clim)) / 4);
  assert.ok(CAP_NONE > 4700, 'over the land\'s ceiling');
});

test('PEAKS1 THE SEASON, THE BAND AND THE FACE: the line comes down by SNOWCAP.winter on the coldest day and not at midsummer (none never brought down); the cover rises from `below` under the line to whole `above` it; a face sheds it to rock from `held` to `bare` near and over the line, never a ledge, never far under it (mutants: the winter, the coldest day, the band, the face\'s two ends, its height gate)', () => {
  assert.equal(winterness(20), 1, 'the coldest day');
  near(winterness(200), 0, 1e-12, 'midsummer');
  near(winterness(110), 0.5, 1e-12, 'a quarter on');
  assert.equal(seasonalLine(1500, 20), 1500 - SNOWCAP.winter);
  assert.equal(seasonalLine(1500, 200), 1500);
  assert.equal(seasonalLine(CAP_NONE, 20), CAP_NONE, 'none stays none');
  assert.equal(SNOWCAP.winter, 450);
  const L = 1500;
  assert.equal(capCover(L - SNOWCAP.band.below, L), 0);
  assert.equal(capCover(L - SNOWCAP.band.below - 50, L), 0);
  assert.equal(capCover(L + SNOWCAP.band.above, L), 1);
  near(capCover(L + (SNOWCAP.band.above - SNOWCAP.band.below) / 2, L), 0.5, 1e-12, 'half at the band\'s middle');
  assert.deepEqual(SNOWCAP.band, { below: 140, above: 180 });
  assert.equal(faceRock(L + 500, 1, L), 0, 'a ledge holds it');
  assert.equal(faceRock(L + 500, SNOWCAP.face.held, L), 0);
  assert.equal(faceRock(L + 500, SNOWCAP.face.bare, L), 1, 'a cliff over the line is rock');
  assert.equal(faceRock(L + 500, 0.3, L), 1);
  assert.equal(faceRock(L - SNOWCAP.face.from, 0.3, L), 0, 'far under the line a face is what it was');
  assert.equal(faceRock(L - SNOWCAP.face.full, 0.3, L), 1);
  assert.deepEqual(SNOWCAP.face, { bare: 0.62, held: 0.8, from: 500, full: 150 });
  near(capShare(L + 400, 0.7, L), capCover(L + 400, L) * (1 - faceRock(L + 400, 0.7, L)), 1e-12, 'the far views\' share');
  assert.ok(capShare(L + 400, 0.7, L) > 0 && capShare(L + 400, 0.7, L) < 1);
});

test('PEAKS1 THE CAP AS A SNOWLINE, A FLOOR UNDER THE PACK: capSnowline\'s crossings read through coverAtHeight within a few percent of capCover; the merge takes the lower crossing of each, never raises the pack, and none merges nothing (mutants: the merge\'s min, none merged)', () => {
  const L = 1600, line = capSnowline(L);
  assert.ok(line[0] < line[1] && line[1] < line[2]);
  for (let h = L - 300; h <= L + 300; h += 10) near(coverAtHeight(line, h), capCover(h, L), 0.08, `the band at ${h}`);
  const pack = [2000, 2300, 2600];
  assert.deepEqual(mergeCapLine([...pack], L), line, 'a pack bare over the cap: the cap\'s');
  assert.deepEqual(mergeCapLine([300, 400, 500], L), [300, 400, 500], 'a pack white under it: the pack\'s');
  assert.deepEqual(mergeCapLine([1000, 1700, 2600], L), [1000, line[1], line[2]], 'each crossing its lower');
  assert.deepEqual(mergeCapLine([...pack], CAP_NONE), pack, 'none: the pack whole');
  const c = new Uint8Array([10, 20, 30]);
  whiten(c, 0, 1);
  assert.deepEqual([...c], SNOWCAP.rgb);
  const d = new Uint8Array([10, 20, 30]);
  whiten(d, 0, 0);
  assert.deepEqual([...d], [10, 20, 30]);
});

/** The face's chunk after the cover's (and the ecotone's), bound to a frame whose texels carry `cap` in their alpha. */
const PROBE = '\nvec4 faceProbe(vec3 tex, float c, vec2 local, float y, vec3 n) { float r = snowFace(tex, c, local, y, n, vec2(0.5), vec2(0.0), vec2(0.0)); return vec4(tex, r); }\n';
const chunk = ({ cap = () => 1500, on = 1, alt = 0, origin = [0, 0, 0] } = {}) => glslFunctions('uniform highp sampler2DArray uTileArr;\n' + ecotoneGlsl('') + snowCoverGlsl('') + snowCapGlsl('', SNOW_TILE_M) + PROBE, {
  uEcoSide: [0, 0, 0, 0], uEcoCorner: [0, 0, 0, 0], uEcoOrigin: origin, uSnowWin: [origin[0], origin[1] + 128, 11], uSnowSet: [alt, on, 2 * 128, 0], uSnowArr: [TWIN_LAYERS, 0, 0, 0],
  texelFetch: (smp, p) => [9000, 9000, 9000, cap(p[0], p[1])],
  textureGrad: (smp, tl) => (tl[2] === STONE_RECORD ? [0.5, 0.5, 0.5, 1] : [0.2, 0.4, 0.1, 1]),
});

test('PEAKS1 THE BARE FACE IN THE CHUNK: snowFaceRock is snowcap.js faceRock term for term on the cap line the texels\' alpha carry (the lattice\'s bilinear, the snowline\'s own); snowFace turns the texel to its set\'s stone record (DFU\'s base record 3) by it and the cover less it; off the lane nothing (mutants: the alpha unread, the stone record, the cover not shed, the lane\'s test)', () => {
  assert.equal(createLookupTable()[48] & 63, STONE_RECORD, 'the stone ring\'s base record');
  const f = chunk();
  for (const [h, ny] of [[1600, 0.5], [1400, 0.7], [1200, 0.6], [2500, 0.9], [1360, 0.4], [900, 0.1]]) near(f.snowFaceRock([300, 300], h, [0, ny, 0]), faceRock(h, ny, 1500), 1e-6, `${h} ${ny}`);
  // a line varying across the lattice: the bilinear between the four points about the place
  const g = chunk({ cap: (i, j) => 1200 + 100 * i + 40 * j });
  const lx = 0.3 * 819.2, lz = 0.6 * 819.2;   // inside the window's first cell (two pixels a cell)
  // the window's first point the pixel's north-west corner: the place lies 0.15 of a cell east and 0.2 south of it
  near(g.snowCapLine([lx, lz]), 1200 + 100 * 0.15 + 40 * 0.2, 1e-3, 'the bilinear of the four points about it');
  const cliff = f.faceProbe([0.2, 0.4, 0.1], 1, [300, 300], 2500, [0, 0.4, 0]);
  near(cliff[3], 0, 1e-9, 'a cliff over the line: no snow');
  assert.deepEqual([...cliff.slice(0, 3)].map((v) => +v.toFixed(6)), [0.5, 0.5, 0.5], 'its texel the stone');
  const half = f.faceProbe([0.2, 0.4, 0.1], 1, [300, 300], 2500, [0, 0.71, 0]), r = faceRock(2500, 0.71, 1500);
  assert.ok(r > 0.2 && r < 0.8);
  near(half[3], 1 - r, 1e-6, 'the cover less the rock');
  near(half[0], 0.2 + (0.5 - 0.2) * r, 1e-6, 'the texel the rock\'s share of the stone');
  const ledge = f.faceProbe([0.2, 0.4, 0.1], 0.8, [300, 300], 2500, [0, 1, 0]);
  near(ledge[3], 0.8, 1e-9, 'a ledge keeps its cover');
  assert.deepEqual([...ledge.slice(0, 3)].map((v) => +v.toFixed(6)), [0.2, 0.4, 0.1]);
  const off = chunk({ on: 0 });
  assert.equal(off.snowFaceRock([300, 300], 2500, [0, 0.2, 0]), 0, 'off the lane');
  const offp = off.faceProbe([0.2, 0.4, 0.1], 0.7, [300, 300], 2500, [0, 0.2, 0]);
  near(offp[3], 0.7, 1e-9);
  // both terrain programs shed it, right after the cover, on the fragment's own normal
  for (const p of ['src/render/renderer.js', 'src/render/enhancedLighting.js']) {
    assert.match(read(p), /float snowC = snowCover\(vLocalXZ, vWorldPos\.y, gx, gy\);[^\n]*\n {2}snowC = snowFace\(tex, snowC, vLocalXZ, vWorldPos\.y, normalize\(vNormal\), tuv, gx, gy\);/, p);
  }
  assert.match(read('src/render/enhancedLighting.js'), /\$\{snowCapGlsl\('elDecode', SNOW_TILE_M\)\}/, 'the lane decodes the stone as its texels');
});

test('PEAKS1 THE HOST MERGES THE CAP: with `capLine` every point\'s target and build lines are the lower of the pack\'s and the cap\'s at its corner, and the frame\'s texels carry the cap in their alpha; without it the lines are the pack\'s and the alpha none (mutants: the merge, the corner, the alpha)', async () => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  try {
    const t = (406 * 360 + 215) * 1440;   // a summer: the pack bare over the ground
    const state = { compensation: [0, 40, 0], current: { x: 200, y: 100 }, pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * 819.2; out[1] = 40; out[2] = -(py - 100) * 819.2; return out; } };
    const mk = (capLine) => createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => state, builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => t, place: () => ({ px: 200, py: 100 }), capLine });
    const capped = mk((cx, cy) => 300 + cx + 2 * cy), bare = mk(null);
    for (const h of [capped, bare]) await h.settle({ left: () => Infinity, breathe: async () => {} });
    let merged = 0;
    for (const pt of capped._window) {
      const k = latticeKey(pt.i, pt.j), a = capped._lines.get(k), b = bare._lines.get(k);
      const want = capSnowline(300 + pt.i * SNOW_COVER.spacing + 2 * pt.j * SNOW_COVER.spacing);
      for (let q = 0; q < 3; q++) {
        near(a.target[q], Math.min(b.target[q], want[q]), 1e-3, `target ${pt.i},${pt.j} ${q}`);
        near(a.build[q], Math.min(b.build[q], want[q]), 1e-3, `build ${pt.i},${pt.j} ${q}`);
      }
      if (want[1] < b.target[1]) merged++;
    }
    assert.ok(merged > 50, `the cap under a summer's pack: ${merged}`);
    const fr = capped.frame(), i0 = capped._window[0].i, j0 = capped._window[0].j;
    assert.equal(fr.lines[3], 300 + i0 * SNOW_COVER.spacing + 2 * j0 * SNOW_COVER.spacing, 'the alpha the corner\'s cap');
    assert.equal(bare.frame().lines[3], CAP_NONE, 'no cap: none');
  } finally { setAirGround(null); }
  // unhanded, the land's own wherever the air's ground is the landforms' (the world host hands the air its map with the row)
  setAirGround({ climateAt: () => CLIMATES.Mountain, groundAt: () => 0, topAt: () => 900, landforms: true });
  try {
    const own = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Mountain, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0], pixelTranslation: () => [0, 0, 0] }), builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => (406 * 360 + 215) * 1440, place: () => ({ px: 200, py: 30 }) });
    await own.settle({ left: () => Infinity, breathe: async () => {} });
    const pt = own._window[0];
    assert.equal(own._lines.get(latticeKey(pt.i, pt.j)).cap, capLineAt(pt.i * SNOW_COVER.spacing, pt.j * SNOW_COVER.spacing, () => CLIMATES.Mountain), 'the Mountain\'s own line');
    const off = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Mountain, mapHeight: 500, stateOf: () => ({ compensation: [0, 0, 0] }), builtOf: () => new Map(), owns: () => true, markReskin: () => {}, now: () => (406 * 360 + 215) * 1440, place: () => ({ px: 200, py: 30 }), capLine: null });
    await off.settle({ left: () => Infinity, breathe: async () => {} });
    assert.equal(off._lines.get(latticeKey(off._window[0].i, off._window[0].j)).cap, CAP_NONE, 'null: none');
  } finally { setAirGround(null); }
  assert.match(read('src/systems/weather/airGround.js'), /landforms: !!landforms,/, 'the law\'s air ground says whether it is the landforms\'');
});

test('PEAKS1 THE HORIZON WEARS IT: the far ring whitens a vertex over its line by its height and its slope, never the sea and never with no line (the classic ground\'s horizon its own - ringSnowAt none without the Landforms row); the middle ring and the far field the same (mutants: the ring\'s whiten, the middle ring\'s, the far field\'s, the relief gate)', () => {
  const W = 40, Hh = 40, bytes = new Uint8Array(W * Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) bytes[y * W + x] = x < 4 ? 0 : Math.min(127, 20 + 4 * Math.abs(x - 20) + 3 * y);
  const inputs = { heightBytes: bytes, mapWidth: W, mapHeight: Hh, climateAt: (x) => (x < 4 ? CLIMATES.Ocean : CLIMATES.Mountain), baseX: 20, baseY: 20, radius: 8, relief: true };
  assert.equal(ringSnowAt({ ...inputs, relief: false }), null, 'no Landforms row: no cap');
  const lineAt = (x) => (x < 20 ? CAP_NONE : 500);
  const plain = buildFarRingGrid(inputs), snowy = buildFarRingGrid({ ...inputs, snowAt: lineAt });
  let white = 0, same = 0;
  for (let v = 0; v < plain.sea.length; v++) {
    const o = v * 3, h = plain.positions[o + 1] - SEA_Y, s = capShare(h, plain.normals[o + 1], lineAt(20 - 8 + (v % 17)));
    const want = [0, 1, 2].map((k) => Math.round(plain.colors[o + k] + (SNOWCAP.rgb[k] - plain.colors[o + k]) * s));
    if (plain.sea[v]) { assert.deepEqual([...snowy.colors.slice(o, o + 3)], [...plain.colors.slice(o, o + 3)], 'the sea'); continue; }
    assert.deepEqual([...snowy.colors.slice(o, o + 3)], s > 0 ? want : [...plain.colors.slice(o, o + 3)], `vertex ${v}`);
    if (s > 0.9) white++; else if (s === 0) same++;
  }
  assert.ok(white > 10 && same > 10, `white ${white}, bare ${same}`);
  // the middle ring: a ridge of heights, each vertex's line the centres' bilinear
  const radius = 2, sub = 4, side = (2 * radius + 1) * sub + 1, heights = new Float32Array(side * side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) heights[z * side + x] = SEA_Y + 200 + 60 * x + 10 * z;
  const tintAt = () => [60, 90, 40];
  const m0 = midRingVertices({ heights, baseX: 50, baseY: 50, radius, sub, tintAt, seaY: SEA_Y });
  const m1 = midRingVertices({ heights, baseX: 50, baseY: 50, radius, sub, tintAt, seaY: SEA_Y, snowAt: () => 1200 });
  let mw = 0;
  for (let v = 0; v < side * side; v++) {
    const s = capShare(heights[v] - SEA_Y, m0.normals[v * 3 + 1], 1200);
    const want = [60, 90, 40].map((c, k) => Math.round(c + (SNOWCAP.rgb[k] - c) * s));
    assert.deepEqual([...m1.colors.slice(v * 3, v * 3 + 3)], s > 0 ? want : [60, 90, 40], `middle ${v}`);
    if (s > 0.9) mw++;
  }
  assert.ok(mw > 5, `the middle ring white: ${mw}`);
  assert.deepEqual([...m0.colors.slice(0, 3)], [60, 90, 40], 'no line: its own tint');
  // the far field: a cell's line at its centre, the cell's highest byte its height
  const R = 3, fs = farFieldSide(R), high = new Uint8Array(fs * fs), low = new Uint8Array(fs * fs);
  for (let v = 0; v < high.length; v++) high[v] = 20 + 12 * (v % fs);
  const o = { high, low, baseCX: 10, baseCY: 10, radius: R, cell: 8, heightOf: (b) => b * 8 * STREAMING_TERRAIN_SCALE, tintAt: () => [70, 80, 50], oceanAt: () => false, seaY: SEA_Y };
  const f0 = farFieldVertices(o), f1 = farFieldVertices({ ...o, snowAt: () => 600 });
  let fw = 0;
  for (let v = 0; v < high.length; v++) {
    const s = capShare(f0.positions[v * 3 + 1] - SEA_Y, f0.normals[v * 3 + 1], 600);
    assert.deepEqual([...f1.colors.slice(v * 3, v * 3 + 3)], s > 0 ? [70, 80, 50].map((c, k) => Math.round(c + (SNOWCAP.rgb[k] - c) * s)) : [70, 80, 50], `far ${v}`);
    if (s > 0.9) fw++;
  }
  assert.ok(fw > 5, `the far field white: ${fw}`);
  assert.ok(FAR_SAMPLES.length > 0);
});

// ── WITH ARENA2: THE CAPS ON THE FREEWARE'S RANGES ────────────────

const A = process.env.ARENA2_PATH;
const HAVE = !!A && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(A, f)));

test('PEAKS1 with ARENA2: on the freeware\'s ground every range the relief stands high wears its cap - Skyrim\'s summit, the Jerall, the Wrothgarians and the Dragontails white at their tops, the line under them by their zones; Red Mountain\'s ash and the Alik\'r bare; a corner\'s line one number from the four pixels about it (mutants: a zone\'s line, the zones unread past the Bay)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(A, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const G = await import('../../src/world/tamriel/tamrielGround.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const { createLandforms, landformClimates } = await import('../../src/world/landforms.js');
  const { sampleKernel, MAX_TERRAIN_HEIGHT } = await import('../../src/world/terrain/terrainSampler.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const bay = new WoodsFile(); bay.load(bytes('WOODS.WLD'));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (audittesa2c_capitals.test.js's)
  setTamrielTrace(trace);
  try {
    G.dropGroundCache();
    G.groundMaps(maps);
    const woods = G.groundWoods(bay);
    const lf = createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) });
    const H = (px, py) => sampleKernel(woods, px, py, 129, true, lf)(64, 64) * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE - SEA_Y;
    const climateAt = (x, y) => (G.bayEdgeDistance(x, y) > G.SEAM_PX ? G.tamrielClimateAt(x, y) : maps.getClimateIndex(Math.max(0, Math.min(999, x)), Math.max(0, Math.min(499, y))));
    /** the highest pixel centre within `r` of (x, y), its height and its cap line */
    const top = (x, y, r = 3) => {
      let best = -Infinity, at = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const h = H(x + dx, y + dy); if (h > best) { best = h; at = [x + dx, y + dy]; } }
      return { h: best, at, line: capLineOfPixel(at[0], at[1], climateAt), zone: tamrielBiomeAt(at[0], at[1])?.key ?? null };
    };
    // the summits the probes found (bible/03-World/Peaks.md's table): the relief's own, past the Bay; the Bay's highest
    const white = [
      ['Skyrim\'s summit (the Throat)', 2076, 106, 'skyrimPeaks', 3000],
      ['the Jerall', 2202, 332, 'cyrodiilJerall', 2600],
      ['the Reach\'s shoulder', 1490, 198, ['skyrimPeaks', 'hammerfellDragontail'], 2500],
      ['the Wrothgarians past the Bay', 1130, -92, 'highRockWrothgar', 1400],
      ['the Bay\'s Wrothgarians', 951, 3, null, 1500],
      ['the Bay\'s Dragontails', 964, 442, null, 2300],
    ];
    for (const [name, x, y, zone, least] of white) {
      const t = top(x, y);
      // PIN MOVED (RELIEF-PEAKS, bible/03-World/Tamriel.md): the ranges under the heightmap's grain stand the highest ground
      // about a summit where their crests fall - the Reach's shoulder's on the border of Skyrim's peaks and Hammerfell's
      // Dragontail, its top on either side; each top wears its own zone's cap
      assert.ok([zone].flat().includes(t.zone), `${name}'s zone (${t.zone})`);
      assert.ok(t.h > least, `${name} stands ${t.h.toFixed(0)} m`);
      assert.ok(t.line < t.h - 150, `${name}: its line ${t.line} under its top ${t.h.toFixed(0)}`);
      assert.ok(capCover(t.h, t.line) > 0.95, `${name} white (${capCover(t.h, t.line).toFixed(3)})`);
    }
    for (const [name, x, y, zone] of [['Red Mountain', 3051, -51, 'morrowindRedMountain']]) {
      const t = top(x, y);
      assert.equal(t.zone, zone);
      assert.equal(t.line, CAP_NONE, `${name}: none`);
      assert.ok(t.h > 2000, `${name} stands ${t.h.toFixed(0)} m and bare`);
    }
    let deserts = 0;
    for (let y = 300; y < 500; y += 7) for (let x = 0; x < 1000; x += 7) {
      if (maps.getClimateIndex(x, y) !== CLIMATES.Desert || bay.getHeightMapValue(x, y) < 20) continue;
      deserts++;
      assert.equal(capLineOfPixel(x, y, climateAt), CAP_NONE, `the Alik'r bare at ${x},${y}`);
    }
    assert.ok(deserts > 10, `the Alik'r's high ground: ${deserts}`);
    // a corner past the Bay: the four pixels' mean - one number from either pixel on its edge
    for (const [cx, cy] of [[2076, 106], [2203, 333], [1131, -91]]) {
      const four = [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]].map(([x, y]) => capLineOfPixel(x, y, climateAt));
      assert.equal(capLineAt(cx, cy, climateAt), (four[0] + four[1] + four[2] + four[3]) / 4);
    }
  } finally { setTamrielTrace(null); setTamrielFit(null); G.dropGroundCache(); }
});
