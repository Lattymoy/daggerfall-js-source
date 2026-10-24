// PERF-CLIMB (the Enhanced Climbing arc's dense-mesh limit - bible/03-World/Parkour-Arc.md; Mac: "Take care of the
// remaining items"): A RESOLVE THAT MOVED NOTHING STOPS. The capsule's resolve ran three passes whatever the first
// found; a pass that ends where it began, to the bit, is the same pass again (collider.js _resolveCapsule), so it is
// the last. Measured on a 714-brick wall (8,568 triangles, one mesh): the free climb's top-out step 14.3 -> 10.8 ms,
// a step pressed into the wall 23.3 -> 13.5 ms, a corner's turn on a brick tower 15.1 -> 9.5 ms - and the answers
// are the same, bit for bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Collider, _setFixedPointStopForTest } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxVerts = (x0, y0, z0, x1, y1, z1) => [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
/** Count the sphere resolves `fn` asks of `col`. */
function spheres(col, fn) {
  const orig = col._resolveSphere;
  let n = 0;
  col._resolveSphere = function (...a) { n++; return orig.apply(this, a); };
  try { fn(); } finally { col._resolveSphere = orig; }
  return n;
}

test('PERF-CLIMB P1: a capsule in the open is resolved in ONE pass (its three beads, standing), one pressed in until the pass that pushed and the one that finds nothing left - and with the stop off, three passes always (mutants: the stop gone, the stop on a moved pass)', () => {
  const col = new Collider(() => -100);
  col.addMesh('wall', new Float32Array(boxVerts(-3, 0, 1, 3, 4, 2)), BOX_IDX, I);
  // feet at 1 m: the beads' centres (1.35, 1.9, 2.45) come back from the head to the bit
  const open = spheres(col, () => assert.equal(col.penetrationAt([0, 1, -2], 1.8), 0));
  assert.equal(open, 3, 'in the open: one pass of three beads');
  const touch = spheres(col, () => assert.equal(col.penetrationAt([0, 1, 1 - 0.35], 1.8), 0));
  assert.equal(touch, 3, 'touching, not in: one pass');
  let pushed = 0;
  const into = spheres(col, () => { pushed = col.penetrationAt([0, 1, 1 - 0.25], 1.8); });
  assert.ok(Math.abs(pushed - 0.1) < 1e-6, `pressed 0.1 in, pushed out 0.1 (${pushed})`);
  assert.equal(into, 6, 'the pass that pushed, and the one that found nothing left');
  // feet on the ground: 0.35 + 1.1 - 1.1 is not 0.35 in doubles - the round trip MOVED the body by a bit, which is not
  // nothing, and the next pass runs as it always did (the original's own drift, kept to the bit)
  const drift = spheres(col, () => col.penetrationAt([0, 0, -2], 1.8));
  assert.equal(drift, 6, 'a pass the rounding moved is not the last');
  try {
    _setFixedPointStopForTest(false);
    assert.equal(spheres(col, () => col.penetrationAt([0, 1, -2], 1.8)), 9, 'without the stop, three passes always');
  } finally { _setFixedPointStopForTest(true); }
});

test('PERF-CLIMB P2: the stop changes no answer - 80 random scenes walked, jumped, crouched and climbed for 300 steps each come out the same to the bit with it and without it', () => {
  const trace = () => {
    let seed = 987654;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const h = createHash('sha256');
    for (let scene = 0; scene < 80; scene++) {
      const col = new Collider(() => (scene % 3 === 0 ? 0.2 : 0));
      for (let k = 0; k < 12; k++) {
        const x = rnd() * 10 - 5, z = rnd() * 10 - 5, y = rnd() < 0.3 ? rnd() * 2 : 0;
        col.addMesh(`b${k}`, new Float32Array(boxVerts(x, y, z, x + 0.1 + rnd() * 3, y + 0.05 + rnd() * 4, z + 0.1 + rnd() * 3)), BOX_IDX, I);
      }
      const m = new PlayerMotor(col, { speed: 30 + rnd() * 70, running: 30 }, scene % 2 === 0
        ? { parkour: { enabled: () => true, inputs: () => ({ climbing: 60, jumping: 50 }), say: () => {}, tally: () => {} } } : {});
      m.spawn(rnd() * 2 - 1, 0.02, rnd() * 2 - 1);
      let yaw = rnd() * 6.28;
      for (let i = 0; i < 300; i++) {
        if (i % 40 === 0) yaw += rnd() * 2 - 1;
        m.update(1 / 60, { forward: rnd() < 0.8 ? 1 : 0, strafe: rnd() < 0.2 ? (rnd() < 0.5 ? 1 : -1) : 0, jump: rnd() < 0.05, crouch: rnd() < 0.02, run: rnd() < 0.3 }, yaw);
        h.update(new Float64Array([m.pos[0], m.pos[1], m.pos[2], m.grounded ? 1 : 0, m.velY ?? 0]));
      }
    }
    return h.digest('hex');
  };
  const on = trace();
  let off;
  try { _setFixedPointStopForTest(false); off = trace(); } finally { _setFixedPointStopForTest(true); }
  assert.equal(on, off, 'the same trajectories, bit for bit');
});

test('PERF-CLIMB P3: on the 714-brick wall the free climb\'s top-out step asks under 200 sphere resolves (342 before the stop), and climbs over as it did', () => {
  const verts = [], idx = [];
  let n = 0;
  for (let row = 0; row < 28; row++) {
    for (let x = -3 - (row % 2 ? 0.12 : 0); x < 3; x += 0.24) {
      const x0 = Math.max(-3, x), x1 = Math.min(3, x + 0.235);
      if (x1 <= x0) continue;
      verts.push(...boxVerts(x0, row * 0.1, 1, x1, row * 0.1 + 0.098, 1.3));
      for (const k of BOX_IDX) idx.push(n * 8 + k);
      n++;
    }
  }
  const col = new Collider(() => 0);
  col.addMesh('bricks', new Float32Array(verts), idx, I);
  assert.equal(n, 714);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100, jumping: 100 }), say: () => {}, tally: () => {} } });
  m.spawn(0, 0.02, 0.4);
  let topOut = null;
  for (let i = 0; i < 300 && !(m.grounded && m.pos[1] > 2.7); i++) {
    const wasClimbing = m.onWall;
    const k = spheres(col, () => m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0));
    if (wasClimbing && m.mantling && topOut == null) topOut = k;
  }
  assert.ok(m.grounded && m.pos[1] > 2.7, 'climbed up and over onto the top');
  assert.ok(topOut != null && topOut < 200, `the top-out step: ${topOut} sphere resolves`);
});
