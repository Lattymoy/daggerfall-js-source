// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPlaceOnPixel } from '../world/arenaPlaces.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';

/** @param {any} host */
export function createTamrielPorts(host) {
  const { _arenaTemplates } = host;
  /** TESA6 (bible/03-World/Arena-Provinces.md): ARENA'S PORTS - a coastal city of Arena on its shore past the Bay
   *  (world/arenaPlaces.js standArenaPixels: `port`), where this host stands Arena's places; within a pixel, the nearest -
   *  the harbour book's town (scenes/world.js navalHarbourNear). AUDIT TESA II P7: the port test, the port here, the
   *  nearest port and the waters' distance past the Bay are the world's ports' (world/worldWide/worldPorts.js - TESA's
   *  places registered, world/pastBayRows.js): this host's list and its port's record went with them. */
  const arenaPortAt = (x, y) => {
    if (!_arenaTemplates || onTheBay(x, y)) return null;
    const q = arenaPlaceOnPixel(x, y);
    return q?.port ? q : null;
  };
  const arenaPortNear = (x, y) => {
    let best = null,
      bd = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const q = arenaPortAt(x + dx, y + dy);
        const d = Math.abs(dx) + Math.abs(dy);
        if (q && d < bd) {
          bd = d;
          best = q;
        }
      }
    return best;
  };
  return { arenaPortAt, arenaPortNear };
}
