// Combat-arc routed row: RDB Hurt/Poison/DrainMagicka action delegates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionSystem, EFFECT_ACTION_FLAGS } from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';

const collider = { addMesh() {}, removeMesh() {}, removeBucket() {} };
const mkAction = (flag, over = {}) => ({
  actionFlag: flag, magnitude: 5, index: 12, axisRaw: 7, isFlat: false,
  duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
  nextObject: -1, ...over,
});

test('effect actions: Hurt21 fires every 20th, verbatim Range math', () => {
  let taken = [];
  const sys = new ActionSystem(collider, {
    damagePlayer: (d) => taken.push(d), playerLevel: () => 3, rolls: () => 0.999,
  });
  const o = sys.addEffect(101, mkAction(ACTION_FLAGS.Hurt21, { magnitude: 5, index: 12 }));
  for (let i = 0; i < 19; i++) sys.receive(o);
  assert.equal(taken.length, 0);                       // count 1..19: gated
  sys.receive(o);                                      // count 20 fires
  // Range(5, 12) exclusive upper -> max roll 11; * level 3 = 33
  assert.deepEqual(taken, [33]);
  for (let i = 0; i < 20; i++) sys.receive(o);
  assert.equal(taken.length, 2);                       // fires again at 40
  // min<=max guard: magnitude 9, index 1 -> a=9, span 0 -> 9 * lvl
  const o2 = sys.addEffect(102, mkAction(ACTION_FLAGS.Hurt21, { magnitude: 9, index: 1 }));
  for (let i = 0; i < 20; i++) sys.receive(o2);
  assert.equal(taken[2], 27);
});

test('effect actions: Hurt22-25 every hit, flat vs axis; Poison verbatim no-op', () => {
  let taken = [];
  const sys = new ActionSystem(collider, { damagePlayer: (d) => taken.push(d), playerLevel: () => 2 });
  const flat = sys.addEffect(1, mkAction(ACTION_FLAGS.Hurt23, { isFlat: true, magnitude: 4 }));
  sys.receive(flat);
  assert.deepEqual(taken, [8]);                        // magnitude * level
  const model = sys.addEffect(2, mkAction(ACTION_FLAGS.Hurt25, { isFlat: false, axisRaw: 6 }));
  sys.receive(model); sys.receive(model);
  assert.deepEqual(taken, [8, 12, 12]);                // axisRaw * level, every activation
  const poison = sys.addEffect(3, mkAction(ACTION_FLAGS.Poison));
  sys.receive(poison);
  assert.equal(taken.length, 3);                       // DFU's own empty delegate
  assert.ok(EFFECT_ACTION_FLAGS.has(ACTION_FLAGS.DrainMagicka));
});

test('effect actions: chains cascade INTO effects (lever -> spike)', () => {
  let taken = [];
  const sys = new ActionSystem(collider, { damagePlayer: (d) => taken.push(d), playerLevel: () => 1 });
  const spike = sys.addEffect(7, mkAction(ACTION_FLAGS.Hurt22, { isFlat: true, magnitude: 10 }));
  // a mover whose nextObject = the spike's position key
  const cpu = { positions: new Float32Array(9), indices: new Uint32Array(3) };
  const lever = sys.addAction(3, cpu, new Float32Array(16), mkAction(ACTION_FLAGS.Translation, { nextObject: 7, duration: 0 }));
  sys.receive(lever);                                  // cascades to the spike FIRST
  assert.deepEqual(taken, [10]);
  assert.equal(spike.activationCount, 1);
});
