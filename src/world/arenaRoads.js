// @ts-check
// TESA4 (2026-10-12, the owner: "Continue"; bible/03-World/Arena-Provinces.md TESA4) - ROADS BETWEEN ARENA'S PLACES.
// The land past the Bay carries roads between the Arena places that stand on it (world/arenaPlaces.js arenaPixels), by
// the port's own road law (world/roadNetwork.js buildRoadNetwork, ROADS 1-21) and its own painter (world/roadPainter.js,
// through the kernel's seam): our engine on Arena's map, as TESA1 chose.
//
// THE GRADE, THE CLONE'S: each place's road grade is the grade of the Daggerfall place it stands as (world/arenaLocations.js
// arenaRoadTowns) - a city-state's city and a town's hamlet are ROAD nodes, a village a TRACK node, a dungeon none
// (ROADS 1: a road to a labyrinth tells the player where it is). Pure, and world/ and formats/ alone: the terrain
// worker imports it (TAMRIEL2-WORKER).
//
// THE WINDOW. The network's grid is the Bay's 1000 x 500 (the builder's own), laid over the places' extent at an integer
// scale - ARENA_ROAD_MARGIN Bay pixels round them, `s` Bay pixels a cell (5 on the freeware's places). A cell's ground is
// the ground at its centre; the Bay's own cells are water to it, so no Arena road crosses the Bay's land (the Bay's
// network is its own). Each step the network takes, cell to cell, is drawn back onto the Bay pixels as the straight run
// from centre to centre - `s` pixels of one compass point - and each place's own pixel is joined to its cell's centre the
// same way. Arena's places stand about as far apart in cells as Daggerfall's towns do in pixels, so the dials are the
// Bay's own (ROAD_DIALS).
//
// THE LAYER is a sparse map of Bay pixel to compass byte (ROADS 1's layout), roads and tracks, with no pixel of the Bay in
// it. It is installed where the kernel reads it - each thread its own copy (the terrain worker builds it, this thread
// installs what it posts back; tamrielLand's trace the pattern) - and the painter and the verge ask it of a pixel off the
// Bay. Built once a set of places, cached as the Bay's network is (world/roadsCache.js).
//
// TESA5 - THE JOIN: where the Bay's own roads come to its edge and the land goes on past it, a crossing (arenaJoins): a
// road node of Arena's network a little past the edge (its GATE) and the straight run from the Bay's road out to it. The
// run's Bay pixels are the layer's `join` - the one part of it a Bay pixel reads.
//
// Nothing of Arena ships or crosses the wire (bible/01-Overview/Port-Doctrine.md): each player's roads are drawn from
// their own copy's places, the same for every player with the same release (TESA-ONLINE).
import { buildRoadNetwork, DIR_DELTA, MAP_W, MAP_H, ROAD_DIALS, ROAD_TYPES } from './roadNetwork.js';
import { inBay, tamrielFit } from './tamrielFrame.js';
import { tamrielTrace } from './tamrielLand.js';
import { GENERATOR_VERSION } from './roadsCache.js';

/** Bay pixels of ground round the places' extent the window takes in. */
export const ARENA_ROAD_MARGIN = 40;
/** Bump when the layer's shape changes - the window, the raster, the ground a cell reads. The Bay's generator rides the
 *  key on its own (GENERATOR_VERSION, ROAD_DIALS). */
export const ARENA_ROADS_VERSION = 2;   // AUDIT-TESA A3-1: a shore town's cell its land

/**
 * THE WINDOW over the towns: its north-west Bay pixel and its scale - the least integer at which the extent and its
 * margin fit the builder's grid. Null for no towns.
 * @param {?Array<{ x: number, y: number }>} towns @param {number} [margin]
 * @returns {?{ x0: number, y0: number, s: number }}
 */
export function arenaRoadWindow(towns, margin = ARENA_ROAD_MARGIN) {
  if (!towns?.length) return null;
  let xa = Infinity, ya = Infinity, xb = -Infinity, yb = -Infinity;
  for (const t of towns) { xa = Math.min(xa, t.x); ya = Math.min(ya, t.y); xb = Math.max(xb, t.x); yb = Math.max(yb, t.y); }
  const x0 = xa - margin, y0 = ya - margin;
  const w = xb + margin + 1 - x0, h = yb + margin + 1 - y0;
  return { x0, y0, s: Math.max(1, Math.ceil(Math.max(w / MAP_W, h / MAP_H))) };
}

/** A Bay pixel's cell in the window. */
export const windowCell = (win, x, y) => [Math.floor((x - win.x0) / win.s), Math.floor((y - win.y0) / win.s)];
/** A cell's centre, a Bay pixel. */
export const cellCentre = (win, u, v) => [win.x0 + u * win.s + (win.s >> 1), win.y0 + v * win.s + (win.s >> 1)];

/**
 * THE NETWORK on the window's cells: the ground read once a cell at its centre (`heightAt`, `isWater` of a Bay pixel and
 * its height; the Bay's own cells water), and the towns in their cells - a cell's node its first road town, else its
 * first track town.
 * @param {{ towns: Array<{ x: number, y: number, type: number }>, window: { x0: number, y0: number, s: number },
 *   heightAt: (x: number, y: number) => number, isWater: (x: number, y: number, h: number) => boolean }} o
 * @returns {{ roads: Uint8Array, tracks: Uint8Array, stats: object }}
 */
export function buildArenaNetwork({ towns, window, heightAt, isWater }) {
  const heights = new Uint8Array(MAP_W * MAP_H), water = new Uint8Array(MAP_W * MAP_H);
  for (let v = 0; v < MAP_H; v++) {
    for (let u = 0; u < MAP_W; u++) {
      const [x, y] = cellCentre(window, u, v);
      const h = inBay(x, y) ? 0 : heightAt(x, y);
      heights[v * MAP_W + u] = h;
      water[v * MAP_W + u] = inBay(x, y) || isWater(x, y, h) ? 1 : 0;
    }
  }
  const taken = new Set(), locations = [];
  // TESA5: a road node takes its cell before a track node does (a crossing's gate where a village stands); of a grade,
  // the first
  const roadGrade = (o) => /** @type {ReadonlySet<number>} */ (ROAD_TYPES).has(o.type);
  for (const t of [...towns.filter(roadGrade), ...towns.filter((o) => !roadGrade(o))]) {
    const [u, v] = windowCell(window, t.x, t.y);
    if (taken.has(v * MAP_W + u)) continue;
    taken.add(v * MAP_W + u);
    // AUDIT-TESA A3-1: a town on the shore (TESA6's ports, a shore capital) can stand in a cell whose centre is the sea -
    // its own cell is its land, at its own pixel's height, so the roads reach it
    if (!inBay(t.x, t.y)) { water[v * MAP_W + u] = 0; heights[v * MAP_W + u] = heightAt(t.x, t.y); }
    locations.push({ x: u, y: v, type: t.type });
  }
  return buildRoadNetwork({ locations, heightAt: (u, v) => heights[v * MAP_W + u], isWater: (u, v) => water[v * MAP_W + u] === 1 });
}

/** TESA5: how deep inside its edge a Bay road may lie and still be joined, Bay pixels. */
export const JOIN_DEPTH = 8;
/** TESA5: how far apart along an edge two crossings stand at least - a road nearer the last one is the same crossing. */
export const JOIN_SPACING = 60;
/** TESA5: how far past the edge a crossing's gate stands - its window cell's centre past the Bay at any scale to 8. */
export const JOIN_OUT = 8;
/** The Bay's four edges: the run along it, the Bay pixel at (along, depth in), the step out of the Bay. */
const EDGES = Object.freeze([
  Object.freeze({ side: 'N', len: MAP_W, at: (u, k) => [u, k], out: [0, -1] }),
  Object.freeze({ side: 'S', len: MAP_W, at: (u, k) => [u, MAP_H - 1 - k], out: [0, 1] }),
  Object.freeze({ side: 'W', len: MAP_H, at: (u, k) => [k, u], out: [-1, 0] }),
  Object.freeze({ side: 'E', len: MAP_H, at: (u, k) => [MAP_W - 1 - k, u], out: [1, 0] }),
]);

/**
 * TESA5: THE CROSSINGS - where the Bay's ROADS (never its tracks: a track is no way out of a province) come within
 * JOIN_DEPTH of its edge, each run of them along the edge (runs nearer than JOIN_SPACING one run) is one crossing, at the
 * road pixel nearest the edge (of those, the nearest the run's middle). Its GATE stands JOIN_OUT past the edge, straight
 * out; the run is every pixel from the road out to the gate, and a crossing stands only where all of it is land (`land`
 * of a Bay pixel or one past it - the Bay's water law and the ground's).
 * @param {{ roads: Uint8Array }} bay the Bay's network (terrainGen.roads()) @param {(x: number, y: number) => boolean} land
 * @returns {Array<{ side: string, gate: number[], meet: number[], run: number[][] }>}
 */
export function arenaJoins(bay, land) {
  const joins = [];
  for (const { side, len, at, out } of EDGES) {
    const hits = [];
    for (let u = 0; u < len; u++) {
      for (let k = 0; k < JOIN_DEPTH; k++) {
        const [x, y] = at(u, k);
        if (bay.roads[y * MAP_W + x]) { hits.push([u, k]); break; }
      }
    }
    const runs = [];
    for (const h of hits) { const r = runs.at(-1); if (r && h[0] - r.at(-1)[0] < JOIN_SPACING) r.push(h); else runs.push([h]); }
    for (const r of runs) {
      const depth = Math.min(...r.map((h) => h[1])), mid = (r[0][0] + r.at(-1)[0]) / 2;
      const [u, k] = r.filter((h) => h[1] === depth).reduce((a, b) => (Math.abs(b[0] - mid) < Math.abs(a[0] - mid) ? b : a));
      const run = [];
      for (let j = k; j >= 0; j--) run.push(at(u, j));
      const [ex, ey] = at(u, 0);
      for (let j = 1; j <= JOIN_OUT; j++) run.push([ex + out[0] * j, ey + out[1] * j]);
      if (run.every(([x, y]) => land(x, y))) joins.push({ side, gate: run.at(-1), meet: run[0], run });
    }
  }
  return joins;
}

/** A Bay pixel's key in the layer: x and y each in [-32768, 32767]. */
export const beyondKey = (x, y) => (y + 32768) * 65536 + (x + 32768);
/** TESA13: the Bay pixel a layer key names, [x, y] - beyondKey's inverse. */
export const beyondPixel = (key) => [(key % 65536) - 32768, Math.floor(key / 65536) - 32768];
const BIT_OF = new Map(DIR_DELTA.map(([bit, dx, dy]) => [`${dx},${dy}`, bit]));
const OPPOSITE_OF = new Map(DIR_DELTA.map(([bit], k) => [bit, DIR_DELTA[(k + 4) % 8][0]]));
/** Each cell's steps drawn once: from it to the east, south-east, south and south-west. */
const FORWARD = DIR_DELTA.slice(2, 6);

const offBay = (x, y) => !inBay(x, y);
/** One straight run of 8-connected steps between two Bay pixels, each step's bits on both its ends - on the pixels `keep`
 *  takes: none on the Bay, unless the join's. */
function stampRun(layer, ax, ay, bx, by, keep = offBay) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  let px = ax, py = ay;
  for (let i = 1; i <= n; i++) {
    const qx = ax + Math.round(((bx - ax) * i) / n), qy = ay + Math.round(((by - ay) * i) / n);
    const bit = BIT_OF.get(`${qx - px},${qy - py}`);
    if (keep(px, py)) layer.set(beyondKey(px, py), (layer.get(beyondKey(px, py)) ?? 0) | bit);
    if (keep(qx, qy)) layer.set(beyondKey(qx, qy), (layer.get(beyondKey(qx, qy)) ?? 0) | OPPOSITE_OF.get(bit));
    px = qx; py = qy;
  }
}

/**
 * THE LAYER: the network's steps drawn onto the Bay pixels, centre to centre, and each town's pixel joined to its cell's
 * centre where the cell carries that grade; TESA5: each crossing's run, its Bay pixels the `join`, its gate's past the
 * Bay the roads'.
 * @param {{ roads: Uint8Array, tracks: Uint8Array }} net @param {{ x0: number, y0: number, s: number }} window
 * @param {Array<{ x: number, y: number }>} towns @param {Array<{ meet: number[], gate: number[] }>} [joins]
 * @returns {{ roads: Map<number, number>, tracks: Map<number, number>, join: Map<number, number> }}
 */
export function rasterArenaRoads(net, window, towns, joins = []) {
  const out = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (const { meet, gate } of joins) {
    stampRun(out.join, meet[0], meet[1], gate[0], gate[1], inBay);
    stampRun(out.roads, meet[0], meet[1], gate[0], gate[1]);
  }
  for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
    const cells = net[kind], layer = out[kind];
    for (let v = 0; v < MAP_H; v++) {
      for (let u = 0; u < MAP_W; u++) {
        const m = cells[v * MAP_W + u];
        if (!m) continue;
        for (const [bit, dx, dy] of FORWARD) if (m & bit) stampRun(layer, ...cellCentre(window, u, v), ...cellCentre(window, u + dx, v + dy));
      }
    }
    for (const t of towns) {
      const [u, v] = windowCell(window, t.x, t.y);
      if (u >= 0 && v >= 0 && u < MAP_W && v < MAP_H && cells[v * MAP_W + u]) stampRun(layer, ...cellCentre(window, u, v), t.x, t.y);
    }
  }
  return out;
}

/**
 * THE CACHE KEY: everything the layer is made of - the generator's version and dials, this layer's version, the towns,
 * the window, and the ground: the heightmap's length (WOODS.WLD's), the fit and the trace's land (the ground past the Bay,
 * world/tamrielGround.js; the installed ones unless given).
 * @param {{ towns: Array<{ x: number, y: number, type: number }>, window: { x0: number, y0: number, s: number },
 *   woodsLength: number, fit?: ?{ ox: number, oy: number, ppu: number }, trace?: ?{ land: Uint8Array, province: Uint8Array } }} o
 */
export function arenaRoadsKey({ towns, window, woodsLength, fit = tamrielFit(), trace = tamrielTrace() }) {
  let sum = 0;
  for (const t of towns) sum = (sum + t.x * 31 + t.y * 17 + (t.type | 0) * 7) >>> 0;
  let land = 0;
  if (trace) for (let i = 0; i < trace.land.length; i++) if (trace.land[i]) land = (Math.imul(land, 31) + i + 1 + trace.province[i] * 977) >>> 0;
  const f = fit ? `${fit.ox},${fit.oy},${fit.ppu}` : 'none';
  return `arena-roads:v${ARENA_ROADS_VERSION}:g${GENERATOR_VERSION}:${towns.length}:${sum}:${window.x0},${window.y0},${window.s}:${woodsLength}:${f}:${land}:${JSON.stringify(ROAD_DIALS)}`;
}

// THE INSTALLED LAYER - this thread's.
let _layer = null;
let _version = 0;
/** Install a layer (null: none). */
export function setArenaRoads(layer) {
  _layer = layer ?? null;
  _version++;
}
export const arenaRoadsLayer = () => _layer;
/** Moves on every install. */
export const arenaRoadsVersion = () => _version;

/** A Bay pixel's byte in a layer: 'roads' or 'tracks', 0 for none. */
export const layerByte = (layer, kind, x, y) => layer?.[kind]?.get(beyondKey(x, y)) ?? 0;
/** The installed layer's byte at a Bay pixel. */
export const arenaRoadByte = (kind, x, y) => layerByte(_layer, kind, x, y);
/** Its corner byte at a Bay pixel, as the mod's (world/roadPainter.js pathCorners): the east neighbour's SW|NW bits and
 *  the west neighbour's NE|SE. */
export const arenaRoadCorners = (kind, x, y) => (arenaRoadByte(kind, x + 1, y) & 0x5) | (arenaRoadByte(kind, x - 1, y) & 0x50);
/** Roads and tracks together at a Bay pixel - travelPaths.js pathsDataPoint's question. */
export const arenaPathsAt = (x, y) => (arenaRoadByte('roads', x, y) | arenaRoadByte('tracks', x, y)) & 0xff;
/** TESA5: a Bay pixel's join byte - a road's, the one part of the layer a pixel ON the Bay reads (its runs are straight
 *  out of the Bay, so no diagonal of them brushes a corner). */
export const arenaJoinByte = (x, y) => arenaRoadByte('join', x, y);
/** Does a layer carry anything on a pixel or the two beside it - whose bytes and corners its paint reads? */
export const layerTouches = (layer, x, y) => !!layer && [-1, 0, 1].some((dx) => layerByte(layer, 'roads', x + dx, y) || layerByte(layer, 'tracks', x + dx, y) || layerByte(layer, 'join', x + dx, y));

/**
 * The layer to post across a thread, and back: its pixels' keys and bytes in three arrays (transferable).
 * @param {{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} layer
 */
export function packArenaRoads(layer) {
  const keys = [...new Set([...layer.roads.keys(), ...layer.tracks.keys()])];
  const k = new Float64Array(keys), r = new Uint8Array(keys.length), t = new Uint8Array(keys.length);
  keys.forEach((key, i) => { r[i] = layer.roads.get(key) ?? 0; t[i] = layer.tracks.get(key) ?? 0; });
  const join = layer.join ?? new Map();
  return { keys: k, roads: r, tracks: t, joinKeys: new Float64Array(join.keys()), join: Uint8Array.from(join.values()) };
}
/** @param {{ keys: Float64Array, roads: Uint8Array, tracks: Uint8Array, joinKeys?: Float64Array, join?: Uint8Array }} packed */
export function unpackArenaRoads(packed) {
  const roads = new Map(), tracks = new Map(), join = new Map();
  for (let i = 0; i < packed.keys.length; i++) {
    if (packed.roads[i]) roads.set(packed.keys[i], packed.roads[i]);
    if (packed.tracks[i]) tracks.set(packed.keys[i], packed.tracks[i]);
  }
  for (let i = 0; i < (packed.joinKeys?.length ?? 0); i++) join.set(packed.joinKeys[i], packed.join[i]);
  return { roads, tracks, join };
}
