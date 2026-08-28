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
import { createNetwork, linkPixels, ROAD_TRACK, ROAD_TRUNK, networkHasAnyRoad } from '../src/systems/roads.js';
import { loadOrBakeRoadsAsync, serializeRoads } from '../src/systems/roadBake.js';
import { paintRoadTiles, ROAD_TILE_HALF_WIDTH, ROAD_TILE_RECORDS, isRoadTile } from '../src/world/roadTiles.js';
import { roadPoints } from '../src/ui/overworldModel.js';
import { ROAD_TILE_RECORD_BY_KIND, ROAD_TILE_RECORD } from '../src/world/roadTiles.js';
import { pickFootstepSet, FOOTSTEP } from '../src/systems/footsteps.js';

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

// ── RR1: rounded, not mitred ─────────────────────────────────────
test('RR1: a through road is ROUNDED - no mitred corner at the pixel centre', () => {
  // Every exit used to be a straight spoke to the centre, so a road
  // entering west and leaving north painted two spokes meeting at a
  // hard 90 degrees - and a chain of those corners across the province
  // is the zig-zag. A pixel with exactly two exits is one Bezier now.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);   // W
  linkPixels(net.trunkExits, 8, 4, 4, 4, 3);   // N
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);

  // The mitre's signature is the centre row running clean to the
  // centre column and stopping dead. On a curve the road has already
  // begun to bend before it gets there, so the centre row's road ends
  // WEST of the corner.
  let lastOnCentreRow = -1;
  for (let x = 0; x < T; x++) if (isRoad(tm, x, MID)) lastOnCentreRow = x;
  assert.ok(lastOnCentreRow < MID - 2,
    `the run bends away before the centre, got x=${lastOnCentreRow}`);

  // ...and it is still 4-connected end to end, and still meets BOTH
  // edges exactly where the neighbours' runs meet them.
  assert.ok(isRoad(tm, 0, MID), 'it starts at the west edge tile');
  assert.ok(isRoad(tm, MID, T - 1), 'and ends at the north edge tile');
  let cells = 0, orth = 0;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!isRoad(tm, x, y)) continue;
      cells++;
      if (isRoad(tm, x - 1, y) || isRoad(tm, x + 1, y) || isRoad(tm, x, y - 1) || isRoad(tm, x, y + 1)) orth++;
    }
  }
  assert.equal(orth, cells, 'the curve is 4-connected throughout');

  // WHICH WAY it bows is the law, not merely that it bows. The control
  // point is the pixel CENTRE, so the curve is pulled toward the
  // middle of the pixel - a road through a pixel goes through it. A
  // control point pulled to a corner instead still draws a smooth
  // curve, just one hugging the wrong two edges, so this pins the
  // side: a quadratic's midpoint lands halfway to its control point.
  const nearRoad = (cx, cy, r = 3) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) if (isRoad(tm, x, y)) return true;
    }
    return false;
  };
  // centre control: B(0.5) = (0,64)/4 + (64,64)/2 + (64,127)/4 = (48, 80)
  assert.ok(nearRoad(48, 80), 'the curve bows toward the middle of the pixel');
  // corner control (0,127) would put it at (16, 111) instead
  assert.equal(nearRoad(16, 111), false, 'and not toward the north-west corner');

  // ...and it never leaves the hull its three control points span.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!isRoad(tm, x, y)) continue;
      assert.ok(x <= MID + 1 && y >= MID - 1, `the curve stayed in its hull, got ${x},${y}`);
    }
  }
});

test('RR1: the curve bends toward the CENTRE, on a diagonal pair too', () => {
  // The axis-aligned pair above cannot tell a centre control point
  // from `(exits[0].x, exits[1].y)` - exitTile puts MID on the
  // non-moving axis, so that expression lands ON the centre and the
  // two are the same curve. A DIAGONAL exit separates them.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 4, 4, 5, 3);   // NE, exit tile (127,127)
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);   // W,  exit tile (0,64)
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);
  const nearRoad = (cx, cy, r = 3) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) if (isRoad(tm, x, y)) return true;
    }
    return false;
  };
  // centre control (64,64) puts the midpoint at (64, 80)
  assert.ok(nearRoad(64, 80), 'the curve bows through the middle of the pixel');
  // a control at (127,64) would put it out at (95, 80)
  assert.equal(nearRoad(95, 80), false, 'not out toward the east edge');
});

test('RR1: the MAP layer rounds its chains too - a right angle stops being one', () => {
  // The traced chain is a walk over map pixels, so every turn in it is
  // a multiple of 45 degrees. Chaikin cuts those corners; without it
  // the drawn road is a staircase.
  const ctx = { heightBytes: new Uint8Array(16 * 16).fill(30), width: 16, height: 16 };
  const corner = [{ x: 2, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 2 }];
  const [buf] = roadPoints([corner], ctx, 0);
  assert.ok(buf.length / 3 > corner.length, 'smoothing added vertices');
  // the ENDS are exact - they are where the tracer split at a junction
  assert.equal(buf[0], Math.fround(2 + 0.5));
  assert.equal(buf[buf.length - 3], Math.fround(8 + 0.5));
  // ...and no vertex sits exactly on the old hard corner any more
  const cornerX = Math.fround(8 + 0.5), cornerZ = Math.fround(-(8 + 0.5));
  let onCorner = 0;
  for (let i = 0; i < buf.length; i += 3) {
    if (buf[i] === cornerX && buf[i + 2] === cornerZ) onCorner++;
  }
  assert.equal(onCorner, 0, 'the mitre vertex is cut away');
});

test('RR1: a straight through road is unchanged, and a junction keeps its spokes', () => {
  // W->E through the centre: the Bezier's control point is ON the
  // line, so the curve IS the straight run. Nothing moves.
  const thru = createNetwork(8, 8);
  linkPixels(thru.trunkExits, 8, 3, 4, 4, 4);
  linkPixels(thru.trunkExits, 8, 4, 4, 5, 4);
  const a = new Uint8Array(T * T);
  paintRoadTiles(a, thru, 4, 4);
  for (let x = 0; x < T; x++) assert.ok(isRoad(a, x, MID), `the straight run is unbroken at x=${x}`);

  // Three exits is a junction, not a curve - it keeps spokes to the
  // centre, so the centre tile itself is road.
  const junc = createNetwork(8, 8);
  linkPixels(junc.trunkExits, 8, 3, 4, 4, 4);
  linkPixels(junc.trunkExits, 8, 4, 4, 5, 4);
  linkPixels(junc.trunkExits, 8, 4, 4, 4, 3);
  const b = new Uint8Array(T * T);
  paintRoadTiles(b, junc, 4, 4);
  assert.ok(isRoad(b, MID, MID), 'a junction still meets at the centre');
});

// ── RP1 / RB1 ────────────────────────────────────────────────────
test('RP1: the loops phase reports as it goes, not once at the end', () => {
  const s = src('src/systems/roads.js');
  assert.match(s, /report\('loops', 0, loopCandidates\.length\);/, 'it opens the phase');
  assert.match(s, /report\('loops', \+\+loopsSeen, loopCandidates\.length\);/,
    'and ticks per candidate EXAMINED - most are rejected, so counting the laid ones would crawl then jump');
  assert.equal(/report\('loops', loopsLaid, loopsLaid\)/.test(s), false,
    'the done === total report that made the bar look instant is gone');
});

test('RB1: an EMPTY bake is never cached, and an empty cache reads as a miss', async () => {
  const empty = createNetwork(8, 8);
  const full = createNetwork(8, 8);
  linkPixels(full.trunkExits, 8, 2, 2, 3, 2);
  assert.equal(networkHasAnyRoad(empty), false);
  assert.equal(networkHasAnyRoad(full), true);
  // BOTH planes count. A network of nothing but TRACK is a real
  // network - most of the province is spurs - and reading it as empty
  // would rebake a good artifact on every single boot.
  const trackOnly = createNetwork(8, 8);
  linkPixels(trackOnly.trackExits, 8, 2, 2, 3, 2);
  assert.equal(networkHasAnyRoad(trackOnly), true, 'a track-only network is not empty');

  // a bake that lays nothing still ANSWERS - this boot is unaffected -
  // but it writes no bytes, so it cannot become permanent
  const a = await loadOrBakeRoadsAsync(null, async () => ({ network: empty }));
  assert.equal(a.fromCache, false);
  assert.equal(a.network, empty, 'the caller still gets its network');
  assert.equal(a.bytes, null, 'and nothing is handed to the store');

  // a bake that lays road IS cached
  const b = await loadOrBakeRoadsAsync(null, async () => ({ network: full }));
  assert.ok(b.bytes, 'a real network is cached');

  // an ALREADY-poisoned cache recovers: intact envelope, right
  // version, no road - a hit by every other test, and a miss by this
  // one, so the bake runs again instead of the emptiness surviving.
  let rebaked = 0;
  const c = await loadOrBakeRoadsAsync(serializeRoads(empty), async () => { rebaked++; return { network: full }; });
  assert.equal(rebaked, 1, 'the empty cache was rebaked, not read back');
  assert.equal(c.fromCache, false);
  assert.equal(networkHasAnyRoad(c.network), true);

  // ...while a cache WITH road is still a hit and never rebakes
  let touched = 0;
  const d = await loadOrBakeRoadsAsync(serializeRoads(full), async () => { touched++; return { network: full }; });
  assert.equal(touched, 0, 'a good cache is still read, not rebaked');
  assert.equal(d.fromCache, true);
});


// ── RC2: a trunk and a track look different underfoot ────────────
test('RC2: the two classes paint DIFFERENT records, and both are still road', () => {
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);   // a trunk from the west
  linkPixels(net.trackExits, 8, 4, 4, 4, 3);   // a track to the north
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);

  const seen = new Set();
  for (const v of tm) if (v) seen.add(v & 0x3f);
  assert.equal(seen.size, 2, 'the classes are told apart on the ground at all');
  assert.ok(seen.has(ROAD_TILE_RECORD_BY_KIND[ROAD_TRUNK]));
  assert.ok(seen.has(ROAD_TILE_RECORD_BY_KIND[ROAD_TRACK]));
  // ...and BOTH remain road to the nav law and to every road reader -
  // this ships no art and changes nothing about what counts as road.
  for (const r of seen) assert.ok(ROAD_TILE_RECORDS.includes(r), `${r} is one of DFU's road records`);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (tm[x + y * T]) assert.ok(isRoadTile(tm[x + y * T]), 'every painted tile reads as road');
    }
  }
  // the trunk keeps 46 - the record the single-record version used and
  // the one the older pins name
  assert.equal(ROAD_TILE_RECORD_BY_KIND[ROAD_TRUNK], ROAD_TILE_RECORD);
});

test('RC2: an explicit `record` still overrides both classes', () => {
  // A probe or a pin must be able to paint the whole network in one
  // record and read it back without knowing the classes.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);
  linkPixels(net.trackExits, 8, 4, 4, 4, 3);
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4, { record: 55 });
  const seen = new Set();
  for (const v of tm) if (v) seen.add(v & 0x3f);
  assert.deepEqual([...seen], [55], 'one record for the lot when the caller says so');
});

// ── FS1: the tile under the player ───────────────────────────────
test('FS1: a road underfoot rings like stone, and open ground does not', () => {
  // pickFootstepSet has carried this arm since the FS-slice with NO
  // producer anywhere in src/ - the exterior host passed inside,
  // winter and climate, and nothing else.
  const ground = pickFootstepSet({ inside: false, winter: false, climateIndex: 302 });
  const road = pickFootstepSet({ inside: false, winter: false, climateIndex: 302, onExteriorPath: true });
  assert.deepEqual(ground, [FOOTSTEP.Outside1, FOOTSTEP.Outside2], 'the field beside it');
  assert.deepEqual(road, [FOOTSTEP.Stone1, FOOTSTEP.Stone2], 'and the road itself');
  assert.notDeepEqual(road, ground, 'a road sounds different from the field beside it');
  // The path arm sits AFTER the snow arm in DFU's own write order, so
  // a road in winter is stone rather than snow.
  const snowRoad = pickFootstepSet({ inside: false, winter: true, climateIndex: 302, onExteriorPath: true });
  assert.deepEqual(snowRoad, [FOOTSTEP.Stone1, FOOTSTEP.Stone2], 'a cleared road in winter is stone');
  const snow = pickFootstepSet({ inside: false, winter: true, climateIndex: 302 });
  assert.deepEqual(snow, [FOOTSTEP.Snow1, FOOTSTEP.Snow2], 'while the field around it is not');
});

test('FS1: what the probe reads off a real tilemap IS what isRoadTile answers', () => {
  // The chain end to end: paint a road, read a tile the way the probe
  // reads it, and ask the same question the footstep arm asks.
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 3, 4, 4, 4);   // straight through, row MID
  linkPixels(net.trunkExits, 8, 4, 4, 5, 4);
  const tm = new Uint8Array(T * T);
  paintRoadTiles(tm, net, 4, 4);
  assert.equal(isRoadTile(tm[40 + MID * T]), true, 'on the road');
  assert.equal(isRoadTile(tm[40 + 20 * T]), false, 'off it');
  // the probe's "no information" answer must not read as road
  assert.equal(isRoadTile(null ?? 0), false, 'an unstreamed pixel is not a road');
});

test('FS1: the host retains the tilemap and probes it at the right scale', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /tilemapTex, tilemap, groundArchive/, 'the pixel record keeps its tilemap');
  assert.match(w, /const TERRAIN_TILE_WORLD = 2 \* TERRAIN_TILE_DIM;/,
    'a terrain tile is 2 x WorldMapTileDim world units - locationWorldRect walks the same step');
  assert.match(w, /const ty = Math\.floor\(\(wc\.z - origin\.z\) \/ TERRAIN_TILE_WORLD\);/,
    'rows rise with z, which is why row 127 is north');
  assert.match(w, /onExteriorPath: isRoadTile\(playerGroundTile\(\) \?\? 0\)/, 'and the footsteps read it');
  // off the built world the probe says NOTHING rather than "not road"
  assert.match(w, /if \(!built_\?\.tilemap\) return null;/);
});
