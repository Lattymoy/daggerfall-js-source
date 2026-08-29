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
import { createNetwork, linkPixels, ROAD_TRACK, ROAD_TRUNK, networkHasAnyRoad, buildCostField, buildRoadNetwork } from '../src/systems/roads.js';
import { loadOrBakeRoadsAsync, serializeRoads } from '../src/systems/roadBake.js';
import { paintRoadTiles, ROAD_TILE_HALF_WIDTH, ROAD_TILE_RECORDS, isRoadTile, throughControl, simplifyKeepingCorners } from '../src/world/roadTiles.js';
import { roadPoints, chaikin, simplifyChain, reliefPoint, sampleHeightByte, SIMPLIFY_EPSILON } from '../src/ui/overworldModel.js';
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

test('RZ2: the control point is placed by how sharply the road turns', () => {
  // RR1 put it at the centre ALWAYS. That rounds a right angle
  // correctly and scallops a gentle bend: a road drifting
  // east-north-east had to dive to the middle of every pixel and back
  // out to a corner, standing a mean 28 tiles and a peak 46 off its
  // own line over five pixels.
  const W = { x: 0, y: MID }, E = { x: T - 1, y: MID };
  const N = { x: MID, y: T - 1 }, NE = { x: T - 1, y: T - 1 };

  // opposite exits: the chord's midpoint, so a through road is STRAIGHT
  const straight = throughControl(W, E);
  // the chord's own midpoint - exits sit at 0 and 127, so that is
  // 63.5, half a tile off MID and exactly where the straight line runs
  assert.equal(straight.x, (W.x + E.x) / 2, 'a straight road stays on its chord');
  assert.equal(straight.y, MID);

  // perpendicular exits: the centre, so a real corner rounds as before
  const corner = throughControl(W, N);
  assert.equal(corner.x, MID, 'a right angle still bows to the centre');
  assert.equal(corner.y, MID);

  // 135 degrees: mostly the chord, a little of the centre
  const gentle = throughControl(W, NE);
  const chordMid = { x: (W.x + NE.x) / 2, y: (W.y + NE.y) / 2 };
  const toChord = Math.hypot(gentle.x - chordMid.x, gentle.y - chordMid.y);
  const toCentre = Math.hypot(gentle.x - MID, gentle.y - MID);
  assert.ok(toChord < toCentre, 'a gentle bend sits nearer its chord than the centre');
  assert.ok(toChord > 0, 'but is not perfectly straight - it still bends');
});

test('RZ2: a drifting road stays far nearer its own line than it did', () => {
  // The behavioural half, stitched across five pixels the way the
  // streamed world lays them - each painted independently, so this is
  // the picture the player walks.
  const chain = [[2, 5], [3, 5], [4, 4], [5, 4], [6, 3]];
  const net = createNetwork(9, 9);
  for (let i = 1; i < chain.length; i++) {
    linkPixels(net.trunkExits, 9, chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
  }
  const PX = [2, 3, 4, 5, 6], PY = [3, 4, 5];
  const BW = PX.length * T, BH = PY.length * T;
  const big = new Uint8Array(BW * BH);
  for (let j = 0; j < PY.length; j++) {
    for (let i = 0; i < PX.length; i++) {
      const tm = new Uint8Array(T * T);
      paintRoadTiles(tm, net, PX[i], PY[j]);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) big[(i * T + x) + ((j * T) + (T - 1 - y)) * BW] = tm[x + y * T];
      }
    }
  }
  const pts = [];
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (big[x + y * BW]) pts.push([x, y]);
  assert.ok(pts.length > 0);
  let a = pts[0], b = pts[0];
  for (const p of pts) { if (p[0] < a[0]) a = p; if (p[0] > b[0]) b = p; }
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  let max = 0;
  for (const p of pts) {
    const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) max = d;
  }
  // 45.9 with the centre control; the exit POINTS themselves set the
  // floor, since a diagonal step must pass through a shared corner.
  assert.ok(max < 40, `the drifting road stands ${max.toFixed(1)} tiles off its line`);
  // and the road is still one connected thing across every seam
  const road = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH && big[x + y * BW] !== 0;
  let cells = 0, orth = 0;
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      if (!road(x, y)) continue;
      cells++;
      if (road(x - 1, y) || road(x + 1, y) || road(x, y - 1) || road(x, y + 1)) orth++;
    }
  }
  assert.equal(orth, cells, 'every tile of the stitched road has an orthogonal neighbour');
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


// ── RH1: the map's roads ride the relief ─────────────────────────
test('RH1: a smoothed road has a HEIGHT at every vertex, not NaN', () => {
  // reliefPoint indexed heightBytes with the raw coordinates, which
  // held while every vertex WAS a pixel. RR1's smoothing put
  // fractional points between pixels, and a fractional array index is
  // undefined - so overworldHeight(undefined) was NaN. Measured on a
  // three-pixel corner before the fix: 6 of 12 vertices NaN, which is
  // a road with no height for half its length.
  const hb = new Uint8Array(16 * 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) hb[y * 16 + x] = 20 + x * 4;
  const ctx = { heightBytes: hb, width: 16, height: 16 };
  const [buf] = roadPoints([[{ x: 2, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 2 }]], ctx, 0);
  for (let i = 1; i < buf.length; i += 3) {
    assert.ok(Number.isFinite(buf[i]), `vertex ${(i - 1) / 3} has a real height`);
  }
});

test('RH1: the sample is BILINEAR, and exact on a pixel', () => {
  const hb = new Uint8Array(4 * 4);
  hb[0] = 0; hb[1] = 100;              // (0,0)=0  (1,0)=100
  hb[4] = 0; hb[5] = 100;              // (0,1)=0  (1,1)=100
  const w = 4, h = 4;
  // exact on a pixel - anything already right must not move
  assert.equal(sampleHeightByte(hb, w, h, 0, 0), 0);
  assert.equal(sampleHeightByte(hb, w, h, 1, 0), 100);
  // and interpolated between two, which is what the drawn surface does
  // between its one-vertex-per-pixel centres
  assert.equal(sampleHeightByte(hb, w, h, 0.5, 0), 50);
  assert.equal(sampleHeightByte(hb, w, h, 0.25, 0), 25);
  // clamped at the edges rather than reading off the end
  assert.equal(sampleHeightByte(hb, w, h, -3, -3), 0);
  assert.ok(Number.isFinite(sampleHeightByte(hb, w, h, 99, 99)));
  // reliefPoint at an integer pixel still answers what it always did
  const ctx = { heightBytes: hb, width: w, height: h };
  assert.deepEqual(reliefPoint(1, 0, ctx, 0), [1.5, reliefPoint(1, 0, ctx, 0)[1], -0.5]);
});

// ── RZ1: simplify, THEN smooth ───────────────────────────────────
const turning = (pts) => {
  let total = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    const b = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    total += d * 180 / Math.PI;
  }
  return total;
};
/** the staircase a traced chain makes of an east-north-east road */
const staircase = () => {
  const out = []; let y = 0;
  for (let x = 0; x < 24; x++) { if (x % 3 === 0) y++; out.push({ x, y }); }
  return out;
};

test('RZ1: a grid staircase becomes STRAIGHT, because smoothing alone cannot', () => {
  const stair = staircase();
  assert.equal(Math.round(turning(stair)), 630, 'the raw chain wobbles this much');
  // Chaikin alone takes the worst corner down but moves the TOTAL not
  // at all - it spreads the same wobble over more vertices. That is
  // why simplification had to come first, and pinning it here is what
  // stops someone "simplifying" the pipeline back to smoothing alone.
  assert.equal(Math.round(turning(chaikin(stair, 2))), 630,
    'smoothing rounds corners; it does not decide which are real');
  // simplify DOES
  const simp = simplifyChain(stair);
  assert.equal(Math.round(turning(simp)), 0, 'the staircase was an artifact of the grid');
  assert.equal(simp.length, 2, 'and collapses to the line it always was');
});

test('RZ1: roadPoints itself straightens - the pipeline, not just the helper', () => {
  // The helpers can both be right while roadPoints uses neither. This
  // drives the actual model builder, which is what draws the map.
  const ctx = { heightBytes: new Uint8Array(32 * 32).fill(30), width: 32, height: 32 };
  const [buf] = roadPoints([staircase()], ctx, 0);
  const verts = buf.length / 3;
  // simplify collapses the 24-pixel staircase to its two ends, and
  // Chaikin leaves a two-point chain alone. Smoothing WITHOUT
  // simplifying would give 96 vertices of the same wobble.
  assert.ok(verts < 12, `a straight-running road draws as a straight line, got ${verts} vertices`);
  // and the ends are still exactly where the tracer put them
  assert.equal(buf[0], Math.fround(0 + 0.5));
  assert.equal(buf[buf.length - 3], Math.fround(23 + 0.5));
});

test('RZ1: a road that genuinely turns KEEPS its corner', () => {
  // The risk of simplifying is flattening real shape. A right-angle
  // road must survive with its angle intact and only shed the pixels
  // along its two straight legs.
  const corner = [];
  for (let x = 0; x < 12; x++) corner.push({ x, y: 0 });
  for (let y = 1; y < 12; y++) corner.push({ x: 11, y });
  const simp = simplifyChain(corner);
  assert.equal(Math.round(turning(simp)), 90, 'the corner is still a corner');
  assert.equal(simp.length, 3, 'reduced to its two legs and the bend between them');
  // ends are exact - they are where the tracer split at a junction
  assert.deepEqual(simp[0], corner[0]);
  assert.deepEqual(simp[simp.length - 1], corner[corner.length - 1]);
});

test('RZ1: the tolerance sits just under one pixel, for a stated reason', () => {
  // A diagonal step stands at most sqrt(2)/2 off the line it belongs
  // to, so the tolerance has to clear that and stay under a pixel.
  assert.ok(SIMPLIFY_EPSILON > Math.SQRT2 / 2, 'clears a diagonal grid step');
  assert.ok(SIMPLIFY_EPSILON < 1, 'and keeps anything that bends by a whole pixel');
  // a chain too short to simplify comes back untouched
  assert.deepEqual(simplifyChain([{ x: 1, y: 1 }, { x: 2, y: 2 }]), [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
});


// ── RZ3: the ROUTE was the zig-zag ───────────────────────────────
/** Stitch a chain of map pixels the way the streamed world lays them -
 *  each painted on its own, which is the only way a seam defect shows. */
function stitchChain(chain, plane = 'trunkExits') {
  const xs = [...new Set(chain.map((c) => c[0]))].sort((a, b) => a - b);
  const ys = [...new Set(chain.map((c) => c[1]))].sort((a, b) => a - b);
  const net = createNetwork(32, 32);
  for (let i = 1; i < chain.length; i++) {
    linkPixels(net[plane], 32, chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
  }
  const W = xs.length * T, H = ys.length * T;
  const big = new Uint8Array(W * H);
  for (let j = 0; j < ys.length; j++) {
    for (let i = 0; i < xs.length; i++) {
      const tm = new Uint8Array(T * T);
      paintRoadTiles(tm, net, xs[i], ys[j]);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) big[(i * T + x) + ((j * T) + (T - 1 - y)) * W] = tm[x + y * T];
      }
    }
  }
  return { big, W, H };
}
function deviation({ big, W, H }) {
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (big[x + y * W]) pts.push([x, y]);
  let a = pts[0], b = pts[0];
  for (const p of pts) { if (p[0] < a[0]) a = p; if (p[0] > b[0]) b = p; }
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let max = 0;
  for (const p of pts) {
    const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) max = d;
  }
  const road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && big[x + y * W] !== 0;
  let cells = 0, orth = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!road(x, y)) continue;
      cells++;
      if (road(x - 1, y) || road(x + 1, y) || road(x, y - 1) || road(x, y + 1)) orth++;
    }
  }
  return { max, connected: orth === cells };
}

test('RZ3: a road on a shallow gradient runs STRAIGHT, not flat-flat-step', () => {
  // The measurement that found this: on a road climbing one pixel in
  // three, the painted road sat dead flat across three whole pixels
  // and then stepped 128 tiles at once - 63.4 tiles off its own line.
  // The exits and the curve were faithfully drawing a staircase,
  // because the ROUTE is a staircase at pixel resolution.
  for (const [name, chain] of [
    ['1 in 2', [[2, 10], [3, 10], [4, 9], [5, 9], [6, 8]]],
    ['1 in 3', [[2, 11], [3, 11], [4, 11], [5, 10], [6, 10], [7, 10], [8, 9]]],
    ['1 in 4', [[2, 10], [3, 10], [4, 10], [5, 10], [6, 9], [7, 9], [8, 9], [9, 9]]],
  ]) {
    const r = deviation(stitchChain(chain));
    assert.ok(r.max < 8, `a ${name} gradient stands ${r.max.toFixed(1)} tiles off its line`);
    assert.equal(r.connected, true, `and the ${name} road is unbroken across every seam`);
  }
  // ...and the shapes that were already right have not moved
  assert.ok(deviation(stitchChain([[2, 8], [3, 8], [4, 8], [5, 8], [6, 8]])).max < 4, 'straight');
  assert.ok(deviation(stitchChain([[2, 10], [3, 9], [4, 8], [5, 7], [6, 6]])).max < 5, 'diagonal');
});

test('RZ3: a stair is dropped and a CORNER is kept - the turn tells them apart', () => {
  // A one-pixel corner and a one-pixel stair are the SAME shape: both
  // stand 0.707 off their chord, so no RDP tolerance can separate them
  // - it either keeps both and the staircase survives, or drops both
  // and a right-angle road is cut across. A first draft here did the
  // latter: the corner pixel painted a sliver at its own corner
  // instead of turning. The TURN separates them - a stair is 45
  // degrees, a corner is 90 or more.
  const stair = simplifyKeepingCorners([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
  assert.ok(stair.length < 4, 'the stair steps are gone');

  const corner = simplifyKeepingCorners([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }]);
  assert.equal(corner.length, 3, 'a one-pixel right angle survives intact');
  assert.deepEqual(corner[1], { x: 1.5, y: 2.5 }, 'and it is the corner pixel itself that is kept');

  // a chain too short to simplify comes back as its own centres
  assert.deepEqual(simplifyKeepingCorners([{ x: 0, y: 0 }, { x: 1, y: 0 }]),
    [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }]);
});

test('RZ3: both neighbours draw the SAME road on their shared seam', () => {
  // Symmetry is the whole difficulty: the two pixels are painted
  // independently and possibly never together, so they must place the
  // road identically or it tears. They trace the WHOLE chain, junction
  // to junction, from the same exit planes - the curve belongs to the
  // CHAIN, not to whoever is looking at it.
  const chain = [[2, 11], [3, 11], [4, 11], [5, 10], [6, 10]];
  const net = createNetwork(32, 32);
  for (let i = 1; i < chain.length; i++) {
    linkPixels(net.trunkExits, 32, chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
  }
  // pixels (3,11) and (4,11) share a vertical seam
  const left = new Uint8Array(T * T), right = new Uint8Array(T * T);
  paintRoadTiles(left, net, 3, 11);
  paintRoadTiles(right, net, 4, 11);
  const leftEdge = [], rightEdge = [];
  for (let y = 0; y < T; y++) {
    if (left[(T - 1) + y * T]) leftEdge.push(y);
    if (right[0 + y * T]) rightEdge.push(y);
  }
  assert.ok(leftEdge.length > 0 && rightEdge.length > 0, 'both pixels reach the seam');
  // they must OVERLAP, or the road tears at the boundary
  assert.ok(leftEdge.some((y) => rightEdge.includes(y)),
    `the seam tears: left rows ${leftEdge} vs right rows ${rightEdge}`);
});

test('RZ3: the chain cache does not touch the network the bake serializes', () => {
  // The artifact is serialized to the cache; a derived field grafted
  // onto it would ride along or break the envelope. A WeakMap keeps
  // the index off the object entirely.
  const src_ = src('src/world/roadTiles.js');
  assert.match(src_, /const CHAIN_CACHE = new WeakMap\(\);/);
  assert.equal(/network\.__chains/.test(src_), false, 'nothing is written onto the network');
  const net = createNetwork(8, 8);
  linkPixels(net.trunkExits, 8, 2, 2, 3, 2);
  paintRoadTiles(new Uint8Array(T * T), net, 2, 2);
  assert.deepEqual(Object.keys(net).filter((k) => k.startsWith('_')), [], 'the network grew no fields');
});


// ── RC3: the trunk forest ────────────────────────────────────────
/** A map whose hubs CLUMP, the way Daggerfall's towns clump by
 *  province - which is the shape that splits the skeleton. */
function clumpedMap(clusters, { wallAt = null, hubsPer = 6, W = 120, H = 80 } = {}) {
  const hb = new Uint8Array(W * H).fill(40);
  const locs = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [cx, cy] of clusters) {
    for (let i = 0; i < hubsPer; i++) {
      locs.push({ x: Math.round(cx + (rnd() - 0.5) * 14), y: Math.round(cy + (rnd() - 0.5) * 14), locationType: 0 });
    }
  }
  const field = buildCostField({ heightBytes: hb, climateAt: () => 2, width: W, height: H, isWater: () => false });
  if (wallAt !== null) {
    for (let y = 0; y < H; y++) for (let x = wallAt; x <= wallAt + 4; x++) field.cost[y * W + x] = Infinity;
  }
  const built = buildRoadNetwork({ field, locations: locs, heightBytes: hb });
  // the caller needs the hubs to walk the road between them
  return { ...built, locations: locs, hubs: locs.filter((l) => l.locationType === 0) };
}

test('RC3: a clumped map used to build three road systems that never met', () => {
  // The candidate graph is the k nearest hubs and is not guaranteed
  // connected, so stage 3 produced a spanning FOREST. Worse, every
  // statistic reported contentment: no hub STRANDED, because each sits
  // in a cluster of its own kind, and no spur ORPHANED, because each
  // finds its own cluster's road. Three road systems, no complaint.
  const r = clumpedMap([[15, 15], [100, 20], [60, 65]]);
  assert.equal(r.stats.forestBefore, 3, 'the forest is real, and this is the shape that makes it');
  assert.equal(r.stats.bridgesLaid, 2, 'joining N components takes N-1 bridges');
  assert.equal(r.stats.trunkComponents, 1, 'and what comes out is ONE network');
  // the old signals that stayed silent through all of it
  assert.equal(r.stats.strandedHubs, 0);
  assert.equal(r.stats.orphans, 0);
});

test('RC3: an ISLAND is reported, not looped on', () => {
  // Two clusters either side of an impassable wall cannot be joined by
  // any road. The loop must stop, say so, and not retry the same
  // refusing pair for ever.
  const r = clumpedMap([[20, 20], [95, 40]], { wallAt: 58 });
  assert.equal(r.stats.forestBefore, 2);
  assert.equal(r.stats.bridgesLaid, 0, 'no bridge is forced across water');
  assert.equal(r.stats.trunkComponents, 2, 'the two islands are reported as they are');
});

test('RC3: a map that was already one network is not touched', () => {
  const r = clumpedMap([[40, 40]], { hubsPer: 10 });
  assert.equal(r.stats.forestBefore, 1, 'one cluster, one component');
  assert.equal(r.stats.bridgesLaid, 0, 'so nothing to bridge');
  assert.equal(r.stats.trunkComponents, 1);
});

/** Walk the road itself, on the GROUND, from one hub - the exit planes
 *  are the road, so this asks whether a cart could actually get there.
 *  union-find agreeing is not the same claim. */
function hubsReachableOnTheRoad(network, hubs) {
  const { width, height, trunkExits, trackExits } = network;
  const seen = new Uint8Array(width * height);
  const start = hubs[0];
  const stack = [[start.x, start.y]];
  seen[start.y * width + start.x] = 1;
  const STEPS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  while (stack.length) {
    const [x, y] = stack.pop();
    const bits = trunkExits[y * width + x] | trackExits[y * width + x];
    for (let d = 0; d < 8; d++) {
      if (!(bits & (1 << d))) continue;
      const nx = x + STEPS[d][0], ny = y + STEPS[d][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (seen[ny * width + nx]) continue;
      seen[ny * width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  return hubs.filter((h) => seen[h.y * width + h.x]).length;
}

test('RC3: the join lays ROAD, not just a union-find merge', () => {
  // The exact lie RC1 caught one stage earlier, repeated here: a union
  // without a layPath leaves the bookkeeping claiming two components
  // joined with nothing on the ground between them. Every count agrees
  // - one component, two bridges - and no cart can make the journey.
  // So walk the EXIT PLANES from one hub and count how many others are
  // actually reachable along road.
  const r = clumpedMap([[15, 15], [100, 20], [60, 65]]);
  assert.equal(r.stats.trunkComponents, 1, 'the bookkeeping says one network');
  assert.equal(hubsReachableOnTheRoad(r.network, r.hubs), r.hubs.length,
    'and every hub is reachable along the road ITSELF, not merely in the union-find');
});

test('RC3: the join is deterministic - the same map bakes the same roads', () => {
  const a = clumpedMap([[15, 15], [100, 20], [60, 65]]);
  const b = clumpedMap([[15, 15], [100, 20], [60, 65]]);
  assert.deepEqual(a.stats, b.stats, 'same statistics');
  assert.deepEqual([...a.network.trunkExits], [...b.network.trunkExits], 'and the same trunk plane, byte for byte');

  // The FIRST tied pair wins, not the last. Read from the source
  // because it is unobservable: `<` and `<=` are BOTH deterministic,
  // so no reproducibility pin can separate them, and they differ only
  // when two cross-component pairs are EXACTLY equidistant - which
  // real hub coordinates essentially never are, and which cannot be
  // staged here either, since a fixture tight enough to tie is also
  // tight enough for the k=5 candidate graph to have joined the two
  // clusters already. Recorded rather than contorted around: the day
  // the scan order changes, this line is what says which pair the bake
  // was supposed to pick.
  assert.match(src('src/systems/roads.js'), /if \(d < bestD\) \{ bestD = d; best = \{ i, j, key \}; \}/);
});


// ── RZ4/RZ5: the seam a LOCATION sits on ─────────────────────────
/** A stamped town footprint, as setLocationTiles leaves one. */
const stampFootprint = () => {
  const tm = new Uint8Array(T * T);
  for (let y = 40; y <= 88; y++) for (let x = 40; x <= 88; x++) tm[x + y * T] = 0xff;
  return tm;
};

test('RZ4: a road on a GRADIENT does not tear where it reaches a town', () => {
  // RZ3 gave open country the smoothed chain and left a location's
  // pixel on the exit rule, so the two disagreed about where a road
  // crosses a seam. On a 1-in-3 gradient the open neighbour left at
  // tile rows 126-127 and the town took the road in at 63-65 - sixty
  // two tiles of nothing, at every town the road reached.
  const chain = [[2, 11], [3, 11], [4, 11], [5, 10], [6, 10], [7, 10], [8, 9]];
  const net = createNetwork(32, 32);
  for (let i = 1; i < chain.length; i++) {
    linkPixels(net.trunkExits, 32, chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
  }
  const town = stampFootprint();
  paintRoadTiles(town, net, 4, 11);
  const open = new Uint8Array(T * T);
  paintRoadTiles(open, net, 3, 11);

  const rows = (tm, col) => {
    const out = [];
    for (let y = 0; y < T; y++) { const v = tm[col + y * T]; if (v && v !== 0xff) out.push(y); }
    return out;
  };
  const left = rows(open, T - 1), right = rows(town, 0);
  assert.ok(left.length && right.length, 'both pixels put road on the seam');
  assert.ok(left.some((y) => right.includes(y)),
    `the road tears at the town: neighbour rows ${left} vs town rows ${right}`);
});

test('RZ5: out of bounds is not the same as CLAIMED', () => {
  // The chain pass begins OUTSIDE its pixel and only its width reaches
  // in, so a stop mask that counts out-of-bounds as claimed halts the
  // run before it paints anything - which is precisely how the tear
  // above survived a first fix. A run that starts at the pixel's own
  // edge still stops when it leaves.
  const s_ = src('src/world/roadTiles.js');
  assert.match(s_, /function isClaimed\(mask, x, y, outOfBoundsStops = true\)/);
  assert.match(s_, /return outOfBoundsStops;/, 'the caller decides what leaving the tilemap means');
  assert.match(s_, /densifyChain\(c\.points, px, py\), half, rec, claimed, false\)/,
    'the chain pass says leaving is not stopping');
});

test('RZ5: and the town keeps its ground, holes included', () => {
  // The mask still stops the run at the town's own stamped ground -
  // dropping it entirely was the other way this went wrong, and it
  // filled the unstamped HOLES inside the footprint with road.
  const chain = [[2, 4], [3, 4], [4, 4]];
  const net = createNetwork(9, 9);
  for (let i = 1; i < chain.length; i++) {
    linkPixels(net.trunkExits, 9, chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
  }
  const town = stampFootprint();
  town[MID + MID * T] = 0;   // a hole at the town's centre, on the road's line
  paintRoadTiles(town, net, 3, 4);
  assert.equal(town[MID + MID * T], 0, 'the hole inside the footprint is still unpainted');
  // ...and every stamped cell is untouched
  assert.equal(town[(MID + 8) + (MID + 8) * T], 0xff, 'the 1:1 tile law holds');
});
