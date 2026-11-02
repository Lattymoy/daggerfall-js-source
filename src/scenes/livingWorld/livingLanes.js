// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT WW F7 (2026-10-24, bible/03-World/World-Wide.md WW3): THE LIVING WORLD'S LANES - how many packets ply a lane,
// a port town's lanes by sea and a port's berths (its packets and its sailors), the books LW5 and LW5b kept in the
// world host's own scope; out of it (HOST-SPLIT: the host wires it).
//
// MADE AGAIN WHEN THE WORLD MOVES: the lanes are the world's (scenes/naval/worldLanes.js `all` - a new list whenever
// the world's ports move: a province's ports registered past the Bay), and a port's town is the world's places'
// (scenes/livingWorld/livingIndex.js, its generation). Kept by a lane's key and a town's id alone, the books named a
// Bay port's lanes without the ones a province's ports added, and a port's town as it stood before its places came.
//
// Asked only once the lanes stand (the host's BOOT-TDZ II guard): `lanes()` reads them.
// ═══════════════════════════════════════════════════════════════════
import { packetsAt } from '../../systems/naval/seaLanes.js';
import { portPackets } from '../../systems/livingWorld/portCrews.js';
import { portIdOf } from '../../world/worldWide/worldPorts.js';
import { livingSide, LIVING_SIDES } from './livingIndex.js'; // WW7-7: a trip keeps to its own side of the Bay's edge

/**
 * @param {{ lanes: () => any[], way: (lane: any) => any, townOfPort: (id: number) => any,
 *   sailorsOf: (portId: number) => any[], generation: () => number }} o `lanes` every lane of the world, `way` a lane's
 *   way (null where its water joins its ports not), `townOfPort` a port's town, `sailorsOf` a port's sailors,
 *   `generation` the world's places'
 */
export function createLivingLanes({ lanes, way, townOfPort, sailorsOf, generation }) {
  /** @type {any[]|null} */ let net = null;
  let gen = -1;
  /** @type {Map<string, number>} */ const counts = new Map();
  /** @type {Map<number, any[]>} */ const from = new Map();
  /** @type {Map<number, { packets: any[], sailors: any[] }>} */ const berths = new Map();
  /** The world's lanes now - every book dropped when they or the places moved. */
  const fresh = () => {
    const n = lanes(),
      g = generation();
    if (n !== net || g !== gen) {
      net = n;
      gen = g;
      counts.clear();
      from.clear();
      berths.clear();
    }
    return n;
  };
  /** How many packets ply `lane` (systems/naval/seaLanes.js packetsAt - none where it has no way). */
  const count = (lane) => {
    fresh();
    let n = counts.get(lane.key);
    if (n === undefined) {
      const w = way(lane);
      n = w ? packetsAt(lane, w, 0).length : 0;
      counts.set(lane.key, n);
    }
    return n;
  };
  return {
    count,
    /** A port town's lanes `[{ to, len, key }]` - the far port's town and the lane's length. WW7-7: wherever the town
     *  stands (a town past the Bay sails its travellers on the lanes past it, as a Bay port's on the Bay's), each lane's far
     *  town on the town's own side of the Bay's edge - WW7-9: or across it on a lane that crosses it (scenes/naval/
     *  worldLanes.js crossLanes: made only where the land past the Bay stands, so a client without it sails the Bay's). WW7-11:
     *  a lane past the Bay or across its edge says it is FAR (`far` - its passage may take more of a traveller's cycles
     *  than one: systems/livingWorld/trips.js voyageBlock); a Bay lane's says nothing, the Bay's passages as they were. */
    from(town) {
      const n = fresh();
      let got = from.get(town.mapId);
      if (!got) {
        const id = portIdOf(town); // WW3: a port's one number - the Bay's masked id, the world's key past it
        got = n
          .filter((l) => l.a.id === id || l.b.id === id)
          .flatMap((l) => {
            const w = way(l),
              to = townOfPort(l.a.id === id ? l.b.id : l.a.id);
            const far = !!l.cross || livingSide(town) === LIVING_SIDES.beyond; // WW7-11: past the Bay or across its edge - a passage of more cycles than one
            return w && to && (livingSide(to) === livingSide(town) || !!l.cross)
              ? [{ to, len: w.len, key: l.key, ...(far ? { far: true } : {}) }]
              : []; // WW7-7: past the Bay as on it - a lane to a port of its own side; WW7-9: or one across the edge
          });
        from.set(town.mapId, got);
      }
      return got;
    },
    /** A port's berths: the packets calling at it (systems/livingWorld/portCrews.js portPackets) and its sailors. */
    berths(portId) {
      const n = fresh();
      let book = berths.get(portId);
      if (!book) {
        book = { packets: portPackets(n, portId, count), sailors: sailorsOf(portId) };
        berths.set(portId, book);
      }
      return book;
    },
  };
}
