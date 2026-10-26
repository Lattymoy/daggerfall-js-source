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
//  - AUDIT TESA II P7: THE LANES PAST THE BAY AT THEIR OWN SCALE. Registered (world/pastBayRows.js), the province's 28
//    ports stood hundreds of pixels apart (a median 325 between a port and its two nearest) where the Bay's lanes reach 30:
//    one lane of them stood. Past the Bay a port runs packets to its LANE_NEIGHBOURS nearest within BEYOND_LANE_MAX_PX,
//    and its way is walked at the PICTURE'S scale (beyondLaneWay: an A* over the trace's open sea - its lakes and the Bay's
//    rectangle left out, the Bay's water being WOODS.WLD's - from one roadstead's picture pixel to the other's, no longer
//    than BEYOND_LANE_PATH_PX), straightened where the picture's sea holds the line and every leg asked again of the
//    world's lane water at the Bay's scale: an A* over the Bay's pixels cost 15 s for the lanes of the freeware's coasts.
//    Every client walks the same picture: every client's lanes alike.
// ═══════════════════════════════════════════════════════════════════
import { laneNetwork, laneWay, LANE_PATH_PX, LANE_STRAIGHT_STEPS } from '../../systems/naval/seaLanes.js';
import { getPixelFromPixelID, CLIMATES } from '../../formats/mapsFile.js';
import { inBay, bayToPicture, pictureToBay, bayPictureRect, tamrielFit } from '../../world/tamriel/tamrielFrame.js';
import { tamrielTrace } from '../../world/tamriel/tamrielLand.js';
import { pictureLakes } from '../../world/arenaPlaces.js';   // AUDIT TESA II P7/P12: the picture's open sea - its lakes left out
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

const RING8 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
/** AUDIT TESA II P7: a port's packets past the Bay reach this far (map pixels, roadstead to roadstead: about 330 km), and
 *  a lane's way past it is no longer than this. */
export const BEYOND_LANE_MAX_PX = 400;
export const BEYOND_LANE_PATH_PX = 800;
/** NIBEN-SEA: the longest a lane's way past the Bay runs (map pixels) - BEYOND_LANE_PATH_PX, or twice the reach of a harbour
 *  up a canal at either end (world/worldWide/worldPorts.js CANAL_PORT_REACH_PX), as the rest run twice theirs.
 *  @param {{ a: { reach?: number }, b: { reach?: number } }} lane */
export const beyondPathPx = (lane) => Math.max(BEYOND_LANE_PATH_PX, 2 * Math.max(lane.a.reach ?? 0, lane.b.reach ?? 0));
/** SEA-LANES: a player within this of a lane's water (map pixels) has its packets listed (the host's laneShips). */
export const LANE_NEAR_PX = 4;
/** Metres a native unit. */
const M_PER_NATIVE = 819.2 / NATIVE_PIXEL;

/**
 * AUDIT TESA II P7: A LANE'S WAY PAST THE BAY at the picture's scale - `{ pts, len }` (native points, roadstead to
 * roadstead, and its length in metres) or null: no trace, a roadstead off the picture's open sea (NIBEN-SEA: with none of
 * its eight that is, the world's water holding the leg to it), no way of it within BEYOND_LANE_PATH_PX (NIBEN-SEA:
 * beyondPathPx). The picture's open sea is its water its border joins (world/arenaPlaces.js pictureLakes: the lakes left
 * out) outside the Bay's rectangle; a move is one of eight with no corner cut past land; the chain of pixel
 * centres is straightened wherever the picture's sea holds the line (a quarter of a picture pixel at a time), and each
 * straightened leg is asked again of `openNative` (the world's lane water, LANE_STRAIGHT_STEPS a map pixel) - one that
 * fails keeps the chain it stood for.
 * @param {{ a: { road: { x: number, y: number }, reach?: number }, b: { road: { x: number, y: number }, reach?: number } }} lane
 * @param {(x: number, z: number) => boolean} openNative
 */
export function beyondLaneWay(lane, openNative) {
  const trace = tamrielTrace(), fit = tamrielFit();
  if (!trace || !fit) return null;
  const { w, h, land } = trace, lakes = pictureLakes(trace), bay = bayPictureRect();
  const sea = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < w && y < h && !land[y * w + x] && !lakes[y * w + x]
    && !(x + 1 > bay.x0 && x < bay.x1 && y + 1 > bay.y0 && y < bay.y1);
  const picOf = (/** @type {{ x: number, y: number }} */ r) => bayToPicture(r.x + 0.5, r.y + 0.5);   // a roadstead's centre on the picture
  const native = (/** @type {number[]} */ p) => { const [mx, my] = pictureToBay(p[0], p[1]); return { x: mx * NATIVE_PIXEL, z: (500 - my) * NATIVE_PIXEL }; };
  const holdsNative = (/** @type {{ x: number, z: number }} */ a, /** @type {{ x: number, z: number }} */ b) => {
    const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS));
    for (let i = 1; i < n; i++) if (!openNative(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    return true;
  };
  /** NIBEN-SEA: the picture pixel a roadstead puts out from - its own where it is the picture's sea, else the nearest of its
   *  eight that is, where the world's lane water holds the leg to its centre (the Imperial City's Waterfront canal: water
   *  at the Bay's scale that the picture's pixels lay a little short of) - or null. */
  const seaFrom = (/** @type {number} */ px, /** @type {number} */ py) => {
    const x = Math.floor(px), y = Math.floor(py);
    if (sea(x, y)) return [x, y];
    let best = null, bd = Infinity;
    for (const [dx, dy] of RING8) {
      const nx = x + dx, ny = y + dy, d = Math.hypot(nx + 0.5 - px, ny + 0.5 - py);
      if (d < bd && sea(nx, ny) && holdsNative(native([px, py]), native([nx + 0.5, ny + 0.5]))) { bd = d; best = [nx, ny]; }
    }
    return best;
  };
  const [ax, ay] = picOf(lane.a.road), [bx, by] = picOf(lane.b.road);
  const from = seaFrom(ax, ay), to = seaFrom(bx, by);
  if (!from || !to) return null;
  const ppu = fit.ppu, maxG = beyondPathPx(lane) / ppu;   // the A*'s costs in picture pixels
  const key = (/** @type {number} */ x, /** @type {number} */ y) => y * w + x;
  const g = new Float64Array(w * h).fill(Infinity), came = new Int32Array(w * h).fill(-1), shut = new Uint8Array(w * h);
  const hEst = (/** @type {number} */ x, /** @type {number} */ y) => Math.hypot(x - to[0], y - to[1]);
  const heap = [[hEst(from[0], from[1]), from[0], from[1]]];
  g[key(from[0], from[1])] = 0;
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = /** @type {number[]} */ (heap.pop());
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  let found = false;
  while (heap.length) {
    const [, x, y] = pop(), k = key(x, y);
    if (shut[k]) continue;
    shut[k] = 1;
    if (x === to[0] && y === to[1]) { found = true; break; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!sea(nx, ny) || (dx && dy && (!sea(x + dx, y) || !sea(x, y + dy)))) continue;   // no corner cut past land
      const ng = g[k] + (dx && dy ? Math.SQRT2 : 1), nk = key(nx, ny);
      if (ng >= g[nk] || ng > maxG) continue;
      g[nk] = ng; came[nk] = k;
      push([ng + hEst(nx, ny), nx, ny]);
    }
  }
  if (!found) return null;
  // the chain in picture points: the roadstead, the pixels' centres between, the far roadstead
  const cells = [];
  for (let k = key(to[0], to[1]); k >= 0; k = came[k]) cells.push([(k % w) + 0.5, Math.floor(k / w) + 0.5]);
  cells.reverse();
  const offA = Math.floor(ax) !== from[0] || Math.floor(ay) !== from[1], offB = Math.floor(bx) !== to[0] || Math.floor(by) !== to[1];   // NIBEN-SEA: put out from a pixel beside it
  const chain = [[ax, ay], ...(offA ? [cells[0]] : []), ...cells.slice(1, -1), ...(offB ? [cells[cells.length - 1]] : []), [bx, by]];
  const holdsPic = (/** @type {number[]} */ p, /** @type {number[]} */ q) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 4));
    for (let i = 1; i < n; i++) if (!sea(Math.floor(p[0] + ((q[0] - p[0]) * i) / n), Math.floor(p[1] + ((q[1] - p[1]) * i) / n))) return false;
    return true;
  };
  const pts = [native(chain[0])];
  for (let i = 0; i < chain.length - 1;) {
    let j = chain.length - 1;
    while (j > i + 1 && !holdsPic(chain[i], chain[j])) j--;
    const a = native(chain[i]), b = native(chain[j]);
    if (j === i + 1 || holdsNative(a, b)) pts.push(b);
    else for (let k = i + 1; k <= j; k++) pts.push(native(chain[k]));   // the leg the Bay's scale refuses: the chain it stood for
    i = j;
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) * M_PER_NATIVE;
  return { pts, len };
}

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
    if (v !== beyondOf) { beyondOf = v; beyondList = laneNetwork(ports.list(), worldOpen, BEYOND_LANE_MAX_PX); beyondWays.clear(); }   // AUDIT TESA II P7: their own reach
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
    /** A lane's way (systems/naval/seaLanes.js laneWay - its own water's; past the Bay beyondLaneWay's, on the picture),
     *  kept once; null where the water joins its ports not.
     *  @param {{ key: string, a: { px: number, py: number, road: { x: number, y: number } }, b: { road: { x: number, y: number } } }} lane */
    way(lane) {
      const onBay = inBay(lane.a.px, lane.a.py), ways = onBay ? bayWays : beyondWays;
      let way = ways.get(lane.key);
      if (way === undefined) { way = onBay ? laneWay(lane, bayOpen, bayOpenNative) : tamrielTrace() ? beyondLaneWay(lane, worldOpenNative) : laneWay(lane, worldOpen, worldOpenNative); ways.set(lane.key, way); }   // AUDIT TESA II P7: past the Bay at the picture's scale - with no picture (the authored shape), WW3's walk at the Bay's, within its LANE_PATH_PX
      return way;
    },
    /** SEA-LANES: whether a player at map pixel `here` may have a packet of `lane` in reach - asked before its way is:
     *  on the Bay every point of a way lies within half its longest (LANE_PATH_PX) of one of its ports; AUDIT TESA II P7:
     *  past it within the ellipse its two roadsteads bound for a way no longer than BEYOND_LANE_PATH_PX (NIBEN-SEA: beyondPathPx).
     *  @param {{ a: any, b: any }} lane @param {{ x: number, y: number }} here */
    near(lane, here) {
      const da = Math.hypot(lane.a.road.x - here.x, lane.a.road.y - here.y), db = Math.hypot(lane.b.road.x - here.x, lane.b.road.y - here.y);
      if (inBay(lane.a.px, lane.a.py)) return Math.min(da, db) <= LANE_PATH_PX / 2 + LANE_NEAR_PX;
      return da + db <= beyondPathPx(lane) + 2 * LANE_NEAR_PX;   // NIBEN-SEA: a canal harbour's lane its own
    },
  };
}
