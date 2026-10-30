// DETOUR-RETRY: a foe boxed in on every side ran FindDetour's whole sweep (up to ten ~55-ray probes) every step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI, DETOUR_RETRY } from '../../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../../src/player/collider.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const zWall = (z) => new Float32Array([-40, 0, z, 40, 0, z, 40, 4, z, -40, 4, z]);
const xWall = (x) => new Float32Array([x, 0, -40, x, 0, 40, x, 4, 40, x, 4, -40]);

/** A floor, and optionally four walls 0.3 out from the origin: no way out. */
function world(boxed) {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quad, I);
  if (boxed) {
    c.addMesh('n', zWall(0.3), quad, I); c.addMesh('s', zWall(-0.3), quad, I);
    c.addMesh('e', xWall(0.3), quad, I); c.addMesh('w', xWall(-0.3), quad, I);
  }
  return c;
}
const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });

/** Rays cast and sweeps run over one second of 1/60 frames chasing a target to the north. */
function chase(boxed, always = false) {
  const c = world(boxed);
  let rays = 0;
  const hit = c.raycastHit.bind(c);
  c.raycastHit = (...a) => { rays++; return hit(...a); };
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.3 });
  ai.detected = true; ai.inSight = true;
  let sweeps = 0;
  const find = ai._findDetour.bind(ai);
  ai._findDetour = (d) => { sweeps++; return find(d); };
  if (always) ai._detourIfDue = (d) => ai._findDetour(d);   // the old every-step retry
  for (let i = 0; i < 60; i++) ai.update(1 / 60, [0, 0, 20], senses(), false);
  return { rays, sweeps, ai };
}

test('DETOUR-RETRY: a boxed-in foe sweeps once per DETOUR_RETRY, not every step', () => {
  const old = chase(true, true), now = chase(true);
  assert.ok(old.sweeps > 0, 'the box really blocks it');
  assert.ok(now.sweeps <= Math.ceil(1 / DETOUR_RETRY) + 1, `sweeps in a second: ${now.sweeps}`);
  assert.ok(now.rays * 3 < old.rays, `rays ${old.rays} -> ${now.rays}`);
  for (const r of [old, now]) assert.ok(Math.abs(r.ai.feet[0]) < 0.3 && Math.abs(r.ai.feet[2]) < 0.3, 'and it stays in the box');
});

test('DETOUR-RETRY: a sweep that finds a way out holds nothing back', () => {
  const ai = new EnemyAI(world(false), [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.3 });
  ai._clock = 10;
  ai._findDetour([0, 0, 1]);
  assert.equal(ai._detourRetryAt, 0);
  const boxed = new EnemyAI(world(true), [0, 0, 0], 0, { liveSpeed: 50, rolls: () => 0.3 });
  boxed._clock = 10;
  boxed._findDetour([0, 0, 1]);
  assert.equal(boxed._detourRetryAt, 10 + DETOUR_RETRY);
});
