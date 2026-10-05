// RATE-LAW (2026-10-04, Mac: "Remove travel options dials" / "Roads now travel at x100 and non roads at x60"): A JOURNEY'S
// RATE IS ITS GROUND'S. This file pinned TRAVEL-LAST-SPEED - the spinner's chosen rate surviving a path's half cap - and
// the spinner, its limit and the half cap are gone; what it pins now is the law that replaced them, driven through the
// real mod and the real panel: a route by its legs (a road or a track x100, the open ground and the walk back to the
// road x60), the follow key's legs x100, the ring walk under the mod's own x15 ceiling, a straight walk by what the
// traveller stands on - each asked of the clock only when it changes, and said on the panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { mapPixelWorldOrigin, MAX_CIRCUMNAVIGATION_ACCEL } from '../src/systems/travelPaths.js';
import { TRAVEL_ROAD_RATE, TRAVEL_OPEN_RATE } from '../src/systems/timeScale.js';

const mid = (x, y) => { const o = mapPixelWorldOrigin(x, y); return { x: o.x + 16384, z: o.z + 16384 }; };

function rig({ onRoad = () => false } = {}) {
  const asked = [];
  const w = { pos: mid(500, 250), pixel: { x: 500, y: 250 } };
  const ui = new TravelControlUI({});
  const to = createTravelOptions({
    settings: { ...readTravelOptionsSettings(), avoidObstacles: false }, ui,
    pushWindow: (win) => win.show(), mapPixel: () => w.pixel, worldPos: () => w.pos,
    setTimeScale: (n) => asked.push(n), locationTileRect: () => null, onRoad,
    localizedLocationName: (sm) => sm?.name ?? '',
    locationWorldRect: (sm) => { const o = mapPixelWorldOrigin(sm.pixel.x, sm.pixel.y); return { xMin: o.x + 16000, xMax: o.x + 16768, zMin: o.z + 16000, zMax: o.z + 16768 }; },
  });
  const frame = () => to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  return { to, ui, asked, w, frame };
}

test('RATE-LAW: a route runs at its LEG\'s rate - a road x100, a track x100, the open ground x60 - asked of the clock as each leg begins and only on a change, and said on the panel (mutants: the leg\'s kind unread, a track off the road, the clock asked every frame)', () => {
  const { to, ui, asked, w, frame } = rig();
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'track' }, { x: 503, y: 250, kind: 'open' }, { x: 504, y: 250, kind: 'road' }];
  // a PLACE's route (AUDIT-D1: a spot's last stretch asks the host's lanes - test/ratelawfix.test.js)
  assert.equal(to.beginTravelAlongRoute({ legs, summary: { pixel: { x: 505, y: 250 }, name: 'There', mapId: 7 } }), true);
  assert.deepEqual(asked, [TRAVEL_ROAD_RATE], 'the first leg, a road: x100');
  assert.deepEqual([ui.timeAcceleration, ui.onRoad], [100, true]);
  frame(); frame();
  assert.deepEqual(asked, [100], 'unchanged ground: the clock is not asked again');
  // walk each leg in turn: its arrival begins the next, and the frame after asks for the new ground's rate
  const walkTo = (x) => { w.pixel = { x, y: 250 }; w.pos = mid(x, 250); frame(); frame(); };
  walkTo(501);
  assert.deepEqual([asked.at(-1), ui.onRoad], [100, true], 'a track is a road to the rate');
  walkTo(502);
  assert.deepEqual([asked.at(-1), ui.timeAcceleration, ui.onRoad], [TRAVEL_OPEN_RATE, 60, false], 'the open ground: x60');
  walkTo(503);
  assert.deepEqual([asked.at(-1), ui.onRoad], [100, true], 'back on a road: x100');
  assert.deepEqual(asked, [100, 60, 100], 'asked three times over four legs - only where the ground changed');
});

test('RATE-LAW: a resumed route walks back to the road at the open ground\'s rate, then takes up the road\'s (mutant: the join walked at the road\'s rate)', () => {
  const { to, asked, w, frame } = rig();
  const legs = [{ x: 500, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }, { x: 504, y: 250, kind: 'road' }];
  // a PLACE's route - a spot's dies with its stop (AUDIT TV A4), a place's waits for the Resume
  to.beginTravelAlongRoute({ legs, summary: { pixel: { x: 504, y: 250 }, name: 'There', mapId: 7 } });
  assert.equal(asked.at(-1), 100);
  frame(); frame();   // standing on the first leg's pixel middle: it arrives, and the second is the one walked
  assert.equal(to.route.i, 1);
  // knocked off the road between its first two legs (a stop, then the map's Resume)
  to.interruptTravel();
  w.pixel = { x: 501, y: 250 };
  const o = mapPixelWorldOrigin(501, 250);
  w.pos = { x: o.x + 16384, z: o.z + 4000 };   // a long way off the road's lane, in its own pixel
  to.resumeTravel();
  assert.ok(to.route.join, 'a join is walked first (AUDIT OW3 J3)');
  assert.equal(asked.at(-1), TRAVEL_OPEN_RATE, 'the walk back to the road: the open ground\'s x60');
  // reach the join: the road's leg begins, and its rate with it
  w.pos = { x: to.route.join.x, z: to.route.join.z };
  frame(); frame();
  assert.equal(to.route.join, null);
  assert.equal(asked.at(-1), TRAVEL_ROAD_RATE, 'on the road again: x100');
});

test('RATE-LAW: a straight walk asks the host what the traveller stands on - x60 across the open ground, x100 while it runs along a road, followed frame by frame (mutant: the host never asked)', () => {
  let road = false;
  const { to, ui, asked, frame } = rig({ onRoad: () => road });
  to.beginTravelToCoords({ x: 520, y: 250 });
  assert.deepEqual([asked.at(-1), ui.onRoad], [60, false], 'across country: x60');
  road = true;
  frame();
  assert.deepEqual([asked.at(-1), ui.timeAcceleration, ui.onRoad], [100, 100, true], 'onto a road: x100 from the next frame');
  road = false;
  frame();
  assert.deepEqual(asked, [60, 100, 60], 'and off it again');
});

test('RATE-LAW: the follow key walks a road or a track at x100, and the ring walk round a town keeps the mod\'s own x15 ceiling - no spinner, no half limit (mutants: the ceiling dropped, the path walked at the open rate)', () => {
  const { to, ui, asked } = rig();
  to.beginPathTravel({ x: 501, y: 250 });
  assert.deepEqual([asked.at(-1), ui.timeAcceleration, ui.onRoad], [100, 100, true]);
  // a town's ring, stood in at its north-east corner
  const r = rig();
  r.w.pos = { x: 15, z: 15 };
  r.to.state.locationRect = { xMin: 0, xMax: 10, zMin: 0, zMax: 10 };
  r.to.state.locationBorderRect = { xMin: -10, xMax: 20, zMin: -10, zMax: 20 };
  r.to.circumnavigateLocation();
  assert.equal(MAX_CIRCUMNAVIGATION_ACCEL, 15);
  assert.deepEqual([r.asked.at(-1), r.ui.timeAcceleration], [MAX_CIRCUMNAVIGATION_ACCEL, 15], 'the ring walk: the mod\'s :34 ceiling over the road\'s rate');
});

test('RATE-LAW: a stop asks for walking pace and forgets the rate, so the next journey asks again whatever it was (mutant: the resume left at x1)', () => {
  const { to, asked } = rig();
  to.beginTravelToCoords({ x: 520, y: 250 });
  to.interruptTravel();
  assert.equal(asked.at(-1), 1, 'InterruptTravel: x1');
  to.beginTravelToCoords({ x: 521, y: 250 });
  assert.equal(asked.at(-1), 60, 'the next journey asks for its ground\'s rate again');
});

// ── THE HOST'S OWN QUESTION, RUN ──────────────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { playerOnPathAt, pathsDataPoint, E, W } from '../src/systems/travelPaths.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');

test('RATE-LAW host: travellerOnRoad (lifted from world.js) answers from the network\'s own lanes - a road or a track under the feet, whichever network painted the land; the mod and the keys\' travel are both handed it (mutants: the lanes unread, the tracks unread, the dep unwired)', () => {
  const m = /\n {2}function travellerOnRoad\(\) \{\n[\s\S]*?\n {2}\}\n/.exec(WORLD);
  assert.ok(m, 'travellerOnRoad lifted');
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'port' };
  const w = { pos: [0, 0, 0], px: { x: 500, y: 250 }, at: mid(500, 250) };
  const run = new Function('terrainGen', 'state', 'walkMode', 'player', 'cam', 'playerTravelPixel', 'playerOnPathAt', 'pathsDataPoint',
    `${m[0]}\nreturn travellerOnRoad;`)(
    { roads: () => net }, { worldCoords: () => w.at }, true, { pos: w.pos }, { pos: w.pos }, () => w.px, playerOnPathAt, pathsDataPoint);
  assert.equal(run(), false, 'no lane here');
  net.roads[500 + 250 * 1000] = E | W;
  assert.equal(run(), true, 'a road through the pixel middle, east to west');
  const o = mapPixelWorldOrigin(500, 250);
  w.at = { x: o.x + 16384, z: o.z + 2000 };
  assert.equal(run(), false, 'off its lane, far to the south of it');
  net.roads.fill(0); net.tracks[500 + 250 * 1000] = E | W; w.at = mid(500, 250);
  assert.equal(run(), true, 'a track counts');
  assert.match(WORLD, /onRoad: \(\) => travellerOnRoad\(\),/, 'the mod is handed it');
  assert.match(WORLD, /travels: !!travelControlUI, onRoad: !journey && travelView\?\.state === 'up' && travellerOnRoad\(\),/, 'and the keys\' travel');
});
