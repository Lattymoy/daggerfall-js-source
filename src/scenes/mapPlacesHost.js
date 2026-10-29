// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
//
// BAY-LEFT-MAPS (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed. No
// exceptions."; bible/06-Systems/Travel-View.md BAY-LEFT-MAPS) grew it, after the move: a place past the Bay by its summary
// where it was found, or where a quest names it (`named`), whether or not its pixel has built (tvPlaceSummary - the index
// holds one only once it has; its location stood the first time a journey reads it, pendingSummary); TV5's settlements a
// near query (tvFarSettlements) where they were a snapshot of the index at the view's first ask; the junction map's dots
// past the Bay (junctionPlaceAt); and the carriage towns keyed by the place's own id (carriageTown - it read a map id as
// the Bay's pixel id, `y * 1000 + x`).
import { discoveryGeneration, hasDiscoveredLocationId, discoveryKeyOf, BAKED_KNOWN_TYPES } from '../systems/discovery.js';
import { capitalStreet } from './livingWorld/livingIndex.js';   // OW-BEYOND-KNOWN: a capital is one town (IC-GRAND)
import { etherPlaceIsle } from '../world/etherPlaces.js';
import { isCarriageTown } from '../world/capitalCarriages.js';   // AUDIT CAPITAL-CARRIAGES L6: a capital's slice by its gates
import { immersiveTravelLoaded } from '../systems/immersiveTravel.js';
import { inEther } from '../world/ethericSea.js';
import { isHallMapId, spawnedHallMapId } from '../net/wire.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { checkLocationDiscovered as travelCheckDiscovered } from '../ui/travel/travelMapWindow.js';
import { locationSummaryAt as travelLocationSummaryAt } from '../systems/map/mapDirectory.js';
import { wildHallAt } from '../systems/wild/wildDungeons.js';
import { settlementPixels, TV_FAR_RANGE, TV_FAR_TYPES } from '../systems/travel/travelFarPlaces.js';   // BAY-LEFT-MAPS: TV5's towns
import { pastBayPlacesIn, setPastBayPlaceLaw } from '../world/pastBayPlaces.js';   // BAY-LEFT-MAPS: the countryside the roads' regions laid; TRAVEL-EVERYWHERE: the law the held map asks
import { isCapitalPlaceId } from '../world/capitalLane.js';   // BAY-LEFT-MAPS: a capital once, by its centre
import { MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';   // BAY-LEFT-MAPS: the Bay's pixel ids, under its 1000 x 500
import { locationWorldRect } from '../world/streamingWorld.js';   // BAY-LEFT-MAPS: a pending place's rect, off its row's grid

/** BAY-LEFT-MAPS: the Bay's pixel ids - a map id whose low 20 bits are under this names a Bay pixel (DFU's MapId). */
const BAY_PIXEL_IDS = MAX_MAP_PIXEL_X * MAX_MAP_PIXEL_Y;

/** @param {any} host */
export function createMapPlaces(host) {
  const {
    captainLedger, etherPlaceClone, etherSea, locationIndex, mapDict, wildActiveNow, wildHallStand,
    provinceQuestPlaces = null, worldPlaces = null,   // BAY-LEFT-MAPS: the places past the Bay as the build stands them, the world's registry
  } = host;
  /** OW-HUBS (FIELD BUGS 2026-10-04e): a town with a carriage at its gate, by its map id - while Immersive Travel is
   *  loaded (online it is always). Kept per id until the location index moves (a spawn stood or taken back).
   *  BAY-LEFT-MAPS (C11): BY THE PLACE'S OWN KEY - a Bay place by its pixel id (DFU's mask, the low 20 bits: `y * 1000 + x`),
   *  a place past the Bay by its whole id (systems/discovery.js discoveryKeyOf, AUDIT TESA II P6's key), found where it
   *  stands (the registry's pixel for it, the index's place there). It read every id as the Bay's pixel id, so a walled
   *  city past the Bay never showed its wheel, and a countryside id named another pixel's place. */
  const _carriageOf = { gen: -1, of: new Map() };   // HOST-SPLIT: a holder (the generation it was kept at, the answers), so the law moves out whole
  const carriageTown = (mapId) => {
    if (!immersiveTravelLoaded() || !Number.isFinite(mapId) || isHallMapId(mapId)) return false;   // AUDIT WW F1: a zone hall's id is no Bay town's
    if (_carriageOf.gen !== host._locIndexGen) { _carriageOf.of.clear(); _carriageOf.gen = host._locIndexGen; }
    const id = discoveryKeyOf(mapId);
    let on = _carriageOf.of.get(id);
    if (on === undefined) { on = isCarriageTown(townOfKey(id)); _carriageOf.of.set(id, on); }
    return on;
  };
  /** The place a key (discoveryKeyOf's) names where it stands: a Bay pixel id's place on that pixel; a whole id's on the
   *  registry's pixel for it - or none (not listed, not stood yet: asked again when the index moves). */
  const townOfKey = (key) => {
    if (key < BAY_PIXEL_IDS) return locationIndex.get(`${key % MAX_MAP_PIXEL_X},${Math.floor(key / MAX_MAP_PIXEL_X)}`);
    const p = worldPlaces?.byMapId(key) ?? null;
    const loc = p ? locationIndex.get(`${p.px},${p.py}`) : null;
    return (loc?.mapTableData?.mapId ?? -1) >>> 0 === key ? loc : null;
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
  /** The summary of the place on a pixel the Overworld (and the passages, the junction map) may journey to - known, as DFU
   *  knows a place: found. BAY-LEFT-MAPS: `named` - a place a quest names (its diamond pressed: OW-QUEST): past the Bay a
   *  quest's site is on the map whether or not it was found (START3), and its place is answered as found. */
  /** OW-BEYOND-KNOWN (bible/06-Systems/Travel-View.md): past the Bay a place is known by its kind, as MAPS.BSA bakes the
   *  Bay's (systems/discovery.js BAKED_KNOWN_TYPES) - a capital by its centre alone, its other slices its streets. */
  const knownByKind = (mapId, type) => BAKED_KNOWN_TYPES.has(type) && !capitalStreet({ mapId });
  /** AUDIT TAMRIEL-WIDE D2: the places past the Bay the held map inks and hovers (world/pastBayPlaces.js), known as the
   *  Overworld knows them - by their kind, or found (its row's id, tvPlaceSummary's own read) - so a lair is inked once found. */
  const knownPastBayIn = (x0, y0, x1, y1) => pastBayPlacesIn(x0, y0, x1, y1).filter((p) => BAKED_KNOWN_TYPES.has(p.type) || hasDiscoveredLocationId(provinceQuestPlaces?.rowAt(p.x, p.y)?.mapId ?? -1));
  const tvPlaceSummary = (px, py, named = false) => {
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
    // BAY-LEFT-MAPS (C3): and the index holds it only once its pixel has built - so where none stands yet, the place known
    // there (OW-BEYOND-KNOWN: by its kind, or found) or the quest names is its registry row's (pendingSummary): a booked
    // passage to a port past the Bay resumes after a load, a port found in an earlier session is on its masters' lists, a
    // far town stands at the view's edge, a quest's diamond is a journey
    if (!onTheBay(px, py)) {
      if (loc) {
        const id = (loc.mapTableData?.mapId ?? 0) >>> 0;
        return loc.name && id && (named || knownByKind(id, loc.mapTableData?.locationType) || hasDiscoveredLocationId(id)) ? { pixel: { x: px, y: py }, name: loc.name, mapId: id, regionIndex: loc.regionIndex, locationIndex: loc.locationIndex, locationType: loc.mapTableData?.locationType, loc } : null;
      }
      const row = provinceQuestPlaces?.rowAt(px, py) ?? null;   // OW-BEYOND-KNOWN: read for its kind - a roll, kept a pixel; nothing stood
      return row?.name && (named || knownByKind(row.mapId >>> 0, row.type) || hasDiscoveredLocationId(row.mapId)) ? pendingSummary(px, py, row) : null;
    }
    const row = loc?.name ? travelLocationSummaryAt(mapDict, px, py) : null;
    if (!row || !travelCheckDiscovered(row)) return null;   // DFU's own law: an undiscovered place has no name to go to
    return { pixel: { x: px, y: py }, name: loc.name, mapId: row.mapID, regionIndex: row.regionIndex, locationIndex: row.mapIndex, loc };
  };
  /** BAY-LEFT-MAPS (C3): A PLACE PAST THE BAY NOT STANDING YET, AS ITS SUMMARY - read off its row (scenes/tamrielPlacesHost.js
   *  rowAt: the registry's list, the countryside's roll, a lair's - the rolls the build stands, so the same id, name, region
   *  and location), its location stood the first time something reads it (`loc`: a journey's arrival rect, its door - the
   *  build's own order, scenes/tamrielPlacesHost.js standAt), never to answer a list: standing one is the build's own
   *  24-152 ms (an Arena town the dearest, measured on the freeware), and a list asks a dozen. Until it stands, the rect a
   *  plate stands over is its row's block grid's (`lightRect`, the world.js tvPlaceRect's first read). */
  function pendingSummary(px, py, row) {
    const key = `${px},${py}`;
    let stood = null;
    const rect = locationWorldRect({ exterior: { exteriorData: { width: row.w, height: row.h, blockNames: [''] } } }, px, py);
    return {
      pixel: { x: px, y: py }, name: row.name, mapId: row.mapId >>> 0, regionIndex: row.region,
      locationIndex: Number.isInteger(row.location) && row.location < 0 ? row.location : -1, locationType: row.type,
      get loc() { return (stood ??= locationIndex.get(key) ?? provinceQuestPlaces?.standAt(px, py) ?? null); },
      lightRect: () => (stood || locationIndex.has(key) ? null : rect),
    };
  }
  // BAY-LEFT-MAPS (C3, TV5 - systems/travel/travelFarPlaces.js): THE SETTLEMENTS THE VIEW'S EDGE MAY SPEAK FOR about a pixel -
  // the Bay's towns (the index's rows, gathered once: MAPS.BSA does not change; never an isle's, ETHER-OW), and past the Bay a
  // NEAR QUERY each time: the registry's listed towns within `range` (Arena's places; a capital once, by its centre slice -
  // the Imperial City is 625 of them) and the countryside's towns the roads' regions laid there (world/pastBayPlaces.js). It
  // was ONE snapshot of the index at the view's first ask - the Bay's rows and whatever place past the Bay stood then - so no
  // country town, and none of a province not built yet, ever reached the edge. farPlaces keeps the found ones in its circle.
  let _baySettlements = null;
  const _pastBayTowns = { gen: -1, list: [] };   // the registry's towns past the Bay, kept by its generation
  function tvFarSettlements(at, range = TV_FAR_RANGE) {
    const bay = (_baySettlements ??= settlementPixels(locationIndex).filter((t) => !t.loc.ether && onTheBay(t.x, t.y)));
    if (onTheBay(at.x, at.y) && at.x >= range && at.y >= range && at.x < MAX_MAP_PIXEL_X - range && at.y < MAX_MAP_PIXEL_Y - range) return bay;   // the edge's circle wholly on the Bay
    const out = [...bay];
    if (worldPlaces) {
      const gen = worldPlaces.generation();
      if (gen !== _pastBayTowns.gen) {
        _pastBayTowns.gen = gen;
        _pastBayTowns.list = worldPlaces.all().filter((p) => !onTheBay(p.px, p.py) && TV_FAR_TYPES.has(p.type) && (!isCapitalPlaceId(p.mapId) || (p.mapId & 0x7ffff) < 16)).map((p) => ({ x: p.px, y: p.py }));
      }
      for (const t of _pastBayTowns.list) if (Math.hypot(t.x - at.x, t.y - at.y) <= range) out.push(t);
    }
    for (const p of pastBayPlacesIn(at.x - range, at.y - range, at.x + range + 1, at.y + range + 1)) if (TV_FAR_TYPES.has(p.type) && !onTheBay(p.x, p.y)) out.push({ x: p.x, y: p.y });
    return out;
  }
  /** BAY-LEFT-MAPS (C10): A PIXEL'S PLACE FOR THE JUNCTION MAP'S DOT (ui/travel/travelPathsOverlay.js drawMapSection's
   *  locationAt) - on the Bay its row and DFU's discovery law, as the host read it; past the Bay the place found there
   *  (tvPlaceSummary - found, so drawn). The junction map read the Bay's rows alone. */
  const junctionPlaceAt = (x, y) => {
    if (onTheBay(x, y)) {
      const summary = travelLocationSummaryAt(mapDict, x, y);
      return summary ? { locationType: summary.locationType, mapId: summary.mapID ?? summary.mapId, discovered: travelCheckDiscovered(summary) } : null;
    }
    const s = tvPlaceSummary(x, y);
    return s ? { locationType: s.locationType ?? s.loc?.mapTableData?.locationType, mapId: s.mapId, discovered: true } : null;
  };
  setPastBayPlaceLaw(tvPlaceSummary);   // TRAVEL-EVERYWHERE: the held map's places past the Bay are this law's (world/pastBayPlaces.js)
  return { carriageTown, tvEtherPlace, tvKnownGen, tvPlaceSummary, tvFarSettlements, junctionPlaceAt, knownPastBayIn };
}
