// RR3b - Roleplay & Realism 1.8 (Hazelnut): the Master Armorer quest
// line's WORLD DATA - Northrock Fort (locationnew-RRfort01-16.json, a
// new location in the Wrothgarian Mountains), its block (RRFORT01.RMB.
// json) and the armorer's shop as the quest rebuilds it (ARMRAM03.RMB-
// 765-building14_master.json) - through WorldDataReplacement.cs, ported
// whole as formats/worldDataReplacement.js: the door MapsFile and
// BlocksFile ask (MapsFile.cs:984, :999, :1027; BlocksFile.cs:214, :273,
// :385, :850), the converters from DFU's JSON to the port's reader
// shapes, RMBLayout's replacement arm and the save file's variants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerWorldDataAsset, installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement, assetInjectionOn,
  regionReplacementFilename, locationReplacementFilename, blockReplacementFilename, buildingReplacementFilename,
  getNewDFLocationIndex, getDFRegionAdditionalLocationData, getDFLocationReplacementData, loadNewDFLocationVariant,
  getNewDFBlockIndex, getNewDFBlockName, getDFBlockReplacementData, getBuildingReplacementData, applyBuildingReplacementAutoMapData,
  locationFromJson, blockFromJson, buildingReplacementFromJson, groundDataFromJson, rmbBlockDataFromJson, AUTO_MAP_DATA_SIZE, makeLocationKey,
} from '../src/formats/worldDataReplacement.js';
import { worldDataDoor, setWorldDataDoor } from '../src/formats/worldDataDoor.js';
import { setBuildingVariant, setBlockVariant, setLastLocationKeyTo, setNewLocationVariant, setNewLocationIndexResolver, clearWorldDataVariants, NO_VARIANT } from '../src/systems/worldDataVariants.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { longitudeLatitudeToMapPixel, LOCATION_TYPES, DUNGEON_TYPES, CLIMATES, FACTION_RACES } from '../src/formats/mapsFile.js';
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { mergeNamedBuildings } from '../src/systems/talkTopics.js';
import { RR_ARMORER_BLOCK, RR_ARMORER_RECORD, rrMasterArmBuildingKey } from '../src/systems/rrQuestLine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const WD = 'vendor/roleplay-realism/WorldData';
const FILES = ['locationnew-RRfort01-16.json', 'RRFORT01.RMB.json', 'ARMRAM03.RMB-765-building14_master.json'];
const json = (n) => JSON.parse(rd(`${WD}/${n}`));
const LOC = json(FILES[0]), BLK = json(FILES[1]), BLD = json(FILES[2]);
const BSA_COUNT = 1000;
const fakeBlocks = (classic = {}) => ({ count: BSA_COUNT, getBlockIndex: (n) => classic[n] ?? -1 });
const fakeRegion = () => ({ name: 'Wrothgarian Mountains', locationCount: 2, mapNames: ['Aldleigh', 'Bhoriane'], mapTable: [{ mapId: 1, locationId: 0 }, { mapId: 2, locationId: 0 }], mapNameLookup: new Map([['Aldleigh', 0], ['Bhoriane', 1]]), mapIdLookup: new Map([[1, 0], [2, 1]]) });
const fresh = ({ bind = true } = {}) => {
  _resetWorldDataReplacement(); clearWorldDataVariants(); resetToDefaults();
  setValue('Enhancements', 'AssetInjection', 'True');
  for (const n of FILES) registerWorldDataAsset(n, json(n));
  installWorldDataReplacement();
  if (bind) bindWorldDataBlocks(fakeBlocks());
};

test('RR3b the record: the three files vendored verbatim, DFU\'s file names, the quest\'s three `_master` lines at the three shops', () => {
  const author = '/home/user/dfunity-mods/RoleplayRealism/WorldData';
  for (const n of FILES) {
    assert.ok(existsSync(join(ROOT, WD, n)), n);
    if (existsSync(author)) assert.equal(rd(`${WD}/${n}`), readFileSync(join(author, n), 'utf8'), `${n}: verbatim`);
  }
  assert.equal(regionReplacementFilename(16), 'region-16.json');
  assert.equal(locationReplacementFilename(16, 2), 'location-16-2.json');
  assert.equal(locationReplacementFilename(16, 2, '_v'), 'location-16-2_v.json');
  assert.equal(blockReplacementFilename('RRFORT01.RMB'), 'RRFORT01.RMB.json');
  assert.equal(buildingReplacementFilename('ARMRAM03.RMB', 765, 14, '_master'), FILES[2]);
  const q = rd('vendor/roleplay-realism/Quests/RRMSTARM1.txt');
  const lines = [...q.matchAll(/worldupdate building ARMRAM03\.RMB 14 at (\d+) in region (\d+) variant (\S+)/g)].map((m) => [Number(m[2]), Number(m[1]), m[3]]);
  assert.deepEqual(lines, [[52, 240, '_master'], [18, 33, '_master'], [48, 44, '_master']], 'Pjiga, Penmore, Paponirea - the three regions the building key knows');
  for (const [region] of lines) assert.notEqual(rrMasterArmBuildingKey(region), 0);
  assert.equal(RR_ARMORER_BLOCK, 'ARMRAM03.RMB'); assert.equal(RR_ARMORER_RECORD, 14);
  assert.equal(AUTO_MAP_DATA_SIZE, 4096);
});

// ---- the converters -------------------------------------------------------------
test('RR3b the location converter: Northrock Fort in the port\'s DFLocation shape - the pixel, the enums, the climate by the world climate, the building, the block names', () => {
  const loc = locationFromJson(LOC);
  assert.equal(loc.name, 'Northrock Fort'); assert.equal(loc.regionName, 'Wrothgarian Mountains'); assert.equal(loc.regionIndex, 16);
  assert.equal(loc.loaded, true); assert.equal(loc.hasDungeon, false); assert.equal(loc.politic, 144, 'region + 128');
  assert.deepEqual(longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude), { x: 938, y: 51 }, 'the fort\'s pixel - the tracks\' centre');
  assert.equal(loc.mapTableData.mapId, 51938);
  assert.equal(loc.mapTableData.locationType, LOCATION_TYPES.ReligionCult, '"ReligionCult" spelled');
  assert.equal(loc.mapTableData.dungeonType, DUNGEON_TYPES.NoDungeon, '"NoDungeon" spelled');
  assert.equal(loc.mapTableData.discovered, false); assert.equal(loc.mapTableData.locationId, 0, 'AddLocationToRegion copies it in');
  assert.equal(loc.climate.worldClimate, CLIMATES.Mountain); assert.equal(loc.climate.people, FACTION_RACES.Nord);
  assert.equal(loc.climate.groundArchive, LOC.Climate.GroundArchive, 'the port\'s table agrees with the JSON\'s inline fields');
  assert.equal(loc.climate.natureArchive, LOC.Climate.NatureArchive); assert.equal(loc.climate.skyBase, LOC.Climate.SkyBase);
  const h = loc.exterior.recordElement.header;
  assert.equal(h.locationId, 0x73A0, 'Northrock_Fort_Ext\'s p1'); assert.equal(h.x, 30736384); assert.equal(h.y, 14680064); assert.equal(h.isExterior, 32768); assert.equal(h.locationName, 'Northrock Fort');
  assert.equal(loc.exterior.recordElement.doorCount, 0);
  assert.equal(loc.exterior.buildingCount, 1);
  const b = loc.exterior.buildings[0];
  assert.equal(b.locationId, 0x73A1, 'Northrock_Fort\'s p1 - the building the quest walks into');
  assert.equal(b.factionId, 852); assert.equal(b.buildingType, BUILDING_TYPES.House6, '"House6" spelled'); assert.equal(b.quality, 11); assert.equal(b.nameSeed, 6248);
  assert.equal(b.serviceTimeLimit, 0, 'the 26-byte record whole');
  const ed = loc.exterior.exteriorData;
  assert.equal(ed.anotherName, 'Northrock Fort'); assert.equal(ed.mapId, 51938); assert.equal(ed.width, 1); assert.equal(ed.height, 1); assert.equal(ed.portTownAndUnknown, 0);
  assert.deepEqual(ed.blockNames, ['RRFORT01.RMB']);
  assert.deepEqual(loc.dungeon, { recordElement: null, header: null, blocks: null });
  assert.equal(locationFromJson({ Name: 'x' }, 3).regionName, 'Daggerfall Bluffs', 'a bare record: the region\'s name, the defaults');
});

test('RR3b the block converter: RRFORT01.RMB in the port\'s DFBlock shape - the FLD header from the subrecords, the ground data un-flattened y-outer x-inner, every record kind', () => {
  const blk = blockFromJson(BLK, 1000);
  assert.equal(blk.name, 'RRFORT01.RMB'); assert.equal(blk.index, 1000); assert.equal(blk.type, BLOCK_TYPES.Rmb); assert.equal(blk.position, BLK.Position);
  const fh = blk.rmbBlock.fldHeader;
  assert.equal(fh.numBlockDataRecords, 1); assert.equal(fh.numMisc3dObjectRecords, 0); assert.equal(fh.numMiscFlatObjectRecords, 4);
  assert.equal(fh.blockPositions.length, 32);
  assert.deepEqual(fh.blockPositions[0], { unknown1: 0, unknown2: 0, xPos: BLK.RmbBlock.SubRecords[0].XPos, zPos: BLK.RmbBlock.SubRecords[0].ZPos, yRotation: BLK.RmbBlock.SubRecords[0].YRotation });
  assert.equal(fh.buildingDataList.length, 32, 'the 32-slot list, the JSON\'s entries first');
  assert.equal(fh.buildingDataList[0].factionId, 852); assert.equal(fh.buildingDataList[0].buildingType, BUILDING_TYPES.House6); assert.equal(fh.buildingDataList[0].quality, 18);
  assert.equal(fh.buildingDataList[1].buildingType, -1, 'AUDIT-RR2 G19: the padding is None');
  assert.equal(fh.name, BLK.RmbBlock.FldHeader.Name); assert.equal(fh.otherNames, null);
  assert.ok(fh.autoMapData instanceof Uint8Array); assert.equal(fh.autoMapData.length, 4096);
  assert.ok(fh.groundData.header instanceof Uint8Array); assert.equal(fh.groundData.header.length, 8);
  // DFBlock.RmbGroundDataConverter (DFBlock.cs:1124-1185): flattened y-outer, x-inner
  const T = BLK.RmbBlock.FldHeader.GroundData.GroundTiles;
  for (const [x, y] of [[0, 0], [3, 2], [15, 0], [0, 15], [7, 9]]) {
    const src = T[y * 16 + x];
    assert.deepEqual(fh.groundData.groundTiles[x][y], { tileBitfield: src.TileBitfield, textureRecord: src.TextureRecord, isRotated: src.IsRotated, isFlipped: src.IsFlipped }, `tile ${x},${y}`);
  }
  const S = BLK.RmbBlock.FldHeader.GroundData.GroundScenery;
  const sc = fh.groundData.groundScenery[5][11];
  assert.equal(sc.textureRecord, S[11 * 16 + 5].TextureRecord);
  assert.equal(sc.tileBitfield, sc.textureRecord < 0 ? 255 : (sc.textureRecord + 1) * 4, 'the reader\'s bitfield, inverted');
  const sub = blk.rmbBlock.subRecords[0];
  assert.deepEqual([sub.xPos, sub.zPos, sub.yRotation], [BLK.RmbBlock.SubRecords[0].XPos, BLK.RmbBlock.SubRecords[0].ZPos, BLK.RmbBlock.SubRecords[0].YRotation]);
  assert.equal(sub.exterior.block3dObjectRecords.length, 18); assert.equal(sub.exterior.header.num3dObjectRecords, BLK.RmbBlock.SubRecords[0].Exterior.Header.Num3dObjectRecords, 'the header as the JSON wrote it (1 here, against 18 records - DFU walks the array, and so does the port)');
  assert.equal(sub.interior.block3dObjectRecords.length, 73); assert.equal(sub.interior.blockFlatObjectRecords.length, 40);
  assert.equal(sub.interior.blockSection3Records.length, 50); assert.equal(sub.interior.blockPeopleRecords.length, 2); assert.equal(sub.interior.blockDoorRecords.length, 6);
  const m0 = BLK.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords[0], m = sub.exterior.block3dObjectRecords[0];
  assert.equal(m.modelId, String(m0.ModelId)); assert.equal(m.modelIdNum, m0.ModelIdNum); assert.equal(m.objectType, m0.ObjectType);
  assert.deepEqual([m.xPos, m.yPos, m.zPos, m.xRotation, m.yRotation, m.zRotation], [m0.XPos, m0.YPos, m0.ZPos, m0.XRotation, m0.YRotation, m0.ZRotation]);
  assert.equal(m.xPos1, 0, 'the fields the JSON does not carry are zero');
  const f0 = BLK.RmbBlock.SubRecords[0].Interior.BlockFlatObjectRecords[0], f = sub.interior.blockFlatObjectRecords[0];
  assert.deepEqual([f.textureArchive, f.textureRecord, f.factionID, f.flags, f.position], [f0.TextureArchive, f0.TextureRecord, f0.FactionID, f0.Flags, f0.Position]);
  assert.equal(f.textureBitfield, ((f0.TextureArchive << 7) | f0.TextureRecord) & 0xffff, 'the bitfield the reader keeps, rebuilt');
  const p = sub.interior.blockPeopleRecords[0], p0 = BLK.RmbBlock.SubRecords[0].Interior.BlockPeopleRecords[0];
  assert.equal(p.textureArchive, p0.TextureArchive); assert.equal(p.factionID, p0.FactionID);
  const d = sub.interior.blockDoorRecords[0], d0 = BLK.RmbBlock.SubRecords[0].Interior.BlockDoorRecords[0];
  assert.deepEqual([d.xPos, d.yPos, d.zPos, d.yRotation, d.openRotation, d.doorModelIndex], [d0.XPos, d0.YPos, d0.ZPos, d0.YRotation, d0.OpenRotation, 0]);
  assert.equal(blk.rmbBlock.miscFlatObjectRecords.length, 4); assert.equal(blk.rmbBlock.misc3dObjectRecords.length, 0);
  assert.equal(blk.rdbBlock, null);
  assert.equal(blockFromJson({ Name: 'X.RMB' }, 7).type, BLOCK_TYPES.Rmb, 'a nameless type: by the extension');
  assert.deepEqual(rmbBlockDataFromJson(null).header.num3dObjectRecords, 0);
  assert.equal(groundDataFromJson(null).groundTiles[15][15].textureRecord, 0);
});

test('RR3b the building converter: the armorer\'s shop - faction 1022, an Armorer of quality 20, seed 632, the rebuilt interior, its automap', () => {
  const b = buildingReplacementFromJson(BLD);
  assert.equal(b.factionId, 1022); assert.equal(b.buildingType, BUILDING_TYPES.Armorer); assert.equal(b.quality, 20); assert.equal(b.nameSeed, 632);
  assert.deepEqual([b.rmbSubRecord.xPos, b.rmbSubRecord.zPos, b.rmbSubRecord.yRotation], [640, 384, 512]);
  assert.equal(b.rmbSubRecord.exterior.block3dObjectRecords.length, 1);
  assert.equal(b.rmbSubRecord.interior.block3dObjectRecords.length, 33); assert.equal(b.rmbSubRecord.interior.blockFlatObjectRecords.length, 21);
  assert.equal(b.rmbSubRecord.interior.blockPeopleRecords.length, 2); assert.equal(b.rmbSubRecord.interior.blockDoorRecords.length, 2);
  assert.ok(b.autoMapData instanceof Uint8Array); assert.equal(b.autoMapData.length, 4096);
  assert.equal(buildingReplacementFromJson({}).autoMapData, null);
  // ApplyBuildingReplacementAutoMapData (:494-508): 30 means "leave it"
  const block = new Uint8Array(4096).fill(7);
  const data = { autoMapData: new Uint8Array(4096).fill(30) };
  data.autoMapData[5] = 1; data.autoMapData[4095] = 0;
  applyBuildingReplacementAutoMapData(data, block);
  assert.equal(block[5], 1); assert.equal(block[4095], 0); assert.equal(block[6], 7, 'a 30 leaves the block\'s own byte');
  applyBuildingReplacementAutoMapData({ autoMapData: new Uint8Array(10) }, block);
  assert.equal(block[0], 7, 'a wrong-sized map is ignored');
  applyBuildingReplacementAutoMapData({ autoMapData: null }, block);
});

// ---- the door ----------------------------------------------------------------
test('RR3b the region: the fort added to region 16 with its index and id, cached and re-laid on a re-read region, another region none, the gate', () => {
  fresh();
  assert.equal(assetInjectionOn(), true);
  const region = fakeRegion();
  assert.equal(getDFRegionAdditionalLocationData(16, region), true);
  assert.equal(region.locationCount, 3); assert.equal(region.mapNames[2], 'Northrock Fort');
  assert.equal(region.mapTable[2].mapId, 51938); assert.equal(region.mapTable[2].locationId, 0x73A0, 'the id ReadLocationIdFast reads instead of peeking the BSA');
  assert.equal(region.mapNameLookup.get('Northrock Fort'), 2); assert.equal(region.mapIdLookup.get(51938), 2);
  assert.equal(getNewDFLocationIndex(16, 'Northrock Fort'), 2); assert.equal(getNewDFLocationIndex(16, 'nowhere'), -1); assert.equal(getNewDFLocationIndex(17, 'Northrock Fort'), -1);
  // a re-read of the same region (the reader rebuilt its own from the BSA) gets the cached additions laid on again
  const again = fakeRegion();
  assert.equal(getDFRegionAdditionalLocationData(16, again), true);
  assert.equal(again.locationCount, 3); assert.equal(again.mapNames[2], 'Northrock Fort'); assert.equal(again.mapIdLookup.get(51938), 2);
  assert.equal(getDFRegionAdditionalLocationData(17, fakeRegion()), false, 'no file for region 17');
  registerWorldDataAsset('locationnew-late-17.json', { ...LOC, Name: 'Late Fort', RegionIndex: 17 });
  assert.equal(getDFRegionAdditionalLocationData(17, fakeRegion()), false, 'cached as none - a file landing later is not seen (only look for added locations once per region)');
  // the new location by its index (AddLocationToRegion stored it under its key)
  const loc = getDFLocationReplacementData(16, 2);
  assert.equal(loc.name, 'Northrock Fort'); assert.equal(loc.locationIndex, 2); assert.equal(loc.exterior.recordElement.header.unknown2, 2, 'Unknown2 = locationIndex');
  assert.equal(getDFLocationReplacementData(16, 2), loc, 'the same record');
  assert.equal(getDFLocationReplacementData(16, 0), null, 'a classic index: no file');
  assert.equal(getDFLocationReplacementData(16, 0), null, 'cached as none');
  // the gate
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(getDFRegionAdditionalLocationData(16, fakeRegion()), false);
  assert.equal(getDFLocationReplacementData(16, 2), null);
  setValue('Enhancements', 'AssetInjection', 'True');
  // the mod's switch: an asset whose mod is off is not there
  _resetWorldDataReplacement(); installWorldDataReplacement(); bindWorldDataBlocks(fakeBlocks());
  let on = false;
  for (const n of FILES) registerWorldDataAsset(n, json(n), () => on);
  assert.equal(getDFRegionAdditionalLocationData(16, fakeRegion()), false);
  _resetWorldDataReplacement({ assets: false }); installWorldDataReplacement(); bindWorldDataBlocks(fakeBlocks());
  on = true;
  assert.equal(getDFRegionAdditionalLocationData(16, fakeRegion()), true);
  assert.equal(registerWorldDataAsset('', {}), false); assert.equal(registerWorldDataAsset('x.json', null), false);
});

test('RR3b the new block: an index past the BSA\'s count, its name, the region uncached without a reader, the JSON block served and cached, the variant key', () => {
  fresh();
  getDFRegionAdditionalLocationData(16, fakeRegion());
  assert.equal(getNewDFBlockIndex('RRFORT01.RMB'), BSA_COUNT, 'nextBlockIndex starts at BsaFile.Count');
  assert.equal(getNewDFBlockName(BSA_COUNT), 'RRFORT01.RMB');
  assert.equal(getNewDFBlockIndex('ARMRAM03.RMB'), -1); assert.equal(getNewDFBlockName(5), null);
  const blk = getDFBlockReplacementData(BSA_COUNT, 'RRFORT01.RMB');
  assert.equal(blk.name, 'RRFORT01.RMB'); assert.equal(blk.index, BSA_COUNT); assert.equal(blk.rmbBlock.subRecords.length, 1);
  assert.equal(getDFBlockReplacementData(BSA_COUNT, 'RRFORT01.RMB'), blk, 'cached');
  assert.equal(getDFBlockReplacementData(5, 'ARMRAM03.RMB'), null, 'a classic block with no JSON');
  assert.equal(getDFBlockReplacementData(5, 'ARMRAM03.RMB'), null, 'cached as none');
  assert.equal(getDFBlockReplacementData(5, null), null);
  setBlockVariant('RRFORT01.RMB', '_burnt');
  assert.equal(getDFBlockReplacementData(BSA_COUNT, 'RRFORT01.RMB'), null, 'a variant with no file: nothing, and NOT cached as none');
  registerWorldDataAsset('RRFORT01.RMB_burnt.json', { ...BLK, Name: 'RRFORT01.RMB' });
  assert.equal(getDFBlockReplacementData(BSA_COUNT, 'RRFORT01.RMB')?.name, 'RRFORT01.RMB', 'the variant\'s file, landing later, is found (variants are not marked as not present)');
  setBlockVariant('RRFORT01.RMB', NO_VARIANT);
  assert.equal(getDFBlockReplacementData(BSA_COUNT, 'RRFORT01.RMB'), blk);
  // a classic block name already in the BSA is not reassigned
  fresh(); bindWorldDataBlocks(fakeBlocks({ 'RRFORT01.RMB': 33 }));
  getDFRegionAdditionalLocationData(16, fakeRegion());
  assert.equal(getNewDFBlockIndex('RRFORT01.RMB'), -1);
  // no reader bound: the location lands, the indices do not, the region is not cached (the C#'s ContentReader null arm)
  fresh({ bind: false });
  const r = fakeRegion();
  assert.equal(getDFRegionAdditionalLocationData(16, r), true); assert.equal(r.locationCount, 3);
  assert.equal(getNewDFBlockIndex('RRFORT01.RMB'), -1);
  bindWorldDataBlocks(fakeBlocks());
  assert.equal(getDFRegionAdditionalLocationData(16, fakeRegion()), true, 'asked again: read again, not served from a cache');
  assert.equal(getNewDFBlockIndex('RRFORT01.RMB'), BSA_COUNT, 'and this time the reader is there, so the index lands');
});

test('RR3b the building: nothing without the variant (cached as none under NoVariant), the master file under `_master` at the last location, the variant getter\'s here/any', () => {
  fresh();
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 765, 14), null);
  setBuildingVariant('ARMRAM03.RMB', 14, '_master', makeLocationKey(52, 240));   // the quest's first line
  setLastLocationKeyTo(52, 240);
  const b = getBuildingReplacementData('ARMRAM03.RMB', 765, 14);
  assert.equal(b.factionId, 1022); assert.equal(b.buildingType, BUILDING_TYPES.Armorer); assert.equal(b.nameSeed, 632);
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 765, 14), b, 'cached under its variant');
  setLastLocationKeyTo(52, 241);
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 765, 14), null, 'another location: the cached none');
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 765, 13), null, 'another record');
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 766, 14), null, 'another block index (the file names 765)');
  setBuildingVariant('ARMRAM03.RMB', 14, '_master');   // everywhere
  assert.equal(getBuildingReplacementData('ARMRAM03.RMB', 765, 14), b, 'AnyLocationKey');
  // the variant of a NEW location: loaded from `locationnew-*-16<variant>.json` when set
  registerWorldDataAsset('locationnew-RRfort01-16_v.json', { ...LOC, Name: 'Northrock Fort' , Exterior: { ...LOC.Exterior, BuildingCount: 0, Buildings: [] } });
  getDFRegionAdditionalLocationData(16, fakeRegion());
  setNewLocationIndexResolver((region, name) => getNewDFLocationIndex(region, name));
  setNewLocationVariant(16, 'Northrock Fort', '_v');
  const v = getDFLocationReplacementData(16, 2);
  assert.equal(v.exterior.buildingCount, 0, 'the variant\'s record'); assert.equal(v.locationIndex, 2);
  assert.equal(loadNewDFLocationVariant(16, 2, '_v'), false, 'already loaded');
  assert.equal(loadNewDFLocationVariant(16, 2, '_w'), false, 'no such file');
  assert.equal(loadNewDFLocationVariant(16, 0, '_v'), false, 'not a new location');
  setNewLocationIndexResolver(null);
  clearWorldDataVariants();
});

// ---- the readers and the layout ------------------------------------------------
test('RR3b the readers ask the door: MapsFile\'s three asks and BlocksFile\'s four, by source; the door leaf; the merge arm hands the pool draw back and varies the seed', () => {
  const mf = rd('src/formats/mapsFile.js');
  assert.match(mf, /worldDataDoor\(\)\?\.getDFRegionAdditionalLocationData\(region, rec\.dfRegion\);/, 'LoadRegion (:984)');
  assert.match(mf, /const replacement = worldDataDoor\(\)\?\.getDFLocationReplacementData\(region, location\);\s*if \(replacement\) return replacement;/, 'ReadLocation (:998-1000)');
  assert.match(mf, /const entry = rec\.dfRegion\?\.mapTable\?\.\[location\];\s*if \(entry\?\.locationId\) return entry\.locationId;/, 'ReadLocationIdFast (:1027-1028)');
  const bf = rd('src/formats/blocksFile.js');
  assert.match(bf, /return worldDataDoor\(\)\?\.getNewDFBlockName\(block\) \?\? \(block < this\.count \? this\._bsa\.getRecordName\(block\) : null\);/, 'GetBlockName (:214)');
  assert.match(bf, /const assigned = worldDataDoor\(\)\?\.getNewDFBlockIndex\(name\) \?\? -1;\s*if \(assigned !== -1\) return assigned;/, 'GetBlockIndex (:273)');
  assert.match(bf, /const replacement = block >= 0 \? worldDataDoor\(\)\?\.getDFBlockReplacementData\(block, this\.getBlockName\(block\)\) : null;\s*if \(replacement\) \{\s*if \(this\._blocks && this\._blocks\.length > block\) this\._blocks\[block\] = \{ name: replacement\.name, bytes: null, view: null, dfBlock: replacement \};\s*return replacement;/, 'GetBlock (:385)');
  assert.match(bf, /const replacement = door\?\.getBuildingReplacementData\(rec\.name, rec\.dfBlock\.index, i\);\s*if \(replacement\) \{\s*subRecords\[i\] = \{ \.\.\.replacement\.rmbSubRecord \};/, 'ReadRmbBlockData (:850)');
  assert.match(bf, /if \(replacement\.nameSeed > 0\) h\.buildingDataList\[i\]\.nameSeed = replacement\.nameSeed;\s*door\.applyBuildingReplacementAutoMapData\(replacement, h\.autoMapData\);/);
  assert.match(bf, /position \+= h\.blockDataSizes\[i\];\s*r\.pos = position;/, 'the step by the header\'s sizes stands on both arms');
  // the leaf
  const saved = worldDataDoor();
  setWorldDataDoor(null); assert.equal(worldDataDoor(), null);
  setWorldDataDoor(saved);
  // RMBLayout.cs:662-672 over the port's merge
  fresh();
  setBuildingVariant('ARMRAM03.RMB', 14, '_master', makeLocationKey(52, 240)); setLastLocationKeyTo(52, 240);
  const entry = (i, type) => ({ nameSeed: 100 + i, factionId: 0, sector: 0, locationId: 0, buildingType: type, quality: 5 });
  const list = Array.from({ length: 32 }, (_, i) => entry(i, i === 14 ? BUILDING_TYPES.Armorer : BUILDING_TYPES.House1));
  const block = { dfBlock: { name: 'ARMRAM03.RMB', index: 765, rmbBlock: { fldHeader: { buildingDataList: list, numBlockDataRecords: 16, otherNames: null }, subRecords: new Array(16) } } };
  const pool = [{ nameSeed: 9001, factionId: 77, sector: 1, locationId: 3, buildingType: BUILDING_TYPES.Armorer, quality: 9 }];
  const merged = mergeNamedBuildings(pool, [block], { locationIndex: 240 }).get(block);
  assert.equal(merged[14].factionId, 1022, 'the replacement\'s faction'); assert.equal(merged[14].quality, 20); assert.equal(merged[14].buildingType, BUILDING_TYPES.Armorer);
  assert.equal(merged[14].nameSeed, 632 + 240, 'NameSeed + LocationIndex - varied by location');
  assert.equal(merged[14].sector, 1, 'the pool draw\'s other fields were copied first');
  // and the draw was handed back: a second armorer in the block takes it
  const list2 = list.map((e, i) => (i === 15 ? entry(15, BUILDING_TYPES.Armorer) : e));
  const block2 = { dfBlock: { name: 'ARMRAM03.RMB', index: 765, rmbBlock: { fldHeader: { buildingDataList: list2, numBlockDataRecords: 16, otherNames: null }, subRecords: new Array(16) } } };
  const merged2 = mergeNamedBuildings([...pool], [block2], { locationIndex: 240 }).get(block2);
  assert.equal(merged2[15].factionId, 77, 'item.used = false: the one pool armorer went to record 15');
  assert.equal(merged2[14].factionId, 1022);
  // a replacement with NO faction: the type is still overridden, the pool draw stays used and its values stand
  registerWorldDataAsset('ARMRAM03.RMB-765-building15_master.json', { ...BLD, FactionId: 0, BuildingType: 'Tavern', NameSeed: 0 });
  setBuildingVariant('ARMRAM03.RMB', 15, '_master', makeLocationKey(52, 240));
  const merged3 = mergeNamedBuildings([...pool], [block2], { locationIndex: 240 }).get(block2);
  assert.equal(merged3[15].buildingType, BUILDING_TYPES.Tavern, 'always override type');
  assert.equal(merged3[15].factionId, 77, 'the pool draw\'s faction'); assert.equal(merged3[15].nameSeed, 9001);
  // without the variant: the classic merge
  clearWorldDataVariants(); _resetWorldDataReplacement({ assets: false }); installWorldDataReplacement();
  const plain = mergeNamedBuildings([...pool], [block]).get(block);
  assert.equal(plain[14].factionId, 77); assert.equal(plain[14].nameSeed, 9001);
  // and no door at all
  setWorldDataDoor(null);
  const none = mergeNamedBuildings([...pool], [block]).get(block);
  assert.equal(none[14].factionId, 77);
  setWorldDataDoor(saved);
});

test('RR3b the hosts and the save: the four hosts bind the reader and await the mod assets before a region loads, the loader\'s gate, the call sites\' location index, the variants on the save', () => {
  for (const h of ['world', 'exterior', 'interior', 'dungeon']) {
    const s = rd(`src/scenes/${h}.js`);
    assert.match(s, /const blocks = new BlocksFile\(\);\s*blocks\.load\(blocksBytes\);\s*bindWorldDataBlocks\(blocks\);[^\n]*\n\s*await loadModWorldData\(\);/, `${h}: before the first region`);
  }
  const ld = rd('src/scenes/modWorldData.js');
  assert.match(ld, /import\.meta\.glob\('\.\.\/\.\.\/vendor\/\*\/WorldData\/\*\.json', \{ import: 'default' \}\)/);
  assert.match(ld, /registerWorldDataAsset\(baseName\(path\), json, \(\) => modSetting\(vendor, 'Enabled'\) === true\)/, 'a mod that is off is a mod DFU never loaded');
  assert.match(ld, /installWorldDataReplacement\(\);/);
  const w = rd('src/scenes/world.js'), e = rd('src/scenes/exterior.js');
  assert.equal((w.match(/locationIndex: (dfLoc|loc)\.locationIndex \?\? 0/g) ?? []).length, 4, 'world.js: the four merge sites');
  assert.equal((e.match(/locationIndex: dfLocation\.locationIndex \?\? 0/g) ?? []).length, 4, 'exterior.js: the four merge sites');
  assert.match(rd('src/systems/talkTopics.js'), /export function mergeNamedBuildings\(exteriorBuildings, blocks, \{ locationIndex = 0 \} = \{\}\) \{/);
  assert.match(rd('src/world/buildingSummaries.js'), /mergeNamedBuildings\(exteriorBuildings \?\? \[\], blocks \?\? \[\], \{ locationIndex: nameOpts\.locationIndex \?\? 0 \}\)/);
  const sv = rd('src/systems/save.js');
  assert.match(sv, /snap\.worldVariation = getWorldVariationSaveData\(\);/, 'SaveLoadManager.cs:1125');
  assert.match(sv, /clearWorldDataVariants\(\);\s*restoreWorldVariationData\(snap\.worldVariation \?\? null\);/, 'SaveLoadManager.cs:1465-1466');
});
