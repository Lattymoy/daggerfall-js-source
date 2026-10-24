// HORSE-VOL, ANIMAL-VOL (2026-10-23, travddm: "add an ability to disable horse neighing", then "Add both animal volume &
// horse volume (since you use horses to travel, but not other animals, so you're around them a lot more)"): two Volume
// rows on the Audio tab, beside Monster Volume (systems/monsterVolume.js), each 0..1 on the uiPrefs shelf.
// - Horse Volume: every horse heard - the mount's neigh and its riding loop (player/mountRig.js), a mounted peer's
//   (net/remotePlayers.js), a town's horse flat (animalAmbience.js) and the team the Wagon Warden lifts (scenes/world.js
//   WARDEN_CLIPS heave).
// - Animal Volume: every other archive-201 animal flat - the dog, the cat, the pig, the cow (animalAmbience.js). A horse
//   flat answers to Horse Volume alone, so one row silences every neigh.
// The master bus still scales both (Sound Volume). The ambience's birds and crickets are neither (systems/ambientEffects.js).
import { getPref } from './uiPrefs.js';

/** A Volume row's pref, 0..1 (1 when the shelf holds nothing usable). */
function volumePref(key) {
  const v = Number(getPref(key));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** The Audio tab's Horse Volume, 0..1. */
export const horseVolume = () => volumePref('horseVolume');
/** The Audio tab's Animal Volume, 0..1. */
export const animalVolume = () => volumePref('animalVolume');
