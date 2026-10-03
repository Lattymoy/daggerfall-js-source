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
import { isOnlinePage } from '../systems/onlineLane.js';   // WD3: online the door is the room's
import { NO_VARIANT, makeLocationKey, getLocationVariant, getBlockVariantHere, getBuildingVariantHere, setNewLocationIndexResolver, readingLocationKeyOf, noteReadingLocation } from '../systems/worldDataVariants.js';
import { LOCATION_TYPES, DUNGEON_TYPES, getWorldClimateSettings, REGION_NAMES } from './mapsFile.js';
import { BLOCK_TYPES, RDB_RESOURCE_TYPES } from './blocksFile.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { setWorldDataDoor } from './worldDataDoor.js';

export const AUTO_MAP_DATA_SIZE = 64 * 64;   // :45
const NO_REPLACEMENT = Symbol('noReplacement');   // the C#'s noReplacementRegion/Location/Block/Building sentinels
export { makeLocationKey };

/** DaggerfallUnity.Settings.AssetInjection. */
export const assetInjectionOn = () => getBool('Enhancements', 'AssetInjection');
/**
 * WD3: THE DOOR'S GATE. DFU's is AssetInjection alone, and offline it stays so. ONLINE THE GROUND IS THE ROOM'S: the
 * world-data mods the room owns (systems/onlineLane.js ONLINE_ROOM_MOD_KEYS - Beautiful Villages and Cities, Detailed
 * Ships, Roleplay & Realism's fort) stand buildings, decks and walls every player walks, and a player's Replace Game
 * Artwork switched off stood none of them on that one screen - a departure (Port-Ledger, WD3): online the door is open
 * whatever the switch says, which keeps the textures and the music it gates elsewhere. Each mod's own switch still
 * decides its files.
 */
// WD3 (AUDIT WD3 P2/P3): READ ONCE FOR THE GAME. DFU reads AssetInjection at startup - a change waits for a restart -
// and the boot's location index keeps a pack's grids, whose new blocks only the door can serve: a gate turned shut
// mid-game would stand holes in every town. The mod loader latches it beside the mods' switches
// (scenes/modWorldData.js), and a closed door loads no pack and stamps no town with a layout it does not show.
let _doorLatched = null;
export function latchWorldDataDoor() { _doorLatched = assetInjectionOn() || isOnlinePage(); return _doorLatched; }
export const worldDataDoorOpen = () => _doorLatched ?? (assetInjectionOn() || isOnlinePage());
const worldDataOn = worldDataDoorOpen;

// ---- the mod's assets (ModManager.TryGetAsset / FindAssets, the port's one source) ----
// WD3: a name may be carried by more than one mod (Beautiful Villages and Beautiful Cities both ship FIGHBM00.RMB,
// and they differ). ModManager.TryGetAsset walks the ENABLED mods in reverse load order and takes the first that has
// the asset (ModManager.cs:404-427, EnumerateEnabledModsReverse) - so each name keeps every mod's entry, highest
// load priority first, and the live one answers: a switched-off mod never hides the one under it, and two mods'
// order is the load order's, never the order their files happened to arrive in.
const _assets = new Map();   // file name -> [{ json, get, isOn, priority, vendor }], highest priority first
function addAssetEntry(fileName, entry) {
  const list = _assets.get(fileName) ?? [];
  const mine = list.findIndex((e) => (e.vendor ?? null) === (entry.vendor ?? null));
  if (mine >= 0) list.splice(mine, 1);   // a mod registering its own file again replaces it (a registration naming no mod, WD1's, replaces the last that named none - the C#'s one asset a name)
  // a later registration of equal priority stands in front (the C# Map.set's last-writer rule, kept for WD1's files)
  let at = list.findIndex((e) => e.priority <= entry.priority);
  if (at < 0) at = list.length;
  list.splice(at, 0, entry);
  _assets.set(fileName, list);
}
/** A vendored mod's world-data file by its DFU name; `isOn` is the mod's
 *  switch (a mod that is off is a mod DFU never loaded); `priority` its
 *  place in the load order (higher wins), `vendor` whose it is. */
export function registerWorldDataAsset(fileName, json, isOn = null, { priority = 0, vendor = null } = {}) {
  if (!fileName || json == null) return false;
  addAssetEntry(fileName, { json, get: null, isOn: typeof isOn === 'function' ? isOn : null, priority, vendor });
  return true;
}
/** WD3: every file of an opened world-data pack (formats/worldDataPack.js) on the door, each rebuilt from the
 *  player's own data the first time it is asked for. Answers how many names it registered. */
export function registerWorldDataPack(pack, isOn = null, { priority = 0 } = {}) {
  if (!pack?.names) return 0;
  let n = 0;
  for (const name of pack.names()) {
    addAssetEntry(name, { json: null, get: (maps) => pack.rebuild(name, maps), isOn: typeof isOn === 'function' ? isOn : null, priority, vendor: pack.vendor });
    n++;
  }
  return n;
}
function assetOn(a) {
  if (!a) return false;
  const pin = a.vendor ? pinHere() : null;
  if (pin?.in?.has(a.vendor)) return true;     // WD3: a town a save made in this mod's layout keeps it
  if (pin?.out?.has(a.vendor)) return false;   // WD3: and one made without it stays without it
  return a.isOn?.() ?? true;
}
/** WD3: whether a mod carries a world-data file - the layout pins ask which mods a town's files come from
 *  (systems/layoutPins.js). Answers for the mods on the door: one never loaded carries nothing here. */
export const worldDataVendorCarries = (vendor, fileName) => (_assets.get(fileName) ?? []).some((a) => a.vendor === vendor);
function liveAsset(fileName) {
  for (const a of _assets.get(fileName) ?? []) if (assetOn(a)) return a;
  return null;
}
/** A pack file that will not rebuild on this player's data is said once and not served (WD1's "a patch whose ops do
 *  not land is said and not served") - the location or block is the classic one, never a throw out of the reader. */
const _refused = new Set();
function assetJson(a, fileName, maps) {
  if (a.json != null) return a.json;
  try {
    return a.get(maps);
  } catch (e) {
    if (!_refused.has(fileName)) { _refused.add(fileName); console.error(`[worlddata] ${fileName} (${a.vendor}): ${e?.message ?? e} - not served`); }
    return null;
  }
}
/** ModManager.TryGetAsset(fileName): the JSON, or null. `maps` is the
 *  MapsFile asking (a location file of a pack is an edit of its classic
 *  location). */
function tryGetAsset(fileName, maps = null) { const a = liveAsset(fileName); return a ? assetJson(a, fileName, maps) : null; }
/** ModManager.FindAssets<TextAsset>(worldData, extension): every asset
 *  whose name ends so, in registration order (the C#'s list). The JSON is
 *  read when asked for - a pack's 7,000 location files are never rebuilt
 *  to be passed over by a `locationnew-` filter. */
function findAssets(extension) {
  const out = [];
  for (const [name] of _assets) {
    if (!name.endsWith(extension)) continue;
    const a = liveAsset(name);
    if (a) out.push({ name, get json() { return assetJson(a, name, null); } });
  }
  return out;
}

// ---- WD3: layout pins (systems/layoutPins.js decides; the door only asks) ----
// A town whose buildings a save has made its own - a house bought, decorated and filled, a room rented, a quest's
// site - keeps the layout those were made in: its location and the blocks laid out in it are served with exactly the
// world-data mods that were serving it then. The oracle answers, for the location the door is asked about (a
// location by its own key; a block or a building by the town whose grid named it - WorldDataVariants'
// readingLocationKeyOf, which MapsFile.getRmbBlockName notes and a location read takes back), the vendors pinned out
// of it and pinned into it, or null.
let _pinAt = () => null;   // (locationKey) -> { out:Set<vendor>, in:Set<vendor> } | null
/** The pin oracle (systems/layoutPins.js installs it). */
export function setLayoutPinOracle(fn) { _pinAt = typeof fn === 'function' ? fn : () => null; }
let _pinKey = null;   // the location a pin is being asked for; null = the town whose blocks are being read
const pinLocationKey = () => _pinKey ?? readingLocationKeyOf();
const pinHere = () => _pinAt(pinLocationKey());

// ---- the caches (:57-65) ----
let regions = new Map();          // regionIndex -> dfRegion | NO_REPLACEMENT
let locations = new Map();        // `${locationKey}${variant}` -> dfLocation | NO_REPLACEMENT
let blocks = new Map();           // `${blockName}${variant}` -> dfBlock | NO_REPLACEMENT
/** WD3 (AUDIT WD3 B4): the blocks served, the most recently asked kept - DFU keeps every one for the session, and a
 *  walk across the Bay with the town packs on built some 260 MB of them; a block let go is rebuilt when next asked
 *  (the same JSON, the same block). A town of 8 x 8 blocks and its neighbours stand well inside it. */
export const BLOCK_CACHE_MAX = 192;
function cacheBlock(key, value) {
  blocks.set(key, value);
  if (blocks.size > BLOCK_CACHE_MAX) blocks.delete(blocks.keys().next().value);
}
let buildings = new Map();        // `${blockIndex}|${recordIndex}|${variant}` -> data | NO_REPLACEMENT
let nextBlockIndex = 0;
let newBlockNames = new Map();    // block index -> name
let newBlockIndices = new Map();  // name -> block index
let _blocksFile = null;           // ContentReader.BlockFileReader (AssignBlockIndices' read of BsaFile.Count)

/** The host's BlocksFile - what AssignBlockIndices asks for the BSA's
 *  count and a name's classic index. */
export function bindWorldDataBlocks(blocksFile) { _blocksFile = blocksFile ?? null; }
/** WD1: the bound BlocksFile, for the world-data patches' classic reads (scenes/modWorldData.js). */
export const boundWorldDataBlocks = () => _blocksFile;
/** Once: the readers' door. Tests reset with `_resetWorldDataReplacement`. */
export function installWorldDataReplacement() {
  setNewLocationIndexResolver(getNewDFLocationIndex);   // AUDIT-RR F33: SetNewLocationVariant -> GetNewDFLocationIndex (WorldDataVariants.cs:101) - RR3a's seam, wired
  setWorldDataDoor({ getDFRegionAdditionalLocationData, getDFLocationReplacementData, getDFBlockReplacementData, getBuildingReplacementData, getNewDFBlockName, getNewDFBlockIndex, applyBuildingReplacementAutoMapData, noteReadingLocation, editLocation });   // WD3: MapsFile.getRmbBlockName names the town whose blocks come next; ARENA1: the port's own edits of a location read
}
export function _resetWorldDataReplacement({ assets = true } = {}) {
  regions = new Map(); locations = new Map(); blocks = new Map(); buildings = new Map();
  nextBlockIndex = 0; newBlockNames = new Map(); newBlockIndices = new Map(); _blocksFile = null;
  _refused.clear(); _quietLocations = false; _doorLatched = null;
  if (assets) { _assets.clear(); _portBlocks.clear(); _locationEdits.length = 0; }
}

// ---- ARENA1: THE PORT'S OWN WORLD DATA - not a mod's, so behind no switch ----
// The Arena of Daggerfall is not a layout mod and not a switch (bible/11-Multiplayer/Arena.md "How it is laid": "the
// arena is not a switch, it is the city"), so its block and its edit of the city are served whatever AssetInjection,
// a mod's switch or a save's pin says - and outside DFU's new-block sequence: a port block takes a FIXED index past
// any BSA (world/gateArena.js's made block is the precedent), so the first block a mod's file names still takes
// BsaFile.Count (DFU's AssignBlockIndices, RR3b) and no pack's new block moves.
const _portBlocks = new Map();   // name -> { index, json, block }
/** A block of the port's own, by name, at a fixed index (>= 900000). */
export function registerPortBlock(name, json, index) {
  if (!name || json == null || !Number.isSafeInteger(index)) return false;
  _portBlocks.set(name, { index, json, block: null });
  return true;
}
const portBlockByIndex = (index) => { for (const [name, b] of _portBlocks) if (b.index === index) return name; return null; };
function portBlock(name) {
  const b = _portBlocks.get(name);
  if (!b) return null;
  b.block ??= blockFromJson(b.json, b.index);
  return b.block;
}
/** ARENA1: an edit the port makes to a location as it is read - `fn(dfLocation, maps, blocksFile)`, after the
 *  location is read (MAPS.BSA's, a mod's file, a pinned town's), with its indices set. Never on readClassicLocation:
 *  that is the location a pack's edit is taken against. */
const _locationEdits = [];
export function registerLocationEdit(fn) { if (typeof fn === 'function' && !_locationEdits.includes(fn)) _locationEdits.push(fn); }
let _editing = false;   // a location read inside an edit (a pin oracle asking a town's type) is answered unedited
export function editLocation(dfLocation, maps = null) {
  if (_editing || !dfLocation) return dfLocation;
  _editing = true;
  try { for (const fn of _locationEdits) fn(dfLocation, maps, _blocksFile); } finally { _editing = false; }
  return dfLocation;
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
  if (!worldDataOn() || !dfRegion) return false;
  const cached = regions.get(regionIndex);
  if (cached !== undefined) {
    if (cached !== NO_REPLACEMENT) { copyRegionInto(cached, dfRegion); return true; }
    return false;
  }
  const dataLocationCount = dfRegion.locationCount;
  let locationAssignmentSuccess = true;
  for (const asset of findAssets(`-${regionIndex}.json`)) {
    const { name } = asset;
    if (!name.startsWith('locationnew-')) continue;
    const json = asset.json;   // WD3: read only now - a pack's `location-<r>-<i>.json` ending in this region's number is passed over unread
    // AUDIT-RR2 G3: DFU's throw escapes this one region's read (MapsFile.cs:984, outside ReadRegion's catch) when the
    // region is first loaded; the port's boot index reads EVERY region, so one bad mod file is said and its location
    // skipped rather than the whole world host dying at boot - a departure, recorded
    try {
      const dfLocation = locationFromJson(json, regionIndex);
      locationAssignmentSuccess = addLocationToRegion(regionIndex, dfRegion, dfLocation) && locationAssignmentSuccess;
    } catch (e) { console.error(`[worlddata] ${name}: ${e?.message ?? e}`); locationAssignmentSuccess = false; }
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
  // AUDIT-RR F37 / AUDIT-RR2 G3: `Dictionary.Add` (:521-522) THROWS on a mapId or name a vanilla location already has -
  // the region load fails loudly in DFU, and a silent remap of the vanilla entry would be the port's own invention.
  // Asked BEFORE any write: the C# pushes to LOCAL lists copied back only on success (:176-177), so its DFRegion is
  // left whole; the port writes the region's own arrays and must not leave a row its lookups do not know
  if (dfRegion.mapIdLookup.has(dfLocation.mapTableData.mapId)) throw new Error(`[worlddata] region ${regionIndex}: mapId ${dfLocation.mapTableData.mapId} is already a location's (${dfLocation.name})`);
  if (dfRegion.mapNameLookup.has(dfLocation.name)) throw new Error(`[worlddata] region ${regionIndex}: a location named ${JSON.stringify(dfLocation.name)} already stands`);
  // Copy the location id for ReadLocationIdFast() to use instead of peeking the classic data files
  dfLocation.mapTableData.locationId = dfLocation.exterior.recordElement.header.locationId;
  const locationIndex = dfRegion.locationCount++;
  dfRegion.mapNames.push(dfLocation.name);
  dfLocation.locationIndex = locationIndex;
  dfLocation.exterior.recordElement.header.unknown2 = locationIndex >>> 0;
  dfRegion.mapTable.push(dfLocation.mapTableData);
  dfRegion.mapIdLookup.set(dfLocation.mapTableData.mapId, locationIndex);
  dfRegion.mapNameLookup.set(dfLocation.name, locationIndex);
  locations.set(String(makeLocationKey(regionIndex, locationIndex)), dfLocation);
  return assignBlockIndices(dfLocation);
}

// ---- GetDFLocationReplacementData (:204-262) ----
/** The replacement (or new) DFLocation for region/index, or null. `maps`
 *  is the MapsFile asking (WD3: a pack's location file is rebuilt over the
 *  location as that reader holds it). */
export function getDFLocationReplacementData(regionIndex, locationIndex, maps = null) {
  if (!worldDataOn()) return null;
  const locationKey = makeLocationKey(regionIndex, locationIndex);
  const { variant, newLocation } = getLocationVariant(locationKey);
  let locationVariantKey = `${locationKey}${variant}`;
  if (newLocation && !locations.has(locationVariantKey)) {
    if (!loadNewDFLocationVariant(regionIndex, locationIndex, variant)) locationVariantKey = String(locationKey);   // Fall back to non-variant if load fails
  }
  // WD3: a pinned town is asked fresh - its answer is the save's, never the cache's
  const fileName = locationReplacementFilename(regionIndex, locationIndex, variant);
  if (pinnedHere(locationKey, fileName)) {
    if (newLocation) return locations.get(locationVariantKey) ?? null;   // a location a mod ADDED is no town's layout to keep
    const json = withPinKey(locationKey, () => tryGetAsset(fileName, maps));
    if (!json) return null;
    const dfLocation = locationFromJson(json, regionIndex);
    dfLocation.locationIndex = locationIndex;
    assignBlockIndices(dfLocation);
    return dfLocation;
  }
  const cached = locations.get(locationVariantKey);
  if (cached !== undefined) return cached === NO_REPLACEMENT ? null : cached;
  const json = tryGetAsset(fileName, maps);
  if (!json) {
    if (variant === NO_VARIANT) locations.set(locationVariantKey, NO_REPLACEMENT);
    return null;
  }
  const dfLocation = locationFromJson(json, regionIndex);
  dfLocation.locationIndex = locationIndex;
  if (assignBlockIndices(dfLocation)) locations.set(locationVariantKey, dfLocation);
  if (!_quietLocations) console.log(`[worlddata] Found DFLocation override, region:${regionIndex}, index:${locationIndex} variant:${variant}`);
  return dfLocation;
}
/** WD3: a pack's thousands of locations, and the hundreds of new blocks their grids name, are not each logged (the
 *  loader counts the files once). */
let _quietLocations = false;
export function quietLocationOverrides(on) { _quietLocations = !!on; }
/** WD3: whether a pin turns away a mod that carries this file at this location - only then is the cache bypassed. */
function pinnedHere(locationKey, fileName) {
  const pin = _pinAt(locationKey);
  if (!pin || (!pin.out?.size && !pin.in?.size)) return false;
  return (_assets.get(fileName) ?? []).some((a) => a.vendor && (pin.out?.has(a.vendor) || pin.in?.has(a.vendor)));
}
function withPinKey(key, fn) {
  const was = _pinKey;
  _pinKey = key;
  try { return fn(); } finally { _pinKey = was; }
}
/** LoadNewDFLocationVariant (:263-298): the variant of a NEW location,
 *  from `locationnew-*-<region><variant>.json`. */
export function loadNewDFLocationVariant(regionIndex, locationIndex, variant) {
  const locationKey = makeLocationKey(regionIndex, locationIndex);
  const base = locations.get(String(locationKey));
  if (!base || base === NO_REPLACEMENT) return false;
  const locationVariantKey = `${locationKey}${variant}`;
  if (locations.has(locationVariantKey)) return false;
  for (const asset of findAssets(`-${regionIndex}${variant}.json`)) {
    // AUDIT-RR2 G16: the mod arm (:284-292) takes EVERY asset the suffix finds - only the loose-file arm (:271) names locationnew-*
    const json = asset.json;
    if (!json) continue;
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
export const getNewDFBlockIndex = (blockName) => _portBlocks.get(blockName)?.index ?? newBlockIndices.get(blockName) ?? -1;   // ARENA1: a port block first
export const getNewDFBlockName = (block) => portBlockByIndex(block) ?? newBlockNames.get(block) ?? null;
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
  if (!_quietLocations) console.log(`[worlddata] Found a new DFBlock: ${blockName}, (assigned index: ${nextBlockIndex})`);   // WD3: a pack's 439 new blocks are not each logged either
  nextBlockIndex++;
}

// ---- GetDFBlockReplacementData (:342-398) ----
/** The JSON block for this index and name, in the port's DFBlock shape,
 *  with its RMB buildings replaced where a building file says so; null
 *  when the mod ships none. */
export function getDFBlockReplacementData(block, blockName) {
  if (blockName && _portBlocks.has(blockName)) return portBlock(blockName);   // ARENA1: the port's own, behind no door
  if (!worldDataOn() || !blockName) return null;
  const variant = getBlockVariantHere(blockName);
  const blockKey = `${blockName}${variant}`;
  // WD3: a block laid out in a pinned town is asked fresh, without the mods its pin turns away
  if (pinnedHere(pinLocationKey(), blockReplacementFilename(blockName, variant))) {
    const json = tryGetAsset(blockReplacementFilename(blockName, variant));
    if (!json) return null;
    const dfBlock = blockFromJson(json, block);
    if (blockName.endsWith('.RMB')) replaceRmbBlockBuildingData(blockName, block, dfBlock);
    return dfBlock;
  }
  const cached = blocks.get(blockKey);
  if (cached !== undefined) { blocks.delete(blockKey); blocks.set(blockKey, cached); return cached === NO_REPLACEMENT ? null : cached; }   // AUDIT WD3 B4: the most recent last
  const json = tryGetAsset(blockReplacementFilename(blockName, variant));
  if (!json) {
    if (variant === NO_VARIANT) cacheBlock(blockName, NO_REPLACEMENT);
    return null;
  }
  // WD1 (Aquatic Sprites' three wet blocks): the whole DFBlock, RdbBlock and RdiBlock included (:363-369) - the
  // AUDIT-RR2 G14 refusal of RDB/RDI files is lifted now that the converters below read both halves
  const dfBlock = blockFromJson(json, block);
  if (blockName.endsWith('.RMB')) replaceRmbBlockBuildingData(blockName, block, dfBlock);   // :382-384 - RMB blocks only
  cacheBlock(blockKey, dfBlock);
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
  if (!worldDataOn() || !blockName) return null;
  const variant = getBuildingVariantHere(blockName, recordIndex, NO_VARIANT);
  const key = `${blockIndex}|${recordIndex}|${variant}`;
  const file = buildingReplacementFilename(blockName, blockIndex, recordIndex, variant);
  if (pinnedHere(pinLocationKey(), file)) { const json = tryGetAsset(file); return json ? buildingReplacementFromJson(json) : null; }   // WD3
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
        header: recordHeaderFromJson(h, json.Name),
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
    dungeon: json.Dungeon ? dungeonFromJson(json.Dungeon, json.Name) : { recordElement: null, header: null, blocks: null },
  };
}
/** LocationRecordElementHeader from its JSON (DFLocation.cs) - the exterior's and the dungeon's alike. */
function recordHeaderFromJson(h, name) {
  return {
    alwaysOne1: 1, x: h.X ?? 0, y: h.Y ?? 0, isExterior: h.IsExterior ?? 0, unknown1: 0, unknown2: h.Unknown2 ?? 0, alwaysOne2: 1,
    locationId: h.LocationId ?? 0, isInterior: h.IsInterior ?? 0, exteriorLocationId: h.ExteriorLocationId ?? 0, locationName: h.LocationName ?? name ?? '',
  };
}
// WD3 (AUDIT WD3 P1): LocationDungeon.RecordElement is a public field DFU keeps (DFLocation.cs) and every dungeon
// reader asks its header's LocationId (world/dungeonLayout.js, scenes/dungeonContext.js, systems/save.js) - a town
// with a dungeon (Castle Daggerfall, Sentinel, Wayrest under Beautiful Cities) carries it, and it is read here.
function dungeonFromJson(d, name) {
  return {
    recordElement: { doorCount: 0, doors: [], header: recordHeaderFromJson(d.RecordElement?.Header ?? {}, name) },
    header: d.Header ? { nullValue1: 0, unknown1: 0, unknown2: 0, blockCount: d.Header.BlockCount ?? (d.Blocks?.length ?? 0), unknown3: null } : null,
    blocks: (d.Blocks ?? []).map((b) => ({ x: b.X ?? 0, z: b.Z ?? 0, isStartingBlock: !!b.IsStartingBlock, blockName: b.BlockName ?? '', blockIndex: b.BlockIndex ?? 0, blockNumber: b.BlockNumber ?? 0, blockCharacter: b.BlockCharacter ?? 0 })),
  };
}
/** The RMB model, flat, section-3, people and door records (the
 *  `_readRmb*` shapes with the fields the JSON does not carry zeroed). */
const modelFromJson = (m) => ({
  position: 0, modelIdNum: m.ModelIdNum ?? Number(m.ModelId ?? 0), modelId: String(m.ModelId ?? m.ModelIdNum ?? 0), objectType: m.ObjectType ?? 0,
  unknown1: 0, unknown2: 0, unknown3: 0, xPos1: 0, yPos1: 0, zPos1: 0,
  xPos: m.XPos ?? 0, yPos: m.YPos ?? 0, zPos: m.ZPos ?? 0,
  // WD1: RmbBlock3dObjectRecord's XScale/YScale/ZScale (DFBlock.cs:407-420) - a JSON record's own; zero (absent) is
  // "unscaled" at the layout (RMBLayout.GetModelScaleVector; world/rmbLayout.js modelScale). Float32 fields.
  xScale: Math.fround(m.XScale ?? 0), yScale: Math.fround(m.YScale ?? 0), zScale: Math.fround(m.ZScale ?? 0),
  nullValue2: 0,
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
/** DFBlock from `<block>.RMB.json` / `.RDB.json` / `.RDI.json`: the
 *  port's `loadBlock` record with `index` the caller's (the C# sets
 *  dfBlock.Index = block). An RMB's FLD header takes its positions from
 *  the subrecords (the JSON carries them there) and its record counts
 *  from the arrays; an RDB or RDI file serves its own half (WD1). */
export function blockFromJson(json, index) {
  const name = json.Name ?? '';
  const type = enumOf(BLOCK_TYPES, json.Type, name.endsWith('.RMB') ? BLOCK_TYPES.Rmb : name.endsWith('.RDB') ? BLOCK_TYPES.Rdb : name.endsWith('.RDI') ? BLOCK_TYPES.Rdi : BLOCK_TYPES.Unknown);
  if (type === BLOCK_TYPES.Rdb || type === BLOCK_TYPES.Rdi) {
    return {
      position: json.Position ?? 0, index, name, type, fromWorldData: true,   // WD3: served from a mod's JSON, not BLOCKS.BSA
      rmbBlock: null,
      rdbBlock: type === BLOCK_TYPES.Rdb ? rdbBlockFromJson(json.RdbBlock ?? {}) : null,
      rdiBlock: type === BLOCK_TYPES.Rdi ? { data: json.RdiBlock?.Data ? Uint8Array.from(json.RdiBlock.Data) : null } : null,
    };
  }
  const rmb = json.RmbBlock ?? {};
  const fh = rmb.FldHeader ?? {};
  const subRecords = (rmb.SubRecords ?? []).map(rmbSubRecordFromJson);
  const misc3d = (rmb.Misc3dObjectRecords ?? []).map(modelFromJson);
  const miscFlat = (rmb.MiscFlatObjectRecords ?? []).map(flatFromJson);
  const blockPositions = new Array(32).fill(null).map((_, i) => ({ unknown1: 0, unknown2: 0, xPos: subRecords[i]?.xPos ?? 0, zPos: subRecords[i]?.zPos ?? 0, yRotation: subRecords[i]?.yRotation ?? 0 }));
  const buildingDataList = (fh.BuildingDataList ?? []).map(buildingDataFromJson);
  while (buildingDataList.length < 32) buildingDataList.push({ ...emptyBuildingData(), buildingType: -1 });   // AUDIT-RR2 G19: DFU's list is the JSON's length; the port's 32-slot shape pads with BuildingTypes.None (-1), not Alchemist (0)
  return {
    position: json.Position ?? 0,
    index,
    name,
    type,
    fromWorldData: true,   // WD3: served from a mod's JSON, not BLOCKS.BSA (world/rmbLayout.js: its own mills, not Kamer's)
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: subRecords.length, numMisc3dObjectRecords: misc3d.length, numMiscFlatObjectRecords: miscFlat.length,
        blockPositions, buildingDataList, section2UnknownData: new Array(32).fill(0), blockDataSizes: new Array(32).fill(0),
        groundData: groundDataFromJson(fh.GroundData), autoMapData: Uint8Array.from(fh.AutoMapData ?? new Array(AUTO_MAP_DATA_SIZE).fill(0)),
        // WD3: FldHeader.OtherNames is a public field FullSerializer writes and reads (DFBlock.cs), so a block served
        // from JSON keeps it - and RMBLayout's Order of the Raven case (KRAVE01.HS2 -> GuildHall, faction 414,
        // RMBLayout.cs:677-683; talkTopics.mergeNamedBuildings) fires for Beautiful Cities' knightly blocks as in DFU.
        // A file that leaves it out (RRFORT01) carries none.
        name: fh.Name ?? name, otherNames: Array.isArray(fh.OtherNames) ? [...fh.OtherNames] : null,
      },
      subRecords, misc3dObjectRecords: misc3d, miscFlatObjectRecords: miscFlat,
    },
    rdbBlock: null,
    rdiBlock: null,
  };
}
// ---- the RDB half (WD1) ----
/** DFBlock.RdbResourceTypes by name. */
const RDB_RESOURCE_BY_NAME = Object.freeze({ Model: RDB_RESOURCE_TYPES.Model, Light: RDB_RESOURCE_TYPES.Light, Flat: RDB_RESOURCE_TYPES.Flat });
/** RdbActionResource: a Model object's own, or DFU's default struct (every field zero) when the JSON leaves the resource out. */
const actionResourceFromJson = (a) => ({
  position: a?.Position ?? 0, axis: a?.Axis ?? 0, duration: a?.Duration ?? 0, magnitude: a?.Magnitude ?? 0,
  nextObjectOffset: a?.NextObjectOffset ?? 0, flags: a?.Flags ?? 0,
  previousObjectOffset: a?.PreviousObjectOffset ?? 0, nextObjectIndex: a?.NextObjectIndex ?? 0,
});
/** RdbResources: the one resource RdbObjectProcessor wrote, the other two left at DFU's default struct. */
function rdbResourcesFromJson(r) {
  const m = r?.ModelResource, f = r?.FlatResource, l = r?.LightResource;
  return {
    modelResource: {
      xRotation: m?.XRotation ?? 0, yRotation: m?.YRotation ?? 0, zRotation: m?.ZRotation ?? 0, modelIndex: m?.ModelIndex ?? 0,
      triggerFlagStartingLock: m?.TriggerFlag_StartingLock ?? 0, soundIndex: m?.SoundIndex ?? 0, actionOffset: 0,
      actionResource: actionResourceFromJson(m?.ActionResource),
    },
    flatResource: {
      position: f?.Position ?? 0,
      textureBitfield: (((f?.TextureArchive ?? 0) << 7) | ((f?.TextureRecord ?? 0) & 0x7f)) & 0xffff,
      textureArchive: f?.TextureArchive ?? 0, textureRecord: f?.TextureRecord ?? 0, flags: f?.Flags ?? 0,
      magnitude: f?.Magnitude ?? 0, soundIndex: f?.SoundIndex ?? 0, factionOrMobileId: f?.FactionOrMobileId ?? 0,
      nextObjectOffset: f?.NextObjectOffset ?? 0, action: f?.Action ?? 0,
      isCustomData: !!f?.IsCustomData,   // DFU's own field (DFBlock.cs:1064): a custom marker's whole FactionOrMobileId is its MobileType
    },
    lightResource: { unknown1: l?.Unknown1 ?? 0, unknown2: l?.Unknown2 ?? 0, radius: l?.Radius ?? 0 },
  };
}
/** RdbBlockDesc from its JSON: the reference list as written (cut at the
 *  first unused slot), the object roots with their objects. The internal
 *  members (Header, ModelDataList, ObjectHeader, UnknownObjectList) are
 *  not serialised and come back at their defaults, as in the C#. */
export function rdbBlockFromJson(j) {
  return {
    position: 0, header: null, modelDataList: null, objectHeader: null, unknownObjectList: null,
    modelReferenceList: (j.ModelReferenceList ?? []).map((m) => ({ modelId: m.ModelId ?? '', modelIdNum: m.ModelIdNum ?? 0, description: m.Description ?? '' })),
    objectRootList: (j.ObjectRootList ?? []).map((g) => ({
      rootOffset: 0,
      rdbObjects: g?.RdbObjects ? g.RdbObjects.map((o) => ({
        position: o.Position ?? 0, next: 0, previous: 0, index: o.Index ?? 0,
        xPos: o.XPos ?? 0, yPos: o.YPos ?? 0, zPos: o.ZPos ?? 0,
        type: enumOf(RDB_RESOURCE_BY_NAME, o.Type, 0), resourceOffset: 0,
        resources: rdbResourcesFromJson(o.Resources),
      })) : null,
    })),
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
