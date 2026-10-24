// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPixels, arenaPlaceOnPixel } from '../world/arenaPlaces.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';

/** @param {any} host */
export function createTamrielPorts(host) {
  const {
    _arenaTemplates, maps
  } = host;
  /** TESA6 (bible/03-World/Arena-Provinces.md): ARENA'S PORTS - a coastal city of Arena on its shore past the Bay
   *  (world/arenaPlaces.js standArenaPixels: `port`), where this host stands Arena's places; within a pixel, the nearest;
   *  and as the harbour office and the naval host read a port - no crown's writ past the Bay (`crown: null`), its region
   *  the pixel's own read (TESA3's law: never a province's). */
  const arenaPorts = () => (_arenaTemplates ? arenaPixels()?.stood.filter((q) => q.port) ?? [] : []);
  const arenaPortAt = (x, y) => { if (!_arenaTemplates || onTheBay(x, y)) return null; const q = arenaPlaceOnPixel(x, y); return q?.port ? q : null; };
  const arenaPortNear = (x, y) => {
    let best = null, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = arenaPortAt(x + dx, y + dy); const d = Math.abs(dx) + Math.abs(dy); if (q && d < bd) { bd = d; best = q; } }
    return best;
  };
  const arenaPortOf = (q) => ({ key: `${q.bx},${q.by}`, name: q.name, px: q.bx, py: q.by, region: maps.getRegionIndexAt(q.bx, q.by), crown: null });
  return { arenaPortAt, arenaPortNear, arenaPortOf, arenaPorts };
}
