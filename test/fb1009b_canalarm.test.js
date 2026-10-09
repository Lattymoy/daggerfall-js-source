// FIELD BUGS 2026-10-09b - CANAL-ARM, the Discord's "River/Stream Creation Turned Some Roads into Canals": "Noticing that
// a lot of towns that usually have straight dirt roads to them now have canals?"
//
// Hazelnut's arrays share a compass arm between a path and a river or a stream at 32 arms of 30 pixels. His painter
// paints the water before the track, so a shared arm was water from the pixel's centre to its edge where the dirt track
// ran, and a river along a road flanked the road with its banks; LANDFORM3 cuts the painted water into the land and the
// room's rivers are on, so each was a straight sunken channel - a canal - up to the town. Each such arm is the path's
// now, once, as the arrays load (world/roadsProducer.js waterOffPaths): the painter, the channel's cut and the maps read
// the arrays, so all three agree, and a crossing (no shared arm) is a ford or a causeway as it was.
// `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as producer from '../src/world/roadsProducer.js';
import { paintRoads, pathCorners, TILE } from '../src/world/roadPainter.js';
import { MAP_W, DIR_DELTA } from '../src/world/roadNetwork.js';

const { loadModRoads, MOD_ROADS } = producer;
const raw = (k) => new Uint8Array(readFileSync(new URL(MOD_ROADS[k])));
/** The files as the page fetches them, off the vendored tree. */
const fetchLocal = async (url) => ({ ok: true, arrayBuffer: async () => readFileSync(new URL(url)).buffer.slice(0) });
const shared = (net, i) => (net.rivers[i] | net.streams[i]) & (net.roads[i] | net.tracks[i]);

test('CANAL-ARM: his arrays as they load give every arm a path carries to the path - the 32 shared arms of 30 pixels; every other water arm, the crossings\' among them, stands (mutant: the arrays loaded as they ship)', async () => {
  const his = { roads: raw('roads'), tracks: raw('tracks'), rivers: raw('rivers'), streams: raw('streams') };
  let pixels = 0, arms = 0;
  for (let i = 0; i < his.roads.length; i++) { const s = shared(his, i); if (s) { pixels++; for (let b = 0; b < 8; b++) arms += (s >> b) & 1; } }
  assert.deepEqual([pixels, arms], [30, 32], 'the shipped arrays\' shared arms');
  const net = await loadModRoads(fetchLocal);
  assert.ok(net && net.source === 'basic-roads');
  let left = 0, kept = 0, crossings = 0;
  for (let i = 0; i < net.roads.length; i++) {
    if (shared(net, i)) left++;
    const path = his.roads[i] | his.tracks[i];
    // every water arm the path does not carry is his to the bit
    if (net.rivers[i] === (his.rivers[i] & ~path) && net.streams[i] === (his.streams[i] & ~path)) kept++;
    if (path && (net.rivers[i] | net.streams[i])) crossings++;
  }
  assert.equal(left, 0, 'no arm is both a path and water');
  assert.equal(kept, net.roads.length, 'nothing else moved');
  assert.ok(crossings > 300, `the crossings stand: ${crossings} pixels carry a path and water`);
  assert.deepEqual([net.roads, net.tracks].map((a, k) => a.every((v, i) => v === [his.roads, his.tracks][k][i])), [true, true], 'the paths are his to the byte');
});

test('CANAL-ARM: painted with the rivers on, a shared arm is its path\'s from the centre to the edge - the tiles a path paints there with the water off, no water tile among them (mutant: the arrays loaded as they ship)', async () => {
  const his = { roads: raw('roads'), tracks: raw('tracks'), rivers: raw('rivers'), streams: raw('streams') };
  const net = await loadModRoads(fetchLocal);
  const ground = new Uint8Array(129 * 129).fill(TILE.grass);
  const corners = (m, px, py) => pathCorners(m, px, py, MAP_W);
  const paint = (i, water) => {
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const tilemap = new Uint8Array(128 * 128);
    paintRoads(ground, tilemap, net.roads[i], net.tracks[i], null, 129, {
      river: net.rivers[i], stream: net.streams[i], water,
      corners: { road: corners(net.roads, px, py), track: corners(net.tracks, px, py), river: corners(net.rivers, px, py), stream: corners(net.streams, px, py) },
    });
    return tilemap;
  };
  let checked = 0;
  for (let i = 0; i < his.roads.length; i++) {
    const s = shared(his, i);
    if (!s) continue;
    const on = paint(i, true), off = paint(i, false);
    for (const [bit, dx, dy] of DIR_DELTA) {
      if (!(s & bit)) continue;
      // along the arm, off the centre (a crossing's own ford may lie there) to the edge - the tile rows run north
      // (a north arm paints rows 63..127), the map's rows south
      for (let t = 0.3; t <= 0.95; t += 0.05) {
        const x = Math.max(0, Math.min(127, Math.round(64 + dx * 63 * t))), y = Math.max(0, Math.min(127, Math.round(64 - dy * 63 * t)));
        assert.equal(on[y * 128 + x], off[y * 128 + x], `(${i % MAP_W},${(i / MAP_W) | 0}) arm ${bit} at ${x},${y}: the path's tile`);
        checked++;
      }
    }
  }
  assert.ok(checked > 400, `${checked} tiles along the shared arms`);
});
