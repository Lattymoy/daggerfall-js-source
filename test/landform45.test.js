// LANDFORM4-5 (2026-10-07, Mac, of a town walled in by its own levelling: "I dont care about DFU. I want detailed
// generation, rolling hills, varied terrian. This isnt about being 1:1") - A TOWN STANDS IN ITS LAND and THE LAND ROLLS
// (world/landforms.js). Pinned with no game data, on the landforms' synthetic world (test/landformWorld.mjs) and a steep
// upland stamped into it - the shape the field shot showed: a town levelled to its pixel's mean on a lifted hillside.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile, MAP_WIDTH } from '../src/formats/woodsFile.js';
import { generateSamples, sampleKernel, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';
import { createLandforms, landformSites, hillsAt, hillsTopOf, LANDFORM_KNEE, LANDFORM_FLOOR, LANDFORM_DIALS } from '../src/world/landforms.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { generatePixelTerrain, restrideGrid } from '../src/world/terrainGen.js';
import { locationFootprintRect, getLocationTerrainTileOrigin } from '../src/world/terrainTiles.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;
const M = UNIT * STREAMING_TERRAIN_SCALE;   // a normalized sample in metres
const at = (s, x, y) => s[x * H + y];
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const load = (bytes) => { const w = new WoodsFile(); assert.equal(w.load(bytes), true); return w; };

const woods = load(syntheticWoodsBytes());
const NET = network();
/** A steep upland: bytes rising 5 a pixel eastward from 60 at x = 600 to the 7-bit top, rows 230..269 - lifted, about
 *  150 m of rise across a pixel, the hillside the field shot's town was levelled into. */
const UPLAND_BYTES = (() => {
  const b = syntheticWoodsBytes(), hm = new DataView(b.buffer).getUint32(28, true);
  for (let y = 230; y < 270; y++) for (let x = 590; x < 630; x++) b[hm + y * MAP_WIDTH + x] = Math.max(60, Math.min(127, 60 + 5 * (x - 600)));
  return b;
})();
const upland = load(UPLAND_BYTES.slice());
const loc = (w, h, type = 0) => ({ exterior: { exteriorData: { width: w, height: h, blockNames: ['X'] } }, mapTableData: { locationType: type } });
const TOWNS = [{ px: 605, py: 250, loc: loc(4, 4) }, { px: 610, py: 245, loc: loc(6, 6) }, { px: 602, py: 260, loc: loc(2, 2, 3) }];
const SITES = landformSites(TOWNS);
const townAt = (px, py) => TOWNS.find((t) => t.px === px && t.py === py);

/** The steepest 51 m grade (8 samples - the bible's measure) over a pixel's 3x3, each pixel built as the game builds it:
 *  the pipeline, its location's own rect and DFU's blend after the kernel. */
function steepest(w, px, py, { sites = null, located = true } = {}) {
  const N = 3 * 128 + 1, F = new Float64Array(N * N);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = located ? townAt(px + dx, py + dy) : null;
    const s = generatePixelTerrain({ woods: w, px: px + dx, py: py + dy, tilemap: new Uint8Array(128 * 128), climateType: 231, sites, landform: true, hasLocation: !!t, locationRect: t ? locationFootprintRect(t.loc) : null }).samples;
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) F[((dx + 1) * 128 + x) * N + ((1 - dy) * 128 + y)] = s[x * H + y] * M;
  }
  let g = 0;
  for (let x = 0; x + 8 < N; x++) for (let y = 0; y + 8 < N; y++) {
    const a = F[x * N + y];
    g = Math.max(g, Math.abs(F[(x + 8) * N + y] - a), Math.abs(F[x * N + y + 8] - a));
  }
  return Math.atan(g / 51.2) * 180 / Math.PI;
}

test('LANDFORM4: a town stands in its land - levelled on a lifted hillside it was walled in (DFU levels it to its pixel\'s mean and ramps back to raw ground by the pixel\'s edge); pulled to its level past its pixel, no grade round it steeper than the bare land\'s', () => {
  for (const { px, py, loc: l } of TOWNS.slice(0, 2)) {
    const walled = steepest(upland, px, py), stands = steepest(upland, px, py, { sites: SITES }), bare = steepest(upland, px, py, { located: false });
    const size = `${l.exterior.exteriorData.width}x${l.exterior.exteriorData.height}`;
    assert.ok(walled > bare + 12, `${size} at ${px},${py}: the wall the levelling stood (${walled.toFixed(1)} degrees on land of ${bare.toFixed(1)})`);
    assert.ok(stands <= bare + 1, `${size} at ${px},${py}: pulled, ${stands.toFixed(1)} degrees on land of ${bare.toFixed(1)} - no wall`);
  }
  // a hamlet's small rect was walled less, and stands in its land as well
  const [h] = TOWNS.slice(2), small = steepest(upland, h.px, h.py, { sites: SITES }), bareSmall = steepest(upland, h.px, h.py, { located: false }), walledSmall = steepest(upland, h.px, h.py);
  assert.ok(walledSmall > bareSmall + 3, `the hamlet's wall (${walledSmall.toFixed(1)} degrees on land of ${bareSmall.toFixed(1)})`);
  assert.ok(small <= bareSmall + 1, `the hamlet: ${small.toFixed(1)} degrees on land of ${bareSmall.toFixed(1)}`);
});

test('LANDFORM4: a site\'s rect stands at its level, the pixel\'s mean, so DFU\'s own blend after the kernel finds it all but level; the pull reaches past the pixel\'s edge and stops at its reach', () => {
  const lf = createLandforms({ woods: upland, sites: SITES });
  const { px, py, loc: l } = TOWNS[1];
  const r = locationFootprintRect(l), shaped = generateSamples(upland, px, py, H, lf);
  const level = at(shaped, 64, 64);
  for (let x = Math.max(0, r.xMin); x <= Math.min(128, r.xMax); x += 4) for (let y = Math.max(0, r.yMin); y <= Math.min(128, r.yMax); y += 4) {
    assert.ok(Object.is(at(shaped, x, y), level), `(${x},${y}): inside the rect, the site's level`);
  }
  // the level is the mean of the pixel's land on the coarse grid - within a few metres of the whole pixel's own mean, so
  // the pipeline's blend moves the town by little
  const free = generateSamples(upland, px, py, H, createLandforms({ woods: upland }));
  let mean = 0;
  for (let i = 0; i < free.length; i++) mean += free[i];
  mean /= free.length;
  assert.ok(Math.abs(level - mean) * M < 6, `the level ${(level * M).toFixed(1)} m against the pixel's mean ${(mean * M).toFixed(1)} m`);
  let coarse = 0, nc = 0;
  for (let x = 0; x <= 128; x += LANDFORM_DIALS.site.grid) for (let y = 0; y <= 128; y += LANDFORM_DIALS.site.grid) { coarse += at(free, x, y); nc++; }
  assert.ok(Math.abs(level - coarse / nc) * UNIT < 0.01, `the level is that grid's mean of the pixel's own land, to the float (${((level - coarse / nc) * UNIT).toFixed(4)} units)`);
  const job = generatePixelTerrain({ woods: upland, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, sites: SITES, landform: true, hasLocation: true, locationRect: r });
  assert.ok(Math.abs(job.avg - level) * M < 3, `the town stands on ${(job.avg * M).toFixed(1)} m, its level ${(level * M).toFixed(1)} m`);
  // past the pixel's edge the neighbour is pulled too - and at the reach, not at all
  const east = generateSamples(upland, px + 1, py, H, lf), eastFree = generateSamples(upland, px + 1, py, H, createLandforms({ woods: upland }));
  assert.ok(Math.abs(at(east, 4, 64) - at(eastFree, 4, 64)) * M > 5, 'the neighbour, beside the edge, is pulled');
  const reach = Math.min(LANDFORM_DIALS.site.most, LANDFORM_DIALS.site.reach + LANDFORM_DIALS.site.per * Math.max(r.xMax - r.xMin, r.yMax - r.yMin) / 2);
  const past = Math.ceil(r.xMax + reach) - 128 + 1;
  assert.ok(past < 128 && past > 0, `the reach ends inside the neighbour (${past})`);
  for (const y of [20, 64, 108]) assert.ok(Object.is(at(east, past, y), at(eastFree, past, y)), `(${past},${y}) in the neighbour: past the reach, the land`);
  assert.equal(reach, LANDFORM_DIALS.site.most, 'a 6x6 town reaches the most');
  // a site on the shore pulls toward a level the sea drags under the knee - a sea truly at the ocean's floor (no large
  // heightmap over it) and a strand rising out of it to a byte of 7 across the site's pixel - and the land it pulls is
  // held over the knee, at LANDFORM_FLOOR as a cut is; the sea and the beach DFU's to the bit (LANDFORM1's knee)
  const byte = (x) => (x <= 100 ? 0 : 7);
  const sea = {
    getHeightMapValue: (x) => byte(x),
    getHeightMapValuesRange1Dim: (x0, y0, dim) => { const out = new Uint8Array(dim * dim); for (let j = 0; j < dim; j++) for (let i = 0; i < dim; i++) out[i + j * dim] = byte(x0 + i); return out; },
    getLargeHeightMapValuesRange: (px, py, dim) => new Uint8Array(dim * 3 * dim * 3),
  };
  const lfShore = createLandforms({ woods: sea, sites: landformSites([{ px: 101, py: 200, loc: loc(6, 6) }]) });
  const FLOOR = Math.fround(LANDFORM_FLOOR / UNIT);
  let held = 0;
  for (const [sx, sy] of [[101, 200], [102, 200], [101, 199]]) {
    const dfu = generateSamples(sea, sx, sy), pulled = generateSamples(sea, sx, sy, H, lfShore);
    for (let i = 0; i < dfu.length; i++) {
      if (Math.fround(dfu[i] * UNIT) <= LANDFORM_KNEE) assert.ok(Object.is(pulled[i], dfu[i]), `${sx},${sy} #${i}: under the knee, DFU's own`);
      else {
        assert.ok(Math.fround(pulled[i] * UNIT) > LANDFORM_KNEE, `${sx},${sy} #${i}: over the knee, still over it`);
        if (pulled[i] === FLOOR && dfu[i] > FLOOR) held++;
      }
    }
  }
  assert.ok(held > 1000, `the strand pulled down to the floor and held there (${held} samples)`);
});

test('LANDFORM4: the sites are the game\'s own rows as the map table gives them - the block grid from its tile origin with setLocationTiles\' clearance, four bytes a pixel; and a seam is one number from both pixels round a site', () => {
  const t = loc(3, 2, 0), o = getLocationTerrainTileOrigin(t);
  assert.deepEqual(locationFootprintRect(t), { xMin: o.x - 3, xMax: o.x + 47 + 3, yMin: o.y - 3, yMax: o.y + 31 + 3 }, 'a town: clearance 3');
  assert.deepEqual(locationFootprintRect(loc(1, 1, 7)), { xMin: 56 - 2, xMax: 71 + 2, yMin: 56 - 2, yMax: 71 + 2 }, 'anything else: 2');
  const table = landformSites([{ px: 10, py: 20, loc: loc(8, 8) }, { px: -1, py: 0, loc: loc(1, 1) }, { px: 11, py: 20, loc: { mapTableData: {} } }]);
  const i = 4 * (20 * MAP_WIDTH + 10);
  assert.deepEqual([...table.slice(i, i + 4)], [-3 + 16, 127 + 3 + 16, -3 + 16, 127 + 3 + 16], 'an 8x8 city, its clearance under 0 carried by the bias');
  assert.equal(table.reduce((n, v) => n + (v ? 1 : 0), 0), 4, 'off the map and without an exterior: no site');
  // the seams round a site, with the network and the hills: every shared edge one number from both pixels
  const lf = createLandforms({ woods: upland, roads: NET, sites: SITES });
  const cache = new Map();
  const S = (px, py) => { const k = `${px},${py}`; if (!cache.has(k)) cache.set(k, generateSamples(upland, px, py, H, lf)); return cache.get(k); };
  for (const [px, py] of [[604, 249], [605, 249], [604, 250], [605, 250], [609, 244], [610, 245], [609, 245], [601, 259], [602, 260]]) {
    const a = S(px, py), east = S(px + 1, py), north = S(px, py - 1);
    for (let k = 0; k < H; k++) {
      assert.ok(Object.is(at(a, 128, k), at(east, 0, k)), `${px},${py} east edge ${k}`);
      assert.ok(Object.is(at(a, k, 128), at(north, k, 0)), `${px},${py} north edge ${k}`);
    }
  }
});

test('LANDFORM5: the land rolls - hills over every land sample, a pure function of world position, never reaching the knee, never over their top; stilled along the painted water', () => {
  // the knee: under it nothing; over it a hill or a dale is always smaller than the land's own height over the knee
  let worst = 0, most = 0, n = 0;
  for (let gx = 12000; gx < 140000; gx += 977) for (let gy = 3000; gy < 64000; gy += 613) {
    for (const macro of [LANDFORM_KNEE - 1, LANDFORM_KNEE, LANDFORM_KNEE + 1, LANDFORM_KNEE + 20, LANDFORM_KNEE + 60, LANDFORM_KNEE + 96, 400, 1200]) {
      const v = hillsAt(gx, gy, macro, macro);
      if (!(macro > LANDFORM_KNEE)) { assert.equal(v, 0); continue; }
      worst = Math.max(worst, Math.abs(v) / (macro - LANDFORM_KNEE));
      most = Math.max(most, Math.abs(v));
      n++;
    }
  }
  assert.ok(n > 10000);
  assert.ok(worst < 0.95, `a hill never reaches the knee (at most ${worst.toFixed(3)} of the land's height over it)`);
  // ...and that is the dials' own law, not the noise's luck: the tallest hill the ease lets stand at every height over
  // the knee is smaller than that height
  // (LANDFORM6: every land's ease is its own - `coast` times its tallest hill - so the bound holds for each)
  const { coast } = LANDFORM_DIALS.hills;
  for (const climate of Object.values(CLIMATES)) {
    const top = hillsTopOf(climate);
    for (let e = 0.25; e <= 4 * coast * top; e += 0.25) { const t = Math.min(1, e / (coast * top)); assert.ok(top * t * t * (3 - 2 * t) < 0.91 * e, `climate ${climate}, ${e} over the knee: the tallest hill ${(top * t * t * (3 - 2 * t)).toFixed(2)}`); }
  }
  const WOOD_TOP = hillsTopOf(CLIMATES.Woodlands);   // with no climates every sample is woodlands
  assert.ok(most <= WOOD_TOP && most > WOOD_TOP * 0.5, `the hills stand up to ${most.toFixed(1)} units of their top ${WOOD_TOP}`);
  // they roll, and they vary: a region field that lies near flat in some country and rolls hard in other
  const amp = (gx0, gy0) => { let lo = Infinity, hi = -Infinity; for (let x = 0; x < 2048; x += 32) for (let y = 0; y < 2048; y += 32) { const v = hillsAt(gx0 + x, gy0 + y, 400, 400); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  const spans = [];
  for (let gx = 0; gx < 120000; gx += 9000) for (let gy = 0; gy < 60000; gy += 9000) spans.push(amp(gx, gy));
  spans.sort((a, b) => a - b);
  assert.ok(spans[spans.length - 1] > 3 * spans[0], `country varies (${spans[0].toFixed(1)} to ${spans[spans.length - 1].toFixed(1)} units across 13 km squares)`);
  // the kernel takes them: a lowland pixel moves by them and a road is graded to them - its bed the land with its hills
  const flat = generateSamples(woods, 300, 250, H, createLandforms({ woods, roads: NET, hills: false })), roll = generateSamples(woods, 300, 250, H, createLandforms({ woods, roads: NET }));
  const smooth = sampleKernel(woods, 300, 250, H, false, createLandforms({ woods }));
  let moved = 0;
  for (let y = 0; y <= 128; y += 4) {
    if (Math.abs(at(roll, 20, y) - at(flat, 20, y)) * UNIT > 1) moved++;
    assert.ok(Math.abs(at(roll, 64, y) - smooth(64, y)) * UNIT < 1e-3, `y=${y}: the road's bed is the rolling land's macro`);
  }
  assert.ok(moved > 10, `off the road the land rolls (${moved} of 33)`);
  // along a painted river the hills are stilled to nothing: its centre line is the land without them, cut
  const riverRoll = generateSamples(woods, 290, 255, H, createLandforms({ woods, roads: NET })), riverFlat = generateSamples(woods, 290, 255, H, createLandforms({ woods, roads: NET, hills: false }));
  for (let x = 0; x <= 128; x += 8) assert.ok(Math.abs(at(riverRoll, x, 64) - at(riverFlat, x, 64)) * UNIT < 1e-9, `x=${x}: on the river's centre line, no hill`);
  // and the rivers off, no water to still them: the hills stand there too
  const dryRoll = generateSamples(woods, 290, 255, H, createLandforms({ woods, roads: { ...NET, water: false } }));
  let back = 0;
  for (let x = 0; x <= 128; x += 8) if (Math.abs(at(dryRoll, x, 64) - at(riverFlat, x, 64)) * UNIT > 2) back++;
  assert.ok(back > 4, `with the rivers off the hills stand on its line (${back} of 17)`);
});

test('LANDFORM4: the sites ride every kernel - the worker keeps the ones the client posts and cuts what this thread cuts; the host makes them once from the game\'s own rows and hands them to both before the first pixel', async () => {
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js?landform45');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: UPLAND_BYTES.slice() } });
    globalThis.onmessage({ data: { t: 'landform-tables', sites: SITES.slice(), climates: null } });
    const t = TOWNS[0];
    const job = { px: t.px + 1, py: t.py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: 231, landform: true };
    globalThis.onmessage({ data: { t: 'job', ...job, tilemap: job.tilemap.slice() } });
    const done = posted.findLast((m) => m.t === 'done');
    const here = generatePixelTerrain({ woods: upland, sites: SITES, ...job });
    const bare = generatePixelTerrain({ woods: upland, ...job });
    assert.deepEqual([...done.samples], [...here.samples], 'the samples - pulled to the site next door');
    assert.notDeepEqual([...here.samples], [...bare.samples], 'and the site moved them');
    globalThis.onmessage({ data: { t: 'grid', id: 7, px: t.px + 1, py: t.py, stride: 4, samples: here.samples, landform: true } });
    const grid = posted.findLast((m) => m.t === 'grid');
    assert.deepEqual([...grid.normals], [...restrideGrid({ woods: upland, px: t.px + 1, py: t.py, stride: 4, samples: here.samples, landform: true, sites: SITES }).normals], 'a promotion\'s ghost rows too');
  } finally { globalThis.postMessage = prevPost; globalThis.onmessage = prevOn; }
  const client = src('src/world/terrainGenClient.js');
  assert.equal((client.match(/roads: this\._roads \?\? null, sites: this\._sites, climates: this\._climates, /g) ?? []).length, 6, 'every same-thread kernel the client runs takes them');
  assert.match(client, /this\._worker\.postMessage\(\{ t: 'landform-tables', sites: s, climates: c \}, \[s, c\]\.filter\(Boolean\)\.map\(\(a\) => a\.buffer\)\);/, 'the worker gets copies');
  const world = src('src/scenes/world.js');
  assert.match(world, /if \(landform\) \{\n    _landformSites = landformSites\(_hubRows\.map\(\(loc\) => \{ const p = longitudeLatitudeToMapPixel\(loc\.mapTableData\.longitude, loc\.mapTableData\.latitude\); return \{ px: p\.x, py: p\.y, loc \}; \}\)\);\n    _landformClimates = landformClimates\(\(x, y\) => maps\.getClimateIndex\(x, y\)\);[^\n]*\n    terrainGen\.setLandformTables\(\{ sites: _landformSites, climates: _landformClimates \}\);\n  \}/, 'made once of the game\'s own rows (HUB1\'s - the same sites on every client), handed to both kernels with the climates');
  assert.ok(world.indexOf('_landformSites = landformSites(_hubRows') > world.indexOf('if (l < baseCount) { _hubRows.push(loc);'), 'after the rows are gathered');
  assert.ok(world.indexOf('terrainGen.setLandformTables(') < world.indexOf('await terrainGen.generate({'), 'before the first pixel is asked of either');
});
