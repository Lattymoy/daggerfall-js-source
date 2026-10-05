// FIELD BUGS 2026-10-05 CRYPT-SALE (Discord: "House I bought doesnt let me in and instead gives me a message" - "I
// bought a house and only get the following message This house has nothing of value when trying to enter"; "I have
// the same issue with the house inside the graveyard in wayrest"; "probably we tried the same place Wickcroft Tombs";
// "+1 on having a bugged house at a graveyard").
//
// HOME2 widened what can be a home to House5 and House6, and the graveyard's crypt is a House5 whose interior holds no
// 3D model: DFU's AssignBlockData refuses it (DaggerfallInterior.cs:388-389) and TransitionInterior says "This house
// has nothing of value." (PlayerEnterExit.cs:719-730) - so the line was DFU's and the SALE was the port's (DFU's
// GetHousesForSale takes HouseForSale and House1-4, BuildingDirectory.cs:156-184). Measured with the player's data:
// 67 crypts in 67 places carried a door and a price online (Wayrest's GRVEAL09 #11, key 66059, at 67,600; the
// Wickcroft Tombs' GRVEAS09 #11, key 11). Fixtures from the producers (locationBuildings, buildingDataForDoor).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tinyRmb } from './wd3Fakes.mjs';
import { locationBuildings, buildingDataForDoor } from '../src/systems/talkTopics.js';
import { homeCandidate, homePurchasable } from '../src/systems/onlineHomes.js';
import { hasInteriorModels, layoutInterior } from '../src/world/interiorLayout.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

/** tinyRmb's two subrecords as a graveyard's: #0 a room with a model, #1 a room with none - both House5, no faction. */
function graveyard() {
  const b = tinyRmb(7, 'GRVEAL09.RMB');
  b.rmbBlock.fldHeader.buildingDataList = b.rmbBlock.fldHeader.buildingDataList.map((d) => ({ ...d, buildingType: BUILDING_TYPES.House5, factionId: 0 }));
  return b;
}

test('CRYPT-SALE: the report - a crypt (House5, its room without a model) is still a home candidate, and no longer for sale; a House5 with a room still is', () => {
  const blk = graveyard();
  assert.equal(blk.rmbBlock.subRecords[1].interior.header.num3dObjectRecords, 0, 'the fixture\'s #1 is the crypt\'s shape');
  const list = locationBuildings([], [{ x: 1, y: 2, dfBlock: blk }]);
  const crypt = list.find((b) => b.recordIndex === 1), house = list.find((b) => b.recordIndex === 0);
  assert.equal(crypt.hasInterior, false, 'the producer says the room cannot be laid out');
  assert.equal(homeCandidate(crypt), true, 'a crypt already bought stays its owner\'s home (the plaque, "Sell it")');
  assert.equal(homePurchasable(crypt), false, 'and nobody is offered it');
  assert.equal(house.hasInterior, true);
  assert.equal(homePurchasable(house), true, 'HOME2\'s House5 with a room is still a house anyone can buy');
});

test('CRYPT-SALE: the door\'s own record (buildingDataForDoor, what the plaque and the click price) carries the same answer', () => {
  const blk = graveyard();
  const blocks = [{ x: 1, y: 2, originX: 0, originZ: 0, dfBlock: blk }];
  const crypt = buildingDataForDoor([], blocks, { dfBlock: blk, recordIndex: 1, position: [10, 0, 10] });
  const house = buildingDataForDoor([], blocks, { dfBlock: blk, recordIndex: 0, position: [10, 0, 10] });
  assert.equal(crypt.hasInterior, false);
  assert.equal(homePurchasable(crypt), false, 'the crypt\'s door says no price');
  assert.equal(homePurchasable(house), true);
});

test('CRYPT-SALE: the one law - the layout refuses by it, and a record the producers did not stamp is not refused', () => {
  const blk = graveyard();
  assert.equal(hasInteriorModels(blk.rmbBlock.subRecords[1]), false);
  assert.equal(hasInteriorModels(blk.rmbBlock.subRecords[0]), true);
  assert.equal(hasInteriorModels({ exterior: blk.rmbBlock.subRecords[1].exterior }), true, 'a subrecord read without its interior half is not known to be empty');
  assert.throws(() => layoutInterior(blk, 7, 1, () => null), /No interior 3D models/, 'AssignBlockData\'s refusal, by the same law');
  assert.equal(homePurchasable({ buildingType: BUILDING_TYPES.House5, factionId: 0, buildingKey: 66059 }), true, 'no stamp: not known to be empty');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('CRYPT-SALE with ARENA2: every graveyard block in every place - no building whose room cannot be laid out is for sale; Wayrest\'s crypt (66059) and the Wickcroft Tombs\' (11) are among them', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 120000 }, async () => {
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const rd = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(rd('BLOCKS.BSA'));
  const cache = new Map();
  const blk = (n) => { if (!cache.has(n)) { const i = blocks.getBlockIndex(n); cache.set(n, i >= 0 ? blocks.getBlock(i) : null); } return cache.get(n); };
  let places = 0, empty = 0, candidates = 0, forSale = 0;
  const named = new Set();
  for (let r = 0; r < 62; r++) {
    for (let l = 0; l < (maps.baseLocationCount(r) ?? 0); l++) {
      const loc = maps.getLocation(r, l), ed = loc?.exterior?.exteriorData;
      if (!ed) continue;
      const inst = [];
      for (let y = 0; y < ed.height; y++) for (let x = 0; x < ed.width; x++) {
        const name = maps.getRmbBlockName(loc, x, y);
        if (/^GRVE/.test(name) && blk(name)) inst.push({ x, y, dfBlock: blk(name) });
      }
      if (!inst.length) continue;
      places++;
      for (const bd of locationBuildings(loc.exterior.buildings ?? [], inst, { locationIndex: loc.locationIndex })) {
        if (bd.hasInterior !== false) continue;
        empty++;
        if (homeCandidate(bd)) candidates++;
        if (homePurchasable(bd)) forSale++;
        if ((loc.name === 'Wayrest' && bd.buildingKey === 66059) || (loc.name === 'The Wickcroft Tombs' && bd.buildingKey === 11)) named.add(loc.name);
      }
    }
  }
  assert.ok(places > 1000 && empty > 10000, `the sweep reached the graveyards (${places} places, ${empty} empty rooms)`);
  assert.ok(candidates > 10000, 'HOME2 counts the crypts as homes - the gate is what refuses them');
  assert.equal(forSale, 0, 'none is for sale');
  assert.deepEqual([...named].sort(), ['The Wickcroft Tombs', 'Wayrest'], 'the two the reports named are among them');
});

test('CRYPT-SALE: the arena\'s move never puts a displaced home in a room that cannot be laid out (AUDIT FB1005 C2: buildingSummaries carried no stamp - Daggerfall\'s GRVEAL27 holds twelve House5 graves, CUSTAA05 two empty House6)', async () => {
  const { buildingSummaries } = await import('../src/world/buildingSummaries.js');
  const { arenaHomeFor } = await import('../src/systems/arenaMove.js');
  const summaries = buildingSummaries([], [{ x: 1, y: 2, dfBlock: graveyard() }]);
  assert.deepEqual(summaries.map((s) => [s.recordIndex, s.hasInterior]), [[0, true], [1, false]], 'the producer stamps both');
  for (let oldKey = 1; oldKey <= 40; oldKey++) {
    const to = arenaHomeFor({ mapId: 7, oldKey: 4096 + oldKey, oldType: BUILDING_TYPES.House5 }, summaries);
    assert.equal(to?.recordIndex, 0, `seed ${oldKey}: the House5 with a room, never the crypt`);
  }
});

test('CRYPT-SALE by source: both hosts\' door records carry the producer\'s stamp whole (AUDIT FB1005 C4: the law fails open, so a host that dropped it would sell the crypt again)', () => {
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(rd('src/scenes/world.js'), /if \(!d\) return null;\n\s*return \{ \.\.\.d, regionIndex: dfLoc\.regionIndex,/);
  assert.match(rd('src/scenes/exterior.js'), /if \(!d\) return null;\n\s*return \{ \.\.\.d, regionIndex: dfLocation\.regionIndex,/);
});
