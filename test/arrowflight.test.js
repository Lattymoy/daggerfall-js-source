// C13: the host arrow flight (exterior/interior hosts - visible
// arrows without the dungeon missile system).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrowFlight, arrowMatrix, ARROW_MODEL_ID } from '../src/combat/arrowFlight.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S, MISSILE_COLLIDER_RADIUS } from '../src/systems/spellcast.js';
import { Collider } from '../src/player/collider.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

test('arrowflight: S5 constants ride the single source + the matrix law', () => {
  // The flight is the dungeon missile's shape: same speed, lifespan,
  // sweep radius (spellcast.js), same 99800 model, same oriented trs.
  assert.equal(ARROW_MODEL_ID, 99800);
  assert.equal(MISSILE_SPEED, 25.0);
  assert.equal(MISSILE_LIFESPAN_S, 8);
  assert.equal(MISSILE_COLLIDER_RADIUS, 0.45);
  // Level flight along +z: no pitch, identity-ish yaw
  const m = arrowMatrix([1, 2, 3], [0, 0, 1]);
  assert.equal(m[12], 1); assert.equal(m[13], 2); assert.equal(m[14], 3);
  // Straight down: pitch +90 (asin(-(-1))) - r12 = -sin(rx) = -1 in
  // the column-major trs (m[9]); the dungeon path shares this law.
  const down = arrowMatrix([0, 0, 0], [0, -1, 0]);
  assert.ok(Math.abs(down[9] + 1) < 1e-5, 'nose-down transform');
});

test('arrowflight: flies at missile speed, dies on geometry (a miss is LOST)', () => {
  const c = new Collider(() => -100);
  // A wall at z=5 facing the archer
  c.addMesh('wall', new Float32Array([-5, -5, 5, 5, -5, 5, 5, 5, 5, -5, 5, 5]), quadIdx, I);
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: c });
  a.fire([0, 0, 0], [0, 0, 1]);
  a.update(0.1);   // 2.5 units: still flying
  assert.equal(a.arrows[0].dead, false);
  assert.ok(Math.abs(a.arrows[0].pos[2] - 2.5) < 1e-6);
  a.update(0.1);   // the sweep reaches the wall inside this step
  assert.equal(a.arrows[0].dead, true);
  // Open air: retires on the 8s lifespan instead
  const open = new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => -100) });
  open.fire([0, 50, 0], [0, 0, 1]);
  for (let i = 0; i < 79; i++) open.update(0.1);
  assert.equal(open.arrows[0].dead, false);
  open.update(0.2);
  assert.equal(open.arrows[0].dead, true);
});

test('arrowflight X2: an ENEMY arrow hunts the player mid-capsule; a player arrow never does', () => {
  const open = () => new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => -100) });
  // an enemy arrow flying +z reaches the player at z=5 and fires the
  // impact (the dungeon missile's contact law: 0.45 + the 0.45 body)
  const a = open();
  const hits = [];
  a.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 7 }, weapon: { templateIndex: 119 } });
  for (let i = 0; i < 4; i++) a.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 1, 'the impact fired once');
  assert.equal(hits[0].shooterFoe.id, 7, 'the record carries its shooter');
  assert.equal(a.arrows[0].dead, true, 'the landed arrow retires');
  // the SAME flight without the enemy meta sails through the player
  const p = open();
  p.fire([0, 0.9, 0], [0, 0, 1]);
  const pHits = [];
  for (let i = 0; i < 4; i++) p.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => pHits.push(m) });
  assert.equal(pHits.length, 0, 'player arrows resolve at the fire host, not here');
  assert.equal(p.arrows[0].dead, false);
  // and the bare update(dt) form still flies (the C13 hosts)
  const bare = open();
  bare.fire([0, 50, 0], [0, 0, 1]);
  bare.update(0.1);
  assert.equal(bare.arrows[0].dead, false);
});

test('arrowflight: bare terrain lands it (heightAt floor) + late collider resolve', () => {
  // heightAt = the streaming-world terrain fallback the mesh raycast
  // never sees; an arrow arcing under it has landed.
  const c = new Collider((x) => (x > 10 ? 5 : 0));
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: () => c });   // function form (rebuilding hosts)
  a.fire([0, 1, 0], [Math.SQRT1_2, -0.1, Math.SQRT1_2]);   // shallow dive: -0.042/step, ~24 steps to ground
  for (let i = 0; i < 40 && !a.arrows[0].dead; i++) a.update(1 / 60);
  assert.equal(a.arrows[0].dead, true, 'landed in the ground');
  assert.ok(a.arrows[0].pos[1] <= 0.01);
  // All-dead sweep clears the list
  a.update(1 / 60);
  assert.equal(a.arrows.length, 0);
});
