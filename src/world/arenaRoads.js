// @ts-check
// TESA4 (2026-10-12, the owner: "Continue"; bible/03-World/Arena-Provinces.md TESA4) - THE ROADS PAST THE BAY'S LAYER.
// TESA14 (2026-10-24, "Full Daggerfall network") moved the network itself to world/tamrielRoads.js: the port's own road
// law (world/road/roadNetwork.js buildRoadNetwork, ROADS 1-21) at the Bay's own scale over every place past the Bay, a region
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
import { DIR_DELTA, MAP_W, MAP_H } from './road/roadNetwork.js';
import { setRoadsPastTable } from './road/pathData.js'; // BAY-LEFT-MAPS: Travel Options' reads past the table are this layer's
import { inBay } from './tamriel/tamrielFrame.js';

/** TESA5: how deep inside its edge a Bay road may lie and still be joined, Bay pixels. */
export const JOIN_DEPTH = 8;
/** TESA5: how far apart along an edge two crossings stand at least - a road nearer the last one is the same crossing.
 *  ROAD-GAPS (2026-10-26, the owner: "Take care of exclusions and gaps"; `06-Systems/Travel-View.md` ROAD-GAPS): 12, where it
 *  was 60 - the Bay brings eighteen roads to its north, south and east edges (a road along the edge one), and seven
 *  crossings stood for them: the rest ended at the edge with the land going on past it, and a journey off the Bay walked
 *  the field from their ends to the nearest crossing's road. Two roads ten kilometres apart are two crossings now:
 *  fourteen on the freeware's Bay. */
export const JOIN_SPACING = 12;
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
        if (bay.roads[y * MAP_W + x]) {
          hits.push([u, k]);
          break;
        }
      }
    }
    const runs = [];
    for (const h of hits) {
      const r = runs.at(-1);
      if (r && h[0] - r.at(-1)[0] < JOIN_SPACING) r.push(h);
      else runs.push([h]);
    }
    for (const r of runs) {
      const depth = Math.min(...r.map((h) => h[1])),
        mid = (r[0][0] + r.at(-1)[0]) / 2;
      const [u, k] = r
        .filter((h) => h[1] === depth)
        .reduce((a, b) => (Math.abs(b[0] - mid) < Math.abs(a[0] - mid) ? b : a));
      const run = [];
      for (let j = k; j >= 0; j--) run.push(at(u, j));
      const [ex, ey] = at(u, 0);
      for (let j = 1; j <= JOIN_OUT; j++) run.push([ex + out[0] * j, ey + out[1] * j]);
      if (run.every(([x, y]) => land(x, y))) joins.push({ side, gate: run.at(-1), meet: run[0], run });
    }
  }
  return joins;
}

/** AUDIT TESA II R9: THE PIXELS A CROSSING'S ROAD IS DRAWN ON PAST THE BAY, its gate's but - no rolled place stands on
 *  them (world/tamrielRoads.js buildTamrielRegion `held`: the roll and the routes go round them, as round an Arena place),
 *  where a village and a poor home stood on two of the freeware's seven runs, the run painted through them. The gate is
 *  a road node, whose pixel the countryside may stand on as on a capital's gate. */
export function joinRunPixels(joins = []) {
  const out = [];
  for (const { run, gate } of joins)
    for (const [x, y] of run) if (!inBay(x, y) && (x !== gate[0] || y !== gate[1])) out.push({ x, y });
  return out;
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
  let px = ax,
    py = ay;
  for (let i = 1; i <= n; i++) {
    const qx = ax + Math.round(((bx - ax) * i) / n),
      qy = ay + Math.round(((by - ay) * i) / n);
    const bit = BIT_OF.get(`${qx - px},${qy - py}`);
    if (keep(px, py)) layer.set(beyondKey(px, py), (layer.get(beyondKey(px, py)) ?? 0) | bit);
    if (keep(qx, qy)) layer.set(beyondKey(qx, qy), (layer.get(beyondKey(qx, qy)) ?? 0) | OPPOSITE_OF.get(bit));
    px = qx;
    py = qy;
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
/** TESA15: what moved in it, a tile at a time - each ROAD_TILE tile its pixels are in and the install that last touched
 *  it, and the keys of its pixels; null until asked after a whole install (worked out then, from every pixel). */
let _tiles = null,
  _tilePixels = null;
/**
 * Install a layer (null: none). TESA15: `add`, the part merged into the layer already installed (the terrain client's
 * addArenaRoads: a region landing) - only the tiles it touches move; with none, or another layer, every tile does.
 * @param {?{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} layer
 * @param {?{ roads?: Map<number, number>, tracks?: Map<number, number> }} [add]
 */
export function setArenaRoads(layer, add = null) {
  const merged = !!add && !!layer && layer === _layer;
  _layer = layer ?? null;
  _version++;
  if (!merged) {
    _tiles = null;
    _tilePixels = null;
    return;
  }
  // the first add into a layer works its tiles out whole (it is small yet: the crossings, a region) - every add after
  // keeps them, so the map's first ask never walks the continent
  if (!_tiles) {
    arenaRoadTiles();
    return;
  }
  for (const kind of /** @type {const} */ (['roads', 'tracks']))
    for (const key of add[kind]?.keys() ?? []) stampPixel(key);
}
function stampPixel(key) {
  const t = roadTileOfKey(key);
  _tiles.set(t, _version);
  let keys = _tilePixels.get(t);
  if (!keys) _tilePixels.set(t, (keys = new Set()));
  keys.add(key);
}
export const arenaRoadsLayer = () => _layer;
/** Moves on every install. */
export const arenaRoadsVersion = () => _version;

/** W14 (STOREFRONT): the host that lays this layer on this thread (scenes/tamrielRoadsHost.js), kept as it is made - its
 *  `landedIn(x0, y0, x1, y1)` (the layer whole over a box) and `build()` read by the season's fissures past the Bay, which
 *  keep off these roads (scenes/seasonHost.js). Null while none lays them. */
let _host = null;
/** @param {?{ landedIn: (x0: number, y0: number, x1: number, y1: number) => boolean, build: () => number }} host */
export const keepArenaRoadsHost = (host) => {
  _host = host ?? null;
};
export const keptArenaRoadsHost = () => _host;

/** TESA13: the layer is walked into the sheet's chains a tile this many Bay pixels a side at a time (ui/tamrielInk.js) -
 *  TESA15: and stamped by it here, so a region landing re-inks the tiles it reaches and no others. */
export const ROAD_TILE = 64;
/** A ROAD_TILE tile's key from its column and row - a number, both either side of nought. */
export const roadTileKey = (tx, ty) => (ty + 4096) * 8192 + (tx + 4096);
/** The tile a layer key's pixel is in. */
export function roadTileOfKey(key) {
  const [x, y] = beyondPixel(key);
  return roadTileKey(Math.floor(x / ROAD_TILE), Math.floor(y / ROAD_TILE));
}
/** TESA15: the installed layer's tiles - each tile holding a road's or a track's pixel, and the install that last moved
 *  it. A tile that held some and holds none now keeps its stamp (its ink is made again, empty). */
export function arenaRoadTiles() {
  if (!_tiles) {
    _tiles = new Map();
    _tilePixels = new Map();
    for (const kind of /** @type {const} */ (['roads', 'tracks']))
      for (const key of _layer?.[kind]?.keys() ?? []) stampPixel(key);
  }
  return _tiles;
}
const NO_PIXELS = Object.freeze(new Set());
/** TESA15: the keys of the pixels a tile holds a road's or a track's on - the far view draws them as they lie. */
export function arenaRoadTilePixels(tx, ty) {
  arenaRoadTiles();
  return /** @type {Map<number, Set<number>>} */ (_tilePixels).get(roadTileKey(tx, ty)) ?? NO_PIXELS;
}

/** A Bay pixel's byte in a layer: 'roads' or 'tracks', 0 for none. */
export const layerByte = (layer, kind, x, y) => layer?.[kind]?.get(beyondKey(x, y)) ?? 0;
/** The installed layer's byte at a Bay pixel. */
export const arenaRoadByte = (kind, x, y) => layerByte(_layer, kind, x, y);
// BAY-LEFT-MAPS (bible/06-Systems/Travel-Options.md BAY-LEFT-MAPS): past the Bay's table, Basic Roads' path data reads this
// layer - handed in as the module loads, so pathData.js need not import it (the account Worker bundles pathData.js).
setRoadsPastTable(arenaRoadByte);
/** Its corner byte at a Bay pixel, as the mod's (world/road/roadPainter.js pathCorners): the east neighbour's SW|NW bits and
 *  the west neighbour's NE|SE. */
export const arenaRoadCorners = (kind, x, y) =>
  (arenaRoadByte(kind, x + 1, y) & 0x5) | (arenaRoadByte(kind, x - 1, y) & 0x50);
/** Roads and tracks together at a Bay pixel - travelPaths.js pathsDataPoint's question. */
export const arenaPathsAt = (x, y) => (arenaRoadByte('roads', x, y) | arenaRoadByte('tracks', x, y)) & 0xff;
/** TESA5: a Bay pixel's join byte - a road's, the one part of the layer a pixel ON the Bay reads (its runs are straight
 *  out of the Bay, so no diagonal of them brushes a corner). */
export const arenaJoinByte = (x, y) => arenaRoadByte('join', x, y);
/** Does a layer carry anything on a pixel or the two beside it - whose bytes and corners its paint reads? */
export const layerTouches = (layer, x, y) =>
  !!layer &&
  [-1, 0, 1].some(
    (dx) =>
      layerByte(layer, 'roads', x + dx, y) ||
      layerByte(layer, 'tracks', x + dx, y) ||
      layerByte(layer, 'join', x + dx, y),
  );

/**
 * The layer to post across a thread, and back: its pixels' keys and bytes in three arrays (transferable).
 * @param {{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} layer
 */
export function packArenaRoads(layer) {
  const keys = [...new Set([...layer.roads.keys(), ...layer.tracks.keys()])];
  const k = new Float64Array(keys),
    r = new Uint8Array(keys.length),
    t = new Uint8Array(keys.length);
  keys.forEach((key, i) => {
    r[i] = layer.roads.get(key) ?? 0;
    t[i] = layer.tracks.get(key) ?? 0;
  });
  const join = layer.join ?? new Map();
  return {
    keys: k,
    roads: r,
    tracks: t,
    joinKeys: new Float64Array(join.keys()),
    join: Uint8Array.from(join.values()),
  };
}
/** @param {{ keys: Float64Array, roads: Uint8Array, tracks: Uint8Array, joinKeys?: Float64Array, join?: Uint8Array }} packed */
export function unpackArenaRoads(packed) {
  const roads = new Map(),
    tracks = new Map(),
    join = new Map();
  for (let i = 0; i < packed.keys.length; i++) {
    if (packed.roads[i]) roads.set(packed.keys[i], packed.roads[i]);
    if (packed.tracks[i]) tracks.set(packed.keys[i], packed.tracks[i]);
  }
  for (let i = 0; i < (packed.joinKeys?.length ?? 0); i++) join.set(packed.joinKeys[i], packed.join[i]);
  return { roads, tracks, join };
}
