import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  MapsFile,
  REGION_NAMES,
  REGION_RACES,
  REGION_TEMPLES,
  RMB_BLOCK_PREFIXES,
  LOCATION_TYPES,
  DUNGEON_TYPES,
  CLIMATES,
  CLIMATE_BASE_TYPES,
  FACTION_RACES,
  longitudeLatitudeToMapPixel,
  mapPixelToLongitudeLatitude,
  getMapPixelID,
  getPixelFromPixelID,
  mapPixelToWorldCoord,
  worldCoordToMapPixel,
  getWorldClimateSettings,
} from '../src/formats/mapsFile.js';
import { PakFile, PAK_WIDTH, PAK_HEIGHT } from '../src/formats/pakFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function loadMaps() {
  const m = new MapsFile();
  const ok = m.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))
  );
  assert.equal(ok, true);
  return m;
}

// Regions with zero locations in the classic data (their records are empty).
const EMPTY_REGIONS = [2, 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 24, 25, 27, 28, 29, 30];

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('maps: FALL.EXE tables intact', () => {
  assert.equal(REGION_NAMES.length, 62);
  assert.equal(REGION_RACES.length, 62);
  assert.equal(REGION_TEMPLES.length, 62);
  assert.equal(RMB_BLOCK_PREFIXES.length, 45);
  assert.equal(REGION_NAMES[17], 'Daggerfall');
  assert.equal(REGION_NAMES[20], 'Sentinel');
  assert.equal(REGION_TEMPLES[17], 36); // Kynareth in Daggerfall
  assert.equal(LOCATION_TYPES.TownCity, 0);
  assert.equal(LOCATION_TYPES.None, 0xffff);
  assert.equal(DUNGEON_TYPES.Cemetery, 18);
  assert.equal(DUNGEON_TYPES.NoDungeon, 255);
});

test('maps: coordinate converters round-trip', () => {
  const px = longitudeLatitudeToMapPixel(107620, 40120);
  assert.deepEqual(px, { x: Math.trunc(107620 / 128), y: 499 - Math.trunc(40120 / 128) });
  const ll = mapPixelToLongitudeLatitude(px.x, px.y);
  assert.equal(Math.trunc(ll.x / 128), px.x);
  assert.equal(499 - Math.trunc(ll.y / 128), px.y);

  assert.equal(getMapPixelID(207, 213), 213207);
  assert.deepEqual(getPixelFromPixelID(213207), { x: 207, y: 213 });

  const wc = mapPixelToWorldCoord(207, 213);
  assert.deepEqual(worldCoordToMapPixel(wc.x, wc.y), { x: 207, y: 213 });
});

test('maps: climate settings pinned per climate', () => {
  const desert = getWorldClimateSettings(CLIMATES.Desert);
  assert.equal(desert.climateType, CLIMATE_BASE_TYPES.Desert);
  assert.equal(desert.groundArchive, 2);
  assert.equal(desert.skyBase, 8);
  assert.equal(desert.people, FACTION_RACES.Redguard);

  const mountain = getWorldClimateSettings(CLIMATES.Mountain);
  assert.equal(mountain.groundArchive, 102);
  assert.equal(mountain.people, FACTION_RACES.Nord);

  const woodlands = getWorldClimateSettings(CLIMATES.Woodlands);
  assert.equal(woodlands.climateType, CLIMATE_BASE_TYPES.Temperate);
  assert.equal(woodlands.groundArchive, 302);
  assert.equal(woodlands.natureArchive, 504);

  // Unknown climates fall through to temperate woodlands.
  const fallback = getWorldClimateSettings(9999);
  assert.equal(fallback.groundArchive, 302);
  assert.equal(fallback.skyBase, 16);
});

test('maps: resolveRmbBlockName quirks', () => {
  const m = new MapsFile();
  const loc = { exterior: { exteriorData: { letter1ForRMBName: 66 } } }; // 'B'

  // blockCharacter 0: letter1 defaults A, letter2 = LETTER2[0] = A.
  assert.equal(m.resolveRmbBlockName(loc, 0, 2, 0), 'TVRNAA02.RMB');

  // Bit 0x10 pulls letter1 from the location.
  assert.equal(m.resolveRmbBlockName(loc, 2, 7, 0x10), 'RESIBA07.RMB');

  // letter2 uses (byte)(2*char)>>6: char 0xa0 -> (0x140 & 0xff)>>6 = 1 -> 'L'.
  // Without the 8-bit truncation this would index 5 and crash.
  assert.equal(m.resolveRmbBlockName(loc, 0, 3, 0xa0), 'TVRNAL03.RMB');

  // Temple blocks (13/14) encode a letter from the low nibble.
  assert.equal(m.resolveRmbBlockName(loc, 13, 4, 0x02), 'TEMPAAC4.RMB');
});

test('pak: synthetic run-length rows expand', () => {
  // 500 offsets, then one run per row filling all 1001 bytes with row%251.
  const bytes = new Uint8Array(PAK_HEIGHT * 4 + PAK_HEIGHT * 3);
  const v = new DataView(bytes.buffer);
  for (let row = 0; row < PAK_HEIGHT; row++) {
    const off = PAK_HEIGHT * 4 + row * 3;
    v.setUint32(row * 4, off, true);
    v.setUint16(off, PAK_WIDTH, true);
    bytes[off + 2] = row % 251;
  }
  const pak = new PakFile();
  assert.equal(pak.load(bytes), true);
  assert.equal(pak.getValue(0, 0), 0);
  assert.equal(pak.getValue(1000, 123), 123);
  assert.equal(pak.getValue(500, 499), 499 % 251);
  assert.equal(pak.getValue(-1, 0), -1);
  assert.equal(pak.getValue(0, 500), -1);
  assert.equal(pak.setValue(3, 3, 77), true);
  assert.equal(pak.getValue(3, 3), 77);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('maps: full corpus - 62 regions, 45 populated, every location decodes', { skip: skipReal }, () => {
  const m = loadMaps();
  m.autoDiscard = false;
  assert.equal(m.regionCount, 62);

  let totalLocations = 0;
  let totalDungeons = 0;
  const empty = [];
  for (let region = 0; region < m.regionCount; region++) {
    const dfr = m.getRegion(region);
    if (!dfr) {
      empty.push(region);
      continue;
    }
    totalLocations += dfr.locationCount;
    assert.equal(dfr.mapNames.length, dfr.locationCount);
    assert.equal(dfr.mapTable.length, dfr.locationCount);
    for (let loc = 0; loc < dfr.locationCount; loc++) {
      const l = m.getLocation(region, loc);
      assert.ok(l && l.loaded, `${REGION_NAMES[region]} location ${loc}`);
      if (l.hasDungeon) totalDungeons++;
      const ext = l.exterior.exteriorData;
      assert.equal(ext.blockNames.length, ext.width * ext.height, `${l.name}: block grid`);
      for (const n of ext.blockNames) {
        assert.match(n, /\.RMB$/, `${l.name}: block name ${n}`);
      }
    }
  }

  // The 17 empty regions match classic (62 total, 45 populated).
  assert.deepEqual(empty, EMPTY_REGIONS);
  assert.equal(totalLocations, 15251);
  assert.equal(totalDungeons, 4232);
});

test('maps: 32-byte map names truncate exactly where DFU documents', { skip: skipReal }, () => {
  const m = loadMaps();
  const bhoriane = m.getRegionByName('Bhoriane');
  assert.ok(bhoriane.mapNames.includes('The Unfortunate Porcupine Hostel'));
  const kambria = m.getRegionByName('Kambria');
  assert.ok(kambria.mapNames.includes('The Feather and Barbarian Tavern'));
  assert.equal('The Unfortunate Porcupine Hostel'.length, 32);
  assert.equal('The Feather and Barbarian Tavern'.length, 32);
});

test('maps: Daggerfall city pinned', { skip: skipReal }, () => {
  const m = loadMaps();
  const region = m.getRegion(17);
  assert.equal(region.locationCount, 1331);

  const dag = m.getLocationByName('Daggerfall', 'Daggerfall');
  assert.equal(dag.regionIndex, 17);
  assert.equal(dag.locationIndex, 1231);
  assert.equal(dag.mapTableData.locationType, LOCATION_TYPES.TownCity);
  assert.equal(dag.exterior.exteriorData.width, 8);
  assert.equal(dag.exterior.exteriorData.height, 8);
  assert.equal(dag.exterior.buildingCount, 316);
  assert.equal(dag.exterior.exteriorData.blockNames[0], 'WALLAA02.RMB');
  assert.equal(dag.hasDungeon, true); // castle dungeon
  assert.equal(dag.politic, 17 + 128); // politic equals region index + 128
  assert.equal(dag.climate.worldClimate, CLIMATES.Woodlands);
  assert.equal(m.getRmbBlockName(dag, 0, 0), 'WALLAA02.RMB');

  // Fast id read matches the full record element.
  assert.equal(
    m.readLocationIdFast(17, 1231),
    dag.exterior.recordElement.header.locationId
  );
});

test("maps: Privateer's Hold starting dungeon pinned", { skip: skipReal }, () => {
  const m = loadMaps();
  const priv = m.getLocationByName('Daggerfall', "Privateer's Hold");
  assert.ok(priv && priv.hasDungeon);
  assert.equal(priv.dungeon.blocks.length, 5); // 1 interior + 4 borders
  const start = priv.dungeon.blocks.find((b) => b.isStartingBlock);
  assert.deepEqual(
    { x: start.x, z: start.z, blockName: start.blockName },
    { x: 0, z: 0, blockName: 'S0000999.RDB' }
  );
  const borders = priv.dungeon.blocks.filter((b) => b.blockName.startsWith('B'));
  assert.equal(borders.length, 4);
});
