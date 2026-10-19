// F-1 D2 (OUTDOOR-LOOT follow-ups, PR A phase 1b, 2026-10-19; test-harness/loot-followups/DESIGN-1b.md): `interiorLootStock`, THE DOOR A
// SHELF'S STOCK IS MINTED THROUGH, held to its own contract - a stock offered to a room that already holds the day's shelf mints
// NOTHING and writes NOTHING: the shelf stays the room's list. (A shelf asks no Yes, so the door is `roll` and `birth` in one call;
// shelfloot.test.js drives it through the host's press, where a fresh shelf is the only case it is called in. What the mutants found
// open there: a door that wrote the roll ahead of the mint left the roll standing as the room's list wherever the mint declined.)
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { interiorLootStock } from '../../src/world/interior/interiorShared.js';
import { REAL_RANDOM, TODAY, mk, names, windowOf, openShelfOf, shelfOf, frame, building, SHOP } from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; setSharedClock(null); delete globalThis.location; });

test('F-1 D2 (interiorLootStock): a stock offered to a room that already holds the day\'s shelf mints nothing and writes nothing - B\'s shelf stays the list A stocked, and no word is said for the roll (mutant: the roll written ahead of the mint)', () => {
  const s = building(3, { each: [0, 1, 2].map(() => ({ shelves: 1, building: { ...SHOP }, shelfRoll: () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')] })) });
  const wa = windowOf(s.A);
  assert.ok(openShelfOf(s.A, wa), 'A\'s press opened the shelf (the stealing window) and stocked it');
  wa.close(); frame(s.A); s.net.flush();
  const room = names(shelfOf(s.B));
  assert.deepEqual(room, ['Dagger', 'Mace', 'Katana', 'Staff'], 'B lists the shelf A stocked (guard)');
  const said = s.net.words(s.B, 'shelf:0').length;
  s.B.as(() => interiorLootStock(s.B.ctx, 'shelf:0', [mk('Longsword'), mk('Flail')], s.B.h.bag(), TODAY));
  s.net.flush();
  assert.deepEqual(names(shelfOf(s.B)), room, 'F-1 D2: the roll offered to a room that holds today\'s shelf is not written - B\'s shelf is still the room\'s list');
  assert.equal(s.net.words(s.B, 'shelf:0').length, said, 'and B said nothing about it');
});
