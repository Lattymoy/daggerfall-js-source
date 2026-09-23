// WORLD DATA VARIANTS - WorldDataVariants.cs (Assets/Scripts/Utility/
// AssetInjection, MIT, Hazelnut), the registry a quest's `worldupdate`
// line writes and the world-data replacement door reads: which variant
// of a location, a block or a building is in force, for one location
// or for every one. Pure state - the door that serves the variant's
// JSON (WorldDataReplacement) is RR3b's; this is the half the quest
// machine needs today, so Roleplay & Realism's Master Armorer line can
// set its shop's `master` variant the way the C# does (RR3).
//
// `MakeLocationKey` is WorldDataReplacement.cs:484-487, carried here so
// the key's law has one home: `(locationIndex * 100) + regionIndex`.

export const NO_VARIANT = '';
export const ANY_LOCATION_KEY = -8;   // "Cos 8 looks like infinity and also on keyboards has * symbol" (:49)

let lastLocationKey = 0;
let newLocationVariants = [];             // List<int>
let locationVariants = new Map();         // locationKey -> variant
let blockVariants = new Map();            // `${locationKey}|${blockName}` -> variant
let buildingVariants = new Map();         // `${locationKey}|${blockName}|${recordIndex}` -> variant

/** WorldDataReplacement.MakeLocationKey (:484-487). */
export const makeLocationKey = (regionIndex, locationIndex) => (locationIndex * 100) + regionIndex;
const blockKey = (locationKey, blockName) => `${locationKey}|${blockName}`;
const buildingKey = (locationKey, blockName, recordIndex) => `${locationKey}|${blockName}|${recordIndex}`;

/** RMBLayout.ClearLocationCache, the C#'s side effect on every set - the
 *  host that caches laid-out locations hangs its clear here. */
let _onChanged = null;
export function setVariantChangedHook(fn) { _onChanged = typeof fn === 'function' ? fn : null; }
/** WorldDataReplacement.GetNewDFLocationIndex (:106-125) - RR3b's door;
 *  until it stands, a new location is unknown (-1) and SetNewLocationVariant
 *  logs its failure, as the C# does for a name it cannot find. */
let _newLocationIndex = () => -1;
export function setNewLocationIndexResolver(fn) { _newLocationIndex = typeof fn === 'function' ? fn : () => -1; }

/** SetLastLocationKeyTo (:64-67). */
export function setLastLocationKeyTo(regionIndex, locationIndex) { lastLocationKey = makeLocationKey(regionIndex, locationIndex); }
export const lastLocationKeyOf = () => lastLocationKey;

// ---- setters (:78-162) ----------------------------------------------------------
/** SetLocationVariant (:78-90). Answers `added` exactly as the C# does -
 *  which is `ContainsKey` BEFORE the write (the C#'s own inversion, kept). */
export function setLocationVariant(regionIndex, locationIndex, variant) {
  const locationKey = makeLocationKey(regionIndex, locationIndex);
  const added = locationVariants.has(locationKey);
  if (variant === NO_VARIANT) locationVariants.delete(locationKey);
  else locationVariants.set(locationKey, variant);
  _onChanged?.();
  return added;
}
/** SetNewLocationVariant (:99-118). */
export function setNewLocationVariant(regionIndex, locationName, variant) {
  const locationIndex = _newLocationIndex(regionIndex, locationName);
  if (locationIndex >= 0) {
    const locationKey = makeLocationKey(regionIndex, locationIndex);
    const added = !locationVariants.has(locationKey);
    if (variant === NO_VARIANT) locationVariants.delete(locationKey);
    else locationVariants.set(locationKey, variant);
    if (!newLocationVariants.includes(locationKey)) newLocationVariants.push(locationKey);
    _onChanged?.();
    return added;
  }
  console.warn('[worlddata] Failed to set a new location variant.');
  return true;
}
/** SetBlockVariant (:129-141). */
export function setBlockVariant(blockName, variant, locationKey = ANY_LOCATION_KEY) {
  const key = blockKey(locationKey, blockName);
  const added = !blockVariants.has(key);
  if (variant === NO_VARIANT) blockVariants.delete(key);
  else blockVariants.set(key, variant);
  _onChanged?.();
  return added;
}
/** SetBuildingVariant (:150-162). */
export function setBuildingVariant(blockName, recordIndex, variant, locationKey = ANY_LOCATION_KEY) {
  const key = buildingKey(locationKey, blockName, recordIndex);
  const added = !buildingVariants.has(key);
  if (variant === NO_VARIANT) buildingVariants.delete(key);
  else buildingVariants.set(key, variant);
  _onChanged?.();
  return added;
}

// ---- getters for the current play session (:174-269) ------------------------------
/** GetLocationVariant (:174-183): sets the last location checked; answers
 *  { variant, newLocation }. */
export function getLocationVariant(locationKey) {
  lastLocationKey = locationKey;
  const v = locationVariants.get(locationKey);
  return { variant: v ?? NO_VARIANT, newLocation: v !== undefined && newLocationVariants.includes(locationKey) };   // AUDIT-RR2 G15: `newLocation` only inside the TryGetValue arm (:176-182)
}
/** GetBlockVariant(blockName) (:190-206): the last location's, else any's. */
export function getBlockVariantHere(blockName) {
  if (lastLocationKey < 0) return NO_VARIANT;   // AUDIT-RR F35: `if (lastLocationKey >= 0)` (:192) - a negative key asks nothing, not even AnyLocationKey
  return blockVariants.get(blockKey(lastLocationKey, blockName)) ?? blockVariants.get(blockKey(ANY_LOCATION_KEY, blockName)) ?? NO_VARIANT;
}
/** GetBuildingVariant(ref key, blockName) (:213-236): only asked for a key
 *  with NO variant yet; the last location's, else any's. */
export function getBuildingVariantHere(blockName, recordIndex, currentVariant = NO_VARIANT) {
  if (currentVariant !== NO_VARIANT) return NO_VARIANT;
  return buildingVariants.get(buildingKey(lastLocationKey, blockName, recordIndex)) ?? buildingVariants.get(buildingKey(ANY_LOCATION_KEY, blockName, recordIndex)) ?? NO_VARIANT;
}
/** GetBlockVariant(regionIndex, locationIndex, blockName) (:245-250): the
 *  variant set for that location, or null. */
export function getBlockVariant(regionIndex, locationIndex, blockName) {
  return blockVariants.get(blockKey(makeLocationKey(regionIndex, locationIndex), blockName)) ?? null;
}
/** GetBuildingVariant(regionIndex, locationIndex, blockName, recordIndex) (:260-265). */
export function getBuildingVariant(regionIndex, locationIndex, blockName, recordIndex) {
  return buildingVariants.get(buildingKey(makeLocationKey(regionIndex, locationIndex), blockName, recordIndex)) ?? null;
}

// ---- save, load & clear (:272-306) ------------------------------------------
/** Clear (:272-278). */
export function clearWorldDataVariants() {
  newLocationVariants = []; locationVariants = new Map(); blockVariants = new Map(); buildingVariants = new Map();
}
/** GetWorldVariationSaveData (:280-290): WorldVariationData_v1. */
export function getWorldVariationSaveData() {
  return {
    newLocationVariants: [...newLocationVariants],
    locationVariants: Object.fromEntries(locationVariants),
    blockVariants: Object.fromEntries(blockVariants),
    buildingVariants: Object.fromEntries(buildingVariants),
  };
}
/** RestoreWorldVariationData (:292-306): each half only when present. */
export function restoreWorldVariationData(data) {
  if (!data) return;
  if (data.newLocationVariants != null) newLocationVariants = [...data.newLocationVariants];
  if (data.locationVariants != null) locationVariants = new Map(Object.entries(data.locationVariants).map(([k, v]) => [Number(k), v]));
  if (data.blockVariants != null) blockVariants = new Map(Object.entries(data.blockVariants));
  if (data.buildingVariants != null) buildingVariants = new Map(Object.entries(data.buildingVariants));
}
