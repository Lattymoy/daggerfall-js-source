// A4: the PlayRandomlyIfPlayerNear animal pass, shared. A2 shipped
// this inline for dungeon RDB animal flats; the exterior RMB blocks
// carry the same archive-201 flats (GameObjectHelper.
// AddAnimalAudioSource on every one, verbatim), so the cadence moves
// here and all three hosts consume one implementation: per CLASSIC
// UPDATE (16 Hz), every source within animalSoundMaxDistance (768
// units = 19.2) rolls the classic DFRandom stream and barks on
// rand() <= 100. Exterior torches stay SILENT - DFU's Burning loop
// is RDBLayout-only (checked; RMBLayout adds no light audio).
//
// sourcesFn returns the CURRENT source list ({pos, sound}) - static
// hosts close over an array; the streaming world rebuilds against
// its floating origin per tick (16 Hz x a handful of animals).

import { rand } from '../formats/dfRandom.js';
import { CLASSIC_UPDATE_INTERVAL } from '../characters/weaponStates.js';
import { ANIMAL_MAX_DISTANCE, AMBIENT_RANDOM_PLAY_MAX } from './soundClips.js';

export function createAnimalAmbience(audioApi, sourcesFn, randFn = rand) {
  let timer = 0;
  return {
    update(dt, eye) {
      timer += dt;
      while (timer >= CLASSIC_UPDATE_INTERVAL) {
        timer -= CLASSIC_UPDATE_INTERVAL;
        for (const a of sourcesFn()) {
          const dx = eye[0] - a.pos[0], dy = eye[1] - a.pos[1], dz = eye[2] - a.pos[2];
          if (dx * dx + dy * dy + dz * dz > ANIMAL_MAX_DISTANCE * ANIMAL_MAX_DISTANCE) continue;
          if (randFn() <= AMBIENT_RANDOM_PLAY_MAX) {
            audioApi.play3d(a.sound, a.pos, 1, { maxDistance: ANIMAL_MAX_DISTANCE });
          }
        }
      }
    },
  };
}
