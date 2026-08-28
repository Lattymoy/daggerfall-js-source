// R3W / RW1 / RC1 — THE ROAD SYSTEM'S WIRING, ITS WIDTH, AND ITS
// CONNECTIVITY. Mac reported two symptoms: roads absent from the
// enhanced map, and a road at a dungeon exit "connected to nothing".
// The audit found the map layer and the travel slice were both written
// and never called, and that the ground paint erased itself against
// every location footprint.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createNetwork, linkPixels, ROAD_TRACK, ROAD_TRUNK } from '../src/systems/roads.js';
import { paintRoadTiles, ROAD_TILE_HALF_WIDTH, ROAD_TILE_RECORDS, isRoadTile } from '../src/world/roadTiles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');
const T = 128, MID = 64;
const isRoad = (tm, x, y) =>
  x >= 0 && y >= 0 && x < T && y < T && tm[x + y * T] !== 0 && ROAD_TILE_RECORDS.includes(tm[x + y * T] & 0x3f);

// ── R3W: the map layer is actually reachable ─────────────────────
test('R3W: the road model has a consumer, a renderer slot, and a host that feeds it', () => {
  // The whole defect was that each link existed and none connected.
  const map = src('src/ui/overworldMap.js');
  assert.match(map, /roadModel, roadLayersForDistance,/, 'the map imports the model');
  assert.match(map, /this\._ov\.setRoads\(roadModel\(chains, \{/, 'and builds one from the host\'s chains');
  assert.match(map, /roadLayers: roadLayersForDistance\(this\._cam\.dist\)/, 'and passes the distance switch');

  const rend = src('src/render/overworldRenderer.js');
  assert.match(rend, /setRoads\(model\) \{/, 'the renderer has a road slot');
  assert.match(rend, /this\._roads = \{ trunk: \[\], track: \[\] \};/);
  // in the DISPOSE, specifically - setRoads frees the old set too, so a
  // bare grep for the call passes with the teardown line deleted.
  const disp = rend.slice(rend.indexOf('this._freeSet(this._route); this._route = null;'));
  assert.match(disp.slice(0, 200), /this\._freeRoads\(\);/,
    'and frees them on TEARDOWN - every chain has an owner');
  // ONE SET PER CHAIN: a single strip across unconnected chains would
  // draw a road that is not there, which is the model's own reason
  // for returning an array.
  assert.match(rend, /for \(const points of model\[kind\] \?\? \[\]\)/);

  const host = src('src/scenes/world.js');
  assert.match(host, /roads: \(\) => \{/, 'the host puts the network in the one dep bag');
  assert.match(host, /_roadChains \?\?= traceNetwork\(roadNetwork\)/, 'traced once, lazily');
});

test('R3W: roads are gated on the SKIN, not the preference alone', () => {
  // Classic Daggerfall has no roads. The preference alone let a classic
  // session bake and paint them.
  assert.match(src('src/scenes/world.js'), /if \(isEnhanced\(\) && getPref\('roads'\)\)/);
});

// ── RW1: narrower, and connected ─────────────────────────────────
test('RW1: a track is one tile and a trunk three, both halved', () => {
  assert.equal(ROAD_TILE_HALF_WIDTH[ROAD_TRACK], 0, 'a track is a single-tile line');
  assert.equal(ROAD_TILE_HALF_WIDTH[ROAD_TRUNK], 1, 'a trunk is a 3-tile band');
  // 6.4 world units per tile, so a trunk lands near 19 units where it
  // used to be near 32 - a third of an RMB block.
  assert.ok(ROAD_TILE_HALF_WIDTH[ROAD_TRUNK] < ROAD_TILE_HALF_WIDTH[ROAD_TRACK] + 2);
});

test('RW1: a diagonal run is 4-CONNECTED, which is what makes one tile possible', () => {
  // The old per-step rounding left a half=0 diagonal as corner-touching
  // dots: 0% of its tiles had an orthogonal neighbour. That is not a
  // road you can walk and not one tileWeight's walk treats as joined.
  const net = createNetwork(8, 8);
  linkPixels(net.trackExits, 8, 4, 4, 5, 3);   // a NE diagonal
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);
  let cells = 0, orth = 0;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!isRoad(tm, x, y)) continue;
      cells++;
      if (isRoad(tm, x - 1, y) || isRoad(tm, x + 1, y) || isRoad(tm, x, y - 1) || isRoad(tm, x, y + 1)) orth++;
    }
  }
  assert.ok(cells > 0, 'the diagonal painted something');
  assert.equal(orth, cells, 'every tile of a diagonal track has an orthogonal neighbour');
});

// ── RW1: the road reaches the town's own street ──────────────────
/** A stamped location footprint, optionally with a street through it -
 *  which is what setLocationTiles produces (0 is stored as 0xff so
 *  assignTiles does not overwrite it). */
const stampTown = (x0, y0, x1, y1, streetRow = null) => {
  const tm = new Uint8Array(T * T);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tm[x + y * T] = 0xff;
  if (streetRow !== null) for (let x = x0; x <= x1; x++) tm[x + streetRow * T] = 46;
  return tm;
};

test('RW1: a road into a town meets the town\'s own street', () => {
  // Daggerfall's REAL rect is 11..116 (test/terrain.test.js:264). A
  // trunk crossing west to east used to keep 110 of 216 tiles and
  // survive only as two detached fringes at x=0..10 and x=117..127 -
  // two stubs connected to nothing, because every run aimed at the
  // pixel CENTRE and stamp() refuses a claimed cell.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);
  const tm = stampTown(11, 11, 116, 116, MID);
  paintRoadTiles(tm, net, 4, 4);

  // the road must touch a tile the TOWN stamped as street
  let meets = false;
  for (let y = 0; y < T && !meets; y++) {
    for (let x = 0; x < T; x++) {
      if (tm[x + y * T] !== 46) continue;
      if (isRoad(tm, x - 1, y) || isRoad(tm, x + 1, y) || isRoad(tm, x, y - 1) || isRoad(tm, x, y + 1)) { meets = true; break; }
    }
  }
  assert.ok(meets, 'the highway reaches the street the town already comes out of');
  // ...and it never overwrote the town's ground
  assert.equal(tm[(MID + 4) + (MID + 4) * T], 0xff, 'the 1:1 tile law is untouched inside the rect');
});

test('RW1: the road lands at the wall NEAREST the street - the gate, not an arbitrary point', () => {
  // The observable half of street-targeting. A town cannot be painted
  // through, so a road always stops at the wall; what aiming at the
  // street buys is WHICH piece of wall. Put the street near the north
  // edge, well inside the rect, and a road entering from the west must
  // bend toward it instead of running to the centre row.
  const net = createNetwork(8, 8);
  linkPixels(net.trackExits, 8, 3, 4, 4, 4);   // arrives from the west, at row MID
  const tm = stampTown(40, 40, 90, 90);
  for (let x = 40; x <= 90; x++) tm[x + 45 * T] = 46;   // an interior street, north
  // The town's street is record 46 too, so compare against a snapshot:
  // only cells this paint ADDED are the road.
  const before = Uint8Array.from(tm);
  paintRoadTiles(tm, net, 4, 4);
  const added = (x, y) => before[x + y * T] === 0 && isRoad(tm, x, y);

  let lastY = null, lastX = -1;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (added(x, y) && x > lastX) { lastX = x; lastY = y; }
    }
  }
  assert.ok(lastX >= 38 && lastX <= 40, `the road stops at the west wall, got x=${lastX}`);
  assert.ok(Math.abs(lastY - 45) < Math.abs(lastY - MID),
    `it lands beside the STREET (row 45), not the centre row - got row ${lastY}`);
});

test('RW1: a run stops at the footprint and never paints a hole inside it', () => {
  // setLocationTiles leaves cells unstamped where textureRecord >= 56,
  // so a footprint has holes. Without the stop the run walks straight
  // through the town and fills them with road.
  const net = createNetwork(8, 8);
  linkPixels(net.trackExits, 8, 3, 4, 4, 4);            // arrives from the west at row MID
  const tm = stampTown(40, 40, 90, 90);
  tm[85 + MID * T] = 46;                                // one street tile, deep on the EAST side
  tm[MID + MID * T] = 0;                                // a hole squarely on the run's line
  paintRoadTiles(tm, net, 4, 4);
  // The west run aims at (85, MID), so its line crosses the town
  // centre. With the stop it halts at the west wall; without it, it
  // walks straight through and fills the hole with road.
  assert.equal(isRoad(tm, MID, MID), false,
    'the hole inside the footprint stays unpainted - the run stopped at the wall');
  assert.ok(isRoad(tm, 38, MID), 'while the road still arrives at that wall');
});

test('RW1: a dead-end spur reaches the BUILDING, not the pixel centre', () => {
  // getLocationTerrainTileOrigin forces a CUST 1x1 exterior to tile
  // (72,55) rather than the centred 56. A centre-aimed run therefore
  // stopped six tiles short of it, in open ground - Mac's "the road was
  // connected to nothing" on leaving a dungeon.
  const net = createNetwork(8, 8);
  linkPixels(net.trackExits, 8, 3, 4, 4, 4);   // a spur arriving from the west
  const tm = stampTown(72, 55, 87, 70);        // the CUST footprint, off-centre
  paintRoadTiles(tm, net, 4, 4);
  let last = -1;
  for (let x = 0; x < T; x++) if (isRoad(tm, x, MID)) last = x;
  assert.equal(last, 71, 'the track ends flush against the footprint at x=72');
});

test('RW1: an empty pixel is unchanged - a dead end still ends in the middle', () => {
  // The no-location case must keep its old shape exactly: a road that
  // only enters ends at the centre, which is what a dead-end track
  // looks like.
  const net = createNetwork(8, 8);
  linkPixels(net.trackExits, 8, 3, 4, 4, 4);
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);
  assert.ok(isRoad(tm, MID, MID), 'it reaches the centre');
  assert.ok(isRoad(tm, 0, MID), 'and starts at the west edge');
  assert.equal(isRoad(tm, MID + 8, MID), false, 'and does not carry on past it');
});

test('RW1: isRoadTile reads the record out of the tileBitfield', () => {
  // setLocationTiles stores tile.tileBitfield, so the record is the low
  // six bits - the same mask CityNavigation applies at :57.
  assert.equal(isRoadTile(46), true);
  assert.equal(isRoadTile(46 | 0x40), true, 'a rotate/flip bit does not hide the record');
  assert.equal(isRoadTile(0), false, 'an empty cell is not a road');
  assert.equal(isRoadTile(8), false);
});

// ── RC1: the trunk skeleton's connectivity ───────────────────────
test('RC1: the union is committed only after the reroute succeeds', () => {
  // It used to run BEFORE, with `if (!r) continue` after it - so a
  // reroute that failed against the live field left union-find claiming
  // two hubs joined with no trunk between them, and every later
  // candidate that would have joined them was skipped as redundant.
  const s = src('src/systems/roads.js');
  const route = s.indexOf('const r = routeRoad(field, hubs[c.a], hubs[c.b], opts);');
  const guard = s.indexOf('if (!r) continue;', route);
  const union = s.indexOf('uf.union(c.a, c.b);', route);
  assert.ok(route > 0 && guard > route && union > guard,
    'route, then the guard, then the union');
});

test('RC1: the forest is counted and reported, and every location gets a spur try', () => {
  const s = src('src/systems/roads.js');
  assert.match(s, /trunkComponents, strandedHubs,/, 'the stats say whether the skeleton is one network');
  // The spur comment always said "every remaining location"; the code
  // walked `spurs`, the non-hub types only, so a stranded hub got no
  // road at all and nothing reported it.
  assert.match(s, /for \(const s of all\) \{/, 'the spur pass walks every location');
});
