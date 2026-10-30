// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW3 (2026-10-24, bible/03-World/World-Wide.md WW3): THE WORLD'S PORTS - the harbours past the Bay, off the world's
// registry (world/worldWide/worldPlaces.js), as every sea system reads a port.
//
// The Bay's ports are Travel Options' list and Daggerfall's PortTownAndUnknown byte (systems/travel/travelPorts.js,
// systems/portPlaces.js portTownByData), read by the host as they always were: every Bay lane, packet, board and
// harbour is the one it was. Past the Bay a port is a place its PROVIDER says is one (a list's row's `port` - TESA's
// places), and stands a sea system's port as the Bay's do:
//  - IS A PORT TOWN (`at`): the place on the pixel, its provider's word that it is a port - the host's port test
//    (csaIsPortTown's, by data alone, as the Bay's byte is read) past the Bay.
//  - A PORT OF THE SEA (`list`): a port town of the port's own kinds (systems/portPlaces.js isPortTownType - a city, a
//    town, a village) that the OPEN SEA bears on (net/fortLaw.js seaBears, the shipyard's and the harbour board's law) -
//    the lanes' ports, the board's and the director's nearest.
//  - ITS ID (`portIdOf`): a port's one number wherever it stands - the Bay's masked map id (Travel Options' and the map
//    directory's, its pixel id: what the lanes and the living world's sailors always filed a Bay port by) on the Bay, and
//    the world's key past it, PORT_ID_WORLD on (worldGrid.js worldPixelKey - the grid's north-west keys are small, so they
//    stand past every masked id, which is 20 bits), so a lane's key and seed are its two ports' and never another's.
// BAY-LEFT-SEA (2026-10-26, the audit "no system left behind in the Bay" item 30, C5; the owner's call taken: "Every
// single thing here needs to be addressed. No exceptions."): A PORT PAST THE BAY KEEPS THE NEAREST BAY CROWN'S OFFICE
// (`crownAt`, the host's - systems/naval/navalShips.js crownOf over the three capitals, the very law a Bay port's crown
// is read by, and the crown whose colours its navy already flies there, WW7-8/WW7-10), so its harbourmaster's board,
// contracts, letter of marque and Admiralty carrack stand there (scenes/harbourOffice.js) - and its exchange is that
// crown's, as a Bay port's is (systems/naval/tradeGoods.js portTrade). Its region is its province's (WW-R: the
// provinces are regions after the Bay's 62 - AUDIT TESA II P7, where it was -1 before the owner's call, and TESA6's own
// port past the Bay read its pixel's), and it has its area and its theatre.
//
// Pure: the registry and the sea's one law in, ports out. Not a DFU member. Ledger A (WW3).
// ═══════════════════════════════════════════════════════════════════
import { worldPixelKey, areaAt } from './worldGrid.js';
import { inBay } from '../tamriel/tamrielFrame.js';
import { isPortTownType } from '../../systems/portPlaces.js';
import { maskMapId } from '../../systems/travel/travelPorts.js';
import { seaBears } from '../../net/fortLaw.js';
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';
import { capitalOnPixel } from '../tamrielCapitals.js'; // NIBEN-SEA: a capital's harbour bears its capital's name

/** @typedef {{ id: number, mapId: number, key: string, name: string, px: number, py: number, region: number, area: number,
 *   theatre: number, crown: string|null, reach?: number, neighbours?: number }} WorldPort - a port past the Bay, in the shape the host's port lists hand the
 *   sea; NIBEN-SEA: `reach` a harbour up a canal's packets' own (CANAL_PORT_REACH_PX); RUMARE-WATER: `neighbours` the ports its
 *   lanes are asked of (CANAL_PORT_NEIGHBOURS) */

/** NIBEN-SEA: how far (map pixels, roadstead to roadstead) a harbour up a canal - the Imperial City's, some 850 pixels of
 *  the Niben from the Topal Bay, a thousand from the nearest port of the sea - runs its packets: the lanes' own reach past
 *  the Bay (scenes/naval/worldLanes.js BEYOND_LANE_MAX_PX, 400) would leave it none. */
export const CANAL_PORT_REACH_PX = 1200;
/** RUMARE-WATER: how many of its nearest ports a harbour up a canal asks a lane of - past the lanes' own two
 *  (systems/naval/seaLanes.js LANE_NEIGHBOURS): its nearest as the crow flies lie across the land (the Imperial City's,
 *  on the Waterfront: Senchal, then Winterhold and Windhelm over Skyrim - no way to either - then Torval), and a lane the
 *  water does not join has no way and sails nothing. */
export const CANAL_PORT_NEIGHBOURS = 4;
/** The compass's eight ways, east first, turning north (map y runs south). */
export const COMPASS_WAYS = Object.freeze([
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
]);

/** Where the port ids past the Bay begin: past every masked map id (MapsFile's low 20 bits, travelPorts.js maskMapId). */
export const PORT_ID_WORLD = 1 << 20;
/** A port's one number: the Bay's masked map id on the Bay, PORT_ID_WORLD and the world's key past it.
 *  @param {{ mapId: number, px: number, py: number }} p a place, a living town, a port */
export const portIdOf = (p) => (inBay(p.px, p.py) ? maskMapId(p.mapId) : PORT_ID_WORLD + worldPixelKey(p.px, p.py));

/** A DF location's port id (its harbour's key - the harbour book's `port:<id>`): its map table's pixel and map id, as
 *  portIdOf reads a place. @param {any} loc */
export function portIdOfLocation(loc) {
  const md = loc?.mapTableData;
  if (!md) return 0;
  const p = longitudeLatitudeToMapPixel(md.longitude, md.latitude);
  return portIdOf({ mapId: md.mapId ?? 0, px: p.x, py: p.y });
}

/**
 * The ports past the Bay: every LISTED place outside the Bay's rectangle its provider calls a port, of a port town's
 * kind, that the open sea (`openSea(x, y)` - the host's one open-sea law) bears on; the registry's order.
 * NIBEN-SEA: a capital's harbour is named for its capital (the Imperial City's, on its Waterfront's slice), and one up its
 * canal (world/tamrielCapitals.js `harbour`) runs its packets CANAL_PORT_REACH_PX (`reach`). BAY-LEFT-SEA: its crown the
 * nearest Bay crown's (`crownAt(px, py)`, the host's; none without one).
 * @param {import('./worldPlaces.js').WorldPlaces} places @param {(x: number, y: number) => boolean} openSea
 * @param {(x: number, y: number) => (string|null)} [crownAt]
 * @returns {WorldPort[]}
 */
export function beyondPorts(places, openSea, crownAt = () => null) {
  /** @type {WorldPort[]} */ const out = [];
  for (const p of places.all()) {
    if (!p.port || inBay(p.px, p.py) || !p.name || !isPortTownType(p.type) || !seaBears(p.px, p.py, openSea)) continue;
    const cap = capitalOnPixel(p.px, p.py)?.cap;
    out.push({
      id: portIdOf(p),
      mapId: p.mapId,
      key: `${p.px},${p.py}`,
      name: cap?.name ?? p.name,
      px: p.px,
      py: p.py,
      region: p.region,
      area: p.area,
      theatre: p.theatre,
      crown: crownAt(p.px, p.py), // AUDIT TESA II P7: its province's region (WW-R); BAY-LEFT-SEA: the nearest Bay crown's office
      ...(cap?.harbour ? { reach: CANAL_PORT_REACH_PX, neighbours: CANAL_PORT_NEIGHBOURS } : {}),
    }); // NIBEN-SEA: a harbour up its canal, its packets' own reach; RUMARE-WATER: and its lanes asked of more of its nearest
  }
  return out;
}

/**
 * The world's ports past the Bay, kept by the registry's generation and the land's picture (`land()` - a version that
 * moves when the open sea's ground does). `regionAt` the Bay's region under a pixel (the host's); BAY-LEFT-SEA: `crownAt`
 * the nearest Bay crown's name to a pixel (the host's navalShips.js crownOf over the three capitals).
 * @param {{ places: import('./worldPlaces.js').WorldPlaces, openSea: (x: number, y: number) => boolean, land?: () => number,
 *   regionAt?: (x: number, y: number) => number, crownAt?: (x: number, y: number) => (string|null) }} o
 */
export function createWorldPorts({ places, openSea, land = () => 0, regionAt = () => -1, crownAt = () => null }) {
  let gen = -1,
    ver = -1;
  /** @type {WorldPort[]} */ let list = [];
  /** @type {{ bay: any[], list: WorldPort[], all: any[] }|null} */ let joined = null;
  /** @param {number} px @param {number} py @returns {WorldPort|null} */
  const nearest = (px, py) => {
    let best = null,
      d = Infinity;
    for (const q of list) {
      const e = Math.max(Math.abs(q.px - px), Math.abs(q.py - py));
      if (e < d) {
        d = e;
        best = q;
      }
    }
    return best;
  };
  const fresh = () => {
    if (places.generation() === gen && land() === ver) return;
    gen = places.generation();
    ver = land();
    list = beyondPorts(places, openSea, crownAt);
  };
  return {
    /** The ports of the sea past the Bay. */
    list: () => {
      fresh();
      return list;
    },
    /** Moves whenever the list may have (a reader that keeps an answer off it keeps it by this). */
    version: () => {
      fresh();
      return `${gen}.${ver}`;
    },
    /** The Bay's own list (`bay`, the host's - the same array every time it is asked) with the ports past the Bay after
     *  it: the one array while neither moves. @param {any[]} bay */
    withBay(bay) {
      fresh();
      if (!list.length) return bay;
      if (joined?.bay !== bay || joined.list !== list) joined = { bay, list, all: [...bay, ...list] };
      return joined.all;
    },
    /** The nearest port of `bayPorts` and the ports past the Bay to a pixel, by the crow's flight, named and the way to it
     *  as a compass reads it (map y runs south) - or null where the nearest is unnamed.
     *  @param {{ x: number, y: number }} here @param {Array<{ name: string|null, px: number, py: number }>} bayPorts */
    nearestNamed(here, bayPorts) {
      fresh();
      let best = null,
        bestD = Infinity;
      for (const ps of [bayPorts, list])
        for (const q of ps) {
          const d = Math.hypot(q.px - here.x, q.py - here.y);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
      if (!best?.name) return null;
      const turn = Math.atan2(here.y - best.py, best.px - here.x) / (Math.PI / 4);
      return { name: best.name, way: COMPASS_WAYS[((Math.round(turn) % 8) + 8) % 8] };
    },
    /** Whether the place on a pixel past the Bay is a port town by its provider's word (the Bay's own answer is the
     *  host's - the game's data). @param {number} px @param {number} py */
    at: (px, py) => !inBay(px, py) && !!places.at(px, py)?.port,
    /** The nearest port of the sea past the Bay to a pixel, Chebyshev, in map pixels - or null for none.
     *  @param {number} px @param {number} py */
    nearestPx(px, py) {
      fresh();
      const q = nearest(px, py);
      return q ? Math.max(Math.abs(q.px - px), Math.abs(q.py - py)) : null;
    },
    /** THE WATERS' AREA - whose people sail them (a ship's names, a crew's): on the Bay its region, as always; past it
     *  the province's district under the pixel, and at sea (no province under it) the nearest port's - or -1.
     *  @param {number} px @param {number} py */
    seaAreaAt(px, py) {
      const a = areaAt(px, py, regionAt);
      if (a >= 0 || inBay(px, py)) return a;
      fresh();
      return nearest(px, py)?.area ?? -1;
    },
  };
}

/** @typedef {ReturnType<typeof createWorldPorts>} WorldPorts */
