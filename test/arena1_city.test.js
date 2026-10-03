// ARENA1 (2026-10-02): THE ARENA IN DAGGERFALL'S CELL (4,3) - src/world/arenaCity.js on the world-data door. Mac:
// "a centerpoint that fits in the middle of Daggerfall city". Every read of the city (MAPS.BSA's, Beautiful Cities',
// a pinned town's, the door shut) names ARENADAG.RMB at (4,3) and its building list loses exactly what the old block's
// named buildings drew - so every other building keeps its name, its faction and its quality. The port's block stands
// at a fixed index outside DFU's new-block sequence, behind no switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standArenaInLocation, ARENA_BLOCK, ARENA_BLOCK_INDEX, ARENA_CELL, inArenaCell, isArenaCity, installArena, _resetArena } from '../src/world/arenaCity.js';
import { drawNamedBuildings, mergeNamedBuildings, makeBuildingKey } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { registerPortBlock, getNewDFBlockIndex, getNewDFBlockName, getDFBlockReplacementData, editLocation, registerLocationEdit, installWorldDataReplacement, _resetWorldDataReplacement, bindWorldDataBlocks } from '../src/formats/worldDataReplacement.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { worldDataDoor, setWorldDataDoor } from '../src/formats/worldDataDoor.js';
import { setValue } from '../src/systems/settings.js';
import { HAS_ARENA2, bootDoor } from './arena1Data.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = BUILDING_TYPES;
const bd = (buildingType, nameSeed = 0) => ({ buildingType, nameSeed, factionId: nameSeed, quality: 1, sector: 0, locationId: 0 });
/** A block of its buildings' types, by name. */
const fakeBlock = (name, types) => ({ name, index: 1, rmbBlock: { fldHeader: { buildingDataList: types.map((t) => bd(t)), otherNames: null }, subRecords: types.map(() => ({})) } });

/** A 5 x 4 Daggerfall: taverns and gem stores in every block, the arena's cell among them. */
function fakeCity() {
  const names = [];
  const blocks = new Map();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
    const n = `B${x}${y}.RMB`;
    names.push(n);
    blocks.set(n, fakeBlock(n, x === 4 && y === 3 ? [T.Tavern, T.GemStore, T.House2, T.GemStore] : [T.Tavern, T.House1, T.GemStore]));
  }
  const pool = [];
  for (let i = 0; i < 20; i++) pool.push(bd(T.Tavern, 100 + i), bd(T.GemStore, 200 + i), bd(T.GemStore, 300 + i));
  const loc = { regionIndex: 17, locationIndex: 1231, name: 'Daggerfall', exterior: { buildingCount: pool.length, buildings: pool, exteriorData: { width: 5, height: 4, blockNames: names } } };
  const blocksFile = { getBlockByName: (n) => blocks.get(n) ?? null };
  const grid = (l) => { const out = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) { const b = blocksFile.getBlockByName(l.exterior.exteriorData.blockNames[y * 5 + x]); if (b) out.push({ dfBlock: b, x, y }); } return out; };
  return { loc, blocksFile, grid, blocks };
}

test('ARENA1 city: the draw answers what each block drew - the very entries its merged list took', () => {
  const { loc, grid } = fakeCity();
  const list = grid(loc);
  const { out, drawn } = drawNamedBuildings(loc.exterior.buildings, list);
  const cell = list.find((b) => b.x === 4 && b.y === 3);
  assert.deepEqual(drawn.get(cell).map((d) => d.nameSeed), out.get(cell).filter((d) => d.buildingType !== T.House2).map((d) => d.nameSeed));
  assert.equal(drawn.get(cell).length, 3, 'a tavern and two gem stores - a house draws nothing');
  assert.deepEqual([...mergeNamedBuildings(loc.exterior.buildings, list)].map(([, l]) => l), [...out].map(([, l]) => l), 'merge is the same draw');
  // a building a world-data file replaces with a faction hands its draw back (RMBLayout.cs:662-672): not the block's
  const was = worldDataDoor();
  setWorldDataDoor({ getBuildingReplacementData: (name, index, i) => (name === 'B43.RMB' && i === 0 ? { factionId: 9, quality: 1, nameSeed: 1, buildingType: T.Tavern } : null) });
  try {
    const again = drawNamedBuildings(loc.exterior.buildings, grid(loc));
    const c2 = [...again.drawn.keys()].find((b) => b.x === 4 && b.y === 3);
    assert.equal(again.drawn.get(c2).length, 2, 'the tavern\'s draw went back to the pool');
    assert.ok(again.drawn.get(c2).every((d) => d.buildingType === T.GemStore));
  } finally { setWorldDataDoor(was); }
});

test('ARENA1 city: cell (4,3) is the arena\'s and the list loses exactly the cell\'s draws - every other building keeps its entry', () => {
  const { loc, blocksFile, grid } = fakeCity();
  const before = mergeNamedBuildings(loc.exterior.buildings, grid(loc));
  const named = (m, l) => new Map([...m].filter(([b]) => !(b.x === 4 && b.y === 3)).map(([b, list]) => [`${b.x},${b.y}`, list.map((d) => d.nameSeed)]));
  const was = named(before, grid(loc));
  const r = standArenaInLocation(loc, null, blocksFile);
  assert.deepEqual(r, { block: 'B43.RMB', stripped: 3 });
  assert.equal(loc.exterior.exteriorData.blockNames[3 * 5 + 4], ARENA_BLOCK);
  assert.equal(loc.exterior.exteriorData.arenaTook, 'B43.RMB');
  assert.equal(loc.exterior.buildings.length, 57);
  assert.equal(loc.exterior.buildingCount, 57);
  const after = mergeNamedBuildings(loc.exterior.buildings, grid(loc));
  assert.deepEqual(named(after, grid(loc)), was, 'not one name moved');
  // once: a second read of the same (cached) record is left as it is
  assert.deepEqual(standArenaInLocation(loc, null, blocksFile), { block: ARENA_BLOCK, stripped: 0, already: true });
  assert.equal(loc.exterior.buildings.length, 57);
});

test('ARENA1 city: only Daggerfall, and never without a blocks file - a grid renamed with no strip would rename the city', () => {
  const { loc, blocksFile } = fakeCity();
  assert.equal(standArenaInLocation({ ...loc, locationIndex: 1230 }, null, blocksFile), null);
  assert.equal(standArenaInLocation({ ...loc, regionIndex: 16 }, null, blocksFile), null);
  assert.equal(standArenaInLocation(loc, null, null), null);
  assert.equal(loc.exterior.exteriorData.blockNames[19], 'B43.RMB');
  assert.equal(isArenaCity(loc), true);
  assert.deepEqual(ARENA_CELL, [4, 3]);
  assert.equal(inArenaCell(makeBuildingKey(4, 3, 7)), true);
  assert.equal(inArenaCell(makeBuildingKey(3, 4, 7)), false);
  assert.equal(inArenaCell(makeBuildingKey(4, 2, 0)), false);
  assert.equal(inArenaCell(0), false);
});

test('ARENA1 city: the port\'s block at a fixed index past any BSA, served behind no switch; a mod\'s first new block still takes BsaFile.Count', () => {
  _resetWorldDataReplacement();
  setValue('Enhancements', 'AssetInjection', 'False');
  installWorldDataReplacement();
  bindWorldDataBlocks({ count: 1295, getBlockIndex: () => -1 });
  registerPortBlock('TEST.RMB', { Name: 'TEST.RMB', RmbBlock: { FldHeader: {}, SubRecords: [], Misc3dObjectRecords: [], MiscFlatObjectRecords: [] } }, 900123);
  assert.equal(getNewDFBlockIndex('TEST.RMB'), 900123);
  assert.equal(getNewDFBlockName(900123), 'TEST.RMB');
  const b = getDFBlockReplacementData(900123, 'TEST.RMB');
  assert.equal(b.name, 'TEST.RMB');
  assert.equal(b.index, 900123);
  assert.equal(getDFBlockReplacementData(900123, 'TEST.RMB'), b, 'built once');
  assert.equal(getDFBlockReplacementData(5, 'OTHER.RMB'), null, 'the door is still shut for a mod\'s');
  // the edit seam: every registered edit, once a read, and a read inside an edit answered unedited
  let n = 0;
  registerLocationEdit((loc) => { n++; editLocation(loc); });
  editLocation({});
  assert.equal(n, 1);
  _resetWorldDataReplacement();
  assert.equal(getNewDFBlockIndex('TEST.RMB'), -1);
  assert.equal(ARENA_BLOCK_INDEX, 900100);
  const src = read('src/formats/worldDataReplacement.js');
  assert.match(src, /if \(blockName && _portBlocks\.has\(blockName\)\) return portBlock\(blockName\);[^\n]*\n\s*if \(!worldDataOn\(\) \|\| !blockName\) return null;/, 'before the door\'s gate');
  assert.match(read('src/formats/mapsFile.js'), /dfLocation\.locationIndex = location;\n\s*worldDataDoor\(\)\?\.editLocation\?\.\(dfLocation, this\);/);
  assert.doesNotMatch(read('src/formats/mapsFile.js').match(/readClassicLocation\(region, location\) \{[\s\S]*?\n {2}\}/)[0], /editLocation/, 'a pack\'s edit is taken against the city as MAPS.BSA holds it');
  assert.match(read('src/scenes/modWorldData.js'), /installWorldDataReplacement\(\);\n\s*await installArena\(\);/);
});

/** The city's summaries as every reader draws them. */
function summaries(maps, blocks, loc) {
  const e = loc.exterior.exteriorData;
  const list = [];
  for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) { const b = blocks.getBlockByName(maps.getRmbBlockName(loc, x, y)); if (b) list.push({ dfBlock: b, x, y }); }
  return buildingSummaries(loc.exterior.buildings, list, { locationIndex: loc.locationIndex });
}
const same = (a, b) => a.name === b.name && a.factionId === b.factionId && a.quality === b.quality && a.buildingType === b.buildingType && a.nameSeed === b.nameSeed;

for (const [layout, packs] of [['Daggerfall\'s own layout', false], ['Beautiful Cities', true]]) {
  test(`ARENA1 city (ARENA2): ${layout} - ARENADAG.RMB at (4,3), GEMSAL03's 19 buildings gone, its 3 draws stripped, the other buildings unchanged`, { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, async () => {
    const { maps: m0, blocks: b0 } = await bootDoor({ packs, arena: false });
    const city0 = m0.getLocation(17, 1231);
    assert.equal(city0.exterior.exteriorData.blockNames[3 * 8 + 4], 'GEMSAL03.RMB');
    const was = summaries(m0, b0, city0);
    const listWas = city0.exterior.buildings.length;
    const { maps, blocks } = await bootDoor({ packs, arena: true });
    const city = maps.getLocation(17, 1231);
    assert.equal(city.exterior.exteriorData.blockNames[3 * 8 + 4], ARENA_BLOCK);
    assert.equal(city.exterior.exteriorData.arenaTook, 'GEMSAL03.RMB');
    assert.equal(city.exterior.buildings.length, listWas - 3, 'the tavern and the two gem stores');
    assert.equal(city.exterior.buildingCount, listWas - 3);
    assert.equal(city.exterior.recordElement.header.locationId, 50026, 'the city keeps its LocationId');
    assert.equal(city.dungeon.recordElement.header.locationId, 50027, 'and its castle');
    assert.equal(city.mapTableData.mapId, city0.mapTableData.mapId);
    const now = summaries(maps, blocks, city);
    assert.equal(was.filter((s) => inArenaCell(s.buildingKey)).length, 19);
    assert.equal(now.filter((s) => inArenaCell(s.buildingKey)).length, 0);
    assert.equal(now.length, was.length - 19);
    const byKey = new Map(was.map((s) => [s.buildingKey, s]));
    const moved = now.filter((s) => !same(s, byKey.get(s.buildingKey) ?? {}));
    assert.deepEqual(moved, [], 'every other building keeps its name, faction, quality');
    assert.ok(now.some((s) => s.buildingType === BUILDING_TYPES.Palace && s.factionId === 201), 'the Palace stands');
    // the block itself, at its index, with Kamer's props and the gate's people
    const blk = blocks.getBlockByName(ARENA_BLOCK);
    assert.equal(blk.index, ARENA_BLOCK_INDEX);
    assert.equal(blk.rmbBlock.subRecords.length, 0);
    assert.equal(blk.rmbBlock.misc3dObjectRecords.length, 119 + 14, 'Kamer\'s 119 and the plazas\' 14 (ARENA-FIX 3)');
    assert.equal(blk.rmbBlock.miscFlatObjectRecords.length, 35 + 8, 'his 29 lights, the gate\'s six, the plazas\' eight');
    // a second read: the same answer
    const again = maps.getLocation(17, 1231);
    assert.equal(again.exterior.buildings.length, listWas - 3);
    assert.equal(again.exterior.exteriorData.blockNames[3 * 8 + 4], ARENA_BLOCK);
    // MAPS.BSA's own city is never edited - a pack's edit is taken against it
    assert.equal(maps.readClassicLocation(17, 1231).exterior.exteriorData.blockNames[3 * 8 + 4], 'GEMSAL03.RMB');
  });
}

test('ARENA1 city (ARENA2): not a switch - with Replace Game Artwork off the door serves no mod, and the arena stands all the same', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const { maps, blocks } = await bootDoor({ packs: false, arena: true, injection: false });
  const city = maps.getLocation(17, 1231);
  assert.equal(city.exterior.exteriorData.blockNames[3 * 8 + 4], ARENA_BLOCK);
  assert.equal(blocks.getBlockByName(ARENA_BLOCK)?.index, ARENA_BLOCK_INDEX);
  // and the next town is untouched
  const other = maps.getLocation(17, 1230);
  assert.ok(!other?.exterior?.exteriorData?.blockNames?.includes(ARENA_BLOCK));
  _resetArena();
  setValue('Enhancements', 'AssetInjection', 'True');
  assert.equal(typeof installArena, 'function');
});
