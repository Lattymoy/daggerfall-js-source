// FIELD BUGS 2026-10-14 GROG-WORD (Cruor on the Discord: "Crew morale LIES sometimes between fleet window/shipwright and
// the helm! ... You get the low morale slow reload speed as a result which is a shame. Let me give them MORE grog!").
// The yard sells one round a port day (AUDIT CC-D5), and its row wants none once the day's is drunk - the same `missing`
// 0 as a crew at the top, and the window read only that: "Her crew's spirits are as high as they go", "No need", over a
// crew the helm called low (the reload under 50 slower). Read through the yard's own offer and the window's own words.
// bible/01-Overview/bugs/Field-Bugs-2026-10-14.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionOffer } from '../../../src/systems/naval/navalYard.js';
import { yardText } from '../../../src/ui/naval/navalYardWindow.js';
import { spiritsOf } from '../../../src/systems/naval/shipCrew.js';

const ship = { hull: 10, maxHull: 10, sail: 10, maxSail: 10, crew: 8, maxCrew: 8, barrels: 0 };
const grogOf = (morale, grogToday) => {
  const model = { offer: () => ({ rows: [], gold: 1000 }), ship: () => ship, hasBarrels: false,
    provisions: () => provisionOffer({ stores: 99, morale, crew: 8, crewed: true, gold: 1000, grogToday }) };
  return yardText(model).provisions.find((r) => r.id === 'grog');
};

test('GROG-WORD: a crew that has had the day\'s round below the top is told in its own spirits - low is low, the press says Tomorrow - and "as high as they go" is the top\'s alone (mutants: the drunk row read as the top; the word dropped)', () => {
  const low = grogOf(40, true);
  assert.equal(spiritsOf(40).key, 'low', 'the helm\'s word at 40');
  assert.equal(low.state, 'Crew spirits are low, and they\'ve had today\'s round');
  assert.equal(low.press, 'Tomorrow');
  assert.equal(low.can, false, 'still one round a port day');
  const top = grogOf(100, true);
  assert.equal(top.state, 'Crew spirits are as high as they go');
  assert.equal(top.press, 'No need');
  assert.equal(grogOf(100, false).state, 'Crew spirits are as high as they go');
  const wants = grogOf(40, false);
  assert.match(wants.state, /^Crew spirits are low\. A round costs \d/);
  assert.equal(wants.can, true);
});
