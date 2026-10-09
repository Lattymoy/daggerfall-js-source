// LANDFORM6 (2026-10-07, Mac, asked whether the land varies between environments: "Shit, dude go all out with this. I
// trust you") - THE LAND WEARS ITS CLIMATE (world/landforms.js): each climate's hills their own shape and height - the
// Alik'r's dune seas, Dak'fron's mesas, the ranges' ridgelines, the rainforest's karst towers, the subtropics' soft domes,
// the swamps' near-flat hummocks, the haunted woods' ravines, the woodlands' rolling hills - blended across a climate's
// border, one function of world position still. Pinned with no game data: a climates table filled as each test needs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generateSamples, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';
import { createLandforms, landformClimates, landformSites, hillsAt, hillsTopOf, HILLS_TOP, LANDFORM_KNEE, LANDFORM_CEILING, LANDFORM_DIALS, reliefLift, peakField, PEAK_MEAN } from '../src/world/landforms.js';
import { generatePixelTerrain, restrideGrid } from '../src/world/terrainGen.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const M = STREAMING_TERRAIN_SCALE;   // kernel units to metres
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WOODS_BYTES = syntheticWoodsBytes();
const woods = new WoodsFile();
assert.equal(woods.load(WOODS_BYTES.slice()), true);
const filled = (climate) => new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(climate);
const deg = (grade) => (Math.atan(grade) * 180) / Math.PI;

/** A land's hills over 10 km square, a value every 8 samples (51 m), on land standing well over the knee. */
const N = 200, ST = 8;
function field(climates, gx0 = 400 * 128, gy0 = 200 * 128) {
  const F = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) F[y * N + x] = hillsAt(gx0 + x * ST, gy0 + y * ST, 400, 600, null, climates) * M;
  return F;
}
function stats(F) {
  const v = [...F].sort((a, b) => a - b), q = (p) => v[Math.floor(p * (v.length - 1))];
  const g = [];
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
    const a = F[y * N + x];
    g.push(Math.max(Math.abs(F[y * N + x + 1] - a), Math.abs(F[(y + 1) * N + x] - a)) / (ST * 6.4));
  }
  g.sort((a, b) => a - b);
  return { span: v[v.length - 1] - v[0], p1: q(0.01), p50: q(0.5), p99: q(0.99), g99: deg(g[Math.floor(0.99 * (g.length - 1))]), gmax: deg(g[g.length - 1]) };
}
const LAND = Object.fromEntries(Object.entries(CLIMATES).map(([k, c]) => [k, stats(field(filled(c)))]));

test('LANDFORM6: every climate wears its own land - CLIMATE.PAK\'s ten values, any other the woodlands\'; the tallest hill is the mountains\', and the ceiling counts it', () => {
  const tops = Object.fromEntries(Object.entries(CLIMATES).map(([k, c]) => [k, hillsTopOf(c)]));
  const top = (land) => land.high * land.upland + (land.peaks ? land.peaks.high : 0), L = LANDFORM_DIALS.lands;   // PIN MOVED (LANDFORM8): a mountain land's tallest is a peak on its tallest hill
  assert.deepEqual(tops, {
    Ocean: top(L.ocean), Desert: top(L.desert), Desert2: top(L.desert2), Mountain: top(L.mountain), Rainforest: top(L.rainforest),
    Swamp: top(L.swamp), Subtropical: top(L.subtropical), MountainWoods: top(L.mountainWoods), Woodlands: top(L.woodlands), HauntedWoodlands: top(L.haunted),
  });
  for (const other of [0, 1, 222, 233, 255]) assert.equal(hillsTopOf(other), top(L.woodlands), `climate ${other}: woodlands`);
  assert.equal(HILLS_TOP, top(L.mountain));
  assert.equal(LANDFORM_CEILING, MAX_TERRAIN_HEIGHT + reliefLift(127 * 8) + HILLS_TOP);
  // the table is the climate map's own, a byte a pixel, row by row
  const t = landformClimates((x, y) => (x === 7 && y === 3 ? CLIMATES.Desert : x + y === 0 ? 300 : CLIMATES.Swamp));
  assert.equal(t.length, MAP_WIDTH * MAP_HEIGHT);
  assert.equal(t[3 * MAP_WIDTH + 7], CLIMATES.Desert);
  assert.equal(t[3 * MAP_WIDTH + 8], CLIMATES.Swamp);
  assert.equal(t[0], 300 & 255);
});

test('LANDFORM6: every land keeps off the knee - a hill or a dale smaller than the land\'s own height over the beach line, whatever the climate, on its border too', () => {
  const border = filled(CLIMATES.Mountain);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < 400; x++) border[y * MAP_WIDTH + x] = CLIMATES.Desert;
  const tables = [...Object.values(CLIMATES).map(filled), border];
  let n = 0;
  for (const t of tables) {
    for (let gx = 400 * 128 - 900; gx < 400 * 128 + 900; gx += 37) {
      for (let gy = 200 * 128; gy < 200 * 128 + 2000; gy += 211) {
        for (const e of [-1, 0, 0.5, 2, 8, 20, 50, 100, 160, 400]) {
          const v = hillsAt(gx, gy, LANDFORM_KNEE + e, 800, null, t);
          if (!(e > 0)) { assert.equal(v, 0); continue; }
          n++;
          assert.ok(Math.abs(v) < 0.91 * e, `(${gx}, ${gy}) ${e} over the knee: ${v.toFixed(3)}`);
        }
      }
    }
  }
  assert.ok(n > 10000);
});

test('LANDFORM6: each land its own character - the swamps near flat, the woodlands rolling, the ranges tall and steep, the rainforest\'s towers over plains, the haunted woods gashed by ravines; none steeper than 45 degrees', () => {
  const S = LAND;
  assert.ok(S.Swamp.span < 20 && S.Swamp.g99 < 4, `the swamps: ${S.Swamp.span.toFixed(1)} m across 10 km, ${S.Swamp.g99.toFixed(1)} degrees`);
  assert.ok(S.Woodlands.g99 < 8, `the woodlands roll: ${S.Woodlands.g99.toFixed(1)} degrees`);
  assert.ok(S.Ocean.span < S.Woodlands.span, 'the coasts\' land lower than the woodlands\'');
  assert.ok(S.Mountain.span > 200 && S.Mountain.g99 > 15, `the ranges: ${S.Mountain.span.toFixed(0)} m, ${S.Mountain.g99.toFixed(1)} degrees`);
  assert.ok(S.Mountain.span > S.MountainWoods.span && S.MountainWoods.span > S.Woodlands.span, 'the ranges over their foothills over the woods');
  assert.ok(S.Mountain.g99 > S.MountainWoods.g99 && S.MountainWoods.g99 > S.Woodlands.g99, 'and steeper in that order');
  assert.ok(S.Rainforest.p99 - S.Rainforest.p50 > 3 * (S.Rainforest.p50 - S.Rainforest.p1), `the rainforest: towers over plains (${(S.Rainforest.p99 - S.Rainforest.p50).toFixed(1)} m over, ${(S.Rainforest.p50 - S.Rainforest.p1).toFixed(1)} m under)`);
  assert.ok(S.Subtropical.gmax < S.Rainforest.gmax, 'the subtropics\' domes softer than the rainforest\'s towers');
  assert.ok(S.HauntedWoodlands.p50 - S.HauntedWoodlands.p1 > 1.1 * (S.HauntedWoodlands.p99 - S.HauntedWoodlands.p50), 'the haunted woods: cut down more than they stand up');
  for (const [k, s] of Object.entries(S)) assert.ok(s.gmax < 45, `${k}: ${s.gmax.toFixed(1)} degrees at the steepest`);
  // the creases: a haunted wood's sharpest are its ravines' bottoms, a range's its crests (the Laplacian's far tails over
  // 5 km at a value every 4 samples - a valley's crease is a strongly positive one, a crest's a strongly negative one)
  const creases = (climate) => {
    const t = filled(climate), n = 200, F = new Float64Array(n * n), lap = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) F[y * n + x] = hillsAt(400 * 128 + x * 4, 200 * 128 + y * 4, 400, 600, null, t);
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) lap.push(F[y * n + x + 1] + F[y * n + x - 1] + F[(y + 1) * n + x] + F[(y - 1) * n + x] - 4 * F[y * n + x]);
    lap.sort((a, b) => a - b);
    return lap[Math.floor(0.995 * (lap.length - 1))] / -lap[Math.floor(0.005 * (lap.length - 1))];
  };
  const ravines = creases(CLIMATES.HauntedWoodlands), crests = creases(CLIMATES.Mountain), rolls = creases(CLIMATES.Woodlands);
  assert.ok(ravines > 2, `the haunted woods' creases are ravines (valley to crest ${ravines.toFixed(2)})`);
  assert.ok(crests < 0.7, `the ranges' creases are crests (${crests.toFixed(2)})`);
  assert.ok(rolls > 0.8 && rolls < 1.25, `the woodlands roll, creased neither way (${rolls.toFixed(2)})`);
});

test('LANDFORM6: the deserts - the Alik\'r\'s dune seas lie across the wind, a long rise to windward and a steep slip face to lee; Dak\'fron\'s stand mesas among them', () => {
  const t = filled(CLIMATES.Desert), W = 0.35, cs = Math.cos(W), sn = Math.sin(W);
  let along = 0, across = 0, rise = 0, nr = 0, fall = 0, nf = 0;
  for (let k = 0; k < 30; k++) {
    const x0 = 400 * 128 + k * 997, y0 = 200 * 128 + k * 613;
    const line = (dx, dy) => Array.from({ length: 320 }, (_, i) => hillsAt(x0 + dx * i, y0 + dy * i, 400, 600, null, t));
    const crests = (h) => h.reduce((n, v, i) => n + (i > 0 && i < h.length - 1 && v > h[i - 1] && v >= h[i + 1] ? 1 : 0), 0);
    const a = line(cs, sn);
    along += crests(a);
    across += crests(line(-sn, cs));
    for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; if (d > 0.05) { rise += d; nr++; } else if (d < -0.05) { fall -= d; nf++; } }
  }
  assert.ok(along > 1.5 * across, `crests crossed along the wind ${along}, across it ${across}`);
  assert.ok(fall / nf > 1.6 * (rise / nr) && nr > 1.5 * nf, `the slip face: ${(fall / nf).toFixed(3)} a sample down, ${(rise / nr).toFixed(3)} up, the rise ${nr} samples long to the fall's ${nf}`);
  // mesas: flat tops high over the sand - Dak'fron's rock field gives way to them far more than the Alik'r's
  const flatHigh = (F) => {
    const v = [...F].sort((a, b) => a - b), hi = v[Math.floor(0.8 * v.length)];
    let n = 0;
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const a = F[y * N + x]; if (a >= hi && Math.abs(F[y * N + x + 1] - a) < 0.6 && Math.abs(F[(y + 1) * N + x] - a) < 0.6) n++; }
    return n / (N * N);
  };
  const sand = flatHigh(field(filled(CLIMATES.Desert))), rock = flatHigh(field(filled(CLIMATES.Desert2)));
  assert.ok(rock > 2.5 * sand && rock > 0.01, `mesa tops: Dak'fron ${rock.toFixed(3)} of the land, the Alik'r ${sand.toFixed(3)}`);
});

test('LANDFORM6: where climates meet their lands blend across about a pixel - each its own, to the bit, a pixel in from the border, and no step on the way', () => {
  const t = filled(CLIMATES.Woodlands);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 400; x < MAP_WIDTH; x++) t[y * MAP_WIDTH + x] = CLIMATES.Mountain;
  const wood = filled(CLIMATES.Woodlands), peak = filled(CLIMATES.Mountain);
  // the border runs between the centres of pixels 399 and 400 - x = 399.5 to 400.5 pixels in samples
  let steps = 0, worstStep = 0, pureStep = 0;
  for (const gy of [200 * 128 + 17, 200 * 128 + 64, 201 * 128 + 99]) {
    let last = null, lastPure = null;
    for (let gx = 397 * 128; gx <= 403 * 128; gx += 2) {
      const v = hillsAt(gx, gy, 400, 600, null, t), p = hillsAt(gx, gy, 400, 600, null, peak);
      if (gx <= 399.5 * 128) assert.ok(Object.is(v, hillsAt(gx, gy, 400, 600, null, wood)), `${gx}: the woodlands' own`);
      if (gx >= 400.5 * 128) assert.ok(Object.is(v, p), `${gx}: the mountains' own`);
      if (last !== null) { worstStep = Math.max(worstStep, Math.abs(v - last)); pureStep = Math.max(pureStep, Math.abs(p - lastPure)); steps++; }
      last = v; lastPure = p;
    }
  }
  assert.ok(steps > 1000 && worstStep <= pureStep * 1.15, `the blend's steepest step ${worstStep.toFixed(2)} against the mountains' own ${pureStep.toFixed(2)}`);
  // and a seam across the climate border, the network and a site with it, one number from both pixels
  const lf = createLandforms({ woods, roads: network(), sites: landformSites([{ px: 400, py: 250, loc: { exterior: { exteriorData: { width: 3, height: 3 } }, mapTableData: { locationType: 0 } } }]), climates: t });
  const cache = new Map();
  const S = (px, py) => { const k = `${px},${py}`; if (!cache.has(k)) cache.set(k, generateSamples(woods, px, py, H, lf)); return cache.get(k); };
  for (const [px, py] of [[398, 250], [399, 250], [400, 250], [399, 249], [400, 249], [399, 251]]) {
    const a = S(px, py), east = S(px + 1, py), north = S(px, py - 1);
    for (let k = 0; k < H; k++) {
      assert.ok(Object.is(a[128 * H + k], east[k]), `${px},${py} east edge ${k}`);
      assert.ok(Object.is(a[k * H + 128], north[k * H]), `${px},${py} north edge ${k}`);
    }
  }
});

test('LANDFORM6: the climates ride every kernel - the worker keeps the posted table and cuts what this thread cuts; the host reads the climate map after the boot\'s coastal dilation and hands it over with the sites', async () => {
  const t = filled(CLIMATES.Woodlands);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 401; x < MAP_WIDTH; x++) t[y * MAP_WIDTH + x] = CLIMATES.Desert;
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js?landform6');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: WOODS_BYTES.slice() } });
    globalThis.onmessage({ data: { t: 'landform-tables', sites: null, climates: t.slice() } });
    const job = { px: 401, py: 250, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Desert, landform: true };
    globalThis.onmessage({ data: { t: 'job', ...job, tilemap: job.tilemap.slice() } });
    const done = posted.findLast((m) => m.t === 'done');
    const here = generatePixelTerrain({ woods, climates: t, ...job });
    assert.deepEqual([...done.samples], [...here.samples], 'the samples - the Alik\'r\'s dunes');
    assert.notDeepEqual([...here.samples], [...generatePixelTerrain({ woods, ...job }).samples], 'and the climate moved them');
    globalThis.onmessage({ data: { t: 'grid', id: 9, px: 401, py: 250, stride: 2, samples: here.samples, landform: true } });
    const grid = posted.findLast((m) => m.t === 'grid');
    assert.deepEqual([...grid.normals], [...restrideGrid({ woods, px: 401, py: 250, stride: 2, samples: here.samples, landform: true, climates: t }).normals], 'a promotion\'s ghost rows too');
  } finally { globalThis.postMessage = prevPost; globalThis.onmessage = prevOn; }
  const world = src('src/scenes/world.js');
  assert.ok(world.indexOf('dilateCoastalClimate(maps, 2)') > 0 && world.indexOf('dilateCoastalClimate(maps, 2)') < world.indexOf('_landformClimates = landformClimates('), 'after the dilation, as every pixel streams the climates');
  assert.match(world, /_landformClimates = landformClimates\(\(x, y\) => maps\.getClimateIndex\(x, y\)\);/, 'the climate map\'s own values');
  assert.match(world, /terrainGen\.setLandformTables\(\{ sites: _landformSites, climates: _landformClimates \}\);/, 'handed to both kernels with the sites');
});

test('LANDFORM8 (WOD-PEAKS): the mountain lands stand rounded peaks where World of Daggerfall\'s spires stood - a bell from summit to foot, no taller than its land\'s `peaks.high`, 550 m to a kilometre across its radius, centred so the land\'s mean is its own, and no other land wears one', () => {
  const L = LANDFORM_DIALS.lands;
  assert.deepEqual(Object.keys(L).filter((k) => L[k].peaks), ['mountainWoods', 'mountain'], 'the mountains and their woods alone');
  assert.ok(L.mountain.peaks.high * 1.25 <= 200 && L.mountainWoods.peaks.high * 1.25 <= 140, 'not super huge: 200 m and 140 m at the most');
  // the field: 0..1, round on top (the summit is a smooth maximum), easing to nothing at the foot
  const { cell, fill } = L.mountain.peaks;
  let best = { v: 0, x: 0, y: 0 }, sum = 0, n = 0;
  for (let y = 0; y < 6 * cell; y += 4) for (let x = 0; x < 6 * cell; x += 4) {
    const v = peakField(x, y, cell, fill);
    assert.ok(v >= 0 && v <= 1);
    if (v > best.v) best = { v, x, y };
    sum += v; n++;
  }
  assert.ok(best.v > 0.3, 'peaks stand');
  const s = 2;   // the summit: no crease - the field falls by about the same either side of it, and slowly
  const around = [[s, 0], [-s, 0], [0, s], [0, -s]].map(([dx, dy]) => best.v - peakField(best.x + dx, best.y + dy, cell, fill));
  assert.ok(Math.max(...around) < 0.01, `a round top (${around.map((d) => d.toFixed(4)).join(', ')})`);
  // the steepest a bell's flank stands: high x pi / 2 over its narrowest radius, at most some 30 degrees
  const slope = (L.mountain.peaks.high * 1.25 * Math.PI / 2) / (0.24 * cell * 6.4);
  assert.ok(Math.atan(slope) * 180 / Math.PI < 31, `the steepest flank ${(Math.atan(slope) * 180 / Math.PI).toFixed(1)} degrees`);
  // centred: PEAK_MEAN is the field's own mean per unit of fill, within a twentieth
  assert.ok(Math.abs(sum / n / fill - PEAK_MEAN) / PEAK_MEAN < 0.05, `the mean ${(sum / n / fill).toFixed(4)} against PEAK_MEAN ${PEAK_MEAN.toFixed(4)}`);
  // the land wears them: over a broad sweep of all-mountain country the hills reach past anything the ridges alone can
  // stand (their tallest is high x upland), and the land's mean stays at its own height - the peaks centred
  const cl = landformClimates(() => CLIMATES.Mountain);
  let top = -Infinity, total = 0, count = 0;
  for (let y = 0; y < 60000; y += 97) for (let x = 0; x < 60000; x += 101) {
    const h = hillsAt(x + 128 * 300, y + 128 * 200, LANDFORM_KNEE + 3000, LANDFORM_KNEE + 2000, null, cl);
    if (h > top) top = h;
    total += h; count++;
  }
  assert.ok(top > L.mountain.high * L.mountain.upland + 0.3 * L.mountain.peaks.high, `peaks stand on the hills (${top.toFixed(1)} units at the highest)`);
  assert.ok(Math.abs(total / count) < 2, `and the land's mean is its own (${(total / count).toFixed(2)} units)`);
});
