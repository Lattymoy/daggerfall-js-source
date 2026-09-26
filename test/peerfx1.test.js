// PEERFX1 (2026-09-26): the others see and hear my weapon blows, and hear me struck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteMyBlow, noteMyHurt, poseFx, isHurtClip, createPeerFxPlayer, _resetPeerFxForTests } from '../src/net/peerFx.js';
import { validPose, poseChanged } from '../src/net/wire.js';

const P = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };

test('PEERFX1 sender: nothing rides until something happened; a blow and a hurt ride the pose and survive the door', () => {
  _resetPeerFxForTests();
  assert.deepEqual(poseFx(), {}, 'a player who never fought sends the bytes it always did');
  noteMyBlow([1, 2, 3], 2, { damage: 5, maxHealth: 20 }, (p) => [p[0] + 100, p[1], p[2]]);
  noteMyHurt();
  const v = validPose({ ...P, ...poseFx() });
  assert.deepEqual([v.hk, v.hp, v.hb, v.hq, v.hu, v.uq], [1, [101, 2, 3], 2, 25, 1, 20]);
  assert.ok(poseChanged(validPose(P), v), 'a blow goes out at once');
  assert.equal(validPose({ ...P, hk: 3, hp: [1e12, 0, 0] }).hk, undefined, 'a point outside the world is nothing');
  assert.ok(isHurtClip(110, 1) && !isHurtClip(110, 1.1) && !isHurtClip(420, 1), 'the ring on me, not on a foe, not the burn');
  _resetPeerFxForTests();
});

test('PEERFX1 receiver: a first-seen count plays nothing, a new blow plays once after its delay, one the owner drew is skipped', () => {
  let t = 0; const blows = []; const hurts = [];
  const flinches = [];
  const fx = createPeerFxPlayer({ now: () => t, toScene: (p) => [p.x, p.y, p.z], play: { blow: (b) => blows.push(b), hurt: (h) => hurts.push(h), flinch: (id) => flinches.push(id) } });
  fx.update('a', { hk: 5, hp: [0, 0, 0], hu: 2 }, [0, 0, 0]);
  t = 1; fx.frame();
  assert.equal(blows.length + hurts.length, 0, 'an old blow is not replayed');
  fx.update('a', { hk: 6, hp: [4, 1, 4], hb: 1, hq: 50, hu: 3, uq: 30 }, [0, 0, 0], 1.8);
  assert.deepEqual(flinches, ['a'], 'PEERFX3: the red flash at once');
  fx.frame(); assert.equal(blows.length + hurts.length, 0, 'both wait for the owner\'s own splash');
  t = 2; fx.frame();
  assert.deepEqual(blows, [{ at: [4, 1, 4], bloodIndex: 1, share: 0.5 }]);
  assert.deepEqual(hurts, [{ at: [0, 0.9, 0], bloodIndex: 0, share: 0.3 }], 'PEERFX2: struck - a blow\'s feedback on their body');
  fx.update('a', { hk: 7, hp: [9, 1, 9] }, [0, 0, 0]);
  t = 2.1; fx.splashed([9.3, 1, 9]);
  t = 2.25; fx.frame();
  assert.equal(blows.length, 1, 'the owner drew that one already');
});
