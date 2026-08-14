// A1: the audio layer's pure parts - PCM conversion, clip constants
// vs DFU SoundClips.cs, swing/hit selection verbatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pcm8ToFloat32 } from '../src/systems/audio.js';
import { SOUND, swingSoundFor, hitSoundFor } from '../src/systems/soundClips.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('audio: pcm8 -> float32 verbatim (b - 128) / 128', () => {
  const f = pcm8ToFloat32(new Uint8Array([0, 128, 255, 64]));
  assert.equal(f[0], -1);
  assert.equal(f[1], 0);
  assert.ok(Math.abs(f[2] - 127 / 128) < 1e-9);
  assert.equal(f[3], -0.5);
});

test('audio: SoundClips indices verbatim from SoundClips.cs', () => {
  assert.equal(SOUND.DungeonDoorOpen, 25);
  assert.equal(SOUND.DungeonDoorClose, 24);
  assert.equal(SOUND.NormalDoorOpen, 94);
  assert.equal(SOUND.SwingLowPitch, 105);
  assert.equal(SOUND.SwingHighPitch, 106);
  assert.equal(SOUND.SwingMediumPitch, 347);
  assert.equal(SOUND.Hit1, 108);
  assert.equal(SOUND.Hit2, 109);
  assert.equal(SOUND.Parry6, 433);
});

test('audio: GetSwingSound pitch table + PlayHitSound families verbatim', () => {
  assert.equal(swingSoundFor({ name: 'Warhammer' }), SOUND.SwingLowPitch);
  assert.equal(swingSoundFor({ name: 'Dai-Katana' }), SOUND.SwingLowPitch);
  assert.equal(swingSoundFor({ name: 'Longsword' }), SOUND.SwingMediumPitch);
  assert.equal(swingSoundFor({ name: 'Wakazashi' }), SOUND.SwingMediumPitch);   // MEDIUM in the source
  assert.equal(swingSoundFor({ name: 'Dagger' }), SOUND.SwingHighPitch);
  assert.equal(swingSoundFor(null), SOUND.SwingHighPitch);                      // barehanded (SetMelee)
  // weapon: Hit1 + [0,5) - boundaries
  assert.equal(hitSoundFor({ name: 'Dagger' }, seq(0)), 108);
  assert.equal(hitSoundFor({ name: 'Dagger' }, seq(0.999)), 112);
  // barehanded: Hit1 + [2,4)
  assert.equal(hitSoundFor(null, seq(0)), 110);
  assert.equal(hitSoundFor(null, seq(0.999)), 111);
});

test('audio: enemy sound columns restored (rat/imp verbatim rows)', async () => {
  const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
  assert.equal(ENEMY_BASICS['0'].moveSound, 115);     // EnemyRatMove
  assert.equal(ENEMY_BASICS['0'].barkSound, 116);
  assert.equal(ENEMY_BASICS['0'].attackSound, 117);
  assert.equal(ENEMY_BASICS['1'].moveSound, 118);     // EnemyImpMove
  const withSounds = Object.values(ENEMY_BASICS).filter((e) => e.moveSound !== undefined).length;
  assert.equal(withSounds, 61);
});
