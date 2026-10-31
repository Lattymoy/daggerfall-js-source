// ROAD-FOLLOW (2026-10-27, the owner's field report, item 6: "Road travel is not following roads properly in overworld
// travel"; bible/06-Systems/Travel-View.md ROAD-FOLLOW) - A ROAD PAST THE BAY IS WALKED AND DRAWN ON ITS CURVES. The
// Overworld's walk and its drawn line ran pixel middle to pixel middle (Basic Roads' bands), and past the Bay the roads are
// painted as VOYAGER2's curves (world/road/roadCurves.js): at every bend the party walked across the inside of it, up to a
// fifth of a pixel off a road two tiles wide - 12 to 17 per cent of a road journey's walk past the Bay off the painted
// road on the freeware, where the plan's own steps were 97 to 100 per cent road. Now a leg that turns on a curve walks the
// curve (systems/travel/roadLine.js), the walk and the drawn line alike; the Bay's straight bands and the ways straight
// through are the middles they were.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { curveThrough, routeCurveAt, roadLineLegs, nativeOfTile, legEnd, nearestOnLine, lineUpTo, drawRouteRuns, drawOwnRun, stepBit } from '../../../src/systems/travel/roadLine.js';
import { planRoute, routeLegs, routeDrawPoints, wayStillToWalk } from '../../../src/systems/travel/travelRoute.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { worldCoordToMapPixel } from '../../../src/formats/mapsFile.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads, arenaRoadByte } from '../../../src/world/arenaRoads.js';
import { curveDistance, CURVE_STEPS } from '../../../src/world/road/roadCurves.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setArenaRoads(null); });
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const STEP = { '1,0': DIR.E, '1,-1': DIR.NE, '1,1': DIR.SE, '-1,0': DIR.W, '-1,-1': DIR.NW, '-1,1': DIR.SW, '0,1': DIR.S, '0,-1': DIR.N };
/** A path through `pts` (each the last one's neighbour) as a layer's map of bytes. */
const pathMap = (pts) => {
  const m = new Map();
  for (let k = 0; k < pts.length; k++) {
    let bits = 0;
    for (const j of [k - 1, k + 1]) if (j >= 0 && j < pts.length) bits |= STEP[`${pts[j][0] - pts[k][0]},${pts[j][1] - pts[k][1]}`];
    m.set(beyondKey(pts[k][0], pts[k][1]), (m.get(beyondKey(pts[k][0], pts[k][1])) ?? 0) | bits);
  }
  return m;
};
const install = (roads, tracks = new Map()) => setArenaRoads({ roads, tracks, join: new Map() });
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
/** A road that turns: east along row y from x0 for 6, north-east 4, east 6, south-east 3, east 4 - every bend a 45-degree
 *  one, past the Bay's east edge where x0 is. */
const bends = (x0, y) => {
  const pts = [];
  let x = x0, yy = y;
  const go = (dx, dy, n) => { for (let s = 0; s < n; s++) { x += dx; yy += dy; pts.push([x, yy]); } };
  pts.push([x, yy]);
  go(1, 0, 6); go(1, -1, 4); go(1, 0, 6); go(1, 1, 3); go(1, 0, 4);
  return pts;
};
/** The painted road's distance from a native point, tiles (its pixel's curves and its eight neighbours'). */
const offRoad = (x, z, kind = 'roads') => {
  const p = worldCoordToMapPixel(x, z), o = mapPixelWorldOrigin(p.x, p.y), tx = (x - o.x) / 256, ty = (z - o.z) / 256;
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const bits = arenaRoadByte(kind, p.x + dx, p.y + dy);
    if (bits) best = Math.min(best, curveDistance(bits, tx - dx * 128, ty + dy * 128));
  }
  return best;
};

test('ROAD-FOLLOW the law: the curve a byte draws through its pixel between the two edges a route crosses, from the one it comes in by - a bend\'s quadratic about the middle (its apex 0.125 of a pixel inside a 45-degree one, 0.177 a right angle\'s); none straight through, none for a pair a junction draws no curve for (mutants: the order unreversed; the straight band taken for a curve; an end\'s run taken for a curve)', () => {
  const c = curveThrough(DIR.W | DIR.NE, DIR.W, DIR.NE);
  assert.equal(c.length, CURVE_STEPS + 1);
  assert.deepEqual(c[0], [0, 64], 'from the west edge\'s middle');
  assert.deepEqual(c[CURVE_STEPS], [128, 128], 'to the north-east corner');
  assert.deepEqual(c[CURVE_STEPS / 2], [64, 80], 'the apex: 16 tiles (0.125 of a pixel) inside the middle');
  assert.deepEqual(curveThrough(DIR.W | DIR.NE, DIR.NE, DIR.W), [...c].reverse(), 'walked the other way: reversed');
  assert.deepEqual(curveThrough(DIR.W | DIR.S, DIR.W, DIR.S)[CURVE_STEPS / 2], [48, 48], 'a right angle\'s apex');
  assert.equal(curveThrough(DIR.W | DIR.E, DIR.W, DIR.E), null, 'straight through: the lane\'s own line');
  assert.equal(curveThrough(DIR.W | DIR.E | DIR.S, DIR.W, DIR.S), null, 'a T\'s stem met square: through the middle, as the painter runs it in');
  assert.ok(curveThrough(DIR.W | DIR.E | DIR.NE, DIR.W, DIR.NE), 'a junction\'s 45-degree merge is its curve');
  assert.deepEqual(nativeOfTile(1100, 100, 64, 80), [1100 * 32768 + 64 * 256, 399 * 32768 + 80 * 256], 'tile row 0 the south edge');
  assert.deepEqual(nativeOfTile(1100, 100, 64, 64), [mapPixelWorldOrigin(1100, 100).x + 16384, mapPixelWorldOrigin(1100, 100).z + 16384], 'the middle the lane\'s');
  assert.equal(stepBit({ x: 5, y: 5 }, { x: 6, y: 4 }), DIR.NE);
  // a route's pixel turns on its curve where the steps in and out are a road's or a track's - PIN MOVED (ROAD-SMOOTH,
  // road_smooth.test.js): a road handing on to a track there walks the curve either paints through both edges
  const route = [{ x: 1099, y: 100 }, { x: 1100, y: 100 }, { x: 1101, y: 99 }], o = { byteAt: () => DIR.W | DIR.NE, past: () => true };
  assert.ok(routeCurveAt(route, ['road', 'road'], 1, o), 'a road\'s bend: its curve');
  assert.ok(routeCurveAt(route, ['track', 'track'], 1, o), 'a track\'s bend: its curve');
  assert.ok(routeCurveAt(route, ['road', 'track'], 1, o), 'a road on to a track, both painted through the bend: its curve');
  assert.equal(routeCurveAt(route, ['open', 'open'], 1, o), null, 'the open ground: no curve');
});

test('ROAD-FOLLOW the legs: past the Bay a leg that turns on a curve ends at its apex, and the leg after walks the curve\'s second half before its run - each with its `line` of the painted road\'s points; the Bay\'s straight bands, a way straight through, a turn from a road onto a track and a layer not installed keep the middles (mutants: the Bay curved; the kinds unread; the second half dropped; the apex not the end)', () => {
  const pts = bends(1100, 100);
  install(pathMap(pts));
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...bay(), pathsBeyond: arenaRoadByte });
  assert.ok(r.kinds.every((k) => k === 'road'), 'the plan is the road\'s');
  const legs = routeLegs(r.pixels, r.kinds);
  assert.deepEqual(legs.map((l) => [l.x, l.y]), [[1106, 100], [1110, 96], [1116, 96], [1119, 99], [1123, 99]], 'one leg a run');
  // the first bend (1106, 100): W in, NE out - the first leg ends at its apex
  const apex = nativeOfTile(1106, 100, 64, 80);
  assert.deepEqual(legs[0].line.at(-1), apex);
  assert.deepEqual(legEnd(legs[0], () => null), { x: apex[0], z: apex[1] });
  // the second leg: the bend's second half from its apex, then on to the next bend's apex (1110, 96): SW in, E out
  assert.deepEqual(legs[1].line[0], nativeOfTile(1106, 100, ...curveThrough(DIR.W | DIR.NE, DIR.W, DIR.NE)[CURVE_STEPS / 2 + 1]));
  assert.deepEqual(legs[1].line.at(-1), nativeOfTile(1110, 96, ...curveThrough(DIR.SW | DIR.E, DIR.SW, DIR.E)[CURVE_STEPS / 2]));
  // the last leg ends at the route's last pixel's middle - the end is the place's
  assert.deepEqual(legs.at(-1).line.at(-1), nativeOfTile(1123, 99, 64, 64));
  // every point of every line on the painted road
  for (const l of legs) for (const [x, z] of l.line) assert.ok(offRoad(x, z) < 0.01, `(${x}, ${z}) on the road: ${offRoad(x, z)}`);
  // the Bay: the same road on the table is Basic Roads' bands - middle to middle
  const net = bay();
  const onTable = bends(100, 100);
  for (const [k, b] of pathMap(onTable)) { const x = (k % 65536) - 32768, y = Math.floor(k / 65536) - 32768; net.roads[y * MAP_W + x] = b; }
  const rb = planRoute({ x: 100, y: 100 }, { x: onTable.at(-1)[0], y: onTable.at(-1)[1] }, { ...net });
  assert.ok(routeLegs(rb.pixels, rb.kinds).every((l) => !l.line), 'on the Bay no line');
  // no layer installed: the middles
  setArenaRoads(null);
  assert.ok(routeLegs(r.pixels, r.kinds).every((l) => !l.line), 'no layer: no curve read');
  // a turn from the road onto a track: the two are painted apart - through the middle
  const roads = pathMap(pts.slice(0, 7)), tracks = pathMap(pts.slice(6));
  install(roads, tracks);
  const kinds = r.kinds.map((_, i) => (i < 6 ? 'road' : 'track'));
  assert.equal(routeCurveAt(r.pixels, kinds, 6), null, 'a road in, a track out');
  assert.ok(routeCurveAt(r.pixels, kinds, 10), 'a track\'s own bend is its curve');
  // the law in place: roadLineLegs with no curve and nothing behind writes nothing
  const plainLegs = [{ x: 1, y: 1, kind: 'road' }];
  assert.equal(roadLineLegs(plainLegs, [1], [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }], ['road', 'road'])[0].line, undefined);
});

/** The real Travel Options over a stub world, as test/systems/travel/audit_owrevisited_walk.test.js stands it. */
function rig() {
  const state = { pos: { x: 0, z: 0 }, pixel: { x: 0, y: 0 } };
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
  });
  return { to, state };
}
/** Walk a journey on the real Travel Options: a body flown `step` world units a frame along each autopilot's drive until
 *  it arrives - the road's distance (tiles) at every frame. */
function walk(legs, summary, step) {
  const { to, state } = rig();
  const o = mapPixelWorldOrigin(legs[0].x, legs[0].y);
  state.pos = { x: o.x + 16384 - 32768, z: o.z + 16384 };   // the middle of the pixel before the first leg's
  assert.equal(to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  const off = [];
  let arrived = false;
  for (let f = 0; f < 20000 && !arrived; f++) {
    const ap = to.state.autopilot;
    if (!ap) break;
    const p = worldCoordToMapPixel(state.pos.x, state.pos.z);
    state.pixel = p;
    const d = ap.update({ worldX: state.pos.x, worldZ: state.pos.z, mapPixelX: p.x, mapPixelY: p.y });
    if (d.arrived) { arrived = !to.route; continue; }
    const r = (d.yaw * Math.PI) / 180;
    state.pos = { x: state.pos.x + Math.sin(r) * step * d.forward, z: state.pos.z + Math.cos(r) * step * d.forward };
    off.push(offRoad(state.pos.x, state.pos.z));
  }
  return { off, arrived, at: state.pos };
}

test('ROAD-FOLLOW the walk: the real Travel Options walks a road past the Bay that bends four times on its painted curves - within a tile of it all the way, at a hundred times walking pace and at walking pace; the old lanes, middle to middle, crossed the inside of every bend 16 tiles off the road (mutants: the line not copied; the lane\'s points unread; the leg\'s end square at the middle)', () => {
  const pts = bends(1100, 100);
  install(pathMap(pts));
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...bay(), pathsBeyond: arenaRoadByte });
  const legs = routeLegs(r.pixels, r.kinds);
  const summary = { pixel: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, name: 'Bendwater', mapId: 7, regionIndex: 1, locationIndex: 1 };
  for (const step of [433, 40]) {
    const w = walk(legs, summary, step);
    assert.ok(w.arrived, `arrived (step ${step})`);
    const along = w.off.slice(Math.ceil(32768 / step));   // from the first leg's pixel on (the walk sets out from the one before)
    const worst = Math.max(...along);
    assert.ok(worst < 1, `on the painted road all the way: ${worst.toFixed(2)} tiles at the worst (step ${step})`);
  }
  // the old law: the same legs without their lines walk middle to middle
  const old = walk(legs.map(({ line, ...l }) => l), summary, 433);
  assert.ok(Math.max(...old.off) > 12, `the defect: ${Math.max(...old.off).toFixed(1)} tiles off at a bend`);
});

test('ROAD-FOLLOW the drawn line: a leg on a curve is drawn through the painted road\'s points (routeDrawPoints\' `via`, one point a leg still), the traveller\'s own run from the points still ahead of the run the walk is on, and the forecast\'s way the same road (mutants: the via dropped; the own run from its first point whatever the walk; the forecast straight)', () => {
  const pts = bends(1100, 100);
  install(pathMap(pts));
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...bay(), pathsBeyond: arenaRoadByte });
  const legs = routeLegs(r.pixels, r.kinds);
  const mid = (l) => { const o = mapPixelWorldOrigin(l.x, l.y); return [o.x + 16384, o.z + 16384]; };
  const me = { x: mid({ x: 1100, y: 100 })[0], z: mid({ x: 1100, y: 100 })[1] };
  const end = { x: mid(legs.at(-1))[0] + 300, z: mid(legs.at(-1))[1] };
  const n = routeDrawPoints(me, legs, end, mid);
  assert.equal(n.length, legs.length + 1, 'one point a leg, and the traveller');
  assert.deepEqual([n[1][0], n[1][1]], legs[0].line.at(-1), 'a curve\'s leg drawn to its apex');
  assert.deepEqual(n[1].via, legs[0].line.slice(0, -1), 'along its first half');
  assert.deepEqual(n[2].via, legs[1].line.slice(0, -1), 'through the painted road\'s points');
  assert.deepEqual(n.at(-1).via, legs.at(-1).line.slice(0, -1), 'the last leg\'s road up to the end');
  const seg = (out) => out;
  const drawn = drawRouteRuns(n, 0, (ax, az, bx, bz, out) => out.push([bx, bz]), []);
  for (const [x, z] of drawn.slice(0, -1)) assert.ok(offRoad(x, z) < 0.01, 'every drawn point on the road');
  const own = drawOwnRun(me, n[2], 5, (ax, az, bx, bz, out) => out.push([bx, bz]), seg([]));
  assert.deepEqual(own, [...n[2].via.slice(5), [n[2][0], n[2][1]]], 'the traveller\'s own run: the points ahead of the run walked');
  const w = wayStillToWalk(me, { legs, i: 0 }, 0, n);
  assert.equal(w.points.length, 1 + n.slice(1).reduce((s, q) => s + 1 + (q.via?.length ?? 0), 0), 'the forecast\'s way through every point');
  // no curve: the old one point a leg, no via
  setArenaRoads(null);
  assert.ok(routeDrawPoints(me, routeLegs(r.pixels, r.kinds), end, mid).every((q) => !q.via));
});

test('ROAD-FOLLOW the walk\'s other doors: a resume knocked off a curve rejoins it at its nearest point, a place\'s last leg after a bend walks the bend\'s second half up to the place, a spot\'s cuts the road at its point nearest the spot (mutants: the rejoin on the chord; the last leg\'s line unread)', () => {
  const near = nearestOnLine([[0, 0], [100, 0], [100, 100]], { x: 130, z: 60 });
  assert.deepEqual([near.x, near.z, near.seg], [100, 60, 1]);
  assert.deepEqual(lineUpTo([[0, 0], [100, 0], [100, 100]], { x: 130, z: 60 }), [[0, 0], [100, 0], [100, 60]]);
  const src = read('src/systems/travel/travelOptions.js');
  assert.match(src, /const near = lane\?\.pts \? nearestOnLine\(lane\.pts, me\) : null;/, 'the resume rejoins the curve it walks');
  assert.match(src, /const road = lane\.pts\n\s*\? place\n\s*\? lane\.pts\n\s*: lineUpTo\(lane\.pts, end\)\n\s*: \[\n\s*\[lane\.ax, lane\.az\],\n\s*\[via\.x, via\.z\],\n\s*\];/, 'the last leg on the road\'s curves');
  assert.match(src, /\.\.\.\(l\.line \? \{ line: l\.line\.map\(\(q\) => \[q\[0\], q\[1\]\]\) \} : \{\}\)/, 'the journey keeps each leg\'s line');
  // and walked: a place two pixels past the last bend - the body up the bend's second half, never across its inside
  const pts = bends(1100, 100).slice(0, 13);
  install(pathMap(pts));
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...bay(), pathsBeyond: arenaRoadByte });
  const legs = routeLegs(r.pixels, r.kinds);
  const w = walk(legs, { pixel: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, name: 'Bendwater', mapId: 7, regionIndex: 1, locationIndex: 1 }, 200);
  assert.ok(w.arrived);
  assert.ok(Math.max(...w.off.slice(200)) < 1, `${Math.max(...w.off.slice(200)).toFixed(2)} tiles at the worst`);
});

test('ROAD-FOLLOW the Bay is the Bay: a route on the table walks Basic Roads\' bands middle to middle - no curve read there (the source: the past test before the byte)', () => {
  const src = read('src/systems/travel/roadLine.js');
  assert.match(src, /if \(!past\(p\.x, p\.y\)\) return null;/);
  assert.ok(inBay(500, 250) && !inBay(1100, 100));
});
