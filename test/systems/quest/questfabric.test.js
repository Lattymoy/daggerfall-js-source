// QUEST-FABRIC (2026-10-26, the owner, asked whether quests may land in BLD-3's buildings: "Let quests use them";
// bible/06-Systems/Quest-Arc.md QUEST-FABRIC) - A CELL'S BUILDINGS AS A QUEST READS THEM. A quest's site search reads every
// block of a town (systems/quest/place.js townBlockGrid); the Imperial City's own cells are made whole by the scene's door
// (world/capitalModels.js: the cell's fabric, ground, models and lamps, then world/imperialFabricBuildings.js
// withFabricBuildings), some 15 ms a cell, and with the cells read a temple's remote dart over the city stood eighty
// slices of them: 83 s on the freeware's data against 0.25 s with the cells unread. The quest world reads a cell through
// fabricQuestBlock instead: the same records, subrecords and donors' interiors over an empty block. Pinned here equal to
// the made block on everything a quest reads, for a spread of the plan's cells; the walk end to end on fixtures in
// auditrelease_r25f.test.js, and on the freeware at the centre in auditrelease_r25_freeware.test.js.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fabricQuestBlock, withFabricBuildings, fabricCellBuildings, fabricSliceKindsOf, fabricSliceSites, FABRIC_DONORS, _resetFabricInteriors } from '../../../src/world/imperialFabricBuildings.js';
import { FABRIC_DONOR_MARKED, FABRIC_SITE_SETS, FABRIC_SLICE_SETS } from '../../../src/world/imperialFabricSites.js';
import { imperialOwnName, imperialFarName, imperialLakeName } from '../../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SPAN } from '../../../src/world/imperialCity.js';
import { blockBuildingCount } from '../../../src/systems/talk/talkTopics.js';
import { townBuildings, townSitesIndex, buildingHasQuestMarker } from '../../../src/systems/quest/place.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { BlocksFile } from '../../../src/formats/blocksFile.js';

/** A BLOCKS.BSA of the donors alone: each donor block's records, every interior a marker of its own (its block and record
 *  named, so an interior handed to the wrong building shows). */
const donorsFile = () => {
  const blocks = new Map();
  for (const d of FABRIC_DONORS) {
    const b = blocks.get(d.block) ?? { rmbBlock: { subRecords: [] } };
    b.rmbBlock.subRecords[d.record] = { interior: { blockFlatObjectRecords: [{ textureArchive: 199, textureRecord: 11, xPos: d.record, yPos: 0, zPos: 0, of: `${d.block}#${d.record}` }] } };
    blocks.set(d.block, b);
  }
  return { getBlockByName: (name) => blocks.get(name) ?? null };
};
/** A cell's own block as the scene's door makes it, but for its ground and models (withFabricBuildings over an empty JSON). */
const madeBlock = (name, file) => withFabricBuildings({ Name: name, RmbBlock: { FldHeader: {}, SubRecords: [] } }, name, file);
/** A spread of the plan's cells: every eleventh row and column. */
const CELLS = [];
for (let r = 5; r < IMPERIAL_CELLS; r += 11) for (let c = 7; c < IMPERIAL_CELLS; c += 11) CELLS.push([r, c]);

test('QUEST-FABRIC THE VIEW IS THE BLOCK\'S BUILDINGS (world/imperialFabricBuildings.js fabricQuestBlock): for a spread of the plan\'s cells, the records (type, faction, quality, name seed, sector), the count the walk reads, the subrecords\' places, each interior its own donor\'s and the block naming its own buildings - all the made block\'s (mutants: the records unread; the donors unattached)', () => {
  _resetFabricInteriors();
  const file = donorsFile();
  let built = 0, empty = 0;
  for (const [r, c] of CELLS) {
    const name = imperialOwnName(r, c), view = fabricQuestBlock(name, file), recs = fabricCellBuildings(r, c);
    assert.ok(view, `${name}: a view`);
    if (!recs.length) {
      empty++;
      assert.equal(blockBuildingCount(view), 0, `${name}: no building, none read`);
      continue;
    }
    built++;
    const made = madeBlock(name, file), at = `${name} (${r}, ${c})`;
    assert.deepEqual(view.rmbBlock.fldHeader.buildingDataList, made.rmbBlock.fldHeader.buildingDataList, `${at}: its records`);
    assert.equal(blockBuildingCount(view), blockBuildingCount(made), `${at}: its count`);
    assert.equal(blockBuildingCount(view), recs.length);
    assert.deepEqual(view.rmbBlock.fldHeader.blockPositions, made.rmbBlock.fldHeader.blockPositions, `${at}: its subrecords' places`);
    assert.equal(view.ownNamedBuildings, true, `${at}: it names its own buildings`);
    view.rmbBlock.subRecords.forEach((sub, i) => {
      const d = FABRIC_DONORS[recs[i].donor];
      assert.equal(sub.interior, made.rmbBlock.subRecords[i].interior, `${at} #${i}: the made block's interior`);
      // PIN MOVED (IC-INTERIORS): the interior is the building's own (world/interior/fabricInterior.js) and carries its donor's
      // quest marker among its own flats, no longer the donor's record whole
      assert.equal(sub.interior.blockFlatObjectRecords.find((f) => f.textureArchive === 199 && f.textureRecord === 11)?.of, `${d.block}#${d.record}`, `${at} #${i}: its own donor's`);
    });
    assert.equal(view.index, made.index, `${at}: its index`);
  }
  assert.ok(built > 40 && empty > 20, `the spread holds cells of both kinds (${built} built, ${empty} empty)`);
});

test('QUEST-FABRIC THE VIEW IS THE CITY\'S OWN CELLS ALONE: a far block, the lake\'s and Daggerfall\'s own are none of it, and with no BLOCKS.BSA there is none (the made block has no buildings then either) - the walk reads those as it always did', () => {
  const file = donorsFile();
  for (const name of [imperialFarName(80, 80), imperialLakeName(80, 80), 'TVRNBM04.RMB', 'MARKS1.RMB', '']) assert.equal(fabricQuestBlock(name, file), null, name);
  assert.equal(fabricQuestBlock(imperialOwnName(80, 80), null), null, 'no BLOCKS.BSA');
});

test('QUEST-FABRIC THE QUEST WORLD READS A CELL THROUGH IT (scenes/questWorld.js questBlock): its buildings and their sites, the scene\'s door never asked for the cell - a classic block still made by the door (mutant: the quest world\'s view unwired)', () => {
  _resetFabricInteriors();
  const donors = donorsFile(), asked = [];
  const blocks = { getBlockByName: (name) => { asked.push(name); return donors.getBlockByName(name); } };
  const { questWorld: qw } = createQuestWorld({ maps: {}, blocks, provinceQuestPlaces: null, params: new URLSearchParams(), placeByName: () => null, townTalk: { nameOpts: () => ({}) } });
  const [r, c] = CELLS.find(([y, x]) => fabricCellBuildings(y, x).length > 5);
  const name = imperialOwnName(r, c);
  const view = qw.questBlock(name);
  assert.equal(blockBuildingCount(view), fabricCellBuildings(r, c).length);
  const town = { loaded: true, name: 'A slice', exterior: { buildings: [], exteriorData: { width: 1, height: 1, blockNames: [name], locationId: 1 } } };
  const world = { ...qw, maps: { getRmbBlockName: () => name } };
  assert.equal([...townBuildings(town, [{ dfBlock: view, x: 0, y: 0 }])].length, fabricCellBuildings(r, c).length);
  asked.length = 0;
  const index = townSitesIndex(world, town);
  assert.equal(index.length, fabricCellBuildings(r, c).length, 'every building a site: each donor\'s interior holds a marker here');
  assert.ok(!asked.includes(name), 'the scene\'s door never asked for the cell');
  assert.ok(asked.every((n) => FABRIC_DONORS.some((d) => d.block === n)), 'only the donors\' own blocks read');
  assert.equal(qw.questBlock('MARKS1.RMB'), null, 'a classic block is the door\'s');
});

test('QUEST-FABRIC THE BAKED TABLE IS THE PLAN\'S (world/imperialFabricSites.js, tools/bakeFabricSites.mjs): every slice a set, the first none; on a spread of slices the kinds its own cells\' buildings give with a marked donor (fabricSliceKindsOf), read as a sites index reads them (fabricSliceSites) - so a change to the plan or the donors that the table missed fails here (mutants: a set\'s kind dropped; a slice\'s set swapped)', () => {
  assert.equal(FABRIC_SLICE_SETS.length, IMPERIAL_SPAN * IMPERIAL_SPAN, 'every slice of the plan');
  assert.equal(FABRIC_SITE_SETS[0], '', 'the first set none');
  assert.equal(new Set(FABRIC_SITE_SETS).size, FABRIC_SITE_SETS.length, 'each set once');
  assert.equal(FABRIC_DONOR_MARKED.length, FABRIC_DONORS.length, 'a mark a donor');
  let some = 0;
  for (let s = 3; s < FABRIC_SLICE_SETS.length; s += 13) {
    const kinds = fabricSliceKindsOf(s, FABRIC_DONOR_MARKED);
    assert.equal(FABRIC_SITE_SETS[FABRIC_SLICE_SETS[s]], kinds.join(' '), `slice ${s}: the plan's kinds`);
    assert.deepEqual(fabricSliceSites(s).map((x) => `${x.buildingType}:${x.factionId}`), kinds, `slice ${s}: as the index reads them`);
    if (kinds.length) some++;
  }
  assert.ok(some > 10, `the spread holds slices with sites (${some})`);
  // the donor's mark is read: no donor marked, no kind; one pool's alone marked, that pool's kinds alone
  const full = FABRIC_SLICE_SETS.findIndex((set) => FABRIC_SITE_SETS[set].split(' ').length > 8);
  assert.deepEqual(fabricSliceKindsOf(full, FABRIC_DONORS.map(() => 0)), [], 'no donor marked: none');
  const taverns = FABRIC_DONORS.map((d) => Number(d.pool === 'tavern'));
  assert.deepEqual(fabricSliceKindsOf(full, taverns), ['15:0'], 'the taverns\' donors alone: the tavern alone');
  assert.deepEqual(fabricSliceSites(IMPERIAL_SPAN * IMPERIAL_SPAN), [], 'past the plan: none');
});

const ARENA2 = process.env.ARENA2_PATH;
test('QUEST-FABRIC with ARENA2: the donors\' marks are BLOCKS.BSA\'s - each donor\'s interior holds a quest marker exactly where the table says (tools/bakeFabricSites.mjs reads them there)', { skip: !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing BLOCKS.BSA' : false }, () => {
  const raw = readFileSync(join(ARENA2, 'BLOCKS.BSA'));
  const bsa = new BlocksFile(); bsa.load(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  assert.deepEqual(FABRIC_DONORS.map((d) => Number(buildingHasQuestMarker(bsa.getBlockByName(d.block), d.record))), [...FABRIC_DONOR_MARKED]);
});

