// MAP-WHOLE (2026-10-26, the owner: "The held map still struggles to load everything at once"; bible/03-World/
// Arena-Provinces.md MAP-WHOLE) - THE HELD MAP PAST THE BAY, WHOLE FROM ITS FIRST FRAMES: the continent's dots
// rasterised by hand (ui/inkRaster.js, ui/tamrielInk.js rasterPass) and the base under every tile owed
// (ui/tamrielTiles.js BASE_SCALE).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCoverage, clearCoverage, stampSquare, coveragePixels, penRgb, RASTER_SS } from '../../src/ui/inkRaster.js';
import { createTamrielTiles, BASE_SCALE, baseLevelIndex, tileLevelIndex, TILE_PX, LEVEL_STEPS } from '../../src/ui/tamrielTiles.js';
import { paintPastBay, RASTER_STEP_SHARE, PAST_BAY_STEP } from '../../src/ui/tamrielInk.js';
import { setArenaRoads, beyondKey } from '../../src/world/arenaRoads.js';
import { pathPen, penSolid } from '../../src/ui/ink/inkMap.js';
import { DIR } from '../../src/world/road/roadNetwork.js';

test('MAP-WHOLE the mask: a square inks the samples its area holds, two squares their union (never twice), a pixel\'s alpha its covered share; the word-wise sum and the sample-wise one agree (mutant: the edge rule, the union, the share, the word sum)', () => {
  assert.equal(RASTER_SS, 4);
  const cov = createCoverage(4, 4);
  stampSquare(cov, 2, 2, 1);   // device pixels [1.5, 2.5) both ways: samples whose centres lie inside
  let n = 0;
  for (const v of cov.mask) n += v;
  assert.equal(n, 16, 'a one-pixel square: sixteen samples');
  const px = coveragePixels(cov, [10, 20, 30]);
  const alpha = (x, y) => px[(y * 4 + x) * 4 + 3];
  assert.deepEqual([alpha(1, 1), alpha(2, 1), alpha(1, 2), alpha(2, 2)], [64, 64, 64, 64], 'a quarter of each of the four pixels it straddles');
  assert.deepEqual([...px.subarray(0, 3)], [10, 20, 30], 'the pen\'s colour solid under the alpha');
  stampSquare(cov, 2, 2, 1);
  n = 0; for (const v of cov.mask) n += v;
  assert.equal(n, 16, 'the same square again: the union, not the sum');
  stampSquare(cov, 2.5, 2, 1);
  n = 0; for (const v of cov.mask) n += v;
  assert.equal(n, 24, 'half over it: the union grows by the half that is new');
  // the word-wise sum (four samples a word) against the sample-wise one (any other grain)
  const a = createCoverage(16, 16), b = createCoverage(16, 16, 3);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const sq = [];
  for (let k = 0; k < 40; k++) sq.push([rnd() * 16, rnd() * 16, 0.3 + rnd() * 2]);
  for (const [x, y, w] of sq) stampSquare(a, x, y, w);
  const words = coveragePixels(a, [0, 0, 0]);
  let byHand = 0, sum = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = 0; for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) c += a.mask[(y * 4 + v) * 64 + x * 4 + u];
    byHand += Math.abs(Math.round((c * 255) / 16) - words[(y * 16 + x) * 4 + 3]); sum += c;
  }
  assert.equal(byHand, 0, 'the word-wise sum is the samples\' own');
  assert.ok(sum > 0);
  for (const [x, y, w] of sq) stampSquare(b, x, y, w);
  assert.ok(coveragePixels(b, [0, 0, 0]).some((v, i) => i % 4 === 3 && v > 0), 'a grain of three: summed sample by sample');
  clearCoverage(a);
  assert.ok(a.mask.every((v) => v === 0) && a.any === false, 'cleared for the next pass');
  assert.deepEqual(penRgb('rgba(46, 32, 18, 0.42)'), [46, 32, 18]);
});

/** A canvas whose 2D context records its rects, fills, puts and lays - and takes pixels where `pixels`. */
function canvas(pixels = true) {
  const log = { rects: 0, fills: 0, puts: [], draws: [] };
  const c = { width: 0, height: 0, log };
  const ctx = {
    canvas: c, globalAlpha: 1, fillStyle: '', lineCap: '', lineJoin: '',
    setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, clip() {},
    rect() { log.rects++; }, fill() { log.fills++; },
    drawImage(img) { log.draws.push({ img, alpha: ctx.globalAlpha }); },
    ...(pixels ? { putImageData(img) { log.puts.push(img); } } : {}),
  };
  c.getContext = () => ctx;
  return c;
}

test('MAP-WHOLE the continent\'s dots: rasterised into the job\'s mask - one put a pass, laid down at the pen\'s alpha, each pixel\'s dot a square of the far pen\'s width - and a canvas that takes no pixels paints its path of rects as before (mutant: the raster unread, the width, the lay)', () => {
  const was = globalThis.ImageData;
  globalThis.ImageData = class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };
  try {
    // a road along row -100 past the Bay, x 2000..2063, and a track under it
    const roads = new Map(), tracks = new Map();
    for (let x = 2000; x < 2064; x++) { roads.set(beyondKey(x, -100), DIR.E | DIR.W); tracks.set(beyondKey(x, -98), DIR.E | DIR.W); }
    setArenaRoads({ roads, tracks, join: new Map() });
    const view = { ox: 1990, oy: -110, scale: 0.5 }, opts = { paperW: 64, paperH: 32, band: 'far', continent: true, filters: {} };
    const sheet = canvas(), scratch = canvas();
    const cov = createCoverage(128, 64);
    let pixels = null;
    scratch.width = 128; scratch.height = 64;
    const job = { scratch: () => scratch.getContext(), coverage: () => cov, pixels: () => (pixels ??= new Uint8ClampedArray(128 * 64 * 4)) };
    const it = paintPastBay(sheet.getContext(), view, opts, job);
    for (const _ of it) { /* every step */ }
    assert.equal(scratch.log.rects, 0, 'no path of rects');
    assert.equal(scratch.log.puts.length, 2, 'one put a pass: the tracks, then the roads');
    const lays = sheet.getContext().canvas.log.draws;
    assert.deepEqual(lays.map((d) => d.alpha), [penSolid(pathPen('tracks', 'far').style).alpha, penSolid(pathPen('roads', 'far').style).alpha], 'each laid down once at its pen\'s alpha');
    // the roads' pass: the last put - the road's row (paper y 5, device 10) inked, the gap between the two rows not
    const roadsPut = scratch.log.puts[1].data;
    const a = (x, y) => roadsPut[(y * 128 + x) * 4 + 3];
    assert.ok(a(40, 10) > 0 && a(40, 11) > 0, 'the road\'s row - a square of the far pen\'s width (1 paper pixel: 2 device pixels) on each pixel\'s centre');
    assert.equal(a(40, 13), 0, 'off the row');
    assert.deepEqual([...roadsPut.subarray((10 * 128 + 40) * 4, (10 * 128 + 40) * 4 + 3)], penRgb(pathPen('roads', 'far').style), 'in the pen\'s colour');
    // no pixels: the canvas's own path of rects, as before
    const plain = canvas(false), plainSheet = canvas(false);
    plain.width = 128;
    for (const _ of paintPastBay(plainSheet.getContext(), view, opts, { scratch: () => plain.getContext(), coverage: () => cov })) { /* */ }
    assert.equal(plain.log.rects, 128, 'every pixel a rect, roads and tracks');
    assert.ok(RASTER_STEP_SHARE > 0 && RASTER_STEP_SHARE < 1 && PAST_BAY_STEP === 2048);
  } finally { globalThis.ImageData = was; setArenaRoads(null); }
});

/** A tiles rig: the paint records each tile's view and options; the clock a step a paint. */
function rig() {
  const painted = [];
  const make = () => {
    const c = { width: 0, height: 0 };
    c.getContext = () => ({ setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {}, canvas: c });
    return c;
  };
  const tiles = createTamrielTiles({ paint: (ctx, view, w, h, opts) => { painted.push({ view, opts }); }, stamp: () => 'w', make, now: () => 0 });
  const drawn = [];
  const sheet = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, drawImage: (img, ...a) => drawn.push(a) };
  return { tiles, painted, sheet, drawn };
}

test('MAP-WHOLE the base: the continent\'s whole frame at BASE_SCALE, painted before the view\'s tiles, the stand-in under every one owed - no hole; its words read again only when its version moves; kept apart from TILES_KEPT and let go on close (mutant: the base unpainted, unasked as a stand-in, its words every frame, let go with the view\'s)', () => {
  assert.equal(BASE_SCALE, 0.25);
  assert.equal(baseLevelIndex(1), tileLevelIndex(0.25));
  assert.equal(baseLevelIndex(2), tileLevelIndex(0.125), 'at two device pixels a point, the same pixels');
  const r = rig();
  const frame = { x0: -2000, y0: -1500, w: 6000, h: 3750 };
  const base = { key: 'far|1|{}|null', paint: { band: 'far', continent: true }, frame, version: 'v1' };
  const bspan = TILE_PX / (2 ** (baseLevelIndex(1) / LEVEL_STEPS));
  const bases = (Math.floor((frame.x0 + frame.w - 1e-9) / bspan) - Math.floor(frame.x0 / bspan) + 1) * (Math.floor((frame.y0 + frame.h - 1e-9) / bspan) - Math.floor(frame.y0 / bspan) + 1);
  // a near view: none of its tiles kept, no level within two doublings - the base stands in
  const view = { ox: 1500, oy: -300, scale: 6 }, o = { paperW: 600, paperH: 300, dpr: 1, key: 'near|0|{}|null', paint: { band: 'near' }, budgetMs: 0, force: true, base };
  r.tiles.draw(r.sheet, view, o);
  assert.equal(r.painted.length, 1, 'one step at the least, and it is the base\'s');
  assert.equal(r.painted[0].view.scale, 2 ** (baseLevelIndex(1) / LEVEL_STEPS));
  assert.deepEqual(r.painted[0].opts, base.paint);
  // the rest of the base, then the view's own: a budget that lasts
  const o2 = { ...o, budgetMs: 1 };
  r.tiles.draw(r.sheet, view, o2);
  assert.equal(r.painted.filter((p) => p.opts.band === 'far').length, bases, `every base tile (${bases}) before any of the view's`);
  assert.deepEqual(r.tiles.baseKept(), { tiles: bases, whole: bases });
  const s = r.tiles.stats();
  assert.equal(s.holes, 0, 'no hole: the view\'s tiles all painted, or the base under them');
  // a far view never painted: every tile owed shows the base
  const r2 = rig();
  r2.tiles.draw(r2.sheet, { ox: 0, oy: -800, scale: 0.6 }, { ...o, key: 'far|1|{}|null', paint: { band: 'far' }, budgetMs: 0, force: false });
  assert.equal(r2.tiles.stats().holes, r2.tiles.stats().want, 'settling, no base yet: every tile a hole');
  for (let k = 0; k < 4 * bases && r2.tiles.baseKept().whole < bases; k++) r2.tiles.draw(r2.sheet, { ox: 0, oy: -800, scale: 0.6 }, { ...o, key: 'far|1|{}|null', paint: { band: 'far' }, budgetMs: 0 });
  r2.drawn.length = 0;
  r2.tiles.draw(r2.sheet, { ox: 0, oy: -800, scale: 0.6 }, { ...o, key: 'far|1|{}|null', paint: { band: 'far' }, budgetMs: 0, force: false });
  assert.equal(r2.tiles.stats().holes, 0, 'the base standing: no hole');
  assert.ok(r2.tiles.stats().stood > 0 && r2.drawn.length > 0, 'the base drawn under them');
  // the words: read again only when the version moves
  let stamps = 0;
  const r3 = createTamrielTiles({ paint: () => {}, stamp: () => { stamps++; return 'w'; }, make: () => ({ width: 0, height: 0, getContext: () => ({ setTransform() {}, clearRect() {}, drawImage() {} }) }), now: () => 0 });
  const small = { ...base, frame: { x0: 0, y0: 0, w: 1000, h: 1000 } };
  const tiny = { paperW: 10, paperH: 10, dpr: 1, key: 'k', base: small, budgetMs: 1 };
  r3.draw(r.sheet, { ox: 0, oy: 0, scale: 6 }, tiny);
  const once = stamps;
  r3.draw(r.sheet, { ox: 0, oy: 0, scale: 6 }, tiny);
  assert.ok(stamps - once <= 2, `the base whole and its version unmoved: its words unread (${stamps - once} stamps, the view's own)`);
  r3.draw(r.sheet, { ox: 0, oy: 0, scale: 6 }, { ...tiny, base: { ...small, version: 'v2' } });
  assert.ok(stamps - once > 2, 'the version moved: read again');
  // apart from the view's count; let go on close
  assert.ok(r.tiles.kept() < bases + 30, 'the base is not the view\'s');
  r.tiles.clear();
  assert.deepEqual(r.tiles.baseKept(), { tiles: 0, whole: 0 });
});
