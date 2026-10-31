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
import {
  laneNetwork,
  laneWay,
  roadsteadOf,
  straighten,
  holdsLine,
  LANE_PATH_PX,
  LANE_NEIGHBOURS,
} from '../../systems/naval/seaLanes.js';
import { getPixelFromPixelID, CLIMATES } from '../../formats/mapsFile.js';
import {
  inBay,
  bayToPicture,
  pictureToBay,
  bayPictureRect,
  tamrielFit,
  BAY_W,
  BAY_H,
} from '../../world/tamriel/tamrielFrame.js';
import { tamrielTrace, landLaw, landLabelAt } from '../../world/tamriel/tamrielLand.js'; // SMOOTH-LAND: the land's one law
import { pictureLakes } from '../../world/arenaPlaces.js'; // AUDIT TESA II P7/P12: the picture's open sea - its lakes left out
import { inWorldGrid } from '../../world/worldWide/worldGrid.js';
import { inEther, onBayOrEther } from '../../world/ethericSea.js';
import { NATIVE_PIXEL } from '../../systems/seaRaiders.js';
import { rumareSeaPixel } from '../../world/rumareWaters.js'; // RUMARE-WATER: the Imperial City's lake the sea's
import { squareCornersAll } from '../../world/terrain/terrainSampler.js'; // SEA-SQUARE: a square's water is its four corners'
import { kernelLine } from '../../world/water/kernelSea.js'; // AUDIT SEA PATHS O3: the ground the game builds

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
    ports.push({
      id: summary.id,
      name: maps.getRegion(summary.regionIndex)?.mapNames?.[summary.mapIndex] ?? null,
      px: at.x,
      py: at.y,
      region: summary.regionIndex,
    }); // AUDIT BAY A8: her names her home port's region's
  }
  return ports;
}

/**
 * The world's lane water: the Bay's own (`bayOpen`) on the Bay; past it, where the land past the Bay stands (`beyond()`),
 * the Ocean climate on water (`water`, `climateAt`) outside the Eltheric Ocean's box, and RUMARE-WATER's Imperial City's
 * lake (world/rumareWaters.js rumareSeaPixel). SEA-SQUARE (FIELD BUGS 2026-10-28b): a pixel past the Bay is that water where
 * its four corner bytes are (world/terrain/terrainSampler.js squareCornersAll: a byte is its square's south-east corner).
 * Its native twin reads a point's pixel FLOORED (seaRaiders.js tvRaidSea's own reading).
 * @param {{ bayOpen: (x: number, y: number) => boolean, water: (x: number, y: number) => boolean, climateAt: (x: number, y: number) => number, beyond: () => boolean }} o
 */
export function worldLaneWater({ bayOpen, water, climateAt, beyond }) {
  const sea = (/** @type {number} */ px, /** @type {number} */ py) =>
    (water(px, py) && climateAt(px, py) === CLIMATES.Ocean) || rumareSeaPixel(px, py);
  const open = (/** @type {number} */ px, /** @type {number} */ py) =>
    inBay(px, py)
      ? bayOpen(px, py)
      : beyond() &&
        inWorldGrid(px, py) &&
        !inEther(px, py) &&
        (rumareSeaPixel(px, py) || squareCornersAll(sea, px, py));
  return {
    open,
    openNative: (/** @type {number} */ x, /** @type {number} */ z) =>
      open(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL)),
  };
}

/** AUDIT SEA PATHS LN-1: THE BAY'S LANE WATER - a Bay pixel whose square is sea at its four corners (SEA-SQUARE's law,
 *  squareCornersAll: the kernel lays a byte at its square's south-east corner), a corner sea where the host's byte law
 *  calls it water (`water`) and its climate is the Ocean's (`ocean`: CLIMATE.PAK's own on the Bay, the world's past it).
 *  Read through the boot's coastal dilation (a texture repair) 103 ports, Daggerfall, Sentinel and Wayrest among them,
 *  stood with no roadstead; read by the pixel's own byte a quarter of a lane's way ran over the kernel's land.
 *  @param {(x: number, y: number) => boolean} water @param {(x: number, y: number) => boolean} ocean */
export function bayLaneWater(water, ocean) {
  const sea = (/** @type {number} */ px, /** @type {number} */ py) => water(px, py) && ocean(px, py);
  return (/** @type {number} */ px, /** @type {number} */ py) => inBay(px, py) && squareCornersAll(sea, px, py);
}

/** THE SEA'S GROUND - where the world's seeded things of the sea (the Warm Ashes raiders) are born and sail: the Bay's
 *  map and the Eltheric Ocean's box (ethericSea.js onBayOrEther, ETHER-OW's), and WW3 the world's grid past them where
 *  the land past the Bay stands (`beyond`: its ground streams, its climate and its water the composed continent's -
 *  AUDIT OW5b S5's raider born a pixel past the map's edge was born on ground nothing streamed).
 *  @param {number} x @param {number} y @param {boolean} beyond */
export const onWorldSea = (x, y, beyond) => onBayOrEther(x, y) || (beyond && inWorldGrid(x, y));

/** AUDIT TESA II P7: a port's packets past the Bay reach this far (map pixels, roadstead to roadstead: about 330 km), and
 *  a lane's way past it is no longer than this. */
export const BEYOND_LANE_MAX_PX = 400;
export const BEYOND_LANE_PATH_PX = 800;
/** AUDIT SEA PATHS O2: a port past the Bay with no lane that has a way asks its nearest ports out to this (map pixels), the
 *  LONE_TRIES nearest, each lane's way allowed twice its ports' distance (Necrom's sea runs round Vvardenfell). */
export const BEYOND_LONE_PX = 1600;
export const LONE_TRIES = 6;
/** NIBEN-SEA: the longest a lane's way past the Bay runs (map pixels) - BEYOND_LANE_PATH_PX, or twice the reach of a harbour
 *  up a canal at either end (world/worldWide/worldPorts.js CANAL_PORT_REACH_PX), as the rest run twice theirs.
 *  @param {{ a: { reach?: number }, b: { reach?: number }, path?: number }} lane */
export const beyondPathPx = (lane) =>
  Math.max(BEYOND_LANE_PATH_PX, 2 * Math.max(lane.a.reach ?? 0, lane.b.reach ?? 0), lane.path ?? 0); // AUDIT SEA PATHS O2: a lone port's lane its own (`path`)
/** SEA-LANES: a player within this of a lane's water (map pixels) has its packets listed (the host's laneShips). */
export const LANE_NEAR_PX = 4;
/** Metres a native unit. */
const M_PER_NATIVE = 819.2 / NATIVE_PIXEL;

/** AUDIT TESA II P7: THE PICTURE'S OPEN SEA - a picture cell of the trace's water its border joins (world/arenaPlaces.js
 *  pictureLakes: the lakes left out) that no part of the Bay's rectangle covers (the Bay's water is WOODS.WLD's).
 *  WW7-10: its own export - beyondLaneWay's, and the crossing lanes' mouths read it.
 *  @param {any} trace the picture's trace (world/tamriel/tamrielLand.js tamrielTrace's) @returns {(x: number, y: number) => boolean} */
export function pictureSeaMask(trace) {
  // AUDIT SEA PATHS O2: one mask a picture (its lakes' flood and its land's law made once - a way past the Bay paid them each)
  const kept = _seaMasks.get(trace);
  if (kept) return kept;
  const mask = seaMaskOf(trace);
  _seaMasks.set(trace, mask);
  return mask;
}
/** @type {WeakMap<object, (x: number, y: number) => boolean>} */
const _seaMasks = new WeakMap();
/** @param {any} trace */
function seaMaskOf(trace) {
  const { w, h } = trace,
    lakes = pictureLakes(trace),
    bay = bayPictureRect(),
    L = landLaw(trace);
  // SMOOTH-LAND: a cell's water by the land's one law at its centre (world/tamriel/tamrielLand.js landLabelAt - a centre
  // keeps the picture's own side, so the cells stand as they stood)
  const at = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 &&
    y >= 0 &&
    x < w &&
    y < h &&
    landLabelAt(L, x + 0.5, y + 0.5) === 0 &&
    !lakes[y * w + x] &&
    !(x + 1 > bay.x0 && x < bay.x1 && y + 1 > bay.y0 && y < bay.y1);
  // AUDIT SEA PATHS C1: a cell's answer kept (0 unasked, 1 sea, 2 not) - a lane's search asks each many times
  const kept = new Uint8Array(w * h);
  return (x, y) => {
    if (!(x >= 0 && y >= 0 && x < w && y < h)) return false;
    const k = y * w + x;
    if (!kept[k]) kept[k] = at(x, y) ? 1 : 2;
    return kept[k] === 1;
  };
}

/** SMOOTH-LAND (bible/03-World/Tamriel.md): how far (picture cells) a roadstead looks for the cell its lane leaves from. */
export const MOOR_REACH = 2;

/** SMOOTH-LAND: THE CELL A ROADSTEAD MOORS OFF - its own picture cell when that is the picture's open sea; else (the land's
 *  smooth coast runs between the cell's centre and the roadstead, so the cell's centre is land and its roadstead sea) the
 *  open-sea cell within MOOR_REACH whose centre lies nearest it and is reached straight on the world's lane water at the
 *  Bay's scale (`holds`, every map pixel crossed - seaLanes.js holdsLine); ties to the first in rows. Null: none.
 *  @param {number} px @param {number} py the roadstead's picture point
 *  @param {(x: number, y: number) => boolean} sea the picture's open sea (pictureSeaMask's)
 *  @param {(p: number[]) => { x: number, z: number }} native a picture point's native point
 *  @param {(a: { x: number, z: number }, b: { x: number, z: number }) => boolean} holds a straight leg on the lane water
 *  @returns {number[]|null} */
export function moorCell(px, py, sea, native, holds) {
  const cx = Math.floor(px),
    cy = Math.floor(py);
  if (sea(cx, cy)) return [cx, cy];
  const near = [];
  for (let dy = -MOOR_REACH; dy <= MOOR_REACH; dy++)
    for (let dx = -MOOR_REACH; dx <= MOOR_REACH; dx++) {
      if (sea(cx + dx, cy + dy)) near.push([Math.hypot(cx + dx + 0.5 - px, cy + dy + 0.5 - py), cx + dx, cy + dy]);
    }
  near.sort((a, b) => a[0] - b[0]);
  const at = native([px, py]);
  for (const [, x, y] of near) if (holds(at, native([x + 0.5, y + 0.5]))) return [x, y];
  return null;
}

/**
 * AUDIT TESA II P7: A LANE'S WAY PAST THE BAY at the picture's scale - `{ pts, len }` (native points, roadstead to
 * roadstead, and its length in metres) or null: no trace, a roadstead with no cell of the picture's open sea to moor off
 * (moorCell, SMOOTH-LAND; NIBEN-SEA: the Imperial City's Waterfront canal is such a roadstead), no way of it within
 * BEYOND_LANE_PATH_PX (NIBEN-SEA: beyondPathPx). The picture's open sea is its water its border joins (world/arenaPlaces.js
 * pictureLakes: the lakes left out) outside the Bay's rectangle; a move is one of eight with no corner cut past land; the chain of pixel
 * centres is straightened wherever the picture's sea holds the line (a quarter of a picture pixel at a time), and each
 * straightened leg is asked again of `openNative` (the world's lane water, every map pixel crossed) - one that
 * fails keeps the chain it stood for.
 * @param {{ a: { road: { x: number, y: number }, reach?: number }, b: { road: { x: number, y: number }, reach?: number } }} lane
 * @param {(x: number, z: number) => boolean} openNative
 */
export function beyondLaneWay(lane, openNative, kernel = null) {
  const s = beyondSearch(lane, openNative, kernel, beyondPathPx(lane));
  return s && { pts: s.pts, len: s.len };
}

/** AUDIT SEA PATHS C1: the length (map pixels) a lane past the Bay's search runs over the picture's whole sea, uncapped,
 *  or null: its water joins its ports not. As the lane's cap, its search finds that chain again.
 *  @param {any} lane @param {(x: number, z: number) => boolean} openNative */
export function beyondFarPath(lane, openNative, kernel = null) {
  const s = beyondSearch(lane, openNative, kernel, Infinity, true);
  return s && Math.ceil(s.chainPx);
}

/** AUDIT SEA PATHS C1: whether a lane past the Bay has a way under its cap - beyondLaneWay's search alone, no way drawn.
 *  @param {any} lane @param {(x: number, z: number) => boolean} openNative */
export const beyondReaches = (lane, openNative, kernel = null) =>
  !!beyondSearch(lane, openNative, kernel, beyondPathPx(lane), true);
/** A native point's map pixel point (x east, y south). @param {{ x: number, z: number }} p */
const pxOf = (p) => ({ x: p.x / NATIVE_PIXEL, y: 500 - p.z / NATIVE_PIXEL });
/** AUDIT SEA PATHS C1: whether `here` (map pixels) lies within `pad` of a way's legs. @param {{ x: number, z: number }[]} pts @param {{ x: number, y: number }} here @param {number} pad */
export function nearWay(pts, here, pad) {
  for (let i = 1; i < pts.length; i++) {
    const a = pxOf(pts[i - 1]),
      b = pxOf(pts[i]),
      dx = b.x - a.x,
      dy = b.y - a.y,
      L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((here.x - a.x) * dx + (here.y - a.y) * dy) / L2)) : 0;
    if (Math.hypot(a.x + t * dx - here.x, a.y + t * dy - here.y) <= pad) return true;
  }
  return false;
}

/** The diagonal steps past a picture cell's corner the Bay's scale holds, kept a lane water and a picture: cell * 8 + its
 *  step's bearing. @type {WeakMap<Function, { trace: any, fit: any, held: Map<number, boolean> }>} */
const _corners = new WeakMap();

/** beyondLaneWay's search under the cap `maxPx` (map pixels): its way and its chain's cost (map pixels); `chainOnly` the
 *  search alone. */
function beyondSearch(lane, openNative, kernel, maxPx, chainOnly = false) {
  const trace = tamrielTrace(),
    fit = tamrielFit();
  if (!trace || !fit) return null;
  const { w, h } = trace,
    sea = pictureSeaMask(trace);
  const picOf = (/** @type {{ x: number, y: number }} */ r) => bayToPicture(r.x + 0.5, r.y + 0.5); // a roadstead's centre on the picture
  const [ax, ay] = picOf(lane.a.road),
    [bx, by] = picOf(lane.b.road);
  const native = (/** @type {number[]} */ p) => {
    const [mx, my] = pictureToBay(p[0], p[1]);
    return { x: mx * NATIVE_PIXEL, z: (500 - my) * NATIVE_PIXEL };
  };
  const holdsNative = (/** @type {{ x: number, z: number }} */ a, /** @type {{ x: number, z: number }} */ b) =>
    holdsLine(a, b, openNative) && kernelLine(a, b, kernel, true, true) === true; // AUDIT SEA PATHS LN-4: every pixel crossed; O3: the kernel's sea
  const from = moorCell(ax, ay, sea, native, holdsNative),
    to = moorCell(bx, by, sea, native, holdsNative);
  if (!from || !to) return null;
  const ppu = fit.ppu,
    maxG = maxPx / ppu; // the A*'s costs in picture pixels (NIBEN-SEA: a canal harbour's lane its own)
  const key = (/** @type {number} */ x, /** @type {number} */ y) => y * w + x;
  const g = new Float64Array(w * h).fill(Infinity),
    came = new Int32Array(w * h).fill(-1),
    shut = new Uint8Array(w * h);
  const hEst = (/** @type {number} */ x, /** @type {number} */ y) => Math.hypot(x - to[0], y - to[1]);
  const heap = [[hEst(from[0], from[1]), from[0], from[1]]];
  g[key(from[0], from[1])] = 0;
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = /** @type {number[]} */ (heap.pop());
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  let corners = _corners.get(openNative);
  if (corners?.trace !== trace || corners.fit !== fit)
    _corners.set(openNative, (corners = { trace, fit, held: new Map() }));
  const held = corners.held;
  const cornerHolds = (
    /** @type {number} */ k,
    /** @type {number} */ x,
    /** @type {number} */ y,
    /** @type {number} */ dx,
    /** @type {number} */ dy,
  ) => {
    const c = k * 8 + (dy + 1) * 2 + (dx + 1) / 2; // the four diagonals: 0..3
    let v = held.get(c);
    if (v === undefined) {
      v = holdsLine(native([x + 0.5, y + 0.5]), native([x + dx + 0.5, y + dy + 0.5]), openNative);
      held.set(c, v);
    }
    return v;
  };
  let found = false;
  while (heap.length) {
    const [, x, y] = pop(),
      k = key(x, y);
    if (shut[k]) continue;
    shut[k] = 1;
    if (x === to[0] && y === to[1]) {
      found = true;
      break;
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        // no corner cut past land - AUDIT SEA PATHS O2: but where the Bay's scale holds the step (a channel a cell wide that
        // runs on the slant: Vivec's to Ebonheart read walled)
        if (!sea(nx, ny) || (dx && dy && (!sea(x + dx, y) || !sea(x, y + dy)) && !cornerHolds(k, x, y, dx, dy)))
          continue;
        const ng = g[k] + (dx && dy ? Math.SQRT2 : 1),
          nk = key(nx, ny);
        if (ng >= g[nk] || ng > maxG) continue;
        g[nk] = ng;
        came[nk] = k;
        push([ng + hEst(nx, ny), nx, ny]);
      }
  }
  if (!found) return null;
  const chainPx = g[key(to[0], to[1])] * ppu;
  if (chainOnly) return { pts: [], len: 0, chainPx };
  // the chain in picture points: the roadstead, the pixels' centres between, the far roadstead
  const cells = [];
  for (let k = key(to[0], to[1]); k >= 0; k = came[k]) cells.push([(k % w) + 0.5, Math.floor(k / w) + 0.5]);
  cells.reverse();
  // the roadstead stands for its own cell's centre; a cell it moors off (moorCell) keeps its centre in the chain
  const ownA = from[0] === Math.floor(ax) && from[1] === Math.floor(ay),
    ownB = to[0] === Math.floor(bx) && to[1] === Math.floor(by);
  const mid =
    cells.length > 1
      ? [...(ownA ? [] : [cells[0]]), ...cells.slice(1, -1), ...(ownB ? [] : [cells[cells.length - 1]])]
      : ownA && ownB
        ? []
        : cells;
  const chain = [[ax, ay], ...mid, [bx, by]];
  const holdsPic = (/** @type {number[]} */ p, /** @type {number[]} */ q) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 4));
    for (let i = 1; i < n; i++)
      if (!sea(Math.floor(p[0] + ((q[0] - p[0]) * i) / n), Math.floor(p[1] + ((q[1] - p[1]) * i) / n))) return false;
    return true;
  };
  const pts = [native(chain[0])];
  for (let i = 0; i < chain.length - 1;) {
    let j = chain.length - 1;
    while (j > i + 1 && !holdsPic(chain[i], chain[j])) j--;
    const a = native(chain[i]),
      b = native(chain[j]);
    if (j === i + 1 || holdsNative(a, b)) pts.push(b);
    else for (let k = i + 1; k <= j; k++) pts.push(native(chain[k])); // the leg the Bay's scale refuses: the chain it stood for
    i = j;
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) * M_PER_NATIVE;
  return { pts, len, chainPx };
}

// ── WW7-10 (bible/03-World/World-Wide.md WW7-10): THE LANES ACROSS THE BAY'S EDGE ─────────────────────────────────────
// "Same for ships" and "the sea is one sea" (WW3): the Bay's lanes keep to the Bay's water and the lanes past it to the sea
// past it, so no packet sailed between a Bay port and a port past the Bay. A CROSSING LANE does: each port past the Bay
// runs packets to its LANE_NEIGHBOURS nearest of the Bay's ports within BEYOND_LANE_MAX_PX (SEA-LANES' own law, read
// from the side past the Bay alone - a Bay port's own nearest stay the Bay's, so no Bay lane moves), and its way is two
// legs: the Bay's water at the Bay's scale from the Bay port's roadstead to a MOUTH of the Bay (where its water meets the
// sea past the map's edge), and the picture's sea from the mouth to the far roadstead (beyondLaneWay's).

/** WW7-10: a crossing lane's leg on the Bay's water is no longer than this (map pixels, its roadstead to a mouth), and a
 *  mouth's run straight out past the map's edge reaches a picture cell clear of the Bay's rectangle within this. */
export const CROSS_BAY_PATH_PX = 400;
export const MOUTH_RUN_PX = 16;
/** WW7-10: the longest a crossing lane's way is - its two legs and the run between (a player near one: `near`). */
export const CROSS_LANE_PATH_PX = CROSS_BAY_PATH_PX + MOUTH_RUN_PX + BEYOND_LANE_PATH_PX;
/** The Bay map's four edges: how long each is, its pixel at `u` along it, and the step out of the map. */
const MOUTH_EDGES = Object.freeze([
  Object.freeze({ len: BAY_W, at: (/** @type {number} */ u) => [u, 0], out: [0, -1] }),
  Object.freeze({ len: BAY_W, at: (/** @type {number} */ u) => [u, BAY_H - 1], out: [0, 1] }),
  Object.freeze({ len: BAY_H, at: (/** @type {number} */ u) => [0, u], out: [-1, 0] }),
  Object.freeze({ len: BAY_H, at: (/** @type {number} */ u) => [BAY_W - 1, u], out: [1, 0] }),
]);

/**
 * WW7-10: THE BAY'S MOUTHS - each pixel of the Bay's lane water (`bayOpen`) on its map's edge whose run straight out is the
 * world's lane water (`open`) up to the first pixel whose picture cell no part of the Bay's rectangle covers, that cell
 * the picture's open sea (`sea`, pictureSeaMask's) - within MOUTH_RUN_PX. `{ at, out, run }`: the edge pixel, the pixel out,
 * the run's pixels after the edge's to it. The edges in turn (north, south, west, east), each along its length.
 * @param {(x: number, y: number) => boolean} bayOpen @param {(x: number, y: number) => boolean} open
 * @param {(x: number, y: number) => boolean} sea
 */
export function bayMouths(bayOpen, open, sea) {
  const out = [],
    bay = bayPictureRect();
  for (const e of MOUTH_EDGES) {
    for (let u = 0; u < e.len; u++) {
      const [x, y] = e.at(u);
      if (!bayOpen(x, y)) continue;
      const run = [];
      for (let k = 1; k <= MOUTH_RUN_PX; k++) {
        const px = x + e.out[0] * k,
          py = y + e.out[1] * k;
        if (!open(px, py)) break;
        run.push({ x: px, y: py });
        const [cx, cy] = bayToPicture(px + 0.5, py + 0.5).map(Math.floor);
        if (cx + 1 > bay.x0 && cx < bay.x1 && cy + 1 > bay.y0 && cy < bay.y1) continue; // the cell still the Bay's: on out
        if (sea(cx, cy)) out.push({ at: [x, y], out: [px, py], run });
        break;
      }
    }
  }
  return out;
}

/**
 * WW7-10: THE BAY'S SEAWARD WATER - every pixel of the Bay's lane water (`bayOpen`) a boat sails to from a mouth (eight
 * neighbours, no corner cut past land), one byte a Bay pixel: a lake's harbour and a cove the map's water never joins to
 * the open sea are not (FIELD BUGS 2026-10-14 INLAND-PORTS: 331 pixels of the map's lakes carry the Ocean climate).
 * @param {(x: number, y: number) => boolean} bayOpen @param {ReturnType<typeof bayMouths>} mouths
 */
export function baySeaward(bayOpen, mouths) {
  const W = BAY_W,
    seen = new Uint8Array(W * BAY_H),
    queue = new Int32Array(W * BAY_H);
  let head = 0,
    tail = 0;
  for (const m of mouths) {
    const k = m.at[1] * W + m.at[0];
    if (!seen[k]) {
      seen[k] = 1;
      queue[tail++] = k;
    }
  }
  while (head < tail) {
    const k = queue[head++],
      x = k % W,
      y = (k - x) / W;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy,
          nk = ny * W + nx;
        if (
          (!dx && !dy) ||
          !inBay(nx, ny) ||
          seen[nk] ||
          !bayOpen(nx, ny) ||
          (dx && dy && (!bayOpen(x + dx, y) || !bayOpen(x, y + dy)))
        )
          continue;
        seen[nk] = 1;
        queue[tail++] = nk;
      }
  }
  return seen;
}

/**
 * WW7-10: THE CROSSING LANES - each port past the Bay (`far`) with a roadstead on the world's lane water (`open`) to its
 * LANE_NEIGHBOURS nearest of the Bay's ports (`bay`) whose roadstead (on the Bay's lane water, `bayOpen`) is SEAWARD
 * (`seaward`, baySeaward's), within `maxPx` between roadsteads, the nearer first (then the lower id); each pair once, the
 * Bay's port `a` (its masked id is the lower). `[{ key, a, b, cross: true }]` - the same list on every client that stands
 * the land past the Bay.
 * @param {any[]} far @param {any[]} bay @param {(x: number, y: number) => boolean} open @param {(x: number, y: number) => boolean} bayOpen
 * @param {Uint8Array} seaward
 */
export function crossLanes(far, bay, open, bayOpen, seaward, maxPx = BEYOND_LANE_MAX_PX) {
  const ours = [...bay]
    .sort((p, q) => p.id - q.id)
    .map((p) => ({ ...p, road: roadsteadOf(p, bayOpen) }))
    .filter((p) => p.road && seaward[p.road.y * BAY_W + p.road.x]);
  const pairs = new Map();
  for (const f of [...far].sort((p, q) => p.id - q.id)) {
    const road = roadsteadOf(f, open, true); // SEA-SQUARE: the roomiest, as the lanes past the Bay's
    if (!road) continue;
    const p = { ...f, road };
    const near = ours
      .map((q) => ({ q, d: Math.hypot(q.road.x - road.x, q.road.y - road.y) }))
      .filter((x) => x.d <= maxPx)
      .sort((x, y) => x.d - y.d || x.q.id - y.q.id)
      .slice(0, LANE_NEIGHBOURS);
    for (const { q } of near) {
      const key = `${q.id}-${p.id}`;
      if (!pairs.has(key)) pairs.set(key, { key, a: q, b: p, cross: true });
    }
  }
  return [...pairs.values()];
}

/**
 * WW7-10: A CROSSING LANE'S WAY - `{ pts, len }` (native points from the Bay port's roadstead to the far one's, and its
 * length in metres) or null. The first leg is an A* over the Bay's lane water (`bayOpen`, eight neighbours, no corner cut
 * past land - SEA-LANES' own step) from the Bay's roadstead to the first mouth it reaches, leaning to the far roadstead
 * (the mouth that leaves the least sea past it), no longer than CROSS_BAY_PATH_PX; that leg and the mouth's run are
 * straightened over the world's lane water (`openNative`). The second is beyondLaneWay's from the mouth's pixel out to the
 * far roadstead. Every client walks the same: the Bay's water, the mouths and the picture alike.
 * @param {{ a: { road: { x: number, y: number } }, b: { road: { x: number, y: number } } }} lane
 * @param {{ bayOpen: (x: number, y: number) => boolean, openNative: (x: number, z: number) => boolean, mouths: ReturnType<typeof bayMouths>, kernel?: ((x: number, z: number) => boolean)|null }} o
 */
export function crossLaneWay(lane, { bayOpen, openNative, mouths, kernel = null }) {
  const from = lane.a.road,
    to = lane.b.road;
  if (!mouths.length || !inBay(from.x, from.y) || !bayOpen(from.x, from.y)) return null;
  const W = BAY_W,
    at = new Map(mouths.map((m) => [m.at[1] * W + m.at[0], m]));
  const g = new Float64Array(W * BAY_H).fill(Infinity),
    came = new Int32Array(W * BAY_H).fill(-1),
    shut = new Uint8Array(W * BAY_H);
  const hEst = (/** @type {number} */ x, /** @type {number} */ y) => Math.hypot(x - to.x, y - to.y);
  /** @type {number[][]} */ const heap = [[hEst(from.x, from.y), from.x, from.y]];
  const push = (/** @type {number[]} */ n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = /** @type {number[]} */ (heap.pop());
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  g[from.y * W + from.x] = 0;
  let mouth = null;
  while (heap.length) {
    const [, x, y] = pop(),
      k = y * W + x;
    if (shut[k]) continue;
    shut[k] = 1;
    mouth = at.get(k) ?? null;
    if (mouth) break;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (!inBay(nx, ny) || !bayOpen(nx, ny) || (dx && dy && (!bayOpen(x + dx, y) || !bayOpen(x, y + dy)))) continue; // no corner cut past land
        const ng = g[k] + (dx && dy ? Math.SQRT2 : 1),
          nk = ny * W + nx;
        if (ng >= g[nk] || ng > CROSS_BAY_PATH_PX) continue;
        g[nk] = ng;
        came[nk] = k;
        push([ng + hEst(nx, ny), nx, ny]);
      }
  }
  if (!mouth) return null;
  const sailed = beyondLaneWay({ a: { road: { x: mouth.out[0], y: mouth.out[1] } }, b: lane.b }, openNative, kernel);
  if (!sailed) return null;
  const cells = [];
  for (let k = mouth.at[1] * W + mouth.at[0]; k >= 0; k = came[k]) cells.push({ x: k % W, y: Math.floor(k / W) });
  cells.reverse();
  const pts = [...straighten([...cells, ...mouth.run], openNative, kernel), ...sailed.pts.slice(1)];
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) * M_PER_NATIVE;
  return { pts, len };
}

/**
 * The world's lanes. The host hands its map's directory, maps and Travel Options' list (`mapDict()`, `maps`, `portIds` -
 * the Bay's ports), the world's
 * ports past the Bay, the Bay's lane water (`bayOpen` and its native twin) and its composed readers (`water` the
 * planner's sea, `maps.getClimateIndex`, `beyond()` the land past the Bay standing) - worldLaneWater's.
 * @param {{ mapDict: () => Map<number, any>|null|undefined, maps: { getRegion: (r: number) => any, getClimateIndex: (x: number, y: number) => number }, portIds: readonly number[],
 *   ports: import('../../world/worldWide/worldPorts.js').WorldPorts, bayOpen: (x: number, y: number) => boolean,
 *   bayOpenNative: (x: number, z: number) => boolean, water: (x: number, y: number) => boolean, beyond: () => boolean, kernel?: ((x: number, z: number) => boolean)|null }} o
 */
export function createWorldLanes({
  mapDict,
  maps,
  portIds,
  ports,
  bayOpen,
  bayOpenNative,
  water,
  beyond,
  kernel = null,
}) {
  const { open: worldOpen, openNative: worldOpenNative } = worldLaneWater({
    bayOpen,
    water,
    climateAt: (x, y) => maps.getClimateIndex(x, y),
    beyond,
  });
  /** @type {any[]|null} */ let bayList = null;
  const bayPorts = () => (bayList ??= bayLanePorts(mapDict(), maps, portIds));
  /** @type {any[]|null} */ let bay = null;
  /** @type {any[]} */ let beyondList = [];
  let beyondOf = null,
    beyondTrace = null;
  /** @type {{ b: any[], w: any[], c: any[], list: any[] }|null} */ let all = null;
  const bayWays = new Map(),
    beyondWays = new Map(),
    crossWays = new Map();
  /** @type {any[]} */ const NONE = []; // the Bay before its directory stands: no lane
  /** WW7-10: the crossing lanes, the mouths and the seaward water they were made on, and what they were made for. */
  /** @type {any[]} */ let crossList = [];
  /** @type {{ trace: any, mouths: ReturnType<typeof bayMouths>, seaward: Uint8Array }|null} */ let sea = null;
  /** @type {string|null} */ let crossOf = null;
  /** @type {any} */ let crossSea = null;
  /** WW7-10: the Bay's mouths and its seaward water on the picture that stands (none without one). */
  const seaOf = () => {
    const trace = tamrielTrace();
    if (!trace || !tamrielFit()) return null;
    if (sea?.trace !== trace) {
      const mouths = bayMouths(bayOpen, worldOpen, pictureSeaMask(trace));
      sea = { trace, mouths, seaward: baySeaward(bayOpen, mouths) };
    }
    return sea;
  };
  const bayNet = () => {
    if (!bay) {
      const p = bayPorts();
      if (p) bay = laneNetwork(p, bayOpen);
    }
    return bay ?? NONE;
  };
  /** A lane's way past the Bay, kept once (the picture's where it stands, else the Bay's scale over the world's water). */
  const beyondWay = (/** @type {any} */ lane) => {
    let way = beyondWays.get(lane.key);
    if (way === undefined) {
      way = tamrielTrace()
        ? beyondLaneWay(lane, worldOpenNative, kernel)
        : laneWay(lane, worldOpen, worldOpenNative, kernel);
      beyondWays.set(lane.key, way);
    }
    return way;
  };
  /** AUDIT SEA PATHS O2: each port past the Bay with no port within its reach (BEYOND_LANE_MAX_PX, its own where farther)
   *  and none of whose lanes has a way on the picture runs to the nearest of its LONE_TRIES nearest within BEYOND_LONE_PX
   *  that one joins it to, LANE_NEIGHBOURS at most - only such a port's lanes asked for their ways here. */
  const loneLanes = (/** @type {any[]} */ list) => {
    if (!tamrielTrace()) return list;
    const out = [...list];
    const sea = ports
      .list()
      .map((p) => ({ ...p, road: roadsteadOf(p, worldOpen, true) }))
      .filter((p) => p.road)
      .sort((p, q) => p.id - q.id);
    for (const p of sea) {
      const reach = Math.max(BEYOND_LANE_MAX_PX, p.reach ?? 0);
      if (sea.some((q) => q !== p && Math.hypot(q.road.x - p.road.x, q.road.y - p.road.y) <= reach)) continue;
      if (out.some((l) => (l.a.id === p.id || l.b.id === p.id) && beyondWay(l))) continue;
      const near = sea
        .filter((q) => q.id !== p.id)
        .map((q) => ({ q, d: Math.hypot(q.road.x - p.road.x, q.road.y - p.road.y) }))
        .filter((x) => x.d <= BEYOND_LONE_PX)
        .sort((x, y) => x.d - y.d || x.q.id - y.q.id)
        .slice(0, LONE_TRIES);
      let n = 0;
      for (const { q, d } of near) {
        const [a, b] = p.id < q.id ? [p, q] : [q, p],
          key = `${a.id}-${b.id}`;
        if (out.some((l) => l.key === key)) continue;
        const lane = { key, a, b, path: Math.ceil(2 * d) };
        if (!beyondWay(lane)) continue;
        out.push(lane);
        if (++n >= LANE_NEIGHBOURS) break;
      }
    }
    return out;
  };
  /** AUDIT SEA PATHS C1: a lane past the Bay with no way under its cap is sought over the picture's whole sea; found, it
   *  runs at its own length (`path`, `long`: Senchal to Torval, Necrom's two, the Imperial City's to Skyrim round the land). */
  const longLanes = (/** @type {any[]} */ list) => {
    if (!tamrielTrace()) return list;
    return list.map((lane) => {
      if (beyondWays.has(lane.key) ? beyondWays.get(lane.key) : beyondReaches(lane, worldOpenNative, kernel))
        return lane;
      const path = beyondFarPath(lane, worldOpenNative, kernel);
      if (path === null) return lane;
      beyondWays.delete(lane.key); // a lone port's ask under the old cap
      return { ...lane, path, long: true };
    });
  };
  const beyondNet = () => {
    const v = ports.version(),
      t = tamrielTrace();
    if (v !== beyondOf || t !== beyondTrace) {
      beyondOf = v;
      beyondTrace = t;
      beyondWays.clear();
      beyondList = longLanes(
        loneLanes(laneNetwork(ports.list(), worldOpen, BEYOND_LANE_MAX_PX, true, BEYOND_LANE_PATH_PX)),
      );
    } // AUDIT TESA II P7: their own reach; SEA-SQUARE: the roomiest roadstead; AUDIT SEA PATHS LN-2: a lone port its way's cap; O2: one with no way farther
    return beyondList;
  };
  /** WW7-10: the lanes across the Bay's edge - made again when the world's ports or the picture move, none before the
   *  Bay's directory stands or without a picture (no mouth is known). */
  const crossNet = () => {
    const b = bayPorts(),
      s = b ? seaOf() : null;
    if (!s) {
      if (crossSea) {
        crossSea = null;
        crossOf = null;
        crossList = [];
        crossWays.clear();
      }
      return crossList;
    }
    const v = ports.version();
    if (v !== crossOf || s !== crossSea) {
      crossOf = v;
      crossSea = s;
      crossList = crossLanes(ports.list(), /** @type {any[]} */ (b), worldOpen, bayOpen, s.seaward);
      crossWays.clear();
    }
    return crossList;
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
    /** WW7-10: the lanes across the Bay's edge (crossLanes), made again whenever the world's ports or the picture move. */
    cross: crossNet,
    /** WW7-12: are the world's lanes WHOLE - the Bay's directory, the land past the Bay standing (`beyond()`) and its picture
     *  come (its ports, its lane water and the mouths across its edge are all the picture's, its fit installed with it -
     *  world/terrain/terrainGenClient.js), so `all()` is the one list every game standing that land holds? The serpent's
     *  site is rolled over them once they are (systems/serpent/serpentSite.js worldSerpentSite). */
    whole: () => !!bayPorts() && beyond() && !!tamrielTrace(),
    /** SEA-ROWS: are the lanes this game will hold all made - the Bay's directory, and the picture where the land past
     *  the Bay stands (the Bay's lanes alone with it off)? The crossing's waters are measured from them once they are. */
    settled: () => !!bayPorts() && (!beyond() || !!tamrielTrace()),
    /** Every lane of the world: the Bay's, then the ones past it, then (WW7-10) the ones across its edge. */
    all() {
      const b = bayNet(),
        w = beyondNet(),
        c = crossNet();
      if (!all || all.b !== b || all.w !== w || all.c !== c)
        all = { b, w, c, list: w.length || c.length ? [...b, ...w, ...c] : b };
      return all.list;
    },
    /** A lane's way (systems/naval/seaLanes.js laneWay - its own water's; past the Bay beyondLaneWay's, on the picture),
     *  kept once; null where the water joins its ports not.
     *  @param {{ key: string, a: { px: number, py: number, road: { x: number, y: number } }, b: { road: { x: number, y: number } } }} lane */
    way(lane) {
      if (/** @type {any} */ (lane).cross) {
        // WW7-10: across the Bay's edge - the Bay's water to a mouth, the picture's sea on
        let way = crossWays.get(lane.key);
        if (way === undefined) {
          const s = seaOf();
          way = s ? crossLaneWay(lane, { bayOpen, openNative: worldOpenNative, mouths: s.mouths, kernel }) : null;
          crossWays.set(lane.key, way);
        }
        return way;
      }
      if (!inBay(lane.a.px, lane.a.py)) return beyondWay(lane);
      let way = bayWays.get(lane.key);
      if (way === undefined) {
        way = laneWay(lane, bayOpen, bayOpenNative, kernel);
        bayWays.set(lane.key, way);
      } // the Bay's own water; past it beyondWay's (AUDIT TESA II P7: the picture's scale)
      return way;
    },
    /** SEA-LANES: whether a player at map pixel `here` may have a packet of `lane` in reach - asked before its way is:
     *  on the Bay every point of a way lies within half its longest (LANE_PATH_PX) of one of its ports; AUDIT TESA II P7:
     *  past it within the ellipse its two roadsteads bound for a way no longer than BEYOND_LANE_PATH_PX (NIBEN-SEA:
     *  beyondPathPx); WW7-10: across the Bay's edge, the ellipse for one no longer than CROSS_LANE_PATH_PX. SEA-ROWS: `pad`
     *  the reach past its water (the crossing's, etherCrossing.js createCrossSea).
     *  @param {{ a: any, b: any, cross?: boolean }} lane @param {{ x: number, y: number }} here */
    near(lane, here, pad = LANE_NEAR_PX) {
      const da = Math.hypot(lane.a.road.x - here.x, lane.a.road.y - here.y),
        db = Math.hypot(lane.b.road.x - here.x, lane.b.road.y - here.y);
      if (lane.cross) return da + db <= CROSS_LANE_PATH_PX + 2 * pad;
      if (inBay(lane.a.px, lane.a.py)) return Math.min(da, db) <= LANE_PATH_PX / 2 + pad;
      if (/** @type {any} */ (lane).long) {
        const way = beyondWay(lane);
        return !!way && nearWay(way.pts, here, pad);
      } // AUDIT SEA PATHS C1: its ellipse the land's whole
      return da + db <= beyondPathPx(lane) + 2 * pad; // NIBEN-SEA: a canal harbour's lane its own
    },
  };
}
