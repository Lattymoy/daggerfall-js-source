// T4: PlayerGPS's building discovery - the state the 35% map-reveal
// writes and the town map will read. DiscoverBuilding
// (PlayerGPS.cs:917-975) and the DiscoveredBuilding record (:92-103),
// trimmed to the columns this port has sources for: the quest
// name-override machinery (:947-971) and customUserDisplayName pend
// their arcs (quests, the automap UI). R1: lastLockpickAttempt is
// LIVE - the exterior lockpicking anti-grind law (:1099-1126).
//
// ONE module-level store, because there is one world - the same call
// worldTick's clock made (AUDIT 21 F2). DFU namespaces locations by
// MapPixelID (GetMapPixelIDFromLongitudeLatitude, :936); the talk seam
// does not carry a map pixel yet, so the location id is the caller's
// string (`region:location` today) - the automap arc swaps it to the
// pixel id when there is a map to draw, and the save shape below
// already keys by that one string.

import { isResidence } from '../world/buildingNames.js';   // RMBLayout.IsResidence (:753-760), House1-House4

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
    lastLockpickAttempt: 0,   // R1: PlayerGPS.cs:101 - the failed-attempt skill record
    customUserDisplayName: '',   // c2/S10: the exterior automap's rename (PlayerGPS.cs:97)
  });
  return true;
}

/**
 * SetDiscoveredBuildingCustomName (PlayerGPS.cs:1057-1075) - the town
 * map's double-click rename. c2/S10 HALF B.
 *
 * DFU's own two laws, both kept: the write is a NO-OP for a building
 * that is not actually discovered ("If building not actually
 * discovered then nothing is changed", ExteriorAutomap.cs:914-915),
 * and the input is TRIMMED before it lands so a player cannot store
 * leading, trailing or whitespace-only names (:911-912). The plate
 * DRAWS this name and its tooltip keeps the canonical displayName -
 * that split lives in the window (:880-885), not here.
 */
export function setDiscoveredBuildingCustomName(locationId, buildingKey, name) {
  const rec = _discovered.get(locationId)?.get(buildingKey);
  if (!rec) return false;
  rec.customUserDisplayName = String(name ?? '').trim();
  return true;
}

/** GetLastLockpickAttempt (PlayerGPS.cs:1103-1110): the Lockpicking
 *  skill at the last FAILED exterior attempt on this building; 0 for
 *  a building not in the discovery store. The gate at the door is
 *  `skill <= lastAttempt` - the live skill must RISE past the failure
 *  before another roll is allowed; success never writes it and
 *  nothing ever clears it, verbatim. */
export function getLastLockpickAttempt(locationId, buildingKey) {
  return _discovered.get(locationId)?.get(buildingKey)?.lastLockpickAttempt ?? 0;
}

/** SetLastLockpickAttempt (:1118-1126): failure records the skill;
 *  a no-op for an undiscovered building, as DFU's lookup-guard is. */
export function setLastLockpickAttempt(locationId, buildingKey, skillValue) {
  const rec = _discovered.get(locationId)?.get(buildingKey);
  if (rec) rec.lastLockpickAttempt = skillValue;
}

/** HasDiscoveredBuilding (:1038-1050). */
export function hasDiscoveredBuilding(locationId, buildingKey) {
  return _discovered.get(locationId)?.has(buildingKey) ?? false;
}

/** FactionFile.FactionIDs.The_Thieves_Guild / The_Dark_Brotherhood
 *  (FactionFile.cs:91, :135) - the two hideout factions
 *  UndiscoverBuilding shields UNCONDITIONALLY. */
const THIEVES_GUILD_FACTION = 42;
const DARK_BROTHERHOOD_FACTION = 108;

/** PlayerGPS.UndiscoverBuilding (:986-1019): drop one building from a
 *  location's discovered set - AFTER the three refusals, in DFU's
 *  order (AUDIT 26 F099; the old cut deleted unconditionally):
 *  a non-residence when onlyIfResidence is set (:1006-1007), a
 *  Thieves Guild or Dark Brotherhood hideout ALWAYS - even on the
 *  bank's house-sale call, which passes neither optional (:1010-1012)
 *  - and a name that does not match the stored displayName
 *  (:1015-1016). TK-ii undiscovers quest RESIDENCES at topic-add so a
 *  previously discovered house does not pre-reveal on the automap
 *  when a quest names it; both quest callers (TalkManager.cs:2958,
 *  Quest.cs:655) pass (key, true, siteDetails.buildingName). */
export function undiscoverBuilding(locationId, buildingKey, onlyIfResidence = false, matchName = null) {
  const rec = _discovered.get(locationId)?.get(buildingKey);
  if (!rec) return;
  if (onlyIfResidence && !isResidence(rec.buildingType)) return;
  if (rec.factionId === THIEVES_GUILD_FACTION || rec.factionId === DARK_BROTHERHOOD_FACTION) return;
  if (matchName != null && matchName !== rec.displayName) return;
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
    // c2/S10: the missing-field discipline the rest of this store
    // already keeps - a record written before the rename shipped
    // restores with an EMPTY custom name, never `undefined`, so the
    // plate's `custom || name` fallback cannot read a hole.
    _discovered.set(locId, new Map(
      Object.entries(b).map(([k, r]) => [Number(k), { customUserDisplayName: '', ...r }])));
  }
  for (const [k, r] of Object.entries(snap.locations ?? {})) {
    _locations.set(Number(k), { ...r });
  }
}
