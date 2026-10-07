// FOREST1 (2026-10-01, the Discord's "Real Forests" thread) - REAL FORESTS:
// the wilderness's trees gathered into woods with open land between them
// (world/terrainNature.js layoutForests), behind the Features row
// `realForests`. Off - and on a desert - DFU's scatter is untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  layoutNature, forestCover, forestAt, forestField, placesPull, tileDraw, groundAt, FOREST, TREE_RECORDS, isTreeRecord,
} from '../src/world/terrainNature.js';
import { standTrees } from '../src/scenes/treeHost.js';
import { wodSiteFootprint } from '../src/world/roadClearance.js';
import { TREE_RECORDS as HOST_TREE_RECORDS, isTreeRecord as hostIsTreeRecord } from '../src/scenes/treeHost.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { realForestsOn, FOREST_HIDDEN_LOCATION_TYPES } from '../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { onlineForcedPref } from '../src/systems/onlineLane.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const TILE = TERRAIN_SIZE / 128;

/** A flat, dry pixel of one ground record everywhere (2 grass unless named) - every tile can stand a flat. */
function flatPixel(record = 2) {
  const heights = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.05);
  const tiles = new Uint8Array(128 * 128).fill(record);
  return { heights, tiles };
}
const TEMPERATE = 2;   // ClimateBaseType.Temperate
const DESERT = 0;
const opts = (px, py, extra = {}) => ({ mapPixelX: px, mapPixelY: py, rawWorldHeight: 100, climateType: TEMPERATE, locationRect: null, ...extra });
const tileOf = (f) => [Math.floor(f.x / TILE), Math.floor(f.z / TILE)];
/** Two layouts the same, flat for flat - asked with assert.ok: a failing deepEqual of ten thousand flats builds a diff
 *  that runs the runner out of memory. */
const same = (a, b) => a.length === b.length && a.every((f, i) => f.record === b[i].record && f.x === b[i].x && f.y === b[i].y && f.z === b[i].z);

/** The world tile a pixel's tile is: east, and NORTH (pixelTranslation negates the map's y). */
const worldTile = (px, py, x, y) => [px * 128 + x, -py * 128 + y];

/** Tree rates over the tiles the field calls woods and the tiles it calls plain - the pixel's field, as the layout reads it. */
function rates(px, py, flats, archive) {
  const trees = new Set(flats.filter((f) => isTreeRecord(archive, f.record)).map((f) => tileOf(f).join(',')));
  const wood = { n: 0, t: 0 }, plain = { n: 0, t: 0 };
  const field = forestField(px, py);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const w = field(x, y);
      const b = w >= 0.999 ? wood : w <= 0.001 ? plain : null;
      if (!b) continue;
      b.n++;
      if (trees.has(`${x},${y}`)) b.t++;
    }
  }
  return { wood: wood.t / wood.n, plain: plain.t / plain.n, woodTiles: wood.n, plainTiles: plain.n };
}

/** A pixel with plenty of woods AND plain on it, found once. */
const MIXED = (() => {
  for (let py = 200; py < 260; py++) {
    for (let px = 200; px < 260; px++) {
      let w = 0, p = 0;
      for (let y = 0; y < 128; y += 4) for (let x = 0; x < 128; x += 4) { const v = forestAt(...worldTile(px, py, x, y)); if (v >= 0.999) w++; else if (v <= 0.001) p++; }
      if (w > 250 && p > 250) return { px, py };
    }
  }
  throw new Error('no mixed pixel');
})();

test('FOREST1: the numbers, as the Port-Ledger row states them - pinned as literals, since every measurement below reads FOREST', () => {
  const { forestTree, undergrowth, plainTree, plainCover, lattice, woods, edgeFade } = FOREST;
  assert.deepEqual({ forestTree, undergrowth, plainTree, plainCover, lattice, woods, edgeFade },
    { forestTree: 0.5, undergrowth: 0.12, plainTree: 0.02, plainCover: 0.1, lattice: 4, woods: 0.5, edgeFade: 12 });
  assert.deepEqual([{ ...FOREST.hide }, { ...FOREST.clear }, { ...FOREST.ground }, [...FOREST.inset], [...FOREST.edge]],
    [{ near: 10, far: 30, pull: 1 }, { near: 6, far: 26, pull: 1 }, { 1: 0.6, 2: 1, 3: 0.15 }, [0.1, 0.9], [0.495, 0.525]]);
});

test('FOREST1: off, the scatter is DFU\'s byte for byte - no `forests`, a desert, or an archive with no Tree table', () => {
  const { heights, tiles } = flatPixel();
  const dfu = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py));
  assert.ok(dfu.length > 1000, 'the oracle stands its scatter');
  assert.ok(same(layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: null })), dfu));
  const desert = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { climateType: DESERT }));
  assert.ok(same(layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { climateType: DESERT, forests: { archive: 503 } })), desert),
    'the Desert and Subtropical climates (DFU\'s Desert base type) keep DFU\'s scatter');
  assert.ok(same(layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 505 } })), dfu),
    'an archive with no Tree table (a winter one) is never read as a forest');
  // and DFU's corner placement is still what the oracle stands
  assert.ok(dfu.every((f) => Math.abs(f.x / TILE - Math.round(f.x / TILE)) < 1e-6 && Math.abs(f.z / TILE - Math.round(f.z / TILE)) < 1e-6));
});

test('FOREST1: the woods are dense and the plains open - the field decides, at the WORLD tile (north up)', () => {
  const { heights, tiles } = flatPixel();
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } }));
  const r = rates(MIXED.px, MIXED.py, flats, 504);
  assert.ok(r.woodTiles > 1000 && r.plainTiles > 1000, `both kinds of land on the pixel: ${JSON.stringify(r)}`);
  assert.ok(Math.abs(r.wood - FOREST.forestTree) < 0.04, `a Tree on ~${FOREST.forestTree} of the woods' grass tiles: ${r.wood}`);
  assert.ok(Math.abs(r.plain - FOREST.plainTree) < 0.015, `a lone Tree on ~${FOREST.plainTree} of the plain's: ${r.plain}`);
  // the same pixel's tiles read with the map's y NOT negated: the separation is gone
  const trees = new Set(flats.filter((f) => isTreeRecord(504, f.record)).map((f) => tileOf(f).join(',')));
  let n = 0, t = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (forestAt(MIXED.px * 128 + x, MIXED.py * 128 + y + 2) >= 0.999) { n++; if (trees.has(`${x},${y}`)) t++; }
  assert.ok(n > 500 && Math.abs(t / n - FOREST.forestTree) > 0.15, 'the field is read at -mapPixelY, the way the pixels stand');
});

test('FOREST1: the plains keep their cover, the woods their undergrowth - and a Tree is always one of the archive\'s Trees', () => {
  const { heights, tiles } = flatPixel();
  for (const archive of Object.keys(TREE_RECORDS).map(Number).filter((a) => a !== 503)) {
    const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive } }));
    const recs = new Set(flats.map((f) => f.record));
    for (const r of recs) assert.ok(r >= 1 && r <= 31, `record ${r} in DFU's 1..31`);
    const t = flats.filter((f) => isTreeRecord(archive, f.record)).length;
    assert.ok(t > 0 && t < flats.length, `archive ${archive}: Trees and cover both`);
    assert.ok(TREE_RECORDS[archive].every((r) => recs.has(r)), `archive ${archive}: every Tree record grows`);
  }
  // the share of cover on a flat pixel: undergrowth in the woods, the plains' scatter
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } }));
  let plainCover = 0, plainN = 0, woodCover = 0, woodN = 0;
  const byTile = new Map(flats.map((f) => [tileOf(f).join(','), f]));
  const field = forestField(MIXED.px, MIXED.py);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const w = field(x, y);
    const f = byTile.get(`${x},${y}`);
    if (w <= 0.001) { plainN++; if (f && !isTreeRecord(504, f.record)) plainCover++; }
    if (w >= 0.999) { woodN++; if (f && !isTreeRecord(504, f.record)) woodCover++; }
  }
  assert.ok(Math.abs(plainCover / plainN - FOREST.plainCover) < 0.02, `the plains' bushes, flowers and rocks: ${plainCover / plainN}`);
  assert.ok(Math.abs(woodCover / woodN - FOREST.undergrowth) < 0.03, `the woods' undergrowth: ${woodCover / woodN}`);
});

test('FOREST1: DFU\'s tests on the tile hold - dirt takes less, stone least, water and the beach none', () => {
  for (const [record, share] of [[1, FOREST.ground[1]], [3, FOREST.ground[3]]]) {
    const { heights, tiles } = flatPixel(record);
    const r = rates(MIXED.px, MIXED.py, layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } })), 504);
    assert.ok(Math.abs(r.wood - FOREST.forestTree * share) < 0.04, `record ${record}: ${r.wood} of the woods' tiles`);
  }
  assert.equal(layoutNature(flatPixel(0).heights, flatPixel(0).tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } })).length, 0, 'water stands nothing');
  const low = flatPixel();
  low.heights.fill(0);
  assert.equal(layoutNature(low.heights, low.tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } })).length, 0, 'under the beach line, nothing');
});

test('FOREST1: no grid - every flat stands inside its own tile, on the ground there', () => {
  const heights = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
  for (let a = 0; a < HEIGHTMAP_DIMENSION; a++) for (let b = 0; b < HEIGHTMAP_DIMENSION; b++) heights[a * HEIGHTMAP_DIMENSION + b] = 0.05 + 0.002 * Math.sin(a * 0.2) + 0.001 * b / 128;
  const tiles = new Uint8Array(128 * 128).fill(2);
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } }));
  assert.ok(flats.length > 2000);
  let offCorner = 0, offCornerZ = 0;
  for (const f of flats) {
    const fx = f.x / TILE - Math.floor(f.x / TILE), fz = f.z / TILE - Math.floor(f.z / TILE);
    assert.ok(fx >= FOREST.inset[0] - 1e-6 && fx < FOREST.inset[1] + 1e-6 && fz >= FOREST.inset[0] - 1e-6 && fz < FOREST.inset[1] + 1e-6,
      'inside its tile, never on the corner it shares with a road');
    assert.ok(f.y <= groundAt(heights, f.x, f.z) + 1e-9 && f.y > groundAt(heights, f.x, f.z) - 0.5, 'on the ground there, sunk a little on a slope');
    if (fx > 0.2) offCorner++;
    if (fz > 0.2) offCornerZ++;
  }
  assert.ok(offCorner > flats.length / 2 && offCornerZ > flats.length / 2, 'scattered through the tile both ways, not stacked at one edge');
  assert.ok(flats.every((f) => f.x < TERRAIN_SIZE && f.z < TERRAIN_SIZE), 'the last row stays on its pixel');
});

test('FOREST1: the field is one for the Bay - continuous over a pixel\'s edge, the same for every caller', () => {
  for (let i = 0; i < 200; i++) {
    const tx = 128 * (100 + i) - 1, tz = -128 * (150 + (i % 50)) + (i * 37) % 128;
    assert.ok(Math.abs(forestCover(tx, tz) - forestCover(tx + 1, tz)) < 0.02, 'a tile and the next, across the edge');
    assert.equal(forestCover(tx, tz), forestCover(tx, tz), 'pure');
  }
  // about 45% of the land is woods
  let w = 0, n = 0;
  for (let x = 0; x < 128000; x += 997) for (let z = 0; z < 64000; z += 991) { n++; if (forestAt(x, -z) > 0.5) w++; }
  assert.ok(w / n > 0.35 && w / n < 0.55, `woods share ${w / n}`);
  // the layout is deterministic per pixel
  const { heights, tiles } = flatPixel();
  const o = opts(MIXED.px, MIXED.py, { forests: { archive: 506 } });
  assert.ok(same(layoutNature(heights, tiles, o), layoutNature(heights, tiles, o)));
  // the pixel's lattice is the WORLD's: two neighbours read their shared edge's samples alike, in both directions
  const a = forestField(MIXED.px, MIXED.py), east = forestField(MIXED.px + 1, MIXED.py), north = forestField(MIXED.px, MIXED.py - 1);
  for (let k = 0; k <= 128; k += 4) {
    assert.equal(a(128, k), east(0, k), 'the east neighbour\'s first column is this pixel\'s far one');
    assert.equal(a(k, 128), north(k, 0), 'the north neighbour (py - 1) begins where this pixel ends');
    assert.equal(a(k, 0), forestAt(MIXED.px * 128 + k, -MIXED.py * 128), 'a lattice sample is the field itself at its world tile');
  }
});

test('FOREST1: every flat carries the wood it was rolled against - the field at its world tile plus the places\' pull, exactly', () => {
  const { heights, tiles } = flatPixel();
  const pois = [{ xMin: 50, xMax: 60, yMin: 50, yMax: 60, hide: true }];
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504, pois } }));
  const field = forestField(MIXED.px, MIXED.py);
  for (const f of flats) {
    const [x, y] = tileOf(f);
    assert.equal(f.wood, Math.min(1, Math.max(0, field(x, y) + placesPull(pois, x, y))));
  }
  // a tile's dice are its WORLD tile's: the same tile of the same world, the same draws
  assert.equal(tileDraw(1000, -2000, 0), tileDraw(1000, -2000, 0));
  assert.notEqual(tileDraw(1000, -2000, 0), tileDraw(1001, -2000, 0));
  assert.notEqual(tileDraw(1000, -2000, 0), tileDraw(1000, -2000, 1));
  const d = Array.from({ length: 20000 }, (_, i) => tileDraw(i % 211, Math.floor(i / 211), 0));
  assert.ok(d.every((v) => v >= 0 && v < 1) && Math.abs(d.reduce((s, v) => s + v, 0) / d.length - 0.5) < 0.01, 'uniform');
});

test('FOREST1 (AUDIT F6): a place one peer stands and another does not moves the flats about it alone', () => {
  const { heights, tiles } = flatPixel();
  const without = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } }));
  const spawned = { xMin: 20, xMax: 26, yMin: 20, yMax: 26, hide: true };   // a spawned dungeon the other peer's clock has expired
  const withIt = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504, pois: [spawned] } }));
  const far = (f) => { const [x, y] = tileOf(f); return Math.hypot(Math.max(20 - x, 0, x - 25), Math.max(20 - y, 0, y - 25)) > FOREST.hide.far + 1; };
  const a = without.filter(far), b = withIt.filter(far);
  assert.ok(a.length > 2000);
  assert.ok(same(a, b), 'every flat past the place\'s reach stands where it stood');
});

test('FOREST1: places - the woods close round a dungeon and draw back from a town, and their clearings stay clear', () => {
  const rect = { xMin: 56, xMax: 72, yMin: 56, yMax: 72 };
  assert.equal(placesPull([{ ...rect, hide: true }], 64, 64), 1, 'full inside');
  assert.equal(placesPull([{ ...rect, hide: true }], 72 + FOREST.hide.near - 1, 64), 1, 'full to `near` tiles out');
  assert.equal(placesPull([{ ...rect, hide: true }], 72 + FOREST.hide.far, 64), 0, 'none past `far`');
  assert.equal(placesPull([{ ...rect, hide: true }], 71 + FOREST.hide.far, 64), 0, 'max-exclusive: the last tile in is xMax - 1, and `far` from it is nothing');
  assert.ok(placesPull([{ ...rect, hide: true }], 70 + FOREST.hide.far, 64) > 0, 'a tile short of `far` still pulls');
  const town8 = placesPull([{ ...rect, hide: false }], 71 + FOREST.clear.near + 2, 64);
  assert.ok(town8 > -1 && town8 < 0, `a town's fields ease off past \`near\` (${FOREST.clear.near}) tiles: ${town8}`);
  assert.equal(placesPull([{ ...rect, hide: false }], 64, 64), -1, 'a town draws the woods back');
  assert.equal(placesPull([{ xMin: 2, xMax: 10, yMin: 60, yMax: 68, hide: true }], 0, 64), 0, 'faded out at the pixel\'s edge - no forest cut off by it');
  assert.equal(placesPull([], 64, 64), 0);

  const { heights, tiles } = flatPixel();
  const near = (f) => { const [x, y] = tileOf(f); return Math.hypot(Math.max(rect.xMin - x, 0, x - rect.xMax + 1), Math.max(rect.yMin - y, 0, y - rect.yMax + 1)); };
  const treeShare = (flats, lo, hi) => {
    const ring = flats.filter((f) => { const d = near(f); return d >= lo && d < hi; });
    let tiles = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const d = Math.hypot(Math.max(rect.xMin - x, 0, x - rect.xMax + 1), Math.max(rect.yMin - y, 0, y - rect.yMax + 1)); if (d >= lo && d < hi) tiles++; }
    return ring.filter((f) => isTreeRecord(504, f.record)).length / tiles;
  };
  const hidden = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { locationRect: rect, forests: { archive: 504, pois: [{ ...rect, hide: true }] } }));
  const town = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { locationRect: rect, forests: { archive: 504, pois: [{ ...rect, hide: false }] } }));
  for (const flats of [hidden, town]) {
    assert.ok(flats.every((f) => near(f) > 4 - 1e-9 || !(tileOf(f)[0] >= rect.xMin - 4 && tileOf(f)[0] < rect.xMax + 4 && tileOf(f)[1] >= rect.yMin - 4 && tileOf(f)[1] < rect.yMax + 4)),
      'nothing inside the rect widened by DFU\'s clearance');
  }
  assert.ok(Math.abs(treeShare(hidden, 5, FOREST.hide.near) - FOREST.forestTree) < 0.06, `woods round the dungeon: ${treeShare(hidden, 5, FOREST.hide.near)}`);
  assert.ok(treeShare(town, 5, FOREST.clear.near) <= FOREST.plainTree + 0.02, `fields round the town: ${treeShare(town, 5, FOREST.clear.near)}`);
  // NT2's quirk is DFU's scatter's: here a rect near the pixel's corner is tested whole
  const corner = { xMin: 2, xMax: 30, yMin: 2, yMax: 30 };
  const c = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { locationRect: corner, forests: { archive: 504 } }));
  assert.ok(c.every((f) => { const [x, y] = tileOf(f); return !(x < 34 && y < 34); }), 'no tree across an eight-block town');
});

test('FOREST1: the kernel carries the switch - the location and every World of Daggerfall site are places, on the worker as on the thread', () => {
  const fakeWoods = {
    getHeightMapValuesRange1Dim(mx, my, d) { const a = new Float32Array(d * d); for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1); return a; },
    getLargeHeightMapValuesRange(mx, my, span) { const d = span * 3; const a = new Float32Array(d * d); for (let x = 0; x < d; x++) for (let y = 0; y < d; y++) a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3); return a; },
    getHeightMapValue(px, py) { return (px * 7 + py * 3) % 200; },
  };
  const job = { woods: fakeWoods, px: MIXED.px, py: MIXED.py, climateType: TEMPERATE };
  const off = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128) });
  const on = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), forests: { archive: 504, hidden: false } });
  assert.ok(!same(on.nature, off.nature));
  assert.ok(same(on.nature, layoutNature(on.samples, on.tilemap, { mapPixelX: MIXED.px, mapPixelY: MIXED.py, rawWorldHeight: fakeWoods.getHeightMapValue(MIXED.px, MIXED.py), climateType: TEMPERATE, locationRect: null, forests: { archive: 504, pois: [] } })));
  const rect = { x: 40, y: 50, width: 12, height: 10 };
  const inSite = (f, x0, x1, y0, y1) => { const [x, y] = tileOf(f); return x >= x0 && x < x1 && y >= y0 && y < y1; };
  const wod = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), forests: { archive: 504, hidden: false }, wod: { picks: [{ flatten: false, rect, hide: true }] } });
  assert.ok(!wod.nature.some((f) => inSite(f, 36, 56, 46, 64)), 'a site\'s clearing');
  // AUDIT FOREST1 F1: a rock field or a mountain is no place - no clearing, no ring of woods
  const rocks = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), forests: { archive: 504, hidden: false }, wod: { picks: [{ flatten: false, rect, hide: false }] } });
  assert.ok(rocks.nature.some((f) => inSite(f, 40, 52, 50, 60)), 'scenery is not cleared');
  assert.ok(same(rocks.nature, on.nature), 'nor does it pull the woods');
  // AUDIT FOREST1 F7: a site's FOOTPRINT, when the caller has one, is the clearing - a camp's tents past its rect
  const footprint = wodSiteFootprint({ obj: [{ pos: { x: 3, z: -40 } }] }, rect);
  assert.deepEqual(footprint, { xMin: 39, xMax: 52, yMin: 42, yMax: 60 }, 'the rect and its objects, each grown by the site margin (an object 3 m in from the west edge, 8 m round it)');
  const camp = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), forests: { archive: 504, hidden: false }, wod: { picks: [{ flatten: false, rect, hide: true, bounds: footprint }] } });
  assert.ok(!camp.nature.some((f) => inSite(f, 35, 56, 38, 64)), 'nothing among the tents');
  // the DFU location: a dungeon is ringed by woods, a town by fields - the kernel hands the flag on
  const loc = { xMin: 56, xMax: 72, yMin: 56, yMax: 72 };
  const ring = (n) => n.filter((f) => { const [x, y] = tileOf(f); const d = Math.hypot(Math.max(56 - x, 0, x - 71), Math.max(56 - y, 0, y - 71)); return d > 5 && d < 10 && isTreeRecord(504, f.record); }).length;
  const dungeon = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), locationRect: loc, hasLocation: true, forests: { archive: 504, hidden: true } });
  const town = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), locationRect: loc, hasLocation: true, forests: { archive: 504, hidden: false } });
  assert.ok(ring(dungeon.nature) > 4 * Math.max(1, ring(town.nature)), `woods round a dungeon (${ring(dungeon.nature)}), fields round a town (${ring(town.nature)})`);
  assert.ok(src('world/terrainGen.js').includes('...(wod?.picks ?? []).filter((p) => p.hide !== false).map(({ rect: r, bounds: b }) => (b'),
    'every site, not only the loader\'s last rect, and never scenery');
});

test('FOREST1 (AUDIT F8): no flat on a track the road painter laid - a track over dirt leaves the record dirt', () => {
  const { heights, tiles } = flatPixel();
  const paths = new Uint8Array(128 * 128);
  for (let y = 0; y < 128; y++) for (let x = 60; x < 63; x++) paths[y * 128 + x] = 1;
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504, paths } }));
  assert.ok(flats.length > 1000 && flats.every((f) => { const [x] = tileOf(f); return x < 60 || x > 62; }));
});

test('FOREST1: too steep for nature is too steep for a forest - DFU\'s fifty degrees', () => {
  const heights = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
  for (let a = 0; a < HEIGHTMAP_DIMENSION; a++) for (let b = 0; b < HEIGHTMAP_DIMENSION; b++) heights[a * HEIGHTMAP_DIMENSION + b] = 0.05 + (a < 64 ? a * 0.004 : 0);   // steep in x below tile 64, flat beyond
  const tiles = new Uint8Array(128 * 128).fill(2);
  const flats = layoutNature(heights, tiles, opts(MIXED.px, MIXED.py, { forests: { archive: 504 } }));
  assert.ok(flats.length > 500, 'the flat half stands its flats');
  assert.ok(flats.every((f) => tileOf(f)[0] >= 63 || tileOf(f)[0] === 0), 'none on the slope (the pixel\'s edge column reads half its slope, as DFU\'s central difference clamps there)');
  assert.ok(flats.filter((f) => tileOf(f)[0] < 63).length < flats.length / 20);
});

test('FOREST1 (AUDIT F3): Logging\'s trees stand in the woods - a lone tree of the plains only where a pixel has no wood', () => {
  const flat = (id, x, z, wood) => ({ id, group: 'g', i: id, x, y: 0, z, wood });
  const plainsTree = flat(0, 10, 10, 0), woodTrees = [flat(1, 700, 700, 0.9), flat(2, 710, 700, 1), flat(3, 720, 700, 0.6)];
  const day = 20000;
  const stood = standTrees({ px: 207, py: 213, day, climate: 231, forest: { trees: [plainsTree, ...woodTrees] } });
  assert.ok(stood.length >= 1);
  assert.ok(stood.every((n) => n.flat.wood >= FOREST.woods), 'every tree of the day is a tree of the woods');
  const bare = standTrees({ px: 207, py: 213, day, climate: 231, forest: { trees: [plainsTree] } });
  assert.equal(bare[0]?.flat.id, 0, 'a pixel with no wood stands its lone tree');
  const dfu = standTrees({ px: 207, py: 213, day, climate: 231, forest: { trees: [{ ...plainsTree, wood: undefined }, ...woodTrees.map((f) => ({ ...f, wood: undefined }))] } });
  assert.ok(dfu.some((n) => n.flat.id === 0) || dfu.length === woodTrees.length + 1, 'DFU\'s scatter carries no wood, and its nearest flat is taken');
});

test('FOREST1: the switch - the row, the enhanced skin, ?forests=off; online the room\'s', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.realForests;
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('realForests', true);
    assert.equal(realForestsOn(''), true);
    assert.equal(realForestsOn('?forests=off'), false, 'the kill door');
    setPref('realForests', false);
    assert.equal(realForestsOn(''), false, 'the row is the switch');
    assert.equal(realForestsOn('?online=1'), true, 'online the woods are the room\'s - Logging\'s trees stand in them');
    setPref('realForests', true); setUiSkin('classic');
    assert.equal(realForestsOn(''), false, 'offline, the classic skin keeps DFU\'s scatter');
    assert.equal(realForestsOn('?online=1&forests=off'), true, 'AUDIT FOREST1 F6: the kill door is offline\'s - online the woods are the room\'s ground');
  } finally { setUiSkin(skin); setPref('realForests', pref); }
  assert.equal(onlineForcedPref('realForests', '?online=1'), true);
  const row = FEATURES.find((f) => f.id === 'real-forests');
  assert.ok(row);
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'realForests', initial: true, online: true });
  assert.deepEqual([...FOREST_HIDDEN_LOCATION_TYPES].sort((a, b) => a - b), [4, 7, 9, 10, 12, 13]);
});

test('FOREST1: the world host reads the switch once at its mount and hands the kernel the climate\'s summer archive', () => {
  const w = src('scenes/world.js');
  assert.match(w, /picks: wodPicks\.map\(\(p\) => \(\{ flatten: p\.flatten, rect: p\.rect, hide: !wodPiecewise\(p\.prefabName\), bounds: forests \? wodSiteFootprint\(p\.prefab, p\.rect\) : null \}\)\)/, 'AUDIT F1/F7: the sites and their footprints');
  assert.match(w, /if \(pointNearGate\(gateClear, px, py, f\.x, f\.z, WOD_FLAT_GATE_CLEAR_M\)\) continue;\n\s+if \(forests && insideRocks\(pixelRocks, f\.x, f\.z\)\) continue;/, 'AUDIT F5/F1: the gate\'s clearing and the rock pieces');
  // PIN MOVED (ECOTONE1, 2026-10-07): and its climate - a border's tree is a neighbour climate's, its stump that one's
  assert.match(w, /wood: f\.wood \?\? 0, base, archive \}\);/, 'AUDIT F3: a tree flat carries its wood to Logging');
  assert.match(w, /const forests = realForestsOn\(\);/);
  assert.match(w, /forests: forests \? \{ archive: climate\.natureArchive, hidden: FOREST_HIDDEN_LOCATION_TYPES\.has\(dfLocation\?\.mapTableData\?\.locationType\) \} : null,/);
  assert.equal((w.match(/realForestsOn\(/g) ?? []).length, 1, 'once, not a pixel at a time');
  // the Tree table has one home; Logging reads the same one
  assert.equal(HOST_TREE_RECORDS, TREE_RECORDS);
  assert.equal(hostIsTreeRecord, isTreeRecord);
});
