// SHAFT-SWEEP (systems/spellcast.js sweptSphereOverlapsCapsule): a player's shaft meets a foe anywhere along its step,
// not only where the step ends - DaggerfallMissile.cs:337-339 casts the sphere over the whole displacement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweptSphereOverlapsCapsule, sphereOverlapsCapsule, missileHitsFoe, missileHitsCapsule, MISSILE_COLLIDER_RADIUS, ARROW_FLIGHT_SPEED } from '../../src/systems/spellcast.js';

const FOE = { ai: { feet: [0, 0, 0], height: 1.8 } };

test('SHAFT-SWEEP: a step that flies through a foe meets it, though neither end does (mutants: the end alone tested; the sweep unwired)', () => {
  const step = ARROW_FLIGHT_SPEED / 15;   // 2.25 m: a shaft at 15 fps
  for (const off of [0, 0.3, 0.6, 0.85]) {
    const a = [off, 1, -step / 2], b = [off, 1, step / 2];
    assert.equal(missileHitsFoe(b, FOE), false, `the end alone misses (offset ${off})`);
    assert.equal(missileHitsFoe(a, FOE), false, `the start alone misses (offset ${off})`);
    assert.equal(missileHitsFoe(b, FOE, a), true, `the whole step meets it (offset ${off})`);
  }
  assert.equal(missileHitsFoe([0.95, 1, 1], FOE, [0.95, 1, -1]), false, 'a step that passes wide misses');
  assert.equal(missileHitsFoe([0, 3.2, 1], FOE, [0, 3.2, -1]), false, 'a step over its head misses');
  assert.equal(missileHitsFoe([0, 2.1, 1], FOE, [0, 2.1, -1]), true, 'one through its crown meets it');
});

test('SHAFT-SWEEP: a step of no length is the point test; a vertical step and a step along the axis read right (mutants: a degenerate case dropped)', () => {
  for (const p of [[0.5, 1, 0], [0.9, 0.2, 0.1], [1.2, 1, 0], [0, 2.8, 0], [0, -0.6, 0]]) {
    assert.equal(sweptSphereOverlapsCapsule(p, p, MISSILE_COLLIDER_RADIUS, FOE.ai.feet, 1.8), sphereOverlapsCapsule(p, MISSILE_COLLIDER_RADIUS, FOE.ai.feet, 1.8), `${p}`);
  }
  assert.equal(sweptSphereOverlapsCapsule([0.5, 5, 0], [0.5, -5, 0], MISSILE_COLLIDER_RADIUS, FOE.ai.feet, 1.8), true, 'a fall through it');
  assert.equal(sweptSphereOverlapsCapsule([1, 5, 0], [1, -5, 0], MISSILE_COLLIDER_RADIUS, FOE.ai.feet, 1.8), false, 'a fall beside it');
  assert.equal(missileHitsCapsule([0, 1, 0.5], [0, 0, 0], 1.8), missileHitsCapsule([0, 1, 0.5], [0, 0, 0], 1.8, undefined, null), 'no start: the point test');
});
