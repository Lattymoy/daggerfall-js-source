// @ts-check
// WG2 PHASE 3 (bible/03-World/World-2-Arc.md): THE PROTOTYPE SETTLEMENTS the specification names, each on its
// prototype region's ground - an oasis village at Tava Wells, a mining settlement on the Dragontails' ore, a fortified
// town on the high ground, a river trade settlement on the valley's river (all Redguard), and an Argonian stilt village
// in Black Marsh. Seeds and centres are authored; everything else the generator makes from the land.
import MANIFEST from '../worldManifest.json' with { type: 'json' };

/** @type {readonly (import('./settlementGen.js').SettlementSpec & { region: string })[]} */
export const TEST_SETTLEMENTS = Object.freeze([
  { region: 'hammerfell-test', id: 'set-tava-wells', name: 'Tava Wells', type: 'oasisVillage', style: 'redguard', x: 1047.0, y: 452.8, seed: MANIFEST.worldSeed },
  { region: 'hammerfell-test', id: 'set-dragontail-mine', name: 'Hollowstone', type: 'miningTown', style: 'redguard', x: 0, y: 0, seed: MANIFEST.worldSeed, near: 'ore' },
  { region: 'hammerfell-test', id: 'set-sentry-hold', name: 'Sentry Hold', type: 'fortifiedTown', style: 'redguard', x: 0, y: 0, seed: MANIFEST.worldSeed, near: 'defense' },
  { region: 'hammerfell-test', id: 'set-reedford', name: 'Reedford', type: 'riverTown', style: 'redguard', x: 0, y: 0, seed: MANIFEST.worldSeed, near: 'river' },
  { region: 'blackmarsh-test', id: 'set-hist-shallows', name: 'Hist Shallows', type: 'stiltVillage', style: 'argonian', x: 0, y: 0, seed: MANIFEST.worldSeed, near: 'wet' },
]);
