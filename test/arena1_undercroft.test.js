// ARENA1 (2026-10-02): THE UNDERCROFT - Kamer's 32-block dungeon as the arena's own location record, under the city's
// pixel and kept off the travel map, entered by the 43600 stair in ARENADAG.RMB (Mac: Kamer's dungeon "becomes the
// arena's undercroft"). The city's castle dungeon (50027) is untouched; a save made below re-enters it by its own id;
// the castle's quest sites are never found to be here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { undercroftLocation, isArenaUndercroft, isUndercroftDoor, ARENA_BLOCK, UNDERCROFT_LOCATION_ID, UNDERCROFT_MAP_ID } from '../src/world/arenaCity.js';
import { DOOR_TYPE } from '../src/world/meshReader.js';
import { LOCATION_TYPES, DUNGEON_TYPES } from '../src/formats/mapsFile.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { dungeonStartDoorFor } from '../src/systems/save.js';
import { HAS_ARENA2, bootDoor, classicModels } from './arena1Data.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const city = () => ({
  regionIndex: 17, locationIndex: 1231, regionName: 'Daggerfall', name: 'Daggerfall', politic: 145, climate: { worldClimate: 231, climateType: 2 },
  mapTableData: { mapId: 1291010263, longitude: 26496, latitude: 36608, locationType: 0, dungeonType: 13, locationId: 50026 },
  exterior: { recordElement: { header: { x: 1, y: 2, locationId: 50026 } }, buildings: [], exteriorData: { blockNames: [] } },
  dungeon: { recordElement: { header: { locationId: 50027 } }, blocks: [{ blockName: 'S0000160.RDB' }] },
});

test('ARENA1 undercroft: the record - Kamer\'s 32 blocks and id, its own map id, the city\'s place and climate, the city\'s castle untouched', () => {
  const c = city();
  const u = undercroftLocation(c);
  assert.equal(u.name, 'The Arena Undercroft');   // ARENA-FIX 4: the place's own name
  assert.equal(u.dungeon.recordElement.header.locationName, 'Arena of Daggerfall', 'the record\'s identity is Kamer\'s');
  assert.equal(u.hasDungeon, true);
  assert.equal(u.dungeon.recordElement.header.locationId, UNDERCROFT_LOCATION_ID);
  assert.equal(u.dungeon.recordElement.header.exteriorLocationId, UNDERCROFT_LOCATION_ID);
  assert.equal(u.dungeon.blocks.length, 32);
  assert.deepEqual(u.dungeon.blocks.filter((b) => b.isStartingBlock).map((b) => [b.blockName, b.x, b.z]), [['N0000077.RDB', 0, 0]]);
  assert.deepEqual(u.dungeon.blocks.find((b) => b.blockName === 'B0000011.RDB') && { ...u.dungeon.blocks.find((b) => b.blockName === 'B0000011.RDB') }, { x: 1, z: -3, isStartingBlock: false, blockName: 'B0000011.RDB', blockIndex: 4, blockNumber: 11 });
  assert.equal(u.mapTableData.mapId, UNDERCROFT_MAP_ID, 'not the city\'s - a castle quest is never here');
  assert.equal(u.mapTableData.locationType, LOCATION_TYPES.DungeonKeep);
  assert.equal(u.mapTableData.dungeonType, DUNGEON_TYPES.HumanStronghold);
  assert.equal(u.mapTableData.longitude, 26496, 'under the city\'s pixel');
  assert.equal(u.regionIndex, 17);
  assert.equal(u.climate, c.climate);
  assert.equal(isArenaUndercroft(u), true);
  assert.equal(isArenaUndercroft(c), false);
  assert.equal(c.dungeon.recordElement.header.locationId, 50027);
  assert.equal(c.mapTableData.mapId, 1291010263);
});

test('ARENA1 undercroft: the stair is a dungeon entrance of the arena\'s block; a save made below finds it by the undercroft\'s id', () => {
  const stair = { dfBlock: { name: ARENA_BLOCK }, door: { doorType: DOOR_TYPE.DUNGEON_ENTRANCE } };
  assert.equal(isUndercroftDoor(stair, DOOR_TYPE.DUNGEON_ENTRANCE), true);
  assert.equal(isUndercroftDoor({ ...stair, door: { doorType: DOOR_TYPE.BUILDING } }, DOOR_TYPE.DUNGEON_ENTRANCE), false);
  assert.equal(isUndercroftDoor({ ...stair, dfBlock: { name: 'CUSTAA05.RMB' } }, DOOR_TYPE.DUNGEON_ENTRANCE), false);
  const u = undercroftLocation(city());
  const castle = { door: stair.door, group: '207,213', dfLocation: city() };
  const below = { door: stair.door, group: '207,213:undercroft', dfLocation: u };
  assert.equal(dungeonStartDoorFor([castle, below], { group: '207,213' }, `dungeon:${UNDERCROFT_LOCATION_ID}`), below);
  assert.equal(dungeonStartDoorFor([below, castle], { group: '207,213' }, 'dungeon:50027'), castle);
});

test('ARENA1 undercroft: the hosts hand the stair the undercroft and an exit group of its own; underground the quest location is the undercroft', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /\.\.\.arenaDoorTarget\(e\),/);
  assert.match(w, /if \(!isUndercroftDoor\(e, DOOR_TYPE\.DUNGEON_ENTRANCE\) \|\| !isArenaCity\(city\)\) return \{ dfLocation: city, group: e\.pixelKey \};/);
  assert.match(w, /return \{ dfLocation: u, group: `\$\{e\.pixelKey\}:undercroft` \};/);
  assert.match(w, /const under = modes\?\.mode === 'dungeon' \? modes\?\.dungeonLocation : null;\n\s*if \(isArenaUndercroft\(under\)\) return under;/);
  const e = read('src/scenes/exterior.js');
  assert.match(e, /if \(isUndercroftDoor\(last, DOOR_TYPE\.DUNGEON_ENTRANCE\) && isArenaCity\(dfLocation\)\) Object\.assign\(last, \{ dfLocation: \(undercroft \?\?= undercroftLocation\(dfLocation\)\), group: 'undercroft' \}\);/);
});

test('ARENA1 undercroft (ARENA2): laid out from BLOCKS.BSA - 32 blocks, a start marker, the castle\'s 16 untouched; the stair a door of the block', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const { maps, blocks } = await bootDoor({ packs: false, arena: true });
  const c = maps.getLocation(17, 1231);
  const u = undercroftLocation(c);
  const getModel = classicModels();
  const d = layoutDungeon(u, blocks, getModel);
  assert.equal(d.blocks.length, 32);
  assert.ok(d.startMarker, 'a start marker in N0000077 - the stair lands somewhere');
  const castle = layoutDungeon(c, blocks, getModel);
  assert.equal(castle.blocks.length, 16);
  assert.equal(c.dungeon.recordElement.header.locationId, 50027);
  // the stair: 43600's door is a dungeon entrance (TEXTURE.331 record 2)
  const stair = getModel(43600);
  assert.ok(stair.doors.some((dr) => dr.type === DOOR_TYPE.DUNGEON_ENTRANCE));
  assert.equal(blocks.getBlockByName(ARENA_BLOCK).rmbBlock.misc3dObjectRecords.filter((m) => m.modelIdNum === 43600).length, 1);
});
