// FIELD BUGS 2026-10-12b YARD-LINE - "Unable to build in my yard. I am unable to build in about 50% of my yard. It says
// that it belongs to another property no matter what I do." HOME-LINE (FIELD BUGS 2026-10-11b, Mac: "Split at the
// midline") split the ground between two HOUSES' lots down its middle - and drew the line to every building of the town
// pixel: a shop, a temple, a tavern within twelve metres of the house took the half of the yard nearer it, though it holds
// no yard to split with. The midline is now a lot's holder's alone; every building's ground is still never stood on.
// bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yardLot, yardWhyNot, yardLineHolder, YARD_ON_OTHER } from '../../src/scenes/homeYards.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lot = yardLot([0, 0, 0], [-4, 0, -3, 4, 5, 3]);
const SHOP = [[8, -3, 16, 3]];   // a building 4 m east of the house's east wall: the midline at x 6
const CHAIR = [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]];

test('YARD-LINE the midline is drawn to the lots\' holders alone: a building that holds none takes no half of the yard, and its own ground is still never stood on (mutants: the line drawn to every building; the ground unasked)', () => {
  assert.equal(yardWhyNot([7, 0, 0], lot, SHOP, CHAIR, [], SHOP), YARD_ON_OTHER, 'a house\'s side of the line is its');
  assert.equal(yardWhyNot([7, 0, 0], lot, SHOP, CHAIR, [], []), null, 'a shop\'s side of it is the yard\'s (the report)');
  assert.equal(yardWhyNot([7, 0, -3.6], lot, SHOP, CHAIR, [], []), null, 'before its door too');
  assert.equal(yardWhyNot([9, 0, 0], lot, SHOP, CHAIR, [], []), YARD_ON_OTHER, 'its own ground is never the yard\'s');
  assert.equal(yardWhyNot([7.9, 0, 0], lot, SHOP, CHAIR, [], []), YARD_ON_OTHER, 'nor a piece reaching onto it');
  assert.equal(yardWhyNot([7, 0, 0], lot, SHOP, CHAIR), YARD_ON_OTHER, 'unpassed, the line is every building\'s, as HOME-LINE had it');
});

test('YARD-LINE a lot\'s holder is a building that could be a home - Daggerfall\'s houses and the house for sale, never a guild\'s hideout - or one a home\'s record stands for (a guild hall\'s yard); a shop, a temple, a tavern, a building of no record hold none (mutants: the home\'s record unread; a shop held; a house unheld)', () => {
  const T = BUILDING_TYPES;
  for (const t of [T.House1, T.House2, T.House3, T.House4, T.House5, T.House6, T.HouseForSale]) assert.equal(yardLineHolder({ type: t, faction: 0 }, 5), true, `type ${t}`);
  for (const t of [T.Tavern, T.Temple, T.GeneralStore, T.Palace, T.GuildHall]) assert.equal(yardLineHolder({ type: t, faction: 0 }, 5), false, `type ${t}`);
  assert.equal(yardLineHolder({ type: T.House2, faction: 42 }, 5), false, 'a guild\'s hideout is the guild\'s, never a lot');
  assert.equal(yardLineHolder({ type: null }, 5), false, 'a building of no record (the mill\'s subrecord)');
  assert.equal(yardLineHolder({ type: T.GuildHall, faction: 0 }, 5, { hall: 'mages', own: false }), true, 'a hall with a yard of its own');
});

test('YARD-LINE the producer stamps the building\'s record on its frame, and the yard asks the line of its holders alone (mutants: the record unstamped; the lines unpassed)', () => {
  const world = hostText('src/scenes/world.js');
  assert.match(world, /pixelHomeFrames\.set\(homeKey, \{ at, box: \[\.\.\.box\], rects, type: bd\?\.buildingType \?\? null, faction: bd\?\.factionId \?\? 0 \}\)/);
  assert.match(world, /const bd = b\.dfBlock\?\.rmbBlock\?\.fldHeader\?\.buildingDataList\?\.\[placed\.recordIndex\] \?\? null;/);
  const yards = src('src/scenes/homeYards.js');
  assert.match(yards, /yardWhyNot\(piece\.pos, cur\.yard\.lot, cur\.others, foot, cur\.roads, cur\.lines\)/);
  assert.match(yards, /if \(holds\) lines\.push\(g\);/);
  assert.match(yards, /const holds = yardLineHolder\(f, bk, deps\.homes\?\.homeAt\?\.\(y\.mapId, bk\) \?\? null\);/);
});
