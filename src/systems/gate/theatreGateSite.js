// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW2 (2026-10-24, bible/03-World/World-Wide.md WW2): WHERE A THEATRE'S GATE STANDS - the gate's site law
// (systems/gate/gateSite.js, WB1's) over a theatre past the Bay, read off the world's registry of places
// (world/worldWide/worldPlaces.js) instead of MAPS.BSA's rows.
//
// THE SAME LAW, TOWN BY TOWN. A pixel is suitable where it is LAND (the one water law), NO PLACE stands on it or its
// eight neighbours, it is 2 to 4 pixels (Chebyshev) from a TOWN a traveller can fast-travel to, and no spawned dungeon
// is rolled there - and the gate's own: grouped by AREA (a region on the Bay, a province's district past it) for the
// day's draw, the nearest town naming it (the first listed winning a tie). The Bay's scan walks every pixel of the map,
// which a theatre six times the Bay's would make a second's work; but every suitable pixel lies in a town's ring, so this
// one walks the rings - each town's 72 pixels - and asks the registry for the places about each. Over the Bay's own
// places it finds the Bay's scan's every list, pixel for pixel (test/world/worldWide/ww2_gates.test.js holds the two
// equal), so the Bay's lane keeps its own scan (its shape is starfall's and the Abyss dungeon's too, until WW5) and the
// lanes past it take this one.
//
// A place past the Bay is TESA's (a list provider's town, a pixel provider's countryside): the towns are the theatre's
// LISTED places of a town's type (a countryside rolled pixel by pixel is never listed - its places stand in the near
// test, which asks the registry pixel by pixel). Pure: the host hands the ground (`wet`), the area and the theatre's
// bounds.
//
// Not a DFU member. Ledger A (WW2).
// ═══════════════════════════════════════════════════════════════════
import { spawnsDungeon, WORLD_SALT } from '../../world/spawnedDungeons.js';
import { pickGateRegion, pickGatePixel, gateSpotLocal, omenRing } from '../../net/gate/gateLaw.js';
import { GATE_TOWN_TYPES, GATE_TOWN_MIN_PX, GATE_TOWN_MAX_PX, GATE_REGION_MIN_PIXELS } from './gateSite.js';
import { WILD_REGION } from '../wild/wildZone.js';   // PVPDUNGEONS: no world event in the open zone
import { worldPixelKey, worldPixelOfKey, inWorldGrid, areaName, isBayArea } from '../../world/worldWide/worldGrid.js';

const TOWN_TYPES = new Set(/** @type {readonly number[]} */ (GATE_TOWN_TYPES));

/** @typedef {{ name: string, px: number, py: number, area: number }} GateTown
 *  @typedef {{ theatre: number, byArea: Map<number, Int32Array>, towns: GateTown[], townOf: Map<number, number> }} TheatreGateScan */

/**
 * A theatre's suitable pixels, by area - each list the pixels' world keys ascending (row by row, as the Bay's scan
 * lists them), the towns, and each pixel's nearest town.
 * @param {{ towns: Iterable<{ name: string, px: number, py: number, area: number, type: number }>, placeAt: (x: number, y: number) => any,
 *   inTheatre: (x: number, y: number) => boolean, areaAt: (x: number, y: number) => number, wet: (x: number, y: number) => boolean,
 *   theatre: number, spawnSalt?: number }} o
 * @returns {TheatreGateScan}
 */
export function scanTheatreGate({ towns, placeAt, inTheatre, areaAt, wet, theatre, spawnSalt = WORLD_SALT }) {
  /** @type {GateTown[]} */ const list = [];
  /** @type {Map<number, { d: number, t: number }>} */ const best = new Map();
  for (const p of towns) {
    if (!TOWN_TYPES.has(p.type)) continue;
    const t = list.length;
    list.push({ name: String(p.name ?? ''), px: p.px, py: p.py, area: p.area });
    for (let dy = -GATE_TOWN_MAX_PX; dy <= GATE_TOWN_MAX_PX; dy++) for (let dx = -GATE_TOWN_MAX_PX; dx <= GATE_TOWN_MAX_PX; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < GATE_TOWN_MIN_PX) continue;
      const x = p.px + dx, y = p.py + dy;
      if (!inWorldGrid(x, y) || !inTheatre(x, y)) continue;
      const k = worldPixelKey(x, y), b = best.get(k);
      if (!b || d < b.d) best.set(k, { d, t });   // the NEAREST town names the gate; the first listed wins a tie
    }
  }
  /** @type {Map<number, number[]>} */ const lists = new Map();
  /** @type {Map<number, number>} */ const townOf = new Map();
  for (const k of [...best.keys()].sort((a, b) => a - b)) {
    const [x, y] = worldPixelOfKey(k);
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = !!placeAt(x + dx, y + dy);
    if (near || wet(x, y) || spawnsDungeon(spawnSalt, x, y)) continue;
    const a = areaAt(x, y);
    if (!Number.isInteger(a) || a < 0) continue;
    let l = lists.get(a);
    if (!l) lists.set(a, l = []);
    l.push(k);
    townOf.set(k, /** @type {{ t: number }} */ (best.get(k)).t);
  }
  const byArea = new Map();
  for (const [a, l] of lists) byArea.set(a, Int32Array.from(l));
  return { theatre, byArea, towns: list, townOf };
}

/** The areas a theatre's gate may open in, ascending - the Bay scan's own (gateSite.js gateRegions): enough ground, never
 *  the open zone. @param {TheatreGateScan} scan */
export const theatreGateAreas = (scan) => [...scan.byArea.keys()].filter((a) => a !== WILD_REGION && /** @type {Int32Array} */ (scan.byArea.get(a)).length >= GATE_REGION_MIN_PIXELS).sort((a, b) => a - b);

/**
 * A theatre's gate's site, by its number `n` (net/gate/gateLaw.js gateNumber - its lane the theatre's), or null when the
 * theatre offered no ground: the area by the lane's own bag, the pixel by the gate's roll, the spot, the ring, and the
 * town that names it with its area (a province past the Bay). The shape of gateSite.js findGateSite's answer, `region`
 * a Bay region's or null, `area` and `theatre` beside it.
 * @param {number} n @param {TheatreGateScan} scan
 */
export function findTheatreGateSite(n, scan) {
  const area = pickGateRegion(n, theatreGateAreas(scan));
  if (area == null) return null;
  const k = pickGatePixel(n, scan.byArea.get(area));
  if (k == null) return null;
  const [px, py] = worldPixelOfKey(k);
  const ti = scan.townOf.get(k);
  const town = ti == null ? null : scan.towns[ti];
  const spot = gateSpotLocal(n);
  const regionName = areaName(area);
  const near = town?.name || regionName;
  const townArea = town ? areaName(town.area) : '';
  return {
    day: n, region: isBayArea(area) ? area : null, area, theatre: scan.theatre, regionName, px, py,
    town: town ? { name: town.name, px: town.px, py: town.py, region: isBayArea(town.area) ? town.area : null, area: town.area } : null,
    spot, ring: omenRing(n, px, py, spot), near, place: town?.name && townArea ? `${town.name}, ${townArea}` : near,
  };
}
