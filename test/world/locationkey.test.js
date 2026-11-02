// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" B4; world/locationKey.js): A LOCATION'S MapTable
// KEY IS ITS BUILDINGS' DIRECTORY. Measured over the freeware's MAPS.BSA: every row's key is exactly what its own
// buildings make by locationKeyOf's table - so a place the port makes past the Bay carries its own buildings' key.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { locationKeyOf, DIVINE_KEY_BITS, TEMPLE_ORDER_DIVINE, GUILD_KEY_BITS, BUILDING_KEY_BITS } from '../../src/world/locationKey.js';
import { checkLocationKeyForRegionalBuilding, REGIONAL_LOOKUP_INDEXES } from '../../src/systems/answerPipeline.js';
import { FACTIONS_AND_BUILDINGS } from '../../src/systems/topicTree.js';
import { BUILDING_TYPES as T } from '../../src/world/buildingNames.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_DATA = ARENA2 ? false : 'ARENA2_PATH unset (sh tools/fetch-data.sh)';
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));

test('BAY-LEFT-B LOCATION-KEY: every MAPS.BSA row\'s key is its own buildings\' (15,251 rows, 7,351 with a key) - the key is the location\'s directory (mutants: each byte\'s table; a temple order\'s divine)', { skip: NO_DATA }, async () => {
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  let rows = 0, keyed = 0;
  const off = [];
  for (let r = 0; r < 62; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let i = 0; i < region.mapTable.length; i++) {
      rows++;
      const want = region.mapTable[i].key >>> 0, got = locationKeyOf(maps.getLocation(r, i)?.exterior?.buildings ?? []);
      if (want) keyed++;
      if (got !== want) off.push(`${region.mapNames[i]}: ${want.toString(16)} != ${got.toString(16)}`);
    }
  }
  assert.deepEqual(off, []);
  assert.deepEqual([rows, keyed], [15251, 7351], 'every row, 7,351 of them with a key');
});

test('BAY-LEFT-B LOCATION-KEY: a temple order names its divine as FACTION.TXT holds it (each order its divine\'s child) (mutant: an order\'s divine)', { skip: NO_DATA }, async () => {
  const { FactionFile } = await import('../../src/formats/factionFile.js');
  const f = new FactionFile(); f.load(bytes('FACTION.TXT'));
  for (const [order, divine] of Object.entries(TEMPLE_ORDER_DIVINE)) assert.equal(f.factionDict.get(Number(order))?.parent, divine, `${f.factionDict.get(Number(order))?.name}`);
});

test('BAY-LEFT-B LOCATION-KEY: each bit locationKeyOf writes is the one the regional "Where is" reads back for its building (CheckLocationKeyForRegionalBuilding) (mutants: a shop\'s bit; a guild\'s bit; a divine\'s bit)', () => {
  for (let index = 0; index < FACTIONS_AND_BUILDINGS.length; index++) {
    const look = REGIONAL_LOOKUP_INDEXES[index], faction = FACTIONS_AND_BUILDINGS[index];
    const building = look === 0x0d ? { buildingType: T.Temple, factionId: faction }
      : look >= 0x19 && look <= 0x27 ? { buildingType: T.GuildHall, factionId: faction }
        : { buildingType: { 0x00: T.Tavern, 0x03: T.WeaponSmith, 0x04: T.Armorer, 0x05: T.Alchemist, 0x06: T.Bank, 0x07: T.Bookseller, 0x08: T.ClothingStore, 0x0a: T.GemStore, 0x0b: T.Library, 0x0c: T.PawnShop }[look], factionId: 0 };
    assert.equal(checkLocationKeyForRegionalBuilding(locationKeyOf([building]), look, faction), 1, `row ${index}`);
    assert.equal(checkLocationKeyForRegionalBuilding(locationKeyOf([]), look, faction), 0);
  }
  assert.equal(Object.keys(DIVINE_KEY_BITS).length, 8);
  assert.equal(Object.values(GUILD_KEY_BITS).filter((b) => b === 17).length, 10, 'the ten knightly orders');
  assert.equal(BUILDING_KEY_BITS[T.GeneralStore], 24);
  assert.equal(locationKeyOf([{ buildingType: T.Temple, factionId: 92 }]), 1, 'the Akatosh Chantry, Akatosh\'s bit');
  assert.equal(locationKeyOf([{ buildingType: T.House1, factionId: 0 }, { buildingType: T.Temple, factionId: 41 }]), 0, 'a house and a temple of no divine name none');
});
