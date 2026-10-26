// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING WORLD'S ROADS - THE TRIPS' WORLD. The trips are pure
// (systems/livingWorld/trips.js); their world is the world host's: the towns - the game's OWN rows (a mod's addition stands
// on one client and not another), the populated types, each as its MAPS row says it (its blocks, its climate's people, its
// region, its port) - and the way between two, the Travel Options planner's on Hazelnut's roads (the follow key's and the
// static's own: his bytes or none), asked once a pair in ONE direction (the lower map id first, the other its reverse) so
// every client walks the same way, a few a frame. A traveller's trip of a cycle never changes, so the book keeps every one
// it has made. WW1: the towns and the dungeons are the world's registry's (scenes/livingWorld/livingIndex.js) - the Bay's
// rows, and whatever a provider past the Bay stands - filed by the world's own key, grouped by AREA (the region on the Bay).
//
// WW7-7 (2026-10-26, the owner: "Yes travellers to need to travel everywhere. Same for ships."; bible/03-World/World-Wide.md
// WW7-7): out of scenes/world.js (HOST-SPLIT: the host wires it - its index, its ways, its trips' world and their memo,
// 33 logical lines out of bootWorld), and the land past the Bay lived in:
//  - THE LAND PAST THE BAY'S WORD (`epoch`): the roads past the Bay (scenes/tamrielRoadsHost.js, `pastTheBay` - TESA14: a
//    region at a time on the roads' workers, the nearest the player first) laid WHOLE - none of their regions still to land
//    (`pending()`) and their layer installed (world/arenaRoads.js arenaRoadsLayer) - answers the layer's version (it moves on
//    every install, and the build lays it again when the places past the Bay move); 0 while a region is still to land. The
//    roads and the places they rolled (world/pastBayPlaces.js) are each client's own build of the same inputs, the same for
//    every client that stands the land past the Bay (TESA-ONLINE) - but only once whole: a region lands first where its
//    player stands, so a town half-way through the build knows the towns near one client and not the next.
//  - A TOWN PAST THE BAY WAITS for it (the trips' world's `waiting`: each of its trips undefined, asked again, as one
//    waiting on a way is), and its towns near and its bands' towns are the index's by the roads' places once it is
//    whole (livingIndex.js `beyond`); its ways are the one planner's on the roads past the Bay (systems/livingWorld/
//    beyondWays.js createBeyondWays, through the way book's `beyond`). The Bay's people keep to the Bay, as they always did:
//    a trip keeps to its own side of the Bay's edge (livingIndex.js livingSide).
//  - THE GROUND. The Bay's pairs walk the Bay's table (routeGround over the climate and the heightmap - never a player's
//    attached massifs: TO-ROADS, the host plans the player's journeys alone); WW7-2's `beyond` on it - the land past the
//    Bay walked off the Bay's table - is gone with it: a Bay pair's planner never leaves the table (its bounds are the
//    table and its two ends), and a pair past the Bay is the window planner's. The land past the Bay's dry ground is the
//    composed continent's height over the beach line (`isTamrielGround`: the land standing).
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { createLivingIndex, livingSide, LIVING_SIDES } from './livingIndex.js';
import { createWayBook } from '../../systems/livingWorld/ways.js';
import { createBeyondWays } from '../../systems/livingWorld/beyondWays.js';
import { routeGround } from '../../systems/travel/travelRoute.js';
import { travellerRoster } from '../../systems/livingWorld/census.js';
import { nativeDry } from '../../systems/livingWorld/trips.js';
import { createDryGround } from '../../world/dryGround.js';
import { WATER_BYTE } from '../../world/roadsProducer.js';
import { arenaRoadsLayer, arenaRoadsVersion } from '../../world/arenaRoads.js';
import { pastBayPlacesIn } from '../../world/pastBayPlaces.js';

/** WW7-7: the land past the Bay's word - the roads past the Bay's layer version once they stand whole, else 0.
 *  @param {?{ pending: () => number }} pastTheBay @param {() => any} [layer] @param {() => number} [version] */
export const pastTheBayEpoch = (pastTheBay, layer = arenaRoadsLayer, version = arenaRoadsVersion) => (pastTheBay && pastTheBay.pending() === 0 && layer() ? version() : 0);

/**
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, populated: (type: number) => boolean,
 *   peopleAt: (px: number, py: number) => number|undefined, maps: { getClimateIndex: (x: number, y: number) => number },
 *   woods: any, roads: () => ({ roads: any, tracks: any } | null), marketBandOf?: (town: any, day: number) => (string|null),
 *   pastTheBay?: ?{ pending: () => number } }} o - `woods` the host's ground (its heightmap, the composed continent's past
 *   the Bay where the land stands); `roads` the drawn network (terrainGen.roads()); `pastTheBay` the roads past the Bay's
 *   host (null where the land past the Bay does not stand)
 */
export function createLivingTrips({ places, populated, peopleAt, maps, woods, roads, marketBandOf, pastTheBay = null }) {
  const epoch = () => pastTheBayEpoch(pastTheBay);
  const index = createLivingIndex({ places, populated, peopleAt, beyond: pastTheBay ? { epoch, placesIn: pastBayPlacesIn } : null });
  /** @type {any} */ let ground = null;
  const beyondWays = createBeyondWays({ layer: arenaRoadsLayer, dry: (x, y) => !!woods.isTamrielGround && woods.getHeightMapValue(x, y) > WATER_BYTE });
  const ways = createWayBook({
    roads,
    ground: () => (ground ??= routeGround((px, py) => maps.getClimateIndex(px, py), (px, py) => woods.getHeightMapValue(px, py), WATER_BYTE, 1000, 500)),
    beyond: { epoch, plan: beyondWays.plan, frame: beyondWays.frame, clear: beyondWays.clear },
  });
  const rosters = new WeakMap();   // WW7: by the town's record - a registry's generation (TESA's places landing) a new record, so a roster made off a bare one before them is made again
  /** @type {((nx: number, nz: number) => boolean) | null} */
  let dry = null;
  /** @type {any} */
  const world = {
    townsNear: index.townsNear,
    routeOf: (/** @type {any} */ a, /** @type {any} */ b) => ways.wayOf(a, b),
    rosterOf: (/** @type {any} */ t) => { let r = rosters.get(t); if (!r) { r = travellerRoster(t); rosters.set(t, r); } return r; },
    templeTown: (/** @type {any} */ t) => t.type === LOCATION_TYPES.ReligionTemple || t.blocks >= 9,
    dungeonsNear: index.dungeonsNear,   // LW6: an adventurer's dives
    dryAt: (/** @type {number} */ nx, /** @type {number} */ nz) => (dry ??= nativeDry(createDryGround(woods)))(nx, nz),   // LW-DRY: a party's camp, halt and fallen on dry ground
    townsIn: index.townsIn, marketBandOf,   // LW12: a region's towns, its bands' legs (WW1: an area's - the region on the Bay); TOWN-ECON TE3: a market town's band on a day
    waiting: (/** @type {any} */ t) => livingSide(t) === LIVING_SIDES.beyond && !epoch(),   // WW7-7: a town past the Bay while its roads are laid
    generation: index.generation,   // WW7-7: its towns near move with the registry and the roads past the Bay
  };
  const memo = new Map();
  let waysSeen = 0, placesSeen = 0;
  return {
    index,
    ways,
    world,
    /** The trips' memo (trips.js townTrips' and memoTrip's book). */
    memo,
    /** AUDIT-B8: the trips' memo kept to its bound and to the network's generation by every reader (the roads', the deep's
     *  and the towns' - only the towns' asked it, and a long stay below grew it unbounded). WW1: and a provider's places
     *  come or go - a town's trips read the towns near it; WW7-7: and the roads past the Bay laid (the index's generation). */
    memoFresh: () => { if (memo.size > 40000 || ways.generation !== waysSeen || index.generation() !== placesSeen) { memo.clear(); waysSeen = ways.generation; placesSeen = index.generation(); } },
  };
}
