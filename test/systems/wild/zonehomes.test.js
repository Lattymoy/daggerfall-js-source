// ZONE-HOMES (2026-10-28; bible/11-Multiplayer/Wild-Zone.md section 29), the owner: "Imperial City houses still cannot
// be purchased", then "You made it where you cant buy a house in the ocean or in the open country. Why?". A house is for
// sale online wherever its door stands: the open zone (Cyrodiil, the sea past Veilhaven's peace) refuses none, and an
// isle town's house is for sale as any town's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homePurchasable } from '../../../src/systems/online/onlineHomes.js';
import { etherPlaceId } from '../../../src/world/etherPlaces.js';
import { capitalPlaceId } from '../../../src/world/tamrielCapitals.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';

test('ZONE-HOMES THE ZONE REFUSES NO HOUSE: the buy asks no zone, and the world host keeps no such seam (mutants: the zone\'s refusal back)', () => {
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const modes = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const buy = modes.slice(modes.indexOf('async function buyHomeAt(bd, price) {'), modes.indexOf('// ═══ HOME-RENT'));
  assert.ok(buy.length > 100, 'buyHomeAt found');
  assert.doesNotMatch(buy, /wild/i, 'the house buy asks nothing of the zone');
  assert.doesNotMatch(world, /wildNoHouse/, 'no seam refuses a house');
});

test('ZONE-HOMES AN ISLE TOWN\'S HOUSE IS FOR SALE: the buy law takes an isle town\'s house as an Imperial City slice\'s or any other town\'s (mutants: an isle town refused)', () => {
  const house = (townMapId) => ({ buildingType: BUILDING_TYPES.House1, factionId: 0, buildingKey: 66059, hasInterior: true, townMapId });
  assert.equal(homePurchasable(house(etherPlaceId({ cx: 3, cy: 7 }))), true, 'an isle town\'s');
  assert.equal(homePurchasable(house(capitalPlaceId(0, 12))), true, 'a capital\'s slice\'s');
  assert.equal(homePurchasable(house(undefined)), true, 'a record naming no town');
});
