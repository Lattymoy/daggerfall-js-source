// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { createHarbourBook } from '../systems/naval/harbourBook.js';
import { ETHER_HARBOUR_REACH, inEther } from '../world/ethericSea.js';
import { HARBOUR_REACH } from '../systems/naval/shipLife.js';
import { harbourKeep } from '../systems/naval/harbourKeep.js';
import { locationWorldRect } from '../world/streamingWorld.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { portIdOf, portIdOfLocation } from '../world/worldWide/worldPorts.js';
import { locationSummaryAt as travelLocationSummaryAt } from '../systems/map/mapDirectory.js';

/** @param {any} host */
export function createHarbourHost(host) {
  const {
    arenaLocationAt, arenaPortNear, capitalLocationAt, csaIsPortTown, csaPixelAt, etherPlaceAt, etherPortNear,
    etherSea, locationIndex, mapDict, maps, navalIsWater, playerTravelPixel, state, surfaceAt, tvSeaY, worldPlaces
  } = host;
  /** SHIP-LIFE (systems/naval/shipLife.js): the port town within a pixel of the player - its location's key and its
   *  footprint in the scene NOW (the native rect, locationWorldRect, through the floating origin's localFromWorld), which
   *  the naval host finds its harbour off - or null where no port stands near. The town asked once a pixel. */
  const _navalHarbourAt = { key: null, town: null };   // { key, town: { id, loc, x, y } | null } - PORT-SHIPS: a holder, written in place (the block moved whole, HOST-SPLIT)
  const navalHarbourNear = () => {
    const p = playerTravelPixel();
    const key = `${p.x},${p.y}`;
    if (_navalHarbourAt.key !== key) {
      let town = null;
      const isle = etherSea && inEther(p.x, p.y) ? etherPortNear(p.x, p.y) : null;   // ETHER-PORTS: an isle's town, its harbour sounded as any port's
      const loc = isle ? etherPlaceAt(isle.px, isle.py) : null;
      if (loc?.exterior?.exteriorData) town = { id: `ether:${isle.key}`, loc, x: isle.px, y: isle.py, name: isle.name, reach: ETHER_HARBOUR_REACH };   // AUDIT CAPTAIN'S SEA H1/P2: its isle's shore, ETHER_PORT_SHORE_M about the town
      const aq = !isle && !onTheBay(p.x, p.y) ? arenaPortNear(p.x, p.y) : null;   // TESA6: an Arena port's town, its harbour sounded as any port's
      const aloc = aq ? capitalLocationAt(aq.bx, aq.by) || arenaLocationAt(aq.bx, aq.by) : null;   // AUDIT-TESA A4-F2: a capital's own
      // AUDIT-TESA A4-F3: its book key the town's own port id, as docksBerthOf reads it - the Docks row and the docks' wait
      // read the berth back by it (WW3's law at the merge: worldPorts.js portIdOfLocation, the world's key past the Bay)
      if (aloc?.exterior?.exteriorData) town = { id: portIdOfLocation(aloc), loc: aloc, x: aq.bx, y: aq.by, name: aq.name };
      for (let dy = -1; dy <= 1 && !town && !isle; dy++) for (let dx = -1; dx <= 1 && !town; dx++) {
        if (!csaIsPortTown(p.x + dx, p.y + dy)) continue;
        // AUDIT-TESA A2-3: the Bay's rows by the Bay's ids alone (WW3's directory answers none off the Bay's map)
        const summary = travelLocationSummaryAt(mapDict, p.x + dx, p.y + dy), beyond = summary ? null : worldPlaces.at(p.x + dx, p.y + dy);   // WW3: past the Bay, the registry's port
        const loc = summary ? maps.getLocation(summary.regionIndex, summary.locationIndex ?? summary.mapIndex) : beyond ? locationIndex.get(`${p.x + dx},${p.y + dy}`) : null;   // WW3: the town its provider stood
        if (loc?.exterior?.exteriorData) town = { id: summary ? summary.id : portIdOf(beyond), loc, x: p.x + dx, y: p.y + dy, name: summary ? maps.getRegion(summary.regionIndex)?.mapNames?.[summary.mapIndex] ?? null : beyond.name };
      }
      Object.assign(_navalHarbourAt, { key, town });
    }
    const t = _navalHarbourAt.town;
    if (!t) return null;
    const r = locationWorldRect(t.loc, t.x, t.y);
    const [ax, az] = state.localFromWorld(r.minX, r.minZ), [bx, bz] = state.localFromWorld(r.maxX, r.maxZ);
    const rect = { minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz) };
    // AUDIT HOLDINGS O1: whether every pixel the harbour's scan reads (the rect grown HARBOUR_REACH) is built - a pixel
    // not built reads as land, so a harbour sounded early found its shore at the streamed world's edge and two players
    // arriving by different roads found different berths and stood different quays; asked only before it is sounded
    const reach = t.reach ?? HARBOUR_REACH;   // AUDIT CAPTAIN'S SEA H1: an isle port's sounding reaches its shore
    const ready = (r = reach) => {   // FB1020c HARBOUR-REACH: or the port law's ring's (systems/naval/harbourBook.js portRingReach)
      const x0 = rect.minX - r, z0 = rect.minZ - r, sx = rect.maxX - rect.minX + 2 * r, sz = rect.maxZ - rect.minZ + 2 * r;
      const nx = Math.ceil(sx / 400), nz = Math.ceil(sz / 400);   // under 400 m apart, both edges read: no pixel (819.2 m) between two
      for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) if (!csaPixelAt(x0 + (sx * i) / nx, z0 + (sz * k) / nz)) return false;
      return true;
    };
    return { key: `port:${t.id}`, name: t.name, rect, ready, reach, keep: harbourKeep(t.loc, rect) };   // SHIP-TAGS: her name, the words a ship bound there is read by; PORT-SHIPS: where its town keeps its ships out (systems/naval/harbourKeep.js)
  };
  // HARBOUR-BOOK (systems/naval/harbourBook.js; bible/03-World/Holdings.md section 7): THE HARBOURS NEAR THE PLAYER -
  // this host's, sounded off the port near the player every exterior frame whatever runs on the water, moved with the
  // floating origin and emptied at a transition, a jump and a load; the quays stand off it and the naval host reads it.
  // It was the naval host's own and sounded only in its frame: with Naval Combat or Come Sail Away off, no port stood a quay.
  const harbourBook = createHarbourBook({
    harbourNear: navalHarbourNear,
    isWater: navalIsWater,
    ground: (x, z) => surfaceAt(x, z) - tvSeaY(),   // PORT-SHIPS: the ground over the sea's top - a berth's ship stands afloat (shipLife.js berthStands)
  });
  return { harbourBook };
}
