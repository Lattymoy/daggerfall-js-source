// @ts-check
// TESA4 (2026-10-12, the owner: "Continue"; bible/03-World/Arena-Provinces.md TESA4) - THE ROADS PAST THE BAY'S LAYER.
// TESA14 (2026-10-24, "Full Daggerfall network") moved the network itself to world/tamrielRoads.js: the port's own road
// law (world/roadNetwork.js buildRoadNetwork, ROADS 1-21) at the Bay's own scale over every place past the Bay, a region
// at a time on the roads' own worker. TESA4's window - a cell of five Bay pixels, its ground read at its centre, the
// network drawn back centre to centre - is retired with it; this module keeps what the kernels and the verge read.
//
// THE LAYER is a sparse map of Bay pixel to compass byte (ROADS 1's layout), roads and tracks, with no pixel of the Bay in
// it but the crossings' joins. It is installed where the kernel reads it - each thread its own copy (the terrain client
// merges each region's layer as it lands and posts it on; tamrielLand's trace the pattern) - and the painter and the verge
// ask it of a pixel off the Bay. Pure, and world/ and formats/ alone: the terrain worker imports it (TAMRIEL2-WORKER).
//
// TESA5 - THE JOIN: where the Bay's own roads come to its edge and the land goes on past it, a crossing (arenaJoins): a
// road node of the network a little past the edge (its GATE) and the straight run from the Bay's road out to it. The
// run's Bay pixels are the layer's `join` - the one part of it a Bay pixel reads.
//
// Nothing of Arena ships or crosses the wire (bible/01-Overview/Port-Doctrine.md): each player's roads are laid from
// their own Daggerfall files, the same for every player.
import { DIR_DELTA, MAP_W, MAP_H } from './roadNetwork.js';
import { inBay } from './tamrielFrame.js';

/** TESA5: how deep inside its edge a Bay road may lie and still be joined, Bay pixels. */
export const JOIN_DEPTH = 8;
/** TESA5: how far apart along an edge two crossings stand at least - a road nearer the last one is the same crossing. */
export const JOIN_SPACING = 60;
/** TESA5: how far past the edge a crossing's gate stands, Bay pixels - the gate a road node past the Bay. */
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

/** TESA5: the crossings' runs as a layer - each run's Bay pixels the `join`, its pixels past the Bay the roads' (TESA14:
 *  the regions' layers are merged over it). */
export function joinLayer(joins = []) {
  const out = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (const { meet, gate } of joins) {
    stampRun(out.join, meet[0], meet[1], gate[0], gate[1], inBay);
    stampRun(out.roads, meet[0], meet[1], gate[0], gate[1]);
  }
  return out;
}

/** TESA14: OR one layer into another - a region's into the installed one as it lands, its joins too. Answers `into`.
 *  @param {{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} into
 *  @param {{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} add */
export function mergeArenaRoads(into, add) {
  for (const kind of /** @type {const} */ (['roads', 'tracks', 'join'])) {
    if (!add[kind]) continue;
    const m = (into[kind] ??= new Map());
    for (const [k, b] of add[kind]) m.set(k, (m.get(k) ?? 0) | b);
  }
  return into;
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
