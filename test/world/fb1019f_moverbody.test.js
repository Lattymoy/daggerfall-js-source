// MOVER-BODY and VOID-DUNGEON (FIELD BUGS 2026-10-19f, two players' private reports): stuck in a dungeon's lift; out of
// the map when a floor lowered onto them while they swam in a dungeon's water.
//
// MOVER-BODY. A dungeon's mover stood its collider bucket again at every frame's pose and asked nothing of the body: the
// host-side ride (shared.js ridePlatform) carried a body STANDING on it by its last frame's delta, through a sweep that
// stops at whatever blocks it, while the mover itself never stopped. A rider whose head met a lip was left inside the
// lift and the floor above it, held by both their inner faces (the collider is two-sided); a swimmer under a lowering
// floor stood on nothing of it, so the floor came down through the body and left it under the dungeon, where a stroke
// down took it out of the world. Now the action system meets the body as each mover steps (world/actionSystem.js
// _standMover, player/moverBody.js): a rider and any body the step presses is carried by the mover's own motion at it
// (DFU's PlayerGroundMotor.MoveWithMovingPlatform adhesion, from any side), swept through everything else; pinned
// between the mover and the world, it HOLDS the mover at its last pose that closed on nobody, and the tween plays on
// once the body is clear. A frame's step is met in MOVER_STEP pieces at the body, so a fast mover in a starved frame
// crosses no body unmet.
//
// VOID-DUNGEON. A dungeon had no failsafe (VOID-ENTRY's, FIELD BUGS 2026-10-04d, is a building's): its collider has no
// ground, so a body out of its floor fell or swam on for good. Its context keeps VOID-ENTRY's record now (enterExit.js
// dungeonVoidRescue - its start marker's landing, by the way in, else its enter marker's; none in a realm that casts its
// own void back), and both dungeon hosts' frames stand such a body there and say so.
//
// Fixtures from the producers: each mover's record minted by layoutRdbBlock off an RDB object (the action flag, axis,
// magnitude and duration as the block file carries them) and registered by ActionSystem.addAction, as dungeonContext.js
// registers it; the real Collider and the player's real motor; the hosts' own frame lines lifted out of their source and
// run. The geometry is synthetic (no ARENA2 here): boxes standing in for the lift, the slab and the floors.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutRdbBlock, ACTION_FLAGS, TRIGGER_FLAGS } from '../../src/world/rdbLayout.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { ActionSystem } from '../../src/world/actionSystem.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../../src/player/motor.js';
import { MOVER_PRESS, carriedBy, moverSteps } from '../../src/player/moverBody.js';
import { dungeonVoidRescue, standFromVoid, dungeonVoidText, DUNGEON_VOID_TEXT, INTERIOR_VOID_DROP } from '../../src/player/enterExit.js';
import { trs } from '../../src/world/mat4.js';

const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
/** A millimetre: how deep a mover may stand in a body it rests against (MOVER_PRESS), written out - a looser press fails here. */
const MM = 1e-3;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const STILL = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const go = (o) => ({ ...STILL, ...o });

/** An axis-aligned box's triangles (both faces count: the collider is two-sided), boxes merged into one mesh. */
function mesh(...boxes) {
  const positions = [], indices = [];
  for (const [[a, b, c], [d, e, f]] of boxes) {
    const o = positions.length / 3;
    positions.push(a, b, c, d, b, c, d, b, f, a, b, f, a, e, c, d, e, c, d, e, f, a, e, f);
    indices.push(...[0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7].map((k) => k + o));
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
const plane = (s) => ({ positions: new Float32Array([-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });

/** A mover as the block file carries it: an RDB model object with its action resource, laid out by layoutRdbBlock (the
 *  placement's matrix and its action record), registered as dungeonContext.js registers a 'move' placement. */
function addMover(actions, cpu, { flags, axis = 0, magnitude = 0, duration = 0, at = [0, 0, 0], position = 100 }) {
  const obj = {
    position, type: 1, xPos: at[0] / GLOBAL_SCALE, yPos: -at[1] / GLOBAL_SCALE, zPos: at[2] / GLOBAL_SCALE,
    resources: {
      modelResource: {
        xRotation: 0, yRotation: 0, zRotation: 0, modelIndex: 0, triggerFlagStartingLock: TRIGGER_FLAGS.Direct, soundIndex: 0,
        actionResource: { axis, duration, magnitude, nextObjectOffset: -1, flags, previousObjectOffset: -1 },
      },
      flatResource: { textureArchive: 0, textureRecord: 0, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: 0, action: 0 },
      lightResource: { radius: 0 },
    },
  };
  const L = layoutRdbBlock({ rdbBlock: { modelReferenceList: [{ modelIdNum: 61028, description: 'XXX' }], objectRootList: [{ rdbObjects: [obj] }] } }, 0, false, () => ({ positions: new Float32Array(0), doors: [] }));
  const p = L.placements[0];
  return actions.addAction(0, p.position, cpu, p.matrix, p.action);
}
const body = (col, at, settle = 30) => {
  const m = new PlayerMotor(col);
  m.spawn(...at);
  for (let f = 0; f < settle; f++) m.update(FIXED_DT, STILL, 0);
  return m;
};
const swimmer = (col, at) => {
  const m = new PlayerMotor(col);
  m.spawn(...at);
  Object.assign(m, { swimming: true, isPlayerSwimming: true, waterSurfaceY: 6 });   // the hosts' swim toggle: deep under the block's water line
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, STILL, 0);
  return m;
};
/** worldModes' order: the motor's step, then the movers (`dungeonCtx.actions.update(dt, player)`). */
const frame = (m, actions, input = STILL, yaw = 0, dt = FIXED_DT) => { m.update(FIXED_DT, input, yaw); actions.update(dt, m); };
/** The pose a mover's tween has at its `t` - the hold keeps its `t` with its pose. */
const poseY = (o, y0) => y0 + o.translation.y * o.t;

// ── the reports ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The lift report's rig: a 2x2 lift rising 4 m (PositiveY, axis 20: RDBLayout's `magnitude = axis * 8` units, over its
 *  fixed 50 ticks) up a shaft whose +x side is narrowed by a 0.6 m lip of the floor above. */
function liftRig() {
  const col = new Collider(() => -Infinity);
  const ground = mesh([[-6, -1.1, -6], [6, -0.6, 6]]);
  col.addMesh('dungeon', ground.positions, ground.indices, I);
  const upper = mesh([[-6, 4, -6], [6, 4.5, -1.1]], [[-6, 4, 1.1], [6, 4.5, 6]], [[-6, 4, -1.1], [-1.1, 4.5, 1.1]], [[0.5, 4, -1.1], [6, 4.5, 1.1]]);
  col.addMesh('upper', upper.positions, upper.indices, I);
  const actions = new ActionSystem(col);
  const lift = addMover(actions, mesh([[-1, -0.5, -1], [1, 0, 1]]), { flags: ACTION_FLAGS.PositiveY, axis: 20 });
  assert.deepEqual([lift.duration, lift.translation.y], [2.5, 4], 'the producer\'s lift: 4 m over 50 ticks');
  return { col, actions, lift };
}

test('MOVER-BODY the lift report: a rider whose head meets a lip is never left inside the lift - the lift HOLDS under the lip with the rider on its top, its tween waiting at the pose it holds, and goes on to its end once the rider steps clear, carrying the rider up', () => {
  // the record of the bug: the movers asked nothing of the body, and the rider was left inside the lift
  {
    const { actions, lift, col } = liftRig();
    const m = body(col, [0.6, 0.05, 0]);
    actions.activate(lift.key);
    for (let f = 0; f < 200; f++) { m.update(FIXED_DT, STILL, 0); actions.update(FIXED_DT); }
    assert.equal(lift.state, 'end');
    assert.ok(lift.matrix[13] - m.pos[1] > 1, `the code before: feet ${m.pos[1].toFixed(2)} inside the lift whose top is at ${lift.matrix[13]}`);
  }
  const { actions, lift, col } = liftRig();
  const m = body(col, [0.6, 0.05, 0]);
  assert.equal(m.groundKey, lift.key, 'the rider stands on the lift');
  actions.activate(lift.key);
  for (let f = 0; f < 200; f++) {
    frame(m, actions);
    assert.ok(lift.matrix[13] - m.pos[1] <= MM, `frame ${f}: feet ${m.pos[1]} never in the lift (top ${lift.matrix[13]})`);
    assert.ok(m.pos[1] + m.height <= 4 + MM, `frame ${f}: the head never in the floor above`);
    assert.ok(Math.abs(lift.matrix[13] - poseY(lift, 0)) < 1e-5, `frame ${f}: the lift stands at its tween's own pose`);
  }
  assert.equal(lift.state, 'forward', 'held, not ended');
  assert.ok(Math.abs(m.pos[1] + CAPSULE_HEIGHT - 4) < 0.02, `the head at the lip (feet ${m.pos[1]})`);
  assert.ok(lift.t < 0.56 && lift.t > 0.53, `the tween waits where it holds (t ${lift.t})`);
  // the rider steps off the lip's side (into the shaft's middle); the lift goes on and carries it through
  for (let f = 0; f < 30; f++) frame(m, actions, go({ forward: 1 }), -Math.PI / 2);
  for (let f = 0; f < 200; f++) frame(m, actions);
  assert.equal(lift.state, 'end');
  assert.equal(lift.matrix[13], 4);
  assert.equal(m.groundKey, lift.key, 'on the lift at the top');
  assert.ok(Math.abs(m.pos[1] - 4) <= 0.02, `feet ${m.pos[1]} on the lift's top`);
});

/** The lowering report's rig: a 4x4 slab, 0.5 thick, lowering 3 m onto a dungeon floor (NegativeY, axis 15) - or a
 *  thin floor of one face, and a fast one (a Translation down its 120 units in 4 ticks). */
const SLOW = { flags: ACTION_FLAGS.NegativeY, axis: 15 };
const FAST = { flags: ACTION_FLAGS.Translation, axis: 3, magnitude: 120, duration: 4 };
function slabRig({ thin = false, fast = false } = {}) {
  const col = new Collider(() => -Infinity);
  const floor = mesh([[-6, -0.25, -6], [6, 0, 6]]);
  col.addMesh('dungeon', floor.positions, floor.indices, I);
  const actions = new ActionSystem(col);
  const slab = addMover(actions, thin ? plane(2) : mesh([[-2, 0, -2], [2, 0.5, 2]]), { ...(fast ? FAST : SLOW), at: [0, 3, 0] });
  assert.deepEqual([slab.duration, slab.translation.y], [fast ? 0.2 : 2.5, -3], 'the producer\'s slab: down 3 m');
  return { col, actions, slab };
}

test('MOVER-BODY the lowering report: a slab lowering onto a swimmer never drives the swimmer through the floor - it holds over the swimmer\'s head, and settles on the floor once the swimmer swims clear; a walker under it is held the same, never popped up on top', () => {
  {
    const { actions, slab, col } = slabRig();
    const m = swimmer(col, [0, 0.6, 0]);
    actions.activate(slab.key);
    for (let f = 0; f < 200; f++) { m.update(FIXED_DT, STILL, 0); actions.update(FIXED_DT); }
    assert.ok(m.pos[1] < -0.3, `the code before: the swimmer under the floor (feet ${m.pos[1].toFixed(2)})`);
  }
  for (const swims of [true, false]) {
    const { actions, slab, col } = slabRig();
    const m = swims ? swimmer(col, [0, 0.6, 0]) : body(col, [0, 0.05, 0]);
    assert.equal(m.height, swims ? CROUCH_HEIGHT : CAPSULE_HEIGHT, swims ? 'the swimmer is force-crouched' : 'the walker stands');
    actions.activate(slab.key);
    for (let f = 0; f < 200; f++) {
      frame(m, actions);
      assert.ok(m.pos[1] >= -MM, `frame ${f}: feet ${m.pos[1]} never through the floor`);
      assert.ok(slab.matrix[13] >= m.pos[1] + m.height - MM, `frame ${f}: the slab ${slab.matrix[13]} never in the body`);
      assert.ok(Math.abs(slab.matrix[13] - poseY(slab, 3)) < 1e-5, `frame ${f}: the slab stands at its tween's own pose`);
    }
    assert.equal(slab.state, 'forward', 'held');
    assert.ok(Math.abs(slab.matrix[13] - m.height) < 0.03 && Math.abs(m.pos[1]) < 0.01, `${swims ? 'swimmer' : 'walker'}: held over the head (${slab.matrix[13]}), the feet on the floor (${m.pos[1]})`);
    for (let f = 0; f < 240; f++) {
      frame(m, actions, go({ forward: 1 }));
      assert.ok(m.pos[1] > -MM - 1e-9 || m.pos[2] > 6, 'never through the floor on the way out');
    }
    assert.equal(slab.state, 'end', 'clear of it, the slab settles');
    assert.equal(slab.matrix[13], 0);
  }
});

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('MOVER-BODY the carry: a rider goes with the mover by the step itself - up, down, aside, in a starved frame, in either host\'s order, and down onto a floor flush with the plate (a bare Move: never snapped to the floor under the plate) - grounded on it at every frame', () => {
  const cases = [
    ['up', { flags: ACTION_FLAGS.PositiveY, axis: 20 }, 1, FIXED_DT, 'motorFirst'],
    ['down', { flags: ACTION_FLAGS.NegativeY, axis: 20 }, 1, FIXED_DT, 'motorFirst'],
    ['aside', { flags: ACTION_FLAGS.PositiveX, axis: 15 }, 0, FIXED_DT, 'motorFirst'],
    ['down, starved frames', { flags: ACTION_FLAGS.NegativeY, axis: 20 }, 1, 0.1, 'motorFirst'],
    ['up, the standalone dungeon\'s order', { flags: ACTION_FLAGS.PositiveY, axis: 20 }, 1, FIXED_DT, 'moversFirst'],
  ];
  for (const [name, rec, axisOf, dt, order] of cases) {
    const col = new Collider(() => -Infinity);
    const ground = mesh([[-20, -10.5, -20], [20, -10, 20]]);
    col.addMesh('dungeon', ground.positions, ground.indices, I);
    const actions = new ActionSystem(col);
    const lift = addMover(actions, mesh([[-1, -0.5, -1], [1, 0, 1]]), rec);
    const m = body(col, [0, 0.05, 0]);
    actions.activate(lift.key);
    const steps = Math.round(dt / FIXED_DT);
    for (let f = 0; f * dt < 3; f++) {
      if (order === 'moversFirst') actions.update(dt, m);
      for (let s = 0; s < steps; s++) m.update(FIXED_DT, STILL, 0);
      if (order === 'motorFirst') actions.update(dt, m);
      assert.ok(Math.abs(m.pos[axisOf] - lift.matrix[12 + axisOf]) < 1e-5 && Math.abs(m.pos[1] - lift.matrix[13]) < 1e-5, `${name}, frame ${f}: carried with the lift (${m.pos[axisOf]} at ${lift.matrix[12 + axisOf]})`);
      assert.equal(m.grounded, true, `${name}, frame ${f}: on it`);
    }
    assert.equal(lift.state, 'end', name);
  }
  // a plate hovering 0.4 over the floor comes down flush onto it: a snap to the floor under it took the rider off the plate
  // and the plate, finding the rider in its way, held for ever
  const col = new Collider(() => -Infinity);
  const floor = mesh([[-6, -0.5, -6], [6, 0, 6]]);
  col.addMesh('dungeon', floor.positions, floor.indices, I);
  const actions = new ActionSystem(col);
  const plate = addMover(actions, mesh([[-1, -0.05, -1], [1, 0, 1]]), { flags: ACTION_FLAGS.Translation, axis: 3, magnitude: 16, duration: 40, at: [0, 0.45, 0] });
  assert.deepEqual([plate.duration, plate.translation.y], [2, -0.4]);
  const m = body(col, [0, 0.5, 0]);
  assert.equal(m.groundKey, plate.key);
  actions.activate(plate.key);
  for (let f = 0; f < 150; f++) {
    frame(m, actions);
    assert.ok(Math.abs(m.pos[1] - plate.matrix[13]) < 1e-5, `frame ${f}: on the plate`);
  }
  assert.equal(plate.state, 'end');
  assert.ok(Math.abs(m.pos[1] - 0.05) < 1e-5);
});

test('MOVER-BODY the stance: the carry sweeps the body the motor has - a crouched rider rides higher under a low ceiling than a standing one before its lift holds', () => {
  const heldAt = (crouch) => {
    const col = new Collider(() => -Infinity);
    const ground = mesh([[-6, -1.1, -6], [6, -0.6, 6]]);
    col.addMesh('dungeon', ground.positions, ground.indices, I);
    const roof = mesh([[-6, 2.5, -6], [6, 3, 6]]);
    col.addMesh('roof', roof.positions, roof.indices, I);
    const actions = new ActionSystem(col);
    const lift = addMover(actions, mesh([[-1, -0.5, -1], [1, 0, 1]]), { flags: ACTION_FLAGS.PositiveY, axis: 20 });
    const m = new PlayerMotor(col);
    m.spawn(0, 0.05, 0);
    m.crouching = crouch;
    for (let f = 0; f < 30; f++) m.update(FIXED_DT, STILL, 0);
    actions.activate(lift.key);
    for (let f = 0; f < 200; f++) frame(m, actions);
    assert.equal(lift.state, 'forward', 'held under the roof');
    return [m.pos[1], m.height];
  };
  const [stand, h1] = heldAt(false), [crouched, h2] = heldAt(true);
  assert.deepEqual([h1, h2], [CAPSULE_HEIGHT, CROUCH_HEIGHT]);
  assert.ok(Math.abs(stand + CAPSULE_HEIGHT - 2.5) < 0.03, `standing: the head at the roof (feet ${stand})`);
  assert.ok(Math.abs(crouched + CROUCH_HEIGHT - 2.5) < 0.03, `crouched: the head at the roof (feet ${crouched})`);
});

test('MOVER-BODY the meet\'s edges: a body the mover already pressed where it stood (a load or a snap stood it there) does not hold it; a rider resting in the skin over a slow lift is carried by its step; aside into a wall, the mover holds', () => {
  // a body inside the lift and the roof alike - the stuck state itself: the lift is not held on its account
  {
    const col = new Collider(() => -Infinity);
    const roof = mesh([[-6, 1.4, -6], [6, 2, 6]]);
    col.addMesh('roof', roof.positions, roof.indices, I);
    const actions = new ActionSystem(col);
    const lift = addMover(actions, mesh([[-1, -0.5, -1], [1, 0, 1]]), { flags: ACTION_FLAGS.PositiveY, axis: 20 });
    const m = new PlayerMotor(col);
    m.spawn(0, -0.2, 0);
    actions.activate(lift.key);
    for (let f = 0; f < 200; f++) actions.update(FIXED_DT, m);
    assert.equal(lift.state, 'end', 'it plays to its end');
  }
  // a rider a hair over its slow lift (within the skin the motor grounds it in) is the lift's to carry, however small the step
  {
    const col = new Collider(() => -Infinity);
    const actions = new ActionSystem(col);
    const lift = addMover(actions, mesh([[-1, -0.5, -1], [1, 0, 1]]), { flags: ACTION_FLAGS.Translation, axis: 4, magnitude: 4, duration: 2000 });
    assert.deepEqual([lift.duration, lift.translation.y], [100, 0.1], 'ten centimetres in a hundred seconds');
    const m = body(col, [0, 0.05, 0]);
    assert.equal(m.groundKey, lift.key);
    m.pos[1] += 0.01;
    actions.activate(lift.key);
    const y = m.pos[1];
    actions.update(1, m);
    assert.ok(Math.abs(m.pos[1] - y - 0.001) < 1e-9, `carried by its 1 mm step (${m.pos[1] - y})`);
  }
  // a wall moving aside into a body standing against a pillar: the body is pushed until the pillar stops it, then the wall holds
  {
    const col = new Collider(() => -Infinity);
    const floor = mesh([[-6, -0.5, -6], [6, 0, 6]]);
    col.addMesh('dungeon', floor.positions, floor.indices, I);
    const pillar = mesh([[2, 0, -1], [2.5, 3, 1]]);
    col.addMesh('pillar', pillar.positions, pillar.indices, I);
    const actions = new ActionSystem(col);
    const wall = addMover(actions, mesh([[-0.25, 0.1, -1], [0, 2.5, 1]]), { flags: ACTION_FLAGS.NegativeX, axis: 20, at: [-1, 0, 0] });   // NegativeX: +x (GetTranslationActionVector's sign flip)
    assert.equal(wall.translation.x, 4);
    const m = body(col, [0.5, 0.05, 0]);
    actions.activate(wall.key);
    for (let f = 0; f < 200; f++) {
      frame(m, actions);
      assert.ok(m.pos[0] - 0.35 >= wall.matrix[12] - MM, `frame ${f}: the wall never in the body`);
      assert.ok(m.pos[0] + 0.35 <= 2 + MM, `frame ${f}: the body never in the pillar`);
    }
    assert.equal(wall.state, 'forward', 'held');
    assert.ok(Math.abs(m.pos[0] - 1.65) < 0.01 && Math.abs(wall.matrix[12] - 1.3) < 0.03, `pinned against the pillar (body ${m.pos[0]}, wall ${wall.matrix[12]})`);
  }
});

test('MOVER-BODY the steps: a thin floor dropping 1.5 m in a starved frame onto a swimmer is met in MOVER_STEP pieces and never crosses it; a body nowhere near costs a fast mover no more than its own stand', () => {
  {
    const { actions, slab, col } = slabRig({ thin: true, fast: true });   // 3 m in 0.2 s: 1.5 m a 0.1 s frame
    const m = swimmer(col, [0, 0.6, 0]);
    actions.activate(slab.key);
    for (let f = 0; f < 20; f++) {
      frame(m, actions, STILL, 0, 0.1);
      assert.ok(slab.matrix[13] >= m.pos[1] + m.height - MM, `frame ${f}: the plane ${slab.matrix[13]} never crosses the body`);
      assert.ok(Math.abs(slab.matrix[13] - poseY(slab, 3)) < 1e-5, `frame ${f}: at its tween's own pose`);
    }
    assert.equal(slab.state, 'forward');
    assert.ok(slab.matrix[13] - (m.pos[1] + m.height) < 1.5 / 9 + MM, 'held within one piece over the head (1.5 m in nine)');
  }
  // the pieces: one per MOVER_STEP (half the capsule's radius, 0.175 m) of the mover's motion at a body it may meet - 1.5 m
  // in nine; none for a body nowhere near
  const col = new Collider(() => -Infinity);
  const actions = new ActionSystem(col);
  const slab = addMover(actions, plane(2), { ...FAST, at: [0, 3, 0] });
  const m0 = slab.matrix, m1 = trs(0, 1.5, 0, 0, 0, 0);
  col.removeBucket(slab.key); col.addMesh(slab.key, slab.cpu.positions, slab.cpu.indices, m1);
  const under = { pos: [0, 0, 0], height: CROUCH_HEIGHT, groundKey: null };
  assert.equal(moverSteps(col, slab.key, m0, m1, under), 9);
  assert.equal(moverSteps(col, slab.key, m0, m1, { ...under, pos: [9, 0, 0] }), 0, 'nowhere near');
  let stands = 0;
  const add = col.addMesh.bind(col);
  col.addMesh = (key, ...rest) => { if (key === slab.key) stands++; return add(key, ...rest); };
  const far = new PlayerMotor(col);
  far.spawn(9, 0, 0);
  actions.activate(slab.key);
  actions.update(0.1, far);
  assert.equal(stands, 1, 'one stand of its bucket, as with no body at all');
});

test('MOVER-BODY the press is a millimetre', () => assert.equal(MOVER_PRESS, MM));

test('MOVER-BODY carriedBy: the mover\'s own frame carries the point - a slide\'s own delta anywhere, a turn\'s sweep about its pivot', () => {
  assert.deepEqual(carriedBy(trs(1, 2, 3, 0, 0, 0), trs(1.5, 1, 3, 0, 0, 0), [7, -4, 9]), [0.5, -1, 0]);
  const d = carriedBy(I, trs(0, 0, 0, 0, 90, 0), [1, 0.5, 0]);   // a quarter turn about y, a point a metre out: (1, 0) to (0, -1)
  assert.deepEqual(d.map((v) => Math.round(v * 1e6) / 1e6), [-1, 0, -1]);
  const off = carriedBy(trs(2, 0, 0, 0, 0, 0), trs(2, 0, 0, 0, 90, 0), [3, 0, 0]);   // the same turn about a pivot that stands at x = 2
  assert.deepEqual(off.map((v) => Math.round(v * 1e6) / 1e6), [-1, 0, -1]);
});

test('MOVER-BODY the wiring: the action system meets the body as each mover steps, and every host that walks a body among movers hands it over - the ride beside them is gone', () => {
  const A = rd('src/world/actionSystem.js');
  assert.match(A, /if \(o\.kind === 'action'\) this\._standMover\(o, t0, m0, body\);/);
  assert.match(rd('src/scenes/worldModes.js'), /if \(!overlayHeld\) dungeonCtx\.actions\.update\(dt, player\);/);
  assert.match(rd('src/scenes/worldModes.js'), /if \(!overlayHeld\) interiorCtx\.actions\.update\(dt, player\);/);
  assert.match(rd('src/scenes/dungeon.js'), /if \(!overlayHeld\) ctx\.actions\.update\(dt, walkMode \? player : null\);/);
  for (const f of ['src/scenes/shared.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) assert.equal(/ridePlatform|frameDelta/.test(rd(f)), false, `${f}: no second ride`);
  assert.equal(/frameDelta/.test(A), false, 'and no delta kept for one');
});

// ── VOID-DUNGEON ────────────────────────────────────────────────────────────────────────────────────────────────

test('VOID-DUNGEON the law: the dungeon\'s record is made the first time it is asked and kept - where the dungeon stands a body it places, INTERIOR_VOID_DROP under the lowest triangle it has; none with no spot or no triangle, and none in a realm that casts its own void back (its spot never asked)', () => {
  const col = new Collider(() => -Infinity);
  const floor = mesh([[-6, -2.25, -6], [6, -2, 6]]);
  col.addMesh('dungeon', floor.positions, floor.indices, I);
  let asked = 0;
  const spot = [1, -2, 1];
  const rescue = dungeonVoidRescue(col, () => { asked++; return spot; });
  assert.equal(asked, 0, 'not made at the build');
  const deep = mesh([[-6, -9.25, -6], [6, -9, 6]]);
  col.addMesh('court', deep.positions, deep.indices, I);   // a floor a host stands into the dungeon after its build
  assert.deepEqual(rescue(), { at: spot, belowY: -9.25 - INTERIOR_VOID_DROP });
  assert.equal(rescue(), rescue(), 'kept');
  assert.equal(asked, 1, 'its spot asked once');
  let realm = 0;
  assert.equal(dungeonVoidRescue(col, () => { realm++; return spot; }, true)(), null, 'a realm with a void of its own');
  assert.equal(realm, 0);
  assert.equal(dungeonVoidRescue(col, () => null)(), null, 'no spot');
  assert.equal(dungeonVoidRescue(new Collider(() => -Infinity), () => spot)(), null, 'no triangle');
});

test('VOID-DUNGEON the context: its record\'s spot is the start marker\'s landing, by the way in, else the enter marker\'s, and a realm of the Hour, an Elite Breach or a sky-ketch keeps none', () => {
  const DC = rd('src/scenes/dungeonContext.js');
  const m = /\n {4}voidRescue: (dungeonVoidRescue\(collider, [^\n]*\)),\n/.exec(DC);
  assert.ok(m, 'the context keeps the record');
  const entry = new Function('dungeonVoidRescue', 'collider', 'api', '_sdRealm', '_egHall', '_ketch', `return ${m[1]};`);   // eslint-disable-line no-new-func
  const col = new Collider(() => -Infinity);
  const floor = mesh([[-6, -0.25, -6], [6, 0, 6]]);
  col.addMesh('dungeon', floor.positions, floor.indices, I);
  const api = (start, enter) => ({ startSpawn: ({ preferEnterMarker = true } = {}) => (preferEnterMarker ? enter ?? start : start) });
  assert.deepEqual(entry(dungeonVoidRescue, col, api([1, 0, 1], [5, 0, 5]), false, false)().at, [1, 0, 1], 'the start marker\'s, though an enter marker stands');
  assert.deepEqual(entry(dungeonVoidRescue, col, api(null, [5, 0, 5]), false, false)().at, [5, 0, 5], 'else the enter marker\'s');
  assert.equal(entry(dungeonVoidRescue, col, api(null, null), false, false)(), null);
  assert.equal(entry(dungeonVoidRescue, col, api([1, 0, 1], null), true, false)(), null, 'the Hour casts its own void back');
  assert.equal(entry(dungeonVoidRescue, col, api([1, 0, 1], null), false, true)(), null, 'an Elite Breach casts its own void back');
  assert.equal(entry(dungeonVoidRescue, col, api([1, 0, 1], null), false, false, true)(), null, 'PIN MOVED (KETCH): a sky-ketch casts its own void back - her nets');
});

test('VOID-DUNGEON the hosts: a body below everything the dungeon stands on - the lowering report\'s swimmer, swum on down out of the map - is stood again at the way in, its fall cleared, and told in the player\'s language; above that depth it is left alone (both dungeon hosts\' own frame lines, run)', () => {
  const WM = rd('src/scenes/worldModes.js');
  const drain = '      if (pendingDungeonExit) { pendingDungeonExit = false; if (aliveUnder()) { exitDungeonNow(); return true; } } else ';
  const at = WM.indexOf(drain);
  assert.ok(at > 0 && WM.indexOf('if (!overlayHeld) dungeonCtx.actions.update(dt, player);', at) - at < 1500, 'the dungeon arm\'s drain, before its movers');
  const wmLine = WM.slice(at + drain.length, WM.indexOf(';', WM.indexOf('dungeonCtx.hudSay(dungeonVoidText())', at)) + 1);
  assert.equal(wmLine, 'if (standFromVoid(dungeonCtx.voidRescue(), player)) dungeonCtx.hudSay(dungeonVoidText());');
  const DS = rd('src/scenes/dungeon.js');
  const block = DS.indexOf('    if (walkMode && !overlayHeld) {');
  const dsAt = DS.indexOf('if (standFromVoid(ctx.voidRescue(), player)) ctx.hudSay?.(dungeonVoidText());', block);
  assert.ok(block > 0 && dsAt > block && DS.indexOf('player.update(dt, paralyzed ?', block) > dsAt, 'the standalone dungeon\'s, where the motor walks');
  const dsLine = 'if (standFromVoid(ctx.voidRescue(), player)) ctx.hudSay?.(dungeonVoidText());';
  const hosts = [
    ['worldModes', new Function('dungeonCtx', 'player', 'standFromVoid', 'dungeonVoidText', wmLine)],   // eslint-disable-line no-new-func
    ['dungeon.js', new Function('ctx', 'player', 'standFromVoid', 'dungeonVoidText', dsLine)],   // eslint-disable-line no-new-func
  ];
  for (const [name, run] of hosts) {
    const { actions, slab, col } = slabRig();
    const said = [];
    const ctx = { voidRescue: dungeonVoidRescue(col, () => [4, 0, 4]), hudSay: (l) => said.push(l) };
    const m = swimmer(col, [0, 0.6, 0]);
    actions.activate(slab.key);
    for (let f = 0; f < 200; f++) { m.update(FIXED_DT, STILL, 0); actions.update(FIXED_DT); }   // the code before MOVER-BODY drove it under the floor
    const depth = ctx.voidRescue().belowY;
    assert.equal(depth, -0.25 - INTERIOR_VOID_DROP);
    for (let f = 0; f < 2000; f++) {
      m.update(FIXED_DT, go({ down: true }), 0);
      if (m.pos[1] < depth) break;
      const was = [...m.pos];
      run(ctx, m, standFromVoid, dungeonVoidText);
      assert.deepEqual([[...m.pos], said], [was, []], `${name}: above the depth, left alone`);
    }
    assert.ok(m.pos[1] < depth, `${name}: it swam on down out of the dungeon`);
    Object.assign(m, { falling: true, fallStart: 3, velY: -20 });
    run(ctx, m, standFromVoid, dungeonVoidText);
    assert.deepEqual([...m.pos], [4, 0, 4], `${name}: stood at the way in`);
    assert.equal(m.falling, false);
    assert.equal(m.velY, 0);
    assert.deepEqual(said, [DUNGEON_VOID_TEXT], `${name}: and told`);
    assert.equal(dungeonVoidText(), DUNGEON_VOID_TEXT);
  }
});
