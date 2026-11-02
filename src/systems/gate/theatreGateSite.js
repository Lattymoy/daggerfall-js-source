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
import { WILD_REGION } from '../wild/wildZone.js'; // PVPDUNGEONS: no world event in the open zone
import { onGhostfence } from '../../world/tamriel/ghostfence.js'; // FENCE-CLEAR: no gate on the Ghostfence's line
import { redMountainLavaIn } from '../../world/tamriel/redMountain.js'; // LAVA-CLEAR: nor where Red Mountain's lava runs
import {
  worldPixelKey,
  worldPixelOfKey,
  inWorldGrid,
  areaName,
  isBayArea,
  theatreOfArea,
} from '../../world/worldWide/worldGrid.js';
import { theatreOfRegion, regionOfTheatre } from '../../formats/mapsTables.js'; // WW-C2: the open zone's theatre, by its region; WW-GATES-EVERYWHERE: a province's region (WW-R)

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
export const scanTheatreGate = (o) => /** @type {TheatreGateScan} */ (theatreGateScanner(o).step());

/** WW-GATES-EVERYWHERE (A2c): how many of a theatre's ring pixels are asked between two asks of `more` - each one nine
 *  registry asks, its ground and its spawn's roll, some twenty-odd microseconds on the freeware's places. */
export const THEATRE_SCAN_STEP = 4;

/**
 * WW-GATES-EVERYWHERE (A2c, 2026-10-26): A THEATRE'S SCAN, A SLICE AT A TIME - the Bay's own scanner's shape
 * (systems/gate/gateSite.js gateScanner): `step(more)` walks the towns' rings once (a town's 72 pixels, cheap), then the
 * ring pixels THEATRE_SCAN_STEP at a time while `more()` says the slice has time, and answers the scan once it is whole
 * (null until then). `step()` with no `more` finishes it there and then. The scan it makes is scanTheatreGate's, pixel
 * for pixel: the walk is the same walk, only cut into slices.
 * @param {Parameters<typeof scanTheatreGate>[0]} o
 */
export function theatreGateScanner({ towns, placeAt, inTheatre, areaAt, wet, theatre, spawnSalt = WORLD_SALT }) {
  /** @type {GateTown[]} */ const list = [];
  /** @type {Map<number, { d: number, t: number }>} */ const best = new Map();
  /** @type {Map<number, number[]>} */ const lists = new Map();
  /** @type {Map<number, number>} */ const townOf = new Map();
  /** @type {number[]|null} */ let keys = null;
  /** @type {TheatreGateScan|null} */ let done = null;
  let i = 0;
  const rings = () => {
    for (const p of towns) {
      if (!TOWN_TYPES.has(p.type)) continue;
      const t = list.length;
      list.push({ name: String(p.name ?? ''), px: p.px, py: p.py, area: p.area });
      for (let dy = -GATE_TOWN_MAX_PX; dy <= GATE_TOWN_MAX_PX; dy++)
        for (let dx = -GATE_TOWN_MAX_PX; dx <= GATE_TOWN_MAX_PX; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (d < GATE_TOWN_MIN_PX) continue;
          const x = p.px + dx,
            y = p.py + dy;
          if (!inWorldGrid(x, y) || !inTheatre(x, y)) continue;
          const k = worldPixelKey(x, y),
            b = best.get(k);
          if (!b || d < b.d) best.set(k, { d, t }); // the NEAREST town names the gate; the first listed wins a tie
        }
    }
    keys = [...best.keys()].sort((a, b) => a - b);
  };
  /** WW-GATES-EVERYWHERE (A2c): each pixel's place asked of the registry once a scan - a ring pixel's eight neighbours are
   *  its neighbours' too, so the walk asked every pixel some five times (149,247 asks of 28,201 pixels on the freeware's
   *  eight provinces), each through the countryside's and the lairs' rolls. */
  /** @type {Map<number, boolean>} */ const placed = new Map();
  const placeOn = (/** @type {number} */ x, /** @type {number} */ y) => {
    if (!inWorldGrid(x, y)) return !!placeAt(x, y); // off the grid no key is the pixel's own
    const k = worldPixelKey(x, y);
    let v = placed.get(k);
    if (v === undefined) placed.set(k, (v = !!placeAt(x, y)));
    return v;
  };
  /** One ring pixel: kept in its area's list where the gate's ground is. */
  const pixel = (/** @type {number} */ k) => {
    const [x, y] = worldPixelOfKey(k);
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = placeOn(x + dx, y + dy);
    if (near || wet(x, y) || onGhostfence(x, y) || redMountainLavaIn(x, y) || spawnsDungeon(spawnSalt, x, y)) return; // FENCE-CLEAR, LAVA-CLEAR: nor the fence's line or the lava
    const a = areaAt(x, y);
    if (!Number.isInteger(a) || a < 0) return;
    let l = lists.get(a);
    if (!l) lists.set(a, (l = []));
    l.push(k);
    townOf.set(k, /** @type {{ t: number }} */ (best.get(k)).t);
  };
  return {
    /** Walk on while `more()` (finished at once with none): the scan once it is whole, else null. */
    step(/** @type {(() => boolean) | undefined} */ more = undefined) {
      if (done) return done;
      if (!keys) rings();
      const K = /** @type {number[]} */ (keys);
      while (i < K.length) {
        const end = Math.min(K.length, i + THEATRE_SCAN_STEP);
        for (; i < end; i++) pixel(K[i]);
        if (i < K.length && more && !more()) return null;
      }
      const byArea = new Map();
      for (const [a, l] of lists) byArea.set(a, Int32Array.from(l));
      return (done = { theatre, byArea, towns: list, townOf });
    },
    /** How far through its ring pixels (0..1) - a probe's. */
    progress: () => (done ? 1 : keys ? i / Math.max(1, keys.length) : 0),
  };
}

/** The areas a theatre's gate may open in, ascending - the Bay scan's own (gateSite.js gateRegions): enough ground, never
 *  the open zone - WW-C2: never an area of Cyrodiil's theatre, the zone being the province whole (its lane opens no gate).
 *  @param {TheatreGateScan} scan */
export const theatreGateAreas = (scan) =>
  [...scan.byArea.keys()]
    .filter(
      (a) =>
        theatreOfArea(a) !== theatreOfRegion(WILD_REGION) &&
        /** @type {Int32Array} */ (scan.byArea.get(a)).length >= GATE_REGION_MIN_PIXELS,
    )
    .sort((a, b) => a - b);

/**
 * A theatre's gate's site, by its number `n` (net/gate/gateLaw.js gateNumber - its lane the theatre's), or null when the
 * theatre offered no ground: the area by the lane's own bag, the pixel by the gate's roll, the spot, the ring, and the
 * town that names it with its area (a province past the Bay). The shape of gateSite.js findGateSite's answer, `region`
 * a Bay region's on the Bay and, WW-GATES-EVERYWHERE, its province's past it (WW-R's 62 to 69 - formats/mapsTables.js
 * regionOfTheatre: the court is laid in it, the seats' word names it), `area` and `theatre` beside it.
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
    day: n,
    region: isBayArea(area) ? area : regionOfTheatre(scan.theatre),
    area,
    theatre: scan.theatre,
    regionName,
    px,
    py,
    town: town
      ? {
          name: town.name,
          px: town.px,
          py: town.py,
          region: isBayArea(town.area) ? town.area : regionOfTheatre(scan.theatre),
          area: town.area,
        }
      : null,
    spot,
    ring: omenRing(n, px, py, spot),
    near,
    place: town?.name && townArea ? `${town.name}, ${townArea}` : near,
  };
}
