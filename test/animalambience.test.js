// A4: the shared PlayRandomlyIfPlayerNear animal pass (A2's dungeon
// cadence, now one implementation for dungeon + both exteriors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnimalAmbience } from '../src/systems/animalAmbience.js';
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD, ANIMAL_MAX_DISTANCE, AMBIENT_RANDOM_PLAY_MAX, SOUND } from '../src/systems/soundClips.js';
import { CLASSIC_UPDATE_INTERVAL } from '../src/characters/weaponStates.js';

test('animalAmbience: the verbatim record table + constants (AddAnimalAudioSource)', () => {
  // GameObjectHelper.AddAnimalAudioSource: 0/1 horse, 3/4 cow,
  // 5/6 pig, 7/8 cat, 9/10 dog - record 2 (and 11+) silent.
  assert.equal(ANIMALS_ARCHIVE, 201);
  assert.equal(ANIMAL_SOUND_BY_RECORD[0], SOUND.AnimalHorse);
  assert.equal(ANIMAL_SOUND_BY_RECORD[1], SOUND.AnimalHorse);
  assert.equal(ANIMAL_SOUND_BY_RECORD[3], SOUND.AnimalCow);
  assert.equal(ANIMAL_SOUND_BY_RECORD[5], SOUND.AnimalPig);
  assert.equal(ANIMAL_SOUND_BY_RECORD[7], SOUND.AnimalCat);
  assert.equal(ANIMAL_SOUND_BY_RECORD[9], SOUND.AnimalDog);
  assert.equal(ANIMAL_SOUND_BY_RECORD[2], undefined);
  assert.equal(ANIMAL_MAX_DISTANCE, 768 * 0.025);   // animalSoundMaxDistance
  assert.equal(AMBIENT_RANDOM_PLAY_MAX, 100);       // rand() <= 100
});

test('animalAmbience: 16Hz cadence, the range gate, and the classic roll', () => {
  const played = [];
  const audioApi = { play3d: (sound, pos) => played.push({ sound, pos }) };
  const near = { pos: [0, 0, 5], sound: SOUND.AnimalDog };
  const far = { pos: [0, 0, ANIMAL_MAX_DISTANCE + 1], sound: SOUND.AnimalCow };
  let rolls = [];
  const amb = createAnimalAmbience(audioApi, () => [near, far], () => rolls.shift() ?? 30000);
  // Under one classic tick: nothing rolls, nothing plays
  amb.update(CLASSIC_UPDATE_INTERVAL * 0.9, [0, 0, 0]);
  assert.equal(played.length, 0);
  assert.equal(rolls.length, 0);
  // One tick: the NEAR animal rolls (100 -> plays); the far one never
  // rolls (range gates BEFORE the roll - sequence preservation).
  rolls = [100];
  amb.update(CLASSIC_UPDATE_INTERVAL * 0.2, [0, 0, 0]);   // 0.9 + 0.2 crosses one tick
  assert.equal(played.length, 1);
  assert.equal(played[0].sound, SOUND.AnimalDog);
  assert.equal(rolls.length, 0, 'exactly one roll consumed');
  // A roll above 100 stays silent
  rolls = [101];
  amb.update(CLASSIC_UPDATE_INTERVAL, [0, 0, 0]);
  assert.equal(played.length, 1);
  assert.equal(rolls.length, 0);
});
