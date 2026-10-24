// OW-ROAD-TRUE (2026-10-19, the owner: "Routes should always follow the road if planned, it should never offset";
// bible/06-Systems/Travel-View.md OW-ROAD-TRUE): A ROUTED LEG ON A ROAD WALKS THE ROAD'S LINE. The mod's autopilot aims a
// leg once a map pixel (PlayerAutoPilot.cs Update re-aims only on a pixel change), so a body knocked off the road kept its
// bearing beside it for up to a pixel; a road or a track leg now pursues its lane every frame
// (systems/travel/travelAutopilot.js lanePursuit), arrived where the lane ends. Pinned on the law, on a walk flown over the
// real autopilot (the mod's re-aim beside it - the defect - and the lane), and on the legs the real Travel Options hands a
// lane to.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TravelAutopilot, lanePursuit, rectOf, LANE_LOOK_MIN, LANE_LOOK_MAX, LANE_LOOK_STEPS } from '../../../src/systems/travel/travelAutopilot.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin, MID_LO, P_SIZE } from '../../../src/systems/travel/travelPaths.js';
import { worldCoordToMapPixel } from '../../../src/formats/mapsFile.js';

const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + 16384, z: o.z + 16384 }; };
const midRect = (px, py) => { const o = mapPixelWorldOrigin(px, py); return rectOf(o.x + MID_LO, o.z + MID_LO, P_SIZE, P_SIZE); };

test('OW-ROAD-TRUE the law: the point `look` past the body\'s own projection onto the lane, clamped to its end; `t` the projection\'s share (past 1: walked); a lane of no length walked at once (mutants: the projection unclamped; the look ignored; the share of the wrong axis)', () => {
  const lane = { ax: 0, az: 0, bx: 1000, bz: 0 };
  const same = (got, want, msg) => { for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] - want[k]) < 1e-9, `${msg}: ${k} ${got[k]} vs ${want[k]}`); };
  same(lanePursuit(200, 300, lane, 100), { t: 0.2, x: 300, z: 0 }, 'beside the line: the point ahead ON it');
  same(lanePursuit(950, -40, lane, 100), { t: 0.95, x: 1000, z: 0 }, 'near the end: the end');
  same(lanePursuit(-500, 0, lane, 100), { t: -0.5, x: 0, z: 0 }, 'behind the start: its start');
  assert.equal(lanePursuit(1200, 0, lane, 100).t, 1.2, 'past the end');
  const diag = lanePursuit(0, 100, { ax: 0, az: 0, bx: 300, bz: 400 }, 0);
  assert.ok(Math.abs(diag.t - 0.16) < 1e-9 && Math.abs(diag.x - 48) < 1e-9 && Math.abs(diag.z - 64) < 1e-9, 'a diagonal lane');
  assert.deepEqual(lanePursuit(5, 5, { ax: 7, az: 7, bx: 7, bz: 7 }, 100), { t: 1, x: 7, z: 7 });
  assert.equal(LANE_LOOK_MIN, P_SIZE, 'a path\'s width: back on the road within it');
  assert.equal(LANE_LOOK_MAX, 4096);
  assert.equal(LANE_LOOK_STEPS, 3);
});

/** A walk flown over the real autopilot: `step` world units a frame along its yaw; a knock `dz` across the road at frame
 *  `knockAt`. Answers the offsets from the road's line (z = the lane's) frame by frame, and the frame it arrived. */
function fly(ap, from, { step, frames = 400, knockAt = -1, dz = 0, laneZ }) {
  let x = from.x, z = from.z;
  const off = [];
  for (let f = 0; f < frames; f++) {
    if (f === knockAt) z += dz;
    const p = worldCoordToMapPixel(x, z);
    const d = ap.update({ worldX: x, worldZ: z, mapPixelX: p.x, mapPixelY: p.y });
    if (d.arrived) return { off, arrived: f, x, z };
    const r = (d.yaw * Math.PI) / 180;
    x += Math.sin(r) * step * d.forward;
    z += Math.cos(r) * step * d.forward;
    off.push(Math.abs(z - laneZ));
  }
  return { off, arrived: -1, x, z };
}

test('OW-ROAD-TRUE the walk: a body knocked a road\'s width off at a hundred times walking pace - under the mod\'s re-aim it walks on beside the road until it crosses into the next pixel; on the lane it is back on the road within a few frames and stays on it to the leg\'s end, arrived there (mutants: the lane unread; the look never grown; the end not an arrival)', () => {
  const a = mid(500, 250), b = mid(504, 250);   // a straight road run east, four pixels - one leg (routeLegs folds it)
  const lane = { ax: a.x, az: a.z, bx: b.x, bz: b.z };
  const step = 433;   // ~10.8 m a frame: a horse at x100 at 60 frames a second
  const knock = { knockAt: 6, dz: 600 };   // ~15 m north: off a road two tiles (P_SIZE, 512) wide
  // the mod's law: a bearing once a pixel
  const mod = fly(new TravelAutopilot({ x: 504, y: 250 }, midRect(504, 250), 1), a, { step, ...knock, laneZ: a.z });
  const modBeside = mod.off.slice(knock.knockAt + 1, knock.knockAt + 40);
  assert.ok(modBeside.every((o) => o > P_SIZE / 2), `the defect: the mod walks on beside the road (${Math.round(Math.min(...modBeside))} units off at best)`);
  // the lane
  const ap = new TravelAutopilot({ x: 504, y: 250 }, midRect(504, 250), 1, { lane });
  const run = fly(ap, a, { step, ...knock, laneZ: a.z });
  assert.ok(run.arrived > 0, 'arrived');
  assert.ok(Math.abs(run.x - b.x) <= step && Math.abs(run.z - b.z) < P_SIZE / 2, 'at the leg\'s end, on the road');
  const back = run.off.findIndex((o, f) => f > knock.knockAt && o < P_SIZE / 4);
  assert.ok(back > 0 && back - knock.knockAt <= 8, `back on the road\'s line within ${back - knock.knockAt} frames`);
  assert.ok(run.off.slice(back).every((o) => o < P_SIZE / 4), 'and on it from then to the end');
  assert.ok(run.off.slice(0, knock.knockAt).every((o) => o < 1), 'never off it before the knock');
  // at walking pace too
  const slow = fly(new TravelAutopilot({ x: 504, y: 250 }, midRect(504, 250), 1, { lane }), a, { step: 4, frames: 40000, knockAt: 50, dz: 300, laneZ: a.z });
  assert.ok(slow.arrived > 0 && slow.off.slice(50 + 400).every((o) => o < 16), 'a walker the same');
});

test('OW-ROAD-TRUE no swing is an arrival: a body off the lane in the leg\'s own pixel is aimed back at the line, never counted arrived until its projection passes the end or it stands in the end\'s square (mutants: the bearing latch kept)', () => {
  const a = mid(500, 250), b = mid(501, 250);
  const ap = new TravelAutopilot({ x: 501, y: 250 }, midRect(501, 250), 1, { lane: { ax: a.x, az: a.z, bx: b.x, bz: b.z } });
  // in the end's pixel, 400 units beside the road and 4000 short of the end: the bearing to the point ahead swings far
  // past the mod's five degrees from the bearing to the end - no arrival
  const p = { x: b.x - 4000, z: b.z + 400 };
  const px = worldCoordToMapPixel(p.x, p.z);
  assert.deepEqual(px, { x: 501, y: 250 }, 'the premise: in the end\'s pixel');
  for (let f = 0; f < 3; f++) assert.equal(ap.update({ worldX: p.x, worldZ: p.z, mapPixelX: px.x, mapPixelY: px.y }).arrived, false);
  assert.equal(ap.update({ worldX: b.x + 10, worldZ: b.z + 400, mapPixelX: 501, mapPixelY: 250 }).arrived, true, 'past the end: arrived');
});

test('OW-ROAD-TRUE the look grows with the frame\'s step: at a crawl a path\'s width ahead, at speed three steps, never past a block (mutants: the step unmeasured; no ceiling)', () => {
  const lane = { ax: 0, az: 0, bx: 100000, bz: 0 };
  const aim = (ap, x, z) => { const d = ap.update({ worldX: x, worldZ: z, mapPixelX: 0, mapPixelY: 0 }); return d.yaw; };
  const toward = (x, z, tx) => (Math.atan2(tx - x, 0 - z) * 180) / Math.PI;
  const yawOf = (x, z, tx) => { const r = toward(x, z, tx); return r < 0 ? r + 360 : r; };
  const ap = new TravelAutopilot({ x: 9, y: 9 }, rectOf(99000, -10, 20, 20), 1, { lane });
  assert.ok(Math.abs(aim(ap, 1000, 300) - yawOf(1000, 300, 1000 + LANE_LOOK_MIN)) < 1e-6, 'the first update: a path\'s width ahead');
  assert.ok(Math.abs(aim(ap, 1600, 300) - yawOf(1600, 300, 1600 + 3 * 600)) < 1e-6, 'a 600-unit step: three of them ahead');
  assert.ok(Math.abs(aim(ap, 11600, 300) - yawOf(11600, 300, 11600 + LANE_LOOK_MAX)) < 1e-6, 'a huge step: a block at most');
});

function rig() {
  const state = { pos: mid(500, 250), pixel: { x: 500, y: 250 } };
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
  });
  const go = (px, py, at = mid(px, py)) => { state.pixel = { x: px, y: py }; state.pos = at; return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  return { to, state, go };
}

test('OW-ROAD-TRUE the legs: a road or a track leg walks the line from its last leg\'s middle to its own - the place\'s own last leg up the road into it too; a join, a town\'s ring point, open ground, the sea and the route\'s first leg walk as before (mutants: the open ground laned; a join laned; the first leg laned from nowhere; the last leg unlaned; a lane from the join\'s point)', () => {
  const r = rig();
  const summary = { pixel: { x: 504, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  const me = { x: mid(500, 250).x + 3000, z: mid(500, 250).z + 2000 };
  const legs = [
    { x: 500, y: 250, kind: 'open', at: { x: me.x, z: mid(500, 250).z } },   // OW-ROADSIDE's join
    { x: 502, y: 250, kind: 'road' },
    { x: 503, y: 251, kind: 'track' },
    { x: 503, y: 252, kind: 'open' },
    { x: 504, y: 250, kind: 'road' },
  ];
  assert.equal(r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  const lanes = [];
  lanes.push(r.to.state.autopilot.path);
  r.go(500, 250, legs[0].at); r.go(500, 250, legs[0].at);   // the join reached
  const ln = (p, q) => [[mid(p[0], p[1]).x, mid(p[0], p[1]).z], [mid(q[0], q[1]).x, mid(q[0], q[1]).z]];   // the lane as the autopilot keeps it: a line of two points
  assert.equal(lanes[0], null, 'the join aims at its own point');
  assert.deepEqual(r.to.state.autopilot.path, ln([500, 250], [502, 250]), 'the road: from the join\'s pixel middle - the line the join stands on');
  r.go(502, 250); r.go(502, 250);
  assert.deepEqual(r.to.state.autopilot.path, ln([502, 250], [503, 251]), 'a track: middle to middle, diagonally');
  r.go(503, 251); r.go(503, 251);
  assert.equal(r.to.state.autopilot.path, null, 'open ground: no line to keep');
  r.go(503, 252); r.go(503, 252);
  assert.equal(r.to.state.autopilot.isLocation, true, 'the place\'s own leg');
  assert.deepEqual(r.to.state.autopilot.path, ln([503, 252], [504, 250]), 'up the road into the place');
  // a ring point and the first leg
  const s = rig();
  s.to.beginTravelAlongRoute({ legs: [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road', at: mid(502, 250), ring: true }, { x: 503, y: 250, kind: 'road' }], point: { pixel: { x: 503, y: 250 }, ...mid(503, 250) } }, false, { quiet: true });
  assert.equal(s.to.state.autopilot.path, null, 'the first leg: no leg behind it');
  s.go(501, 250); s.go(501, 250);
  // PIN MOVED (AUDIT OW-REVISITED L2-3): the road INTO a town's ring is laned to the ring's point (ringPassPoints puts it
  // on the road's own line), and the road out of it from the ring's last point
  assert.deepEqual(s.to.state.autopilot.path, ln([501, 250], [502, 250]), 'the road into the ring: to the ring\'s point');
  s.go(502, 250); s.go(502, 250);
  assert.deepEqual(s.to.state.autopilot.path, ln([502, 250], [503, 250]), 'the road out of it: from the ring\'s point');
});
