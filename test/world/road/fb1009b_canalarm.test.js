// FIELD BUGS 2026-10-09b - CANAL-ARM, the Discord's "River/Stream Creation Turned Some Roads into Canals": "Noticing that
// a lot of towns that usually have straight dirt roads to them now have canals?"
//
// Basic Roads' arrays shared a compass arm between a path and a river or a stream at 32 arms of 30 pixels. The painter
// paints the water before the track, so a shared arm was water from the pixel's centre to its edge where the dirt track
// ran; LANDFORM3 cuts the painted water into the land and the room's rivers are on, so each was a straight sunken
// channel - a canal - up to the town. Each such arm is the path's (world/roadsProducer.js waterOffPaths): the painter,
// the channel's cut and the maps read the arrays, so all three agree, and a crossing (no shared arm) is a ford as it was.
// PIN MOVED (OWN-WORK2, 2026-10-31): his arrays are retired; the law is pinned on a network of the test's own, and the
// Bay's own network is watered as it is built. `01-Overview/bugs/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waterOffPaths } from '../../../src/world/roadsProducer.js';
import { paintRoads, pathCorners, TILE } from '../../../src/world/road/roadPainter.js';
import { MAP_W, MAP_H, DIR, DIR_DELTA } from '../../../src/world/road/roadNetwork.js';

const shared = (net, i) => (net.rivers[i] | net.streams[i]) & (net.roads[i] | net.tracks[i]);
const at = (x, y) => y * MAP_W + x;
/** A town at (100, 100): a road in from the north and on south, a track west; a river down the road's north arm and
 *  away east, a stream up the track's west arm and away south - and a crossing at (200, 100), a road N-S over a river E-W. */
function network() {
  const plane = () => new Uint8Array(MAP_W * MAP_H);
  const net = { roads: plane(), tracks: plane(), rivers: plane(), streams: plane() };
  net.roads[at(100, 100)] = DIR.N | DIR.S;
  net.tracks[at(100, 100)] = DIR.W;
  net.rivers[at(100, 100)] = DIR.N | DIR.E;
  net.streams[at(100, 100)] = DIR.W | DIR.S;
  net.roads[at(200, 100)] = DIR.N | DIR.S;
  net.rivers[at(200, 100)] = DIR.E | DIR.W;
  return net;
}

test('CANAL-ARM: every arm a path carries is the path\'s - the river\'s and the stream\'s bits on it go, every other water arm stands, the crossing\'s too (mutants: the river keeps the arm; the stream keeps it; the path under the water too)', () => {
  const his = network(), net = waterOffPaths(network());
  assert.equal(shared(his, at(100, 100)), DIR.N | DIR.S | DIR.W, 'three shared arms');
  for (let i = 0; i < net.roads.length; i++) assert.equal(shared(net, i), 0, 'no arm is both a path and water');
  assert.equal(net.rivers[at(100, 100)], DIR.E, 'the river keeps its own arm east');
  assert.equal(net.streams[at(100, 100)], 0, 'the stream\'s two arms were the road\'s and the track\'s');
  assert.equal(net.rivers[at(200, 100)], DIR.E | DIR.W, 'a crossing shares no arm - its ford stands');
  assert.deepEqual([net.roads, net.tracks], [his.roads, his.tracks], 'the paths as they were');
});

test('CANAL-ARM: painted with the rivers on, a shared arm is its path\'s from the centre to the edge - the tiles a path paints there with the water off, no water tile among them', () => {
  const net = waterOffPaths(network()), his = network();
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
  const i = at(100, 100), s = shared(his, i);
  const on = paint(i, true), off = paint(i, false);
  let checked = 0;
  for (const [bit, dx, dy] of DIR_DELTA) {
    if (!(s & bit)) continue;
    // along the arm, off the centre to the edge - the tile rows run north (a north arm paints rows 63..127), the map's south
    for (let t = 0.3; t <= 0.95; t += 0.05) {
      const x = Math.max(0, Math.min(127, Math.round(64 + dx * 63 * t))), y = Math.max(0, Math.min(127, Math.round(64 - dy * 63 * t)));
      assert.equal(on[y * 128 + x], off[y * 128 + x], `arm ${bit} at ${x},${y}: the path's tile`);
      checked++;
    }
  }
  assert.ok(checked > 30, `${checked} tiles along the shared arms`);
  assert.ok(on.some((v, k) => v !== off[k]), 'and the river\'s own arm east is water');
});

test('CANAL-ARM: the Bay\'s network is watered as it is built (mutant: the network unwatered)', () => {
  const src = readFileSync(new URL('../../../src/world/roadsProducer.js', import.meta.url), 'utf8');
  assert.match(src, /\n {4}waterOffPaths\(Object\.assign\(net, \{ rivers, streams \}\)\);/);
});
