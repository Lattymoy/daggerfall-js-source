// THE SHIPPED DATA, END TO END.
//
// EVERY ROADS TEST BEFORE THIS ONE USED A SYNTHETIC MASK. This file runs
// the REAL network through the REAL kernel and counts what lands in the
// tilemap the GPU reads. OWN-WORK2: the real network is the
// port's own, built from the player's ARENA2 (test/bayRoads.mjs) - Hazelnut's
// arrays are retired - so the file runs where that data is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintRoads, pathCorners, TILE } from '../../../src/world/road/roadPainter.js';
import { MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { bayRoads, BAY_SKIP } from '../../bayRoads.mjs';

const net = bayRoads();
const { roads, tracks, rivers, streams } = net ?? {};

const corners = (m, px, py) => (m ? pathCorners(m, px, py, MAP_W) : 0);
/** The three records a road wears (46 surface, 47 dirt flank, 55 grass
 *  flank), under the rotate/flip bits the painter ORs on top. */
const ROAD_RECORDS = new Set([TILE.road, TILE.roadDirt, TILE.roadGrass]);
const recordOf = (t) => t & 0x3f;

test('BR3: the network is four whole map-pixel planes with paths on them', { skip: BAY_SKIP }, () => {
  for (const [name, a] of [['road', roads], ['track', tracks], ['river', rivers], ['stream', streams]]) {
    assert.equal(a.length, MAP_W * MAP_H, `the ${name} plane is one byte per map pixel`);
  }
  // A plane of zeroes is a build that ran and says nothing - the exact
  // shape of "every test green, no roads on the ground". OWN-WORK2: the
  // counts are pinned once, test/world/road/ownwork2_bayroads.test.js.
  const count = (a) => a.reduce((n, b) => n + (b ? 1 : 0), 0);
  for (const a of [roads, tracks, rivers, streams]) assert.ok(count(a) > 1000, `${count(a)} pixels`);
});

test('BR3: every road pixel paints road tiles - none is silently blank', { skip: BAY_SKIP }, () => {
  let blank = 0, tiles = 0;
  const ground = new Uint8Array(129 * 129).fill(TILE.grass);
  const first = [];
  for (let i = 0; i < roads.length; i++) {
    if (!roads[i]) continue;
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const tilemap = new Uint8Array(128 * 128);
    paintRoads(ground, tilemap, roads[i], tracks[i], null, 129, {
      river: 0, stream: 0, water: false,
      corners: { road: corners(roads, px, py), track: corners(tracks, px, py), river: 0, stream: 0 },
    });
    let n = 0;
    for (const t of tilemap) if (ROAD_RECORDS.has(recordOf(t))) n++;
    tiles += n;
    if (!n && first.length < 5) first.push(`(${px},${py}) mask ${roads[i]}`);
    if (!n) blank++;
  }
  assert.equal(blank, 0, `road pixels that paint NOTHING: ${first.join(', ')}`);
  // A road is a thin thing on a 128x128 pixel - a couple of hundred tiles,
  // not a handful and not a field. The mean is the shape of the whole map.
  const mean = tiles / roads.reduce((n, b) => n + (b ? 1 : 0), 0);
  assert.ok(mean > 100 && mean < 600, `mean road tiles per pixel is ${mean.toFixed(1)} of 16384`);
});

test('BR3: the network survives the WHOLE kernel - the tilemap the GPU reads carries the road', { skip: BAY_SKIP }, () => {
  // paintRoads is one step. assignTiles runs its marching squares after
  // it and convertTilemap re-encodes every byte for the shader; a road
  // that is painted and then overwritten or re-encoded away is a road
  // nobody sees. This is the only pin that reads the FINAL bytes.
  const woods = {
    getHeightMapValue: () => 40,
    getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d).fill(40),
    getLargeHeightMapValuesRange: (x, y, d) => new Uint8Array(d * d * 25).fill(40),
  };
  const whole = { roads, tracks, rivers, streams, water: false, smooth: true };
  let carried = 0, probed = 0;
  for (let i = 0; i < roads.length && probed < 250; i++) {
    if (!roads[i]) continue;
    probed++;
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const out = generatePixelTerrain({
      woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128),
      locationRect: null, hasLocation: false, climateType: 302, roads: whole,
    });
    // convertTilemap writes (record * 4) + transform, so the record is >> 2.
    if (out.tilemapBytes.some((b) => ROAD_RECORDS.has(b >> 2))) carried++;
    assert.equal(out.withRoads, true, 'and the pixel reports it was painted with a network');
  }
  assert.equal(carried, probed, `${probed - carried} of ${probed} pixels lost their road between paintRoads and the shader`);
});

test('BR3: RiversAndStreams is what decides whether the water paints at all', { skip: BAY_SKIP }, () => {
  // The switch a player actually flips. Off is the mod's own default.
  const ground = new Uint8Array(129 * 129).fill(TILE.grass);
  const paint = (i, water) => {
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const tilemap = new Uint8Array(128 * 128);
    paintRoads(ground, tilemap, 0, 0, null, 129, {
      river: rivers[i], stream: streams[i], water,
      corners: { road: 0, track: 0, river: corners(rivers, px, py), stream: corners(streams, px, py) },
    });
    return tilemap.some((t) => t !== 0);
  };
  let on = 0, off = 0, n = 0;
  for (let i = 0; i < rivers.length && n < 500; i++) {
    if (!rivers[i]) continue;
    n++;
    if (paint(i, true)) on++;
    if (paint(i, false)) off++;
  }
  assert.equal(on, n, 'every river pixel paints with the switch ON');
  assert.equal(off, 0, 'and none of them paints with it OFF');
});
