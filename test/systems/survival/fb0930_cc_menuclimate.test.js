// FIELD BUGS 2026-09-30 (MENU-CLIMATE) - found under the #bug-reports "Climates & Calories Bugs" thread (the Sentinel
// inn of its third item): the tavern's regional menu is keyed by the climate, and MENU_KEY_BY_CLIMATE was written as the
// numbers 224 to 233 while the port's climate indices run 223 (Ocean) to 232 (Haunted Woodlands). Every climate read the
// menu meant for the one before it: the Desert - Sentinel's - served the bay's bananas, the Mountain served the desert's
// camel milk, the Rainforest the north-east's carrot cake, the Ocean nobody's (the default), and a 233 nothing stands on.
// The table is keyed by the CLIMATES enum's own names now.
//
// PIN MOVED (AUDIT C&C I8, 2026-10-12): the climate is the mod's FALLBACK now. Its regionMenuDay keys a tavern by the
// REGION first (test/systems/survival/auditcc_tavern.test.js) and asks the climate only where the region names none, and the climate
// table is the mod's own switch - still by the enum's names: the deserts and the subtropics eat the South's, the
// rainforest and the swamp the SouthEast's (its bananas), the woods and the mountains the North's, and the Ocean, which
// the switch names not, its default, the North's. The report's inn is Sentinel's, the South's by its region and by its
// desert alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MENU_KEY_BY_CLIMATE, menuKeyFor, tavernMenu } from '../../../src/systems/survival/tavernMenu.js';
import { CLIMATES, REGION_NAMES } from '../../../src/formats/mapsFile.js';

/** Every climate the port reads, by its enum name, to the key the mod's fallback gives it. */
const SERVES = Object.freeze({
  Ocean: 'n', Desert: 's', Desert2: 's', Mountain: 'n', Rainforest: 'se', Swamp: 'se', Subtropical: 's',
  MountainWoods: 'n', Woodlands: 'n', HauntedWoodlands: 'n',
});
const food = (m) => m.rows.filter((r) => r.kind === 'food').map((r) => r.name);
const drinks = (m) => m.rows.filter((r) => r.kind === 'drink').map((r) => r.name);

test('MENU-CLIMATE: every climate by its enum name keys the mod\'s own fallback - the deserts and the subtropics the South\'s, the rainforest and the swamp the SouthEast\'s, the woods and the mountains the North\'s, the Ocean the default (mutants: the numbers back one up; the desert eats bananas; the mountain drinks camel milk; the ocean served Balfiera\'s again; the swamp eats Dunmer dishes; the woodlands eat Bruma rabbit; the mountain woods eat bananas; the rainforest eats carrot cake; the subtropics eat Dunmeri horse; the haunted woods eat Bruma rabbit; the Dak\'fron eats bananas)', () => {
  assert.deepEqual(Object.keys(SERVES).sort(), Object.keys(CLIMATES).sort(), 'the pin names every climate the enum has');
  for (const [name, key] of Object.entries(SERVES)) assert.equal(menuKeyFor(CLIMATES[name]), key, `${name} (${CLIMATES[name]}) keys '${key}'`);
  // keyed on the enum's own indices - the nine the mod's switch names, no 233, and the Ocean left to the default
  assert.deepEqual(Object.keys(MENU_KEY_BY_CLIMATE).map(Number).sort((a, b) => a - b), [224, 225, 226, 227, 228, 229, 230, 231, 232]);
  for (const [name, key] of Object.entries(SERVES)) assert.equal(tavernMenu({ climateIndex: CLIMATES[name], hour: 12 }).key, key, `a ${name} tavern in a region the mod names not keys '${key}'`);
});

test('MENU-CLIMATE: the report\'s own inn - a Sentinel tavern at noon serves Hammerfell\'s South (its cantaloupe and camel milk), not the bay\'s bananas, by its region and by its desert alike; the Orcs\' mountain inn serves Bruma rabbit and mead, and a mountain no region names the North\'s (mutants: the numbers back one up; the desert eats bananas; the mountain drinks camel milk; the rainforest eats carrot cake)', () => {
  const sentinel = tavernMenu({ climateIndex: CLIMATES.Desert, regionIndex: REGION_NAMES.indexOf('Sentinel'), quality: 3, hour: 12 });
  assert.equal(sentinel.key, 's');
  assert.deepEqual(food(sentinel), ['Cantaloupe Bread', 'Fishy Stick', 'Roasted Corn']);
  assert.ok(drinks(sentinel).includes('Camel Milk'), 'camel milk');
  assert.ok(!sentinel.rows.some((r) => /Banana/.test(r.name ?? '')), 'no banana in the Alik\'r');
  assert.deepEqual(food(tavernMenu({ climateIndex: CLIMATES.Desert, quality: 3, hour: 12 })), food(sentinel), 'the desert keys the same where no region is known');
  const orcs = tavernMenu({ climateIndex: CLIMATES.Mountain, regionIndex: REGION_NAMES.indexOf('Orsinium Area'), quality: 10, hour: 12 });
  assert.equal(orcs.key, 'o');
  assert.ok(food(orcs).includes('Bruma Jugged Rabbit') && drinks(orcs).includes('Mead'), 'Bruma rabbit and mead');
  const mountain = tavernMenu({ climateIndex: CLIMATES.Mountain, quality: 10, hour: 12 });
  assert.equal(mountain.key, 'n');
  assert.deepEqual(food(mountain), ['Breton Pork Sausage', 'Cheese Pork Schnitzel', 'Hare in Garlic Sauce', 'Highland Rabbit Stew'], 'the North\'s');
  assert.equal(drinks(mountain).some((n) => n === 'Camel Milk' || n === 'Coffee'), false, 'no camel milk on the mountain');
  assert.deepEqual(drinks(tavernMenu({ climateIndex: CLIMATES.Rainforest, quality: 10, hour: 12 })), ['Fruit Juice', 'Coffee', 'Beer', 'Stout', 'Bitter', 'Wine', 'Rum'], 'the rainforest eats the SouthEast\'s and drinks the South\'s (DoDrinks)');
});
