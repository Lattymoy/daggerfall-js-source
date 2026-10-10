// AUDIT CLIMB-ARC (the Enhanced Climbing arc's audit - bible/03-World/Parkour-Arc.md): THE PINS. One law a finding, each
// asked of the REAL producers (PlayerMotor over a Collider and parkour.js, ClimbFeel and its host, the look filter,
// PeerClimbSounds, the weapon rig) - the shape the producer mints, never a literal of it - and each red on the PR head
// before the audit's fixes (d92a75a13) and green after them; the source pins hold the hosts' wiring, which no unit test
// can reach. The mutants that put each old behaviour back are tools/mutants/auditclimbarc.json.
//
// The peer and the body modules (net/peerClimb.js, net/peerRiders.js, net/remotePlayers.js, player/mwView.js,
// combat/weaponRig.js) are imported inside their own tests: they reach CLIMB6's work in progress (player/climbPose.js,
// combat/climbRig.js), and a slip there must cost those pins alone, not the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, GRAVITY, CAPSULE_RADIUS, climbPoseOf } from '../src/player/motor.js';
import { Collider, _setFixedPointStopForTest } from '../src/player/collider.js';
import * as P from '../src/player/parkour.js';
import { ClimbFeel, createClimbFeelHost } from '../src/player/climbFeel.js';
import { LookFilter } from '../src/player/lookFilter.js';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { SKILLS } from '../src/systems/skills.js';
import { validPose } from '../src/net/wire.js';
import { WIDE_POSE } from './placeWidest.mjs';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxVerts = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

function world(terrain = () => 0, drawn = undefined) {
  const col = drawn ? new Collider(terrain, drawn) : new Collider(terrain);
  const boxes = [];
  let n = 0;
  const box = (...b) => { boxes.push(b); col.addMesh(`b${n++}`, boxVerts(...b), BOX_IDX, I); };
  return { col, box, boxes };
}
function climber(col, { skill = 50, jumping = skill, enabled = true, stats = { speed: 50, running: 30 }, extra = {}, inputs = null } = {}) {
  return new PlayerMotor(col, stats, {
    parkour: { enabled: () => enabled, inputs: inputs ?? (() => ({ climbing: skill, jumping })), say: () => {}, tally: () => {} },
    ...extra,
  });
}
const state = (m) => (m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air');
/** Step `m` by `script` (its input, from the step, the motor and a scratch context); the states seen, the moves and
 *  jumps billed, the hardest landing and a log. */
function drive(m, yaw, script, steps, dt = 1 / 60) {
  const seen = [], billed = [], ctx = {}, log = [];
  let fell = 0;
  for (let i = 0; i < steps; i++) {
    const input = script(i, m, ctx);
    m.update(dt, { ...blank, ...input }, typeof yaw === 'function' ? yaw(i, m, ctx) : yaw);
    if (m.parkoured) billed.push(...[].concat(m.parkoured));
    if (m.jumped) billed.push('jump');
    if (m.landedFallDistance) fell = Math.max(fell, m.landedFallDistance);
    const s = state(m);
    if (seen[seen.length - 1] !== s) seen.push(s);
    log.push({ i, s, pos: [...m.pos], grip: m.grip, vel: [m._airVelX, m.velY, m._airVelZ] });
  }
  return { seen, billed, fell, log, ctx };
}
/** Hang from a lip (a standing Jump at it), then at the 20th step of the hang press `input`. */
const hangThen = (input) => (i, m, c) => {
  if (c.h == null) { if (m.hanging) { c.h = i; return {}; } return { jump: i > 5 && i < 40 }; }
  if (i === c.h + 20) return input;
  return {};
};
/** The 2.3 m wall across +z (its face at z 1, x -w..w), a body hung from it facing yaw 0. */
function hungOn(w = 3, opts = {}) {
  const wd = world();
  wd.box(-w, 0, 1, w, 2.3, 4);
  const m = climber(wd.col, opts);
  m.spawn(0, 0.02, 0.4);
  for (let i = 0; i < 240 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
  assert.ok(m.hanging, 'hung');
  return { m, col: wd.col };
}
/** A host's feel over `player` - the camera, the look filter, the sounds (on, their clips unloaded, dice fixed). */
function feelHost(player, { cam = { yaw: 0, pitch: 0, pos: [0, 0, 0] }, lookFilter = new LookFilter() } = {}) {
  const shots = [];
  const host = createClimbFeelHost(() => player, cam, lookFilter, { audio: { playOneShot: (k) => shots.push(k) }, strain: () => ({ clip: 42, pitchLift: 0 }) });
  if (host.sounds) { host.sounds.on = () => true; host.sounds.install = false; host.sounds.rand = () => 0.3; }
  return { host, shots, cam, lookFilter };
}

// ---- THE FEEL (CLIMB4) ------------------------------------------------------------------------------------------------

test('AUDIT CLIMB-ARC F1: the corner turns the view onto the next wall - a real shimmy round an outer corner, either way, and the view the feel pays out ends facing the wall the hands hold, as the body does (mutant: the mirror\'s sign)', () => {
  for (const strafe of [1, -1]) {
    const { m } = hungOn(3, { skill: 90 });
    const feel = new ClimbFeel();
    let yaw = 0, corner = null;
    for (let i = 0; i < 900; i++) {
      m.update(1 / 60, { ...blank, strafe }, yaw);
      corner ??= m.climbEvents.find((e) => e.type === 'move' && e.kind === 'corner') ?? null;
      yaw += feel.update(1 / 60, m, yaw).yaw;   // the look filter pays it (smoothing nought)
      if (corner && !m.climbMove) { for (let k = 0; k < 60; k++) yaw += feel.update(1 / 60, m, yaw).yaw; break; }
    }
    assert.ok(corner, `the shimmy (strafe ${strafe}) turned the corner`);
    const n = m.wallNormal;
    assert.ok(Math.abs(n[0]) > 0.99, `onto the side wall (normal ${n})`);
    const faces = Math.atan2(-n[0], -n[2]);
    assert.ok(Math.abs(wrap(m.climbFacing - faces)) < 1e-6, 'the body faces the wall it holds');
    assert.ok(Math.abs(wrap(yaw - faces)) < 1 * DEG, `strafe ${strafe}: the view ends ${(wrap(yaw - faces) / DEG).toFixed(1)} deg off the wall it holds`);
    assert.ok(Math.abs(wrap(yaw - m.climbFacing)) < 1 * DEG, 'and on the body\'s facing');
  }
});

test('AUDIT CLIMB-ARC F2/F4: a held frame replays no climb - holdFrame clears the frame\'s climb events, the feel\'s handle held stands still (no clock, no sound, no turn), and every host that holds its motor holds the feel with it (mutants: the events kept, `held` ignored, a host unwired)', () => {
  // the motor: a catch's events, and the held frame after it
  const wd = world(); wd.box(-3, 0, 1, 3, 2.3, 4);
  const player = climber(wd.col);
  player.spawn(0, 0.02, 0.4);   // a standing jump at the lip: a catch (a sound, a dip)
  const { host, shots, cam, lookFilter } = feelHost(player);
  let ev = null;
  for (let i = 0; i < 400 && !ev; i++) {
    player.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, cam.yaw);
    lookFilter.tick(1 / 60, cam, { smoothing: 0 });
    host.frame(1 / 60);
    ev = player.climbEvents.find((e) => e.type === 'move' && e.kind === 'catch');
  }
  assert.ok(ev, 'a catch');
  // the handle, held with the frame's events still there: it reads none of them
  const fx = JSON.stringify(host.fx), before = shots.length, yaw0 = cam.yaw, owed = lookFilter.turnYaw ?? lookFilter.residualYaw;
  for (let k = 0; k < 30; k++) host.frame(1 / 60, true);
  assert.equal(JSON.stringify(host.fx), fx, 'the camera stands as it was under a held frame');
  assert.equal(shots.length, before, 'and sounds nothing');
  assert.equal(cam.yaw, yaw0);
  assert.equal(lookFilter.turnYaw ?? lookFilter.residualYaw, owed, 'and owes no turn');
  // holdFrame: the events the feel and the sounds read are gone
  assert.ok(player.climbEvents.length > 0);
  player.holdFrame();
  assert.deepEqual(player.climbEvents, [], 'a held frame has no climb events');
  for (let k = 0; k < 30; k++) { player.holdFrame(); host.frame(1 / 60); }
  assert.equal(shots.length, before, 'an overlay up after a catch replays no catch');
  // the hosts: the feel is held exactly when the motor is
  const world_ = src('scenes/world.js'), ext = src('scenes/exterior.js'), modes = src('scenes/worldModes.js');
  assert.match(world_, /if \(_overlayHeld \|\| _seasonHeld \|\| _rideHeld\) player\.holdFrame\(\);/);   // PIN MOVED (WAGONS1): a rider's held motor too
  assert.match(world_, /climbFeel\.frame\(dt, _overlayHeld \|\| _seasonHeld\);/, 'world.js: held under the overlay and the season');
  assert.match(ext, /if \(_overlayHeld\) player\.holdFrame\(\);/);
  assert.match(ext, /climbFeel\.frame\(dt, _overlayHeld\);/, 'exterior.js: held under the overlay');
  assert.match(modes, /host\.climbFeel\?\.frame\(dt, overlayHeld\);/, 'worldModes.js: held under the overlay');
  assert.doesNotMatch(world_ + ext + modes, /climbFeel\??\.frame\(dt\)/, 'no host frames the feel unheld');
});

test('AUDIT CLIMB-ARC F3: the feel reads the render frame\'s own way on the wall - a shimmy drawn at 144 Hz over the motor\'s 60 Hz steps bobs and rolls smoothly, no frame-to-frame reversals (mutant: the physics feet read)', () => {
  for (const hz of [144, 60]) {
    const { m } = hungOn(6);
    const feel = new ClimbFeel();
    const dt = 1 / hz;
    for (let i = 0; i < hz; i++) { m.update(dt, blank, 0); feel.update(dt, m, 0); }
    const eyes = [], rolls = [];
    for (let i = 0; i < hz * 1.5; i++) {
      m.update(dt, { ...blank, strafe: 1 }, 0);
      const o = feel.update(dt, m, 0);
      eyes.push(o.eye[1]); rolls.push(o.roll);
    }
    assert.ok(m.pos[0] > 1, 'it shimmied');
    const reversals = (xs, eps) => {
      let n = 0;
      for (let i = 2; i < xs.length; i++) {
        const d = xs[i] - xs[i - 1], d0 = xs[i - 1] - xs[i - 2];
        if (Math.abs(d) > eps && Math.abs(d0) > eps && Math.sign(d) !== Math.sign(d0)) n++;
      }
      return n;
    };
    assert.equal(reversals(eyes, 2e-4), 0, `${hz} Hz: the eye judders`);
    assert.ok(reversals(rolls, 0.01 * DEG) <= 6, `${hz} Hz: the roll judders (${reversals(rolls, 0.01 * DEG)} reversals in 1.5 s)`);
  }
});

test('AUDIT CLIMB-ARC F5: the feel\'s springs are exact - a real catch dips the eye and pitches the view the same at 20, 60 and 240 Hz, within 5 % (mutant: the semi-implicit step)', () => {
  const wd = world(); wd.box(-3, 0, 1, 3, 2.3, 4);
  const m = climber(wd.col);
  m.spawn(0, 0.02, 0.4);
  let ev = null;
  for (let i = 0; i < 400 && !ev; i++) { m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0); ev = m.climbEvents.find((e) => e.type === 'move' && e.kind === 'catch'); }
  assert.ok(ev && ev.speed > 1, 'a catch, as the motor tells it (the speed it came at)');
  const dip = (hz) => {
    const feel = new ClimbFeel();
    const fake = { climbEvents: [ev], pos: [0, 0, 0], onWall: true, hanging: true, climbMove: { t: 0 }, wallNormal: ev.normal, grip: 1 };
    let eye = 0, pitch = 0, t = 0;
    for (let i = 0; i < hz * 1.5; i++) {
      t += 1 / hz;
      fake.climbMove = t < ev.dur ? { t: t / ev.dur } : null;
      const o = feel.update(1 / hz, fake, 0);
      fake.climbEvents = [];
      eye = Math.min(eye, o.eye[1]); pitch = Math.min(pitch, o.pitch);
    }
    return { eye, pitch };
  };
  const ref = dip(240);
  assert.ok(ref.eye < -0.01, 'the catch dips the eye');
  for (const hz of [20, 60]) {
    const d = dip(hz);
    assert.ok(Math.abs(d.eye / ref.eye - 1) < 0.05, `${hz} Hz dips ${(d.eye * 100).toFixed(2)} cm, 240 Hz ${(ref.eye * 100).toFixed(2)}`);
    assert.ok(Math.abs(d.pitch / ref.pitch - 1) < 0.05, `${hz} Hz pitches ${(d.pitch / DEG).toFixed(2)} deg, 240 Hz ${(ref.pitch / DEG).toFixed(2)}`);
  }
  // and a long frame (a 5 fps stall) steps the whole of its time: one 0.2 s frame lands where forty 5 ms ones do
  const after = (steps) => {
    const feel = new ClimbFeel();
    const fake = { climbEvents: [ev], pos: [0, 0, 0], onWall: false, hanging: false, climbMove: null, wallNormal: null, grip: 1 };
    let o = null;
    for (let i = 0; i < steps; i++) { o = feel.update(0.2 / steps, fake, 0); fake.climbEvents = []; }
    return o.eye[1];
  };
  const one = after(1), forty = after(40);
  assert.ok(forty < -0.005 && Math.abs(one / forty - 1) < 1e-6, `one 0.2 s frame: ${(one * 100).toFixed(3)} cm, forty: ${(forty * 100).toFixed(3)} cm`);
});

test('AUDIT CLIMB-ARC F6: a teleport and a load reset the feel - no climb\'s turn or cue rides them (world.js\'s teleport and load, the dungeon\'s quick load) (mutants: a reset dropped)', () => {
  const feel = new ClimbFeel();
  feel._turnTo(Math.PI, 0, 0.2);
  assert.ok(feel.turnLeft !== 0);
  feel.reset();
  assert.equal(feel.turnLeft, 0, 'the reset drops the owed turn');
  const w = src('scenes/world.js');
  assert.match(w, /async function _teleportToPixel\([^\n]*\n(?:[^\n]*\n){0,8}?\s*cameraRecoiler\.reset\(\);\n\s*climbFeel\.reset\(\);/, 'the teleport');
  assert.match(w, /const extras = restorePlayer\(playerEntity, snap, spellsByIndex\);(?:[^\n]*\n){1,12}?\s*cameraRecoiler\.reset\(\);\n\s*resetVitalsDetector\(\);[^\n]*\n\s*player\.stopAutorun\(\);[^\n]*\n\s*climbFeel\.reset\(\);/, 'the load');
  assert.match(src('scenes/dungeon.js'), /ctx\.quickLoad = \(\.\.\.args\) => \{ climbFeel\.reset\(\); cameraRecoiler\.reset\(\); return _ctxQuickLoad\.apply\(ctx, args\); \};/, 'the dungeon\'s quick load');
});

test('AUDIT CLIMB-ARC F7: a swing in flight when the hands take the wall lands nothing - WeaponManager\'s climbing return skips the hit frame (mutant: the swing\'s events kept on the wall)', async () => {
  const { createWeaponRig } = await import('../src/combat/weaponRig.js');
  const { setModSetting, _resetModSettings } = await import('../src/systems/modSettings.js');
  const { resetToDefaults } = await import('../src/systems/settings.js');
  const { EQUIP_SLOTS } = await import('../src/systems/equip.js');
  const bowCif = () => {
    const W = 100, H = 80, head = 12 + 31 * 2 + 2, runs = Math.ceil((W * H) / 128);
    const b = new Uint8Array(head + runs * 2), v = new DataView(b.buffer);
    v.setUint16(0, W, true); v.setUint16(2, H, true);
    for (let f = 0; f < 7; f++) v.setUint16(12 + f * 2, head, true);
    for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
    v.setUint16(12 + 62, b.length, true);
    return b;
  };
  resetToDefaults(); _resetModSettings();
  try {
    setModSetting('weapon-widget', 'Enabled', false);
    const entity = {
      items: [{ name: 'Arrow', templateIndex: 131, stackCount: 20 }],
      equip: { slots: { [EQUIP_SLOTS.RightHand]: { name: 'Long Bow', templateIndex: 130, material: 0 } } },
      stats: { speed: 50 },
    };
    let climbing = false;
    const r = createWeaponRig({
      renderer: { uploadTexture: (_k, name) => name, drawScreenQuad: () => {} }, canvas: { width: 320, height: 200, clientWidth: 320, clientHeight: 200 },
      entity, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
      fetchBytes: async () => bowCif(), camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, climbing, move: { grounded: !climbing } }),
    });
    r.toggleSheath();
    for (let i = 0; i < 90; i++) { r.frame(1 / 60); r.draw(); }
    await new Promise((res) => setTimeout(res, 0));
    for (let i = 0; i < 5; i++) { r.frame(1 / 60); r.draw(); }
    r.clickAttack();
    const evs = [];
    let began = false;
    for (let i = 0; i < 120; i++) {
      if (!began && r.playerWeapon.machine.state !== 'Idle') { began = true; climbing = true; }   // the hands go to the wall as the swing begins
      const e = r.frame(1 / 60); r.draw();
      if (climbing) evs.push(...e);
    }
    assert.ok(began, 'the swing began');
    assert.ok(!evs.includes('hit'), `a swing in flight on the wall lands nothing (${evs.join(', ')})`);
  } finally { _resetModSettings(); resetToDefaults(); }
});

test('AUDIT CLIMB-ARC F8: a hold carried by what moves (a deck along its lip, a lift rising) is no climb - no hands or boots, no shimmy\'s roll, while the body holds still on it (mutant: the carry read as the body\'s own way)', () => {
  const run = (vel) => {
    const col = new Collider(() => 0);
    const off = [0, 0, 0];
    col.addMesh('hull', boxVerts(-20, 0, 1, 20, 2.3, 4), BOX_IDX, I, () => off);
    const m = climber(col);
    m.spawn(0, 0.02, 0.4);
    for (let i = 0; i < 240 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
    assert.ok(m.hanging);
    if (vel[1]) for (let i = 0; i < 5; i++) m.update(1 / 60, { ...blank, forward: -1 }, 0);   // down onto the face: a free climb
    const { host, shots } = feelHost(m, { lookFilter: null });
    for (let i = 0; i < 30; i++) { m.update(1 / 60, blank, 0); host.frame(1 / 60); }
    const n0 = shots.length, p0 = [...m.pos];
    let roll = 0;
    for (let i = 0; i < 120; i++) {
      off[0] += vel[0] / 60; off[1] += vel[1] / 60; off[2] += vel[2] / 60;
      m.update(1 / 60, blank, 0);
      host.frame(1 / 60);
      roll = Math.max(roll, Math.abs(host.fx.roll));
    }
    return { carried: Math.hypot(m.pos[0] - p0[0], m.pos[1] - p0[1], m.pos[2] - p0[2]), shots: shots.slice(n0), roll, onWall: m.onWall };
  };
  // a deck's carry (the host's carryBy, a ship's hull it does not key) along the lip held
  {
    const { m } = hungOn(20);
    const { host, shots } = feelHost(m, { lookFilter: null });
    for (let i = 0; i < 30; i++) { m.update(1 / 60, blank, 0); host.frame(1 / 60); }
    const n0 = shots.length, x0 = m.pos[0];
    for (let i = 0; i < 120; i++) { m.update(1 / 60, blank, 0); m.carryBy(2 / 60, 0, 0); host.frame(1 / 60); }
    assert.ok(m.hanging && m.pos[0] - x0 > 3.5, `carried ${(m.pos[0] - x0).toFixed(2)} m along the lip`);
    assert.deepEqual(shots.slice(n0), [], 'a deck\'s carry: no hands');
  }
  const still = run([0, 0, 0]);
  for (const vel of [[2, 0, 0], [0, 1, 0]]) {
    const r = run(vel);
    assert.ok(r.onWall && r.carried > 1.5, `carried ${r.carried.toFixed(2)} m on the wall`);
    assert.deepEqual(r.shots, [], `carried ${JSON.stringify(vel)}: no hands nor boots (${r.shots.join(', ')})`);
    assert.ok(r.roll <= still.roll + 0.05 * DEG, `carried ${JSON.stringify(vel)}: rolled ${(r.roll / DEG).toFixed(2)} deg, held still ${(still.roll / DEG).toFixed(2)}`);
  }
});

test('AUDIT CLIMB-ARC F9: a leap dips the eye where it lands, never as it pushes off - a real side leap between two walls keeps the eye up through its launch, and the leap the motor tells dips at the hold it ends in (mutant: the dip at the push-off)', () => {
  const wd = world(); wd.box(-4, 0, 1, -0.6, 2.3, 4); wd.box(0.6, 0, 1, 4, 2.3, 4);
  const m = climber(wd.col, { inputs: () => ({ climbing: 60, jumping: 80 }) });
  m.spawn(-1.2, 0.02, 0.4);
  for (let i = 0; i < 240 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
  const feel = new ClimbFeel();
  for (let i = 0; i < 90; i++) { m.update(1 / 60, blank, 0); feel.update(1 / 60, m, 0); }
  let leap = null, low = Infinity, held = null, landed = Infinity;
  for (let i = 0; i < 120; i++) {
    m.update(1 / 60, i < 3 ? { ...blank, strafe: 1, jump: true } : blank, 0);
    leap ??= m.climbEvents.find((e) => e.type === 'move' && e.kind === 'leap') ?? null;
    if (leap && held == null && m.climbEvents.some((e) => e.type === 'hold')) held = i;
    const o = feel.update(1 / 60, m, 0);
    if (leap && held == null) low = Math.min(low, o.eye[1]);
    if (held != null) landed = Math.min(landed, o.eye[1]);
  }
  assert.ok(leap, 'a side leap');
  // the real arrival: the wall held goes on, and the motor tells the hold the leap lands on - the eye dips there
  assert.ok(held != null && m.hanging, 'the leap lands held, told');
  assert.ok(low > -0.002, `the push-off dips the eye ${(low * 100).toFixed(2)} cm`);
  assert.ok(landed < -0.01, `the dip at the real arrival (${(landed * 100).toFixed(2)} cm)`);
  // the arrival: the leap's own event, then the hold it ends in
  const f = new ClimbFeel();
  const fake = { climbEvents: [leap], pos: [0, 0, 0], onWall: true, hanging: true, climbMove: { t: 0 }, wallNormal: leap.normal, grip: 1 };
  let before = Infinity, after = Infinity;
  const steps = Math.round(leap.dur * 60);
  for (let i = 0; i < steps + 40; i++) {
    fake.climbMove = i < steps ? { t: i / steps } : null;
    if (i === steps) fake.climbEvents = [{ type: 'hold', mode: 'hang', normal: leap.normal }];
    const o = f.update(1 / 60, fake, 0);
    fake.climbEvents = [];
    if (i < steps) before = Math.min(before, o.eye[1]); else after = Math.min(after, o.eye[1]);
  }
  assert.ok(before > -0.002, `no dip in flight (${(before * 100).toFixed(2)} cm)`);
  assert.ok(after < -0.01, `the dip at the arrival (${(after * 100).toFixed(2)} cm)`);
});

test('AUDIT CLIMB-ARC F10/F11: the dungeons aim with the view before the climb\'s feel (the look, the ears, the spell, the blow), and ?exterior\'s interiors and dungeons take the feel as the world host\'s do (mutants: the felt view aimed with, the feel unhanded)', () => {
  const ctx = src('scenes/dungeonContext.js');
  const draw = ctx.slice(ctx.indexOf('function drawFoes('));
  assert.match(draw, /^function drawFoes\([^)]*aimView = null\) \{/, 'drawFoes takes the aim');
  assert.match(draw, /const aimed = aimView \?\? view;/);
  const body = draw.slice(0, draw.indexOf('\n  }\n'));
  assert.match(body, /_fpYaw = Math\.atan2\(-aimed\[2\], -aimed\[10\]\);/);
  assert.match(body, /_fpPitch = Math\.asin\(Math\.max\(-1, Math\.min\(1, -aimed\[6\]\)\)\);/);
  assert.match(body, /magic\.firePending\(eye, \[-aimed\[2\], -aimed\[6\], -aimed\[10\]\]\)/);
  assert.match(body, /audio\.setListener\(eye, \[-aimed\[2\], -aimed\[6\], -aimed\[10\]\]\)/);
  assert.match(body, /resolvePlayerHit\(eye, inView, playerFeet, \[-aimed\[2\], -aimed\[6\], -aimed\[10\]\]\)/);
  assert.doesNotMatch(body, /\[-view\[2\], -view\[6\], -view\[10\]\]/, 'nothing in the frame aims with the felt view');
  assert.doesNotMatch(body, /-view\[6\]/, 'nor looks with its pitch');
  for (const [file, feel] of [['scenes/dungeon.js', 'climbFeel.view(view'], ['scenes/worldModes.js', 'host.climbFeel?.view(view']]) {
    const s = src(file);
    const at = s.indexOf('const aimView = view.slice();');
    assert.ok(at > 0 && at < s.indexOf(feel, at - 2000) && s.indexOf(feel, at) > at, `${file}: the aim is taken before the feel lays its pitch on the view`);
    assert.match(s, /drawFoes\([^\n]*, aimView\);/, `${file}: and handed to the dungeon`);
  }
  const ext = src('scenes/exterior.js');
  const modes = ext.slice(ext.indexOf('createWorldModes({'));
  assert.match(modes.slice(0, modes.indexOf('\n  });')), /\n\s*climbFeel,/, '?exterior hands its modes the feel');
});

test('AUDIT CLIMB-ARC F13: the game\'s turn survives a held swing - the look filter owes it apart from the hand\'s look, so settle() (WeaponSwingMode 0, every frame) drops the mouse and keeps the corner (mutant: the turn owed as look)', () => {
  const lf = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  lf.add(0.3, 0);
  lf.turn(0.5);
  lf.settle();
  lf.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(Math.abs(cam.yaw - 0.5) < 1e-9, `the turn paid whole, the mouse dropped (yaw ${cam.yaw})`);
  // the real corner, a swing held all the way round it
  const { m } = hungOn(3, { skill: 90 });
  const { host, cam: c2, lookFilter } = feelHost(m);
  for (let i = 0; i < 900; i++) {
    lookFilter.settle();
    lookFilter.tick(1 / 60, c2, { smoothing: 0 });
    m.update(1 / 60, { ...blank, strafe: 1 }, c2.yaw);
    host.frame(1 / 60);
    if (Math.abs(m.wallNormal?.[0] ?? 0) > 0.99 && !m.climbMove) break;
  }
  for (let k = 0; k < 90; k++) { lookFilter.settle(); lookFilter.tick(1 / 60, c2, { smoothing: 0 }); m.update(1 / 60, blank, c2.yaw); host.frame(1 / 60); }
  assert.ok(Math.abs(m.wallNormal[0]) > 0.99, 'round the corner');
  assert.ok(Math.abs(wrap(c2.yaw - m.climbFacing)) < 1 * DEG, `the view ends ${(wrap(c2.yaw - m.climbFacing) / DEG).toFixed(1)} deg off the wall, a swing held`);
});

test('AUDIT CLIMB-ARC nit (_turnTo): a turn asked while another is still owed lands on its own target, never short by what was owed (mutant: the owed turn replaced)', () => {
  const feel = new ClimbFeel();
  const fake = { climbEvents: [], pos: [0, 0, 0], onWall: false, hanging: false, climbMove: null, wallNormal: null, grip: 1 };
  let yaw = 0;
  fake.climbEvents = [{ type: 'launch', dir: [1, 0, 0], along: 4, up: 3 }];   // the eject: face +x (yaw 90)
  for (let i = 0; i < 3; i++) { yaw += feel.update(1 / 60, fake, yaw).yaw; fake.climbEvents = []; }
  assert.ok(Math.abs(feel.turnLeft) > 0.3, 'a turn still owed');
  fake.climbEvents = [{ type: 'launch', dir: [0, 0, -1], along: 4, up: 3 }];   // asked again: face -z (yaw 180)
  for (let i = 0; i < 240; i++) { yaw += feel.update(1 / 60, fake, yaw).yaw; fake.climbEvents = []; }
  assert.ok(Math.abs(wrap(yaw - Math.PI)) < 0.5 * DEG, `the view ends at ${(wrap(yaw) / DEG).toFixed(1)} deg, asked 180`);
});

// ---- THE LEAPS (CLIMB3) -----------------------------------------------------------------------------------------------

test('AUDIT CLIMB-ARC L1: a staircase is no edge - senseDrop asks each sample from the floor the last one found, so a running Jump down a steep flight is the plain jump, never a leap (mutant: depth under the feet)', () => {
  for (const [rise, tread] of [[0.25, 0.3], [0.3, 0.3]]) {
    const build = () => {
      const w = world(() => -40);
      w.box(-3, -40, -20, 3, 0, 0);
      for (let k = 1; k <= 60; k++) w.box(-3, -40, (k - 1) * tread, 3, -k * rise, k * tread);
      return w;
    };
    const w0 = build();
    for (const z of [0, 1.5, 3]) assert.equal(P.senseDrop(w0.col, [0, -Math.ceil(z / tread) * rise, z], [0, 0, 1], CAPSULE_RADIUS, P.PARKOUR_RUNLEAP_EDGE), false, `stair ${rise}/${tread}: no edge at z ${z}`);
    const w = build();
    const m = climber(w.col, { extra: { jumpBoost: () => 1.25 } });
    m.spawn(0, 0.02, -8);
    const r = drive(m, 0, (i, mm, c) => {
      const press = !c.p && mm.grounded && mm.pos[2] > 1.5;
      if (press) c.p = true;
      return { forward: 1, run: true, jump: press };
    }, 200);
    assert.ok(r.billed.includes('jump') && !r.billed.includes('leap'), `stair ${rise}/${tread}: billed [${r.billed}]`);
  }
  // a real edge still is one
  const roof = world(); roof.box(-3, 0, -10, 3, 8, 0);
  assert.equal(P.senseDrop(roof.col, [0, 8, -0.5], [0, 0, 1], CAPSULE_RADIUS, P.PARKOUR_RUNLEAP_EDGE), true);
});

/** The running Jump across a 1.5 m gap between two 8 m roofs: the flight's length, take-off to landing. */
function gapFlight({ enabled, stats, jumping, boost, spell = false }) {
  const w = world();
  w.box(-3, 0, -30, 3, 8, 0); w.box(-3, 0, 1.5, 3, 8, 40);
  const m = climber(w.col, { jumping, enabled, stats, extra: { jumpBoost: () => boost, enhancedJumping: () => spell } });
  m.spawn(0, 8.02, -25);
  let off = null, land = null;
  const r = drive(m, 0, (i, mm) => {
    if (off != null && land == null && mm.grounded) land = mm.pos[2];
    if (off == null && !mm.grounded && i > 5) off = mm.pos[2];
    return { forward: 1, run: true, jump: mm.pos[2] > -0.5 && mm.pos[2] < -0.1 };
  }, 400);
  return { dist: land - off, billed: r.billed };
}

test('AUDIT CLIMB-ARC L2/L3: the running leap is never short of the plain jump it replaces - a fast runner\'s, a Jumping past 100\'s, a Jump spell\'s - and the Jump spell\'s air control keeps a leap\'s launch (mutants: the leap\'s fixed speeds, the spell\'s air arm over a leap)', () => {
  for (const [label, o] of [
    ['Speed 100/Running 100, Jumping 50', { stats: { speed: 100, running: 100 }, jumping: 50, boost: 1.25 }],
    ['Speed 100/Running 100, Jumping 100', { stats: { speed: 100, running: 100 }, jumping: 100, boost: 1.5 }],
    ['Speed 50/Running 30, Jumping 200', { stats: { speed: 50, running: 30 }, jumping: 200, boost: 2.0 }],
    ['Speed 100/Running 100, Jumping 200', { stats: { speed: 100, running: 100 }, jumping: 200, boost: 2.0 }],
    ['a Jump spell, Speed 50/Running 30, Jumping 50', { stats: { speed: 50, running: 30 }, jumping: 50, boost: 1.85, spell: true }],
  ]) {
    const jump = gapFlight({ ...o, enabled: false }), leap = gapFlight({ ...o, enabled: true });
    assert.ok(leap.billed.includes('leap'), `${label}: a leap`);
    assert.ok(leap.dist >= jump.dist - 0.02, `${label}: the leap flies ${leap.dist.toFixed(2)} m, the plain jump ${jump.dist.toFixed(2)}`);
  }
  // L3: the eject across L3's alley under the spell flies as without it, and catches the far ledge
  for (const spell of [false, true]) {
    const w = world();
    w.box(-3, 0, 1, 3, 8, 4); w.box(-3, 0, -8, 3, 7.0, -1.9);
    const m = climber(w.col, { extra: { enhancedJumping: () => spell, jumpBoost: () => 1.85 } });
    m.spawn(0, 8.02, 2.5);
    const vz = [];
    const r = drive(m, Math.PI, (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (c.h == null) { if (mm.hanging) c.h = i; else return { forward: 1 }; }
      if (i > c.h + 20 && i <= c.h + 24) vz.push(mm._airVelZ);
      return i === c.h + 20 ? { jump: true, forward: -1 } : {};
    }, 240);
    assert.ok(vz.every((v) => v < -3), `spell ${spell}: the push-off keeps its way out (${vz.map((v) => v.toFixed(2))})`);
    assert.ok(m.hanging && r.fell < 1, `spell ${spell}: caught the far ledge (${r.seen.join(' > ')})`);
  }
});

test('AUDIT CLIMB-ARC L4/L5: the late press is the at-edge leap - launched along the RUN (the view turned after leaving the edge does not steer it), and only where a Jump at the edge would have leapt (never off a 0.9 m step, never crouched) (mutants: the view\'s way, the drop unasked, the crouch unasked)', () => {
  for (const turn of [Math.PI / 2, Math.PI]) {
    const w = world();
    w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, 4, 3, 8, 15);
    const m = climber(w.col);
    m.spawn(0, 8.02, -8);
    const r = drive(m, (i, mm, c) => (c.off != null && i - c.off >= 2 ? turn : 0), (i, mm, c) => {
      if (!mm.grounded && mm.pos[1] < 8 && c.off == null) c.off = i;
      return { forward: 1, run: true, jump: c.off != null && i - c.off >= 3 && i - c.off < 6 };
    }, 200);
    assert.ok(r.billed.includes('leap'), 'a late press leaps');
    const after = r.log[r.ctx.off + 4].vel;
    assert.ok(Math.abs(after[0]) < 1e-6 && after[2] > 9, `the view turned ${(turn / DEG).toFixed(0)} deg: launched along the run (vel ${after.map((v) => v.toFixed(2))})`);
  }
  // L5: off a 0.9 m porch step, and a crouched run off a cliff - a press a beat after is no leap
  {
    const w = world(); w.box(-3, 0, -20, 3, 0.9, 0);
    const m = climber(w.col);
    m.spawn(0, 0.92, -8);
    const r = drive(m, 0, (i, mm, c) => {
      if (c.off == null && !mm.grounded && mm.pos[2] > -0.5) c.off = i;
      return { forward: mm.pos[2] < 8 ? 1 : 0, run: true, jump: c.off != null && i - c.off === 3 };
    }, 200);
    assert.ok(r.ctx.off != null && !r.billed.includes('leap'), `off a 0.9 m step: billed [${r.billed}]`);
  }
  {
    const col = new Collider((x, z) => (z < 0 ? 8 : 0));
    const m = climber(col);
    m.spawn(0, 8.02, -8);
    const r = drive(m, 0, (i, mm, c) => {
      if (c.off == null && !mm.grounded && i > 5 && mm.pos[2] > -1) c.off = i;
      return { crouch: i === 0, forward: 1, run: true, jump: c.off != null && i - c.off === 3 };
    }, 200);
    assert.ok(r.ctx.off != null && !r.billed.includes('leap'), `a crouched run off a cliff: billed [${r.billed}]`);
  }
});

test('AUDIT CLIMB-ARC L6: a placement ends the late press and the flight - a teleport\'s spawn under its freeze (Jump held through it), a spawn mid-eject, pinFeet (mutants: spawn, pinFeet, the freeze keeping either)', () => {
  // the teleport mid-run, Jump held through the freeze: the plain jump at the far side, never a leap
  {
    const w = world(); w.box(-20, -1, -20, 20, 0, 20);
    const m = climber(w.col);
    m.spawn(0, 0.02, -10);
    const r = drive(m, 0, (i, mm, c) => {
      if (i === 40) { mm.freezeMotor = 0.5; mm.spawn(5, 0.02, 5); c.tp = i; }
      return { forward: 1, run: true, jump: c.tp != null && i > c.tp + 10 };
    }, 140);
    assert.ok(!r.billed.includes('leap'), `teleported mid-run, Jump held: billed [${r.billed}]`);
  }
  // spawned into the air from a run at a roof's edge: a Jump the step after is no late leap off that edge
  {
    const w = world(); w.box(-3, 0, -30, 3, 8, 0);
    const m = climber(w.col);
    m.spawn(0, 8.02, -10);
    const r = drive(m, 0, (i, mm, c) => {
      if (c.tp == null && mm.grounded && mm.pos[2] > -0.6) { c.tp = i; return { forward: 1, run: true }; }
      if (c.tp === i - 1) mm.spawn(0, 20, -20);   // the host's placement, up in the air over the roof
      return c.tp == null ? { forward: 1, run: true } : { jump: i === c.tp + 2 };
    }, 120);
    assert.ok(r.ctx.tp != null, 'ran to the edge');
    assert.ok(!r.billed.includes('leap'), `placed into the air from a run at the edge: billed [${r.billed}]`);
  }
  // a freeze alone (the helm's, a door's) a step after running off the edge: a press after it is no late leap
  {
    const w = world(); w.box(-3, 0, -30, 3, 8, 0);
    const m = climber(w.col);
    m.spawn(0, 8.02, -10);
    const r = drive(m, 0, (i, mm, c) => {
      if (c.off == null && !mm.grounded && mm.pos[2] > -0.5) { c.off = i; mm.freezeMotor = 0.2; }
      if (c.off != null && c.thaw == null && !(mm.freezeMotor > 0)) c.thaw = i;
      return c.off == null ? { forward: 1, run: true } : { forward: 1, run: true, jump: c.thaw != null && i === c.thaw + 1 };   // the thaw's own step is the cancelled one
    }, 200);
    assert.ok(r.ctx.thaw != null, 'frozen and let go');
    assert.ok(!r.billed.includes('leap'), `a press after a freeze: billed [${r.billed}]`);
  }
  // placed mid-eject before a ledge the view faces: the catch looks the view's way, as a fresh body's does
  {
    const w = world();
    w.box(-3, 0, 1, 3, 8, 4); w.box(17, 0, 4.0, 23, 7.0, 8);
    const m = climber(w.col);
    m.spawn(0, 8.02, 2.5);
    drive(m, (i, mm, c) => (c.h != null && i >= c.h + 23 ? 0 : Math.PI), (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (c.h == null) { if (mm.hanging) c.h = i; else return { forward: 1 }; }
      if (i === c.h + 23) mm.spawn(20, 7.6, 3.4);
      return i === c.h + 20 ? { jump: true, forward: -1 } : {};
    }, 260);
    assert.ok(m.hanging && m.pos[1] > 5, `placed mid-flight before a ledge: caught it (${state(m)} y ${m.pos[1].toFixed(2)})`);
  }
  // pinFeet mid-flight, and mid-run
  {
    const w = world();
    w.box(-3, 0, 1, 3, 8, 4);
    const m = climber(w.col);
    m.spawn(0, 8.02, 2.5);
    let flew = false;
    drive(m, Math.PI, (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (c.h == null) { if (mm.hanging) c.h = i; else return { forward: 1 }; }
      if (i === c.h + 22) { flew = !!mm.climbFlight || !!mm._pkLeap; mm.pinFeet(10, 8, 10); }
      return i === c.h + 20 ? { jump: true, forward: -1 } : {};
    }, 120);
    assert.ok(flew, 'in an eject\'s flight');
    const m2 = climber(world().col);
    m2.spawn(0, 0.02, 0);
    for (let i = 0; i < 30; i++) m2.update(1 / 60, { ...blank, forward: 1, run: true }, 0);
    m2.pinFeet(0, 0.02, 0);
    const m3 = climber(w.col);
    m3.spawn(0, 8.02, 2.5);
    let leapAtPin = null;
    drive(m3, Math.PI, (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (c.h == null) { if (mm.hanging) c.h = i; else return { forward: 1 }; }
      if (i === c.h + 22) { mm.pinFeet(10, 20, 10); leapAtPin = mm._pkLeap; }
      return i === c.h + 20 ? { jump: true, forward: -1 } : {};
    }, 60);
    assert.equal(leapAtPin, null, 'pinFeet ends the flight');
    assert.equal(m2._pkOffEdge, null, 'pinFeet ends the late press\'s clock');
  }
});

test('AUDIT CLIMB-ARC L7/L8: no leap where the plain jump would not go - a Jump HELD as the hands take the wall from the water is no fresh press, and under Slowfall or wading outdoor water a running Jump (at the edge or a beat after) is no leap (mutants: the latch, the jump\'s cancels unasked)', () => {
  {
    const w = world();
    w.box(-3, 0, 1.3, 3, 9, 4); w.box(-3, 2.7, 1.15, 3, 3.0, 1.3);
    const m = climber(w.col);
    m.spawn(0, 0.02, 0.75);
    m.waterSurfaceY = 1.2;
    const r = drive(m, 0, (i, mm) => { mm.swimming = !mm.onWall && !mm.mantling; return { forward: 1, jump: true, up: true }; }, 120);
    assert.ok(r.seen.includes('climb'), 'the free climb taken from the water');
    assert.ok(!r.billed.includes('leap'), `Jump held: billed [${r.billed}] (${r.seen.join(' > ')})`);
  }
  // wading outdoor water up to the edge (Iliac Puddle No More keeping the head above it unsunk): no leap, as no jump
  {
    const w = world(); w.box(-3, 0, -30, 3, 20, 0);
    const m = climber(w.col, { jumping: 100 });
    m.spawn(0, 20.02, -10);
    const billed = [];
    for (let i = 0; i < 300; i++) {
      const near = m.grounded && m.pos[2] > -0.9 && m.pos[2] < -0.4;
      m.onExteriorWater = m.grounded && m.pos[2] > -2;
      m.update(1 / 60, { ...blank, forward: 1, run: true, jump: near }, 0);
      m.forceUnsink();
      if (m.parkoured) billed.push(m.parkoured);
    }
    assert.ok(!billed.includes('leap'), `outdoor water at the edge: billed [${billed}]`);
  }
  for (const [label, set] of [['Slowfall', (m) => { m.slowFalling = true; }]]) {
    for (const [when, press] of [['at the edge', (m, i, c) => m.grounded && m.pos[2] > -0.9 && m.pos[2] < -0.4], ['a beat after', (m, i, c) => c.off != null && i - c.off === 3]]) {
      const w = world();
      w.box(-3, 0, -30, 3, 20, 0);
      const m = climber(w.col, { jumping: 100 });
      m.spawn(0, 20.02, -10);
      const r = drive(m, 0, (i, mm, c) => {
        set(mm);
        if (c.off == null && !mm.grounded && mm.pos[2] > -0.5) c.off = i;
        return { forward: 1, run: true, jump: press(mm, i, c) };
      }, 400);
      assert.ok(!r.billed.includes('leap'), `${label}, Jump ${when}: billed [${r.billed}]`);
    }
  }
});

test('AUDIT CLIMB-ARC L9: a side leap is never along the very lip the shimmy follows - a sloped coping, a round tower\'s ring (mutant: the held lip run along the held face\'s line at the held height)', () => {
  for (const deg of [10, 20]) {
    const w = world();
    const k = Math.tan(deg * DEG), top = (x) => 2.4 + k * (x + 1);
    w.col.addMesh('coping', new Float32Array([-6, 0, 1, 6, 0, 1, 6, top(6), 1, -6, top(-6), 1, -6, 0, 4, 6, 0, 4, 6, top(6), 4, -6, top(-6), 4]), BOX_IDX, I);
    w.box(-6, 0, 1.5, 6, 12, 4);
    const m = climber(w.col);
    m.spawn(-1, 0.02, 0.45);
    const r = drive(m, 0, hangThen({ jump: true, strafe: 1 }), 160);
    assert.ok(r.ctx.h != null, 'hung');
    assert.ok(!r.seen.includes('move:leap'), `${deg} deg coping, Jump + Right: no leap along it (${r.seen.join(' > ')}; AUDIT CLIMB-FIELD J1: the press pushes off instead)`);
  }
  const prism = (col, key, n, R, y0, y1, cx, cz) => {
    const v = [], idx = [];
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / n; v.push(cx + R * Math.cos(a), y0, cz + R * Math.sin(a), cx + R * Math.cos(a), y1, cz + R * Math.sin(a)); }
    v.push(cx, y0, cz, cx, y1, cz);
    const c0 = 2 * n, c1 = 2 * n + 1;
    for (let k = 0; k < n; k++) { const a0 = 2 * k, a1 = a0 + 1, b0 = 2 * ((k + 1) % n), b1 = b0 + 1; idx.push(a0, b0, b1, a0, b1, a1, c1, a1, b1, c0, b0, a0); }
    col.addMesh(key, new Float32Array(v), idx, I);
  };
  for (const strafe of [1, -1]) {
    const col = new Collider(() => 0);
    prism(col, 'ring', 16, 4.0, 0, 2.4, 0, 4.5);
    prism(col, 'core', 16, 3.5, 0, 9, 0, 4.5);
    const m = climber(col);
    m.spawn(0, 0.02, 0.1);
    const r = drive(m, 0, hangThen({ jump: true, strafe }), 200);
    assert.ok(r.ctx.h != null, 'hung on the ring');
    assert.ok(!r.seen.includes('move:leap'), `round the tower, Jump + ${strafe > 0 ? 'Right' : 'Left'}: no leap along the ring (${r.seen.join(' > ')})`);
  }
});

test('AUDIT CLIMB-ARC L10: running is running at pace - Run held against a wall from a standstill is no wall run (mutant: the toggle read for the pace)', () => {
  const w = world(); w.box(-3, 0, 2, 3, 4.2, 5);
  const m = climber(w.col, { skill: 100 });
  m.spawn(0, 0.02, 1.5);
  const r = drive(m, 0, (i) => ({ forward: i <= 14 ? 1 : 0, run: true, jump: i === 14 }), 120);
  assert.ok(!r.billed.includes('wallrun'), `pressed still against the wall: billed [${r.billed}]`);
  // the run at pace still runs the wall
  const m2 = climber(w.col, { skill: 100 });
  m2.spawn(0, 0.02, -6);
  const r2 = drive(m2, 0, (i, mm) => ({ forward: 1, run: true, jump: mm.pos[2] > 0.6 && mm.pos[2] < 1.1 }), 120);
  assert.ok(r2.billed.includes('wallrun'), `a run up to it: billed [${r2.billed}]`);
});

test('AUDIT CLIMB-ARC L11/L12: a lipless wall run rides its hull, and a save mid-run keeps the climb\'s hold (mutants: the face\'s key dropped, the wall\'s hold unsaved)', () => {
  // L11: up a hull moving away at 2 m/s, a run with no lip in reach ends on the wall, against the hull
  {
    const col = new Collider(() => -100);
    col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
    const t = [0, 0, 0];
    col.addMesh('hull', boxVerts(-3, 0, 2, 3, 9, 5), BOX_IDX, I, () => t, null);
    const m = climber(col, { skill: 0 });
    m.spawn(0, 0.02, -6);
    let ran = null, out = null;
    for (let i = 0; i < 200; i++) {
      if (ran != null) { t[2] += 2 / 60; col._broad = null; }
      m.update(1 / 60, { ...blank, ...(ran == null ? { forward: 1, run: true, jump: m.pos[2] > 0.6 && m.pos[2] < 1.1 } : {}) }, 0);
      if (m.parkoured === 'wallrun') ran = i;
      if (ran != null && !m.mantling && out == null) out = { onWall: m.onWall, gap: 2 + t[2] - m.pos[2] - CAPSULE_RADIUS };
    }
    assert.ok(ran != null && out, 'a wall run');
    assert.ok(out.onWall && out.gap < 0.1, `ended on the wall, ${out.gap.toFixed(2)} m off the hull`);
    assert.ok(m.onWall, `and held on (${state(m)})`);
  }
  // L12: saved mid-run, loaded: on the wall where the run would have ended
  {
    const w = world(); w.box(-3, 0, 2, 3, 9, 5);
    const m = climber(w.col, { skill: 0 });
    m.spawn(0, 0.02, -6);
    let snap = null, saved = null;
    for (let i = 0; i < 200 && !snap; i++) {
      m.update(1 / 60, { ...blank, forward: 1, run: true, jump: m.pos[2] > 0.6 && m.pos[2] < 1.1 }, 0);
      if (m.mantling && m.climbMove.kind === 'wallrun' && m.climbMove.t > 0.5) { snap = m.fallSnapshot(); saved = [...m.pos]; }
    }
    assert.ok(snap, 'saved mid-run');
    assert.equal(snap.hold?.mode, 'climb', 'the hold the run ends in, saved');
    const l = climber(w.col, { skill: 0 });
    l.spawn(...saved);
    l.restoreFall(JSON.parse(JSON.stringify(snap)));
    for (let i = 0; i < 90; i++) l.update(1 / 60, blank, 0);
    assert.ok(l.onWall && l.pos[1] > 0.5, `loaded: ${state(l)} at y ${l.pos[1].toFixed(2)}`);
  }
});

test('AUDIT CLIMB-ARC L13: every move a frame begins is billed - an eject and its catch inside one 10 fps or 4 fps frame bill the leap and the catch, and the ticker bills each (mutants: the motor\'s one slot, the ticker\'s one bill)', () => {
  for (const fps of [10, 4]) {
    const w = world();
    w.box(-3, 0, 1, 3, 8, 4); w.box(-3, 0, -8, 3, 8.0, -0.2);
    const m = climber(w.col);
    m.spawn(0, 8.02, 2.5);
    const billed = [];
    let started = false, hangT = null, pressed = false, t = 0;
    for (let f = 0; t < 6; f++) {
      let input = {};
      if (f === 0) input = { crouch: true };
      else if (!started) { if (m.mantling || m.onWall) started = true; else input = { forward: 1 }; }
      if (started && m.hanging && hangT == null) hangT = t;
      if (hangT != null && !pressed && t >= hangT + 0.34) { input = { jump: true, forward: -1 }; pressed = true; }
      m.update(1 / fps, { ...blank, ...input }, Math.PI);
      t += 1 / fps;
      if (m.parkoured) billed.push(...[].concat(m.parkoured));
    }
    assert.ok(billed.includes('leap') && billed.includes('catch'), `${fps} fps: billed [${billed}]`);
  }
  // a running leap across a 1 m alley and the sheer wall it grabs (Forward and Jump held), one 4 fps frame
  {
    const w = world(); w.box(-3, 0, -30, 3, 8, 0); w.box(-6, 0, 1, 6, 20, 4);
    const m = climber(w.col);
    m.spawn(0, 8.02, -10);
    const billed = [];
    let pressed = false;
    for (let t = 0; t < 4; t += 1 / 4) {
      if (!pressed && m.grounded && m.pos[2] > -1.2) pressed = true;
      m.update(1 / 4, { ...blank, forward: 1, run: true, jump: pressed && !m.onWall }, 0);
      if (m.parkoured) billed.push([].concat(m.parkoured));
    }
    assert.ok(billed.some((b) => b.includes('leap') && b.includes('catch')), `4 fps: one frame billed the leap and the grab (${JSON.stringify(billed)})`);
  }
  const run = (activity) => {
    const entity = { level: 1, health: 50, maxHealth: 50, fatigue: 6400, magicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), items: [], activeEffects: [] };
    let drained = 0;
    tickPlayerMinutes({ entity, classicMinutes: 10.2, dt: 0.001, activity, fatigueMultiplier: 1, rolls: () => 0.5, sinks: { drainFatigue: (d) => { drained += d; } } });
    return { drained, uses: entity.skillUses };
  };
  const one = run({ standing: true, parkoured: 'leap' }), two = run({ standing: true, parkoured: ['leap', 'catch'] });
  assert.equal(two.uses[SKILLS.Jumping], 1, 'the leap trains Jumping');
  assert.equal(two.uses[SKILLS.Climbing], 1, 'the catch trains Climbing');
  assert.equal(two.drained, 2 * one.drained, 'two exertions');
});

test('AUDIT CLIMB-ARC L15: the wall run\'s height reads the climb\'s skill the moves read - a Khajiit\'s, the Climbing spell\'s (mutant: the raw Climbing)', () => {
  const top = (inputs) => {
    const w = world(); w.box(-3, 0, 2, 3, 9, 5);
    const m = climber(w.col, { inputs: () => inputs });
    m.spawn(0, 0.02, -6);
    let to = null;
    drive(m, 0, (i, mm) => {
      if (mm.climbMove?.kind === 'wallrun') to ??= mm.climbMove.to[1];
      return mm.onWall || mm.mantling ? {} : { forward: 1, run: true, jump: mm.pos[2] > 0.6 && mm.pos[2] < 1.1 };
    }, 200);
    assert.ok(to != null, 'a wall run');
    return to;
  };
  const plain = top({ climbing: 50, jumping: 50 });
  for (const extra of [{ khajiit: true }, { enhanced: true }]) {
    const inputs = { climbing: 50, jumping: 50, ...extra };
    const want = P.wallRunHeight(P.parkourSkill(inputs), 50);
    assert.ok(want > plain + 0.1);
    assert.ok(Math.abs(top(inputs) - want) < 0.01, `${JSON.stringify(extra)}: the run's height ${top(inputs).toFixed(3)}, the moves' skill's ${want.toFixed(3)}`);
  }
});

test('AUDIT CLIMB-ARC L16: a leap\'s first step charges the grip once - the leap\'s tenth and the hang\'s own step, never the hang\'s twice (mutant: the step spent again)', () => {
  const w = world();
  w.box(-6, 0, 1, -0.3, 2.4, 4); w.box(0.9, 0, 1, 6, 2.4, 4); w.box(-6, 0, 1.5, 6, 6, 4);
  const m = climber(w.col);
  m.spawn(-1, 0.02, 0.45);
  const r = drive(m, 0, hangThen({ jump: true, strafe: 1 }), 120);
  const h = r.ctx.h, step = (1 / 60) / P.gripSeconds(50, 1);
  assert.ok(r.billed.includes('leap'), 'a side leap');
  const leapStep = r.log[h + 19].grip - r.log[h + 20].grip;
  assert.ok(Math.abs(leapStep - (P.PARKOUR_LEAP_GRIP + step)) < 1e-6, `the leap's step spent ${leapStep.toFixed(6)}: the leap's ${P.PARKOUR_LEAP_GRIP} and one step's ${step.toFixed(6)}`);
});

// ---- THE WAY DOWN (CLIMB-DOWN) ------------------------------------------------------------------------------------------

/** The 8 m tower (6 m square about the origin), with a parapet `ph` high and `pw` thick round its roof. */
function tower(H, ph = 0, pw = 0) {
  const w = world();
  w.box(-3, 0, -3, 3, H, 3);
  if (ph > 0) { w.box(-3, H, -3, 3, H + ph, -3 + pw); w.box(-3, H, 3 - pw, 3, H + ph, 3); w.box(-3, H, -3, -3 + pw, H + ph, 3); w.box(3 - pw, H, -3, 3, H + ph, 3); }
  return w;
}

test('AUDIT CLIMB-ARC D1: Forward still held into the lower\'s hang does not climb back up - the hang asks a fresh Forward - at 60, 30 and 10 fps; a fresh press still climbs (mutant: the hang\'s up unrefused)', () => {
  for (const fps of [60, 30, 10]) {
    for (const holdMs of [50, 200, Infinity]) {
      const { col } = tower(8);
      const m = climber(col);
      m.spawn(0, 8.02, 0);
      const r = drive(m, Math.PI, (i, b, c) => {
        if (i === 0) return { crouch: true };
        if (c.h == null && b.hanging) c.h = i;
        if (c.h == null || ((i - c.h) * 1000) / fps < holdMs) return { forward: 1 };
        return {};
      }, Math.ceil(4 * fps), 1 / fps);
      assert.ok(r.seen.includes('hang'), `${fps} fps: the lower hangs`);
      assert.ok(!r.seen.slice(r.seen.indexOf('hang')).includes('move:mantle'), `${fps} fps, Forward held ${holdMs} ms into the hang: ${r.seen.join(' > ')}`);
      assert.ok(r.fell < 1, `${fps} fps: no fall (${r.fell.toFixed(2)} m)`);
    }
  }
  const { col } = tower(8);
  const m = climber(col);
  m.spawn(0, 8.02, 0);
  const r = drive(m, Math.PI, (i, b, c) => {
    if (i === 0) return { crouch: true };
    if (c.h == null && b.hanging) c.h = i;
    if (c.h == null || i - c.h < 30) return { forward: 1 };
    return i - c.h === 40 ? { forward: 1 } : {};
  }, 400);
  assert.ok(r.seen.slice(r.seen.indexOf('hang')).includes('move:mantle'), `a fresh Forward climbs up: ${r.seen.join(' > ')}`);
});

test('AUDIT CLIMB-ARC D2: a ledge topped by the ground is mantled onto though the drawn ground lies 6-8 cm under the capsule\'s floor (mutant: the drawn ground stood on)', () => {
  for (const gap of [0.06, 0.08]) {
    const bank = (z) => (z >= 4 ? 1.4 : 0);
    const w = world((x, z) => bank(z) + (z >= 4 ? gap : 0), (x, z) => bank(z));
    w.col.addMesh('wall', boxVerts(-3, -1, 3.9, 3, 1.4, 4.0), BOX_IDX, I);
    const m = climber(w.col);
    m.spawn(0, 0.02, 3.2);
    const r = drive(m, 0, (i) => ({ jump: i === 20 }), 120);
    assert.ok(r.billed.includes('mantle'), `drawn ground ${gap} under: ${r.seen.join(' > ')}`);
    assert.ok(m.grounded && m.pos[1] > 1.4, `stood on the bank (y ${m.pos[1].toFixed(3)})`);
  }
});

test('AUDIT CLIMB-ARC D3: a 1.3 m parapet over a 1.6-1.7 m outer drop is no trap - Forward and Jump at it clamber over (mutant: the tall parapet\'s clamber gone)', () => {
  for (const drop of [1.6, 1.7]) {
    const w = world();
    w.box(-3, 0, -3, 3, 8, 3);
    w.box(-3, 8, -3, 3, 9.3, -2.75);
    w.box(-6, 0, -9, 6, 9.3 - drop, -3);
    const m = climber(w.col);
    m.spawn(0, 8.02, 0);
    const r = drive(m, Math.PI, (i, b, c) => {
      if (!c.j) { if (b.pos[2] > -2.25) return { forward: 1 }; c.j = 1; return { forward: 1, jump: true }; }
      return { forward: b.pos[2] > -3.6 ? 1 : 0 };   // over, and stopped on the roof outside
    }, 600);
    assert.ok(m.pos[2] < -2.75, `drop ${drop}: over the parapet (${r.seen.join(' > ')})`);
    assert.ok(r.fell < 2.5, `a drop no worse than a hang's let-go (${r.fell.toFixed(2)} m)`);
  }
});

test('AUDIT CLIMB-ARC D4: the crouched Jump over the parapet hangs standing, its eye at the lip as the lower\'s (mutant: the hang begun crouched)', () => {
  const w = world();
  w.box(-3, 0, -3, 3, 8, 3); w.box(-3, 8, -3, 3, 9, -2.75);
  const m = climber(w.col);
  m.spawn(0, 8.02, 0);
  let hang = null, jumped = false;
  for (let i = 0; i < 300 && !hang; i++) {
    let inp = {};
    if (i === 0) inp = { crouch: true };
    else if (!jumped && m.pos[2] > -2.25) inp = { forward: 1 };
    else if (!jumped) { inp = { jump: true }; jumped = true; }
    m.update(1 / 60, { ...blank, ...inp }, Math.PI);
    if (m.hanging) hang = { crouching: m.crouching, height: m.height, eyeToLip: m.eye[1] - m._wall.lipY };
  }
  assert.ok(hang, 'the over-hang hangs');
  assert.equal(hang.crouching, false, 'standing');
  assert.ok(Math.abs(hang.height - 1.8) < 1e-6);
  assert.ok(Math.abs(hang.eyeToLip + 0.1) < 0.05, `the eye ${hang.eyeToLip.toFixed(3)} m to the lip`);
});

// ---- THE PEERS AND THE BODY (CLIMB5) ------------------------------------------------------------------------------------

test('AUDIT CLIMB-ARC N1: the sprite lane\'s body is drawn on the VIEW\'s yaw (its quad\'s plane, its camera\'s) while the Morrowind body turns to the wall - mwViewDrawBody hands it viewYaw, and every host hands viewYaw (mutants: the body\'s yaw to the sprite, a host unwired)', async () => {
  const mw = await import('../src/player/mwView.js');
  const { setModSetting, _resetModSettings } = await import('../src/systems/modSettings.js');
  const { m } = hungOn(3);
  const view = Math.PI / 2;
  for (let i = 0; i < 30; i++) m.update(1 / 60, blank, view);
  const bodyYaw = m.bodyYawFor(view);
  assert.ok(Math.abs(wrap(bodyYaw - view)) > 1, 'the body faces the wall, the view along it');
  const got = [];
  try {
    setModSetting('eye-of-the-beholder', 'Enabled', true);
    mw.setEotbBodyReady(() => true);
    mw.setEotbDrawBody((canvas, o) => { got.push(o.yaw); return true; });
    assert.ok(mw.eotbLane(), 'the sprite lane');
    mw.mwViewDrawBody(null, { proj: I, view: I, eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: bodyYaw, viewYaw: view });
  } finally { mw.setEotbDrawBody(null); mw.setEotbBodyReady(null); _resetModSettings(); }
  assert.deepEqual(got, [view], 'the sprite lane draws on the view\'s yaw');
  for (const f of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeon.js']) {
    const calls = src(f).match(/mwViewDrawBody\(canvas, \{[^}]*\}\)/g) ?? [];
    assert.ok(calls.length > 0, f);
    for (const c of calls) assert.match(c, /yaw: player\.bodyYawFor\(cam\.yaw\), viewYaw: cam\.yaw/, `${f}: ${c}`);
  }
});

test('AUDIT CLIMB-ARC N2: a beast on the wall is drawn as every other peer - facing the wall it climbs, and standing, no stride (mutants: the camera\'s yaw, the move bit read raw)', async () => {
  const { createPeerRiders, beastTable } = await import('../src/net/peerRiders.js');
  const { spriteFor } = await import('../src/player/eotbSprite.js');
  const shown = { x: 0, y: 2, z: 0, yaw: Math.PI, pitch: 0, mv: 1, wd: 0, wb: 1, cl: 2, cw: 0 };
  assert.equal(beastTable(shown), beastTable({ ...shown, mv: 0 }), 'on the wall the beast walks no stride');
  const drawn = [];
  const art = { renderer: { createBillboardBatch: (a, r, size) => ({ archive: a, rec: r, size, origin: [0, 0, 0] }), destroyBillboardBatch() {} }, ensure: (s) => { drawn.push(s); return { w: 4, h: 6 }; } };
  createPeerRiders({ art }).sync([{ id: 'w', shown }], (p) => [p.x, p.y, p.z], { eye: [0, 1.6, -5], right: [1, 0, 0], dt: 1 / 60 });
  const want = spriteFor(beastTable({ ...shown, mv: 0 }), 4, 0, { lycanthropyType: 1 });   // facing the wall (+z), seen from behind
  assert.equal(drawn.at(-1)?.rec, want.rec, `drawn ${drawn.at(-1)?.rec}, want ${want.rec}: the beast faces its wall`);
});

test('AUDIT CLIMB-ARC N3: the classic climb faces its wall - climbFacing and the pose\'s cw from the wall the motor latched, whatever the view does (mutant: no facing off the enhanced lane)', () => {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('wall', new Float32Array([-5, 0, 0.4, 5, 0, 0.4, 5, 6, 0.4, -5, 6, 0.4]), [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} } });
  m.spawn(0, 0.02, 0);
  for (let i = 0; i < 60; i++) m.update(1 / 30, { ...blank, forward: 1 }, 0);
  for (let i = 0; i < 20; i++) m.update(1 / 30, { ...blank, forward: 1 }, Math.PI / 2);
  assert.ok(m.climb?.isClimbing, 'the classic climb');
  assert.ok(Number.isFinite(m.climbFacing) && Math.abs(wrap(m.climbFacing)) < 0.05, `facing the wall (+z): ${m.climbFacing}`);
  assert.ok(Number.isFinite(climbPoseOf(m).cw) && Math.abs(wrap(climbPoseOf(m).cw)) < 0.05, `the pose says it: ${JSON.stringify(climbPoseOf(m))}`);
});

// OPEN: the fix (motor.js _stepBodyYaw's offset decayed "from the view") is the old chase restated - the offset is taken
// against THIS frame's view, so a view turning w rad/s still leaves the body w * dt * (1 - k) / k behind it (0.216 rad
// at 3 rad/s, 60 fps), exactly as on d92a75a13. Carried as a todo - it reports, it does not fail - until the body keeps
// its offset from the view it last had.
test('AUDIT CLIMB-ARC N4: off the wall the body is handed back to a view still turning - the view\'s yaw exactly within 0.75 s of the let-go (mutant: the view chased)', () => {
  const { m } = hungOn(3);
  let yaw = 1.5;
  for (let i = 0; i < 10; i++) m.update(1 / 60, blank, yaw);
  m.update(1 / 60, { ...blank, crouch: true }, yaw);
  let back = null;
  for (let i = 0; i < 120; i++) {
    yaw += 3 / 60;
    m.update(1 / 60, blank, yaw);
    if (back == null && !m.onWall && m.bodyYawFor(yaw) === yaw) back = i;
  }
  assert.equal(m.bodyYawFor(yaw), yaw, `still trailing by ${wrap(yaw - m.bodyYawFor(yaw)).toFixed(3)} rad`);
  assert.ok(back != null && back <= 45, `handed back after ${back} frames`);
});

test('AUDIT CLIMB-ARC N5: the peers\' sounds\' switch silences, it does not blind - switched back on, it replays nothing that happened while it was off (mutant: the law untold with the switch off)', async () => {
  const { RemotePlayers } = await import('../src/net/remotePlayers.js');
  const { getPref, setPref } = await import('../src/systems/uiPrefs.js');
  const shots = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: { play3d: (k) => shots.push(k) } }, compose: async () => null });
  const peer = (s) => ({ id: 'amy-0002', name: 'amy', shown: { yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, fk: 0, ...s }, look: null });
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 60 };
  const was = getPref('peerFootsteps');
  try {
    for (let i = 0; i < 5; i++) rp.sync([peer({ x: 3, y: 0, z: 4 })], (p) => [p.x, p.y, p.z], opts);
    setPref('peerFootsteps', false);
    for (let i = 0; i < 60; i++) rp.sync([peer({ x: 3, y: 2, z: 4, cl: 1, cw: 0 })], (p) => [p.x, p.y, p.z], opts);
    setPref('peerFootsteps', true);
    for (let i = 0; i < 5; i++) rp.sync([peer({ x: 3, y: 2, z: 4, cl: 1, cw: 0 })], (p) => [p.x, p.y, p.z], opts);
  } finally { setPref('peerFootsteps', was); }
  assert.deepEqual(shots, [], 'a catch from while the switch was off, replayed');
});

test('AUDIT CLIMB-ARC N6: a floor under one peer\'s climb sounds - a hostile pose stream flipping the hold every frame, or swinging along a lip, sounds at most ~10 one-shots a second (mutants: the cue floor, the rhythm floor)', async () => {
  const { PeerClimbSounds } = await import('../src/net/peerClimb.js');
  for (const [label, poseAt] of [
    ['the hold flipped every frame', (f) => ({ cl: 1 + (f % 2), cw: 0 })],
    ['a metre-less swing along a lip', (f) => ({ cl: 1, cw: 0, dx: (f % 2) * 0.9 })],
    ['a face, a hand every frame', (f) => ({ cl: 2, cw: 0, dy: (f % 2) * 0.9 })],
  ]) {
    let now = 0;
    const shots = [];
    const s = new PeerClimbSounds({ audio: { play3d: (k) => shots.push(k) }, on: () => true, rand: () => 0.3, install: false, now: () => now });
    const FPS = 60;
    for (let f = 0; f < FPS * 5; f++) {
      now = (f * 1000) / FPS;
      const p = poseAt(f);
      s.update('evil', p, [2 + (p.dx ?? 0), 2 + (p.dy ?? 0), 2], true);
    }
    assert.ok(shots.length / 5 <= 10, `${label}: ${(shots.length / 5).toFixed(1)} one-shots a second`);
    assert.ok(shots.length > 0, `${label}: still heard`);
  }
});

test('AUDIT CLIMB-ARC N7: the widest pose the attachment pins measure carries the climb - cl, cw and a move\'s ck, cy, cd - through validPose', () => {
  const v = validPose(WIDE_POSE);
  for (const k of ['cl', 'cw', 'ck', 'cy', 'cd']) assert.ok(k in WIDE_POSE && k in v, `${k} in the widest pose`);
});

// ---- PERF-CLIMB ---------------------------------------------------------------------------------------------------------

test('AUDIT CLIMB-ARC P1: the resolve\'s fixed-point stop reads all three axes - a capsule pressed into a wall along x runs the pass that pushed and the one that finds nothing left, as along z (mutant: the stop blind to x)', () => {
  const count = (col, fn) => {
    let n = 0;
    const orig = col._resolveSphere;
    col._resolveSphere = function (...a) { n++; return orig.apply(this, a); };
    try { fn(); } finally { col._resolveSphere = orig; }
    return n;
  };
  const col = new Collider(() => -100);
  col.addMesh('wall', boxVerts(1, 0, -3, 2, 4, 3), BOX_IDX, I);   // a face at x 1
  let pushed = 0;
  const into = count(col, () => { pushed = col.penetrationAt([1 - 0.25, 1, 0.5], 1.8); });   // z 0.5: the push leaves z and y to the bit
  assert.ok(Math.abs(pushed - 0.1) < 1e-6, `pressed 0.1 in along x, pushed out 0.1 (${pushed})`);
  assert.equal(into, 6, 'the pass that pushed, and the one that found nothing left');
  try {
    _setFixedPointStopForTest(false);
    let off = 0;
    count(col, () => { off = col.penetrationAt([1 - 0.25, 1, 0.5], 1.8); });
    assert.equal(off, pushed, 'the same answer without the stop');
  } finally { _setFixedPointStopForTest(true); }
});
