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

/** PlayerGPS.UndiscoverBuilding (:980-1010)'s store half: drop one
 *  building from a location's discovered set. TK-ii undiscovers quest
 *  RESIDENCES at topic-add so a previously discovered house does not
 *  pre-reveal on the automap when a quest names it. */
export function undiscoverBuilding(locationId, buildingKey) {
  _discovered.get(locationId)?.delete(buildingKey);
}

/** The location's discovered records, for the map that will draw them. */
export function discoveredBuildings(locationId) {
  return [..._discovered.get(locationId)?.values() ?? []].map((r) => ({ ...r }));
}

// G8-slice (guilds-8): the LOCATION half - PlayerGPS
// discoveredLocations, keyed by MapId & 0xfffff exactly as
// HasDiscoveredLocation masks it (:875-882). The guild map reveals
// write it; the travel map's hidden-dungeon law will read it (its own
// ledger row).
let _locations = new Map();   // (mapId & 0xfffff) -> { regionName, locationName }

/** DiscoverLocation's store write (:869-890, the summary columns). */
export function discoverLocation(mapId, info = {}) {
  const key = mapId & 0xfffff;
  if (_locations.has(key)) return false;
  _locations.set(key, { regionName: info.regionName ?? '', locationName: info.locationName ?? '' });
  return true;
}

/** HasDiscoveredLocation (:875-882). */
export function hasDiscoveredLocationId(mapId) {
  return _locations.has(mapId & 0xfffff);
}

/** DiscoverRandomLocation (PlayerGPS.cs:892-910), the pure law:
 *  candidates are the CURRENT region's rows with the BAKED MapTable
 *  Discovered flag false AND not already in the store; none left ->
 *  null ("there's nothing to find"); else a uniform pick
 *  (UnityEngine.Random.Range - injectable, Ledger A) is discovered
 *  and returned. regionLocations: [{ mapId, discovered, name,
 *  regionName }]. */
export function discoverRandomLocation(regionLocations, rolls = Math.random) {
  const candidates = (regionLocations ?? []).filter(
    (l) => !l.discovered && !hasDiscoveredLocationId(l.mapId));
  if (!candidates.length) return null;
  const pick = candidates[Math.floor(rolls() * candidates.length)];
  discoverLocation(pick.mapId, { regionName: pick.regionName, locationName: pick.name });
  return pick;
}

/** The save envelope's shape. G8: grew the `locations` half - the
 *  envelope is `{ buildings, locations }` now; restore still accepts
 *  the pre-G8 FLAT building map (locationIds carry a colon, so the
 *  key `buildings` can never collide with one). */
export function snapshotDiscovery() {
  const buildings = {};
  for (const [locId, b] of _discovered) {
    buildings[locId] = Object.fromEntries([...b].map(([k, r]) => [k, { ...r }]));
  }
  return { buildings, locations: Object.fromEntries([..._locations].map(([k, r]) => [k, { ...r }])) };
}

/** A load REPLACES both stores (missing on old saves = nothing found). */
export function restoreDiscovery(snap) {
  _discovered = new Map();
  _locations = new Map();
  if (!snap) return;
  const legacy = !snap.buildings && !snap.locations;
  const buildings = legacy ? snap : (snap.buildings ?? {});
  for (const [locId, b] of Object.entries(buildings)) {
    _discovered.set(locId, new Map(
      Object.entries(b).map(([k, r]) => [Number(k), { ...r }])));
  }
  for (const [k, r] of Object.entries(snap.locations ?? {})) {
    _locations.set(Number(k), { ...r });
  }
}
