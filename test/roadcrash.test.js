// ROAD-CRASH (2026-09-23, Discord through Mac: "crashes while traveling
// on roads with travel options") - THE RING WALK'S DEAD FRAME, and the
// recovery walk's give-up.
//
// FollowPath's third arm walks the border ring of a town
// (TravelOptionsMod.cs:658-664). Unlike the two path arms before it,
// it did not forget the named destination - and an interrupt "leaves
// current destination active" (:1273), so a ring walked after any
// stopped journey ran with that name still set. That is the one
// condition under which InitLocationRects keeps refreshing the rects
// MID-journey (:606-612): the walk crossed into a neighbour pixel (a
// town's ring reaches into them), the neighbour answered no location
// (not built yet, or none there), both rects went null, and the walk's
// own OnArrival read `.zMax` off null. Unity logs the
// NullReferenceException and runs the next frame; this host's frame
// loop dies on it - the red crash box. Three pins, by execution, over
// the mod driven on a table (to1_travelOptions.test.js's own rig
// shape, with the host's onClose wired as world.js:6257 wires it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  N, E, S, SE, mapPixelWorldOrigin, nextPathDirection, countSetBits,
} from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import {
  readTravelOptionsSettings, createTravelOptions, locationRectsOf, circumnavigateTarget,
} from '../src/systems/travelOptions.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { modSetting } from '../src/systems/modSettings.js';

/** A forty-tile town in the middle of pixel 500,250 - the shape
 *  world.js's locationTileRect answers off the built pixel. */
const TOWN = { tileRect: { x: 40, y: 40, width: 40, height: 40 }, locationType: 0, hasCustomPosition: false };

function rig() {
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' };
  const at = (x, y) => x + y * 1000;
  const o = mapPixelWorldOrigin(500, 250);
  const state = { pos: { x: o.x + 16384, z: o.z + 16384 }, pixel: { x: 500, y: 250 }, yaw: 0, tileRect: null, location: null };
  const said = [], scales = [];
  let to = null;
  // world.js:6257 - CAMP / close is InterruptTravel; the port's panel is
  // what the C#'s pushed window is, and its OnClose is the mod's own.
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel() });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui,
    roads: () => net,
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => state.yaw,
    setFacing: () => {},
    currentLocation: () => state.location,
    hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => state.location?.name ?? '',
    localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false,
    diseaseCount: () => 0,
    say: (l) => said.push(l),
    messageBox: () => {},
    setTimeScale: (n) => scales.push(n),
    now: () => 0,
    worldTimeNow: () => 0,
    pushWindow: (w) => w.show(),
    locationWorldRect: (s) => { const q = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(q.x + 16000, q.z + 16000, 768, 768); },
    // the terrain's answer: the town's pixel carries it once `tileRect`
    // is set; every other pixel is unbuilt or empty - null, which is
    // world.js:6336's own answer for both.
    locationTileRect: (p) => (p.x === 500 && p.y === 250 ? state.tileRect : null),
  });
  return { to, ui, net, at, state, said, scales, o };
}

/** The player in the ring's north edge, facing east - FollowPath's
 *  ring arm, and CircumnavigateLocation's fifth branch (an edge, not a
 *  corner), which is the branch that reads `locationRect.zMax`. */
function standInTheRing(r) {
  r.state.tileRect = TOWN;
  r.to.onMapPixelChanged({ x: 500, y: 250 });   // world.js:2737 - the rects for the pixel the player stands in
  const t = locationRectsOf(r.o.x, r.o.z, TOWN.tileRect, false, false);
  r.state.pos = { x: (t.locationRect.xMin + t.locationRect.xMax) / 2, z: (t.locationRect.zMax + t.locationBorderRect.zMax) / 2 };
  r.state.yaw = 90;
  return t;
}
const frame = { topWindowIsTravelUI: true, isPlayerOnHUD: false };

test('ROAD-CRASH: a ring walked after an interrupted journey forgets the named destination, so the rects hold for the whole walk', () => {
  const r = rig();
  const { to, ui, state } = r;
  to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  to.interruptTravel();
  assert.equal(to.destinationName, 'Daggerfall', ':1273 - an interrupt keeps the name for the map\'s resume prompt (the mod\'s own)');
  assert.equal(to.state.autopilot, null);

  standInTheRing(r);
  assert.ok(to.state.locationBorderRect, 'the rects for the town\'s pixel');
  assert.equal(to.followPath(), true, ':658-664 - the ring arm');
  assert.ok(to.state.autopilot, 'the walk is on');
  assert.equal(ui.isShowing, true);
  assert.equal(to.destinationName, null, 'THE FIX: the ring walk is a followed path and forgets the named destination');
  assert.equal(to.isPathFollowing, true, '...and reads as one');

  // the walk crosses into the neighbour pixel, whose terrain answers no
  // location: with the name gone InitLocationRects is silent mid-journey
  // (:607), exactly as it is for every path leg.
  to.onMapPixelChanged({ x: 501, y: 250 });
  assert.ok(to.state.locationRect && to.state.locationBorderRect, 'the rects hold across the crossing');

  // ...and the arrival at the north-east corner picks the next corner
  // without a throw: the walk goes on round the town.
  const c = to.state.corners;
  state.pos = { x: (c.ne.xMin + c.ne.xMax) / 2, z: (c.ne.zMin + c.ne.zMax) / 2 };
  to.update(frame);   // the autopilot latches the pixel
  let report;
  assert.doesNotThrow(() => { report = to.update(frame); });
  assert.equal(report.drive.arrived, true, 'OnArrival fired');
  assert.ok(to.state.autopilot, 'the walk goes on');
  assert.deepEqual(to.state.autopilot.destinationWorldRect, c.se, 'in the NE corner facing east: round to the SE');
  assert.equal(ui.isShowing, true);
});

test('ROAD-CRASH: a walk whose rects are gone ends where it stands instead of throwing in the frame loop', () => {
  const r = rig();
  const { to, ui, state, said } = r;
  standInTheRing(r);
  assert.equal(to.followPath(), true);
  assert.ok(to.state.autopilot);
  const c = to.state.corners;

  // the state the mod reaches (its arm keeps the name, its rects
  // refresh, the neighbour answers nothing) - and what the read is
  to.state.locationRect = null;
  to.state.locationBorderRect = null;
  assert.throws(() => circumnavigateTarget(state.pos.x, state.pos.z, 90, null, null, c), TypeError,
    'on an edge the pick reads locationRect.zMax - a NullReferenceException in the mod, a dead frame loop here');

  assert.doesNotThrow(() => to.circumnavigateLocation(), 'the guard');
  assert.equal(to.state.autopilot, null, 'the walk is over');
  assert.equal(ui.isShowing, false, ':1063 - CloseWindow, whose onClose is InterruptTravel');
  // the follow key asked again: the mod's own "no path here", not a throw
  assert.equal(to.followPath(), false);
  assert.deepEqual(said, [TRAVEL_OPTIONS_TEXT.MsgNoPath]);
});

test('ROAD-CRASH: a walk with no panel to close is stopped outright', () => {
  const r = rig();
  const { to } = r;
  standInTheRing(r);
  to.followPath();
  to.state.locationRect = null;
  to.state.locationBorderRect = null;
  r.ui.isShowing = false;   // a host whose panel is already down (closeWindow is a no-op then)
  to.circumnavigateLocation();
  assert.equal(to.state.autopilot, null, 'InterruptTravel, not a leg that arrives every frame');
});

test('ROAD-CRASH: the recovery walk\'s give-up is a junction, not a leg to the pixel the player stands in', () => {
  const { to, ui, net, at, state, said } = rig();
  // two ways out, east and south-east; the player faces south, so the
  // facing matches neither and the mod's walk starts from north - and
  // from north its nine shifts visit only N, NW and W (the reset at zero
  // is not a rotate), so the pick stays three bits.
  const raw = nextPathDirection(E | SE, S, N);
  assert.equal(countSetBits(raw), 3, 'the mod\'s own give-up, raw');
  net.roads[at(500, 250)] = E | SE;
  to.beginPathTravel({ x: 500, y: 250 });   // a leg into this pixel, its arrival SelectNextPath
  assert.equal(ui.isShowing, true);
  state.yaw = 180;
  const before = said.length;
  to.selectNextPath();
  assert.deepEqual(said.slice(before), [TRAVEL_OPTIONS_TEXT.MsgArrivedJunc], ':1057 - a junction');
  assert.equal(ui.isShowing, false, ':1063 - CloseWindow');
  assert.equal(to.state.autopilot, null, '...and the journey is over, not re-armed at the pixel it stands in');

  // the sound case is untouched: two edges, the facing on one, carry on
  net.roads[at(500, 250)] = N | S;
  state.yaw = 0;
  to.beginPathTravel({ x: 500, y: 250 });
  to.selectNextPath();
  assert.ok(to.state.autopilot, 'straight on');
  assert.deepEqual(to.state.autopilot.destinationMapPixel, { x: 500, y: 249 }, 'north');
  assert.equal(ui.isShowing, true);
});
