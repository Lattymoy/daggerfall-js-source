// FIELD BUGS 2026-10-30b ZONE-BANK (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 3): "Banker in IC referred
// to mountains" - "the banks in the IC should work, or they should be removed". The owner, asked: banks "Work in
// settlements". PVPDUNGEONS shut every bank in the open zone, and the zone has been Cyrodiil since WW-C2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zoneBankOpen, ZONE_SAFE_TEXT } from '../../../src/systems/wild/zoneSafe.js';
import { CAPITALS, synthesizeCapitalLocation } from '../../../src/world/tamrielCapitals.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
// icgrand_lod.test.js's recipe: the Imperial City's centre slice as the producer mints it
const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
const base = { name: 'B', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
const names = new Map(['GENR', 'ARMR', 'ALCH', 'GEMS', 'BOOK', 'PAWN', 'BANK', 'TVRN', 'RESI', 'FIGH', 'TEMP', 'LIBR', 'THIE', 'MAGE'].map((k) => [k, [`${k}AA00.RMB`]]));

test('ZONE-BANK a bank in the open zone serves in a settlement - the Imperial City\'s among them - and not in the zone\'s wilds; outside the zone every bank serves, on the Bay and past it; the refusal names the zone, not the mountains (mutants: the zone\'s banks all shut again; a wild bank open; the old words)', () => {
  const ic = synthesizeCapitalLocation({ cap: CAPITALS[0], k: 0 }, { base, names, blockOf: (n) => (n.startsWith('TES') ? null : fh), px: 0, py: 0 });
  assert.equal(ic.mapTableData.locationType, LOCATION_TYPES.TownCity, 'the Imperial City is a city');
  const px = { x: 0, y: 0 }, on = (loc) => (x, y) => (x === px.x && y === px.y ? loc : null);
  assert.equal(zoneBankOpen(true, px, on(ic)), true, 'its banks serve, in the zone');
  const hall = { ...base, mapTableData: { mapId: 10, locationType: LOCATION_TYPES.DungeonLabyrinth } };
  assert.equal(zoneBankOpen(true, px, on(hall)), false, 'the zone\'s wilds keep PVPDUNGEONS\' rule');
  assert.equal(zoneBankOpen(true, px, on(null)), false, 'no place known: the wilds');
  assert.equal(zoneBankOpen(false, px, on(hall)), true, 'outside the zone, anywhere');
  assert.equal(zoneBankOpen(false, px, on({ ...base })), true, 'a Bay town');
  assert.equal(ZONE_SAFE_TEXT.bank, 'In the open zone, banks serve only cities, towns and villages.');
  const w = read('src/scenes/world.js');
  assert.match(w, /wildNoBank: \(\) => \{ if \(zoneBankOpen\(wildHere\(\), playerTravelPixel\(\), _locationToBuild\)\) return false; townTalk\.say\(ZONE_SAFE_TEXT\.bank\); return true; \},/, 'the world host asks the place its door stands on');
  assert.ok(!w.includes('There are no banks in the mountains.'), 'the Wrothgarian words are gone');
  assert.match(read('src/scenes/worldModes.js'), /function openBank\(\) \{\n\s*if \(host\.wildNoBank\?\.\(\)\) return false;/, 'the banker asks it first');
});
