// @ts-check
// WORLD-AIR (2026-10-24): A TOWN'S TWO BEDS, out of the player's own people (DAGGER.SND AmbientPeople1-10 - the arena's
// voices, systems/arena/arenaSound.js PEOPLE_RECORDS): the MURMUR, their voices layered round the loop (arenaSound.js
// synthBed, its own seed) with its top eased off - a square heard, not a crowd at the ear - and the TAVERN, another crowd
// of them through a door, darker and levelled under it. Nothing of Daggerfall's is shipped: the voices are read off the
// player's archive at run time. A leaf (AUDIT SOUNDSCAPE W4): systems/soundscape/soundWorker.js makes them off the main
// thread, as the main thread does where no worker can be had. Pure.
import { synthBed, lowpassLoop, level, ARENA_SOUND_RATE } from '../arena/arenaSound.js';

export const TOWN_SEED = 0x70a1e;
/** The rate both are made at (the arena's crowd's own). */
export const TOWN_BED_RATE = ARENA_SOUND_RATE;
/** The murmur's samples. @param {Float32Array[]} voices */
export const murmurSamples = (voices) => lowpassLoop(synthBed(voices, { seed: TOWN_SEED }), ARENA_SOUND_RATE, 2400);
/** The tavern's samples. @param {Float32Array[]} voices */
export const tavernSamples = (voices) => level(lowpassLoop(synthBed(voices, { seed: TOWN_SEED + 1 }), ARENA_SOUND_RATE, 1100), 0.06);
