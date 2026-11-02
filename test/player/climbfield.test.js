// AUDIT CLIMB-FIELD (2026-10-01, Mac: "Can you audit our integration of enhanced climbing? You cant mantle the bottom of
// roofs, you get stuck. You cant jump from a wall, hitting the top of an angled roof at a certain angle can get your
// character stuck, etc"). The arc had been proven on boxes and a few prisms; the audit climbed Daggerfall's own town
// blocks (ARCH3D buildings placed by BLOCKS.BSA, the freeware data) and found what the boxes never had:
//   - E1/E2 THE EAVE: Daggerfall's roofs stand out from their walls (151 of the 392 building models carry a soffit, the
//     common one 0.4 m), and the hand-hold read only a lip whose face steps OUT - an eave steps IN. The free climb's head
//     met the soffit and hung on until the grip ran out (380 of 612 climbs on three blocks), and a jump caught the eave
//     only from under the soffit;
//   - R1 THE PITCH: their "45-degree" roofs are 45.1 to 48.7 (whole-unit vertices), every one past the 45-degree top;
//   - J1 JUMP ON A WALL: a press with no hold to leap to was spent, and the hands held on;
//   - W1/W2 THE WEDGES: a body leaning on a face past the slope limit hung in the air with its fall speed growing (the
//     down pass's collide-and-stop refused every descent the face pushed), and a body whose chest met an eave's knife
//     edge stood on it by its head (the head sphere grounded, as COL1 F8 had stopped the middles doing).
// Driven on a real Collider and PlayerMotor over the shapes the real models have, the eave's measured off ARCH3D 201
// (a 0.4 m flat soffit, a 37-degree roof from a knife edge) and 127 (a soffit falling 0.19 m out to the edge, 46.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import {
  senseGrip, senseEaveAhead, PARKOUR_HANG_DROP, PARKOUR_HANG_GAP, PARKOUR_GRIP_MIN, PARKOUR_LEAP_GRIP, PARKOUR_TOP_MIN_NY,
  PARKOUR_EAVE_OUT,
} from '../../src/player/parkour.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const DEG = Math.PI / 180;
const GEO = { radius: 0.35, stand: CAPSULE_HEIGHT };
const BACK = 0.35 + PARKOUR_HANG_GAP;

function boxMesh(col, key, x0, y0, z0, x1, y1, z1) {
  col.addMesh(key, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX_IDX, I);
}
/** A house wall across +z (its face at z 1) `H` tall, under an eave standing `o` out from it - a soffit from the wall's
 *  top out to a knife edge (`drop` lower at the edge, as 127's falls), and from the edge a roof rising `deg` in. Planes,
 *  as Daggerfall's are: a shell with no fascia, no thickness and no top to the wall under the soffit. */
function eaved(H, o, deg, drop = 0) {
  const col = new Collider(() => 0);
  col.addMesh('wall', new Float32Array([-4, 0, 1, 4, 0, 1, 4, H, 1, -4, H, 1]), [0, 1, 2, 0, 2, 3], I);
  const ze = 1 - o, ye = H - drop, D = 5, t = Math.tan(deg * DEG);
  col.addMesh('soffit', new Float32Array([-4, H, 1, 4, H, 1, 4, ye, ze, -4, ye, ze]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('roof', new Float32Array([-4, ye, ze, 4, ye, ze, 4, ye + D * t, ze + D, -4, ye + D * t, ze + D]), [0, 2, 1, 0, 3, 2], I);
  return { col, edge: [ze, ye] };
}
const state = (m) => (m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air');
function climber(col, { skill = 100, jumping = 50, enabled = true } = {}) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => enabled, inputs: () => ({ climbing: skill, jumping }), say: () => {}, tally: () => {} },
  });
}
/** Drive `m` facing yaw 0 (+z) by `script(i, m, ctx)`; the states passed, each once in a row. */
function drive(m, script, steps, yaw = 0) {
  const seen = [], ctx = {};
  for (let i = 0; i < steps; i++) {
    const input = script(i, m, ctx);
    if (input === null) break;
    m.update(1 / 60, { ...blank, ...input }, yaw);
    const s = state(m);
    if (seen[seen.length - 1] !== s) seen.push(s);
  }
  return { seen, ctx };
}
/** Forward held at the foot of the wall until the body hangs from the eave - then `after` (from the hang). */
const climbToEave = (after = () => ({})) => (i, m, c) => {
  if (c.h == null) { if (m.hanging) { c.h = i; c.at = [...m.pos]; return {}; } return { forward: 1 }; }
  return after(i - c.h, m, c);
};

test('AUDIT CLIMB-FIELD E1: the hand-hold reads an eave over a set-back wall - its edge sought out from the wall, the body hung free under it; a fascia\'s face, a sill too thin, an eave past the hands\' reach and a roof past 50 degrees are the hand-hold\'s own law', () => {
  for (const [deg, drop] of [[37, 0], [46.2, 0.19], [25, 0.1], [48.7, 0]]) {
    const { col, edge } = eaved(3.22, 0.4, deg, drop);
    // asked from the wall the free climber hugs, anywhere in the lip's window
    for (const dy of [-0.12, -0.05, 0, 0.05, 0.12]) {
      const g = senseGrip(col, [0, 0, 1], [0, 0, -1], edge[1] + dy, GEO);
      assert.ok(g?.eave, `${deg} deg, sought ${dy}: the eave is a hold`);
      assert.ok(Math.abs(g.face[2] - edge[0]) < 0.01, `${deg} deg: the hands on the edge itself (z ${g.face[2].toFixed(3)})`);
      assert.ok(Math.abs(g.feet[2] - (edge[0] - BACK)) < 0.01 && Math.abs(g.lipY - PARKOUR_HANG_DROP - g.feet[1]) < 1e-9, `${deg} deg: hung under it, off the edge`);
      assert.ok(g.lipY >= edge[1] - 1e-3 && g.lipY <= edge[1] + 0.04, `${deg} deg: the lip at the edge (${g.lipY.toFixed(3)})`);
    }
    // asked again from the hang (its face the edge) it is the same hold - the hang's own re-ask every step
    const g = senseGrip(col, [0, 0, 1], [0, 0, -1], edge[1], GEO);
    const again = senseGrip(col, [g.feet[0] - BACK * g.normal[0], 0, g.feet[2] - BACK * g.normal[2]], g.normal, g.lipY, GEO);
    assert.ok(again?.eave && Math.hypot(again.feet[0] - g.feet[0], again.feet[1] - g.feet[1], again.feet[2] - g.feet[2]) < 0.005, `${deg} deg: held where it hangs`);
  }
  // a fascia standing under the edge is a face: the hand-hold's own law from it, hung off the fascia
  const f = eaved(3.22, 0.4, 37);
  boxMesh(f.col, 'fascia', -4, 3.07, 0.6, 4, 3.22, 0.62);
  const gf = senseGrip(f.col, [0, 0, 1], [0, 0, -1], 3.22, GEO);
  assert.ok(gf && !gf.eave && Math.abs(gf.face[2] - 0.6) < 0.01, `the fascia's face holds it (${gf && gf.face[2].toFixed(3)})`);
  // a sill 5 cm deep is too thin for the fingers from out here as from its face
  const sill = new Collider(() => 0);
  boxMesh(sill, 'wall', -4, 0, 1, 4, 6, 7); boxMesh(sill, 'sill', -4, 2.45, 0.95, 4, 2.5, 1);
  assert.equal(senseGrip(sill, [0, 0, 1], [0, 0, -1], 2.5, GEO), null, 'a 5 cm sill');
  // past the hands' reach, and past the top's pitch
  assert.equal(senseGrip(eaved(3.22, PARKOUR_EAVE_OUT + 0.2, 37).col, [0, 0, 1], [0, 0, -1], 3.22, GEO), null, `an eave ${PARKOUR_EAVE_OUT + 0.2} m out`);
  assert.equal(senseGrip(eaved(3.22, 0.4, 55).col, [0, 0, 1], [0, 0, -1], 3.22, GEO), null, 'a 55-degree roof');
  // the terrain is never a hold (CLIMB1's law): a heightmap's cliff 3.22 m tall is no eave, nor anything lowered from
  const cliff = new Collider((x, z) => (z > 1 ? 3.22 : 0));
  assert.equal(senseGrip(cliff, [0, 0, 1], [0, 0, -1], 3.22, GEO), null, 'a terrain cliff');
  assert.equal(senseEaveAhead(cliff, [0, 1.5, 0.3], [0, 0, 1], { low: 0.25, high: 2.25, radius: 0.35, stand: CAPSULE_HEIGHT }), null, 'a terrain cliff ahead');
  // a plain wall's free climb asks no eave of it: every rung met the face where it was expected
  const plain = new Collider(() => 0);
  boxMesh(plain, 'wall', -4, 0, 1, 4, 8, 7);
  let downs = 0;
  const raycastHit = plain.raycastHit.bind(plain);
  plain.raycastHit = (o, d, ...a) => { if (d[1] < 0) downs++; return raycastHit(o, d, ...a); };
  assert.equal(senseGrip(plain, [0, 0, 1], [0, 0, -1], 3, GEO), null);
  assert.equal(downs, 0, 'no down ray cast up the middle of a wall');
});

test('AUDIT CLIMB-FIELD E1: Forward held up a wall under a real eave reaches out to its edge, hangs, and climbs onto the roof - ARCH3D 201\'s and 127\'s, at Climbing 0 and 100', () => {
  for (const [deg, drop] of [[37, 0], [46.2, 0.19]]) {
    for (const skill of [0, 100]) {
      const { col } = eaved(3.22, 0.4, deg, drop);
      const m = climber(col, { skill });
      m.spawn(0, 0.02, -0.2);
      const r = drive(m, (i, mm) => (mm.grounded && mm.pos[1] > 3 ? null : { forward: 1 }), 900);
      assert.ok(r.seen.includes('move:reach') && r.seen.includes('hang'), `${deg} deg, Climbing ${skill}: reached out to the eave and hung (${r.seen.join(' > ')})`);
      assert.ok(m.grounded && m.pos[1] > 3.22 && m.pos[2] > 0.6, `${deg} deg, Climbing ${skill}: on the roof (${[...m.pos].map((v) => v.toFixed(2))}; ${r.seen.join(' > ')})`);
    }
  }
});

test('AUDIT CLIMB-FIELD E1: the eave\'s hang is a hang - held still, shimmied along, climbed down under the soffit with Back, let go with Crouch', () => {
  const hung = (after) => {
    const { col } = eaved(3.22, 0.4, 37);
    const m = climber(col);
    m.spawn(0, 0.02, -0.2);
    return { m, r: drive(m, climbToEave(after), 600) };
  };
  const still = hung((k) => (k < 120 ? {} : null));
  assert.ok(still.m.hanging && Math.abs(still.m.pos[2] - still.r.ctx.at[2]) < 1e-6 && Math.abs(still.m.pos[1] - still.r.ctx.at[1]) < 1e-6, 'held two seconds where it hung');
  const along = hung((k) => (k < 60 ? { strafe: 1 } : null));
  assert.ok(along.m.hanging && along.m.pos[0] > 0.4 && Math.abs(along.m.pos[2] - along.r.ctx.at[2]) < 0.01, `shimmied along the eave (x ${along.m.pos[0].toFixed(2)})`);
  const down = hung((k, mm) => (k < 400 && !(k > 5 && mm.grounded) ? { forward: -1 } : null));
  assert.ok(down.r.seen.includes('climb') && down.m.grounded && down.m.pos[1] < 0.05, `climbed down the wall under the soffit to the street (${down.r.seen.join(' > ')})`);
  const drop = hung((k) => (k === 2 ? { crouch: true } : k < 120 ? {} : null));
  assert.ok(drop.m.grounded && drop.m.pos[1] < 0.05 && !drop.m.onWall, 'Crouch let go');
});

test('AUDIT CLIMB-FIELD E2: a jump at an eave catches its edge from under the soffit or outside it, as far out as a lip\'s reach - and with Forward held climbs on onto the roof', () => {
  // an eave 2.3 m up, standing 0.4 and 0.6 m out: the body from under the soffit to 0.8 m short of the edge
  for (const o of [0.4, 0.6]) {
    for (const off of [-0.2, 0, 0.2, 0.4]) {
      const { col, edge } = eaved(2.3, o, 30);
      const m = climber(col);
      m.spawn(0, 0.02, edge[0] - BACK - off);
      const r = drive(m, (i) => ({ jump: i > 5 && i < 60 }), 160);
      assert.ok(m.hanging && Math.abs(m.pos[2] - (edge[0] - BACK)) < 0.02, `${o} m eave, ${off.toFixed(1)} m out from its hang: caught (${r.seen.join(' > ')})`);
    }
    // the edge a metre from the body's axis is past a lip's reach (the grab's: the radius and half a metre) - a jump
    const { col, edge } = eaved(2.3, o, 30);
    const far = climber(col);
    far.spawn(0, 0.02, edge[0] - 1.0);
    drive(far, (i) => ({ jump: i > 5 && i < 60 }), 160);
    assert.ok(!far.onWall, `${o} m eave, its edge 1 m off: out of reach`);
  }
  const { col } = eaved(2.3, 0.6, 30);
  const m = climber(col);
  m.spawn(0, 0.02, 0);
  drive(m, (i) => ({ jump: i > 5 && i < 60, forward: i < 60 ? 1 : 0 }), 200);
  assert.ok(m.grounded && m.pos[1] > 2.3, `Jump and Forward: onto the roof (${[...m.pos].map((v) => v.toFixed(2))})`);
  // the sensor itself: a roof ahead whose edge has a face under it is no overhang (the ledge sensor's), nor is a plain wall
  const ff = eaved(2.3, 0.6, 30);
  boxMesh(ff.col, 'fascia', -4, 2.15, 0.4, 4, 2.3, 0.42);
  assert.equal(senseEaveAhead(ff.col, [0, 1, 0], [0, 0, 1], { low: 0.25, high: 1.8, radius: 0.35, stand: CAPSULE_HEIGHT }), null, 'a fascia');
});

test('AUDIT CLIMB-FIELD R1: a roof up to 50 degrees is a top - Daggerfall\'s "45-degree" roofs, 45.1 to 48.7, are climbed onto from a wall flush with their eave; 52 is not', () => {
  assert.ok(Math.abs(Math.acos(PARKOUR_TOP_MIN_NY) / DEG - 50) < 1e-9);
  for (const deg of [45.2, 46.2, 48.7]) {
    const col = new Collider(() => 0);
    boxMesh(col, 'wall', -4, 0, 1, 4, 3, 7);
    const t = Math.tan(deg * DEG);
    col.addMesh('roof', new Float32Array([-4, 3, 1, 4, 3, 1, 4, 3 + 3 * t, 4, -4, 3 + 3 * t, 4]), [0, 2, 1, 0, 3, 2], I);
    const m = climber(col);
    m.spawn(0, 0.02, 0.2);
    const r = drive(m, (i, mm) => (mm.grounded && mm.pos[1] > 2.9 ? null : { forward: 1 }), 900);
    assert.ok(m.grounded && m.pos[1] > 3 && m.pos[2] > 1, `${deg} degrees: on the roof (${r.seen.join(' > ')})`);
  }
  const steep = new Collider(() => 0);
  boxMesh(steep, 'wall', -4, 0, 1, 4, 3, 7);
  const t = Math.tan(52 * DEG);
  steep.addMesh('roof', new Float32Array([-4, 3, 1, 4, 3, 1, 4, 3 + 3 * t, 4, -4, 3 + 3 * t, 4]), [0, 2, 1, 0, 3, 2], I);
  assert.equal(senseGrip(steep, [0, 0, 1], [0, 0, -1], 3, GEO), null, '52 degrees: no hold at its eave');
});

test('AUDIT CLIMB-FIELD J1: Jump on a wall always does something - a top in reach is climbed onto, a hold in the leap\'s reach leapt to, and with neither the body pushes off the wall', () => {
  // a free climb up the middle of an 8 m wall: nothing to climb onto or leap to - Jump, alone or with Forward or Right,
  // pushes off and the body lands out from the wall
  for (const keys of [{}, { forward: 1 }, { strafe: 1 }]) {
    const col = new Collider(() => 0);
    boxMesh(col, 'wall', -4, 0, 1, 4, 8, 7);
    const m = climber(col);
    m.spawn(0, 0.02, 0.2);
    const r = drive(m, (i, mm, c) => {
      if (c.t == null) { if (mm.onWall && mm.pos[1] > 1.5) c.t = i; return { forward: 1 }; }
      const k = i - c.t;
      return k < 3 ? {} : k < 8 ? { ...keys, jump: true } : k < 200 ? {} : null;
    }, 900);
    assert.ok(m.grounded && !m.onWall && m.pos[2] < -0.5, `Jump ${JSON.stringify(keys)}: pushed off the wall (z ${m.pos[2].toFixed(2)}; ${r.seen.join(' > ')})`);
  }
  // under a wall's top in reach, Jump climbs onto it (the press is the top-out, as Forward is) - never pushed off: from
  // the top, crouched over the edge into the hang, Back a step down the wall into the free climb, then Jump
  const low = new Collider(() => 0);
  boxMesh(low, 'wall', -4, 0, 1, 4, 3.4, 7);
  const m = climber(low);
  m.spawn(0, 3.42, 2.5);
  const r = drive(m, (i, mm, c) => {
    if (c.t == null) {
      if (mm.hanging) c.h ??= i;
      if (c.h != null && i - c.h > 4 && i - c.h <= 12) return { forward: -1 };
      if (c.h != null && i - c.h > 12) { c.t = i; return {}; }
      return c.h == null ? { forward: 1, crouch: i === 1 } : {};
    }
    const k = i - c.t;
    if (k === 0) assert.ok(mm.onWall && !mm.hanging && mm.pos[1] > 3.4 - 2.25, 'on the free climb, the top in the hands\' reach');
    return k < 3 ? {} : k < 8 ? { jump: true } : k < 120 ? {} : null;
  }, 900, Math.PI);
  assert.ok(m.grounded && m.pos[1] > 3.3, `onto the top (${r.seen.join(' > ')})`);
  // and a grip too spent to push off with refuses the press: the hands keep the wall
  const spent = new Collider(() => 0);
  boxMesh(spent, 'wall', -4, 0, 1, 4, 8, 7);
  const s = climber(spent);
  s.spawn(0, 0.02, 0.2);
  drive(s, (i, mm, c) => {
    if (c.t == null) { if (mm.onWall && mm.pos[1] > 1.5) c.t = i; return { forward: 1 }; }
    const k = i - c.t;
    if (k === 3) mm.grip = PARKOUR_GRIP_MIN + PARKOUR_LEAP_GRIP - 0.01;
    return k < 3 ? {} : k < 5 ? { jump: true } : null;
  }, 900);
  assert.ok(s.onWall, 'no grip to push off with: held');
});

test('AUDIT CLIMB-FIELD W1: a body leaning on a face past the slope limit comes down it - the down pass stops only where the body stands (ARCH3D 633: a 71-degree roof over a wall\'s top, the body motionless at its foot with its fall speed past -600)', () => {
  const col = new Collider(() => 0);
  boxMesh(col, 'wall', -4, 0, -3, 4, 6.45, 0);
  const run = 4.84 / Math.tan(71.3 * DEG);
  col.addMesh('steep', new Float32Array([-4, 6.45, 0, 4, 6.45, 0, 4, 11.29, -run, -4, 11.29, -run]), [0, 1, 2, 0, 2, 3], I);
  for (const dy of [-0.1, -0.25, -1, -3]) {
    const f = [0, 6.495, 0.237];
    col.move(f, 0, dy, 0, CAPSULE_HEIGHT, false);
    assert.ok(f[1] < 6.495 + dy * 0.5, `a ${dy} m fall came down (to ${f[1].toFixed(3)})`);
  }
  // what the stop is for: a body coming down onto a floor stops on it, unslid (the down pass's own pin, PH1/DW-D)
  const floor = new Collider(() => -10);
  boxMesh(floor, 'floor', -4, -1, -4, 4, 0, 4);
  const f = [0, 0.3, 0];
  const r = floor.move(f, 0, -0.5, 0, CAPSULE_HEIGHT, false);
  assert.ok(r.grounded && Math.abs(f[1]) < 0.02 && f[0] === 0 && f[2] === 0, 'a fall onto a floor stands on it');
});

test('AUDIT CLIMB-FIELD W2: the player\'s head never stands on what it meets - a jump into an eave\'s knife edge at the chest comes back down, climbing on or off', () => {
  for (const enabled of [false, true]) {
    const { col } = eaved(1.6, 0.4, 30);
    const m = enabled ? climber(col) : new PlayerMotor(col, { speed: 50, running: 30 });
    m.spawn(0, 0.02, -0.1);
    let held = 0;
    for (let i = 0; i < 120; i++) {
      m.update(1 / 60, { ...blank, forward: i < 60 ? 1 : 0, jump: i > 5 && i < 60 }, 0);
      if (m.grounded && m.pos[1] > 0.05 && m.pos[1] < 1.5) held++;
    }
    assert.equal(held, 0, `climbing ${enabled ? 'on' : 'off'}: never grounded in the air beside the edge`);
    assert.ok(m.grounded, 'down, or on the roof');
  }
  // the resolve itself: a body whose waist straddles the edge is pushed off it, never grounded by it
  const { col } = eaved(1.6, 0.4, 30);
  const out = { grounded: false, hitCeiling: false, pushedDown: false };
  const feet = [0, 0.425, 0.383];
  col._resolveCapsule(feet, out, CAPSULE_HEIGHT);
  assert.equal(out.grounded, false, 'the head on the edge is no floor');
});

test('AUDIT CLIMB-FIELD E1: the way down is an eave too - crouched down a real roof to its edge lowers the body over it into the hang under it, and Back climbs down the wall under the soffit to the street (it walked off and fell at every eave)', () => {
  for (const [o, deg, drop] of [[0.4, 30, 0], [0.4, 46.2, 0.19], [0.6, 30, 0]]) {
    const { col, edge } = eaved(3.22, o, deg, drop);
    const m = climber(col);
    m.spawn(0, edge[1] + 1.5 * Math.tan(deg * DEG) + 0.1, edge[0] + 1.5);
    const r = drive(m, (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (!c.hung) { if (mm.hanging) { c.hung = true; c.at = [...mm.pos]; return {}; } return { forward: 1 }; }
      return mm.grounded ? null : { forward: -1 };
    }, 1500, Math.PI);
    assert.deepEqual(r.seen.slice(0, 3), ['ground', 'move:lower', 'hang'], `${o} m eave at ${deg}: lowered into the hang (${r.seen.join(' > ')})`);
    assert.ok(Math.abs(r.ctx.at[2] - (edge[0] - BACK)) < 0.02, `${o} m eave at ${deg}: under its edge (z ${r.ctx.at[2].toFixed(2)})`);
    assert.ok(m.grounded && m.pos[1] < 0.05, `${o} m eave at ${deg}: down to the street (${r.seen.join(' > ')})`);
  }
});

test('AUDIT CLIMB-FIELD E1: the reach out to the eave is proven the whole way - a bracket beside it, clear of the climber under the soffit and of the hang under the edge, is never passed through', () => {
  const { col, edge } = eaved(3.22, 0.4, 37);
  // a bracket 1 cm square hung from the soffit (over the head of a body walking in), 0.29 m to the side of the way out
  // and halfway along it: 3.6 cm clear of the climber at the wall (its axis 0.35 off it) and of the hang, 6 cm into the
  // body halfway between
  const pz = (1 - 0.35 + edge[0] - BACK) / 2;
  boxMesh(col, 'pipe', 0.285, 2.2, pz - 0.005, 0.295, 3.22, pz + 0.005);
  const m = climber(col);
  m.spawn(0, 0.02, -0.2);
  let worst = 0;
  const r = drive(m, (i, mm) => {
    if (mm.onWall || mm._pkMove) {
      const dx = Math.max(0.285 - mm.pos[0], 0, mm.pos[0] - 0.295), dz = Math.max(pz - 0.005 - mm.pos[2], 0, mm.pos[2] - pz - 0.005);
      if (mm.pos[1] + mm.height > 2.2) worst = Math.max(worst, 0.35 - Math.hypot(dx, dz));
    }
    return mm.grounded && mm.pos[1] > 3 ? null : { forward: 1 };
  }, 600);
  assert.ok(worst < 0.035, `never into the pipe (${worst.toFixed(3)} m; ${r.seen.join(' > ')})`);
});
