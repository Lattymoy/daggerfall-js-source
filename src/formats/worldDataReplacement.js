// WORLD DATA REPLACEMENT - WorldDataReplacement.cs (Assets/Scripts/Utility/
// AssetInjection, MIT, Hazelnut): the door a mod's world-data JSON comes
// through - a NEW LOCATION added to a region (`locationnew-<name>-
// <region>.json`), a location REPLACED (`location-<region>-<index>
// <variant>.json`), a BLOCK served from JSON (`<block>.RMB<variant>.json`,
// a new block gets an index past the BSA's count) and a BUILDING record
// replaced inside a classic block (`<block>-<blockIndex>-building<n>
// <variant>.json`). WorldDataVariants (systems/worldDataVariants.js,
// RR3a) says which variant is in force; this module reads the file and
// hands the readers a record in the port's own shape (the C# deserialises
// straight into DFLocation/DFBlock; the port's readers spell the same
// structs in camelCase, so the JSON is converted on the way in - the
// converters below, one per struct).
//
// The C#'s two sources - loose files under StreamingAssets/WorldData
// and mod assets through ModManager - are one here: a vendored mod
// registers its files by name (`registerWorldDataAsset`), which is the
// "Seek from mods" arm; the loose-file arm has no port counterpart (no
// StreamingAssets folder). Every `#if !UNITY_EDITOR` cache is taken (the
// port is not the editor). `DaggerfallUnity.Settings.AssetInjection`
// gates it all, as in the C#.
//
// RR3b (2026-09-23): ported for Roleplay & Realism's Master Armorer line -
// Northrock Fort (a new location in the Wrothgarian Mountains), its
// RRFORT01.RMB, and the armorer's shop as the quest rebuilds it.
import { getBool } from '../systems/settings.js';
import { NO_VARIANT, makeLocationKey, getLocationVariant, getBlockVariantHere, getBuildingVariantHere, setNewLocationIndexResolver } from '../systems/worldDataVariants.js';
import { LOCATION_TYPES, DUNGEON_TYPES, getWorldClimateSettings, REGION_NAMES } from './mapsFile.js';
import { BLOCK_TYPES } from './blocksFile.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { setWorldDataDoor } from './worldDataDoor.js';

export const AUTO_MAP_DATA_SIZE = 64 * 64;   // :45
const NO_REPLACEMENT = Symbol('noReplacement');   // the C#'s noReplacementRegion/Location/Block/Building sentinels
export { makeLocationKey };

/** DaggerfallUnity.Settings.AssetInjection. */
export const assetInjectionOn = () => getBool('Enhancements', 'AssetInjection');

// ---- the mod's assets (ModManager.TryGetAsset / FindAssets, the port's one source) ----
const _assets = new Map();   // file name -> { json, isOn }
/** A vendored mod's world-data file by its DFU name; `isOn` is the mod's
 *  switch (a mod that is off is a mod DFU never loaded). */
export function registerWorldDataAsset(fileName, json, isOn = null) {
  if (!fileName || json == null) return false;
  _assets.set(fileName, { json, isOn: typeof isOn === 'function' ? isOn : null });
  return true;
}
const assetOn = (a) => !!a && (a.isOn?.() ?? true);
/** ModManager.TryGetAsset(fileName): the JSON, or null. */
function tryGetAsset(fileName) { const a = _assets.get(fileName); return assetOn(a) ? a.json : null; }
/** ModManager.FindAssets<TextAsset>(worldData, extension): every asset
 *  whose name ends so, in registration order (the C#'s list). */
function findAssets(extension) {
  const out = [];
  for (const [name, a] of _assets) if (name.endsWith(extension) && assetOn(a)) out.push({ name, json: a.json });
  return out;
}

// ---- the caches (:57-65) ----
let regions = new Map();          // regionIndex -> dfRegion | NO_REPLACEMENT
let locations = new Map();        // `${locationKey}${variant}` -> dfLocation | NO_REPLACEMENT
let blocks = new Map();           // `${blockName}${variant}` -> dfBlock | NO_REPLACEMENT
let buildings = new Map();        // `${blockIndex}|${recordIndex}|${variant}` -> data | NO_REPLACEMENT
let nextBlockIndex = 0;
let newBlockNames = new Map();    // block index -> name
let newBlockIndices = new Map();  // name -> block index
let _blocksFile = null;           // ContentReader.BlockFileReader (AssignBlockIndices' read of BsaFile.Count)

/** The host's BlocksFile - what AssignBlockIndices asks for the BSA's
 *  count and a name's classic index. */
export function bindWorldDataBlocks(blocksFile) { _blocksFile = blocksFile ?? null; }
/** Once: the readers' door. Tests reset with `_resetWorldDataReplacement`. */
export function installWorldDataReplacement() {
  setNewLocationIndexResolver(getNewDFLocationIndex);   // AUDIT-RR F33: SetNewLocationVariant -> GetNewDFLocationIndex (WorldDataVariants.cs:101) - RR3a's seam, wired
  setWorldDataDoor({ getDFRegionAdditionalLocationData, getDFLocationReplacementData, getDFBlockReplacementData, getBuildingReplacementData, getNewDFBlockName, getNewDFBlockIndex, applyBuildingReplacementAutoMapData });
}
export function _resetWorldDataReplacement({ assets = true } = {}) {
  regions = new Map(); locations = new Map(); blocks = new Map(); buildings = new Map();
  nextBlockIndex = 0; newBlockNames = new Map(); newBlockIndices = new Map(); _blocksFile = null;
  if (assets) _assets.clear();
}

// ---- file names (:76-94) ----
export const regionReplacementFilename = (regionIndex) => `region-${regionIndex}.json`;
export const locationReplacementFilename = (regionIndex, locationIndex, variant = NO_VARIANT) => `location-${regionIndex}-${locationIndex}${variant}.json`;
export const blockReplacementFilename = (blockName, variant = NO_VARIANT) => `${blockName}${variant}.json`;
export const buildingReplacementFilename = (blockName, blockIndex, recordIndex, variant = NO_VARIANT) => `${blockName}-${blockIndex}-building${recordIndex}${variant}.json`;

// ---- GetNewDFLocationIndex (:106-125) ----
export function getNewDFLocationIndex(regionIndex, locationName) {
  const r = regions.get(regionIndex);
  if (r && r !== NO_REPLACEMENT && r.mapNameLookup.has(locationName)) return r.mapNameLookup.get(locationName);
  return -1;
}

// ---- GetDFRegionAdditionalLocationData (:127-203) ----
/** Adds every `locationnew-*-<region>.json` the mod ships to the port's
 *  dfRegion (mapNames, mapTable, the two lookups, locationCount) and
 *  answers true when any landed. Mutates `dfRegion` as the C# `ref`. */
export function getDFRegionAdditionalLocationData(regionIndex, dfRegion) {
  if (!assetInjectionOn() || !dfRegion) return false;
  const cached = regions.get(regionIndex);
  if (cached !== undefined) {
    if (cached !== NO_REPLACEMENT) { copyRegionInto(cached, dfRegion); return true; }
    return false;
  }
  const dataLocationCount = dfRegion.locationCount;
  let locationAssignmentSuccess = true;
  for (const { name, json } of findAssets(`-${regionIndex}.json`)) {
    if (!name.startsWith('locationnew-')) continue;
    const dfLocation = locationFromJson(json, regionIndex);
    locationAssignmentSuccess = addLocationToRegion(regionIndex, dfRegion, dfLocation) && locationAssignmentSuccess;
  }
  if (dfRegion.locationCount > dataLocationCount) {
    if (locationAssignmentSuccess) regions.set(regionIndex, snapshotRegion(dfRegion));
    console.log(`[worlddata] Added ${dfRegion.locationCount - dataLocationCount} new DFLocation's to region ${regionIndex}, indexes: ${dataLocationCount} - ${dfRegion.locationCount - 1}`);
    return true;
  }
  regions.set(regionIndex, NO_REPLACEMENT);
  return false;
}
/** The cached region's additions, re-applied to a re-read dfRegion (the
 *  C# hands the cached struct back whole; the port's reader rebuilt its
 *  own from the BSA, so the additions are laid on again). */
function copyRegionInto(cached, dfRegion) {
  if (dfRegion.locationCount >= cached.locationCount) return;
  for (let i = dfRegion.locationCount; i < cached.locationCount; i++) {
    dfRegion.mapNames.push(cached.mapNames[i]);
    dfRegion.mapTable.push(cached.mapTable[i]);
    if (!dfRegion.mapIdLookup.has(cached.mapTable[i].mapId)) dfRegion.mapIdLookup.set(cached.mapTable[i].mapId, i);
    if (!dfRegion.mapNameLookup.has(cached.mapNames[i])) dfRegion.mapNameLookup.set(cached.mapNames[i], i);
  }
  dfRegion.locationCount = cached.locationCount;
}
const snapshotRegion = (r) => ({ locationCount: r.locationCount, mapNames: r.mapNames.slice(), mapTable: r.mapTable.slice(), mapNameLookup: new Map(r.mapNameLookup), mapIdLookup: new Map(r.mapIdLookup) });

// ---- AddLocationToRegion (:510-530) ----
function addLocationToRegion(regionIndex, dfRegion, dfLocation) {
  // Copy the location id for ReadLocationIdFast() to use instead of peeking the classic data files
  dfLocation.mapTableData.locationId = dfLocation.exterior.recordElement.header.locationId;
  const locationIndex = dfRegion.locationCount++;
  dfRegion.mapNames.push(dfLocation.name);
  dfLocation.locationIndex = locationIndex;
  dfLocation.exterior.recordElement.header.unknown2 = locationIndex >>> 0;
  dfRegion.mapTable.push(dfLocation.mapTableData);
  // AUDIT-RR F37: `Dictionary.Add` (:521-522) THROWS on a mapId or name a vanilla location already has - the region
  // load fails loudly in DFU, and a silent remap of the vanilla entry would be the port's own invention
  if (dfRegion.mapIdLookup.has(dfLocation.mapTableData.mapId)) throw new Error(`[worlddata] region ${regionIndex}: mapId ${dfLocation.mapTableData.mapId} is already a location's (${dfLocation.name})`);
  if (dfRegion.mapNameLookup.has(dfLocation.name)) throw new Error(`[worlddata] region ${regionIndex}: a location named ${JSON.stringify(dfLocation.name)} already stands`);
  dfRegion.mapIdLookup.set(dfLocation.mapTableData.mapId, locationIndex);
  dfRegion.mapNameLookup.set(dfLocation.name, locationIndex);
  locations.set(String(makeLocationKey(regionIndex, locationIndex)), dfLocation);
  return assignBlockIndices(dfLocation);
}

// ---- GetDFLocationReplacementData (:204-262) ----
/** The replacement (or new) DFLocation for region/index, or null. */
export function getDFLocationReplacementData(regionIndex, locationIndex) {
  if (!assetInjectionOn()) return null;
  const locationKey = makeLocationKey(regionIndex, locationIndex);
  const { variant, newLocation } = getLocationVariant(locationKey);
  let locationVariantKey = `${locationKey}${variant}`;
  if (newLocation && !locations.has(locationVariantKey)) {
    if (!loadNewDFLocationVariant(regionIndex, locationIndex, variant)) locationVariantKey = String(locationKey);   // Fall back to non-variant if load fails
  }
  const cached = locations.get(locationVariantKey);
  if (cached !== undefined) return cached === NO_REPLACEMENT ? null : cached;
  const json = tryGetAsset(locationReplacementFilename(regionIndex, locationIndex, variant));
  if (!json) {
    if (variant === NO_VARIANT) locations.set(locationVariantKey, NO_REPLACEMENT);
    return null;
  }
  const dfLocation = locationFromJson(json, regionIndex);
  dfLocation.locationIndex = locationIndex;
  if (assignBlockIndices(dfLocation)) locations.set(locationVariantKey, dfLocation);
  console.log(`[worlddata] Found DFLocation override, region:${regionIndex}, index:${locationIndex} variant:${variant}`);
  return dfLocation;
}
/** LoadNewDFLocationVariant (:263-298): the variant of a NEW location,
 *  from `locationnew-*-<region><variant>.json`. */
export function loadNewDFLocationVariant(regionIndex, locationIndex, variant) {
  const locationKey = makeLocationKey(regionIndex, locationIndex);
  const base = locations.get(String(locationKey));
  if (!base || base === NO_REPLACEMENT) return false;
  const locationVariantKey = `${locationKey}${variant}`;
  if (locations.has(locationVariantKey)) return false;
  for (const { name, json } of findAssets(`-${regionIndex}${variant}.json`)) {
    if (!name.startsWith('locationnew-')) continue;   // the C# mod arm takes any asset with the suffix; the loose-file arm's pattern is locationnew-*, kept as the honest one
    const variantLocation = locationFromJson(json, regionIndex);
    addNewDFLocationVariant(locationIndex, locationVariantKey, variantLocation);
    return true;
  }
  return false;
}
function addNewDFLocationVariant(locationIndex, locationVariantKey, variantLocation) {   // :299-310
  variantLocation.locationIndex = locationIndex;
  variantLocation.exterior.recordElement.header.unknown2 = locationIndex >>> 0;
  locations.set(locationVariantKey, variantLocation);
}

// ---- the new block indices (:312-340, :531-573) ----
export const getNewDFBlockIndex = (blockName) => newBlockIndices.get(blockName) ?? -1;
export const getNewDFBlockName = (block) => newBlockNames.get(block) ?? null;
function assignBlockIndices(dfLocation) {
  if (!_blocksFile) return false;   // ContentReader/BlockFileReader null: nothing assigned, and the region is not cached
  if (nextBlockIndex === 0) nextBlockIndex = _blocksFile.count;
  for (const blockName of dfLocation.exterior?.exteriorData?.blockNames ?? []) {
    if (_blocksFile.getBlockIndex(blockName) === -1) assignNextIndex(blockName);
  }
  for (const dungeonBlock of dfLocation.dungeon?.blocks ?? []) {
    if (_blocksFile.getBlockIndex(dungeonBlock.blockName) === -1) assignNextIndex(dungeonBlock.blockName);
  }
  return true;
}
function assignNextIndex(blockName) {
  newBlockNames.set(nextBlockIndex, blockName);
  newBlockIndices.set(blockName, nextBlockIndex);
  console.log(`[worlddata] Found a new DFBlock: ${blockName}, (assigned index: ${nextBlockIndex})`);
  nextBlockIndex++;
}

// ---- GetDFBlockReplacementData (:342-398) ----
/** The JSON block for this index and name, in the port's DFBlock shape,
 *  with its RMB buildings replaced where a building file says so; null
 *  when the mod ships none. */
export function getDFBlockReplacementData(block, blockName) {
  if (!assetInjectionOn() || !blockName) return null;
  const variant = getBlockVariantHere(blockName);
  const blockKey = `${blockName}${variant}`;
  const cached = blocks.get(blockKey);
  if (cached !== undefined) return cached === NO_REPLACEMENT ? null : cached;
  const json = tryGetAsset(blockReplacementFilename(blockName, variant));
  if (!json) {
    if (variant === NO_VARIANT) blocks.set(blockName, NO_REPLACEMENT);
    return null;
  }
  const dfBlock = blockFromJson(json, block);
  if (blockName.endsWith('.RMB')) replaceRmbBlockBuildingData(blockName, block, dfBlock);
  blocks.set(blockKey, dfBlock);
  console.log(`[worlddata] Found DFBlock override: ${blockName} (index: ${block})`);
  return dfBlock;
}
/** ReplaceRmbBlockBuildingData (:400-433): only the Exterior and Interior
 *  halves of a subrecord are replaced - the JSON block's own position and
 *  rotation stand - and the building list entry is updated where the
 *  replacement's fields are set. */
function replaceRmbBlockBuildingData(blockName, blockIndex, dfBlock) {
  const rmb = dfBlock.rmbBlock;
  for (let i = 0; i < rmb.subRecords.length; i++) {
    const data = getBuildingReplacementData(blockName, blockIndex, i);
    if (!data) continue;
    rmb.subRecords[i].exterior = data.rmbSubRecord.exterior;
    rmb.subRecords[i].interior = data.rmbSubRecord.interior;
    const entry = rmb.fldHeader.buildingDataList[i] ?? (rmb.fldHeader.buildingDataList[i] = emptyBuildingData());
    if (data.factionId > 0) entry.factionId = data.factionId;
    entry.buildingType = data.buildingType;
    if (data.quality > 0) entry.quality = data.quality;
    if (data.nameSeed > 0) entry.nameSeed = data.nameSeed;
    applyBuildingReplacementAutoMapData(data, rmb.fldHeader.autoMapData);
  }
}

// ---- GetBuildingReplacementData (:435-482) ----
/** The building file for this block's record, converted, or null. The
 *  ask sets no variant of its own (the C# asks with NoVariant and lets
 *  WorldDataVariants answer for the last location). */
export function getBuildingReplacementData(blockName, blockIndex, recordIndex) {
  if (!assetInjectionOn() || !blockName) return null;
  const variant = getBuildingVariantHere(blockName, recordIndex, NO_VARIANT);
  const key = `${blockIndex}|${recordIndex}|${variant}`;
  const cached = buildings.get(key);
  if (cached !== undefined) return cached === NO_REPLACEMENT ? null : cached;
  const json = tryGetAsset(buildingReplacementFilename(blockName, blockIndex, recordIndex, variant));
  if (!json) {
    if (variant === NO_VARIANT) buildings.set(key, NO_REPLACEMENT);   // Only look for replacement data once, non variant
    return null;
  }
  const data = buildingReplacementFromJson(json);
  buildings.set(key, data);
  return data;
}
/** ApplyBuildingReplacementAutoMapData (:494-508): every value but 30
 *  lands on the block's automap. */
export function applyBuildingReplacementAutoMapData(buildingData, blockAutoMapData) {
  const src = buildingData?.autoMapData;
  if (!src || src.length !== AUTO_MAP_DATA_SIZE || !blockAutoMapData) return;
  for (let i = 0; i < AUTO_MAP_DATA_SIZE; i++) if (src[i] !== 30) blockAutoMapData[i] = src[i];
}

// ======================================================================
// THE CONVERTERS - DFU's JSON (its structs' own field names, PascalCase,
// with the enums spelled) into the port's reader shapes (camelCase, the
// enums as numbers), field for field.
// ======================================================================
const enumOf = (table, v, fallback = 0) => (typeof v === 'number' ? v : (table[v] ?? fallback));
const emptyBuildingData = () => ({ nameSeed: 0, serviceTimeLimit: 0, unknown: 0, unknown2: 0, unknown3: 0, unknown4: 0, factionId: 0, sector: 0, locationId: 0, buildingType: 0, quality: 0 });
/** DFLocation.BuildingData (the 26-byte record) from its JSON. */
export function buildingDataFromJson(b) {
  return { ...emptyBuildingData(), nameSeed: b.NameSeed ?? 0, factionId: b.FactionId ?? 0, sector: b.Sector ?? 0, locationId: b.LocationId ?? 0, buildingType: enumOf(BUILDING_TYPES, b.BuildingType, -1), quality: b.Quality ?? 0 };
}
/** DFLocation from `locationnew-*` / `location-*` JSON: the port's
 *  `_readLocation` shape, the climate by the JSON's WorldClimate through
 *  the port's own table (the C# carries the same seven fields inline). */
export function locationFromJson(json, regionIndex = json.RegionIndex ?? 0) {
  const mt = json.MapTableData ?? {};
  const ext = json.Exterior ?? {};
  const h = ext.RecordElement?.Header ?? {};
  const ed = ext.ExteriorData ?? {};
  const blockNames = [...(ed.BlockNames ?? [])];
  return {
    loaded: json.Loaded ?? true,
    regionName: json.RegionName ?? REGION_NAMES[regionIndex] ?? '',
    name: json.Name ?? '',
    regionIndex,
    locationIndex: json.LocationIndex ?? 0,
    hasDungeon: !!json.HasDungeon,
    politic: json.Politic ?? 0,
    climate: getWorldClimateSettings(json.Climate?.WorldClimate ?? 231),
    mapTableData: {
      mapId: mt.MapId ?? 0, longitude: mt.Longitude ?? 0, locationType: enumOf(LOCATION_TYPES, mt.LocationType, LOCATION_TYPES.None),
      discovered: !!mt.Discovered, latitude: mt.Latitude ?? 0, dungeonType: enumOf(DUNGEON_TYPES, mt.DungeonType, DUNGEON_TYPES.NoDungeon), key: mt.Key ?? 0, locationId: 0,
    },
    exterior: {
      recordElement: {
        doorCount: 0, doors: [],
        header: {
          alwaysOne1: 1, x: h.X ?? 0, y: h.Y ?? 0, isExterior: h.IsExterior ?? 0, unknown1: 0, unknown2: h.Unknown2 ?? 0, alwaysOne2: 1,
          locationId: h.LocationId ?? 0, isInterior: h.IsInterior ?? 0, exteriorLocationId: h.ExteriorLocationId ?? 0, locationName: h.LocationName ?? json.Name ?? '',
        },
      },
      buildingCount: ext.BuildingCount ?? (ext.Buildings?.length ?? 0),
      unknown1: null,
      buildings: (ext.Buildings ?? []).map(buildingDataFromJson),
      exteriorData: {
        anotherName: ed.AnotherName ?? '', mapId: ed.MapId ?? 0, locationId: ed.LocationId ?? 0, width: ed.Width ?? 1, height: ed.Height ?? 1,
        unknown2: null, letter1ForRMBName: 0, portTownAndUnknown: ed.PortTownAndUnknown ?? 0, unknown3: 0,
        blockIndex: null, blockNumber: null, blockCharacter: null, unknown4: null, unknown5: null, unknown6: 0, blockNames,
      },
    },
    dungeon: json.Dungeon ? dungeonFromJson(json.Dungeon) : { recordElement: null, header: null, blocks: null },
  };
}
function dungeonFromJson(d) {
  return {
    recordElement: null,
    header: d.Header ? { nullValue1: 0, unknown1: 0, unknown2: 0, blockCount: d.Header.BlockCount ?? (d.Blocks?.length ?? 0), unknown3: null } : null,
    blocks: (d.Blocks ?? []).map((b) => ({ x: b.X ?? 0, z: b.Z ?? 0, isStartingBlock: !!b.IsStartingBlock, blockName: b.BlockName ?? '', blockIndex: b.BlockIndex ?? 0, blockNumber: b.BlockNumber ?? 0, blockCharacter: b.BlockCharacter ?? 0 })),
  };
}
/** The RMB model, flat, section-3, people and door records (the
 *  `_readRmb*` shapes with the fields the JSON does not carry zeroed). */
const modelFromJson = (m) => ({
  position: 0, modelIdNum: m.ModelIdNum ?? Number(m.ModelId ?? 0), modelId: String(m.ModelId ?? m.ModelIdNum ?? 0), objectType: m.ObjectType ?? 0,
  unknown1: 0, unknown2: 0, unknown3: 0, xPos1: 0, yPos1: 0, zPos1: 0,
  xPos: m.XPos ?? 0, yPos: m.YPos ?? 0, zPos: m.ZPos ?? 0, nullValue2: 0,
  xRotation: m.XRotation ?? 0, yRotation: m.YRotation ?? 0, zRotation: m.ZRotation ?? 0, unknown4: 0, unknown5: 0,
});
const flatFromJson = (f) => ({
  position: f.Position ?? 0, xPos: f.XPos ?? 0, yPos: f.YPos ?? 0, zPos: f.ZPos ?? 0,
  textureBitfield: (((f.TextureArchive ?? 0) << 7) | ((f.TextureRecord ?? 0) & 0x7f)) & 0xffff,
  textureArchive: f.TextureArchive ?? 0, textureRecord: f.TextureRecord ?? 0, factionID: f.FactionID ?? 0, flags: f.Flags ?? 0,
});
const section3FromJson = (s) => ({ xPos: s.XPos ?? 0, yPos: s.YPos ?? 0, zPos: s.ZPos ?? 0, unknown1: 0, unknown2: 0, unknown3: 0 });
const doorFromJson = (d) => ({ position: d.Position ?? 0, xPos: d.XPos ?? 0, yPos: d.YPos ?? 0, zPos: d.ZPos ?? 0, yRotation: d.YRotation ?? 0, openRotation: d.OpenRotation ?? 0, doorModelIndex: 0, unknown: 0, nullValue1: 0 });
/** One RmbBlockData half (exterior or interior). */
export function rmbBlockDataFromJson(j) {
  const models = (j?.Block3dObjectRecords ?? []).map(modelFromJson);
  const flats = (j?.BlockFlatObjectRecords ?? []).map(flatFromJson);
  const s3 = (j?.BlockSection3Records ?? []).map(section3FromJson);
  const people = (j?.BlockPeopleRecords ?? []).map(flatFromJson);
  const doors = (j?.BlockDoorRecords ?? []).map(doorFromJson);
  const hd = j?.Header ?? {};
  return {
    header: {
      position: 0, num3dObjectRecords: hd.Num3dObjectRecords ?? models.length, numFlatObjectRecords: hd.NumFlatObjectRecords ?? flats.length,
      numSection3Records: hd.NumSection3Records ?? s3.length, numPeopleRecords: hd.NumPeopleRecords ?? people.length, numDoorRecords: hd.NumDoorRecords ?? doors.length,
      unknown1: 0, unknown2: 0, unknown3: 0, unknown4: 0, unknown5: 0, unknown6: 0,
    },
    block3dObjectRecords: models, blockFlatObjectRecords: flats, blockSection3Records: s3, blockPeopleRecords: people, blockDoorRecords: doors,
  };
}
/** RmbSubRecord: position and rotation, the two halves. */
export const rmbSubRecordFromJson = (s) => ({
  xPos: s.XPos ?? 0, zPos: s.ZPos ?? 0, yRotation: s.YRotation ?? 0,
  exterior: rmbBlockDataFromJson(s.Exterior), interior: rmbBlockDataFromJson(s.Interior),
});
/** The ground data: DFBlock.RmbGroundDataConverter (DFBlock.cs:1124-1185)
 *  flattens the two 16x16 arrays y-outer, x-inner; the port stores them
 *  [x][y] as the reader does. */
export function groundDataFromJson(g) {
  const tiles = Array.from({ length: 16 }, () => new Array(16));
  const scenery = Array.from({ length: 16 }, () => new Array(16));
  const T = g?.GroundTiles ?? [], S = g?.GroundScenery ?? [];
  let i = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++, i++) {
      const t = T[i] ?? {};
      const bitfield = t.TileBitfield ?? 0;
      tiles[x][y] = { tileBitfield: bitfield, textureRecord: t.TextureRecord ?? (bitfield & 0x3f), isRotated: t.IsRotated ?? ((bitfield & 0x40) === 0x40), isFlipped: t.IsFlipped ?? ((bitfield & 0x80) === 0x80) };
      const s = S[i] ?? {};
      const record = s.TextureRecord ?? -1;
      scenery[x][y] = { tileBitfield: record < 0 ? 255 : (record + 1) * 4, unknown1: 0, textureRecord: record };
    }
  }
  return { header: Uint8Array.from(g?.Header ?? new Array(8).fill(0)), groundTiles: tiles, groundScenery: scenery };
}
/** DFBlock from `<block>.RMB.json`: the port's `loadBlock` record with
 *  `index` the caller's (the C# sets dfBlock.Index = block). The FLD
 *  header's positions come from the subrecords (the JSON carries them
 *  there), its record counts from the arrays. */
export function blockFromJson(json, index) {
  const rmb = json.RmbBlock ?? {};
  const fh = rmb.FldHeader ?? {};
  const subRecords = (rmb.SubRecords ?? []).map(rmbSubRecordFromJson);
  const misc3d = (rmb.Misc3dObjectRecords ?? []).map(modelFromJson);
  const miscFlat = (rmb.MiscFlatObjectRecords ?? []).map(flatFromJson);
  const blockPositions = new Array(32).fill(null).map((_, i) => ({ unknown1: 0, unknown2: 0, xPos: subRecords[i]?.xPos ?? 0, zPos: subRecords[i]?.zPos ?? 0, yRotation: subRecords[i]?.yRotation ?? 0 }));
  const buildingDataList = (fh.BuildingDataList ?? []).map(buildingDataFromJson);
  while (buildingDataList.length < 32) buildingDataList.push(emptyBuildingData());
  const name = json.Name ?? '';
  return {
    position: json.Position ?? 0,
    index,
    name,
    type: enumOf(BLOCK_TYPES, json.Type, name.endsWith('.RMB') ? BLOCK_TYPES.Rmb : BLOCK_TYPES.Unknown),
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: subRecords.length, numMisc3dObjectRecords: misc3d.length, numMiscFlatObjectRecords: miscFlat.length,
        blockPositions, buildingDataList, section2UnknownData: new Array(32).fill(0), blockDataSizes: new Array(32).fill(0),
        groundData: groundDataFromJson(fh.GroundData), autoMapData: Uint8Array.from(fh.AutoMapData ?? new Array(AUTO_MAP_DATA_SIZE).fill(0)),
        name: fh.Name ?? name, otherNames: null,
      },
      subRecords, misc3dObjectRecords: misc3d, miscFlatObjectRecords: miscFlat,
    },
    rdbBlock: null,
    rdiBlock: null,
  };
}
/** BuildingReplacementData from `<block>-<index>-building<n>.json`. */
export function buildingReplacementFromJson(json) {
  return {
    factionId: json.FactionId ?? 0,
    buildingType: enumOf(BUILDING_TYPES, json.BuildingType, -1),
    quality: json.Quality ?? 0,
    nameSeed: json.NameSeed ?? 0,
    rmbSubRecord: rmbSubRecordFromJson(json.RmbSubRecord ?? {}),
    autoMapData: json.AutoMapData ? Uint8Array.from(json.AutoMapData) : null,
  };
}
