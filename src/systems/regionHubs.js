// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HUB1 (2026-09-25) — EVERY REGION'S MAIN CITY IS ITS HUB.
//
// Mac: "One big thing Im trying to brain storm is giving each region's
// main city a natural player hub and future ownership for online
// guilds". Asked, Mac chose the whole arc - exclusive homes, a
// decorator of our own, guilds, and seat ownership "all out" - and left
// respawning at a hub out of it ("That'll be a seperate idea"). This
// slice is the ground the rest stands on: WHICH city is each region's
// hub, the same answer on every client, and the player told so - on
// the held map and on arrival. Online only; offline nothing changes.
//
// THE RULE, over the region's OWN locations - the rows MAPS.BSA holds.
// A world-data mod's additions are appended past them (formats/
// worldDataReplacement.js addLocationToRegion) and never count, so a
// player with AssetInjection on and one with it off agree:
//   1. the best KIND - a city over a town over a village;
//   2. then the one NAMED FOR ITS REGION (Daggerfall, Wayrest, ...);
//   3. then the LARGEST - its exterior blocks, then its buildings;
//   4. then the lowest location index.
// A region with no settlement has no hub (17 of the 62 hold nothing at
// all). The three kingdoms' own cities - Daggerfall, Wayrest, Sentinel,
// each named for its region - are CAPITALS.
//
// Pure: the locations and the region names are arguments.
// ═══════════════════════════════════════════════════════════════════

import { REGION_NAMES, LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';

/** The three kingdoms of the Iliac Bay: a hub named for one of these regions is a capital. */
export const HUB_CAPITALS = Object.freeze(['Daggerfall', 'Wayrest', 'Sentinel']);

/** A settlement's kind, best first: a city, a town (hamlet), a village. Nothing else is a settlement. */
const KIND_RANK = Object.freeze({
  [LOCATION_TYPES.TownCity]: 3,
  [LOCATION_TYPES.TownHamlet]: 2,
  [LOCATION_TYPES.TownVillage]: 1,
});

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A location's claim to be its region's hub, read in order: [kind, named for the region, exterior blocks,
 * buildings, the lower index]. Null for a location that is no settlement.
 */
export function hubClaim(loc, regionName) {
  const kind = KIND_RANK[loc?.mapTableData?.locationType];
  if (!kind) return null;
  const ext = loc.exterior?.exteriorData;
  const blocks = (ext?.width | 0) * (ext?.height | 0);
  const buildings = loc.exterior?.buildingCount | 0;
  return [kind, same(loc.name, regionName) ? 1 : 0, blocks, buildings, -(loc.locationIndex | 0)];
}

/** Whether claim `a` outranks claim `b`: the first place they differ decides. */
function outranks(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/**
 * THE HUBS: one per region that holds a settlement, over `locations` (the host's own reading of every location,
 * each carrying its regionIndex and locationIndex). `isBase` says a row is MAPS.BSA's own; `regionNameOf` names a
 * region. Answers `{ byRegion, byMapId }` - the same frozen hub under both keys.
 * @param {Iterable<any>|null|undefined} locations
 * @param {{ regionNameOf?: (regionIndex: number) => string, isBase?: (loc: any) => boolean }} [opts]
 */
export function pickRegionHubs(locations, { regionNameOf = (r) => REGION_NAMES[r] ?? '', isBase = () => true } = {}) {
  /** @type {Map<number, {loc: any, claim: number[]}>} */
  const best = new Map();
  for (const loc of locations ?? []) {
    if (!loc || !Number.isInteger(loc.regionIndex) || !Number.isInteger(loc.locationIndex) || !isBase(loc)) continue;
    const claim = hubClaim(loc, regionNameOf(loc.regionIndex));
    if (!claim) continue;
    const had = best.get(loc.regionIndex);
    if (!had || outranks(claim, had.claim)) best.set(loc.regionIndex, { loc, claim });
  }
  /** @type {Map<number, any>} */
  const byRegion = new Map();
  /** @type {Map<number, any>} */
  const byMapId = new Map();
  for (const [regionIndex, { loc }] of [...best].sort((a, b) => a[0] - b[0])) {
    const regionName = regionNameOf(regionIndex);
    const px = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    const hub = Object.freeze({
      regionIndex,
      locationIndex: loc.locationIndex,
      name: loc.name,
      regionName,
      mapId: loc.mapTableData.mapId >>> 0,
      pixel: Object.freeze({ x: px.x, y: px.y }),
      capital: HUB_CAPITALS.some((c) => same(c, loc.name) && same(c, regionName)),
    });
    byRegion.set(regionIndex, hub);
    byMapId.set(hub.mapId, hub);
  }
  return Object.freeze({ byRegion, byMapId });
}

/** The hub of a region, or null. */
export const hubOfRegion = (hubs, regionIndex) => hubs?.byRegion?.get(regionIndex) ?? null;
/** The hub a location IS, by its map id (signed as MAPS.BSA reads it, or not), or null. */
export const hubAtMapId = (hubs, mapId) => (mapId == null || !Number.isFinite(Number(mapId)) ? null : hubs?.byMapId?.get(Number(mapId) >>> 0) ?? null);

/** What a hub is: "Capital of the Kingdom of Daggerfall", "Hub of Dragontail Mountains". */
export const hubTitle = (hub) => (hub.capital ? `Capital of the Kingdom of ${hub.regionName}` : `Hub of ${hub.regionName}`);
/** The map's word for one, beside its "Region : Location". */
export const hubMapWord = (hub) => (hub.capital ? 'Capital' : 'Hub');
/** The line a player reads walking into one. */
export const hubArrivalLine = (hub) => `${hub.name}, ${hub.capital ? 'capital of the Kingdom of' : 'hub of'} ${hub.regionName}.`;
