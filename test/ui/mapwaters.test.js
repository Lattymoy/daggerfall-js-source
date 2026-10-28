// MAP-WATERS (2026-10-26, the coordinator: "The held map should draw G's Cyrodiil rivers and smoothed lake shores";
// bible/03-World/Arena-Provinces.md MAP-WATERS) - stream G's rivers and lakes (world/tamriel/tamrielWaters.js) on the held
// map off the terrain worker's copy (world/tamriel/watersInk.js), in the shore's hand, a tile's paint like the roads';
// Cyrodiil's lakes at the ground's own smooth shore; and the middle ring's water where G's rivers run. Pinned with no game
// data; with ARENA2 on the freeware's own trace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { setWatersInk, watersInk, watersInkVersion, packWatersInk } from '../../src/world/tamriel/watersInk.js';
import { paintPastBay, pastBayStamp, riverRuns, watersInView, RIVER_PEN, ringChain, buildTamrielInk, tracedChains } from '../../src/ui/tamrielInk.js';
import { PEN } from '../../src/ui/ink/inkMap.js';
import { setTamrielTrace, IMPERIAL_ID } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { midRingVertices } from '../../src/render/midRing.js';
import { midRingSide } from '../../src/world/terrain/midRingGrid.js';
import { TerrainGenClient } from '../../src/world/terrain/terrainGenClient.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';

const PIXEL_M = 819.2;

/** A river along y = 10.5 from x = 0 to x = 40 Bay pixels, widening 100 m to 900 m; a lake ring round (20, 30). */
function fakeWaters() {
  const n = 81, pts = new Float32Array(2 * n), width = new Float32Array(n);
  for (let i = 0; i < n; i++) { pts[2 * i] = i / 2; pts[2 * i + 1] = 10.5; width[i] = 100 + 10 * i; }
  const ring = new Float32Array(2 * 16);
  for (let i = 0; i < 16; i++) { ring[2 * i] = 20 + 3 * Math.cos((i / 16) * 2 * Math.PI); ring[2 * i + 1] = 30 + 2 * Math.sin((i / 16) * 2 * Math.PI); }
  return { rivers: [{ key: 'test', n, pts, width }], lakes: [ring] };
}

/** A 2D context recording each stroke: its width, its pen and its points (paper). */
function recorder() {
  const strokes = [];
  let pts = [];
  const ctx = {
    lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: '', lineJoin: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '',
    save() {}, restore() {}, setLineDash() {}, beginPath() { pts = []; }, moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); },
    stroke() { strokes.push({ width: ctx.lineWidth, style: ctx.strokeStyle, pts }); }, fill() {}, rect() {}, arc() {}, closePath() {},
    fillText() {}, strokeText() {}, drawImage() {}, setTransform() {}, clearRect() {}, clip() {},
  };
  return { ctx, strokes };
}

test('MAP-WATERS the store: the worker\'s copy installed and dropped, every install a new version; the law packed in Float32 with its transfer list (mutant: the version, the packing)', () => {
  const v0 = watersInkVersion();
  setWatersInk(fakeWaters());
  assert.equal(watersInkVersion(), v0 + 1);
  assert.equal(watersInk().rivers[0].key, 'test');
  setWatersInk(null);
  assert.equal(watersInk(), null);
  assert.equal(watersInkVersion(), v0 + 2);
  const law = { rivers: [{ key: 'k', n: 2, pts: Float64Array.from([1, 2, 3, 4]), width: Float64Array.from([10, 20]), level: [1, 2] }], lakes: [{ ring: Float64Array.from([5, 6, 7, 8]) }] };
  const { ink, transfer } = packWatersInk(law);
  assert.ok(ink.rivers[0].pts instanceof Float32Array && ink.lakes[0] instanceof Float32Array);
  assert.deepEqual([...ink.rivers[0].pts, ...ink.rivers[0].width, ...ink.lakes[0]], [1, 2, 3, 4, 10, 20, 5, 6, 7, 8]);
  assert.equal(transfer.length, 3);
  assert.deepEqual(packWatersInk(null), { ink: null, transfer: [] });
});

test('MAP-WATERS a river\'s runs: its metres at the view\'s scale in half-pixel steps, a hairline at the least, held under the most; each run\'s last point the next one\'s first; thinned out on the continent (mutant: the scale, the step, the floor, the shared point, the thinning)', () => {
  const r = fakeWaters().rivers[0];
  assert.deepEqual([RIVER_PEN.min, RIVER_PEN.step, RIVER_PEN.max], [0.9, 0.5, 14]);
  const near = riverRuns(r, 4);
  const want = (i) => Math.min(14, Math.max(0.9, Math.round((r.width[i] / PIXEL_M) * 4 / 0.5) * 0.5));
  assert.equal(near[0].width, want(0));
  assert.equal(near.at(-1).width, want(r.n - 1));
  for (let k = 1; k < near.length; k++) {
    assert.ok(near[k].width !== near[k - 1].width);
    assert.deepEqual(near[k][0] ?? near[k].chain[0], near[k - 1].chain.at(-1), 'the run\'s first point its neighbour\'s last');
  }
  const far = riverRuns(r, 0.05);
  assert.deepEqual(far.map((x) => x.width), [0.9], 'out on the continent: one hairline');
  assert.ok(far[0].chain.length < r.n / 4, `thinned to a third of a paper pixel (${far[0].chain.length} of ${r.n})`);
  assert.equal(riverRuns(r, 4), near, 'kept a scale at a time');
});

test('MAP-WATERS on the sheet: the rivers and the lakes a tile\'s paint, under the roads - each run its wash, then its line at its width; a lake\'s ring in the coast\'s own hand; none off the view; the tiles\' word moves with an install (mutant: the paint unasked, the wash, the line\'s width, the cull, the word)', () => {
  setWatersInk(fakeWaters());
  try {
    const { ctx, strokes } = recorder();
    const view = { ox: 0, oy: 0, scale: 4 };
    paintPastBay(ctx, view, { paperW: 200, paperH: 200, band: 'near', continent: false, filters: {} });   // painted whole (no job)
    const runs = riverRuns(watersInk().rivers[0], 4);
    const lines = strokes.filter((s) => s.style === PEN.line), washes = strokes.filter((s) => s.style === PEN.wash);
    for (const run of runs) {
      assert.ok(lines.some((s) => s.width === run.width), `a line at ${run.width}`);
      assert.ok(washes.some((s) => s.width === Math.max(RIVER_PEN.wash, run.width * 2 + 1)), 'its wash');
    }
    assert.ok(strokes.findIndex((s) => s.style === PEN.wash) < strokes.findIndex((s) => s.style === PEN.line), 'the wash under the line');
    assert.ok(lines.some((s) => s.width === 1.3 && s.pts.length >= 16) && washes.some((s) => s.width === Math.max(3, 4 * 1.6)), 'the lake in the coast\'s hand');
    const off = recorder();
    paintPastBay(off.ctx, { ox: 500, oy: 500, scale: 4 }, { paperW: 200, paperH: 200, band: 'near', continent: false, filters: {} });
    assert.equal(off.strokes.filter((s) => s.style === PEN.wash).length, 0, 'none off the view - not a wash begun (the roads\' own pens stroke there, the waters\' none)');
    const fake = watersInk(), sheet = (ox, oy) => watersInView({ ox, oy, scale: 4 }, 200, 200, fake);
    assert.deepEqual([sheet(0, 0).rivers.length, sheet(0, 0).lakes.length], [1, 1], 'both on the sheet that holds them');
    assert.deepEqual([sheet(500, 500).rivers.length, sheet(500, 500).lakes.length], [0, 0], 'neither walked off the view (their runs never made there)');
    assert.deepEqual([sheet(-50, 11).rivers.length, sheet(-50, 11).lakes.length], [1, 0], 'a pixel\'s slack: the river at y 10.5 still reached from a sheet whose top is 11, the lake east of it not');
    const w = pastBayStamp(0, 0, 10, 10);
    setWatersInk(fakeWaters());
    assert.notEqual(pastBayStamp(0, 0, 10, 10), w, 'a new install: every tile painted again');
  } finally { setWatersInk(null); }
  assert.deepEqual(ringChain(Float32Array.from([1, 2, 3, 4])), [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 1, y: 2 }], 'a ring closed');
});

// PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): CYRODIIL-SHORES' own lake ink (lakeShoreChains, LAKE_INK_SS) is
// gone - every shore the held map draws is the land's one smooth law's (tamrielInk.js tracedChains), a lake's as the sea's
test('MAP-WATERS a lake\'s shore on the held map is the land\'s smooth law\'s: one closed chain round each lake - Cyrodiil\'s (the zone\'s line) and High Rock\'s alike - of many points, within the lake\'s own pixels and a pixel of them, and none the picture\'s staircase (mutant: the ink back on the picture\'s pixels)', () => {
  // Cyrodiil a block of land with a 6 x 4 lake in it; High Rock's block beside with a lake of its own
  const w = 60, h = 40, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 5; y < 35; y++) for (let x = 5; x < 55; x++) { land[y * w + x] = 1; province[y * w + x] = x < 30 ? IMPERIAL_ID : 1; }
  for (let y = 15; y < 19; y++) for (let x = 12; x < 18; x++) land[y * w + x] = 0;   // Cyrodiil's lake
  for (let y = 15; y < 19; y++) for (let x = 40; x < 44; x++) land[y * w + x] = 0;   // High Rock's
  const trace = { w, h, land, province };
  setTamrielFit({ ox: -2000, oy: 0, ppu: 10 });   // the picture east of the Bay: Bay x = 2000 + 10 picture x
  setTamrielTrace(trace);
  try {
    const X = (p) => (p.x - 2000) / 10, Y = (p) => p.y / 10;   // back to picture units
    const coast = buildTamrielInk({}).coast;
    for (const [x0, x1] of [[12, 18], [40, 44]]) {
      const round = coast.filter((ch) => ch.every((p) => X(p) > x0 - 1 && X(p) < x1 + 1 && Y(p) > 14 && Y(p) < 20));
      assert.equal(round.length, 1, `one shore round the lake at ${x0}`);
      const c = round[0];
      assert.deepEqual(c[0], c.at(-1), 'closed');
      let turn = 0;
      for (let i = 1; i + 1 < c.length; i++) {
        const a1 = Math.atan2(c[i].y - c[i - 1].y, c[i].x - c[i - 1].x), a2 = Math.atan2(c[i + 1].y - c[i].y, c[i + 1].x - c[i].x);
        turn = Math.max(turn, Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI));
      }
      assert.ok(c.length > 16 && turn < (40 * Math.PI) / 180, `a smooth shore (${c.length} points, its sharpest turn ${(turn * 180 / Math.PI).toFixed(1)} degrees) - never the staircase's square corner nor the contour's 45-degree cut`);
      const square = c.filter((p) => Math.abs(X(p) - Math.round(X(p))) < 1e-3 && Math.abs(Y(p) - Math.round(Y(p))) < 1e-3);
      assert.equal(square.length, 0, 'no point on a pixel\'s corner: the staircase is gone');
    }
    assert.deepEqual(coast.flat().filter((p) => X(p) > 10 && X(p) < 20 && Y(p) > 13 && Y(p) < 21).length > 0, true);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('MAP-WATERS the middle ring draws G\'s rivers as water: the worker\'s flags laid a band at a time by the client, every flagged vertex the sea\'s look at its own height (mutant: the flags dropped, the band\'s offset)', async () => {
  const radius = 1, sub = 4, side = midRingSide(radius, sub), wet = new Uint8Array(side * side);
  wet[5 * side + 6] = 255;
  const v = midRingVertices({ heights: new Float32Array(side * side).fill(120), baseX: 0, baseY: 0, radius, sub, tintAt: () => [1, 2, 3], seaY: 34, wet });
  assert.equal(v.sea[5 * side + 6], 255);
  assert.equal(v.sea[5 * side + 7], 0);
  // the client: the second band's flags at their own rows
  const sent = [];
  let wk = null;
  const woods = new WoodsFile(); woods.load(syntheticWoodsBytes());
  const client = new TerrainGenClient({ woods, woodsBytes: new Uint8Array(4), workerFactory: () => (wk = { postMessage: (msg) => sent.push(msg), terminate() {} }) });
  const job = { baseX: 1, baseY: 2, radius: 3, sub: 4, landform: false }, sideJ = midRingSide(3, 4);
  const p = client.midRing(job);
  for (let k = 0; k < 4; k++) {
    const at = sent.filter((x) => x.t === 'midring').at(-1);
    if (!at || at.done) break;
    at.done = true;
    const rows = (at.rows[1] - at.rows[0]) * 4 + (at.rows[1] === 7 ? 1 : 0);
    const flags = at.rows[0] ? new Uint8Array(rows * sideJ).fill(255) : null;
    wk.onmessage({ data: { t: 'mid', id: at.id, heights: new Float32Array(rows * sideJ), wet: flags } });
    await new Promise((r) => setTimeout(r, 0));
  }
  const got = await p;
  assert.equal(got.wet[0], 0, 'the first band dry');
  assert.equal(got.wet[4 * 4 * sideJ], 255, 'the second band\'s at its own rows');
  assert.equal(got.wet[(4 * 4 - 1) * sideJ], 0);
});

// ── WITH ARENA2: THE FREEWARE'S TRACE ──────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('MAP-WATERS with ARENA2: the Lower Niben in the middle ring - its pixels flagged three samples wide, a ring round it some 70 pixels wet; the law packed for the map whole (mutant: the sample\'s Bay y, the kinds)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { fitBayToPicture } = await import('../../src/world/tamriel/tamrielLand.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { tamrielWaters } = await import('../../src/world/tamriel/tamrielWaters.js');
  const { midRingWet, DRY } = await import('../../src/world/terrain/farClimate.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const bay = new WoodsFile(); bay.load(bytes('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const fit = fitBayToPicture({ bayLand: (x, y) => !isWaterPixel(maps.getClimateIndex(x, y), bay.getHeightMapValue(x, y)), trace });
  setTamrielTrace(trace);
  setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
  try {
    const law = tamrielWaters(), niben = law.rivers.find((r) => r.key === 'lowerNiben'), i = niben.n >> 1;
    const px = Math.floor(niben.pts[2 * i]), py = Math.floor(niben.pts[2 * i + 1]);
    let wetPixels = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (midRingWet(px + dx, py + dy, 8) !== DRY) wetPixels++;
    assert.ok(wetPixels >= 3, `the river through the pixels round it (${wetPixels})`);
    const own = midRingWet(px, py, 8);
    assert.notEqual(own, DRY);
    const across = [];
    for (let j = 0; j <= 8; j++) { let n = 0; for (let k = 0; k <= 8; k++) if (own[j * 9 + k]) n++; across.push(n); }
    assert.ok(Math.max(...across) >= 2, `a ${niben.width[i].toFixed(0)} m river two samples or more across (${across})`);
    assert.equal(midRingWet(400, 250, 8), DRY, 'the Bay: dry');
    const { ink } = packWatersInk(law);
    assert.equal(ink.rivers.length, law.rivers.length);
    assert.equal(ink.lakes.length, law.lakes.length);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
