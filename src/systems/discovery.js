// T4: PlayerGPS's building discovery - the state the 35% map-reveal
// writes and the town map will read. DiscoverBuilding
// (PlayerGPS.cs:917-975) and the DiscoveredBuilding record (:92-103),
// trimmed to the columns this port has sources for: the quest
// name-override machinery (:947-971), UndiscoverBuilding (:980-1010)
// and lastLockpickAttempt/customUserDisplayName all pend their arcs
// (quests, the automap UI).
//
// ONE module-level store, because there is one world - the same call
// worldTick's clock made (AUDIT 21 F2). DFU namespaces locations by
// MapPixelID (GetMapPixelIDFromLongitudeLatitude, :936); the talk seam
// does not carry a map pixel yet, so the location id is the caller's
// string (`region:location` today) - the automap arc swaps it to the
// pixel id when there is a map to draw, and the save shape below
// already keys by that one string.

let _discovered = new Map();   // locationId -> Map(buildingKey -> record)

/** DiscoverBuilding (:917-975): a no-op when already discovered
 *  (:926-928 - the override arm pends quests); otherwise the record
 *  lands whole. `building` is a talk-directory entry - it carries
 *  exactly the fields DFU's GetBaseBuildingDiscoveryData reads off
 *  its own building directory. */
export function discoverBuilding(locationId, building) {
  if (!building || building.buildingKey == null) return false;
  let loc = _discovered.get(locationId);
  if (!loc) { loc = new Map(); _discovered.set(locationId, loc); }
  if (loc.has(building.buildingKey)) return false;
  loc.set(building.buildingKey, {
    buildingKey: building.buildingKey,
    displayName: building.name ?? '',
    factionId: building.factionId ?? 0,
    quality: building.quality ?? 0,
    buildingType: building.buildingType ?? 0,
  });
  return true;
}

/** HasDiscoveredBuilding (:1038-1050). */
export function hasDiscoveredBuilding(locationId, buildingKey) {
  return _discovered.get(locationId)?.has(buildingKey) ?? false;
}

/** The location's discovered records, for the map that will draw them. */
export function discoveredBuildings(locationId) {
  return [..._discovered.get(locationId)?.values() ?? []].map((r) => ({ ...r }));
}

/** The save envelope's shape: plain nested objects, keyed as stored. */
export function snapshotDiscovery() {
  const out = {};
  for (const [locId, buildings] of _discovered) {
    out[locId] = Object.fromEntries([...buildings].map(([k, r]) => [k, { ...r }]));
  }
  return out;
}

/** A load REPLACES the store (missing on old saves = nothing found). */
export function restoreDiscovery(snap) {
  _discovered = new Map();
  for (const [locId, buildings] of Object.entries(snap ?? {})) {
    _discovered.set(locId, new Map(
      Object.entries(buildings).map(([k, r]) => [Number(k), { ...r }])));
  }
}
