// TESA13 (2026-10-24; a tester saw nothing past the Bay "reflected on the map", and the owner asked "Does it render on
// the map or not. The real roads, locations. Etc", then "Yes"; bible/03-World/Arena-Provinces.md TESA13) - THE LAND PAST
// THE BAY ON THE HELD MAP, pinned. Arena's roads and tracks walked off the layer the kernels paint into the sheet's chains
// a tile at a time, their halves meeting over a tile's edge; the countryside and the lairs read off the host's own roll a
// tile at a time and kept (world/tamrielAtlas.js), marked under the Bay's own buckets, bands and filters, and named on the
// hover in DFU's words; the host's read in _locationToBuild's order; the window handing the atlas, the band and the
// filters, and repainting when the roads land. No game data: synthetic layers and a stub roll. TESA15 moved the map's read
// to the places the roads' regions laid (world/pastBayPlaces.js) and the roads' ink to a tile at a time: the pins on the
// main thread's atlas and the whole layer's ink are moved or retired below, each where it stood.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  arenaRoadInk, arenaRoadsIn, ROAD_TILE, tamrielMarksIn, tamrielMarkAt, tamrielPlaceAt, buildTamrielInk, tamrielInkFor, paintTamrielInk, CITY_HIT_PX,
} from '../src/ui/tamrielInk.js';
import { createTamrielAtlas, atlasStamp, ATLAS_TILE, ATLAS_TILES_KEPT } from '../src/world/tamrielAtlas.js';
import { beyondKey, beyondPixel, setArenaRoads, arenaRoadsVersion } from '../src/world/arenaRoads.js';
import { arenaPlacesVersion } from '../src/world/arenaPlaces.js';
import { capitalsVersion } from '../src/world/tamrielCapitals.js';
import { tamrielLandVersion } from '../src/world/tamriel/tamrielLand.js';
import { tamrielFit, inBay } from '../src/world/tamriel/tamrielFrame.js';
import { DIR } from '../src/world/road/roadNetwork.js';
import { PEN, BAND_MARKS, toPaper, FAR_TRACK_PEN } from '../src/ui/ink/inkMap.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { plateauDry, spawnPlateauFloor, SPAWN_DRY_ELEVATION, DRY_COLUMN_STRIDE, DRY_MARGIN } from '../src/world/spawnedDungeons.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrain/terrainSampler.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const T = LOCATION_TYPES;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); });

/** A recording 2D context: every call and every style set, in order (test/ui/heldmap.test.js's own). */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
/** The recorded calls as stroked paths: each beginPath to its stroke, with the points it moved and lined to and the
 *  dash set before it. */
function strokedPaths(calls) {
  const out = [];
  let pts = [], dash = [];
  for (const c of calls) {
    if (c.fn === 'setLineDash') dash = c.args[0];
    else if (c.fn === 'beginPath') pts = [];
    else if (c.fn === 'moveTo' || c.fn === 'lineTo') pts.push(c.args);
    else if (c.fn === 'stroke') out.push({ pts, strokeStyle: c.strokeStyle, lineWidth: c.lineWidth, dash });
  }
  return out;
}

/** A layer of straight runs past the Bay: [kind, x0, x1, y] east-west, or [kind, x, y0, y1, 'ns'] north-south - each
 *  pixel's byte its steps' compass bits. */
function runLayer(runs) {
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (const [kind, a0, a1, b, ns] of runs) {
    for (let a = a0; a <= a1; a++) {
      if (ns) layer[kind].set(beyondKey(b, a), (a > a0 ? DIR.N : 0) | (a < a1 ? DIR.S : 0));
      else layer[kind].set(beyondKey(a, b), (a > a0 ? DIR.W : 0) | (a < a1 ? DIR.E : 0));
    }
  }
  return layer;
}
/** Is every unit step from x0 + 0.5 to x1 + 0.5 along y + 0.5 on some chain's segment? */
function covered(chains, x0, x1, y) {
  const segs = [];
  for (const c of chains) for (let i = 1; i < c.length; i++) if (c[i - 1].y === y + 0.5 && c[i].y === y + 0.5) segs.push([Math.min(c[i - 1].x, c[i].x), Math.max(c[i - 1].x, c[i].x)]);
  for (let x = x0; x < x1; x++) if (!segs.some(([a, b]) => a <= x + 0.5 && b >= x + 1.5)) return false;
  return true;
}

// ── THE ROADS ───────────────────────────────────────────────────

test('TESA13 the roads: a layer key is its pixel and back, either side of nought (beyondPixel, beyondKey\'s inverse)', () => {
  for (const [x, y] of [[0, 0], [-1, -1], [999, -1], [-1, 499], [-32768, -32768], [32767, 32767], [4200, -3100], [-862, 2500]]) {
    assert.deepEqual(beyondPixel(beyondKey(x, y)), [x, y], `${x}, ${y}`);
  }
});

test('TESA13 the roads: the layer walked into chains on pixel centres a tile at a time - a run over a tile\'s edge meets itself there; roads and tracks apart; no layer, none', () => {
  assert.deepEqual(arenaRoadInk(null), { roads: [], tracks: [] });
  assert.equal(ROAD_TILE, 64);
  // a road over the edge between tiles 0 and 1 (x 63 | 64), and over two edges west of nought (x -65 | -64, -1 | 0)
  const ink = arenaRoadInk(runLayer([['roads', 60, 70, -20], ['roads', -70, -1, -40], ['tracks', 120, 200, -300], ['roads', -100, -60, -300, 'ns']]));
  assert.ok(covered(ink.roads, 60, 70, -20), 'no gap at the tile\'s edge');
  const down = ink.roads.filter((c) => c.every((p) => p.x === -299.5)).map((c) => [Math.min(...c.map((p) => p.y)), Math.max(...c.map((p) => p.y))]);
  for (let y = -100; y < -60; y++) assert.ok(down.some(([a, b]) => a <= y + 0.5 && b >= y + 1.5), `north-south too, over the edge at y -64 (${y})`);
  assert.ok(covered(ink.roads, -70, -1, -40), 'none west of nought either');
  assert.ok(covered(ink.tracks, 120, 200, -300), 'the track, over its own edges');
  assert.equal(covered(ink.roads, 120, 200, -300), false, 'a track is no road');
  assert.equal(covered(ink.tracks, 60, 70, -20), false, 'nor a road a track');
  const xs = ink.roads.flat().filter((p) => p.y === -19.5).map((p) => p.x);
  assert.equal(Math.min(...xs), 60.5, 'the ends on their pixels\' centres');
  assert.equal(Math.max(...xs), 70.5);
  // a single tile's run is one straight chain, thinned to its ends
  const one = arenaRoadInk(runLayer([['roads', 2, 9, -10]]));
  assert.deepEqual(one.roads, [[{ x: 2.5, y: -9.5 }, { x: 9.5, y: -9.5 }]]);
});

test('TESA13 the roads: the ink carries them off the installed layer - PIN MOVED (TESA15): a tile at a time (arenaRoadsIn), the continent\'s own ink none of them; the paint strokes them in the Bay\'s pens and under its filters, the tracks dotted - and at far (TESA15) a hair', () => {
  assert.deepEqual(arenaRoadsIn(30, -45, 100, 0), { roads: [], tracks: [] }, 'none before a layer');
  const v = arenaRoadsVersion();
  setArenaRoads(runLayer([['roads', 40, 90, -20], ['tracks', 40, 90, -30]]));
  assert.equal(arenaRoadsVersion(), v + 1);
  const got = arenaRoadsIn(30, -45, 100, 0);
  assert.ok(covered(got.roads, 40, 90, -20) && covered(got.tracks, 40, 90, -30));
  const ink = tamrielInkFor(null);
  assert.equal(ink.roads, undefined, 'the continent\'s ink holds no road: a landing makes none of it again');

  const view = { ox: 30, oy: -45, scale: 6 };   // near: the run at y -20 across the paper
  const [, roadY] = toPaper(view, 0, -19.5), [, trackY] = toPaper(view, 0, -29.5);
  const onRow = (p, y) => p.pts.length >= 2 && p.pts.every(([, py]) => Math.abs(py - y) < 1e-9);
  const paint = (opts) => { const ctx = recordingCtx(); paintTamrielInk(ctx, view, ink, { paperW: 400, paperH: 200, ...opts }); return strokedPaths(ctx.calls); };
  const near = paint({});
  const road = near.find((p) => onRow(p, roadY));
  assert.ok(road, 'the road stroked');
  assert.deepEqual([road.strokeStyle, road.lineWidth, road.dash], [PEN.line, 1.5, []], 'the Bay\'s road pen');
  const track = near.find((p) => onRow(p, trackY));
  assert.deepEqual([track?.strokeStyle, track?.lineWidth, track?.dash], [PEN.soft, 1, [2, 3]], 'the Bay\'s track, dotted');
  assert.equal(paint({ filters: { roads: true } }).some((p) => onRow(p, roadY)), false, 'the Roads filter hides it');
  assert.equal(paint({ filters: { tracks: true } }).some((p) => onRow(p, trackY)), false, 'the Tracks filter hides it');
  const far = paint({ band: 'far' });
  assert.equal(far.find((p) => onRow(p, roadY))?.lineWidth, 1, 'far: the road thinner');
  const hair = far.find((p) => onRow(p, trackY));
  assert.deepEqual([hair?.strokeStyle, hair?.lineWidth, hair?.dash], [PEN.soft, FAR_TRACK_PEN, []], 'and the track a hair, undotted (TESA15)');
});

// ── THE GROUND ──────────────────────────────────────────────────

/** A height map of bytes, its noise map flat (test/world/terrain/spawnshore.test.js's own). */
const woodsOf = (byteAt, large = 0) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = byteAt(x0 + x, y0 + y); return d; },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3).fill(large),
});

test('TESA13 the ground: plateauDry answers what spawnPlateauFloor over the beach band answers - the sea, the land, every coast and every byte about the threshold', () => {
  assert.equal(DRY_COLUMN_STRIDE, 16);
  assert.equal(DRY_MARGIN, 1e-9);
  assert.equal(HEIGHTMAP_DIMENSION % DRY_COLUMN_STRIDE, 1, 'the strided columns cover every one of the 129');
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const noise = new Map();
  const grounds = [
    ['the sea', woodsOf(() => 0)], ['the land', woodsOf(() => 20)], ['the beach', woodsOf(() => 5)], ['a byte over it', woodsOf(() => 6)],
    ['a sea edge', woodsOf((x) => (x >= 101 ? 30 : 0))], ['a low shore', woodsOf((x) => (x >= 101 ? 8 : 0))],
    ['a sloping coast', woodsOf((x, y) => Math.max(0, Math.min(255, (x - 100) * 2 + (y - 100))), 3)],
    // a low pixel between high ones: its kernel's edge columns stand higher than its middle, so the first sixteenth of
    // them is over the threshold where the whole is not (41.66 m, 41.15 m at (100, 100)) - no answer before the floor says so
    ['a furrow', woodsOf((x) => (((x % 3) + 3) % 3 === 0 ? 3 : 8))],
    ['bytes about the threshold', woodsOf((x, y) => { const k = `${x},${y}`; if (!noise.has(k)) noise.set(k, 3 + Math.floor(rnd() * 5)); return noise.get(k); }, 1)],
    ['a ragged coast', woodsOf((x, y) => { const k = `r${x},${y}`; if (!noise.has(k)) noise.set(k, rnd() < 0.5 ? 0 : 4 + Math.floor(rnd() * 12)); return noise.get(k); }, 6)],
  ];
  let wet = 0, dry = 0;
  for (const [what, w] of grounds) {
    for (let px = 97; px <= 104; px++) {
      for (const py of [99, 100, 101]) {
        const want = spawnPlateauFloor(w, px, py) > SPAWN_DRY_ELEVATION;
        assert.equal(plateauDry(w, px, py), want, `${what} at ${px}, ${py}`);
        if (want) dry++; else wet++;
      }
    }
  }
  assert.ok(wet > 20 && dry > 20, `both answers met (${wet} wet, ${dry} dry)`);
  // a field of the beach's byte and the one over it, at random: every plateau within a few metres of the threshold
  const field = new Map();
  const about = woodsOf((x, y) => { const k = `${x},${y}`; if (!field.has(k)) field.set(k, rnd() < 0.55 ? 5 : 6); return field.get(k); });
  let near = 0;
  for (let px = 200; px < 220; px++) {
    for (let py = 200; py < 215; py++) {
      const floor = spawnPlateauFloor(about, px, py);
      if (Math.abs(floor - SPAWN_DRY_ELEVATION) < 0.5) near++;
      assert.equal(plateauDry(about, px, py), floor > SPAWN_DRY_ELEVATION, `about the threshold at ${px}, ${py} (${floor.toFixed(3)} m)`);
    }
  }
  assert.ok(near >= 10, `plateaus within half a metre of it (${near})`);
});

// ── THE ATLAS ───────────────────────────────────────────────────

test('TESA13 the atlas: a tile is rolled once, never on the Bay, and only the asked pixels come back; a moved stamp rolls it again', () => {
  assert.equal(ATLAS_TILE, 32);
  const asked = [];
  let stamp = [1];
  const atlas = createTamrielAtlas((x, y) => { asked.push([x, y]); return (x + y) % 9 === 0 ? { type: T.HomeFarms, name: `F${x},${y}` } : null; }, () => stamp);
  const got = atlas.placesIn(-10, -10, 10, 10);
  assert.equal(asked.length, 3 * ATLAS_TILE * ATLAS_TILE, 'four tiles, the Bay\'s one asked of nothing');
  assert.equal(asked.some(([x, y]) => inBay(x, y)), false, 'no pixel of the Bay');
  assert.ok(got.length > 0);
  for (const p of got) assert.ok(p.x >= -10 && p.x < 10 && p.y >= -10 && p.y < 10 && !inBay(p.x, p.y), 'within the asked pixels');
  assert.deepEqual(got.map((p) => [p.x, p.y, p.type, p.name]).sort(), (() => {
    const want = [];
    for (let y = -10; y < 10; y++) for (let x = -10; x < 10; x++) if (!inBay(x, y) && (x + y) % 9 === 0) want.push([x, y, T.HomeFarms, `F${x},${y}`]);
    return want.sort();
  })());
  assert.equal(atlas.placesIn(-5, -5, 5, 5).length > 0, true);
  assert.equal(asked.length, 3 * ATLAS_TILE * ATLAS_TILE, 'kept: asked again, rolled never');
  assert.deepEqual(atlas.placesIn(5, 5, 5, 9), [], 'an empty rectangle');
  stamp = [2];
  atlas.placesIn(-10, -10, -1, -1);
  assert.equal(asked.length, 4 * ATLAS_TILE * ATLAS_TILE, 'the stamp moved: the tile rolled again');
});

// RETIRED (TESA15): 'the atlas: a budget rolls the tiles nearest the middle first until it is spent, says more is owed
// once, and the next ask goes on' - its reader, the held map rolling its view a frame at a time, is the places the
// roads' regions laid now (world/pastBayPlaces.js); the atlas's one reader is the roads' worker, which asks it whole.

test('TESA13 the atlas: ATLAS_TILES_KEPT tiles kept, the one read longest ago let go first - a tile read again goes to the back', () => {
  assert.equal(ATLAS_TILES_KEPT, 2048);
  let rolls = 0;
  const atlas = createTamrielAtlas(() => { rolls++; return null; }, () => [0]);
  const tile = (i) => atlas.placesIn(i * ATLAS_TILE, -ATLAS_TILE, i * ATLAS_TILE + 1, -ATLAS_TILE + 1);   // one pixel of tile (i, -1)
  for (let i = 0; i < ATLAS_TILES_KEPT; i++) tile(i);
  assert.equal(atlas.tilesKept(), ATLAS_TILES_KEPT);
  const per = rolls / ATLAS_TILES_KEPT;
  tile(0);   // read again: to the back
  tile(ATLAS_TILES_KEPT);   // one more: tile 1 goes
  assert.equal(atlas.tilesKept(), ATLAS_TILES_KEPT);
  const r = rolls;
  tile(0);
  assert.equal(rolls, r, 'tile 0 kept');
  tile(1);
  assert.equal(rolls, r + per, 'tile 1 let go, rolled again');
});

test('TESA13 the atlas: its stamp is everything the roll reads that moves after the boot - the land, the fit, the places standing, the capitals; TESA14: no road (the roads are laid round the places)', () => {
  assert.deepEqual(atlasStamp(), [tamrielLandVersion(), tamrielFit(), arenaPlacesVersion(), capitalsVersion()]);
  const s = atlasStamp();
  setArenaRoads(null);
  assert.deepEqual(atlasStamp(), s, 'a road layer landing moves no place');
});

// ── THE MARKS ───────────────────────────────────────────────────

const PLACES = [
  { x: 10, y: -20, type: T.HomeFarms, name: 'Old Farm' },
  { x: 14, y: -20, type: T.DungeonLabyrinth, name: 'The Hole' },
  { x: 18, y: -20, type: T.Graveyard, name: 'The Barrow' },
  { x: 22, y: -20, type: T.ReligionTemple, name: 'The Sacred Oracle' },
  { x: 26, y: -20, type: T.TownHamlet, name: 'Ashwood' },
  { x: 30, y: -20, type: T.Tavern, name: 'The Gilded Inn' },
];
/** The atlas's answer as the host hands it - and every rectangle asked. */
function stubPlaces(places = PLACES) {
  const asked = [];
  const placesIn = (x0, y0, x1, y1) => { asked.push([x0, y0, x1, y1]); return places.filter((p) => p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1); };
  return { placesIn, asked };
}

test('TESA13 the marks: the Bay\'s laws - the classic bucket and its glyph, the band\'s kinds (near all, mid no homes nor graveyards, far none and nothing asked), the filters; on the pixel\'s centre; the view\'s pixels within the frame', () => {
  const view = { ox: 0, oy: -40, scale: 6 };
  const opts = { paperW: 240, paperH: 240 };
  const s = stubPlaces();
  const near = tamrielMarksIn(view, s.placesIn, { ...opts, band: 'near' });
  assert.deepEqual(near.map((m) => [m.place.name, m.kind, m.x, m.y]), [
    ['Old Farm', 'home', 10.5, -19.5], ['The Hole', 'dungeon', 14.5, -19.5], ['The Barrow', 'graveyard', 18.5, -19.5],
    ['The Sacred Oracle', 'temple', 22.5, -19.5], ['Ashwood', 'hamlet', 26.5, -19.5], ['The Gilded Inn', 'tavern', 30.5, -19.5],
  ]);
  assert.deepEqual(s.asked, [[0, -40, 40, 0]], 'the view\'s pixels');
  assert.deepEqual(tamrielMarksIn(view, s.placesIn, { ...opts, band: 'mid' }).map((m) => m.place.name), ['The Hole', 'The Sacred Oracle', 'Ashwood', 'The Gilded Inn'], 'mid: BAND_MARKS.mid');
  assert.ok(!BAND_MARKS.mid.has(5) && !BAND_MARKS.mid.has(3) && BAND_MARKS.mid.has(0));
  const asked = s.asked.length;
  assert.deepEqual(tamrielMarksIn(view, s.placesIn, { ...opts, band: 'far' }), [], 'far: the cities alone');
  assert.equal(s.asked.length, asked, 'and the atlas not asked');
  assert.deepEqual(tamrielMarksIn(view, s.placesIn, { ...opts, band: 'near', filters: { dungeons: true } }).map((m) => m.place.name), ['Old Farm', 'The Sacred Oracle', 'Ashwood', 'The Gilded Inn'], 'the Dungeons filter: the lairs and the graveyard');
  assert.deepEqual(tamrielMarksIn(view, s.placesIn, { ...opts, band: 'near', filters: { homes: true, temples: true, towns: true } }).map((m) => m.place.name), ['The Hole', 'The Barrow']);
  assert.equal(tamrielMarksIn({ ...view, scale: 6 }, s.placesIn, opts).length, 6, 'the band off the scale where none is handed');
  tamrielMarksIn({ ox: -100, oy: -100, scale: 1 }, s.placesIn, { paperW: 1000, paperH: 1000, band: 'near', frame: { x0: -50, y0: -60, w: 70, h: 80 } });
  assert.deepEqual(s.asked.at(-1), [-50, -60, 20, 20], 'held to the continent\'s frame');
  assert.deepEqual(tamrielMarksIn(view, null, opts), [], 'no atlas, none');
});

test('TESA13 the marks: the hover - the nearest the view inks within CITY_HIT_PX, named with its province and DFU\'s word for its kind; none on the Bay, past the reach, or hidden by the band', () => {
  const view = { ox: 0, oy: -40, scale: 6 };
  const { placesIn } = stubPlaces();
  const reach = CITY_HIT_PX / view.scale;
  assert.equal(tamrielMarkAt(10.5 + reach * 0.9, -19.5, view, placesIn, { band: 'near' })?.place.name, 'Old Farm');
  assert.equal(tamrielMarkAt(10.5 + reach * 1.1, -19.5 - reach, view, placesIn, { band: 'near' }), null, 'past the reach');
  assert.equal(tamrielMarkAt(14.0, -19.5, view, placesIn, { band: 'near' })?.place.name, 'The Hole', 'the nearer of two');
  assert.equal(tamrielMarkAt(10.5, -19.5, view, placesIn, { band: 'mid' }), null, 'a farm the band hides answers nothing');
  assert.equal(tamrielMarkAt(10.5, 5, view, () => [{ x: 10, y: 5, type: T.HomeFarms, name: 'Bay' }], { band: 'near' }), null, 'on the Bay the Bay\'s own reads');
  const ink = buildTamrielInk();
  const text = tamrielPlaceAt(22.5, -19.5, view, ink, { placesIn, band: 'near' });
  assert.match(text, / : The Sacred Oracle \(temple\)$/);   // PIN MOVED (AUDIT TAMRIEL-WIDE D3): the land past the Bay is the world's, named by its province and place alone
  assert.match(tamrielPlaceAt(30.5, -19.5, view, ink, { placesIn, band: 'near' }), / : The Gilded Inn \(tavern\)$/);
  assert.match(tamrielPlaceAt(26.5, -19.5, view, ink, { placesIn, band: 'near' }), / : Ashwood \(town\)$/, 'MacroHelper.LocationTypeName: a hamlet is a town');
  assert.doesNotMatch(tamrielPlaceAt(22.5, -19.5, view, ink) ?? '', /Oracle/, 'no atlas: the province\'s answer');
});

test('TESA13 the marks: painted in to the Bay\'s scale, every halo before every glyph, each kind in its hue; out on the continent the atlas is not asked', () => {
  const view = { ox: 0, oy: -40, scale: 6 };
  const ink = buildTamrielInk();
  const s = stubPlaces([PLACES[1]]);
  const ctx = recordingCtx();
  paintTamrielInk(ctx, view, ink, { paperW: 240, paperH: 240, band: 'near', placesIn: s.placesIn, inks: { dungeon: 'rgb(1, 2, 3)' } });
  const [x, y] = toPaper(view, 14.5, -19.5);
  const at = ctx.calls.filter((c) => c.fn === 'moveTo' && Math.abs(c.args[0] - x) < 1e-9 && Math.abs(c.args[1] - (y - 4.5)) < 1e-9);
  assert.equal(at.length, 2, 'the dungeon\'s glyph twice - its halo and its ink');
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');
  const i = ctx.calls.indexOf(at[0]), j = ctx.calls.indexOf(at[1]);
  const after = (k) => strokes.find((c) => ctx.calls.indexOf(c) > k);
  assert.deepEqual([after(i).strokeStyle, after(j).strokeStyle], [PEN.halo, 'rgb(1, 2, 3)'], 'the halo first, then the kind\'s hue');
  const asked = s.asked.length;
  paintTamrielInk(recordingCtx(), { ox: -2000, oy: -1500, scale: 0.15 }, ink, { paperW: 900, paperH: 560, continent: true, band: 'mid', placesIn: s.placesIn });
  assert.equal(s.asked.length, asked, 'the continent: no mark, no ask, whatever the band (a paper wide enough is out on it at mid)');
});

// ── THE HOST AND THE WINDOW ─────────────────────────────────────

const W = hostText('src/scenes/world.js');

// RETIRED (TESA15): 'the host: the map's read is _locationToBuild's order' over world.js's own atlas - the map's places
// are the roads' regions' now, and _locationToBuild's order is held where they are rolled (test/tesa15_mapfidelity.test.js:
// a capital's pixel and an Arena place's no rolled place's, a lair only with its plan). Kept: the order the build keeps,
// and its one roll.
test('TESA13 the host: _locationToBuild\'s order - a capital, an Arena place, the countryside, a lair - and the build\'s ask reads the one roll; PIN MOVED (TESA15): the map seam hands the places the regions laid, and a name as the hover asks', () => {
  // PIN MOVED (AUDIT TESA II P1): online the open zone's hall of the day first - Cyrodiil's lie past the Bay
  // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild left world.js for scenes/spawnStandHost.js, the
  // places' rolls read through `host`
  // PIN MOVED (WG2-TOWNS): a World 2.0 town asked first past the Bay, before a capital (scenes/settle2Host.js)
  assert.match(W, /if \(\(_arenaTemplates \|\| _countryTemplates \|\| _capitalBase\) && !onTheBay\(px, py\)\) return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\) && zoneHalls\.standIn\(cyrodiilMask\(\), px, py\)\) \|\| settle2LocationAt\(px, py\) \|\| host\.capitalLocationAt\(px, py\) \|\| \(_arenaTemplates && host\.arenaLocationAt\(px, py\)\) \|\| host\.countryLocationAt\(px, py\) \|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/, 'the order it keeps');   // PIN MOVED (SPAWN-WORLD 2026-10-26): online, the spawner's last - never on a place   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js) - carried into scenes/spawnStandHost.js at the packages' merge (AUDIT BAY-LEFT)
  const body = (head) => { const k = W.indexOf(head); assert.ok(k > 0, head); return W.slice(k, W.indexOf('\n  }\n', k)); };
  assert.match(body('  function countryLocationAt(px, py) {'), /const at = countryRollAt\(px, py\);/);
  assert.match(body('  function lairLocationAt(px, py) {'), /at = lairRollAt\(px, py\);[\s\S]*const loc = at \? lairCloneOf\(at, px, py\) : null;/);   // PIN MOVED (START2): the clone its own function
  assert.match(body('  function lairCloneOf(at, px, py) {'), /const blocks = lairBlocksOf\(at\);/);
  const from = W.indexOf('  function buildTravelMapWindow(extra = {}) {');
  const map = W.slice(from, W.indexOf('      ...extra,', from));
  assert.match(map, /tamrielPlacesIn: tamrielLand \? \(x0, y0, x1, y1\) => knownPastBayIn\(x0, y0, x1, y1\) : null,/, 'the one map seam hands the regions\' places - PIN MOVED (AUDIT TAMRIEL-WIDE D2): the known ones');
  assert.match(map, /tamrielPlaceName: tamrielLand \? tamrielPlaceName : null,/, 'and a mark\'s name');
  assert.match(W, /const tamrielPlaceName = \(px, py\) => countryRollAt\(px, py\)\?\.name \?\? lairRollAt\(px, py\)\?\.name \?\? '';/, 'off the one roll');
  assert.doesNotMatch(W, /createTamrielAtlas|tamrielPlacesPending/, 'no second roll on this thread');
});

test('TESA13 the window: the continent painted with the Bay\'s band, filters and hues and the host\'s atlas; the hover asks it where the sheet inks it; the kept layer repainted when the roads land', () => {
  const H = read('src/ui/heldMap.js');
  assert.match(H, /const tamOpts = \{ paperW: env\.paperW, paperH: env\.paperH, continent: onContinent\(env\.view\.scale, bayFit\), bayFit,\n\s+band: env\.band, filters: this\.filters, inks: this\._markInks\(\), placesIn: this\.deps\.tamrielPlacesIn \?\? null,/);
  // PIN MOVED (AUDIT TESA II M7, M14): the hover through tamrielHoverAt, the continent's capitals alone on the continent
  // PIN MOVED (BAY-LEFT-MAPS C11, test/ui/bayleft_find.test.js): and the Ports filter
  assert.match(H, /tamrielHoverAt\(mx, my, this\._view, ink, \{ placesIn: continent \? null : this\.deps\.tamrielPlacesIn \?\? null, nameOf: this\.deps\.tamrielPlaceName \?\? null, filters: this\.filters, band: zoomBand\(this\._view\.scale\), continent, portsOnly: this\.portsFilter \}\)/);
  // PIN MOVED (AUDIT TESA II M9): the roads landing repaint the window from its tick, no part of the static key
  const tick0 = H.slice(H.indexOf('      tick: (dt) => {'), H.indexOf('      mount: () => {', H.indexOf('      tick: (dt) => {')));
  assert.match(tick0, /const pastBay = `\$\{arenaRoadsVersion\(\)\}\|\$\{pastBayPlacesVersion\(\)\}`;/, 'the window repainted when the roads land');
  const tick = H.slice(H.indexOf('      tick: (dt) => {'), H.indexOf('      mount: () => {', H.indexOf('      tick: (dt) => {')));
  assert.match(tick, /if \(this\._pastBayTiles\?\.takePending\(\)\) \{ this\._staticKey = ''; this\._dirty = true; \}/, 'PIN MOVED (TESA15): the tiles still owed - painted again next frame');
});
