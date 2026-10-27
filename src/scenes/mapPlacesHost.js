// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { discoveryGeneration, hasDiscoveredLocationId } from '../systems/discovery.js';
import { etherPlaceIsle } from '../world/etherPlaces.js';
import { hasCarriageGate } from '../world/immersiveTravelGates.js';
import { immersiveTravelLoaded } from '../systems/immersiveTravel.js';
import { inEther } from '../world/ethericSea.js';
import { isHallMapId, spawnedHallMapId } from '../net/wire.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { checkLocationDiscovered as travelCheckDiscovered } from '../ui/travel/travelMapWindow.js';
import { locationSummaryAt as travelLocationSummaryAt } from '../systems/map/mapDirectory.js';
import { wildHallAt } from '../systems/wild/wildDungeons.js';

/** @param {any} host */
export function createMapPlaces(host) {
  const {
    captainLedger, etherPlaceClone, etherSea, locationIndex, mapDict, wildActiveNow, wildHallStand
  } = host;
  /** OW-HUBS (FIELD BUGS 2026-10-04e): a town with a carriage at its gate, by its map id - while Immersive Travel is
   *  loaded (online it is always). Kept per id until the location index moves (a spawn stood or taken back). */
  const _carriageOf = { gen: -1, of: new Map() };   // HOST-SPLIT: a holder (the generation it was kept at, the answers), so the law moves out whole
  const carriageTown = (mapId) => {
    if (!immersiveTravelLoaded() || !Number.isFinite(mapId) || isHallMapId(mapId)) return false;   // AUDIT WW F1: a zone hall's id is no Bay town's
    if (_carriageOf.gen !== host._locIndexGen) { _carriageOf.of.clear(); _carriageOf.gen = host._locIndexGen; }
    const id = mapId & 0xfffff;
    let on = _carriageOf.of.get(id);
    if (on === undefined) { on = hasCarriageGate(locationIndex.get(`${id % 1000},${Math.floor(id / 1000)}`)); _carriageOf.of.set(id, on); }
    return on;
  };
  // ETHER-OW (2026-10-13, the owner: "Also allow the player to zoom out into the overworld like in the Iliac Bay for easy
  // travel"): THE ISLES' PLACES ON THE OVERWORLD. Past the Veil no place is a row of the Bay's dictionary - an isle's town
  // or ruin is its own (world/etherPlaces.js), the index's once its pixel has built, else its clone, marked and never
  // stood (etherPlaceClone). KNOWN as the Eltheric knows a place: its isle on the captain's charts (etherHost.js `sight`
  // within three pixels, a harbourmaster's chart, a corsair's papers - the chart's own isles), or the place found.
  const tvEtherPlace = (px, py) => { const isle = etherPlaceIsle(px, py); return isle ? (locationIndex.get(`${px},${py}`) ?? etherPlaceClone(isle)) : null; };
  const tvEtherKnown = (loc) => captainLedger.isCharted(loc.ether) || hasDiscoveredLocationId(loc.mapTableData.mapId);
  /** AUDIT ETHER-OW C2-2: WHAT IS KNOWN, as the Overworld's lists key it - DFU's finds and the captain's charts: an isle
   *  charted by sight, a harbourmaster's chart or a corsair's papers is a plate at once, never a pixel later. */
  const tvKnownGen = () => `${discoveryGeneration()}:${captainLedger.chartedCount()}`;
  const tvPlaceSummary = (px, py) => {
    // ETHER-OW: past the Veil, an isle's place - known, it is its own summary (HALL-JOURNEY's way), its region the isles'
    if (etherSea && inEther(px, py)) {
      const loc = tvEtherPlace(px, py);
      return loc && tvEtherKnown(loc) ? { pixel: { x: px, y: py }, name: loc.name, mapId: loc.mapTableData.mapId, regionIndex: loc.regionIndex, locationIndex: loc.locationIndex, loc } : null;
    }
    // HALL-JOURNEY (2026-10-08, the owner: "when i want to travel there with begin journey nothing happens"): a zone hall
    // is no row of the map's dictionary (it is spawned, by the day) - it is its own summary, always known, so the
    // Overworld walks to its door as to any place's
    const hall = wildHallAt(wildActiveNow(), px, py) ? wildHallStand(px, py) : null;
    if (hall) return { pixel: { x: px, y: py }, name: hall.name, mapId: spawnedHallMapId(px, py), regionIndex: hall.regionIndex, locationIndex: -1, loc: hall };
    const loc = locationIndex.get(`${px},${py}`);
    // AUDIT-TESA A2-3: past the Bay a pixel id aliases a Bay row - the place the world stands there is its own summary,
    // known once discovered (entering it discovers it), so the Overworld walks to its door as to a Bay place's
    if (!onTheBay(px, py)) {
      const id = (loc?.mapTableData?.mapId ?? 0) >>> 0;
      return loc?.name && id && hasDiscoveredLocationId(id) ? { pixel: { x: px, y: py }, name: loc.name, mapId: id, regionIndex: loc.regionIndex, locationIndex: loc.locationIndex, loc } : null;
    }
    const row = loc?.name ? travelLocationSummaryAt(mapDict, px, py) : null;
    if (!row || !travelCheckDiscovered(row)) return null;   // DFU's own law: an undiscovered place has no name to go to
    return { pixel: { x: px, y: py }, name: loc.name, mapId: row.mapID, regionIndex: row.regionIndex, locationIndex: row.mapIndex, loc };
  };
  return { carriageTown, tvEtherPlace, tvKnownGen, tvPlaceSummary };
}
