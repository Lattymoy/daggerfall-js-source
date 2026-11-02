// CSA-E (2026-09-27) - UNITY'S ANIMATOR AS COME SAIL AWAY DRIVES IT (world/unityAnimator.js): the clip's curves
// (constant, streamed Hermite, dense), the binding hash, Quaternion.Euler's order, the two blend trees the mod's
// controllers use, the pose blend, the state machine's clock, its transitions and the script's CrossFade - and, on the
// vendored data, a sail stowed and raised and the rudder's oars rowing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import {
  pathHash, sampleComponent, clipLength, clipTime, quatEuler, blendPoses, weights1D, weights2DDirectional,
  resolveController, createAnimator,
} from '../../../src/world/unityAnimator.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { Boat, spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const ANIMATION = json('animation.json');
const near = (a, b, eps = 1e-5, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} is not ${b}`);
const nearV = (a, b, eps = 1e-5, what = '') => { assert.equal(a.length, b.length); a.forEach((v, i) => near(v, b[i], eps, `${what}[${i}]`)); };

test('CSA-E: a binding is the CRC32 of the transform path from the Animator (the node itself is the empty path)', () => {
  assert.equal(pathHash(''), 0);
  for (const p of ['Bones', 'Bones/Mast', 'Rudder/Oar Left', 'Ça va']) assert.equal(pathHash(p), zlib.crc32(Buffer.from(p, 'utf8')) >>> 0, p);
  // every clip curve of the data names a hash the extractor read as a u32
  for (const c of Object.values(ANIMATION.clips)) for (const cv of c.curves) assert.ok(Number.isInteger(cv.path) && cv.path >= 0 && cv.path <= 0xFFFFFFFF);
});

test('CSA-E: a curve at t - a constant; a streamed segment\'s cubic ((a dt + b) dt + c) dt + d from its own start; dense samples, linear between two', () => {
  assert.equal(sampleComponent({ constant: 1.25 }, 7), 1.25);
  const seg = { streamed: [[-3.4028234663852886e+38, 0, 0, 0, 120], [0, 0, 0, 0, 120], [0.3333333432674408, 2430, -1215, 0, 120], [0.6666666865348816, 0, 0, 0, 75]] };
  assert.equal(sampleComponent(seg, -1), 120, 'the sentinel before the first key');
  assert.equal(sampleComponent(seg, 0.2), 120);
  const dt = Math.fround(Math.fround(0.4333333432674408) - Math.fround(0.3333333432674408));
  const want = Math.fround(Math.fround(Math.fround(Math.fround(Math.fround(Math.fround(2430 * dt) + -1215) * dt) + 0) * dt) + 120);
  assert.equal(sampleComponent(seg, 0.4333333432674408), want);
  near(want, 110.28, 1e-3);
  assert.equal(sampleComponent(seg, 0.9), 75, 'the last segment holds');
  // a linear segment (only c) is evaluated, not taken as flat
  assert.equal(sampleComponent({ streamed: [[0, 0, 0, 2, 5]] }, 0.5), 6);
  // a step: AT a key's time its own segment answers, not the one before
  const step = { streamed: [[0, 0, 0, 0, 1], [0.5, 0, 0, 0, 9]] };
  assert.equal(sampleComponent(step, 0.5), 9);
  assert.equal(sampleComponent(step, 0.4999), 1);
  const dense = { dense: [0, 10, 30] };
  assert.equal(sampleComponent(dense, 0.25, { denseRate: 4, denseBegin: 0 }), 10);
  assert.equal(sampleComponent(dense, 0.375, { denseRate: 4, denseBegin: 0 }), 20);
  assert.equal(sampleComponent(dense, 5, { denseRate: 4, denseBegin: 0 }), 30);
  assert.equal(sampleComponent(dense, -1, { denseRate: 4, denseBegin: 0 }), 0);
});

test('CSA-E: a clip is sampled at start + its normalized time times its length - wrapped when it loops, held at an end when not', () => {
  const loop = { start: 0.5, stop: 1.5, loop: true }, once = { start: 0.5, stop: 1.5, loop: false };
  assert.equal(clipLength(loop), 1);
  assert.equal(clipTime(loop, 0.25), 0.75);
  assert.equal(clipTime(loop, 2.25), 0.75);
  assert.equal(clipTime(once, 2.25), 1.5);
  assert.equal(clipTime(once, -3), 0.5);
});

test('CSA-E: Quaternion.Euler(x, y, z) turns Z, then X, then Y', () => {
  const h = Math.SQRT1_2;
  nearV(quatEuler(0, 90, 0), [0, h, 0, h]);
  nearV(quatEuler(90, 0, 0), [h, 0, 0, h]);
  nearV(quatEuler(0, 0, 90), [0, 0, h, h]);
  // Euler(90, 90, 0) = Y(90) * X(90): (0,h,0,h)*(h,0,0,h)
  nearV(quatEuler(90, 90, 0), [0.5, 0.5, -0.5, 0.5]);
  // Euler(90, 0, 90) = X(90) * Z(90)
  nearV(quatEuler(90, 0, 90), [0.5, -0.5, 0.5, 0.5]);
});

test('CSA-E: Simple 1D - the two neighbours of the parameter, linear between, clamped past the ends', () => {
  assert.deepEqual(weights1D([-1, 0, 1], -3), [1, 0, 0]);
  assert.deepEqual(weights1D([-1, 0, 1], 1), [0, 0, 1]);
  assert.deepEqual(weights1D([-1, 0, 1], 0.25), [0, 0.75, 0.25]);
  assert.deepEqual(weights1D([-1, 0, 1], -0.5), [0.5, 0.5, 0]);
  assert.deepEqual(weights1D([-0.8972972631454468, 1], 0), [1 - 0.8972972631454468 / 1.8972972631454468, 0.8972972631454468 / 1.8972972631454468]);
});

test('CSA-E: Simple Directional 2D - the centre and the two directions bracketing the input, barycentric; outside the triangle the pair alone', () => {
  const pos = [[0, 1], [0, -1], [0, 0], [1, 0], [-1, 0]];   // the rudder's Rowing tree: forward, back, centre, right, left
  assert.deepEqual(weights2DDirectional(pos, 0, 0), [0, 0, 1, 0, 0]);
  assert.deepEqual(weights2DDirectional(pos, 0, 1), [1, 0, 0, 0, 0]);
  assert.deepEqual(weights2DDirectional(pos, 0, -0.5), [0, 0.5, 0.5, 0, 0]);
  assert.deepEqual(weights2DDirectional(pos, 0.25, 0), [0, 0, 0.75, 0.25, 0]);
  const w = weights2DDirectional(pos, 0.5, 0.5);
  nearV(w, [0.5, 0, 0, 0.5, 0]);
  const out = weights2DDirectional(pos, 1, 1);   // past the triangle: normalised over the pair
  nearV(out, [0.5, 0, 0, 0.5, 0]);
  const back = weights2DDirectional(pos, -0.3, -0.3);
  nearV(back, [0, 0.3, 0.4, 0, 0.3]);
  near(weights2DDirectional(pos, -1, 0)[4], 1);
});

test('CSA-E: poses blend by weight - vectors summed, rotations on the first\'s hemisphere and normalised', () => {
  const props = [{ attr: 'position', def: [9, 9, 9] }, { attr: 'rotation', def: [0, 0, 0, 1] }];
  const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const a = [[0, 0, 0], [0, 0, 0, 1]], b = [[2, 4, 6], [-q[0], -q[1], -q[2], -q[3]]];   // b's rotation on the far hemisphere
  const p = blendPoses(props, [a, b], [0.5, 0.5]);
  nearV(p[0], [1, 2, 3]);
  const half = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)];
  nearV(p[1], half, 1e-6, 'the hemisphere flipped, then the half-way nlerp');
  const none = blendPoses(props, [a], [0]);
  assert.deepEqual(none[0], [9, 9, 9], 'no weight: the default');
});

// a two-state controller over a node with one bone: A holds the bone at x=0, B at x=10 (and turns it, which A does not)
function toy({ transitions = [], speedParam = null, bTransitions = [] } = {}) {
  const animation = {
    controllers: {
      Toy: {
        params: [{ name: 'Go', type: 'Bool', default: false }, { name: 'Speed', type: 'Float', default: 2 }],
        layers: [{ name: 'Base Layer', defaultState: 'A', states: [
          { name: 'A', fullPath: 'Base Layer.A', speed: 1, speedParam, motion: [{ type: 0, clip: 'ClipA', children: [] }], transitions },
          { name: 'B', fullPath: 'Base Layer.B', speed: 1, motion: [{ type: 0, clip: 'ClipB', children: [] }], transitions: bTransitions },
        ] }],
      },
    },
    overrides: {},
    clips: {
      ClipA: { start: 0, stop: 1, loop: true, curves: [{ path: pathHash('Bone'), attribute: 'position', components: [{ constant: 0 }, { constant: 1 }, { constant: 0 }] }] },
      ClipB: { start: 0, stop: 2, loop: true, curves: [
        { path: pathHash('Bone'), attribute: 'position', components: [{ constant: 10 }, { constant: 1 }, { constant: 0 }] },
        { path: pathHash('Bone'), attribute: 'euler', components: [{ constant: 0 }, { constant: 90 }, { constant: 0 }] },
      ] },
    },
  };
  const root = new PrefabNode('Root');
  const bone = new PrefabNode('Bone', { position: [5, 5, 5], rotation: [0, 0, 0, 1] }).setParent(root);
  const c = { type: 'Animator', m_Enabled: 1, m_Controller: { controller: 'Toy' } };
  root.addComponent(c);
  return { a: createAnimator(root, c, animation), root, bone };
}

test('CSA-E: the Animator binds what any state animates, enters its default state, and writes defaults for what a state leaves alone', () => {
  const { a, bone } = toy();
  assert.equal(a.props.length, 2, 'the bone\'s position (both clips) and rotation (B\'s euler)');
  a.update(0.1);
  assert.equal(a.stateName, 'A');
  assert.deepEqual(bone.localPosition, [0, 1, 0]);
  assert.deepEqual(bone.localRotation, [0, 0, 0, 1], 'A does not turn it: the default, as bound');
});

test('CSA-E: CrossFade takes the next update - the fade over the normalized duration times the SOURCE\'s length, weights linear, B\'s own clock running', () => {
  const { a, bone } = toy();
  a.update(0.1);
  a.CrossFade('B', 0.5);   // A is one second long: half a second
  assert.equal(a.stateName, 'A', 'asked, not yet taken');
  a.update(0.25);
  assert.equal(a.nextStateName, 'B');
  near(bone.localPosition[0], 5, 1e-5, 'half way at 0.25 of 0.5');
  a.update(0.25);
  assert.equal(a.stateName, 'B');
  assert.equal(a.nextStateName, null);
  nearV(bone.localPosition, [10, 1, 0]);
  nearV(bone.localRotation, [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  // a state already playing is left to play: no fade, no restart
  const t = a.current.time;
  a.CrossFade('B', 0.5);
  a.update(0.1);
  assert.equal(a.nextStateName, null);
  near(a.current.time, t + 0.05, 1e-9, 'B is two seconds long: 0.1 s is 0.05 of it');
  // the full name answers too; an unknown one is ignored
  a.CrossFade('Nope', 1);
  a.update(0.1);
  assert.equal(a.stateName, 'B');
  a.CrossFade('Base Layer.A', 0.25);   // from B (2 s): half a second
  a.update(0.25);
  near(bone.localPosition[0], 5);
});

test('CSA-E: a CrossFade into a running fade freezes the pose it had reached and fades the new state in over it', () => {
  const { a, bone } = toy();
  a.update(0.1);
  a.CrossFade('B', 1);   // one second
  a.update(0.5);
  near(bone.localPosition[0], 5);
  a.CrossFade('A', 1);   // back, from the frozen half-way pose
  a.update(0.5);
  assert.equal(a.nextStateName, 'A');
  near(bone.localPosition[0], 2.5, 1e-5, 'half way from the frozen 5 to A\'s 0');
  a.update(0.5);
  assert.equal(a.stateName, 'A');
  near(bone.localPosition[0], 0);
});

test('CSA-E: a controller transition - every condition and the exit time crossed (below one, on every loop) - over its fixed duration', () => {
  const { a, bone } = toy({ transitions: [{ to: 'B', duration: 0.2, offset: 0, exitTime: 0.75, hasExitTime: true, hasFixedDuration: true, conditions: [{ mode: 'If', param: 'Go', threshold: 0 }] }] });
  a.update(0.5);
  a.SetBool('Go', true);
  assert.equal(a.GetBool('Go'), true);
  a.update(0.2);   // 0.5 -> 0.7: not yet 0.75
  assert.equal(a.nextStateName, null);
  a.update(0.1);   // 0.7 -> 0.8: crossed
  assert.equal(a.nextStateName, 'B');
  a.update(0.1);
  near(bone.localPosition[0], 5);
  a.update(0.1);
  assert.equal(a.stateName, 'B');
  // on the NEXT loop when the condition came late
  const t2 = toy({ transitions: [{ to: 'B', duration: 0.2, offset: 0, exitTime: 0.75, hasExitTime: true, hasFixedDuration: true, conditions: [{ mode: 'If', param: 'Go', threshold: 0 }] }] });
  t2.a.update(0.8);   // past 0.75 with Go false
  t2.a.SetBool('Go', true);
  t2.a.update(0.5);   // 0.8 -> 1.3: no crossing
  assert.equal(t2.a.nextStateName, null);
  t2.a.update(0.5);   // 1.3 -> 1.8: 1.75 crossed
  assert.equal(t2.a.nextStateName, 'B');
  // one long frame from past this loop's exit time to past the next loop's: crossed
  const t3 = toy({ transitions: [{ to: 'B', duration: 0.2, offset: 0, exitTime: 0.75, hasExitTime: true, hasFixedDuration: true, conditions: [] }] });
  t3.a.update(0.8);   // from 0 to 0.8: 0.75 crossed at once - the transition starts
  assert.equal(t3.a.nextStateName, 'B');
  const t4 = toy({ transitions: [{ to: 'B', duration: 0.2, offset: 0, exitTime: 0.75, hasExitTime: true, hasFixedDuration: true, conditions: [{ mode: 'If', param: 'Go', threshold: 0 }] }] });
  t4.a.update(0.8);
  t4.a.SetBool('Go', true);
  t4.a.update(1.0);   // 0.8 -> 1.8 in one frame: the next loop's 1.75 is inside it
  assert.equal(t4.a.nextStateName, 'B');
  // a FIXED duration is seconds whatever the source's length: B is two seconds long, the fade a fifth of one
  const t5 = toy({ bTransitions: [{ to: 'A', duration: 0.2, offset: 0, exitTime: 0, hasExitTime: false, hasFixedDuration: true, conditions: [{ mode: 'If', param: 'Go', threshold: 0 }] }] });
  t5.a.update(0.1);
  t5.a.CrossFade('B', 0.1);
  t5.a.update(0.1);
  assert.equal(t5.a.stateName, 'B');
  t5.a.SetBool('Go', true);
  t5.a.update(0.05);   // the transition starts
  assert.equal(t5.a.nextStateName, 'A');
  t5.a.update(0.2);
  assert.equal(t5.a.stateName, 'A', 'over 0.2 s, not 0.2 of B\'s two');
});

test('CSA-E: a state\'s speed parameter scales its clock; a missing parameter reads false and zero and takes no write', () => {
  const { a } = toy({ speedParam: 'Speed' });
  a.update(0.1);
  near(a.current.time, 0.2, 1e-9);
  a.SetFloat('Speed', 0.5);
  a.update(0.1);
  near(a.current.time, 0.25, 1e-9);
  a.SetBool('Nope', true);
  assert.equal(a.GetBool('Nope'), false);
  assert.equal(a.GetFloat('Nope'), 0);
});

test('CSA-E: disabled it stands still; enabled again it starts over - the default state at 0, the parameters at their defaults', () => {
  const { a, root, bone } = toy();
  a.update(0.1);
  a.CrossFade('B', 0.1);
  a.update(0.1);
  a.SetBool('Go', true);
  assert.equal(a.stateName, 'B');
  root.setActive(false);
  a.update(0.1);
  nearV(bone.localPosition, [10, 1, 0], 1e-6, 'nothing written while off');
  root.setActive(true);
  a.update(0.1);
  assert.equal(a.stateName, 'A');
  assert.equal(a.GetBool('Go'), false);
  assert.deepEqual(bone.localPosition, [0, 1, 0]);
  // a component switched off is off
  a.component.m_Enabled = 0;
  a.CrossFade('B', 0.1);
  a.update(0.1);
  a.component.m_Enabled = 1;
  a.update(0.1);
  assert.equal(a.stateName, 'A', 'a CrossFade asked while off is dropped');
});

test('CSA-E: an override controller is its base with its clips swapped; a reference naming nothing resolves to null', () => {
  const r = resolveController(ANIMATION, 'Large Lateen');
  assert.equal(r.controller, ANIMATION.controllers['Sail Controller']);
  assert.equal(r.clipOf('Sail Unstowed Right'), ANIMATION.clips['Lateen Unstowed GoodTack']);
  assert.equal(r.clipOf('Sail Stowed'), ANIMATION.clips['skiffanimations/Lateen Stowed']);
  assert.equal(resolveController(ANIMATION, 'Door Controller').clipOf('Door Opened'), ANIMATION.clips['Door Opened']);
  assert.equal(resolveController(ANIMATION, 'Nothing'), null);
});

// the vendored boats
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: ANIMATION });
const ctx = { models: MODELS, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: () => [1, 2], modelBounds: () => ({ min: [0, 0, 0], max: [1, 1, 1] }) };

test('CSA-E: on the vendored data every Animator of every hull binds its controller, and every sail enters Stowed', () => {
  for (let hull = 0; hull < 5; hull++) {
    const boat = spawnBoat(new Boat(hull, 0), ctx);
    let n = 0;
    for (const node of boat.GameObject.walk()) {
      const c = node.getComponent('Animator');
      if (!c) continue;
      const a = createAnimator(node, c, ANIMATION);
      assert.ok(a.props.length > 0, `${hull} ${node.name}: ${c.m_Controller.controller} binds something`);
      n++;
    }
    assert.ok(n > 0, `hull ${hull} has Animators`);
    for (const sail of boat.Sails) {
      const c = sail.getComponent('Animator');
      const a = createAnimator(sail, c, ANIMATION);
      a.update(0.02);
      assert.equal(a.stateName, 'Stowed', `${hull} ${sail.name}`);
      assert.equal(a.GetBool('Stowed'), true);
    }
  }
});

test('CSA-E: a sail raised - CrossFade("Unstowed", 2) from Stowed fades over twice Stowed\'s length to the Wind\'s blend, and the bones end where the clip puts them', () => {
  const boat = spawnBoat(new Boat(1, 0), ctx);
  const sail = boat.Sails[0];
  const c = sail.getComponent('Animator');
  const a = createAnimator(sail, c, ANIMATION);
  a.update(0.02);
  const stowed = a.props.map((p) => [...(p.attr === 'position' ? p.node.localPosition : p.attr === 'rotation' ? p.node.localRotation : p.node.localScale)]);
  a.CrossFade('Unstowed', 2);
  a.SetBool('Stowed', false);
  const len = clipLength(resolveController(ANIMATION, c.m_Controller.controller).clipOf('Sail Stowed'));
  const steps = Math.ceil((2 * len) / 0.05) + 2;
  for (let i = 0; i < steps; i++) a.update(0.05);
  assert.equal(a.stateName, 'Unstowed');
  assert.equal(a.nextStateName, null);
  const raised = a.props.map((p) => [...(p.attr === 'position' ? p.node.localPosition : p.attr === 'rotation' ? p.node.localRotation : p.node.localScale)]);
  assert.ok(raised.some((v, i) => v.some((x, k) => Math.abs(x - stowed[i][k]) > 1e-3)), 'the sail moved');
  // Wind 1 is the Right child alone: the pose is that clip's
  const right = resolveController(ANIMATION, c.m_Controller.controller).clipOf('Sail Unstowed Right');
  for (const cv of right.curves) {
    const i = a.props.findIndex((p) => pathHash(p.node.pathFrom(sail)) === cv.path && p.attr === (cv.attribute === 'euler' ? 'rotation' : cv.attribute));
    if (i < 0 || cv.attribute !== 'position') continue;
    nearV(raised[i], cv.components.map((k) => sampleComponent(k, clipTime(right, a.current.time), right)), 1e-5, cv.attribute);
  }
});

test('CSA-E: the rudder rows - CrossFade("Rowing", 1) from Disembarked, RowZ forward is the Forward clip alone, RowSpeed its clock', () => {
  const boat = spawnBoat(new Boat(0, 0), ctx);
  const c = boat.RudderAnimator;
  assert.ok(c, 'the rowboat has a rudder Animator');
  const node = [...boat.GameObject.walk()].find((n) => n.getComponent('Animator') === c);
  const a = createAnimator(node, c, ANIMATION);
  a.update(0.02);
  assert.equal(a.stateName, 'Disembarked');
  a.CrossFade('Rowing', 1);
  for (let i = 0; i < 30; i++) a.update(0.05);
  assert.equal(a.stateName, 'Rowing');
  a.SetFloat('RowZ', 1);
  a.SetFloat('RowSpeed', 2);
  const t0 = a.current.time;
  a.update(0.1);
  const len = clipLength(resolveController(ANIMATION, c.m_Controller.controller).clipOf('clips/Rudder Rowing Forward'));
  near(a.current.time - t0, (0.1 * 2) / len, 1e-6, 'RowSpeed doubles the clock');
  // Sailing true takes the controller's own transition at the exit time, over its quarter second
  a.SetBool('Sailing', true);
  for (let i = 0; i < 40 && a.stateName !== 'Sailing'; i++) a.update(0.05);
  assert.equal(a.stateName, 'Sailing');
});
