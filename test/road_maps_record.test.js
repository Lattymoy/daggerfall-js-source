// road/maps-record - the MAPS verification sweep's nine surviving
// mismatches, each rewritten claim pinned.
//
// Two kinds of pin here, on purpose:
//   SOURCE pins run everywhere, including CI with no ARENA2. They hold the
//   corrected COMMENT to the file, so a rewrite that quietly puts the old
//   wrong sentence back goes red.
//   DATA pins are gated on the real MAPS.BSA and hold the corrected FACT to
//   the bytes. CLIMATE.PAK and POLITIC.PAK are not needed by anything below,
//   so the two PakFile loads are stubbed and the gate asks for MAPS.BSA only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  MapsFile, REGION_NAMES, LOCATION_TYPES,
  longitudeLatitudeToMapPixel, getMapPixelID,
} from '../src/formats/mapsFile.js';
import { BsaFile } from '../src/formats/bsaFile.js';
import { OFFSET_LOOKUP, hasRegionPage, getRegionMapNames } from '../src/ui/travelMapWindow.js';
import { CUSTOM_LOCATION_OFFSET } from '../src/ui/exteriorAutomapWindow.js';
import { hasCustomLocationPosition } from '../src/world/locationLayout.js';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const skipReal = !existsSync(join(ARENA2, 'MAPS.BSA'))
  ? 'ARENA2_PATH/MAPS.BSA not present - MAPS data pins skipped'
  : false;

/** MAPS.BSA alone: the PAKs are a separate download and nothing below
 *  reads a climate or politic value, so their loaders are stubbed. */
function loadMapsOnly() {
  const m = new MapsFile();
  m.climatePak.load = () => true;
  m.politicPak.load = () => true;
  assert.equal(m.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), null, null), true);
  return m;
}

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const MAPS_SRC = src('../src/formats/mapsFile.js');
const BSA_SRC = src('../src/formats/bsaFile.js');
const TRAVEL_SRC = src('../src/ui/travelMapWindow.js');
const AUTOMAP_SRC = src('../src/ui/exteriorAutomapWindow.js');

// ---------------------------------------------------------------------------
// SOURCE pins - no ARENA2 needed.
// ---------------------------------------------------------------------------

test('maps-record: the exterior-automap custom-location set is eight dungeon exteriors, not towns', () => {
  assert.deepEqual([...CUSTOM_LOCATION_OFFSET], [-64, 3]);   // ExteriorAutomap.cs:1391-1395
  assert.ok(!/CUST-prefixed 1x1 towns/.test(AUTOMAP_SRC),
    'the retracted claim must not come back');
  for (const name of ['Scourg Barrow', 'Direnni Tower', 'Shedungent', "Privateer's Hold",
    'Woodborne Hall', 'Orsinium', "Lysandus' Tomb", 'Castle Llugwych']) {
    assert.ok(AUTOMAP_SRC.includes(name), `the comment names ${name}`);
  }
  assert.ok(/locationType 4 \(DungeonLabyrinth\)/.test(AUTOMAP_SRC));
  assert.ok(/Zero towns take the correction/.test(AUTOMAP_SRC));
});

test('maps-record: the 32-byte name run is intra-record, and the comment says so', () => {
  assert.ok(!/overflows? into the next record/.test(MAPS_SRC),
    'the header no longer claims the read leaves the record');
  assert.ok(!/prevent overflow into the next record/.test(MAPS_SRC),
    '_readMapNames no longer claims the cap protects the record');
  assert.ok(/swallows the NEXT NAME SLOT/.test(MAPS_SRC));
  assert.ok(/never leaves the record/.test(MAPS_SRC));
  // the cap itself is still there, and is still what the pin below measures
  assert.ok(/mapName\.length > 32.*\n?.*mapName\.slice\(0, 32\)/.test(MAPS_SRC)
    || MAPS_SRC.includes('mapName = mapName.slice(0, 32)'));
});

test('maps-record: region 31 is pageless in DFU too, and the comment stops calling it empty', () => {
  assert.equal(OFFSET_LOOKUP['FMAP0I31.IMG'], undefined,
    "DFU's own offset table has no page for High Rock sea coast");
  assert.deepEqual(getRegionMapNames(31), ['FMAP0I31.IMG']);
  assert.equal(hasRegionPage(31), false);
  assert.equal(REGION_NAMES[31], 'High Rock sea coast');
  assert.ok(!/nothing normally clicks them/.test(TRAVEL_SRC),
    'the retracted characterisation must not come back');
  assert.ok(/Mantellan Crux/.test(TRAVEL_SRC) && /Your Ship/.test(TRAVEL_SRC));
  // what DFU does for a ship moored there
  assert.ok(/TransportManager\.cs:368-397/.test(TRAVEL_SRC));
  assert.ok(/GetPlayerRegion \(:1609-1617\)/.test(TRAVEL_SRC));
});

test('maps-record: the clamped C-string scan is recorded as a departure, not as verbatim', () => {
  assert.ok(!/unbounded, as DFU's ReadCStringSkip/.test(MAPS_SRC));
  assert.ok(/EndOfStreamException/.test(MAPS_SRC),
    'the comment states what DFU does instead of clamping');
  assert.ok(/end < bytes\.byteLength/.test(MAPS_SRC), 'the clamp is still the code');
});

test('maps-record: the BSA name-field bound is recorded as a departure, not as verbatim', () => {
  assert.ok(!/Logic and constants kept verbatim;/.test(BSA_SRC),
    'the unqualified verbatim claim is narrowed');
  assert.ok(/kept verbatim with ONE measured\n\/\/ exception/.test(BSA_SRC));
  assert.ok(/UNBOUNDED/.test(BSA_SRC) && /BsaFile\.cs:400/.test(BSA_SRC));
});

test('maps-record: readLocationIdFast records the dropped WorldDataReplacement arm', () => {
  assert.ok(/MapsFile\.cs:1133-1137/.test(MAPS_SRC));
  assert.ok(/the early return is unreachable rather than missing/.test(MAPS_SRC));
  // the reason it is unreachable is a literal in this same file
  assert.ok(/\n\s+locationId: 0,\n/.test(MAPS_SRC),
    '_readMapTable still hard-codes locationId 0');
});

test('maps-record: loadRegion records its memoization', () => {
  assert.ok(/C# LoadRegion has NO cache check/.test(MAPS_SRC));
  assert.ok(/at most one region resident/.test(MAPS_SRC));
});

test('maps-record: the header lists the unported MapsFile members and their DFU callers', () => {
  for (const member of ['GetMapPixelIDFromLongitudeLatitude', 'WorldCoordToLongitudeLatitude',
    'SetClimateIndex', 'SetPoliticIndex', 'DefaultClimateSettings',
    'ResolveRmbBlockName(dfLocation, x, y)', 'LoadRegion(string)', 'MinMapPixelX/Y']) {
    assert.ok(MAPS_SRC.includes(member), `the Not-ported list names ${member}`);
  }
  // the one with live DFU callers carries them, and the port's substitute
  assert.ok(/PlayerGPS\.cs:855, 879, 936, 993,\n\/\/\s+1045, 1073, 1146, 1201/.test(MAPS_SRC));
  assert.ok(/mapId & 0xfffff/.test(MAPS_SRC));
});

test('maps-record: the null-on-failure contract is recorded and holds', () => {
  assert.ok(/return\n\/\/\s+NULL on failure where C# returns a default-constructed/.test(MAPS_SRC));
  // an unloaded MapsFile has regionCount 0, so every accessor takes its
  // failure arm - and every one answers null, never a default object.
  const m = new MapsFile();
  assert.equal(m.regionCount, 0);
  assert.equal(m.getRegion(0), null);
  assert.equal(m.getRegionByName('Daggerfall'), null);
  assert.equal(m.getLocation(0, 0), null);
  assert.equal(m.getLocationByName('Daggerfall', 'Daggerfall'), null);
});

// ---------------------------------------------------------------------------
// DATA pins - real MAPS.BSA only (the PAK loads are stubbed above).
// ---------------------------------------------------------------------------

test('maps-record DATA: exactly eight CUST locations, all DungeonLabyrinth', { skip: skipReal }, () => {
  const m = loadMapsOnly();
  const found = [];
  for (let r = 0; r < m.regionCount; r++) {
    if (!m.loadRegion(r)) continue;
    const region = m.getRegion(r);
    for (let l = 0; l < region.locationCount; l++) {
      const loc = m.getLocation(r, l);
      if (!loc || !hasCustomLocationPosition(loc)) continue;
      found.push({
        name: loc.name,
        region: REGION_NAMES[r],
        type: loc.mapTableData.locationType,
        block: loc.exterior.exteriorData.blockNames[0],
      });
    }
  }
  assert.equal(found.length, 8);
  assert.deepEqual(found.map((f) => f.type), new Array(8).fill(LOCATION_TYPES.DungeonLabyrinth));
  assert.deepEqual(
    found.map((f) => `${f.region}/${f.name}/${f.block}`).sort(),
    [
      'Daggerfall/Privateer\'s Hold/CUSTAA30.RMB',
      'Dragontail Mountains/Scourg Barrow/CUSTAA10.RMB',
      'Isle of Balfiera/Direnni Tower/CUSTAA06.RMB',
      'Menevia/Lysandus\' Tomb/CUSTAA08.RMB',
      'Orsinium Area/Orsinium/CUSTAA09.RMB',
      'Wayrest/Woodborne Hall/CUSTAA29.RMB',
      'Wrothgarian Mountains/Shedungent/CUSTAA19.RMB',
      'Ykalon/Castle Llugwych/CUSTAA07.RMB',
    ]);
});

test('maps-record DATA: the two unterminated name runs stay inside their MAPNAMES record', { skip: skipReal }, () => {
  const m = loadMapsOnly();
  const runs = [];
  let reachedRecordEnd = 0;
  for (let r = 0; r < m.regionCount; r++) {
    if (!m.loadRegion(r)) continue;
    const region = m.getRegion(r);
    const bytes = m._regions[r].mapNames;
    for (let i = 0; i < region.locationCount; i++) {
      const start = 4 + 32 * i;
      let end = start;
      while (end < bytes.byteLength && bytes[end] !== 0) end++;
      if (end - start < 32) continue;              // terminated inside the stride
      if (end >= bytes.byteLength) reachedRecordEnd++;
      let raw = '';
      for (let k = start; k < end; k++) raw += String.fromCharCode(bytes[k]);
      runs.push({
        region: REGION_NAMES[r], index: i, recordLength: bytes.byteLength,
        start, end, raw, name: region.mapNames[i], next: region.mapNames[i + 1],
      });
    }
  }
  assert.equal(runs.length, 2, 'exactly two slots fill all 32 bytes');
  assert.equal(reachedRecordEnd, 0, 'neither run reaches the end of its record');
  assert.deepEqual(runs, [
    {
      region: 'Bhoriane', index: 61, recordLength: 6084, start: 1956, end: 2009,
      raw: 'The Unfortunate Porcupine HostelThe Yeomsley Cemetery',
      name: 'The Unfortunate Porcupine Hostel', next: 'The Yeomsley Cemetery',
    },
    {
      region: 'Kambria', index: 270, recordLength: 9924, start: 8644, end: 8701,
      raw: 'The Feather and Barbarian TavernGentle Martyr of Zenithar',
      name: 'The Feather and Barbarian Tavern', next: 'Gentle Martyr of Zenithar',
    },
  ]);
  // what the cap protects is the NAME; the stride is what protects the next
  // one, and both next names came out whole above.
});

test('maps-record DATA: the clamp in _readCStringSkip never fires on classic data', { skip: skipReal }, () => {
  // Same sweep, stated as the equivalence the comment claims: DFU's unbounded
  // scan would only diverge by throwing, and it never reaches a record end.
  const m = loadMapsOnly();
  let slots = 0;
  for (let r = 0; r < m.regionCount; r++) {
    if (!m.loadRegion(r)) continue;
    const region = m.getRegion(r);
    const bytes = m._regions[r].mapNames;
    assert.equal(bytes.byteLength, 4 + 32 * region.locationCount);
    for (let i = 0; i < region.locationCount; i++) {
      slots++;
      let end = 4 + 32 * i;
      while (end < bytes.byteLength && bytes[end] !== 0) end++;
      assert.ok(end < bytes.byteLength, `slot ${i} of ${REGION_NAMES[r]} terminates in-record`);
    }
  }
  assert.equal(slots, 15251);
});

test('maps-record DATA: region 31 holds Mantellan Crux and both ship moorings', { skip: skipReal }, () => {
  const m = loadMapsOnly();
  const PAGELESS = [2, 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 24, 25, 27, 28, 29, 30, 31];
  assert.deepEqual(
    [...Array(62).keys()].filter((r) => !hasRegionPage(r)), PAGELESS,
    'the eighteen pageless regions are unchanged');

  // seventeen empty, one not
  const loadable = PAGELESS.filter((r) => m.loadRegion(r));
  assert.deepEqual(loadable, [31]);

  const region = m.getRegion(31);
  assert.equal(region.locationCount, 3);
  const rows = [];
  for (let l = 0; l < 3; l++) {
    const loc = m.getLocation(31, l);
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    rows.push({
      name: loc.name, mapId: loc.mapTableData.mapId, type: loc.mapTableData.locationType,
      pixel: `${p.x},${p.y}`, block: loc.exterior.exteriorData.blockNames[0],
      hasDungeon: loc.hasDungeon,
    });
  }
  assert.deepEqual(rows, [
    { name: 'Mantellan Crux', mapId: 1001, type: LOCATION_TYPES.DungeonLabyrinth,
      pixel: '1,1', block: 'DUNGAA00.RMB', hasDungeon: true },
    { name: 'Your Ship', mapId: 1050578, type: LOCATION_TYPES.HomeYourShips,
      pixel: '2,2', block: 'SHIPAA00.RMB', hasDungeon: false },
    { name: 'Your Ship', mapId: 2102157, type: LOCATION_TYPES.HomeYourShips,
      pixel: '5,5', block: 'SHIPAA01.RMB', hasDungeon: false },
  ]);
});

test('maps-record DATA: no BSA directory name fills the 14-byte field', { skip: skipReal }, () => {
  const bytes = new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA')));
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 248);
  const dirStart = bytes.byteLength - 18 * bsa.count;
  let longest = 0;
  for (let i = 0; i < bsa.count; i++) {
    const p = dirStart + 18 * i;
    let n = 0;
    while (n < 14 && bytes[p + n] !== 0) n++;
    assert.ok(n < 14, `entry ${i} terminates inside the name field`);
    longest = Math.max(longest, n);
  }
  assert.equal(longest, 12, 'the "MAPXITEM.NNN" form is the longest name in the file');
});

test('maps-record DATA: the dropped readLocationIdFast arm is unreachable, and the walk agrees', { skip: skipReal }, () => {
  const m = loadMapsOnly();
  let checked = 0;
  for (let r = 0; r < m.regionCount; r++) {
    if (!m.loadRegion(r)) continue;
    const region = m.getRegion(r);
    for (let l = 0; l < region.locationCount; l++) {
      assert.equal(region.mapTable[l].locationId, 0);   // C#'s early return can never fire
      const loc = m.getLocation(r, l);
      assert.equal(m.readLocationIdFast(r, l), loc.exterior.recordElement.header.locationId);
      checked++;
    }
  }
  assert.equal(checked, 15251);
});

test('maps-record DATA: loadRegion memoizes without breaking the resident-count invariant', { skip: skipReal }, () => {
  const m = loadMapsOnly();
  assert.equal(m.autoDiscard, true);
  const resident = () => m._regions.filter((r) => r !== null).length;

  assert.equal(m.loadRegion(17), true);
  const first = m.getRegion(17);
  assert.equal(resident(), 1);
  assert.equal(m.loadRegion(17), true);              // the memoized arm
  assert.equal(m.getRegion(17), first, 'same object, not a re-read');
  assert.equal(resident(), 1);

  assert.equal(m.loadRegion(20), true);              // a different region still discards
  assert.equal(resident(), 1);
  assert.equal(m.loadRegion(17), true);              // and 17 re-reads from bytes
  const second = m.getRegion(17);
  assert.notEqual(second, first);
  assert.equal(resident(), 1);
  assert.deepEqual(second.mapNames, first.mapNames, 'the re-read decodes identically');
  assert.deepEqual(second.mapTable, first.mapTable);
});

test('maps-record DATA: the port needs no GetMapPixelIDFromLongitudeLatitude', { skip: skipReal }, () => {
  // The omission is safe because discovery.js's key IS the same number:
  // mapId & 0xfffff === getMapPixelID(longitudeLatitudeToMapPixel(lon, lat)).
  const m = loadMapsOnly();
  let checked = 0;
  for (let r = 0; r < m.regionCount; r++) {
    if (!m.loadRegion(r)) continue;
    const region = m.getRegion(r);
    for (let l = 0; l < region.locationCount; l++) {
      const row = region.mapTable[l];
      const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      assert.equal(row.mapId & 0xfffff, getMapPixelID(p.x, p.y));
      checked++;
    }
  }
  assert.equal(checked, 15251);
});
