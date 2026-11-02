// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { createHarbourBook, HARBOUR_TOWN_ORDER, harbourOf } from '../systems/naval/harbourBook.js'; // RPT1026-WORLD FAR-QUAY: every port near, out to the ring, its ground known
import { ETHER_HARBOUR_REACH, inEther } from '../world/ethericSea.js';
import { harbourKeep } from '../systems/naval/harbourKeep.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { portIdOf, portIdOfLocation } from '../world/worldWide/worldPorts.js';
import { locationSummaryAt as travelLocationSummaryAt } from '../systems/map/mapDirectory.js';

/** @param {any} host */
export function createHarbourHost(host) {
  const {
    arenaLocationAt,
    arenaPortNear,
    capitalLocationAt,
    csaIsPortTown,
    csaPixelAt,
    etherPlaceAt,
    etherPortNear,
    etherSea,
    locationIndex,
    mapDict,
    maps,
    navalIsWater,
    playerTravelPixel,
    state,
    surfaceAt,
    tvSeaY,
    worldPlaces,
  } = host;
  /** SHIP-LIFE (systems/naval/shipLife.js): the port towns near the player (RPT1026-WORLD FAR-QUAY: within SEA_RING, the
   *  nearest pixels first - systems/naval/harbourBook.js HARBOUR_TOWN_ORDER) - each its location's key and its footprint in
   *  the scene NOW (harbourOf: the native rect, locationWorldRect, through the floating origin's localFromWorld), which the
   *  naval host finds its harbour off - none where no port stands near. The towns asked once a pixel. */
  const _navalHarbourAt = { key: null, towns: [] }; // { key, towns: [{ id, loc, x, y }] } - PORT-SHIPS: a holder, written in place (the block moved whole, HOST-SPLIT)
  const navalHarbourNear = () => {
    const p = playerTravelPixel();
    const key = `${p.x},${p.y}`;
    if (_navalHarbourAt.key !== key) {
      const towns = []; // RPT1026-WORLD FAR-QUAY: every port town near - a far harbour's town and a neighbour port's both
      const add = (t) => {
        if (!towns.some((o) => o.id === t.id)) towns.push(t);
      }; // one town once, whichever way it was met
      const isle = etherSea && inEther(p.x, p.y) ? etherPortNear(p.x, p.y) : null; // ETHER-PORTS: an isle's town, its harbour sounded as any port's
      const loc = isle ? etherPlaceAt(isle.px, isle.py) : null;
      if (loc?.exterior?.exteriorData)
        add({ id: `ether:${isle.key}`, loc, x: isle.px, y: isle.py, name: isle.name, reach: ETHER_HARBOUR_REACH }); // AUDIT CAPTAIN'S SEA H1/P2: its isle's shore, ETHER_PORT_SHORE_M about the town
      const aq = !isle && !onTheBay(p.x, p.y) ? arenaPortNear(p.x, p.y) : null; // TESA6: an Arena port's town, its harbour sounded as any port's
      const aloc = aq ? capitalLocationAt(aq.bx, aq.by) || arenaLocationAt(aq.bx, aq.by) : null; // AUDIT-TESA A4-F2: a capital's own
      // AUDIT-TESA A4-F3: its book key the town's own port id, as docksBerthOf reads it - the Docks row and the docks' wait
      // read the berth back by it (WW3's law at the merge: worldPorts.js portIdOfLocation, the world's key past the Bay)
      if (aloc?.exterior?.exteriorData)
        add({ id: portIdOfLocation(aloc), loc: aloc, x: aq.bx, y: aq.by, name: aq.name });
      for (const [dx, dy] of isle ? [] : HARBOUR_TOWN_ORDER) {
        // RPT1026-WORLD FAR-QUAY: out to SEA_RING, the 3 x 3 first in its own order
        if (!csaIsPortTown(p.x + dx, p.y + dy)) continue;
        // AUDIT-TESA A2-3: the Bay's rows by the Bay's ids alone (WW3's directory answers none off the Bay's map)
        const summary = travelLocationSummaryAt(mapDict, p.x + dx, p.y + dy),
          beyond = summary ? null : worldPlaces.at(p.x + dx, p.y + dy); // WW3: past the Bay, the registry's port
        const loc = summary
          ? maps.getLocation(summary.regionIndex, summary.locationIndex ?? summary.mapIndex)
          : beyond
            ? locationIndex.get(`${p.x + dx},${p.y + dy}`)
            : null; // WW3: the town its provider stood
        if (loc?.exterior?.exteriorData)
          add({
            id: summary ? summary.id : portIdOf(beyond),
            loc,
            x: p.x + dx,
            y: p.y + dy,
            name: summary ? (maps.getRegion(summary.regionIndex)?.mapNames?.[summary.mapIndex] ?? null) : beyond.name,
          });
      }
      Object.assign(_navalHarbourAt, { key, towns });
    }
    // each town's footprint in the scene now and its readiness at any reach (AUDIT HOLDINGS O1, FB1020c HARBOUR-REACH,
    // RPT1026-WORLD FAR-QUAY: systems/naval/harbourBook.js harbourOf); PORT-SHIPS: where its town keeps its ships out
    // (systems/naval/harbourKeep.js)
    return _navalHarbourAt.towns.map((t) => {
      const h = harbourOf(t, { state, built: csaPixelAt, woods: host.woods });
      return { ...h, keep: harbourKeep(t.loc, h.rect) };
    });
  };
  // HARBOUR-BOOK (systems/naval/harbourBook.js; bible/03-World/Holdings.md section 7): THE HARBOURS NEAR THE PLAYER -
  // this host's, sounded off the port near the player every exterior frame whatever runs on the water, moved with the
  // floating origin and emptied at a transition, a jump and a load; the quays stand off it and the naval host reads it.
  // It was the naval host's own and sounded only in its frame: with Naval Combat or Come Sail Away off, no port stood a quay.
  const harbourBook = createHarbourBook({
    harbourNear: navalHarbourNear,
    isWater: navalIsWater,
    ground: (x, z) => surfaceAt(x, z) - tvSeaY(), // PORT-SHIPS: the ground over the sea's top - a berth's ship stands afloat (shipLife.js berthStands)
  });
  return { harbourBook };
}
