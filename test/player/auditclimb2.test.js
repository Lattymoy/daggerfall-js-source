// AUDIT CLIMB2 (2026-10-01, Mac: "Hey audit this and ensure its perfection before we merge"): the enhanced climb's
// second slice - the hang, the shimmy, the grip and the free climb - audited in four lenses: fidelity to the ask and the
// calls, an adversarial read of the code, the climb against hostile geometry, and the hosts and the records
// (bible/03-World/Parkour-Arc.md, AUDIT CLIMB2). Every finding below was pinned here RED on the CLIMB2 code before its
// fix. The geometry is boxes; the body's overlap with them is measured EXACTLY (a capsule against an axis-aligned box),
// never through the collider's own resolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, CAPSULE_RADIUS, CAPSULE_HEIGHT, SYSTEM_TIMER_UPDATES_DIVISOR, HOLD_CARRY_MAX } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { senseGrip, capsuleFits, registerParkourGate, PARKOUR_GRIP_LOW_TEXT, PARKOUR_BODY_RADIUS } from '../../src/player/parkour.js';
import { CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY } from '../../src/player/climbing.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

/** A floor at `floorY` and solid boxes, kept for the exact overlap measure. */
function scene(floorY = 0) {
  const col = new Collider(() => -100);
  const boxes = [];
  col.addMesh('floor', new Float32Array([-20, floorY, -20, 20, floorY, -20, 20, floorY, 20, -20, floorY, 20]), [0, 1, 2, 0, 2, 3], I);
  let n = 0;
  const box = (x0, y0, z0, x1, y1, z1, key = `b${n++}`) => {
    col.addMesh(key, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX_IDX, I);
    boxes.push([x0, y0, z0, x1, y1, z1]);
  };
  return { col, box, boxes };
}

/** How deep a capsule at these feet, this tall, sits in any of the boxes - the axis sampled every centimetre, each
 *  sample's distance to the box against the radius. */
function overlap(boxes, feet, height = CAPSULE_HEIGHT, r = CAPSULE_RADIUS) {
  let worst = 0;
  for (let y = feet[1] + r; y <= feet[1] + height - r + 1e-9; y += 0.01) {
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const dx = Math.max(x0 - feet[0], 0, feet[0] - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - feet[2], 0, feet[2] - z1);
      worst = Math.max(worst, r - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}

function motor(col, { skill = 50, x = 0, y = 0.02, z = 0.4, yaw = 0, said = [], tallies = [] } = {}) {
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: skill, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 },
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill }), say: (l) => said.push(l), tally: () => tallies.push(1) },
  });
  m.spawn(x, y, z);
  m._yaw = yaw;
  return m;
}
const step = (m, input = {}, yaw = 0) => m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, crouch: false, ...input }, yaw);
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

test('AUDIT CLIMB2 A1: a free climb begun at the floor and let go of is no hold - the body stands, as the classic climb\'s own "ground too near" abort has it', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 6, 4);
  const m = motor(s.col, { skill: 0, z: 0.6 });
  let started = -1;
  for (let i = 0; i < 120 && started < 0; i++) { step(m, { forward: 1 }); if (m.onWall) started = i; }
  assert.ok(started > 0, 'Forward held against the wall began a free climb');
  for (let i = 0; i < 30; i++) step(m, {});   // Forward let go, the feet still on the floor
  assert.equal(m.onWall, false, 'standing on the floor is no hold on the wall');
  assert.equal(m.grounded, true);
  // and a climber who comes down to within the classic's 0.12 of the floor and stops is standing too
  const d = motor(s.col, { skill: 50, z: 0.6 });
  for (let i = 0; i < 200 && !(d.onWall && d.pos[1] > 0.6); i++) step(d, { forward: 1 });
  assert.ok(d.onWall && d.pos[1] > 0.6, 'up the wall');
  for (let i = 0; i < 200 && d.pos[1] > 0.1; i++) step(d, { forward: -1 });
  for (let i = 0; i < 10; i++) step(d, {});
  assert.equal(d.onWall, false, 'down at the floor and still: standing');
  // a climber held still well up the wall stays on it
  const h = motor(s.col, { skill: 50, z: 0.6 });
  for (let i = 0; i < 200 && !(h.onWall && h.pos[1] > 1); i++) step(h, { forward: 1 });
  for (let i = 0; i < 30; i++) step(h, {});
  assert.equal(h.onWall, true, 'held a metre up the wall');
});

test('AUDIT CLIMB2 A3: Left and Right kept while the key is held are kept round a corner, never into the next hold - a new wall asks the look afresh', () => {
  const s = scene();
  s.box(-6, 0, 1, 6, 2.3, 4);        // A, faced looking +z
  s.box(-6, 0, -9, 6, 2.3, -6.6);    // B, faced looking -z from z = -6.2
  const m = motor(s.col, { skill: 100 });
  for (let i = 0; i < 40; i++) step(m, { jump: i >= 10 }, 0);
  assert.equal(m.hanging, true, 'hanging on A');
  for (let i = 0; i < 20; i++) step(m, { strafe: 1 }, Math.PI);   // looking away from A, Right: the look's right is -x
  assert.ok(m.pos[0] < -0.2, `the look's right (${m.pos[0].toFixed(2)})`);
  step(m, { strafe: 1, crouch: true }, Math.PI);                   // let go, Right still held
  for (let i = 0; i < 40; i++) step(m, { strafe: 1 }, Math.PI);
  assert.equal(m.onWall, false);
  m.spawn(0, 0.02, -6.2);                                          // before B, facing it (-z), Right still held
  for (let i = 0; i < 40; i++) step(m, { strafe: 1, jump: i >= 10 }, Math.PI);
  assert.equal(m.hanging, true, 'hanging on B');
  const x0 = m.pos[0];
  for (let i = 0; i < 30; i++) step(m, { strafe: 1, jump: true }, Math.PI);
  assert.ok(m.pos[0] < x0 - 0.2, `Right on B is the look's right (-x), not A's held one (moved ${(m.pos[0] - x0).toFixed(2)})`);
  assert.ok(overlap(s.boxes, m.pos) < 0.03);
});

test('AUDIT CLIMB2 H1: a save on the wall keeps the hold - the load takes it again where the body hung, with the grip it had; a save in a move lands where the move ends', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 14, 4);
  const m = motor(s.col, { skill: 100, z: 0.6 });
  for (let i = 0; i < 900 && !(m.onWall && m.pos[1] > 10); i++) step(m, { forward: 1 });
  assert.ok(m.onWall && m.pos[1] > 10, 'ten metres up the wall');
  for (let i = 0; i < 60; i++) step(m, {});
  const grip = m.grip, at = [...m.pos];
  const snap = m.fallSnapshot();
  // the load: a placement, then the carried record
  const l = motor(s.col, { skill: 100, z: 0.6 });
  l.spawn(at[0], at[1], at[2]);
  l.restoreFall(snap);
  let fell = 0;
  for (let i = 0; i < 60; i++) { step(l, {}); fell = Math.max(fell, l.landedFallDistance); }
  assert.equal(l.onWall, true, 'the hold taken again');
  assert.ok(Math.abs(l.pos[1] - at[1]) < 0.05 && fell === 0, `held where it was (${l.pos[1].toFixed(2)} of ${at[1].toFixed(2)}), no fall`);
  assert.ok(Math.abs(l.grip - (grip - 60 / 60 * 0.5 / 30)) < 0.01, `the grip carried (${l.grip.toFixed(3)} from ${grip.toFixed(3)}) - a load is no rest`);
  // a hang the same
  const h = scene(); h.box(-3, 0, 1, 3, 2.3, 4);
  const hm = motor(h.col, { skill: 100 });
  for (let i = 0; i < 40; i++) step(hm, { jump: i >= 10 });
  assert.equal(hm.hanging, true);
  const hs = hm.fallSnapshot(), hp = [...hm.pos];
  const hl = motor(h.col, { skill: 100 }); hl.spawn(hp[0], hp[1], hp[2]); hl.restoreFall(hs);
  step(hl, {});
  assert.equal(hl.hanging, true, 'hanging again');
  // a save in a catch's move: the load is where the move ends, held
  const cm = motor(h.col, { skill: 100 });
  let moving = null;
  for (let i = 0; i < 40 && !moving; i++) { step(cm, { jump: i >= 10 }); if (cm._pkMove?.kind === 'catch' && cm._pkMove.t > 0.2) moving = cm.fallSnapshot(); }
  assert.ok(moving, 'saved in the catch');
  const cp = [...cm.pos], cl = motor(h.col, { skill: 100 }); cl.spawn(cp[0], cp[1], cp[2]); cl.restoreFall(moving);
  step(cl, {});
  assert.equal(cl.hanging, true, 'the catch\'s hang');
  // a plain fall is carried as ever
  const f = motor(h.col, { skill: 100, y: 5, z: -2 });
  for (let i = 0; i < 10; i++) step(f, {});
  assert.ok(Number.isFinite(f.fallSnapshot()?.above), 'a fall is the fall\'s own record');
  // the carry is bounded, as a fall's is: a forged or corrupt record moves the body a few metres at most
  const b = motor(h.col, { skill: 100, z: -3 });
  b.restoreFall({ to: [1e6, 0, 0], hold: null, grip: 1 });
  assert.ok(near(b.pos[0], HOLD_CARRY_MAX), `carried ${b.pos[0]} m`);
});

test('AUDIT CLIMB2 H2: a spent grip comes back treading water - the free climb is the only way out of the water on this lane', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 3, 4);
  const m = motor(s.col, { skill: 50, z: 0.6, y: 1 });
  m.swimming = true;
  m.grip = 0;
  let out = false;
  for (let i = 0; i < 600 && !out; i++) { m.swimming = m.pos[1] < 1.2 && !m.onWall; step(m, { forward: 1 }); out = m.onWall; }
  assert.equal(out, true, 'the grip came back in the water and the wall was taken');
});

test('AUDIT CLIMB2 H4: a corner and a catch spend the grip as the hang does - a corner at Climbing 0 is two seconds of it', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.0, 4);
  const m = motor(s.col, { skill: 0, x: 2.4 });
  for (let i = 0; i < 40; i++) step(m, { jump: i >= 10 });
  assert.equal(m.hanging, true);
  let before = null, after = null;
  for (let i = 0; i < 400 && after == null; i++) {
    step(m, { strafe: 1 });
    if (m._pkMove?.kind === 'corner' && before == null) before = m.grip;
    if (before != null && !m._pkMove && m.hanging) after = m.grip;
  }
  assert.ok(before != null && after != null, 'round the corner');
  assert.ok(before - after > 0.25, `the corner spent the grip (${(before - after).toFixed(3)} of it)`);
});

test('AUDIT CLIMB2 H5: a free climb tops out over a lip in reach - a wall lower than the hang (a plinth before a taller wall) is climbed onto, not stuck under', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 1.0, 2.0); s.box(-3, 0, 2.0, 3, 6, 4);   // a metre deep: room to stand
  const m = motor(s.col, { skill: 50, z: 0.6 });
  const log = [];
  let landed = false;   // Forward let go once the climb has landed on the top (held on, it would start up the taller wall)
  for (let i = 0; i < 200; i++) {
    step(m, { forward: landed ? 0 : 1 });
    log.push({ wall: m.onWall, move: m._pkMove?.kind ?? null, y: m.pos[1], g: m.grounded });
    landed ||= log.some((e) => e.move === 'mantle') && !m.mantling;
  }
  const first = log.findIndex((e) => e.wall);
  assert.ok(first > 0, 'the plinth\'s face climbed');
  assert.ok(log.some((e, i) => i > first && e.move === 'mantle'), 'its lip climbed onto');
  const end = log[log.length - 1];
  assert.ok(end.g && !end.wall && Math.abs(end.y - 1.0) < 0.05, `standing on the plinth (y ${end.y.toFixed(2)}, ${end.wall ? 'still on the wall' : 'off it'})`);
  // a tall wall still tops out at its lip, and one stopped short of it holds
  const t = scene(); t.box(-3, 0, 1, 3, 4.0, 4);
  const u = motor(t.col, { skill: 50, z: 0.6 });
  let top = false;
  for (let i = 0; i < 300 && !top; i++) { step(u, { forward: 1 }); top = !u.onWall && !u.mantling && u.grounded && u.pos[1] > 3.9; }
  assert.ok(top, 'over the 4 m wall\'s top');
});

test('AUDIT CLIMB2 H6: the run is not latched on the wall - a running catch neither trains Running while it hangs nor shows the peers a run', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4);
  const m = motor(s.col, { skill: 100, z: -2 });
  // run at it, jump, and let go of Forward as the jump leaves the ground: the lip is caught and held
  for (let i = 0; i < 120 && !m.hanging; i++) step(m, { forward: m.grounded && i < 60 ? 1 : 0, run: true, jump: i >= 14 }, 0);
  assert.equal(m.hanging, true, 'a running jump, caught');
  for (let i = 0; i < 30; i++) step(m, { run: true });
  assert.equal(m.isRunning, false, 'not running on the wall');
});

/** A wall `H` tall under a roof pitched `deg` rising from its eave (CLIMB1's roof: a plane, and the solid behind). */
function roofed(deg, H = 3) {
  const s = scene(); s.box(-3, 0, 1, 3, H, 4);
  const t = Math.tan((deg * Math.PI) / 180), d = 1.5;
  s.col.addMesh('roof', new Float32Array([-3, H, 1, 3, H, 1, 3, H + d * t, 1 + d, -3, H + d * t, 1 + d]), [0, 2, 1, 0, 3, 2], I);
  s.box(-3, H, 1 + d, 3, H + d * t, 4);
  return s;
}
const BOX = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);

test('AUDIT CLIMB2 C1: a pitched roof\'s eave is a hand-hold up to 50 degrees (AUDIT CLIMB-FIELD R1) - held from anywhere in the window, caught, and shimmied along, as CLIMB1 climbs onto the same roof', () => {
  const geo = { radius: CAPSULE_RADIUS, stand: CAPSULE_HEIGHT };
  for (const deg of [0, 10, 15, 20, 30, 38, 44, 46.2, 48.7]) {
    const { col } = roofed(deg);
    for (let k = -12; k <= 12; k++) {
      const g = senseGrip(col, [0, 0, 1], [0, 0, -1], 3 + k * 0.01, geo);
      assert.ok(g, `${deg} deg: the eave held, sought at ${(3 + k * 0.01).toFixed(2)}`);
      assert.ok(g.lipY >= 3 - 1e-3 && g.lipY <= 3.075, `${deg} deg: the hands at the eave (${g.lipY.toFixed(3)})`);   // the top read up to 6 cm in: 7 at 50 degrees
      assert.ok(near(g.normal[2], -1) && near(g.feet[2], 1 - CAPSULE_RADIUS - 0.04, 0.01), `${deg} deg: hung off the wall under it`);
    }
  }
  assert.equal(senseGrip(roofed(55).col, [0, 0, 1], [0, 0, -1], 3, geo), null, 'a roof over 50 degrees is no top (CLIMB1\'s)');
  // the depth is read up a top that rises, not across a wall that stands up again: a moulding 6 cm deep, its wall set
  // back a further 4 cm a hand above it, is no hold (the grip's 8 cm)
  const mo = scene();
  mo.box(-3, 0, 1, 3, 3, 4); mo.box(-3, 3, 1.06, 3, 3.07, 4); mo.box(-3, 3.07, 1.1, 3, 4, 4);
  for (let k = -5; k <= 5; k++) assert.equal(senseGrip(mo.col, [0, 0, 1], [0, 0, -1], 3.01 + k * 0.01, geo), null, `no hold on the moulding (${k})`);
  // live: a jump at a wall under a 40 degree roof catches the eave, hangs, and shimmies along it
  const s = roofed(40, 2.3);
  const m = motor(s.col, { skill: 100 });
  for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });
  assert.equal(m.hanging, true, 'hanging from the eave');
  for (let i = 0; i < 60; i++) step(m, { strafe: 1 });
  assert.ok(m.hanging && m.pos[0] > 0.5, `shimmied along the eave (x ${m.pos[0].toFixed(2)})`);
});

test('AUDIT CLIMB2 C2: on the wall over deep water the hands hold the body out of it - Crouch lets go, the hold is never sunk, and the way up out of the water is a whole body\'s', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4);
  const m = motor(s.col, { skill: 100 });
  for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });
  assert.equal(m.hanging, true);
  for (let i = 0; i < 30; i++) { m.onExteriorWater = true; step(m, {}); }   // the host's flag: deep water under the hang
  assert.equal(m.sunk, false, 'the hanging body is not sunk');
  assert.equal(m.height, CAPSULE_HEIGHT);
  m.onExteriorWater = true; step(m, { crouch: true });
  m.onExteriorWater = true; step(m, {});
  assert.equal(m.onWall, false, 'Crouch let go');
  // out of deep water up a quay under a roof 1.1 m over its top: the water flag the hosts' down probe raises
  const col = new Collider(() => 0);   // the water's own floor
  const boxes = [[-3, -1, 1, 3, 2.3, 4], [-3, 3.4, 1.3, 3, 3.8, 4]];
  boxes.forEach((b, i) => col.addMesh(`q${i}`, BOX(...b), BOX_IDX, I));
  const w = motor(col, { skill: 100, z: 0.6 });
  let moved = false, topped = false, taken = null;
  for (let i = 0; i < 400; i++) {
    const cy = w.pos[1] + w.height / 2, mesh = col.raycast([w.pos[0], cy, w.pos[2]], [0, -1, 0], 2);
    w.onExteriorWater = cy <= 2 && cy < mesh;
    moved ||= w._pkMove?.kind === 'mantle';
    topped ||= moved && !w._pkMove;
    const was = w.sunk;
    step(w, { forward: topped ? 0 : 1 });
    if (taken == null && w.onWall) taken = { was, sunk: w.sunk, height: w.height };
  }
  // stood whole on the very step the wall is taken - not a frame later, when a crouched move begun in a frame of
  // several steps would be stood up under the roof by the frame's unsink
  assert.deepEqual(taken, { was: true, sunk: false, height: CAPSULE_HEIGHT }, 'the swimmer taken out of the water by the hold itself');
  assert.ok(moved && Math.abs(w.pos[1] - 2.3) < 0.02, `climbed out onto the quay (feet y ${w.pos[1].toFixed(2)})`);
  assert.equal(w.crouching, true, 'crouched under the roof');
  assert.ok(overlap(boxes, w.pos, 0.9) < 1e-3, `clear of the quay and the roof (${overlap(boxes, w.pos, 0.9).toFixed(3)})`);
});

test('AUDIT CLIMB2 C3: climbing down past a window sill holds on the wall above it - a ledge a hand wide under the feet is no floor, one deep enough to stand on is', () => {
  for (const depth of [0.12, 0.7]) {
    const s = scene();
    s.box(-3, 0, 1.12, 3, 12, 4);
    s.box(-1.5, 5.4, 1.12 - depth, 1.5, 5.5, 1.12);   // a sill (or a balcony) at 5.5 m
    const m = motor(s.col, { skill: 100, z: 0.74, y: 9 });
    let on = false, off = false, fell = 0;
    for (let i = 0; i < 400; i++) {
      if (!on && m.onWall) on = true;
      off ||= on && !m.onWall;   // Back let go once off the wall
      step(m, off ? {} : on ? { forward: -1 } : { forward: 1, jump: i >= 5 });
      fell = Math.max(fell, m.landedFallDistance);
    }
    assert.ok(on, 'the wall grabbed falling');
    if (depth < 0.5) {
      assert.ok(m.onWall && m.pos[1] > 5.3, `held on the wall over the sill (y ${m.pos[1].toFixed(2)}, ${m.onWall ? 'on it' : 'off it'})`);
      for (let i = 0; i < 60; i++) step(m, {});
      assert.ok(m.onWall, 'and held there with Back let go');
    } else {
      assert.ok(!m.onWall && Math.abs(m.pos[1] - 5.5) < 0.05 && m.pos[2] < 1.12 - depth + 0.1 + CAPSULE_RADIUS, `standing on the balcony (y ${m.pos[1].toFixed(2)})`);
    }
    assert.ok(fell < 1, `no fall (${fell.toFixed(2)})`);
  }
});

test('AUDIT CLIMB2 C4: a recentre under a hold on what stands again at its new place (a wagon, a gate) keeps the body there - only a mover\'s pose is carried', () => {
  const OFF = -819.2;
  for (const what of ['hang', 'mantle']) {
    const col = new Collider(() => 0);
    const stand = (dx) => { col.removeBucket('wagon'); col.addMesh('wagon', BOX(-3 + dx, 0, 1, 3 + dx, 2.3, 4), BOX_IDX, I); };
    stand(0);
    const m = motor(col, { skill: 100 });
    let done = false;
    for (let i = 0; i < 200; i++) {
      const jump = i >= 10 && i < 40;
      if (!done && (what === 'hang' ? m.hanging && i > 50 : m._pkMove?.kind === 'mantle' && m._pkMove.t > 0.3)) { stand(OFF); m.offsetOrigin([OFF, 0, 0]); done = true; }
      step(m, what === 'hang' ? { jump } : { jump, forward: jump ? 1 : 0 });
    }
    assert.ok(done, `${what}: recentred`);
    assert.ok(Math.abs(m.pos[0] - OFF) < 0.01, `${what}: the body stays where the recentre put it (x ${m.pos[0].toFixed(2)})`);
    if (what === 'hang') assert.equal(m.hanging, true, 'still hanging');
    else assert.ok(m.grounded && Math.abs(m.pos[1] - 2.3) < 0.02, 'on the top');
  }
});

test('AUDIT CLIMB2 C5: a catch or a corner in flight carries the hang it ends in - with a recentre, and with a turning hull', () => {
  for (const what of ['catch', 'corner']) {
    const T = [0, 0, 0], H = 499;
    const col = new Collider(() => -1e9);
    col.addMesh('floor', new Float32Array([-20, H, -20, 20, H, -20, 20, H, 20, -20, H, 20]), [0, 1, 2, 0, 2, 3], I, () => T);
    col.addMesh('block', BOX(-3, H, 1, 3, H + 2.3, 4), BOX_IDX, I, () => T);
    const m = motor(col, { skill: 100, x: what === 'corner' ? 2 : 0, y: H + 0.02 });
    let shifted = false;
    for (let i = 0; i < 200; i++) {
      if (!shifted && m._pkMove?.kind === what) { T[1] -= 500; m.offsetOrigin([0, -500, 0]); shifted = true; }
      step(m, { strafe: what === 'corner' && i >= 60 && !shifted ? 1 : 0, jump: i >= 10 && i < 40 });
    }
    assert.ok(shifted, `${what}: recentred in flight`);
    assert.equal(m.hanging, true, `${what}: hanging after it`);
  }
  // a corner turned on a hull turning 25 degrees a second ends in a hold on the face it came to
  const T = [0, 0, 2.5]; let th = 0;
  const R = () => { const c = Math.cos(th), s = Math.sin(th); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('hull', BOX(-3, 0, -1.5, 3, 2.0, 1.5), BOX_IDX, I, () => T, R);
  const m = motor(col, { skill: 0, x: 2 });
  let cornered = false, lag = null;
  for (let i = 0; i < 400 && lag == null; i++) {
    const inCorner = m._pkMove?.kind === 'corner';
    if (inCorner) { th += (25 * Math.PI / 180) / 60; cornered = true; }
    step(m, { strafe: i >= 60 && (!cornered || m._pkMove) ? 1 : 0, jump: i >= 10 && i < 40 });
    if (cornered && !m._pkMove && m._wall) {
      const n = m._wall.normal, face = [Math.cos(th), 0, -Math.sin(th)];   // the hull's +x side, turned
      lag = Math.acos(Math.max(-1, Math.min(1, n[0] * face[0] + n[2] * face[2]))) * 180 / Math.PI;
    }
  }
  assert.ok(cornered && lag != null, 'round the hull\'s corner');
  assert.ok(lag < 1, `the hold faces the side it came to (off it by ${lag.toFixed(1)} deg)`);
});

test('AUDIT CLIMB2 C6: A1\'s floor is the ground outdoors too - a free climb let go of on terrain stands, as on a floor', () => {
  const col = new Collider(() => 0);   // terrain only (heightAt): the outdoors
  col.addMesh('wall', BOX(-3, 0, 1, 3, 6, 4), BOX_IDX, I);
  const m = motor(col, { skill: 0, z: 0.6 });
  let started = false;
  for (let i = 0; i < 120 && !started; i++) { step(m, { forward: 1 }); started = m.onWall; }
  assert.ok(started, 'a free climb begun at the foot of the wall');
  for (let i = 0; i < 30; i++) step(m, {});
  assert.equal(m.onWall, false, 'standing on the ground');
  // the classic climb's own probe (ClimbingMotor :318-320) is the same one: it meets the terrain as Unity's ray does
  const c = new PlayerMotor(col, { speed: 50, running: 30 }, { climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 } });
  c.spawn(0, 0.02, 0.6);
  const asked = [];
  const classic = c.climb.step.bind(c.climb);
  c.climb.step = (dt, k) => { asked.push(k.tooCloseToGround()); return classic(dt, k); };
  step(c, { forward: 1 });
  c.spawn(0, 1.5, -3);
  step(c, { forward: 1 });
  assert.deepEqual(asked, [true, false], 'the ground too near on the terrain, and not 1.5 m over it');
});

test('AUDIT CLIMB2 C7: a corner is the same hold going on - the grip warning said once a hold, the Climbing tally kept, the climb\'s flag up through it', () => {
  const said = [];
  const s = scene(); s.box(-1, 0, 1, 1, 2.3, 3);   // a 2 m block
  const m = motor(s.col, { skill: 100, said });
  for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });
  assert.equal(m.hanging, true);
  m.grip = 0.2;   // failing as the shimmy begins
  let corners = 0;
  for (let i = 0; i < 300; i++) { const was = m._pkMove; step(m, { strafe: 1 }); if (!was && m._pkMove?.kind === 'corner') corners++; }
  assert.ok(corners >= 2, `${corners} corners turned`);
  assert.equal(said.filter((l) => l === PARKOUR_GRIP_LOW_TEXT).length, 1, 'the warning said once');
  // round and round a pillar whose faces take less than the tally's cadence
  const tallies = [];
  const p = scene(); p.box(-0.45, 0, 1, 0.45, 2.3, 1.9);
  const q = motor(p.col, { skill: 100, tallies });
  for (let i = 0; i < 60; i++) step(q, { jump: i >= 10 && i < 40 });
  assert.equal(q.hanging, true);
  const t0 = tallies.length;
  let on = 0, flagOff = 0;
  for (let i = 0; i < 600; i++) {
    step(q, { strafe: 1 });
    if (q._pkMove?.kind === 'corner' || q.onWall) on++;
    if (q._pkMove?.kind === 'corner' && !q.climb.isClimbing) flagOff++;
  }
  const cadence = SYSTEM_TIMER_UPDATES_DIVISOR * CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY;
  assert.ok(on === 600, 'held all the way round');
  assert.ok(tallies.length - t0 >= Math.floor(600 / 60 / cadence) - 1, `Climbing tallied ${tallies.length - t0} times in ten seconds on the pillar`);
  assert.equal(flagOff, 0, 'climbing through every corner');
});

/** A convex n-sided tower of radius R (a vertical prism), its near face at z = 1, top at 2.3; its centre's z. */
function tower(n, R, top = 2.3) {
  const s = scene();
  const p = [];
  for (let i = 0; i < n; i++) { const a = Math.PI + (Math.PI / n) * 0.5 + (2 * Math.PI * i) / n; p.push([Math.sin(a) * R, Math.cos(a) * R]); }
  let near0 = Infinity;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % n];
    if ((x0 <= 0 && x1 >= 0) || (x0 >= 0 && x1 <= 0)) near0 = Math.min(near0, z0 + (z1 - z0) * (x1 === x0 ? 0 : -x0 / (x1 - x0)));
  }
  const cz = 1 - near0;
  const V = [];
  for (const y of [0, top]) for (const [x, z] of p) V.push(x, y, z + cz);
  const idx = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + j, i, n + j, n + i); }
  for (let i = 1; i < n - 1; i++) { idx.push(0, i + 1, i); idx.push(n, n + i, n + i + 1); }
  s.col.addMesh('tower', new Float32Array(V), idx, I);
  return { col: s.col, cz };
}

/** A box as a prism: its four sides and two fanned caps (the hostile-geometry audit's own triangulation - the
 *  collider's answers turn on which triangles a ray or a sphere meets first). */
function prismBox(s, x0, y0, z0, x1, y1, z1) {
  const p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const V = [];
  for (const y of [y0, y1]) for (const [x, z] of p) V.push(x, y, z);
  const idx = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; idx.push(i, j, 4 + j, i, 4 + j, 4 + i); }
  for (let i = 1; i < 3; i++) { idx.push(0, i + 1, i); idx.push(4, 4 + i, 4 + i + 1); }
  s.col.addMesh(`p${s.boxes.length}`, new Float32Array(V), idx, I);
  s.boxes.push([x0, y0, z0, x1, y1, z1]);
}

test('AUDIT CLIMB2 G1: a free climb never steps up - the hug\'s press into the wall is no walk into a stair, and a climb across under an eave is not lifted into it', () => {
  const s = scene();
  prismBox(s, -0.683, 0, 1, 1.763, 2.219, 2); prismBox(s, 0.289, 0, 0.638, 0.886, 2.219, 1); prismBox(s, -0.392, 2.081, 0.517, 3.516, 2.376, 1.961);
  for (const x of [-0.3, -0.2]) {
    const m = motor(s.col, { skill: 100, x, z: 0.6 });
    let worst = 0, leap = 0;
    for (let i = 0; i < 400; i++) {
      const was = [...m.pos];
      step(m, { forward: i < 100 ? 1 : 0, strafe: i < 100 ? 0 : (Math.floor((i - 100) / 10) % 2 ? -1 : 1) });
      if (m.onWall) { worst = Math.max(worst, overlap(s.boxes, m.pos, m.height)); leap = Math.max(leap, Math.hypot(m.pos[0] - was[0], m.pos[1] - was[1], m.pos[2] - was[2])); }
    }
    assert.ok(leap < 0.1 && worst < 0.03, `x ${x}: the longest step on the wall ${leap.toFixed(3)} m, the deepest ${worst.toFixed(3)} m`);
  }
  // and where the ladder's rung lands clear - a plinth beside the way across, 0.3 m over the feet - the climb is not
  // lifted onto it in a step
  const p = scene(); p.box(-3, 0, 1, 3, 6, 4); p.box(1, 0, 0.6, 3, 0.8, 1);
  const m = motor(p.col, { skill: 100, z: 0.6 });
  for (let i = 0; i < 200 && !(m.onWall && m.pos[1] > 0.5); i++) step(m, { forward: 1 });
  assert.ok(m.onWall && m.pos[1] > 0.5 && m.pos[1] < 0.6, `on the wall at the plinth's side (y ${m.pos[1].toFixed(2)})`);
  let leap = 0;
  for (let i = 0; i < 90 && m.onWall; i++) { const was = [...m.pos]; step(m, { strafe: 1 }); leap = Math.max(leap, Math.abs(m.pos[1] - was[1])); }
  assert.ok(leap < 0.05, `no step up onto the plinth (${leap.toFixed(3)} m in a step)`);
});

test('AUDIT CLIMB2 G2: the climb\'s proofs ask the whole body - a moulding or a rail between the collider\'s spheres stops a shimmy, a catch and a free climb', () => {
  const on = (m) => m.onWall || !!m._pkMove;
  // the shimmy into a moulding at the chest (0.20 off the face) and one at the waist (0.22 off): it stops short
  for (const [y0, y1, z0] of [[1.65, 1.69, 0.8], [1.10, 1.14, 0.78]]) {
    const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4); s.box(0.5, y0, z0, 3, y1, 1);
    const m = motor(s.col, { skill: 100, x: -1 });
    let worst = 0, pop = 0;
    for (let i = 0; i < 220; i++) {
      const was = [...m.pos], held = on(m);
      step(m, { jump: i >= 10 && i < 40, strafe: i >= 60 ? 1 : 0 });
      if (on(m)) worst = Math.max(worst, overlap(s.boxes, m.pos, m.height));
      if (held && !on(m)) pop = Math.max(pop, Math.abs(m.pos[1] - was[1]));
    }
    assert.ok(worst < 0.03 && pop < 0.2, `moulding at ${y0}: deepest on the wall ${worst.toFixed(3)} m, popped ${pop.toFixed(2)} m`);
  }
  // the catch beside a rail under the lip
  {
    const s = scene(); s.box(-3, 0, 1, 3, 2.15, 4); s.box(-3, 0.85, 0.91, 3, 0.88, 0.98);
    const m = motor(s.col, { skill: 60, z: 0.45 });
    let worst = 0;
    for (let i = 0; i < 60; i++) { step(m, { jump: i >= 10 && i < 40 }); if (on(m)) worst = Math.max(worst, overlap(s.boxes, m.pos, m.height)); }
    assert.ok(worst < 0.03, `the catch: ${worst.toFixed(3)} m deep`);
  }
  // the free climb up a wall with a rail across it: never pressed deeper into it than it stood, and up past it, leaning
  // out - a rail in the collider's blind band (12 cm out at the chest) too, the body walked in against it
  for (const [out, y0] of [[0.08, 0.83], [0.12, 1.15]]) {
    const s = scene(); s.box(-3, 0, 1, 3, 6, 4); s.box(-3, y0, 1 - out, 3, y0 + 0.03, 1);
    const m = motor(s.col, { skill: 100, z: 0.6 });
    const entry = overlap(s.boxes, m.pos, m.height);
    let worst = 0;
    for (let i = 0; i < 120; i++) { step(m, { forward: 1 }); if (m.onWall) worst = Math.max(worst, overlap(s.boxes, m.pos, m.height)); }
    assert.ok(worst <= Math.max(0.03, entry + 0.01), `the free climb at a rail ${out} out: ${worst.toFixed(3)} m deep (it stood ${entry.toFixed(3)} in)`);
    assert.ok(m.pos[1] > y0 + 0.1, `up past the rail ${out} out (feet ${m.pos[1].toFixed(2)})`);
  }
});

test('AUDIT CLIMB2 G3: a crouched body under a low slab takes no wall it cannot stand up on - never stood into the slab, never flicking on and off the wall', () => {
  for (const slab of [1.4, 1.6]) {
    const s = scene(); s.box(-3, 0, 1, 3, 4, 4); s.box(-3, slab, -0.5, 3, slab + 0.3, 1);
    const m = motor(s.col, { skill: 100, z: -1.5 });
    let worst = 0, flips = 0, was = false;
    for (let i = 0; i < 400; i++) {
      step(m, { crouch: i === 2, forward: i >= 30 ? 1 : 0 });
      worst = Math.max(worst, overlap(s.boxes, m.pos, m.height));
      if (m.onWall !== was) flips++;
      was = m.onWall;
    }
    assert.ok(worst < 0.03 && flips === 0, `slab at ${slab}: ${flips} flips on and off the wall, ${worst.toFixed(3)} m deep`);
  }
  // with room to stand, a crouched climber stands and climbs (the classic climb stands a crouched one too)
  const s = scene(); s.box(-3, 0, 1, 3, 4, 4);
  const m = motor(s.col, { skill: 100, z: -0.5 });
  for (let i = 0; i < 200 && !(m.onWall && m.pos[1] > 0.5); i++) step(m, { crouch: i === 2, forward: i >= 30 ? 1 : 0 });
  assert.ok(m.onWall && !m.crouching && m.pos[1] > 0.5, `climbing, standing (y ${m.pos[1].toFixed(2)})`);
});

test('AUDIT CLIMB2 G4: a free climb takes the lip its hands come to - a sill as it reaches it, never butting the head first; a cornice it cannot get past by reaching round it', () => {
  // a sill 12 cm out and 10 cm tall on a tall wall: taken as the hands come to it, the climb never stopped under it
  // (CLIMB3 moved this pin: with Forward held the hold it takes there goes on up the wall over it, past the sill)
  {
    const s = scene(); s.box(-3, 0, 1.12, 3, 12, 4); s.box(-1.5, 5.4, 1.0, 1.5, 5.5, 1.12);
    const m = motor(s.col, { skill: 100, z: 0.74 });
    let stalls = 0, climbing = false, worst = 0, took = false;
    for (let i = 0; i < 900 && m.pos[1] < 6; i++) {
      const y = m.pos[1];
      step(m, { forward: 1 });
      if (climbing && m.onWall && !m.hanging && m.pos[1] - y < 1e-4) stalls++;
      climbing ||= m.onWall;
      took ||= m._wall?.past != null && near(m._wall.past, 5.5, 0.02);
      worst = Math.max(worst, overlap(s.boxes, m.pos, m.height));
    }
    assert.ok(took, 'the sill taken as the hands came to it');
    assert.ok(m.onWall && m.pos[1] >= 6, `and the climb went on up past it (at ${m.pos[1].toFixed(2)})`);
    assert.equal(stalls, 0, 'the climb never stopped under it');
    assert.ok(worst < 0.03, `never into the sill (${worst.toFixed(3)})`);
  }
  // a cornice 0.12-0.15 out and 0.2 tall: the head stops under it with the lip 1.9 over the feet - the hands reach round
  for (const out of [0.12, 0.15]) {
    const s = scene(); s.box(-3, 0, 1, 3, 8, 4); s.box(-3, 2.8, 1 - out, 3, 3.0, 1);
    const m = motor(s.col, { skill: 0, z: 0.6 });
    let worst = 0;
    for (let i = 0; i < 300 && !m.hanging; i++) { step(m, { forward: 1 }); worst = Math.max(worst, overlap(s.boxes, m.pos, m.height)); }
    for (let i = 0; i < 20; i++) { step(m, {}); worst = Math.max(worst, overlap(s.boxes, m.pos, m.height)); }
    assert.ok(m.hanging && near(m._wall.lipY, 3.0, 0.02), `cornice ${out} out: hanging from it (${m.hanging ? m._wall.lipY : 'not hanging'})`);
    assert.ok(worst < 0.03, `clear of it (${worst.toFixed(3)})`);
  }
});

/** The inside of a polygonal room: n wall segments 0.3 thick round a circle of radius R, its near wall's face at z = 1,
 *  top at 2.3; its centre's z. */
function ring(n, R, top = 2.3) {
  const s = scene();
  const cz = 1 - R * Math.cos(Math.PI / n), k = (R + 0.3) / R;
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * (i - 0.5)) / n, a1 = (2 * Math.PI * (i + 0.5)) / n;
    const p = [[Math.sin(a0) * R, Math.cos(a0) * R], [Math.sin(a1) * R, Math.cos(a1) * R]];
    p.push([p[1][0] * k, p[1][1] * k], [p[0][0] * k, p[0][1] * k]);
    const V = [];
    for (const y of [0, top]) for (const [x, z] of p) V.push(x, y, z + cz);
    const idx = [];
    for (let a = 0; a < 4; a++) { const b = (a + 1) % 4; idx.push(a, b, 4 + b, a, 4 + b, 4 + a); }
    for (let a = 1; a < 3; a++) { idx.push(0, a + 1, a); idx.push(4, 4 + a, 4 + a + 1); }
    s.col.addMesh(`seg${i}`, new Float32Array(V), idx, I);
  }
  return { col: s.col, cz };
}

test('AUDIT CLIMB2 G5: the shimmy goes round a tower of any number of sides - its bends followed and its corners turned, whatever their angle - and round the inside of a room the same', () => {
  for (const [n, R, inside] of [[24, 1.0], [20, 0.8], [32, 0.6], [12, 1.5], [10, 2], [8, 1.5], [6, 1.5], [8, 2, true], [10, 2, true], [12, 3, true], [12, 1.5, true], [6, 2, true]]) {
    const { col, cz } = inside ? ring(n, R) : tower(n, R);
    const m = motor(col, { skill: 100 });
    for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });
    assert.equal(m.hanging, true, `${n}-gon R ${R}${inside ? ' inside' : ''}: hanging`);
    let turned = 0, prev = Math.atan2(m.pos[0], m.pos[2] - cz), corners = 0;
    for (let i = 0; i < 2400 && Math.abs(turned) < 2 * Math.PI; i++) {
      const was = m._pkMove;
      step(m, { strafe: 1 });
      if (!was && m._pkMove) corners++;
      if (!m.onWall && !m._pkMove) break;
      const a = Math.atan2(m.pos[0], m.pos[2] - cz);
      let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      turned += d; prev = a;
    }
    assert.ok(Math.abs(turned) >= 2 * Math.PI, `${n}-gon R ${R}${inside ? ' inside' : ''}: round ${(Math.abs(turned) * 180 / Math.PI).toFixed(0)} deg (${m.hanging ? 'hanging' : 'let go'})`);
    // a facet turned under the follow is followed, not swung round: a round tower is no string of corners
    if (360 / n < 30) assert.equal(corners, 0, `${n}-gon R ${R}: followed round, ${corners} corners swung`);
  }
  // a lip that ends at a gap, a wall across the way beyond it: no corner - the hands do not cross the gap
  const s = scene(); s.box(-3, 0, 1, 0, 2.3, 4); s.box(0.6, 0, -1, 3, 2.3, 4);
  const m = motor(s.col, { skill: 100, x: -1 });
  for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });
  assert.equal(m.hanging, true);
  let crossed = false;
  for (let i = 0; i < 180; i++) { step(m, { strafe: 1 }); crossed ||= !!m._pkMove; }
  assert.ok(!crossed && m.hanging && m.pos[0] < 0, `held at the lip's end (x ${m.pos[0].toFixed(2)})`);
});

test('AUDIT CLIMB2 G6: Forward with Left or Right at a wall\'s side edge still climbs - the way across ends there, the way up does not', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 8, 4);
  const m = motor(s.col, { skill: 0, x: 2.0, z: 0.6 });
  let edge = null;
  for (let i = 0; i < 400; i++) {
    step(m, { forward: 1, strafe: i >= 60 ? 1 : 0 });
    if (edge == null && m.onWall && m.pos[0] > 2.99) edge = { i, y: m.pos[1] };
    if (edge && i > edge.i + 120) break;
  }
  assert.ok(edge, 'at the edge');
  assert.ok(m.onWall && m.pos[1] > edge.y + 0.5, `still climbing at the edge (rose ${(m.pos[1] - edge.y).toFixed(2)} m)`);
});

test('AUDIT CLIMB2 M1: Crouch with Jump held lets go and stays let go - the Jump held is spent on the hold, never a catch of the lip just dropped from', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4);
  const m = motor(s.col, { skill: 100 });
  for (let i = 0; i < 60; i++) step(m, { jump: i >= 10 && i < 40 });   // caught, and Jump let go of on the wall
  assert.equal(m.hanging, true);
  step(m, { jump: true, crouch: true });   // a fresh Jump pressed as Crouch lets go - the hold's own let-go spends it
  let again = false;
  for (let i = 0; i < 60; i++) { step(m, { jump: true }); again ||= m.onWall || !!m._pkMove; }
  assert.equal(again, false, 'not caught again');
  assert.equal(m.grounded, true, 'down on the ground');
});

test('AUDIT CLIMB2 M2: the fit\'s headroom ray still answers what the collider and the bands cannot - a body pinned between a slab at its feet and one at its head', () => {
  assert.equal(PARKOUR_BODY_RADIUS, CAPSULE_RADIUS, 'the body\'s radius restated for the cycle');
  for (const [y1, y2, th] of [[0.02, 1.5, 0.1], [0.1, 1.56, 0.1], [0.2, 1.62, 0.1], [0.06, 1.78, 0.02], [0.04, 1.78, 0.1]]) {
    const s = scene(); s.box(-2, y1, -2, 2, y1 + th, 2); s.box(-2, y2, -2, 2, y2 + 0.1, 2);
    assert.equal(capsuleFits(s.col, [0, 0, 0], CAPSULE_HEIGHT), false, `slabs at ${y1} and ${y2}`);
  }
  // (the last two - a plate through the shins under a ceiling at the head - only the ray sees: the collider's
  // spheres can be pushed neither way, and the bands, since AFTER AUDIT CLIMB2 fine enough to see the others, stand
  // above the plate)
  const s = scene();
  assert.equal(capsuleFits(s.col, [0, 0, 0], CAPSULE_HEIGHT), true, 'and the open fits');
});

test('TAP CATCH (Mac, 2026-10-01: "Take care of what is left including a jump catching a ledge"): a tapped Jump catches - the press arms the catch for the jump it makes, until the body is down again', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4);
  // a tap at the wall: the grounded press finds the lip out of the standing reach, the jump carries it into the hands
  const m = motor(s.col, { skill: 100 });
  let armedUp = false;
  for (let i = 0; i < 60; i++) { step(m, { jump: i === 10 }); armedUp ||= !m.grounded && !!m._pkArm; }
  assert.ok(armedUp, 'armed through the jump with the key let go');
  assert.equal(m.hanging, true, 'a tapped jump caught the lip and hangs');
  // a tap in the air, falling past the lip (no jump made): the press arms the catch just the same
  const f = motor(s.col, { skill: 100, y: 1.0 });
  for (let i = 0; i < 40; i++) step(f, { jump: i === 1 });
  assert.equal(f.hanging, true, 'a tap while falling past it caught it');
  // a tap far from any lip arms nothing past the landing: the jump comes down and the arm is gone
  const far = scene();
  const g = motor(far.col, { skill: 100 });
  let up = false, down = null;
  for (let i = 0; i < 90; i++) { step(g, { jump: i === 10 }); up ||= !g.grounded; if (up && g.grounded && down == null) down = i; }
  assert.ok(up && down != null, 'jumped and landed');
  assert.equal(g._pkArm, null, 'the landing ends the arm');
  // and no press, no catch: falling past the lip with no key is still a fall
  const n = motor(s.col, { skill: 100, y: 1.0 });
  for (let i = 0; i < 40; i++) step(n, {});
  assert.equal(n.hanging, false, 'no press, no catch');
  // a tap catches what the hands can hang from; a sheer wall (no lip in reach) is grabbed only with the key held, as
  // CLIMB2 has it - a tapped jump at a wall with Forward is a jump
  const w = scene(); w.box(-3, 0, 1, 3, 8, 4);
  const t = motor(w.col, { skill: 100 });
  let grabbed = false;
  for (let i = 0; i < 60; i++) { step(t, { forward: i < 30 ? 1 : 0, jump: i === 12 }); grabbed ||= t.onWall; }
  assert.equal(grabbed, false, 'a tap is no grab of a sheer wall');
  const h = motor(w.col, { skill: 100 });
  for (let i = 0; i < 30; i++) step(h, { forward: 1, jump: i >= 12 && i < 30 });
  assert.equal(h.onWall, true, 'held, it is (CLIMB2)');
  // (nor is a low lip stepped onto in the air from a tap - AUDIT CLIMB1 G5's staircase, tapped all the way up, pins it)
  // a press the ground's own gate refuses a jump (fresh off a landing) arms nothing for long: no jump, no catch to come
  const z = motor(far.col, { skill: 100 });
  step(z, {}); step(z, {});   // down on the floor, under the gate's 0.1 s
  assert.equal(z.grounded, true);
  step(z, { jump: true });
  assert.equal(z.grounded, true, 'the gate refused the jump');
  for (let i = 0; i < 6; i++) step(z, {});
  assert.ok(z.grounded && z._pkArm === null, 'a press that never left the ground lapses');
  // a press spent on a move arms nothing past it: a tap at a waist-high box mantles onto it, the press gone with it
  const k = scene(); k.box(-3, 0, 1, 3, 0.9, 4);
  const q = motor(k.col, { skill: 100 });
  for (let i = 0; i < 40 && !q._pkMove; i++) step(q, { jump: i === 20 });
  assert.ok(q._pkMove && q._pkArm === null, 'the mantle spent the press');
  // a fresh press at the let-go, let go of at once: the fall is a fall, not a catch of the lip just let go of - a hang
  // high on a wall (a slab over its top: the free climb ends hanging from it), so the fall is long enough to catch in
  const hi = scene(); hi.box(-3, 0, 1, 3, 6, 4); hi.box(-4, 6.6, -1, 4, 6.8, 4);
  const d = motor(hi.col, { skill: 100, z: 0.6 });
  for (let i = 0; i < 900 && !d.hanging; i++) step(d, { forward: 1 });
  assert.ok(d.hanging && d.pos[1] > 4, `hanging high on the wall (feet ${d.pos[1].toFixed(2)})`);
  for (let i = 0; i < 5; i++) step(d, {});
  step(d, { jump: true, crouch: true });
  let again = false;
  for (let i = 0; i < 60; i++) { step(d, {}); again ||= d.onWall || !!d._pkMove; }
  assert.equal(again, false, 'the let-go spent the press');
  // a refused climb's line is said once a jump, armed or held (Roleplay & Realism's weapon drawn)
  const said = [];
  registerParkourGate(() => 'no weapon');
  try {
    const r = motor(s.col, { skill: 100, said });
    for (let i = 0; i < 60; i++) step(r, { jump: i === 10 });
    assert.equal(said.filter((l) => l === 'no weapon').length, 1, 'said once for the tapped jump');
  } finally { registerParkourGate(null); }
});

test('AUDIT CLIMB2 CLIP: the fit asks the body finely enough that a thin rod between its samples sits no deeper than a contact - 3.3 cm in is refused where the first sampling missed it, 1.5 cm in is a touch', () => {
  const at = (y, d) => { const s = scene(); s.box(-2, y, d, 2, y + 0.01, 3); return capsuleFits(s.col, [0, 0, 0], CAPSULE_HEIGHT); };
  assert.equal(at(0.7575, 0.317), false, 'a rod 3.3 cm in at 0.76 m - midway between the first cut\'s samples');
  assert.equal(at(0.689, 0.317), false, 'a rod 3.3 cm in at 0.69 m - midway between two of the samples now');
  assert.equal(at(0.7575, 0.335), true, 'a rod 1.5 cm in is a touch');
});
