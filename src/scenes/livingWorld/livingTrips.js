// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING WORLD'S ROADS - THE TRIPS' WORLD. The trips are pure
// (systems/livingWorld/trips.js); their world is the world host's: the towns - the game's OWN rows (a mod's addition stands
// on one client and not another), the populated types, each as its MAPS row says it (its blocks, its climate's people, its
// region, its port) - and the way between two, the Travel Options planner's on the Bay's roads (the follow key's and the
// static's own: the Basic Roads switch's network or none), asked once a pair in ONE direction (the lower map id first, the other its reverse) so
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
//
// WW7-9 (2026-10-26, the coordinator: the owner's "travellers need to travel everywhere", across the Bay's edge and region
// by region; bible/03-World/World-Wide.md WW7-9):
//  - REGION BY REGION. The land past the Bay's word is TESA14's host's own now (`pastTheBay` - `build` its build's number,
//    `landedIn` whether every region whose layer and places reach a box has landed, `onRegion` each region's grid as it
//    lands): a place WAITS while the land past the Bay within LIVING_WAKE_PX of it is still being laid (`waiting` - its
//    towns near, the ways to them and the inns along them all lie in that box), and wakes as the regions about it land:
//    the land about the player first, where WW7-7 waited for every region of the build. A region landing makes the
//    index's squares asked again (its `landed` count) and lets go the planner's tiles it reaches (`drop`); a place that
//    woke is never put back to sleep, for nothing it read moves till the roads are laid again (the build: every book of
//    the land past the Bay made again).
//  - ACROSS THE EDGE. A trip keeps to its side no longer: a Bay town by the edge has the towns past it near (and a town past
//    it the Bay's), their way the window planner's with the Bay's own ground (`bay` - the drawn network and the Bay's
//    table: systems/livingWorld/beyondWays.js), so it walks the Bay's roads out by a crossing's gate (TESA5) and on along
//    the roads past the Bay. Only where the land past the Bay stands and is laid there: a client without it has no
//    `pastTheBay`, and its Bay is the Bay it always was, to the byte - a Bay town by the edge waits while the land past
//    it is laid, so no client walks it otherwise once both have laid it.
//
// WW7-11 (2026-10-26, the owner on passages past the Bay being rare: "Make them longer"; bible/03-World/World-Wide.md
// WW7-11): where the land past the Bay stands (`longPassages`) a port's traveller's passage on a far lane takes as many of
// its cycles as it needs (systems/livingWorld/trips.js voyageBlock); a capital is one town, its centre (livingIndex.js
// capitalStreet - its streets send no traveller).
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { createLivingIndex, livingSide, capitalStreet, LIVING_SIDES } from './livingIndex.js';
import { createWayBook } from '../../systems/livingWorld/ways.js';
import { createBeyondWays, BEYOND_FAR_PX } from '../../systems/livingWorld/beyondWays.js';
import { routeGround } from '../../systems/travel/travelRoute.js';
import { travellerRoster } from '../../systems/livingWorld/census.js';
import { nativeDry, TRIP_REACH_PX, INN_REACH_PX } from '../../systems/livingWorld/trips.js';
import { HIDEOUT_OFF_PX } from '../../systems/livingWorld/outlaws.js';
import { districtOfArea, DISTRICT_PX, WORLD_PIXEL_SPAN } from '../../world/worldWide/worldGrid.js';
import { createDryGround } from '../../world/dryGround.js';
import { WATER_BYTE } from '../../world/roadsProducer.js';
import { arenaRoadsLayer } from '../../world/arenaRoads.js';
import { pastBayPlacesIn } from '../../world/pastBayPlaces.js';

/** WW7-9: what a place's trips read lies within this many pixels of it - its towns near (TRIP_REACH_PX), the ways to them
 *  (each a window of BEYOND_FAR_PX about its two ends) and the inns along them (INN_REACH_PX). */
export const LIVING_WAKE_PX = TRIP_REACH_PX + BEYOND_FAR_PX + INN_REACH_PX;
/** WW7-9: what an area's bands read lies within this many pixels of its district - the ways of its legs (BEYOND_FAR_PX)
 *  and a hideout off one (HIDEOUT_OFF_PX). */
export const LIVING_AREA_WAKE_PX = BEYOND_FAR_PX + HIDEOUT_OFF_PX[1] + 1;
/** WW7-9: THE LAND ABOUT A PLACE KNOWN - the land past the Bay within LIVING_WAKE_PX of (px, py) laid whole by the roads past
 *  the Bay's host (its `landedIn`; the Bay's own land always is). @param {{ landedIn: Function }} pastTheBay
 *  @param {number} px @param {number} py */
export const landedAbout = (pastTheBay, px, py) => pastTheBay.landedIn(px - LIVING_WAKE_PX, py - LIVING_WAKE_PX, px + LIVING_WAKE_PX + 1, py + LIVING_WAKE_PX + 1);

/**
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, populated: (type: number) => boolean,
 *   peopleAt: (px: number, py: number) => number|undefined, maps: { getClimateIndex: (x: number, y: number) => number },
 *   woods: any, roads: () => ({ roads: any, tracks: any } | null), marketBandOf?: (town: any, day: number) => (string|null),
 *   pastTheBay?: ?{ build: () => number, landedIn: (x0: number, y0: number, x1: number, y1: number) => boolean,
 *     onRegion: (fn: (grid: { x0: number, y0: number, x1: number, y1: number }) => void) => void } }} o - `woods` the host's
 *   ground (its heightmap, the composed continent's past the Bay where the land stands); `roads` the drawn network
 *   (terrainGen.roads()); `pastTheBay` the roads past the Bay's host (scenes/tamrielRoadsHost.js - null where the land
 *   past the Bay does not stand)
 */
export function createLivingTrips({ places, populated, peopleAt, maps, woods, roads, marketBandOf, pastTheBay = null }) {
  const epoch = () => pastTheBay?.build() ?? 0;
  let landed = 0;   // WW7-9: the regions landed, counted - the index's squares asked again with each
  const landedIn = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => !!pastTheBay && pastTheBay.landedIn(x0, y0, x1, y1);
  const index = createLivingIndex({ places, populated, peopleAt, beyond: pastTheBay ? { epoch, placesIn: pastBayPlacesIn, landedIn, landed: () => landed } : null });
  /** @type {any} */ let ground = null;
  const groundOf = () => (ground ??= routeGround((px, py) => maps.getClimateIndex(px, py), (px, py) => woods.getHeightMapValue(px, py), WATER_BYTE, 1000, 500));
  const beyondWays = createBeyondWays({ layer: arenaRoadsLayer, dry: (x, y) => !!woods.isTamrielGround && woods.getHeightMapValue(x, y) > WATER_BYTE,
    bay: () => { const raw = roads(); return raw ? { roads: raw.roads ?? null, tracks: raw.tracks ?? null, isWater: groundOf().isWater } : null; }, landedIn });   // WW7-9: across the edge the Bay's own ground; a window once its land is laid
  pastTheBay?.onRegion((grid) => { landed++; beyondWays.drop(grid.x0, grid.y0, grid.x1, grid.y1); });   // WW7-9: a region landed
  const ways = createWayBook({
    roads,
    ground: groundOf,
    beyond: { epoch, plan: beyondWays.plan, frame: beyondWays.frame, clear: beyondWays.clear },
  });
  const rosters = new WeakMap();   // WW7: by the town's record - a registry's generation (TESA's places landing) a new record, so a roster made off a bare one before them is made again
  /** @type {((nx: number, nz: number) => boolean) | null} */
  let dry = null;
  /** @type {any} */
  const world = {
    townsNear: index.townsNear,
    routeOf: (/** @type {any} */ a, /** @type {any} */ b) => ways.wayOf(a, b),
    rosterOf: (/** @type {any} */ t) => { let r = rosters.get(t); if (!r) { r = capitalStreet(t) ? [] : travellerRoster(t); rosters.set(t, r); } return r; },   // WW7-11: a capital's streets send none - its travellers are its centre's
    templeTown: (/** @type {any} */ t) => t.type === LOCATION_TYPES.ReligionTemple || t.blocks >= 9,
    dungeonsNear: index.dungeonsNear,   // LW6: an adventurer's dives
    dryAt: (/** @type {number} */ nx, /** @type {number} */ nz) => (dry ??= nativeDry(createDryGround(woods)))(nx, nz),   // LW-DRY: a party's camp, halt and fallen on dry ground
    townsIn: index.townsIn, marketBandOf,   // LW12: a region's towns, its bands' legs (WW1: an area's - the region on the Bay); TOWN-ECON TE3: a market town's band on a day
    waiting: (/** @type {any} */ t) => !!pastTheBay && livingSide(t) !== LIVING_SIDES.none && !landedAbout(pastTheBay, t.px, t.py),   // WW7-9: a place while the land past the Bay about it is laid
    waitingArea: (/** @type {number} */ area) => {   // WW7-9: a province's district while the land past the Bay under its bands is laid
      const d = pastTheBay ? districtOfArea(area | 0) : null;
      if (!d) return false;
      const x0 = d[0] * DISTRICT_PX - WORLD_PIXEL_SPAN - LIVING_AREA_WAKE_PX, y0 = d[1] * DISTRICT_PX - WORLD_PIXEL_SPAN - LIVING_AREA_WAKE_PX;
      return !landedIn(x0, y0, x0 + DISTRICT_PX + 2 * LIVING_AREA_WAKE_PX, y0 + DISTRICT_PX + 2 * LIVING_AREA_WAKE_PX);
    },
    generation: index.generation,   // WW7-7: its towns near move with the registry and the roads past the Bay
    longPassages: !!pastTheBay,   // WW7-11: the land past the Bay stands - its far lanes' passages may take more cycles than one
  };
  const memo = new Map();
  let waysSeen = 0, placesSeen = 0;
  return {
    index,
    ways,
    /** WW7-9: the window planner past the Bay and across its edge (its tiles let go as each region lands). */
    beyond: beyondWays,
    world,
    /** The trips' memo (trips.js townTrips' and memoTrip's book). */
    memo,
    /** AUDIT-B8: the trips' memo kept to its bound and to the network's generation by every reader (the roads', the deep's
     *  and the towns' - only the towns' asked it, and a long stay below grew it unbounded). WW1: and a provider's places
     *  come or go - a town's trips read the towns near it; WW7-7: and the roads past the Bay laid (the index's generation). */
    memoFresh: () => { if (memo.size > 40000 || ways.generation !== waysSeen || index.generation() !== placesSeen) { memo.clear(); waysSeen = ways.generation; placesSeen = index.generation(); } },
  };
}
