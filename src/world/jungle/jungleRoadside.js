// @ts-check
// ═══════════════════════════════════════════════════════════════════
// JUNGLE-ROADSIDE (2026-10-23, the owner, through Mac, with pine.obj, pine-1.obj and pine2.obj: "These trees are meant
// for the jungle biome and roadside. Making it more like a jungle with the vines stringing across the roads", and to have
// them "sunk into the ground so they dont float") - THE ROADSIDE PAIRS, READ. bible/03-World/Bantha-Jungle.md, The
// roadside pairs, is the design and the record; 01-Overview/audits/Audit-Jungle-Roadside.md its audit.
//
// Each of the owner's three files is a PAIR: the mahogany and a second tree of the jungle's own (a kapok they leant over
// the road, a fig, a kapok they sank 2 m), 33 m apart, and lianas strung between their crowns - ribbons cut from the fig
// picture's hanging vines, laid on their side so each vine drawn down the picture runs from one crown to the other.
//
// THE PAIR IS READ WHOLE, AND DRAWN A TREE AT A TIME. Its near trees are the owner's file as they drew it (both trees,
// the lianas, the leaning kapok's own shape) - the mirror, the fan and the winding jungleMesh's (jungleModels.js objMesh)
// - cut in two HALVES at the middle of its roots, each tree with the lianas on its side, each moved so its own ROOT is
// the origin: one near-only prototype of the jungle's door a half, instanced at its tree's root with the pair's turn and
// scale, so it hands over to its tree's far picture where that picture stands (AUDIT JUNGLE-ROADSIDE GAME-1: one instance
// at the middle handed over 16 m from each tree's picture, and a tree seen from the side half vanished). Its trees stand
// again as the jungle's own trees at their roots (the species JUNGLE_PAIRS names), so far off each is its species' far
// picture, and near and far each is cover and a trunk.
//
// A ROOT is the middle of what the tree's picture sinks below the owner's ground (y 0): the lianas wear the fig's
// picture and hang to within a metre of the ground beside a fig's trunk, so the lowest-band root of a single tree
// (jungleMesh's) would be pulled out toward the road by them.
//
// THIS MODULE IS PURE (no GL, no fetch, no DOM): the node tests read the very files the game reads, and the terrain
// worker reads its measures.
// ═══════════════════════════════════════════════════════════════════
import { parseObj, parseMtl, objMesh, eachDrawn, FOOT_TOP, JUNGLE_SPECIES } from './jungleModels.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../terrain/terrainTiles.js';
import { surfaceHeightAt } from '../terrain/terrainSurface.js';
import { ARMS, roadRoom, PATH_HALF_M } from '../road/roadBand.js';
import { pathsDataPoint } from '../road/pathData.js';
import { tileDraw } from '../terrain/terrainNature.js';

/**
 * THE OWNER'S THREE PAIRS. `file` the OBJ's name under src/assets/jungle/source/ (its MTL the same name's); `trees` the
 * two species (JUNGLE_SPECIES's index) whose pictures stand as its trees, the mahogany first - a picture no tree of the
 * pair wears (the fig's, beside a kapok) is its lianas' alone; `key` its name in the code.
 */
export const JUNGLE_PAIRS = Object.freeze([
  Object.freeze({ key: 'leaning', file: 'pine', trees: Object.freeze([4, 1]) }),   // the mahogany, and a kapok leant toward the road on a mound
  Object.freeze({ key: 'fig', file: 'pine-1', trees: Object.freeze([4, 2]) }),     // the mahogany and a fig
  Object.freeze({ key: 'sunk', file: 'pine2', trees: Object.freeze([4, 1]) }),     // the mahogany and a kapok, sunk 2 m into its ground
]);

/** The record a pair's half - `side` 0 its first tree's, 1 its second's - is keyed by in the jungle's door
 *  (`500_${pairRecord(p, side)}`). */
export const pairRecord = (p, side) => `jungle-pair-${p.key}.${side}`;

/** A pair's files, relative to src/assets/jungle/source/. */
export const pairFiles = (p) => ({ obj: `${p.file}.obj`, mtl: `${p.file}.mtl` });

/**
 * (x, z) turned as the trees' program turns a mesh's vertex by its instance's turn (render/renderer.js BB_VS, uMesh:
 * `vec3(tc * p.x + tsn * p.z, p.y, -tsn * p.x + tc * p.z)`) - so a pair's trees stand where its near trees draw them.
 * @param {number} x @param {number} z @param {number} t
 * @returns {[number, number]}
 */
export const turnXZ = (x, z, t) => [Math.cos(t) * x + Math.sin(t) * z, -Math.sin(t) * x + Math.cos(t) * z];

/**
 * A PAIR, READ: its whole mesh about its anchor (objMesh's, `subs` each naming its `picture` - what it is measured by),
 * its two HALVES each about its own tree's root (the faces whose middle lies on that root's side of the roots' middle,
 * along the line between them - a tree with its lianas; what is drawn), the anchor in the owner's scene, its two trees'
 * roots about the anchor in the port's frame (mirrored x), and each tree's `base` - how far the owner stood it below (or
 * above) its species' own file: its picture's lowest point here less the species tree's lowest (`speciesLow`), so its
 * far picture stands where its near tree does.
 * @param {string} objText @param {string} mtlText
 * @param {{ trees: ReadonlyArray<number> }} pair a JUNGLE_PAIRS row
 * @param {ReadonlyArray<string>} pictures each species' picture (its MTL's map_Kd), JUNGLE_SPECIES's order
 * @param {ReadonlyArray<number>} speciesLow each species tree's lowest point (jungleMesh's min y)
 */
export function readPair(objText, mtlText, pair, pictures, speciesLow) {
  const obj = parseObj(objText), mtl = parseMtl(mtlText);
  const pictureOf = (material) => mtl.get(material ?? '')?.mapKd ?? null;
  const P = obj.positions;
  const roots = pair.trees.map((species) => {
    const pic = pictures[species];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, low = Infinity;
    for (const f of obj.faces) {
      if (pictureOf(f.material) !== pic) continue;
      for (const c of f.corners) {
        const x = P[c[0] * 3], y = P[c[0] * 3 + 1], z = P[c[0] * 3 + 2];
        low = Math.min(low, y);
        if (y >= 0) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
    if (!(x1 >= x0)) throw new Error(`jungle pair: no tree of ${pic} stands into its ground`);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, base: low - speciesLow[species] };
  });
  const named = (mesh) => ({
    ...mesh,
    subs: mesh.subs.map((s) => {
      const picture = pictureOf(s.material);
      if (!picture) throw new Error(`jungle pair: ${s.material} names no picture`);
      return { ...s, picture };
    }),
  });
  const ax = (roots[0].x + roots[1].x) / 2, az = (roots[0].z + roots[1].z) / 2;
  // a face to the tree whose side of the roots' middle its own middle lies on, along the line between the roots
  const dx = roots[1].x - roots[0].x, dz = roots[1].z - roots[0].z;
  const sideOf = (f) => {
    let cx = 0, cz = 0;
    for (const c of f.corners) { cx += P[c[0] * 3]; cz += P[c[0] * 3 + 2]; }
    cx /= f.corners.length; cz /= f.corners.length;
    return (cx - ax) * dx + (cz - az) * dz < 0 ? 0 : 1;
  };
  const halves = roots.map((r, k) => named(objMesh({ ...obj, faces: obj.faces.filter((f) => sideOf(f) === k) }, r.x, r.z)));
  return {
    mesh: named(objMesh(obj, ax, az)), halves, anchor: [ax, az],
    roots: roots.map((r) => [-(r.x - ax), r.z - az]),   // the port's frame: mirrored in x, as the mesh
    base: roots.map((r) => r.base),
  };
}

/** The sample spacing (m) a pair is measured at - converged (AUDIT JUNGLE-ROADSIDE LAW-3: at 0.1 m the grid stepped over
 *  a liana's tip and a root's reach; 0.05 and 0.02 agree to the millimetre). */
export const PAIR_MEASURE_STEP = 0.02;
/** The highest a drawn point over the road is kept in a pair's `under` (m, the owner's) - over it, the road's own rise
 *  under the pair is asked instead (standPairs' `reach`). */
export const UNDER_TOP = 8;
/** An `under` cell's side (m, the owner's). */
export const UNDER_CELL = 0.5;

/**
 * A PAIR AS IT STANDS, MEASURED off what it draws (jungleModels.js eachDrawn over every run, each its own picture), at
 * the owner's size: `feet` - each tree's foot, how far the drawn points under FOOT_TOP nearer its root than the other's
 * reach from it (its roots, buttresses and mound: what a road keeps clear of); `height` - its top; and what hangs over
 * the road it stands astride - every drawn point within a road's half band (VERGE1's PATH_HALF_M) of the middle of the
 * gap between its feet, along its axis, at the smallest scale a pair stands at (AUDIT JUNGLE-ROADSIDE READ-4): `over`
 * its lowest, `reach` how far along the road any of them stands from the axis, and `under` - the lowest of them in each
 * UNDER_CELL square, where that is under UNDER_TOP, `[x, z, y]` about the anchor in the port's frame (the lianas' drops,
 * the leaning kapok's crown edge: what a road is held under - AUDIT JUNGLE-ROADSIDE LAW-1).
 * @param {ReturnType<typeof readPair>} read
 * @param {(picture: string) => {width: number, height: number, data: Uint8Array}} picOf
 * @param {number} [step]
 */
export function measurePair(read, picOf, step = PAIR_MEASURE_STEP) {
  const [[ax, az], [bx, bz]] = read.roots;
  const feet = [0, 0], points = [];
  let height = 0;
  for (const s of read.mesh.subs) {
    eachDrawn(read.mesh, picOf(s.picture), step, (x, y, z) => {
      height = Math.max(height, y);
      points.push(x, y, z);
      if (y >= FOOT_TOP) return;
      const da = Math.hypot(x - ax, z - az), db = Math.hypot(x - bx, z - bz);
      if (da <= db) feet[0] = Math.max(feet[0], da); else feet[1] = Math.max(feet[1], db);
    }, s.at, s.count);
  }
  const d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d, mid = (feet[0] - feet[1]) / 2;
  const band = PATH_HALF_M / JUNGLE_ROADSIDE.scale[0];
  let over = Infinity, reach = 0;
  const cells = new Map();
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], y = points[i + 1], z = points[i + 2];
    const a = x * ux + z * uz, b = -x * uz + z * ux;   // along the pair's axis (across the road), and along the road
    if (Math.abs(a - mid) > band) continue;
    over = Math.min(over, y);
    reach = Math.max(reach, Math.abs(b));
    if (y >= UNDER_TOP) continue;
    const key = `${Math.floor(a / UNDER_CELL)},${Math.floor(b / UNDER_CELL)}`;
    if (!(cells.get(key) <= y)) cells.set(key, y);
  }
  const under = [...cells].map(([key, y]) => {
    const [i, j] = key.split(',').map(Number), a = (i + 0.5) * UNDER_CELL, b = (j + 0.5) * UNDER_CELL;
    return [a * ux - b * uz, a * uz + b * ux, y];
  });
  return { feet, height, over, reach, under };
}

/**
 * EACH PAIR AS IT STANDS, MEASURED (readPair and measurePair at PAIR_MEASURE_STEP, off the owner's files - test/world/
 * jungleroadside.test.js reads them again and holds this table to them): JUNGLE_PAIRS's order, metres at the owner's
 * size - its two roots about its anchor (the port's frame), each tree's `base` against its species' file, each tree's
 * foot (rounded up), its height, and what hangs over its road (rounded down): `over`, `reach` (rounded up) and the
 * `under` cells. A constant of the files, so the terrain worker stands a pair with no file read.
 */
export const JUNGLE_PAIR_MEASURES = Object.freeze([
  Object.freeze({   // leaning - its kapok leant toward the road on a mound
    roots: Object.freeze([Object.freeze([-4.439, 16.334]), Object.freeze([4.439, -16.334])]), base: Object.freeze([0, 0.21]),
    feet: Object.freeze([6.42, 8.53]), height: 22.55, over: 4.12, reach: 8.99,
    under: Object.freeze([[6.09, -4.3, 5.83], [5.61, -4.43, 5.81], [5.13, -4.57, 5.8], [5, -4.08, 5.8], [4.64, -4.7, 6.35], [3.55, -4.48, 5.77], [3.07, -4.61, 5.77], [2.58, -4.74, 5.77], [2.45, -4.26, 5.76], [1.97, -4.39, 5.76], [2.1, -4.87, 5.99], [1.62, -5, 6.43], [-1.06, -4.69, 6.41], [-1.54, -4.82, 6.41], [3.2, -5.09, 6.5], [3.68, -4.96, 6.59], [-0.93, -5.17, 6.61], [2.71, -5.22, 6.69], [-1.41, -5.3, 6.68], [2.23, -5.35, 6.94], [1.14, -5.13, 6.93], [-1.89, -5.44, 6.96], [0.65, -5.26, 7.1], [1.75, -5.48, 7.18], [0.17, -5.39, 7.33], [1.27, -5.61, 7.41], [-0.79, -5.66, 7.5], [-1.28, -5.79, 7.64], [0.78, -5.75, 7.72], [0.3, -5.88, 7.88], [-1.76, -5.92, 7.86], [-2.11, -0.83, 7.98], [-2.24, -0.35, 7.85], [-2.37, 0.13, 7.73], [-2.5, 0.62, 7.6], [-2.63, 1.1, 7.46], [-2.76, 1.58, 7.43], [-2.89, 2.06, 7.5], [-3.02, 2.55, 7.59], [-3.15, 3.03, 7.67], [-3.29, 3.51, 7.76], [-3.42, 3.99, 7.84], [-3.55, 4.48, 7.92], [-1.63, -6.4, 7.86], [-2.24, -6.05, 7.77], [-2.37, -5.57, 7.68], [-2.5, -5.08, 7.57], [-2.64, -4.6, 7.5], [-2.77, -4.12, 7.43], [-2.9, -3.64, 7.36], [-3.03, -3.15, 7.4], [-3.16, -2.67, 7.52], [-3.29, -2.19, 7.64], [-3.42, -1.71, 7.76], [-3.55, -1.22, 7.87], [-3.68, -0.74, 7.99], [-1.67, -4.34, 7.76], [-2.98, 6.19, 4.12], [-2.49, 6.32, 5.91], [-2.93, 4.12, 7.46], [-2.8, 3.64, 7.85]].map((c) => Object.freeze(c))),
  }),
  Object.freeze({   // fig
    roots: Object.freeze([Object.freeze([-3.256, 17.506]), Object.freeze([3.256, -17.506])]), base: Object.freeze([0, 0]),
    feet: Object.freeze([6.42, 7.56]), height: 22.55, over: 7.46, reach: 2.78,
    under: Object.freeze([[-0.14, -3.33, 7.76], [-1.7, 5.02, 7.46]].map((c) => Object.freeze(c))),
  }),
  Object.freeze({   // sunk - its kapok 2 m into its ground
    roots: Object.freeze([Object.freeze([-4.439, 15.926]), Object.freeze([4.439, -15.926])]), base: Object.freeze([0, -2]),
    feet: Object.freeze([6.42, 8.53]), height: 22.55, over: 4.12, reach: 4.28,
    under: Object.freeze([[-1.51, -4.83, 7.76], [-3.02, 6.17, 4.12], [-2.53, 6.3, 7.99], [-2.83, 3.62, 7.46]].map((c) => Object.freeze(c))),
  }),
]);

/** The roadside's numbers, in one place (metres unless said). */
export const JUNGLE_ROADSIDE = Object.freeze({
  /** a station every `step` along a road's arm from the pixel's middle, the first `first` out (past a junction's
   *  crossing), none within `end` of the pixel's edge (the next pixel's arm stands its own); each slid along the road by
   *  up to `jitter` either way. These keep every pair's trunks at least EDGE_MIN inside its pixel, every station of
   *  every arm (AUDIT JUNGLE-ROADSIDE LAW-4: a guard on it could never refuse one - the test walks them) */
  first: 44,
  step: 40,
  end: 24,
  jitter: 8,
  /** a station's chance of a pair, where everything else allows one */
  chance: 0.6,
  /** a pair's scale, of the owner's */
  scale: Object.freeze([0.92, 1.08]),
  /** SUNK, NEVER FLOATING: a pair stands this far under the lowest drawn ground beneath either foot */
  sink: 0.3,
  /** ...where neither trunk's own ground stands more than this over it (the uphill tree is buried by it) */
  bury: 3,
  /** ...and the road under it stands this far under what hangs lowest over each spot of it at least: a rider's head
   *  (player/motor.js RIDE_EYE_HEIGHT 2.51 and a quarter metre - AUDIT JUNGLE-ROADSIDE LAW-2: 1.5 m hung a liana's tip
   *  at a walker's face) */
  headroom: 2.75,
  /** no other jungle trunk within this of a pair's trunk (times the pair's scale) - the canopy's trunks' own nearest
   *  (jungleNature.js JUNGLE.inset: two sites' trunks never nearer than 9 m) */
  clear: 9,
  /** the stations' draws' salt */
  salt: 600,
});
/** How far inside its pixel a pair's trunk always stands (m) - by `first`, `end` and `jitter` alone, every arm, station,
 *  pair, turn and scale (the test walks them): farther than any neighbour pixel's trunk can come within `clear` of. */
export const EDGE_MIN = 19;

/** A map pixel's side (m) and its tile's. */
const PIXEL = TERRAIN_SIZE, HALF = PIXEL / 2;

/**
 * THE LOWEST DRAWN GROUND under a disc of `r` about (x, z) - the ground as it is drawn (terrainSurface.js
 * surfaceHeightAt: two planes a heightmap cell, cut on its diagonal - AUDIT JUNGLE-ROADSIDE DOC-5: not the bilinear
 * groundAt, which stands up to half a metre over it). The drawn ground is flat on each triangle, so its lowest under the
 * disc is at a sample inside the disc or on its rim; and on the rim, between two of the rim's crossings of the triangles'
 * edges, it is the one plane's - lowest at a crossing or where the rim faces straight down that plane. Every such point
 * is asked: the answer is the drawn ground's lowest, exactly.
 * @param {Float32Array} heightmapData @param {number} x @param {number} z @param {number} r
 */
export function lowestDrawn(heightmapData, x, z, r) {
  const hDim = HEIGHTMAP_DIMENSION, cell = PIXEL / (hDim - 1), yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const at = (i, j) => heightmapData[Math.max(0, Math.min(hDim - 1, i)) * hDim + Math.max(0, Math.min(hDim - 1, j))];
  let lo = surfaceHeightAt(heightmapData, x, z);
  const ask = (px, pz) => { lo = Math.min(lo, surfaceHeightAt(heightmapData, px, pz)); };
  const i0 = Math.floor((x - r) / cell), i1 = Math.ceil((x + r) / cell), j0 = Math.floor((z - r) / cell), j1 = Math.ceil((z + r) / cell);
  for (let i = Math.max(0, i0); i <= Math.min(hDim - 1, i1); i++) {
    for (let j = Math.max(0, j0); j <= Math.min(hDim - 1, j1); j++) if (Math.hypot(i * cell - x, j * cell - z) <= r) lo = Math.min(lo, heightmapData[i * hDim + j] * yScale);
  }
  // the rim's crossings of the grid's lines (x, then z) and of the cells' diagonals (x - z constant)
  for (let i = i0; i <= i1; i++) { const e = i * cell - x; if (Math.abs(e) <= r) { const h = Math.sqrt(r * r - e * e); ask(i * cell, z + h); ask(i * cell, z - h); } }
  for (let j = j0; j <= j1; j++) { const e = j * cell - z; if (Math.abs(e) <= r) { const h = Math.sqrt(r * r - e * e); ask(x + h, j * cell); ask(x - h, j * cell); } }
  for (let k = i0 - j1; k <= i1 - j0; k++) {
    const v = (k * cell - x + z) / (r * Math.SQRT2);   // cos(t + pi/4) on the rim x = x + r cos t, z = z + r sin t
    if (Math.abs(v) > 1) continue;
    const w = Math.acos(v);
    for (const t of [w - Math.PI / 4, -w - Math.PI / 4]) ask(x + r * Math.cos(t), z + r * Math.sin(t));
  }
  // where the rim faces straight down each triangle's plane
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
      for (const [gx, gz] of [[h11 - h01, h01 - h00], [h10 - h00, h11 - h10]]) {
        const g = Math.hypot(gx, gz);
        if (g > 0) ask(x - (r * gx) / g, z - (r * gz) / g);
      }
    }
  }
  return lo;
}

/**
 * THE HIGHEST DRAWN GROUND over a convex polygon (`corners`, [x, z] each, in order round it) - the drawn ground is flat
 * on each triangle (lowestDrawn), so its highest over the polygon is at a corner, where an edge crosses a triangle's
 * edge (a grid line or a cell's diagonal), or at a grid point inside: every one is asked.
 * @param {Float32Array} heightmapData @param {ReadonlyArray<ReadonlyArray<number>>} corners
 */
export function highestDrawn(heightmapData, corners) {
  const hDim = HEIGHTMAP_DIMENSION, cell = PIXEL / (hDim - 1), yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  let hi = -Infinity;
  const ask = (x, z) => { hi = Math.max(hi, surfaceHeightAt(heightmapData, x, z)); };
  const n = corners.length;
  for (let k = 0; k < n; k++) {
    const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % n];
    ask(x0, z0);
    // the edge's crossings of the lines x, z and x - z a whole number of cells
    for (const [f0, f1] of [[x0, x1], [z0, z1], [x0 - z0, x1 - z1]]) {
      if (f0 === f1) continue;
      for (let c = Math.ceil(Math.min(f0, f1) / cell); c * cell <= Math.max(f0, f1); c++) {
        const t = (c * cell - f0) / (f1 - f0);
        ask(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      }
    }
  }
  const xs = corners.map((c) => c[0]), zs = corners.map((c) => c[1]);
  const inside = (x, z) => {
    let sign = 0;
    for (let k = 0; k < n; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % n];
      const c = Math.sign((x1 - x0) * (z - z0) - (z1 - z0) * (x - x0));
      if (c && sign && c !== sign) return false;
      sign ||= c;
    }
    return true;
  };
  for (let i = Math.max(0, Math.ceil(Math.min(...xs) / cell)); i <= Math.min(hDim - 1, Math.floor(Math.max(...xs) / cell)); i++) {
    for (let j = Math.max(0, Math.ceil(Math.min(...zs) / cell)); j <= Math.min(hDim - 1, Math.floor(Math.max(...zs) / cell)); j++) {
      if (inside(i * cell, j * cell)) hi = Math.max(hi, heightmapData[i * hDim + j] * yScale);
    }
  }
  return hi;
}

/**
 * THE PAIRS A PIXEL STANDS - astride its roads and tracks (the network's arms, VERGE1's bands: world/road/roadBand.js
 * ARMS, roadRoom), in the jungle whole. Along each arm a station every JUNGLE_ROADSIDE.step, its draws a hash of its
 * world tile (terrainNature.js tileDraw: every client, every rebuild the same pairs); at a station a pair of one of the
 * owner's three, turned either way round, at its own scale, its axis across the road and its two feet's gap centred on
 * the road's line, turned so (turnXZ) - and it stands only where:
 *   - both trunks stand on ground the jungle's trees stand on (`tileOk` - whole jungle, a ground that grows, no slope
 *     past the trees' 34 degrees, no place's fields or clearing);
 *   - both feet keep off every road and track band (roadRoom - its own pixel's and its neighbours') and off the jungle's
 *     trails (`trailOk`);
 *   - neither trunk is buried past `bury` (its own drawn ground over where the pair stands);
 *   - every `under` cell (what hangs over its road's band) keeps `headroom` over the drawn ground's highest under it,
 *     and the road anywhere under the pair (across its band, along it as far as anything hangs over it) keeps it under
 *     UNDER_TOP (highestDrawn, both);
 *   - no trunk of a pair it already stood is within `clear`.
 * SUNK, NEVER FLOATING (the owner: "sunk into the ground so they dont float"): the pair is one rigid thing - its lianas
 * hang from both crowns - so it stands at the LOWEST drawn ground beneath either foot (lowestDrawn, exact) less `sink`:
 * nowhere under its feet is the ground lower than its own, and the uphill tree's roots go into the slope. Answers
 * `[{ kind, js, turn, ax, az, y, trees: [{ species, record, x, z, y }] }]`, pixel-local - `y` where the pair stands (its
 * halves' instances), each tree's `y` its far picture's (`base` on it).
 * @param {{ px: number, py: number, net: any, heightmapData: Float32Array, tileOk: (tx: number, ty: number) => boolean,
 *   trailOk: (x: number, z: number, r: number) => boolean }} job
 */
export function standPairs({ px, py, net, heightmapData, tileOk, trailOk }) {
  const bits = net ? pathsDataPoint(net, px, py) : 0;
  if (!bits) return [];
  const R = JUNGLE_ROADSIDE, tile = PIXEL / WORLD_MAP_TILE_DIM;
  const ox = px * WORLD_MAP_TILE_DIM, oz = -py * WORLD_MAP_TILE_DIM;
  const ground = (x, z) => surfaceHeightAt(heightmapData, x, z);
  const out = [], trunks = [];
  for (const [bit, sx, sz] of ARMS) {
    if (!(bits & bit)) continue;
    const len = Math.hypot(sx, sz) * HALF, rx = sx / Math.hypot(sx, sz), rz = sz / Math.hypot(sx, sz);
    for (let s0 = R.first; s0 <= len - R.end; s0 += R.step) {
      const wx = ox + Math.floor((HALF + rx * s0) / tile), wz = oz + Math.floor((HALF + rz * s0) / tile);
      if (tileDraw(wx, wz, R.salt) >= R.chance) continue;
      const s = s0 + (tileDraw(wx, wz, R.salt + 1) * 2 - 1) * R.jitter;
      const kind = Math.min(JUNGLE_PAIRS.length - 1, Math.floor(tileDraw(wx, wz, R.salt + 2) * JUNGLE_PAIRS.length));
      const flip = tileDraw(wx, wz, R.salt + 3) < 0.5;
      const js = R.scale[0] + (R.scale[1] - R.scale[0]) * tileDraw(wx, wz, R.salt + 4);
      const m = JUNGLE_PAIR_MEASURES[kind], [[lax, laz], [lbx, lbz]] = m.roots;
      // the axis across the road, from the first tree to the second; the gap between the feet centred on the road's line
      const ux = flip ? rz : -rz, uz = flip ? -rx : rx;
      const turn = Math.atan2(lbz - laz, lbx - lax) - Math.atan2(uz, ux);
      const qx = HALF + rx * s, qz = HALF + rz * s, mid = ((m.feet[0] - m.feet[1]) / 2) * js;
      const ax = qx - ux * mid, az = qz - uz * mid;
      const trees = m.roots.map(([x, z], t) => {
        const [dx, dz] = turnXZ(x * js, z * js, turn);
        return { species: JUNGLE_PAIRS[kind].trees[t], x: ax + dx, z: az + dz, foot: m.feet[t] * js };
      });
      if (!trees.every((t) => tileOk(Math.floor(t.x / tile), Math.floor(t.z / tile)))) continue;
      if (!trees.every((t) => roadRoom(net, px, py, t.x, t.z, t.foot) >= t.foot && trailOk(t.x, t.z, t.foot))) continue;
      if (trees.some((t) => trunks.some((u) => Math.hypot(t.x - u.x, t.z - u.z) < R.clear * js))) continue;
      const y = Math.min(...trees.map((t) => lowestDrawn(heightmapData, t.x, t.z, t.foot))) - R.sink;
      if (trees.some((t) => ground(t.x, t.z) - y > R.bury)) continue;
      // the road under it: each `under` cell keeps the headroom over the drawn ground's highest under it (AUDIT
      // JUNGLE-ROADSIDE: read at the cell's middle, a graded road came 1 cm nearer), and the road under the rest (over
      // UNDER_TOP) keeps it under UNDER_TOP
      const h = (UNDER_CELL * js) / 2;
      const square = (x, z, across, along) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [x + ux * i * across + rx * j * along, z + uz * i * across + rz * j * along]);
      if (m.under.some(([cx, cz, cy]) => {
        const [dx, dz] = turnXZ(cx * js, cz * js, turn);
        return highestDrawn(heightmapData, square(ax + dx, az + dz, h, h)) + R.headroom > y + cy * js;
      })) continue;
      if (highestDrawn(heightmapData, square(qx, qz, PATH_HALF_M, m.reach * js)) + R.headroom > y + UNDER_TOP * js) continue;
      for (const t of trees) trunks.push(t);
      out.push({ kind, js, turn, ax, az, y, trees: trees.map((t, k) => ({ species: t.species, record: JUNGLE_SPECIES[t.species].record, x: t.x, z: t.z, y: y + m.base[k] * js })) });
    }
  }
  return out;
}
