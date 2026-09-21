// EM1 - THE TAB LAW (2026-09-21, Mac: "instead of 3 seperate keybinds,
// adding a tab toggle on the map itself. So if you open it in a dungeon,
// the world map would be not accessible, same for the town map").
//
// Three map windows became one sheet with tabs, and which tabs a place
// offers is asked in four hosts and answered in one module. These pins
// hold the table BY VALUE (the four contexts, exactly what each offers)
// and the DERIVATION (the order of the flag tests - a building inside a
// dungeon is the dungeon's), plus the two properties that keep a fifth
// sheet from being half-added: every context's offer is a subset of
// MAP_SHEETS in strip order, and every sheet is offered somewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_SHEETS, MAP_CONTEXTS, mapContextOf, sheetsFor, defaultSheetFor, sheetAvailable, openOn,
} from '../src/systems/mapTabs.js';

test('EM1: the table by value - inside is inside, a town has streets and a bay, the wilderness has the bay', () => {
  assert.deepEqual([...sheetsFor('dungeon')], ['automap'], 'a crypt offers its own plan and nothing else');
  assert.deepEqual([...sheetsFor('building')], ['automap'], 'a shop is inside too');
  assert.deepEqual([...sheetsFor('town')], ['town', 'world']);
  assert.deepEqual([...sheetsFor('wilderness')], ['world']);
  // the tab the map opens on is the first its place offers
  assert.equal(defaultSheetFor('dungeon'), 'automap');
  assert.equal(defaultSheetFor('building'), 'automap');
  assert.equal(defaultSheetFor('town'), 'town');
  assert.equal(defaultSheetFor('wilderness'), 'world');
  // Mac's sentence, as an assertion: no world map from a dungeon, no town map either
  assert.equal(sheetAvailable('dungeon', 'world'), false);
  assert.equal(sheetAvailable('dungeon', 'town'), false);
  assert.equal(sheetAvailable('building', 'world'), false);
  assert.equal(sheetAvailable('wilderness', 'town'), false, 'no streets to draw out here');
});

test('EM1: the context is DERIVED off the flags every host already keeps, and the order of the tests is the law', () => {
  assert.equal(mapContextOf({ insideDungeon: true }), 'dungeon');
  assert.equal(mapContextOf({ insideBuilding: true }), 'building');
  assert.equal(mapContextOf({ inLocation: true }), 'town');
  assert.equal(mapContextOf({}), 'wilderness');
  assert.equal(mapContextOf(), 'wilderness', 'no flags at all is the wilderness, not a crash');
  // a room inside a castle is the DUNGEON's - the dungeon test runs first
  assert.equal(mapContextOf({ insideDungeon: true, insideBuilding: true, inLocation: true }), 'dungeon');
  // a shop in a town is the BUILDING's, not the town's
  assert.equal(mapContextOf({ insideBuilding: true, inLocation: true }), 'building');
  // standing in a town that happens to hold a dungeon entrance is the town
  assert.equal(mapContextOf({ inLocation: true, insideDungeon: false, insideBuilding: false }), 'town');
});

test('EM1: the properties that keep a fifth sheet from being half-added', () => {
  // every offer is a SUBSET of MAP_SHEETS, in strip order - so the tab
  // strip can walk MAP_SHEETS and dim what this place does not offer
  const offered = new Set();
  for (const c of MAP_CONTEXTS) {
    const list = sheetsFor(c);
    for (const s of list) {
      assert.ok(MAP_SHEETS.includes(s), `${c} offers ${s}, which is not a sheet`);
      offered.add(s);
    }
    const order = list.map((s) => MAP_SHEETS.indexOf(s));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${c}'s offer is out of strip order`);
    assert.equal(new Set(list).size, list.length, `${c} offers a sheet twice`);
    assert.ok(list.length > 0, `${c} offers no map at all - a map that opens blank is a bug report`);
  }
  // and every sheet is reachable from somewhere
  for (const s of MAP_SHEETS) assert.ok(offered.has(s), `${s} is inked by nothing`);
});

test('EM1: an unknown place still opens the bay rather than nothing', () => {
  assert.deepEqual([...sheetsFor('moon')], ['world'], 'a context nobody wrote down is the wilderness');
  assert.equal(defaultSheetFor(undefined), 'world');
});

test('EM1: openOn honours an ask the place offers and drops one it does not', () => {
  // the TravelMap key asks for the world: granted in a town, dropped in a crypt
  assert.equal(openOn('town', 'world'), 'world');
  assert.equal(openOn('dungeon', 'world'), 'automap', 'the ask is dropped, not obeyed - and never left blank');
  assert.equal(openOn('building', 'town'), 'automap');
  assert.equal(openOn('wilderness', 'automap'), 'world');
  // no ask at all is the default
  assert.equal(openOn('town'), 'town');
  assert.equal(openOn('town', null), 'town');
});
