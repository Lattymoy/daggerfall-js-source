// ROAD-SMOOTH (2026-10-28, the owner after the Tamriel update: "Road pathfinding is still very janky"; bible/06-Systems/
// Travel-View.md ROAD-SMOOTH) - A ROAD JOURNEY PAST THE BAY WALKED SMOOTHLY ON ITS CURVES. ROAD-FOLLOW's walk ran each
// curve as 32 short runs, and the lane cut the force at every run's end: on the freeware's roads past the Bay a cut frame
// every 120 m, the heading turned back and forth 6 times a km, the walk turned 44% more than the road and lost 7 to 16% of
// its pace; and it stood a frame at every leg. Now the force is cut and the look stopped only at a corner, a whole frame's
// reach measures the look, the walk is handed from leg to leg, a leg ending inside a curve looks on along the next, and a
// leg's end is no stop.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TravelAutopilot, pathPursuit, rectOf, turnAt, calculateYaw, LANE_CORNER_TURN, LANE_LOOK_STEPS, LANE_CORNER_FORCE_MIN } from '../../../src/systems/travel/travelAutopilot.js';
import { createTravelOptions, readTravelOptionsSettings, LEG_CHAIN_MAX } from '../../../src/systems/travel/travelOptions.js';
import { curveThrough, routeCurveAt, nativeOfTile } from '../../../src/systems/travel/roadLine.js';
import { planRoute, routeLegs } from '../../../src/systems/travel/travelRoute.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { worldCoordToMapPixel } from '../../../src/formats/mapsFile.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads, arenaRoadByte } from '../../../src/world/arenaRoads.js';
import { curveDistance } from '../../../src/world/road/roadCurves.js';

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
/** A road from (x0, y) stepping by the moves in turn - `moves` [dx, dy, n] each. */
const roadOf = (x0, y, moves) => {
  const pts = [[x0, y]];
  let x = x0, yy = y;
  for (const [dx, dy, n] of moves) for (let s = 0; s < n; s++) { x += dx; yy += dy; pts.push([x, yy]); }
  return pts;
};
/** A staircase past the Bay - east, north-east, east, ... - the shape the land's law lays a road at an angle in: every
 *  pixel a bend, every bend a curve (on the freeware 88% of a road's turning pixels past the Bay are). */
const stair = (x0, y, n) => roadOf(x0, y, Array.from({ length: n }, (_, k) => (k % 2 ? [1, -1, 1] : [1, 0, 1])));
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
/** The painted road's distance from a native point, tiles (its pixel's curves and its eight neighbours'). */
const offRoad = (x, z) => {
  const p = worldCoordToMapPixel(x, z), o = mapPixelWorldOrigin(p.x, p.y), tx = (x - o.x) / 256, ty = (z - o.z) / 256;
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    for (const kind of ['roads', 'tracks']) {
      const bits = arenaRoadByte(kind, p.x + dx, p.y + dy);
      if (bits) best = Math.min(best, curveDistance(bits, tx - dx * 128, ty + dy * 128));
    }
  }
  return best;
};
const wrap = (a) => ((a + 540) % 360) - 180;

test('ROAD-SMOOTH the law: a road\'s line point is a corner where it turns LANE_CORNER_TURN (22.5) degrees or more - Basic Roads\' 45 and 90 degree kinks are, a painted curve\'s runs never; its end is one unless the next leg\'s line goes on from it with less, which the aim then looks along; a street\'s every point a corner, as it was (mutants: the turn unread; a curve\'s end a corner whatever follows; the next line taken past a corner)', () => {
  assert.equal(LANE_CORNER_TURN, 22.5);
  assert.equal(LEG_CHAIN_MAX, 8);
  assert.equal(turnAt([0, 0], [1, 0], [2, 0]), 0);
  assert.ok(Math.abs(turnAt([0, 0], [1, 0], [2, 1]) - 45) < 1e-9 && Math.abs(turnAt([0, 0], [1, 0], [1, -1]) - 90) < 1e-9);
  assert.ok(Math.abs(turnAt([0, 0], [1, 0], [0, 1]) - 135) < 1e-9, 'a hairpin');
  assert.ok(Number.isNaN(turnAt([0, 0], [0, 0], [1, 0])), 'a run of no length turns no way');
  // a bend's curve, west edge to north-east corner, and the next pixel's on from that corner
  const tiles = (px, py, c) => c.map(([tx, ty]) => nativeOfTile(px, py, tx, ty));
  const a = tiles(1100, 100, curveThrough(DIR.W | DIR.NE, DIR.W, DIR.NE)), b = tiles(1101, 99, curveThrough(DIR.SW | DIR.E, DIR.SW, DIR.E));
  const end = rectOf(a.at(-1)[0] - 256, a.at(-1)[1] - 256, 512, 512);
  for (let k = 1; k < a.length - 1; k++) assert.ok(turnAt(a[k - 1], a[k], a[k + 1]) < 4, `a curve's runs turn a few degrees (${turnAt(a[k - 1], a[k], a[k + 1])})`);
  const lone = new TravelAutopilot({ x: 1100, y: 100 }, end, 1, { path: a, cornerTurn: LANE_CORNER_TURN });
  assert.deepEqual(lone.corners, [...Array(a.length - 1).fill(0), 1], 'no corner on the curve; its end one with nothing after');
  assert.equal(lone.ahead, null);
  const on = new TravelAutopilot({ x: 1100, y: 100 }, end, 1, { path: a, ahead: b.slice(1), cornerTurn: LANE_CORNER_TURN });
  assert.ok(on.corners.every((c) => c === 0), 'the next pixel\'s curve goes on from its end: no corner');
  assert.deepEqual(on.ahead, b.slice(1), 'and the aim looks along it');
  // a Basic Roads' kink: a corner, the next line not looked along
  const kink = new TravelAutopilot({ x: 0, y: 0 }, rectOf(3990, 3990, 20, 20), 1, { path: [[0, 0], [4000, 0]], ahead: [[8000, 4000]], cornerTurn: LANE_CORNER_TURN });
  assert.deepEqual(kink.corners, [0, 1]);
  assert.equal(kink.ahead, null, 'a 45-degree kink stops the aim');
  // a street's: every point a corner (cornerTurn 0, the default), never a next line
  const street = new TravelAutopilot({ x: 1100, y: 100 }, end, 1, { path: a, ahead: b.slice(1), lookMin: 96, lookMax: 96 });
  assert.ok(street.corners.slice(1).every((c) => c === 1) && street.ahead === null, 'a street\'s line as it was');
});

test('ROAD-SMOOTH the force and the look: a painted curve walked at a hundred times walking pace and at a slow frame\'s step on its whole force every frame, cut at a corner alone; the frame after a corner\'s cut looks three WHOLE frames ahead - the cut step shortened the look and swung the heading back and forth (mutants: every point a corner; the reach the cut step)', () => {
  const tiles = (px, py, c) => c.map(([tx, ty]) => nativeOfTile(px, py, tx, ty));
  const curve = [...tiles(1100, 100, curveThrough(DIR.W | DIR.S, DIR.W, DIR.S)), ...tiles(1100, 101, curveThrough(DIR.N | DIR.E, DIR.N, DIR.E)).slice(1)];
  for (const step of [433, 1300]) {
    const last = curve.at(-1), on = [[last[0] + 32768, last[1]]];   // the road on east past its end
    const ap = new TravelAutopilot({ x: 1100, y: 101 }, rectOf(last[0] - 256, last[1] - 256, 512, 512), 1, { path: curve, ahead: on, cornerTurn: LANE_CORNER_TURN });
    let x = curve[0][0], z = curve[0][1], cut = 0, flips = 0, lastD = 0, prev = null, frames = 0;
    for (; frames < 2000; frames++) {
      const d = ap.update({ worldX: x, worldZ: z, mapPixelX: 1100, mapPixelY: 100 });
      if (d.arrived) break;
      if (d.forward < 1) cut++;
      if (prev != null) { const dy = wrap(d.yaw - prev); if (Math.abs(dy) > 0.01) { if (lastD && Math.sign(dy) !== Math.sign(lastD)) flips++; lastD = dy; } }
      prev = d.yaw;
      const r = (d.yaw * Math.PI) / 180;
      x += Math.sin(r) * step * d.forward; z += Math.cos(r) * step * d.forward;
    }
    assert.ok(frames < 2000, 'walked');
    assert.equal(cut, 0, `step ${step}: no frame cut on the curve`);
    assert.ok(flips <= 1, `step ${step}: the heading turns one way round each bend - ${flips} reversals (a right bend, then a left one)`);
  }
  // a corner: still cut to land on it, and the frame after looks three whole frames ahead
  const path = [[0, 0], [4000, 0], [4000, 4000]];
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(3990, 3990, 20, 20), 1, { path, cornerTurn: LANE_CORNER_TURN });
  ap.update({ worldX: 3000, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  const d = ap.update({ worldX: 3700, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  assert.ok(Math.abs(d.forward - 300 / 700) < 1e-9, `cut to land on the corner (${d.forward})`);
  const after = ap.update({ worldX: 3990, worldZ: 30, mapPixelX: 0, mapPixelY: 0 });   // the cut frame walked: 290 + a hair
  const reach = Math.hypot(290, 30) / (300 / 700), want = calculateYaw(3990, 30, 4000, 30 + LANE_LOOK_STEPS * reach);
  assert.ok(Math.abs(after.yaw - want) < 1e-6, `three whole frames ahead (${after.yaw} against ${want})`);
  assert.ok(LANE_CORNER_FORCE_MIN === 0.25);
});

test('ROAD-SMOOTH a leg that ends inside a curve: the aim looks on through its end along the next leg\'s line, so the heading turns no faster at the leg\'s change than on the curve; at a corner the aim stops at the corner (mutants: the next line unread; the aim stopped at every end)', () => {
  const tiles = (px, py, c) => c.map(([tx, ty]) => nativeOfTile(px, py, tx, ty));
  const whole = [...tiles(1100, 100, curveThrough(DIR.W | DIR.NE, DIR.W, DIR.NE)), ...tiles(1101, 99, curveThrough(DIR.SW | DIR.E, DIR.SW, DIR.E)).slice(1)];
  const apex = 16 + 32, path = whole.slice(0, apex + 1), ahead = whole.slice(apex + 1);   // a leg ending at the second bend's apex
  const me = { x: path[apex - 1][0] + 20, z: path[apex - 1][1] - 40 };   // a run short of the leg's end
  const look = 3000;
  const aim = pathPursuit(me.x, me.z, path, apex - 2, look, ahead), one = pathPursuit(me.x, me.z, whole, apex - 2, look);
  assert.deepEqual([aim.x, aim.z], [one.x, one.z], 'the aim as the whole line\'s: past the leg\'s end');
  assert.equal(aim.end, false);
  const clamped = pathPursuit(me.x, me.z, path, apex - 2, look);
  assert.deepEqual([clamped.x, clamped.z], path.at(-1), 'without the next line: stopped at the end');
  // the autopilot: aimed on along the next leg's line, its force whole up to the end (the frame before a 1000-unit step)
  const ap = new TravelAutopilot({ x: 1101, y: 99 }, rectOf(path.at(-1)[0] - 256, path.at(-1)[1] - 256, 512, 512), 1, { path, ahead, cornerTurn: LANE_CORNER_TURN });
  ap.update({ worldX: me.x - 1000, worldZ: me.z, mapPixelX: 1101, mapPixelY: 99 });
  const d = ap.update({ worldX: me.x, worldZ: me.z, mapPixelX: 1101, mapPixelY: 99 });
  const seen = pathPursuit(me.x, me.z, whole, 0, LANE_LOOK_STEPS * 1000);
  assert.ok(Math.abs(d.yaw - calculateYaw(me.x, me.z, seen.x, seen.z)) < 1e-6, `aimed on along the curve (${d.yaw})`);
  assert.equal(d.forward, 1, 'the force whole up to the leg\'s end');
});

test('ROAD-SMOOTH the walk handed on: a leg begun on the same autopilot, or a new one handed `walk` (a place\'s or a spot\'s last leg), looks three whole frames ahead from its first frame - a new leg\'s first frame looked a path\'s width ahead, a jerk of the heading at every leg (mutants: the walk reset on a new leg; the walk not handed; the last legs not handed it)', () => {
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(99000, -10, 20, 20), 1, { path: [[0, 0], [100000, 0]] });
  ap.update({ worldX: 1000, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  ap.update({ worldX: 1600, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });   // a 600-unit step
  ap.initTargetRect({ x: 0, y: 0 }, rectOf(0, 99000, 20, 20), 1, { path: [[2000, 0], [2000, 100000]] });
  const yaw = ap.update({ worldX: 2200, worldZ: 300, mapPixelX: 0, mapPixelY: 0 }).yaw;   // the next leg: north from (2000, 0)
  const want = calculateYaw(2200, 300, 2000, 300 + LANE_LOOK_STEPS * Math.hypot(600, 300));
  assert.ok(Math.abs(yaw - want) < 1e-6, `the same autopilot: the walk kept (${yaw} against ${want})`);
  const next = new TravelAutopilot({ x: 0, y: 0 }, rectOf(0, 99000, 20, 20), 1, { path: [[2000, 0], [2000, 100000]], walk: ap.walk });
  const yaw2 = next.update({ worldX: 2200, worldZ: 900, mapPixelX: 0, mapPixelY: 0 }).yaw;
  const want2 = calculateYaw(2200, 900, 2000, 900 + LANE_LOOK_STEPS * 600);
  assert.ok(Math.abs(yaw2 - want2) < 1e-6, `a new autopilot handed the walk (${yaw2} against ${want2})`);
  const src = read('src/systems/travel/travelOptions.js');
  assert.equal(src.match(/cornerTurn: LANE_CORNER_TURN, walk: st\.autopilot\?\.walk \}/g)?.length, 2, 'a place\'s and a spot\'s last legs take the walk on');
});

/** The real Travel Options over a stub world, through its own door (update) as the host drives it. */
function rig() {
  const state = { pos: { x: 0, z: 0 }, pixel: { x: 0, y: 0 } };
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ ...bay(), source: 'basic-roads' }),
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
/** A journey to the place at `pts`' last pixel walked through Travel Options' update, a body flown `step` units a frame
 *  along each frame's drive: every frame's force share, heading and distance off the painted road. */
function walk(pts, step) {
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...bay(), pathsBeyond: arenaRoadByte });
  const legs = routeLegs(r.pixels, r.kinds);
  const { to, state } = rig();
  const o = mapPixelWorldOrigin(pts[0][0], pts[0][1]);
  state.pos = { x: o.x + 16384, z: o.z + 16384 };
  const summary = { pixel: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, name: 'Stairfoot', mapId: 9, regionIndex: 1, locationIndex: 1 };
  assert.equal(to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  const frames = [];
  for (let f = 0; f < 40000 && to.route; f++) {
    state.pixel = worldCoordToMapPixel(state.pos.x, state.pos.z);
    const leg = to.route.i;
    const d = to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }).drive;
    if (!d) break;
    if (d.arrived) { frames.push({ stood: true, done: !to.route }); continue; }
    const r2 = (d.yaw * Math.PI) / 180;
    state.pos = { x: state.pos.x + Math.sin(r2) * step * d.forward, z: state.pos.z + Math.cos(r2) * step * d.forward };
    frames.push({ yaw: d.yaw, share: d.forward / to.state.autopilot.speedMultiplier, leg, off: offRoad(state.pos.x, state.pos.z) });
  }
  return { frames, legs, arrived: !to.route };
}
/** How much a line of points turns, degrees, and how long it is, world units. */
const turning = (pts) => {
  let turn = 0, len = 0;
  for (let k = 1; k < pts.length; k++) { len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); if (k > 1) turn += turnAt(pts[k - 2], pts[k - 1], pts[k]) || 0; }
  return { turn, len };
};

test('ROAD-SMOOTH the walk, on the real Travel Options: a staircase road past the Bay walked at a hundred times walking pace and at a slow frame\'s step - the whole force on every frame, no frame stood at a leg\'s end, the heading turning as the painted road turns and no more, on the road all the way; the old walk cut every few frames on the curves, stood at every leg and turned far more than the road (mutants: every point a corner; the reach the cut step; the next line unread; a leg\'s end a stop)', () => {
  const pts = stair(1100, 100, 24);
  setArenaRoads({ roads: pathMap(pts), tracks: new Map(), join: new Map() });
  for (const step of [433, 1300]) {
    const w = walk(pts, step);
    assert.ok(w.arrived, `arrived (step ${step})`);
    const moving = w.frames.filter((f) => !f.stood), along = moving.filter((f) => f.leg >= 1 && f.leg < w.legs.length - 1);
    assert.deepEqual(w.frames.filter((f) => f.stood).map((f) => f.done), [true], `step ${step}: the place's arrival the one frame stood`);
    assert.equal(along.filter((f) => f.share < 1).length, 0, `step ${step}: no frame's force cut on the curves`);
    assert.ok(Math.max(...along.map((f) => f.off)) < 1, `step ${step}: within a tile of the painted road (${Math.max(...along.map((f) => f.off)).toFixed(2)})`);
    let walked = 0;
    for (let k = 1; k < along.length; k++) walked += Math.abs(wrap(along[k].yaw - along[k - 1].yaw));
    const lane = turning(w.legs.slice(1, -1).flatMap((l) => l.line));
    assert.ok(walked < 1.1 * lane.turn, `step ${step}: the walk turns ${walked.toFixed(0)} degrees where the road turns ${lane.turn.toFixed(0)}`);
  }
});

test('ROAD-SMOOTH the Bay\'s corners are corners: a Basic Roads staircase on the table walked middle to middle - the aim never past a 45-degree kink, the force cut to land on one, never more than a road\'s half width off its line, and no frame stood at a leg\'s end (mutants: the corner turn past 45; a leg\'s end a stop)', () => {
  const pts = stair(100, 100, 12);
  const net = bay();
  for (const [k, b] of pathMap(pts)) { const x = (k % 65536) - 32768, y = Math.floor(k / 65536) - 32768; net.roads[y * MAP_W + x] = b; }
  const r = planRoute({ x: pts[0][0], y: pts[0][1] }, { x: pts.at(-1)[0], y: pts.at(-1)[1] }, { ...net });
  const legs = routeLegs(r.pixels, r.kinds);
  assert.ok(legs.every((l) => !l.line), 'the Bay: no curve');
  const { to, state } = rig();
  const o = mapPixelWorldOrigin(pts[0][0], pts[0][1]);
  state.pos = { x: o.x + 16384, z: o.z + 16384 };
  to.beginTravelAlongRoute({ legs, summary: { pixel: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, name: 'Kinkham', mapId: 3, regionIndex: 1, locationIndex: 1 } }, false, { quiet: true });
  const mids = legs.map((l) => { const m = mapPixelWorldOrigin(l.x, l.y); return [m.x + 16384, m.z + 16384]; });
  const lineOff = (x, z) => { let best = Infinity; for (let k = 1; k < mids.length; k++) { const [ax, az] = mids[k - 1], [bx, bz] = mids[k], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return best; };
  let looked = 0, cuts = 0, stood = 0, worst = 0;
  for (let f = 0; f < 20000 && to.route; f++) {
    state.pixel = worldCoordToMapPixel(state.pos.x, state.pos.z);
    const leg = to.route.i, d = to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }).drive;
    if (d.arrived) { if (to.route) stood++; continue; }
    if (d.forward < 1) cuts++;
    if (to.state.autopilot?.ahead) looked++;
    const rr = (d.yaw * Math.PI) / 180;
    state.pos = { x: state.pos.x + Math.sin(rr) * 433 * d.forward, z: state.pos.z + Math.cos(rr) * 433 * d.forward };
    if (leg >= 1) worst = Math.max(worst, lineOff(state.pos.x, state.pos.z));
  }
  assert.ok(!to.route, 'arrived');
  assert.equal(stood, 0, 'no leg\'s end a frame stood');
  assert.equal(looked, 0, 'the aim never looks past a kink');
  assert.ok(cuts > 0, `the force cut to land on a kink (${cuts} frames)`);
  assert.ok(worst < 256, `within a road's half width of its line (${Math.round(worst)})`);
});

test('ROAD-SMOOTH a road onto a track (or back) where one of them is painted through both edges: walked on that curve - it was walked through the middle, off both (on the freeware 78 of 153 such pixels past the Bay, up to 24 tiles off); neither painted through both, the middle as ever; nor onto the open ground (mutants: the other kind unasked; the kinds\' step out unread)', () => {
  const route = [{ x: 1099, y: 100 }, { x: 1100, y: 100 }, { x: 1101, y: 99 }];
  const both = (kind) => (kind === 'tracks' ? DIR.W | DIR.NE : DIR.W | DIR.E);   // the road runs on east; the track bends north-east
  const o = { byteAt: (kind) => both(kind), past: () => true };
  const c = routeCurveAt(route, ['road', 'track'], 1, o);
  assert.deepEqual(c, curveThrough(DIR.W | DIR.NE, DIR.W, DIR.NE).map(([tx, ty]) => nativeOfTile(1100, 100, tx, ty)), 'the track\'s curve');
  assert.ok(routeCurveAt(route, ['track', 'road'], 1, o), 'a track onto a road: the same');
  // a road's crossroads paints no right-angle turn from its west arm to its north; a track bending there does
  const north = [{ x: 1099, y: 100 }, { x: 1100, y: 100 }, { x: 1100, y: 99 }];
  const cross = { byteAt: (kind) => (kind === 'tracks' ? DIR.W | DIR.N : DIR.W | DIR.E | DIR.N | DIR.S), past: () => true };
  assert.deepEqual(routeCurveAt(north, ['road', 'road'], 1, cross), curveThrough(DIR.W | DIR.N, DIR.W, DIR.N).map(([tx, ty]) => nativeOfTile(1100, 100, tx, ty)), 'the road\'s way round, the track\'s curve');
  assert.equal(routeCurveAt(route, ['road', 'track'], 1, { byteAt: (kind) => (kind === 'tracks' ? DIR.NE | DIR.E : DIR.W | DIR.E), past: () => true }), null, 'neither through both: the middle');
  assert.equal(routeCurveAt(route, ['road', 'open'], 1, o), null, 'off onto the field: no curve');
  assert.equal(routeCurveAt(route, ['open', 'track'], 1, o), null, 'on from the field: no curve');
});
