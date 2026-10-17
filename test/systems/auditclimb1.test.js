// AUDIT CLIMB1 (2026-09-30, Mac: "let's do an audit on this. I want to ensure it's perfect and 1:1 with what I
// want"): the enhanced climb's first slice audited in four lenses - fidelity to the ask and the four calls, an
// adversarial read of the code, the sensor against hostile geometry, and the hosts and records
// (bible/03-World/Parkour-Arc.md, AUDIT CLIMB1). Every finding below was pinned here RED on the CLIMB1 code before
// its fix. The geometry is boxes, and the body's overlap with them is measured EXACTLY (a capsule against an
// axis-aligned box), never through the collider's own resolve - which reverts a body it would push up into a
// ceiling and so reads a head through a slab as clear (the reason the fit needs its ray; parkour.js capsuleFits).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  senseLedge, parkourCatchHold, registerParkourGate, vaultDuration, mantleDuration, carryMove,
  PARKOUR_CATCH_HOLD_MIN, PARKOUR_CATCH_HOLD_MAX, PARKOUR_QUIET_STEPS,
} from '../../src/player/parkour.js';
import {
  PlayerMotor, motionBagOf, STEP_OFFSET, CAPSULE_RADIUS, CAPSULE_HEIGHT, CROUCH_HEIGHT, FALL_DAMAGE_THRESHOLD,
} from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { parkourSwitchOn } from '../../src/scenes/shared.js';
import { setPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../../src/systems/uiSkin.js';
import { rrParkourRefusal, NO_CLIMB_HOLDING_WEAPON } from '../../src/systems/roleplayRealism/rrRealism.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

/** A scene of solid boxes on a floor at 0, the boxes kept for the exact overlap measure. */
function scene(floorY = 0, { floor = true } = {}) {
  const col = new Collider(() => -100);
  const boxes = [];
  let n = 0;
  if (floor) col.addMesh('floor', new Float32Array([-20, floorY, -20, 20, floorY, -20, 20, floorY, 20, -20, floorY, 20]), [0, 1, 2, 0, 2, 3], I);
  const box = (x0, y0, z0, x1, y1, z1, key = `b${n++}`) => {
    col.addMesh(key, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX_IDX, I);
    boxes.push([x0, y0, z0, x1, y1, z1]);
  };
  return { col, box, boxes };
}

/** How deep a capsule at these feet, this tall, sits in any of the boxes - exact to a centimetre (the axis sampled
 *  every 2 cm, each point's distance to each box). 0 is a body in the open. */
function overlap(boxes, feet, h) {
  const r = CAPSULE_RADIUS;
  let worst = 0;
  for (let y = feet[1] + r; y <= feet[1] + h - r + 1e-9; y += 0.02) {
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const dx = Math.max(x0 - feet[0], 0, feet[0] - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - feet[2], 0, feet[2] - z1);
      worst = Math.max(worst, r - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}

/** A motor on a scene, the enhanced climb mounted, driven by a scripted input; every step logged. */
function drive(s, { skill = 50, jumping = 50, x = 0, z = 0.4, y = 0.02, yaw = 0, steps = 150, input, climbing = null, say = null } = {}) {
  const m = new PlayerMotor(s.col, { speed: 50, running: 30 }, {
    climbing,
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping }), say },
  });
  m.spawn(x, y, z);
  const log = { started: [], frames: [], worstDuring: 0, worstEyeY: -Infinity, fell: 0, endMove: null };
  for (let i = 0; i < steps; i++) {
    const was = m.mantling;
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, ...input(i, m) }, yaw);
    if (m.parkoured) log.started.push([i, m.parkoured, m._pkMove?.crouch ? 'crouch' : 'stand']);
    if (m.mantling) {
      log.worstDuring = Math.max(log.worstDuring, overlap(s.boxes, m.pos, m.height));
      log.worstEyeY = Math.max(log.worstEyeY, m.eyeAt()[1]);
    }
    if (was && !m.mantling && !log.endMove) log.endMove = { i, pos: [...m.pos], crouching: m.crouching, height: m.height };
    log.fell = Math.max(log.fell, m.landedFallDistance);
    log.frames.push([...m.pos]);
  }
  log.end = { pos: [...m.pos], grounded: m.grounded, crouching: m.crouching, height: m.height, overlap: overlap(s.boxes, m.pos, m.height) };
  return { m, log };
}
const tap = (at = 10) => (i) => ({ jump: i === at });
const runJump = (at = 10, until = 60) => (i) => ({ forward: i >= 4 && i < until ? 1 : 0, jump: i === at });
const GEO = (high, low = STEP_OFFSET) => ({ low, high, radius: CAPSULE_RADIUS, stand: CAPSULE_HEIGHT, crouch: CROUCH_HEIGHT, height: CAPSULE_HEIGHT });
const LOOK = [0, 0, 1];
const at = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];

// ---- the code and the geometry lenses: the body never ends up where the sensor did not prove it could be ----

test('AUDIT CLIMB1 F1: a crouch-only top is climbed CROUCHED - the move and its settle at the height the sensor proved, never up onto the ceiling over it, the eye under it', () => {
  for (const slab of [2.0, 2.1, 2.3]) {
    const s = scene();
    s.box(-4, 0, 1, 4, 1.0, 4);                  // the counter
    s.box(-10, slab, -10, 10, slab + 0.3, 10);   // the ceiling over the whole room
    const { log } = drive(s, { input: tap() });
    assert.deepEqual(log.started.map((x) => x.slice(1)), [['mantle', 'crouch']], `slab ${slab}: one crouched mantle`);
    assert.ok(Math.abs(log.end.pos[1] - 1.0) < 0.03, `slab ${slab}: on the counter (y=${log.end.pos[1].toFixed(3)}), not on the ceiling`);
    assert.equal(log.end.crouching, true);
    assert.ok(log.worstDuring < 0.02, `slab ${slab}: the body stayed out of the slab (${log.worstDuring.toFixed(3)} deep)`);
    assert.ok(log.worstEyeY < slab, `slab ${slab}: the eye stayed under it (${log.worstEyeY.toFixed(3)})`);
  }
  // the crouch key pressed while the crouched move is in flight: the move owns the stance
  {
    const s = scene();
    s.box(-4, 0, 1, 4, 1.0, 4);
    s.box(-10, 2.0, -10, 10, 2.3, 10);
    const { log } = drive(s, { input: (i) => ({ jump: i === 10, crouch: i === 14 || i === 20 }) });
    assert.ok(Math.abs(log.end.pos[1] - 1.0) < 0.03 && log.end.crouching, `a crouch press mid-move stands nobody up into the ceiling (${log.end.pos.map((v) => v.toFixed(2))})`);
    assert.ok(log.worstDuring < 0.02);
  }
  // a lid over the top alone, with a crouch's room under it - never left inside the block
  for (const room of [0.95, 1.0]) {
    const s = scene();
    s.box(-4, 0, 1, 4, 1.0, 4);
    s.box(-10, 1.0 + room, 1.2, 10, 1.0 + room + 0.36, 10);
    const { m, log } = drive(s, { input: tap(), steps: 60 });
    for (let i = 0; i < 120; i++) m.update(1 / 60, { forward: i > 60 ? 1 : 0, strafe: 0, run: false, jump: false }, 0);
    assert.ok(overlap(s.boxes, m.pos, m.height) < 0.02, `room ${room}: the body ends in the open (${overlap(s.boxes, m.pos, m.height).toFixed(3)})`);
    assert.ok(log.worstDuring < 0.02, `room ${room}: and passed through none of it (${log.worstDuring.toFixed(3)})`);
  }
});

test('AUDIT CLIMB1 F2: the WHOLE path is proven, not its two ends - no mantle through a railing, a slot in a thin wall or a window\'s lintel', () => {
  // a balcony's railing: rails 5 cm thick at +0.40 and +0.95 over the platform's edge, posts a metre apart
  for (const P of [0.8, 1.0, 1.3]) {
    const s = scene();
    s.box(-4, 0, 1, 4, P, 5);
    for (let x = -4; x <= 4; x += 1) if (Math.abs(x) > 0.5) s.box(x, P, 1, x + 0.05, P + 1.0, 1.05);
    s.box(-4, P + 0.4, 1, 4, P + 0.45, 1.05);
    s.box(-4, P + 0.95, 1, 4, P + 1.0, 1.05);
    for (const skill of [50, 100]) {
      const { log } = drive(s, { input: tap(), skill });
      assert.ok(log.worstDuring < 0.02, `platform ${P} skill ${skill}: the body never passed through the railing (${log.worstDuring.toFixed(3)} deep)`);
      assert.ok(log.end.overlap < 0.02, `platform ${P} skill ${skill}: and ends in the open`);
    }
  }
  // a slot 0.15-0.3 tall through a 0.1 m wall, a counter behind it
  for (const [S, O] of [[1.0, 0.25], [1.0, 0.15], [1.1, 0.2], [0.9, 0.3]]) {
    const s = scene();
    s.box(-4, 0, 1, 4, S, 1.1); s.box(-4, S + O, 1, 4, 5, 1.1);
    s.box(-4, S, 1, -0.6, S + O, 1.1); s.box(0.6, S, 1, 4, S + O, 1.1);
    s.box(-4, 0, 1.1, 4, S, 5);
    const { log } = drive(s, { input: tap() });
    assert.ok(log.end.pos[2] < 1.0, `slot ${S}+${O}: nobody goes through it (z=${log.end.pos[2].toFixed(2)})`);
    assert.ok(log.worstDuring < 0.02);
  }
  // a window 0.8 m tall in a 12 cm wall, a loft floor at its sill: neither standing nor crouched fits through
  {
    const s = scene();
    s.box(-3, 0, 1, 3, 1.5, 1.12); s.box(-3, 2.3, 1, 3, 5, 1.12);
    s.box(-3, 1.5, 1, -0.6, 2.3, 1.12); s.box(0.6, 1.5, 1, 3, 2.3, 1.12);
    s.box(-3, 1.3, 1.12, 3, 1.5, 4);
    const { log } = drive(s, { input: tap() });
    assert.ok(log.worstDuring < 0.02, `the window: the body passed through no lintel (${log.worstDuring.toFixed(3)} deep)`);
    assert.ok(log.end.overlap < 0.02);
  }
});

test('AUDIT CLIMB1 F3: a vault never lands inside what stands behind the top - a step with a wall at its back is climbed onto, not vaulted into', () => {
  for (const depth of [0.8, 0.85]) {
    const s = scene();
    s.box(-4, 0, 1, 4, 1.0, 1 + depth);          // the step
    s.box(-4, 0, 1 + depth, 4, 3.0, 5);          // the wall directly behind it
    const { log } = drive(s, { input: runJump() });
    assert.ok(!log.started.some((x) => x[1] === 'vault'), `depth ${depth}: no vault into the wall (${JSON.stringify(log.started)})`);
    assert.ok(log.worstDuring < 0.02 && log.end.overlap < 0.02, `depth ${depth}: never inside it (end ${log.end.pos.map((v) => v.toFixed(2))})`);
  }
});

test('AUDIT CLIMB1 F4: a placement cancels a move in flight - pinFeet (Come Sail Away\'s boarding) and the helm\'s freeze', () => {
  const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
  const start = () => { const { m } = drive(s, { input: tap(), steps: 16 }); assert.equal(m.mantling, true); return m; };
  const m = start();
  m.pinFeet(45, 0.52, 45);
  m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0);
  assert.ok(Math.hypot(m.pos[0] - 45, m.pos[2] - 45) < 0.5, `pinned where the boat is, not dragged back (${[...m.pos].map((v) => v.toFixed(2))})`);
  assert.equal(m.mantling, false);
  const f = start();
  f.freezeMotor = 0.5;
  for (let i = 0; i < 60; i++) f.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0);
  assert.equal(f.mantling, false, 'a freeze follows a placement: the move it interrupted is over');
});

test('AUDIT CLIMB1 F5: a move rides what carries the body - a boat deck\'s carry, and a mantle onto a moving boat lands on its deck', () => {
  const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
  const { m } = drive(s, { input: tap(), steps: 16 });
  m.carryBy(1, 0, 0);
  while (m.mantling) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0);
  assert.ok(Math.abs(m.pos[0] - 1) < 0.05, `the carry kept (x=${m.pos[0].toFixed(3)})`);
  // the carry is the bucket's whole rigid motion: a quarter turn about the bucket's origin carries a point with it
  {
    const mv = { from: [1, 0, 0], up: [1, 1, 0], to: [2, 1, 0] };
    const R90 = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // intoBucket's convention (local = r (p - t)): world +z is local +x
    carryMove(mv, { t: [0, 0, 0], r: null }, { t: [0, 0, 0], r: R90 });
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
    assert.ok(near(mv.from, [0, 0, -1]) && near(mv.to, [0, 1, -2]), `turned with the deck (${mv.from} / ${mv.to})`);
    carryMove(mv, { t: [0, 0, 0], r: R90 }, { t: [5, 0, 0], r: R90 });
    assert.ok(near(mv.from, [5, 0, -1]), 'and moved with it');
  }
  // a narrow hull (a 1.5 m box, 1.2 wide and 0.8 deep, on a moving bucket), moving across and away: in the time a
  // mantle takes it moves out from under a landing that stayed where the deck was
  for (const [vx, vz] of [[3, 0], [0, 2.0], [-3, 0]]) {
    const col = new Collider(() => -100);
    col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
    const t = [0, 0, 1];
    col.addMesh('boat', new Float32Array([-0.6, 0, 0, 0.6, 0, 0, 0.6, 1.5, 0, -0.6, 1.5, 0, -0.6, 0, 0.8, 0.6, 0, 0.8, 0.6, 1.5, 0.8, -0.6, 1.5, 0.8]), BOX_IDX, I, () => t, null);
    const b = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 50 }) } });
    b.spawn(0, 0.02, 0.4);
    let started = false, ended = null;
    for (let i = 0; i < 120; i++) {
      if (i >= 10 && (!started || b.mantling)) { t[0] += vx / 60; t[2] += vz / 60; col._broad = null; }
      b.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: i === 10 }, 0);
      if (b.parkoured) started = true;
      if (started && !b.mantling && !ended) ended = i;
    }
    assert.ok(started && ended, `boat (${vx},${vz}): a mantle`);
    // half a second after the move - a landing the deck had moved out from under has dropped by then
    assert.ok(Math.abs(b.pos[1] - 1.5) < 0.05 && b.grounded, `boat (${vx},${vz}): standing on the moving deck (y=${b.pos[1].toFixed(2)}), not in the water beside it`);
  }
});

test('AUDIT CLIMB1 F6: whether a hard catch holds is the Climbing skill\'s (Mac\'s "Skill scales it") - past the skill\'s hold a caught lip is not held and the fall is billed', () => {
  assert.equal(PARKOUR_CATCH_HOLD_MIN, FALL_DAMAGE_THRESHOLD, 'at Climbing 0 a catch holds only a fall that could not hurt anyway');
  assert.equal(parkourCatchHold(0), PARKOUR_CATCH_HOLD_MIN);
  assert.equal(parkourCatchHold(100), PARKOUR_CATCH_HOLD_MAX);
  assert.ok(parkourCatchHold(50) > parkourCatchHold(0) && parkourCatchHold(50) < parkourCatchHold(100));
  const fall = (drop, skill) => {
    const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
    const { log } = drive(s, { y: drop, z: 0.45, skill, steps: 400, input: () => ({ jump: true }) });
    return log;
  };
  const far = fall(30, 0);
  assert.ok(!far.started.length || far.fell > 25, `a 30 m fall at Climbing 0 is not caught - billed ${far.fell.toFixed(1)} m`);
  assert.ok(far.fell > 25, 'the fall is billed');
  const mid = fall(12, 100);
  assert.ok(mid.started.length === 1 && mid.fell < 1, `a 12 m fall at Climbing 100 is held (billed ${mid.fell.toFixed(2)})`);
  const short = fall(4, 0);
  assert.ok(short.started.length === 1, 'a 4 m fall is held at any skill');
});

test('AUDIT CLIMB1 F7: Jump held through a mantle does not hop on arrival - the next jump is a fresh press', () => {
  const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
  let endAt = null, maxAfter = 0;
  const { m, log } = drive(s, {
    steps: 140,
    input: (i, mm) => ({ jump: i >= 10 && i < 110 }),
  });
  endAt = log.endMove.i;
  for (let i = endAt + 1; i < 110; i++) maxAfter = Math.max(maxAfter, log.frames[i][1]);
  assert.equal(log.started.length, 1, 'one mantle, no chain onto nothing');
  assert.ok(maxAfter < 1.55, `no hop on the top while Jump stays held (max y ${maxAfter.toFixed(2)})`);
  // released, then pressed again: a jump
  let apex = 0;
  for (let i = 0; i < 40; i++) { m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: i === 5 }, 0); apex = Math.max(apex, m.pos[1]); }
  assert.ok(apex > 1.8, `a fresh press jumps (apex ${apex.toFixed(2)})`);
});

test('AUDIT CLIMB1 F6b: a refused lip rests the air catch for a few steps - the refusal proves every try, and held Jump would ask it every step', () => {
  // a platform over a pit behind a tall railing (rails every half metre, the top one out of reach): its lip is in
  // reach, and every way onto it is refused by the path - the dearest refusal the sensor makes. Held Jump falling
  // past it counts the collider's fit asks; resting PARKOUR_QUIET_STEPS after each refusal cuts them hard. (CLIMB2:
  // the pit is too shallow for a body to hang in under the lip - the hang is refused too, and with it every way.)
  const asks = (quiet) => {
    const s = scene(-0.6);
    s.box(-4, -10, 1, 4, 1.0, 5);
    for (let k = 1; k <= 4; k++) s.box(-4, 1.0 + 0.5 * k - 0.1, 1, 4, 1.0 + 0.5 * k - 0.05, 1.05);
    const m = new PlayerMotor(s.col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 0 }) } });
    m.spawn(0, 0.8, 0.45);   // falling past it, Jump held
    const real = s.col.penetrationAt.bind(s.col);
    let n = 0;
    s.col.penetrationAt = (...a) => { n++; return real(...a); };
    for (let i = 0; i < 24; i++) { if (!quiet) m._pkQuiet = 0; m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: true }, 0); }
    assert.equal(m.mantling, false, 'nothing was climbed');
    return n;
  };
  const rested = asks(true), every = asks(false);
  assert.ok(every > 0, 'the lip is asked about');
  assert.ok(rested * 2 < every, `resting after a refusal asks far less (${rested} vs ${every} fits over 24 steps)`);
  assert.equal(PARKOUR_QUIET_STEPS, 3);
});

test('AUDIT CLIMB1 F8: the dungeon bills a move\'s edge once - the bag its tick reads is cleared of the frame\'s edges after the tick', () => {
  const ctx = read('src/scenes/dungeonContext.js');
  assert.match(ctx, /classicMinutesRef\.value = _tick\.classicMinutes;\n\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*_activity\.jumped = false;\n\s*_activity\.parkoured = null;/,
    'the jump\'s and the move\'s edges are spent by the tick that billed them');
});

test('AUDIT CLIMB1 F9: a move in flight reads as a climb to what watches the body - no walk input, the torch and the shield put away, the probe sees it', () => {
  const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
  const { m } = drive(s, { input: (i) => ({ forward: 1, jump: i === 10 }), steps: 16 });
  assert.equal(m.mantling, true);
  assert.equal(m.moveForward, 0, 'no walk input in flight');
  assert.equal(m.moveStrafe, 0);
  assert.equal(m.moveSpeed, 0);
  assert.equal(motionBagOf(m).climbing, true, 'the motion bag says climbing (the dungeon host\'s torch reads it)');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(read(f), /camera: \(\) => \(\{ pos: player\.eyeAt\(\),[^\n]*climbing: !!\(player\.climb\?\.isClimbing \|\| player\.mantling( \|\| player\.onWall)?\)/, `${f}: the torch and the shield read the move as a climb`);   // CLIMB4: and the hold (climb4.test.js F16)
  }
  assert.match(read('src/scenes/world.js'), /window\.__climb = \(\) => JSON\.stringify\(\{[^}]*mantling: !!player\.mantling/, 'the __climb probe sees a mantle');
});

test('AUDIT CLIMB1 F10: Roleplay & Realism\'s "no climbing with a weapon out" holds for the enhanced climb - a mantle and a clamber refused, said once a press; a vault is a leap and goes', () => {
  assert.equal(rrParkourRefusal({ weaponDrawn: true, weaponMelee: false }), NO_CLIMB_HOLDING_WEAPON);
  assert.equal(rrParkourRefusal({ weaponDrawn: true, weaponMelee: true }), null, 'bare hands climb');
  assert.equal(rrParkourRefusal({ weaponDrawn: false, weaponMelee: false }), null, 'a sheathed weapon climbs');
  assert.match(read('src/systems/roleplayRealism/rrInstall.js'), /registerParkourGate\(\(\) => \{\n\s*if \(!rrModule\('climbingRestriction'\)\) return null;/, 'the mod registers the gate under its own switch');
  const said = [];
  registerParkourGate(() => NO_CLIMB_HOLDING_WEAPON);
  try {
    const s = scene(); s.box(-4, 0, 1, 4, 1.5, 4);
    const { log } = drive(s, { input: (i) => ({ jump: i >= 10 && i < 20 }), say: (l) => said.push(l) });
    assert.deepEqual(log.started, [], 'no mantle with a weapon out');
    assert.deepEqual(said, [NO_CLIMB_HOLDING_WEAPON], 'the mod\'s line, once for the press');
    const f = scene(); f.box(-4, 0, 1, 4, 1.0, 1.2);
    const v = drive(f, { input: runJump() });
    assert.deepEqual(v.log.started.map((x) => x[1]), ['vault'], 'a vault is not a climb');
  } finally { registerParkourGate(null); }
});

test('AUDIT CLIMB1 F11: online the row is forced on whatever the shelf holds - the switch asks the lane with the page it is handed', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedClimbing;
  try {
    setUiSkin('classic'); setPref('enhancedClimbing', false);
    assert.equal(parkourSwitchOn(''), false, 'offline: the row off and the classic skin');
    assert.equal(parkourSwitchOn('?online=1'), true, 'online: forced on, the stored Off and the classic skin both not asked');
  } finally { setUiSkin(skin); setPref('enhancedClimbing', pref); }
});

// ---- the geometry lens: real ledges the first sensor missed ----

test('AUDIT CLIMB1 G1: a pitched roof up to 50 degrees is climbed onto from its eave; steeper is not (AUDIT CLIMB-FIELD R1: Daggerfall\'s "45-degree" roofs run to 48.7)', () => {
  const roof = (E, deg) => {
    const s = scene(); const t = Math.tan((deg * Math.PI) / 180), D = 3, R = E + D * t;
    s.col.addMesh('roof', new Float32Array([
      -4, 0, 1, 4, 0, 1, 4, E, 1, -4, 0, 1, 4, E, 1, -4, E, 1,
      -4, E, 1, 4, E, 1, 4, R, 1 + D, -4, E, 1, 4, R, 1 + D, -4, R, 1 + D,
      -4, 0, 1 + D, 4, 0, 1 + D, 4, R, 1 + D, -4, 0, 1 + D, 4, R, 1 + D, -4, R, 1 + D,
    ]), [...Array(18).keys()], I);
    return s;
  };
  for (const deg of [15, 33, 38, 40, 44, 45.2, 46.2, 48.7]) {
    const l = senseLedge(roof(1.2, deg).col, [0, 0, 0.45], LOOK, GEO(2.1));
    assert.ok(l.ok && l.mantle, `${deg} degrees: a way onto it (${l.why})`);
    assert.ok(Math.abs(l.lipY - 1.2) < 0.05, `${deg} degrees: the lip is the eave (${l.lipY?.toFixed(3)})`);
  }
  // past 50, to about 51.3, the face scan still ends at the eave and the lip is refused for its pitch
  for (const deg of [50.5, 51]) {
    const l = senseLedge(roof(1.2, deg).col, [0, 0, 0.45], LOOK, GEO(2.1));
    assert.ok(l.mantle == null && l.why === 'steep-top', `${deg} degrees: refused at its lip, for its pitch (${l.why})`);
  }
  const steep = senseLedge(roof(1.2, 55).col, [0, 0, 0.45], LOOK, GEO(2.1));
  assert.equal(steep.mantle ?? null, null, '55 degrees: a roof you slide off');
  assert.ok(['steep-top', 'too-high'].includes(steep.why), `refused for its pitch - at its lip, or past 51 degrees read as the face going on up (${steep.why})`);
});

test('AUDIT CLIMB1 G2: an inner corner, and a ledge beside a taller wall - the body slides along the face to where it fits', () => {
  const L = scene(); L.box(-4, 0, 1, 4, 1.5, 4); L.box(1, 0, -4, 4, 1.5, 1);
  for (const [x, z, d] of [[0.45, 0.45, 45], [0.6, 0.6, 30]]) {
    const l = senseLedge(L.col, [x, 0, z], at(d), GEO(1.8));
    assert.ok(l.ok && l.mantle, `the inner corner from (${x},${z}) at ${d}: ${l.why}`);
  }
  const T = scene(); T.box(-4, 0, 1, 1, 1.5, 4); T.box(1, 0, -4, 4, 4.0, 4);
  const l = senseLedge(T.col, [0.6, 0, 0.6], at(30), GEO(1.8));
  assert.ok(l.ok && l.mantle, `beside a taller wall: ${l.why}`);
  const { log } = drive(T, { x: 0.6, z: 0.6, yaw: (30 * Math.PI) / 180, input: tap() });
  assert.equal(log.started.length, 1);
  assert.ok(Math.abs(log.end.pos[1] - 1.5) < 0.03 && log.end.overlap < 0.02 && log.worstDuring < 0.02, 'on it, in the open, the whole way');
});

test('AUDIT CLIMB1 G3: the landing reads the top - a shallow wall top is stood on in its middle, a thin fence is vaulted, a parapet is climbed over onto the roof behind', () => {
  for (const [H, D] of [[1.2, 0.3], [1.2, 0.4], [1.5, 0.45]]) {
    const s = scene(); s.box(-3, 0, 1, 3, H, 1 + D);
    const { log } = drive(s, { input: tap() });
    assert.deepEqual(log.started.map((x) => x[1]), ['mantle'], `a ${H} m wall ${D} m deep`);
    assert.ok(Math.abs(log.endMove.pos[1] - H) < 0.03, `stood on its top (y=${log.endMove.pos[1].toFixed(3)})`);
  }
  for (const T of [0.1, 0.15]) {
    const s = scene(); s.box(-3, 0, 1, 3, 1.15, 1 + T);
    const { log } = drive(s, { input: runJump(), steps: 150 });
    assert.deepEqual(log.started.map((x) => x[1]), ['vault'], `a 1.15 m fence ${T} thick`);
    assert.ok(log.end.pos[2] > 1 + T + CAPSULE_RADIUS, `over it (z=${log.end.pos[2].toFixed(2)})`);
  }
  for (const [R, h, t] of [[1.4, 0.3, 0.2], [1.2, 0.3, 0.1]]) {
    const s = scene(); s.box(-4, 0, 1, 4, R, 5); s.box(-4, R, 1, 4, R + h, 1 + t);
    const { log } = drive(s, { input: tap(), skill: 100 });
    assert.equal(log.started.length, 1, `a roof at ${R} behind a ${h}x${t} parapet`);
    assert.ok(Math.abs(log.end.pos[1] - R) < 0.03 && log.end.pos[2] > 1 + t, `on the roof behind it (${log.end.pos.map((v) => v.toFixed(2))})`);
    assert.ok(log.worstDuring < 0.02 && log.end.overlap < 0.02);
  }
});

test('AUDIT CLIMB1 G4: a thin table top is climbed onto at any height in reach - the sensor does not need a rung to land on its edge', () => {
  for (const H of [0.8, 0.85, 0.9, 1.0, 1.05, 1.2]) {
    for (const th of [0.04, 0.06, 0.12]) {
      const s = scene();
      s.box(-1, H - th, 1, 1, H, 2);                                   // the top
      for (const [lx, lz] of [[-1, 1], [0.94, 1], [-1, 1.94], [0.94, 1.94]]) s.box(lx, 0, lz, lx + 0.06, H - th, lz + 0.06);   // the legs
      const { log } = drive(s, { input: tap() });
      assert.deepEqual(log.started.map((x) => x[1]), ['mantle'], `a ${th} m top at ${H}`);
      assert.ok(Math.abs(log.end.pos[1] - H) < 0.03, `on it (y=${log.end.pos[1].toFixed(3)})`);
    }
  }
});

test('AUDIT CLIMB1 G5: Jump on a staircase is a jump - a riser two treads up is not a ledge', () => {
  for (const [R, T] of [[0.25, 0.4], [0.25, 0.3], [0.3, 0.3]]) {
    const s = scene();
    for (let i = 0; i < 10; i++) s.box(-2, 0, 1 + i * T, 2, R * (i + 1), 1 + (i + 1) * T + (i === 9 ? 3 : 0));
    const moves = [];
    for (let J = 5; J < 70; J += 4) {
      const { log } = drive(s, { z: 0.2, steps: J + 5, input: (i) => ({ forward: 1, jump: i === J }) });
      if (log.started.length) moves.push(J);
    }
    assert.deepEqual(moves, [], `stairs ${R}/${T}: presses that became a parkour move`);
  }
});

test('AUDIT CLIMB1 G6: a vault is not a leap into a fall that hurts - over a railing above a 10 m drop the press is a jump, over a 1 m drop a vault', () => {
  // a 1.15 m railing: a 1.0 m one is cleared by a plain running jump and the step ladder, the classic way
  const edge = (below) => {
    const col = new Collider(() => -100);
    col.addMesh('deck', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 1.2, -10, 0, 1.2]), [0, 1, 2, 0, 2, 3], I);
    col.addMesh('below', new Float32Array([-10, -below, -10, 10, -below, -10, 10, -below, 20, -10, -below, 20]), [0, 1, 2, 0, 2, 3], I);
    col.addMesh('rail', new Float32Array([-4, 0, 1, 4, 0, 1, 4, 1.15, 1, -4, 1.15, 1, -4, 0, 1.2, 4, 0, 1.2, 4, 1.15, 1.2, -4, 1.15, 1.2]), BOX_IDX, I);
    return { col, boxes: [[-4, 0, 1, 4, 1.15, 1.2]] };
  };
  const deep = drive(edge(10), { input: runJump(), steps: 200 });
  assert.ok(!deep.log.started.some((x) => x[1] === 'vault'), `no vault into a 10 m drop (${JSON.stringify(deep.log.started)})`);
  assert.ok(deep.log.end.pos[1] > -1, 'still on the deck');
  const shallow = drive(edge(1), { input: runJump(), steps: 200 });
  assert.deepEqual(shallow.log.started.map((x) => x[1]), ['vault'], 'a 1 m drop is vaulted');
});

test('AUDIT CLIMB1 R7: a vault\'s pace is the Jumping skill\'s, as its tally is - a mantle\'s the Climbing skill\'s', () => {
  const took = (skill, jumping) => {
    const s = scene(); s.box(-3, 0, 1, 3, 1.0, 1.2);
    const { log } = drive(s, { skill, jumping, input: runJump() });
    return log.endMove.i - log.started[0][0];
  };
  assert.ok(took(50, 100) < took(50, 0), 'Jumping 100 vaults quicker than Jumping 0');
  assert.equal(took(0, 50), took(100, 50), 'and Climbing does not move it');
  assert.ok(vaultDuration(1, 100) < vaultDuration(1, 0) && mantleDuration(1, 100) < mantleDuration(1, 0));
});

test('AUDIT CLIMB1: every move of the fixtures above is proven clear at the step size the sensor sweeps at', () => {
  // the invariant under F1-F3 and G1-G6, stated once over a mixed field: whatever starts, the body is never inside
  // a box by more than the collider's own skin, during the move or at its end
  const s = scene();
  s.box(-6, 0, 1, -4, 1.2, 4); s.box(-4, 0, 1, -2, 1.6, 1.3); s.box(-2, 0, 1, 0, 0.9, 1.15);
  s.box(0, 0, 1, 2, 1.5, 3); s.box(0, 2.1, 1.4, 2, 2.5, 3); s.box(2, 0, 1, 4, 1.0, 1.8); s.box(2, 0, 1.8, 4, 3, 4);
  let moves = 0;
  for (let x = -5.5; x <= 3.5; x += 0.5) {
    for (const d of [-40, 0, 40]) {
      for (const input of [tap(), runJump(), (i) => ({ jump: i >= 10 && i < 40 })]) {
        const { log } = drive(s, { x, z: 0.4, yaw: (d * Math.PI) / 180, steps: 70, input });
        moves += log.started.length;
        assert.ok(log.worstDuring < 0.02, `x=${x} yaw=${d}: ${log.worstDuring.toFixed(3)} deep during ${JSON.stringify(log.started)}`);
      }
    }
  }
  assert.ok(moves > 40, `the field is not vacuous (${moves} moves)`);
});
