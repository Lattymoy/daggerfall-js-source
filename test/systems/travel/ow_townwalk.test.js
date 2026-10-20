// OW-TOWN-WALK (2026-10-19, the owner: "When in a town, slow down overworld navigation and have it navigate properly on
// town pathways instead of bumping into buildings"; bible/06-Systems/Travel-View.md OW-TOWN-WALK): A JOURNEY IN A TOWN
// WALKS ITS STREETS, AT A TOWN'S PACE. Pinned on the law (systems/travel/townWalk.js: the snap, the edge, the line of
// sight, the string-pull, the way), the line walked (travelAutopilot.js pathPursuit), the journey (the real Travel
// Options: its street way first, at TOWN_PACE_MAX, once a leg and a town, again on a resume and on a town walked into,
// never across the place it is bound for), the host's half over a real CityNavigation (scenes/townWalkHost.js), the
// steering that keeps the walk's own line (travelSteer.js), and the governor's hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { snapCell, exitCells, clearLine, simplifyWay, townWayCells, componentsOf, gatePassage, carveNav, TOWN_PACE_MAX, TOWN_SNAP_CELLS, TOWN_EXIT_TRIES, GATE_REACH_CELLS, TOWN_WAY_H_WEIGHT } from '../../../src/systems/travel/townWalk.js';
import { TRAVEL_NAV_TEXT } from '../../../src/systems/travel/travelOptionsText.js';
import { CITY_GATE_OPEN_MODEL_ID, CITY_GATE_CLOSED_MODEL_ID } from '../../../src/world/rmbLayout.js';
import { trs } from '../../../src/world/mat4.js';
import { skipReal, cities, hostTown } from '../../lwRealTown.mjs';
import { TravelAutopilot, pathPursuit, rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { createTravelSteer, steerDrive } from '../../../src/systems/travel/travelSteer.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { CityNavigation, NAV_CELL } from '../../../src/world/city/cityNavigation.js';
import { createTownWalk } from '../../../src/scenes/townWalkHost.js';
import { TRAVEL_HELD_WHY } from '../../../src/ui/enhanced/enhancedTravelControl.js';
import { SCENE_MAP_RATIO } from '../../../src/world/streamingWorld.js';
import { hostText } from '../../hostText.mjs';

/** A grid `w` x `h` of road, with walls (cells of none) where `wall(x, y)` says. */
function grid(w, h, wall = () => false) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = wall(x, y) ? 0 : 15 << 4;
  return { width: w, height: h, grid: g, weightAt: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y * w + x] >> 4 : 0) };
}

test('OW-TOWN-WALK the law: a cell that is no street snaps to the nearest that is, ring by ring, within TOWN_SNAP_CELLS; the edge streets nearest the point first; a line is clear only where every cell it touches is a street - a diagonal step through a corner both cells beside it (mutants: the snap past its reach; the edge unsorted; a corner shaved)', () => {
  assert.equal(TOWN_PACE_MAX, 5);
  assert.equal(TOWN_SNAP_CELLS, 8);
  assert.equal(TOWN_EXIT_TRIES, 6);
  const house = grid(30, 30, (x, y) => x >= 10 && x < 20 && y >= 10 && y < 20);
  assert.deepEqual(snapCell(house, [5, 5]), [5, 5], 'a street: itself');
  assert.deepEqual(snapCell(house, [12, 15]), [9, 15], 'inside a house: the nearest street, out of its west wall');
  assert.equal(snapCell(grid(40, 40, (x, y) => x > 2 && y > 2), [30, 30]), null, 'no street within reach: none');
  assert.deepEqual(exitCells(house, [100, 15], 2), [[29, 15], [29, 14]], 'the edge nearest a point east of the town, nearest first');
  assert.deepEqual(exitCells(house, [15, -50], 1), [[15, 0]]);
  const cross = grid(10, 10, (x, y) => (x === 5 && y === 4) || (x === 4 && y === 5));
  assert.equal(clearLine(cross, [0, 0], [9, 9]), false, 'the diagonal squeezes between two walls at a corner: not clear');
  assert.equal(clearLine(cross, [0, 9], [9, 9]), true);
  assert.equal(clearLine(cross, [0, 0], [3, 3]), true);
  assert.equal(clearLine(cross, [5, 4], [5, 0]), false, 'a line from a wall\'s own cell: not clear, however open past it');
});

test('OW-TOWN-WALK the way: round a wall through its gate; past the town, to the edge toward the point a way reaches - a wall\'s outer edge passed for the one its gate reaches; a staircase string-pulled to one run, a corner kept; none from nowhere near a street (mutants: the gate missed; the first edge always; no string-pull; the ends dropped)', () => {
  const walled = grid(20, 10, (x, y) => x === 10 && y < 8);   // a wall across the town, its gate the two cells at its foot
  const inside = townWayCells(walled, [2, 2], [17, 2]);
  assert.equal(inside.inside, true);
  assert.deepEqual(inside.cells[0], [2, 2], 'from where the traveller stands');
  assert.deepEqual(inside.cells.at(-1), [17, 2], 'to the point');
  assert.ok(inside.cells.some(([x, y]) => x >= 9 && x <= 11 && y >= 8), 'through the gate');
  for (let i = 1; i < inside.cells.length; i++) assert.ok(clearLine(walled, inside.cells[i - 1], inside.cells[i]), 'every run clear');
  const out = townWayCells(walled, [2, 2], [60, 2]);
  assert.equal(out.inside, false);
  assert.equal(out.cells.at(-1)[0], 19, 'out at the edge toward the point');
  // a ring wall with one gate: the nearest edge cells are outside the wall - all six reachable only round to the gate
  const ring = grid(21, 21, (x, y) => (x === 3 || x === 17 || y === 3 || y === 17) && x >= 3 && x <= 17 && y >= 3 && y <= 17 && !(x === 10 && y === 17));
  const fromIn = townWayCells(ring, [10, 10], [60, 10]);
  assert.ok(fromIn, 'a way out');
  for (let i = 1; i < fromIn.cells.length; i++) assert.ok(clearLine(ring, fromIn.cells[i - 1], fromIn.cells[i]), 'every run clear - so through the one gate');
  assert.ok(fromIn.cells.some(([, y]) => y > 17), 'out past the wall, by its gate in the south');
  assert.equal(fromIn.cells.at(-1)[0], 20, 'to the edge toward the point');
  // the nearest edge enclosed (a yard walled off at the town's east edge): passed for the nearest a way reaches
  const pocket = grid(20, 10, (x, y) => (x === 16 && y >= 2 && y <= 7) || ((y === 2 || y === 7) && x >= 16));
  const round = townWayCells(pocket, [2, 4], [60, 4]);
  assert.ok(round, 'a way out still');
  assert.deepEqual(round.cells.at(-1), [19, 1], 'the nearest edge a way reaches - the walled yard\'s passed');
  const staircase = Array.from({ length: 9 }, (_, i) => [Math.ceil(i / 2), Math.floor(i / 2)]);
  assert.deepEqual(simplifyWay(grid(10, 10), staircase), [[0, 0], [4, 4]], 'a staircase down a diagonal street: one run');
  const corner = grid(10, 10, (x, y) => x >= 1 && y >= 1);
  assert.deepEqual(simplifyWay(corner, [[0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]]), [[0, 5], [0, 0], [3, 0]], 'a corner kept');
  assert.equal(townWayCells(grid(40, 40, (x, y) => x > 2 && y > 2), [30, 30], [1, 1]), null, 'nowhere near a street: none');
});

test('OW-TOWN-WALK the line walked: the run moves on as the body passes each run\'s end; the aim looks ahead round a corner onto the next run; `end` only past the last (mutants: the run never moves on; the aim stops at the corner; the end at the first run)', () => {
  const path = [[0, 0], [100, 0], [100, 100], [200, 100]];
  const a = pathPursuit(50, 0, path, 0, 20);
  assert.deepEqual([a.seg, a.x, a.z, a.end], [0, 70, 0, false]);
  const b = pathPursuit(95, 0, path, 0, 20);
  assert.deepEqual([b.seg, b.x], [0, 100], 'the aim round the corner, onto the next run');
  assert.ok(Math.abs(b.z - 15) < 1e-9, `fifteen up it (${b.z})`);
  const c = pathPursuit(104, 5, path, 0, 20);
  assert.deepEqual([c.seg, c.end], [1, false], 'past the first run\'s end: the second');
  const d = pathPursuit(205, 100, path, 1, 20);
  assert.deepEqual([d.seg, d.end, d.x, d.z], [2, true, 200, 100], 'past the last: walked, the aim its end');
  // flown: a body walked round both corners on the line, arrived at the end
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(195, 95, 10, 10), 1, { path, lookMin: 8 });
  let x = 0, z = 0, off = 0, arrived = false;
  for (let f = 0; f < 400 && !arrived; f++) {
    const dr = ap.update({ worldX: x, worldZ: z, mapPixelX: 0, mapPixelY: 0 });
    if (dr.arrived) { arrived = true; break; }
    const r = (dr.yaw * Math.PI) / 180;
    x += Math.sin(r) * 2; z += Math.cos(r) * 2;
    off = Math.max(off, Math.min(Math.abs(z), Math.abs(x - 100), Math.abs(z - 100)));
  }
  assert.ok(arrived, 'arrived at the end');
  assert.ok(off < 8, `a corner cut by no more than its look ahead (${off.toFixed(1)})`);
  assert.deepEqual(ap.steerTarget, { x: 200, z: 100 }, 'the steering\'s target: the run it is on');
});

const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + 16384, z: o.z + 16384 }; };
function rig({ town = () => null, way = () => null } = {}) {
  const state = { pos: mid(500, 250), pixel: { x: 500, y: 250 } };
  const rates = [], asked = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: (n) => rates.push(n), now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
    townKey: (n) => town(n), townWay: (a, b) => { asked.push([a, b]); return way(a, b); },
  });
  const go = (at, px = 500, py = 250) => { state.pixel = { x: px, y: py }; state.pos = at; return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  return { to, state, rates, asked, go };
}

test('OW-TOWN-WALK the journey: set out in a town, its streets first - one line of runs from where the traveller stands to the way\'s end, at no more than a town\'s pace - then the leg from there, the way not asked again for that leg and town; a resume asks it again (mutants: the streets skipped; the pace unheld; asked again at the way\'s end; the resume\'s way kept)', () => {
  const pts = [{ x: mid(500, 250).x + 400, z: mid(500, 250).z }, { x: mid(500, 250).x + 400, z: mid(500, 250).z + 800 }];
  const inTown = (n) => (Math.abs(n.x - mid(500, 250).x) < 1200 && Math.abs(n.z - mid(500, 250).z) < 1200 ? '500,250' : null);
  const r = rig({ town: inTown, way: () => ({ pts }) });
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }];
  assert.equal(r.to.beginTravelAlongRoute({ legs, point: { pixel: { x: 502, y: 250 }, ...mid(502, 250) } }, false, { quiet: true }), true);
  const ap = r.to.state.autopilot;
  assert.equal(ap.lookMin, 96, 'a street\'s look ahead: a cell and a half - its corners turned at the corner');
  assert.deepEqual(ap.path, [[r.state.pos.x, r.state.pos.z], [pts[0].x, pts[0].z], [pts[1].x, pts[1].z]], 'the streets first, from where the traveller stands');
  assert.deepEqual(r.asked[0][1], mid(501, 250), 'toward the leg\'s own point');
  assert.ok(r.rates.at(-1) <= TOWN_PACE_MAX, `at a town's pace (x${r.rates.at(-1)})`);
  assert.equal(r.to.route.street.pts.length, 2);
  r.go(pts[1]); r.go(pts[1]);   // at the way's end
  assert.equal(r.to.route.street, null, 'the way walked');
  assert.equal(r.asked.length, 1, 'not asked again for this leg and this town');
  assert.deepEqual(r.to.state.autopilot.destinationMapPixel, { x: 501, y: 250 }, 'the leg itself, from there');
  r.go(mid(501, 250), 501, 250); r.go(mid(501, 250), 501, 250);
  assert.ok(r.rates.at(-1) > TOWN_PACE_MAX, 'out of the town: its own ground\'s rate again');
  // stopped and resumed in the town (a place's journey - a spot's is over once stopped, AUDIT TV A4): its streets again,
  // from where it stands now
  const s = rig({ town: inTown, way: () => ({ pts }) });
  s.to.beginTravelAlongRoute({ legs, summary: { pixel: { x: 502, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  s.to.interruptTravel();
  s.state.pos = { x: mid(500, 250).x - 300, z: mid(500, 250).z + 200 };
  s.to.resumeTravel();
  assert.equal(s.asked.length, 2, 'a resume asks again');
  assert.deepEqual(s.to.state.autopilot.path[0], [s.state.pos.x, s.state.pos.z], 'from where it stands now');
});

test('OW-TOWN-WALK a town walked into: a spot clicked in a market square - the leg begun again at the town\'s edge, its streets to the spot; a town\'s ring, the sea, and the place the journey is bound for are never walked across (mutants: the town walked into unheard; a ring walked through; the place\'s arrival walked across)', () => {
  const square = { x: mid(502, 250).x + 100, z: mid(502, 250).z };
  const inTown = (n) => (Math.abs(n.x - mid(502, 250).x) < 1000 && Math.abs(n.z - mid(502, 250).z) < 1000 ? '502,250' : null);
  const r = rig({ town: inTown, way: (a, b) => ({ pts: [{ x: a.x + 200, z: a.z }, { x: b.x, z: b.z }] }) });
  r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'open' }, { x: 502, y: 250, kind: 'open' }], point: { pixel: { x: 502, y: 250 }, ...square } }, false, { quiet: true });
  assert.equal(r.asked.length, 0, 'out in the country: no streets');
  r.go(mid(501, 250), 501, 250); r.go(mid(501, 250), 501, 250);
  assert.equal(r.asked.length, 0);
  const edge = { x: mid(502, 250).x - 900, z: mid(502, 250).z };
  r.go(edge, 502, 250);
  assert.equal(r.asked.length, 1, 'into the town: its way asked');
  assert.deepEqual(r.asked[0][1], { x: square.x, z: square.z }, 'to the spot');
  assert.ok(r.to.route.street, 'walking its streets');
  // a ring point: walked round, outside - never through
  const g = rig({ town: () => '600,250', way: () => ({ pts: [{ x: 1, z: 1 }] }) });
  g.to.beginTravelAlongRoute({ legs: [{ x: 600, y: 250, kind: 'road', at: mid(600, 250), ring: true }, { x: 601, y: 250, kind: 'road' }], point: { pixel: { x: 601, y: 250 }, ...mid(601, 250) } }, false, { quiet: true });
  assert.equal(g.asked.length, 0, 'a ring leg asks no streets');
  // bound for the town it stands in: arrived, never walked across to its middle
  const p = rig({ town: () => '503,250', way: () => ({ pts: [{ x: 1, z: 1 }] }) });
  const summary = { pixel: { x: 503, y: 250 }, name: 'Ripwych', mapId: 42 };
  p.state.pos = mid(503, 250); p.state.pixel = { x: 503, y: 250 };
  p.to.beginTravelAlongRoute({ legs: [{ x: 503, y: 250, kind: 'road' }], summary }, false, { quiet: true });
  assert.equal(p.asked.length, 0, 'in the place it is bound for: no streets');
});

test('OW-TOWN-WALK the host: the town a native point stands in is its pixel\'s - a populated place\'s grid, in the location frame carried by the pixel\'s translation; its way comes back as natives, the traveller\'s own cell left out; no grid, or a point past it, no town (mutants: the origin unread; the translation unread; the own cell kept)', () => {
  const nav = new CityNavigation(1, 1);   // one block: 64 x 64 cells of 1.6 m
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) nav.grid[y * 64 + x] = (x === 30 && y < 50 ? 0 : 15) << 4;   // a wall, its gate at its foot
  const o = mapPixelWorldOrigin(100, 200);
  const R = SCENE_MAP_RATIO, t = [7, 0, -3], locOrigin = [o.x / R + 2, 0, o.z / R + 5];
  const state = {
    pixelTranslation: () => t,
    localFromWorld: (x, z) => [x / R + t[0], z / R + t[2]],
    worldCoords: (p) => ({ x: (p[0] - t[0]) * R, z: (p[2] - t[2]) * R }),
  };
  const built = new Map([['100,200', { population: { nav }, locOrigin }], ['101,200', { population: null, locOrigin }]]);
  const tw = createTownWalk({ built, state });
  const cellAt = (gx, gy) => ({ x: (locOrigin[0] + (gx + 0.5) * NAV_CELL) * R, z: (locOrigin[2] + (gy + 0.5) * NAV_CELL) * R });
  assert.equal(tw.townKey(cellAt(10, 10)), '100,200', 'in the grid');
  assert.equal(tw.townKey({ x: cellAt(10, 10).x, z: cellAt(10, -40).z }), null, 'past its edge');
  assert.equal(tw.townKey(mapPixelWorldOrigin(101, 200)), null, 'a pixel with no townsfolk');
  const way = tw.townWay(cellAt(10, 10), cellAt(50, 10));
  assert.equal(way.inside, true);
  const end = way.pts.at(-1);
  assert.ok(Math.abs(end.x - cellAt(50, 10).x) < 1e-6 && Math.abs(end.z - cellAt(50, 10).z) < 1e-6, 'to the street cell at the point, as natives');
  assert.ok(way.pts.some((q) => q.z >= cellAt(0, 49).z), 'round the wall by its gate');
  // PIN MOVED (AUDIT OW-REVISITED L1-2): the traveller's own cell KEPT - the walk's first run is the string-pulled one from it
  // (the pursuit takes it up from where the body stands); left out, the line from the body to the next corner was never checked
  assert.ok(Math.hypot(way.pts[0].x - cellAt(10, 10).x, way.pts[0].z - cellAt(10, 10).z) < 1e-6, 'the traveller\'s own cell kept');
  assert.equal(tw.townWay(mapPixelWorldOrigin(101, 200), cellAt(5, 5)), null, 'no town where it stands: none');
});

test('OW-TOWN-WALK the steering keeps the walk\'s own line: a leg that walks a line hands its run\'s end for the feelers\' line, and its bearing is the way wanted even off the steering\'s line - a leg that walks none pursues the steering\'s own line as ever (mutants: the pathed bearing overridden; the run\'s end unread)', () => {
  const frame = { speed: 4.4, dt: 1 / 60, scale: 5, asked: 0, ratio: SCENE_MAP_RATIO };
  const open = () => Infinity;
  const pathed = new TravelAutopilot({ x: 0, y: 0 }, rectOf(195, 95, 10, 10), 1, { path: [[0, 0], [100, 0], [100, 100], [200, 100]] });
  const steer = createTravelSteer();
  steerDrive(steer, { yaw: 90, pitch: 0, forward: 1, arrived: false }, 0, 0, pathed, frame, open);
  assert.equal(steer.input.tx, 100 / SCENE_MAP_RATIO, 'the run\'s end, not the line\'s');
  const d = { yaw: 45, pitch: 0, forward: 1, arrived: false };
  steerDrive(steer, d, 0, 40, pathed, frame, open);   // a metre off the steering's line (past its quarter metre, short of a jump): its own bearing kept
  assert.equal(d.yaw, 45, 'the walk\'s own bearing');
  const plain = new TravelAutopilot({ x: 0, y: 0 }, rectOf(99990, -10, 20, 20), 1);
  const s2 = createTravelSteer();
  steerDrive(s2, { yaw: 90, pitch: 0, forward: 1, arrived: false }, 0, 0, plain, frame, open);
  const d2 = { yaw: 45, pitch: 0, forward: 1, arrived: false };
  steerDrive(s2, d2, 0, 40, plain, frame, open);
  assert.notEqual(d2.yaw, 45, 'no line of its own: the steering\'s pursuit, as ever');
});

test('OW-TOWN-WALK the host\'s wiring: Travel Options handed the town and its way; under the view the clock held to a town\'s pace in a town - the keys\' travel too - and the panel says why; the route line drawn down the streets still ahead (mutants: the cap unread; the reason not the town\'s; the streets undrawn)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const townWalk = createTownWalk\(\{ built, state \}\);[^\n]*\n(?:[^\n]*\n)?\s+travelOptions = travelOptionsOn \? createTravelOptions\(\{[^\n]*\n\s+townKey: townWalk\.townKey, townWay: townWalk\.townWay,/);
  assert.match(w, /const tvInTown = \(\) => !!townWalk\.townPace\(state\.worldCoords\(player\.pos\)\);/);
  assert.match(w, /const town = tvInTown\(\) \? TOWN_PACE_MAX : Infinity;[^\n]*\n\s+const rate = Math\.min\(load, foeCap, town\);/);
  assert.match(w, /tvHeldWhy = tvHeld == null \? null : town < Math\.min\(load, foeCap\) \? 'town' : foeCap < load \? 'foes' : 'load';/);
  assert.match(w, /sw = travelOptions\.route\?\.street\?\.pts\.slice\(travelOptions\.state\?\.autopilot\?\.seg \?\? 0\) \?\? \[\];\n\s+let at = me;\n\s+for \(const q of j \? \[\.\.\.sw, j\] : sw\) \{ leg\(at\.x, at\.z, q\.x, q\.z, pts\); at = q; \}/);
  assert.equal(TRAVEL_HELD_WHY.town, 'in town');
});

test('OW-TOWN-WALK THE WALLS AND THEIR GATES: a walled town\'s inside and its fields are two pieces of the grid - a way out of the inside finds no edge; its gate\'s passage carved (the axis along which its covered cells end in a street both sides, within GATE_REACH_CELLS), the way goes out through it; the town\'s own grid never written, its walkers\' flags never the journey\'s; a point behind a shut gate met at this piece\'s nearest cell, not reached - however far past the snap\'s reach; a dead end or a wall thicker than GATE_REACH_CELLS no passage (mutants: the pieces unread; the gate\'s axis the longer; the town\'s grid written; the reach unsaid; the far point unmet; the reach unbounded; one side\'s street enough)', () => {
  assert.equal(GATE_REACH_CELLS, 24);
  assert.equal(TOWN_WAY_H_WEIGHT, 1.5);
  // a ring wall round the middle of a 30 x 30 town, three cells thick; its gate a covered cell in the east wall's middle
  const wall = (x, y) => (x >= 8 && x <= 22 && y >= 8 && y <= 22) && !(x >= 11 && x <= 19 && y >= 11 && y <= 19);
  const town = grid(30, 30, wall);
  town.grid[3 * 30 + 3] |= 1;   // a walker's occupancy flag on the town's own grid
  const label = componentsOf(town);
  assert.notEqual(label[15 * 30 + 15], label[2 * 30 + 2], 'inside and fields: two pieces');
  assert.equal(townWayCells(town, [15, 15], [90, 15]), null, 'no gate open: no edge of the inside\'s piece');
  const passage = gatePassage(town, [21, 15]);
  assert.deepEqual(passage, [[20, 15], [21, 15], [22, 15]], 'through the wall\'s thickness, east-west - never along it');
  assert.equal(gatePassage(grid(10, 10, () => true), [5, 5]), null, 'all wall: no passage');
  const carved = carveNav(town, [passage]);
  assert.equal(town.weightAt(21, 15), 0, 'the town\'s own grid untouched');
  assert.equal(carved.weightAt(21, 15), 15, 'the journey\'s carved');
  assert.equal(carved.grid[3 * 30 + 3] & 15, 0, 'no walker\'s flag carried');
  assert.equal(carveNav(town, []), town, 'nothing to carve: the grid itself');
  const out = townWayCells(carved, [15, 15], [90, 15]);
  assert.ok(out && out.reached && out.cells.at(-1)[0] === 29, 'out through the gate to the edge');
  for (let i = 1; i < out.cells.length; i++) assert.ok(clearLine(carved, out.cells[i - 1], out.cells[i]));
  const behind = townWayCells(town, [2, 2], [15, 15]);
  assert.equal(behind.reached, false, 'a point behind a shut gate: not reached');
  assert.equal(townWayCells(carved, [2, 2], [15, 15]).reached, true, 'the gate open: reached');
  assert.equal(gatePassage(grid(10, 3, (x) => x <= 5), [3, 1]), null, 'a dead end - a street one side only: no passage');
  assert.equal(gatePassage(grid(60, 5, (x) => x >= 1 && x <= 55), [28, 2]), null, 'a wall 55 cells thick: no gate\'s passage');
  // the inside a long way in from its fields - no street of it within TOWN_SNAP_CELLS of a point outside
  const keep = grid(50, 50, (x, y) => (x >= 8 && x <= 42 && y >= 8 && y <= 42) && !(x >= 20 && x <= 30 && y >= 20 && y <= 30));
  const far = townWayCells(keep, [25, 25], [2, 2]);
  assert.ok(far && far.reached === false && far.cells.at(-1)[0] === 20 && far.cells.at(-1)[1] === 20, 'the far point met at the inside\'s nearest cell');
});

test('OW-TOWN-WALK the search\'s reach: the journey\'s search weighs its heuristic (TOWN_WAY_H_WEIGHT) - across an open square it opens the way\'s own cells, where the cheapest search opens the square; an edge past the search\'s reach gives way to the next nearest (mutants: the heuristic unweighted; the first edge always)', () => {
  const square = townWayCells(grid(40, 40), [0, 0], [39, 39], { maxExpansions: 200 });
  assert.ok(square && square.reached && square.cells.at(-1)[0] === 39, 'found within 200 cells opened (the cheapest search opens 1,599)');
  // one street across the town, an edge at each end: the far one first (nearest the point), past the reach; the near one walked
  const lane = grid(20, 20, (x, y) => y !== 10);
  const out = townWayCells(lane, [2, 10], [40, 10], { maxExpansions: 5 });
  assert.ok(out && out.inside === false && out.cells.at(-1)[0] === 0, 'the next edge tried');
});

test('OW-TOWN-WALK the host\'s gates: the journey\'s grid carves each OPEN city gate the pixel keeps (DaggerfallCityGate\'s placements) and kept until a gate swings; a way that ends short behind a shut gate is said `shut`; Travel Options stops the journey with its word before it walks into the wall (mutants: a shut gate carved; the swing unseen; the shut unsaid; the stop unmade)', () => {
  const nav = new CityNavigation(1, 1);
  const inWall = (x, y) => x >= 20 && x <= 44 && y >= 20 && y <= 44 && !(x >= 23 && x <= 41 && y >= 23 && y <= 41);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) nav.grid[y * 64 + x] = (inWall(x, y) ? 0 : 15) << 4;
  const o = mapPixelWorldOrigin(100, 200);
  const R = SCENE_MAP_RATIO, t = [0, 0, 0], locOrigin = [o.x / R, 0, o.z / R];
  const state = { pixelTranslation: () => t, localFromWorld: (x, z) => [x / R, z / R], worldCoords: (p) => ({ x: p[0] * R, z: p[2] * R }) };
  const gateAt = (gx, gy) => trs(locOrigin[0] + (gx + 0.5) * NAV_CELL, 0, locOrigin[2] + (gy + 0.5) * NAV_CELL, 0, 0, 0);
  const gate = { gate: { isOpen: true, modelId: CITY_GATE_OPEN_MODEL_ID }, local: gateAt(43, 32) };
  const built = new Map([['100,200', { population: { nav }, locOrigin, cityGates: [gate] }]]);
  const tw = createTownWalk({ built, state });
  const cellAt = (gx, gy) => ({ x: (locOrigin[0] + (gx + 0.5) * NAV_CELL) * R, z: (locOrigin[2] + (gy + 0.5) * NAV_CELL) * R });
  const out = tw.townWay(cellAt(32, 32), cellAt(32 + 400, 32));
  assert.equal(out.shut, false);
  assert.ok(out.pts.some((q) => q.x > cellAt(44, 32).x), 'out through the open gate');
  gate.gate.modelId = CITY_GATE_CLOSED_MODEL_ID;   // dusk: the gate swung shut
  const shut = tw.townWay(cellAt(32, 32), cellAt(32 + 400, 32));
  assert.deepEqual([shut.shut, shut.pts.length], [true, 0], 'the gate shut: said, no way walked');
  // the journey stopped with its word, before it walks into the wall
  const words = [];
  const r = rig({ town: () => '100,200', way: () => ({ pts: [], shut: true }) });
  r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }], summary: { pixel: { x: 502, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  const rep = r.go(mid(500, 250));
  assert.equal(rep.stopped, 'shut', 'stopped');
  assert.equal(r.to.state.autopilot, null, 'nothing walks on');
  assert.equal(TRAVEL_NAV_TEXT.MsgGatesShut, 'Paused the journey since the city gates are shut for the night.');
  assert.ok(words.length === 0);
});

test('OW-TOWN-WALK the game\'s own cities (ARENA2): from the doors of the greatest and a spread of the rest, a way out toward every side through the open gates - every one found, every run of it clear of every wall; and every gate the grid can see through (skipped without the data)', { skip: skipReal }, () => {
  const all = cities();
  const pick = all.filter((l, i) => ['Daggerfall', 'Wayrest', 'Sentinel'].includes(l.name) || i % 41 === 0);
  let ways = 0, gates = 0;
  for (const l of pick) {
    const { nav, doors, gates: g } = hostTown(l);
    const passages = g.map((c) => gatePassage(nav, c));
    gates += g.length;
    assert.ok(passages.every(Boolean), `${l.name}: every gate seen through`);
    const jn = carveNav(nav, passages);
    const W = nav.width, H = nav.height;
    for (const d of doors.slice(0, 4)) {
      const from = [Math.floor((d.x + d.nx * 1.5) / NAV_CELL), Math.floor((d.z + d.nz * 1.5) / NAV_CELL)];
      for (const to of [[W * 3, H >> 1], [-W * 2, H >> 1], [W >> 1, H * 3], [W >> 1, -H * 2]]) {
        const w = townWayCells(jn, from, to);
        assert.ok(w && w.reached, `${l.name}: a way out`);
        for (let i = 1; i < w.cells.length; i++) assert.ok(clearLine(jn, w.cells[i - 1], w.cells[i]), `${l.name}: a clear run`);
        ways++;
      }
    }
  }
  assert.ok(gates >= 4 * 3 && ways >= 150, `the premise: walled cities and their ways (${gates} gates, ${ways} ways)`);
});
