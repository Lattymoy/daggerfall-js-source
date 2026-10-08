// AUDIT LANDFORMS III (2026-10-07, Mac, of LANDFORM4-6: "Audit this. Must be perfection") - the audit of a town
// standing in its land, the rolling hills and the land each climate wears (bible/03-World/Landforms.md, the record
// bible/01-Overview/Audit-Landforms.md). Every finding fixed here was reproduced first, on the real WOODS.WLD and on the
// landforms' synthetic world, and each pin below fails on the code as it stood (tools/mutants/auditlandforms3.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as acorn from 'acorn';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { worldDataDoor, setWorldDataDoor } from '../src/formats/worldDataDoor.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { generateSamples, kernelTerms, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, BASE_HEIGHT_SCALE, NOISE_MAP_SCALE } from '../src/world/terrainSampler.js';
import { createLandforms, landformSites, hillsAt, cosPi, sinPi, expNeg, LANDFORM_KNEE, LANDFORM_FLOOR, LANDFORM_DIALS } from '../src/world/landforms.js';
import { locationFootprintRect } from '../src/world/terrainTiles.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { TerrainGenClient } from '../src/world/terrainGenClient.js';
import { DIR } from '../src/world/roadNetwork.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;
const M = UNIT * STREAMING_TERRAIN_SCALE;   // a normalized sample in metres
const at = (s, x, y) => s[x * H + y];
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const load = (bytes) => { const w = new WoodsFile(); assert.equal(w.load(bytes), true); return w; };
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const filled = (climate) => new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(climate);
const loc = (w, h, type = 0) => ({ exterior: { exteriorData: { width: w, height: h, blockNames: ['X'] } }, mapTableData: { locationType: type } });
/** a world with its bytes stamped: `stamp(x, y)` answers a byte or undefined (the synthetic world's own) */
const stamped = (stamp) => {
  const b = syntheticWoodsBytes(), hm = new DataView(b.buffer).getUint32(28, true);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) { const v = stamp(x, y); if (v !== undefined) b[hm + y * MAP_WIDTH + x] = v; }
  return load(b);
};
const woods = load(syntheticWoodsBytes());
const NET = network();
/** LANDFORM4-5's upland (test/landform45.test.js): bytes rising 5 a pixel eastward from 60 at x = 600, rows 230..269 */
const upland = stamped((x, y) => (y >= 230 && y < 270 && x >= 590 && x < 630 ? Math.max(60, Math.min(127, 60 + 5 * (x - 600))) : undefined));
/** the pixel's sample (x, y) in world samples - x east, y north (landforms.js pixelShaper) */
const world = (px, py, x, y) => [px * (H - 1) + x, (MAP_HEIGHT - py) * (H - 1) + y];
/** a pixel's coarse grid (LANDFORM_DIALS.site.grid) read off its samples: the mean of its land over the knee, and of all
 *  of it */
function gridMeans(land) {
  const { grid } = LANDFORM_DIALS.site;
  let dry = 0, nd = 0, all = 0, n = 0;
  for (let x = 0; x <= H - 1; x += grid) for (let y = 0; y <= H - 1; y += grid) { const v = at(land, x, y) * UNIT; all += v; n++; if (v > LANDFORM_KNEE) { dry += v; nd++; } }
  return { land: nd ? dry / nd : all / n, all: all / n };
}
/** a site as the shaper reads it: its rect in world samples, its reach (LANDFORM_DIALS.site) and its level - the mean
 *  of its pixel's land over the knee on the coarse grid (D4), read off that land's own samples */
function siteOf(w, px, py, l, free) {
  const r = locationFootprintRect(l), [ox, oy] = world(px, py, 0, 0), { reach, per, most } = LANDFORM_DIALS.site;
  return { x0: ox + r.xMin, x1: ox + r.xMax, y0: oy + r.yMin, y1: oy + r.yMax, reach: Math.min(most, reach + per * Math.max(r.xMax - r.xMin, r.yMax - r.yMin) / 2), level: gridMeans(free(px, py)).land };
}
/** LANDFORM4's pull written out (landforms.js pullTo): each site's weight 1 - smoothstep(distance / reach), the land
 *  kept the product of (1 - weight), the rest to the levels weighted by weight^4 - a pull up eased by the knee (A1) */
function pullLaw(sites, gx, gy, land) {
  let keep = 1, ws = 0, wt = 0;
  for (const s of sites) {
    const dx = Math.max(s.x0 - gx, 0, gx - s.x1), dy = Math.max(s.y0 - gy, 0, gy - s.y1), d = Math.hypot(dx, dy);
    if (!(d < s.reach)) continue;
    const w = 1 - smooth01(d / s.reach);
    keep *= 1 - w; ws += w ** 4; wt += w ** 4 * s.level;
  }
  if (keep === 1 || !(ws > 0)) return land;
  const level = wt / ws;
  const move = level > land ? (1 - keep) * smooth01((land - LANDFORM_KNEE) / (level - LANDFORM_KNEE)) : 1 - keep;
  return land + (level - land) * move;
}
const memo = (lf, w) => { const c = new Map(); return (px, py) => { const k = `${px},${py}`; if (!c.has(k)) c.set(k, generateSamples(w, px, py, H, lf)); return c.get(k); }; };

test('AUDIT LANDFORMS III A1: no wall at the knee round a coastal town - a pull up is eased in by how far the land stands over the beach line toward the level, so a strand beside a headland town rises to it no steeper than 1.69 times its own rise; the old pull stood a 227 m wall there', () => {
  // a headland: bytes of 40 (320 units) on the strand east of the synthetic sea, an 8x8 town on its west end
  const X0 = 118, PY = 400;
  const w = stamped((x, y) => (y >= PY - 6 && y <= PY + 6 && x >= X0 && x < X0 + 10 ? 40 : undefined));
  const TOWN = [{ px: X0, py: PY, loc: loc(8, 8) }];
  const pulled = memo(createLandforms({ woods: w, sites: landformSites(TOWN) }), w), free = memo(createLandforms({ woods: w }), w);
  let crossings = 0, worst = 0, eased = 0;
  for (const px of [X0 - 1, X0]) for (const py of [PY - 1, PY, PY + 1]) {
    const a = pulled(px, py), f = free(px, py);
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const x2 = x + dx, y2 = y + dy;
      if (x2 >= H || y2 >= H) continue;
      const i = x * H + y, j = x2 * H + y2;
      // a pair of samples across the beach line, in either ground: the step the town adds to the land's own
      if ((a[i] * UNIT <= LANDFORM_KNEE) === (a[j] * UNIT <= LANDFORM_KNEE) && (f[i] * UNIT <= LANDFORM_KNEE) === (f[j] * UNIT <= LANDFORM_KNEE)) continue;
      crossings++;
      worst = Math.max(worst, (Math.abs(a[i] - a[j]) - Math.abs(f[i] - f[j])) * M);
    }
  }
  assert.ok(crossings > 500, `the beach line runs through the town's neighbour (${crossings} pairs across it)`);
  assert.ok(worst < 1, `no wall at the knee: at most ${worst.toFixed(2)} m over the land's own step`);
  // the law, written out, on the strand the town reaches: over the knee and under the level, eased
  const site = siteOf(w, X0, PY, TOWN[0].loc, free);
  assert.ok(site.level > LANDFORM_KNEE + 150, `the town stands high over the beach line (${site.level.toFixed(1)} units)`);
  const a = pulled(X0 - 1, PY), f = free(X0 - 1, PY);
  for (let x = 0; x <= 128; x += 2) for (let y = 0; y <= 128; y += 8) {
    const land = at(f, x, y) * UNIT;
    if (!(land > LANDFORM_FLOOR + 0.5)) continue;
    const [gx, gy] = world(X0 - 1, PY, x, y), want = pullLaw([site], gx, gy, land);
    assert.ok(Math.abs(at(a, x, y) * UNIT - want) < 0.02, `(${x},${y}) west of the town: ${(at(a, x, y) * UNIT).toFixed(3)} units, the law's ${want.toFixed(3)}`);
    if (want < site.level - 20 && x > 100) eased++;
  }
  assert.ok(eased > 20, `the strand beside the town is raised only part way (${eased} samples 20 units or more under its level)`);
});

test('AUDIT LANDFORMS III A2: every land\'s hills sit on its land - each land\'s mean hill within 3 in 100 of its height, so its average ground is DFU\'s, lifted; the mountain woods\' centre was the ridgelines\' before RIDGED_NORM was set, and stood them 13-18 m low', () => {
  const out = new Float64Array(1);
  for (const [name, climate] of Object.entries(CLIMATES)) {
    const t = filled(climate);
    let sum = 0, deep = 0;
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) { sum += hillsAt(300 * 128 + x * 41, 150 * 128 + y * 41, 400, 600, null, t, out); deep += out[0]; }
    assert.ok(Math.abs(sum / deep) < 0.03, `${name}: its mean hill ${(sum / 160 / 160 * STREAMING_TERRAIN_SCALE).toFixed(2)} m, ${(sum / deep).toFixed(4)} of its height`);
  }
});

test('AUDIT LANDFORMS III D4: a coastal town\'s level is its land\'s - the samples over the knee; DFU\'s blend averages the sea in after the kernel, and a level that counted it too stood six real coastal towns under the beach line, 13 m under DFU\'s', () => {
  // a shore: a sea truly at the ocean's floor (no large heightmap over it, as LANDFORM4's shore pin) and a strand of
  // bytes of 20 (160 units) east of x = 100, a town in the pixel the land rises out of the sea across
  const byte = (x) => (x <= 100 ? 0 : 20);
  const w = {
    getHeightMapValue: (x) => byte(x),
    getHeightMapValuesRange1Dim: (x0, y0, dim) => { const out = new Uint8Array(dim * dim); for (let j = 0; j < dim; j++) for (let i = 0; i < dim; i++) out[i + j * dim] = byte(x0 + i); return out; },
    getLargeHeightMapValuesRange: (px, py, dim) => new Uint8Array(dim * 3 * dim * 3),
  };
  const PX = 101, PY = 200;
  const TOWN = [{ px: PX, py: PY, loc: loc(4, 4) }], r = locationFootprintRect(TOWN[0].loc);
  const free = generateSamples(w, PX, PY, H, createLandforms({ woods: w })), means = gridMeans(free);
  assert.ok(means.land - means.all > 5, `the sea lies in the pixel (its land's mean ${means.land.toFixed(1)} units, all of it ${means.all.toFixed(1)})`);
  const s = generateSamples(w, PX, PY, H, createLandforms({ woods: w, sites: landformSites(TOWN) }));
  let over = 0;
  for (let x = r.xMin + 2; x <= r.xMax - 2; x += 4) for (let y = r.yMin + 2; y <= r.yMax - 2; y += 4) {
    if (!(at(free, x, y) * UNIT > means.land + 0.05)) continue;   // its land over the level: pulled down to it, whole
    assert.ok(Math.abs(at(s, x, y) * UNIT - means.land) < 0.05, `(${x},${y}): at its land's mean ${means.land.toFixed(2)}, not ${(at(s, x, y) * UNIT).toFixed(2)}`);
    over++;
  }
  assert.ok(over > 10, `the rect's land over its level read (${over})`);
  // built as the game builds it, DFU's blend after: the town well over the beach line, as DFU stands it
  const job = (landform) => generatePixelTerrain({ woods: w, px: PX, py: PY, tilemap: new Uint8Array(128 * 128), climateType: 231, sites: landformSites(TOWN), landform, hasLocation: true, locationRect: r });
  const town = job(true).avg * UNIT, dfu = job(false).avg * UNIT;
  assert.ok(town > LANDFORM_KNEE + 20 && dfu > LANDFORM_KNEE + 20, `the town stands on ${town.toFixed(1)} units, DFU's on ${dfu.toFixed(1)}, the beach line ${LANDFORM_KNEE}`);
});

test('AUDIT LANDFORMS III B1: the sites are MAPS.BSA\'s rows on every client - a row a town pack replaces is read again as the BSA holds it, so a pack never moves the ground a town pulls', () => {
  const was = worldDataDoor();
  try {
    const maps = new MapsFile();
    setWorldDataDoor(null);
    assert.equal(maps.locationReplaced(3, 7), false, 'no door: nothing replaced');
    setWorldDataDoor({ getDFLocationReplacementData: (r, l) => (r === 3 && l === 7 ? { replaced: true } : null) });
    assert.equal(maps.locationReplaced(3, 7), true, 'the door serves this one');
    assert.equal(maps.locationReplaced(3, 8), false, 'and not that one');
  } finally { setWorldDataDoor(was); }
  // the host's own line, mounted over a stub map: a replaced row goes back to the BSA's, any other is kept as read
  const line = /const classicRow = (\(row\) => \([^\n]*\));\n/.exec(src('src/scenes/world.js'));
  assert.ok(line, 'the host reads each site row through classicRow');
  const classic = { classic: true };
  const maps = { locationReplaced: (r, l) => r === 1 && l === 2, readClassicLocation: (r, l) => (r === 1 && l === 2 ? classic : null) };
  const classicRow = new Function('maps', `return ${line[1]};`)(maps);
  const packed = { regionIndex: 1, locationIndex: 2 }, own = { regionIndex: 1, locationIndex: 3 };
  assert.equal(classicRow(packed), classic, 'a pack\'s row: the BSA\'s');
  assert.equal(classicRow(own), own, 'the BSA\'s own: itself');
});

test('AUDIT LANDFORMS III C1: a river cuts its valley - the hills never stand a dry sample under its water where DFU\'s own land does not, and where a stream meets a river the deeper valley wins', () => {
  const on = createLandforms({ woods, roads: NET }), off = createLandforms({ woods, roads: NET, hills: false });
  // across the river east-west down (280..320, 255): its centre line y = 64, every dry sample within half a pixel of it
  let under = 0, underBare = 0, worst = -Infinity;
  for (const px of [284, 288, 290, 295, 305, 310, 316]) {
    const s = generateSamples(woods, px, 255, H, on), f = generateSamples(woods, px, 255, H, off);
    for (let x = 0; x <= 128; x += 4) for (let y = 0; y <= 128; y += 2) {
      if (Math.abs(y - 64) < 6) continue;
      const gap = (at(s, x, 64) - at(s, x, y)) * UNIT, gapBare = (at(f, x, 64) - at(f, x, y)) * UNIT;
      if (gap > 0) under++;
      if (gapBare > 0) underBare++;
      worst = Math.max(worst, gap - Math.max(0, gapBare));
    }
  }
  assert.ok(worst < 0.5, `the hills put no dry sample under the river past DFU's own land (${worst.toFixed(3)} units at most)`);
  assert.ok(under * 3 < underBare, `and the river lies under its valley where DFU's land stood it over its neighbours (${under} under it, ${underBare} on DFU's land)`);
  // the stream into the river at (316, 255): off every path's own cut (12 samples from the stream's line, a pixel from
  // the river's) the hills carved by both are the deeper of the two valleys' carves, to the float32
  const noStream = { ...NET, streams: new Uint8Array(NET.streams.length) }, noRiver = { ...NET, rivers: new Uint8Array(NET.rivers.length) };
  let streamDeeper = 0, riverDeeper = 0;
  for (const py of [254, 255]) {
    const bare = generateSamples(woods, 316, py, H, off);
    const hills = (lf) => { const s = generateSamples(woods, 316, py, H, lf); return (x, y) => (at(s, x, y) - at(bare, x, y)) * UNIT; };
    const both = hills(on), river = hills(createLandforms({ woods, roads: noStream })), stream = hills(createLandforms({ woods, roads: noRiver }));
    for (let x = 0; x <= 128; x += 4) for (let y = 0; y <= 128; y += 4) {
      if (Math.abs(x - 64) < 12 || (py === 255 && Math.abs(y - 64) < 12)) continue;
      const want = Math.min(river(x, y), stream(x, y));
      assert.ok(Math.abs(both(x, y) - want) < 2e-3, `(316, ${py}) (${x},${y}): ${both(x, y).toFixed(4)} units of hills, the deeper valley's ${want.toFixed(4)}`);
      if (stream(x, y) < river(x, y) - 1) streamDeeper++;
      if (river(x, y) < stream(x, y) - 1) riverDeeper++;
    }
  }
  assert.ok(streamDeeper > 20 && riverDeeper > 20, `each valley the deeper somewhere (${streamDeeper} the stream's, ${riverDeeper} the river's)`);
});

test('AUDIT LANDFORMS III C2: a site\'s level stands on its own climate\'s land - the mean of the hills that climate wears, not the woodlands\' - each table\'s levels kept apart, and the land without hills levelled without them', () => {
  const MOUNTAIN = filled(CLIMATES.Mountain), TOWNS = [{ px: 610, py: 245, loc: loc(6, 6) }], sites = landformSites(TOWNS);
  const level = (o) => siteOf(upland, 610, 245, TOWNS[0].loc, memo(createLandforms({ woods: upland, ...o }), upland)).level;
  const mountain = level({ climates: MOUNTAIN }), wood = level({}), bare = level({ hills: false });
  assert.ok(Math.abs(mountain - wood) > 1 && Math.abs(bare - wood) > 1, `the climates and the hills stand the pixel's land apart (${mountain.toFixed(2)}, ${wood.toFixed(2)}, ${bare.toFixed(2)} units)`);
  // asked in turn of one world - the woodlands' first, so a level kept across tables would answer the mountains' wrong
  for (const [o, want, what] of [[{}, wood, 'woodlands'], [{ climates: MOUNTAIN }, mountain, 'mountain'], [{ hills: false }, bare, 'hill-less']]) {
    const s = generateSamples(upland, 610, 245, H, createLandforms({ woods: upland, sites, ...o }));
    assert.ok(Math.abs(at(s, 64, 64) * UNIT - want) < 0.05, `the town stands at the ${what} land's mean (${(at(s, 64, 64) * UNIT).toFixed(3)} against ${want.toFixed(3)})`);
  }
});

test('AUDIT LANDFORMS III C3: a climate\'s land holds whole at its pixel\'s centre and gives way by a smoothstep - a quarter pixel east of a lone desert pixel, smoothstep(0.25) of the woodlands; a quarter north, of the row north of it (the map\'s rows run south)', () => {
  const desert = filled(CLIMATES.Desert), wood = filled(CLIMATES.Woodlands), swamp = filled(CLIMATES.Swamp);
  const macro = LANDFORM_KNEE + 400;   // over every land's ease: the lands' shares are the whole of the blend
  const h = (gx, gy, c) => hillsAt(gx, gy, macro, 600, null, c), s = smooth01(0.25);
  let east = 0, north = 0;
  for (let k = 0; k < 12; k++) {
    // a lone desert pixel, swamp the row north of it and rainforest the row south
    const P = [380 + 5 * k, 190 + (k % 4) * 7], t = filled(CLIMATES.Woodlands);
    t[P[1] * MAP_WIDTH + P[0]] = CLIMATES.Desert;
    t[(P[1] - 1) * MAP_WIDTH + P[0]] = CLIMATES.Swamp;
    t[(P[1] + 1) * MAP_WIDTH + P[0]] = CLIMATES.Rainforest;
    const [cx, cy] = world(P[0], P[1], 64, 64);
    assert.ok(Object.is(h(cx, cy, t), h(cx, cy, desert)), `${P}: at its centre, the desert whole`);
    const e = h(cx + 32, cy, t), wantE = (1 - s) * h(cx + 32, cy, desert) + s * h(cx + 32, cy, wood);
    const n = h(cx, cy + 32, t), wantN = (1 - s) * h(cx, cy + 32, desert) + s * h(cx, cy + 32, swamp);
    assert.ok(Math.abs(e - wantE) < 1e-9, `${P}: a quarter east ${e}, the smoothstep's ${wantE}`);
    assert.ok(Math.abs(n - wantN) < 1e-9, `${P}: a quarter north ${n}, the swamp's row's ${wantN}`);
    if (Math.abs(h(cx + 32, cy, desert) - h(cx + 32, cy, wood)) > 2) east++;
    if (Math.abs(h(cx, cy + 32, swamp) - h(cx, cy + 32, filled(CLIMATES.Rainforest))) > 2) north++;
  }
  assert.ok(east > 4 && north > 4, `the lands differ where the shares are read (${east} and ${north} of 12)`);
});

test('AUDIT LANDFORMS III C4: a road through a town runs at its level, and the sites a road\'s profile meets are the 5x5\'s - an 8x8 town two pixels off still grades the road beside a seam to the same float from both pixels', () => {
  const roads = { ...network(), roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT) };
  for (let x = 600; x <= 620; x++) roads.roads[245 * MAP_WIDTH + x] = DIR.E | DIR.W;
  const TOWNS = [{ px: 606, py: 245, loc: loc(4, 4) }, { px: 611, py: 245, loc: loc(8, 8) }];
  const lf = createLandforms({ woods: upland, roads, sites: landformSites(TOWNS) });
  const S = memo(lf, upland);
  // inside the 4x4's rect the road stands at the town's level - its over-level samples' one float - but for the little
  // the knee's ease leaves the land under a level short of it (A1: so high over the knee, under a tenth of a unit)
  const r = locationFootprintRect(TOWNS[0].loc), s = S(606, 245), free = memo(createLandforms({ woods: upland, roads }), upland)(606, 245);
  let level = null;
  for (let x = r.xMin; x <= r.xMax; x += 2) for (let y = r.yMin; y <= r.yMax; y += 2) if (Math.abs(y - 64) > 16 && at(free, x, y) > at(s, x, y)) { level = at(s, x, y); break; }
  assert.ok(level !== null, 'the rect has land over its level');
  // ...and its banks and verges with it: the share of the ground noise the pull takes is taken under the road too
  for (let x = r.xMin + 4; x <= r.xMax - 4; x += 2) for (let y = 52; y <= 76; y += 2) assert.ok(Math.abs(at(s, x, y) - level) * UNIT < 0.1, `(${x},${y}) on the road in the town: ${(at(s, x, y) * UNIT).toFixed(4)} units, its level ${(level * UNIT).toFixed(4)}`);
  // the seams along the road, the 8x8 two pixels from the pixels west of it
  for (let px = 607; px <= 615; px++) {
    const a = S(px, 245), east = S(px + 1, 245);
    for (let k = 0; k < H; k++) assert.ok(Object.is(at(a, 128, k), at(east, 0, k)), `${px},245 east edge ${k}`);
  }
});

test('AUDIT LANDFORMS III C5: the pull, written out - two towns side by side and a hamlet longer than it is wide, every sample about them the law\'s: weights by smoothstep, the land kept their product, the levels by weight to the fourth, the reach by the longer side', () => {
  const TOWNS = [{ px: 606, py: 250, loc: loc(6, 6) }, { px: 607, py: 250, loc: loc(4, 4) }, { px: 603, py: 258, loc: loc(1, 3, 3) }];
  const pulled = memo(createLandforms({ woods: upland, sites: landformSites(TOWNS) }), upland), free = memo(createLandforms({ woods: upland }), upland);
  const sites = TOWNS.map((t) => siteOf(upland, t.px, t.py, t.loc, free));
  assert.ok(sites[2].reach < LANDFORM_DIALS.site.most && sites[2].y1 - sites[2].y0 > 2 * (sites[2].x1 - sites[2].x0), `the hamlet reaches ${sites[2].reach} by its long side`);
  let both = 0;
  for (const [px, py] of [[605, 250], [606, 250], [607, 250], [608, 250], [606, 249], [607, 251], [602, 258], [603, 258], [604, 258], [603, 257], [603, 259]]) {
    const a = pulled(px, py), f = free(px, py);
    for (let x = 0; x <= 128; x += 8) for (let y = 0; y <= 128; y += 8) {
      const [gx, gy] = world(px, py, x, y), want = pullLaw(sites, gx, gy, at(f, x, y) * UNIT);
      assert.ok(Math.abs(at(a, x, y) * UNIT - want) < 2e-3, `(${px},${py}) (${x},${y}): ${(at(a, x, y) * UNIT).toFixed(4)} units, the law's ${want.toFixed(4)}`);
      if (sites.slice(0, 2).every((st) => Math.hypot(Math.max(st.x0 - gx, 0, gx - st.x1), Math.max(st.y0 - gy, 0, gy - st.y1)) < st.reach * 0.7)) both++;
    }
  }
  assert.ok(both > 40, `the two towns' pulls meet over ${both} samples`);
});

test('AUDIT LANDFORMS III C6: the high ground rolls harder by each land\'s own `upland` - its tallest hill that many times its lowland\'s; and the client hands the worker copies of its tables, its own kept whole', () => {
  const out = new Float64Array(1);
  for (const [name, climate] of Object.entries(CLIMATES)) {
    const t = filled(climate), land = LANDFORM_DIALS.lands[{ Woodlands: 'woodlands', MountainWoods: 'mountainWoods', Mountain: 'mountain', Desert: 'desert', Desert2: 'desert2', Rainforest: 'rainforest', Subtropical: 'subtropical', Swamp: 'swamp', HauntedWoodlands: 'haunted', Ocean: 'ocean' }[name]];
    const deep = (low) => { hillsAt(400 * 128 + 77, 200 * 128 + 31, LANDFORM_KNEE + 400, low, null, t, out); return out[0]; };
    const ratio = deep(LANDFORM_KNEE + LANDFORM_DIALS.hills.uplandAt) / deep(LANDFORM_KNEE);
    assert.ok(Math.abs(ratio - land.upland) < 1e-12, `${name}: ${ratio} times on the high ground, its upland ${land.upland}`);
  }
  // the hills ease on the land's macro height, its ground noise out - the height a road's profile reads - so a road and
  // the land beside it take the same hill. On the strand, where the ease is still rising:
  const hilly = generateSamples(woods, 117, 150, H, createLandforms({ woods })), flat = generateSamples(woods, 117, 150, H, createLandforms({ woods, hills: false }));
  const { base, noise } = kernelTerms(woods, 117, 150, H);
  let read = 0;
  for (let x = 0; x <= 128; x += 4) for (let y = 0; y <= 128; y += 4) {
    const low = base(x, y) * BASE_HEIGHT_SCALE, macro = low + noise(x, y) * NOISE_MAP_SCALE;
    if (!(at(flat, x, y) * UNIT > LANDFORM_FLOOR + 1) || !(macro > LANDFORM_KNEE)) continue;
    const [gx, gy] = world(117, 150, x, y), want = hillsAt(gx, gy, macro, low);
    assert.ok(Math.abs((at(hilly, x, y) - at(flat, x, y)) * UNIT - want) < 2e-3, `(${x},${y}): ${((at(hilly, x, y) - at(flat, x, y)) * UNIT).toFixed(4)} units of hill, its macro's ${want.toFixed(4)}`);
    read++;
  }
  assert.ok(read > 200, `the strand read (${read} samples)`);
  // the worker's copies cross by transfer, as a real post moves them: the client's own still read whole after
  const posted = [];
  const fake = { postMessage: (msg, transfer = []) => posted.push(structuredClone(msg, { transfer })), terminate() {} };
  const client = new TerrainGenClient({ woods, woodsBytes: new Uint8Array(8), workerFactory: () => fake });
  const sites = landformSites([{ px: 10, py: 20, loc: loc(2, 2) }]), climates = filled(CLIMATES.Desert);
  client.setLandformTables({ sites, climates });
  const msg = posted.findLast((m) => m.t === 'landform-tables');
  assert.deepEqual([msg.sites.length, msg.climates.length], [sites.length, climates.length], 'the worker has both');
  assert.deepEqual([sites.length, climates.length, client._sites, client._climates], [4 * MAP_WIDTH * MAP_HEIGHT, MAP_WIDTH * MAP_HEIGHT, sites, climates], 'the client\'s own kept, and whole');
});

test('AUDIT LANDFORMS III A7: a land\'s climate is read off its pixel at the shaper\'s own span - a world of 65 samples a side stands a lone desert pixel\'s desert at its centre', () => {
  const P = [400, 200], t = filled(CLIMATES.Woodlands);
  t[P[1] * MAP_WIDTH + P[0]] = CLIMATES.Desert;
  const D = 65, lone = generateSamples(woods, P[0], P[1], D, createLandforms({ woods, climates: t, hDim: D })), all = generateSamples(woods, P[0], P[1], D, createLandforms({ woods, climates: filled(CLIMATES.Desert), hDim: D }));
  const wood = generateSamples(woods, P[0], P[1], D, createLandforms({ woods, hDim: D }));
  assert.ok(Object.is(lone[32 * D + 32], all[32 * D + 32]), 'at its centre, the desert whole');
  assert.ok(Math.abs(lone[32 * D + 32] - wood[32 * D + 32]) * UNIT > 0.5, 'and not the woodlands round it');
});

/** the ground's own sources - the kernel, the landforms, the jobs that run them, a town's tiles and blend */
const GROUND = ['src/world/terrainSampler.js', 'src/world/landforms.js', 'src/world/terrainGen.js', 'src/world/terrainTiles.js'];
const ENGINE_OWN = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot']);
const walk = (n, f) => { if (!n || typeof n.type !== 'string') return; f(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, f)); else if (v && typeof v.type === 'string') walk(v, f); } };

test('AUDIT LANDFORMS III A8: the ground is one float in every engine - none of its sources asks an engine\'s own approximation (Math.cos, Math.exp, `**` - the spec asks no more than "approximated" of them); the landforms\' cosine, sine and exponential are series of correctly rounded steps, within 4.5e-16 of V8\'s', () => {
  for (const file of GROUND) {
    const ast = acorn.parse(src(file), { ecmaVersion: 'latest', sourceType: 'module' }), hits = [];
    walk(ast, (n) => {
      if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'Math' && ENGINE_OWN.has(n.property.name)) hits.push(`Math.${n.property.name}`);
      if ((n.type === 'BinaryExpression' || n.type === 'AssignmentExpression') && (n.operator === '**' || n.operator === '**=')) hits.push(n.operator);
    });
    assert.deepEqual(hits, [], `${file}: an engine's own`);
  }
  let worst = 0;
  for (let i = 0; i <= 200000; i++) {
    const t = -1 + i / 100000;
    worst = Math.max(worst, Math.abs(cosPi(t) - Math.cos(Math.PI * t)), Math.abs(sinPi(t) - Math.sin(Math.PI * t)), Math.abs(expNeg(20 * (t + 1)) - Math.exp(-20 * (t + 1))));
  }
  assert.ok(worst <= 4.5e-16, `the series within ${worst} of V8's own`);
  assert.deepEqual([cosPi(0), cosPi(1), cosPi(-1), sinPi(0), expNeg(0), expNeg(40)], [1, -1, -1, 0, 1, 0], 'their ends');
});

test('AUDIT LANDFORMS III B4: ONE CONSTRUCTION SEAM - every landforms the game builds stands on the world\'s sites and climates (a kernel handed a built one takes them with it); the lift field\'s own default is the one that stands on none, and says so', () => {
  const NAMES = new Set(['createLandforms', 'generatePixelTerrain', 'restrideGrid']), calls = [];
  const files = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));
  for (const file of files('src')) {
    const text = src(file);
    if (![...NAMES].some((n) => text.includes(`${n}(`))) continue;
    walk(acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || !NAMES.has(n.callee.name)) return;
      const arg = n.arguments[0], keys = new Set(arg?.type === 'ObjectExpression' ? arg.properties.filter((p) => p.type === 'Property').map((p) => p.key.name) : []);
      calls.push({ at: `${file}: ${text.slice(n.start, Math.min(n.end, n.start + 90))}`, ok: keys.has('landforms') || (keys.has('sites') && keys.has('climates')) });
    });
  }
  assert.ok(calls.length >= 12, `the game's kernels found (${calls.length})`);
  assert.deepEqual(calls.filter((c) => !c.ok).map((c) => c.at), ['src/world/landforms.js: createLandforms({ woods, hDim })'], 'every other one on the sites and the climates');
  const lift = src('src/world/landforms.js');
  assert.match(lift, /or null: its defaults \(the\n \*   relief and the woodlands' hills, no paths, no sites\)/, 'the lift field\'s default says what it stands on');
  assert.doesNotMatch(lift, /null: the relief alone/, 'not "the relief alone" (LANDFORM5 gave it the hills)');
});
