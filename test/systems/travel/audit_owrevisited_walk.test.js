// AUDIT OW-REVISITED (2026-10-20, the owner, of THE OVERWORLD REVISITED: "Audit this and ensure perfection";
// bible/01-Overview/audits/Audit-Overworld-Revisited.md): THE WALKS - OW-ROAD-TRUE's lanes and OW-TOWN-WALK's streets, as
// the cold lanes found them (L1, the town walk; L2, the road; L6, the record's pins) and as they are now. Each test names
// the findings it pins; each flies the real autopilot, the real Travel Options or the real town walk host.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TravelAutopilot, pathPursuit, rectOf, LANE_CORNER_FORCE_MIN } from '../../../src/systems/travel/travelAutopilot.js';
import { createTravelOptions, readTravelOptionsSettings, ringPassPoints } from '../../../src/systems/travel/travelOptions.js';
import { createTravelSteer, steerDrive } from '../../../src/systems/travel/travelSteer.js';
import { finalRoadVia, routeDrawPoints, joinPoint } from '../../../src/systems/travel/travelRoute.js';
import { clearLine, simplifyWay, townWayCells, componentsOf, edgePieces, TOWN_WAY_MARGIN } from '../../../src/systems/travel/townWalk.js';
import { createTownWalk, JOURNEY_GRIDS_MAX } from '../../../src/scenes/townWalkHost.js';
import { TRAVEL_NAV_TEXT } from '../../../src/systems/travel/travelOptionsText.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { worldCoordToMapPixel } from '../../../src/formats/mapsFile.js';
import { CityNavigation, NAV_CELL } from '../../../src/world/city/cityNavigation.js';
import { CITY_GATE_OPEN_MODEL_ID, CITY_GATE_CLOSED_MODEL_ID } from '../../../src/world/rmbLayout.js';
import { trs } from '../../../src/world/mat4.js';
import { SCENE_MAP_RATIO } from '../../../src/world/streamingWorld.js';

const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + 16384, z: o.z + 16384 }; };
/** A grid `w` x `h` of road, with walls (cells of none) where `wall(x, y)` says. */
function grid(w, h, wall = () => false) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = wall(x, y) ? 0 : 15 << 4;
  return { width: w, height: h, grid: g, weightAt: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y * w + x] >> 4 : 0) };
}
/** The real Travel Options over a stub world: `rect` the place's rect law, `town`/`way` the town walk's, `words` every
 *  word the mod says or boxes. */
function rig({ rect = null, town = () => null, way = () => null, atSea = () => false } = {}) {
  const state = { pos: mid(500, 250), pixel: { x: 500, y: 250 } };
  const words = [], asked = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: (w) => words.push(w), messageBox: (w) => words.push(w),
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: rect ?? ((s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); }),
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
    townKey: (n) => town(n), townWay: (a, b) => { asked.push([a, b]); return way(a, b); }, atSea,
  });
  const go = (at, px, py) => { const p = px == null ? worldCoordToMapPixel(at.x, at.z) : { x: px, y: py }; state.pixel = p; state.pos = at; return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  return { to, state, words, asked, go };
}
/** A body flown over a real autopilot: `step` world units a frame along its yaw, scaled by its force. */
function fly(ap, from, { step, frames = 4000, each = null }) {
  let x = from.x, z = from.z;
  for (let f = 0; f < frames; f++) {
    const p = worldCoordToMapPixel(x, z);
    const d = ap.update({ worldX: x, worldZ: z, mapPixelX: p.x, mapPixelY: p.y });
    if (d.arrived) return { arrived: f, x, z };
    const r = (d.yaw * Math.PI) / 180;
    x += Math.sin(r) * step * d.forward;
    z += Math.cos(r) * step * d.forward;
    each?.(x, z, d);
  }
  return { arrived: -1, x, z };
}
const inRect = (r, p) => p.x >= r.xMin && p.x <= r.xMax && p.z >= r.zMin && p.z <= r.zMax;

test('AUDIT OW-REVISITED L2-1: a PLACE off its pixel\'s middle (the main quest\'s eight CUST dungeons) - its last road leg walks on from the road\'s end to the place\'s own middle, and a place is arrived at inside its rect alone, never at the line\'s end; a resume past the road\'s end walks back to it (mutants: the line ended at the road; a place arrived at its line\'s end)', () => {
  const off = (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 4000, o.z + 9000, 4096, 4096); };   // a 1 x 1 place at tile (72, 55)-like, its middle off the pixel's
  const r = rig({ rect: off });
  const summary = { pixel: { x: 502, y: 250 }, name: 'Direnni Tower', mapId: 7 };
  assert.equal(r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'track' }], summary }, false, { quiet: true }), true);
  r.go(mid(501, 250)); r.go(mid(501, 250));
  const ap = r.to.state.autopilot, rect = off(summary), c = { x: (rect.xMin + rect.xMax) / 2, z: (rect.zMin + rect.zMax) / 2 };
  assert.equal(ap.isLocation, true);
  assert.deepEqual(ap.path, [[mid(501, 250).x, mid(501, 250).z], [mid(502, 250).x, mid(502, 250).z], [c.x, c.z]], 'up the track to its end, then on to the place\'s middle (L2-7: a track as the place\'s leg is laned)');
  assert.ok(!inRect(ap.destinationWorldRect, mid(502, 250)), 'the premise: the road\'s end lies outside the place\'s grown rect');
  const run = fly(ap, mid(501, 250), { step: 200 });
  assert.ok(run.arrived > 0 && inRect(ap.destinationWorldRect, run), `arrived INSIDE the place's rect (${Math.round(run.x)}, ${Math.round(run.z)})`);
  // a resume past the road's end (the body beyond the line's end, in the place's pixel): no arrival until the rect
  const resumed = new TravelAutopilot(summary.pixel, rect, 1, { grow: true, isLocation: true, path: ap.path });
  const past = { x: mid(502, 250).x + 9000, z: mid(502, 250).z - 3000 };
  assert.equal(resumed.update({ worldX: past.x, worldZ: past.z, mapPixelX: 502, mapPixelY: 250 }).arrived, false, 'past the line\'s end: no arrival');
  assert.ok(fly(resumed, past, { step: 200 }).arrived > 0, 'walked to the place and arrived there');
  const beyond = { x: mid(502, 250).x + 1.6 * (c.x - mid(502, 250).x), z: mid(502, 250).z + 1.6 * (c.z - mid(502, 250).z) };   // past the line's end (on its last run), outside the place's rect
  const again = new TravelAutopilot(summary.pixel, rect, 1, { grow: true, isLocation: true, path: ap.path });
  assert.ok(!inRect(again.destinationWorldRect, beyond), 'the premise: outside the rect');
  assert.equal(pathPursuit(beyond.x, beyond.z, ap.path, 0, 0).end, true, 'the premise: the line walked');
  assert.equal(again.update({ worldX: beyond.x, worldZ: beyond.z, mapPixelX: 502, mapPixelY: 250 }).arrived, false, 'past the line\'s end, outside the rect: never arrived');
  // a place at its pixel's middle keeps the plain lane (no point added)
  assert.equal(finalRoadVia([{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }], mid(502, 250), (l) => mid(l.x, l.y), { place: true }).x, mid(502, 250).x);
});

test('AUDIT OW-REVISITED L2-2: a SPOT on the roads - its last road run is walked ON the road to the road\'s point nearest the spot, then off it to the spot, and the drawn line goes there too; a spot behind the run\'s start, open ground and the sea keep their straight walk (mutants: the spot\'s leg unlaned; the line drawn straight)', () => {
  const r = rig();
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 506, y: 250, kind: 'road' }];   // the road east, its last run folded into one leg
  const spot = { x: mid(505, 250).x, z: mid(505, 250).z + 6000 };   // 150 m north of the road, a pixel before its end
  assert.equal(r.to.beginTravelAlongRoute({ legs, point: { pixel: worldCoordToMapPixel(spot.x, spot.z), ...spot } }, false, { quiet: true }), true);
  r.go(mid(501, 250)); r.go(mid(501, 250));
  const ap = r.to.state.autopilot, j = joinPoint(spot, mid(501, 250), mid(506, 250));
  assert.deepEqual(ap.path, [[mid(501, 250).x, mid(501, 250).z], [j.x, j.z], [spot.x, spot.z]], 'the road to its point nearest the spot, then the spot');
  let worst = 0;
  const run = fly(ap, mid(501, 250), { step: 300, each: (x, z) => { if (x < j.x - 600) worst = Math.max(worst, Math.abs(z - mid(501, 250).z)); } });
  assert.ok(run.arrived > 0, 'arrived at the spot');
  assert.ok(worst < 300, `on the road the whole run before it leaves it (${Math.round(worst)} units off at worst; it walked 5,600 off)`);
  // the drawn line the same
  const via = finalRoadVia(legs, spot, (l) => [mid(l.x, l.y).x, mid(l.x, l.y).z]);
  assert.deepEqual(routeDrawPoints(mid(500, 250), legs, spot, (l) => [mid(l.x, l.y).x, mid(l.x, l.y).z], via).at(-2), [j.x, j.z], 'the line through the road\'s point');
  const m2 = (l) => mid(l.x, l.y);
  assert.equal(finalRoadVia([{ x: 501, y: 250, kind: 'road' }, { x: 506, y: 250, kind: 'open' }], spot, m2), null, 'open ground: no road to keep');
  assert.equal(finalRoadVia([{ x: 506, y: 250, kind: 'road' }], spot, m2), null, 'no leg behind it');
  assert.equal(finalRoadVia([{ x: 501, y: 250, kind: 'road' }, { x: 506, y: 250, kind: 'sea' }], spot, m2), null, 'the sea');
});

test('AUDIT OW-REVISITED L2-3: a DIAGONAL road meets a town\'s ring where its own diagonal crosses the band - not at the corner square\'s middle, which stood off it for every town not square - and the walk passes the corner\'s square on its way round when it goes that way; a square town\'s is its corner (mutants: the corner\'s middle; the corner skipped)', () => {
  const m = { x: 1000000, z: 1000000 }, band = 1500;
  const wide = { xMin: m.x - 8000, xMax: m.x + 8000, zMin: m.z - 4000, zMax: m.z + 4000 };   // a town 4 x 2 blocks (Whiteshire)
  const B = { xMin: wide.xMin - band, xMax: wide.xMax + band, zMin: wide.zMin - band, zMax: wide.zMax + band };
  // in from the north-east, out to the west: round the north
  const pts = ringPassPoints(wide, B, [1, -1], [-1, 0], m);
  const ne = pts[0];
  assert.ok(Math.abs((ne.x - m.x) - (ne.z - m.z)) < 1e-6, `on the road's own north-east diagonal (${ne.x - m.x}, ${ne.z - m.z})`);
  assert.ok(ne.z > wide.zMax && ne.z < B.zMax && ne.x < wide.xMax, 'in the north band, short of the corner');
  assert.equal(pts.length, 3, 'its point, the north-west corner, the west side - the north-east corner\'s square not walked (the walk goes the other way)');
  // in from the north-east, out to the south: round the east - the corner's square passed first
  const se = ringPassPoints(wide, B, [1, -1], [0, 1], m);
  assert.deepEqual(se.slice(0, 2).map((p) => [p.x > wide.xMax, p.z > wide.zMax]), [[false, true], [true, true]], 'its point, then the north-east corner\'s square');
  // a square town: the diagonal crosses at the corner's square
  const sq = { xMin: m.x - 4000, xMax: m.x + 4000, zMin: m.z - 4000, zMax: m.z + 4000 };
  const Bs = { xMin: sq.xMin - band, xMax: sq.xMax + band, zMin: sq.zMin - band, zMax: sq.zMax + band };
  const c = ringPassPoints(sq, Bs, [1, -1], [-1, 0], m)[0];
  assert.deepEqual([c.x, c.z], [(sq.xMax + Bs.xMax) / 2, (sq.zMax + Bs.zMax) / 2], 'a square town: the corner square\'s middle, on its diagonal');
});

test('AUDIT OW-REVISITED L1-1: past a turn SHARPER THAN A RIGHT ANGLE the walk moves on to the next run - a body on it still projects inside the run before, and the walk hovered at the corner for ever (37% of the game\'s town ways); a right angle and a straight line as ever (mutants: the run moved on at its end alone; the walk from the first run)', () => {
  for (const deg of [90, 100, 150, 175]) {
    const a = (deg * Math.PI) / 180;
    const path = [[0, 0], [400, 0], [400 - 400 * Math.cos(a), 400 * Math.sin(a)]];   // a turn of `deg` at (400, 0)
    const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(path[2][0] - 30, path[2][1] - 30, 60, 60), 1, { path, lookMin: 96, lookMax: 96 });
    const run = fly(ap, { x: 0, z: 0 }, { step: 8, frames: 3000 });
    assert.ok(run.arrived > 0, `a ${deg} degree turn walked round (seg ${ap.seg})`);
  }
  // the law: on the next run past a hairpin, the next run; and a later call keeps its run (never walks back from the first)
  const hp = [[0, 0], [400, 0], [10, 60], [10, 900]];
  assert.equal(pathPursuit(200, 30, hp, 0, 50).seg, 1, 'on the hairpin\'s return run: that run');
  const u = [[0, 0], [400, 0], [400, 100], [0, 100]];   // a U-turn: its way back runs beside its way out
  assert.equal(pathPursuit(200, 60, u, 2, 50).seg, 2, 'on the way back, nearer the way out than its own run: the run walked kept, never the first');
});

test('AUDIT OW-REVISITED L2-4 / L1-2: A FRAME NEVER CARRIES THE BODY PAST A CORNER - the force cut to land on it (down to LANE_CORNER_FORCE_MIN), and a street\'s look never past its own (lookMax) whatever the step; a road\'s bend at 30 fps x100 met within a road\'s width (mutants: the force never cut; the look uncapped)', () => {
  assert.equal(LANE_CORNER_FORCE_MIN, 0.25);
  const path = [[0, 0], [4000, 0], [4000, 4000]];
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(3990, 3990, 20, 20), 1, { path });
  ap.update({ worldX: 3000, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  const d = ap.update({ worldX: 3700, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });   // a 700-unit step, 300 to the corner
  assert.ok(Math.abs(d.forward - 300 / 700) < 1e-9, `the force cut to land on the corner (${d.forward})`);
  // flown at a 30 fps x100 rider's step (866 units): never more than a road's half width (256) off the line
  let off = 0;
  const run = fly(new TravelAutopilot({ x: 0, y: 0 }, rectOf(3990, 3990, 20, 20), 1, { path }), { x: 0, z: 0 }, { step: 866, each: (x, z) => { off = Math.max(off, x <= 4000 ? Math.abs(z) * (z < 0 ? 1 : 0) + Math.max(0, x - 4000) : Math.abs(x - 4000)); } });
  assert.ok(run.arrived > 0 && off < 256, `the bend met within a road's half width (${Math.round(off)})`);
  // a street's look: never past its own, whatever the step
  const street = new TravelAutopilot({ x: 0, y: 0 }, rectOf(3990, 3990, 20, 20), 1, { path, lookMin: 96, lookMax: 96 });
  street.update({ worldX: 0, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  const y = street.update({ worldX: 2000, worldZ: 50, mapPixelX: 0, mapPixelY: 0 }).yaw;   // a 2000-unit step - three of them would look round the corner
  const want = (Math.atan2(2096 - 2000, 0 - 50) * 180) / Math.PI;
  assert.ok(Math.abs(y - (want < 0 ? want + 360 : want)) < 1e-6, 'aimed 96 ahead, not three steps');
});

test('AUDIT OW-REVISITED L2-5 / L1-3: THE STEERING ON A LINE\'S LEG - a held strafe walks beside the run on its own bearing (the pursuit pulled it back before the steering saw the hand: TRAVEL-STRAFE\'s bug again), let go the pursuit takes the road back; and the corridor it asks for runs to the run\'s end, never nine metres past the corner a street turns at (mutants: the strafe pulled back; the goal the leg\'s end)', () => {
  const frame = { speed: 4.4, dt: 1 / 60, scale: 1, asked: 0, ratio: SCENE_MAP_RATIO };
  const open = () => Infinity;
  const path = [[0, 0], [40000, 0]];
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(39990, -10, 20, 20), 1, { path });
  const beside = { x: 1000, z: 600 };   // the hand has put the body 15 m beside the road
  const d = ap.update({ worldX: beside.x, worldZ: beside.z, mapPixelX: 0, mapPixelY: 0 });
  assert.ok(Math.abs(d.yaw - 90) > 1, 'the premise: the pursuit aims back at the road');
  const steer = createTravelSteer();
  const held = { ...d };
  steerDrive(steer, held, beside.x, beside.z, ap, { ...frame, strafe: 1 }, open);
  assert.equal(held.yaw, 90, 'the strafe held: the run\'s own bearing, beside it');
  const free = { ...d };
  steerDrive(createTravelSteer(), free, beside.x, beside.z, ap, frame, open);
  assert.equal(free.yaw, d.yaw, 'let go: the pursuit\'s bearing back to the road');
  // the corridor: a street's run 8 m to its corner, the way's end 60 m on - the goal is the corner's
  const street = new TravelAutopilot({ x: 0, y: 0 }, rectOf(2390, 2390, 20, 20), 1, { path: [[0, 0], [320, 0], [320, 2400]], lookMin: 96, lookMax: 96 });
  const sd = street.update({ worldX: 0, worldZ: 0, mapPixelX: 0, mapPixelY: 0 });
  const s2 = createTravelSteer();
  steerDrive(s2, sd, 0, 0, street, frame, open);
  assert.ok(Math.abs(s2.input.goal - 320 / SCENE_MAP_RATIO) < 1e-9, `the goal: the run's end (${s2.input.goal} m)`);
});

test('AUDIT OW-REVISITED L1-2: A RUN KEEPS ITS DISTANCE - string-pulled TOWN_WAY_MARGIN clear of every covered cell (the body\'s capsule, not its centre), so no run grazes a footprint\'s corner; a street a cell wide still walks its middle, and two cells a step apart are always clear (mutants: no margin; the margin unread)', () => {
  assert.equal(TOWN_WAY_MARGIN, 0.3);
  const g = grid(20, 20, (x, y) => x === 10 && y === 10);   // one building's cell
  assert.equal(clearLine(g, [0, 7], [19, 11]), true, 'by the cell alone: clear (it shaves the corner)');
  assert.equal(clearLine(g, [0, 7], [19, 11], TOWN_WAY_MARGIN), false, 'by the body: too near the corner');
  assert.equal(clearLine(g, [0, 8], [19, 8], TOWN_WAY_MARGIN), true, 'a run a cell and a half off it: clear');
  const lane = grid(20, 3, (x, y) => y !== 1);   // a street one cell wide
  assert.equal(clearLine(lane, [0, 1], [19, 1], TOWN_WAY_MARGIN), true, 'a street a cell wide: its middle');
  assert.equal(clearLine(g, [9, 9], [9, 10], TOWN_WAY_MARGIN), true, 'a step beside the building: clear');
  // a way round the building string-pulled with the margin: every run clear by it
  const w = townWayCells(g, [0, 7], [19, 11]);
  for (let i = 1; i < w.cells.length; i++) assert.ok(clearLine(g, w.cells[i - 1], w.cells[i], TOWN_WAY_MARGIN), 'a run clear by the margin');
  assert.ok(w.cells.length > 2, 'the corner kept as a turn');
  assert.deepEqual(simplifyWay(g, [[0, 9], [1, 9]]), [[0, 9], [1, 9]]);
});

/** A walled city on a CityNavigation of one block: a ring wall (cells 20..44, three thick), its one gate in the east wall
 *  at (43, 32), fields outside; a yard inside closed in by houses at (25..28, 25..28). */
function walledTown({ yard = false } = {}) {
  const nav = new CityNavigation(1, 1);
  const inWall = (x, y) => x >= 20 && x <= 44 && y >= 20 && y <= 44 && !(x >= 23 && x <= 41 && y >= 23 && y <= 41);
  const house = (x, y) => yard && x >= 24 && x <= 29 && y >= 24 && y <= 29 && !(x >= 25 && x <= 28 && y >= 25 && y <= 28);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) nav.grid[y * 64 + x] = (inWall(x, y) || house(x, y) ? 0 : 15) << 4;
  const o = mapPixelWorldOrigin(100, 200);
  const R = SCENE_MAP_RATIO, t = [0, 0, 0], locOrigin = [o.x / R, 0, o.z / R];
  const state = { pixelTranslation: () => t, localFromWorld: (x, z) => [x / R, z / R], worldCoords: (p) => ({ x: p[0] * R, z: p[2] * R }) };
  const gateAt = (gx, gy) => trs(locOrigin[0] + (gx + 0.5) * NAV_CELL, 0, locOrigin[2] + (gy + 0.5) * NAV_CELL, 0, 0, 0);
  const gate = { gate: { isOpen: true, modelId: CITY_GATE_OPEN_MODEL_ID }, local: gateAt(43, 32) };
  const built = new Map([['100,200', { population: { nav }, locOrigin, cityGates: [gate] }]]);
  const cellAt = (gx, gy) => ({ x: (locOrigin[0] + (gx + 0.5) * NAV_CELL) * R, z: (locOrigin[2] + (gy + 0.5) * NAV_CELL) * R });
  return { nav, gate, built, state, cellAt, tw: createTownWalk({ built, state }) };
}

test('AUDIT OW-REVISITED L1-4: A TOWN\'S PACE IS ITS STREETS\' - a walled city\'s fields (inside its grid, outside its wall: where every route round it walks its ring) are not "in town", its streets and their doorsteps are; a town with no wall is all town; townKey still answers the fields (the way out through the gate is asked there) (mutants: the fields in town; the walls unread)', () => {
  const { tw, cellAt, nav } = walledTown();
  assert.equal(tw.townPace(cellAt(32, 32)), '100,200', 'within the walls');
  assert.equal(tw.townPace(cellAt(5, 5)), null, 'the fields: no town\'s pace');
  assert.equal(tw.townKey(cellAt(5, 5)), '100,200', 'but in the grid: its way is asked');
  assert.equal(tw.townPace(cellAt(22, 32)), '100,200', 'in the wall, nearest the streets inside: a doorstep reads as its street');
  const pieces = edgePieces(nav);
  assert.ok(pieces.edge.size >= 1 && pieces.all === 2, `two pieces, the fields' at the edge (${pieces.edge.size} of ${pieces.all})`);
  const open = createTownWalk({ built: new Map([['100,200', { population: { nav: new CityNavigation(1, 1) }, locOrigin: walledTown().built.get('100,200').locOrigin }]]), state: walledTown().state });
  assert.equal(open.townPace(cellAt(5, 5)), '100,200', 'a town with no wall: all of it');
  // gates, but a wall that does not close (a breach): one piece - all of it town
  const breach = walledTown();
  for (let y = 30; y <= 34; y++) for (let x = 20; x <= 22; x++) breach.nav.grid[y * 64 + x] = 15 << 4;
  assert.equal(breach.tw.townPace(breach.cellAt(5, 5)), '100,200', 'a wall that does not close: no fields apart, all town');
});

test('AUDIT OW-REVISITED L6-3 / L1-6: THE GATES BLAMED ONLY WHEN THEY ARE THE REASON - a way short behind a gate shut is `shut` only if the gates open would have let it through; a yard the houses close in is walked as far as it reaches, by day or night; the journey grids kept a town and its gates\' state, JOURNEY_GRIDS_MAX at most, made again when the pixel is built again (mutants: every short way blamed on the gates; the grids unbounded; a rebuilt pixel\'s stale grid)', () => {
  const town = walledTown({ yard: true });
  const { tw, cellAt, gate } = town;
  const yard = tw.townWay(cellAt(10, 10), cellAt(26, 26));   // from the fields to the closed yard, by day
  assert.equal(yard.shut, false, 'by day: no gate blamed');
  assert.ok(yard.pts.length > 0, 'walked as far as it reaches');
  gate.gate.modelId = CITY_GATE_CLOSED_MODEL_ID;
  const night = tw.townWay(cellAt(10, 10), cellAt(26, 26));
  assert.equal(night.shut, false, 'by night: the yard is still no gate\'s fault');
  const inside = tw.townWay(cellAt(10, 10), cellAt(35, 35));   // the streets inside the walls, at night
  assert.deepEqual([inside.shut, inside.pts.length], [true, 0], 'the streets within the shut gate: said');
  gate.gate.modelId = CITY_GATE_OPEN_MODEL_ID;
  assert.equal(tw.townWay(cellAt(10, 10), cellAt(35, 35)).shut, false, 'the gate open again: walked');
  // the grids: bounded, and a pixel built again makes its grid again
  assert.equal(JOURNEY_GRIDS_MAX, 4);
  const R = SCENE_MAP_RATIO, open = () => { const n = new CityNavigation(1, 1); n.grid.fill(15 << 4); return n; };
  const many = new Map();
  for (let i = 0; i < 8; i++) {
    const o = mapPixelWorldOrigin(100 + i, 200);
    many.set(`${100 + i},200`, { population: { nav: open() }, locOrigin: [o.x / R, 0, o.z / R], cityGates: [{ gate: { modelId: CITY_GATE_OPEN_MODEL_ID }, local: trs(o.x / R + 8, 0, o.z / R + 8, 0, 0, 0) }] });
  }
  const tw2 = createTownWalk({ built: many, state: town.state });
  const at = (i, gx, gy) => { const l = many.get(`${100 + i},200`).locOrigin; return { x: (l[0] + (gx + 0.5) * NAV_CELL) * R, z: (l[2] + (gy + 0.5) * NAV_CELL) * R }; };
  for (let i = 0; i < 8; i++) assert.ok(tw2.townWay(at(i, 5, 5), at(i, 50, 5))?.pts.length, `town ${i}: a way`);
  assert.equal(tw2.gridsKept(), JOURNEY_GRIDS_MAX, 'eight towns walked: four grids kept');
  // a pixel built again: its new grid's walls read (a wall across the way, a gap at its foot)
  const rebuilt = open();
  for (let y = 0; y < 60; y++) rebuilt.grid[y * 64 + 30] = 0;
  many.get('107,200').population = { nav: rebuilt };
  const after = tw2.townWay(at(7, 5, 5), at(7, 50, 5));
  assert.ok(after.pts.some((q) => q.z >= at(7, 0, 59).z), 'round the new wall by its gap - the rebuilt grid read, never the old grid\'s open street');
});

test('AUDIT OW-REVISITED L1-5 / L6-4 / L1-6 / L1-9: THE JOURNEY\'S WORDS AND ITS WATCH - the gates\' word SAID (it was never checked) and never carried to the next journey (a stop in the same frame left it set: the next journey, anywhere and by day, "the city gates are shut"); a town left and walked back into on the same leg asks its way again; at sea no street is asked; a place is arrived at its grown rect, and a leg in a town aims at the place\'s middle (mutants: the word wrong; the word unsaid; the flag kept; the town not asked again; the sea walked; the buffer dropped; the aim not the place)', () => {
  const r = rig({ town: () => '100,200', way: () => ({ pts: [], shut: true }) });
  r.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }], summary: { pixel: { x: 502, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  const rep = r.go(mid(500, 250));
  assert.equal(rep.stopped, 'shut');
  assert.deepEqual(r.words.filter((w) => w === TRAVEL_NAV_TEXT.MsgGatesShut), [TRAVEL_NAV_TEXT.MsgGatesShut], 'the gates\' word, said once');
  assert.ok(!r.words.includes(TRAVEL_NAV_TEXT.MsgBlocked), 'never another stop\'s');
  // the flag set and the journey stopped another way in the same frame: never the next journey's
  r.to.state.shutStop = true;
  r.to.interruptTravel();
  assert.equal(r.to.state.shutStop, false, 'an interrupt takes it');
  const quiet = rig();
  quiet.to.state.shutStop = true;
  quiet.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }], point: { pixel: { x: 501, y: 250 }, ...mid(501, 250) } }, false, { quiet: true });
  assert.equal(quiet.to.state.shutStop, false, 'a new journey begins without it');
  assert.notEqual(quiet.go(mid(500, 250)).stopped, 'shut', 'and is never stopped by it');
  // a town walked out of and back into on one leg: asked again
  const inTown = (n) => (Math.abs(n.x - mid(500, 250).x) < 1200 ? '500,250' : null);
  const back = rig({ town: inTown, way: () => ({ pts: [{ x: mid(500, 250).x + 300, z: mid(500, 250).z }] }) });
  back.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 503, y: 250, kind: 'road' }], point: { pixel: { x: 503, y: 250 }, ...mid(503, 250) } }, false, { quiet: true });
  const n0 = back.asked.length;
  back.to.state.route.street = null;
  back.go({ x: mid(500, 250).x + 5000, z: mid(500, 250).z });   // out of the town
  back.go({ x: mid(500, 250).x + 100, z: mid(500, 250).z });    // back in
  assert.ok(back.asked.length > n0, 'the town walked back into: its way asked again');
  // at sea: no street asked
  const sea = rig({ town: () => '500,250', way: () => ({ pts: [{ x: mid(500, 250).x + 300, z: mid(500, 250).z }] }), atSea: () => true });
  sea.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }], point: { pixel: { x: 501, y: 250 }, ...mid(501, 250) } }, false, { quiet: true });
  assert.equal(sea.asked.length, 0, 'at sea: the helm\'s, never a street\'s');
  // a place: its grown rect is arrived at (no street walked there), and a town's leg aims at the place's own middle
  const placeRect = (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); };
  const at = rig({ town: () => '501,250', way: (a, b) => ({ pts: [{ x: b.x, z: b.z }] }) });
  at.state.pos = { x: mid(501, 250).x + 768 / 2 + 300, z: mid(501, 250).z };   // inside the arrival buffer, outside the rect
  at.state.pixel = { x: 501, y: 250 };
  at.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }], summary: { pixel: { x: 501, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  assert.equal(at.asked.length, 0, 'within the place\'s grown rect: arrived, no street walked across it');
  const offRect = (s2) => { const o = mapPixelWorldOrigin(s2.pixel.x, s2.pixel.y); return rectOf(o.x + 4000, o.z + 9000, 4096, 4096); };
  const aim = rig({ rect: offRect, town: () => '500,250', way: (a, b) => ({ pts: [{ x: b.x, z: b.z }] }) });
  aim.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }], summary: { pixel: { x: 501, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  const want = offRect({ pixel: { x: 501, y: 250 } });
  assert.ok(placeRect, 'the plain law beside it');
  assert.deepEqual(aim.asked[0][1], { x: (want.xMin + want.xMax) / 2, z: (want.zMin + want.zMax) / 2 }, 'aimed at the place\'s middle');
});

test('AUDIT OW-REVISITED L1-9: a line of runs is arrived at its end\'s square only on its LAST run - a way that bends back passes that square on the far side of a building (121 of 2,426 town ways stopped there); a road\'s lane (one run) as ever (mutant: the square on any run)', () => {
  const path = [[0, 0], [0, 600], [200, 600], [200, 40]];   // up, across, and back down to beside where it began
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rectOf(150, 0, 100, 100), 1, { path, lookMin: 96, lookMax: 96 });
  assert.equal(ap.update({ worldX: 160, worldZ: 50, mapPixelX: 0, mapPixelY: 0 }).arrived, false, 'in the end\'s square from the first run\'s side: walked on');
  const lane = new TravelAutopilot({ x: 0, y: 0 }, rectOf(150, 0, 100, 100), 1, { path: [[0, 0], [200, 40]] });
  assert.equal(lane.update({ worldX: 160, worldZ: 50, mapPixelX: 0, mapPixelY: 0 }).arrived, true, 'a lane\'s end square: arrived');
});
