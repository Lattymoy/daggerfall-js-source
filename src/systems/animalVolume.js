// HORSE-VOL, ANIMAL-VOL (2026-10-23, travddm: "add an ability to disable horse neighing", then "Add both animal volume &
// horse volume (since you use horses to travel, but not other animals, so you're around them a lot more)"): two Volume
// rows on the Audio tab, after Monster Volume and Companion Idle Volume (systems/monsterVolume.js), each 0..1 on the uiPrefs shelf.
// - Horse Volume: every horse heard - the mount's neigh and its riding loop (player/mountRig.js), a mounted peer's
//   (net/remotePlayers.js), a town's horse flat (animalAmbience.js) and the team the Wagon Warden lifts (scenes/world.js
//   WARDEN_CLIPS heave).
// - Animal Volume: every other archive-201 animal flat - the dog, the cat, the pig, the cow (animalAmbience.js). A horse
//   flat answers to Horse Volume alone, so one row silences every neigh.
// The master bus still scales both (Sound Volume). The ambience's birds and crickets are neither (systems/ambientEffects.js).
import { shelfVolume } from './monsterVolume.js';   // the one reader of a 0..1 volume on the shelf

/** The Audio tab's Horse Volume, 0..1. */
export const horseVolume = () => shelfVolume('horseVolume');
/** The Audio tab's Animal Volume, 0..1. */
export const animalVolume = () => shelfVolume('animalVolume');
