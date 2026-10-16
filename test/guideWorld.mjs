// GUIDE (2026-09-29): THE QUEST GUIDE SUITES' ONE WORLD - moved out of test/ui/quest/guide1_questLens.test.js when GUIDE2 needed
// the same producer-minted Places. Importing it loads the vendored quest tables (the machine's own parse needs them)
// and hands over the crafted world, its region and a seeded rolls stream that counts its draws.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { REGION_NAMES } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');

{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

// ---------------------------------------------------------------
// The crafted world - the MapsFile/BlocksFile shapes Place resolves
// against (test/systems/quest/questplaces.test.js's, cut to what these quests use):
// Bigtown, one block of a tavern (spawn + item markers) and a house
// (a spawn marker, a questor's home); Llugwych, the FIXED town at
// Quests-Places p1 0xc352; Smallville, the same block, for a questor
// whose home rolls remote. Devilrock is a region with no dominant
// temple, so %god takes DFU's random arm - the quest's own rolls.
// ---------------------------------------------------------------

export const REGION = 'Devilrock';
export const RI = REGION_NAMES.indexOf(REGION);
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const building = (buildingType, o = {}) => ({ buildingType, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9, ...o });

export function makeWorld() {
  const townBlock = {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: [building(15), building(17)], otherNames: null },
      subRecords: [{ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } }, { interior: { blockFlatObjectRecords: [flat(11)] } }],
    },
  };
  const loc = ({ index, name, mapId, locationId, locationType = 0, blockNames = [], buildings = [] }) => ({
    loaded: true, regionIndex: RI, regionName: REGION, name, locationIndex: index, hasDungeon: false,
    mapTableData: { mapId, locationType, dungeonType: -1 },
    exterior: { buildings, recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId, width: blockNames.length, height: blockNames.length ? 1 : 0, blockNames } },
    dungeon: null,
  });
  const locations = [
    loc({ index: 0, name: 'Bigtown', mapId: 111, locationId: 0x400, blockNames: ['GUIDAA00.RMB'], buildings: [building(15)] }),
    loc({ index: 1, name: 'Llugwych', mapId: 444, locationId: 0xc352 }),
    loc({ index: 2, name: 'Smallville', mapId: 333, locationId: 0x402, locationType: 2, blockNames: ['GUIDAA00.RMB'], buildings: [building(15)] }),
  ];
  const region = { name: REGION, locationCount: locations.length, mapTable: locations.map((l) => ({ mapId: l.mapTableData.mapId, locationType: l.mapTableData.locationType, dungeonType: -1 })) };
  return {
    maps: {
      regionCount: 1,
      getRegion: () => region,
      getLocation: (r, l) => locations[l] ?? null,
      getLocationByName: (rn, ln) => locations.find((l) => l.name === ln) ?? null,
      getRmbBlockName: (l, x, y) => l.exterior.exteriorData.blockNames[y * l.exterior.exteriorData.width + x],
      readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId,
      getClimateIndex: () => 231,
    },
    getBlock: (name) => (name === 'GUIDAA00.RMB' ? townBlock : null),
    currentLocation: () => locations[0],
    currentRegionIndex: () => RI,
    currentLocationIndex: () => 0,
    currentRegionName: () => REGION,
    isPlayerInLocationRect: () => true,
    playerInside: () => null,
    isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}),
    discoverLocation: () => {},
  };
}

/** A seeded stream for a quest's rolls, and a count of its draws. */
export function seededRolls(seed = 7) {
  let s = seed >>> 0;
  const rolls = () => { rolls.calls++; s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  rolls.calls = 0;
  return rolls;
}
