// TV2 (2026-09-28, bible/06-Systems/Travel-View.md, Mac: "Even adding the option to tap/click to move to a specific
// location"; his calls: "Both, by target" - a town or a marker by the roads, open ground straight there - and "Cap it
// to what loads cleanly").
//
// Pinned here: the click's ground (player/travelPick.js - the march and its bisection over a table of hills), the
// road planner (systems/travelRoute.js - A* over Hazelnut's compass bytes, a road only where both ends carry the
// edge, the sea refused, the legs folded), the load governor (systems/travelGovernor.js - halved while the view shows
// unbuilt ground, back up a step once it is clean, never under walking pace), the port's own two journeys in Travel
// Options (beginTravelToPoint / beginTravelAlongRoute - the mod's autopilot, legs and stops, and an arrival SAID under
// the view), the view's marks and route projected through the frame, the readout's route line, and the world host's
// wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundHit, canvasPoint, classifyPick, TV_PICK_MAX } from '../src/player/travelPick.js';
import { planRoute, routeLegs, roadShare, edgeKind, ROUTE_COST, OPPOSITE_BIT, openStepBlocked, joinPoint, routeDrawPoints, TV_MOUNTAIN_CLIMATE, TV_STEEP_RISE, routeGround, ROUTE_MARGINS } from '../src/systems/travelRoute.js';
import { createLoadGovernor, viewReach, unbuiltAround, stepDown, TV_GOV_HOLD_S, TV_GOV_CLEAR_S, TV_GOV_STEP, TV_GOV_SETTLE_S } from '../src/systems/travelGovernor.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin, MID_LO, P_SIZE } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';
import { DIR, DIR_DELTA } from '../src/world/roadNetwork.js';
import { createTravelView, TRAVEL_VIEW_TEXT, travelTripLine } from '../src/scenes/travelView.js';
import { routePath } from '../src/ui/travelViewHud.js';
import { forwardOf, TV_RISE_S } from '../src/player/travelCamera.js';
import { TRAVEL_HELD_TEXT } from '../src/ui/enhancedTravelControl.js';   // AUDIT DEEP X-6

// PIN MOVED (AUDIT OW5 G2): the Overworld's own lines are said through tvSay - held at the scale they are said at
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const norm = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };

// ── THE CLICK'S GROUND ──────────────────────────────────────────────────────────────────────────────────────────────

test('TV2 pick: the ray from the raised eye meets flat ground where the geometry says, to well under a centimetre; the sky meets nothing', () => {
  const eye = [0, 300, 0];
  const dir = norm([0, -1, 1]);   // 45 degrees down, due north
  const hit = groundHit(eye, dir, () => 0);
  assert.ok(hit.point, 'a hit');
  assert.ok(near(hit.point[1], 0), 'on the ground');
  assert.ok(Math.abs(hit.point[2] - 300) < 0.01, `300 m out (${hit.point[2]})`);
  assert.ok(Math.abs(hit.point[0]) < 1e-9);
  assert.equal(hit.unbuilt, false);
  assert.ok(near(hit.dist, 300 * Math.SQRT2, 0.01));
  const sky = groundHit(eye, norm([0, 0.2, 1]), () => 0);
  assert.equal(sky.point, null, 'the sky');
  assert.equal(sky.dist, Infinity);
  assert.equal(groundHit(null, dir, () => 0).point, null, 'no eye, no hit');
  assert.equal(TV_PICK_MAX, 6000, 'the lens\'s far plane');
});

test('TV2 pick: a ridge in front of the flat ground takes the ray first; the march does not step over a thin one; unbuilt ground is crossed and said', () => {
  const eye = [0, 300, 0];
  const dir = norm([0, -1, 2]);   // would land at z = 600 on the flat
  // a ridge 50 m high and 6 m thick at z 400..406 - the ray passes it at y ~100, so it misses; raise it to 120
  const ridge = (hgt) => (x, z) => (z >= 400 && z <= 406 ? hgt : 0);
  assert.ok(Math.abs(groundHit(eye, dir, ridge(50)).point[2] - 600) < 0.01, 'under the ray: the flat');
  const onRidge = groundHit(eye, dir, ridge(120)).point;
  assert.ok(onRidge[2] >= 400 && onRidge[2] <= 406, `a 6 m ridge stops it (${onRidge[2]})`);
  assert.ok(near(onRidge[1], 120), 'standing on the ridge\'s top');
  // unbuilt ground between: -Infinity for z < 100 (the grid not raised there yet), flat beyond
  const holes = (x, z) => (z < 100 ? -Infinity : 0);
  const h = groundHit([0, 300, -200], norm([0, -1, 1.5]), holes);
  assert.ok(h.point && h.unbuilt, 'hit the built ground past the hole, and said it crossed one');
  const allHoles = groundHit(eye, dir, () => -Infinity);
  assert.equal(allHoles.point, null);
  assert.equal(allHoles.unbuilt, true, 'nothing built under the ray at all: "beyond what you can see"');
});

test('TV2 pick: the event\'s viewport point is the canvas\'s own; what was clicked decides the journey (a place, the ground, the water, beyond sight, nothing)', () => {
  assert.deepEqual(canvasPoint(410, 230, { left: 10, top: 30 }), [400, 200]);
  assert.deepEqual(canvasPoint(5, 6, null), [5, 6]);
  const hit = { point: [1, 2, 3], unbuilt: false };
  assert.equal(classifyPick({ hit, place: { name: 'Daggerfall' } }).kind, 'place');
  assert.equal(classifyPick({ hit, place: { name: 'Daggerfall' }, water: true }).kind, 'place', 'a harbour town is a town');
  assert.equal(classifyPick({ hit, water: true }).kind, 'water');
  assert.equal(classifyPick({ hit }).kind, 'ground');
  assert.equal(classifyPick({ hit: { point: null, unbuilt: true } }).kind, 'far');
  assert.equal(classifyPick({ hit: { point: null, unbuilt: false } }).kind, 'none');
  assert.equal(classifyPick({ hit: null }).kind, 'none');
});

// ── THE ROAD PLANNER ────────────────────────────────────────────────────────────────────────────────────────────────

const W = 24, H = 12;
const grid = () => ({ roads: new Uint8Array(W * H), tracks: new Uint8Array(W * H) });
/** Lay a road (both ends' bits) along a list of cells. */
function lay(arr, cells) {
  for (let i = 1; i < cells.length; i++) {
    const [ax, ay] = cells[i - 1], [bx, by] = cells[i];
    const [bit] = DIR_DELTA.find(([, dx, dy]) => dx === bx - ax && dy === by - ay);
    arr[ay * W + ax] |= bit;
    arr[by * W + bx] |= OPPOSITE_BIT[bit];
  }
}
const row = (y, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]);

test('TV2 route: a step is ON the road only when both ends carry the edge - two roads side by side are not one road; the compass is roadNetwork\'s', () => {
  const g = grid();
  lay(g.roads, row(5, 2, 6));
  const a = 5 * W + 3, b = 5 * W + 4;
  assert.equal(edgeKind(a, b, DIR.E, g.roads, g.tracks), 'road');
  assert.equal(edgeKind(b, a, DIR.W, g.roads, g.tracks), 'road', 'both ways');
  g.roads[6 * W + 3] = DIR.E; g.roads[6 * W + 4] = 0;   // a half edge: A leaves toward B, B does not answer
  assert.equal(edgeKind(6 * W + 3, 6 * W + 4, DIR.E, g.roads, g.tracks), 'open');
  lay(g.tracks, row(8, 2, 4));
  assert.equal(edgeKind(8 * W + 2, 8 * W + 3, DIR.E, g.roads, g.tracks), 'track');
  for (const [bit] of DIR_DELTA) assert.equal(OPPOSITE_BIT[OPPOSITE_BIT[bit]], bit, 'the edge back of the edge back');
  assert.deepEqual(ROUTE_COST, { road: 1, track: 1.6, open: 3.5 });
});

test('TV2 route: along a road the route IS the road; round a hill it takes the road\'s long way when that is cheaper than the open; a short hop across a field stays across the field', () => {
  const g = grid();
  lay(g.roads, row(5, 1, 20));
  const along = planRoute({ x: 1, y: 5 }, { x: 20, y: 5 }, { ...g, width: W, height: H });
  assert.equal(along.pixels.length, 20);
  assert.ok(along.kinds.every((k) => k === 'road'));
  assert.ok(near(along.cost, 19));
  // a U-shaped road: 2..14 on row 2, down col 14 to row 8, back along row 8 - from (2,2) to (2,8)
  const u = grid();
  lay(u.roads, [...row(2, 2, 14), ...Array.from({ length: 6 }, (_, i) => [14, 3 + i]), ...row(8, 2, 14).reverse().slice(1)]);
  const around = planRoute({ x: 2, y: 2 }, { x: 2, y: 8 }, { ...u, width: W, height: H });
  assert.ok(around.kinds.includes('open'), 'six pixels across the field (21 open) beat thirty on the road');
  assert.ok(around.cost <= 6 * ROUTE_COST.open + 1e-9);
  // ...but a long way round is taken when the field is wide
  const v = grid();
  lay(v.roads, [...row(2, 2, 4), [5, 3], [6, 4], [7, 5], [8, 6], [9, 7], ...row(8, 10, 12)]);
  const diag = planRoute({ x: 2, y: 2 }, { x: 12, y: 8 }, { ...v, width: W, height: H });
  assert.ok(diag.kinds.every((k) => k === 'road'), 'the road the whole way');
  assert.equal(roadShare(diag.kinds), 1);
  assert.equal(roadShare([]), 0);
  assert.equal(roadShare(['road', 'open']), 0.5);
});

test('AUDIT DEEP2 B-6 route: a road just past the first search box beats open ground inside it - the box widens until no route outside it could be cheaper', () => {
  const g = grid();
  const col = (x, y0, y1) => Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i]);
  lay(g.roads, [...col(2, 2, 10), ...row(10, 3, 14), ...col(14, 2, 9).reverse()]);   // down, along row 10, back up: 28 on the road
  const from = { x: 2, y: 2 }, to = { x: 14, y: 2 };
  const boxed = planRoute(from, to, { ...g, width: W, height: H, margins: [6] });
  assert.ok(near(boxed.cost, 12 * ROUTE_COST.open), `inside the first box (rows 0-8) the best is twelve open steps (${boxed.cost})`);
  const r = planRoute(from, to, { ...g, width: W, height: H });
  assert.ok(near(r.cost, 28), `the road round by row 10, outside it, is found (${r.cost})`);
  assert.ok(r.kinds.every((k) => k === 'road'));
  // a route that no path out of the first box could beat is kept there - no second search for the short hop on a road
  const h = grid();
  lay(h.roads, row(4, 4, 8));
  const asked = (margins) => { let n = 0; planRoute({ x: 4, y: 4 }, { x: 8, y: 4 }, { ...h, width: W, height: H, margins, isWater: () => { n++; return false; } }); return n; };
  assert.equal(asked([2, 60]), asked([2]), 'four on the road costs 4, under the 6 any way out of a two-pixel box would');
});

test('TV2 route: the sea is refused - the route goes round by the land bridge, or there is none; the two ends may stand on it; the same pixel is a route of one', () => {
  const g = grid();
  const wall = (x, y) => x === 10 && y !== 11;   // a channel down column 10, crossable only at y 11
  const r = planRoute({ x: 5, y: 3 }, { x: 15, y: 3 }, { ...g, width: W, height: H, isWater: wall });
  assert.ok(r, 'a route');
  assert.ok(r.pixels.some((p) => p.x === 10 && p.y === 11), 'by the bridge');
  assert.ok(!r.pixels.some((p) => wall(p.x, p.y)), 'and never through the water');
  assert.equal(planRoute({ x: 5, y: 3 }, { x: 15, y: 3 }, { ...g, width: W, height: H, isWater: (x) => x === 10 }), null, 'no bridge: no route');
  const toSea = planRoute({ x: 5, y: 3 }, { x: 10, y: 3 }, { ...g, width: W, height: H, isWater: (x) => x === 10 });
  assert.ok(toSea, 'a harbour town on its water pixel is still reached');
  const one = planRoute({ x: 4, y: 4 }, { x: 4, y: 4 }, { ...g, width: W, height: H });
  assert.deepEqual(one.pixels, [{ x: 4, y: 4 }]);
  assert.equal(planRoute(null, { x: 1, y: 1 }), null);
});

test('TV2 route: the legs fold a straight run on one kind of ground into its last pixel - the autopilot aims down the road, not at every pixel\'s middle', () => {
  const px = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 2], [6, 2]].map(([x, y]) => ({ x, y }));
  assert.deepEqual(routeLegs(px, ['road', 'road', 'road', 'road', 'road', 'road']), [
    { x: 3, y: 0, kind: 'road' }, { x: 5, y: 2, kind: 'road' }, { x: 6, y: 2, kind: 'road' },
  ]);
  assert.deepEqual(routeLegs(px.slice(0, 4), ['road', 'open', 'open']), [{ x: 1, y: 0, kind: 'road' }, { x: 3, y: 0, kind: 'open' }], 'a change of ground is a new leg');
  assert.deepEqual(routeLegs([{ x: 0, y: 0 }]), []);
});

// ── THE LOAD GOVERNOR ───────────────────────────────────────────────────────────────────────────────────────────────

test('TV2 cap: the clock runs as asked while the view is clean; unbuilt ground for TV_GOV_HOLD_S halves it (to the spinner\'s step), again and again down to walking pace', () => {
  const gov = createLoadGovernor({ max: 100 });
  assert.equal(gov.step(0.1, { unbuilt: 0, requested: 40 }), 40);
  assert.equal(gov.step(TV_GOV_HOLD_S / 2, { unbuilt: 3, requested: 40 }), 40, 'a glimpse of a hole is not yet a hole');
  assert.equal(gov.step(TV_GOV_HOLD_S / 2, { unbuilt: 3, requested: 40 }), 20, 'halved');
  // AUDIT DEEP2 B-2: the NEXT cut waits TV_GOV_SETTLE_S - the rate just cut needs time to show in the build
  assert.equal(TV_GOV_SETTLE_S, 2);
  assert.equal(gov.step(TV_GOV_SETTLE_S - 0.01, { unbuilt: 3, requested: 40 }), 20, 'not again at once');
  assert.equal(gov.step(0.01, { unbuilt: 3, requested: 40 }), 10, 'the hole stayed: halved again');
  assert.equal(gov.step(TV_GOV_SETTLE_S, { unbuilt: 3, requested: 40 }), 5);
  assert.equal(gov.step(TV_GOV_SETTLE_S, { unbuilt: 3, requested: 40 }), 1, 'five halved is under a step: walking pace');
  assert.equal(gov.step(TV_GOV_SETTLE_S, { unbuilt: 3, requested: 40 }), 1, 'never under it');
  // a climb makes the next hole an ordinary one again
  for (let k = 0; k < Math.ceil(TV_GOV_CLEAR_S / 0.02) + 1; k++) gov.step(0.02, { unbuilt: 0, requested: 40 });
  assert.equal(gov.ceiling, 5);
  assert.equal(gov.step(TV_GOV_HOLD_S, { unbuilt: 3, requested: 40 }), 1, 'after a climb, a hole for TV_GOV_HOLD_S cuts');
  // AUDIT DEEP T2-2/T2-8: walking pace teaches nothing, and the climb goes up the spinner's own steps
  {
    const g = createLoadGovernor({ max: 100 });
    for (let i = 0; i < 40; i++) g.step(0.05, { unbuilt: 3, requested: 1 });
    assert.equal(g.ceiling, 100, 'x1 under streaming lag: the ceiling is not lowered');
    assert.equal(g.step(0.02, { unbuilt: 0, requested: 40 }), 40, 'the next journey asks x40 and gets it');
    for (let i = 0; i < 200; i++) g.step(0.05, { unbuilt: 3, requested: 40 });
    assert.equal(g.ceiling, 1, 'at speed it still halves down to walking pace - a cut every settle, not every quarter second');
    const seen = [];
    for (let i = 0; i < 3; i++) { for (let k = 0; k < 201; k++) g.step(0.02, { unbuilt: 0, requested: 40 }); seen.push(g.ceiling); }
    assert.deepEqual(seen, [5, 10, 15], 'up by the spinner\'s fives');
  }
  assert.equal(stepDown(37), 35);
  assert.equal(stepDown(2.5), 1);
  assert.equal(stepDown(0), 1);
  assert.equal(gov.step(0.1, { unbuilt: 0, requested: 0 }), 1, 'a spinner at nothing is walking pace');
});

test('TV2 cap: clean for TV_GOV_CLEAR_S and the ceiling climbs a step, up to the top and never past what the player asked; reset forgets', () => {
  const gov = createLoadGovernor({ max: 30 });
  gov.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 20 });
  assert.equal(gov.ceiling, 10);
  assert.equal(gov.step(TV_GOV_CLEAR_S - 0.01, { unbuilt: 0, requested: 20 }), 10, 'not clean long enough');
  assert.equal(gov.step(0.02, { unbuilt: 0, requested: 20 }), 10 + TV_GOV_STEP);
  gov.step(TV_GOV_CLEAR_S, { unbuilt: 0, requested: 20 });
  assert.equal(gov.step(0, { unbuilt: 0, requested: 20 }), 20, 'up to the spinner');
  for (let i = 0; i < 5; i++) gov.step(TV_GOV_CLEAR_S, { unbuilt: 0, requested: 20 });
  assert.equal(gov.ceiling, 30, 'the ceiling to its top');
  assert.equal(gov.step(0, { unbuilt: 0, requested: 20 }), 20, 'and the clock still the spinner\'s');
  gov.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 20 });
  assert.equal(gov.ceiling, 10);
  gov.reset();
  assert.equal(gov.ceiling, 30);
  // a hole mid-climb restarts the clean clock
  const g2 = createLoadGovernor({ max: 100 });
  g2.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 40 });
  g2.step(TV_GOV_CLEAR_S - 1, { unbuilt: 0, requested: 40 });
  g2.step(0.01, { unbuilt: 1, requested: 40 });
  assert.equal(g2.step(1.5, { unbuilt: 0, requested: 40 }), 20, 'the clean clock began again after the hole');
});

test('TV2 cap: the view\'s reach is where the top of the picture meets the ground; above the horizon it is the grid\'s; the count is the square\'s unbuilt pixels', () => {
  const deg = (d) => (d * Math.PI) / 180;
  const r = viewReach({ height: 300, pitch: deg(-52), fovY: deg(60) });
  assert.ok(near(r, 300 / Math.tan(deg(22)), 1e-6));
  assert.ok(near(viewReach({ height: 300, pitch: deg(-52), fovY: deg(60), back: 100 }), 300 / Math.tan(deg(22)) - 100, 1e-6));
  assert.equal(viewReach({ height: 300, pitch: deg(-30), fovY: deg(60), far: 5000 }), 5000, 'the top edge at the horizon');
  const built = new Set(['5,5', '4,5', '6,5']);
  assert.equal(unbuiltAround({ x: 5, y: 5 }, 1, (x, y) => built.has(`${x},${y}`)), 6);
  assert.equal(unbuiltAround({ x: 5, y: 5 }, 0, (x, y) => built.has(`${x},${y}`)), 0);
});

// ── THE JOURNEYS ────────────────────────────────────────────────────────────────────────────────────────────────────

function travelRig(over = {}) {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 }, climate: 231, enemies: false, location: null };
  const said = [], boxed = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => state.location, hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => state.climate,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => state.enemies, diseaseCount: () => 0,
    say: (l) => said.push(l), messageBox: (l) => boxed.push(l),
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null,
    pushWindow: (w) => { w.show(); },   // the world host's own: the panel is shown, not stacked
    ...over,
  });
  const go = (px, py, dx, dz) => { state.pixel = { x: px, y: py }; state.pos = at(px, py, dx, dz); return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  return { to, state, said, boxed, ui, at, go };
}

test('TV2 journey: a spot on open ground - the mod\'s autopilot aimed at one path\'s width about the point, the panel up, and the arrival SAID (a box would bring the view down)', () => {
  const r = travelRig();
  const spot = r.at(501, 250, 9000, 20000);
  assert.equal(r.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot }, false, { quiet: true, name: TRAVEL_VIEW_TEXT.spot }), true);
  const ap = r.to.state.autopilot;
  assert.ok(ap, 'the autopilot drives');
  assert.deepEqual(ap.destinationWorldRect, rectOf(spot.x - P_SIZE / 2, spot.z - P_SIZE / 2, P_SIZE, P_SIZE));
  assert.deepEqual(ap.destinationMapPixel, { x: 501, y: 250 });
  assert.equal(r.ui.isShowing, true, 'the Travel Options panel rides along');
  assert.equal(r.to.destinationName, null, 'a spot is not a named journey - as the mod\'s own coordinate journey is not');
  assert.equal(r.ui.destinationName, TRAVEL_VIEW_TEXT.spot);
  assert.ok(r.to.route, 'the view\'s own');
  const d = r.go(500, 250);
  assert.equal(d.drive.arrived, false);
  assert.ok(d.drive.forward > 0);
  r.go(501, 250, 9000, 20000);
  r.go(501, 250, 9000, 20000);
  assert.deepEqual(r.said, [TRAVEL_OPTIONS_TEXT.MsgArrived], 'said');
  assert.deepEqual(r.boxed, [], 'never boxed');
  assert.equal(r.to.state.autopilot, null);
  assert.equal(r.to.route, null, 'and the route is over');
  // without `quiet` the arrival is the mod's own box
  const b = travelRig();
  b.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot });
  b.go(501, 250, 9000, 20000); b.go(501, 250, 9000, 20000);
  assert.deepEqual(b.boxed, [TRAVEL_OPTIONS_TEXT.MsgArrived]);
  // AUDIT DEEP X-7: `quiet` asked AT the arrival - begun from the view, arrived after the player came down: the box
  const c = travelRig();
  let up = true;
  c.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot }, false, { quiet: () => up });
  up = false;
  c.go(501, 250, 9000, 20000); c.go(501, 250, 9000, 20000);
  assert.deepEqual([c.said, c.boxed], [[], [TRAVEL_OPTIONS_TEXT.MsgArrived]], 'the view came down on the way: the mod\'s own box');
});

test('TV2 journey: by the roads - each leg a pixel\'s middle, the SAME autopilot re-aimed leg after leg (BeginPathTravel\'s InitTargetRect), the last leg the place itself with the arrival buffer; a named journey to the mod', () => {
  const r = travelRig();
  const summary = { pixel: { x: 503, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'track' }, { x: 503, y: 250, kind: 'road' }];
  assert.equal(r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  assert.equal(r.to.destinationName, 'Ripwych', 'named: LocationPause and the resume prompt know it');
  assert.equal(r.ui.destinationName, 'Ripwych');
  const first = r.to.state.autopilot;
  const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return rectOf(o.x + MID_LO, o.z + MID_LO, P_SIZE, P_SIZE); };
  assert.deepEqual(first.destinationWorldRect, mid(501, 250));
  assert.equal(first.speedMultiplier, r.to.settings.recklessTravelMultiplier, 'a road leg: reckless');
  r.go(500, 250);
  r.go(501, 250); r.go(501, 250);   // into the leg's pixel, at its middle
  assert.equal(r.to.state.autopilot, first, 'the same autopilot');
  assert.equal(r.to.route.i, 1);
  assert.deepEqual(first.destinationWorldRect, mid(502, 250), 're-aimed at the next middle');
  assert.equal(first.speedMultiplier, r.to.settings.cautiousTravelMultiplier, 'a track leg: cautious');
  r.go(502, 250); r.go(502, 250);
  const last = r.to.state.autopilot;
  assert.notEqual(last, first, 'the place\'s own leg');
  assert.equal(last.isLocation, true);
  const o = mapPixelWorldOrigin(503, 250);
  assert.equal(last.destinationWorldRect.xMin, o.x + 16000 - 800, 'grown by ARRIVAL_BUFFER, as the mod\'s location journey');
  r.go(503, 250, 16300, 16300); r.go(503, 250, 16300, 16300);
  assert.deepEqual(r.said, [TRAVEL_OPTIONS_TEXT.MsgArrived]);
  assert.equal(r.to.destinationName, null);
  assert.equal(r.to.route, null);
});

test('AUDIT DEEP T2-4/T2-5/T2-6/T2-7/T2-8: the planner never swims a corner of the sea; the plates are the LOADED character\'s; the panel counts to the place, not the bend; Hazelnut\'s roads or none; a spot only where the mod allows coordinates', () => {
  // T2-5: water on x + y = 11 - the only way from (3,3) to (8,8) through the corner (5,6)|(6,5) is a swim
  const W = 20, H = 20;
  const sea = (x, y) => x + y === 11;
  const p = planRoute({ x: 3, y: 3 }, { x: 8, y: 8 }, { isWater: sea, width: W, height: H });
  const cut = [];
  if (p) for (let i = 1; i < p.pixels.length; i++) {
    const a = p.pixels[i - 1], b = p.pixels[i];
    if (a.x !== b.x && a.y !== b.y && sea(b.x, a.y) && sea(a.x, b.y)) cut.push([a, b]);
  }
  assert.deepEqual(cut, [], 'no diagonal between two water pixels');
  assert.equal(p, null, 'a solid diagonal coast is a wall - there is no way across by land');
  // a coast road's own diagonal (ONE side water) stays walkable
  const coast = (x, y) => x === 6 && y === 5;
  const q = planRoute({ x: 5, y: 5 }, { x: 6, y: 6 }, { isWater: coast, width: W, height: H });
  assert.deepEqual(q.pixels, [{ x: 5, y: 5 }, { x: 6, y: 6 }], 'one wet side: the diagonal is dry land');
  const w = rd('src/scenes/world.js');
  // PIN MOVED (AUDIT OW5 D1): the find's own list is emptied beside the plates'
  assert.match(w, /tvPlates = \{ at: null, list: \[\] \};   \/\/ AUDIT DEEP T2-4[^\n]*\n\s*tvFar = \{ at: null, near: -1, list: \[\] \};[^\n]*\n\s*(tvDng = \{ at: null, dg: -1, list: \[\] \};[^\n]*\n\s*tvFind = \{ at: null, dg: -1, n: -1, list: \[\] \};[^\n]*\n\s*)?(tvBandSeen = [^\n]*\n\s*)?travelView\?\.exit\('load', true\);/, 'a load empties the plates');
  assert.ok(((i, j) => i >= 0 && j >= 0 && i < j)(w.indexOf('let tvPlates = { at: null, list: [] };'), w.indexOf('tvPlates = { at: null, list: [] };   // AUDIT DEEP T2-4')), 'BOOT-TDZ: declared above the load that clears it');
  assert.match(w, /to: travelOptions\?\.route\?\.summary\?\.pixel \?\? travelOptions\?\.route\?\.point\?\.pixel \?\? travelOptions\?\.state\?\.autopilot\?\.destinationMapPixel \?\? null,/);
  // PIN MOVED (OW-PATH): the roads asked only in the Roads mode - the net is the road net or none, Free walking across country
  assert.match(w, /const raw = terrainGen\.roads\(\);\n\s*const roadNet = raw\?\.source === 'basic-roads' \? raw : null;\n(?:\s*\/\/[^\n]*\n)*\s*let net = \(roads \|\| travelPathUsesRoads\(\)\) \? roadNet : null;\n\s*let plan = planRoute\(from, summary\.pixel,/);   // PIN MOVED (AUDIT OW5 S3): a let - a plan that never sails is planned again on land
  assert.match(w, /if \(travelOptions\?\.settings\?\.targetCoordsAllowed === false\) tvSay\(TRAVEL_VIEW_TEXT\.placesOnly\); else travelViewWalkTo\(hit\.point, pix\);/);
});

test('AUDIT DEEP T2-1: a road journey RESUMES on the leg it was aiming at, or a later one the traveller has come nearer to over DRY ground - never straight across the bay the road goes round', () => {
  const water = (x) => x === 505;   // a sound down the 505th column
  const r = travelRig({ isWater: (x) => water(x) });
  const summary = { pixel: { x: 507, y: 252 }, name: 'Ripwych', mapId: 42 };
  const legs = [[503, 256], [505, 258], [506, 257], [506, 253], [507, 252]].map(([x, y]) => ({ x, y, kind: 'road' }));
  r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true });
  r.to.interruptTravel();
  r.state.pixel = { x: 503, y: 252 };
  r.to.resumeTravel();
  assert.equal(r.to.route.i, 0, 'the leg across the water is nearer, and refused - the road round it goes on');
  // standing on the leg it aimed at: the next
  r.to.interruptTravel();
  r.state.pixel = { x: 503, y: 256 };
  r.to.resumeTravel();
  assert.equal(r.to.route.i, 1);
  // over dry ground a nearer later leg is still taken (a traveller who walked on by hand)
  const d = travelRig({ isWater: () => false });
  d.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true });
  d.to.interruptTravel();
  d.state.pixel = { x: 503, y: 252 };
  d.to.resumeTravel();
  assert.equal(d.to.route.i, 3, 'no sea: the nearest leg ahead');
  assert.match(rd('src/scenes/world.js'), /isWater: \(x, y\) => x < 0 \|\| y < 0 \|\| x >= 1000 \|\| y >= 500 \|\| woods\.getHeightMapValue\(x, y\) <= WATER_BYTE,/);
});

test('TV2 journey: the mod\'s stops still stop it (a foe near: boxed); interrupted, it RESUMES on its road from the nearest leg ahead; a journey of the mod\'s replaces it', () => {
  const r = travelRig();
  const summary = { pixel: { x: 505, y: 250 }, name: 'Ripwych', mapId: 42 };
  const legs = [501, 502, 503, 504, 505].map((x) => ({ x, y: 250, kind: 'road' }));
  r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true });
  r.state.enemies = true;
  r.go(500, 250);
  assert.deepEqual(r.boxed, [TRAVEL_OPTIONS_TEXT.MsgEnemies], 'the mod\'s own refusal, its own box');
  r.state.enemies = false;
  r.to.interruptTravel();
  assert.equal(r.to.state.autopilot, null);
  assert.ok(r.to.route, 'the route outlives the interruption');
  r.state.pixel = { x: 503, y: 251 }; r.state.pos = r.at(503, 251);   // AUDIT OW3 J3: where they stand is asked too (the rejoin) - the pixel's own middle
  r.to.resumeTravel();
  assert.equal(r.to.route.i, 2, 'the nearest leg ahead of where they stand now');
  assert.equal(r.to.route.join, null, 'the road\'s nearest point is the leg\'s own end: no rejoin, the leg itself');
  const o = mapPixelWorldOrigin(503, 250);
  assert.equal(r.to.state.autopilot.destinationWorldRect.xMin, o.x + MID_LO);
  r.to.beginTravel({ pixel: { x: 520, y: 250 }, name: 'Daggerfall', mapId: 7 });
  assert.equal(r.to.route, null, 'the mod\'s journey replaces the view\'s');
  r.to.clearTravelDestination();
  assert.equal(r.to.beginTravelAlongRoute({ legs: [] }), false, 'no end, no journey');
});

test('TV2 journey (AUDIT TV A3/A4): a view journey is not a ring walk - the ring\'s path-crossing watch is off; a SPOT\'s journey, stopped, is over (nothing resumes a journey with no name) while a place\'s route stays for the resume', () => {
  const r = travelRig();
  r.to.state.circumnavigatePathsDataPt = 40; r.to.state.lastCrossed = 8;   // a ring walk was running
  r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }], summary: { pixel: { x: 502, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  assert.equal(r.to.state.circumnavigatePathsDataPt, 0, 'its watch would stop this journey at the first pixel middle');
  assert.equal(r.to.state.lastCrossed, 0);
  r.to.interruptTravel();
  assert.ok(r.to.route, 'a place: kept for the map\'s resume prompt');
  const spot = r.at(501, 250, 9000, 20000);
  r.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot }, false, { quiet: true });
  r.to.interruptTravel();
  assert.equal(r.to.route, null, 'a spot: over - its mark and line go with it');
});

// ── THE VIEW'S MARKS AND ROUTE ──────────────────────────────────────────────────────────────────────────────────────

function viewRig(over = {}) {
  const log = { picks: [], marked: [], last: null, hooks: null };
  const win = { addEventListener() {}, removeEventListener() {} };
  const tv = createTravelView({
    canvas: {}, win,
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => ({ x: 100 + p[0], y: 100 - p[2], front: p[2] >= 0 }),
    onPick: (x, y) => log.picks.push([x, y]), onMark: (k) => log.marked.push(k),
    marks: () => [{ key: 'place:1', at: [10, 0, 20], label: 'Ripwych', kind: 'place', pick: true }, { key: 'behind', at: [0, 0, -5], label: '' }],
    route: () => [[0, 0, 0], [0, 0, 10], [0, 0, -3]],
    trip: () => 'To Ripwych, by the road',
    hud: { show: (h) => { log.hooks = h; }, hide: () => {}, update: (f) => { log.last = f; } },
    schedule: () => null, cancel: () => {},
    ...over,
  });
  return { tv, log };
}

test('TV2 view: the marks and the route are WORLD points the view projects through the frame; the trip rides along; a plate takes a click only while the view is up', () => {
  // PERF-TV: the plates are DRAWN - a click on one reaches the view as a click, and the readout says what is under it
  const L = [];
  const win = { addEventListener(t, fn) { L.push([t, fn]); }, removeEventListener(t, fn) { const i = L.findIndex(([a, b]) => a === t && b === fn); if (i >= 0) L.splice(i, 1); } };
  const fire = (t, e) => { for (const [a, fn] of [...L]) if (a === t) fn({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e }); };
  const canvas = {};
  const seen = {};
  const { tv, log } = viewRig({ win, canvas, hud: { show() {}, hide() {}, update: (f) => { seen.last = f; }, pickAt: (x, y) => (Math.abs(x - 110) < 5 && Math.abs(y - 80) < 5 ? 'place:1' : null) } });
  const click = (x, y) => { fire('pointerdown', { target: canvas, pointerId: 1, clientX: x, clientY: y, button: 0 }); fire('pointerup', { target: canvas, pointerId: 1, clientX: x, clientY: y, button: 0 }); };
  tv.enter();
  click(110, 80);
  assert.deepEqual([log.marked, log.picks], [[], []], 'rising: no journeys from a camera still on its way up');
  for (let i = 0; i < 90; i++) tv.frame(TV_RISE_S / 60);
  assert.equal(tv.state, 'up');
  tv.drawHud();
  log.last = seen.last;
  const m = log.last.marks;
  assert.deepEqual(m[0], { key: 'place:1', x: 110, y: 80, front: true, label: 'Ripwych', sub: undefined, kind: 'place', pick: true, edge: false, badge: null });   // TV3: `edge` rides along; TV5: and `sub`; AUDIT NAMES N2-1: and a player's badge (none on a place)
  assert.equal(m[1].front, false, 'behind the eye: hidden, not drawn at the origin');
  assert.deepEqual(log.last.route.map((p) => p.front), [true, true, false]);
  assert.equal(log.last.trip, 'To Ripwych, by the road');
  click(110, 80);
  assert.deepEqual([log.marked, log.picks], [['place:1'], []], 'a click on the plate is its journey, never the ground\'s pick');
  click(300, 300);
  assert.deepEqual(log.picks, [[300, 300]], 'beside it, the ground');
});

test('TV2 readout: the route line moves to its first point, lines through the rest, and breaks where a point falls behind the eye', () => {
  assert.equal(routePath([{ x: 1.4, y: 2.6, front: true }, { x: 10, y: 20, front: true }, { x: 5, y: 5, front: false }, { x: 30, y: 40, front: true }, { x: 31, y: 41, front: true }]),
    'M1 3 L10 20 M30 40 L31 41');
  assert.equal(routePath([]), '');
  assert.equal(routePath([null, { x: NaN, y: 1, front: true }, { x: 2, y: 2, front: true }]), 'M2 2');
  assert.equal(travelTripLine({ name: 'Ripwych', share: 0.8 }), 'To Ripwych, by the road');
  assert.equal(travelTripLine({ name: 'Ripwych', share: 0.2 }), 'To Ripwych, across country');
  assert.equal(travelTripLine({ spot: true }), 'To the marked spot');
  assert.match(TRAVEL_HELD_TEXT(20, 40), /×20 of ×40/);   // AUDIT DEEP X-6: shown, on the held rate's title (it lived unshown in the view's own table)
  // PIN MOVED (AUDIT OW5 G1): the words say WHY - the load, or AUDIT OW4 J5's walk on the ground until the view rises
  assert.equal(TRAVEL_HELD_TEXT(20, 40), 'Held to ×20 of ×40 while the land loads');
  assert.equal(TRAVEL_HELD_TEXT(1, 20, 'ground'), 'Held to ×1 of ×20 until the Overworld rises');
  assert.match(rd('src/ui/enhancedTravelControl.js'), /const why = held != null \? TRAVEL_HELD_TEXT\(held, accel, state\.heldWhy\) : '';\n\s*if \(parts\.accel && last\.accelTitle !== why\) \{ last\.accelTitle = why; parts\.accel\.title = why; \}/);   // RATE-LAW: every hold said, the enemies' too (ENEMY-PACE's stepper is gone)
});

// ── THE WORLD HOST'S WIRING ─────────────────────────────────────────────────────────────────────────────────────────

test('TV2 host wiring: the click is a ray from the VIEW\'s eye through this frame, met with the built ground; a known place under it (its rect grown) is reached by the roads, the ground walked to, the water and the unseen refused', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const \[sx, sy\] = canvasPoint\(clientX, clientY, canvas\.getBoundingClientRect\(\)\);/, 'the canvas\'s own pixels (tapRay reads them)');
  assert.match(w, /rayDirFromScreen\(sx, sy, canvas\.clientWidth, canvas\.clientHeight, _lastProj, _lastView, travelView\.eye, worldViewportRect\(/, 'from the eye the frame was drawn from');
  assert.match(w, /const hit = groundHit\(travelView\.eye, dir, \(x, z\) => heightAt\(x, z\)\);/);
  assert.match(w, /if \(!row \|\| !travelCheckDiscovered\(row\)\) return null;/, 'an undiscovered place has no name to go to - DFU\'s own law, the travel map\'s');
  assert.match(w, /const TV_PLACE_GROW = 6144;/);
  assert.match(w, /woods\.getHeightMapValue\(px, py\) <= WATER_BYTE/, 'the water: roadsProducer\'s own byte law');
  assert.match(w, /if \(what\.kind === 'place'\) travelViewRouteTo\(what\.place\);\n\s*else if \(what\.kind === 'ground'\) \{ if \(travelOptions\?\.settings\?\.targetCoordsAllowed === false\) tvSay\(TRAVEL_VIEW_TEXT\.placesOnly\); else travelViewWalkTo\(hit\.point, pix\); \}[^\n]*\n\s*else if \(what\.kind === 'water'\) \{ if \(travelOptions\?\.settings\?\.targetCoordsAllowed === false\) tvSay\(TRAVEL_VIEW_TEXT\.placesOnly\); else travelViewWalkTo\(hit\.point, pix, \{ water: true \}\); \}[^\n]*\n\s*else if \(what\.kind === 'far'\) tvSay\(TRAVEL_VIEW_TEXT\.far\);/);
  assert.match(w, /if \(!travelOptions\) \{ tvSay\(TRAVEL_VIEW_TEXT\.noJourneys\); return false; \}/, 'no Travel Options, no journeys - said');
  assert.match(w, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\)\) \{ tvSay\(TRAVEL_VIEW_TEXT\.enemies\); return false; \}/);
  // AUDIT OW3 J8: the pins name what stands - the peaks' law and the road's join - so reverting either reddens here
  assert.match(w, /planRoute\(from, summary\.pixel, \{ roads: net\?\.roads \?\? null, tracks: net\?\.tracks \?\? null, \.\.\.tvRouteGround\(\), sea: tvSeaAsk\(means, 'land'\) \}\);   \/\/ OW-MOUNTAINS/, 'Hazelnut\'s bytes, whichever source raised them - never across the peaks (AUDIT OW4 J3: the ground read once), and the boat to cross the water in (OWS2)');
  assert.match(w, /const legs = tvJoinedLegs\(from, plan, roads\);\n\s*const ok = travelOptions\.beginTravelAlongRoute\(\{ legs, summary, name: summary\.name \}, tvCautious\(\), \{ quiet: tvQuiet \}\);/, 'OW-ROADSIDE: the road joined first');
  // AUDIT DEEP T2-3/X-7: the player's own cautious choice (the map's last toggles), and quiet only while the view is up
  assert.match(w, /const tvCautious = \(\) => !!travelMapPopUpState\(\)\.speedCautious;\n\s*const tvQuiet = \(\) => !!travelView\?\.active;/);
  // AUDIT TV A1: the line's points are one a LEG, so the leg index cuts it where the traveller is
  assert.match(w, /tvTrip\.natives = routeDrawPoints\(state\.worldCoords\(player\.pos\), legs, \{ x: rect\.cx, z: rect\.cz \}, tvLegMid\);/);   // AUDIT OW3 J4: through the one law
  assert.match(w, /const tvLegMid = \(p\) => \{ const o = mapPixelToWorldCoords\(p\.x, p\.y\); return \[o\.x \+ 16384, o\.z \+ 16384\]; \};/, 'a leg\'s pixel middle');
  assert.match(w, /const start = Math\.min\(n\.length - 1, from \+ 1\);/);
  assert.match(w, /leg\(me\.x, me\.z, n\[start\]\[0\], n\[start\]\[1\], pts\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*const gen = tvGroundGenNow\(\), kept = tvTrip\._tail;\n\s*let tail = kept && kept\.gen === gen && kept\.start === start && kept\.n === n \? kept\.pts : null;/, 'PERF-TV: the legs past the traveller\'s own kept while the ground and the leg hold');
  // AUDIT TV A5: a town's grown rect asked across the 3x3 about the hit
  assert.match(w, /for \(let dy = -1; dy <= 1; dy\+\+\) \{\n\s*for \(let dx = -1; dx <= 1; dx\+\+\) \{\n\s*const summary = tvPlaceSummary\(pix\.x \+ dx, pix\.y \+ dy\);/);
  // PIN MOVED (AUDIT OW5 S4): an own-pixel sea spot is given its one sea leg first; AUDIT OW5b D3: the walk carries its door
  assert.match(w, /let legs = tvJoinedLegs\(from, plan, roads\);\n(?:\s*\/\/[^\n]*\n)*\s*if \(!legs\.length && seaAsk\?\.goal === 'sea'\) \{ legs = \[\{ x: pix\.x, y: pix\.y, kind: 'sea' \}\]; plan = \{ \.\.\.plan, kinds: \['sea'\] \}; \}\n(\s*if \(door\) n = [^\n]*\n)?\s*const ok = travelOptions\.beginTravelAlongRoute\(\{ legs, point: \{ pixel: pix, x: n\.x, z: n\.z, door \}, name: TRAVEL_VIEW_TEXT\.spot \}, tvCautious\(\), \{ quiet: tvQuiet \}\)/);
  for (const dep of [/onPick: \(x, y, e\) => onTravelViewPick\(x, y, e\),/, /onMark: \(key, e\) => onTravelViewMark\(key, e\),/, /marks: travelViewMarks,/, /route: travelViewRoute,/, /trip: \(\) => \(tvWalking \? TRAVEL_VIEW_TEXT\.travelling\(tvWalking, tvHeld\) : tvTripLive\(\) \? tvTrip\.line : ''\),/]) assert.match(w, dep);   // PIN MOVED (AUDIT OW5 G3): the keys' speed first
});

test('TV2 host wiring: THE CAP - governed before the frame reads the travel scale, only while the view is up over a running journey, over the pixels the view can reach; handed back whole when either ends; the panel told', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /travelViewGovern\(dt\);[^\n]*\n\s*const travelScale = worldTimeScale\(\);/, 'this frame\'s scale is the governed one');
  assert.match(w, /const journey = !!travelControlUI\?\.isShowing && !!travelOptions\?\.state\?\.autopilot;/);
  // PIN MOVED (AUDIT OW5 G1; OW6): the hold and its reason let go together, and the enemies' line with them
  assert.match(w, /if \(tvHeld != null\) \{ tvHeld = null; if \(journey\) setWorldTimeScale\(travelAsked\); \}\n\s*tvHeldWhy = null; journeySlowSaid\(null\);[^\n]*\n\s*if \(tvWalking\) \{[^\n]*\n\s*travelGovernor\.reset\(\);/, 'the mod\'s own ask back (PIN MOVED, TV-WASD: the keys\' travel let go beside it - test/tv_wasd.test.js)');
  // OW6: the classic skin's journey (and First-Person Travel's) is the mod's own ask under the enemies' cap alone - nothing near,
  // the ask handed back whole, never over the helm's own time step; under the view the lower of the ground's cap and the enemies'
  assert.match(w, /const rate = csaHoldsTimeScale\(\) \? null : foePaced\(foes\.cap, travelAsked\);\n\s*if \(rate != null && worldTimeScale\(\) !== rate\) setWorldTimeScale\(rate\);\n\s*tvHeld = rate != null && rate < travelAsked \? rate : null;/, 'the mod\'s own ask back');
  assert.match(w, /const load = travelGovernor\.step\(dt, \{ unbuilt, requested: want \}\);\n\s*const foeCap = foePaced\(foes\.cap, want\);[^\n]*\n\s*const rate = Math\.min\(load, foeCap\);/);
  // AUDIT TV A2: the ASK is the mod's - its ground's rate (RATE-LAW; it was the spinner) and its own caps (the ring walk's
  // x15, an interrupt's x1), recorded where the mod sets the clock - so the governor never lifts a journey past the mod's
  assert.doesNotMatch(w, /onTimeAccelerationChanged/, 'RATE-LAW: no spinner to tell the host');
  assert.match(w, /setTimeScale: \(n\) => \{ const held = worldTimeScale\(\) < travelAsked; travelAsked = n; if \(!held \|\| n < worldTimeScale\(\)\) setWorldTimeScale\(n\); \},/, 'AUDIT-D3: the ask recorded, a hold never lifted by it');
  assert.match(w, /const want = journey \? travelAsked : walk;/);   // PIN MOVED (TV-WASD): a journey's ask, else the keys' travel
  assert.equal((w.match(/if \(!ok\) return false;\n(?:\s*partyWalkBegin\([^\n]*\n)?\s*travelGovernor\.reset\(\);   \/\/ AUDIT DEEP T2-8/g) ?? []).length, 2, 'a new click\'s journey forgets the old ceiling - the road\'s and the spot\'s');
  assert.match(w, /const radius = Math\.max\(1, grid - 1\);/, 'never its outermost ring, queued anew at every crossing and fogged (AUDIT DEEP T2-2) - and every ring inside it, always (AUDIT DEEP2 B-2: the early warning)');
  assert.match(w, /if \(uc\.gen !== gen \|\| uc\.x !== px\.x \|\| uc\.y !== px\.y \|\| uc\.r !== radius\) \{\n\s*uc\.n = unbuiltAround\(px, radius, \(x, y\) => x < 0 \|\| y < 0 \|\| x >= 1000 \|\| y >= 500 \|\| built\.has\(`\$\{x\},\$\{y\}`\)\);/);
  assert.match(w, /held: tvHeld,/, 'the travel panel says the clock is held');
  const panel = rd('src/ui/enhancedTravelControl.js');
  assert.match(panel, /put\(parts\.accel, 'accel', held != null \? `×\$\{held\} \/ ×\$\{accel\}` : `×\$\{accel\}`\);/);   // RATE-LAW: every hold shown, the enemies' too
  assert.match(rd('src/ui/enhancedPlusStyle.js'), /\.travelpanel-accel\.held \{/);
  assert.match(rd('src/ui/enhancedStyle.js'), /\.travelpanel-accel\.held \{/);
});

test('OW-MOUNTAINS (Mac: "You shouldnt be able to navigate mountains"): an open step into the Mountain climate or up or down a steep rise is refused - the route goes round; a road over the pass is still walked; only the traveller\'s OWN peaks are left freely (AUDIT OW4 J1: the start\'s connected range, `peakAt`), and the step onto the goal is exempt only for a place (AUDIT OW3 J5)', () => {
  assert.equal(TV_MOUNTAIN_CLIMATE, 226);
  assert.equal(TV_STEEP_RISE, 16);
  const climate = (x, y) => (x === 10 && y >= 2 && y <= 8 ? TV_MOUNTAIN_CLIMATE : 231);
  const flat = () => 20;
  assert.equal(openStepBlocked(climate, flat, 9, 5, 10, 5), true, 'into the range');
  assert.equal(openStepBlocked(climate, flat, 9, 1, 10, 1), false, 'round its end');
  const cliff = (x) => (x >= 20 ? 20 + TV_STEEP_RISE + 1 : 20);
  assert.equal(openStepBlocked(() => 231, cliff, 19, 0, 20, 0), true, 'up a cliff');
  assert.equal(openStepBlocked(() => 231, cliff, 20, 0, 19, 0), true, 'or down it');
  assert.equal(openStepBlocked(() => 231, (x) => (x >= 20 ? 20 + TV_STEEP_RISE : 20), 19, 0, 20, 0), false, 'a rise the height of the threshold: walked');
  const W = 30, H = 12;
  const blocked = (ax, ay, bx, by) => openStepBlocked(climate, flat, ax, ay, bx, by);
  const straight = planRoute({ x: 6, y: 5 }, { x: 14, y: 5 }, { width: W, height: H });
  assert.ok(straight.pixels.some((p) => p.x === 10 && p.y === 5), 'without the law: straight over the peaks');
  const round = planRoute({ x: 6, y: 5 }, { x: 14, y: 5 }, { width: W, height: H, openBlocked: blocked });
  assert.ok(round && !round.pixels.some((p) => p.x === 10 && p.y >= 2 && p.y <= 8), 'with it: round the range');
  // a road over the pass: walked (the roads were laid over the passes)
  const roads = new Uint8Array(W * H);
  for (let x = 6; x < 14; x++) { roads[5 * W + x] |= DIR.E; roads[5 * W + x + 1] |= DIR.W; }
  const pass = planRoute({ x: 6, y: 5 }, { x: 14, y: 5 }, { width: W, height: H, roads, openBlocked: blocked });
  assert.deepEqual(pass.pixels.map((p) => p.x), [6, 7, 8, 9, 10, 11, 12, 13, 14], 'the road over the pass');
  assert.ok(pass.kinds.every((k) => k === 'road'));
  // standing among the peaks: the traveller's own range is walked out of (AUDIT OW4 J1: the start's connected peaks,
  // flood-filled by `peakAt` - never "the first step" alone, nor every peak's step); bound for a TOWN among them: the last
  // step is the goal's exemption (a place's; a spot's is asked - AUDIT OW3 J5, below)
  const ring = (x, y) => Math.abs(x - 10) <= 1 && Math.abs(y - 5) <= 1;
  const ringed = (ax, ay, bx, by, leaving) => openStepBlocked((x, y) => (ring(x, y) ? TV_MOUNTAIN_CLIMATE : 231), flat, ax, ay, bx, by, leaving);
  assert.ok(planRoute({ x: 10, y: 5 }, { x: 14, y: 5 }, { width: W, height: H, openBlocked: ringed, peakAt: ring }), 'out of the range, though every step about the start is a peak');
  assert.equal(planRoute({ x: 10, y: 5 }, { x: 14, y: 5 }, { width: W, height: H, openBlocked: ringed }), null, 'told nothing of the start\'s peaks: held in them - no step out of a peak is free by itself');
  assert.ok(planRoute({ x: 7, y: 5 }, { x: 10, y: 5 }, { width: W, height: H, openBlocked: blocked }), 'into a town in it');
});

test('OW-ROADSIDE (Mac: routes "appear traveling alongside" the road): the join is the nearest point of the first run\'s line, clamped to it; a leg with its own point aims the autopilot at that point, and the road after it at the pixels\' middles', () => {
  assert.deepEqual(joinPoint({ x: 50, z: 400 }, { x: 0, z: 0 }, { x: 100, z: 0 }), { x: 50, z: 0 }, 'straight across to the road');
  assert.deepEqual(joinPoint({ x: -80, z: 30 }, { x: 0, z: 0 }, { x: 100, z: 0 }), { x: 0, z: 0 }, 'behind the run\'s start: its start');
  assert.deepEqual(joinPoint({ x: 500, z: 30 }, { x: 0, z: 0 }, { x: 100, z: 0 }), { x: 100, z: 0 }, 'past its end: its end');
  assert.deepEqual(joinPoint({ x: 5, z: 5 }, { x: 7, z: 7 }, { x: 7, z: 7 }), { x: 7, z: 7 }, 'a run of no length: its point');
  const r = travelRig();
  const summary = { pixel: { x: 503, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  const o = mapPixelWorldOrigin(500, 250);
  const join = { x: o.x + 16384 + 3000, z: o.z + 16384 };
  const legs = [{ x: 500, y: 250, kind: 'open', at: join }, { x: 503, y: 250, kind: 'road' }];
  assert.equal(r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  const ap = r.to.state.autopilot;
  assert.deepEqual(ap.destinationWorldRect, rectOf(join.x - P_SIZE / 2, join.z - P_SIZE / 2, P_SIZE, P_SIZE), 'the join first');
  assert.deepEqual(r.to.route.legs[0].at, join, 'kept on the leg');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(!legs\.length \|\| \(plan\.kinds\[0\] !== 'road' && plan\.kinds\[0\] !== 'track'\)\) return legs;/, 'a route that starts on open ground has no road to join');
  assert.match(w, /return \[\{ x: from\.x, y: from\.y, kind: 'open', at: joinPoint\(\{ x: me\.x, z: me\.z \}, c\(from\), legs\[0\]\.at \?\? c\(legs\[0\]\)\) \}, \.\.\.legs\];/);
  // the drawn route joins the road where the walk does (AUDIT OW3 J4: systems/travelRoute.js routeDrawPoints, both journeys)
  assert.deepEqual(routeDrawPoints({ x: 1, z: 2 }, [{ x: 500, y: 250, at: { x: 7, z: 8 } }, { x: 503, y: 250 }, { x: 504, y: 251 }], { x: 90, z: 91 }, (l) => [l.x * 10, l.y * 10]),
    [[1, 2], [7, 8], [5030, 2500], [90, 91]], 'the traveller, the join\'s own point, a pixel\'s middle, the end - never the last leg\'s middle');
});

test('OW-ONLY (Mac: "Remove the ground travel alltogether. Now selecting a location should immediately transition you to the overworld"): a map\'s pick is the Overworld\'s journey, the view rises with any journey, and a view brought down stops it', async () => {
  const lowered = [];
  const tv = createTravelView({
    canvas: {}, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    onLower: (why) => lowered.push(why), hud: { show() {}, hide() {}, update() {} }, schedule: () => null, cancel: () => {},
  });
  tv.enter();
  tv.exit('button');
  assert.deepEqual(lowered, ['button'], 'brought down: the host hears why');
  tv.enter();
  tv.exit('door', true);
  assert.deepEqual(lowered, ['button'], 'cut (a door, a window, a death): not a choice - nothing said');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // PIN MOVED (TO-ROADS): the map's three forks ask whether the trip is ROUTED - the Overworld's, or First-Person Travel's
  // with its roads on (tvRoutesJourneys grows from tvOwnsJourneys; test/fb0929d_toroads.test.js mounts both ways)
  assert.match(w, /if \(tvRoutesJourneys\(\)\) \{\n\s*const why = travelViewAllowed\(\);\n\s*if \(!why\.ok\) \{ if \(why\.why\) tvSay\(why\.why\); return false; \}\n\s*if \(!travelViewCanGo\(\)\) return false;\n\s*if \(!coords\) \{\n\s*const summary = tvPlaceSummary\(pick\.pixel\.x, pick\.pixel\.y\);\n\s*return summary \? travelViewRouteTo\(summary, \{ roads: tvMapForcesRoads\(\) \}\) : false;[^\n]*/, 'the map\'s pick: the Overworld\'s road journey');
  assert.match(w, /function tvRoutesJourneys\(\) \{ return tvOwnsJourneys\(\) \|\| \(/, 'TO-ROADS: every journey the Overworld owns is routed');
  assert.match(w, /const at = tvSceneOf\(o\.x \+ 16384, o\.z \+ 16384, 0\);\n(?:\s*\/\/[^\n]*\n)*\s*if \(tvWater\(pick\.pixel\.x, pick\.pixel\.y\) \|\| at\[1\] <= tvSeaY\(\) \+ TV_SEA_EPS_M\) \{ tvSay\(TRAVEL_VIEW_TEXT\.water\); return false; \}\n\s*return travelViewWalkTo\(at, pick\.pixel, \{ roads: tvMapForcesRoads\(\) \}\);/, 'the map\'s spot: the Overworld\'s walk - AUDIT OW3 J7: never out onto the water, refused in the view\'s own words');
  // PIN MOVED (OW-TOGGLE, AUDIT OW5 T1): First-Person Travel on, the Overworld owns none - read live (test/ow_toggle.test.js mounts it both ways)
  assert.match(w, /function tvOwnsJourneys\(\) \{ return !!travelOptions && !modSetting\(TRAVEL_OPTIONS_VENDOR, 'GeneralOptions\.FirstPersonTravel'\) && isEnhanced\(\) && !!travelView; \}/, 'AUDIT OW3 J2: the Overworld owns the walked trip on the enhanced interface');
  assert.match(w, /if \(opts\?\.playerControlled && beginAcceleratedTravel\(pick, opts, \{ estimateMinutes: computed\?\.minutes \?\? null \}\)\) return;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(opts\?\.playerControlled && tvRoutesJourneys\(\)\) return;\n\s*if \(isOnlinePage\(\) && !opts\?\.travelShip\) \{ townTalk\.say\(ONLINE_LAND_TRAVEL_REFUSAL\); hudFade\.clearFade\(\); \} else fastTravelTo\(pick, opts, computed\);/, 'AUDIT OW3 J2: a walk the Overworld refused never falls through to a paid teleport');   // PIN MOVED (AUDIT TRAVEL-ONLINE T7): and online a trip over land never reaches it
  assert.match(w, /onTravelToCoords: \(pick, opts\) => \{ if \(!beginAcceleratedTravel\(pick, opts, \{ coords: true \}\) && !tvRoutesJourneys\(\)\) townTalk\.say\('You cannot travel there now\.'\); \},/, 'AUDIT OW3 J2: its refusal said once, in its own words');
  // AUDIT OW3 J1: stopped THROUGH the panel (the mod's Camp) - a bare interrupt left it up, the journey "active"
  // PIN MOVED (OW-TOGGLE): and only the Overworld's journey - a first-person one walks on
  assert.match(w, /onLower: \(why\) => \{ if \(\(why === 'button' \|\| why === 'escape' \|\| why === 'key'\) && travelOptions\?\.isTravelActive && tvOwnsJourneys\(\)\) travelOptions\.messages\.pauseTravel\(\); \},/, 'brought down by the player: the journey stops (the map\'s resume takes it up again)');
  // PIN MOVED (OW-TOGGLE): the Overworld's journey alone is raised - the door asks the enhanced interface and the view itself
  assert.match(w, /if \(!tvOwnsJourneys\(\) \|\| travelView\.state !== 'off' \|\| !travelOptions\.isTravelActive \|\| !travelOptions\.state\?\.autopilot\) return;\n\s*if \(gamePaused\(\) \|\| \(modes\?\.modalWindowUp\?\.\(\) \?\? false\) \|\| duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\) \|\| !travelViewAllowed\(\)\.ok\) return;\n\s*travelView\.enter\(\);/, 'any journey raises the view, silently, once nothing forbids it');
  assert.match(w, /tvJourneyUp\(\);   \/\/ OW-ONLY[^\n]*\n\s*const tvHeadEye/, 'every frame, before the view\'s own');
  assert.match(w, /if \(!door && !water && tvRouteGround\(\)\.peakAt\(pix\.x, pix\.y\)\) \{ tvSay\(TRAVEL_VIEW_TEXT\.mountains\); return false; \}/, 'OW-MOUNTAINS: a spot among the peaks refused (AUDIT OW4 D1: a spawn\'s door is a place\'s - tv6_dungeons; OW-WOD-PATH: the ground\'s own peaks - the Mountain climate and a World of Daggerfall massif)');
  assert.match(w, /\.\.\.tvRouteGround\(\), sea: tvSeaAsk\(means, 'land'\) \}\);   \/\/ OW-MOUNTAINS: never across the peaks/, 'a place\'s route round them');
  assert.equal(TRAVEL_VIEW_TEXT.mountains, 'The mountains cannot be crossed on foot.');
});

// ── AUDIT OW3 (2026-09-28): the Overworld round 2's audit - the journey stopped through its panel, the refusal never a
// teleport, the resume rejoining the road, the spot's line its walk, the peaks' law the ground's, and the pins that hold
// them (the grown Morrowind body: test/prbow1_bow.test.js, test/mwhead1_window.test.js, test/eotb_view.test.js) ────────

test('AUDIT OW3 J5 (AUDIT OW4 J1): a Mountain pixel is never ENTERED from outside it (a one-pixel ridge beside the start is not crossed, a cliff out of the start is not climbed), every step out of the TRAVELLER\'S OWN range is walked (a traveller deep in the peaks walks out), and a SPOT on a plateau is refused up its cliff while a place there is still reached', () => {
  const W = 30, H = 12;
  const flat = () => 20;
  // the law itself: out of the traveller's own range (or on through it: `leaving`, planRoute's flood fill) never refused;
  // into the peaks always; AUDIT OW4 J1: from any OTHER peak (one a road led into) the ground's law, steep test and all
  const band = (x) => (x >= 8 && x <= 16 ? TV_MOUNTAIN_CLIMATE : 231);
  assert.equal(openStepBlocked((x) => band(x), flat, 12, 5, 13, 5, true), false, 'peak to peak, in the traveller\'s own range: walked');
  assert.equal(openStepBlocked((x) => band(x), flat, 12, 5, 13, 5), true, 'AUDIT OW4 J1: peak to peak in a range a road led into: refused');
  assert.equal(openStepBlocked((x) => band(x), flat, 16, 5, 17, 5, true), false, 'out of the own range: walked');
  assert.equal(openStepBlocked((x) => band(x), (x) => (x === 17 ? 90 : 20), 16, 5, 17, 5, true), false, 'out of it down a drop: walked (every step in the range is steep)');
  assert.equal(openStepBlocked((x) => band(x), (x) => (x === 17 ? 90 : 20), 16, 5, 17, 5), true, 'AUDIT OW4 J1: down the drop off a range a road led into: the steep test');
  assert.equal(openStepBlocked((x) => band(x), flat, 16, 5, 17, 5), false, '...and gently off it: walked');
  assert.equal(openStepBlocked((x) => band(x), flat, 7, 5, 8, 5), true, 'into it: refused');
  // a one-pixel ridge the height of the map beside the start: the step onto it was the exempt first one
  const ridge = (ax, ay, bx, by) => openStepBlocked((x) => (x === 7 ? TV_MOUNTAIN_CLIMATE : 231), flat, ax, ay, bx, by);
  assert.equal(planRoute({ x: 6, y: 5 }, { x: 12, y: 5 }, { width: W, height: H, openBlocked: ridge }), null, 'the ridge is not crossed on foot');
  const roads = new Uint8Array(W * H);
  for (let x = 6; x < 12; x++) { roads[5 * W + x] |= DIR.E; roads[5 * W + x + 1] |= DIR.W; }
  assert.ok(planRoute({ x: 6, y: 5 }, { x: 12, y: 5 }, { width: W, height: H, roads, openBlocked: ridge }).kinds.every((k) => k === 'road'), 'a road over it is walked');
  // deep in the peaks, no road out: every destination had no way (the first step alone was exempt)
  const deep = (ax, ay, bx, by, leaving) => openStepBlocked((x) => band(x), flat, ax, ay, bx, by, leaving);
  const out = planRoute({ x: 12, y: 5 }, { x: 22, y: 5 }, { width: W, height: H, openBlocked: deep, peakAt: (x) => band(x) === TV_MOUNTAIN_CLIMATE });
  assert.ok(out, 'a traveller among the peaks walks out');
  assert.ok(out.pixels.every((p, i) => i === 0 || band(out.pixels[i - 1].x) === TV_MOUNTAIN_CLIMATE || band(p.x) !== TV_MOUNTAIN_CLIMATE), 'and never back in');
  // a cliff beside the start: routed round it, never up it
  const pillar = (x, y) => (x === 7 && y >= 3 && y <= 7 ? 60 : 20);
  const cliff = (ax, ay, bx, by) => openStepBlocked(() => 231, pillar, ax, ay, bx, by);
  const round = planRoute({ x: 6, y: 5 }, { x: 9, y: 5 }, { width: W, height: H, openBlocked: cliff });
  assert.ok(round && !round.pixels.some((p) => pillar(p.x, p.y) === 60), 'round the cliff, not up it out of the start');
  // a plateau: its pixel 60 over every neighbour (the rise Mac's lag and fall came from)
  const plateau = (x, y) => (x === 15 && y === 5 ? 80 : 20);
  const up = (ax, ay, bx, by) => openStepBlocked(() => 231, plateau, ax, ay, bx, by);
  assert.equal(planRoute({ x: 10, y: 5 }, { x: 15, y: 5 }, { width: W, height: H, openBlocked: up, goalExempt: false }), null, 'a spot on it: no way up');
  assert.ok(planRoute({ x: 10, y: 5 }, { x: 15, y: 5 }, { width: W, height: H, openBlocked: up }), 'a place on it: its own pixel stays exempt');
  const w = rd('src/scenes/world.js');
  // PIN MOVED (AUDIT OW5 S3): a let
  assert.match(w, /let plan = planRoute\(from, pix, \{ roads: wnet\?\.roads \?\? null, tracks: wnet\?\.tracks \?\? null, \.\.\.tvRouteGround\(\), goalExempt: !!door, sea: seaAsk \}\);/, 'the spot\'s journey asks its last step (AUDIT OW3 J8: and the peaks\' law at all)');
  // AUDIT OW4 J3: the law bound to the world's own climate and heightmap, read once (routeGround: its behaviour pinned below)
  assert.match(w, /const tvRouteGround = \(\) => \{ \(_tvRouteGround \?\?= routeGround\(\(x, y\) => maps\.getClimateIndex\(x, y\), \(x, y\) => woods\.getHeightMapValue\(x, y\), WATER_BYTE\)\)\.setRocks\(tvWodRocks\(\)\); return _tvRouteGround; \};/, 'AUDIT OW3 J8: the law bound to the world\'s own climate and heightmap (OW-WOD-PATH: and the World of Daggerfall massifs)');
});

test('AUDIT OW3 J3: a resumed road journey REJOINS the road - from the start pixel the join is made again from where the traveller stands, knocked off the road mid-run it walks back to the run\'s nearest point, the join\'s own pixel aimed; then the leg; open ground has nothing to rejoin', () => {
  const o = mapPixelWorldOrigin(500, 250);
  const mid = (px, py) => { const q = mapPixelWorldOrigin(px, py); return { x: q.x + 16384, z: q.z + 16384 }; };
  const summary = { pixel: { x: 503, y: 253 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  const legs = () => [{ x: 500, y: 250, kind: 'open', at: { x: o.x + 20000, z: o.z + 16384 } }, { x: 503, y: 250, kind: 'road' }, { x: 503, y: 253, kind: 'road' }];
  const spot = (j) => rectOf(j.x - P_SIZE / 2, j.z - P_SIZE / 2, P_SIZE, P_SIZE);
  // 1. stopped in the start pixel, walked on a way by hand: the old skip aimed straight at the run's far end, beside it
  const r = travelRig();
  r.state.pos = r.at(500, 250, 20000, 24000);
  r.to.beginTravelAlongRoute({ legs: legs(), summary }, false, { quiet: true });
  r.to.interruptTravel();
  r.state.pos = r.at(500, 250, 26000, 21000);
  r.to.resumeTravel();
  assert.equal(r.to.route.i, 1, 'the road\'s run taken up');
  assert.deepEqual(r.to.route.join, { x: o.x + 26000, z: o.z + 16384 }, 'joined where the traveller stands NOW');
  assert.deepEqual(r.to.state.autopilot.destinationWorldRect, spot(r.to.route.join), 'the join first');
  assert.deepEqual(r.to.state.autopilot.destinationMapPixel, { x: 500, y: 250 });
  r.go(500, 250, 26000, 16384); r.go(500, 250, 26000, 16384);
  assert.equal(r.to.route.join, null, 'reached: the join is spent');
  assert.equal(r.to.route.i, 1);
  assert.deepEqual(r.to.state.autopilot.destinationWorldRect, spot(mid(503, 250)), 'then down the road to the run\'s end');
  // 1b. knocked out of the start pixel while the join was still ahead: made again, not the old point walked to
  const k = travelRig();
  k.to.beginTravelAlongRoute({ legs: legs(), summary }, false, { quiet: true });
  k.to.interruptTravel();
  k.state.pixel = { x: 500, y: 251 }; k.state.pos = k.at(500, 251, 30000, 20000);
  k.to.resumeTravel();
  assert.equal(k.to.route.i, 1);
  assert.deepEqual(k.to.route.join, { x: o.x + 30000, z: o.z + 16384 });
  // 2. on the road's run, then a fight knocks the traveller a pixel south: back north to the road, never the diagonal
  const f = travelRig();
  f.to.beginTravelAlongRoute({ legs: legs(), summary }, false, { quiet: true });
  f.go(500, 250, 20000, 16384); f.go(500, 250, 20000, 16384);
  assert.equal(f.to.route.i, 1, 'on the road');
  f.to.interruptTravel();
  f.state.pixel = { x: 502, y: 251 }; f.state.pos = f.at(502, 251);
  f.to.resumeTravel();
  assert.equal(f.to.route.i, 1);
  assert.deepEqual(f.to.route.join, mid(502, 250), 'the run\'s nearest point');
  assert.deepEqual(f.to.state.autopilot.destinationMapPixel, { x: 502, y: 250 }, 'aimed in the join\'s own pixel - the autopilot asks for its arrival only there');
  // 3. open ground: no line to keep to
  const g = travelRig();
  g.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'open' }, { x: 505, y: 250, kind: 'open' }], summary: { ...summary, pixel: { x: 505, y: 250 } } }, false, { quiet: true });
  g.go(501, 250); g.go(501, 250);
  assert.equal(g.to.route.i, 1, 'the second open leg, a run behind it');
  g.to.interruptTravel();
  g.state.pixel = { x: 503, y: 251 }; g.state.pos = g.at(503, 251);
  g.to.resumeTravel();
  assert.equal(g.to.route.i, 1);
  assert.equal(g.to.route.join, null, 'across country: straight on - no line to keep to');
  // the view's line goes where the walk does
  assert.match(rd('src/scenes/world.js'), /const j = travelOptions\.route\?\.join;\n\s*if \(j\) \{ leg\(me\.x, me\.z, j\.x, j\.z, pts\); leg\(j\.x, j\.z, n\[start\]\[0\], n\[start\]\[1\], pts\); \}\n\s*else leg\(me\.x, me\.z, n\[start\]\[0\], n\[start\]\[1\], pts\);/);
});

test('AUDIT OW3 J1: a journey is stopped through its PANEL (the mod\'s Camp: pauseTravel) - the panel down, so it reads stopped, the destination kept for the map\'s Resume; a bare interrupt left the panel up and the journey "active"', () => {
  const hold = {};
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => hold.to.interruptTravel() });   // the world host's own wiring: Camp is InterruptTravel
  const r = travelRig({ ui });
  hold.to = r.to;
  const summary = { pixel: { x: 503, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 503, y: 250, kind: 'road' }], summary }, false, { quiet: true });
  assert.equal(r.to.isTravelActive, true);
  r.to.interruptTravel();
  assert.deepEqual([r.to.isTravelActive, !!r.to.state.autopilot], [true, false], 'the bare interrupt: nothing drives, yet the journey reads active - what froze the view');
  r.to.resumeTravel();
  r.to.messages.pauseTravel();
  assert.deepEqual([r.to.isTravelActive, !!r.to.state.autopilot, r.to.destinationName, !!r.to.route], [false, false, 'Ripwych', true], 'through the panel: stopped, and kept for the resume');
  r.to.resumeTravel();
  assert.deepEqual([r.to.isTravelActive, !!r.to.state.autopilot], [true, true], 'the map\'s Resume takes it up again');
});

test('AUDIT OW3 J4: a SPOT\'s drawn route is its walk - one point a leg through the one law (routeDrawPoints), never [traveller, spot] across the bends', () => {
  const legs = [{ x: 500, y: 250, kind: 'open', at: { x: 11, z: 12 } }, { x: 503, y: 250, kind: 'road' }, { x: 503, y: 253, kind: 'road' }];
  const centre = (l) => [l.x * 100, l.y * 100];
  assert.deepEqual(routeDrawPoints({ x: 1, z: 2 }, legs, { x: 7, z: 9 }, centre), [[1, 2], [11, 12], [50300, 25000], [7, 9]], 'the traveller, the join, the road\'s bend, the spot');
  assert.deepEqual(routeDrawPoints({ x: 1, z: 2 }, [], { x: 7, z: 9 }, centre), [[1, 2], [7, 9]], 'a spot in the traveller\'s own pixel: the straight line it is');
  assert.match(rd('src/scenes/world.js'), /tvTrip\.natives = routeDrawPoints\(state\.worldCoords\(player\.pos\), legs, \{ x: n\.x, z: n\.z \}, tvLegMid\);/, 'the spot\'s journey draws its legs');
});


// ── AUDIT OW4 (2026-09-28): the Overworld's journeys audited again - the peaks left freely only from the traveller's own
// range, a spot's journey kept through an avoided band, the far pick gone round and answered cheaply, the map's Resume
// planned again, the ground journey held to walking pace (the grown Morrowind body's lean: test/prbow1_bow.test.js; the
// disease stop through the panel: test/to1_travelOptions.test.js) ─────────────────────────────────────────────────────

test('AUDIT OW4 J1 (Mac: "Bumping into a mountain can cause insane lag ... You shouldnt be able to navigate mountains"): a route that ENTERS a range by a road walks no further in it - no open step from peak to peak, none down its edge past the steep law - while the start\'s OWN connected peaks are still walked out of freely', () => {
  const M = TV_MOUNTAIN_CLIMATE;
  // the audit's probe: a DEAD-END road into the middle of a 21x101 Mountain block, 100 high over a plain of 20
  const BW = 70, BH = 110;
  const inBlock = (x, y) => x >= 20 && x <= 40 && y >= 4 && y <= 104;
  const climate = (x, y) => (inBlock(x, y) ? M : 231), height = (x, y) => (inBlock(x, y) ? 100 : 20);
  const peakAt = (x, y) => climate(x, y) === M;
  const roads = new Uint8Array(BW * BH);
  for (let x = 10; x < 30; x++) { roads[55 * BW + x] |= DIR.E; roads[55 * BW + x + 1] |= DIR.W; }
  const offPeaks = (r) => r.kinds.filter((k, i) => k === 'open' && peakAt(r.pixels[i].x, r.pixels[i].y)).length;
  const from = { x: 10, y: 55 }, to = { x: 55, y: 55 };
  // OW3 J5's law - every step out of ANY peak free: the road in, then across the block on foot and down its far edge
  const ow3 = (ax, ay, bx, by) => (climate(ax, ay) === M ? false : openStepBlocked(climate, height, ax, ay, bx, by));
  const was = planRoute(from, to, { width: BW, height: BH, roads, openBlocked: ow3 });
  assert.ok(offPeaks(was) >= 10, `OW3: ${offPeaks(was)} open steps off the peaks`);
  const law = (ax, ay, bx, by, leaving) => openStepBlocked(climate, height, ax, ay, bx, by, leaving);
  const now = planRoute(from, to, { width: BW, height: BH, roads, openBlocked: law, peakAt });
  assert.ok(now, 'a way round the block (51 pixels out: the whole map\'s rung, AUDIT OW4 J3)');
  assert.equal(offPeaks(now), 0, 'no open step off a peak');
  assert.ok(now.pixels.every((p) => !inBlock(p.x, p.y)), 'never into the block at all - the dead end leads nowhere');
  // THE EDGE: a road up onto a one-pixel ridge (60 over the plain, the map's whole height) that ends on it - OW3 stepped
  // off its far side down a drop of 40; now the steep law holds there (no way on foot), and a gentle side is walked off
  const W2 = 30, H2 = 12, ridge = (x) => (x === 7 ? M : 231);
  const up = new Uint8Array(W2 * H2);
  up[5 * W2 + 6] |= DIR.E; up[5 * W2 + 7] |= DIR.W;
  const onRidge = (h) => (ax, ay, bx, by, leaving) => openStepBlocked(ridge, h, ax, ay, bx, by, leaving);
  const sheer = (x) => (x === 7 ? 60 : 20), gentle = (x) => (x === 7 ? 30 : 20);
  const ow3edge = (ax, ay, bx, by) => (ridge(ax) === M ? false : openStepBlocked(ridge, sheer, ax, ay, bx, by));
  const trip = [{ x: 4, y: 5 }, { x: 10, y: 5 }];
  assert.ok(planRoute(...trip, { width: W2, height: H2, roads: up, openBlocked: ow3edge }), 'OW3: up the road and off the far side');
  assert.equal(planRoute(...trip, { width: W2, height: H2, roads: up, openBlocked: onRidge(sheer), peakAt: (x) => ridge(x) === M }), null, 'now: the drop of 40 refused - no way on foot');
  assert.ok(planRoute(...trip, { width: W2, height: H2, roads: up, openBlocked: onRidge(gentle), peakAt: (x) => ridge(x) === M }), 'a gentle side: walked off it');
  // THE START'S OWN RANGE: walked out of freely; a SECOND range a road leads into from there is not the traveller's
  const two = (x) => (x >= 3 && x <= 5) || (x >= 12 && x <= 14);   // two ranges, the map's whole height
  const twoC = (x) => (two(x) ? M : 231);
  const into = new Uint8Array(W2 * H2);
  for (let x = 8; x < 13; x++) { into[5 * W2 + x] |= DIR.E; into[5 * W2 + x + 1] |= DIR.W; }
  const twoLaw = (ax, ay, bx, by, leaving) => openStepBlocked(twoC, () => 20, ax, ay, bx, by, leaving);
  const twoOpts = { width: W2, height: H2, roads: into, openBlocked: twoLaw, peakAt: (x) => two(x) };
  assert.ok(planRoute({ x: 4, y: 5 }, { x: 9, y: 5 }, twoOpts), 'out of the own range, across the plain');
  assert.equal(planRoute({ x: 4, y: 5 }, { x: 20, y: 5 }, twoOpts), null, 'but not on through the range the road ends in');
  assert.ok(planRoute({ x: 13, y: 5 }, { x: 20, y: 5 }, twoOpts), 'standing in THAT one, it is the traveller\'s own: walked out of');
});

test('AUDIT OW4 J3: the planner\'s ground is READ ONCE (routeGround: the sea, the peaks\' law and the peaks off two byte tables - what the host\'s reads answered); a range wider than the 60-pixel box is gone round (the whole map\'s rung); a pick with no way by land is answered once its first box has none (no wider box searched), and never wrongly', () => {
  // the tables answer as the host's reads did, everywhere
  const W3 = 40, H3 = 20;
  const cl = (x, y) => (x === 20 && y < 17 ? TV_MOUNTAIN_CLIMATE : 223 + ((x * 7 + y * 3) % 9));
  const ht = (x, y) => (x * 3 + y * 7) % 60;
  const gr = routeGround(cl, ht, 3, W3, H3);
  let wrong = 0;
  for (let y = 0; y < H3; y++) {
    for (let x = 0; x < W3; x++) {
      if (gr.isWater(x, y) !== (ht(x, y) <= 3) || gr.peakAt(x, y) !== (cl(x, y) === TV_MOUNTAIN_CLIMATE)) wrong++;
      for (const [, dx, dy] of DIR_DELTA) {
        const bx = x + dx, by = y + dy;
        if (bx < 0 || by < 0 || bx >= W3 || by >= H3) continue;
        if (gr.openBlocked(x, y, bx, by) !== openStepBlocked(cl, ht, x, y, bx, by) || gr.openBlocked(x, y, bx, by, true)) wrong++;
      }
    }
  }
  assert.equal(wrong, 0, 'every pixel and every step as the reads answer it');
  assert.ok(gr.isWater(-1, 0) && gr.isWater(W3, 0) && gr.isWater(0, H3), 'off the map: the sea (the host\'s tvWater)');
  // THE WHOLE MAP'S RUNG: a range 262 pixels long, open past its south end - past every box the old ladder searched
  assert.deepEqual([...ROUTE_MARGINS], [6, 20, 60, 1000], 'the last rung is the whole map');
  const wall = (x, y) => x === 100 && y < 262;
  const wl = (ax, ay, bx, by, leaving) => openStepBlocked((x, y) => (wall(x, y) ? TV_MOUNTAIN_CLIMATE : 231), () => 20, ax, ay, bx, by, leaving);
  assert.equal(planRoute({ x: 90, y: 100 }, { x: 110, y: 100 }, { width: 300, height: 300, openBlocked: wl, margins: [6, 20, 60] }), null, 'the old ladder: "no way by land"');
  const round = planRoute({ x: 90, y: 100 }, { x: 110, y: 100 }, { width: 300, height: 300, openBlocked: wl });
  assert.ok(round && round.pixels.some((p) => p.y >= 262), 'the whole map\'s rung: round its end');
  // a rung the map's edges clamp to the last one's box is that search again: not made
  const asked = (margins) => { let n = 0; planRoute({ x: 2, y: 2 }, { x: 20, y: 9 }, { width: 24, height: 12, margins, isWater: (x) => { n++; return x === 10; } }); return n; };
  assert.equal(asked([1000, 2000, 5000]), asked([1000]), 'the same box, searched once');
  // THE LAND'S PIECES: a Mountain wall the map's height splits it - a pick across it answered at once; a road over it
  // joins the two; bound for a town ON it, or standing on it (the start's own peaks), the search answers
  const PW = 60, PH = 40;
  const g2 = routeGround((x) => (x === 30 ? TV_MOUNTAIN_CLIMATE : 231), () => 20, 3, PW, PH);
  let searched = 0;
  const counted = (x, y) => { searched++; return g2.isWater(x, y); };
  const across = (opts) => { searched = 0; const r = planRoute({ x: 20, y: 20 }, { x: 40, y: 20 }, { width: PW, height: PH, ...g2, isWater: counted, ...opts }); return [r, searched]; };
  const [none, asked1] = across({});
  const [, firstBox] = across({ apart: null, margins: [6] });
  const [, everyBox] = across({ apart: null });
  assert.equal(none, null, 'no way by land');
  assert.equal(asked1, firstBox, 'said once the first box has none - no wider box searched (a pick far across the map searched them all, ~70-380 ms)');
  assert.ok(everyBox > firstBox, 'the ladder without the pieces: every box');
  // a pick the first box routes never folds the pieces: it reads the road bytes no more than the search alone does
  const readsOf = (opts) => {
    let n = 0;
    const net = new Proxy(new Uint8Array(PW * PH), { get: (t, k) => { if (typeof k === 'string' && /^\d+$/.test(k)) n++; return Reflect.get(t, k); } });
    assert.ok(planRoute({ x: 20, y: 20 }, { x: 23, y: 20 }, { width: PW, height: PH, roads: net, ...routeGround(() => 231, () => 20, 3, PW, PH), ...opts }));
    return n;
  };
  assert.equal(readsOf({}), readsOf({ apart: null }), 'routed in the first box: the pieces never folded');
  assert.equal(g2.apart({ x: 20, y: 20 }, { x: 30, y: 20 }), false, 'a town ON the wall: a neighbour on this side (the goal step a place\'s)');
  assert.ok(planRoute({ x: 20, y: 20 }, { x: 30, y: 20 }, { width: PW, height: PH, ...g2 }), '...reached');
  assert.equal(g2.apart({ x: 30, y: 20 }, { x: 40, y: 20 }), false, 'from the wall itself: the traveller\'s own peaks - the search answers');
  assert.ok(planRoute({ x: 30, y: 20 }, { x: 40, y: 20 }, { width: PW, height: PH, ...g2 }), '...and walks off it');
  const pass = new Uint8Array(PW * PH);
  for (let x = 25; x < 35; x++) { pass[20 * PW + x] |= DIR.E; pass[20 * PW + x + 1] |= DIR.W; }
  assert.equal(g2.apart({ x: 20, y: 20 }, { x: 40, y: 20 }, { roads: pass }), false, 'a road over the pass joins the pieces (folded again for its network)');
  assert.ok(planRoute({ x: 20, y: 20 }, { x: 40, y: 20 }, { width: PW, height: PH, roads: pass, ...g2 }), '...and is walked');
  // NEVER A FALSE "NO WAY": on seeded rough ground - a range two pixels thick the map's height, a sound across the east,
  // scattered peaks and cliffs, a few roads in the west - every pick the pieces refuse has no route in an unbounded search
  // of the whole map, a place's or a spot's
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const RW = 36, RH = 24;
  const hs = Array.from({ length: RW * RH }, (_, i) => ((i % RW) > 14 && [16, 17].includes(Math.floor(i / RW)) ? 0 : 5 + Math.floor(rnd() * 30)));
  const cs = Array.from({ length: RW * RH }, (_, i) => ([12, 13].includes(i % RW) || rnd() < 0.1 ? TV_MOUNTAIN_CLIMATE : 231));
  const rr = new Uint8Array(RW * RH);
  for (let k = 0; k < 12; k++) {
    let x = Math.floor(rnd() * RW), y = Math.floor(rnd() * RH);
    const [bit, dx, dy] = DIR_DELTA[Math.floor(rnd() * 8)];
    for (let s = 0; s < 5 && x + dx >= 0 && y + dy >= 0 && x + dx < 11 && y + dy < RH; s++) { rr[y * RW + x] |= bit; x += dx; y += dy; rr[y * RW + x] |= OPPOSITE_BIT[bit]; }
  }
  const g3 = routeGround((x, y) => cs[y * RW + x], (x, y) => hs[y * RW + x], 4, RW, RH);
  let refused = 0, found = 0;
  for (let k = 0; k < 250; k++) {
    const a = { x: Math.floor(rnd() * RW), y: Math.floor(rnd() * RH) }, b = { x: Math.floor(rnd() * RW), y: Math.floor(rnd() * RH) };
    for (const goalExempt of [true, false]) {
      const full = planRoute(a, b, { width: RW, height: RH, roads: rr, ...g3, apart: null, goalExempt, margins: [RW], maxExpansions: Infinity });
      if (full) found++;
      if (!g3.apart(a, b, { roads: rr })) continue;
      refused++;
      assert.equal(full, null, `refused ${a.x},${a.y} -> ${b.x},${b.y} (${goalExempt ? 'a place' : 'a spot'}) has a way`);
    }
  }
  assert.ok(refused > 100 && found > 100, `both answers tried (${refused} refused, ${found} routed)`);
});

test('AUDIT OW4 J2: a band AVOIDED on a SPOT\'s journey (the cautious roll won) walks on to the spot - the same journey, taken up where it stood; the Camp before the roll ended it, and the mod\'s answer for a journey with no name, followPath, made it "Following a road" or "no path"', () => {
  const hold = {};
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => hold.to.interruptTravel() });   // the world host's own: Camp is InterruptTravel
  const r = travelRig({ ui, roll100: () => 1 });
  hold.to = r.to;
  const spot = r.at(503, 250, 9000, 20000);
  const legs = [{ x: 501, y: 250, kind: 'open' }, { x: 502, y: 250, kind: 'road' }, { x: 503, y: 250, kind: 'open' }];
  assert.equal(r.to.beginTravelAlongRoute({ legs, point: { pixel: { x: 503, y: 250 }, ...spot }, name: TRAVEL_VIEW_TEXT.spot }, true, { quiet: true }), true);   // cautious: the roll is made
  const route = r.to.route;
  r.state.enemies = true;
  assert.equal(r.go(500, 250).stopped, 'enemies', 'the band stops it');
  assert.equal(r.to.route, route, 'the SAME journey - its line, its mark, a TV8 walk\'s destination all hold');
  assert.deepEqual([ui.isShowing, !!r.to.state.autopilot], [true, true], 'on its way, the panel up');
  assert.equal(ui.destinationName, TRAVEL_VIEW_TEXT.spot, 'still the spot - never "Following a road"');
  assert.deepEqual(r.to.state.autopilot.destinationMapPixel, { x: 501, y: 250 }, 'aimed at the leg it was walking');
  assert.equal(ui.message, TRAVEL_OPTIONS_TEXT.MsgAvoidSuccess, 'the mod\'s own word');
  assert.deepEqual([r.said, r.boxed], [[], []], 'no "no path", no box');
  // lost, the band's stop is the spot journey's end, as every stop of one is (AUDIT TV A4)
  const l = travelRig({ ui: new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => l.to.interruptTravel() }), roll100: () => 100 });
  l.to.beginTravelAlongRoute({ legs, point: { pixel: { x: 503, y: 250 }, ...spot }, name: TRAVEL_VIEW_TEXT.spot }, true, { quiet: true });
  l.state.enemies = true;
  l.go(500, 250);
  assert.deepEqual([l.to.route, l.to.state.autopilot, l.boxed], [null, null, [TRAVEL_OPTIONS_TEXT.MsgAvoidFail]]);
});

test('AUDIT OW4 J4/J5: the map\'s Resume PLANS the Overworld\'s journey again from where the traveller stands (a place by the roads round the peaks, a spot walked to again), refused in the view\'s words - the mod\'s resume walked straight at the next leg over whatever stood between; and a journey the Overworld owns runs at walking pace while its view is down (an avoided band still standing near: no spinner-rate drive on the ground)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /onResumeTravel: \(\) => \{ travelViewResume\(\); \},/, 'the held map\'s and the classic map\'s Resume');
  // PIN MOVED (AUDIT OW5 J1): the re-plan asks the route, not the switch - First Person Travel's Overworld-planned routes are re-planned too
  assert.match(w, /function travelViewResume\(\) \{\n\s*const r = travelOptions\?\.route;\n\s*if \(!r \|\| !isEnhanced\(\) \|\| !travelView\) \{ travelOptions\?\.resumeTravel\(\); return; \}\n\s*const why = travelViewAllowed\(\);\n\s*if \(!why\.ok\) \{ if \(why\.why\) tvSay\(why\.why\); return; \}\n\s*if \(!travelViewCanGo\(\)\) return;\n\s*const roads = tvMapForcesRoads\(\);[^\n]*\n\s*if \(r\.summary\) travelViewRouteTo\(r\.summary, \{ roads \}\);\n(?:\s*\/\/[^\n]*\n)*\s*else if \(r\.point\) travelViewWalkTo\(tvSceneOf\(r\.point\.x, r\.point\.z, 0\), r\.point\.pixel, \{ door: r\.point\.door \?\? null, roads \}\);\n\s*\}/, 'planned again - the classic skin and the mod\'s own journeys keep the mod\'s resume; a spawn\'s walk resumed is its door again (AUDIT OW4 X2) - the walk\'s OWN door, never the live index\'s (AUDIT OW5b D3)');
  // PIN MOVED (TV-WASD): the keys' travel is let go on the ground too, and the view's gate reads the keys' rate beside the journey
  // PIN MOVED (AUDIT OW5 G1): and the bar told the hold is the ground's, not the load's; OW6: then the enemies' cap on what runs
  assert.match(w, /if \(journey && !travelView\?\.active && tvOwnsJourneys\(\)\) \{\n\s*if \(worldTimeScale\(\) !== 1\) setWorldTimeScale\(1\);\n\s*tvHeld = travelAsked > 1 \? 1 : null;[^\n]*\n\s*tvHeldWhy = tvHeld != null \? 'ground' : null;[^\n]*\n\s*tvWalking = 0;[^\n]*\n\s*travelGovernor\.reset\(\);\n\s*return;\n\s*\}\n\s*const walk = travelWalkRate\(\{[\s\S]{0,900}?\}\);\n(?:\s*\/\/[^\n]*\n)*\s*const foes = journey \|\| walk \? journeyThreatCap\(!!travelView\?\.active, !journey\) : null;\n\s*if \(journey && !travelView\?\.active\) \{/, 'held at x1 until the view rises - then the governor has it');   // PIN MOVED (AUDIT OW5 G4): the keys' read grew by the focus's law
  // what the resume re-plans past: the mod's resume aims the next leg from wherever the traveller stands, asking nothing
  const r = travelRig();
  const summary = { pixel: { x: 510, y: 250 }, name: 'Ripwych', mapId: 42 };
  r.to.beginTravelAlongRoute({ legs: [{ x: 505, y: 245, kind: 'open' }, { x: 510, y: 250, kind: 'open' }], summary }, false, { quiet: true });
  r.to.interruptTravel();
  r.state.pixel = { x: 500, y: 246 }; r.state.pos = r.at(500, 246);   // walked off by hand, a range between (the host's to know)
  r.to.resumeTravel();
  assert.deepEqual(r.to.state.autopilot.destinationMapPixel, { x: 505, y: 245 }, 'straight at the leg - no planner asked');
});

test('AUDIT OW5b D3 (run on the host\'s own code): THE MAP\'S RESUME WALKS THE WALK\'S OWN DOOR - a far spawn\'s walk (its pixel never built, so the index knows nothing of it) resumes as its door; a spot clicked on a place\'s pixel resumes as that spot', () => {
  const w = rd('src/scenes/world.js');
  const m = /\n {2}(function travelViewResume\(\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the resume lifted');
  const walked = [];
  const run = (point, index = new Map()) => {
    walked.length = 0;
    const resume = new Function('d', `const { travelOptions, isEnhanced, travelView, travelViewAllowed, tvSay, travelViewCanGo, travelViewRouteTo, travelViewWalkTo, tvSceneOf, locationIndex, locationWorldRect, tvMapForcesRoads } = d;
      return ${m[1]};`)({
      travelOptions: { route: { point }, resumeTravel: () => walked.push('mod') }, isEnhanced: () => true, travelView: {}, travelViewAllowed: () => ({ ok: true }), tvSay() {},   // AUDIT OW5 J1: the route's re-plan, whoever owns the journey
      travelViewCanGo: () => true, travelViewRouteTo: () => walked.push('route'), travelViewWalkTo: (at, pix, opts) => walked.push({ pix, door: opts?.door ?? null }),
      tvSceneOf: (x, z) => [x, 0, z], locationIndex: index, locationWorldRect: () => ({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }),
      tvMapForcesRoads: () => false,   // TO-ROADS x OW-PATH: the Overworld's own walk (its Path switch)
    });
    resume();
    return walked[0];
  };
  const door = { minX: 10, maxX: 20, minZ: 30, maxZ: 40 };
  assert.deepEqual(run({ pixel: { x: 7, y: 8 }, x: 1, z: 2, door }), { pix: { x: 7, y: 8 }, door }, 'the far spawn: its own door, though the index holds nothing there');
  assert.deepEqual(run({ pixel: { x: 7, y: 8 }, x: 1, z: 2, door: null }, new Map([['7,8', { name: 'A keep' }]])), { pix: { x: 7, y: 8 }, door: null }, 'a spot on a keep\'s pixel: a spot still');
});
