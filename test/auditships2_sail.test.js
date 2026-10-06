// AUDIT SHIPS 2 (2026-10-06, Mac: "Audit everything" - PR #634 again, the first audit's fixes with it;
// bible/01-Overview/Audit-Ships.md, its second round): THE SAILING HALF. Each pin is one finding, fixed at its root, on
// Come Sail Away's real runtime, and failed on the build before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scene } from './csaScene.mjs';
import { BOAT_ACTIONS, CSA_BRAKE_MAX } from '../src/systems/comeSailAway.js';
import { csaWireRecord, validCsaRecord, CSA_WIRE_SPEED_MAX } from '../src/systems/comeSailAwayWire.js';
import { HELM_WAY, sailFreeGain } from '../src/systems/helmWay.js';
import { heaveToDecel, heaveToRun, HEAVE_TO_M, HEAVE_TO_S } from '../src/scenes/navalHost.js';
import { BOARD_SPEED } from '../src/systems/naval/navalBoarding.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { SCENE_MAP_RATIO } from '../src/world/streamingWorld.js';
import { MAX_TIME_SCALE, TRAVEL_OPEN_RATE } from '../src/systems/timeScale.js';

const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
const rad = (d) => (d * Math.PI) / 180;
/** Her helm taken - `hull`, rig `variant`, `handling` - in a wind of `len` blowing `off` degrees round from her bow's way,
 *  held there; `dt` the frame. */
function helmOn(hull, { handling = 'responsive', off = 90, len = 1.5, variant = 0, settings = {}, dt = 1 / 60 } = {}) {
  const s = scene({ settings });
  s.deps.handling = () => handling;
  s.deps.dt = () => dt;
  const boat = s.helm(s.place(hull, variant));
  const w = [-len * Math.sin(rad(off)), 0, -len * Math.cos(rad(off))];
  const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
  hold();
  const run = (secs) => { for (let t = 0; t < secs - 1e-9; t += dt) { hold(); s.frame(); } };
  const way = () => Math.hypot(...s.rt.state.MoveVectorCurrent);
  /** Frames until her way is under `floor` (300 s at most): the seconds and the metres it took. */
  const coast = (floor = 2.5, frame = () => s.frame()) => {
    const p0 = [...boat.GameObject.position];
    let t = 0;
    while (way() > floor && t < 300) { hold(); frame(); t += s.deps.dt(); }
    const p = boat.GameObject.position;
    return { t, d: Math.hypot(p[0] - p0[0], p[2] - p0[2]) };
  };
  return { s, boat, hold, run, way, coast };
}
/** Full way under sail - a minute of it. */
function underWay(hull, o = {}) {
  const h = helmOn(hull, o);
  h.s.rt.RaiseSails();
  h.run(60);
  return h;
}

// ═══ XA1: THE OARS GATHER WAY; HER CANVAS'S WAY COMES OFF AT HER COAST ═════════════════════════════════════════════

test('AUDIT SHIPS 2 XA1 under the responsive helm the oars\' rate GATHERS way, and a way above what they make - her canvas\'s, no oar made it - is lost no slower than her coast: a galleon struck from full way and rowed on (the journey\'s autorun, a sea leg\'s oars) comes down to BOARD_SPEED as her coast does, in the rated wind and the sea\'s strongest; at the oars\' rate both ways (AUDIT SHIPS A5\'s autorun) she took 48 s and 400 m in the rated wind and 105 s and 1.6 km in the storm, and the journey\'s hand ran her aground on it; under the mod\'s own helm its own rate stands (mutants: the oars\' rate both ways)', () => {
  for (const len of [1.5, 3]) {
    const rowed = underWay(HULL.SmallShip, { len, dt: 0.25 });
    const drift = underWay(HULL.SmallShip, { len, dt: 0.25 });
    rowed.s.rt.LowerSails(); rowed.s.deps.input.toggleAutorun = true;
    drift.s.rt.LowerSails();
    const a = rowed.coast(), b = drift.coast();
    assert.ok(a.t <= b.t + 0.25 && a.d <= b.d + 2, `wind ${len}: struck and rowed, ${a.t.toFixed(1)} s and ${a.d.toFixed(0)} m - her coast's ${b.t.toFixed(1)} s and ${b.d.toFixed(0)} m`);
    assert.ok(a.t <= (len > 2 ? 30 : 15), `wind ${len}: never the oars' rate (${a.t.toFixed(1)} s)`);
    // her oars still gather their own way at their own rate: rowed on, she comes to their way and holds it
    rowed.run(10);
    near(rowed.way(), Math.hypot(...rowed.s.rt.state.velocityTarget), 0.05, 'the oars\' way, gathered');
  }
  // the mod's own helm: its rowing takes her way off at its oars' rate, as the mod does
  const c = underWay(HULL.SmallShip, { handling: 'classic', dt: 0.25 });
  c.s.rt.LowerSails(); c.s.deps.input.toggleAutorun = true;
  c.run(0.5);
  const oar = c.s.rt.properties.moveAccel();
  const r = helmOn(HULL.SmallShip, { handling: 'classic' });
  r.s.rt.state.oarThrottle = 1;
  near(oar, r.s.rt.properties.moveAccel(), 1e-9, 'under Classic: the oars\' rate both ways');
});

// ═══ XA7: HER CANVAS'S SHARE OF HER WAY ════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XA7 a coast takes her rig\'s gain in the share of her way her canvas made (`sailWay`) - gathered under canvas, lost in its share, saved with her way: struck through the ladder\'s oars\' rung, or saved and loaded mid-coast, a galleon and a Large Boat coast as End strikes them; a frame of sail over her oars\' way coasts as her oars at rest do; a flag of the arm that drove her last coasted the first two ungained (19.6 s to 2.5 m/s, not 12.0) and the last gained (mutants: the whole gain on any share; the share not saved; gathered by any arm)', () => {
  for (const [hull, variant] of [[HULL.SmallShip, 0], [HULL.LargeBoat, 2]]) {
    const end = underWay(hull, { variant });
    end.s.frame({ press: [BOAT_ACTIONS.toggleSail] });
    const a = end.coast();
    // the ladder: S (sails struck, the oars pulling ahead), S again half a second on (the oars at rest)
    const lad = underWay(hull, { variant });
    lad.s.frame({ press: ['MoveBackwards'] });
    assert.equal(lad.s.rt.state.oarThrottle, 1, 'the oars\' rung');
    lad.run(0.5);
    lad.s.frame({ press: ['MoveBackwards'] });
    const b = lad.coast();
    assert.ok(b.t <= a.t + 0.1, `hull ${hull}: the ladder's coast gained (${b.t.toFixed(2)} s against End's ${a.t.toFixed(2)})`);
    // saved mid-coast and loaded
    const sav = underWay(hull, { variant });
    sav.s.frame({ press: [BOAT_ACTIONS.toggleSail] });
    sav.run(0.5);
    const record = JSON.parse(JSON.stringify(sav.s.rt.getSaveData()));
    assert.ok(record.sailWay > 0, 'her canvas\'s way saved with her way');
    const ld = helmOn(hull, { variant });
    ld.s.rt.restoreSaveData(record);
    const c = ld.coast(), d = sav.coast();
    near(c.t, d.t, 0.05, `hull ${hull}: loaded, the coast unsaved`);
    // her oars' way, a frame of sail over it, struck: her oars' coast
    const oars = helmOn(hull, { variant });
    oars.s.rt.state.oarThrottle = 1; oars.run(30); oars.s.rt.state.oarThrottle = 0;
    const rest = helmOn(hull, { variant });
    rest.s.rt.state.oarThrottle = 1; rest.run(30); rest.s.rt.state.oarThrottle = 0;
    oars.s.rt.RaiseSails(); oars.hold(); oars.s.frame(); oars.s.rt.LowerSails();
    near(oars.coast(0.5).t, rest.coast(0.5).t, 0.1, `hull ${hull}: a frame of sail over her oars' way coasts as her oars at rest`);
  }
  // the share: a coast of her canvas's way is her rig's whole gain, of her oars' none
  const g = underWay(HULL.SmallShip);
  g.s.rt.LowerSails();
  const coastOf = (h) => h.s.rt.properties.moveAccel();
  const plain = (() => { const h = helmOn(HULL.SmallShip); h.s.rt.state.oarThrottle = 1; h.run(5); h.s.rt.state.oarThrottle = 0; return coastOf(h); })();
  near(coastOf(g), plain * sailFreeGain(g.boat), 1e-4, 'her canvas\'s way: the gain whole');
  assert.ok(HELM_WAY.coast > 1);
});

// ═══ XA5: THE HEAVE-TO'S BRAKE, ONE BOUND ══════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XA5 a heave-to\'s brake never asks past the runtime\'s own bound (CSA_BRAKE_MAX), so the run it is offered by (heaveToRun) is the run she makes: a galleon and a Carrack at full way on her beam and her quarter in the rated wind and in the sea\'s strongest come under BOARD_SPEED where heaveToRun says - within HEAVE_TO_M where her way allows it, and within HEAVE_TO_S; asked up to 47 m/s^2 and braked at 20, a storm\'s Carrack ran 37 m where 20 was reckoned, past BOARD_RANGE (mutants: the brake unbounded)', () => {
  for (const len of [1.5, 3]) for (const hull of [HULL.SmallShip, HULL.Carrack]) for (const off of [90, 135]) {
    const h = underWay(hull, { off, len, dt: 0.25 });
    const v0 = h.way();
    h.s.deps.dt = () => 1 / 60;
    h.s.rt.LowerSails();
    const decel = heaveToDecel(v0);
    assert.ok(decel <= CSA_BRAKE_MAX, `never past the runtime's bound (${decel.toFixed(1)})`);
    h.s.deps.brake = () => decel;
    const { t, d } = h.coast(BOARD_SPEED);
    near(d, heaveToRun(v0), 1, `wind ${len} hull ${hull} off ${off} at ${v0.toFixed(1)} m/s: the run reckoned`);
    if (heaveToDecel(v0) < CSA_BRAKE_MAX) assert.ok(d <= HEAVE_TO_M + 1, `within HEAVE_TO_M (${d.toFixed(1)} m)`);
    assert.ok(t <= HEAVE_TO_S, `in ${t.toFixed(2)} s`);
  }
});

// ═══ XA6: A STORM SHIP'S WORD THROUGH THE DOOR ═════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XA6 a boat\'s word is never dropped for her way: every way SAIL-FREE gives a galleon, a Carrack and a Large Galley - every heading, the rated wind to the sea\'s strongest - at an open journey\'s x60 and a road\'s x100 passes the door, and the door\'s bound covers the fastest of them at the Handling dials\' tenfold; the writer holds a way past it to it; at 64k natives a second, 27 m/s of way at x60, every reader dropped a storm galleon\'s word whole and her boats were gone from every screen (mutants: the old bound; the writer unheld)', () => {
  const toWire = (p) => [p[0] * SCENE_MAP_RATIO, p[1], p[2] * SCENE_MAP_RATIO];
  let fastest = 0;
  for (const hull of [HULL.SmallShip, HULL.Carrack, HULL.LargeGalley]) for (const len of [1.5, 3]) for (const off of [0, 60, 90, 135, 180]) {
    const h = helmOn(hull, { off, len, dt: 0.5 });
    if (h.boat.Sails.length) h.s.rt.RaiseSails();
    h.run(80);
    const way = h.s.rt.helmMotion();
    fastest = Math.max(fastest, Math.hypot(way.velocity[0], way.velocity[2]));
    for (const scale of [TRAVEL_OPEN_RATE, MAX_TIME_SCALE]) {
      const view = [{ hull, variant: 0, position: [100, 34, 200], rotation: h.boat.GameObject.rotation, sails: 1, helm: true, light: false, velocity: way.velocity.map((x) => x * scale), turn: way.turn * scale }];
      assert.ok(validCsaRecord(JSON.parse(JSON.stringify(csaWireRecord(view, toWire)))), `hull ${hull} wind ${len} off ${off} at x${scale}: her word passes`);
    }
  }
  assert.ok(fastest > 30, `a storm's way (${fastest.toFixed(1)} m/s)`);
  // the bound: the fastest at the dials' tenfold, her Rigging at its best (+12%), at the world's fastest scale
  assert.ok(fastest * 1.12 * 10 * MAX_TIME_SCALE * SCENE_MAP_RATIO < CSA_WIRE_SPEED_MAX, 'the door\'s bound past its ceiling');
  // past the bound, the writer holds her to it - her way's bearing kept
  const rec = csaWireRecord([{ hull: HULL.Carrack, variant: 0, position: [0, 34, 0], rotation: [0, 0, 0, 1], sails: 1, helm: true, light: false, velocity: [CSA_WIRE_SPEED_MAX, 0, CSA_WIRE_SPEED_MAX], turn: 1e6 }]);
  assert.ok(validCsaRecord(JSON.parse(JSON.stringify(rec))), 'held to the door');
  near(rec.m[0][0], rec.m[0][1], 0.01, 'her bearing kept');
});
