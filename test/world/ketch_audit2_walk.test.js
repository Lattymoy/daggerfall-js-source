// AUDIT KETCH II (2026-10-26, the owner: "Can you audit the airship raid. Its a buggy mess"; bible/01-Overview/audits/
// Audit-Ketch-II.md): the ship as a place to walk, fall and platform, on the real ship's collider, the real deck host's ride
// (its pose, the lid's and the roof's cast-back, its last ground), the Sailwalk's real Steps and the real PlayerMotor - the
// game's own frame order (scenes/worldModes.js: the ride, the Steps' cast-back on its answer, the motor).
// tools/mutants/ketch_audit2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, TELEPORT_FREEZE_S } from '../../src/player/motor.js';
import { createKetchDeckHost, createKetchDeck, ketchOnRoof, ketchSkyLanding } from '../../src/scenes/ketch/ketchDeckHost.js';
import { createSdSteps, sdBreathBand, SD_BREATH_BAND_M } from '../../src/scenes/superDungeon/sdSteps.js';
import { castBackTo, spanAt, SD_COURSE } from '../../src/world/superDungeon/sdSteps.js';
import { buildKetchShip, KT_HOUSE, KT_LID_Y } from '../../src/world/ketch/ketchModel.js';
import { ketchShipLocation } from '../../src/world/ketch/ketchShip.js';
import { KT_STAGE } from '../../src/net/ketch/ketchLaw.js';
import {
  KT_COURSE, KT_BRIDGE, KT_MAIN_TOP, KT_ENGINE, KT_HOLD, KT_SOCKETS, KT_ARRIVE, KT_WAIST, KT_COURSE_SPEC, deckToDungeon, dungeonToDeck,
} from '../../src/net/ketch/ketchDeck.js';

/** The ship at stage `sg` (its fight `ws`): the frame, the feet, a spawn, and what was cast back and where it was stood. */
function rig(sg, ws = null) {
  const col = new Collider(() => -Infinity);
  const V = { sg, cl: null, ws, n: 1 };
  let t = 1000;
  const casts = [], placed = [], voids = [];
  const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 });
  const steps = createSdSteps({ course: KT_COURSE, renderer: null, audio: null, lite: true });
  const ctx = {
    dynamicDraws: [], collider: col,
    sdStepsRide(dt, body, live) { steps.stand({ dynamicDraws: [], collider: col }); return steps.ride(t, dt, body, live); },
    addActivationTargets() {}, addActivationNamer() {}, addTeardown() {},
  };
  const K = { now: () => t * 1000, clock: () => t, voyage: () => V, carried: () => [], castBack: () => { casts.push(dungeonToDeck(...m.pos)); } };
  const host = { ketch: () => K };
  const wm = { mode: 'dungeon', dungeonCtx: ctx, dungeonLoc: ketchShipLocation({ n: 1, owner: '0123456789abcdef' }), place: (at) => { m.freezeMotor = TELEPORT_FREEZE_S; m.spawn(at[0], at[1], at[2]); placed.push(dungeonToDeck(...at)); return true; } };
  const kh = createKetchDeckHost({ renderer: { createMesh: (x) => ({ x }) }, host, wm, moon: () => null });
  kh.stand(ctx);
  const frame = (input = {}, yaw = 0) => {
    const dt = 1 / 60, back = ctx.sdStepsRide(dt, m, true);
    if (back) { voids.push(dungeonToDeck(...back)); m.freezeMotor = TELEPORT_FREEZE_S; m.spawn(back[0], back[1], back[2]); host.sdCastBack(); }
    m.update(dt, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, yaw, 0);
    t += dt;
  };
  const feet = () => dungeonToDeck(m.pos[0], m.pos[1], m.pos[2]);
  const spawn = (x, y, z, settle = 40) => { const p = deckToDungeon(x, y, z); m.spawn(p[0], p[1] + 0.05, p[2]); for (let k = 0; k < settle; k++) frame(); };
  const yawTo = (to) => { const f = feet(); return Math.atan2(to[0] - f[0], to[1] - f[2]); };
  return { col, m, V, frame, feet, spawn, yawTo, casts, placed, voids, kh, get t() { return t; } };
}
const onCore = (f) => Math.hypot(f[0] - KT_BRIDGE.x, f[2] - KT_BRIDGE.z) < KT_BRIDGE.core;

test('AUDIT KETCH II L4-1 A BODY ON A FALLEN SECTION IS CAST BACK: on each of the ring\'s eight sections as it falls away, a body falls past her hull to the void and is stood back on the bridge\'s core - never into her hull\'s shut belly, 15 to 20 m down in the dark with no way up (mutants: her bilge to her keel solid; her bottom solid)', () => {
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (Math.PI / 4) + 0.25, S = rig(KT_STAGE.bridge, { ph: 1, sec: [] });
    S.spawn(KT_BRIDGE.x + Math.sin(a) * 20, 0.1, KT_BRIDGE.z + Math.cos(a) * 20);
    const now = S.t * 1000;
    S.V.ws = { ph: 1, sec: [[k, now + 100, now + 100 + 7000]] };
    for (let i = 0; i < 60 * 8; i++) S.frame();
    const end = S.feet();
    assert.ok(S.voids.length >= 1, `section ${k}: the fall reached the void (ended at y ${end[1].toFixed(2)})`);
    assert.ok(onCore(end) && Math.abs(end[1] - KT_BRIDGE.y) < 0.5 && S.m.grounded, `section ${k}: stood on the core (ended ${end.map((v) => v.toFixed(2)).join(', ')})`);
    assert.equal(S.casts.length, S.voids.length, `section ${k}: one cast-back's cost a fall`);
  }
});

test('AUDIT KETCH II L2-4, L4-2, L4-3 THE LID AND THE ENGINE HOUSE\'S ROOF STAND A BODY BACK: off the main top onto the waist\'s lid, or onto the roof, a body is stood on the main top it came from - once, never left there paying a cast-back a frame to 1 HP; the roof is the sky\'s (its ridge ran past the whole Sailwalk to the bridge); off the Sailwalk the landing is its span\'s checkpoint, with no ground at all where a crew arrives (mutants: the lid\'s landing the Steps\' none; the roof stood on; the Sailwalk\'s landing the spar)', () => {
  for (const [name, at] of [['the lid over the waist', [0, KT_LID_Y, 40]], ['the lid over the Anchor Deck', [2, KT_LID_Y, 8]], ['the roof\'s ridge', [0, KT_HOUSE.ridge, 110]], ['the roof by its eave', [10, KT_HOUSE.eave + (KT_HOUSE.ridge - KT_HOUSE.eave) * (1 / KT_HOUSE.x), 140]]]) {
    const S = rig(KT_STAGE.sailwalk);
    S.spawn(KT_MAIN_TOP.x, KT_MAIN_TOP.y, KT_MAIN_TOP.z + 5.4);
    const top = S.feet();
    assert.ok(Math.abs(top[1] - KT_MAIN_TOP.y) < 0.3 && S.m.grounded, 'the body stands on the main top first');
    S.spawn(at[0], at[1] + 0.3, at[2], 90);
    const end = S.feet();
    assert.ok(S.casts.length >= 1 && S.casts.length <= 2, `${name}: cast back once (${S.casts.length})`);
    assert.ok(S.placed.length >= 1 && Math.abs(S.placed[0][1] - KT_MAIN_TOP.y - 0.2) < 0.4, `${name}: stood on the main top (${S.placed[0]?.map((v) => v.toFixed(2)).join(', ')})`);
    assert.ok(Math.abs(end[1] - KT_MAIN_TOP.y) < 0.3, `${name}: and there it stands (ended at y ${end[1].toFixed(2)})`);
  }
  assert.equal(ketchOnRoof(0, KT_HOUSE.ridge, 100), true, 'the ridge');
  assert.equal(ketchOnRoof(-10.5, KT_HOUSE.eave, 150), true, 'the eave');
  assert.equal(ketchOnRoof(5, 0, 172), false, 'the aft deck');
  assert.equal(ketchOnRoof(12, 0, 150), false, 'the strip beside the house');
  assert.equal(ketchOnRoof(KT_MAIN_TOP.x, KT_MAIN_TOP.y, KT_MAIN_TOP.z + 5), false, 'the main top');
  assert.equal(ketchOnRoof(0, -6, 100), false, 'the gun deck under it');
  assert.deepEqual(ketchSkyLanding([24, 17.4, 110], 'sailwalk'), castBackTo(spanAt(110, KT_COURSE), KT_COURSE), 'off the Sailwalk: its checkpoint');
  assert.deepEqual(ketchSkyLanding([9, 16, 62], 'top'), [9, 16, 62], 'off the main top: where it stood');
  assert.deepEqual(ketchSkyLanding(null, null), [KT_ARRIVE.x, KT_ARRIVE.y, KT_ARRIVE.z], 'no ground at all: where a crew arrives');
});

test('AUDIT KETCH II L4-7 THE WAIST\'S BULWARK MEETS THE BRIDGE\'S DISC: a body walking out over her side where the bulwark ended (z 179, the disc meeting her side at 179.8) stops at it - a walk off with no jump, a cast-back\'s cost, through the gap (mutants: the bulwark ending at z 179)', () => {
  for (const s of [1, -1]) {
    const S = rig(KT_STAGE.bridge, { ph: 1, sec: [] });
    S.spawn(s * 11.5, 0.1, 178.5);
    for (let k = 0; k < 60 * 4; k++) S.frame({ forward: 1 }, S.yawTo([s * 16, 179.5]));
    let low = 99;
    for (let k = 0; k < 60 * 2; k++) { S.frame(); low = Math.min(low, S.feet()[1]); }
    assert.ok(low > -0.5 && S.voids.length === 0, `side ${s}: held aboard (lowest ${low.toFixed(2)}, ${S.voids.length} falls)`);
    assert.ok(Math.abs(S.feet()[0]) <= KT_WAIST.x1, `side ${s}: inside her side`);
  }
});

test('AUDIT KETCH II L4-9 THE ENGINE\'S FLYWHEEL STANDS CLEAR OF ITS SOCKETS, AND IS SOLID: on the drum\'s fore face, where no socket stands - every socket\'s pedestal and its cell clear of the wheel\'s face - and a body walking into it stops (it cut through socket 1 and the cell set in it, drawn only; mutants: the wheel on the drum\'s west face; the wheel drawn only)', () => {
  const fz = KT_ENGINE.z - KT_ENGINE.r - 1.3, fr = 2.4;
  for (const [sx, sz] of KT_SOCKETS) assert.ok(sz - 0.5 > fz + 0.2 || Math.abs(sx - KT_ENGINE.x) > fr + 0.5, `the socket at (${sx.toFixed(2)}, ${sz.toFixed(2)}) clear of the wheel`);
  const { model } = buildKetchShip(), P = model.positions, O = deckToDungeon(0, 0, 0);
  let face = 0, west = 0;
  for (let i = 0; i < P.length; i += 9) {
    const xs = [P[i], P[i + 3], P[i + 6]].map((v) => v - O[0]), zs = [P[i + 2], P[i + 5], P[i + 8]].map((v) => v - O[2]);
    if (zs.every((z) => Math.abs(z - fz) < 1e-3) && xs.every((x) => Math.abs(x - KT_ENGINE.x) <= fr + 1e-3)) face++;
    if (xs.every((x) => Math.abs(x - (KT_ENGINE.x - KT_ENGINE.r - 1.3)) < 1e-3) && zs.some((z) => Math.abs(z - KT_ENGINE.z) < fr)) west++;
  }
  assert.ok(face >= 40, `the wheel drawn on the fore face (${face} triangles)`);
  assert.equal(west, 0, 'and nothing left on the west face');
  const S = rig(KT_STAGE.engine);
  S.spawn(KT_ENGINE.x + 0.6, KT_HOLD.y + 0.05, fz - 3);
  for (let k = 0; k < 60 * 3; k++) S.frame({ forward: 1 }, 0);
  assert.ok(S.feet()[2] < fz - 0.2, `a body walking at the wheel stops at it (ended at z ${S.feet()[2].toFixed(2)}, the wheel at ${fz})`);
});

test('AUDIT KETCH II L4-6 THE ROTTEN RIGGING BREATHES ON ITS COURSE\'S LINE ALONE: on the ship a body standing still on her aft deck, beside the house or on the bridge is never blown, nor hears the gust\'s wind - the course\'s band its steps\' breadth and sway and SD_BREATH_BAND_M; the Hour\'s course breathes at every x, as it did (mutants: the band unread; the Hour banded)', () => {
  assert.equal(sdBreathBand(SD_COURSE), null, 'the Hour\'s: everywhere');
  const band = sdBreathBand(KT_COURSE);
  assert.ok(band[0] > 13 && band[0] < KT_COURSE_SPEC.x && band[1] > KT_COURSE_SPEC.x && band[1] < KT_COURSE_SPEC.x + 10, `about the course's x (${band.map((v) => v.toFixed(2)).join('..')})`);
  for (const s of KT_COURSE.steps) assert.ok(s.x - s.w / 2 - (s.amp ?? 0) - SD_BREATH_BAND_M >= band[0] - 1e-9 && s.x + s.w / 2 + (s.amp ?? 0) + SD_BREATH_BAND_M <= band[1] + 1e-9, `step ${s.i} inside its band`);
  for (const [name, at] of [['the aft deck', [5, 0, 172]], ['the strip beside the house', [-12, 0, 150]], ['the bridge by its fore rail', [3, 0, 176.6]]]) {
    const col = new Collider(() => -Infinity), deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } });
    deck.stand({ dynamicDraws: [], collider: col });
    const sounds = [];
    const steps = createSdSteps({ course: KT_COURSE, renderer: null, audio: { playOneShot: (rec) => sounds.push(rec), play3d: () => {} }, lite: true });
    steps.stand({ dynamicDraws: [], collider: col });
    const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 });
    let t = 6000 - 2;
    const p = deckToDungeon(...at); m.spawn(p[0], p[1] + 0.05, p[2]);
    const frame = () => { deck.pose({ sg: KT_STAGE.bridge }, t, t * 1000, m); steps.ride(t, 1 / 60, m, true); m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0, 0); t += 1 / 60; };
    for (let k = 0; k < 30; k++) frame();
    const before = dungeonToDeck(...m.pos);
    let far = 0;
    for (let k = 0; k < 60 * 13; k++) { frame(); const q = dungeonToDeck(...m.pos); far = Math.max(far, Math.hypot(q[0] - before[0], q[2] - before[2])); }
    assert.ok(far < 0.05, `${name}: never blown (${far.toFixed(2)} m)`);
    assert.equal(sounds.length, 0, `${name}: the gust's wind unheard`);
  }
});
