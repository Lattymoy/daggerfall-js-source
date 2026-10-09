// GATE-FBX (2026-10-09, Mac, sending Oblivion_Gate.fbx: "I want to replace the oblivion gate model with this handcrafted
// model which also needs texturing. Additionally, on the inside of the oblivion gate, remove the portal that players walk
// through on the inside and just use a portal that opens and closes. Like at the end of the fight"). Design:
// bible/11-Multiplayer/World-Bosses.md section 3 and section 4.
//
//   THE BAKE          tools/bakeGate.mjs over tools/shipBake.mjs: the one object of Mac's scene, re-made to the byte
//   THE ROOTS         world/gateModel.js GATE_ROOT, scenes/gatePool.js ROOT_TRAP - the pillars' feet, read off the bake
//   THE COURT'S FIRE  world/gateArena.js wayInStep / portalFade, scenes/gateCourt.js the way in and the way home,
//                     render/gatePass.js fireOnly - the bridge's membrane gone
// The stone itself, its art and its opening: test/wb2_gate.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeGate, assertAlone, toGate, SOURCE_FBX, OUT, OBJECT, FRAME } from '../tools/bakeGate.mjs';
import { bakeJson, sceneObjects } from '../tools/shipBake.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { buildGateModel, GATE_ROOT, GATE_ROOT_TOP } from '../src/world/gateModel.js';
import { ROOT_TRAP, inGateRoot } from '../src/scenes/gatePool.js';
import {
  courtToDungeon, wayInStep, portalFade, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_CLOSE_MS, PORTAL_DROP, WAY_IN_Z, WAY_IN_HOLD_MS,
  WAY_IN_OPEN_MS, ARRIVE_Z,
} from '../src/world/gateArena.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { GatePassRenderer } from '../src/render/gatePass.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { gateTimes, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { COURT_R } from '../src/net/gateBrain.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
const tree = readFbx(bytes);

// ═══ THE BAKE ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-FBX the bake: Mac\'s scene baked into the gate\'s frame is the file committed, byte for byte - its source, hash and frame carried, the one object read; the frame a turn and never a mirror, its feet on the ground and its lintel\'s middle over the threshold (mutants: the frame\'s ground unread; the mirror)', () => {
  const baked = bakeGate(bytes, tree);
  assert.equal(bakeJson(baked), read(OUT), 're-made to the byte');
  assert.equal(baked.source, SOURCE_FBX);
  assert.equal(baked.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(baked.frame, { ...FRAME });
  assert.deepEqual(baked.parts.map((p) => [p.role, p.object]), [['gate', OBJECT]]);
  const P = baked.parts[0].positions;
  const ys = P.filter((_, i) => i % 3 === 1), xs = P.filter((_, i) => i % 3 === 0);
  assert.equal(Math.min(...ys), 0, 'its feet on the ground');
  assert.ok(Math.abs(Math.max(...ys) - 16.19) < 0.01, 'SCALE 0.53: WB2\'s 16.2 m');
  assert.ok(Math.abs(Math.max(...xs) + Math.min(...xs)) < 0.07, 'the threshold\'s middle at x 0 (the spines stand 6 cm off it, as drawn)');
  // a turn: (X, Y, Z) scene to (X, Z, -Y) - the determinant of the map is +1, so no face is turned over
  const o = toGate([FRAME.x, FRAME.y, FRAME.ground]);
  assert.deepEqual(o.map((v) => v + 0), [0, 0, 0]);
  const ex = toGate([FRAME.x + 1, FRAME.y, FRAME.ground]).map((v, k) => v - o[k]);
  const ey = toGate([FRAME.x, FRAME.y + 1, FRAME.ground]).map((v, k) => v - o[k]);
  const ez = toGate([FRAME.x, FRAME.y, FRAME.ground + 1]).map((v, k) => v - o[k]);
  const det = ex[0] * (ey[1] * ez[2] - ey[2] * ez[1]) - ex[1] * (ey[0] * ez[2] - ey[2] * ez[0]) + ex[2] * (ey[0] * ez[1] - ey[1] * ez[0]);
  assert.ok(det > 0, 'a turn, not a mirror');
  assert.deepEqual(ez.map((v) => +v.toFixed(6)), [0, FRAME.scale, 0], 'the scene\'s up is the gate\'s');
});

test('GATE-FBX the scene: the gate is one object of 1,905 - read alone, every other placed for its box only (one of them is mirrored, and asked nothing); a bake that reads every object still refuses a mirrored one; and a piece standing in the gate\'s box is refused, never dropped (mutants: the unread asked their sense; a piece in the box let through)', () => {
  const only = sceneObjects(tree, (name) => name === OBJECT);
  assert.equal(only.length, 1905);
  const gate = only.find((o) => o.name === OBJECT);
  assert.ok(gate.polygons.length === 60 && !gate.unread);
  assert.ok(only.filter((o) => o !== gate).every((o) => o.unread && o.polygons.length === 0), 'the rest unread');
  assert.ok(only.find((o) => o.name === 'Cube.002').unread, 'the mirrored one among them');
  assert.throws(() => sceneObjects(tree), /Cube\.002's transform mirrors it/, 'read whole, the scene is refused as a ship\'s would be');
  assertAlone(only, gate);
  const intruder = { name: 'Cube.9999', scene: [[gate.scene[0][0], gate.scene[0][1], gate.scene[0][2]]] };
  assert.throws(() => assertAlone([...only, intruder], gate), /Cube\.9999 stands inside the gate's box/);
});

// ═══ THE ROOTS ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-FBX the roots: the pillars\' feet read off the bake - where a body standing as the stone comes up whole is set down before it (AUDIT WBX W1): inside a foot\'s stone, and under the overhang of the pillar over it; never in the threshold\'s middle, nor out past the spines (mutants: the trap a body narrower)', () => {
  const m = buildGateModel(), P = m.positions;
  let lo = Infinity, hi = 0;
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] >= 0 && P[i + 1] <= GATE_ROOT_TOP) { lo = Math.min(lo, Math.abs(P[i])); hi = Math.max(hi, Math.abs(P[i])); }
  assert.ok(Math.abs(GATE_ROOT.x - (lo + hi) / 2) < 1e-4 && Math.abs(GATE_ROOT.halfX - (hi - lo) / 2) < 1e-4, 'the feet\'s reach across x');
  assert.deepEqual(ROOT_TRAP, { x: GATE_ROOT.x, rx: GATE_ROOT.halfX + 0.6, rz: GATE_ROOT.halfZ + 0.6, top: GATE_ROOT_TOP });
  const place = { origin: [0, 0, 0], yaw: 0 };
  for (const p of [[-2.3, 0, 0], [2.3, 0.2, 0.3], [-4.6, 0, 0], [5.5, 1, 1.2], [-1.6, 0, 0]]) assert.ok(inGateRoot(place, p), `${p} is in a root`);
  for (const p of [[0, 0, 0], [0.6, 0, 0], [-7.3, 0, 0], [0, 0, 3], [-3.6, GATE_ROOT_TOP + 0.5, 0]]) assert.equal(inGateRoot(place, p), false, `${p} is free`);
});

// ═══ THE COURT'S FIRE ═══════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-FBX the laws of the court\'s fire: the way in opens over WAY_IN_OPEN_MS while it is held and closes over PORTAL_CLOSE_MS once it is not; the way home rises PORTAL_AFTER_MS into his fall over PORTAL_RISE_MS and closes over the PORTAL_CLOSE_MS before the court comes apart (mutants: the way in never closing; the way home never closing)', () => {
  assert.equal(wayInStep(0, WAY_IN_OPEN_MS / 2, true), 0.5);
  assert.equal(wayInStep(0.5, WAY_IN_OPEN_MS, true), 1, 'whole, and no further');
  assert.equal(wayInStep(1, PORTAL_CLOSE_MS / 4, false), 0.75);
  assert.equal(wayInStep(0.2, PORTAL_CLOSE_MS, false), 0, 'shut, and no further');
  assert.equal(wayInStep(NaN, NaN, true), 0, 'nothing from nothing');
  const fell = 1_000_000, end = 5_000_000;
  assert.equal(portalFade(fell + PORTAL_AFTER_MS - 1, fell, end), 0, 'not while he falls');
  assert.equal(portalFade(fell + PORTAL_AFTER_MS + PORTAL_RISE_MS / 2, fell, end), 0.5, 'rising');
  assert.equal(portalFade(fell + PORTAL_AFTER_MS + PORTAL_RISE_MS, fell, end), 1, 'risen');
  assert.equal(portalFade(end - PORTAL_CLOSE_MS / 2, fell, end), 0.5, 'closing as the court comes apart');
  assert.equal(portalFade(end, fell, end), 0, 'shut when it does');
  assert.equal(PORTAL_DROP, 0, 'the fire on the floor: the gate\'s opening starts on the ground');
  assert.ok(WAY_IN_Z > ARRIVE_Z && WAY_IN_Z < COURT_R, 'the way in at the floor\'s edge by the bridge, behind where the players arrive');
});

/** A court driven by hand (test/wbx_gate_fixes.test.js's shape), with the step's veil to lift. */
function court() {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, veil = { on: true }, doors = [];
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, veiled: () => veil.on,
    feet: () => courtToDungeon(0, 0, ARRIVE_Z), player: () => ({ health: 100, maxHealth: 100, level: 12 }),
    portalDoor: (d) => doors.push(d),
  });
  return { c, link, clock, veil, doors };
}
const DAY = 700;
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: DAY, boss: 'ruhn', hp: 900, max: 1000, fighters: 1, wrathAt: 9e15, ...over });
const at = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };

test('GATE-FBX the way in: shut under the step\'s veil, whole as it lifts (I came through it), held WAY_IN_HOLD_MS and closed behind me; opened again as the relay\'s count of fighters rises - another stepping in - and not as it falls; never a door: it takes nobody back (mutants: open under the veil; never closing; a fighter leaving opens it)', () => {
  const h = court();
  at(h, 10_000, state());
  assert.equal(h.c.wayIn(), 0, 'under the veil, nothing');
  h.veil.on = false;
  at(h, 10_100, state());
  assert.equal(h.c.wayIn(), 1, 'the veil lifted: I stand before the fire I came through');
  at(h, 10_100 + WAY_IN_HOLD_MS - 50, state());
  assert.equal(h.c.wayIn(), 1, 'held');
  at(h, 10_100 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS / 2, state());
  assert.ok(h.c.wayIn() > 0 && h.c.wayIn() < 1, 'closing behind me');
  at(h, 10_100 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS + 200, state());
  assert.equal(h.c.wayIn(), 0, 'shut');
  const t0 = 30_000;
  at(h, t0, state({ fighters: 2 }));
  at(h, t0 + WAY_IN_OPEN_MS, state({ fighters: 2 }));
  assert.equal(h.c.wayIn(), 1, 'another stepped in: open');
  at(h, t0 + WAY_IN_OPEN_MS + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS, state({ fighters: 2 }));
  assert.equal(h.c.wayIn(), 0, 'and shut behind them');
  at(h, 60_000, state({ fighters: 1 }));
  at(h, 61_000, state({ fighters: 1 }));
  assert.equal(h.c.wayIn(), 0, 'a fighter gone opens nothing');
  assert.deepEqual(h.doors, [], 'no door laid for it');
  assert.equal(h.c.state().wayIn, 0);
  // a walk out and back in: the way in opens again for the new entry
  h.c.leave();
  h.veil.on = false;
  at(h, 90_000, state({ fighters: 1 }));
  assert.equal(h.c.wayIn(), 1, 'stepping in again');
});

test('GATE-FBX the way home closes: the portal where he fell stands whole until the PORTAL_CLOSE_MS before the court comes apart (net/gateLaw.js gateTimes\' wrathAt and GATE_COLLAPSE_MS, the host\'s own collapse) and is shut when it does; its door laid once all the while (mutants: the way home never closing)', () => {
  const h = court();
  h.veil.on = false;
  const end = gateTimes(DAY).wrathAt + GATE_COLLAPSE_MS;
  const fell = state({ x: 6, z: -4, fell: { at: end - 600_000, top: ['Mac'], n: 2 } });
  at(h, end - 600_000 + PORTAL_AFTER_MS + PORTAL_RISE_MS, fell);
  assert.equal(h.c.state().portal.fade, 1, 'risen');
  at(h, end - PORTAL_CLOSE_MS - 1, fell);
  assert.equal(h.c.state().portal.fade, 1, 'whole until its close begins');
  at(h, end - PORTAL_CLOSE_MS / 2, fell);
  assert.ok(Math.abs(h.c.state().portal.fade - 0.5) < 1e-9, 'closing');
  at(h, end, fell);
  assert.equal(h.c.state().portal.fade, 0, 'shut as the court comes apart');
  assert.equal(h.doors.length, 1, 'its door laid once');
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('GATE-FBX the court\'s fire drawn: the way in is the gate\'s own fire ALONE - no beacon over the bridge each time a fighter steps through - and the way home its fire and its beacon, both in the one pass; the court hands the way in at the bridge\'s foot, fireOnly (mutants: the way in\'s beacon drawn)', () => {
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, new Float32Array(24).fill(1));
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  pass.draw([{ origin: [0, 0, 0], yaw: 0, open: 1, fade: 1, fireOnly: true }], I, I, [0, 0, 0], 1);
  const beaconAt = (x) => calls.some((c) => c[0] === 'uniform3f' && c[2] === x && calls.indexOf(c) < calls.findIndex((d) => d[0] === 'useProgram' && d[1] === pass.membrane));
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 1, 'the fire alone');
  assert.equal(pass.drawn, 1, 'and counted drawn');
  calls.length = 0;
  pass.draw([{ origin: [7, 0, 0], yaw: 0, open: 1, fade: 1 }, { origin: [9, 0, 0], yaw: 0, open: 1, fade: 1, fireOnly: true }], I, I, [0, 0, 0], 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 3, 'the way home\'s beacon and fire, and the way in\'s fire');
  assert.ok(beaconAt(7) && !beaconAt(9), 'the beacon over the way home alone');
  assert.equal(pass.drawn, 2);
  const gc = read('src/scenes/gateCourt.js');
  assert.match(gc, /const _wayIn = \{ origin: courtToDungeon\(0, -PORTAL_DROP, WAY_IN_Z\), yaw: 0, open: 1, fade: 0, spin: 0, fireOnly: true \};/);
  assert.match(gc, /if \(wayIn > 0\) \{ _wayIn\.fade = wayIn; _wayIn\.spin = spin; _fires\.push\(_wayIn\); \}/);
});
