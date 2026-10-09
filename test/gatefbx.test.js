// GATE-FBX (2026-10-09, Mac, sending Oblivion_Gate.fbx: "I want to replace the oblivion gate model with this handcrafted
// model which also needs texturing. Additionally, on the onside of the oblivion gate, remove the portal that players walk
// through on the inside and just use a portal that opens and closes. Like at the end of the fight"); and AUDIT GATE-FBX
// (2026-10-09, Mac: "Audit this"). Design: bible/11-Multiplayer/World-Bosses.md sections 3, 4 and 22.
//
//   THE BAKE          tools/bakeGate.mjs over tools/shipBake.mjs: the one object of Mac's scene, re-made to the byte,
//                     through the port's handedness mirror
//   THE SOLIDS        world/gateModel.js gateSolids / insideGateStone, scenes/gatePool.js inGateRoot - a body sealed in
//                     the stone as it stands whole
//   THE RISE          scenes/gatePool.js gatePlacement - sunk whole before it rises, on a slope too
//   THE COURT'S FIRE  world/gateArena.js wayInStep / portalFade, scenes/gateCourt.js the way in (my arrival, another's
//                     step out of it), the way home, the court gone silent, render/gatePass.js fireOnly and its foot
// The stone itself, its art and its opening: test/wb2_gate.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeGate, assertAlone, toGate, SOURCE_FBX, OUT, OBJECT, FRAME } from '../tools/bakeGate.mjs';
import { bakeJson, sceneObjects } from '../tools/shipBake.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { buildGateModel, gateSolids, gateSpines, insideGateStone, GATE_HEIGHT, GATE_HALF_W, GATE_FOOT_SINK, ARCH_Y0, ARCH_Y1 } from '../src/world/gateModel.js';
import { inGateRoot, gatePlacement, SEALED_AT, RISE_SLACK_M } from '../src/scenes/gatePool.js';
import {
  courtToDungeon, wayInStep, portalFade, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_CLOSE_MS, PORTAL_DROP, WAY_IN_Z, WAY_IN_HOLD_MS,
  WAY_IN_OPEN_MS, WAY_IN_NEAR_M, ARRIVE_Z, COURT_SILENT_MS, COURT_FRAME_GAP_MS, COURT_TEXT,
} from '../src/world/gateArena.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { GatePassRenderer, membraneVertices, MEMBRANE_FS, FIRE_FOOT_Y } from '../src/render/gatePass.js';
import { gateArt, GATE_ARCHIVE } from '../src/world/gateArt.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { gateTimes, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { COURT_R } from '../src/net/gateBrain.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
const tree = readFbx(bytes);

// ═══ THE BAKE ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-FBX the bake: Mac\'s scene baked into the gate\'s frame is the file committed, byte for byte - its source, hash and frame carried, the one object read; its feet on the ground and its lintel\'s middle over the threshold; AUDIT GATE-FBX G5: the frame a MIRROR in the numbers - Blender\'s right hand into the world\'s left (world/mat4.js THE HANDEDNESS LAW), so the gate stands as Mac drew it - every polygon reversed with it, as a ship\'s (mutants: the frame\'s ground unread; the turn that mirrored the gate; the winding left)', () => {
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
  // the mirror: (X, Y, Z) scene to (X, Z, Y) - the determinant of the map is -1, as tools/shipBake.mjs toBoat's
  const o = toGate([FRAME.x, FRAME.y, FRAME.ground]);
  assert.deepEqual(o.map((v) => v + 0), [0, 0, 0]);
  const ex = toGate([FRAME.x + 1, FRAME.y, FRAME.ground]).map((v, k) => v - o[k]);
  const ey = toGate([FRAME.x, FRAME.y + 1, FRAME.ground]).map((v, k) => v - o[k]);
  const ez = toGate([FRAME.x, FRAME.y, FRAME.ground + 1]).map((v, k) => v - o[k]);
  const det = ex[0] * (ey[1] * ez[2] - ey[2] * ez[1]) - ex[1] * (ey[0] * ez[2] - ey[2] * ez[0]) + ex[2] * (ey[0] * ez[1] - ey[1] * ez[0]);
  assert.ok(det < 0, 'a mirror in the numbers - his gate in the left-handed world');
  assert.deepEqual(ez.map((v) => +v.toFixed(6)), [0, FRAME.scale, 0], 'the scene\'s up is the gate\'s');
  assert.deepEqual(ey.map((v) => +v.toFixed(6)), [0, 0, FRAME.scale], 'his scene\'s Y the world\'s z, the same way');
  // and every polygon reversed through it: each baked polygon is Mac's, corner for corner, backwards
  const gate = sceneObjects(tree, (name) => name === OBJECT).find((x) => x.name === OBJECT);
  assert.deepEqual(baked.parts[0].polygons, gate.polygons.map((p) => [...p].reverse()));
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

// ═══ THE SOLIDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATE-FBX E1/E2 the stone\'s solids: the lintel and both pillars on their sunk feet each closed - every edge met twice, once each way - and wound out (a positive volume), each spine capped at its root; a body is sealed in where its capsule\'s axis stands in them - a foot, its overhang over a head, a pillar high up on a hillside, the lintel - and free in the threshold to its edge, before a foot and in the opening (mutants: a sole wall wound inward; the stone asked to 2.8 m alone; a spine left open)', () => {
  const solids = gateSolids();
  assert.equal(solids.length, 3 + gateSpines().length, 'the lintel, two pillars, six spines');
  const vol = (T) => { let v = 0; for (let i = 0; i < T.length; i += 9) v += (T[i] * (T[i + 4] * T[i + 8] - T[i + 5] * T[i + 7]) - T[i + 1] * (T[i + 3] * T[i + 8] - T[i + 5] * T[i + 6]) + T[i + 2] * (T[i + 3] * T[i + 7] - T[i + 4] * T[i + 6])) / 6; return v; };
  const closed = (T) => {
    const k = (i) => `${Math.fround(T[i])},${Math.fround(T[i + 1])},${Math.fround(T[i + 2])}`;
    const edges = new Map();
    for (let i = 0; i < T.length; i += 9) for (let e = 0; e < 3; e++) { const a = k(i + e * 3), b = k(i + ((e + 1) % 3) * 3); edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1); }
    for (const [ab, n] of edges) { const [a, b] = ab.split('>'); if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false; }
    return true;
  };
  const big = solids.filter((T) => T.length / 9 > 8);   // the spines are four triangles, their caps' winding their own
  assert.equal(big.length, 3);
  for (const T of big) { assert.ok(closed(T), 'closed, every edge once each way'); assert.ok(vol(T) > 1, `wound out (${vol(T).toFixed(2)} m3)`); }
  assert.deepEqual(SEALED_AT, [CAPSULE_RADIUS, 0.9, 1.8 - CAPSULE_RADIUS], 'the capsule\'s axis');
  const place = { origin: [0, 0, 0], yaw: 0 };
  for (const p of [[-2.3, 0, 0], [2.3, 0.2, 0.3], [-4.6, 0, 0], [4.6, 3.2, 0], [4.8, 6, 0], [-5, 4, 0.3], [0, 14.5, 0]]) assert.ok(inGateRoot(place, p), `${p} is sealed`);
  for (const p of [[0, 0, 0], [1.0, 0, 0], [-1.1, 0, 0.3], [2.3, 0, 1.6], [-7.3, 0, 0], [0, 0, 3], [0, 6, 0], [-2.6, 2.95, 0]]) assert.equal(inGateRoot(place, p), false, `${p} is free`);
  assert.equal(insideGateStone([0, 15, 0]), true, 'the lintel');
  assert.equal(insideGateStone([0, 12, 0]), false, 'under it');
  // a spine, closed at its root: inside it sealed; beside it, where a ray up through its open root would have counted
  // one face and called the air stone, free
  assert.equal(insideGateStone([-6, 4.75, 0]), true, 'in a spine');
  assert.equal(insideGateStone([-7.75, 2.25, -2.5]), false, 'beside the spines, outside them');
  assert.equal(inGateRoot(place, [-7.75, 1.65, -2.5]), false, 'a body beside the spines, free');
});

test('AUDIT GATE-FBX E3 the rise: sunk whole before it rises - its crown RISE_SLACK_M under the ground at the middle, and on a slope across the arch under the ground at its ends too; risen, it stands on the ground (mutants: the ends unasked; its crown flush with the ground)', () => {
  const T = gateTimes(2100);
  const g = { day: 2100, px: 1, py: 1, spot: [0, 0], phase: 'rising', t: T, fellAt: null };
  const slope = (x) => 0.25 * x;   // 14 degrees across x
  const flat = gatePlacement(g, { pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: T.riseAt });
  assert.ok(Math.abs(flat.origin[1] + GATE_HEIGHT + RISE_SLACK_M) < 1e-9, 'its crown under the ground');
  const at = gatePlacement(g, { pixelTranslation: () => [0, 0, 0], heightAt: (x) => slope(x), now: T.riseAt });
  const m = buildGateModel(), P = m.positions, c = Math.cos(at.yaw), s = Math.sin(at.yaw);
  let bare = 0;
  for (let i = 0; i < P.length; i += 3) {
    const x = at.origin[0] + c * P[i] + s * P[i + 2], y = at.origin[1] + P[i + 1], z = at.origin[2] - s * P[i] + c * P[i + 2];
    if (y > slope(x)) bare++;
  }
  assert.equal(bare, 0, 'not a corner of it over the ground before it rises');
  const unbuilt = gatePlacement(g, { pixelTranslation: () => [0, 0, 0], heightAt: (x, z) => (Math.hypot(x, z) < 1 ? 0 : NaN), now: T.riseAt });
  assert.ok(Math.abs(unbuilt.origin[1] + GATE_HEIGHT + RISE_SLACK_M) < 1e-9, 'its ends\' ground unknown: under the middle\'s all the same');
  const risen = gatePlacement({ ...g, phase: 'sealed' }, { pixelTranslation: () => [0, 0, 0], heightAt: (x) => slope(x), now: T.riseAt + 30_000 });
  assert.equal(risen.origin[1], 0, 'risen, on the ground at its middle');
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

/** A court driven by hand (test/wbx_gate_fixes.test.js's shape), with the step's veil to lift and my feet to move. */
function court(over = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, veil = { on: true }, doors = [], me = { at: courtToDungeon(0, 0, ARRIVE_Z) };
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, veiled: () => veil.on,
    feet: () => me.at, player: () => ({ health: 100, maxHealth: 100, level: 12 }),
    portalDoor: (d) => doors.push(d), ...over,
  });
  return { c, link, clock, veil, doors, me };
}
const DAY = 700;
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: DAY, boss: 'ruhn', hp: 900, max: 1000, fighters: 1, wrathAt: 9e15, ...over });
const at = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };
const run = (h, from, to, st) => { for (let t = from; t <= to; t += 1000) at(h, t, typeof st === 'function' ? st(t) : st); };

test('GATE-FBX the way in: shut under the step\'s veil, whole as it lifts (I came through it), held WAY_IN_HOLD_MS and closed behind me; never a door: it takes nobody back; out of the court and in again, it opens again. AUDIT GATE-FBX C4: held from my ARRIVAL, however late the fight\'s first word comes - in the hold it stands whole, after it it is shut, never a flash of fire (mutants: open under the veil; never closing; the hold from the first word; a late word flashing it)', () => {
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
  assert.deepEqual(h.doors, [], 'no door laid for it');
  assert.equal(h.c.state().wayIn, 0);
  // out of the court (the host's link forgets the fight) and in again: the way in opens for the new entry
  h.me.at = null;
  at(h, 40_000, GATE_STATE_EMPTY);
  h.me.at = courtToDungeon(0, 0, ARRIVE_Z); h.veil.on = true;
  at(h, 41_000, state());
  assert.equal(h.c.wayIn(), 0, 'under the step\'s veil again');
  h.veil.on = false;
  at(h, 41_100, state());
  assert.equal(h.c.wayIn(), 1, 'stepping in again');
  // C4: the fight's first word late - the hold is my arrival's
  const k = court();
  k.veil.on = false;
  at(k, 5_000);   // no state yet: arrived all the same
  assert.equal(k.c.wayIn(), 0, 'no fight said yet, nothing drawn');
  at(k, 5_000 + WAY_IN_HOLD_MS / 2, state());
  assert.equal(k.c.wayIn(), 1, 'the word came within the hold: whole');
  at(k, 5_000 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS + 200, state());
  assert.equal(k.c.wayIn(), 0, 'and shut on my arrival\'s time');
  const l = court();
  l.veil.on = false;
  at(l, 5_000);
  at(l, 5_000 + WAY_IN_HOLD_MS + 1, state());
  assert.equal(l.c.wayIn(), 0, 'the word came after the hold: shut, never flashed open');
});

test('AUDIT GATE-FBX C3 another stepping in: the way in opens for a player seen in the court this look and not the last, within WAY_IN_NEAR_M of where the players arrive - a fighter walking back in among them (the relay\'s count of fighters it replaces came a state late and never rose for one); the first look after my arrival only learns who is here; one seen far from the arrival, one still standing, one with no place, a look before my arrival - none opens it (mutants: the first look opening it; the far one opening it; a returner never seen stepping in)', () => {
  const h = court();
  const ARR = courtToDungeon(0, 0, ARRIVE_Z), far = courtToDungeon(0, 0, ARRIVE_Z - WAY_IN_NEAR_M - 1);
  const look = (t, ...list) => { h.clock.t = t; h.c.stepsIn(list, (d) => d.at); };
  const A = { id: 'a', at: ARR }, B = { id: 'b', at: far }, C = { id: 'c', at: far }, D = { id: 'd', at: ARR }, E = { id: 'e', at: null };
  look(9_000, D);   // before my arrival: nothing learnt
  at(h, 10_000, state());
  h.veil.on = false;
  at(h, 10_100, state());
  at(h, 10_100 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS + 100, state());
  assert.equal(h.c.wayIn(), 0, 'shut behind me');
  look(20_000, A, null, B);
  at(h, 21_000, state());
  assert.equal(h.c.wayIn(), 0, 'the first look learns who is here');
  look(22_000, A, B, C, E);
  at(h, 23_000, state());
  assert.equal(h.c.wayIn(), 0, 'one seen far from the arrival came another way; one with no place, nowhere');
  look(24_000, A, B, C, E, D);
  at(h, 24_000 + WAY_IN_OPEN_MS, state());
  assert.equal(h.c.wayIn(), 1, 'another stepped out of it: open');
  at(h, 24_000 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS + 100, state());
  assert.equal(h.c.wayIn(), 0, 'and shut behind them');
  look(30_000, A, B, C, D);
  at(h, 31_000, state());
  assert.equal(h.c.wayIn(), 0, 'those still standing open nothing');
  look(32_000, A, B, C);   // d walks out of the court ...
  at(h, 33_000, state());
  assert.equal(h.c.wayIn(), 0, 'one gone opens nothing');
  look(34_000, A, B, C, D);   // ... and back in
  at(h, 34_000 + WAY_IN_OPEN_MS, state());
  assert.equal(h.c.wayIn(), 1, 'a fighter walking back in: open');
  assert.deepEqual(h.doors, []);
});

test('AUDIT GATE-FBX C2/C3 the host: /unstuck in a gate\'s court is refused in its own words, before any other way of it (it walked out mid-fight with no veil, no toll, no cooldown spent on a death); and every player in the court\'s room - the crowd\'s cut or not - is handed to the way in each online frame, in the court alone (mutants: /unstuck walking out of the court; the crowd\'s cut handed)', () => {
  const ws = read('src/scenes/world.js');
  const un = ws.indexOf('if (modes?.gateArenaDay?.() != null) { say(COURT_TEXT.noUnstuck); return true; }');
  assert.ok(un > 0, 'refused in the court');
  assert.ok(un > ws.indexOf('if (/^\\/unstuck(\\s+cancel)?$/i.test(text.trim())) {') && un < ws.indexOf('const inZone = wildHere() && !(TEST_GODMODE && staffPowers().god);'), 'before the zone\'s and the town\'s ways');
  assert.match(COURT_TEXT.noUnstuck, /Deadlands/);
  assert.match(ws, /\n {4}if \(modes\?\.gateArenaDay\?\.\(\) != null\) gateCourt\?\.stepsIn\(drawable, \(d\) => \(d\?\.shown \? onlineToScene\(d\.shown\) : null\)\);/, 'the room\'s every player, in the court');
  assert.ok(ws.indexOf('gateCourt?.stepsIn(drawable') > ws.indexOf('const visiblePeers = gateCrowd.cut('), 'beside the crowd\'s cut, never through it');
});

test('AUDIT GATE-FBX C1 the court gone silent: standing in it, my frames seeing no word of its fight for COURT_SILENT_MS - no state at all, or one whose heardAt never moves - it is silent, and the host casts me out by the way that is lost (no door stands in it until he falls); each word keeps it alive; a fallen Warden\'s court (his portal stands) or the Wrath\'s, never; a frame COURT_FRAME_GAP_MS after the last (a screen asleep) counts none; under the step\'s veil or out of the court, never (mutants: the silence never counted; the sleeping screen counted)', () => {
  const h = court();
  h.veil.on = false;
  run(h, 1_000, 1_000 + COURT_SILENT_MS);   // no state: the link holds none
  assert.equal(h.c.silent(), false, 'COURT_SILENT_MS, and not past it');
  at(h, 1_000 + COURT_SILENT_MS + 1_000);
  assert.equal(h.c.silent(), true, 'no word: silent');
  h.me.at = null;
  at(h, 1_000 + COURT_SILENT_MS + 2_000);
  assert.equal(h.c.silent(), false, 'out of the court, forgotten');
  const w = court();
  w.veil.on = false;
  run(w, 1_000, 61_000, (t) => state({ heardAt: Math.floor(t / 5_000) * 5_000 }));
  assert.equal(w.c.silent(), false, 'a word every STATE_SEND_MS');
  run(w, 62_000, 62_000 + COURT_SILENT_MS + 5_000, state({ heardAt: 60_000 }));
  assert.equal(w.c.silent(), true, 'the relay stalled: its last word never moves');
  at(w, 88_000, state({ heardAt: 60_000, fell: { at: 80_000, top: ['Mac'], n: 1 } }));
  assert.equal(w.c.silent(), false, 'he fell: nothing more to say, and his portal stands');
  at(w, 89_000, state({ heardAt: 60_000, wrath: 85_000 }));
  assert.equal(w.c.silent(), false, 'the Wrath has its own way out');
  const z = court();
  z.veil.on = false;
  run(z, 1_000, 15_000);
  at(z, 45_000);   // the screen slept 30 s
  assert.equal(z.c.silent(), false, 'a sleeping screen\'s gap counts none');
  assert.ok(COURT_FRAME_GAP_MS < 30_000);
  run(z, 46_000, 45_000 + COURT_SILENT_MS);
  assert.equal(z.c.silent(), false);
  at(z, 45_000 + COURT_SILENT_MS + 1_000);
  assert.equal(z.c.silent(), true, 'silent on its waking frames');
  const v = court();
  run(v, 1_000, 2 * COURT_SILENT_MS);
  assert.equal(v.c.silent(), false, 'under the step\'s veil: not arrived');
  const ws = read('src/scenes/world.js');
  assert.match(ws, /else if \(courtDay != null && gateCourt\?\.silent\(\)\) ejectFromCourt\(COURT_TEXT\.lost\);/, 'the host casts me out by the lost way');
  assert.ok(ws.indexOf('gateCourt?.silent()') < ws.indexOf("try { gateCourt?.frame(); } catch (e) { console.warn('[gate] court', e?.message ?? e); }   // WB4"), 'before the court\'s frame');
  assert.match(COURT_TEXT.lost, /lost/);
});

test('AUDIT GATE-FBX C5 the court\'s one door first: a step of the fight\'s own that throws every frame (the host swallows it, scenes/world.js) still leaves the way home risen and its door laid (mutants: the door after the fight\'s steps)', () => {
  const h = court({ spoils: { frame() { throw new Error('a spark gone wrong'); }, gather() {}, drawPass: () => false, lights: () => [] } });
  h.veil.on = false;
  h.link.st = state({ fell: { at: 100_000, top: ['Mac'], n: 1 } });
  h.clock.t = 100_000 + PORTAL_AFTER_MS + PORTAL_RISE_MS;
  assert.throws(() => h.c.frame(), /a spark gone wrong/);
  assert.equal(h.doors.length, 1, 'laid all the same');
  assert.equal(h.c.portal().rise, 1, 'and risen');
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

test('GATE-FBX the court\'s fire drawn: the way in is the gate\'s own fire ALONE - no beacon over the bridge each time a fighter steps through - and the way home its fire and its beacon, both in the one pass; AUDIT GATE-FBX P1: the court driven hands its pass one list - the way in alone, fireOnly, at the bridge\'s foot while it stands and nothing once it is shut; the way home where he fell, and the way in beside it while another steps through (mutants: the way in\'s beacon drawn; the way in handed with a beacon)', () => {
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
  // the court driven: what it hands its pass
  const got = [], was = GatePassRenderer.prototype.draw;
  GatePassRenderer.prototype.draw = function (list) { got.push(list.map((f) => ({ ...f, origin: [...f.origin] }))); this.drawn = list.length; };
  try {
    const h = court({ gl: fakeGl().gl });
    const draw = () => { got.length = 0; h.c.drawPass(I, I, [0, 0, 0], 1); return got[0] ?? []; };
    h.veil.on = false;
    at(h, 10_000, state());
    const way = courtToDungeon(0, -PORTAL_DROP, WAY_IN_Z);
    let L = draw();
    assert.equal(L.length, 1, 'the way in, alone');
    assert.deepEqual([L[0].origin, L[0].fade, L[0].fireOnly], [way, 1, true], 'at the bridge\'s foot, whole, its fire alone');
    at(h, 10_000 + WAY_IN_HOLD_MS + PORTAL_CLOSE_MS + 100, state());
    assert.deepEqual(draw(), [], 'shut: nothing handed');
    const fell = 100_000, s = state({ x: 6, z: -4, fell: { at: fell, top: ['Mac'], n: 2 } });
    h.c.stepsIn([{ id: 'a' }], () => null);
    at(h, fell + PORTAL_AFTER_MS + PORTAL_RISE_MS, s);
    h.clock.t += 100;
    h.c.stepsIn([{ id: 'a' }, { id: 'b' }], () => courtToDungeon(0, 0, ARRIVE_Z));
    at(h, h.clock.t + WAY_IN_OPEN_MS, s);
    L = draw();
    assert.equal(L.length, 2, 'the way home and the way in, one list');
    assert.deepEqual([L[0].origin, L[0].fade, !!L[0].fireOnly], [courtToDungeon(6, -PORTAL_DROP, -4), 1, false], 'the way home where he fell, with its beacon');
    assert.deepEqual([L[1].origin, L[1].fireOnly], [way, true]);
  } finally { GatePassRenderer.prototype.draw = was; }
});

test('AUDIT GATE-FBX E5 the fire\'s foot: down between the feet\'s sunk soles (GATE_FOOT_SINK under the gate\'s ground) - its quad and its mask both - so on a slope across the arch the ground cuts it and no light shows under it; its width there the threshold\'s (mutants: the mask\'s foot at the gate\'s ground)', () => {
  assert.equal(FIRE_FOOT_Y, ARCH_Y0 - GATE_FOOT_SINK);
  assert.ok(GATE_FOOT_SINK >= Math.tan(10 * Math.PI / 180) * GATE_HALF_W / 2, 'deep enough for the downhill side at 10 degrees');
  const V = membraneVertices(), ys = V.filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)].map((v) => +v.toFixed(4)), [+FIRE_FOOT_Y.toFixed(4), +ARCH_Y1.toFixed(4)]);
  assert.ok(MEMBRANE_FS.includes(`if (vLocal.y < ${FIRE_FOOT_Y.toFixed(4)} || vLocal.y > ${ARCH_Y1.toFixed(4)}) discard;`), 'the mask down to it');
  assert.match(MEMBRANE_FS, /clamp\(\(y - [-\d.]+\) \/ [\d.]+, 0\.0, 1\.0\)/, 'under the threshold, the threshold\'s width');
});

test('AUDIT GATE-FBX G4 the stone\'s glow is its own colour: every upload of a gate\'s or its court\'s emission (the street\'s gate, the court\'s, the rite\'s, the broker\'s) hands it WHITE - never tinted by the window light of the night or the dungeon arm\'s day (AUDIT SD II L2 F3\'s law) (mutants: the street gate\'s emission tinted)', () => {
  const sites = [];
  for (const f of ['src/scenes/gatePool.js', 'src/scenes/worldModes.js', 'src/scenes/riteHost.js', 'src/scenes/sigilBrokerPool.js']) {
    for (const m of read(f).matchAll(/uploadEmissionTexture\?\.\((GATE_ARCHIVE|COURT_ARCHIVE), rec, art\.emission(, \{ white: true \})?\)/g)) sites.push([f, m[1], !!m[2]]);
  }
  assert.equal(sites.length, 5, 'the five uploads');
  for (const [f, archive, white] of sites) assert.ok(white, `${f}'s ${archive} emission white`);
  assert.deepEqual(gateArt().map(([rec]) => rec), [0, 1, 3, 4], 'stone, plinth, spine, rim');
  assert.equal(GATE_ARCHIVE, 38101);
});
