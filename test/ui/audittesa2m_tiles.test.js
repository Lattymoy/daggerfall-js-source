// AUDIT TESA II, lane M (2026-10-25) - THE HELD MAP PAST THE BAY'S PAINT AND ITS READS, pinned where the audit found them
// wrong (ui/tamrielTiles.js, ui/tamrielInk.js, ui/ink/inkMap.js; bible/03-World/Arena-Provinces.md TESA15, MAP-LINES):
//   M1  a still view that wants more tiles than TILES_KEPT settles - it never lets go a tile it draws;
//   M3  a stand-in is found at every level (the level an integer of quarter-doublings, not a float an ulp off);
//   M10 a dense tile is painted a step at a time under the frame's budget, owed and partial meanwhile, its last paint
//       showing, each translucent pass laid down once - the same ink as the whole paint;
//   M11 the road ink's caches bounded and let go (an LRU, no empty tile kept, released on close);
//   M12 a far tile strokes every step that crosses it, however long its straight run;
//   M13 a zone border's end on the sheet's coast, never out at sea;
//   M7  the cities past the Bay under the map's filters and in MAP-KEY's hues, the hover and the press as the sheet inks;
//   M6  a city the window names itself (the zone map's) inked without the continent's name;
//   M14 a city's or a mark's glyph past the Bay answers from the Bay's side of the seam.
// Synthetic layers, places and canvases; the coast off the authored land.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setArenaRoads, beyondKey, ROAD_TILE } from '../../src/world/arenaRoads.js';
import { resetPastBayPlaces, addPastBayPlaces, pastBayPlacesIn } from '../../src/world/pastBayPlaces.js';
import {
  arenaRoadInkAt, arenaRoadSteps, pastBayStamp, paintPastBay, releasePastBayInk, roadKeptCounts, ROAD_INK_KEPT, ROAD_KEPT_TILES, ROAD_RUNS_KEPT,
  PAST_BAY_STEP, DOTS_BELOW, zoneChains, buildTamrielInk, paintTamrielInk, tamrielCityAt, tamrielHoverAt, tamrielCityBucket,
  ARENA_KIND_GLYPHS, CITY_HIT_PX, BORDER_SNAP_PX,
} from '../../src/ui/tamrielInk.js';
import { createTamrielTiles, levelOf, tileLevelIndex, TILES_KEPT, LEVEL_STEPS } from '../../src/ui/tamrielTiles.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { PEN, penSolid, pathPen, FAR_TRACK_PEN, paintInkStatic } from '../../src/ui/ink/inkMap.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { setTamrielTrace, provinceKeyAt } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, tamrielFit, bayToPicture, BAY_W, BAY_H } from '../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setArenaRoads(null); resetPastBayPlaces(); releasePastBayInk(); });

/** A context that records its calls and its state at each (globalAlpha, fillStyle, strokeStyle). */
function recCtx(canvas, clock = null) {
  const calls = [], st = { globalAlpha: 1 };
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k === 'getLineDash') return () => [];
      if (k === 'save') return () => { (st._stack ??= []).push({ globalAlpha: st.globalAlpha }); calls.push({ fn: 'save' }); };
      if (k === 'restore') return () => { Object.assign(st, st._stack?.pop() ?? {}); calls.push({ fn: 'restore' }); };
      if (k in st) return st[k];
      return (...args) => { if (clock && (k === 'rect' || k === 'lineTo')) clock.t += clock.per; calls.push({ fn: k, args, alpha: st.globalAlpha, fill: st.fillStyle, stroke: st.strokeStyle, width: st.lineWidth }); };
    },
    set: (_, k, v) => { st[k] = v; return true; },
  });
  return ctx;
}
let ids = 0;
const canvas = (clock) => { const c = { id: `c${++ids}`, width: 0, height: 0 }; const x = recCtx(c, clock); c.getContext = () => x; return c; };
const ctx2d = () => ({ setTransform() {}, clearRect() {}, drawImage() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {} });
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ctx2d() });
/** A road east-west from x0 to x1 along y. */
function run(map, x0, x1, y) {
  for (let x = x0; x <= x1; x++) map.set(beyondKey(x, y), (map.get(beyondKey(x, y)) ?? 0) | (x > x0 ? DIR.W : 0) | (x < x1 ? DIR.E : 0));
  return map;
}

// ── M1: A VIEW THAT WANTS MORE TILES THAN ARE KEPT ──────────────
test('AUDIT TESA II M1: a still view whose tiles outnumber TILES_KEPT (a 2560 x 1440 screen at two pixels a point) settles - painted once, none owed, none let go that it draws (mutant: the cap the count alone)', () => {
  let t = 0, paints = 0;
  const tiles = createTamrielTiles({ paint: () => { paints++; t += 1; }, stamp: () => 'w', make: fakeCanvas, now: () => t });
  const view = { ox: -1234.37, oy: -567.89, scale: 1.3 };
  const o = { paperW: 1984, paperH: 1210, dpr: 2, key: 'mid' };
  let frames = 0;
  while (frames < 200) { tiles.draw(ctx2d(), view, o); frames++; if (!tiles.takePending()) break; t += 8; }
  assert.ok(tiles.kept() > TILES_KEPT, `the view's own ${tiles.kept()} kept past the count`);
  assert.equal(paints, tiles.kept(), 'each painted once');
  for (let k = 0; k < 5; k++) tiles.draw(ctx2d(), view, o);
  assert.deepEqual([paints, tiles.takePending()], [tiles.kept(), false], 'and no frame after paints one again');
});

// ── M3: THE STAND-INS AT EVERY LEVEL ────────────────────────────
test('AUDIT TESA II M3: a stand-in is found at every level a zoom crosses - half a doubling from 0.125, 0.25 and 0.5, where the float an ulp off found none (mutant: the stand-in\'s level a float again)', () => {
  assert.equal(tileLevelIndex(0.25), -8);
  assert.equal(levelOf(0.25), 0.25);
  for (let n = -12; n <= 22; n++) assert.equal(tileLevelIndex(2 ** (n / LEVEL_STEPS)), n, `the level ${n} its own index`);
  const seen = [];
  const at12 = createTamrielTiles({ paint: (c, v) => { seen.push(v.scale); }, stamp: () => 'w', make: fakeCanvas, now: () => 0 });
  at12.draw(ctx2d(), { ox: 0, oy: 0, scale: 1.2 }, { paperW: 300, paperH: 200, dpr: 1, key: 'k' });
  assert.ok(seen.length && seen.every((v) => v === levelOf(1.2) && v !== 1.2), 'a view at 1.2 painted at its level, 2^0.25');
  for (const [s0, s1] of [[1, 2 ** 0.5], [0.125, 2 ** -2.5], [0.25, 2 ** -1.5], [0.5, 2 ** -0.5], [2 ** -2.75, 2 ** -2.25]]) {
    const tiles = createTamrielTiles({ paint: () => {}, stamp: () => 'w', make: fakeCanvas, now: () => 0 });
    const o = { paperW: 1150, paperH: 720, dpr: 1, key: 'far|1|{}|null' };
    for (let i = 0; i < 40; i++) tiles.draw(ctx2d(), { ox: -2000, oy: -1500, scale: s0 }, o);
    let drawn = 0;
    tiles.draw({ ...ctx2d(), drawImage() { drawn++; } }, { ox: -2000, oy: -1500, scale: s1 }, { ...o, budgetMs: 0, force: false });
    assert.ok(drawn > 0, `${s0} -> ${s1}: the kept level stands in (${drawn})`);
  }
});

// ── M10: A DENSE TILE, A STEP AT A TIME ─────────────────────────
/** A dense block of roads and tracks: every pixel of w x h a road east-west and a track. */
function denseLayer(x0, y0, w, h) {
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (let y = y0; y < y0 + h; y++) { run(layer.roads, x0, x0 + w - 1, y); run(layer.tracks, x0, x0 + w - 1, y); }
  return layer;
}
test('AUDIT TESA II M10: a dense tile is painted a step at a time - PAST_BAY_STEP rects a step, the frame\'s budget read between steps - owed and partial meanwhile, its last paint shown until the new one is whole; each translucent pass laid on the scratch solid and down once at the pen\'s alpha, the same rects as the whole paint (mutants: the steps unread; the pass laid at each step; the partial tile shown)', () => {
  assert.equal(PAST_BAY_STEP, 2048);
  // a small dense block (bounded: 12,288 pixels of each kind, three steps a kind) - every comparison below a count or a
  // boolean, never a deep diff of the rect lists (node's assert diffs two long unequal arrays in gigabytes)
  setArenaRoads(denseLayer(0, -96, 128, 96));
  const clock = { t: 0, per: 0.004 };   // 2048 rects 8 ms
  const made = [];
  const make = () => { const c = canvas(clock); made.push(c); return c; };
  let word = 'a';
  const tiles = createTamrielTiles({ paint: (c, v, w, h, o, job) => paintPastBay(c, v, { ...o, paperW: w, paperH: h }, job), stamp: () => word, make, now: () => clock.t });
  const view = { ox: 0, oy: -192, scale: 0.5 };   // the continent's dots: one tile of 512 Bay pixels
  assert.ok(view.scale < DOTS_BELOW);
  const o = { paperW: 96, paperH: 96, dpr: 1, key: 'far|1', paint: { band: 'far', continent: true, filters: {} } };
  let frames = 0, owed = true;
  const shown = [];
  while (owed && frames < 50) {
    const sheet = recCtx({ id: 'sheet' });
    owed = tiles.draw(sheet, view, o);
    shown.push(sheet.calls.filter((c) => c.fn === 'drawImage').length);
    frames++; clock.t += 16;
  }
  assert.ok(frames >= 6, `the tile over ${frames} frames, a step a frame`);
  assert.ok(shown.slice(0, -1).every((n) => n === 0), 'nothing shown while the first paint is partial - no half-painted tile');
  assert.equal(shown.at(-1), 1, 'shown whole once done');
  const tile = made.find((c) => c.getContext().calls.some((x) => x.fn === 'drawImage'));
  const laid = tile.getContext().calls.filter((x) => x.fn === 'drawImage');
  assert.deepEqual(laid.map((x) => x.alpha), [penSolid(PEN.soft).alpha, penSolid(PEN.line).alpha], 'two passes, each laid down once at its pen\'s alpha: the tracks, then the roads');
  const scratch = laid[0].args[0];
  const rects = (calls) => calls.filter((x) => x.fn === 'rect').map((x) => x.args.map((v) => v.toFixed(3)).join(','));
  const fills = scratch.getContext().calls.filter((x) => x.fn === 'fill');
  assert.ok(fills.length >= 6 && fills.every((x) => x.fill === penSolid(PEN.soft).solid || x.fill === penSolid(PEN.line).solid), `laid solid on the scratch, a fill a step (${fills.length})`);
  const whole = recCtx({ id: 'whole' });
  paintPastBay(whole, { ox: 0, oy: -512, scale: 0.5 }, { ...o.paint, paperW: 256, paperH: 256 });   // the tile's own view
  assert.equal(whole.calls.filter((x) => x.fn === 'fill').length, 2, 'the whole paint: one fill a kind');
  const a = rects(scratch.getContext().calls).sort(), b = rects(whole.calls).sort();
  assert.equal(a.length, 2 * 128 * 96, 'every pixel of each kind a rect');
  assert.ok(a.length === b.length && a.every((v, i) => v === b[i]), 'the same rects as the whole paint, each once');
  // a new word while a paint is partial: the last whole paint stands until the new one is done
  word = 'b';
  const sheet = recCtx({ id: 'sheet' });
  assert.equal(tiles.draw(sheet, view, o), true, 'owed again');
  assert.equal(sheet.calls.filter((c) => c.fn === 'drawImage').length, 1, 'its last paint shown');
});

test('AUDIT TESA II M10: the far view\'s steps a pass a kind, the roads under the tracks, each laid down once (mutant: the pens parted from strokePaths\')', () => {
  setArenaRoads(denseLayer(0, -64, 64, 64));
  const made = [];
  const tiles = createTamrielTiles({ paint: (c, v, w, h, o, job) => paintPastBay(c, v, { ...o, paperW: w, paperH: h }, job), stamp: () => 'w', make: () => { const c = canvas(null); made.push(c); return c; }, now: () => 0 });
  const o = { paperW: 256, paperH: 256, dpr: 1, key: 'far|0', paint: { band: 'far', continent: false, filters: {} } };
  for (let i = 0; i < 20 && tiles.draw(recCtx({}), { ox: 0, oy: -64, scale: 1 }, o); i++);
  const tile = made.find((c) => c.getContext().calls.some((x) => x.fn === 'drawImage'));
  assert.deepEqual(tile.getContext().calls.filter((x) => x.fn === 'drawImage').map((x) => x.alpha), [penSolid(PEN.line).alpha, penSolid(PEN.soft).alpha]);
  assert.deepEqual([pathPen('roads', 'far').width, pathPen('tracks', 'far').width, pathPen('tracks', 'mid').dash], [1, FAR_TRACK_PEN, [2, 3]]);
  // a step's work counts the pixels a cold tile's runs were walked from, not the runs alone: long straight runs are one
  // run a tile a row, 64 a tile, so the runs alone never fill a step - the three cold tiles' walks (4,096 pixels each, past
  // PAST_BAY_STEP) are a step each
  releasePastBayInk();
  setArenaRoads(denseLayer(0, -64, 192, 64));
  const st = {}, cheap = new Proxy({}, { get: (_, k) => (k in st ? st[k] : k === 'canvas' ? {} : () => {}), set: (_, k, v) => { st[k] = v; return true; } });
  let yields = 0;
  for (const _ of paintPastBay(cheap, { ox: 0, oy: -64, scale: 1 }, { paperW: 256, paperH: 256, band: 'far', continent: true, filters: {} }, { scratch: () => cheap })) yields++;
  assert.ok(yields >= 3, `the walk a step's work (${yields} steps)`);
});

// ── M11: THE ROAD INK'S CACHES ──────────────────────────────────
test('AUDIT TESA II M11: the walked chains kept to ROAD_INK_KEPT, the one read longest ago let go; the runs and the dots keep no empty tile and let go the oldest (not all) past ROAD_KEPT_TILES; all let go on close (mutants: the chains unbounded; the empties kept; the release a no-op)', () => {
  assert.deepEqual([ROAD_INK_KEPT, ROAD_KEPT_TILES, ROAD_RUNS_KEPT], [512, 2048, 768]);
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  // a short road on each of 24 x 24 road tiles (a grid: a layer key holds x within 32,768 of the Bay's corner)
  for (let ty = 0; ty < 24; ty++) for (let tx = 0; tx < 24; tx++) run(layer.roads, tx * ROAD_TILE + 3, tx * ROAD_TILE + 5, ty * ROAD_TILE + 10);
  setArenaRoads(layer);
  for (let ty = 0; ty < 24; ty++) for (let tx = 0; tx < 24; tx++) arenaRoadInkAt(tx, ty);
  assert.equal(roadKeptCounts().ink, ROAD_INK_KEPT, 'the 576 tiles\' chains kept to the count');
  const last = arenaRoadInkAt(23, 23);
  assert.equal(arenaRoadInkAt(23, 23), last, 'the one read last kept, walked again never');
  // the runs over a sparse view: only the tiles that hold a pixel
  releasePastBayInk();
  arenaRoadSteps(-ROAD_TILE * 8, -ROAD_TILE * 8, ROAD_TILE * 4 - 1, ROAD_TILE * 4 - 1);
  assert.equal(roadKeptCounts().steps, 25, 'the 25 road tiles there that hold a pixel (0..4 each way), of the 14 x 14 asked');
  const many = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (let ty = 0; ty < 46; ty++) for (let tx = 0; tx < 46; tx++) many.roads.set(beyondKey(tx * ROAD_TILE + 1, ty * ROAD_TILE + 1), DIR.E);   // 2,116 road tiles
  setArenaRoads(many);
  arenaRoadSteps(0, 0, 46 * ROAD_TILE - 1, 46 * ROAD_TILE - 1);
  assert.equal(roadKeptCounts().steps, ROAD_RUNS_KEPT, 'the runs kept to their count, not dropped whole');
  const st = {}, cheap = new Proxy({}, { get: (_, k) => (k in st ? st[k] : k === 'canvas' ? {} : () => {}), set: (_, k, v) => { st[k] = v; return true; } });
  paintPastBay(cheap, { ox: 0, oy: 0, scale: 0.2 }, { paperW: 46 * ROAD_TILE * 0.2, paperH: 46 * ROAD_TILE * 0.2, band: 'far', continent: true, filters: {} });
  assert.equal(roadKeptCounts().dots, ROAD_KEPT_TILES, 'the dots kept to theirs: the continent\'s contain view holds the freeware\'s 1,702 road tiles whole');
  releasePastBayInk();
  assert.deepEqual(roadKeptCounts(), { steps: 0, dots: 0, ink: 0 });
});

// ── M12: A LONG RUN ACROSS A FAR TILE ───────────────────────────
test('AUDIT TESA II M12: a far tile strokes every step that crosses it - a straight road of 300 pixels cut where it leaves each road tile, each run on its own tile and a step over its edge (mutant: the run unbounded again)', () => {
  const layer = { roads: run(new Map(), 0, 299, -10), tracks: new Map(), join: new Map() };
  setArenaRoads(layer);
  const all = arenaRoadSteps(0, -64, 299, -1).roads;
  for (const c of all) {
    const tile = Math.floor((c[0].x - 0.5) / ROAD_TILE);
    assert.ok(c[1].x - 0.5 <= (tile + 1) * ROAD_TILE, `the run from ${c[0].x} ends by the next tile's first pixel`);
  }
  // a tile of a far view 200 pixels along: every step under it is stroked by its own paint's runs
  const x0 = 200, x1 = 232;
  const drawn = arenaRoadSteps(x0, -64, x1, -1).roads;
  for (let x = x0; x < x1; x++) {
    assert.ok(drawn.some((c) => c[0].x <= x + 0.5 && c[1].x >= x + 1.5 && c[0].y === -9.5), `the step ${x} -> ${x + 1}`);
  }
});

// ── M13: THE ZONES' ENDS ON THE COAST ───────────────────────────
test('AUDIT TESA II M13: a zone border\'s open end within BORDER_SNAP_PX of the sheet\'s coast is moved onto it, as a province border\'s is - none left out at sea (mutant: the coast unasked)', () => {
  setTamrielTrace(null);
  try {
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    const ink = buildTamrielInk();
    const reach = BORDER_SNAP_PX * tamrielFit().ppu;
    const segDist = (p) => { let d = Infinity; for (const c of ink.coast) for (let i = 1; i < c.length; i++) { const a = c[i - 1], b = c[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; d = Math.min(d, Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y)); } return d; };
    const ends = (chains) => chains.flatMap((c) => (c[0].x === c.at(-1).x && c[0].y === c.at(-1).y ? [] : [c[0], c.at(-1)])).filter((p) => !(Math.abs(p.x) < 1e-6 || Math.abs(p.x - BAY_W) < 1e-6 || Math.abs(p.y) < 1e-6 || Math.abs(p.y - BAY_H) < 1e-6));
    const before = ends(zoneChains()).filter((p) => { const d = segDist(p); return d > 1e-6 && d < reach; });
    assert.ok(before.length > 0, `unsnapped, ${before.length} ends lie near the coast and off it`);
    const after = ends(zoneChains(undefined, ink.coast));
    assert.equal(after.filter((p) => { const d = segDist(p); return d > 1e-6 && d < reach; }).length, 0, 'snapped, every such end on the coast');
    assert.equal(after.filter((p) => !provinceKeyAt(...bayToPicture(p.x, p.y)) && segDist(p) > 1e-6).length, 0, 'none out at sea');
  } finally { setTamrielFit(null); }
});

// ── M7, M6, M14: THE CITIES PAST THE BAY ────────────────────────
const inkOf = () => { setTamrielTrace(null); setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 }); return buildTamrielInk(); };
function overNames(ink, view, opts) {
  const ctx = recCtx({ id: 'over' });
  paintTamrielInk(ctx, view, ink, { paperW: 1150, paperH: 720, continent: false, band: 'mid', part: 'over', ...opts });
  return ctx.calls;
}
test('AUDIT TESA II M7: a city past the Bay is its bucket\'s - under the map\'s filters (Towns hides it, as the Bay\'s towns), its glyph that bucket\'s in MAP-KEY\'s hue - and the hover and the press take only one the sheet inks (mutants: the filter unread; the hue unread; the hover past the filter; the continent\'s capitals alone)', () => {
  try {
    const ink = inkOf();
    assert.deepEqual(ARENA_KIND_GLYPHS, { 'city-state': 'hamlet', town: 'village', village: 'village' }, 'TESA1\'s glyphs, off the buckets');
    assert.deepEqual([tamrielCityBucket({ capital: true }), tamrielCityBucket({ kind: 'city-state' }), tamrielCityBucket({ kind: 'town' }), tamrielCityBucket({ kind: null })], [11, 12, 13, 12]);
    const town = ink.cities.find((c) => !c.capital);
    const view = { ox: town.x - 115, oy: town.y - 72, scale: 5 };
    const names = (calls) => calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
    assert.ok(names(overNames(ink, view, {})).includes(town.name), 'named with no filter');
    assert.ok(!names(overNames(ink, view, { filters: { towns: true } })).includes(town.name), 'Towns hides it');
    const hue = overNames(ink, view, { inks: { hamlet: 'rgb(1, 2, 3)', city: 'rgb(4, 5, 6)', village: 'rgb(7, 8, 9)' } });
    assert.ok(hue.some((c) => c.fill === 'rgb(1, 2, 3)' || c.stroke === 'rgb(1, 2, 3)'), 'the hamlet\'s glyph in its hue');
    assert.equal(tamrielCityAt(town.x, town.y, view, ink), town);
    assert.equal(tamrielCityAt(town.x, town.y, view, ink, { filters: { towns: true } }), null, 'a hidden town is not hovered');
    assert.equal(tamrielCityAt(town.x, town.y, view, ink, { continent: true }), null, 'on the continent the capitals alone');
    const cap = ink.cities.find((c) => c.capital);
    assert.equal(tamrielCityAt(cap.x, cap.y, view, ink, { continent: true }), cap);
  } finally { setTamrielFit(null); }
});

test('AUDIT TESA II M6: a city the window names itself (`nameless` - the zone map\'s, inside its zone) keeps its glyph and the continent\'s layer letters no name for it (mutant: the option unread)', () => {
  try {
    const ink = inkOf();
    const town = ink.cities.find((c) => !c.capital);
    const view = { ox: town.x - 115, oy: town.y - 72, scale: 5 };
    const calls = overNames(ink, view, { nameless: (c) => c === town });
    assert.ok(!calls.some((c) => c.fn === 'fillText' && c.args[0] === town.name), 'no name');
    assert.ok(calls.some((c) => c.fn === 'arc' || c.fn === 'moveTo'), 'its glyph still');
  } finally { setTamrielFit(null); }
});

test('AUDIT TESA II M14: on the Bay\'s side of the seam a glyph past the Bay answers within its reach - a countryside mark on the first column past the Bay, its province its own pixel\'s; deep in the Bay nothing, and the land and the sea past it alone (mutants: the seam shut again)', () => {
  try {
    setTamrielTrace(null); setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    addPastBayPlaces([{ x: 1000, y: 120, type: LOCATION_TYPES.ReligionTemple }]);
    const view = { ox: 960, oy: 100, scale: 8 };
    const marks = { placesIn: pastBayPlacesIn, band: 'near', filters: {}, nameOf: () => 'A temple' };
    const at = (x) => tamrielHoverAt(x, 120.5, view, null, marks);
    assert.equal(at(1000.5)?.on, 'mark');
    const west = at(999.95);
    assert.equal(west?.on, 'mark', '4.4 paper pixels west of its centre, on the Bay\'s side');
    assert.match(west.label, /A temple \(temple, beyond the Bay\)/);
    assert.equal(at(1000.5 - (CITY_HIT_PX + 1) / view.scale), null, 'past its reach, the Bay\'s own');
    assert.equal(tamrielHoverAt(500, 250, view, null, marks), null, 'deep in the Bay nothing');
    assert.equal(at(1003)?.on, 'land', 'past the Bay the land answers');
  } finally { setTamrielFit(null); }
});

test('AUDIT TESA II M10 (TESA15\'s recorded change kept): the Bay\'s own far band strokes its tracks a hair through strokePaths, over the roads, each under its filter - the past-Bay paint reads the same pens (pathPen) (mutants: the Bay\'s far tracks left off; the roads\' filter unread)', () => {
  const track = [{ x: 10.5, y: 10.5 }, { x: 40.5, y: 10.5 }], road = [{ x: 10.5, y: 20.5 }, { x: 40.5, y: 20.5 }];
  const model = { coast: [], borders: [], high: [], highBands: [], regions: [], roads: [road], tracks: [track], marks: [] };
  /** Each stroke that drew a path: its pen and width (a path's lineTo calls since its beginPath). */
  const strokes = (filters) => {
    const ctx = recCtx({ id: 'bay' });
    paintInkStatic(ctx, model, { ox: 0, oy: 0, scale: 1 }, { paperW: 100, paperH: 60, band: 'far', filters, names: null });
    const out = []; let segs = 0;
    for (const c of ctx.calls) { if (c.fn === 'beginPath') segs = 0; else if (c.fn === 'lineTo') segs++; else if (c.fn === 'stroke' && segs) out.push(`${c.stroke}@${c.width}`); }
    return out;
  };
  const trackPen = `${PEN.soft}@${FAR_TRACK_PEN}`, roadPen = `${PEN.line}@1`;
  assert.deepEqual(strokes({}).filter((x) => x === trackPen || x === roadPen), [roadPen, trackPen], 'the roads, then the tracks a hair over them');
  assert.ok(!strokes({ tracks: true }).includes(trackPen), 'the tracks under their filter');
  assert.ok(!strokes({ roads: true }).includes(roadPen), 'the roads under theirs');
});
