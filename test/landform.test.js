// LANDFORM1-3 (2026-10-06, Mac, with a picture of the Iliac Bay's heightmap: "Can we adjust the heightmap to be more of
// this? and allow roads to carve through terrian and caverns without breaking anything and rivers to actually have
// depth, not just lying flat on land") - THE PORT'S OWN TERRAIN (world/landforms.js), inside the sampler's kernel,
// behind the Features row `landforms`. Pinned with no game data: a synthetic WOODS.WLD the real reader loads (a coast,
// a rising land and one mountain) and a synthetic network in Basic Roads' own layout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generateSamples, ghostSampler, sampleKernel, kernelTerms, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, DEFAULT_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION } from '../src/world/terrainSampler.js';
import { createLandforms, reliefLift, reliefByteHeight, landformLift, LANDFORM_KNEE, LANDFORM_FLOOR, LANDFORM_DIALS, LANDFORM_CEILING } from '../src/world/landforms.js';
import { generateTileData, BEACH_JITTER } from '../src/world/terrainTiles.js';
import { generatePixelTerrain, restrideGrid } from '../src/world/terrainGen.js';
import { DIR } from '../src/world/roadNetwork.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';   // the synthetic world, one home (AUDIT LANDFORMS)
import { ringHeight, buildFarRingGrid } from '../src/render/farRing.js';
import { landformsOn } from '../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { onlineForcedPref } from '../src/systems/onlineLane.js';
import { onlineModSetting } from '../src/systems/modSettings.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { makeAnchor } from '../src/systems/teleportAnchor.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;   // a normalized sample in kernel units
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');

const WOODS_BYTES = syntheticWoodsBytes();
const woods = new WoodsFile();
assert.equal(woods.load(WOODS_BYTES.slice()), true);

const NET = network();
const LF = createLandforms({ woods, roads: NET });
const RELIEF = createLandforms({ woods });   // the lift alone: no network to cut along
const at = (s, x, y) => s[x * H + y];

test('LANDFORM1: at or under the knee a height is DFU\'s to the bit, and over it it stays over it - the sea, the beach and every tile class stand where they stood, a road run down to the shore included', () => {
  assert.equal(LANDFORM_KNEE, 40 + BEACH_JITTER, 'the beach line with its jitter (terrainTiles.js generateTileData)');
  assert.equal(LANDFORM_FLOOR - LANDFORM_KNEE, 0.5, 'half a unit over the knee');   // PIN MOVED (AUDIT LANDFORMS II J4): it was `>`, which +5 and +0.05 both passed
  let under = 0, over = 0;
  for (const [px, py] of [[99, 200], [100, 200], [101, 200], [102, 200], [103, 200], [100, 199], [100, 300], [101, 300], [102, 300], [103, 300], [105, 300]]) {
    const dfu = generateSamples(woods, px, py);
    const shaped = generateSamples(woods, px, py, H, LF);
    for (let i = 0; i < dfu.length; i++) {
      if (Math.fround(dfu[i] * UNIT) <= LANDFORM_KNEE) { under++; assert.ok(Object.is(shaped[i], dfu[i]), `${px},${py} #${i}: under the knee, DFU's own`); }
      else { over++; assert.ok(Math.fround(shaped[i] * UNIT) > LANDFORM_KNEE, `${px},${py} #${i}: over the knee, still over it`); }
    }
    assert.deepEqual([...generateTileData(shaped, px, py)], [...generateTileData(dfu, px, py)], `${px},${py}: the classifier's ground, tile for tile`);
  }
  assert.ok(under > 20000 && over > 20000, `both sides walked (${under} under, ${over} over)`);
  // the shore road fades in over the coast band rather than stepping at the knee: along it, no neighbour pair parts
  // further than DFU's own steepest pair there
  for (const py of [200, 300]) {   // the road, and the river (the one that drops under its land)
    for (const px of [100, 101, 102]) {
      const dfu = generateSamples(woods, px, py), shaped = generateSamples(woods, px, py, H, LF);
      const steep = (s) => { let m = 0; for (let x = 0; x < H - 1; x++) for (const y of [62, 64, 66]) m = Math.max(m, Math.abs(at(s, x + 1, y) - at(s, x, y))); return m * UNIT; };
      assert.ok(steep(shaped) <= steep(dfu) + 0.5, `${px},${py}: no step where the path meets the beach (${steep(shaped).toFixed(2)} vs DFU's ${steep(dfu).toFixed(2)})`);
    }
  }
  // and the shaper itself at its worst - ground noise at its top (10) over a macro height just under the knee, on the
  // river's centre line: the fade and the floor between them never take it under the knee, and a sample barely over
  // the knee is barely moved
  const shape = LF.pixel(101, 300);
  const { base } = kernelTerms(woods, 101, 300);
  const kernel = sampleKernel(woods, 101, 300, H, false, null);
  let tried = 0;
  for (let x = 0; x <= 128; x++) {
    const macro = kernel(x, 64) * UNIT;
    if (!(macro > LANDFORM_KNEE - 12 && macro < LANDFORM_KNEE)) continue;
    tried++;
    for (const g of [2, 6, 10]) {
      const h = macro + g;
      if (!(h > LANDFORM_KNEE)) continue;
      const out = shape(x, 64, h, base(x, 64) * 8, g);
      assert.ok(out > LANDFORM_KNEE, `x=${x} g=${g}: ${out.toFixed(3)} stays over the knee`);
      if (h - LANDFORM_KNEE < 0.25) assert.ok(Math.abs(out - h) < 0.02, `x=${x} g=${g}: a hair over the knee, a hair moved`);
    }
  }
  assert.ok(tried > 0, 'the river crosses the coast band');
});

test('LANDFORM1: the small heightmap is lifted - nothing under the median land, then a smooth rise to 1.9 x its own term at the top; the ring takes the same lift', () => {
  const { from, full, gain } = LANDFORM_DIALS.relief;
  assert.deepEqual([from, full, gain], [200, 900, 0.9]);
  assert.equal(reliefLift(LANDFORM_KNEE + from), 0, 'nothing at the start of the rise');
  assert.equal(reliefLift(LANDFORM_KNEE), 0);
  assert.equal(reliefLift(SCALED_OCEAN_ELEVATION), 0);
  assert.ok(Math.abs(reliefLift(LANDFORM_KNEE + 550) - 0.9 * 550 * 0.5) < 1e-9, 'half-way up the rise, half the gain');
  assert.ok(Math.abs(reliefLift(LANDFORM_KNEE + 375) - 0.9 * 375 * 0.15625) < 1e-9, 'a quarter of the way, eased (smoothstep), not a straight ramp');
  assert.ok(Math.abs(reliefLift(LANDFORM_KNEE + 900) - 0.9 * 900) < 1e-9, 'fully risen');
  assert.ok(Math.abs(reliefLift(LANDFORM_KNEE + 950) - 0.9 * 950) < 1e-9);
  let last = 0;
  for (let low = 0; low <= 1100; low += 0.5) { const l = reliefLift(low); assert.ok(l >= last - 1e-12, `never falls (${low})`); assert.ok(l - last < 2, `never jumps (${low})`); last = l; }
  // the ring: a byte's macro height with the same lift; untouched with the row off; the lowlands the same either way
  assert.equal(ringHeight(100), 100 * 8 * STREAMING_TERRAIN_SCALE);
  assert.equal(ringHeight(100, true), reliefByteHeight(100) * STREAMING_TERRAIN_SCALE);
  assert.equal(reliefByteHeight(100), 800 + reliefLift(800));
  assert.ok(ringHeight(127, true) > ringHeight(127) * 1.5, 'the top stands half as tall again and more');
  assert.ok(Math.abs((reliefByteHeight(127) - LANDFORM_KNEE) / (127 * 8 - LANDFORM_KNEE) - 1.9) < 1e-12, 'the top byte: 1.9 x its own term over the knee, as the title says (AUDIT LANDFORMS D6)');
  assert.equal(ringHeight(20, true), ringHeight(20), 'the lowlands are DFU\'s');
  assert.equal(ringHeight(0, true), SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE, 'the sea is the sea');
  const grid = (relief) => buildFarRingGrid({ heightBytes: woods.heightMapBuffer, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, climateAt: () => 231, baseX: 400, baseY: 250, radius: 2, relief });
  assert.ok(grid(true).positions[(2 * 5 + 2) * 3 + 1] > grid(false).positions[(2 * 5 + 2) * 3 + 1] + 500, 'the ring\'s summit is raised');
  // the streamed kernel: the mountain stands taller, its lowland flank does not move
  const dfu = generateSamples(woods, 400, 250), shaped = generateSamples(woods, 400, 250, H, LF);
  assert.ok(Math.max(...shaped) * UNIT > Math.max(...dfu) * UNIT * 1.5, 'the summit');
  assert.ok(Math.max(...shaped) > 1, 'a raised mountain stands over the reference\'s normalising height, not flattened against it');
  const low = generateSamples(woods, 150, 100), lowShaped = generateSamples(woods, 150, 100, H, RELIEF);
  assert.ok(low.every((v, i) => Object.is(v, lowShaped[i])), 'a lowland pixel with no path near it is DFU\'s to the bit');
});

test('LANDFORM1: nothing stands over the ceiling - the shaper takes DFU\'s height as DFU clamps it and the lift is level past the 7-bit top, so WOODS.WLD\'s one glitch byte stands at the landforms\' ceiling as DFU stands it at its own', () => {
  // the shipped file carries one byte over 127: a 255 at map pixel (470, 355), in the sea off Tigonus - DFU's
  // kernel stands it at its ceiling, a 1.9 km pillar; unclamped and lifted it was 5 km
  assert.equal(LANDFORM_CEILING, MAX_TERRAIN_HEIGHT + reliefLift(127 * 8));
  assert.ok(Math.abs(LANDFORM_CEILING * STREAMING_TERRAIN_SCALE - 3020.06) < 0.01, 'about 3 km');
  assert.equal(reliefLift(255 * 8), reliefLift(127 * 8), 'the lift is level past the top');
  assert.ok(reliefLift(126 * 8) < reliefLift(127 * 8), '...and rising up to it');
  const bytes = WOODS_BYTES.slice();
  bytes[new DataView(bytes.buffer).getUint32(28, true) + 400 * MAP_WIDTH + 150] = 255;   // in a lowland with no sea byte within three pixels - the shipped one has one a diagonal step off, where the lift fades (AUDIT LANDFORMS II I1)
  const glitch = new WoodsFile();
  assert.equal(glitch.load(bytes), true);
  // a road down the diagonal through the byte's own sample - (150, 400)'s south-east corner - so its grade is read there
  const net = network();
  net.roads[400 * MAP_WIDTH + 150] |= DIR.SE | DIR.NW;
  net.roads[401 * MAP_WIDTH + 151] |= DIR.SE | DIR.NW;
  const cut = createLandforms({ woods: glitch, roads: net }), relief = createLandforms({ woods: glitch });
  let dfuTop = 0, top = 0, roadAtCorner = 0, worst = 0;
  for (const [px, py] of [[150, 400], [151, 400], [150, 401], [151, 401], [149, 400]]) {
    const v = generateSamples(glitch, px, py, H, null), r = generateSamples(glitch, px, py, H, relief), c = generateSamples(glitch, px, py, H, cut);
    const { base } = kernelTerms(glitch, px, py, H);
    for (let x = 0; x < H; x += 4) for (let y = 0; y < H; y += 4) {
      const i = x * H + y;
      dfuTop = Math.max(dfuTop, v[i]); top = Math.max(top, r[i], c[i]);
      worst = Math.max(worst, Math.abs((r[i] - v[i]) * UNIT - reliefLift(base(x, y) * 8)));
    }
    if (px === 150 && py === 400) roadAtCorner = c[128 * H];
  }
  assert.equal(dfuTop, 1, 'DFU stands the glitch at its ceiling');
  assert.ok(Math.abs(top * UNIT - LANDFORM_CEILING) < 1e-3, `the landforms stand it at theirs (${(top * UNIT).toFixed(2)})`);
  assert.ok(Math.abs(roadAtCorner * UNIT - LANDFORM_CEILING) < 1e-3, 'a road graded over it is graded to the same - DFU\'s macro as DFU stands it');
  assert.ok(worst < 1e-3, `and the relief's lift is reliefLift of the kernel's own small-heightmap term, the glitch's pixels too (${worst})`);   // AUDIT LANDFORMS II J9: the re-stand's field is the cuts' too since B2 - this is the lift alone
  assert.ok(Math.abs(reliefByteHeight(255) - 255 * 8 - reliefLift(127 * 8)) < 1e-9, 'the ring takes the same lift');
});

test('LANDFORM1-3: a seam is one number from both pixels - every shared edge and corner, across the road, the river, the stream and the diagonal track; and the ghost rows are the neighbour\'s shaped ground', () => {
  const pixels = [[300, 249], [300, 250], [301, 250], [299, 250], [300, 255], [301, 255], [291, 243], [292, 243], [312, 248], [313, 248]];
  const cache = new Map();
  const S = (px, py) => { const k = `${px},${py}`; if (!cache.has(k)) cache.set(k, generateSamples(woods, px, py, H, LF)); return cache.get(k); };
  let n = 0;
  for (const [px, py] of pixels) {
    const a = S(px, py), east = S(px + 1, py), north = S(px, py - 1), ne = S(px + 1, py - 1);
    for (let y = 0; y < H; y++) { n++; assert.ok(Object.is(at(a, 128, y), at(east, 0, y)), `${px},${py} east edge y=${y}`); }
    for (let x = 0; x < H; x++) { n++; assert.ok(Object.is(at(a, x, 128), at(north, x, 0)), `${px},${py} north edge x=${x}`); }
    assert.ok(Object.is(at(a, 128, 128), at(ne, 0, 0)), 'the corner four pixels share');
    const ghost = ghostSampler(woods, px, py, H, LF);   // the kernel's double; a pixel keeps its float32
    for (const y of [0, 17, 64, 111, 128]) {
      assert.ok(Object.is(Math.fround(ghost(129, y)), at(east, 1, y)), `${px},${py}: the east ghost row is the neighbour's own (y=${y})`);
      assert.ok(Object.is(Math.fround(ghost(y, 129)), at(north, y, 1)), `${px},${py}: the north ghost row (x=${y})`);
    }
  }
  assert.ok(n > 2500);
  // the diagonal track runs down x == y of each pixel it crosses (NE, up the map's north), as the painter paints it
  const tr = S(293, 241), trLift = generateSamples(woods, 293, 241, H, RELIEF);
  for (const k of [20, 64, 100]) {
    assert.ok(!Object.is(at(tr, k, k), at(trLift, k, k)), `(${k},${k}): on the track's diagonal, cut`);
    assert.ok(Object.is(at(tr, k, 128 - k), at(trLift, k, 128 - k)) || Math.abs(k - 64) < 10, `(${k},${128 - k}): across from it, the land`);
  }
  // and the cut is really there at the seams it was checked on: the road's own edge rows differ from the relief alone
  const road = S(300, 250), lifted = generateSamples(woods, 300, 250, H, RELIEF);
  assert.ok(Math.abs(at(road, 64, 128) - at(lifted, 64, 128)) * UNIT > 0.01 || Math.abs(at(road, 64, 0) - at(lifted, 64, 0)) * UNIT > 0.01, 'the road is cut through the pixel edge');
});

test('LANDFORM2: a road is graded level across to the kernel\'s own macro height - the ground noise cut away, the land untouched past its verge', () => {
  const px = 300, py = 250;
  const cut = generateSamples(woods, px, py, H, LF);
  const lifted = generateSamples(woods, px, py, H, RELIEF);
  const macro = sampleKernel(woods, px, py, H, false, RELIEF);   // the lift on the two bicubic terms, no ground noise
  const { flat, bank, verge } = LANDFORM_DIALS.road;
  assert.deepEqual([flat, bank, verge, LANDFORM_DIALS.road.drop], [1.25, 2.5, 6, 0]);
  let cutAway = 0;
  for (let y = 0; y <= 128; y++) {   // PIN MOVED (AUDIT LANDFORMS D5): it ran 4..124, and the hand-over between two pixels' arms is in the rows it skipped
    const bed = at(cut, 64, y);
    assert.ok(Math.abs(bed - macro(64, y)) * UNIT < 1e-3, `y=${y}: the bed is the macro height on the centre line - the arm alongside grades it, at the centre and the pixel edge too`);
    for (const x of [63, 65]) assert.ok(Math.abs(at(cut, x, y) - bed) * UNIT < 0.05, `y=${y}: level across (x=${x})`);
    for (const x of [53, 54, 74, 75]) assert.ok(Object.is(at(cut, x, y), at(lifted, x, y)), `y=${y}: past the verge the land is the land (x=${x})`);
    cutAway = Math.max(cutAway, (at(lifted, 64, y) - bed) * UNIT);
  }
  assert.ok(cutAway > 1, `the ground noise is cut out of the bed (up to ${cutAway.toFixed(2)} units)`);
  // the bank runs from the bed toward the smooth land, never past it - up on the high side, down on the low side (PIN
  // MOVED, AUDIT LANDFORMS E1: the low side was a level shelf, which passed a check against the land with noise trivially)
  for (const y of [30, 90]) {
    const bed = at(cut, 64, y);
    for (const x of [61, 67]) {
      const v = at(cut, x, y), smooth = macro(x, y);
      assert.ok((v - bed) * (smooth - bed) >= 0 && Math.abs(v - bed) <= Math.abs(smooth - bed) + 1e-7, `y=${y} x=${x}: the bank lies between the bed and the smooth land`);
    }
  }
});

test('LANDFORM3: a river\'s water lies level across its whole painted width, under its banks - with the rivers off there is no channel, and online the switch is the room\'s, on', () => {
  const px = 300, py = 255, x = 20;   // twenty samples west of the road that crosses it
  const cut = generateSamples(woods, px, py, H, LF);
  const lifted = generateSamples(woods, px, py, H, RELIEF);
  const macro = sampleKernel(woods, px, py, H, false, RELIEF);
  const { flat, drop } = LANDFORM_DIALS.river;
  assert.deepEqual([flat, drop], [2, 1.92]);
  const floor = macro(x, 64) * UNIT - drop;
  for (let y = 64 - flat; y <= 64 + flat; y++) assert.ok(Math.abs(at(cut, x, y) * UNIT - floor) < 0.02, `y=${y}: the water's floor, ${(drop * STREAMING_TERRAIN_SCALE).toFixed(1)} m under the land it is graded to`);
  for (const y of [61, 67]) assert.ok(at(cut, x, y) * UNIT > floor + 0.2, `y=${y}: the bank stands over the water`);
  assert.ok(at(lifted, x, 64) * UNIT - floor > drop, 'the channel is cut into the field');
  // rivers off (RiversAndStreams): painted nowhere, cut nowhere - so the switch MOVES THE GROUND, and online, where a
  // room stands on one ground, it is the room's: on (2026-10-06, Mac: "Yes rivers should be online")
  const dry = network({ water: false });
  const off = generateSamples(woods, px, py, H, createLandforms({ woods, roads: dry }));
  for (let y = 54; y <= 74; y++) assert.ok(Object.is(at(off, x, y), at(lifted, x, y)), `y=${y}: no painted river, no channel`);
  assert.ok(at(off, x, 64) - at(cut, x, 64) > 0, 'the river switch moves the ground under the river');
  assert.ok(!Object.is(at(off, 64, 30), at(lifted, 64, 30)), 'and the road is cut either way');
  assert.equal(createLandforms({ woods, roads: dry }).rivers, false);
  assert.equal(LF.rivers, true);
  assert.equal(onlineModSetting('roads-hazelnut', 'RiversAndStreams', '?online=1'), true, 'online the room\'s rivers are painted, and so cut (onlineLane.js ONLINE_ROOM_MOD_KEYS)');
  assert.equal(onlineModSetting('roads-hazelnut', 'RiversAndStreams', ''), undefined, 'offline the switch is the player\'s');
  // where the road crosses it the road wins, as its paint does: a causeway level across at the road's own grade
  for (const rx of [63, 64, 65]) assert.ok(Math.abs(at(cut, rx, 64) * UNIT - macro(64, 64) * UNIT) < 0.02, `x=${rx}: the road over the river`);
  // the pipeline - the same job online and off - cuts the river wherever its network paints one
  const piped = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: { ...NET, smooth: false }, landform: true }).samples;
  for (let y = 54; y <= 74; y++) assert.ok(Object.is(at(piped, x, y), at(cut, x, y)), `the job, y=${y}: the channel`);
  const pipedDry = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: { ...dry, smooth: false }, landform: true }).samples;
  for (let y = 54; y <= 74; y++) assert.ok(Object.is(at(pipedDry, x, y), at(lifted, x, y)), `the job with the rivers off, y=${y}: no channel`);
  // a stream: level across its two painted tiles, a metre under
  assert.deepEqual(Object.values(LANDFORM_DIALS.stream), [1, 1.25, 4, 0.8]);
  const s = generateSamples(woods, 312, 248, H, LF), sm = sampleKernel(woods, 312, 248, H, false, RELIEF);
  for (const sx of [63, 64, 65]) assert.ok(Math.abs(at(s, sx, 40) * UNIT - (sm(64, 40) * UNIT - LANDFORM_DIALS.stream.drop)) < 0.02, `stream x=${sx}`);
});

test('LANDFORM1-3: the build\'s own grid reads the shaped ground past its edges - its edge normals are the neighbours\' cut ground, not DFU\'s', () => {
  const out = generatePixelTerrain({ woods, px: 300, py: 250, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: NET, landform: true });
  const want = restrideGrid({ woods, px: 300, py: 250, stride: 1, samples: out.samples, landform: true, roads: NET });
  assert.deepEqual([...out.normals], [...want.normals]);
  const raw = restrideGrid({ woods, px: 300, py: 250, stride: 1, samples: out.samples });
  assert.notDeepEqual([...out.normals], [...raw.normals], 'and those differ from the raw ghost rows where the road crosses the edge');
});

test('LANDFORM1: a point\'s lift is the lift field taken through the location\'s own blend - exact over a town\'s levelled ground, exact in the wild (the real pipeline, with and without the row)', () => {
  const px = 330, py = 250;   // on the mountain's flank, where the lift is large and uneven (its bytes under the 7-bit top)
  const rect = { xMin: 40, xMax: 80, yMin: 50, yMax: 90 };
  const run = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, landform }).samples;
  const dfu = run(false), shaped = run(true);
  for (const [sx, sy] of [[60, 70], [41, 51], [79, 89], [20, 70], [60, 110], [5, 5], [120, 20], [100, 100]]) {
    const want = (at(shaped, sx, sy) - at(dfu, sx, sy)) * UNIT;
    assert.ok(Math.abs(landformLift(woods, px, py, sx, sy, rect) - want) < 0.01, `(${sx},${sy}): ${landformLift(woods, px, py, sx, sy, rect).toFixed(3)} vs the pipeline's ${want.toFixed(3)}`);   // AUDIT LANDFORMS D7: 0.05 was fifty times the agreement
  }
  assert.ok(Math.abs(landformLift(woods, px, py, 60, 70, rect) - landformLift(woods, px, py, 45, 55, rect)) < 1e-6, 'the whole levelled ground rises as one');
  assert.ok(landformLift(woods, px, py, 60, 70, rect) > 50, 'and it rises');
  assert.ok(Math.abs(landformLift(woods, px, py, 60, 70) - landformLift(woods, px, py, 45, 55)) > 1, 'where the wild lift is uneven over the same two points');
  const wild = generatePixelTerrain({ woods, px, py: 230, tilemap: new Uint8Array(128 * 128), climateType: 231, landform: true }).samples;
  const wildDfu = generatePixelTerrain({ woods, px, py: 230, tilemap: new Uint8Array(128 * 128), climateType: 231, landform: false }).samples;
  assert.ok(Math.abs(landformLift(woods, px, 230, 33, 77) - (at(wild, 33, 77) - at(wildDfu, 33, 77)) * UNIT) < 1e-3, 'in the wild: reliefLift of the kernel\'s own small-heightmap term');
});

/** world.js's own groundFrameHeight, groundFrameNative and restandHeight, sliced and run against a stub ground and a stub
 *  lift (terrainscale1.test.js's harness, with the landforms' two reads; test/auditlandforms.test.js runs the real lift). */
function restander({ ground, comp = 0, landform = false, lift = () => 0 }) {
  const i = WORLD.indexOf('  const groundFrameHeight = (y, x, z) =>');
  const j = WORLD.indexOf('  // Building doors (P3)', i);
  assert.ok(i > 0 && j > i && WORLD.slice(i, j).includes('  const restandHeight = (y, x, z, was) => {'));
  const state = { compensation: [0, comp, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  const heightAt = (x, z) => (ground(x, z) == null ? -Infinity : ground(x, z) + comp);
  return new Function('heightAt', 'state', 'STREAMING_TERRAIN_SCALE', 'DEFAULT_TERRAIN_SCALE', 'landform', 'landformLiftAt', `${WORLD.slice(i, j)}\nreturn { groundFrameHeight, groundFrameNative, restandHeight };`)(heightAt, state, STREAMING_TERRAIN_SCALE, DEFAULT_TERRAIN_SCALE, landform, lift);
}

test('LANDFORM1: a record\'s height is DFU\'s frame - written with the landforms\' lift at its own spot taken off, stood again with it put back on; with the row off it lands as it came', () => {
  // AUDIT LANDFORMS C1 MOVED THIS PIN: it ran a stamp (`landforms: true`) that told a reader whose ground a height stood
  // on - and a build that never knew the stamp (a desktop copy not yet updated, a revert) stood a landforms save's every
  // height the lift over its ground. A record is DFU's frame now, whatever the row: nothing to tell.
  const L = 140, g = 500;   // the lift at the spot, and DFU's ground there
  const on = restander({ ground: (x) => (x < 1000 ? g + L : null), comp: 21, landform: true, lift: () => L });
  assert.equal(on.groundFrameHeight(g + L + 3, 10, 10), g + 3, 'written with the row on: 3 over DFU\'s ground');
  assert.equal(on.groundFrameNative(110, 210, g + L + 3), g + 3, '...a record in natives the same');
  assert.equal(on.restandHeight(g + 3, 10, 10, 1.25), g + L + 3, 'read with the row on: the lift put back on');
  assert.equal(on.restandHeight(g + 3, 5000, 10, 1.25), g + L + 3, '...where the ground is not built too');
  // and read where the row is off - this build with it off, or a build without it: 3 over DFU's ground, as it stood
  const off = restander({ ground: (x) => (x < 1000 ? g : null), comp: 21, landform: false, lift: () => L });
  assert.equal(off.restandHeight(on.groundFrameHeight(g + L + 3, 10, 10), 10, 10, 1.25), g + 3);
  assert.equal(off.groundFrameHeight(g + 3, 10, 10), g + 3, 'written with the row off: DFU\'s frame is the ground\'s own');
  assert.equal(off.groundFrameNative(110, 210, g + 3), g + 3);
  assert.equal(off.restandHeight(123.4, 10, 10, 1.25), 123.4, 'and read with it off: as it came');
  assert.equal(off.restandHeight(123.4, 5000, 10, 1.25), 123.4);
  // the lift is the one at the record's OWN spot, scene coordinates for a height and natives through the frame for a row
  const spot = restander({ ground: () => null, landform: true, lift: (x, z) => 2 * x + z });
  assert.equal(spot.groundFrameHeight(100, 7, 5), 81);
  assert.equal(spot.groundFrameNative(107, 205, 100), 81);
  assert.equal(spot.restandHeight(81, 7, 5, 1.25), 100, 'the round trip is exact');
  assert.ok(Number.isNaN(spot.groundFrameHeight(NaN, 7, 5)) && spot.groundFrameHeight(-Infinity, 7, 5) === -Infinity, 'a height that is no number passes as it came');
  // the scale's arm and the land's together: a 1.5 save of DFU's ground, now on the landforms at 1.25
  const sample = 0.3, gOld = sample * MAX_TERRAIN_HEIGHT * 1.5, gNew = sample * MAX_TERRAIN_HEIGHT * 1.25;
  const both = restander({ ground: (x) => (x < 1000 ? gNew + L : null), comp: 21, landform: true, lift: () => L });
  assert.ok(Math.abs(both.restandHeight(gOld + 6.5, 10, 10, 1.5) - (gNew + L + 6.5)) < 1e-6, 'on a roof on the old scale: the same 6.5 over today\'s ground');
  assert.ok(Math.abs(both.restandHeight(gOld, 5000, 10, 1.5) - (gNew + L)) < 1e-6, 'unbuilt: the ratio on DFU\'s part, the lift on top');
  // and with the row off the old scale's height takes the scale's arm alone - no lift, built or not
  const offOld = restander({ ground: (x) => (x < 1000 ? gNew : null), comp: 21, landform: false, lift: () => L });
  assert.ok(Math.abs(offOld.restandHeight(gOld + 6.5, 10, 10, 1.5) - (gNew + 6.5)) < 1e-6, 'the row off, the old scale: the same 6.5 over DFU\'s ground');
  assert.ok(Math.abs(offOld.restandHeight(gOld, 5000, 10, 1.5) - gNew) < 1e-6);
});

test('LANDFORM1: no record carries whose ground it stood on - the save, the scene cache, the anchor, the deck and a dungeon\'s outer camps are DFU\'s frame, so every build reads them as it always read one', () => {
  // AUDIT LANDFORMS C1 MOVED THIS PIN: it pinned the stamp each carried (`landforms: true`) and the reads of it
  for (const f of ['src/systems/save.js', 'src/systems/sceneCache.js', 'src/systems/teleportAnchor.js', 'src/systems/ship.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.equal(src(f).includes('landforms'), false, `${f}: no stamp`);
  }
  assert.equal(/landforms: !!landform|landOf\(|wasLand|savedLand/.test(WORLD), false, 'the host writes none and reads none');
  const entity = { items: [], stats: {} };
  assert.equal(Object.hasOwn(snapshotPlayer(entity, {}), 'landforms'), false);
  assert.equal(Object.hasOwn(makeAnchor({ pixel: { x: 1, y: 2 }, nativeX: 0, nativeZ: 0, y: 5, terrainScale: 1.25 }), 'landforms'), false);
  const cache = createSceneCache();
  cacheScene(cache, 'A', { droppedPiles: [], terrainScale: 1.25 });
  const round = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  assert.equal(restoreCachedScene(round, 'A').landforms, undefined);
  assert.equal(restorePlayer(entity, snapshotPlayer(entity, {})).landforms, undefined);
});

test('LANDFORM1-3: the switch is the Features row on the enhanced skin, the room\'s ground online, and ?landforms=off offline', () => {
  const skin = uiSkin(), pref = getPref('landforms');
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('landforms', true);
    assert.equal(landformsOn(''), true);
    assert.equal(landformsOn('?landforms=off'), false, 'the kill door');
    setPref('landforms', false);
    assert.equal(landformsOn(''), false, 'the row is the switch');
    assert.equal(landformsOn('?online=1'), true, 'online it is the room\'s ground');
    setPref('landforms', true); setUiSkin('classic');
    assert.equal(landformsOn(''), false, 'the classic skin keeps DFU\'s ground to the bit');
    assert.equal(landformsOn('?online=1&landforms=off'), true, 'the kill door is offline\'s');
  } finally { setUiSkin(skin); setPref('landforms', pref); }
  assert.equal(onlineForcedPref('landforms', '?online=1'), true);
  const row = FEATURES.find((f) => f.id === 'landforms');
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'landforms', initial: true, online: true });
  assert.equal(row.effect, 'Takes effect when the world next loads.');
});

test('LANDFORM1-3: the host reads the row once, cuts every pixel and every promotion with it, raises the ring and the beacon by it, and stands every record\'s height again by it', () => {
  assert.match(WORLD, /\n  const landform = landformsOn\(\);\n/, 'once, at the mount - the same job online and off: the room\'s river switch decides online');
  assert.match(WORLD, /const landformsHere = \(\) => \(landform \? createLandforms\(\{ woods, roads: terrainGen\.roads\(\) \}\) : null\);/, 'this thread\'s landforms, over its own network');
  assert.equal((WORLD.match(/landformsOn\(/g) ?? []).length, 1);
  assert.match(WORLD, /\n      landform,   \/\/ LANDFORM1-3: the shaped ground, cut along the kernel's own network\n    \}\);/, 'the pixel job');
  assert.match(WORLD, /terrainGen\.grid\(\{ px: p\.px, py: p\.py, stride: 1, samples: p\.samples, landform \}\)/, 'the promotion off the thread');
  assert.match(WORLD, /grid = restrideGrid\(\{ woods, px: p\.px, py: p\.py, stride, samples: p\.samples, landform, roads: terrainGen\.roads\(\) \}\)/, 'and on it');
  assert.match(WORLD, /_gateKernel = sampleKernel\(woods, px, py, HEIGHTMAP_DIMENSION, true, landformsHere\(\)\);/, 'the gate\'s beacon stands on the shaped ground');
  assert.match(WORLD, /relief: !!landform,   \/\/ LANDFORM1: the ring stands the massifs/, 'the far ring');
  assert.match(WORLD, /ringHeight\(byte, !!landform, fade\)/, 'the travel view past the built grid');   // PIN MOVED (AUDIT LANDFORMS II I1): faded beside the sea, as the ring is
  // AUDIT LANDFORMS C1 MOVED THESE PINS: they read a stamp - every record is DFU's frame now, the row's lift put back on at
  // every read (test/auditlandforms.test.js runs each path, row on and off)
  assert.match(WORLD, /const today = was === STREAMING_TERRAIN_SCALE && !landform;/, 'the quickload');
  assert.match(WORLD, /const rows = savedScale === STREAMING_TERRAIN_SCALE && !landform \? outer : outer\.map/, 'the camps left outside');
  assert.match(WORLD, /return restandHeight\(y, x, z, was\); \};   \/\/ LANDFORM1: the row's lift put back on\n    droppedLoot\.restoreWorld\(arrived/, 'the exterior scene cache');
  const tg = src('src/world/terrainGen.js');
  // AUDIT LANDFORMS D3 MOVED THIS PIN: the same pass writes DFU's own samples beside, for a location's tiles
  assert.match(tg, /const landforms = landform \? createLandforms\(\{ woods, roads \}\) : null;\n(?:  \/\/[^\n]*\n)*  const classic = landforms && hasLocation \? new Float32Array\(HEIGHTMAP_DIMENSION \* HEIGHTMAP_DIMENSION\) : null;\n  const samples = generateSamples\(woods, px, py, HEIGHTMAP_DIMENSION, landforms, classic\);/, 'the kernel cuts along the network the painter paints');
  assert.match(tg, /const lf = landforms \?\? \(landform \? createLandforms\(\{ woods, roads \}\) : null\);/, 'and a promotion\'s ghost rows along the same');
  assert.match(src('src/world/terrainGenWorker.js'), /if \(m\.t === 'grid' && m\.landform && pendingRoads\) \{ pendingRoads\.then\(\(\) => handle\(m\)\); return; \}/, 'a landforms promotion waits for the network its pixel was cut along');
});

test('LANDFORM1-3: the worker cuts what this thread cuts - a job and a promotion, byte for byte', async () => {
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js?landform');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: WOODS_BYTES.slice() } });
    const copy = (n) => ({ roads: n.roads.slice(), tracks: n.tracks.slice(), rivers: n.rivers.slice(), streams: n.streams.slice(), water: n.water, smooth: n.smooth });
    globalThis.onmessage({ data: { t: 'roads', net: copy(NET) } });
    const job = { px: 300, py: 255, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: 231, landform: true };
    globalThis.onmessage({ data: { t: 'job', ...job, tilemap: job.tilemap.slice() } });
    const done = posted.findLast((m) => m.t === 'done');
    const here = generatePixelTerrain({ woods, roads: NET, ...job });
    assert.deepEqual([...done.samples], [...here.samples], 'the samples');
    assert.deepEqual([...done.normals], [...here.normals], 'the edge normals - the ghost rows cut too');
    globalThis.onmessage({ data: { t: 'grid', id: 3, px: 300, py: 255, stride: 4, samples: here.samples, landform: true } });
    const grid = posted.findLast((m) => m.t === 'grid');
    const want = restrideGrid({ woods, px: 300, py: 255, stride: 4, samples: here.samples, landform: true, roads: NET });
    assert.deepEqual([...grid.normals], [...want.normals], 'a promotion\'s ghost rows are cut along the same network');
  } finally { globalThis.postMessage = prevPost; globalThis.onmessage = prevOn; }
});
