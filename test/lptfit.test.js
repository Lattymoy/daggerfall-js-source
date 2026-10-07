// LPT-FIT (2026-10-07, Mac: "roads still show on roads and pathways. You're not taking the entire model into account"):
// THE WHOLE TREE FITS ITS ROOM. VERGE1 kept the WILD flats' reach off the road band; a location's own trees (a town's,
// a farm's, a tavern's RMB blocks) were never asked, nor the location's streets, nor the paved ring Basic Roads lays
// round a town - and Low Poly Trees stands a 5-15 m crown on each. Every Low Poly tree is drawn no wider than the room
// its root has from the pixel's path tiles (world/roadVerge.js pathTileMask, tileRoom) and the network's band
// (roadRoom): lptFitCap, under the tree's own variety, never under LPT_FIT_FLOOR. A scale, never a move. The fixtures
// are the producers': the painter's own tilemap and mask (roadPainter.js paintRoads), the marching squares' lookup
// (terrainTiles.js), the baked crowns (lptCrowns.js), the set the frame draws (lowPolyTrees.js buildTreeSet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathTileMask, tileRoom, lptFitCap, LPT_FIT_FLOOR, TILE_M, PATH_HALF_M } from '../src/world/roadVerge.js';
import { LPT_CROWNS } from '../src/world/lptCrowns.js';
import { paintRoads, TILE } from '../src/world/roadPainter.js';
import { createLookupTable } from '../src/world/terrainTiles.js';
import { DIR, MAP_W } from '../src/world/roadNetwork.js';
import { buildTreeSet, lptVariety, LPT_SET_FLOATS, LPT_SCALE_MAX } from '../src/world/lowPolyTrees.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The painter's own pixel: a road north to south over grass - its tilemap and its mask. */
function paintedRoad(road = DIR.N | DIR.S, track = 0) {
  const grass = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128), paths = new Uint8Array(128 * 128);
  paintRoads(grass, tilemap, road, track, null, 129, { paths });
  return { tilemap, paths };
}
const TEMPERATE_TREE = '504_12';   // a temperate wood's Tree under Low Poly Trees: a 9.68 m crown

test('LPT-FIT: the path tiles are the painter\'s mask and the road records 46/47/55 a location\'s streets wear, whatever their turn - and the marching squares never write one (mutants: the records unread; the mask unread)', () => {
  const { tilemap, paths } = paintedRoad();
  const mask = pathTileMask(tilemap, paths);
  for (let i = 0; i < mask.length; i++) assert.equal(mask[i], paths[i], `the painted road is the mask, tile ${i}`);
  // a location's street, as setLocationTiles writes its blocks' ground: the road records, turned and flipped
  const street = new Uint8Array(128 * 128);
  street[10 * 128 + 10] = TILE.road; street[10 * 128 + 11] = TILE.roadDirt + 64; street[10 * 128 + 12] = TILE.roadGrass + 128 + 64;
  street[10 * 128 + 13] = TILE.grass; street[10 * 128 + 14] = 0xff;   // ground, and water
  assert.deepEqual([...pathTileMask(street, null).subarray(10 * 128 + 10, 10 * 128 + 15)], [1, 1, 1, 0, 0]);
  // the marching squares' every answer is ground, never a road record - so on a finished tilemap 46/47/55 is a path
  const natural = new Set([...createLookupTable()].map((v) => v & 0x3f));
  for (const r of [TILE.road, TILE.roadDirt, TILE.roadGrass]) assert.equal(natural.has(r), false, `record ${r} is no ground's`);
  // a track over dirt is marked and not written (VERGE1) - the mask carries it
  const dirt = new Uint8Array(129 * 129).fill(TILE.dirt), t = new Uint8Array(128 * 128), p = new Uint8Array(128 * 128);
  paintRoads(dirt, t, 0, DIR.E | DIR.W, null, 129, { paths: p });
  assert.equal(t.some((v) => v !== 0), false);
  assert.equal(pathTileMask(t, p).some((v) => v === 1), true, 'the track the mod writes nothing for');
});

test('LPT-FIT: a root\'s room is its distance to the nearest path tile\'s square - 0 on one, the reach when none is nearer (mutants: the square\'s far edge; its centre for its square; the search a tile short)', () => {
  const { tilemap, paths } = paintedRoad();
  const mask = pathTileMask(tilemap, paths);
  // the north-south road is tiles 63 and 64: x from 403.2 to 416 m
  assert.ok(Math.abs(63 * TILE_M - 403.2) < 1e-9);
  assert.equal(tileRoom(mask, 410, 300, 20), 0, 'on the road');
  assert.ok(Math.abs(tileRoom(mask, 420, 300, 20) - 4) < 1e-9, '4 m east of its east edge');
  assert.ok(Math.abs(tileRoom(mask, 400, 300, 20) - 3.2) < 1e-9, '3.2 m west of its west edge');
  assert.equal(tileRoom(mask, 450, 300, 20), 20, 'past the reach: the reach');
  assert.equal(tileRoom(mask, 410, 300, 0), 0);
  // a corner: the nearest tile is the square's corner, not its side
  const one = new Uint8Array(128 * 128); one[10 * 128 + 10] = 1;
  assert.ok(Math.abs(tileRoom(one, 11 * TILE_M + 3, 11 * TILE_M + 4, 20) - 5) < 1e-9, '3-4-5 off the tile\'s north-east corner');
  // two tiles over and still in reach: a root near its own tile's east side reaches a tile two east (the search's span)
  const two = new Uint8Array(128 * 128); two[5 * 128 + 12] = 1;
  assert.ok(Math.abs(tileRoom(two, 10 * TILE_M + 6, 5 * TILE_M + 1, 9.68) - (12 * TILE_M - (10 * TILE_M + 6))) < 1e-9, '6.8 m - inside a 9.68 m reach');
  assert.ok(Math.abs(PATH_HALF_M - TILE_M) < 1e-9, 'the band is the painted road\'s two tiles, one either side of its line');
});

test('LPT-FIT: the cap - a tree drawn no wider than its room over its turned crown, its variety under it; never under the floor; no cap where it fits or its crown is unknown (mutants: the cap unfloored; the room over the reach; the band unasked)', () => {
  const { tilemap, paths } = paintedRoad();
  const mask = pathTileMask(tilemap, paths);
  const crown = LPT_CROWNS[TEMPERATE_TREE];
  assert.equal(crown, 9.68, 'the baked, turned crown');
  // 4 m off the road: the crown is drawn 4 m wide
  const cap = lptFitCap(mask, null, 230, 230, 420, 300, crown, 1);
  assert.ok(Math.abs(cap * crown - 4) < 1e-9, `the drawn crown reaches the road's edge and no further (${cap * crown})`);
  // far enough for its variety: no cap
  assert.equal(lptFitCap(mask, null, 230, 230, 440, 300, crown, 1), Infinity);
  assert.equal(lptFitCap(mask, null, 230, 230, 440, 300, crown, 1.4), Infinity, '24 m off: room for its widest');
  assert.equal(lptFitCap(mask, null, 230, 230, 428, 300, crown, 1), Infinity, '12 m off: room for it at 1');
  assert.ok(Math.abs(lptFitCap(mask, null, 230, 230, 428, 300, crown, 1.4) - 12 / crown) < 1e-9, '...and at its widest it is capped to the room');
  // on the road: a sapling, never nothing (its trunk's collider and cover stand there)
  assert.equal(lptFitCap(mask, null, 230, 230, 410, 300, crown, 1), LPT_FIT_FLOOR);
  assert.equal(LPT_FIT_FLOOR, 0.2);
  assert.equal(lptFitCap(mask, null, 230, 230, 420, 300, 0, 1), Infinity, 'a record the mod leaves a picture');
  // the band across a pixel's edge: no tile of this pixel is near, the neighbour's road is
  const roads = new Uint8Array(MAP_W * 500), tracks = new Uint8Array(MAP_W * 500);
  roads[230 * MAP_W + 231] = DIR.W;   // the pixel to the east: its road's west arm runs to our east edge, along z = 409.6
  const net = { roads, tracks };
  const empty = new Uint8Array(128 * 128);
  assert.equal(lptFitCap(empty, null, 230, 230, 815, 419.6, crown, 1), Infinity, 'the tiles alone see nothing');
  const bandCap = lptFitCap(empty, net, 230, 230, 815, 419.6, crown, 1.4);
  assert.ok(Math.abs(bandCap - (Math.hypot(819.2 - 815, 10) - PATH_HALF_M) / crown) < 1e-9, `the band caps it: the arm's end 10.8 m off, 4.4 from the band's edge (${bandCap})`);
});

test('LPT-FIT: the set the frame draws takes the cap - each tree its variety or its fit, the lesser; a group with none is as it was (mutants: the fit unread; the greater taken)', () => {
  const centers = [[420, 50, 300], [440, 50, 300], [100, 50, 100]];
  const wild = Uint8Array.of(1, 1, 1);
  const fit = Float32Array.of(0.4, Infinity, 2);
  const { trees } = buildTreeSet(230, 230, [{ h: 3, centers, wild, fit }]);
  const plain = buildTreeSet(230, 230, [{ h: 3, centers, wild }]).trees;
  centers.forEach((c, i) => {
    const v = lptVariety(230, 230, c[0], c[2], false).scale;
    assert.ok(Math.abs(trees[i * LPT_SET_FLOATS + 4] - Math.min(v, fit[i])) < 1e-6, `tree ${i}`);
    assert.ok(Math.abs(plain[i * LPT_SET_FLOATS + 4] - v) < 1e-6, `tree ${i} uncapped`);
  });
  assert.ok(lptVariety(230, 230, 420, 300, false).scale > 0.4, 'the fixture\'s first tree is one the cap shrinks');
});

test('LPT-FIT by source: the world host fits every Low Poly tree of a pixel - the wild\'s and a location\'s - under clear roadsides, by the drawn prototype\'s turned crown, on its far picture and its near set alike; THE FOUR HOSTS', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const crown = verges \? \(LPT_CROWNS\[lpt\.key\] \?\? 0\) : 0;/, 'under the clear roadsides\' switch, the turned crown');
  assert.match(w, /if \(crown > 0 && !lptPathMask\) lptPathMask = pathTileMask\(tilemap, paths\);/, 'the pixel\'s finished tiles and the painter\'s mask');
  assert.match(w, /if \(fit\) fit\[i\] = lptFitCap\(lptPathMask, vergeNet, px, py, c\[0\], c\[2\], crown, v\);/, 'every centre - wild or not');
  assert.match(w, /scales\[i\] = \(fit \? Math\.min\(v, fit\[i\]\) : v\) \/ LPT_SCALE_MAX;/, 'the far picture');
  assert.match(w, /lptGroups\.push\(\{ h: lptHandles\.length - 1, centers, wild, fit \}\);/, 'the near set');
  assert.equal(LPT_SCALE_MAX, 1.4);
  // exterior.js (the fixed town bench) lays one location's ground in its own frame and paints no roads; worldModes.js and
  // dungeonContext.js stand no terrain trees - none of them fits a tree (Roads.md LPT-FIT)
  for (const host of ['exterior', 'worldModes', 'dungeonContext']) {
    assert.doesNotMatch(read(`src/scenes/${host}.js`), /lptFitCap|pathTileMask/, `${host}.js`);
  }
});
