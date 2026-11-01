// @ts-check
// WG2 PHASE 2: THE PROTOTYPE REGIONS - the spec's Hammerfell test ground (foothills,
// the Dragontail range on the canon's spine, a river valley, a desert basin with its dunes and an oasis) east of the
// Bay, and a wetland in the heart of Black Marsh for low, slow drainage. Each is a spec the bake reads (geology.js
// RegionSpec); the oasis's spring is the region's own authored water. Neither is published: a client walks one only
// behind `?wg2=<id>` (scenes/gen2Host.js), and the manifest's published list stays the owner's to fill.
import MANIFEST from './worldManifest.json' with { type: 'json' };

const base = { seed: MANIFEST.worldSeed, fit: MANIFEST.fit };

/** @type {readonly import('./geology.js').RegionSpec[]} */
export const TEST_REGIONS = Object.freeze([
  Object.freeze({ ...base, id: 'hammerfell-test', rect: { x: 1014, y: 330, w: 192, h: 192 }, res: 2,
    springs: [{ name: 'Tava Wells', x: 1046.5, y: 452.5, flow: 0.12 }], erosion: { steps: 80 } }),
  Object.freeze({ ...base, id: 'blackmarsh-test', rect: { x: 3220, y: 1260, w: 96, h: 96 }, res: 2, springs: [], erosion: { steps: 60 } }),
]);
/** A test region by id, or null. @param {string} id */
export const testRegion = (id) => TEST_REGIONS.find((r) => r.id === id) ?? null;
