// AUDIT DISC28 (2026-09-28, the pre-merge audit of the 2026-09-28 Discord batch, before the merge) - lane 4, motion.
//
// MO-1: A WALL IS NEVER A FLOOR. DISC28-G stopped a RISING swimmer being set on a ceiling's top face, and the same
// report came true by another road the fix left as it was. PH1's one-way floor read the CONTACT's direction alone -
// within the slope limit of straight down - and the closest point of a wall is not always on its face: a wall quad is
// two triangles, and a sphere pressed into it just under the DIAGONAL is nearest the upper triangle's edge, above its
// centre. The lower sphere was set ON that edge (lifted ~0.4) and, under a ceiling, the ceiling's face was then in reach
// straight above and set the body on the ceiling's top - in the HORIZONTAL pass, which is never a rising one. A swimmer
// holding Space along a wall left the level; a crouched walker in a crawlspace did; a runner along a wall was thrown
// half a metre up. A CharacterController stands only on what its slopeLimit calls walkable, judged by the touched
// triangle's own normal: the one-way floor now asks the face's own plane too (player/collider.js _resolveSphere).
//
// MO-3: ONE STROKE IS ONE SWEEP. The Deep Waters stroke is one CharacterController.Move a frame, however long; the
// port's move() sweeps exactly only up to EXACT_SWEEP_MAX and takes the rest whole. At the Swim Speed Multiplier's top
// a fast swimmer's stroke in a slow frame passed that, and its substeps - wider than the capsule - went up through any
// ceiling. The stroke hands a longer motion over in pieces (scenes/deepWater/deepWatersSwimMove.js).
//
// Every test here fails on the merge it was written against (2a8b70b2a). Driven through the real collider, the real
// PlayerMotor and the real stroke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { createSwimMovement } from '../../src/scenes/deepWater/deepWatersSwimMove.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** One quad, two triangles, filed in the order given (the one above the diagonal first, as a model may file it). */
const quad = (c, pts, order = [0, 1, 2, 0, 2, 3]) => c.addMesh('dungeon', new Float32Array(pts.flat()), new Uint32Array(order), I);
/** A room of floor `floor`, a flat ceiling at `ceil`, and one ordinary wall at x = 2 (y floor..ceil, z -8..8) whose
 *  diagonal runs from its low corner at z -8 to its high corner at z 8. */
function room(floor, ceil) {
  const c = new Collider(() => -Infinity);
  quad(c, [[-40, floor, -40], [40, floor, -40], [40, floor, 40], [-40, floor, 40]]);
  quad(c, [[-40, ceil, -40], [40, ceil, -40], [40, ceil, 40], [-40, ceil, 40]]);
  quad(c, [[2, floor, -8], [2, ceil, -8], [2, ceil, 8], [2, floor, 8]]);
  return c;
}
const swimInput = { forward: 1, strafe: 0, run: false, jump: true, up: true, down: false, crouch: false };

test('AUDIT DISC28 MO-1: a wall is never a floor - a crouched body pressed into a wall under a ceiling stays under it, and a floor\'s own edge still takes it', () => {
  for (const [dx, dy] of [[0.0694, 0], [0.0694, 0.0694], [0.0694, -0.01], [0.2, 0]]) {
    for (const z of [6, 6.25, 6.5, 6.75, 7]) {
      const feet = [1.65, -1.9, z];   // crouched 0.9: the head resting under the ceiling at -1, the body touching the wall
      room(-6, -1).move(feet, dx, dy, 0, 0.9, false);
      assert.ok(feet[1] <= -1.9 + 1e-3, `pressed (${dx}, ${dy}) at z ${z}: still under the ceiling (feet ${feet[1].toFixed(3)}; -1 is ON its top)`);
    }
  }
  // what the law leaves alone: a lower sphere caught under a FLOOR's edge is still set on that floor (PH1's own case)
  const c = new Collider(() => -Infinity);
  quad(c, [[-40, 0, -40], [2, 0, -40], [2, 0, 40], [-40, 0, 40]]);
  const feet = [2.1, -0.45, 0];   // at rest, the lower sphere's centre 0.1 under the floor's plane and 0.1 past its edge
  c.move(feet, 0, 0, 0, 1.8, false);
  assert.ok(feet[1] > -0.05, `set on the edge of the floor it was under (feet ${feet[1].toFixed(3)}; the plain push drives it under, to -0.6)`);
});

test('AUDIT DISC28 MO-1: a dungeon swimmer holding Space and swimming along a wall under the ceiling stays in the level', () => {
  const c = room(-5, -1);
  const m = new PlayerMotor(c, { speed: 70, running: 50, swimming: 60 });
  m.pos = [1, -2.5, 7.5]; m.grounded = false;
  const yaw = Math.atan2(Math.sin(Math.PI / 4), -Math.cos(Math.PI / 4));   // 45 degrees into the wall, sliding towards -z
  let top = -Infinity;
  for (let k = 0; k < 60 * 12 && m.pos[2] > -7.8; k++) {
    m.waterSurfaceY = 8;
    m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 1.25 - 0.95 < 8;
    m.update(1 / 60, swimInput, yaw, 0);
    top = Math.max(top, m.pos[1]);
  }
  assert.ok(top <= -1.9 + 1e-3, `the crouched swimmer never rises past the ceiling (highest feet ${top.toFixed(3)})`);
});

test('AUDIT DISC28 MO-1: walkers - a crouched walker along a crawlspace\'s wall never ends on its ceiling, and a runner along a wall is not thrown up by it', () => {
  // the crawlspace: 0.95 high, the crouched 0.9 body just fitting; walking along its wall at 45 degrees
  const crawl = room(0, 0.95);
  const w = new PlayerMotor(crawl);
  w.pos = [1.5, 0, -7.5]; w.grounded = true; w.crouching = true;
  const along = Math.atan2(Math.sin(Math.PI / 4), Math.cos(Math.PI / 4));
  let crawlTop = 0;
  for (let k = 0; k < 60 * 10 && w.pos[2] < 7.8; k++) {
    w.update(1 / 60, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false }, along, 0);
    crawlTop = Math.max(crawlTop, w.pos[1]);
  }
  assert.ok(crawlTop < 0.05, `the crouched walker keeps to the crawlspace's floor (highest feet ${crawlTop.toFixed(3)}; 0.95 is ON the ceiling)`);
  // the runner: standing, running along a 4 m wall at 75 degrees into it
  const hall = room(0, 4);
  const r = new PlayerMotor(hall);
  r.pos = [1.6, 0, -7.5]; r.grounded = true;
  const into = (75 * Math.PI) / 180;
  let runTop = 0, air = 0;
  for (let k = 0; k < 60 * 6 && r.pos[2] < 7.5; k++) {
    r.update(1 / 60, { forward: 1, strafe: 0, run: true, jump: false, up: false, down: false, crouch: false }, into, 0);
    runTop = Math.max(runTop, r.pos[1]); if (!r.grounded) air++;
  }
  assert.ok(runTop < 0.05, `the runner is not lifted by the wall (highest feet ${runTop.toFixed(3)})`);
  assert.equal(air, 0, 'and never leaves the floor');
});

// PIN MOVED (FIELD BUGS 2026-10-25i RAIL-HANG, player/collider.js): a LEVEL stride's floor is one whose own plane stands
// over the sphere now (planeOver - a wall's has no up), so the walkers above no longer tell MO-1's law from that one -
// measured, the face-slope test dropped passed them. A stride with a vertical part is MO-1's alone: the runner's hall.
test('AUDIT DISC28 MO-1 at a stride with a vertical part: a body pressed into the hall\'s wall at 45 and 75 degrees, rising or sinking a hair, is never lifted by the wall\'s diagonal (41 of 1686 strides were, the face-slope test dropped)', () => {
  const c = room(0, 4);
  for (const dy of [0.004, -0.004]) {
    let lifted = 0;
    for (const deg of [45, 75]) {
      for (let z = -7; z <= 7; z += 0.05) {
        for (const x of [1.6, 1.63, 1.65]) {
          const a = (deg * Math.PI) / 180, feet = [x, 0, z];
          c.move(feet, Math.sin(a) * 0.1, dy, Math.cos(a) * 0.1, 1.8, false);
          if (feet[1] > Math.max(0, dy) + 0.05) lifted++;
        }
      }
    }
    assert.equal(lifted, 0, `a stride of ${dy}: lifted ${lifted} times`);
  }
});

test('AUDIT DISC28 MO-3: the Deep Waters stroke at the multiplier\'s top, in a 0.1 s frame, meets a ceiling like any other rise; a stroke that fits one sweep is still one move', () => {
  const run = (mult, stats) => {
    const c = new Collider(() => -Infinity);
    quad(c, [[-1e5, -6, -1e5], [1e5, -6, -1e5], [1e5, -6, 1e5], [-1e5, -6, 1e5]]);
    quad(c, [[-1e5, -1, -1e5], [1e5, -1, -1e5], [1e5, -1, 1e5], [-1e5, -1, 1e5]]);
    let moves = 0, strokeFrames = 0;
    const counted = { move: (...a) => { moves++; return c.move(...a); } };
    const m = new PlayerMotor(c, stats);
    m.pos = [0, -3, 0]; m.grounded = false;
    const sm = createSwimMovement({ settings: () => ({ swimSpeedMultiplier: mult, enableSwimStroke: true }), collider: () => counted });
    const ent = { fatigue: 1e9, stats: { strength: 60, endurance: 60 }, strength: 60, endurance: 60 };
    const dt = 0.1, pitch = 1.0;
    let t = 0, runKey = false, top = -Infinity;
    for (let k = 0; k < 60; k++) {
      t += dt;
      m.waterSurfaceY = 200;
      m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 1.25 - 0.95 < 200;
      m.update(dt, { ...swimInput, forward: 0 }, 0, pitch);
      if (k % 3 === 0) runKey = !runKey;
      const before = moves;
      sm.update({ now: t, dt, player: m, entity: ent, loadGrace: false, outdoorSwimming: false, anySwimming: !!m.swimming,
        input: { forward: 0, strafe: 0, up: true, down: false, run: runKey }, yaw: 0, pitch,
        lookDir: [0, Math.sin(pitch), Math.cos(pitch)], cameraY: m.pos[1] + 0.8, oceanY: null, seafloorY: () => null });
      if (moves > before) { strokeFrames++; if (mult === 1) assert.equal(moves - before, 1, 'a stroke that fits one sweep is the one move it was'); }
      top = Math.max(top, m.pos[1]);
    }
    return { top, strokeFrames };
  };
  const top = run(30, { speed: 100, running: 100, swimming: 100 });
  assert.ok(top.strokeFrames > 0, 'the stroke ran');
  assert.ok(top.top <= -1 - 0.9 + 1e-3, `the stroke stays under the ceiling (feet reached ${top.top.toFixed(2)})`);
  assert.ok(run(1, { speed: 100, running: 100, swimming: 100 }).strokeFrames > 0, 'and at the multiplier anyone walks with, it strokes as it did');
});
