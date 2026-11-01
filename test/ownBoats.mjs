// OWN-WORK4 (2026-10-31): OUR BOATS' FILES FOR THE SUITES - what the five Come Sail Away files were read off the disk
// as (prefabs.json, meshes.json, meshes.bin, materials.json, animation.json), now built by our own builders
// (src/world/ships/ownBoats/ownBoatFiles.js). Each ask is a copy of its own, so a suite may change what it is given.
import { ownBoatFiles } from '../src/world/ships/ownBoats/ownBoatFiles.js';

const KEY = Object.freeze({
  'prefabs.json': 'prefabs',
  'meshes.json': 'meshes',
  'meshes.bin': 'bin',
  'materials.json': 'materials',
  'animation.json': 'animation',
});
/** One of the five, by the name its file had - a copy. */
export function ownFile(name) {
  const k = KEY[name];
  if (!k) throw new Error(`our boats have no ${name}`);
  return structuredClone(ownBoatFiles()[k]);
}
/** All five, as comeSailAwayModels() takes them - copies. */
export const ownFiles = () => ({
  prefabs: ownFile('prefabs.json'),
  meshes: ownFile('meshes.json'),
  bin: ownFile('meshes.bin'),
  materials: ownFile('materials.json'),
  animation: ownFile('animation.json'),
});
