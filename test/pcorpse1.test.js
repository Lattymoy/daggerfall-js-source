// PCORPSE1 (2026-09-23, Discord: "add dead corpses to players that died against mobs, based on the class they play -
// right now they just disappear. The corpse should stay for 1 minute ... and give it the player's death sound
// depending on whether it's a woman or a man").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemotePlayers, corpseTextureFor, peerDeathSound, CORPSE_MS } from '../src/net/remotePlayers.js';
import { validPose, poseChanged } from '../src/net/wire.js';
import { SOUND } from '../src/systems/soundClips.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const base = { x: 1, y: 0, z: 2, yaw: 0, pitch: 0 };

test('PCORPSE1 wire: `dd` rides a death pose, is OMITTED alive (every living pose keeps its bytes), and a death is never a keepalive', () => {
  assert.equal('dd' in validPose(base), false);
  assert.equal(validPose({ ...base, dd: 1 }).dd, 1);
  assert.equal('dd' in validPose({ ...base, dd: 7 }), false, 'only 1 means dead');
  assert.equal(poseChanged(validPose(base), validPose({ ...base, dd: 1 })), true);
});

test('PCORPSE1: the body is the CLASS\'s own corpse row (the Thief\'s with no class), the cry the race\'s own for the gender', () => {
  assert.deepEqual(corpseTextureFor({ class: 'Knight' }), ENEMY_BASICS[145].corpseTexture);
  assert.deepEqual(corpseTextureFor(null), ENEMY_BASICS[138].corpseTexture);
  assert.equal(peerDeathSound({ race: 'Nord', gender: 'female' }), SOUND.NordFemalePain3);
  assert.equal(peerDeathSound({ race: 'Nord', gender: 'male' }), SOUND.NordMalePain3);
  assert.equal(peerDeathSound({ gender: 'female' }), SOUND.BretonFemalePain3, 'no race: a Breton');
});

test('PCORPSE1: a fallen peer lies for exactly a minute, cries once at the distance it fell, and is released after', async () => {
  let t = 0; const heard = []; const made = []; const gone = [];
  const renderer = { createBillboardBatch: (a, r) => { const b = { a, r }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b) };
  const tex = { recordCount: 5, getSize: () => ({ width: 60, height: 20 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const rp = new RemotePlayers({ renderer, now: () => t, deps: { audio: { playOneShot: (c, v) => heard.push([c, v]) }, getTexture: async () => tex, uploadRecordFrame: () => {} } });
  const at = (p) => [p.x, p.y, p.z];
  rp.sync([], at, { eye: [0, 0, 0] });
  rp.addCorpse({ id: 'a', look: { class: 'Mage', race: 'Breton', gender: 'female' } }, { x: 3, y: 0, z: 0 }, 'cell:1');
  rp.addCorpse({ id: 'b', look: { class: 'Warrior', race: 'Redguard', gender: 'male' } }, { x: 30, y: 0, z: 0 }, 'cell:1');
  assert.deepEqual(heard.map(([c]) => c), [SOUND.BretonFemalePain3, SOUND.RedguardMalePain3]);
  assert.equal(heard[0][1], 1, 'beside you: full');
  assert.ok(heard[1][1] > 0 && heard[1][1] < 1, 'across the field: quieter');
  rp.sync([], at); await new Promise((r) => setTimeout(r, 5)); rp.sync([], at);
  assert.equal(rp.batches().length, 2);
  t = CORPSE_MS - 1; rp.sync([], at); assert.equal(rp.batches().length, 2);
  t = CORPSE_MS; rp.sync([], at); assert.equal(rp.batches().length, 0);
  assert.equal(gone.length, 2, 'both released');
  rp.addCorpse({ id: 'c', look: null }, { x: 0, y: 0, z: 0 }, 'dungeon:9');
  rp.keepCorpses((r) => r !== 'dungeon:9');
  rp.sync([], at); await new Promise((r) => setTimeout(r, 5)); rp.sync([], at);
  assert.equal(rp.batches().length, 0, 'a body from a space this scene left is not drawn');
});
