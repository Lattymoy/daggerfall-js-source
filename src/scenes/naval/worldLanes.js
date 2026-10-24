// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW3 (2026-10-24, bible/03-World/World-Wide.md WW3): THE WORLD'S PACKET LANES - the Bay's lanes as they always were,
// and the lanes of the sea past it between the world's ports (world/worldWide/worldPorts.js), one book of both.
//
// Out of scenes/world.js (HOST-SPLIT: the host wires it). SEA-LANES (systems/naval/seaLanes.js) ran its packets between
// the Bay's ports alone, over the Bay's water alone; past the Bay the continent's sea (TAMRIEL2's ground) held no ship.
//  - THE BAY'S LANES ARE THE BAY'S: its ports (Travel Options' list, read off the map's directory), its water (the
//    host's `bayOpen` - the Bay's map alone), made once - every Bay packet in the water it sailed, the serpent's site
//    rolled over the same list in the same order (systems/serpent/serpentSite.js).
//  - THE LANES PAST THE BAY run between the world's ports past it, over the world's water (`worldOpen` - the Bay's own
//    on the Bay, the continent's sea past it where the land past the Bay stands), made again whenever the ports move (a
//    provider registered, a new picture). A lane past the Bay may cross the Bay's water (the sea is one sea); a Bay lane
//    never leaves it.
//  - ONE BOOK: `all()` the Bay's lanes and then the ones past it, each lane's way kept once (its key its two ports' ids -
//    the Bay's pixel ids and the world's keys never meet, worldPorts.js lanePortId).
// ═══════════════════════════════════════════════════════════════════
import { laneNetwork, laneWay } from '../../systems/naval/seaLanes.js';
import { getPixelFromPixelID, CLIMATES } from '../../formats/mapsFile.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { inWorldGrid } from '../../world/worldWide/worldGrid.js';
import { inEther, onBayOrEther } from '../../world/ethericSea.js';
import { NATIVE_PIXEL } from '../../systems/seaRaiders.js';

/**
 * The Bay's ports as its lanes read them - Travel Options' list (`portIds`, the host's: systems/travel/travelPorts.js
 * PORT_LOCATION_IDS), each port the map's directory knows, its home region's name - or null before the directory stands.
 * @param {Map<number, any>|null|undefined} mapDict @param {{ getRegion: (r: number) => any }} maps @param {readonly number[]} portIds
 */
export function bayLanePorts(mapDict, maps, portIds) {
  if (!mapDict) return null;
  const ports = [];
  for (const id of new Set(portIds)) {
    const summary = mapDict.get(id & 0x000fffff);
    if (!summary) continue;
    const at = getPixelFromPixelID(summary.id);
    ports.push({ id: summary.id, name: maps.getRegion(summary.regionIndex)?.mapNames?.[summary.mapIndex] ?? null, px: at.x, py: at.y, region: summary.regionIndex });   // AUDIT BAY A8: her names her home port's region's
  }
  return ports;
}

/**
 * The world's lane water: the Bay's own (`bayOpen`) on the Bay, and past it the continent's sea - the Ocean climate on
 * water (`water`, `climateAt`: the host's composed readers) where the land past the Bay stands (`beyond()`), never the
 * Eltheric Ocean's box (its isles keep their own ports). Its native twin reads a point's pixel FLOORED (a pixel west of
 * the map's edge is its own - the map pixel law truncates, seaRaiders.js tvRaidSea's own reading).
 * @param {{ bayOpen: (x: number, y: number) => boolean, water: (x: number, y: number) => boolean, climateAt: (x: number, y: number) => number, beyond: () => boolean }} o
 */
export function worldLaneWater({ bayOpen, water, climateAt, beyond }) {
  const open = (/** @type {number} */ px, /** @type {number} */ py) => (inBay(px, py) ? bayOpen(px, py)
    : beyond() && inWorldGrid(px, py) && !inEther(px, py) && water(px, py) && climateAt(px, py) === CLIMATES.Ocean);
  return { open, openNative: (/** @type {number} */ x, /** @type {number} */ z) => open(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL)) };
}

/** THE SEA'S GROUND - where the world's seeded things of the sea (the Warm Ashes raiders) are born and sail: the Bay's
 *  map and the Eltheric Ocean's box (ethericSea.js onBayOrEther, ETHER-OW's), and WW3 the world's grid past them where
 *  the land past the Bay stands (`beyond`: its ground streams, its climate and its water the composed continent's -
 *  AUDIT OW5b S5's raider born a pixel past the map's edge was born on ground nothing streamed).
 *  @param {number} x @param {number} y @param {boolean} beyond */
export const onWorldSea = (x, y, beyond) => onBayOrEther(x, y) || (beyond && inWorldGrid(x, y));

/**
 * The world's lanes. The host hands its map's directory, maps and Travel Options' list (`mapDict()`, `maps`, `portIds` -
 * the Bay's ports), the world's
 * ports past the Bay, the Bay's lane water (`bayOpen` and its native twin) and its composed readers (`water` the
 * planner's sea, `maps.getClimateIndex`, `beyond()` the land past the Bay standing) - worldLaneWater's.
 * @param {{ mapDict: () => Map<number, any>|null|undefined, maps: { getRegion: (r: number) => any, getClimateIndex: (x: number, y: number) => number }, portIds: readonly number[],
 *   ports: import('../../world/worldWide/worldPorts.js').WorldPorts, bayOpen: (x: number, y: number) => boolean,
 *   bayOpenNative: (x: number, z: number) => boolean, water: (x: number, y: number) => boolean, beyond: () => boolean }} o
 */
export function createWorldLanes({ mapDict, maps, portIds, ports, bayOpen, bayOpenNative, water, beyond }) {
  const { open: worldOpen, openNative: worldOpenNative } = worldLaneWater({ bayOpen, water, climateAt: (x, y) => maps.getClimateIndex(x, y), beyond });
  /** @type {any[]|null} */ let bayList = null;
  const bayPorts = () => (bayList ??= bayLanePorts(mapDict(), maps, portIds));
  /** @type {any[]|null} */ let bay = null;
  /** @type {any[]} */ let beyondList = [];
  let beyondOf = null;
  /** @type {{ b: any[], w: any[], list: any[] }|null} */ let all = null;
  const bayWays = new Map(), beyondWays = new Map();
  /** @type {any[]} */ const NONE = [];   // the Bay before its directory stands: no lane
  const bayNet = () => {
    if (!bay) { const p = bayPorts(); if (p) bay = laneNetwork(p, bayOpen); }
    return bay ?? NONE;
  };
  const beyondNet = () => {
    const v = ports.version();
    if (v !== beyondOf) { beyondOf = v; beyondList = laneNetwork(ports.list(), worldOpen); beyondWays.clear(); }
    return beyondList;
  };
  return {
    /** The Bay's ports as the lanes read them (bayLanePorts), or null before the map's directory stands. */
    bayPorts,
    /** The world's lane water past the Bay (worldLaneWater's). */
    open: worldOpen,
    /** The Bay's lanes - its ports', over its water - made once the map's directory stands. */
    bay: bayNet,
    /** The lanes past the Bay, made again whenever the world's ports move. */
    beyond: beyondNet,
    /** Every lane of the world: the Bay's, then the ones past it. */
    all() {
      const b = bayNet(), w = beyondNet();
      if (!all || all.b !== b || all.w !== w) all = { b, w, list: w.length ? [...b, ...w] : b };
      return all.list;
    },
    /** A lane's way (systems/naval/seaLanes.js laneWay - its own water's), kept once; null where the water joins its
     *  ports not. @param {{ key: string, a: { px: number, py: number } }} lane */
    way(lane) {
      const onBay = inBay(lane.a.px, lane.a.py), ways = onBay ? bayWays : beyondWays;
      let way = ways.get(lane.key);
      if (way === undefined) { way = onBay ? laneWay(lane, bayOpen, bayOpenNative) : laneWay(lane, worldOpen, worldOpenNative); ways.set(lane.key, way); }
      return way;
    },
  };
}
