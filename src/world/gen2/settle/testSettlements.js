// @ts-check
// WG2 PHASE 3: THE PROTOTYPE SETTLEMENTS the specification names, each on its
// prototype region's ground - an oasis village at Tava Wells, a mining settlement on the Dragontails' ore, a fortified
// town on the high ground, a river trade settlement on the valley's river (all Redguard), and an Argonian stilt village
// in Black Marsh. Seeds, centres and ordinals are authored; everything else the generator makes from the land.
import MANIFEST from '../worldManifest.json' with { type: 'json' };

/** Each with its authored centre - a pixel's middle, so the town stands within one map pixel (one location of the
 *  streamed world) - and its ordinal, the low bits of its map id (buildingRecord.js settlementMapId). The centres were
 *  first found by siteSelect.js for each type and then written here, as a lore town's are. */
/** @type {readonly (import('./settlementGen.js').SettlementSpec & { region: string, ordinal: number })[]} */
export const TEST_SETTLEMENTS = Object.freeze([
  { region: 'hammerfell-test', ordinal: 1, id: 'set-tava-wells', name: 'Tava Wells', type: 'oasisVillage', style: 'redguard', x: 1046.5, y: 452.75, seed: MANIFEST.worldSeed },
  { region: 'hammerfell-test', ordinal: 2, id: 'set-dragontail-mine', name: 'Hollowstone', type: 'miningTown', style: 'redguard', x: 1149.5, y: 414.5, seed: MANIFEST.worldSeed },
  { region: 'hammerfell-test', ordinal: 3, id: 'set-sentry-hold', name: 'Sentry Hold', type: 'fortifiedTown', style: 'redguard', x: 1095.5, y: 420.5, seed: MANIFEST.worldSeed },
  { region: 'hammerfell-test', ordinal: 4, id: 'set-reedford', name: 'Reedford', type: 'riverTown', style: 'redguard', x: 1101.5, y: 408.5, seed: MANIFEST.worldSeed },
  { region: 'blackmarsh-test', ordinal: 5, id: 'set-hist-shallows', name: 'Hist Shallows', type: 'stiltVillage', style: 'argonian', x: 3283.5, y: 1302.5, seed: MANIFEST.worldSeed },
]);
