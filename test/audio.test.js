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

test('audio: A2 ambient-source data verbatim (torches, animals, action sounds)', async () => {
  const {
    TORCH_ARCHIVE, TORCH_RECORDS, TORCH_MAX_DISTANCE, TORCH_VOLUME,
    ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD, ANIMAL_MAX_DISTANCE, AMBIENT_RANDOM_PLAY_MAX,
  } = await import('../src/systems/soundClips.js');
  // RDBLayout.IsTorchFlat: 210 / {0,1,6,16..20}; 5m linear, 0.7
  assert.equal(TORCH_ARCHIVE, 210);
  assert.deepEqual([...TORCH_RECORDS].sort((a, b) => a - b), [0, 1, 6, 16, 17, 18, 19, 20]);
  assert.equal(TORCH_MAX_DISTANCE, 5);
  assert.equal(TORCH_VOLUME, 0.7);
  assert.equal(SOUND.Burning, 420);
  // GameObjectHelper.AddAnimalAudioSource: 201, record pairs -> clip
  assert.equal(ANIMALS_ARCHIVE, 201);
  assert.equal(ANIMAL_SOUND_BY_RECORD[0], 99);    // horse
  assert.equal(ANIMAL_SOUND_BY_RECORD[1], 99);
  assert.equal(ANIMAL_SOUND_BY_RECORD[3], 103);   // cow
  assert.equal(ANIMAL_SOUND_BY_RECORD[5], 102);   // pig
  assert.equal(ANIMAL_SOUND_BY_RECORD[8], 101);   // cat
  assert.equal(ANIMAL_SOUND_BY_RECORD[10], 100);  // dog
  assert.equal(ANIMAL_SOUND_BY_RECORD[2], undefined);   // gap records stay silent
  assert.ok(Math.abs(ANIMAL_MAX_DISTANCE - 19.2) < 1e-9);   // 768 * GlobalScale
  assert.equal(AMBIENT_RANDOM_PLAY_MAX, 100);     // DFRandom.rand() <= 100 per classic update
});

test('audio: A2 the action Play sound seam - soundIndex > 0 fires from the object', async () => {
  const { ActionSystem } = await import('../src/world/actionSystem.js');
  const { ACTION_FLAGS } = await import('../src/world/rdbLayout.js');
  const c = { addMesh() {}, removeBucket() {}, raycast: () => Infinity };
  const a = new ActionSystem(c);
  const played = [];
  a.onActionSound = (o) => played.push([o.index, o.origin ?? [o.matrix[12], o.matrix[13], o.matrix[14]]]);
  // an effect action with soundIndex 12 speaks from its origin
  const eff = a.addEffect(0, 1, { actionFlag: ACTION_FLAGS.Poison, index: 12, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1 }, [3, 4, 5]);
  a.receive(eff);
  // a mover with soundIndex 3 speaks from its (base) matrix
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]);
  const mover = a.addAction(0, 2, { positions: new Float32Array(3), indices: new Uint32Array(0) }, I, {
    index: 3, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: -1, triggerFlag: 0x02 });
  a.activate(mover.key);
  // index 0 stays silent (DFU: PlaySound && Index > 0)
  const silent = a.addEffect(0, 3, { actionFlag: ACTION_FLAGS.Poison, index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1 }, [0, 0, 0]);
  a.receive(silent);
  assert.deepEqual(played, [[12, [3, 4, 5]], [3, [7, 8, 9]]]);
});
