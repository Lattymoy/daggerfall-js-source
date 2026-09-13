// BR3 - THE SHIPPED DATA, END TO END (2026-09-13, Mac: "can you do an
// audit on basic roads, I dont think its working").
//
// EVERY ROADS TEST BEFORE THIS ONE USED A SYNTHETIC MASK. roads.test.js
// hands paintRoads a `DIR.N | DIR.S` it wrote itself; roadsParity.test.js
// replays 907 oracle cases, and the oracle's `roadCorners` is an INPUT -
// so `pathCorners`, the function that COMPUTES that byte from the four
// vendored arrays, was pinned only against the port's own expectation and
// never against a byte the mod would actually produce. Nothing anywhere
// asserted that vendor/roads-hazelnut/*.bytes - the files the game
// actually ships and reads - put a single road tile on the ground.
//
// So the whole chain could have been green with the feature dead: a
// wrong bit convention, a transposed index, a truncated asset, a painter
// that answers for every mask a test invents and none the map holds.
// This file runs the REAL arrays through the REAL kernel and counts what
// lands in the tilemap the GPU reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paintRoads, pathCorners, TILE } from '../src/world/roadPainter.js';
import { MAP_W, MAP_H } from '../src/world/roadNetwork.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';

const bytes = (f) => new Uint8Array(readFileSync(new URL(`../vendor/roads-hazelnut/${f}`, import.meta.url)));
const roads = bytes('roadData.bytes');
const tracks = bytes('trackData.bytes');
const rivers = bytes('riverData.bytes');
const streams = bytes('streamData.bytes');

const corners = (m, px, py) => (m ? pathCorners(m, px, py, MAP_W) : 0);
/** The three records a road wears (46 surface, 47 dirt flank, 55 grass
 *  flank), under the rotate/flip bits the painter ORs on top. */
const ROAD_RECORDS = new Set([TILE.road, TILE.roadDirt, TILE.roadGrass]);
const recordOf = (t) => t & 0x3f;

test('BR3: the shipped arrays are four whole map-pixel planes with roads on them', () => {
  for (const [name, a] of [['road', roads], ['track', tracks], ['river', rivers], ['stream', streams]]) {
    assert.equal(a.length, MAP_W * MAP_H, `${name}Data is one byte per map pixel`);
  }
  // A plane of zeroes is a file that loaded and says nothing - the exact
  // shape of "every test green, no roads on the ground".
  const count = (a) => a.reduce((n, b) => n + (b ? 1 : 0), 0);
  assert.equal(count(roads), 21554, 'his road pixels');
  assert.equal(count(tracks), 30472, 'his track pixels');
  assert.equal(count(rivers), 973, 'his river pixels');
  assert.equal(count(streams), 2203, 'his stream pixels');
});

test('BR3: every one of his road pixels paints road tiles - none is silently blank', () => {
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
  const mean = tiles / 21554;
  assert.ok(mean > 100 && mean < 600, `mean road tiles per pixel is ${mean.toFixed(1)} of 16384`);
});

test('BR3: his data survives the WHOLE kernel - the tilemap the GPU reads carries the road', () => {
  // paintRoads is one step. assignTiles runs its marching squares after
  // it and convertTilemap re-encodes every byte for the shader; a road
  // that is painted and then overwritten or re-encoded away is a road
  // nobody sees. This is the only pin that reads the FINAL bytes.
  const woods = {
    getHeightMapValue: () => 40,
    getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d).fill(40),
    getLargeHeightMapValuesRange: (x, y, d) => new Uint8Array(d * d * 25).fill(40),
  };
  const net = { roads, tracks, rivers, streams, water: false, smooth: true };
  let carried = 0, probed = 0;
  for (let i = 0; i < roads.length && probed < 250; i++) {
    if (!roads[i]) continue;
    probed++;
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const out = generatePixelTerrain({
      woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128),
      locationRect: null, hasLocation: false, climateType: 302, roads: net,
    });
    // convertTilemap writes (record * 4) + transform, so the record is >> 2.
    if (out.tilemapBytes.some((b) => ROAD_RECORDS.has(b >> 2))) carried++;
    assert.equal(out.withRoads, true, 'and the pixel reports it was painted with a network');
  }
  assert.equal(carried, probed, `${probed - carried} of ${probed} pixels lost their road between paintRoads and the shader`);
});

test('BR3: RiversAndStreams is what decides whether his water paints at all', () => {
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
